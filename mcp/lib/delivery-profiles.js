/**
 * Delivery Profiles — Channel→Quality Mapping
 *
 * Maps delivery channels (web-hero, social-feed, email-gif, etc.)
 * to encoding settings (resolution, fps, codec, CRF, max size).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

let _profiles = null;
function loadProfiles() {
  if (!_profiles) {
    _profiles = JSON.parse(readFileSync(resolve(ROOT, 'catalog/delivery-profiles.json'), 'utf-8'));
  }
  return _profiles;
}

/**
 * Get a delivery profile by slug.
 * @param {string} slug - Profile slug (web-hero, social-feed, etc.)
 * @returns {object|null}
 */
export function getDeliveryProfile(slug) {
  return loadProfiles().find(p => p.slug === slug) || null;
}

/**
 * List all delivery profiles.
 * @returns {object[]}
 */
export function listDeliveryProfiles() {
  return loadProfiles();
}

/**
 * Find the best delivery profile for a channel.
 * @param {string} channel - Channel name (youtube, instagram-feed, email, etc.)
 * @returns {object|null}
 */
export function getProfileForChannel(channel) {
  const lc = channel.toLowerCase();
  // Exact match first
  const exact = loadProfiles().find(p => p.channels.some(c => c === lc));
  if (exact) return exact;
  // Substring match — but only if the channel or profile channel is at least 3 chars
  // (avoids "x" matching "fax-machine")
  return loadProfiles().find(p => p.channels.some(c =>
    c.length >= 3 && lc.length >= 3 && (lc.includes(c) || c.includes(lc))
  )) || null;
}

/**
 * Build ffmpeg arguments from a delivery profile.
 *
 * When the profile has video-only input (frame pattern), audio is configured
 * via an optional second input (`audioInput`). When no audio source is
 * provided OR the profile explicitly sets `audio: null` (e.g. email-gif),
 * `-an` is emitted and the output has no audio stream.
 *
 * @param {object} profile - Delivery profile
 * @param {string} inputPattern - Input frame pattern (e.g., 'frames/frame_%06d.png')
 * @param {string} outputPath - Output file path
 * @param {object} [opts]
 * @param {string} [opts.audioInput] - Path to an audio file to mux into the output.
 * @returns {string[]} ffmpeg arguments
 */
export function buildFfmpegArgs(profile, inputPattern, outputPath, opts = {}) {
  const args = ['-y', '-framerate', String(profile.fps), '-i', inputPattern];

  const wantsAudio = profile.audio && opts.audioInput;
  if (wantsAudio) {
    args.push('-i', opts.audioInput);
  }

  // Video filter chain: dithering (optional) + scale to target resolution
  const vf = (profile.dithering ? 'noise=c0s=3:c1s=3:c2s=3:allf=t,' : '') +
    `scale=${profile.resolution.w}:${profile.resolution.h}:flags=lanczos`;
  args.push('-vf', vf);

  switch (profile.codec) {
    case 'h264':
      args.push('-c:v', 'libx264');
      if (profile.pixel_format) args.push('-pix_fmt', profile.pixel_format);
      if (profile.crf != null) args.push('-crf', String(profile.crf));
      if (profile.preset) args.push('-preset', profile.preset);
      args.push('-movflags', '+faststart');
      break;
    case 'prores':
      args.push('-c:v', 'prores_ks', '-profile:v', '4444');
      if (profile.pixel_format) args.push('-pix_fmt', profile.pixel_format);
      break;
    case 'gif':
      // GIF needs palette generation — handled by gifski externally
      break;
  }

  if (wantsAudio) {
    const a = profile.audio;
    args.push('-c:a', a.codec);
    if (a.bitrate_kbps != null) args.push('-b:a', `${a.bitrate_kbps}k`);
    if (a.sample_rate != null) args.push('-ar', String(a.sample_rate));
    if (a.channels != null) args.push('-ac', String(a.channels));
    args.push('-shortest');
  } else {
    args.push('-an');
  }

  args.push(outputPath);
  return args;
}

