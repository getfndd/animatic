/**
 * master-persist.js — durable persistence + one-button encode for render_master
 * (ANI-185, follow-up to ANI-183, epic ANI-181).
 *
 * `render_master` returns in-memory renderable artifacts (`{ manifest, sceneDefs,
 * timelines }` per aspect). This module closes the two gaps to a one-call master:
 *
 *   1. persistMaster — writes each emitted artifact to disk under the project
 *      (`masters/<tier>/<id>/{manifest.json, scenes/*.json, timelines.json}`)
 *      plus a `masters/<tier>/master.json` index, then returns the relative
 *      paths so the caller can register them.
 *
 *   2. encodeMaster — the opt-in chain: hands each artifact to
 *      assemble_video_sequence → renderRemotionSequence to produce ONE master
 *      MP4 per aspect (the "source of truth for all encodes"). The master's audio
 *      is realized here per the tier's audio_policy (ANI-188/189), then each
 *      delivery profile is transcoded off its matching-aspect master (ANI-190,
 *      fail-soft per profile; max_size_mb enforced as a gate). GIF / caption
 *      burn-in still defer. The caller invokes encodeMaster only when the
 *      fail-closed gate passes (verdict !== BLOCK); we never encode a BLOCKed master.
 */

import { join } from 'node:path';
import { mkdir, writeFile, stat } from 'node:fs/promises';

import { assembleVideoSequence } from './video-assembly.js';
import { renderRemotionSequence } from './video.js';
import { realizeAudioPolicy } from './master-audio.js';
import { buildTranscodeArgs } from './delivery-profiles.js';

/** Default ffmpeg runner for delivery transcodes (injectable in tests). */
async function runFfmpeg(args) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  await promisify(execFile)('ffmpeg', args, { timeout: 600_000 });
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** ratio → filesystem-safe dir token ('16:9' → '16x9'). */
function ratioToken(ratio) {
  return String(ratio).replace(/[:/]/g, 'x');
}

/** Map an encode resolution to its aspect bucket (all delivery profiles fall in these three). */
function aspectOf({ w, h }) {
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return '1:1';
  return r < 1 ? '9:16' : '16:9';
}

