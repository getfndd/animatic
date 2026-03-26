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
 * @param {object} profile - Delivery profile
 * @param {string} inputPattern - Input frame pattern (e.g., 'frames/frame_%06d.png')
 * @param {string} outputPath - Output file path
 * @returns {string[]} ffmpeg arguments
 */
export function buildFfmpegArgs(profile, inputPattern, outputPath) {
  const args = ['-y', '-framerate', String(profile.fps), '-i', inputPattern];

  // Dithering filter for gradient preservation
  if (profile.dithering) {
    args.push('-vf', 'noise=c0s=3:c1s=3:c2s=3:allf=t');
  }

  // Scale to target resolution
  args.push('-vf', (profile.dithering ? 'noise=c0s=3:c1s=3:c2s=3:allf=t,' : '') +
    `scale=${profile.resolution.w}:${profile.resolution.h}:flags=lanczos`);

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

  args.push('-an', outputPath);
  return args;
}

export const DELIVERY_PROFILE_SLUGS = [
  'web-hero', 'web-embed', 'social-feed', 'social-landscape',
  'story-reel', 'email-gif', 'presentation', 'master',
];
