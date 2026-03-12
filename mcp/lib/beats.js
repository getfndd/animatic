/**
 * Beat Analysis & Sync — ANI-37
 *
 * Audio analysis for beat-synced editing. Detects beats, tempo, and
 * energy curves from audio samples. Provides sync functions that
 * adjust scene durations to align transitions with beat boundaries.
 *
 * Pure functions, no I/O. Audio decoding is handled upstream.
 */

// ── Beat Detection ───────────────────────────────────────────────────────────

/**
 * Detect beats in audio samples using energy-based onset detection.
 *
 * Algorithm:
 * 1. Divide samples into short windows
 * 2. Calculate RMS energy per window
 * 3. Compare each window to a local average (adaptive threshold)
 * 4. Peaks above threshold = onsets (beats)
 * 5. Derive BPM from median inter-beat interval
 *
 * @param {Float32Array|number[]} samples — mono PCM audio samples
 * @param {number} sampleRate — sample rate (e.g. 44100)
 * @param {object} [options]
 * @param {number} [options.windowSize=1024] — samples per analysis window
 * @param {number} [options.hopSize=512] — overlap between windows
 * @param {number} [options.localWindowSize=15] — windows for local average
 * @param {number} [options.threshold=1.3] — peak-to-average ratio for onset
 * @param {number} [options.minBeatInterval=0.2] — min seconds between beats
 * @returns {{ bpm: number, beats: number[], energy: number[] }}
 */
export function detectBeats(samples, sampleRate, options = {}) {
  const {
    windowSize = 1024,
    hopSize = 512,
    localWindowSize = 15,
    threshold = 1.3,
    minBeatInterval = 0.2,
  } = options;

  if (!samples || samples.length === 0) {
    return { bpm: 0, beats: [], energy: [] };
  }

  // Step 1: Calculate RMS energy per window
  const energy = [];
  for (let i = 0; i + windowSize <= samples.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const s = samples[i + j];
      sum += s * s;
    }
    energy.push(Math.sqrt(sum / windowSize));
  }

  if (energy.length === 0) {
    return { bpm: 0, beats: [], energy: [] };
  }

  // Step 2: Onset detection with adaptive threshold
  const halfLocal = Math.floor(localWindowSize / 2);
  const minBeatWindows = Math.floor(minBeatInterval * sampleRate / hopSize);
  const onsets = [];

  for (let i = 0; i < energy.length; i++) {
    // Local average
    const start = Math.max(0, i - halfLocal);
    const end = Math.min(energy.length, i + halfLocal + 1);
    let localSum = 0;
    for (let j = start; j < end; j++) {
      localSum += energy[j];
    }
    const localAvg = localSum / (end - start);

    // Peak detection
    if (energy[i] > localAvg * threshold) {
      // Enforce minimum beat interval
      if (onsets.length === 0 || (i - onsets[onsets.length - 1]) >= minBeatWindows) {
        onsets.push(i);
      }
    }
  }

  // Step 3: Convert window indices to timestamps
  const beats = onsets.map(idx => parseFloat((idx * hopSize / sampleRate).toFixed(3)));

  // Step 4: Calculate BPM from median inter-beat interval
  const bpm = calculateBPM(beats);

  return { bpm, beats, energy };
}

/**
 * Calculate BPM from beat timestamps using median inter-beat interval.
 */
function calculateBPM(beats) {
  if (beats.length < 2) return 0;

  const intervals = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i] - beats[i - 1]);
  }

  // Median interval
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  if (median <= 0) return 0;
  return Math.round(60 / median);
}

// ── Energy Curve ─────────────────────────────────────────────────────────────

/**
 * Compute a normalized energy curve at a given resolution.
 * Returns energy values at evenly-spaced time points.
 *
 * @param {number[]} energy — raw energy array from detectBeats
 * @param {number} sampleRate — sample rate
 * @param {number} hopSize — hop size used in detection
 * @param {number} [segments=20] — number of output points
 * @returns {number[]} — normalized energy values (0-1)
 */
