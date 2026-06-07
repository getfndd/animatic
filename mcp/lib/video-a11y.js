/**
 * Accessibility audit for rendered videos — WCAG for motion (ANI-122)
 *
 * Five checks across two layers:
 *
 *   Frame layer (needs the rendered video + ffmpeg):
 *     - flash/strobe frequency        → WCAG 2.3.1 (three flashes threshold)
 *   Static layer (manifest + scene definitions only):
 *     - text contrast ratios          → WCAG 1.4.3 (4.5:1 for normal text)
 *     - captions presence             → WCAG 1.2.2 (captions for narration)
 *     - autoplay-muted compatibility  → narration that vanishes when muted
 *     - motion intensity (advisory)   → vestibular triggers: sustained
 *                                       high-intensity camera + cut cadence
 *
 * Same architecture as audio-fingerprint/pixel-diff (ANI-126/127): ffmpeg
 * decode behind an injectable exec, all analysis pure JS so the math
 * unit-tests offline. Findings reference specific scenes/layers with an
 * actionable suggestion each — the audit is a fix list, not a verdict.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { buildCaptionsSidecar, computeSceneTimeline } from './captions.js';

const execFileAsync = promisify(execFile);

// ── Decode (frame layer) ────────────────────────────────────────────────────

/** Analysis sampling: 10fps catches flash pairs up to the 2.3.1 threshold band. */
export const FLASH_SAMPLE_FPS = 10;
const DECODE_W = 160;
const DECODE_H = 90;

/**
 * Decode a video into downscaled raw RGBA frames for luminance analysis.
 *
 * @param {string} videoPath
 * @param {object} [opts] - { fps, width, height, exec }
 * @returns {Promise<{ fps: number, width: number, height: number, frames: Buffer[] }>}
 */
