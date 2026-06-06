/**
 * Voiceover render glue (ANI-129)
 *
 * Connects the pieces shipped by ANI-111 — the TTS synthesizer (`tts.js`)
 * and the pure ffmpeg arg builders (`audio-mix.js`) — into the render
 * pipeline. `renderProject` calls these around the Remotion render:
 *
 *   1. `planVoiceoverClips`     — which scenes speak, and when (pre-render)
 *   2. `prepareVoiceoverTrack`  — synthesize WAVs + build the timeline track
 *   3. `muxVoiceoverIntoRender` — attach the track to the rendered MP4,
 *                                 ducking the render's embedded audio
 *                                 (ANI-106 music bed + scene SFX) when present
 *
 * ffmpeg execution is injectable (`exec`) so tests — including the golden
 * harness — can capture the exact commands without an ffmpeg dependency.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

import { computeSceneTimeline } from './captions.js';
import { synthesizeVoiceovers } from './tts.js';
import { buildDuckedMuxArgs, buildMuxArgs, buildVoiceoverTrackArgs } from './audio-mix.js';

const execFileAsync = promisify(execFile);

/** Relative directory (under the project root) for synthesized narration. */
export const VOICEOVER_DIR = 'audio/voiceover';

/** Default ffmpeg runner. 5-minute ceiling — audio passes are fast. */
async function runFfmpeg(args) {
  await execFileAsync('ffmpeg', args, { timeout: 300_000 });
}

/**
 * Default TTS provider for renders. `macos_say` produces real speech with
 * no credentials on macOS; everywhere else fall back to the deterministic
 * silent `mock` until a cloud provider lands (ANI-128). Scene-level
 * `voiceover.provider` always wins over this default.
 */
export function defaultTtsProvider(platform = process.platform) {
  return platform === 'darwin' ? 'macos_say' : 'mock';
}

/**
 * Walk the manifest timeline and pair each scene that carries a
 * `voiceover.text` with its absolute start offset. Scene start times honor
 * transition overlap via `computeSceneTimeline`, so narration lands where
 * the picture actually is — not where naive duration summing puts it.
 *
 * @param {object} manifest - Sequence manifest
 * @param {object} sceneDefs - scene_id → scene definition map
 * @returns {Array<{ scene_id: string, scene: object, offset_ms: number }>}
 */
export function planVoiceoverClips(manifest, sceneDefs) {
  const timeline = computeSceneTimeline(manifest);
  const clips = [];
  for (const entry of timeline) {
    const scene = sceneDefs?.[entry.scene_id];
    if (!scene?.voiceover?.text) continue;
    clips.push({ scene_id: entry.scene_id, scene, offset_ms: entry.start_ms });
  }
  return clips;
}

/**
 * Whether the Remotion render will already carry an audio stream — a
 * manifest-level music bed (`manifest.audio.src`, ANI-106) or any per-scene
 * audio clip. Decides between the ducked mix and the plain mux post-render.
 *
 * @param {object} manifest - Sequence manifest
 * @returns {boolean}
 */
export function renderHasEmbeddedAudio(manifest) {
  if (manifest?.audio?.src) return true;
  return (manifest?.scenes || []).some(entry => entry.audio?.src);
}

/**
 * Synthesize one WAV per speaking scene and combine them into a single
 * timeline-aligned narration track at `<projectRoot>/audio/voiceover/`.
 *
 * Fails hard when any clip fails to synthesize — a narrated deliverable
 * with holes in the narration is a broken deliverable, mirroring the
 * preflight philosophy of refusing to spend render compute on known-bad
 * output.
 *
 * @param {object} opts
 * @param {Array<{ scene_id, scene, offset_ms }>} opts.clips - From `planVoiceoverClips`
 * @param {string} opts.projectRoot - Absolute project root
 * @param {string} [opts.provider] - TTS provider default (scene-level overrides win)
 * @param {Function} [opts.exec] - ffmpeg runner override (tests)
 * @returns {Promise<{ clips, track, track_relative, commands } | { error, results }>}
 */
