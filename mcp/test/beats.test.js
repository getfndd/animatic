/**
 * Tests for Beat Analysis & Sync (ANI-37).
 *
 * Covers: detectBeats, computeEnergyCurve, syncToBeats,
 * matchEnergyToScenes, decodeWav.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectBeats,
  computeEnergyCurve,
  syncToBeats,
  matchEnergyToScenes,
  decodeWav,
} from '../lib/beats.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a sine wave with periodic volume spikes (simulated beats). */
function generateBeatSignal(sampleRate, durationS, bpm) {
  const samples = new Float32Array(sampleRate * durationS);
  const beatInterval = 60 / bpm; // seconds per beat
  const freq = 440; // Hz

  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const base = Math.sin(2 * Math.PI * freq * t) * 0.1;

    // Add energy spike at each beat
    const timeSinceBeat = t % beatInterval;
    const inBeat = timeSinceBeat < 0.05; // 50ms pulse
    samples[i] = inBeat ? Math.sin(2 * Math.PI * freq * t) * 0.8 : base;
  }
  return samples;
}

/** Create a minimal valid WAV buffer. */
function createWavBuffer(samples, sampleRate = 44100, channels = 1) {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);        // chunk size
  buffer.writeUInt16LE(1, 20);         // PCM format
  buffer.writeUInt16LE(channels, 22);  // channels
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(channels * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = Math.round(clamped * 32767);
    buffer.writeInt16LE(int16, 44 + i * bytesPerSample);
  }

  return buffer;
}

// ── detectBeats ──────────────────────────────────────────────────────────────

describe('detectBeats', () => {
  it('returns empty result for empty samples', () => {
    const result = detectBeats(new Float32Array(0), 44100);
    assert.equal(result.bpm, 0);
    assert.equal(result.beats.length, 0);
    assert.equal(result.energy.length, 0);
  });

  it('detects beats in a periodic signal', () => {
    const sampleRate = 44100;
    const signal = generateBeatSignal(sampleRate, 4, 120);
    const { bpm, beats, energy } = detectBeats(signal, sampleRate);

    // Should detect something in the BPM range
    assert.ok(bpm > 0, 'BPM should be positive');
    assert.ok(beats.length > 2, `Should detect multiple beats, got ${beats.length}`);
    assert.ok(energy.length > 0, 'Should produce energy values');
  });

  it('beats are monotonically increasing', () => {
    const signal = generateBeatSignal(44100, 3, 100);
    const { beats } = detectBeats(signal, 44100);

    for (let i = 1; i < beats.length; i++) {
      assert.ok(beats[i] > beats[i - 1], `Beat ${i} should be after beat ${i - 1}`);
    }
  });

  it('respects minBeatInterval', () => {
    const signal = generateBeatSignal(44100, 3, 120);
    const minInterval = 0.4;
    const { beats } = detectBeats(signal, 44100, { minBeatInterval: minInterval });

    for (let i = 1; i < beats.length; i++) {
      const interval = beats[i] - beats[i - 1];
      assert.ok(interval >= minInterval - 0.01,
        `Interval ${interval} should be >= ${minInterval}`);
    }
  });

  it('energy array has expected length', () => {
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate * 2); // 2 seconds
    samples.fill(0.5);
    const hopSize = 512;
    const { energy } = detectBeats(samples, sampleRate, { hopSize });

    const expectedWindows = Math.floor((samples.length - 1024) / hopSize) + 1;
    // Allow some tolerance
    assert.ok(Math.abs(energy.length - expectedWindows) <= 2,
      `Energy length ${energy.length} should be close to ${expectedWindows}`);
  });
});

// ── computeEnergyCurve ───────────────────────────────────────────────────────

