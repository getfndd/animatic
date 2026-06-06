/**
 * Audio-mix ffmpeg arg builders (ANI-111).
 *
 * Pure-function tests — asserts on the exact shape of the emitted arg
 * array so drift in the filter graph surfaces immediately.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDuckedMuxArgs,
  buildDuckingFfmpegArgs,
  buildMuxArgs,
  buildVoiceoverTrackArgs,
  DEFAULT_DUCKING_PARAMS,
} from '../lib/audio-mix.js';

// ── buildDuckingFfmpegArgs ──────────────────────────────────────────────────

describe('buildDuckingFfmpegArgs', () => {
  const baseOpts = {
    voiceoverPath: 'narration.wav',
    musicPath: 'music.wav',
    outputPath: 'mixed.wav',
  };

  it('emits sidechaincompress with default parameters', () => {
    const args = buildDuckingFfmpegArgs(baseOpts);
    const filterIndex = args.indexOf('-filter_complex');
    const graph = args[filterIndex + 1];
    assert.match(graph, /sidechaincompress/);
    assert.match(graph, /threshold=0\.05/);
    assert.match(graph, /ratio=8/);
  });

  it('outputs a single [out] track', () => {
    const args = buildDuckingFfmpegArgs(baseOpts);
    const mapIdx = args.indexOf('-map');
    assert.equal(args[mapIdx + 1], '[out]');
  });

  it('orders inputs as [music, voiceover]', () => {
    const args = buildDuckingFfmpegArgs(baseOpts);
    // First -i should be music (drives the compressor), second is voice
    const firstI = args.indexOf('-i');
    assert.equal(args[firstI + 1], 'music.wav');
    const secondI = args.indexOf('-i', firstI + 1);
    assert.equal(args[secondI + 1], 'narration.wav');
  });

  it('splits voiceover so it plays while also keying the ducker', () => {
    const args = buildDuckingFfmpegArgs(baseOpts);
    const graph = args[args.indexOf('-filter_complex') + 1];
    assert.match(graph, /asplit=2\[vk0\]\[vplay\]/);
    assert.match(graph, /\[ducked\]\[vplay\]amix/);
  });

  it('pads the sidechain key so a short voiceover cannot truncate the music (ANI-127)', () => {
    // sidechaincompress ends when its key input ends; without apad the
    // mixed output truncated to the narration length.
    const args = buildDuckingFfmpegArgs(baseOpts);
    const graph = args[args.indexOf('-filter_complex') + 1];
    assert.match(graph, /\[vk0\]apad\[vkey\]/);
    assert.match(graph, /amix=inputs=2:duration=longest/);
  });

  it('honors custom gain + threshold overrides', () => {
    const args = buildDuckingFfmpegArgs({
      ...baseOpts,
      threshold: 0.1,
      ratio: 12,
      music_gain_db: -3,
      voice_gain_db: 2,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    assert.match(graph, /threshold=0\.1/);
    assert.match(graph, /ratio=12/);
    assert.match(graph, /volume=-3dB/);
    assert.match(graph, /volume=2dB/);
  });

  it('throws when paths are missing', () => {
    assert.throws(() => buildDuckingFfmpegArgs({ voiceoverPath: 'x' }));
  });
});

// ── buildVoiceoverTrackArgs ────────────────────────────────────────────────

describe('buildVoiceoverTrackArgs', () => {
  it('emits one adelay per clip and mixes them', () => {
    const args = buildVoiceoverTrackArgs({
      clips: [
        { path: 'sc_01.wav', offset_ms: 0 },
        { path: 'sc_02.wav', offset_ms: 2000 },
        { path: 'sc_03.wav', offset_ms: 5000 },
      ],
      outputPath: 'track.wav',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    assert.match(graph, /\[0:a\]adelay=0:all=1\[v0\]/);
    assert.match(graph, /\[1:a\]adelay=2000:all=1\[v1\]/);
    assert.match(graph, /\[2:a\]adelay=5000:all=1\[v2\]/);
    assert.match(graph, /\[v0\]\[v1\]\[v2\]amix=inputs=3/);
  });

  it('rejects empty clip lists', () => {
    assert.throws(() => buildVoiceoverTrackArgs({ clips: [], outputPath: 'x.wav' }));
  });

  it('clamps negative offsets to 0', () => {
    const args = buildVoiceoverTrackArgs({
      clips: [{ path: 'a.wav', offset_ms: -500 }],
      outputPath: 'out.wav',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    assert.match(graph, /adelay=0:all=1/);
  });
});

// ── buildMuxArgs ────────────────────────────────────────────────────────────

describe('buildMuxArgs', () => {
  const baseOpts = {
    videoPath: 'render.mp4',
    audioPath: 'track.wav',
    outputPath: 'final.mp4',
  };

  it('copies the video stream and encodes audio as AAC', () => {
    const args = buildMuxArgs(baseOpts);
    const cvIdx = args.indexOf('-c:v');
    assert.equal(args[cvIdx + 1], 'copy');
    const caIdx = args.indexOf('-c:a');
    assert.equal(args[caIdx + 1], 'aac');
  });

  it('maps video from input 0 and audio from input 1', () => {
    const args = buildMuxArgs(baseOpts);
    const firstMap = args.indexOf('-map');
    assert.equal(args[firstMap + 1], '0:v');
    const secondMap = args.indexOf('-map', firstMap + 1);
    assert.equal(args[secondMap + 1], '1:a');
  });

  it('does not truncate the picture with -shortest', () => {
    const args = buildMuxArgs(baseOpts);
    assert.equal(args.includes('-shortest'), false);
  });

  it('throws when paths are missing', () => {
    assert.throws(() => buildMuxArgs({ videoPath: 'x.mp4' }));
  });
});

// ── buildDuckedMuxArgs ──────────────────────────────────────────────────────

describe('buildDuckedMuxArgs', () => {
  const baseOpts = {
    videoPath: 'render.mp4',
    voiceoverPath: 'narration.wav',
    outputPath: 'final.mp4',
  };

  it('ducks the video\'s own audio stream under the voiceover', () => {
    const args = buildDuckedMuxArgs(baseOpts);
    const graph = args[args.indexOf('-filter_complex') + 1];
    // Input 0 (the video) supplies the "music" side of the compressor.
    assert.match(graph, /\[0:a\]volume=0dB\[music_g\]/);
    assert.match(graph, /sidechaincompress=threshold=0\.05:ratio=8/);
    assert.match(graph, /asplit=2\[vk0\]\[vplay\]/);
  });

  it('pads the sidechain key so narration shorter than the render cannot truncate its audio (ANI-127)', () => {
    const args = buildDuckedMuxArgs(baseOpts);
    const graph = args[args.indexOf('-filter_complex') + 1];
    assert.match(graph, /\[vk0\]apad\[vkey\]/);
    assert.match(graph, /amix=inputs=2:duration=longest/);
  });

  it('copies video and maps the mixed [out] track', () => {
    const args = buildDuckedMuxArgs(baseOpts);
    const cvIdx = args.indexOf('-c:v');
    assert.equal(args[cvIdx + 1], 'copy');
    const firstMap = args.indexOf('-map');
    assert.equal(args[firstMap + 1], '0:v');
    const secondMap = args.indexOf('-map', firstMap + 1);
    assert.equal(args[secondMap + 1], '[out]');
  });

  it('honors ducking overrides like buildDuckingFfmpegArgs', () => {
    const args = buildDuckedMuxArgs({ ...baseOpts, threshold: 0.1, music_gain_db: -3 });
    const graph = args[args.indexOf('-filter_complex') + 1];
    assert.match(graph, /threshold=0\.1/);
    assert.match(graph, /volume=-3dB/);
  });

  it('throws when paths are missing', () => {
    assert.throws(() => buildDuckedMuxArgs({ videoPath: 'x.mp4' }));
  });
});

// ── Defaults are locked ─────────────────────────────────────────────────────

describe('DEFAULT_DUCKING_PARAMS', () => {
  it('locks the acceptance-criterion ducking depth (~6dB dip = threshold 0.05, ratio 8)', () => {
    assert.equal(DEFAULT_DUCKING_PARAMS.threshold, 0.05);
    assert.equal(DEFAULT_DUCKING_PARAMS.ratio, 8);
  });
});
