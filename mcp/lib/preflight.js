/**
 * Preflight Doctor (ANI-115)
 *
 * Run checks that catch common render-readiness failures BEFORE burning
 * compute on a doomed render. Returns a structured report so callers can
 * decide whether to proceed, warn the user, or abort.
 *
 * Each check produces:
 *   { name, status: 'pass' | 'warn' | 'fail', message, details? }
 *
 * Overall `ok` is true iff no check returned `fail`. `warn`-level checks
 * surface issues without blocking.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { checkVoiceoverFit } from './tts.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Thresholds ──────────────────────────────────────────────────────────────

const REQUIRED_ENCODERS = ['libx264']; // minimum for any useful render
const RECOMMENDED_ENCODERS = ['libvpx-vp9', 'prores_ks']; // for alpha + archival
const MIN_FREE_DISK_MB = 500;
const REQUIRED_FONT_WEIGHTS = [
  'Satoshi-Regular.woff2',
  'Satoshi-Medium.woff2',
  'Satoshi-Bold.woff2',
  'Satoshi-Black.woff2',
];

// ── Individual checks ───────────────────────────────────────────────────────

/**
 * Check ffmpeg + codec availability. Pass if ffmpeg + required encoders
 * present; warn if optional encoders missing; fail if ffmpeg itself missing.
 */
export async function checkEncoders() {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-encoders'], { timeout: 8_000 });
    const missingRequired = REQUIRED_ENCODERS.filter(e => !stdout.includes(e));
    const missingRecommended = RECOMMENDED_ENCODERS.filter(e => !stdout.includes(e));

    if (missingRequired.length > 0) {
      return {
        name: 'encoders',
        status: 'fail',
        message: `ffmpeg is missing required encoder(s): ${missingRequired.join(', ')}`,
        details: { missing_required: missingRequired, missing_recommended: missingRecommended },
      };
    }
    if (missingRecommended.length > 0) {
      return {
        name: 'encoders',
        status: 'warn',
        message: `ffmpeg available, but missing recommended encoder(s): ${missingRecommended.join(', ')}`,
        details: { missing_recommended: missingRecommended },
      };
    }
    return { name: 'encoders', status: 'pass', message: 'ffmpeg + h264/vp9/prores encoders available' };
  } catch (err) {
    return {
      name: 'encoders',
      status: 'fail',
      message: 'ffmpeg not available on PATH — install with `brew install ffmpeg`',
      details: { error: err.message.split('\n')[0] },
    };
  }
}

/**
 * Check the vendored Satoshi font pack is intact.
 */
export function checkFonts() {
  const fontsDir = resolve(ROOT, 'public/fonts/satoshi');
  if (!existsSync(fontsDir)) {
    return {
      name: 'fonts',
      status: 'fail',
      message: `Vendored Satoshi directory missing at ${fontsDir}`,
      details: { expected_dir: fontsDir },
    };
  }
  const missing = REQUIRED_FONT_WEIGHTS.filter(f => !existsSync(resolve(fontsDir, f)));
  if (missing.length > 0) {
    return {
      name: 'fonts',
      status: 'fail',
      message: `Missing vendored Satoshi weights: ${missing.join(', ')}`,
      details: { missing, expected_dir: fontsDir },
    };
  }
  return {
    name: 'fonts',
    status: 'pass',
    message: `Satoshi vendored (${REQUIRED_FONT_WEIGHTS.length} weights) at public/fonts/satoshi/`,
  };
}

/**
 * Check plate assets for browser_capture scenes.
 *
 * @param {object} manifest - Sequence manifest
 * @param {object} [ctx]
 * @param {object} [ctx.plates] - { [scene_id]: { src: string } }
 * @param {object} [ctx.sceneDefs] - { [scene_id]: scene } keyed by scene_id
 */