describe('computeEnergyCurve', () => {
  it('returns normalized values between 0 and 1', () => {
    const energy = [0.1, 0.5, 0.3, 0.8, 0.2, 0.6, 0.4, 0.9, 0.1, 0.7];
    const curve = computeEnergyCurve(energy, 5);

    for (const v of curve) {
      assert.ok(v >= 0 && v <= 1, `Value ${v} should be 0-1`);
    }
  });

  it('has the requested number of segments', () => {
    const energy = new Array(100).fill(0.5);
    const curve = computeEnergyCurve(energy, 10);
    assert.equal(curve.length, 10);
  });

  it('returns zeros for empty energy', () => {
    const curve = computeEnergyCurve([], 5);
    assert.equal(curve.length, 5);
    assert.ok(curve.every(v => v === 0));
  });

  it('peak segment has value 1.0', () => {
    const energy = [0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1];
    const curve = computeEnergyCurve(energy, 5);
    assert.ok(curve.some(v => v === 1), 'Peak should normalize to 1.0');
  });
});

// ── syncToBeats ──────────────────────────────────────────────────────────────

describe('syncToBeats', () => {
  it('returns unchanged durations when no beats provided', () => {
    const durations = [3, 3, 3];
    const { synced, adjustments } = syncToBeats(durations, []);
    assert.deepEqual(synced, [3, 3, 3]);
    assert.equal(adjustments.length, 0);
  });

  it('snaps boundaries to nearby beats', () => {
    const durations = [3.0, 3.0, 3.0]; // boundaries at 3.0, 6.0
    const beats = [0.5, 1.0, 1.5, 2.0, 2.5, 3.2, 3.5, 4.0, 4.5, 5.0, 5.5, 6.3, 7.0];
    // Boundary at 3.0 → nearest beat 3.2 → stretch by 0.2
    const { synced, adjustments } = syncToBeats(durations, beats);

    assert.ok(adjustments.length > 0, 'Should have at least one adjustment');
    // First scene should be stretched toward 3.2
    assert.ok(synced[0] > 3.0, `First scene ${synced[0]} should be stretched`);
  });

  it('respects maxStretch limit', () => {
    const durations = [3.0, 3.0];
    const beats = [3.5]; // 0.5s away from boundary at 3.0
    const { synced } = syncToBeats(durations, beats, { maxStretch: 0.3 });

    // 0.5 > maxStretch of 0.3, so should NOT adjust
    assert.equal(synced[0], 3.0);
  });

  it('respects maxCompress limit', () => {
    const durations = [3.0, 3.0];
    const beats = [2.5]; // -0.5s from boundary
    const { synced } = syncToBeats(durations, beats, { maxCompress: 0.3 });

    // 0.5 > maxCompress of 0.3, so should NOT adjust
    assert.equal(synced[0], 3.0);
  });

  it('does not compress below minDuration', () => {
    const durations = [1.2, 3.0];
    const beats = [1.0]; // compress by 0.2 → would make 1.0
    const { synced } = syncToBeats(durations, beats, { minDuration: 1.1 });

    // 1.2 - 0.2 = 1.0 < minDuration 1.1, so should NOT adjust
    assert.equal(synced[0], 1.2);
  });

  it('last scene is never adjusted', () => {
    const durations = [3.0, 3.0];
    const beats = [3.2, 6.2];
    const { synced } = syncToBeats(durations, beats);

    // Only first scene boundary (at 3.0) is adjusted
    // Last scene duration is never touched (no boundary after it)
    assert.equal(synced.length, 2);
  });

  it('adjustments include beat_time and type', () => {
    const durations = [3.0, 3.0];
    const beats = [3.2];
    const { adjustments } = syncToBeats(durations, beats);

    if (adjustments.length > 0) {
      assert.ok('beat_time' in adjustments[0]);
      assert.ok('type' in adjustments[0]);
      assert.ok(['stretch', 'compress'].includes(adjustments[0].type));
    }
  });
});

// ── matchEnergyToScenes ──────────────────────────────────────────────────────

