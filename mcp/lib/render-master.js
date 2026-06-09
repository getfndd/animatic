/**
 * render_master — One Source, Four Masters orchestrator (ANI-183, epic ANI-181)
 *
 * Composes tools we already ship into a tier master, gated by the ANI-178
 * hero-frame contract. Thin orchestration; no new rendering infra. The emitted
 * master is a *renderable artifact* (`{ manifest, sceneDefs, timelines }` per
 * aspect), handed to `assemble_video_sequence` for the actual encode — NOT
 * `render_project`, which loads scene defs from disk and would drop the
 * recomposed sceneDefs.
 *
 * The honesty contract (spike fault line 2): a master may re-time and re-finish,
 * never re-author. `composeMaster` asserts every emitted artifact has the same
 * scene set/order as the source; anything else is a fork (create_social_cutdown).
 */

import { getMasterProfile, RETIME_OPS } from './master-profiles.js';
import { resolveRenderTargets } from './render-routing.js';
import { adaptManifestAspectRatio, recomposeSceneForRatio } from './social-formats.js';
import { getDeliveryProfile } from './delivery-profiles.js';
import { syncSequenceToBeats } from './audio-sync.js';
import { applyFinishPreset } from '../runtime.js';
import { auditHeroFrames } from './hero-frame.js';
import { compileAllScenes } from './compiler.js';
import { loadProjectSource, getProject, saveProjectArtifact } from './projects.js';
import { persistMaster, encodeMaster } from './master-persist.js';
import { loadPrimitivesCatalog, loadRecipes } from '../data/loader.js';

const VERDICT_RANK = { PASS: 0, WARN: 1, BLOCK: 2 };

// ── helpers ──────────────────────────────────────────────────────────────────

function toSceneDefs(scenes) {
  if (!scenes) return {};
  if (Array.isArray(scenes)) {
    const map = {};
    for (const s of scenes) if (s?.scene_id) map[s.scene_id] = s;
    return map;
  }
  return scenes; // already a scene_id → def map
}

function sceneOrder(manifest) {
  return (manifest?.scenes || []).map(e => e.scene || e.scene_id || e.id).filter(Boolean);
}

/** Assert an artifact is a pure function of source — same scene set + order. */
function assertNoReauthor(sourceOrder, artifactManifest, label) {
  const order = sceneOrder(artifactManifest);
  if (order.length !== sourceOrder.length || order.some((id, i) => id !== sourceOrder[i])) {
    throw new Error(`render_master honesty violation: ${label} re-authored the scene set/order (source [${sourceOrder.join(',')}] → [${order.join(',')}]). Masters re-time + re-finish only; use create_social_cutdown for a new source.`);
  }
}

/** Constrain resolved render routes to a profile's policy (pin / resolve+allowed). */
function constrainRoutes(routes, policy) {
  if (policy.mode === 'pin') {
    return routes.map(r => (r.render_target === policy.target
      ? r
      : { ...r, render_target: policy.target, reason: `pinned to ${policy.target} by master profile`, constrained_from: r.render_target }));
  }
  // resolve: keep the resolver's choice when allowed, else snap to prefer/first allowed.
  const allowed = new Set(policy.allowed || []);
  const fallback = policy.prefer && allowed.has(policy.prefer) ? policy.prefer : (policy.allowed || [])[0];
  return routes.map(r => (allowed.has(r.render_target)
    ? r
    : { ...r, render_target: fallback, reason: `constrained to ${fallback} (allowed: ${[...allowed].join(', ')})`, constrained_from: r.render_target }));
}

// ── composeMaster (pure) ───────────────────────────────────────────────────────

/**
 * Compose a tier master from a source. Pure (no catalog I/O / no render). Applies
 * retime (if profile allows + beats given), finish, route policy, and the aspect
 * set (recomposing both manifest and sceneDefs). Returns the primary master + the
 * non-source aspect variants, each as `{ manifest, sceneDefs }`.
 *
 * @returns {{ primary, aspect_variants, render_routes, delivery_profiles, retime }}
 */