/**
 * Build ffmpeg args that transcode an existing master MP4 down to a delivery
 * profile (ANI-190). The mp4→mp4 sibling of `buildFfmpegArgs` (which encodes
 * from a PNG frame pattern): the per-aspect master is the "source of truth for
 * all encodes" and each profile is a scale + fps + codec/quality pass off it.
 *
 * Audio is RE-ENCODED to the profile's `audio` spec (bitrate/rate/channels) —
 * not `-c:a copy` — since the 48 kHz master must land at e.g. social-feed's
 * 128 kbps / 44.1 kHz. `audio: null` (or absent) → `-an`.
 *
 * GIF (`codec: 'gif'`) is intentionally NOT handled here — it needs a palettegen
 * pass; `encodeMaster` defers it. Caption burn-in and `max_size_mb` two-pass are
 * likewise out of scope (deferred with reasons).
 *
 * @param {object} profile - Delivery profile (resolution, fps, codec, crf, …).
 * @param {string} inputPath - The source master MP4.
 * @param {string} outputPath - Destination file.
 * @param {object} [opts]
 * @param {string} [opts.burnInSubtitles] - Path to a VTT/SRT sidecar to burn into
 *   the picture (ANI-193, for `captions.mode==='burn_in'` profiles). Rendered
 *   AFTER scale so captions sit at the delivery resolution.
 * @returns {string[]} ffmpeg arguments
 */
/**
 * Escape a path for ffmpeg's `subtitles=` filter, UNQUOTED (the argv form — no
 * surrounding single quotes, which are a shell construct). The filtergraph
 * parser treats `\`, `:` and `'` specially — backslash-escape each (backslash
 * first so we don't double-escape the others). Conservative and sufficient for
 * project paths; exotic filtergraph metacharacters aren't in play.
 *
 * NOTE: the `subtitles` filter requires an ffmpeg built with libass; absent it,
 * the burn-in transcode fails (caught fail-soft per profile by encodeMaster).
 */
export function escapeSubtitlesPath(p) {
  return String(p).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export function buildTranscodeArgs(profile, inputPath, outputPath, opts = {}) {
  if (!profile || !inputPath || !outputPath) {
    throw new Error('buildTranscodeArgs requires (profile, inputPath, outputPath)');
  }
  if (profile.codec === 'gif') {
    throw new Error('buildTranscodeArgs does not handle gif (needs palettegen) — defer email-gif');
  }

  const args = ['-y', '-i', inputPath];

  // fps conversion + scale to the profile resolution (+ optional dithering),
  // mirroring buildFfmpegArgs' filter chain but for a decoded video input.
  // Caption burn-in (if any) renders AFTER scale so it lands at delivery size.
  const vf = [
    `fps=${profile.fps}`,
    ...(profile.dithering ? ['noise=c0s=3:c1s=3:c2s=3:allf=t'] : []),
    `scale=${profile.resolution.w}:${profile.resolution.h}:flags=lanczos`,
    ...(opts.burnInSubtitles ? [`subtitles=${escapeSubtitlesPath(opts.burnInSubtitles)}`] : []),
  ].join(',');
  args.push('-vf', vf);

  switch (profile.codec) {
    case 'h264':
      args.push('-c:v', 'libx264');
      if (profile.pixel_format) args.push('-pix_fmt', profile.pixel_format);
      if (profile.crf != null) args.push('-crf', String(profile.crf));
      if (profile.preset) args.push('-preset', profile.preset);
      args.push('-movflags', '+faststart');
      break;
    case 'prores':
      args.push('-c:v', 'prores_ks', '-profile:v', '4444');
      if (profile.pixel_format) args.push('-pix_fmt', profile.pixel_format);
      break;
    default:
      throw new Error(`buildTranscodeArgs: unsupported codec "${profile.codec}"`);
  }

  // Audio: re-encode to the profile spec, or drop it.
  const a = profile.audio;
  if (a && a.codec) {
    args.push('-c:a', a.codec);
    if (a.bitrate_kbps != null) args.push('-b:a', `${a.bitrate_kbps}k`);
    if (a.sample_rate != null) args.push('-ar', String(a.sample_rate));
    if (a.channels != null) args.push('-ac', String(a.channels));
  } else {
    args.push('-an');
  }

  args.push(outputPath);
  return args;
}

export const DELIVERY_PROFILE_SLUGS = [
  'web-hero', 'web-embed', 'social-feed', 'social-landscape',
  'story-reel', 'email-gif', 'presentation', 'master',
];
