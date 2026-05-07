/**
 * GSAP capture adapter smoke test (ANI-143)
 *
 * Verifies the GSAP determinism adapter is present in the capture pipeline
 * and that its spike prototype is intact. This is a wiring test, not a
 * full capture run — exercising the capture pipeline end-to-end takes ~10s
 * and depends on Puppeteer + ffmpeg in PATH, which is too heavy for the
 * default test suite.
 *
 * To run a real capture against the spike prototype, set
 * ANIMATIC_RUN_CAPTURE_SPIKE=1 — that path is documented in the spec at
 * docs/cinematography/specs/compound-js-primitive.md.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const CAPTURE_SCRIPT = path.join(REPO_ROOT, 'scripts/capture-prototype.mjs');
const SPIKE_HTML = path.join(REPO_ROOT, 'prototypes/2026-05-05-gsap-capture-adapter-spike/index.html');

describe('GSAP capture adapter', () => {
  it('GSAP_ADAPTER_SCRIPT is defined in the capture pipeline', () => {
    const src = fs.readFileSync(CAPTURE_SCRIPT, 'utf-8');
    assert.match(src, /const GSAP_ADAPTER_SCRIPT = `/,
      'GSAP_ADAPTER_SCRIPT constant must exist in scripts/capture-prototype.mjs');
  });

  it('adapter disables lagSmoothing and uncaps ticker fps', () => {
    const src = fs.readFileSync(CAPTURE_SCRIPT, 'utf-8');
    assert.match(src, /gsap\.ticker\.lagSmoothing\(0\)/,
      'adapter must call gsap.ticker.lagSmoothing(0) — without it, GSAP clamps long rAF gaps and decouples timeline progress from virtual time');
    assert.match(src, /gsap\.ticker\.fps\(-1\)/,
      'adapter must call gsap.ticker.fps(-1) — capture controls rAF cadence directly');
  });

  it('adapter exposes the ESM opt-in hook', () => {
    const src = fs.readFileSync(CAPTURE_SCRIPT, 'utf-8');
    assert.match(src, /window\.__animaticSyncGsap/,
      'adapter must expose window.__animaticSyncGsap so React/ESM prototypes whose gsap is not on window can opt in');
  });

  it('adapter is injected after VIRTUAL_TIME_SCRIPT', () => {
    const src = fs.readFileSync(CAPTURE_SCRIPT, 'utf-8');
    const virtualIdx = src.indexOf("evaluateOnNewDocument(VIRTUAL_TIME_SCRIPT)");
    const adapterIdx = src.indexOf("evaluateOnNewDocument(GSAP_ADAPTER_SCRIPT)");
    assert.ok(virtualIdx > 0, 'VIRTUAL_TIME_SCRIPT injection call missing');
    assert.ok(adapterIdx > 0, 'GSAP_ADAPTER_SCRIPT injection call missing');
    assert.ok(adapterIdx > virtualIdx,
      'GSAP_ADAPTER_SCRIPT must inject after VIRTUAL_TIME_SCRIPT — the adapter checks window.__virtualTimeEnabled');
  });

  it('MP4 encoder is configured for byte-reproducible output', () => {
    const src = fs.readFileSync(CAPTURE_SCRIPT, 'utf-8');
    assert.match(src, /all_seed=42/,
      'noise filter must be seeded — otherwise ffmpeg pulls entropy from /dev/urandom and MP4 bytes diverge across runs');
    assert.match(src, /\+bitexact/,
      'encoder must run with +bitexact flags to strip non-deterministic container metadata');
    assert.match(src, /threads=1/,
      'x264 must run single-threaded — multi-threaded encoding makes tiny non-deterministic decisions at slice boundaries');
  });
});

describe('GSAP capture adapter spike prototype', () => {
  it('spike prototype exists', () => {
    assert.ok(fs.existsSync(SPIKE_HTML),
      `spike prototype missing at ${SPIKE_HTML} — referenced by docs/cinematography/specs/compound-js-primitive.md as the determinism-contract reference`);
  });

  it('spike loads gsap and uses a timeline', () => {
    const html = fs.readFileSync(SPIKE_HTML, 'utf-8');
    assert.match(html, /gsap@/, 'spike must pin a gsap version');
    assert.match(html, /gsap\.timeline/, 'spike must exercise gsap.timeline (the path the adapter is for)');
    assert.match(html, /dwell\s*:/, 'spike must declare a dwell phase so capture-prototype.mjs auto-detects duration');
  });

  it('spike surfaces adapter activation in the rendered scene', () => {
    const html = fs.readFileSync(SPIKE_HTML, 'utf-8');
    assert.match(html, /__gsapCaptureAdapter/,
      'spike must read window.__gsapCaptureAdapter so a captured frame visibly distinguishes adapter-active from adapter-missing');
  });
});
