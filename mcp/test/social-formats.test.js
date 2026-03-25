/**
 * Tests for Social Formats — aspect ratio presets and manifest adaptation.
 *
 * Covers: getSocialFormat, listSocialFormats, adaptManifestAspectRatio,
 * createSocialCutdown.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getSocialFormat,
  listSocialFormats,
  adaptManifestAspectRatio,
  createSocialCutdown,
  SOCIAL_FORMAT_SLUGS,
  VALID_ASPECT_RATIOS,
} from '../lib/social-formats.js';

// ── getSocialFormat ─────────────────────────────────────────────────────────

describe('getSocialFormat', () => {
  it('returns square format by slug', () => {
    const f = getSocialFormat('square');
    assert.ok(f, 'should return a value');
    assert.equal(f.slug, 'square');
    assert.equal(f.aspect_ratio, '1:1');
    assert.equal(f.resolution.w, 1080);
    assert.equal(f.resolution.h, 1080);
  });

  it('returns portrait_4_5 format by slug', () => {
    const f = getSocialFormat('portrait_4_5');
    assert.ok(f);
    assert.equal(f.aspect_ratio, '4:5');
    assert.equal(f.resolution.w, 1080);
    assert.equal(f.resolution.h, 1350);
  });

  it('returns vertical_story format by slug', () => {
    const f = getSocialFormat('vertical_story');
    assert.ok(f);
    assert.equal(f.aspect_ratio, '9:16');
    assert.equal(f.resolution.w, 1080);
    assert.equal(f.resolution.h, 1920);
  });

  it('returns landscape format by slug', () => {
    const f = getSocialFormat('landscape');
    assert.ok(f);
    assert.equal(f.aspect_ratio, '16:9');
    assert.equal(f.resolution.w, 1920);
    assert.equal(f.resolution.h, 1080);
  });

  it('returns null for unknown slug', () => {
    assert.equal(getSocialFormat('nonexistent'), null);
  });

  it('all formats have required fields', () => {
    const required = ['slug', 'aspect_ratio', 'resolution', 'safe_areas', 'typography_scale',
      'max_scene_duration_s', 'recommended_duration_range', 'layout_adjustments',
      'personality_affinities', 'when_to_use', 'pacing_rules'];
    for (const slug of SOCIAL_FORMAT_SLUGS) {
      const f = getSocialFormat(slug);
      for (const key of required) {
        assert.ok(key in f, `${slug} missing key: ${key}`);
      }
    }
  });
});

// ── listSocialFormats ───────────────────────────────────────────────────────

describe('listSocialFormats', () => {
  it('returns all formats with no filter', () => {
    const all = listSocialFormats();
    assert.equal(all.length, 4);
  });

  it('filters by personality', () => {
    const montage = listSocialFormats({ personality: 'montage' });
    assert.ok(montage.length > 0);
    for (const f of montage) {
      assert.ok(f.personality_affinities.includes('montage'));
    }
  });

  it('returns empty for unknown personality', () => {
    const result = listSocialFormats({ personality: 'nonexistent' });
    assert.equal(result.length, 0);
  });
});

// ── SOCIAL_FORMAT_SLUGS ─────────────────────────────────────────────────────

describe('SOCIAL_FORMAT_SLUGS', () => {
  it('contains all four format slugs', () => {
    assert.ok(SOCIAL_FORMAT_SLUGS.includes('square'));
    assert.ok(SOCIAL_FORMAT_SLUGS.includes('portrait_4_5'));
    assert.ok(SOCIAL_FORMAT_SLUGS.includes('vertical_story'));
    assert.ok(SOCIAL_FORMAT_SLUGS.includes('landscape'));
  });
});

// ── VALID_ASPECT_RATIOS ─────────────────────────────────────────────────────

describe('VALID_ASPECT_RATIOS', () => {
  it('contains all four ratios', () => {
    assert.deepEqual(VALID_ASPECT_RATIOS, ['16:9', '1:1', '4:5', '9:16']);
  });
});

// ── adaptManifestAspectRatio ────────────────────────────────────────────────

const baseManifest = {
  sequence_id: 'seq_test_adapt',
  resolution: { w: 1920, h: 1080 },
  fps: 60,
  scenes: [
    { scene: 'sc_intro', duration_s: 5 },
    { scene: 'sc_body', duration_s: 8, camera_override: { move: 'pan_left', intensity: 0.7 } },
    { scene: 'sc_close', duration_s: 4, transition_in: { type: 'crossfade', duration_ms: 400 } },
  ],
};

describe('adaptManifestAspectRatio', () => {
  it('adapts to square 1:1', () => {
    const adapted = adaptManifestAspectRatio(baseManifest, '1:1');
    assert.equal(adapted.resolution.w, 1080);
    assert.equal(adapted.resolution.h, 1080);
    assert.equal(adapted.format.aspect_ratio, '1:1');
    assert.ok(adapted.format.safe_areas);
  });

  it('adapts to vertical 9:16', () => {
    const adapted = adaptManifestAspectRatio(baseManifest, '9:16');
    assert.equal(adapted.resolution.w, 1080);
    assert.equal(adapted.resolution.h, 1920);
    assert.equal(adapted.format.aspect_ratio, '9:16');
  });

  it('clamps scene duration to format max', () => {
    const adapted = adaptManifestAspectRatio(baseManifest, '1:1');
    // square max is 5s
    for (const scene of adapted.scenes) {
      assert.ok(scene.duration_s <= 5, `scene duration ${scene.duration_s} should be <= 5`);
    }
  });

  it('reduces horizontal pan intensity for narrow formats', () => {
    const adapted = adaptManifestAspectRatio(baseManifest, '9:16');
    const panScene = adapted.scenes.find(s => s.camera_override?.move === 'pan_left');
    assert.ok(panScene);
    assert.ok(panScene.camera_override.intensity <= 0.3, 'pan intensity should be reduced');
  });

  it('does not mutate original manifest', () => {
    const original = JSON.parse(JSON.stringify(baseManifest));
    adaptManifestAspectRatio(baseManifest, '1:1');
    assert.deepEqual(baseManifest, original);
  });

  it('throws for invalid aspect ratio', () => {
    assert.throws(() => adaptManifestAspectRatio(baseManifest, '3:2'), /Invalid aspect ratio/);
  });

  it('preserves existing format fields', () => {
    const withFormat = { ...baseManifest, format: { custom_field: 'keep_me' } };
    const adapted = adaptManifestAspectRatio(withFormat, '1:1');
    assert.equal(adapted.format.custom_field, 'keep_me');
    assert.equal(adapted.format.aspect_ratio, '1:1');
  });

  it('recompose mode adjusts layer positions', () => {
    const withLayers = {
      ...baseManifest,
      scenes: [
        {
          scene: 'sc_layers',
          duration_s: 3,
          layers: [
            { id: 'bg', position: { x: 960, y: 540 }, size: { w: 800, h: 400 } },
          ],
        },
      ],
    };
    const adapted = adaptManifestAspectRatio(withLayers, '1:1', { recompose: true });
    const layer = adapted.scenes[0].layers[0];
    assert.ok(layer.position.x != null);
    assert.ok(layer.position.y != null);
  });
});

// ── createSocialCutdown ─────────────────────────────────────────────────────

const longManifest = {
  sequence_id: 'seq_long_demo',
  resolution: { w: 1920, h: 1080 },
  fps: 60,
  scenes: [
    { scene: 'sc_01', duration_s: 5 },
    { scene: 'sc_02', duration_s: 6 },
    { scene: 'sc_03', duration_s: 4 },
    { scene: 'sc_04', duration_s: 7 },
    { scene: 'sc_05', duration_s: 5 },
    { scene: 'sc_06', duration_s: 4 },
    { scene: 'sc_07', duration_s: 6 },
    { scene: 'sc_08', duration_s: 3 },
  ],
};

describe('createSocialCutdown', () => {
  it('creates a cutdown with specified scenes', () => {
    const cutdown = createSocialCutdown(longManifest, [0, 3, 7], '1:1', 15);
    assert.ok(cutdown.scenes.length <= 3);
    assert.equal(cutdown.resolution.w, 1080);
    assert.equal(cutdown.resolution.h, 1080);
  });

  it('auto-selects scenes when none specified', () => {
    const cutdown = createSocialCutdown(longManifest, null, '1:1', 15);
    assert.ok(cutdown.scenes.length > 0);
    assert.ok(cutdown.scenes.length < longManifest.scenes.length);
  });

  it('enforces max duration', () => {
    const cutdown = createSocialCutdown(longManifest, [0, 1, 2, 3], '1:1', 10);
    let total = 0;
    for (const s of cutdown.scenes) {
      total += s.duration_s || 3;
      if (s.transition_in?.duration_ms) total -= s.transition_in.duration_ms / 1000;
    }
    assert.ok(total <= 10, `total duration ${total} should be <= 10`);
  });

  it('updates sequence_id with social prefix', () => {
    const cutdown = createSocialCutdown(longManifest, [0, 1], '1:1', 10);
    assert.ok(cutdown.sequence_id.startsWith('seq_social_'));
  });

  it('sets sequence_intent', () => {
    const cutdown = createSocialCutdown(longManifest, [0, 1], '9:16', 10);
    assert.ok(cutdown.sequence_intent);
  });

  it('tightens transition durations', () => {
    const withTransitions = {
      ...longManifest,
      scenes: longManifest.scenes.map((s, i) => ({
        ...s,
        transition_in: i > 0 ? { type: 'crossfade', duration_ms: 600 } : undefined,
      })),
    };
    const cutdown = createSocialCutdown(withTransitions, [0, 1, 2], '1:1', 15);
    for (const s of cutdown.scenes) {
      if (s.transition_in?.duration_ms) {
        assert.ok(s.transition_in.duration_ms <= 300, 'transitions should be tightened');
      }
    }
  });

  it('throws for invalid aspect ratio', () => {
    assert.throws(() => createSocialCutdown(longManifest, null, '3:2', 10), /Invalid aspect ratio/);
  });

  it('does not mutate original manifest', () => {
    const original = JSON.parse(JSON.stringify(longManifest));
    createSocialCutdown(longManifest, [0, 1], '1:1', 10);
    assert.deepEqual(longManifest, original);
  });
});
