/**
 * TTS — text-to-speech provider interface (ANI-111, ANI-128)
 *
 * `generateSpeech` is the single entrypoint. Providers:
 *
 *   - `mock`       — writes a tiny silent WAV, reports a word-count-based
 *                    duration estimate. Used by tests and as a deterministic
 *                    stand-in when no real TTS is available.
 *   - `macos_say`  — uses the built-in macOS `say` command to render real
 *                    speech to a WAV file. No API key, no network.
 *   - `openai`     — OpenAI's speech endpoint (ANI-128). Production-quality
 *                    narration, bring-your-own `OPENAI_API_KEY`. Chosen as
 *                    the first cloud adapter for lowest BYOK friction +
 *                    pay-as-you-go pricing with no commercial-use gate;
 *                    ElevenLabs is the planned premium follow-up.
 *
 * Cloud synthesis is metered — callers that re-render should go through
 * the content-addressed cache in `synthesizeVoiceovers` (opts.cacheDir)
 * so unchanged narration never re-bills.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ── Duration estimation ─────────────────────────────────────────────────────

// Spoken English averages ~165 words per minute for confident narration.
// We use this for the mock provider and for the `checkVoiceoverFit`
// preflight when no real audio exists yet.
export const AVERAGE_WPM = 165;
const MIN_DURATION_MS = 500;

/**
 * Estimate the spoken duration of text, in milliseconds.
 *
 * @param {string} text
 * @param {number} [wpm=165]
 */
export function estimateSpeechDurationMs(text, wpm = AVERAGE_WPM) {
  if (typeof text !== 'string' || text.trim().length === 0) return 0;
  const words = text.trim().split(/\s+/).length;
  const ms = Math.round((words / wpm) * 60_000);
  return Math.max(MIN_DURATION_MS, ms);
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a voiceover field. Returns array of error strings; empty means OK.
 */
export function validateVoiceover(voiceover) {
  const errors = [];
  if (voiceover == null) return errors;
  if (typeof voiceover !== 'object' || Array.isArray(voiceover)) {
    errors.push('voiceover must be an object with at least { text }');
    return errors;
  }
  if (typeof voiceover.text !== 'string' || voiceover.text.trim().length === 0) {
    errors.push('voiceover.text must be a non-empty string');
  }
  if (voiceover.provider != null && typeof voiceover.provider !== 'string') {
    errors.push('voiceover.provider must be a string when provided');
  }
  if (voiceover.voice != null && typeof voiceover.voice !== 'string') {
    errors.push('voiceover.voice must be a string when provided');
  }
  if (voiceover.speed != null && (typeof voiceover.speed !== 'number' || voiceover.speed <= 0)) {
    errors.push('voiceover.speed must be a positive number when provided');
  }
  return errors;
}

/**
 * Compare expected narration duration to scene hold time. Returns a
 * structured advisory so the preflight doctor / analyzer can surface it.
 *
 * @param {{ duration_s?: number, voiceover?: { text?: string, speed?: number } }} scene
 * @returns {{ fits: boolean, severity: 'ok' | 'warn' | 'fail',
 *             estimated_ms: number, scene_duration_ms: number,
 *             overrun_ms: number, message: string }}
 */
export function checkVoiceoverFit(scene) {
  const voiceover = scene?.voiceover;
  const sceneDurationMs = Math.round((scene?.duration_s || 0) * 1000);
  if (!voiceover?.text) {
    return {
      fits: true, severity: 'ok',
      estimated_ms: 0, scene_duration_ms: sceneDurationMs, overrun_ms: 0,
      message: 'no voiceover',
    };
  }
  const baseMs = estimateSpeechDurationMs(voiceover.text);
  // A `speed` of 1 is baseline; 1.2 = 20% faster = shorter duration.
  const speed = voiceover.speed && voiceover.speed > 0 ? voiceover.speed : 1;
  const estimatedMs = Math.round(baseMs / speed);
  const overrunMs = estimatedMs - sceneDurationMs;
  if (overrunMs <= 0) {
    return {
      fits: true, severity: 'ok',
      estimated_ms: estimatedMs, scene_duration_ms: sceneDurationMs, overrun_ms: 0,
      message: 'voiceover fits comfortably',
    };
  }
  // 10% overrun tolerated as a warning; beyond that the scene won't hold the line.
  const severity = overrunMs / sceneDurationMs > 0.1 ? 'fail' : 'warn';
  return {
    fits: false, severity,
    estimated_ms: estimatedMs, scene_duration_ms: sceneDurationMs, overrun_ms: overrunMs,
    message: `voiceover estimate ${estimatedMs}ms exceeds scene hold ${sceneDurationMs}ms by ${overrunMs}ms`,
  };
}

// ── Providers ───────────────────────────────────────────────────────────────

/**
 * Minimal 16-bit PCM WAV header + silent samples for a given duration.
 * Used by the mock provider so downstream code sees a real, playable file
 * even when no TTS is wired up.
 */
function buildSilentWav(durationMs, sampleRate = 22050) {
  const numSamples = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const byteRate = sampleRate * 2; // 16-bit mono
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk size
  buffer.writeUInt16LE(1, 20);  // PCM
  buffer.writeUInt16LE(1, 22);  // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32);  // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // samples are already zero-initialized by Buffer.alloc
  return buffer;
}

async function mockProvider({ text, outputPath, speed = 1 }) {
  const estimated = estimateSpeechDurationMs(text) / (speed > 0 ? speed : 1);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buildSilentWav(Math.round(estimated)));
  return { audio_path: outputPath, duration_ms: Math.round(estimated) };
}

