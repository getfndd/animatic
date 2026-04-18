/**
 * TTS — text-to-speech provider interface (ANI-111)
 *
 * `generateSpeech` is the single entrypoint. Providers:
 *
 *   - `mock`       — writes a tiny silent WAV, reports a word-count-based
 *                    duration estimate. Used by tests and as a deterministic
 *                    stand-in when no real TTS is available.
 *   - `macos_say`  — uses the built-in macOS `say` command to render real
 *                    speech to a WAV file. No API key, no network.
 *
 * The interface is deliberately shaped so cloud providers (ElevenLabs,
 * Cartesia, OpenAI TTS) can be added later without changing callers. Those
 * integrations need API-key handling + CI gating and are tracked as
 * follow-up work.
 */

import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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

  // Probe actual duration via ffprobe so downstream sync logic gets real numbers.
  let durationMs = estimateSpeechDurationMs(text) / (speed || 1);
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', outputPath],
      { timeout: 10_000 },
    );
    const secs = parseFloat(stdout.trim());
    if (Number.isFinite(secs) && secs > 0) durationMs = Math.round(secs * 1000);
  } catch {
    // ffprobe missing → fall back to the text-based estimate above.
  }

  return { audio_path: outputPath, duration_ms: Math.round(durationMs) };
}

const PROVIDERS = {
  mock: mockProvider,
  macos_say: macosSayProvider,
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
 * @returns {Promise<{ audio_path, duration_ms, provider, voice, text }>}
 */
export async function generateSpeech(input) {
  const { text, outputPath, provider = 'mock', voice, speed = 1 } = input || {};
  if (!text || !outputPath) {
    throw new Error('generateSpeech requires { text, outputPath }');
  }
  const impl = PROVIDERS[provider];
  if (!impl) {
    throw new Error(`Unknown TTS provider "${provider}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  const result = await impl({ text, outputPath, voice, speed });
  return { ...result, provider, voice: voice || null, text };
}

/**
 * Batch-synthesize voiceovers for a scene array, writing one audio file per
 * scene that carries a `voiceover` field. Scenes without voiceover are
 * skipped. Returns an array of generation results (or skip markers) in the
 * same order as the input scenes.
 *
 * @param {object[]} scenes - Scene defs with optional `voiceover` blocks
 * @param {object} opts
 * @param {string} opts.outputDir - Directory to write audio files into
 * @param {string} [opts.provider='mock']
 * @returns {Promise<Array<{ scene_id, status, audio_path?, duration_ms?, error? }>>}
 */
export async function synthesizeVoiceovers(scenes, opts) {
  const { outputDir, provider = 'mock' } = opts || {};
  if (!outputDir) throw new Error('synthesizeVoiceovers requires opts.outputDir');
  mkdirSync(outputDir, { recursive: true });

  const results = [];
  for (const scene of scenes) {
    const id = scene.scene_id || scene.id;
    if (!scene.voiceover?.text) {
      results.push({ scene_id: id, status: 'skipped' });
      continue;
    }
    const outputPath = `${outputDir}/${id}.wav`;
    try {
      const result = await generateSpeech({
        text: scene.voiceover.text,
        outputPath,
        provider: scene.voiceover.provider || provider,
        voice: scene.voiceover.voice,
        speed: scene.voiceover.speed,
      });
      results.push({
        scene_id: id,
        status: 'generated',
        audio_path: result.audio_path,
        duration_ms: result.duration_ms,
        provider: result.provider,
      });
    } catch (err) {
      results.push({ scene_id: id, status: 'failed', error: err.message });
    }
  }
  return results;
}

export const AVAILABLE_PROVIDERS = Object.keys(PROVIDERS);
