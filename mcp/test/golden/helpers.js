/**
 * Golden artifact harness helpers (ANI-110)
 *
 * Pattern: compute a deterministic actual value, then call
 * `assertMatchesGolden(label, actual)` to compare against a checked-in
 * JSON snapshot at `mcp/test/golden/fixtures/<label>.json`.
 *
 * Updating a golden is an explicit, reviewable commit:
 *   ANIMATIC_UPDATE_GOLDENS=1 npm run test:golden
 * rewrites the fixture files with current output. Review the diff, commit.
 *
 * Two comparison modes:
 *   - `assertMatchesGolden`       — exact JSON equality (structural snapshots)
 *   - `assertMatchesGoldenApprox` — same structure, but numeric leaves may
 *     drift within per-key tolerances (audio fingerprints, ANI-127 — lossy
 *     codecs are not bit-stable across encoder versions)
 *
 * Frame-level (pixel diff) goldens remain follow-up work (ANI-126).
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const FIXTURES_ROOT = resolve(dirname(__filename), 'fixtures');

export const UPDATE_MODE = process.env.ANIMATIC_UPDATE_GOLDENS === '1';

/**
 * Assert that `actual` matches the golden fixture stored at
 * `fixtures/<label>.json`. In update mode, writes the actual value to disk
 * instead of asserting.
 *
 * @param {string} label - Slash-separated fixture identifier, e.g.
 *   `"manifests/brand-teaser.beats"`. Used to derive the on-disk path.
 * @param {unknown} actual - JSON-serializable value to compare.
 */
export function assertMatchesGolden(label, actual) {
  const fixturePath = resolve(FIXTURES_ROOT, `${label}.json`);
  const serialized = JSON.stringify(actual, null, 2) + '\n';

  if (UPDATE_MODE) {
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, serialized);
    return;
  }

  if (!existsSync(fixturePath)) {
    throw new Error(
      `Golden fixture missing at ${fixturePath}. ` +
      `Run \`ANIMATIC_UPDATE_GOLDENS=1 npm run test:golden\` to create it, then review the diff before committing.`,
    );
  }

  const expected = readFileSync(fixturePath, 'utf-8');
  if (serialized !== expected) {
    // Surface the first differing line so CI logs point at the actual drift.
    const actualLines = serialized.split('\n');
    const expectedLines = expected.split('\n');
    const len = Math.min(actualLines.length, expectedLines.length);
    let firstDiff = -1;
    for (let i = 0; i < len; i++) {
      if (actualLines[i] !== expectedLines[i]) { firstDiff = i; break; }
    }
    const hint = firstDiff >= 0
      ? `\n  first diff at line ${firstDiff + 1}:\n    expected: ${expectedLines[firstDiff]}\n    actual:   ${actualLines[firstDiff]}`
      : `\n  lengths differ: expected ${expectedLines.length} lines, actual ${actualLines.length} lines`;

    assert.fail(
      `Golden mismatch at ${label}. ` +
      `If this drift is intentional, rerun with ANIMATIC_UPDATE_GOLDENS=1 and commit the updated fixture.${hint}`,
    );
  }
}

/**
 * Recursively compare `actual` against `expected`, allowing numeric leaves
 * to drift within a tolerance chosen by the nearest enclosing object key.
 * Returns the first mismatch as a string, or null when everything matches.
 *
 * @param {unknown} actual
 * @param {unknown} expected
 * @param {Record<string, number>} tolerances - Per-key absolute tolerance.
 *   The key applying to a leaf is the closest ancestor object key (so each
 *   element of `bands: [...]` uses the `bands` tolerance).
 * @param {string} path - Current location (for the mismatch message)
 * @param {number} tolerance - Tolerance inherited from the enclosing key
 */
export function diffWithTolerance(actual, expected, tolerances, path = '$', tolerance = 0) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Math.abs(actual - expected) > tolerance) {
      return `${path}: ${actual} differs from golden ${expected} by more than ±${tolerance}`;
    }
    return null;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return `${path}: type mismatch (array vs non-array)`;
    }
    if (actual.length !== expected.length) {
      return `${path}: length ${actual.length} differs from golden ${expected.length}`;
    }
    for (let i = 0; i < expected.length; i++) {
      const d = diffWithTolerance(actual[i], expected[i], tolerances, `${path}[${i}]`, tolerance);
      if (d) return d;
    }
    return null;
  }
  if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);
    if (expectedKeys.length !== actualKeys.length ||
        expectedKeys.some(k => !Object.hasOwn(actual, k))) {
      return `${path}: keys [${actualKeys}] differ from golden [${expectedKeys}]`;
    }
    for (const key of expectedKeys) {
      const d = diffWithTolerance(
        actual[key], expected[key], tolerances, `${path}.${key}`,
        Object.hasOwn(tolerances, key) ? tolerances[key] : tolerance,
      );
      if (d) return d;
    }
    return null;
  }
  if (actual !== expected) {
    return `${path}: ${JSON.stringify(actual)} differs from golden ${JSON.stringify(expected)}`;
  }
  return null;
}

/**
 * Like `assertMatchesGolden`, but numeric leaves may drift within per-key
 * absolute tolerances. Structure, strings, and key sets still match exactly.
 * Update mode rewrites the fixture with the current actual value.
 *
 * @param {string} label - Fixture identifier (see assertMatchesGolden)
 * @param {unknown} actual - JSON-serializable value
 * @param {Record<string, number>} tolerances - e.g. { rms_db: 1, centroid_hz: 50 }
 */
export function assertMatchesGoldenApprox(label, actual, tolerances) {
  const fixturePath = resolve(FIXTURES_ROOT, `${label}.json`);
  const serialized = JSON.stringify(actual, null, 2) + '\n';

  if (UPDATE_MODE) {
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, serialized);
    return;
  }

  if (!existsSync(fixturePath)) {
    throw new Error(
      `Golden fixture missing at ${fixturePath}. ` +
      `Run \`ANIMATIC_UPDATE_GOLDENS=1 npm run test:golden\` to create it, then review the diff before committing.`,
    );
  }

  const expected = JSON.parse(readFileSync(fixturePath, 'utf-8'));
  const mismatch = diffWithTolerance(JSON.parse(serialized), expected, tolerances);
  if (mismatch) {
    assert.fail(
      `Golden mismatch at ${label} (tolerance-aware): ${mismatch}. ` +
      `If this drift is intentional, rerun with ANIMATIC_UPDATE_GOLDENS=1 and commit the updated fixture.`,
    );
  }
}