/**
 * Probe a written audio file's real duration via ffprobe, falling back to
 * the text-based estimate when ffprobe is unavailable.
 */
async function probeDurationMs(outputPath, text, speed = 1) {
  let durationMs = estimateSpeechDurationMs(text) / (speed > 0 ? speed : 1);
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', outputPath],
      { timeout: 10_000 },
    );
    const secs = parseFloat(stdout.trim());
    if (Number.isFinite(secs) && secs > 0) durationMs = Math.round(secs * 1000);
  } catch {
    // ffprobe missing → fall back to the text-based estimate.
  }
  return Math.round(durationMs);
}

async function macosSayProvider({ text, voice, outputPath, speed = 1 }) {
  // `say --rate` is words-per-minute. We scale around the default of ~175 so
  // a relative `speed` multiplier maps consistently with `estimateSpeechDurationMs`.
  const rateWpm = Math.round(175 * (speed > 0 ? speed : 1));
  mkdirSync(dirname(outputPath), { recursive: true });

  const args = ['--file-format=WAVE', '--data-format=LEI16@22050', '-o', outputPath];
  if (voice) args.push('-v', voice);
  args.push('-r', String(rateWpm));
  args.push(text);

  await execFileAsync('say', args, { timeout: 60_000 });

  return {
    audio_path: outputPath,
    duration_ms: await probeDurationMs(outputPath, text, speed),
  };
}

// ── OpenAI provider (ANI-128) ───────────────────────────────────────────────

