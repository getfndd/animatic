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
  effectiveSpeed,
  estimateSpeechDurationMs,
  estimateSynthesisCost,
  validateVoiceover,
  voiceoverCacheKey,
  checkVoiceoverFit,
  AVAILABLE_PROVIDERS,
  AVERAGE_WPM,
  PROVIDER_USD_PER_MILLION_CHARS,
} from '../lib/tts.js';

/** Valid ~0.5s silent WAV for fake fetch responses (ffprobe-readable). */
function tinyWav() {
  const dataSize = 22050; // 0.5s mono 16-bit @ 22050Hz
  const b = Buffer.alloc(44 + dataSize);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataSize, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(22050, 24); b.writeUInt32LE(44100, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(dataSize, 40);
  return b;
}

/** Build a fake fetch returning a scripted sequence of responses. */
function fakeFetch(script) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    if (step.throw) throw step.throw;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      arrayBuffer: async () => Uint8Array.from(tinyWav()).buffer,
      text: async () => step.text ?? '',
    };
  };
  return { impl, calls };
}

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
      const header = fs.readFileSync(outputPath, { encoding: null }).subarray(0, 12);
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

// ── Provider speed caps in fit checks (ANI-128 review finding) ─────────────

describe('effectiveSpeed', () => {
  it('clamps openai to its 0.25-4.0 range and normalizes invalid values', () => {
    assert.equal(effectiveSpeed('openai', 9), 4);
    assert.equal(effectiveSpeed('openai', 0.1), 0.25);
    assert.equal(effectiveSpeed('openai', 1.5), 1.5);
    assert.equal(effectiveSpeed('openai', 0), 1);
    assert.equal(effectiveSpeed('openai', undefined), 1);
  });

  it('leaves uncapped providers alone', () => {
    assert.equal(effectiveSpeed('mock', 9), 9);
    assert.equal(effectiveSpeed('macos_say', 0.1), 0.1);
    assert.equal(effectiveSpeed(undefined, 2), 2);
  });
});

describe('checkVoiceoverFit — provider speed caps', () => {
  // ~40 words ≈ 14.5s at baseline; a 3s scene "fits" at 9x (1.6s) but
  // openai caps at 4x (3.6s) → real audio overruns the scene.
  const longLine = Array(40).fill('word').join(' ');

  it('estimates at the clamped speed for openai scenes', () => {
    const scene = {
      duration_s: 3,
      voiceover: { text: longLine, provider: 'openai', speed: 9 },
    };
    const fit = checkVoiceoverFit(scene);
    assert.equal(fit.fits, false, 'speed 9 must not pass a check the provider caps at 4');
    const expectedMs = Math.round(estimateSpeechDurationMs(longLine) / 4);
    assert.equal(fit.estimated_ms, expectedMs);
  });

  it('applies the render default provider when the scene does not pin one', () => {
    const scene = { duration_s: 3, voiceover: { text: longLine, speed: 9 } };
    const capped = checkVoiceoverFit(scene, { defaultProvider: 'openai' });
    assert.equal(capped.fits, false);
    // Uncapped providers keep the raw-speed behavior.
    const uncapped = checkVoiceoverFit(scene, { defaultProvider: 'mock' });
    assert.equal(uncapped.fits, true);
  });
});

// ── OpenAI provider (ANI-128) ───────────────────────────────────────────────

