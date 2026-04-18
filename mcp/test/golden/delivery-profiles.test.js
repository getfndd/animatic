/**
 * Golden delivery profiles (ANI-110)
 *
 * Structural snapshots of `buildFfmpegArgs` output for every delivery
 * profile (ANI-106 audio support + ANI-100 dithering + the base profile
 * encoder settings). Catches regressions in encoder flags, scaling,
 * pixel format, audio muxing, and the -an vs -shortest decision when a
 * codec / container is changed in the catalog.
 */

import { describe, it } from 'node:test';

import {
  buildFfmpegArgs,
  getDeliveryProfile,
  DELIVERY_PROFILE_SLUGS,
} from '../../lib/delivery-profiles.js';
import { assertMatchesGolden } from './helpers.js';

// Fixed I/O paths so the snapshot captures only the encoder-flag decisions.
const INPUT_PATTERN = 'frames/frame_%06d.png';
const OUTPUT_PATH = 'out/video.mp4';
const AUDIO_INPUT = 'audio/mix.wav';

describe('golden: delivery profile ffmpeg args', () => {
  for (const slug of DELIVERY_PROFILE_SLUGS) {
    it(`${slug} → video-only args`, () => {
      const profile = getDeliveryProfile(slug);
      const args = buildFfmpegArgs(profile, INPUT_PATTERN, OUTPUT_PATH);
      assertMatchesGolden(`delivery-profiles/${slug}.video-only`, args);
    });

    it(`${slug} → with audio input`, () => {
      const profile = getDeliveryProfile(slug);
      const args = buildFfmpegArgs(profile, INPUT_PATTERN, OUTPUT_PATH, {
        audioInput: AUDIO_INPUT,
      });
      assertMatchesGolden(`delivery-profiles/${slug}.with-audio`, args);
    });
  }
});
