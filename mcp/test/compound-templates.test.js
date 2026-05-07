/**
 * Capture-contract smoke tests for library-driven compound primitive
 * templates (ANI-143). These are static checks on the HTML — they assert
 * each template has the markers required by the capture pipeline. The
 * actual capture run is gated behind ANIMATIC_RUN_CAPTURE_SPIKE=1 since it
 * takes ~10s and depends on Puppeteer + ffmpeg in PATH.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const COMPOUND_DIR = resolve(REPO_ROOT, 'catalog/compound');

function loadLibraryDrivenEntries() {
  const files = readdirSync(COMPOUND_DIR).filter(f => f.endsWith('.json'));
  const entries = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(resolve(COMPOUND_DIR, f), 'utf-8'));
    if (Array.isArray(data) || data.flavor !== 'library-driven') continue;
    entries.push({ file: f, data });
  }
  return entries;
}

describe('library-driven prototype_template — capture contract markers', () => {
  for (const { file, data } of loadLibraryDrivenEntries()) {
    const html = readFileSync(resolve(REPO_ROOT, data.prototype_template), 'utf-8');

    it(`${file}: declares a dwell annotation`, () => {
      assert.match(html, /dwell\s*:\s*\d+/,
        `${data.prototype_template}: missing "dwell: NNNN" — capture-prototype.mjs uses this for duration auto-detection`);
    });

    it(`${file}: renders a .scene root element`, () => {
      // Match either class="scene" (HTML) or className: 'scene' (React.createElement).
      // The capture pipeline queries `.scene` post-boot to measure content height,
      // so the React-rendered case is valid as long as it lands a scene class.
      assert.match(html, /class(?:Name)?\s*[:=]\s*["'][^"']*\bscene\b/,
        `${data.prototype_template}: missing .scene root — capture pipeline measures content height by querying it`);
    });

    it(`${file}: imports the declared library`, () => {
      const lib = data.library.name;
      const importPattern = lib === 'gsap'
        ? /\bgsap[@.]/
        : /motion@|motion\/react/;
      assert.match(html, importPattern,
        `${data.prototype_template}: declares library.name="${lib}" but template doesn't reference it`);
    });

    if (data.library.name === 'motion') {
      it(`${file}: pins React via ?deps= to avoid dual-React useContext failure`, () => {
        assert.match(html, /\?deps=react@/,
          `${data.prototype_template}: motion/react imports must include ?deps=react@... — without it esm.sh ships a second React and useContext fails (see ANI-143 reference memory)`);
      });
    }
  }
});

describe('library-driven prototype_template — no real-time-only APIs', () => {
  const FORBIDDEN_APIS = [
    { pattern: /addEventListener\(\s*["']scroll/, name: 'scroll listener' },
    { pattern: /addEventListener\(\s*["']pointermove/, name: 'pointermove listener' },
    { pattern: /new IntersectionObserver/, name: 'IntersectionObserver' },
    { pattern: /requestIdleCallback/, name: 'requestIdleCallback' },
  ];

  for (const { file, data } of loadLibraryDrivenEntries()) {
    const html = readFileSync(resolve(REPO_ROOT, data.prototype_template), 'utf-8');

    it(`${file}: declares no real-time dependencies and uses no real-time-only APIs`, () => {
      assert.deepEqual(data.capture_contract.real_time_dependencies, [],
        `${file}: capture_contract.real_time_dependencies must be empty for capture-deterministic primitives`);

      for (const { pattern, name } of FORBIDDEN_APIS) {
        assert.doesNotMatch(html, pattern,
          `${data.prototype_template}: uses ${name} — capture pipeline does not synthesize this event source`);
      }
    });
  }
});
