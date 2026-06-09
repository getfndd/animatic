/**
 * sonic-cues.js — brand sonic-cue resolution + deterministic placement (ANI-189).
 *
 * Turns a brand's `audio.sonic_cues` (logo_sting / transition_whoosh / ui_click)
 * into a timed cue list anchored to a master's timeline, then (glue) mixes them
 * onto the rendered master via `buildSonicCueMixArgs`. Composes existing pieces:
 * `computeSceneTimeline` for offsets, the audio-mix arg builder for the graph.
 *
 * Anchors (deterministic — no heuristics beyond this table):
 *   logo_sting        → the logo/resolve scene start (last scene with a closing
 *                       signal; falls back to the last scene). One placement.
 *   transition_whoosh → each transition boundary (manifest entry i>0 with a
 *                       transition_in), at the entering scene's start. N.
 *   ui_click          → each scene with interaction_truth.has_state_change, at
 *                       the scene start. Labeled `scene_start_state_change` — it
 *                       is scene-level, NOT click-event timing (a follow-up).
 *
 * Brand state today is usually "not configured" (fintech-demo sets all cues
 * null; mercury has no audio block) — that is normal, distinct from a configured
 * path whose file is missing. Both fail SOFT (the cue is skipped, never an error)
 * but the skip reason distinguishes them.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeSceneTimeline } from './captions.js';
import { buildSonicCueMixArgs } from './audio-mix.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = resolve(__dirname, '../..', 'catalog/brands');

/** The three cue types the brand schema defines. */
export const SONIC_CUE_TYPES = ['logo_sting', 'transition_whoosh', 'ui_click'];

/** Read a field from the scene def OR its metadata (generation path varies). */
function field(scene, key) {
  return scene?.[key] ?? scene?.metadata?.[key];
}
function intentTags(scene) {
  return scene?.metadata?.intent_tags ?? scene?.intent_tags ?? [];
}

/** True when a scene reads as the closing / brand-resolve beat. */
function isClosingScene(scene) {
  if (!scene) return false;
  if (field(scene, 'product_role') === 'cta') return true;
  const tags = intentTags(scene);
  return tags.includes('closing') || tags.includes('cta');
}

/** True when a scene represents a UI state change (a click beat). */
function isStateChangeScene(scene) {
  return scene?.interaction_truth?.has_state_change === true;
}

/**
 * Resolve a cue's relative/absolute path against the brand package directory.
 * Returns null when not resolvable (caller treats as missing).
 */
function resolveCuePath(relativeOrAbsolute, brand) {
  if (!relativeOrAbsolute) return null;
  if (isAbsolute(relativeOrAbsolute)) return relativeOrAbsolute;
  const base = brand?.brand_id ? resolve(BRANDS_DIR, brand.brand_id) : BRANDS_DIR;
  return resolve(base, relativeOrAbsolute);
}

/**
 * Resolve + place a brand's sonic cues against a master's timeline.
 *
 * @param {object} params
 * @param {object} [params.brand] - Brand package (reads `audio.sonic_cues`, `brand_id`).
 * @param {object} params.manifest - The artifact's sequence manifest.
 * @param {object} params.sceneDefs - scene_id → scene definition map.
 * @returns {{ available: string[], placed: Array, skipped: Array }}
 */
export function resolveSonicCues({ brand, manifest, sceneDefs = {} }) {
  const cuesCfg = brand?.audio?.sonic_cues || {};
  const timeline = computeSceneTimeline(manifest);
  const startByScene = new Map(timeline.map(t => [t.scene_id, t.start_ms]));
  const sceneOf = (id) => sceneDefs[id] || {};

  const available = SONIC_CUE_TYPES.filter(t => cuesCfg[t] != null);
  const placed = [];
  const skipped = [];

  for (const type of SONIC_CUE_TYPES) {
    const configured = cuesCfg[type];
    // null/undefined ⇒ this brand simply hasn't set the cue — NOT a broken asset.
    if (configured == null) {
      skipped.push({ type, reason: 'not_configured' });
      continue;
    }
    const path = resolveCuePath(configured, brand);
    if (!path || !existsSync(path)) {
      skipped.push({ type, reason: 'missing_file', path: path || configured });
      continue;
    }

    // Anchor placement per type.
    if (type === 'logo_sting') {
      // Last closing-signalled scene, else the last scene in the timeline.
      const closing = [...timeline].reverse().find(t => isClosingScene(sceneOf(t.scene_id)));
      const anchor = closing || timeline[timeline.length - 1];
      if (anchor) placed.push({ type, path, offset_ms: anchor.start_ms, scene_id: anchor.scene_id, placement: 'logo_scene_start' });
    } else if (type === 'transition_whoosh') {
      manifest.scenes.forEach((entry, i) => {
        if (i === 0 || !entry.transition_in) return; // the first scene has no transition in
        const id = entry.scene || entry.scene_id;
        if (startByScene.has(id)) placed.push({ type, path, offset_ms: startByScene.get(id), scene_id: id, placement: 'transition_boundary' });
      });
    } else if (type === 'ui_click') {
      for (const t of timeline) {
        if (isStateChangeScene(sceneOf(t.scene_id))) {
          // Scene-level, not click-event timing — named so it can't masquerade as precise.
          placed.push({ type, path, offset_ms: t.start_ms, scene_id: t.scene_id, placement: 'scene_start_state_change' });
        }
      }
    }
  }

  return { available, placed, skipped };
}

/** Default ffmpeg runner (mirrors voiceover-mix). */
async function runFfmpeg(args) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  await promisify(execFile)('ffmpeg', args, { timeout: 300_000 });
}

/**
 * Mix placed sonic cues onto a rendered master in place (temp file → rename,
 * since ffmpeg can't edit in place — mirrors muxVoiceoverIntoRender).
 *
 * @param {object} params
 * @param {string} params.videoPath - Rendered master MP4 (replaced in place).
 * @param {Array<{ path, offset_ms }>} params.cues - Placed cues (from resolveSonicCues).
 * @param {number} params.videoDurationMs - Full picture duration (pads the base).
 * @param {boolean} params.hasBaseAudio - Whether the master already carries audio.
 * @param {function} [params.exec] - ffmpeg runner override (tests).
 * @param {function} [params.rename] - fs rename override (tests).
 * @returns {Promise<{ args: string[] }>}
 */
export async function muxSonicCuesIntoRender({ videoPath, cues, videoDurationMs, hasBaseAudio, exec = runFfmpeg, rename }) {
  if (!videoPath || !Array.isArray(cues) || cues.length === 0) {
    throw new Error('muxSonicCuesIntoRender requires { videoPath, cues: [...] }');
  }
  const tmpPath = videoPath.replace(/(\.[^./]+)$/, '.sonic-cues$1');
  const args = buildSonicCueMixArgs({
    videoPath,
    cues: cues.map(c => ({ path: c.path, offset_ms: c.offset_ms })),
    outputPath: tmpPath,
    hasBaseAudio,
    ...(hasBaseAudio ? { videoDurationMs } : {}),
  });
  await exec(args);
  const doRename = rename || (await import('node:fs/promises')).rename;
  await doRename(tmpPath, videoPath);
  return { args };
}
