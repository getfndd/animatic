/**
 * Pixel diffing (ANI-126)
 *
 * Fuzzy frame comparison for the golden harness: decode PNGs to raw RGBA
 * via ffmpeg (already this pipeline's backbone — no PNG/diff npm deps),
 * then compare per-pixel in pure JS.
 *
 * Tolerance model (the ANI-126 design pass):
 *   - per-channel threshold — a pixel only counts as mismatched when some
 *     channel differs by more than `channel_threshold` (absorbs
 *     anti-aliasing and codec rounding)
 *   - mismatch budget — the comparison fails only when the fraction of
 *     mismatched pixels exceeds `mismatch_budget` (absorbs sub-pixel text
 *     rasterization drift without masking layout/color regressions, which
 *     move whole regions)
 *
 * The decode shells out to ffmpeg (injectable); the comparison is pure JS
 * so it unit-tests on synthetic buffers without ffmpeg.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Default per-channel delta (0-255) below which a pixel is "same". */
export const DEFAULT_CHANNEL_THRESHOLD = 8;

/** Default fraction of pixels allowed to mismatch before failing. */
export const DEFAULT_MISMATCH_BUDGET = 0.02;

// ── ffmpeg-backed decode ────────────────────────────────────────────────────

/**
 * Decode an image to raw RGBA plus its dimensions.
 *
 * @param {string} filePath
 * @param {object} [opts]
 * @param {Function} [opts.exec] - execFileAsync-compatible override (tests)
 * @returns {Promise<{ width: number, height: number, rgba: Buffer }>}
 */
export async function decodeImage(filePath, opts = {}) {
  const exec = opts.exec ?? execFileAsync;

  const { stdout: probeOut } = await exec(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', filePath],
    { timeout: 30_000 },
  );
  const [width, height] = String(probeOut).trim().split(',').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Cannot determine dimensions of ${filePath} (got "${String(probeOut).trim()}")`);
  }

  const { stdout: rgba } = await exec(
    'ffmpeg',
    ['-v', 'error', '-i', filePath, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { timeout: 60_000, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 },
  );
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(`Decoded ${rgba.length} bytes from ${filePath}, expected ${expected} (${width}x${height} RGBA)`);
  }
  return { width, height, rgba };
}

// ── Pure comparison ─────────────────────────────────────────────────────────

/**
 * Compare two same-sized RGBA buffers.
 *
 * @param {{ width, height, rgba: Buffer|Uint8Array }} a
 * @param {{ width, height, rgba: Buffer|Uint8Array }} b
 * @param {object} [opts]
 * @param {number} [opts.channel_threshold=8] - Per-channel delta (0-255) a
 *   pixel must exceed (on any channel) to count as mismatched.
 * @param {number} [opts.mismatch_budget=0.02] - Max fraction of mismatched
 *   pixels before `ok` flips false.
 * @returns {{ ok: boolean, total_pixels, mismatched_pixels, mismatch_ratio,
 *             max_channel_delta, dimensions_match: boolean }}
 */
export function comparePixels(a, b, opts = {}) {
  const channelThreshold = opts.channel_threshold ?? DEFAULT_CHANNEL_THRESHOLD;
  const mismatchBudget = opts.mismatch_budget ?? DEFAULT_MISMATCH_BUDGET;

  if (a.width !== b.width || a.height !== b.height) {
    return {
      ok: false,
      dimensions_match: false,
      total_pixels: 0,
      mismatched_pixels: 0,
      mismatch_ratio: 1,
      max_channel_delta: 255,
    };
  }

  const totalPixels = a.width * a.height;
  const pa = a.rgba;
  const pb = b.rgba;
  let mismatched = 0;
  let maxDelta = 0;

  for (let i = 0; i < totalPixels * 4; i += 4) {
    let pixelMax = 0;
    for (let c = 0; c < 4; c++) {
      const d = Math.abs(pa[i + c] - pb[i + c]);
      if (d > pixelMax) pixelMax = d;
    }
    if (pixelMax > maxDelta) maxDelta = pixelMax;
    if (pixelMax > channelThreshold) mismatched++;
  }

  const ratio = totalPixels > 0 ? mismatched / totalPixels : 0;
  return {
    ok: ratio <= mismatchBudget,
    dimensions_match: true,
    total_pixels: totalPixels,
    mismatched_pixels: mismatched,
    mismatch_ratio: ratio,
    max_channel_delta: maxDelta,
  };
}

/**
 * Decode two image files and compare them. Convenience wrapper used by the
 * golden frames harness.
 *
 * @param {string} actualPath
 * @param {string} expectedPath
 * @param {object} [opts] - comparePixels options + { exec } decode override
 * @returns {Promise<ReturnType<typeof comparePixels>>}
 */
export async function compareImageFiles(actualPath, expectedPath, opts = {}) {
  const [a, b] = await Promise.all([
    decodeImage(actualPath, opts),
    decodeImage(expectedPath, opts),
  ]);
  return comparePixels(a, b, opts);
}
