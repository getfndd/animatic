/**
 * Tests for delivery profiles.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDeliveryProfile,
  listDeliveryProfiles,
  getProfileForChannel,
  buildFfmpegArgs,
  DELIVERY_PROFILE_SLUGS,
} from '../lib/delivery-profiles.js';

describe('listDeliveryProfiles', () => {
  it('returns all profiles', () => {
    const profiles = listDeliveryProfiles();
    assert.ok(profiles.length >= 8);
    for (const slug of DELIVERY_PROFILE_SLUGS) {
      assert.ok(profiles.some(p => p.slug === slug), `Missing profile: ${slug}`);
    }
  });

  it('each profile has required fields', () => {
    for (const p of listDeliveryProfiles()) {
      assert.ok(p.slug, 'missing slug');
      assert.ok(p.name, 'missing name');
      assert.ok(p.resolution, 'missing resolution');
      assert.ok(typeof p.fps === 'number', 'missing fps');
      assert.ok(p.codec, 'missing codec');
      assert.ok(Array.isArray(p.channels), 'missing channels');
    }
  });
});

describe('getDeliveryProfile', () => {
  it('returns profile by slug', () => {
    const p = getDeliveryProfile('web-hero');
    assert.equal(p.slug, 'web-hero');
    assert.equal(p.resolution.w, 1920);
    assert.equal(p.fps, 60);
  });

  it('returns null for unknown slug', () => {
    assert.equal(getDeliveryProfile('nonexistent'), null);
  });
});

describe('getProfileForChannel', () => {
  it('finds profile for youtube', () => {
    const p = getProfileForChannel('youtube');
    assert.ok(p);
    assert.equal(p.resolution.w, 1920);
  });

  it('finds profile for instagram-feed', () => {
    const p = getProfileForChannel('instagram-feed');
    assert.ok(p);
    assert.equal(p.resolution.w, 1080);
    assert.equal(p.resolution.h, 1080);
  });

  it('finds profile for email', () => {
    const p = getProfileForChannel('email');
    assert.ok(p);
    assert.equal(p.codec, 'gif');
  });

  it('finds profile for tiktok', () => {
    const p = getProfileForChannel('tiktok');
    assert.ok(p);
    assert.equal(p.resolution.h, 1920);
  });

  it('returns null for unknown channel', () => {
    assert.equal(getProfileForChannel('fax-machine'), null);
  });
});

describe('buildFfmpegArgs', () => {
  it('builds H.264 args with dithering', () => {
    const p = getDeliveryProfile('web-hero');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.mp4');
    assert.ok(args.includes('-c:v'));
    assert.ok(args.includes('libx264'));
    assert.ok(args.includes('-movflags'));
    assert.ok(args.some(a => a.includes('noise')), 'should include dithering filter');
  });

  it('builds ProRes args without dithering', () => {
    const p = getDeliveryProfile('master');
    const args = buildFfmpegArgs(p, 'frames/frame_%06d.png', 'out.mov');
    assert.ok(args.includes('prores_ks'));
    assert.ok(!args.some(a => a.includes('noise')), 'master should not dither');
  });
});