export function composeMaster({ manifest, scenes, profile, beats, personality }) {
  if (!manifest?.scenes) throw new Error('composeMaster requires a manifest with scenes');
  const sourceOrder = sceneOrder(manifest);
  const sourceSceneDefs = toSceneDefs(scenes);
  const scenesArray = Object.values(sourceSceneDefs);
  const sourceRatio = manifest.format?.aspect_ratio || '16:9';
  const sourceResolution = manifest.resolution || { w: 1920, h: 1080 };

  let workManifest = JSON.parse(JSON.stringify(manifest));

  // 1. Retime — only if the profile allows it AND beats are provided. Duration-only.
  let retime = { applied: false, ops_allowed: profile.retime_policy };
  if (profile.retime_policy.length > 0 && beats?.beats?.length) {
    const synced = syncSequenceToBeats(workManifest, beats);
    assertNoReauthor(sourceOrder, synced.manifest, 'retime');
    workManifest = synced.manifest;
    retime = { applied: true, ops_allowed: profile.retime_policy, adjustments: synced.sync_report?.adjustments || [] };
  }

  // 2. Finish.
  if (profile.finish_preset) {
    workManifest = applyFinishPreset(workManifest, profile.finish_preset).manifest;
  }

  // 3. Render routes (constrained to the profile policy), then STAMP them onto
  //    the artifact so the routes travel with it. assemble_video_sequence
  //    re-resolves routing from the manifest+sceneDefs (render-routing priority:
  //    scene.render_target > entry.render_target > render_target_default); if the
  //    constrained routes aren't written back, the encode can re-pick a target
  //    that violates the master profile (e.g. T1 web_native → remotion_native).
  //    Stamp the scene def (priority 1, authoritative) + the manifest entry +,
  //    for pin mode, render_target_default.
  const resolved = resolveRenderTargets(scenesArray, { manifest: workManifest, personality });
  const render_routes = constrainRoutes(resolved.routes, profile.render_target_policy);
  const routeByScene = new Map(render_routes.map(r => [r.scene_id, r.render_target]));
  const policy = profile.render_target_policy;

  const stampManifestRoutes = (m) => {
    for (const entry of m.scenes || []) {
      const id = entry.scene || entry.scene_id || entry.id;
      if (routeByScene.has(id)) entry.render_target = routeByScene.get(id);
    }
    if (policy.mode === 'pin') m.render_target_default = policy.target;
    return m;
  };
  const stampSceneDefRoute = (id, def) => {
    if (routeByScene.has(id)) def.render_target = routeByScene.get(id);
    return def;
  };

  stampManifestRoutes(workManifest);

  // 4. Aspect set — primary is the source ratio; others are deterministic recompositions.
  //    Clone the source scene defs for the primary so stamping never mutates the caller's input.
  const primarySceneDefs = {};
  for (const [id, def] of Object.entries(sourceSceneDefs)) {
    primarySceneDefs[id] = stampSceneDefRoute(id, JSON.parse(JSON.stringify(def)));
  }
  const primary = { manifest: workManifest, sceneDefs: primarySceneDefs };
  assertNoReauthor(sourceOrder, primary.manifest, `${sourceRatio} primary`);

  const aspect_variants = [];
  for (const ratio of profile.aspect_set) {
    if (ratio === sourceRatio) continue;
    const variantManifest = stampManifestRoutes(adaptManifestAspectRatio(workManifest, ratio, { recompose: true }));
    assertNoReauthor(sourceOrder, variantManifest, `${ratio} variant`);
    const variantSceneDefs = {};
    for (const [id, def] of Object.entries(sourceSceneDefs)) {
      variantSceneDefs[id] = stampSceneDefRoute(id, recomposeSceneForRatio(def, ratio, sourceResolution));
    }
    aspect_variants.push({ ratio, resolution: variantManifest.resolution, manifest: variantManifest, sceneDefs: variantSceneDefs });
  }

  // 5. Delivery profiles.
  const delivery_profiles = profile.delivery_profiles.map(getDeliveryProfile).filter(Boolean);

  return { primary, aspect_variants, render_routes, delivery_profiles, retime };
}

