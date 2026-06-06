/**
 * Audio fingerprint math (ANI-127).
 *
 * Pure-function tests on JS-synthesized PCM — no ffmpeg required. The
 * ffmpeg-backed decode + real-pipeline coverage lives in
 * `golden/audio-fingerprint.test.js` (skip-gated on ffmpeg availability).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeFingerprint,
  fingerprintAudioFile,
  FINGERPRINT_BANDS,
  FINGERPRINT_SAMPLE_RATE,
} from '../lib/audio-fingerprint.js';

/** Synthesize an s16le sine at `freq` Hz / `amplitude` (0-1) for `seconds`. */
function sinePcm(freq, seconds, amplitude = 0.5, sampleRate = FINGERPRINT_SAMPLE_RATE) {
  const samples = new Int16Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * amplitude * 32767);
  }
  return samples;
}

describe('computeFingerprint', () => {
  it('measures sine RMS at amplitude/√2', () => {
    // 0.5 amplitude sine → RMS 0.3536 → −9.0 dBFS.
    const fp = computeFingerprint(sinePcm(440, 2, 0.5));
    assert.equal(fp.seconds.length, 2);
    for (const s of fp.seconds) {
      assert.ok(Math.abs(s.rms_db - -9.0) <= 0.1, `rms_db ${s.rms_db} should be ≈ -9.0`);
    }
  });

  it('concentrates band energy where the tone lives', () => {
    // 440 Hz → band 1 (250-1000). 3000 Hz → band 3 (2500-4000).
    const low = computeFingerprint(sinePcm(440, 1));
    assert.ok(low.seconds[0].bands[1] > 0.9, `expected band 1 dominance, got ${low.seconds[0].bands}`);

    const high = computeFingerprint(sinePcm(3000, 1));
    assert.ok(high.seconds[0].bands[3] > 0.9, `expected band 3 dominance, got ${high.seconds[0].bands}`);
  });

  it('puts the spectral centroid at the tone frequency', () => {
    const fp = computeFingerprint(sinePcm(1000, 1));
    assert.ok(Math.abs(fp.seconds[0].centroid_hz - 1000) <= 20,
      `centroid ${fp.seconds[0].centroid_hz} should be ≈ 1000`);
  });

  it('floors silence at -96 dBFS with zero centroid', () => {
    const fp = computeFingerprint(new Int16Array(FINGERPRINT_SAMPLE_RATE));
    assert.equal(fp.seconds[0].rms_db, -96);
    assert.equal(fp.seconds[0].centroid_hz, 0);
    assert.deepEqual(fp.seconds[0].bands, FINGERPRINT_BANDS.map(() => 0));
  });

  it('reports duration and accepts Buffer input', () => {
    const samples = sinePcm(440, 2.5);
    const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    const fp = computeFingerprint(buf);
    assert.equal(fp.duration_s, 2.5);
    assert.equal(fp.seconds.length, 3); // 2 full + 1 partial second
    assert.equal(fp.sample_rate, FINGERPRINT_SAMPLE_RATE);
  });

  it('is deterministic for identical input', () => {
    const a = computeFingerprint(sinePcm(440, 2));
    const b = computeFingerprint(sinePcm(440, 2));
    assert.deepEqual(a, b);
  });
});

describe('fingerprintAudioFile', () => {
  it('routes through an injectable decoder', async () => {
    const samples = sinePcm(440, 1);
    const decoded = [];
    const fp = await fingerprintAudioFile('/fake/path.wav', {
      decode: async (path, rate) => {
        decoded.push([path, rate]);
        return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
      },
    });
    assert.deepEqual(decoded, [['/fake/path.wav', FINGERPRINT_SAMPLE_RATE]]);
    assert.equal(fp.seconds.length, 1);
    assert.ok(fp.seconds[0].bands[1] > 0.9);
  });
});