/** Model is pinned: gpt-4o-mini-tts has reports of ignoring `speed`. */
const OPENAI_TTS_MODEL = 'tts-1';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_DEFAULT_VOICE = 'alloy';
const OPENAI_ATTEMPT_TIMEOUT_MS = 60_000;
const OPENAI_MAX_ATTEMPTS = 3;
const OPENAI_BACKOFF_BASE_MS = 500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function openaiProvider({ text, voice, outputPath, speed = 1, fetchImpl }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. The "openai" TTS provider needs it — export it in your shell, ' +
      'or add it to the `env` block of the animatic server entry in your MCP config.',
    );
  }
  const doFetch = fetchImpl ?? fetch;

  // OpenAI accepts 0.25-4.0; clamp rather than erroring on out-of-range
  // scene values. The clamped value also drives the duration-estimate
  // fallback so it matches what was actually requested.
  const clampedSpeed = Math.min(4, Math.max(0.25, speed > 0 ? speed : 1));

  const body = JSON.stringify({
    model: OPENAI_TTS_MODEL,
    input: text,
    voice: voice || OPENAI_DEFAULT_VOICE,
    response_format: 'wav', // 24kHz WAV — the mix pipeline resamples via ffmpeg
    speed: clampedSpeed,
  });

  let lastError = null;
  for (let attempt = 1; attempt <= OPENAI_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await doFetch(OPENAI_TTS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(OPENAI_ATTEMPT_TIMEOUT_MS),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        const err = new Error(`OpenAI TTS HTTP ${res.status}: ${detail.slice(0, 300)}`);
        // 429 + 5xx are transient — retry. 4xx (bad key, bad voice) is not.
        if (res.status === 429 || res.status >= 500) {
          lastError = err;
          if (attempt < OPENAI_MAX_ATTEMPTS) {
            await sleep(OPENAI_BACKOFF_BASE_MS * 2 ** (attempt - 1));
            continue;
          }
        }
        throw err;
      }

      const audio = Buffer.from(await res.arrayBuffer());
      if (audio.length === 0) throw new Error('OpenAI TTS returned an empty audio body');
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, audio);

      return {
        audio_path: outputPath,
        duration_ms: await probeDurationMs(outputPath, text, clampedSpeed),
      };
    } catch (err) {
      // Network failures + timeouts are transient; HTTP errors that reach
      // here have already exhausted their retry policy above.
      if (err.message?.startsWith('OpenAI TTS')) throw err;
      lastError = err;
      if (attempt < OPENAI_MAX_ATTEMPTS) {
        await sleep(OPENAI_BACKOFF_BASE_MS * 2 ** (attempt - 1));
        continue;
      }
    }
  }
  throw new Error(
    `OpenAI TTS failed after ${OPENAI_MAX_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}`,
  );
}

const PROVIDERS = {
  mock: mockProvider,
  macos_say: macosSayProvider,
  openai: openaiProvider,
};

/**
 * Generate speech audio for a single voiceover cue.
 *
 * @param {object} input
 * @param {string} input.text - The text to speak
 * @param {string} input.outputPath - Absolute path where the WAV should be written
 * @param {string} [input.provider='mock'] - Provider key (see PROVIDERS above)
 * @param {string} [input.voice] - Provider-specific voice identifier
 * @param {number} [input.speed=1] - Speed multiplier (1 = baseline, 1.2 = 20% faster)
 * @param {Function} [input.fetchImpl] - fetch override for network providers (tests)
 * @returns {Promise<{ audio_path, duration_ms, provider, voice, text }>}
 */
