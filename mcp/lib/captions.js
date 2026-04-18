/**
 * Captions (ANI-112)
 *
 * Tiny, dependency-free module for:
 *   1. Validating per-scene caption cue arrays
 *   2. Rolling scene-local cues up to a manifest timeline
 *   3. Serializing to SRT / WebVTT sidecars
 *
 * Caption cue shape:
 *   { text: string, start_ms: number, end_ms: number }
 * Start/end are scene-local when attached to a scene; the manifest-level
 * roll-up adds the scene's absolute start offset (accounting for transition
 * overlaps the same way `calculateDuration` does in src/remotion/lib.js).
 */

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a captions array. Returns an array of error strings; empty array
 * means the captions are well-formed.
 *
 * @param {unknown} captions
 * @param {number} [sceneDurationMs] - Optional scene duration; if supplied,
 *   cues that extend past it are flagged.
 */
export function validateCaptions(captions, sceneDurationMs) {
  const errors = [];
  if (captions == null) return errors;
  if (!Array.isArray(captions)) {
    errors.push('captions must be an array of { text, start_ms, end_ms }');
    return errors;
  }

  let previousEnd = -1;
  for (let i = 0; i < captions.length; i++) {
    const cue = captions[i];
    const where = `captions[${i}]`;
    if (typeof cue !== 'object' || cue === null) {
      errors.push(`${where}: must be an object`);
      continue;
    }
    if (typeof cue.text !== 'string' || cue.text.length === 0) {
      errors.push(`${where}.text: must be a non-empty string`);
    }
    if (typeof cue.start_ms !== 'number' || !Number.isFinite(cue.start_ms) || cue.start_ms < 0) {
      errors.push(`${where}.start_ms: must be a non-negative number`);
    }
    if (typeof cue.end_ms !== 'number' || !Number.isFinite(cue.end_ms) || cue.end_ms <= cue.start_ms) {
      errors.push(`${where}.end_ms: must be greater than start_ms`);
    }
    if (sceneDurationMs != null && cue.end_ms > sceneDurationMs) {
      errors.push(`${where}.end_ms (${cue.end_ms}) exceeds scene duration (${sceneDurationMs}ms)`);
    }
    if (cue.start_ms < previousEnd) {
      errors.push(`${where}: overlaps the previous cue (starts at ${cue.start_ms}, previous ended at ${previousEnd})`);
    }
    previousEnd = cue.end_ms;
  }
  return errors;
}

// ── Manifest-level roll-up ──────────────────────────────────────────────────

/**
 * Compute each scene's absolute start time in milliseconds, honoring
 * transition overlap the same way the sequence duration calculator does.
 * Returns an array of { scene_id, start_ms, duration_ms } in manifest order.
 *
 * @param {object} manifest - Sequence manifest
 */
export function computeSceneTimeline(manifest) {
  const entries = manifest?.scenes || [];
  const timeline = [];
  let cursor = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const durationMs = Math.round((entry.duration_s || 0) * 1000);
    const transitionOverlapMs = (i > 0 && entry.transition_in?.duration_ms) || 0;
    const sceneStart = Math.max(0, cursor - transitionOverlapMs);
    timeline.push({
      scene_id: entry.scene || entry.scene_id,
      start_ms: sceneStart,
      duration_ms: durationMs,
    });
    cursor = sceneStart + durationMs;
  }
  return timeline;
}

/**
 * Collect all caption cues across a manifest into a single sorted timeline,
 * with scene-local times mapped to absolute sequence times.
 *
 * @param {object} manifest
 * @param {object} sceneDefs - { [scene_id]: scene } keyed by scene_id
 * @returns {Array<{ text, start_ms, end_ms, scene_id }>}
 */
export function collectManifestCaptions(manifest, sceneDefs = {}) {
  const sceneTimes = computeSceneTimeline(manifest);
  const cues = [];
  for (const entry of sceneTimes) {
    const def = sceneDefs[entry.scene_id];
    const sceneCaptions = def?.captions || [];
    for (const cue of sceneCaptions) {
      cues.push({
        scene_id: entry.scene_id,
        text: cue.text,
        start_ms: entry.start_ms + cue.start_ms,
        end_ms: entry.start_ms + cue.end_ms,
      });
    }
  }
  cues.sort((a, b) => a.start_ms - b.start_ms);
  return cues;
}

// ── Serialization ───────────────────────────────────────────────────────────

function formatSrtTimestamp(ms) {
  const hh = Math.floor(ms / 3_600_000);
  const mm = Math.floor((ms % 3_600_000) / 60_000);
  const ss = Math.floor((ms % 60_000) / 1_000);
  const mss = Math.floor(ms % 1_000);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(mss).padStart(3, '0')}`;
}

function formatVttTimestamp(ms) {
  return formatSrtTimestamp(ms).replace(',', '.');
}

/**
 * Serialize a caption cue array to SRT format.
 */
export function toSrt(cues) {
  const lines = [];
  cues.forEach((cue, i) => {
    lines.push(String(i + 1));
    lines.push(`${formatSrtTimestamp(cue.start_ms)} --> ${formatSrtTimestamp(cue.end_ms)}`);
    lines.push(cue.text);
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Serialize a caption cue array to WebVTT format.
 */
export function toVtt(cues) {
  const lines = ['WEBVTT', ''];
  cues.forEach((cue, i) => {
    lines.push(`cue-${i + 1}`);
    lines.push(`${formatVttTimestamp(cue.start_ms)} --> ${formatVttTimestamp(cue.end_ms)}`);
    lines.push(cue.text);
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Build a captions sidecar for a manifest.
 *
 * @param {object} manifest
 * @param {object} sceneDefs
 * @param {'srt' | 'vtt'} format
 * @returns {{ text: string, extension: string, cue_count: number }}
 *   `text` is the empty string when no cues exist; caller should decide
 *   whether to write an empty sidecar or skip it.
 */
export function buildCaptionsSidecar(manifest, sceneDefs, format = 'srt') {
  const cues = collectManifestCaptions(manifest, sceneDefs);
  const serializer = format === 'vtt' ? toVtt : toSrt;
  return {
    text: cues.length === 0 ? '' : serializer(cues),
    extension: format === 'vtt' ? 'vtt' : 'srt',
    cue_count: cues.length,
  };
}

// ── Active cue lookup (for burn-in rendering) ───────────────────────────────

/**
 * Find the caption cue active at a given scene-local time. Returns null if
 * no cue is active. Used by the Remotion CaptionsLayer to render the
 * current line without iterating every frame.
 *
 * @param {Array<{text, start_ms, end_ms}>} captions
 * @param {number} timeMs - Scene-local time in milliseconds
 */
export function activeCaptionAt(captions, timeMs) {
  if (!Array.isArray(captions)) return null;
  for (const cue of captions) {
    if (timeMs >= cue.start_ms && timeMs < cue.end_ms) return cue;
  }
  return null;
}
