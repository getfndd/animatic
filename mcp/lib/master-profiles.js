/**
 * Master Profiles (ANI-183, epic ANI-181)
 *
 * The four named bundles of finish + retime + quality-gate settings that turn
 * one immutable source into four masters at increasing finish. These are the
 * approved decision rules from the ANI-182 spike
 * (docs/process/master-profile-spike.md) resolved into concrete tool settings.
 *
 * They live as a code constant (not a user catalog like finish-presets.json)
 * because the four tiers are foundational, stable, and spike-decided.
 *
 * `render_target_policy` is a routing MODE + allowed set, not a single enum:
 *   - { mode:'pin', target } — force one render target (T1/T2 stay live HTML).
 *   - { mode:'resolve', allowed:[...], prefer? } — delegate per-scene routing to
 *     resolve_render_targets, constrained to `allowed`, biased toward `prefer`.
 *
 * The honesty contract (spike fault line 2): a master may re-time and re-finish
 * but never re-author. RETIME_OPS is the ONLY set of revision ops a master may
 * apply; anything else is a fork (create_social_cutdown), not a master.
 */

import { HERO_FRAME_TIER_THRESHOLDS } from './hero-frame.js';

/** The only revision ops a master may apply (spike fault line 2 — retime seam). */
export const RETIME_OPS = ['trim', 'extend_hold', 'compress'];

export const MASTER_PROFILES = {
  prototype: {
    name: 'prototype',
    tier: 'T1',
    purpose: 'validate idea/motion fast — HTML as a live surface',
    render_target_policy: { mode: 'pin', target: 'web_native' },
    finish_preset: null, // reduced-motion required; no post
    delivery_profiles: [], // live surface, no encode
    aspect_set: ['16:9'], // authoring ratio only
    audio_policy: 'muted',
    retime_policy: [], // source timing as authored
    hero_frame_threshold: HERO_FRAME_TIER_THRESHOLDS.T1,
  },
  'directed-html': {
    name: 'directed-html',
    tier: 'T2',
    purpose: 'HTML as a small film, embeddable',
    render_target_policy: { mode: 'pin', target: 'web_native' }, // capture-ready
    finish_preset: 'clean-digital',
    delivery_profiles: ['web-embed'],
    aspect_set: ['16:9', '1:1'],
    audio_policy: 'muted-autoplay',
    retime_policy: ['extend_hold', 'trim'], // holds only
    hero_frame_threshold: HERO_FRAME_TIER_THRESHOLDS.T2,
  },
  video: {
    name: 'video',
    tier: 'T3',
    purpose: 'durable shareable media',
    render_target_policy: { mode: 'resolve', allowed: ['browser_capture', 'remotion_native', 'hybrid'] },
    finish_preset: 'editorial-subtle', // or social-punchy (spike alternatives)
    delivery_profiles: ['web-hero', 'social-feed', 'social-landscape', 'story-reel'],
    aspect_set: ['16:9', '1:1', '9:16'],
    audio_policy: 'mix',
    retime_policy: ['trim', 'extend_hold', 'compress'],
    hero_frame_threshold: HERO_FRAME_TIER_THRESHOLDS.T3,
  },
  'hero-film': {
    name: 'hero-film',
    tier: 'T4',
    purpose: 'impressive product storytelling',
    render_target_policy: { mode: 'resolve', prefer: 'remotion_native', allowed: ['remotion_native', 'hybrid', 'browser_capture'] },
    finish_preset: 'cinematic-film', // or premium-brand (spike alternatives)
    delivery_profiles: ['master', 'web-hero', 'social-feed', 'story-reel'],
    aspect_set: ['16:9', '1:1', '9:16'],
    audio_policy: 'full-mix',
    retime_policy: ['trim', 'extend_hold', 'compress'],
    hero_frame_threshold: HERO_FRAME_TIER_THRESHOLDS.T4,
  },
};

const TIER_TO_NAME = Object.fromEntries(
  Object.values(MASTER_PROFILES).map(p => [p.tier, p.name]),
);

/**
 * Resolve a master profile by name (`video`) or tier (`T3`).
 * @returns {object|null} the profile, or null if unknown.
 */
export function getMasterProfile(nameOrTier) {
  if (!nameOrTier) return null;
  const key = String(nameOrTier);
  if (MASTER_PROFILES[key]) return MASTER_PROFILES[key];
  const upper = key.toUpperCase();
  if (TIER_TO_NAME[upper]) return MASTER_PROFILES[TIER_TO_NAME[upper]];
  return null;
}

/** All four profiles in tier order. */
export function listMasterProfiles() {
  return ['prototype', 'directed-html', 'video', 'hero-film'].map(n => MASTER_PROFILES[n]);
}
