/**
 * master-audio.js — per-tier audio realization at encode (ANI-188, epic ANI-181).
 *
 * The master profiles carry an `audio_policy` per tier
 * (`muted` → `muted-autoplay` → `mix` → `full-mix`), but render_master only
 * *recorded* it. This realizes it at encode time, composing the audio surfaces
 * we already ship — never a new ffmpeg graph:
 *
 *   - the Remotion-embedded music bed (`manifest.audio`, ANI-106) is already in
 *     the master MP4 after the encode; this is the POST-encode pass on top.
 *   - voiceover: planVoiceoverClips → prepareVoiceoverTrack → muxVoiceoverIntoRender
 *     (ducks the bed under narration, ANI-129).
 *   - captions: buildCaptionsSidecar (authored scene.captions → VTT sidecar).
 *
 * Policy → realization:
 *   T1 muted          — no audio track.
 *   T2 muted-autoplay — keep the embedded bed; plays muted on autoplay; no mux.
 *   T3 mix            — duck VO under the bed (aac), captions sidecar, 48 kHz master.
 *   T4 full-mix       — VO + ducked bed, captions, 48 kHz. Sonic cues are RESOLVED
 *                       but DEFERRED — buildDuckedMuxArgs only mixes bed+VO, and a
 *                       timed cue-mix needs a new builder + tests (follow-up).
 *
 * Dry-run seam: planning (planVoiceoverClips, caption collection, source resolution)
 * is pure and never calls TTS or ffmpeg; synthesis + mux happen only when realizing.
 */

import { join, dirname } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

import { planVoiceoverClips, prepareVoiceoverTrack, muxVoiceoverIntoRender, renderHasEmbeddedAudio } from './voiceover-mix.js';
import { buildCaptionsSidecar } from './captions.js';

/** The master mix sample rate — archival/source-of-truth; delivery profiles resample. */
const MASTER_SAMPLE_RATE = 48000;

const POLICY_SPEC = {
  muted: { mux: false, captions: false, vo: false },
  'muted-autoplay': { mux: false, captions: false, vo: false, muted_default: true },
  mix: { mux: true, captions: true, vo: true, sonic_cues: false },
  'full-mix': { mux: true, captions: true, vo: true, sonic_cues: true },
};

/**
 * Realize one artifact's audio per the tier's `audio_policy`. Builds the plan
 * always; synthesizes + muxes only when `dryRun` is false (the master MP4 must
 * already exist on disk).
 *
 * @param {object} params
 * @param {object} params.artifact - { manifest, sceneDefs } for this aspect.
 * @param {string} params.masterMp4Rel - Relative path to the aspect's master MP4.
 * @param {string} params.projectRoot - Absolute project root.
 * @param {string} params.policy - audio_policy ('muted' | 'muted-autoplay' | 'mix' | 'full-mix').
 * @param {object} [params.brand] - Brand package (for sonic_cues resolution).
 * @param {boolean} [params.dryRun=false] - Plan only; no TTS / ffmpeg / writes.
 * @param {string} [params.ttsProvider] - TTS provider override (tests / determinism).
 * @param {function} [params.exec] - ffmpeg runner override (tests).
 * @param {function} [params.rename] - fs rename override (tests).
 * @returns {Promise<object>} the audio plan/realization record.
 */
export async function realizeAudioPolicy({ artifact, masterMp4Rel, projectRoot, policy, brand, dryRun = false, ttsProvider, exec, rename }) {
  const spec = POLICY_SPEC[policy];
  if (!spec) throw new Error(`Unknown audio_policy "${policy}" (expected muted | muted-autoplay | mix | full-mix).`);

  const bedEmbedded = renderHasEmbeddedAudio(artifact.manifest);
  const base = { policy, bed_embedded: bedEmbedded, realized: !dryRun };

  // T1 / T2 — no post-encode mix. The embedded bed (if any) stays; muted-autoplay
  // just plays it muted on autoplay surfaces.
  if (!spec.mux) {
    return { ...base, track: null, ...(spec.muted_default ? { muted_default: true } : {}), captions: null };
  }

  // T3 / T4 — voiceover (+ bed duck) + captions, at the master sample rate.
  const sample_rate = MASTER_SAMPLE_RATE;
  const voClips = planVoiceoverClips(artifact.manifest, artifact.sceneDefs);
  const muxMode = bedEmbedded ? 'ducked' : 'plain';

  let voiceover = null;
  if (voClips.length > 0) {
    if (dryRun) {
      voiceover = {
        scenes: voClips.map(c => c.scene_id),
        will_synthesize: voClips.length,
        track_relative: 'audio/voiceover/voiceover-track.wav',
        mux: muxMode, sample_rate, muxed: false,
      };
    } else {
      const prep = await prepareVoiceoverTrack({ clips: voClips, projectRoot, sample_rate, ...(ttsProvider ? { provider: ttsProvider } : {}), ...(exec ? { exec } : {}) });
      if (prep.error) {
        // A narrated master with holes in the narration is a broken deliverable.
        throw new Error(`master audio: voiceover synthesis failed — ${prep.error}`);
      }
      await muxVoiceoverIntoRender({
        videoPath: join(projectRoot, masterMp4Rel),
        trackPath: prep.track,
        hasEmbeddedAudio: bedEmbedded,
        ...(exec ? { exec } : {}),
        ...(rename ? { rename } : {}),
      });
      voiceover = {
        scenes: prep.clips.map(c => c.scene_id),
        synthesized: prep.clips.length,
        track_relative: prep.track_relative,
        mux: muxMode, sample_rate, muxed: true,
      };
    }
  }

  // Captions — authored scene.captions → VTT sidecar (the existing tested path;
  // narration text is NOT auto-captioned here — that is a separate follow-up).
  let captions;
  const sidecar = buildCaptionsSidecar(artifact.manifest, artifact.sceneDefs, 'vtt');
  const captionsRel = masterMp4Rel.replace(/\.[^./]+$/, '') + '.' + sidecar.extension;
  if (sidecar.cue_count > 0) {
    if (!dryRun) {
      const sidecarAbs = join(projectRoot, captionsRel);
      await mkdir(dirname(sidecarAbs), { recursive: true });
      await writeFile(sidecarAbs, sidecar.text, 'utf-8');
    }
    captions = { written: !dryRun, format: sidecar.extension, cue_count: sidecar.cue_count, path: captionsRel };
  } else {
    captions = {
      written: false,
      reason: voClips.length > 0
        ? 'narration present but no authored scene.captions — add captions for the accessibility surface'
        : 'no authored scene.captions',
    };
  }

  const out = { ...base, sample_rate, voiceover, captions };

  // T4 sonic cues — resolved but DEFERRED (no cue-mix builder in this pipeline yet).
  if (spec.sonic_cues) {
    out.sonic_cues = {
      available: Object.keys(brand?.sonic_cues || {}),
      realized: false,
      deferred: true,
      note: 'sonic-cue mixing needs a timed cue-mix builder (buildDuckedMuxArgs only mixes bed+VO) — follow-up.',
    };
  }

  return out;
}
