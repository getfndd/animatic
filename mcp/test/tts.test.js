/**
 * TTS provider interface tests (ANI-111) — mock provider is exercised end
 * to end; macOS-specific provider is gated behind a probe so Linux CI
 * doesn't falsely fail.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  generateSpeech,
  synthesizeVoiceovers,
  estimateSpeechDurationMs,
  validateVoiceover,
  checkVoiceoverFit,
  AVAILABLE_PROVIDERS,
  AVERAGE_WPM,
} from '../lib/tts.js';

// ── Duration estimation ─────────────────────────────────────────────────────

describe('estimateSpeechDurationMs', () => {
  it('returns 0 for empty / whitespace-only text', () => {
    assert.equal(estimateSpeechDurationMs(''), 0);
    assert.equal(estimateSpeechDurationMs('   '), 0);
  });

  it('clamps to a 500ms floor', () => {
    assert.equal(estimateSpeechDurationMs('hi'), 500);
  });

  it('roughly matches AVERAGE_WPM for realistic copy', () => {
    const words = 33; // ~12s at 165wpm
    const text = Array(words).fill('word').join(' ');
    const ms = estimateSpeechDurationMs(text);
    const expected = (words / AVERAGE_WPM) * 60_000;
    assert.ok(Math.abs(ms - expected) < 50, `${ms} vs expected ${expected}`);
  });

  it('honors a custom wpm', () => {
    const text = 'one two three four five six seven eight nine ten';
    const ms = estimateSpeechDurationMs(text, 200);
    // 10 words at 200 wpm = 3000ms
    assert.equal(ms, 3000);
  });
});

// ── Validation ──────────────────────────────────────────────────────────────

describe('validateVoiceover', () => {
  it('accepts null / undefined', () => {
    assert.deepEqual(validateVoiceover(null), []);
    assert.deepEqual(validateVoiceover(undefined), []);
  });

  it('accepts a minimal { text } object', () => {
    assert.deepEqual(validateVoiceover({ text: 'Hello world.' }), []);
  });

  it('rejects arrays / non-objects', () => {
    assert.ok(validateVoiceover([]).length > 0);
    assert.ok(validateVoiceover('text').length > 0);
  });

  it('rejects empty / whitespace text', () => {
    assert.ok(validateVoiceover({ text: '' }).length > 0);
    assert.ok(validateVoiceover({ text: '   ' }).length > 0);
  });

  it('rejects non-string provider / voice', () => {
    assert.ok(validateVoiceover({ text: 'ok', provider: 1 }).length > 0);
    assert.ok(validateVoiceover({ text: 'ok', voice: {} }).length > 0);
  });

  it('rejects non-positive speed', () => {
    assert.ok(validateVoiceover({ text: 'ok', speed: 0 }).length > 0);
    assert.ok(validateVoiceover({ text: 'ok', speed: -1 }).length > 0);
  });
});

// ── checkVoiceoverFit ───────────────────────────────────────────────────────

describe('checkVoiceoverFit', () => {
  it('returns ok when scene has no voiceover', () => {
    const fit = checkVoiceoverFit({ duration_s: 3 });
    assert.equal(fit.severity, 'ok');
    assert.equal(fit.fits, true);
  });

  it('returns ok when voiceover fits comfortably', () => {
    const fit = checkVoiceoverFit({
      duration_s: 10,
      voiceover: { text: 'Short line.' },
    });
    assert.equal(fit.severity, 'ok');
    assert.ok(fit.fits);
  });

  it('warns when overrun is within 10%', () => {
    // 500 words @ 165 wpm ≈ 182s. Scene duration just barely shorter.
    const words = 10;
    const text = Array(words).fill('word').join(' ');
    // 10 words ≈ 3636ms. Scene = 3500ms → ~136ms over → ~4% over → warn.
    const fit = checkVoiceoverFit({ duration_s: 3.5, voiceover: { text } });
    assert.equal(fit.severity, 'warn');
    assert.ok(fit.overrun_ms > 0);
  });

  it('fails when overrun exceeds 10%', () => {
    const words = 30;
    const text = Array(words).fill('word').join(' ');
    // 30 words ≈ 10909ms. Scene = 3s → ~7.9s over → ~264% — fail.
    const fit = checkVoiceoverFit({ duration_s: 3, voiceover: { text } });
    assert.equal(fit.severity, 'fail');
  });

  it('honors the speed multiplier', () => {
    const text = Array(10).fill('word').join(' ');
    const slow = checkVoiceoverFit({ duration_s: 3, voiceover: { text, speed: 0.8 } });
    const fast = checkVoiceoverFit({ duration_s: 3, voiceover: { text, speed: 1.5 } });
    assert.ok(slow.estimated_ms > fast.estimated_ms);
  });
});

// ── Mock provider ──────────────────────────────────────────────────────────

describe('generateSpeech — mock provider', () => {
  it('writes a playable WAV file + reports an estimated duration', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-'));
    try {
      const outputPath = path.join(tmp, 'narration.wav');
      const result = await generateSpeech({
        text: 'This is narration for a product demo.',
        outputPath,
      });
      assert.equal(result.provider, 'mock');
      assert.equal(result.audio_path, outputPath);
      assert.ok(result.duration_ms > 0);
      assert.ok(fs.existsSync(outputPath));
      // RIFF/WAVE header sanity
      const header = fs.readFileSync(outputPath, { encoding: null }).slice(0, 12);
      assert.equal(header.toString('ascii', 0, 4), 'RIFF');
      assert.equal(header.toString('ascii', 8, 12), 'WAVE');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects unknown providers', async () => {
    await assert.rejects(
      () => generateSpeech({ text: 'x', outputPath: '/tmp/x.wav', provider: 'nonexistent' }),
      /Unknown TTS provider/,
    );
  });

  it('rejects missing text / outputPath', async () => {
    await assert.rejects(() => generateSpeech({ outputPath: '/tmp/x.wav' }));
    await assert.rejects(() => generateSpeech({ text: 'x' }));
  });
});

// ── synthesizeVoiceovers ────────────────────────────────────────────────────

describe('synthesizeVoiceovers', () => {
  it('skips scenes without voiceover', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-batch-'));
    try {
      const scenes = [
        { scene_id: 'sc_01', voiceover: { text: 'Hello.' } },
        { scene_id: 'sc_02' },
        { scene_id: 'sc_03', voiceover: { text: 'World.' } },
      ];
      const results = await synthesizeVoiceovers(scenes, { outputDir: tmp, provider: 'mock' });
      assert.equal(results.length, 3);
      assert.equal(results[0].status, 'generated');
      assert.equal(results[1].status, 'skipped');
      assert.equal(results[2].status, 'generated');
      assert.ok(fs.existsSync(results[0].audio_path));
      assert.ok(fs.existsSync(results[2].audio_path));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── Provider catalog ────────────────────────────────────────────────────────

describe('AVAILABLE_PROVIDERS', () => {
  it('lists at least mock and macos_say', () => {
    assert.ok(AVAILABLE_PROVIDERS.includes('mock'));
    assert.ok(AVAILABLE_PROVIDERS.includes('macos_say'));
  });
});
