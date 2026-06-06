/**
 * Pixel diff comparison (ANI-126).
 *
 * Pure-function tests on synthetic RGBA buffers — no ffmpeg required. The
 * ffmpeg-backed decode + real-render coverage lives in
 * `golden/frames.test.js` (skip-gated on ffmpeg + Remotion availability).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  comparePixels,
  decodeImage,
  DEFAULT_CHANNEL_THRESHOLD,
  DEFAULT_MISMATCH_BUDGET,
} from '../lib/pixel-diff.js';

/** Solid-color RGBA frame. */
function frame(width, height, [r, g, b, a = 255]) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height * 4; i += 4) {
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  }
  return { width, height, rgba };
}

describe('comparePixels', () => {
  it('identical frames match exactly', () => {
    const a = frame(8, 8, [10, 20, 30]);
    const result = comparePixels(a, frame(8, 8, [10, 20, 30]));
    assert.equal(result.ok, true);
    assert.equal(result.mismatched_pixels, 0);
    assert.equal(result.max_channel_delta, 0);
    assert.equal(result.total_pixels, 64);
  });

  it('absorbs sub-threshold anti-aliasing noise', () => {
    // Every pixel differs by less than the channel threshold → still ok.
    const a = frame(8, 8, [100, 100, 100]);
    const b = frame(8, 8, [100 + DEFAULT_CHANNEL_THRESHOLD, 100, 100]);
    const result = comparePixels(a, b);
    assert.equal(result.ok, true);
    assert.equal(result.mismatched_pixels, 0);
    assert.equal(result.max_channel_delta, DEFAULT_CHANNEL_THRESHOLD);
  });

  it('tolerates mismatches inside the budget', () => {
    const a = frame(10, 10, [0, 0, 0]);
    const b = frame(10, 10, [0, 0, 0]);
    // Flip 2 of 100 pixels hard — exactly at the 2% default budget.
    b.rgba[0] = 255;
    b.rgba[4] = 255;
    const result = comparePixels(a, b);
    assert.equal(result.mismatched_pixels, 2);
    assert.equal(result.mismatch_ratio, 0.02);
    assert.equal(result.ok, true, 'at-budget should pass');
  });

  it('fails when mismatches exceed the budget', () => {
    const a = frame(10, 10, [0, 0, 0]);
    const b = frame(10, 10, [0, 0, 0]);
    for (let p = 0; p < 3; p++) b.rgba[p * 4] = 255; // 3% > 2%
    const result = comparePixels(a, b);
    assert.equal(result.ok, false);
    assert.equal(result.mismatched_pixels, 3);
  });

  it('a wholesale color shift fails decisively', () => {
    const result = comparePixels(frame(8, 8, [10, 10, 10]), frame(8, 8, [40, 10, 10]));
    assert.equal(result.ok, false);
    assert.equal(result.mismatch_ratio, 1);
    assert.equal(result.max_channel_delta, 30);
  });

  it('compares the alpha channel too', () => {
    const a = frame(4, 4, [10, 10, 10, 255]);
    const b = frame(4, 4, [10, 10, 10, 0]);
    const result = comparePixels(a, b);
    assert.equal(result.ok, false);
    assert.equal(result.max_channel_delta, 255);
  });

  it('dimension mismatch fails without comparing', () => {
    const result = comparePixels(frame(8, 8, [0, 0, 0]), frame(4, 4, [0, 0, 0]));
    assert.equal(result.ok, false);
    assert.equal(result.dimensions_match, false);
  });

  it('honors custom threshold and budget', () => {
    const a = frame(10, 10, [100, 100, 100]);
    const b = frame(10, 10, [120, 100, 100]); // delta 20 everywhere
    assert.equal(comparePixels(a, b, { channel_threshold: 25 }).ok, true);
    assert.equal(comparePixels(a, b, { channel_threshold: 10, mismatch_budget: 1 }).ok, true);
    assert.equal(comparePixels(a, b, { channel_threshold: 10, mismatch_budget: 0.5 }).ok, false);
  });

  it('locks the documented defaults', () => {
    assert.equal(DEFAULT_CHANNEL_THRESHOLD, 8);
    assert.equal(DEFAULT_MISMATCH_BUDGET, 0.02);
  });
});

describe('decodeImage', () => {
  it('routes probe + decode through an injectable exec', async () => {
    const calls = [];
    const rgba = Buffer.alloc(2 * 2 * 4, 7);
    const exec = async (cmd) => {
      calls.push(cmd);
      if (cmd === 'ffprobe') return { stdout: '2,2\n' };
      return { stdout: rgba };
    };
    const result = await decodeImage('/fake/frame.png', { exec });
    assert.deepEqual(calls, ['ffprobe', 'ffmpeg']);
    assert.equal(result.width, 2);
    assert.equal(result.height, 2);
    assert.equal(result.rgba.length, 16);
  });

  it('rejects on dimension/byte-count mismatch', async () => {
    const exec = async (cmd) =>
      cmd === 'ffprobe' ? { stdout: '4,4\n' } : { stdout: Buffer.alloc(8) };
    await assert.rejects(() => decodeImage('/fake/frame.png', { exec }), /expected 64/);
  });
});
