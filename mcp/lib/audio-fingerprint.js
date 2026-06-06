/**
 * Audio waveform fingerprinting (ANI-127)
 *
 * Compact, comparison-friendly fingerprints for rendered/mixed audio so the
 * golden harness can catch codec, container, and muxing regressions without
 * storing audio binaries in the repo.
 *
 * Scheme (per the ANI-127 design pass): decode to a canonical PCM form
 * (mono, 8 kHz, s16le), then per one-second window compute
 *
 *   - RMS level in dBFS            (catches gain / ducking / silence drift)
 *   - energy split across 4 bands  (catches filter-graph and codec changes)
 *   - spectral centroid in Hz      (cheap timbre summary)
 *
 * Full-resolution FFT comparison is deliberately avoided — lossy codecs
 * (AAC) are not bit-stable across encoder versions. These aggregates are,
 * within the tolerances used by `assertMatchesGoldenApprox`.
 *
 * The decode step shells out to ffmpeg (injectable for tests); the math is
 * pure JS so it can be unit-tested on synthesized PCM without ffmpeg.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Canonical decode rate. 8 kHz keeps windows small; Nyquist 4 kHz. */
export const FINGERPRINT_SAMPLE_RATE = 8000;

/** Band edges (Hz) for the energy split. Upper edge = Nyquist. */
export const FINGERPRINT_BANDS = [
  [0, 250],
  [250, 1000],
  [1000, 2500],
  [2500, 4000],
];

/** Floor for dBFS values so silence serializes as a finite number. */
const SILENCE_FLOOR_DB = -96;

/** Cap fingerprint length so goldens stay reviewable. */
const MAX_SECONDS = 60;

// ── Pure math ───────────────────────────────────────────────────────────────

/**
 * In-place iterative radix-2 FFT over interleaved re/im arrays.
 * Standard Cooley-Tukey; n must be a power of two.
 */
function fft(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** Round to a fixed number of decimals (stable JSON serialization). */
function round(value, decimals) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Fingerprint a canonical PCM buffer (s16le mono).
 *
 * @param {Buffer|Int16Array} pcm - Samples (Buffer of s16le bytes, or Int16Array)
 * @param {object} [opts]
 * @param {number} [opts.sampleRate=8000]
 * @returns {{ sample_rate, duration_s, seconds: Array<{ t, rms_db, bands, centroid_hz }> }}
 */
export function computeFingerprint(pcm, opts = {}) {
  const sampleRate = opts.sampleRate ?? FINGERPRINT_SAMPLE_RATE;
  const samples = pcm instanceof Int16Array
    ? pcm
    : new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));

  const totalSeconds = Math.min(MAX_SECONDS, Math.ceil(samples.length / sampleRate));
  // FFT window = largest power of two that fits inside one second.
  const fftSize = 2 ** Math.floor(Math.log2(sampleRate));
  const binHz = sampleRate / fftSize;

  const seconds = [];
  for (let s = 0; s < totalSeconds; s++) {
    const start = s * sampleRate;
    const end = Math.min(samples.length, start + sampleRate);
    const count = end - start;
    if (count <= 0) break;

    // RMS over the full second.
    let sumSq = 0;
    for (let i = start; i < end; i++) {
      const v = samples[i] / 32768;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / count);
    const rmsDb = rms > 0 ? Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(rms)) : SILENCE_FLOOR_DB;

    // Spectrum over the window (zero-padded when the tail second is short).
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);
    const windowLen = Math.min(count, fftSize);
    for (let i = 0; i < windowLen; i++) {
      // Hann window keeps band energy stable against phase/offset shifts.
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowLen - 1 || 1)));
      re[i] = (samples[start + i] / 32768) * w;
    }
    fft(re, im);

    const bandEnergy = FINGERPRINT_BANDS.map(() => 0);
    let totalEnergy = 0;
    let centroidNum = 0;
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = bin * binHz;
      const mag = re[bin] * re[bin] + im[bin] * im[bin];
      totalEnergy += mag;
      centroidNum += mag * freq;
      for (let b = 0; b < FINGERPRINT_BANDS.length; b++) {
        if (freq >= FINGERPRINT_BANDS[b][0] && freq < FINGERPRINT_BANDS[b][1]) {
          bandEnergy[b] += mag;
          break;
        }
      }
    }

    seconds.push({
      t: s,
      rms_db: round(rmsDb, 1),
      bands: bandEnergy.map(e => round(totalEnergy > 0 ? e / totalEnergy : 0, 2)),
      centroid_hz: totalEnergy > 0 ? Math.round(centroidNum / totalEnergy) : 0,
    });
  }

  return {
    sample_rate: sampleRate,
    duration_s: round(samples.length / sampleRate, 2),
    seconds,
  };
}

// ── ffmpeg-backed entrypoints ───────────────────────────────────────────────

/** Default decoder: any input → canonical s16le mono 8 kHz PCM on stdout. */
async function decodeWithFfmpeg(filePath, sampleRate) {
  const { stdout } = await execFileAsync(
    'ffmpeg',
    ['-v', 'error', '-i', filePath, '-ac', '1', '-ar', String(sampleRate), '-f', 's16le', '-'],
    { timeout: 120_000, encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 },
  );
  return stdout;
}

/**
 * Fingerprint any audio-bearing media file (WAV, MP4, MOV, …).
 *
 * @param {string} filePath
 * @param {object} [opts]
 * @param {number} [opts.sampleRate=8000]
 * @param {Function} [opts.decode] - Decoder override (tests): (path, rate) → Buffer
 * @returns {Promise<ReturnType<typeof computeFingerprint>>}
 */
export async function fingerprintAudioFile(filePath, opts = {}) {
  const sampleRate = opts.sampleRate ?? FINGERPRINT_SAMPLE_RATE;
  const decode = opts.decode ?? decodeWithFfmpeg;
  const pcm = await decode(filePath, sampleRate);
  return computeFingerprint(pcm, { sampleRate });
}

/**
 * Count audio streams in a media file via ffprobe. Lets tests assert the
 * `-an` path (email-gif and friends) actually produced a silent container.
 *
 * @param {string} filePath
 * @returns {Promise<number>}
 */
export async function countAudioStreams(filePath) {
  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', filePath],
    { timeout: 30_000 },
  );
  return stdout.trim() === '' ? 0 : stdout.trim().split('\n').length;
}