export function checkPlates(manifest, { plates = {}, sceneDefs = {} } = {}) {
  const captureScenes = (manifest?.scenes || []).filter(entry => {
    const id = entry.scene || entry.scene_id;
    const def = sceneDefs[id];
    const target = def?.render_target || entry.render_target;
    return target === 'browser_capture' || target === 'hybrid';
  });

  if (captureScenes.length === 0) {
    return {
      name: 'plates',
      status: 'pass',
      message: 'No browser_capture scenes — no plates required',
    };
  }

  const missing = [];
  for (const entry of captureScenes) {
    const id = entry.scene || entry.scene_id;
    const plate = plates[id];
    if (!plate?.src || !existsSync(plate.src)) {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    return {
      name: 'plates',
      status: 'fail',
      message: `Missing plate assets for ${missing.length} browser_capture scene(s): ${missing.join(', ')}`,
      details: { missing_plate_scene_ids: missing, capture_scene_count: captureScenes.length },
    };
  }

  return {
    name: 'plates',
    status: 'pass',
    message: `All ${captureScenes.length} browser_capture plate(s) present`,
  };
}

/**
 * Check that voiceover text fits within each scene's hold time (ANI-111).
 *
 * Returns pass when no voiceovers exist, warn when one or more scenes are
 * slightly over (≤10% overrun), and fail when a scene clearly won't hold
 * the line. Scene durations can be bumped, or the text shortened.
 *
 * @param {object} [ctx]
 * @param {object} [ctx.sceneDefs] - Scene definitions keyed by scene_id
 */
export function checkVoiceoverFits({ sceneDefs = {} } = {}) {
  const issues = [];
  let total = 0;
  for (const [id, scene] of Object.entries(sceneDefs)) {
    if (!scene?.voiceover?.text) continue;
    total += 1;
    const fit = checkVoiceoverFit(scene);
    if (fit.severity !== 'ok') issues.push({ scene_id: id, ...fit });
  }

  if (total === 0) {
    return { name: 'voiceover', status: 'pass', message: 'No scenes carry voiceover' };
  }
  if (issues.length === 0) {
    return { name: 'voiceover', status: 'pass', message: `Voiceover fits for all ${total} narrated scene(s)` };
  }
  const hasFail = issues.some(i => i.severity === 'fail');
  return {
    name: 'voiceover',
    status: hasFail ? 'fail' : 'warn',
    message: hasFail
      ? `Voiceover overruns scene hold time for ${issues.length} scene(s) by more than 10%`
      : `Voiceover is tight in ${issues.length} scene(s); consider extending scene duration`,
    details: { issues },
  };
}

/**
 * Check every scene entry in the manifest has a matching scene definition.
 * @param {object} manifest
 * @param {object} [ctx]
 * @param {object} [ctx.sceneDefs] - { [scene_id]: scene } keyed by scene_id
 */
export function checkManifestRefs(manifest, { sceneDefs = {} } = {}) {
  const entries = manifest?.scenes || [];
  if (entries.length === 0) {
    return { name: 'manifest_refs', status: 'fail', message: 'manifest has no scenes' };
  }

  const sceneDefKeys = new Set(Object.keys(sceneDefs));
  if (sceneDefKeys.size === 0) {
    return {
      name: 'manifest_refs',
      status: 'warn',
      message: 'No scene definitions supplied — cannot verify manifest refs',
    };
  }

  const unresolved = entries
    .map(e => e.scene || e.scene_id)
    .filter(id => !sceneDefKeys.has(id));

  if (unresolved.length > 0) {
    return {
      name: 'manifest_refs',
      status: 'fail',
      message: `Unresolved scene references: ${unresolved.join(', ')}`,
      details: { unresolved },
    };
  }
  return {
    name: 'manifest_refs',
    status: 'pass',
    message: `All ${entries.length} manifest scene(s) resolve`,
  };
}

/**
 * Check disk space headroom at the output directory (or repo root).
 * Uses `df` so it works on macOS + Linux without extra deps.
 */
export async function checkDiskSpace({ outputDir } = {}) {
  const target = outputDir || ROOT;
  try {
    const { stdout } = await execFileAsync('df', ['-k', target], { timeout: 5_000 });
    const lines = stdout.trim().split('\n');
    if (lines.length < 2) {
      return { name: 'disk_space', status: 'warn', message: 'Could not parse df output', details: { stdout } };
    }
    // Available kB is the 4th column on both macOS and Linux `df -k`.
    const cols = lines[1].trim().split(/\s+/);
    const availableKb = parseInt(cols[3], 10);
    if (!Number.isFinite(availableKb)) {
      return { name: 'disk_space', status: 'warn', message: 'df output unparseable', details: { line: lines[1] } };
    }
    const availableMb = Math.round(availableKb / 1024);
    if (availableMb < MIN_FREE_DISK_MB) {
      return {
        name: 'disk_space',
        status: 'fail',
        message: `Only ${availableMb} MB free at ${target}; need ≥ ${MIN_FREE_DISK_MB} MB`,
        details: { available_mb: availableMb, threshold_mb: MIN_FREE_DISK_MB, path: target },
      };
    }
    return {
      name: 'disk_space',
      status: 'pass',
      message: `${availableMb} MB free at ${target}`,
      details: { available_mb: availableMb, path: target },
    };
  } catch (err) {
    return {
      name: 'disk_space',
      status: 'warn',
      message: `Could not check disk space: ${err.message.split('\n')[0]}`,
    };
  }
}

// ── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Run all preflight checks. Returns a structured report.
 *
 * @param {object} manifest - Sequence manifest
 * @param {object} [ctx]
 * @param {object} [ctx.sceneDefs] - Scene definitions keyed by scene_id
 * @param {object} [ctx.plates] - Plate assets keyed by scene_id
 * @param {string} [ctx.outputDir] - Where the render will write output
 * @returns {Promise<{ ok: boolean, checks: Array, summary: string }>}
 */
export async function runPreflight(manifest, ctx = {}) {
  const checks = await Promise.all([
    checkEncoders(),
    Promise.resolve(checkFonts()),
    Promise.resolve(checkPlates(manifest, ctx)),
    Promise.resolve(checkManifestRefs(manifest, ctx)),
    Promise.resolve(checkVoiceoverFits(ctx)),
    checkDiskSpace(ctx),
  ]);

  const fails = checks.filter(c => c.status === 'fail');
  const warns = checks.filter(c => c.status === 'warn');
  const ok = fails.length === 0;

  const summary = ok
    ? (warns.length === 0 ? 'All preflight checks passed.' : `Preflight passed with ${warns.length} warning(s).`)
    : `Preflight failed: ${fails.length} blocker(s), ${warns.length} warning(s).`;

  return { ok, checks, summary };
}

/**
 * Format a preflight report as a human-readable string for CLI output.
 */
export function formatReport(report) {
  const lines = [];
  for (const check of report.checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '✗';
    lines.push(`  ${icon} ${check.name.padEnd(14)} ${check.message}`);
  }
  lines.push('');
  lines.push(report.summary);
  return lines.join('\n');
}
