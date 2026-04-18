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
 * Deliberately JSON-only for now. Frame-level (pixel diff) and audio-level
 * (waveform fingerprint) goldens are intentionally out of scope for this
 * pass — tracked as follow-up work.
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
