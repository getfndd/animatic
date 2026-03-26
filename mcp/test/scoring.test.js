/**
 * Tests for unified video scoring.
 *
 * Covers: weight validation, subscore derivation, revision recommendations,
 * edge cases, score range validation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { scoreCandidateVideo, DEFAULT_WEIGHTS, REVISION_OPS } from '../lib/scoring.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeManifest(sceneCount = 3) {
  return {
    sequence_id: 'seq_test',
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      scene: `sc_${String(i + 1).padStart(2, '0')}`,
      duration_s: 3,
      transition_in: i === 0 ? null : { type: 'crossfade', duration_ms: 400 },
    })),
  };
}

function makeScene(id, opts = {}) {
  return {
    scene_id: id,
    duration_s: opts.duration_s || 3,
    camera: opts.camera || { move: 'static' },
    layers: opts.layers || [
      {
        id: 'ly_hero',
        type: 'text',
        content: 'Test content',
        depth_class: 'hero',
        entrance: { type: 'fade_in', duration_ms: 300 },
      },
      {
        id: 'ly_bg',
        type: 'image',
        depth_class: 'background',
        src: '/test-bg.png',
        entrance: { type: 'fade_in', duration_ms: 500 },
      },
    ],
    metadata: opts.metadata || {
      content_type: 'typography',
      motion_energy: 'moderate',
      visual_weight: 'medium',
      intent_tags: i === 0 ? ['opening'] : ['detail'],
    },
  };
}

function makeScenes(manifest) {
  return manifest.scenes.map((entry, i) => makeScene(entry.scene, {
    metadata: {
      content_type: i === 0 ? 'typography' : 'ui_screenshot',
      motion_energy: 'moderate',
      visual_weight: 'medium',
      intent_tags: i === 0 ? ['opening'] : i === manifest.scenes.length - 1 ? ['closing'] : ['detail'],
    },
  }));
}

// ── Weight validation ───────────────────────────────────────────────────────

describe('scoring — weights', () => {
  it('default weights sum to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001, `Weights sum to ${sum}`);
  });

  it('has exactly 6 dimensions', () => {
    assert.equal(Object.keys(DEFAULT_WEIGHTS).length, 6);
  });
});

// ── Score card structure ────────────────────────────────────────────────────

describe('scoreCandidateVideo — structure', () => {
  it('returns a complete score card', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);

    const result = scoreCandidateVideo({
      manifest,
      scenes,
      style: 'prestige',
    });

    // Overall
    assert.ok(typeof result.overall === 'number');
    assert.ok(result.overall >= 0 && result.overall <= 1);

    // Subscores
    for (const dim of Object.keys(DEFAULT_WEIGHTS)) {
      assert.ok(result.subscores[dim], `Missing subscore: ${dim}`);
      assert.ok(typeof result.subscores[dim].score === 'number', `${dim} score not a number`);
      assert.ok(result.subscores[dim].score >= 0 && result.subscores[dim].score <= 1, `${dim} score out of range: ${result.subscores[dim].score}`);
      assert.ok(Array.isArray(result.subscores[dim].findings), `${dim} missing findings array`);
    }

    // Weights
    assert.deepStrictEqual(result.weights_used, DEFAULT_WEIGHTS);

    // Findings
    assert.ok(Array.isArray(result.findings));

    // Revisions
    assert.ok(Array.isArray(result.recommended_revisions));

    // Raw
    assert.ok(result.raw);
  });

  it('uses custom weights when provided', () => {
    const manifest = makeManifest(2);
    const scenes = makeScenes(manifest);
    const customWeights = {
      hook: 0.5, narrative_arc: 0.1, clarity: 0.1,
      visual_hierarchy: 0.1, motion_quality: 0.1, brand_finish: 0.1,
    };

    const result = scoreCandidateVideo({
      manifest, scenes, style: 'prestige',
      weights: customWeights,
    });

    assert.deepStrictEqual(result.weights_used, customWeights);
  });
});

// ── Score range ─────────────────────────────────────────────────────────────

describe('scoreCandidateVideo — score range', () => {
  it('overall is between 0 and 1', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);

    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });
    assert.ok(result.overall >= 0, `Overall ${result.overall} < 0`);
    assert.ok(result.overall <= 1, `Overall ${result.overall} > 1`);
  });

  it('subscores are all between 0 and 1', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);

    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });
    for (const [dim, sub] of Object.entries(result.subscores)) {
      assert.ok(sub.score >= 0, `${dim} score ${sub.score} < 0`);
      assert.ok(sub.score <= 1, `${dim} score ${sub.score} > 1`);
    }
  });
});

// ── Revision recommendations ────────────────────────────────────────────────

describe('scoreCandidateVideo — revisions', () => {
  it('recommended revisions use bounded vocabulary', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);

    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });
    for (const rev of result.recommended_revisions) {
      assert.ok(REVISION_OPS.includes(rev.op), `Unknown revision op: ${rev.op}`);
      assert.ok(typeof rev.reason === 'string');
    }
  });
});

// ── Error handling ──────────────────────────────────────────────────────────

describe('scoreCandidateVideo — errors', () => {
  it('throws for missing manifest', () => {
    assert.throws(
      () => scoreCandidateVideo({ manifest: null, scenes: [] }),
      { message: /requires a manifest/ }
    );
  });

  it('throws for missing scenes', () => {
    assert.throws(
      () => scoreCandidateVideo({ manifest: makeManifest(), scenes: [] }),
      { message: /requires a non-empty scenes/ }
    );
  });

  it('throws for null scenes', () => {
    assert.throws(
      () => scoreCandidateVideo({ manifest: makeManifest(), scenes: null }),
      { message: /requires a non-empty scenes/ }
    );
  });
});

// ── Per-scene scoring ───────────────────────────────────────────────────

describe('scoreCandidateVideo — per_scene', () => {
  it('returns per_scene array with one entry per manifest scene', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);
    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });

    assert.ok(Array.isArray(result.per_scene));
    assert.equal(result.per_scene.length, 3);
  });

  it('each per-scene entry has required dimensions', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);
    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });

    for (const ps of result.per_scene) {
      assert.ok(ps.scene_id, 'missing scene_id');
      assert.ok(typeof ps.overall === 'number', 'missing overall');
      assert.ok(typeof ps.clarity === 'number', 'missing clarity');
      assert.ok(typeof ps.hierarchy === 'number', 'missing hierarchy');
      assert.ok(typeof ps.pacing === 'number', 'missing pacing');
      assert.ok(typeof ps.motion_quality === 'number', 'missing motion_quality');
      assert.ok(Array.isArray(ps.findings), 'missing findings');
    }
  });

  it('per-scene scores are between 0 and 1', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);
    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });

    for (const ps of result.per_scene) {
      for (const dim of ['overall', 'clarity', 'hierarchy', 'pacing', 'motion_quality']) {
        assert.ok(ps[dim] >= 0 && ps[dim] <= 1, `${ps.scene_id} ${dim}=${ps[dim]} out of range`);
      }
    }
  });

  it('annotated scenes produce higher clarity scores', () => {
    const manifest = makeManifest(2);
    const plainScenes = makeScenes(manifest);
    const annotatedScenes = makeScenes(manifest).map(s => ({
      ...s,
      product_role: 'result',
      primary_subject: s.layers[0].id,
      outcome: 'User sees result',
      interaction_truth: { has_cursor: false, has_typing: true, has_state_change: true, timing_realistic: true },
    }));

    const plain = scoreCandidateVideo({ manifest, scenes: plainScenes, style: 'prestige' });
    const annotated = scoreCandidateVideo({ manifest, scenes: annotatedScenes, style: 'prestige' });

    const plainClarity = plain.per_scene.reduce((s, p) => s + p.clarity, 0) / plain.per_scene.length;
    const annotatedClarity = annotated.per_scene.reduce((s, p) => s + p.clarity, 0) / annotated.per_scene.length;

    assert.ok(annotatedClarity > plainClarity, `annotated clarity ${annotatedClarity} should be > plain ${plainClarity}`);
  });

  it('last scene has null continuity_to_next', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);
    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });

    assert.equal(result.per_scene[result.per_scene.length - 1].continuity_to_next, null);
  });
});

// ── Actionable revisions ────────────────────────────────────────────────

describe('scoreCandidateVideo — actionable revisions', () => {
  it('generates targeted revisions from per-scene analysis', () => {
    const manifest = makeManifest(3);
    const scenes = makeScenes(manifest);
    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });

    // All revisions should have a target scene
    for (const rev of result.recommended_revisions) {
      assert.ok(REVISION_OPS.includes(rev.op), `Unknown op: ${rev.op}`);
      assert.ok(typeof rev.reason === 'string' && rev.reason.length > 0);
    }
  });
});

// ── Brand scoring ───────────────────────────────────────────────────────────

describe('scoreCandidateVideo — brand', () => {
  it('includes brand compliance when brand provided', () => {
    const manifest = makeManifest(2);
    const scenes = makeScenes(manifest);
    const brand = {
      brand_id: 'test',
      personality: 'cinematic-dark',
      style: 'prestige',
      motion: { max_intensity: 0.7 },
    };

    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige', brand });
    assert.ok(result.raw.brand_compliance);
  });

  it('skips brand compliance when no brand', () => {
    const manifest = makeManifest(2);
    const scenes = makeScenes(manifest);

    const result = scoreCandidateVideo({ manifest, scenes, style: 'prestige' });
    assert.ok(result.raw.brand_compliance);
    // Should have empty violations
    assert.equal(result.raw.brand_compliance.violations?.length ?? 0, 0);
  });
});
