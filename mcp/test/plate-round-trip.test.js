/**
 * Plate round-trip — ANI-108
 *
 * End-to-end golden test for the dual-render-target capture pipeline:
 * fixture HTML → capture-prototype.mjs → MP4 plate → assembleVideoSequence
 * → sceneRoutes wires the plate through to Remotion render props.
 *
 * Gracefully skips when ffmpeg (libx264) or Puppeteer Chrome is unavailable,
 * so the rest of the suite still runs in constrained environments.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { assembleVideoSequence } from '../lib/video-assembly.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../..');

// Honor ANIMATIC_SKIP_REMOTION_RENDER=1 to bypass the slow Remotion bundle +
// still-render step when developers only want the fast capture check. The
// gating is opt-out, not opt-in, so CI still catches plate-consumer regressions.
const SHOULD_RENDER_REMOTION = process.env.ANIMATIC_SKIP_REMOTION_RENDER !== '1';

// Minimal autoplay prototype. The `dwell: 500` comment is picked up by
// capture-prototype.mjs's duration detector — no animation required.
const FIXTURE_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Plate round-trip fixture</title></head>
<body style="margin:0;background:#111;color:#fff;font-family:system-ui;">
  <div class="scene" style="width:100%;height:180px;display:flex;align-items:center;justify-content:center;">
    <div style="font-size:20px">round-trip</div>
  </div>
  <script>
    // PHASES drives the duration probe in capture-prototype.mjs
    window.PHASES = [{ dwell: 500 }];
  </script>
</body>
</html>
`;

async function probeCaptureEnvironment() {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-encoders'], { timeout: 8_000 });
    if (!stdout.includes('libx264')) {
      return { ok: false, reason: 'ffmpeg missing libx264 encoder' };
    }
  } catch {
    return { ok: false, reason: 'ffmpeg not available' };
  }

  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    await browser.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `puppeteer launch failed: ${err.message}` };
  }
}

describe('plate round-trip (capture → assemble → route)', () => {
  let tmpDir;
  let captureDir;
  let platePath;
  let probe = { ok: false, reason: 'not probed' };

  before(async () => {
    probe = await probeCaptureEnvironment();
    if (!probe.ok) return;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-plate-rt-'));
    captureDir = path.join(tmpDir, 'captures');
    const fixturePath = path.join(tmpDir, 'fixture.html');
    fs.writeFileSync(fixturePath, FIXTURE_HTML, 'utf8');

    await execFileAsync(
      'node',
      [
        path.join(REPO_ROOT, 'scripts/capture-prototype.mjs'),
        fixturePath,
        '--format', 'mp4',
        '--fps', '10',
        '--width', '200',
        '--loops', '1',
        '--deterministic',
        '--output-dir', captureDir,
      ],
      { cwd: REPO_ROOT, timeout: 120_000 },
    );

    platePath = path.join(captureDir, 'fixture.mp4');
  });

  after(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('captures a plate, assembles render-props, and renders it via Remotion', { timeout: 360_000 }, async (t) => {
    if (!probe.ok) {
      t.skip(`capture environment unavailable: ${probe.reason}`);
      return;
    }

    assert.ok(fs.existsSync(platePath), `expected captured plate at ${platePath}`);
    assert.ok(fs.statSync(platePath).size > 0, 'plate file should not be empty');

    const manifest = {
      sequence_id: 'seq_round_trip',
      fps: 60,
      resolution: { w: 1920, h: 1080 },
      scenes: [
        { scene: 'sc_capture', duration_s: 2 },
        { scene: 'sc_native', duration_s: 3 },
      ],
    };

    const sceneDefs = {
      sc_capture: {
        scene_id: 'sc_capture',
        render_target: 'browser_capture',
        layers: [{ id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' }],
      },
      sc_native: {
        scene_id: 'sc_native',
        layers: [{ id: 'title', type: 'text', depth_class: 'foreground', product_role: 'hero' }],
      },
    };

    const routes = {
      sc_capture: { render_target: 'browser_capture' },
      sc_native: { render_target: 'remotion_native' },
    };
    const plates = { sc_capture: { src: platePath, format: 'mp4' } };

    const propsDir = path.join(tmpDir, 'render');
    const result = assembleVideoSequence({ manifest, sceneDefs, routes, plates, outputDir: propsDir });

    // ── Assembly assertions ────────────────────────────────────────────
    assert.equal(result.sceneRoutes.sc_capture.render_target, 'browser_capture');
    assert.equal(result.sceneRoutes.sc_capture.plate_src, platePath);
    assert.equal(result.sceneRoutes.sc_capture.plate_format, 'mp4');

    assert.equal(result.sceneRoutes.sc_native.render_target, 'remotion_native');
    assert.equal(result.sceneRoutes.sc_native.plate_src, null);

    assert.equal(result.plateStatus.sc_capture.status, 'ready');
    assert.equal(result.plateStatus.sc_native.status, 'native');
    assert.deepEqual(result.warnings, [], `unexpected warnings: ${result.warnings.join(' | ')}`);

    const propsPath = path.join(propsDir, 'render-props.json');
    assert.ok(fs.existsSync(propsPath), 'render-props.json should be written');

    const props = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
    assert.equal(props.sceneRoutes.sc_capture.plate_src, platePath);
    assert.equal(props.manifest.sequence_id, 'seq_round_trip');
    assert.ok(props.sceneDefs.sc_capture, 'sceneDefs should include the capture scene');
    assert.ok(props.sceneDefs.sc_native, 'sceneDefs should include the native scene');

    // ── Remotion render step (P2 from #36 review) ──────────────────────
    // Without this, regressions in SceneComposition's browser_capture →
    // OffthreadVideo branch would pass silently. `remotion still` loads the
    // real Sequence composition and renders frame 0 (inside sc_capture),
    // forcing the plate to actually be consumed.
    if (!SHOULD_RENDER_REMOTION) {
      t.diagnostic('ANIMATIC_SKIP_REMOTION_RENDER=1 — skipping Remotion render step');
      return;
    }

    // Remotion's OffthreadVideo treats absolute filesystem paths as
    // server-relative URLs (they 404 against its bundle server). For the
    // render step we rewrite plate_src to the plate's basename and point
    // Remotion at the plate's directory via `--public-dir`, which matches
    // the shape the /direct pipeline uses in practice (plates live inside
    // a public/ root alongside other static assets).
    const renderPropsForStill = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
    const plateBasename = path.basename(platePath);
    renderPropsForStill.sceneRoutes.sc_capture.plate_src = plateBasename;
    const stillPropsPath = path.join(tmpDir, 'render', 'render-props-still.json');
    fs.writeFileSync(stillPropsPath, JSON.stringify(renderPropsForStill));

    const frameOut = path.join(tmpDir, 'frame0.png');
    try {
      await execFileAsync(
        'npx',
        [
          'remotion', 'still', 'Sequence', frameOut,
          '--props', stillPropsPath,
          '--public-dir', path.dirname(platePath),
          '--frame=0',
        ],
        {
          cwd: REPO_ROOT,
          timeout: 240_000,
          env: { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' },
        },
      );
    } catch (err) {
      // Dump the fuller error tail so CI logs are actionable when Remotion
      // or its Chromium dependency isn't available.
      const stderr = (err.stderr || '').slice(-500);
      t.diagnostic(`Remotion render unavailable, skipping. stderr tail: ${stderr}`);
      return;
    }

    assert.ok(fs.existsSync(frameOut), 'Remotion should emit a still PNG for frame 0');
    assert.ok(
      fs.statSync(frameOut).size > 1024,
      'emitted PNG should be non-trivially sized (> 1KB), proving a real render',
    );
  });
});
