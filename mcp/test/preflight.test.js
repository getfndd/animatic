/**
 * Preflight doctor tests (ANI-115)
 *
 * Unit-tests the pure checks and the orchestrator. Encoder + disk checks
 * shell out to `ffmpeg`/`df` and are kept deterministic via small
 * integration-style assertions that tolerate either a present-or-missing
 * environment (ffmpeg could be absent in CI; that's OK, we just verify
 * the check produces a structured result in either case).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  checkFonts,
  checkPlates,
  checkManifestRefs,
  checkDiskSpace,
  checkEncoders,
  runPreflight,
  formatReport,
} from '../lib/preflight.js';

// ── Fonts ───────────────────────────────────────────────────────────────────

describe('checkFonts', () => {
  it('passes when vendored Satoshi pack is present', () => {
    // The repo ships the vendored fonts under public/fonts/satoshi/.
    const result = checkFonts();
    assert.equal(result.status, 'pass',
      `expected fonts pass — did the vendored pack get removed? message: ${result.message}`);
  });
});

// ── Plates ──────────────────────────────────────────────────────────────────

describe('checkPlates', () => {
  const captureManifest = {
    scenes: [
      { scene: 'sc_cap', duration_s: 2 },
      { scene: 'sc_nat', duration_s: 3 },
    ],
  };
  const defs = {
    sc_cap: { scene_id: 'sc_cap', render_target: 'browser_capture' },
    sc_nat: { scene_id: 'sc_nat', render_target: 'remotion_native' },
  };

  it('passes when no browser_capture scenes exist', () => {
    const onlyNative = {
      scenes: [{ scene: 'sc_nat', duration_s: 3 }],
    };
    const result = checkPlates(onlyNative, {
      sceneDefs: { sc_nat: defs.sc_nat },
    });
    assert.equal(result.status, 'pass');
    assert.match(result.message, /No browser_capture/);
  });

  it('fails when a browser_capture scene has no plate', () => {
    const result = checkPlates(captureManifest, { sceneDefs: defs, plates: {} });
    assert.equal(result.status, 'fail');
    assert.ok(result.details.missing_plate_scene_ids.includes('sc_cap'));
  });

  it('fails when plate file does not exist on disk', () => {
    const result = checkPlates(captureManifest, {
      sceneDefs: defs,
      plates: { sc_cap: { src: '/nonexistent/plate.mp4' } },
    });
    assert.equal(result.status, 'fail');
    assert.ok(result.details.missing_plate_scene_ids.includes('sc_cap'));
  });

  it('passes when every browser_capture plate exists', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-preflight-'));
    const platePath = path.join(tmp, 'plate.mp4');
    fs.writeFileSync(platePath, 'x');
    try {
      const result = checkPlates(captureManifest, {
        sceneDefs: defs,
        plates: { sc_cap: { src: platePath } },
      });
      assert.equal(result.status, 'pass');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── Manifest refs ───────────────────────────────────────────────────────────

describe('checkManifestRefs', () => {
  it('fails when manifest has no scenes', () => {
    const result = checkManifestRefs({ scenes: [] });
    assert.equal(result.status, 'fail');
  });

  it('warns when no scene definitions are supplied', () => {
    const result = checkManifestRefs({ scenes: [{ scene: 'sc_01' }] });
    assert.equal(result.status, 'warn');
  });

  it('fails when a manifest entry has no matching scene definition', () => {
    const result = checkManifestRefs(
      { scenes: [{ scene: 'sc_01' }, { scene: 'sc_02' }] },
      { sceneDefs: { sc_01: { scene_id: 'sc_01' } } },
    );
    assert.equal(result.status, 'fail');
    assert.deepEqual(result.details.unresolved, ['sc_02']);
  });

  it('passes when all scenes resolve', () => {
    const result = checkManifestRefs(
      { scenes: [{ scene: 'sc_01' }, { scene: 'sc_02' }] },
      { sceneDefs: { sc_01: {}, sc_02: {} } },
    );
    assert.equal(result.status, 'pass');
  });
});

// ── Disk space ──────────────────────────────────────────────────────────────

describe('checkDiskSpace', () => {
  it('returns a structured result with an available_mb field on pass', async () => {
    const result = await checkDiskSpace();
    assert.ok(['pass', 'warn', 'fail'].includes(result.status));
    if (result.status === 'pass') {
      assert.ok(Number.isFinite(result.details.available_mb));
    }
  });
});

// ── Encoders ────────────────────────────────────────────────────────────────

describe('checkEncoders', () => {
  it('returns a structured result regardless of environment', async () => {
    const result = await checkEncoders();
    assert.ok(['pass', 'warn', 'fail'].includes(result.status));
    assert.equal(result.name, 'encoders');
  });
});

// ── Orchestrator ────────────────────────────────────────────────────────────

describe('runPreflight', () => {
  it('aggregates checks into a single report with ok + summary', async () => {
    const manifest = { scenes: [{ scene: 'sc_01' }] };
    const report = await runPreflight(manifest, {
      sceneDefs: { sc_01: {} },
    });
    assert.ok(Array.isArray(report.checks));
    assert.equal(report.checks.length, 6);
    assert.equal(typeof report.ok, 'boolean');
    assert.equal(typeof report.summary, 'string');
  });

  it('ok=false when any check fails', async () => {
    // An empty manifest triggers a manifest_refs fail.
    const report = await runPreflight({ scenes: [] });
    assert.equal(report.ok, false);
    assert.match(report.summary, /Preflight failed/);
  });
});

// ── formatReport ────────────────────────────────────────────────────────────

describe('formatReport', () => {
  it('renders one line per check plus a summary', () => {
    const report = {
      ok: true,
      summary: 'All preflight checks passed.',
      checks: [
        { name: 'encoders', status: 'pass', message: 'ok' },
        { name: 'fonts', status: 'warn', message: 'meh' },
      ],
    };
    const out = formatReport(report);
    assert.match(out, /encoders/);
    assert.match(out, /fonts/);
    assert.match(out, /All preflight checks passed/);
  });
});
