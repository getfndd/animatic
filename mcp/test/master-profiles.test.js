/**
 * Master Profiles (ANI-183) — the four profile constants resolve correctly and
 * stay consistent with the hero-frame thresholds + the retime honesty contract.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MASTER_PROFILES, RETIME_OPS, getMasterProfile, listMasterProfiles } from '../lib/master-profiles.js';
import { HERO_FRAME_TIER_THRESHOLDS } from '../lib/hero-frame.js';

describe('master-profiles', () => {
  it('has exactly the four tiers in order', () => {
    assert.deepEqual(listMasterProfiles().map(p => p.name), ['prototype', 'directed-html', 'video', 'hero-film']);
    assert.deepEqual(listMasterProfiles().map(p => p.tier), ['T1', 'T2', 'T3', 'T4']);
  });

  it('resolves by name and by tier', () => {
    assert.equal(getMasterProfile('video').tier, 'T3');
    assert.equal(getMasterProfile('T3').name, 'video');
    assert.equal(getMasterProfile('t4').name, 'hero-film');
    assert.equal(getMasterProfile('nope'), null);
    assert.equal(getMasterProfile(undefined), null);
  });

  it('thresholds are sourced from the hero-frame contract (single source of truth)', () => {
    for (const p of listMasterProfiles()) {
      assert.equal(p.hero_frame_threshold, HERO_FRAME_TIER_THRESHOLDS[p.tier], `${p.name} threshold`);
    }
  });

  it('RETIME_OPS is exactly the spike retime seam (no re-authoring ops)', () => {
    assert.deepEqual(RETIME_OPS, ['trim', 'extend_hold', 'compress']);
    // every profile's retime_policy is a subset of RETIME_OPS
    for (const p of listMasterProfiles()) {
      for (const op of p.retime_policy) assert.ok(RETIME_OPS.includes(op), `${p.name} retime op ${op} must be a retime op`);
    }
    assert.deepEqual(MASTER_PROFILES.prototype.retime_policy, [], 'prototype never retimes');
  });

  it('render_target_policy is a mode + target/allowed, matching the spike', () => {
    assert.deepEqual(MASTER_PROFILES.prototype.render_target_policy, { mode: 'pin', target: 'web_native' });
    assert.deepEqual(MASTER_PROFILES['directed-html'].render_target_policy, { mode: 'pin', target: 'web_native' });
    assert.equal(MASTER_PROFILES.video.render_target_policy.mode, 'resolve');
    assert.equal(MASTER_PROFILES['hero-film'].render_target_policy.prefer, 'remotion_native');
  });

  it('aspect/delivery widen with tier; prototype is live-only', () => {
    assert.deepEqual(MASTER_PROFILES.prototype.aspect_set, ['16:9']);
    assert.deepEqual(MASTER_PROFILES.prototype.delivery_profiles, []);
    assert.ok(MASTER_PROFILES['hero-film'].delivery_profiles.includes('master'));
  });
});