// ── renderMaster (async orchestrator) ──────────────────────────────────────────

let _catalogs = null;
function getCatalogs() {
  if (!_catalogs) _catalogs = { primitives: loadPrimitivesCatalog(), recipes: loadRecipes() };
  return _catalogs;
}

/**
 * Resolve + gate + compose a tier master.
 *
 * @param {object} params
 * @param {string} [params.project] - Project slug/path (loaded from disk) — OR pass manifest+scenes.
 * @param {object} [params.manifest] - Inline source manifest (skips project load; for tests/demos).
 * @param {object[]|object} [params.scenes] - Inline scene defs (array or scene_id→def map).
 * @param {string} params.tier - Profile name ('video') or tier ('T3').
 * @param {object} [params.beats] - Beat data (enables retime where the profile allows).
 * @param {object} [params.brand] - Brand package (informs the gate).
 * @param {function} [params.capture] - Injected still-capture (tests / metadata-only).
 * @param {object} [params.client] - Injected vision client (tests).
 * @param {boolean} [params.persist] - Write each emitted artifact under masters/<tier>/ and register it. Requires `project`.
 * @param {boolean} [params.encode] - Implies persist. Chain each emitted artifact to assemble_video_sequence → Remotion (one MP4 per aspect), AFTER the fail-closed gate. Requires `project`; skipped on BLOCK.
 * @param {boolean} [params.dry_run_encode] - With `encode`, assemble props + resolve the plan but skip the Remotion spawn.
 * @param {function} [params.encodeRender] - Injected renderer for encodeMaster (tests).
 * @returns {Promise<object>} { profile, tier, verdict, emitted, block_reason, gate_by_artifact, master, persisted?, encode?, notes }
 */