async function writeJSON(absPath, data) {
  await writeFile(absPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Flatten a master into [primary, ...variants] with a stable dir id per artifact. */
function artifactList(master) {
  return [
    { id: 'primary', ratio: master.primary.ratio, manifest: master.primary.manifest, sceneDefs: master.primary.sceneDefs, timelines: master.primary.timelines },
    ...master.aspect_variants.map(v => ({ id: ratioToken(v.ratio), ratio: v.ratio, manifest: v.manifest, sceneDefs: v.sceneDefs, timelines: v.timelines })),
  ];
}

// ── persistMaster ──────────────────────────────────────────────────────────────

/**
 * Write a render_master result's artifacts to disk under `masters/<tier>/`.
 *
 * @param {object} params
 * @param {object} params.master - `result.master` from renderMaster.
 * @param {string} params.verdict - the roll-up gate verdict.
 * @param {Array}  [params.gateByArtifact] - `result.gate_by_artifact`.
 * @param {string} params.projectRoot - absolute project root.
 * @param {string} params.tier - 'T1'..'T4'.
 * @returns {Promise<{ dir: string, index: string, artifacts: Array }>} relative paths.
 */
export async function persistMaster({ master, verdict, gateByArtifact = [], projectRoot, tier }) {
  const tierDir = join('masters', tier);
  const artifacts = artifactList(master);
  const artifactRecords = [];

  for (const a of artifacts) {
    const aRel = join(tierDir, a.id);
    const aAbs = join(projectRoot, aRel);
    await mkdir(join(aAbs, 'scenes'), { recursive: true });

    await writeJSON(join(aAbs, 'manifest.json'), a.manifest);
    await writeJSON(join(aAbs, 'timelines.json'), a.timelines || {});

    const scenes = [];
    for (const [sceneId, def] of Object.entries(a.sceneDefs || {})) {
      const rel = join(aRel, 'scenes', `${sceneId}.json`);
      await writeJSON(join(projectRoot, rel), def);
      scenes.push({ scene_id: sceneId, path: rel });
    }

    artifactRecords.push({
      id: a.id,
      ratio: a.ratio,
      dir: aRel,
      manifest: join(aRel, 'manifest.json'),
      timelines: join(aRel, 'timelines.json'),
      scenes,
    });
  }

  const indexRel = join(tierDir, 'master.json');
  const index = {
    profile: master.profile,
    tier: master.tier,
    verdict,
    finish_preset: master.finish_preset,
    audio_policy: master.audio_policy,
    retime: master.retime,
    render_routes: master.render_routes,
    delivery_profiles: (master.delivery_profiles || []).map(d => d.slug),
    gate_by_artifact: gateByArtifact.map(g => ({ artifact: g.artifact, ratio: g.ratio, verdict: g.verdict })),
    artifacts: artifactRecords,
  };
  await writeJSON(join(projectRoot, indexRel), index);

  return { dir: tierDir, index: indexRel, artifacts: artifactRecords };
}

// ── encodeMaster ───────────────────────────────────────────────────────────────

/**
 * Chain each emitted artifact through assemble_video_sequence → Remotion to
 * produce one master MP4 per aspect. Fail-closed: the caller invokes this only
 * for an emitted (non-BLOCK) master.
 *
 * Delivery-profile transcodes are resolved into descriptors (which aspect master
 * they derive from, their target codec/resolution/fps/crf) but NOT executed —
 * see the module header.
 *
 * @param {object} params
 * @param {object} params.master - `result.master` from renderMaster.
 * @param {Array}  params.persistedArtifacts - records from persistMaster (carry dir + paths).
 * @param {string} params.projectRoot - absolute project root.
 * @param {string} params.tier - 'T1'..'T4'.
 * @param {boolean} [params.dryRun=false] - assemble props + resolve the plan, skip the Remotion spawn.
 * @param {function} [params.render=renderRemotionSequence] - injectable renderer (tests).
 * @returns {Promise<{ masters: Array, transcodes: Array, note: string }>}
 */
export async function encodeMaster({ master, persistedArtifacts, projectRoot, tier, dryRun = false, render = renderRemotionSequence, brand, audioExec, audioRename, transcodeExec }) {
  // [P1] render_routes is an ARRAY of { scene_id, render_target, ... };
  // assemble_video_sequence wants a scene_id→route MAP (routes[sceneId]).
  // Passing the array would miss every lookup and silently fall back to
  // remotion_native, breaking the tier's route policy. Convert first.
  const routes = Object.fromEntries((master.render_routes || []).map(r => [r.scene_id, r]));

  const artifacts = artifactList(master);
  const recById = new Map(persistedArtifacts.map(r => [r.id, r]));

  const masters = [];
  for (const a of artifacts) {
    const rec = recById.get(a.id);
    const encodeDir = join(rec.dir, 'encode');                 // masters/<tier>/<id>/encode
    const propsRel = join(encodeDir, 'render-props.json');
    const outputRel = join(encodeDir, 'master.mp4');
    const propsAbs = join(projectRoot, propsRel);
    const outputAbs = join(projectRoot, outputRel);

    // assemble writes render-props.json into the encode dir — the persisted
    // source of truth for this artifact's encode.
    const { renderProps, sceneRoutes, warnings } = assembleVideoSequence({
      manifest: a.manifest,
      sceneDefs: a.sceneDefs,
      timelines: a.timelines,
      routes,
      outputDir: join(projectRoot, encodeDir),
    });

    let encoded = false;
    if (!dryRun) {
      // [P2b] encode from the PERSISTED props file, not a fresh temp, so the
      // on-disk artifact and the MP4 it claims to reproduce can't drift.
      await render(renderProps, outputAbs, { propsPath: propsAbs });
      encoded = true;
    }

    // ANI-188: realize the tier's audio_policy on top of the encoded master
    // (the Remotion-embedded bed is already in the MP4; this is the VO/duck +
    // captions pass). Plans only when dry — the MP4 must exist to mux into.
    const audio = await realizeAudioPolicy({
      artifact: { manifest: a.manifest, sceneDefs: a.sceneDefs },
      masterMp4Rel: outputRel,
      projectRoot,
      policy: master.audio_policy,
      brand,
      dryRun,
      ...(audioExec ? { exec: audioExec } : {}),
      ...(audioRename ? { rename: audioRename } : {}),
    });

    masters.push({
      artifact: a.id,
      ratio: a.ratio,
      props: propsRel,
      output: outputRel,
      render_targets: sceneRoutes,
      warnings,
      encoded,
      audio,
    });
  }

  // Per delivery profile: transcode the matching-aspect master down to the
  // profile's target (ANI-190 — "render once, deliver many"). Fail-soft per
  // profile (one failure never aborts the rest). GIF / caption burn-in / max-size
  // still defer (need a palettegen / subtitles / 2-pass path).
  const byRatio = new Map(masters.map(m => [m.ratio, m]));
  const deliveryDir = join('masters', tier, 'delivery');
  const runTranscode = transcodeExec || runFfmpeg;
  const transcodes = [];
  for (const profile of master.delivery_profiles || []) {
    const aspect = aspectOf(profile.resolution);
    const source = byRatio.get(aspect) || byRatio.get(master.primary.ratio);
    // Codec-aware container: ProRes must be .mov (ffmpeg rejects prores_ks in mp4).
    const ext = profile.codec === 'gif' ? 'gif' : profile.codec === 'prores' ? 'mov' : 'mp4';
    const outputRel = join(deliveryDir, `${profile.slug}.${ext}`);
    const rec = {
      profile: profile.slug,
      aspect,
      source_master: source?.output || null,
      target: { resolution: profile.resolution, fps: profile.fps, codec: profile.codec, crf: profile.crf ?? null, audio: profile.audio ?? null },
      output: outputRel,
    };

    // GIF still defers (needs a palettegen pass this runner doesn't cover).
    if (profile.codec === 'gif') { transcodes.push({ ...rec, deferred: true, reason: 'gif needs a palettegen pass — deferred' }); continue; }
    if (!source?.output) { transcodes.push({ ...rec, deferred: true, reason: 'no matching-aspect master to transcode from' }); continue; }

    // Caption burn-in (ANI-193): burn the matching-aspect master's captions
    // sidecar (written by the audio pass, ANI-188) into the picture. No sidecar
    // (no authored scene.captions) → keep deferred rather than ship blank burn-in.
    let burnIn = null;
    if (profile.captions?.mode === 'burn_in') {
      const sidecar = source?.audio?.captions?.written ? source.audio.captions.path : null;
      if (!sidecar) { transcodes.push({ ...rec, deferred: true, reason: 'burn_in: no captions sidecar (no authored scene.captions)' }); continue; }
      burnIn = join(projectRoot, sidecar);
    }

    const args = buildTranscodeArgs(profile, join(projectRoot, source.output), join(projectRoot, outputRel), burnIn ? { burnInSubtitles: burnIn } : {});
    if (dryRun) { transcodes.push({ ...rec, deferred: true, command: args }); continue; }
    if (!source.encoded) { transcodes.push({ ...rec, deferred: true, reason: 'source master not encoded — nothing to transcode' }); continue; }

    try {
      await mkdir(join(projectRoot, deliveryDir), { recursive: true });
      await runTranscode(args);

      // Enforce max_size_mb as a GATE: a single-pass CRF transcode doesn't target
      // a byte budget, so check the result and refuse to call an over-cap file a
      // clean deliverable. (Auto-correcting via a 2-pass re-encode is a follow-up.)
      const cap = profile.max_size_mb;
      let sizeMb = null;
      try { sizeMb = (await stat(join(projectRoot, outputRel))).size / (1024 * 1024); } catch { /* no file (e.g. injected exec in tests) — size unverifiable */ }
      if (cap != null && sizeMb != null && sizeMb > cap) {
        transcodes.push({ ...rec, deferred: true, oversize: true, size_mb: Math.round(sizeMb * 10) / 10, max_size_mb: cap, reason: `over max_size_mb (${Math.round(sizeMb * 10) / 10}MB > ${cap}MB) — single-pass CRF; 2-pass size targeting is a follow-up` });
      } else {
        transcodes.push({ ...rec, deferred: false, encoded: true, ...(burnIn ? { captions_burned: true } : {}), ...(sizeMb != null ? { size_mb: Math.round(sizeMb * 10) / 10 } : {}), ...(cap != null ? { max_size_mb: cap } : {}) });
      }
    } catch (err) {
      // Fail-soft: record the failure, keep going (one bad profile ≠ a dead encode).
      // A burn-in failure on a filtergraph/subtitles error almost always means the
      // ffmpeg build lacks libass — say so rather than surfacing a cryptic parse error.
      const libassHint = burnIn && /filterchain|subtitles|No such filter/i.test(err.message)
        ? ' (caption burn-in needs an ffmpeg built with libass)' : '';
      transcodes.push({ ...rec, deferred: true, error: err.message + libassHint });
    }
  }

  return {
    masters,
    transcodes,
    note: 'One master MP4 per aspect (audio realized per audio_policy, ANI-188/189); delivery-profile transcodes executed off each aspect master (ANI-190, codec-aware container; max_size_mb enforced as a gate), with gif/caption-burn-in still deferred.',
  };
}