export function computeEnergyCurve(energy, segments = 20) {
  if (!energy || energy.length === 0) return new Array(segments).fill(0);

  const curve = [];
  const windowsPerSegment = Math.max(1, Math.floor(energy.length / segments));

  for (let s = 0; s < segments; s++) {
    const start = s * windowsPerSegment;
    const end = Math.min(start + windowsPerSegment, energy.length);
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += energy[i];
    }
    curve.push(sum / (end - start));
  }

  // Normalize to 0-1
  const max = Math.max(...curve);
  if (max === 0) return curve;
  return curve.map(v => parseFloat((v / max).toFixed(3)));
}

// ── Beat Sync ────────────────────────────────────────────────────────────────

/**
 * Snap scene durations to the nearest beat boundaries.
 *
 * Given a set of scene durations and a beat grid, adjusts each scene's
 * duration so that transition points (cumulative boundaries) align with
 * the closest beat. Preserves total duration within a tolerance.
 *
 * @param {number[]} durations — original scene durations in seconds
 * @param {number[]} beats — beat timestamps in seconds
 * @param {object} [options]
 * @param {number} [options.maxStretch=0.4] — max seconds a scene can grow
 * @param {number} [options.maxCompress=0.3] — max seconds a scene can shrink
 * @param {number} [options.minDuration=1.0] — floor for any scene duration
 * @returns {{ synced: number[], adjustments: object[] }}
 */
export function syncToBeats(durations, beats, options = {}) {
  const {
    maxStretch = 0.4,
    maxCompress = 0.3,
    minDuration = 1.0,
  } = options;

  if (!durations || durations.length === 0 || !beats || beats.length === 0) {
    return {
      synced: durations || [],
      adjustments: [],
    };
  }

  const synced = [...durations];
  const adjustments = [];

  // Calculate cumulative boundaries
  let cumulative = 0;
  for (let i = 0; i < synced.length - 1; i++) {
    cumulative += synced[i];

    // Find nearest beat to this boundary
    const nearest = findNearestBeat(cumulative, beats);
    if (nearest === null) continue;

    const delta = nearest - cumulative;

    // Check adjustment is within tolerance
    if (Math.abs(delta) < 0.01) continue; // already aligned
    if (delta > 0 && delta <= maxStretch) {
      // Stretch this scene to reach the beat
      const newDuration = synced[i] + delta;
      synced[i] = parseFloat(newDuration.toFixed(2));
      adjustments.push({
        scene_index: i,
        original: durations[i],
        adjusted: synced[i],
        delta: parseFloat(delta.toFixed(3)),
        beat_time: nearest,
        type: 'stretch',
      });
      cumulative = nearest;
    } else if (delta < 0 && Math.abs(delta) <= maxCompress) {
      // Compress this scene to hit the earlier beat
      const newDuration = synced[i] + delta;
      if (newDuration >= minDuration) {
        synced[i] = parseFloat(newDuration.toFixed(2));
        adjustments.push({
          scene_index: i,
          original: durations[i],
          adjusted: synced[i],
          delta: parseFloat(delta.toFixed(3)),
          beat_time: nearest,
          type: 'compress',
        });
        cumulative = nearest;
      }
    }
    // If outside tolerance, leave the duration unchanged
  }

  return { synced, adjustments };
}

/**
 * Find the nearest beat timestamp to a given time.
 */
function findNearestBeat(time, beats) {
  let closest = null;
  let closestDist = Infinity;
  for (const beat of beats) {
    const dist = Math.abs(beat - time);
    if (dist < closestDist) {
      closestDist = dist;
      closest = beat;
    }
  }
  return closest;
}

// ── Energy Matching ──────────────────────────────────────────────────────────