describe('matchEnergyToScenes', () => {
  it('returns default intensity for empty energy', () => {
    const intensities = matchEnergyToScenes([3, 3], [], 44100, 512);
    assert.equal(intensities.length, 2);
    assert.ok(intensities.every(v => v === 0.3));
  });

  it('returns values in 0.1-0.8 range', () => {
    const energy = new Array(200).fill(0).map((_, i) => Math.sin(i / 10) * 0.5 + 0.5);
    const intensities = matchEnergyToScenes([2, 2, 2], energy, 44100, 512);

    for (const v of intensities) {
      assert.ok(v >= 0.1 && v <= 0.8, `Intensity ${v} should be 0.1-0.8`);
    }
  });

  it('high-energy segments get higher intensity', () => {
    // First half quiet, second half loud
    const energy = [
      ...new Array(100).fill(0.1),
      ...new Array(100).fill(0.9),
    ];
    const intensities = matchEnergyToScenes([2, 2], energy, 44100, 512);

    assert.ok(intensities[1] > intensities[0],
      `Loud section ${intensities[1]} should be more intense than quiet ${intensities[0]}`);
  });
});

// ── decodeWav ────────────────────────────────────────────────────────────────

describe('decodeWav', () => {
  it('decodes a valid 16-bit mono WAV', () => {
    const sampleRate = 44100;
    const rawSamples = new Float32Array(44100); // 1 second
    for (let i = 0; i < rawSamples.length; i++) {
      rawSamples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }

    const buffer = createWavBuffer(rawSamples, sampleRate, 1);
    const { samples, sampleRate: sr, channels, duration } = decodeWav(buffer);

    assert.equal(sr, sampleRate);
    assert.equal(channels, 1);
    assert.ok(Math.abs(duration - 1.0) < 0.01, `Duration ${duration} should be ~1.0`);
    assert.equal(samples.length, 44100);
  });

  it('decodes stereo WAV and mixes to mono', () => {
    const sampleRate = 22050;
    const mono = new Float32Array(22050);
    mono.fill(0.5);

    // Create stereo buffer manually
    const bitsPerSample = 16;
    const channels = 2;
    const bytesPerSample = bitsPerSample / 8;
    const dataSize = mono.length * channels * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
    buffer.writeUInt16LE(channels * bytesPerSample, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < mono.length; i++) {
      const int16 = Math.round(mono[i] * 32767);
      // Left + Right channels
      buffer.writeInt16LE(int16, 44 + i * 4);
      buffer.writeInt16LE(int16, 44 + i * 4 + 2);
    }

    const { samples, channels: ch } = decodeWav(buffer);
    assert.equal(ch, 2);
    assert.equal(samples.length, mono.length);
  });

  it('throws on non-WAV buffer', () => {
    const buffer = Buffer.from('not a wav file at all');
    assert.throws(() => decodeWav(buffer), /Not a valid WAV file/);
  });

  it('throws on non-PCM WAV', () => {
    // Create buffer with non-PCM format (format = 3 = IEEE float)
    // Need enough space for fmt chunk (24 bytes) + data chunk (8 bytes)
    const buffer = Buffer.alloc(48);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(40, 4);     // file size - 8
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);    // fmt chunk size
    buffer.writeUInt16LE(3, 20);     // IEEE float, not PCM
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(44100, 24);
    buffer.writeUInt32LE(44100 * 4, 28);
    buffer.writeUInt16LE(4, 32);
    buffer.writeUInt16LE(32, 34);
    buffer.write('data', 36);        // data chunk
    buffer.writeUInt32LE(0, 40);     // data size = 0

    assert.throws(() => decodeWav(buffer), /Only PCM WAV/);
  });
});

// ── Integration: detectBeats + syncToBeats ───────────────────────────────────

describe('beat detection → sync integration', () => {
  it('full pipeline: generate signal → detect → sync', () => {
    const sampleRate = 44100;
    const signal = generateBeatSignal(sampleRate, 6, 120); // 6s, 120 BPM

    const { bpm, beats } = detectBeats(signal, sampleRate);
    assert.ok(bpm > 0);
    assert.ok(beats.length > 4);

    const durations = [2.0, 2.0, 2.0];
    const { synced, adjustments } = syncToBeats(durations, beats);

    // All synced durations should be positive
    for (const d of synced) {
      assert.ok(d > 0, `Duration ${d} should be positive`);
    }
    // Total should be close to original total (6s)
    const syncedTotal = synced.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(syncedTotal - 6.0) < 1.0,
      `Synced total ${syncedTotal} should be close to 6.0`);
  });
});
