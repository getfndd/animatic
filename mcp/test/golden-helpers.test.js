/**
 * Tolerance-aware golden comparison (ANI-127).
 *
 * Unit tests for `diffWithTolerance` — the comparator behind
 * `assertMatchesGoldenApprox`. Exact-match behavior of the original
 * helper is exercised throughout the golden suite itself.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { diffWithTolerance } from './golden/helpers.js';

describe('diffWithTolerance', () => {
  const TOL = { rms_db: 1, centroid_hz: 50, bands: 0.05 };

  it('passes numeric drift within the keyed tolerance', () => {
    const golden = { rms_db: -9.0, centroid_hz: 1000 };
    const actual = { rms_db: -9.8, centroid_hz: 1040 };
    assert.equal(diffWithTolerance(actual, golden, TOL), null);
  });

  it('fails numeric drift beyond the keyed tolerance', () => {
    const d = diffWithTolerance({ rms_db: -11.5 }, { rms_db: -9.0 }, TOL);
    assert.match(d, /rms_db/);
    assert.match(d, /±1/);
  });

  it('inherits the enclosing key tolerance into arrays', () => {
    // Each element of `bands` uses the `bands` tolerance.
    assert.equal(
      diffWithTolerance({ bands: [0.97, 0.03] }, { bands: [0.95, 0.05] }, TOL),
      null,
    );
    const d = diffWithTolerance({ bands: [0.80, 0.20] }, { bands: [0.95, 0.05] }, TOL);
    assert.match(d, /bands\[0\]/);
  });

  it('defaults to exact match for un-keyed numbers', () => {
    assert.equal(diffWithTolerance({ t: 3 }, { t: 3 }, TOL), null);
    const d = diffWithTolerance({ t: 4 }, { t: 3 }, TOL);
    assert.match(d, /\.t:/);
  });

  it('requires exact structure: lengths, key sets, strings', () => {
    assert.match(diffWithTolerance([1, 2], [1, 2, 3], TOL), /length/);
    assert.match(diffWithTolerance({ a: 1 }, { a: 1, b: 2 }, TOL), /keys/);
    assert.match(diffWithTolerance({ name: 'x' }, { name: 'y' }, TOL), /differs from golden/);
    assert.equal(diffWithTolerance({ name: 'x' }, { name: 'x' }, TOL), null);
  });

  it('handles nested fingerprint-shaped documents', () => {
    const golden = {
      sample_rate: 8000,
      seconds: [{ t: 0, rms_db: -9.0, bands: [0, 0.98, 0.01, 0.01], centroid_hz: 440 }],
    };
    const actual = {
      sample_rate: 8000,
      seconds: [{ t: 0, rms_db: -9.4, bands: [0, 0.96, 0.02, 0.02], centroid_hz: 455 }],
    };
    assert.equal(diffWithTolerance(actual, golden, TOL), null);
    // sample_rate has no keyed tolerance → exact
    const d = diffWithTolerance({ ...actual, sample_rate: 8001 }, golden, TOL);
    assert.match(d, /sample_rate/);
  });
});