export async function renderMaster({ project, manifest, scenes, tier, beats, brand, capture, client, persist, encode, dry_run_encode, encodeRender } = {}) {
  const profile = getMasterProfile(tier);
  if (!profile) {
    throw new Error(`Unknown master tier "${tier}". Use one of: prototype/directed-html/video/hero-film or T1–T4.`);
  }

  // 1. Load source (inline preferred for testability; else from the project).
  let srcManifest = manifest;
  let srcScenes = scenes;
  let projectId = null;
  if (!srcManifest || !srcScenes) {
    if (!project) throw new Error('renderMaster requires either { manifest, scenes } or { project }');
    const loaded = await loadProjectSource(project);
    srcManifest = loaded.manifest;
    srcScenes = loaded.sceneDefs;
    projectId = loaded.project.slug || project;
  }
  const personality = brand?.personality || srcManifest.personality;

  // 2. Compose (pure).
  const composed = composeMaster({ manifest: srcManifest, scenes: srcScenes, profile, beats, personality });

  // 3. Build the emitted artifacts and compile their timelines.
  const catalogs = getCatalogs();
  const artifacts = [
    { id: 'primary', ratio: srcManifest.format?.aspect_ratio || '16:9', manifest: composed.primary.manifest, sceneDefs: composed.primary.sceneDefs },
    ...composed.aspect_variants.map(v => ({ id: v.ratio, ratio: v.ratio, manifest: v.manifest, sceneDefs: v.sceneDefs })),
  ];
  for (const a of artifacts) {
    const compiled = compileAllScenes(a.manifest, a.sceneDefs, catalogs, { personality });
    a.sceneDefs = compiled.sceneDefs;   // compiled (generated layers)
    a.timelines = compiled.timelines;
  }

  // 4. Gate EACH emitted artifact at the tier (not the source), with timelines so
  //    the stills reflect what the sequence renderer ships.
  const gate_by_artifact = [];
  for (const a of artifacts) {
    const gate = await auditHeroFrames({
      manifest: a.manifest, scenes: a.sceneDefs, tier: profile.tier, brand,
      timelines: a.timelines, capture, client,
    });
    gate_by_artifact.push({ artifact: a.id, ratio: a.ratio, verdict: gate.verdict, evidence_summary: gate.evidence_summary, findings: gate.findings, scenes: gate.scenes });
  }

  // 5. Roll up + explicit BLOCK reason.
  let verdict = 'PASS';
  for (const g of gate_by_artifact) if (VERDICT_RANK[g.verdict] > VERDICT_RANK[verdict]) verdict = g.verdict;
  const emitted = verdict !== 'BLOCK';

  let block_reason = null;
  if (verdict === 'BLOCK') {
    // Distinguish "no rendered/vision evidence" from "quality below threshold".
    const anyUnverified = gate_by_artifact.some(g =>
      (g.evidence_summary?.rendered ?? 0) === 0 ||
      (g.scenes || []).some(s => (s.unverified || []).length > 0));
    block_reason = anyUnverified
      ? 'unverified: needs rendered frames + a vision judge — set ANTHROPIC_API_KEY and run with the Remotion toolchain (this is a missing-evidence block, not a quality failure)'
      : 'below_threshold: an emitted artifact scored under the tier hero-frame threshold (see gate_by_artifact for the weak axis)';
  }

  // 6. Emit (in-memory renderable artifacts; hand to assemble_video_sequence to encode).
  const master = {
    profile: profile.name,
    tier: profile.tier,
    project: projectId,
    finish_preset: profile.finish_preset,
    audio_policy: profile.audio_policy,
    retime: composed.retime,
    render_routes: composed.render_routes,
    delivery_profiles: composed.delivery_profiles,
    primary: { ratio: artifacts[0].ratio, manifest: artifacts[0].manifest, sceneDefs: artifacts[0].sceneDefs, timelines: artifacts[0].timelines },
    aspect_variants: artifacts.slice(1).map(a => ({ ratio: a.ratio, manifest: a.manifest, sceneDefs: a.sceneDefs, timelines: a.timelines })),
  };

  // 7. Durable persistence + one-button encode (ANI-185, opt-in). Both require a
  //    project to write under. Encode implies persist and is fail-closed: a
  //    BLOCKed master is persisted (for inspection) but never encoded.
  let persisted = null;
  let encodeResult = null;
  if (persist || encode) {
    if (!project) {
      throw new Error('render_master persist/encode requires a `project` to write artifacts under (inline manifest+scenes has nowhere to persist).');
    }
    const proj = await getProject({ project });
    if (!proj) throw new Error(`Project "${project}" not found`);
    const projectRoot = proj.project_root;

    persisted = await persistMaster({ master, verdict, gateByArtifact: gate_by_artifact, projectRoot, tier: profile.tier });
    await saveProjectArtifact({
      project,
      kind: 'master',
      path: persisted.index,
      role: profile.tier,
      metadata: { tier: profile.tier, profile: profile.name, verdict, emitted, aspects: persisted.artifacts.map(a => a.ratio) },
    });

    if (encode) {
      encodeResult = emitted
        ? await encodeMaster({
            master,
            persistedArtifacts: persisted.artifacts,
            projectRoot,
            tier: profile.tier,
            dryRun: dry_run_encode === true,
            ...(encodeRender ? { render: encodeRender } : {}),
          })
        : { skipped: 'gate BLOCK — fail-closed, no encode', verdict };
    }
  }

  const notes = [`Encode via assemble_video_sequence with each artifact's { manifest, sceneDefs, timelines }.`];
  if (persisted) notes.push(`Persisted master to ${persisted.index}.`);
  if (encodeResult?.note) notes.push(encodeResult.note);

  return {
    profile: profile.name,
    tier: profile.tier,
    verdict,
    emitted,
    block_reason,
    gate_by_artifact,
    master: emitted ? master : { ...master, note: 'not emitted — gate BLOCK; plan returned for inspection only' },
    persisted,
    encode: encodeResult,
    retime_ops_allowed: RETIME_OPS,
    notes,
  };
}