export async function generateSpeech(input) {
  const { text, outputPath, provider = 'mock', voice, speed = 1, fetchImpl } = input || {};
  if (!text || !outputPath) {
    throw new Error('generateSpeech requires { text, outputPath }');
  }
  const impl = PROVIDERS[provider];
  if (!impl) {
    throw new Error(`Unknown TTS provider "${provider}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  const result = await impl({ text, outputPath, voice, speed, fetchImpl });
  return { ...result, provider, voice: voice || null, text };
}

// ── Synthesis cache (ANI-128) ───────────────────────────────────────────────

/**
 * Content-addressed cache key for one voiceover cue. Everything that
 * changes the rendered audio participates; scene ids and offsets don't.
 *
 * @param {{ text: string, provider: string, voice?: string, speed?: number }} cue
 * @returns {string} sha256 hex digest
 */
export function voiceoverCacheKey({ text, provider, voice, speed }) {
  return createHash('sha256')
    .update(JSON.stringify({
      text,
      provider,
      voice: voice || null,
      speed: speed && speed > 0 ? speed : 1,
      model: provider === 'openai' ? OPENAI_TTS_MODEL : null,
    }))
    .digest('hex');
}

/**
 * Batch-synthesize voiceovers for a scene array, writing one audio file per
 * scene that carries a `voiceover` field. Scenes without voiceover are
 * skipped. Returns an array of generation results (or skip markers) in the
 * same order as the input scenes.
 *
 * With `opts.cacheDir`, synthesis is content-addressed (ANI-128): a cue
 * whose (text, provider, voice, speed) already has a cached WAV is copied
 * from the cache with ZERO provider calls — re-renders with unchanged
 * narration never re-bill a metered provider. Duration lives in a JSON
 * sidecar next to the cached WAV.
 *
 * @param {object[]} scenes - Scene defs with optional `voiceover` blocks
 * @param {object} opts
 * @param {string} opts.outputDir - Directory to write audio files into
 * @param {string} [opts.provider='mock']
 * @param {string} [opts.cacheDir] - Content-addressed synthesis cache directory
 * @param {Function} [opts.fetchImpl] - fetch override for network providers (tests)
 * @returns {Promise<Array<{ scene_id, status, audio_path?, duration_ms?, provider?, cached?, error? }>>}
 */
export async function synthesizeVoiceovers(scenes, opts) {
  const { outputDir, provider = 'mock', cacheDir, fetchImpl } = opts || {};
  if (!outputDir) throw new Error('synthesizeVoiceovers requires opts.outputDir');
  mkdirSync(outputDir, { recursive: true });
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });

  const results = [];
  for (const scene of scenes) {
    const id = scene.scene_id || scene.id;
    if (!scene.voiceover?.text) {
      results.push({ scene_id: id, status: 'skipped' });
      continue;
    }
    const outputPath = `${outputDir}/${id}.wav`;
    const cue = {
      text: scene.voiceover.text,
      provider: scene.voiceover.provider || provider,
      voice: scene.voiceover.voice,
      speed: scene.voiceover.speed,
    };

    // Cache hit → copy, no provider call.
    const cachedWav = cacheDir ? `${cacheDir}/${voiceoverCacheKey(cue)}.wav` : null;
    const cachedMeta = cachedWav ? cachedWav.replace(/\.wav$/, '.json') : null;
    if (cachedWav && existsSync(cachedWav) && existsSync(cachedMeta)) {
      try {
        const meta = JSON.parse(readFileSync(cachedMeta, 'utf-8'));
        copyFileSync(cachedWav, outputPath);
        results.push({
          scene_id: id,
          status: 'generated',
          audio_path: outputPath,
          duration_ms: meta.duration_ms,
          provider: cue.provider,
          cached: true,
        });
        continue;
      } catch {
        // Corrupt cache entry → fall through and re-synthesize over it.
      }
    }

    try {
      const result = await generateSpeech({ ...cue, outputPath, fetchImpl });
      if (cachedWav) {
        copyFileSync(outputPath, cachedWav);
        writeFileSync(cachedMeta, JSON.stringify({
          duration_ms: result.duration_ms,
          provider: result.provider,
          voice: result.voice,
          text: cue.text,
        }, null, 2) + '\n');
      }
      results.push({
        scene_id: id,
        status: 'generated',
        audio_path: result.audio_path,
        duration_ms: result.duration_ms,
        provider: result.provider,
        cached: false,
      });
    } catch (err) {
      results.push({ scene_id: id, status: 'failed', error: err.message });
    }
  }
  return results;
}

// ── Cost estimation (ANI-128) ───────────────────────────────────────────────

/**
 * Rough USD per 1M characters by provider. Local providers are free; rates
 * for metered providers are intentionally coarse — this powers an advisory
 * preflight warning, not billing.
 */
export const PROVIDER_USD_PER_MILLION_CHARS = Object.freeze({
  mock: 0,
  macos_say: 0,
  openai: 15, // tts-1 pay-as-you-go (2026-06 pricing)
});

/**
 * Estimate synthesis cost for a set of voiceover cues.
 *
 * @param {Array<{ text: string, provider?: string }>} cues
 * @param {string} [defaultProvider='mock'] - Provider for cues without their own
 * @returns {{ characters: number, billable_characters: number, estimated_usd: number }}
 */
export function estimateSynthesisCost(cues, defaultProvider = 'mock') {
  let characters = 0;
  let billable = 0;
  let usd = 0;
  for (const cue of cues || []) {
    const len = typeof cue?.text === 'string' ? cue.text.length : 0;
    characters += len;
    const rate = PROVIDER_USD_PER_MILLION_CHARS[cue?.provider || defaultProvider] ?? 0;
    if (rate > 0) {
      billable += len;
      usd += (len / 1_000_000) * rate;
    }
  }
  return {
    characters,
    billable_characters: billable,
    estimated_usd: Math.round(usd * 10_000) / 10_000,
  };
}

export const AVAILABLE_PROVIDERS = Object.keys(PROVIDERS);