export async function prepareVoiceoverTrack(opts) {
  const {
    clips,
    projectRoot,
    provider = defaultTtsProvider(),
    exec = runFfmpeg,
  } = opts || {};
  if (!Array.isArray(clips) || clips.length === 0 || !projectRoot) {
    throw new Error('prepareVoiceoverTrack requires { clips: [...], projectRoot }');
  }

  const outputDir = join(projectRoot, VOICEOVER_DIR);
  // Carry the clip's resolved id into synthesis: scene JSON may lack its own
  // scene_id (renderProject keys sceneDefs by `sceneData.scene_id || entry.id`),
  // and synthesizeVoiceovers derives the output filename from the scene object —
  // without this, such scenes all collide on `undefined.wav`.
  const results = await synthesizeVoiceovers(
    clips.map(c => ({ ...c.scene, scene_id: c.scene_id })),
    { outputDir, provider },
  );

  const failed = results.filter(r => r.status === 'failed');
  if (failed.length > 0) {
    return {
      error: `Voiceover synthesis failed for scene(s): ${failed.map(f => `${f.scene_id} (${f.error})`).join(', ')}`,
      results,
    };
  }

  const generated = clips.map((clip, i) => ({
    scene_id: clip.scene_id,
    offset_ms: clip.offset_ms,
    path: results[i].audio_path,
    path_relative: `${VOICEOVER_DIR}/${clip.scene_id}.wav`,
    duration_ms: results[i].duration_ms,
    provider: results[i].provider,
  }));

  const trackRelative = `${VOICEOVER_DIR}/voiceover-track.wav`;
  const trackPath = join(projectRoot, trackRelative);
  const trackArgs = buildVoiceoverTrackArgs({
    clips: generated.map(c => ({ path: c.path, offset_ms: c.offset_ms })),
    outputPath: trackPath,
  });
  await exec(trackArgs);

  return {
    clips: generated,
    track: trackPath,
    track_relative: trackRelative,
    commands: [trackArgs],
  };
}

/**
 * Attach the narration track to a rendered video, replacing the original
 * file in place. When the render carries embedded audio (music bed / SFX),
 * it is ducked ~6dB under the narration; otherwise the track is muxed in
 * directly. ffmpeg can't edit in place, so the mix lands in a sibling temp
 * file that is renamed over the render on success.
 *
 * @param {object} opts
 * @param {string} opts.videoPath - Rendered MP4 (replaced in place)
 * @param {string} opts.trackPath - Narration track from `prepareVoiceoverTrack`
 * @param {boolean} opts.hasEmbeddedAudio - From `renderHasEmbeddedAudio`
 * @param {Function} [opts.exec] - ffmpeg runner override (tests)
 * @param {Function} [opts.rename] - fs rename override (tests)
 * @returns {Promise<{ ducked: boolean, commands: string[][] }>}
 */
export async function muxVoiceoverIntoRender(opts) {
  const { videoPath, trackPath, hasEmbeddedAudio, exec = runFfmpeg, rename } = opts || {};
  if (!videoPath || !trackPath) {
    throw new Error('muxVoiceoverIntoRender requires { videoPath, trackPath }');
  }

  const tmpPath = videoPath.replace(/(\.[^./]+)$/, '.voiceover-mix$1');
  const args = hasEmbeddedAudio
    ? buildDuckedMuxArgs({ videoPath, voiceoverPath: trackPath, outputPath: tmpPath })
    : buildMuxArgs({ videoPath, audioPath: trackPath, outputPath: tmpPath });

  await exec(args);

  const doRename = rename || (await import('node:fs/promises')).rename;
  await doRename(tmpPath, videoPath);

  return { ducked: Boolean(hasEmbeddedAudio), commands: [args] };
}