export async function decodeVideoFrames(videoPath, opts = {}) {
  const fps = opts.fps ?? FLASH_SAMPLE_FPS;
  const width = opts.width ?? DECODE_W;
  const height = opts.height ?? DECODE_H;
  const exec = opts.exec ?? execFileAsync;

  const { stdout } = await exec(
    'ffmpeg',
    ['-v', 'error', '-i', videoPath,
      '-vf', `fps=${fps},scale=${width}:${height}`,
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { timeout: 300_000, encoding: 'buffer', maxBuffer: 1024 * 1024 * 1024 },
  );
  const frameBytes = width * height * 4;
  const frames = [];
  for (let off = 0; off + frameBytes <= stdout.length; off += frameBytes) {
    frames.push(stdout.subarray(off, off + frameBytes));
  }
  return { fps, width, height, frames };
}

// ── Luminance + contrast math (pure) ────────────────────────────────────────

/** sRGB channel (0-255) → linear component. */
function linearize(c255) {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance for an sRGB triple (0-255 each). */
export function relativeLuminance(r, g, b) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two sRGB triples. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a[0], a[1], a[2]);
  const lb = relativeLuminance(b[0], b[1], b[2]);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Parse #rgb / #rrggbb / #rrggbbaa → [r,g,b] or null. */
export function parseHexColor(value) {
  const m = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
  return [0, 1, 2].map(i => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

/** Mean relative luminance of one RGBA frame buffer. */
export function frameMeanLuminance(rgba) {
  let sum = 0;
  const pixels = Math.floor(rgba.length / 4);
  for (let i = 0; i < pixels * 4; i += 4) {
    sum += relativeLuminance(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return pixels > 0 ? sum / pixels : 0;
}

// ── Check 1: flash/strobe (WCAG 2.3.1) ──────────────────────────────────────

/** A transition counts toward a flash when mean luminance swings this much. */
const FLASH_DELTA = 0.10;
/** 2.3.1: more than three flashes in any one-second period. */
const MAX_FLASHES_PER_SECOND = 3;

/**
 * Analyze a luminance series for general flashes. A "flash" is a pair of
 * opposing transitions (increase then decrease, or vice versa) each
 * exceeding FLASH_DELTA — the standard general-flash approximation
 * (full red-flash analysis is out of scope and noted in the report).
 *
 * @param {number[]} luminance - Per-sampled-frame mean luminance (0-1)
 * @param {number} fps - Sample rate of the series
 * @returns {{ flash_times_s: number[], worst_window: { start_s, flashes },
 *             violates: boolean }}
 */
export function analyzeFlashes(luminance, fps) {
  // Collect signed transitions above threshold.
  const transitions = [];
  for (let i = 1; i < luminance.length; i++) {
    const delta = luminance[i] - luminance[i - 1];
    if (Math.abs(delta) >= FLASH_DELTA) {
      transitions.push({ t: i / fps, dir: Math.sign(delta) });
    }
  }
  // A flash = a PAIR of opposing transitions; both are consumed so an
  // alternating series of N transitions yields ⌊N/2⌋ flashes, not N−1
  // (counting every direction change double-counts the WCAG unit).
  const flashTimes = [];
  for (let i = 1; i < transitions.length; i++) {
    if (transitions[i].dir !== transitions[i - 1].dir) {
      flashTimes.push(transitions[i].t);
      i += 1; // consume the pair
    }
  }
  // Worst 1-second window.
  let worst = { start_s: 0, flashes: 0 };
  for (let i = 0; i < flashTimes.length; i++) {
    const windowStart = flashTimes[i];
    let count = 0;
    for (let j = i; j < flashTimes.length && flashTimes[j] < windowStart + 1; j++) count++;
    if (count > worst.flashes) worst = { start_s: Math.round(windowStart * 100) / 100, flashes: count };
  }
  return {
    flash_times_s: flashTimes.map(t => Math.round(t * 100) / 100),
    worst_window: worst,
    violates: worst.flashes > MAX_FLASHES_PER_SECOND,
  };
}

// ── Check 2: text contrast (WCAG 1.4.3, static) ─────────────────────────────

const MIN_CONTRAST = 4.5;

/** Extract `color:`/`background[-color]:` hex pairs from inline-styled HTML. */
function extractHtmlColorPairs(html) {
  const pairs = [];
  const re = /style="([^"]*)"/g;
  let match;
  const stack = [];
  while ((match = re.exec(html)) !== null) {
    const style = match[1];
    const color = /(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,8})/.exec(style)?.[1] || null;
    const bg = /background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/.exec(style)?.[1] || null;
    if (bg) stack.push(bg);
    if (color) pairs.push({ color, background: bg || stack[stack.length - 1] || null });
  }
  return pairs;
}

/**
 * Static contrast check over scene text layers. Only judges pairs where
 * both a text color and an effective background are derivable; everything
 * else lands in `unknown` rather than silently passing.
 *
 * @param {object} manifest
 * @param {object} sceneDefs - scene_id → scene
 * @returns {{ checked: number, unknown: Array, issues: Array }}
 */
export function checkTextContrast(manifest, sceneDefs) {
  const issues = [];
  const unknown = [];
  let checked = 0;

  for (const entry of manifest?.scenes || []) {
    const sceneId = entry.scene || entry.scene_id;
    const scene = sceneDefs?.[sceneId];
    if (!scene) continue;
    const sceneBg = parseHexColor(scene.background || scene.brand?.palette?.[0]);

    for (const layer of scene.layers || []) {
      const html = typeof layer.content === 'string' ? layer.content : null;
      const text = layer.content?.text || (html && /[A-Za-z]/.test(html.replace(/<[^>]*>/g, '')) ? 'html' : null);
      if (!text) continue;

      const pairs = html ? extractHtmlColorPairs(html) : [];
      if (layer.style?.color) {
        pairs.push({ color: layer.style.color, background: layer.style.background || null });
      }
      if (pairs.length === 0) {
        unknown.push({ scene_id: sceneId, layer_id: layer.id, reason: 'no derivable text color' });
        continue;
      }
      for (const pair of pairs) {
        const fg = parseHexColor(pair.color);
        const bg = parseHexColor(pair.background) || sceneBg;
        if (!fg || !bg) {
          unknown.push({ scene_id: sceneId, layer_id: layer.id, reason: 'no derivable background for text color ' + pair.color });
          continue;
        }
        checked += 1;
        const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
        if (ratio < MIN_CONTRAST) {
          issues.push({
            check: 'text_contrast', severity: 'fail', wcag: '1.4.3',
            scene_id: sceneId, layer_id: layer.id,
            message: `Text contrast ${ratio}:1 (${pair.color} on ${pair.background || 'scene background'}) is below ${MIN_CONTRAST}:1`,
            suggestion: `Lighten the text or darken the background of layer "${layer.id}" in ${sceneId} to reach ≥${MIN_CONTRAST}:1`,
          });
        }
      }
    }
  }
  return { checked, unknown, issues };
}

// ── Checks 3+4: captions + autoplay-muted (static + stream probe) ──────────

/**
 * Captions vs narration coverage (WCAG 1.2.2) and muted-autoplay safety.
 *
 * @param {object} manifest
 * @param {object} sceneDefs
 * @param {object} [opts] - { audio_streams: number|null } from the caller's probe
 * @returns {{ issues: Array, narrated_scenes: string[], captioned_scenes: string[] }}
 */
export function checkCaptionsAndAutoplay(manifest, sceneDefs, opts = {}) {
  const issues = [];
  const narrated = [];
  const captioned = new Set();

  for (const entry of manifest?.scenes || []) {
    const sceneId = entry.scene || entry.scene_id;
    const scene = sceneDefs?.[sceneId];
    if (scene?.voiceover?.text) narrated.push(sceneId);
    if ((scene?.captions || []).length > 0) captioned.add(sceneId);
  }

  const sidecar = buildCaptionsSidecar(manifest, sceneDefs, 'srt');
  const uncaptionedNarration = narrated.filter(id => !captioned.has(id));

  if (uncaptionedNarration.length > 0) {
    issues.push({
      check: 'captions', severity: 'fail', wcag: '1.2.2',
      scene_ids: uncaptionedNarration,
      message: `${uncaptionedNarration.length} narrated scene(s) have no captions: ${uncaptionedNarration.join(', ')}`,
      suggestion: 'Add `captions` cues to each narrated scene (render_project emits the .srt sidecar automatically once cues exist)',
    });
  }

  const audioStreams = opts.audio_streams;
  if (audioStreams != null && audioStreams > 0 && narrated.length > 0 && sidecar.cue_count === 0) {
    issues.push({
      check: 'autoplay_muted', severity: 'fail', wcag: '1.2.2',
      scene_ids: narrated,
      message: 'Video carries narration audio but zero caption cues — muted autoplay (the default on every major platform) loses all narrated content',
      suggestion: 'Add caption cues for narrated scenes, or design the scenes to carry their message visually',
    });
  }

  return { issues, narrated_scenes: narrated, captioned_scenes: [...captioned] };
}

// ── Check 5: motion intensity (advisory) ────────────────────────────────────

/** Advisory thresholds: sustained intense camera + rapid cuts → vestibular risk. */
const INTENSE_CAMERA = 0.6;
const MAX_CUTS_PER_10S = 6;

/**
 * Manifest-level vestibular-trigger advisory. Not a WCAG pass/fail (2.3.3
 * governs interaction-triggered animation); flagged as advisory because
 * autoplaying video with sustained intense motion is a known trigger.
 *
 * @param {object} manifest
 * @param {object} sceneDefs
 * @returns {{ issues: Array, intense_scenes: string[], cuts_per_10s: number }}
 */
export function checkMotionIntensity(manifest, sceneDefs) {
  const issues = [];
  const intense = [];
  const entries = manifest?.scenes || [];

  for (const entry of entries) {
    const sceneId = entry.scene || entry.scene_id;
    const scene = sceneDefs?.[sceneId];
    const intensity = entry.camera_override?.intensity ?? scene?.camera?.intensity ?? 0;
    const move = entry.camera_override?.move || scene?.camera?.move || 'static';
    if (intensity >= INTENSE_CAMERA && move !== 'static') {
      intense.push(sceneId);
    }
  }

  const timeline = computeSceneTimeline(manifest);
  const totalS = timeline.length > 0
    ? (timeline[timeline.length - 1].start_ms + timeline[timeline.length - 1].duration_ms) / 1000
    : 0;
  const cutsPer10s = totalS > 0 ? Math.round(((entries.length - 1) / totalS) * 10 * 100) / 100 : 0;

  if (intense.length > 0) {
    issues.push({
      check: 'motion_intensity', severity: 'warn', wcag: '2.3.3 (advisory)',
      scene_ids: intense,
      message: `${intense.length} scene(s) hold camera intensity ≥ ${INTENSE_CAMERA}: ${intense.join(', ')}`,
      suggestion: 'Reduce camera intensity below 0.6 or shorten the moves — sustained intense parallax is a vestibular trigger on autoplay',
    });
  }
  if (cutsPer10s > MAX_CUTS_PER_10S) {
    issues.push({
      check: 'motion_intensity', severity: 'warn', wcag: '2.3.3 (advisory)',
      message: `Cut cadence ${cutsPer10s}/10s exceeds ${MAX_CUTS_PER_10S}/10s`,
      suggestion: 'Lengthen scene holds or merge scenes — rapid cut cadence compounds motion triggers',
    });
  }
  return { issues, intense_scenes: intense, cuts_per_10s: cutsPer10s };
}

// ── The audit ───────────────────────────────────────────────────────────────

/**
 * Run the full accessibility audit. Static checks always run; the frame
 * layer (flash/strobe) and stream probe run only when `video_path` is
 * provided.
 *
 * @param {object} input
 * @param {object} input.manifest
 * @param {object} input.sceneDefs - scene_id → scene
 * @param {string} [input.video_path] - Rendered video for frame-layer checks
 * @param {object} [opts] - { exec } injection for tests
 * @returns {Promise<{ ok, issues, checks, summary }>}
 */
export async function auditVideoAccessibility(input, opts = {}) {
  const { manifest, sceneDefs = {}, video_path } = input || {};
  if (!manifest?.scenes?.length) {
    throw new Error('auditVideoAccessibility requires a manifest with scenes');
  }
  const exec = opts.exec ?? execFileAsync;
  const issues = [];
  const checks = {};

  // Coverage accounting (PR #91 review finding): static checks inspect
  // scene DEFINITIONS — with none loaded they pass vacuously, and "no
  // issues detected" would be a false clean bill. The audit fail-closes
  // on zero coverage and warns on partial coverage instead.
  const manifestSceneIds = (manifest.scenes || []).map(e => e.scene || e.scene_id).filter(Boolean);
  const missingDefs = manifestSceneIds.filter(id => !sceneDefs[id]);
  const coveredCount = manifestSceneIds.length - missingDefs.length;
  checks.coverage = {
    manifest_scenes: manifestSceneIds.length,
    scenes_with_defs: coveredCount,
    missing_defs: missingDefs,
  };
  if (coveredCount === 0) {
    issues.push({
      check: 'coverage', severity: 'fail',
      scene_ids: missingDefs,
      message: `0 of ${manifestSceneIds.length} manifest scenes have loaded definitions — the static checks (contrast, captions, motion) assessed nothing`,
      suggestion: 'Pass the scene definitions referenced by the manifest (see docs/troubleshooting.md §3) — an audit over zero scenes is not a clean audit',
    });
  } else if (missingDefs.length > 0) {
    issues.push({
      check: 'coverage', severity: 'warn',
      scene_ids: missingDefs,
      message: `${missingDefs.length} of ${manifestSceneIds.length} manifest scenes have no loaded definition and were not assessed: ${missingDefs.join(', ')}`,
      suggestion: 'Provide the missing scene definitions so contrast/captions/motion checks cover the full sequence',
    });
  }

  // Frame layer.
  if (video_path) {
    const { fps, frames } = await decodeVideoFrames(video_path, { exec });
    const luminance = frames.map(frameMeanLuminance);
    const flashes = analyzeFlashes(luminance, fps);
    checks.flashes = { ...flashes, frames_analyzed: frames.length, note: 'general-flash approximation; saturated-red flash analysis not performed' };
    if (flashes.violates) {
      const timeline = computeSceneTimeline(manifest);
      const atMs = flashes.worst_window.start_s * 1000;
      const scene = timeline.find(t => atMs >= t.start_ms && atMs < t.start_ms + t.duration_ms);
      issues.push({
        check: 'flashes', severity: 'fail', wcag: '2.3.1',
        scene_id: scene?.scene_id || null, at_s: flashes.worst_window.start_s,
        message: `${flashes.worst_window.flashes} flashes within 1s at t=${flashes.worst_window.start_s}s (limit: ${MAX_FLASHES_PER_SECOND})`,
        suggestion: `Replace the strobe${scene ? ` in ${scene.scene_id}` : ''} with a crossfade or slow pulse — keep luminance flashes at or under 3 per second`,
      });
    }

    let audioStreams = null;
    try {
      const { stdout } = await exec(
        'ffprobe',
        ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', video_path],
        { timeout: 30_000 },
      );
      const text = String(stdout).trim();
      audioStreams = text === '' ? 0 : text.split('\n').length;
    } catch { /* ffprobe unavailable → stream probe skipped, recorded below */ }
    checks.audio_streams = audioStreams;

    const cap = checkCaptionsAndAutoplay(manifest, sceneDefs, { audio_streams: audioStreams });
    checks.captions = { narrated_scenes: cap.narrated_scenes, captioned_scenes: cap.captioned_scenes };
    issues.push(...cap.issues);
  } else {
    checks.flashes = { skipped: 'no video_path provided — frame-layer checks need the rendered video' };
    const cap = checkCaptionsAndAutoplay(manifest, sceneDefs, { audio_streams: null });
    checks.captions = { narrated_scenes: cap.narrated_scenes, captioned_scenes: cap.captioned_scenes };
    issues.push(...cap.issues);
  }

  // Static layer.
  const contrast = checkTextContrast(manifest, sceneDefs);
  checks.contrast = { checked: contrast.checked, unknown: contrast.unknown };
  issues.push(...contrast.issues);

  const motion = checkMotionIntensity(manifest, sceneDefs);
  checks.motion = { intense_scenes: motion.intense_scenes, cuts_per_10s: motion.cuts_per_10s };
  issues.push(...motion.issues);

  const fails = issues.filter(i => i.severity === 'fail').length;
  const warns = issues.filter(i => i.severity === 'warn').length;
  const cleanSummary = missingDefs.length > 0
    ? `No issues in the ${coveredCount}/${manifestSceneIds.length} scenes assessed`
    : 'No accessibility issues detected';
  return {
    ok: fails === 0,
    issues,
    checks,
    summary: fails === 0 && warns === 0
      ? cleanSummary + (video_path ? '' : ' (static checks only — pass video_path for flash/strobe analysis)')
      : `${fails} failure(s), ${warns} advisory warning(s) — see issues[] for per-scene fixes`,
  };
}