/**
 * Map audio energy to camera intensity suggestions.
 *
 * Assigns a camera intensity (0-1) for each scene based on the audio
 * energy during that scene's time range.
 *
 * @param {number[]} durations — scene durations in seconds
 * @param {number[]} energy — raw energy array from detectBeats
 * @param {number} sampleRate — sample rate
 * @param {number} hopSize — hop size used in detection
 * @returns {number[]} — camera intensity per scene (0-1)
 */
export function matchEnergyToScenes(durations, energy, sampleRate, hopSize) {
  if (!energy || energy.length === 0 || !durations || durations.length === 0) {
    return durations.map(() => 0.3); // default moderate intensity
  }

  const intensities = [];
  let cumulative = 0;

  for (const dur of durations) {
    // Map scene time range to energy window range
    const startWindow = Math.floor(cumulative * sampleRate / hopSize);
    const endWindow = Math.min(
      Math.floor((cumulative + dur) * sampleRate / hopSize),
      energy.length
    );

    // Average energy in this range
    let sum = 0;
    let count = 0;
    for (let i = startWindow; i < endWindow; i++) {
      sum += energy[i];
      count++;
    }
    const avgEnergy = count > 0 ? sum / count : 0;
    intensities.push(avgEnergy);
    cumulative += dur;
  }

  // Normalize to 0.1-0.8 range (never fully static, never fully chaotic)
  const max = Math.max(...intensities);
  if (max === 0) return durations.map(() => 0.3);

  return intensities.map(e =>
    parseFloat((0.1 + (e / max) * 0.7).toFixed(2))
  );
}

// ── WAV Decoder ──────────────────────────────────────────────────────────────

/**
 * Decode a WAV file buffer into mono PCM samples.
 * Supports 16-bit and 24-bit PCM WAV files.
 *
 * @param {Buffer} buffer — WAV file contents
 * @returns {{ samples: Float32Array, sampleRate: number, channels: number, duration: number }}
 */
export function decodeWav(buffer) {
  // Validate RIFF header
  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Not a valid WAV file');
  }

  // Find fmt chunk
  let offset = 12;
  let fmtChunk = null;
  let dataChunk = null;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      fmtChunk = {
        audioFormat: buffer.readUInt16LE(offset + 8),
        channels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        bitsPerSample: buffer.readUInt16LE(offset + 22),
      };
    } else if (chunkId === 'data') {
      dataChunk = { offset: offset + 8, size: chunkSize };
    }

    offset += 8 + chunkSize;
    // Align to even boundary
    if (chunkSize % 2 !== 0) offset++;
  }

  if (!fmtChunk) throw new Error('WAV file missing fmt chunk');
  if (!dataChunk) throw new Error('WAV file missing data chunk');
  if (fmtChunk.audioFormat !== 1) throw new Error('Only PCM WAV files are supported');

  const { channels, sampleRate, bitsPerSample } = fmtChunk;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataChunk.size / (bytesPerSample * channels));

  // Read samples and mix to mono
  const samples = new Float32Array(totalSamples);
  let readOffset = dataChunk.offset;

  for (let i = 0; i < totalSamples; i++) {
    let monoSum = 0;
    for (let ch = 0; ch < channels; ch++) {
      let sample;
      if (bitsPerSample === 16) {
        sample = buffer.readInt16LE(readOffset) / 32768;
      } else if (bitsPerSample === 24) {
        // Read 24-bit signed integer
        const b0 = buffer[readOffset];
        const b1 = buffer[readOffset + 1];
        const b2 = buffer[readOffset + 2];
        const raw = (b2 << 16) | (b1 << 8) | b0;
        sample = (raw > 0x7FFFFF ? raw - 0x1000000 : raw) / 8388608;
      } else {
        throw new Error(`Unsupported bits per sample: ${bitsPerSample}`);
      }
      monoSum += sample;
      readOffset += bytesPerSample;
    }
    samples[i] = monoSum / channels;
  }

  return {
    samples,
    sampleRate,
    channels,
    duration: parseFloat((totalSamples / sampleRate).toFixed(3)),
  };
}
