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

  it('captures an MP4 plate and assembles it into render props', { timeout: 180_000 }, (t) => {
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
  });
});