describe('generateSpeech — openai provider', () => {
  const withKey = async (fn) => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-not-real';
    try { return await fn(); }
    finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  };

  it('fails with a clear message when OPENAI_API_KEY is unset', async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await assert.rejects(
        () => generateSpeech({ text: 'x', outputPath: '/tmp/x.wav', provider: 'openai' }),
        /OPENAI_API_KEY is not set/,
      );
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  it('POSTs tts-1 with wav output and clamped speed, writes the audio', async () => {
    await withKey(async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-openai-'));
      try {
        const { impl, calls } = fakeFetch([{ status: 200 }]);
        const outputPath = path.join(tmp, 'line.wav');
        const result = await generateSpeech({
          text: 'Confident product narration.',
          outputPath,
          provider: 'openai',
          voice: 'nova',
          speed: 9, // out of range → clamps to 4
          fetchImpl: impl,
        });
        assert.equal(calls.length, 1);
        assert.match(calls[0].url, /api\.openai\.com\/v1\/audio\/speech/);
        assert.equal(calls[0].body.model, 'tts-1');
        assert.equal(calls[0].body.voice, 'nova');
        assert.equal(calls[0].body.response_format, 'wav');
        assert.equal(calls[0].body.speed, 4);
        assert.ok(fs.existsSync(outputPath));
        assert.equal(result.provider, 'openai');
        assert.ok(result.duration_ms > 0); // ffprobe or estimate fallback
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  it('retries 429/5xx and succeeds', async () => {
    await withKey(async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-openai-'));
      try {
        const { impl, calls } = fakeFetch([
          { status: 429, text: 'rate limited' },
          { status: 500, text: 'oops' },
          { status: 200 },
        ]);
        const result = await generateSpeech({
          text: 'Retry me.', outputPath: path.join(tmp, 'r.wav'),
          provider: 'openai', fetchImpl: impl,
        });
        assert.equal(calls.length, 3);
        assert.equal(result.provider, 'openai');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  it('gives up after exhausting retries on persistent 5xx', async () => {
    await withKey(async () => {
      const { impl, calls } = fakeFetch([{ status: 503, text: 'down' }]);
      await assert.rejects(
        () => generateSpeech({ text: 'x', outputPath: '/tmp/x.wav', provider: 'openai', fetchImpl: impl }),
        /OpenAI TTS HTTP 503/,
      );
      assert.equal(calls.length, 3);
    });
  });

  it('does not retry non-transient 4xx errors', async () => {
    await withKey(async () => {
      const { impl, calls } = fakeFetch([{ status: 401, text: 'bad key' }]);
      await assert.rejects(
        () => generateSpeech({ text: 'x', outputPath: '/tmp/x.wav', provider: 'openai', fetchImpl: impl }),
        /OpenAI TTS HTTP 401/,
      );
      assert.equal(calls.length, 1);
    });
  });

  it('retries network failures', async () => {
    await withKey(async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-openai-'));
      try {
        const { impl, calls } = fakeFetch([
          { throw: new TypeError('fetch failed') },
          { status: 200 },
        ]);
        await generateSpeech({
          text: 'Flaky network.', outputPath: path.join(tmp, 'n.wav'),
          provider: 'openai', fetchImpl: impl,
        });
        assert.equal(calls.length, 2);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  // Live test — skipped unless a real key is present AND opted in. The full
  // unit surface above runs offline; this is a connectivity smoke check.
  it('live: synthesizes real speech', { skip: !process.env.ANIMATIC_TTS_LIVE_TEST || !process.env.OPENAI_API_KEY }, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-live-'));
    try {
      const result = await generateSpeech({
        text: 'Animatic live synthesis check.',
        outputPath: path.join(tmp, 'live.wav'),
        provider: 'openai',
      });
      assert.ok(fs.statSync(result.audio_path).size > 1000);
      assert.ok(result.duration_ms > 500);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── Synthesis cache (ANI-128) ───────────────────────────────────────────────

describe('voiceoverCacheKey', () => {
  it('is stable for identical cues and distinct for any changed input', () => {
    const base = { text: 'Hello.', provider: 'openai', voice: 'nova', speed: 1 };
    assert.equal(voiceoverCacheKey(base), voiceoverCacheKey({ ...base }));
    const variants = [
      { ...base, text: 'Hello!' },
      { ...base, provider: 'mock' },
      { ...base, voice: 'alloy' },
      { ...base, speed: 1.2 },
    ];
    const keys = new Set([voiceoverCacheKey(base), ...variants.map(voiceoverCacheKey)]);
    assert.equal(keys.size, 5);
  });

  it('normalizes default speed and missing voice', () => {
    assert.equal(
      voiceoverCacheKey({ text: 'x', provider: 'mock' }),
      voiceoverCacheKey({ text: 'x', provider: 'mock', voice: null, speed: 1 }),
    );
  });
});

describe('synthesizeVoiceovers — cache', () => {
  it('second run with unchanged cues makes zero provider calls', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-cache-'));
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-not-real';
    try {
      const cacheDir = path.join(tmp, 'cache');
      const scenes = [
        { scene_id: 'sc_01', voiceover: { text: 'Line one.', provider: 'openai' } },
        { scene_id: 'sc_02', voiceover: { text: 'Line two.', provider: 'openai' } },
      ];
      const { impl: fetch1, calls: calls1 } = fakeFetch([{ status: 200 }]);
      const first = await synthesizeVoiceovers(scenes, {
        outputDir: path.join(tmp, 'out1'), cacheDir, fetchImpl: fetch1,
      });
      assert.equal(calls1.length, 2);
      assert.deepEqual(first.map(r => r.cached), [false, false]);

      const { impl: fetch2, calls: calls2 } = fakeFetch([{ status: 500 }]); // would fail if called
      const second = await synthesizeVoiceovers(scenes, {
        outputDir: path.join(tmp, 'out2'), cacheDir, fetchImpl: fetch2,
      });
      assert.equal(calls2.length, 0, 'cache hits must make zero provider calls');
      assert.deepEqual(second.map(r => r.cached), [true, true]);
      assert.equal(second[0].duration_ms, first[0].duration_ms);
      assert.ok(fs.existsSync(second[0].audio_path));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('editing one line re-synthesizes only that line', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-cache-'));
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-not-real';
    try {
      const cacheDir = path.join(tmp, 'cache');
      const scenes = [
        { scene_id: 'sc_01', voiceover: { text: 'Stable line.', provider: 'openai' } },
        { scene_id: 'sc_02', voiceover: { text: 'Original line.', provider: 'openai' } },
      ];
      const { impl: f1 } = fakeFetch([{ status: 200 }]);
      await synthesizeVoiceovers(scenes, { outputDir: path.join(tmp, 'o1'), cacheDir, fetchImpl: f1 });

      scenes[1].voiceover.text = 'Edited line.';
      const { impl: f2, calls: c2 } = fakeFetch([{ status: 200 }]);
      const results = await synthesizeVoiceovers(scenes, { outputDir: path.join(tmp, 'o2'), cacheDir, fetchImpl: f2 });
      assert.equal(c2.length, 1, 'only the edited cue should hit the provider');
      assert.equal(results[0].cached, true);
      assert.equal(results[1].cached, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('works without cacheDir (no cache flags forced on)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ani-tts-cache-'));
    try {
      const results = await synthesizeVoiceovers(
        [{ scene_id: 'sc_01', voiceover: { text: 'No cache.' } }],
        { outputDir: tmp, provider: 'mock' },
      );
      assert.equal(results[0].status, 'generated');
      assert.equal(results[0].cached, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── Cost estimation (ANI-128) ───────────────────────────────────────────────

describe('estimateSynthesisCost', () => {
  it('prices metered providers and zeroes local ones', () => {
    const cues = [
      { text: 'a'.repeat(1000), provider: 'openai' },
      { text: 'b'.repeat(1000), provider: 'macos_say' },
      { text: 'c'.repeat(500) }, // falls back to defaultProvider
    ];
    const est = estimateSynthesisCost(cues, 'openai');
    assert.equal(est.characters, 2500);
    assert.equal(est.billable_characters, 1500);
    assert.equal(est.estimated_usd, Math.round((1500 / 1_000_000) * 15 * 10_000) / 10_000);
  });

  it('returns zeros for empty input and local default', () => {
    assert.deepEqual(estimateSynthesisCost([], 'mock'),
      { characters: 0, billable_characters: 0, estimated_usd: 0 });
    const est = estimateSynthesisCost([{ text: 'hello' }], 'mock');
    assert.equal(est.estimated_usd, 0);
  });

  it('locks the rate table shape', () => {
    assert.equal(PROVIDER_USD_PER_MILLION_CHARS.mock, 0);
    assert.equal(PROVIDER_USD_PER_MILLION_CHARS.macos_say, 0);
    assert.ok(PROVIDER_USD_PER_MILLION_CHARS.openai > 0);
  });
});

// ── Provider catalog ────────────────────────────────────────────────────────

describe('AVAILABLE_PROVIDERS', () => {
  it('lists mock, macos_say, and openai', () => {
    assert.ok(AVAILABLE_PROVIDERS.includes('mock'));
    assert.ok(AVAILABLE_PROVIDERS.includes('macos_say'));
    assert.ok(AVAILABLE_PROVIDERS.includes('openai'));
  });
});
