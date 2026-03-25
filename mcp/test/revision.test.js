/**
 * Tests for bounded manifest revision.
 *
 * One test per revision op plus edge cases.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { reviseCandidateVideo, REVISION_OPS } from '../lib/revision.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeManifest() {
  return {
    sequence_id: 'seq_test',
    scenes: [
      { scene: 'sc_01', duration_s: 3 },
      { scene: 'sc_02', duration_s: 4, transition_in: { type: 'crossfade', duration_ms: 400 } },
      { scene: 'sc_03', duration_s: 5, transition_in: { type: 'crossfade', duration_ms: 400 } },
    ],
  };
}

function makeScenes() {
  return [
    { scene_id: 'sc_01', layers: [{ id: 'ly_a', type: 'text', depth_class: 'hero' }, { id: 'ly_b', type: 'image', depth_class: 'background', entrance: { type: 'fade_in' } }] },
    { scene_id: 'sc_02', layers: [{ id: 'ly_c', type: 'text', depth_class: 'foreground' }] },
    { scene_id: 'sc_03', layers: [{ id: 'ly_d', type: 'image', depth_class: 'foreground' }] },
  ];
}

// ── trim ────────────────────────────────────────────────────────────────────

describe('revision — trim', () => {
  it('reduces scene duration by amount_s', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'trim', target: 'sc_02', amount_s: 1 }],
    });

    const entry = result.manifest.scenes.find(s => s.scene === 'sc_02');
    assert.equal(entry.duration_s, 3);
    assert.equal(result.diff.length, 1);
    assert.equal(result.diff[0].before, 4);
    assert.equal(result.diff[0].after, 3);
  });

  it('clamps to minimum 1s', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'trim', target: 'sc_01', amount_s: 10 }],
    });

    const entry = result.manifest.scenes.find(s => s.scene === 'sc_01');
    assert.equal(entry.duration_s, 1);
  });
});

// ── extend_hold ─────────────────────────────────────────────────────────────

describe('revision — extend_hold', () => {
  it('increases scene duration', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'extend_hold', target: 'sc_01', amount_s: 2 }],
    });

    const entry = result.manifest.scenes.find(s => s.scene === 'sc_01');
    assert.equal(entry.duration_s, 5);
  });

  it('clamps to max 30s', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'extend_hold', target: 'sc_01', amount_s: 100 }],
    });

    const entry = result.manifest.scenes.find(s => s.scene === 'sc_01');
    assert.equal(entry.duration_s, 30);
  });
});

// ── swap_transition ─────────────────────────────────────────────────────────

describe('revision — swap_transition', () => {
  it('replaces transition_in', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'swap_transition', target: 'sc_02', transition: { type: 'focus_dissolve', duration_ms: 500 } }],
    });

    const entry = result.manifest.scenes.find(s => s.scene === 'sc_02');
    assert.equal(entry.transition_in.type, 'focus_dissolve');
    assert.equal(entry.transition_in.duration_ms, 500);
  });
});

// ── reorder ─────────────────────────────────────────────────────────────────

describe('revision — reorder', () => {
  it('moves scene to new index', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'reorder', target: 'sc_03', new_index: 0 }],
    });

    assert.equal(result.manifest.scenes[0].scene, 'sc_03');
    // First scene should have no transition_in
    assert.equal(result.manifest.scenes[0].transition_in, null);
  });

  it('ensures second scene gets a transition_in', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'reorder', target: 'sc_03', new_index: 0 }],
    });

    assert.ok(result.manifest.scenes[1].transition_in);
  });
});

// ── boost_hierarchy ─────────────────────────────────────────────────────────

describe('revision — boost_hierarchy', () => {
  it('promotes a layer to hero product_role and clarity_weight 5', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'boost_hierarchy', target: 'sc_02', layer: 'ly_c' }],
    });

    const scene = result.scenes.find(s => s.scene_id === 'sc_02');
    const layer = scene.layers.find(l => l.id === 'ly_c');
    assert.equal(layer.product_role, 'hero');
    assert.equal(layer.clarity_weight, 5);
    assert.equal(scene.primary_subject, 'ly_c');
  });

  it('picks first non-hero/non-background layer when layer not specified', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'boost_hierarchy', target: 'sc_03' }],
    });

    // sc_03 has ly_d (foreground) — should be promoted to hero
    const scene = result.scenes.find(s => s.scene_id === 'sc_03');
    const promoted = scene.layers.find(l => l.id === 'ly_d');
    assert.equal(promoted.product_role, 'hero');
  });
});

// ── compress ────────────────────────────────────────────────────────────────

describe('revision — compress', () => {
  it('sets scene to target duration', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'compress', target: 'sc_03', target_s: 2 }],
    });

    const entry = result.manifest.scenes.find(s => s.scene === 'sc_03');
    assert.equal(entry.duration_s, 2);
  });
});

// ── add_continuity ──────────────────────────────────────────────────────────

describe('revision — add_continuity', () => {
  it('adds match config to transition_in', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'add_continuity', from_scene: 'sc_01', to_scene: 'sc_02', strategy: 'position' }],
    });

    const entry = result.manifest.scenes.find(s => s.scene === 'sc_02');
    assert.ok(entry.transition_in.match);
    assert.equal(entry.transition_in.match.strategy, 'position');
    assert.ok(entry.transition_in.match.source_continuity_id);
  });

  it('tags hero/foreground layers with continuity_id, not background', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'add_continuity', from_scene: 'sc_01', to_scene: 'sc_02', strategy: 'scale' }],
    });

    const fromScene = result.scenes.find(s => s.scene_id === 'sc_01');
    const toScene = result.scenes.find(s => s.scene_id === 'sc_02');

    // Should tag hero (ly_a) not background (ly_b) in sc_01
    const taggedFrom = fromScene.layers.find(l => l.continuity_id);
    assert.ok(taggedFrom, 'should tag a layer in from scene');
    assert.notEqual(taggedFrom.depth_class, 'background', 'should not tag background layer');

    // Should tag foreground layer in sc_02
    const taggedTo = toScene.layers.find(l => l.continuity_id);
    assert.ok(taggedTo, 'should tag a layer in to scene');
  });
});

// ── adjust_density ──────────────────────────────────────────────────────────

describe('revision — adjust_density', () => {
  it('sets target_density metadata', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'adjust_density', target: 'sc_01', target_density: 'sparse' }],
    });

    const scene = result.scenes.find(s => s.scene_id === 'sc_01');
    assert.equal(scene.metadata.target_density, 'sparse');
  });

  it('removes background entrances for sparse density', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [{ op: 'adjust_density', target: 'sc_01', target_density: 'sparse' }],
    });

    const scene = result.scenes.find(s => s.scene_id === 'sc_01');
    const bg = scene.layers.find(l => l.depth_class === 'background');
    assert.equal(bg.entrance.type, 'none');
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('revision — edge cases', () => {
  it('throws for unknown op', () => {
    assert.throws(
      () => reviseCandidateVideo({
        manifest: makeManifest(),
        scenes: makeScenes(),
        revisions: [{ op: 'explode' }],
      }),
      { message: /Unknown revision op/ }
    );
  });

  it('throws for empty revisions', () => {
    assert.throws(
      () => reviseCandidateVideo({ manifest: makeManifest(), scenes: makeScenes(), revisions: [] }),
      { message: /non-empty revisions/ }
    );
  });

  it('does not mutate original manifest', () => {
    const manifest = makeManifest();
    const original = manifest.scenes[0].duration_s;

    reviseCandidateVideo({
      manifest,
      scenes: makeScenes(),
      revisions: [{ op: 'trim', target: 'sc_01', amount_s: 1 }],
    });

    assert.equal(manifest.scenes[0].duration_s, original);
  });

  it('applies multiple revisions sequentially', () => {
    const result = reviseCandidateVideo({
      manifest: makeManifest(),
      scenes: makeScenes(),
      revisions: [
        { op: 'trim', target: 'sc_01', amount_s: 1 },
        { op: 'swap_transition', target: 'sc_02', transition: { type: 'whip_left', duration_ms: 250 } },
      ],
    });

    assert.equal(result.revision_count, 2);
    assert.equal(result.manifest.scenes[0].duration_s, 2);
    assert.equal(result.manifest.scenes[1].transition_in.type, 'whip_left');
  });

  it('exports all valid ops', () => {
    assert.equal(REVISION_OPS.length, 9);
    assert.ok(REVISION_OPS.includes('trim'));
    assert.ok(REVISION_OPS.includes('add_continuity'));
  });
});
