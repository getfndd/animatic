/**
 * Audio mixing — ffmpeg arg builders (ANI-111)
 *
 * Pure functions that build ffmpeg argument arrays for common audio-mixing
 * operations. Deliberately doesn't run ffmpeg itself — that separation
 * lets tests assert on the exact flag shape (golden-friendly) and lets
 * callers wire the result into their own subprocess plumbing.
 *
 * Main operation today: mix background music + voiceover with sidechain
 * ducking so the music drops under the narration.
 */

const DEFAULT_DUCKING = {
  // ~6dB dip — matches the acceptance criterion on ANI-111. Threshold /
  // ratio tuned so quiet breaths don't trigger ducking but a clear vocal
  // line holds the music down.
  threshold: 0.05,
  ratio: 8,
  attack_ms: 20,
  release_ms: 250,
  music_gain_db: 0,
  voice_gain_db: 0,
};

/**
 * Build ffmpeg args that mix `musicPath` under `voiceoverPath` using
 * sidechain compression. `voiceoverPath` also plays at full level on top.
 *
 * Output is a single-track stereo WAV/M4A depending on `outputPath`
 * extension. The function itself doesn't care — it just emits the
 * `-filter_complex` graph and lets ffmpeg figure out the encoder.
 *
 * @param {object} opts
 * @param {string} opts.voiceoverPath - Path to the narration audio
 * @param {string} opts.musicPath - Path to the background music
 * @param {string} opts.outputPath - Destination file
 * @param {number} [opts.threshold=0.05]
 * @param {number} [opts.ratio=8]
 * @param {number} [opts.attack_ms=20]
 * @param {number} [opts.release_ms=250]
 * @param {number} [opts.music_gain_db=0]
 * @param {number} [opts.voice_gain_db=0]
 * @returns {string[]}
 */
export function buildDuckingFfmpegArgs(opts) {
  const {
    voiceoverPath,
    musicPath,
    outputPath,
    threshold = DEFAULT_DUCKING.threshold,
    ratio = DEFAULT_DUCKING.ratio,
    attack_ms = DEFAULT_DUCKING.attack_ms,
    release_ms = DEFAULT_DUCKING.release_ms,
    music_gain_db = DEFAULT_DUCKING.music_gain_db,
    voice_gain_db = DEFAULT_DUCKING.voice_gain_db,
  } = opts || {};

  if (!voiceoverPath || !musicPath || !outputPath) {
    throw new Error('buildDuckingFfmpegArgs requires { voiceoverPath, musicPath, outputPath }');
  }

  // Filter graph:
  //   [music] → volume adjust → [music_g]
  //   [voice] → volume adjust + asplit so it both drives the sidechain and
  //            plays on the mix → [vkey][vplay]
  //   [music_g][vkey] → sidechaincompress → [ducked]
  //   [ducked][vplay] → amix → [out]
  const filterGraph = [
    `[0:a]volume=${music_gain_db}dB[music_g]`,
    `[1:a]volume=${voice_gain_db}dB,asplit=2[vkey][vplay]`,
    `[music_g][vkey]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack_ms}:release=${release_ms}[ducked]`,
    `[ducked][vplay]amix=inputs=2:duration=longest:dropout_transition=0[out]`,
  ].join(';');

  return [
    '-y',
    '-i', musicPath,
    '-i', voiceoverPath,
    '-filter_complex', filterGraph,
    '-map', '[out]',
    outputPath,
  ];
}

/**
 * Build ffmpeg args that concatenate a list of per-scene voiceover clips
 * into a single timeline-aligned track, with silence padding so each clip
 * starts at its intended offset. Caller supplies the `offset_ms` per clip
 * (derived from scene start times).
 *
 * @param {object} opts
 * @param {Array<{ path: string, offset_ms: number, duration_ms?: number }>} opts.clips
 * @param {string} opts.outputPath
 * @param {number} [opts.sample_rate=22050]
 * @returns {string[]}
 */
export function buildVoiceoverTrackArgs(opts) {
  const { clips, outputPath, sample_rate = 22050 } = opts || {};
  if (!Array.isArray(clips) || clips.length === 0 || !outputPath) {
    throw new Error('buildVoiceoverTrackArgs requires { clips: [...], outputPath }');
  }

  const inputs = [];
  for (const clip of clips) {
    inputs.push('-i', clip.path);
  }

  // For each clip, delay by its offset_ms so concat preserves timeline.
  // adelay=<ms>:all=1 pads both channels consistently.
  const delayChains = clips.map((clip, i) =>
    `[${i}:a]adelay=${Math.max(0, Math.round(clip.offset_ms))}:all=1[v${i}]`,
  );
  const mixInputs = clips.map((_, i) => `[v${i}]`).join('');
  const filterGraph = [
    ...delayChains,
    `${mixInputs}amix=inputs=${clips.length}:duration=longest:normalize=0[out]`,
  ].join(';');

  return [
    '-y',
    ...inputs,
    '-filter_complex', filterGraph,
    '-map', '[out]',
    '-ar', String(sample_rate),
    outputPath,
  ];
}

export const DEFAULT_DUCKING_PARAMS = Object.freeze({ ...DEFAULT_DUCKING });
