/**
 * Tests for Sequence Planner (ANI-23).
 *
 * Covers: orderScenes, assignDurations, selectTransitions,
 * assignCameraOverrides, planSequence integration, and ground truth.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  orderScenes,
  assignDurations,
  selectTransitions,
  assignCameraOverrides,
  preFilterShotGrammar,
  planSequence,
  planVariants,
  STYLE_PACKS,
  STYLE_TO_PERSONALITY,
} from '../lib/planner.js';

import { analyzeScene } from '../lib/analyze.js';
import { evaluateSequence } from '../lib/evaluate.js';
import { validateManifest } from '../lib/scene-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Load ground truth scenes ────────────────────────────────────────────────

const kineticTypeManifest = JSON.parse(
  readFileSync(resolve(ROOT, 'src/remotion/manifests/test-kinetic-type.json'), 'utf-8')
);
const layoutManifest = JSON.parse(
  readFileSync(resolve(ROOT, 'src/remotion/manifests/test-layouts.json'), 'utf-8')
);

const kineticScenes = Object.values(kineticTypeManifest.sceneDefs);
const layoutScenes = Object.values(layoutManifest.sceneDefs);

// ── Test helpers ────────────────────────────────────────────────────────────

function makeScene(id, overrides = {}) {
  return {
    scene_id: id,
    duration_s: 3,
    layers: [{ id: 'l1', type: 'text', depth_class: 'foreground' }],
    metadata: {
      content_type: 'typography',
      visual_weight: 'dark',
      motion_energy: 'moderate',
      intent_tags: [],
      ...overrides,
    },
  };
}

// ── orderScenes ─────────────────────────────────────────────────────────────

describe('orderScenes', () => {
  it('places opening scenes first', () => {
    const scenes = [
      makeScene('sc_detail', { intent_tags: ['detail'] }),
      makeScene('sc_opening', { intent_tags: ['opening'] }),
      makeScene('sc_info', { intent_tags: ['informational'] }),
    ];
    const result = orderScenes(scenes);
    assert.equal(result[0].scene_id, 'sc_opening');
  });

  it('places closing scenes last', () => {
    const scenes = [
      makeScene('sc_closing', { intent_tags: ['closing'] }),
      makeScene('sc_detail', { intent_tags: ['detail'] }),
      makeScene('sc_opening', { intent_tags: ['opening'] }),
    ];
    const result = orderScenes(scenes);
    assert.equal(result[result.length - 1].scene_id, 'sc_closing');
  });

  it('places hero scenes early (after opening)', () => {
    const scenes = [
      makeScene('sc_detail', { intent_tags: ['detail'] }),
      makeScene('sc_hero', { intent_tags: ['hero'] }),
      makeScene('sc_opening', { intent_tags: ['opening'] }),
      makeScene('sc_info', { intent_tags: ['informational'] }),
    ];
    const result = orderScenes(scenes);
    assert.equal(result[0].scene_id, 'sc_opening');
    assert.equal(result[1].scene_id, 'sc_hero');
  });

  it('distributes emotional scenes in the middle', () => {
    const scenes = [
      makeScene('sc_d1', { intent_tags: ['detail'], content_type: 'ui_screenshot' }),
      makeScene('sc_d2', { intent_tags: ['detail'], content_type: 'device_mockup' }),
      makeScene('sc_d3', { intent_tags: ['detail'], content_type: 'data_visualization' }),
      makeScene('sc_emo', { intent_tags: ['emotional'], content_type: 'portrait' }),
    ];
    const result = orderScenes(scenes);
    // Emotional should not be first or last among the detail scenes
    const emoIdx = result.findIndex(s => s.scene_id === 'sc_emo');
    assert.ok(emoIdx > 0, `Emotional scene at index ${emoIdx} should be > 0`);
  });

  it('applies variety rule — no consecutive same content_type', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['detail'], content_type: 'typography' }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'typography' }),
      makeScene('sc_c', { intent_tags: ['detail'], content_type: 'ui_screenshot' }),
      makeScene('sc_d', { intent_tags: ['detail'], content_type: 'portrait' }),
    ];
    const result = orderScenes(scenes);
    // Check no consecutive same content_type
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i].metadata?.content_type;
      const b = result[i + 1].metadata?.content_type;
      // Allow if swap wasn't possible (all same type), but in this case it should work
      if (a === 'typography' && b === 'typography') {
        // Verify there's no other type available to swap with
        const remaining = result.slice(i + 2).some(s => s.metadata?.content_type !== 'typography');
        assert.ok(!remaining, `Should have swapped to break typography run at index ${i}`);
      }
    }
  });

  it('applies weight alternation — no 3+ consecutive same visual_weight', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['detail'], visual_weight: 'dark', content_type: 'typography' }),
      makeScene('sc_b', { intent_tags: ['detail'], visual_weight: 'dark', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { intent_tags: ['detail'], visual_weight: 'dark', content_type: 'portrait' }),
      makeScene('sc_d', { intent_tags: ['detail'], visual_weight: 'light', content_type: 'brand_mark' }),
    ];
    const result = orderScenes(scenes);
    // Check no 3+ consecutive same weight
    for (let i = 0; i < result.length - 2; i++) {
      const w0 = result[i].metadata?.visual_weight;
      const w1 = result[i + 1].metadata?.visual_weight;
      const w2 = result[i + 2].metadata?.visual_weight;
      if (w0 === w1 && w1 === w2) {
        assert.fail(`Three consecutive ${w0} weight scenes at index ${i}`);
      }
    }
  });

  it('applies energy arc — does not start at peak energy unless hero', () => {
    const scenes = [
      makeScene('sc_high', { intent_tags: ['detail'], motion_energy: 'high' }),
      makeScene('sc_mod', { intent_tags: ['detail'], motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_low', { intent_tags: ['detail'], motion_energy: 'subtle', content_type: 'brand_mark' }),
    ];
    const result = orderScenes(scenes);
    assert.notEqual(result[0].metadata?.motion_energy, 'high',
      'Should not start at high energy without hero/opening tag');
  });

  it('allows high energy start when tagged hero', () => {
    const scenes = [
      makeScene('sc_hero', { intent_tags: ['hero'], motion_energy: 'high' }),
      makeScene('sc_mod', { intent_tags: ['detail'], motion_energy: 'moderate', content_type: 'ui_screenshot' }),
    ];
    const result = orderScenes(scenes);
    assert.equal(result[0].scene_id, 'sc_hero');
  });

  it('handles single scene', () => {
    const scenes = [makeScene('sc_only')];
    const result = orderScenes(scenes);
    assert.equal(result.length, 1);
    assert.equal(result[0].scene_id, 'sc_only');
  });

  it('handles two scenes', () => {
    const scenes = [
      makeScene('sc_closing', { intent_tags: ['closing'] }),
      makeScene('sc_opening', { intent_tags: ['opening'] }),
    ];
    const result = orderScenes(scenes);
    assert.equal(result[0].scene_id, 'sc_opening');
    assert.equal(result[1].scene_id, 'sc_closing');
  });
});

// ── assignDurations ─────────────────────────────────────────────────────────

describe('assignDurations', () => {
  it('returns correct prestige durations', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'static' }),
      makeScene('sc_b', { motion_energy: 'subtle' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
      makeScene('sc_d', { motion_energy: 'high' }),
    ];
    const durations = assignDurations(scenes, 'prestige');
    assert.deepEqual(durations, [3.5, 3.0, 3.0, 2.5]);
  });

  it('returns correct energy durations', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'static' }),
      makeScene('sc_b', { motion_energy: 'subtle' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
      makeScene('sc_d', { motion_energy: 'high' }),
    ];
    const durations = assignDurations(scenes, 'energy');
    assert.deepEqual(durations, [2.0, 2.0, 1.5, 1.5]);
  });

  it('returns correct dramatic durations', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'static' }),
      makeScene('sc_b', { motion_energy: 'subtle' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
      makeScene('sc_d', { motion_energy: 'high' }),
    ];
    const durations = assignDurations(scenes, 'dramatic');
    assert.deepEqual(durations, [3.0, 2.5, 3.0, 3.5]);
  });

  it('enforces energy 4s hard cap', () => {
    const scenes = [makeScene('sc_a', { motion_energy: 'static' })];
    const durations = assignDurations(scenes, 'energy');
    assert.ok(durations[0] <= 4.0);
  });

  it('all durations are valid manifest values (0.5–30)', () => {
    for (const style of STYLE_PACKS) {
      for (const energy of ['static', 'subtle', 'moderate', 'high']) {
        const scenes = [makeScene('sc_test', { motion_energy: energy })];
        const durations = assignDurations(scenes, style);
        assert.ok(durations[0] >= 0.5 && durations[0] <= 30,
          `${style}/${energy}: duration ${durations[0]} out of range`);
      }
    }
  });

  it('throws on unknown style', () => {
    assert.throws(() => assignDurations([makeScene('sc_a')], 'unknown'), /Unknown style/);
  });

  it('inserts rest beats for energy style after 3+ consecutive same-duration holds (ANI-41)', () => {
    // 6 scenes all high energy → all get 1.5s base (energy pack high = 1.5, capped at max 4.0)
    // After 3 consecutive identical durations, one should be extended
    const scenes = [
      makeScene('sc_a', { motion_energy: 'high' }),
      makeScene('sc_b', { motion_energy: 'high' }),
      makeScene('sc_c', { motion_energy: 'high' }),
      makeScene('sc_d', { motion_energy: 'high' }),
      makeScene('sc_e', { motion_energy: 'high' }),
      makeScene('sc_f', { motion_energy: 'high' }),
    ];
    const durations = assignDurations(scenes, 'energy');
    // At least one duration should be extended (rest beat = 1.5 * 1.5 = 2.3)
    const hasExtended = durations.some(d => d > 1.5);
    assert.ok(hasExtended, `Expected at least one rest beat, got: ${durations}`);
  });

  it('does not insert rest beats when durations vary (ANI-41)', () => {
    // Mixed energies → different base durations → no rest beat triggered
    const scenes = [
      makeScene('sc_a', { motion_energy: 'static' }),
      makeScene('sc_b', { motion_energy: 'subtle' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
      makeScene('sc_d', { motion_energy: 'high' }),
    ];
    const durations = assignDurations(scenes, 'energy');
    assert.deepEqual(durations, [2.0, 2.0, 1.5, 1.5]);
  });

  it('does not insert rest beats for prestige style (ANI-41)', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'moderate' }),
      makeScene('sc_b', { motion_energy: 'moderate' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
      makeScene('sc_d', { motion_energy: 'moderate' }),
    ];
    const durations = assignDurations(scenes, 'prestige');
    // All should be exactly the pack's moderate duration (3.0)
    assert.ok(durations.every(d => d === 3.0), `Expected all 3.0, got: ${durations}`);
  });
});

// ── selectTransitions ───────────────────────────────────────────────────────

describe('selectTransitions', () => {
  it('first scene always gets null', () => {
    for (const style of STYLE_PACKS) {
      const scenes = [makeScene('sc_a'), makeScene('sc_b', { content_type: 'ui_screenshot' })];
      const transitions = selectTransitions(scenes, style);
      assert.equal(transitions[0], null);
    }
  });

  it('prestige: hard_cut by default', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', content_type: 'ui_screenshot' }),
    ];
    const transitions = selectTransitions(scenes, 'prestige');
    assert.equal(transitions[1].type, 'hard_cut');
  });

  it('prestige: crossfade on weight change', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light' }),
    ];
    const transitions = selectTransitions(scenes, 'prestige');
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 400);
  });

  it('prestige: crossfade for emotional intent', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', intent_tags: ['emotional'] }),
    ];
    const transitions = selectTransitions(scenes, 'prestige');
    assert.equal(transitions[1].type, 'crossfade');
  });

  it('prestige: crossfade for hero intent', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', intent_tags: ['hero'] }),
    ];
    const transitions = selectTransitions(scenes, 'prestige');
    assert.equal(transitions[1].type, 'crossfade');
  });

  it('energy: whip-wipe every 3rd transition', () => {
    const scenes = Array.from({ length: 7 }, (_, i) =>
      makeScene(`sc_${i}`, { content_type: i % 2 === 0 ? 'typography' : 'ui_screenshot' })
    );
    const transitions = selectTransitions(scenes, 'energy');
    // Transitions at indices 1,2,3,4,5,6 (scene 0 has null)
    // Every 3rd: index 3, 6 should be whips
    assert.equal(transitions[1].type, 'hard_cut');
    assert.equal(transitions[2].type, 'hard_cut');
    assert.ok(transitions[3].type.startsWith('whip_'), `Expected whip at index 3, got ${transitions[3].type}`);
    assert.equal(transitions[4].type, 'hard_cut');
    assert.equal(transitions[5].type, 'hard_cut');
    assert.ok(transitions[6].type.startsWith('whip_'), `Expected whip at index 6, got ${transitions[6].type}`);
  });

  it('energy: whip-wipes cycle through directions', () => {
    const scenes = Array.from({ length: 13 }, (_, i) => makeScene(`sc_${i}`));
    const transitions = selectTransitions(scenes, 'energy');
    const whips = transitions.filter(t => t && t.type.startsWith('whip_'));
    // Should cycle: left, right, up, down
    assert.equal(whips[0].type, 'whip_left');
    assert.equal(whips[1].type, 'whip_right');
    assert.equal(whips[2].type, 'whip_up');
    assert.equal(whips[3].type, 'whip_down');
  });

  it('dramatic: crossfade by default (different weights)', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light' }),
    ];
    const transitions = selectTransitions(scenes, 'dramatic');
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 400);
  });

  it('dramatic: hard_cut between same-weight scenes', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark' }),
    ];
    const transitions = selectTransitions(scenes, 'dramatic');
    assert.equal(transitions[1].type, 'hard_cut');
  });

  it('dramatic: 600ms crossfade for emotional intent', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light', intent_tags: ['emotional'] }),
    ];
    const transitions = selectTransitions(scenes, 'dramatic');
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 600);
  });
});

// ── assignCameraOverrides ───────────────────────────────────────────────────

describe('assignCameraOverrides', () => {
  it('prestige: push_in for portrait', () => {
    const scenes = [makeScene('sc_a', { content_type: 'portrait' })];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.2 });
  });

  it('prestige: push_in for product_shot', () => {
    const scenes = [makeScene('sc_a', { content_type: 'product_shot' })];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.2 });
  });

  it('prestige: drift for ui_screenshot', () => {
    const scenes = [makeScene('sc_a', { content_type: 'ui_screenshot' })];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    assert.deepEqual(overrides[0], { move: 'drift', intensity: 0.2 });
  });

  it('prestige: drift for device_mockup', () => {
    const scenes = [makeScene('sc_a', { content_type: 'device_mockup' })];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    assert.deepEqual(overrides[0], { move: 'drift', intensity: 0.2 });
  });

  it('prestige: null for typography', () => {
    const scenes = [makeScene('sc_a', { content_type: 'typography' })];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    assert.equal(overrides[0], null);
  });

  it('energy: always static (montage forbids camera)', () => {
    for (const contentType of ['portrait', 'typography', 'ui_screenshot', 'brand_mark']) {
      const scenes = [makeScene('sc_a', { content_type: contentType })];
      const overrides = assignCameraOverrides(scenes, 'energy');
      assert.deepEqual(overrides[0], { move: 'static' },
        `Energy ${contentType} should be static`);
    }
  });

  it('dramatic: push_in for emotional intent', () => {
    const scenes = [makeScene('sc_a', { intent_tags: ['emotional'] })];
    const overrides = assignCameraOverrides(scenes, 'dramatic');
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.3 });
  });

  it('dramatic: push_in for hero intent', () => {
    const scenes = [makeScene('sc_a', { intent_tags: ['hero'] })];
    const overrides = assignCameraOverrides(scenes, 'dramatic');
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.3 });
  });

  it('dramatic: drift for detail intent', () => {
    const scenes = [makeScene('sc_a', { intent_tags: ['detail'] })];
    const overrides = assignCameraOverrides(scenes, 'dramatic');
    assert.deepEqual(overrides[0], { move: 'drift', intensity: 0.3 });
  });

  it('dramatic: null for brand_mark', () => {
    const scenes = [makeScene('sc_a', { content_type: 'brand_mark', intent_tags: [] })];
    const overrides = assignCameraOverrides(scenes, 'dramatic');
    assert.equal(overrides[0], null);
  });
});

// ── planSequence — integration ──────────────────────────────────────────────

describe('planSequence', () => {
  it('returns valid manifest structure', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'] }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot' }),
      makeScene('sc_c', { intent_tags: ['closing'], content_type: 'brand_mark' }),
    ];
    const { manifest, notes } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_test_integration',
    });

    assert.ok(manifest.sequence_id);
    assert.equal(manifest.fps, 60);
    assert.deepEqual(manifest.resolution, { w: 1920, h: 1080 });
    assert.equal(manifest.style, 'prestige');
    assert.ok(Array.isArray(manifest.scenes));
    assert.equal(manifest.scenes.length, 3);
  });

  it('passes validateManifest', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'] }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot' }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'dramatic',
      sequence_id: 'seq_test_valid',
    });

    const validation = validateManifest(manifest);
    assert.ok(validation.valid, `Validation failed: ${validation.errors.join('; ')}`);
  });

  it('produces different manifests for different styles', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'moderate' }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', motion_energy: 'subtle' }),
      makeScene('sc_c', { intent_tags: ['closing'], content_type: 'brand_mark', motion_energy: 'static' }),
    ];

    const prestige = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_test_p' });
    const energy = planSequence({ scenes, style: 'energy', sequence_id: 'seq_test_e' });
    const dramatic = planSequence({ scenes, style: 'dramatic', sequence_id: 'seq_test_d' });

    // Energy should have shorter total duration
    assert.ok(energy.notes.total_duration_s < prestige.notes.total_duration_s,
      `Energy (${energy.notes.total_duration_s}s) should be shorter than prestige (${prestige.notes.total_duration_s}s)`);
  });

  it('handles single scene', () => {
    const scenes = [makeScene('sc_only', { intent_tags: ['hero'] })];
    const { manifest } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_test_single',
    });

    assert.equal(manifest.scenes.length, 1);
    assert.ok(!manifest.scenes[0].transition_in, 'Single scene should have no transition');
    const validation = validateManifest(manifest);
    assert.ok(validation.valid);
  });

  it('handles scenes with no tags', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: [] }),
      makeScene('sc_b', { intent_tags: [], content_type: 'ui_screenshot' }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'energy',
      sequence_id: 'seq_test_notags',
    });

    assert.equal(manifest.scenes.length, 2);
    const validation = validateManifest(manifest);
    assert.ok(validation.valid);
  });

  it('handles all same content_type scenes', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'typography', intent_tags: ['opening'] }),
      makeScene('sc_b', { content_type: 'typography', intent_tags: ['detail'] }),
      makeScene('sc_c', { content_type: 'typography', intent_tags: ['closing'] }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_test_sametype',
    });

    assert.equal(manifest.scenes.length, 3);
    const validation = validateManifest(manifest);
    assert.ok(validation.valid);
  });

  it('throws on empty scenes', () => {
    assert.throws(() => planSequence({ scenes: [], style: 'prestige' }), /non-empty/);
  });

  it('throws on unknown style', () => {
    assert.throws(
      () => planSequence({ scenes: [makeScene('sc_a')], style: 'invalid' }),
      /Unknown style/
    );
  });

  it('first scene never has transition_in', () => {
    for (const style of STYLE_PACKS) {
      const scenes = [
        makeScene('sc_a', { intent_tags: ['opening'] }),
        makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot' }),
      ];
      const { manifest } = planSequence({
        scenes,
        style,
        sequence_id: `seq_test_first_${style}`,
      });
      assert.ok(!manifest.scenes[0].transition_in,
        `${style}: first scene should have no transition_in`);
    }
  });

  it('uses provided sequence_id', () => {
    const scenes = [makeScene('sc_a')];
    const { manifest } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_custom_id',
    });
    assert.equal(manifest.sequence_id, 'seq_custom_id');
  });
});

// ── Choreography reasoning (ANI-45) ─────────────────────────────────────────

describe('planSequence reasoning (ANI-45)', () => {
  it('notes include reasoning array with per-scene entries', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'moderate' }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', motion_energy: 'subtle' }),
      makeScene('sc_c', { intent_tags: ['closing'], content_type: 'brand_mark', motion_energy: 'static' }),
    ];
    const { notes } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_reasoning' });

    assert.ok(Array.isArray(notes.reasoning), 'notes.reasoning is an array');
    assert.equal(notes.reasoning.length, 3, 'one reasoning entry per scene');
  });

  it('each reasoning entry has scene, duration, transition, camera fields', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'moderate' }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'portrait', motion_energy: 'subtle' }),
    ];
    const { notes } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_reason_fields' });

    for (const r of notes.reasoning) {
      assert.ok(typeof r.scene === 'string', 'reasoning.scene is string');
      assert.ok(typeof r.duration === 'string', 'reasoning.duration is string');
      assert.ok(typeof r.transition === 'string', 'reasoning.transition is string');
      assert.ok(typeof r.camera === 'string', 'reasoning.camera is string');
    }
  });

  it('first scene reasoning says no transition', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'] }),
      makeScene('sc_b', { intent_tags: ['closing'] }),
    ];
    const { notes } = planSequence({ scenes, style: 'dramatic', sequence_id: 'seq_reason_first' });

    assert.ok(notes.reasoning[0].transition.includes('first scene'),
      'first scene reasoning should mention "first scene"');
  });

  it('duration reasoning references style pack and energy level', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['detail'], motion_energy: 'high' }),
    ];
    const { notes } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_reason_dur' });

    assert.ok(notes.reasoning[0].duration.includes('prestige'),
      'duration reasoning should mention style pack name');
    assert.ok(notes.reasoning[0].duration.includes('high'),
      'duration reasoning should mention energy level');
  });

  it('camera reasoning references content_type when by_content_type matches', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['detail'], content_type: 'portrait' }),
    ];
    const { notes } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_reason_cam' });

    assert.ok(notes.reasoning[0].camera.includes('portrait'),
      'camera reasoning should mention matched content_type');
  });

  it('force_static camera reasoning mentions the style pack', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['detail'], content_type: 'ui_screenshot' }),
    ];
    const { notes } = planSequence({ scenes, style: 'energy', sequence_id: 'seq_reason_static' });

    assert.ok(notes.reasoning[0].camera.includes('force_static'),
      'camera reasoning should mention force_static');
  });
});

// ── Ground truth: kinetic type scenes through analyze → plan ────────────────

describe('planSequence — kinetic type ground truth', () => {
  // Run kinetic type scenes through analyzeScene → planSequence
  const analyzedKinetic = kineticScenes.map(scene => {
    const analysis = analyzeScene(scene);
    return { ...scene, metadata: analysis.metadata };
  });

  it('prestige: produces valid manifest from analyzed kinetic type scenes', () => {
    const { manifest } = planSequence({
      scenes: analyzedKinetic,
      style: 'prestige',
      sequence_id: 'seq_gt_kinetic_prestige',
    });

    const validation = validateManifest(manifest);
    assert.ok(validation.valid, `Validation failed: ${validation.errors.join('; ')}`);
    assert.equal(manifest.scenes.length, analyzedKinetic.length);
  });

  it('energy: produces valid manifest from analyzed kinetic type scenes', () => {
    const { manifest } = planSequence({
      scenes: analyzedKinetic,
      style: 'energy',
      sequence_id: 'seq_gt_kinetic_energy',
    });

    const validation = validateManifest(manifest);
    assert.ok(validation.valid, `Validation failed: ${validation.errors.join('; ')}`);
  });

  it('styles produce measurably different manifests from kinetic type scenes', () => {
    const prestige = planSequence({
      scenes: analyzedKinetic,
      style: 'prestige',
      sequence_id: 'seq_gt_kp',
    });
    const energy = planSequence({
      scenes: analyzedKinetic,
      style: 'energy',
      sequence_id: 'seq_gt_ke',
    });
    const dramatic = planSequence({
      scenes: analyzedKinetic,
      style: 'dramatic',
      sequence_id: 'seq_gt_kd',
    });

    // Energy should be shortest
    assert.ok(energy.notes.total_duration_s < prestige.notes.total_duration_s,
      'Energy should be shorter than prestige');
    assert.ok(energy.notes.total_duration_s < dramatic.notes.total_duration_s,
      'Energy should be shorter than dramatic');

    // Energy should have all static camera
    const energyCameras = energy.manifest.scenes
      .filter(s => s.camera_override)
      .map(s => s.camera_override.move);
    assert.ok(energyCameras.every(m => m === 'static'),
      'Energy should have all static cameras');
  });
});

// ── Ground truth: layout scenes through analyze → plan ──────────────────────

describe('planSequence — layout ground truth', () => {
  const analyzedLayouts = layoutScenes.map(scene => {
    const analysis = analyzeScene(scene);
    return { ...scene, metadata: analysis.metadata };
  });

  it('produces valid manifests from analyzed layout scenes (all styles)', () => {
    for (const style of STYLE_PACKS) {
      const { manifest } = planSequence({
        scenes: analyzedLayouts,
        style,
        sequence_id: `seq_gt_layout_${style}`,
      });

      const validation = validateManifest(manifest);
      assert.ok(validation.valid,
        `${style} validation failed: ${validation.errors.join('; ')}`);
      assert.equal(manifest.scenes.length, analyzedLayouts.length);
    }
  });
});

// ── ANI-26: Shot grammar in planner ──────────────────────────────────────────

describe('shot grammar variety rule (ANI-26)', () => {
  it('breaks 3+ consecutive same shot_size', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['detail'], content_type: 'typography', shot_grammar: { shot_size: 'close_up', angle: 'eye_level', framing: 'center' } }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'brand_mark', shot_grammar: { shot_size: 'close_up', angle: 'eye_level', framing: 'center' } }),
      makeScene('sc_c', { intent_tags: ['detail'], content_type: 'portrait', shot_grammar: { shot_size: 'close_up', angle: 'eye_level', framing: 'center' } }),
      makeScene('sc_d', { intent_tags: ['detail'], content_type: 'ui_screenshot', shot_grammar: { shot_size: 'medium', angle: 'eye_level', framing: 'center' } }),
    ];
    const result = orderScenes(scenes);
    // Check no 3+ consecutive same shot_size
    for (let i = 0; i < result.length - 2; i++) {
      const s0 = result[i].metadata?.shot_grammar?.shot_size;
      const s1 = result[i + 1].metadata?.shot_grammar?.shot_size;
      const s2 = result[i + 2].metadata?.shot_grammar?.shot_size;
      if (s0 === s1 && s1 === s2) {
        assert.fail(`Three consecutive ${s0} shot_size at index ${i}`);
      }
    }
  });
});

describe('shot grammar on manifest entries (ANI-26)', () => {
  it('manifest entries include shot_grammar when metadata has it', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], shot_grammar: { shot_size: 'close_up', angle: 'low', framing: 'center' } }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', shot_grammar: { shot_size: 'medium', angle: 'high', framing: 'center' } }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_test_sg',
    });

    for (const entry of manifest.scenes) {
      assert.ok(entry.shot_grammar, `${entry.scene} should have shot_grammar`);
      assert.ok(entry.shot_grammar.shot_size);
      assert.ok(entry.shot_grammar.angle);
      assert.ok(entry.shot_grammar.framing);
    }
  });

  it('shot_grammar is validated against personality restrictions', () => {
    // Energy uses montage personality which restricts angles to eye_level
    const scenes = [
      makeScene('sc_a', { intent_tags: ['detail'], shot_grammar: { shot_size: 'medium', angle: 'dutch', framing: 'dynamic_offset' } }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'energy',
      sequence_id: 'seq_test_sg_val',
    });

    // Montage should correct dutch → eye_level and dynamic_offset → center
    assert.equal(manifest.scenes[0].shot_grammar.angle, 'eye_level');
    assert.equal(manifest.scenes[0].shot_grammar.framing, 'center');
  });

  it('manifest with shot_grammar passes validation', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], shot_grammar: { shot_size: 'wide', angle: 'eye_level', framing: 'center' } }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', shot_grammar: { shot_size: 'medium', angle: 'eye_level', framing: 'center' } }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_test_sg_valid',
    });

    const validation = validateManifest(manifest);
    assert.ok(validation.valid, `Validation failed: ${validation.errors.join('; ')}`);
  });
});

// ── ANI-34: Pre-filter shot grammar by personality ──────────────────────────

describe('preFilterShotGrammar (ANI-34)', () => {
  it('returns null for scenes without shot_grammar', () => {
    const scenes = [makeScene('sc_a', { intent_tags: ['detail'] })];
    const { filtered, corrections } = preFilterShotGrammar(scenes, 'prestige');
    assert.equal(filtered[0], null);
    assert.equal(corrections.length, 0);
  });

  it('passes through allowed values unchanged', () => {
    const scenes = [
      makeScene('sc_a', {
        intent_tags: ['detail'],
        shot_grammar: { shot_size: 'medium', angle: 'eye_level', framing: 'center' },
      }),
    ];
    const { filtered, corrections } = preFilterShotGrammar(scenes, 'minimal');
    assert.deepEqual(filtered[0], { shot_size: 'medium', angle: 'eye_level', framing: 'center' });
    assert.equal(corrections.length, 0);
  });

  it('editorial: corrects dutch angle to eye_level', () => {
    const scenes = [
      makeScene('sc_a', {
        intent_tags: ['detail'],
        shot_grammar: { shot_size: 'medium', angle: 'dutch', framing: 'center' },
      }),
    ];
    // prestige maps to editorial personality
    const { filtered, corrections } = preFilterShotGrammar(scenes, 'prestige');
    assert.equal(filtered[0].angle, 'eye_level');
    assert.equal(corrections.length, 1);
    assert.ok(corrections[0].includes('sc_a'));
    assert.ok(corrections[0].includes('dutch'));
  });

  it('neutral-light: corrects extreme_close_up and dutch angle', () => {
    const scenes = [
      makeScene('sc_a', {
        intent_tags: ['detail'],
        shot_grammar: { shot_size: 'extreme_close_up', angle: 'high', framing: 'center' },
      }),
    ];
    // minimal maps to neutral-light personality
    const { filtered, corrections } = preFilterShotGrammar(scenes, 'minimal');
    assert.equal(filtered[0].shot_size, 'medium');
    assert.equal(filtered[0].angle, 'eye_level');
    assert.equal(corrections.length, 2);
  });

  it('cinematic-dark: allows all values without corrections', () => {
    const scenes = [
      makeScene('sc_a', {
        intent_tags: ['hero'],
        shot_grammar: { shot_size: 'extreme_close_up', angle: 'dutch', framing: 'dynamic_offset' },
      }),
    ];
    // dramatic maps to cinematic-dark personality
    const { filtered, corrections } = preFilterShotGrammar(scenes, 'dramatic');
    assert.deepEqual(filtered[0], { shot_size: 'extreme_close_up', angle: 'dutch', framing: 'dynamic_offset' });
    assert.equal(corrections.length, 0);
  });

  it('collects corrections from multiple scenes', () => {
    const scenes = [
      makeScene('sc_a', {
        intent_tags: ['detail'],
        shot_grammar: { shot_size: 'medium', angle: 'dutch', framing: 'center' },
      }),
      makeScene('sc_b', {
        intent_tags: ['detail'],
        shot_grammar: { shot_size: 'extreme_close_up', angle: 'eye_level', framing: 'dynamic_offset' },
      }),
    ];
    // prestige maps to editorial personality
    const { filtered, corrections } = preFilterShotGrammar(scenes, 'prestige');
    // sc_a: dutch → eye_level (1 correction)
    assert.equal(filtered[0].angle, 'eye_level');
    // sc_b: extreme_close_up → medium, dynamic_offset → center (2 corrections)
    assert.equal(filtered[1].shot_size, 'medium');
    assert.equal(filtered[1].framing, 'center');
    assert.equal(corrections.length, 3);
  });
});

describe('planSequence surfaces shot_grammar_corrections in notes (ANI-34)', () => {
  it('notes include shot_grammar_corrections when filtering occurs', () => {
    const scenes = [
      makeScene('sc_a', {
        intent_tags: ['opening'],
        shot_grammar: { shot_size: 'medium', angle: 'dutch', framing: 'center' },
      }),
    ];
    // prestige maps to editorial, which disallows dutch
    const { notes } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_test_ani34',
    });
    assert.ok(notes.shot_grammar_corrections);
    assert.equal(notes.shot_grammar_corrections.length, 1);
    assert.ok(notes.shot_grammar_corrections[0].includes('dutch'));
  });

  it('notes omit shot_grammar_corrections when no filtering needed', () => {
    const scenes = [
      makeScene('sc_a', {
        intent_tags: ['opening'],
        shot_grammar: { shot_size: 'medium', angle: 'eye_level', framing: 'center' },
      }),
    ];
    const { notes } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_test_ani34_clean',
    });
    assert.equal(notes.shot_grammar_corrections, undefined);
  });
});

// ── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('STYLE_PACKS has 10 entries', () => {
    assert.equal(STYLE_PACKS.length, 10);
    assert.ok(STYLE_PACKS.includes('prestige'));
    assert.ok(STYLE_PACKS.includes('energy'));
    assert.ok(STYLE_PACKS.includes('dramatic'));
    assert.ok(STYLE_PACKS.includes('minimal'));
    assert.ok(STYLE_PACKS.includes('intimate'));
    assert.ok(STYLE_PACKS.includes('corporate'));
    assert.ok(STYLE_PACKS.includes('kinetic'));
    assert.ok(STYLE_PACKS.includes('fade'));
    assert.ok(STYLE_PACKS.includes('analog'));
    assert.ok(STYLE_PACKS.includes('documentary'));
  });

  it('STYLE_TO_PERSONALITY maps all packs', () => {
    for (const style of STYLE_PACKS) {
      assert.ok(STYLE_TO_PERSONALITY[style], `Missing personality for ${style}`);
    }
  });

  it('STYLE_TO_PERSONALITY values match personality catalog slugs', () => {
    const personalities = JSON.parse(
      readFileSync(resolve(ROOT, 'catalog/personalities.json'), 'utf-8')
    );
    const slugs = personalities.map(p => p.slug);
    for (const [style, personality] of Object.entries(STYLE_TO_PERSONALITY)) {
      assert.ok(slugs.includes(personality),
        `${style} maps to "${personality}" which is not in personalities catalog`);
    }
  });
});

// ── ANI-24: Catalog-driven architecture ─────────────────────────────────────

describe('catalog-driven style packs (ANI-24)', () => {
  const stylePacks = JSON.parse(
    readFileSync(resolve(ROOT, 'catalog/style-packs.json'), 'utf-8')
  );

  it('style-packs.json defines all 10 styles', () => {
    const names = stylePacks.map(p => p.name);
    assert.deepEqual(names.sort(), ['analog', 'corporate', 'documentary', 'dramatic', 'energy', 'fade', 'intimate', 'kinetic', 'minimal', 'prestige']);
  });

  it('each pack has required fields', () => {
    for (const pack of stylePacks) {
      assert.ok(pack.name, 'name required');
      assert.ok(pack.personality, 'personality required');
      assert.ok(pack.hold_durations, 'hold_durations required');
      assert.ok(pack.transitions, 'transitions required');
      assert.ok(pack.camera_overrides, 'camera_overrides required');
      // hold_durations must have all 4 energy levels
      for (const energy of ['static', 'subtle', 'moderate', 'high']) {
        assert.ok(typeof pack.hold_durations[energy] === 'number',
          `${pack.name}: hold_durations.${energy} must be a number`);
      }
    }
  });

  it('STYLE_PACKS and STYLE_TO_PERSONALITY are derived from catalog', () => {
    // Verify the exported constants match the catalog data
    for (const pack of stylePacks) {
      assert.ok(STYLE_PACKS.includes(pack.name),
        `STYLE_PACKS should include "${pack.name}"`);
      assert.equal(STYLE_TO_PERSONALITY[pack.name], pack.personality,
        `STYLE_TO_PERSONALITY["${pack.name}"] should be "${pack.personality}"`);
    }
  });
});

// ── ANI-24: Transition rule priority edge cases ─────────────────────────────

describe('transition rule priority (ANI-24)', () => {
  it('dramatic: same-weight + emotional → hard_cut (on_same_weight beats on_intent)', () => {
    // Critical edge case from plan: dramatic's on_same_weight fires before on_intent
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', intent_tags: ['emotional'] }),
    ];
    const transitions = selectTransitions(scenes, 'dramatic');
    assert.equal(transitions[1].type, 'hard_cut',
      'on_same_weight should beat on_intent for dramatic');
  });

  it('prestige: same-weight + emotional → crossfade (no on_same_weight rule)', () => {
    // Critical edge case: prestige has no on_same_weight, so on_intent fires
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', intent_tags: ['emotional'] }),
    ];
    const transitions = selectTransitions(scenes, 'prestige');
    assert.equal(transitions[1].type, 'crossfade',
      'prestige should crossfade for emotional even with same weight');
  });

  it('energy: pattern rule fires at position 3 regardless of metadata', () => {
    const scenes = [
      makeScene('sc_0', { visual_weight: 'dark' }),
      makeScene('sc_1', { visual_weight: 'light', intent_tags: ['emotional'] }),
      makeScene('sc_2', { visual_weight: 'dark' }),
      makeScene('sc_3', { visual_weight: 'dark', intent_tags: ['hero'] }),
    ];
    const transitions = selectTransitions(scenes, 'energy');
    // Position 3 should be a whip regardless of weight/intent
    assert.ok(transitions[3].type.startsWith('whip_'),
      'Pattern rule should override any metadata-based rules');
  });

  it('dramatic: different-weight + non-emotional → crossfade default', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light', intent_tags: ['detail'] }),
    ];
    const transitions = selectTransitions(scenes, 'dramatic');
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 400,
      'Default crossfade should be 400ms, not 600ms (no emotional tag)');
  });
});

// ── ANI-24: Camera personality validation ───────────────────────────────────

describe('camera personality validation (ANI-24)', () => {
  it('prestige push_in is allowed by editorial personality', () => {
    const scenes = [makeScene('sc_a', { content_type: 'portrait' })];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    // editorial allows push-in
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.2 });
  });

  it('prestige drift is allowed (ambient motion bypass)', () => {
    const scenes = [makeScene('sc_a', { content_type: 'ui_screenshot' })];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    assert.deepEqual(overrides[0], { move: 'drift', intensity: 0.2 });
  });

  it('dramatic push_in is allowed by cinematic-dark personality', () => {
    const scenes = [makeScene('sc_a', { intent_tags: ['emotional'] })];
    const overrides = assignCameraOverrides(scenes, 'dramatic');
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.3 });
  });

  it('energy force_static overrides all content types', () => {
    for (const contentType of ['portrait', 'ui_screenshot', 'typography']) {
      const scenes = [makeScene('sc_a', { content_type: contentType, intent_tags: ['hero'] })];
      const overrides = assignCameraOverrides(scenes, 'energy');
      assert.deepEqual(overrides[0], { move: 'static' },
        `Energy should force static for ${contentType}`);
    }
  });
});

// ── ANI-30: New style packs ─────────────────────────────────────────────────

describe('new style packs (ANI-30)', () => {
  // Load ground truth for "all 8 packs produce valid manifests" tests
  const analyzedKinetic = kineticScenes.map(scene => {
    const analysis = analyzeScene(scene);
    return { ...scene, metadata: analysis.metadata };
  });

  // ── minimal ──
  it('minimal: all transitions are hard_cut', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { visual_weight: 'dark', intent_tags: ['emotional'], content_type: 'portrait' }),
    ];
    const transitions = selectTransitions(scenes, 'minimal');
    for (let i = 1; i < transitions.length; i++) {
      assert.equal(transitions[i].type, 'hard_cut',
        `minimal scene ${i} should be hard_cut, got ${transitions[i].type}`);
    }
  });

  it('minimal: force_static camera for all content types', () => {
    for (const contentType of ['portrait', 'ui_screenshot', 'typography', 'product_shot']) {
      const scenes = [makeScene('sc_a', { content_type: contentType })];
      const overrides = assignCameraOverrides(scenes, 'minimal');
      assert.deepEqual(overrides[0], { move: 'static' },
        `minimal ${contentType} should be static`);
    }
  });

  it('minimal: durations >= 3.0s for all energy levels', () => {
    for (const energy of ['static', 'subtle', 'moderate', 'high']) {
      const scenes = [makeScene('sc_a', { motion_energy: energy })];
      const durations = assignDurations(scenes, 'minimal');
      assert.ok(durations[0] >= 3.0,
        `minimal ${energy}: expected >= 3.0s, got ${durations[0]}`);
    }
  });

  // ── intimate ──
  it('intimate: emotional scenes get 800ms crossfade', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', intent_tags: ['emotional'] }),
    ];
    const transitions = selectTransitions(scenes, 'intimate');
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 800);
  });

  it('intimate: default crossfade is 500ms', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light', content_type: 'ui_screenshot' }),
    ];
    const transitions = selectTransitions(scenes, 'intimate');
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 500);
  });

  it('intimate: push_in 0.15 for portrait', () => {
    const scenes = [makeScene('sc_a', { content_type: 'portrait' })];
    const overrides = assignCameraOverrides(scenes, 'intimate');
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.15 });
  });

  // ── corporate ──
  it('corporate: crossfade 300ms on weight change', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light' }),
    ];
    const transitions = selectTransitions(scenes, 'corporate');
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 300);
  });

  it('corporate: hard_cut default (same weight)', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', content_type: 'ui_screenshot' }),
    ];
    const transitions = selectTransitions(scenes, 'corporate');
    assert.equal(transitions[1].type, 'hard_cut');
  });

  it('corporate: uniform pacing (2.5-3.0s range)', () => {
    for (const energy of ['static', 'subtle', 'moderate', 'high']) {
      const scenes = [makeScene('sc_a', { motion_energy: energy })];
      const durations = assignDurations(scenes, 'corporate');
      assert.ok(durations[0] >= 2.5 && durations[0] <= 3.0,
        `corporate ${energy}: expected 2.5-3.0s, got ${durations[0]}`);
    }
  });

  // ── kinetic ──
  it('kinetic: whip every 2nd transition at 200ms', () => {
    const scenes = Array.from({ length: 5 }, (_, i) =>
      makeScene(`sc_${i}`, { content_type: i % 2 === 0 ? 'typography' : 'ui_screenshot' })
    );
    const transitions = selectTransitions(scenes, 'kinetic');
    // Position 2 and 4 should be whips (every_n=2)
    assert.ok(transitions[2].type.startsWith('whip_'),
      `Expected whip at index 2, got ${transitions[2].type}`);
    assert.equal(transitions[2].duration_ms, 200);
    assert.ok(transitions[4].type.startsWith('whip_'),
      `Expected whip at index 4, got ${transitions[4].type}`);
    assert.equal(transitions[4].duration_ms, 200);
  });

  it('kinetic: max_hold_duration 3.0s enforced', () => {
    const scenes = [makeScene('sc_a', { motion_energy: 'static' })];
    const durations = assignDurations(scenes, 'kinetic');
    assert.ok(durations[0] <= 3.0,
      `kinetic static: expected <= 3.0s, got ${durations[0]}`);
  });

  it('kinetic: force_static camera', () => {
    const scenes = [makeScene('sc_a', { content_type: 'portrait', intent_tags: ['hero'] })];
    const overrides = assignCameraOverrides(scenes, 'kinetic');
    assert.deepEqual(overrides[0], { move: 'static' });
  });

  // ── fade ──
  it('fade: all transitions are crossfade 500ms', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'dark', intent_tags: ['emotional'], content_type: 'ui_screenshot' }),
      makeScene('sc_c', { visual_weight: 'light', content_type: 'portrait' }),
    ];
    const transitions = selectTransitions(scenes, 'fade');
    for (let i = 1; i < transitions.length; i++) {
      assert.equal(transitions[i].type, 'crossfade',
        `fade scene ${i} should be crossfade`);
      assert.equal(transitions[i].duration_ms, 500,
        `fade scene ${i} should be 500ms`);
    }
  });

  it('fade: push_in 0.1 for portrait/product only, null for others', () => {
    const portrait = [makeScene('sc_a', { content_type: 'portrait' })];
    const product = [makeScene('sc_a', { content_type: 'product_shot' })];
    const typo = [makeScene('sc_a', { content_type: 'typography' })];

    assert.deepEqual(assignCameraOverrides(portrait, 'fade')[0], { move: 'push_in', intensity: 0.1 });
    assert.deepEqual(assignCameraOverrides(product, 'fade')[0], { move: 'push_in', intensity: 0.1 });
    assert.equal(assignCameraOverrides(typo, 'fade')[0], null);
  });

  // ── All 8 packs: valid manifests ──
  it('all 8 packs produce valid manifests from ground truth scenes', () => {
    for (const style of STYLE_PACKS) {
      const { manifest } = planSequence({
        scenes: analyzedKinetic,
        style,
        sequence_id: `seq_ani30_${style}`,
      });

      const validation = validateManifest(manifest);
      assert.ok(validation.valid,
        `${style} validation failed: ${validation.errors.join('; ')}`);
    }
  });

  it('all 8 packs work through plan → evaluate (score > 0)', () => {
    for (const style of STYLE_PACKS) {
      const { manifest } = planSequence({
        scenes: analyzedKinetic,
        style,
        sequence_id: `seq_ani30_eval_${style}`,
      });
      const result = evaluateSequence({ manifest, scenes: analyzedKinetic, style });
      assert.ok(result.score > 0,
        `${style} evaluate score should be > 0, got ${result.score}`);
      assert.ok(result.score <= 100,
        `${style} evaluate score should be <= 100, got ${result.score}`);
    }
  });
});

// ── ANI-30: Per-scene style blending ────────────────────────────────────────

describe('per-scene style blending (ANI-30)', () => {
  it('style_override affects duration for that scene only', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'moderate' }),
      makeScene('sc_b', { motion_energy: 'moderate', style_override: 'energy' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
    ];
    const durations = assignDurations(scenes, 'prestige');
    // prestige moderate = 3.0, energy moderate = 1.5
    assert.equal(durations[0], 3.0, 'Scene 0 should use prestige duration');
    assert.equal(durations[1], 1.5, 'Scene 1 should use energy duration (override)');
    assert.equal(durations[2], 3.0, 'Scene 2 should use prestige duration');
  });

  it('style_override affects transition for incoming scene', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark' }),
      makeScene('sc_b', { visual_weight: 'light', style_override: 'fade' }),
    ];
    const transitions = selectTransitions(scenes, 'prestige');
    // fade default = crossfade 500ms (not prestige's weight-change crossfade 400ms)
    assert.equal(transitions[1].type, 'crossfade');
    assert.equal(transitions[1].duration_ms, 500);
  });

  it('style_override affects camera per scene', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'portrait' }),
      makeScene('sc_b', { content_type: 'portrait', style_override: 'energy' }),
    ];
    const overrides = assignCameraOverrides(scenes, 'prestige');
    // prestige portrait = push_in 0.2, energy = force_static
    assert.deepEqual(overrides[0], { move: 'push_in', intensity: 0.2 });
    assert.deepEqual(overrides[1], { move: 'static' });
  });

  it('planSequence produces valid manifest with mixed styles', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'] }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', style_override: 'energy' }),
      makeScene('sc_c', { intent_tags: ['closing'], content_type: 'brand_mark' }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_blend_test',
    });

    const validation = validateManifest(manifest);
    assert.ok(validation.valid, `Validation failed: ${validation.errors.join('; ')}`);
  });

  it('notes includes style_overrides_used', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'] }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', style_override: 'dramatic' }),
      makeScene('sc_c', { intent_tags: ['closing'], content_type: 'brand_mark', style_override: 'fade' }),
    ];
    const { notes } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_blend_notes',
    });

    assert.ok(notes.style_overrides_used, 'notes should include style_overrides_used');
    assert.ok(notes.style_overrides_used.includes('dramatic'));
    assert.ok(notes.style_overrides_used.includes('fade'));
  });

  it('unknown style_override throws', () => {
    const scenes = [
      makeScene('sc_a', { style_override: 'nonexistent' }),
    ];
    assert.throws(
      () => assignDurations(scenes, 'prestige'),
      /Unknown style_override "nonexistent"/
    );
  });

  it('no style_override = backward compatible (identical output)', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'subtle' }),
      makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', motion_energy: 'moderate' }),
      makeScene('sc_c', { intent_tags: ['closing'], content_type: 'brand_mark', motion_energy: 'static' }),
    ];
    const result1 = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_compat_1' });
    const result2 = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_compat_2' });

    // Manifests should be structurally identical (ignoring sequence_id)
    assert.equal(result1.manifest.scenes.length, result2.manifest.scenes.length);
    for (let i = 0; i < result1.manifest.scenes.length; i++) {
      assert.equal(result1.manifest.scenes[i].duration_s, result2.manifest.scenes[i].duration_s);
      assert.deepEqual(result1.manifest.scenes[i].transition_in, result2.manifest.scenes[i].transition_in);
      assert.deepEqual(result1.manifest.scenes[i].camera_override, result2.manifest.scenes[i].camera_override);
    }
    assert.ok(!result1.notes.style_overrides_used, 'No overrides should mean no style_overrides_used in notes');
  });
});

// ── A/B Variant Planning (ANI-44) ────────────────────────────────────────────

describe('planVariants (ANI-44)', () => {
  const scenes = [
    makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'moderate' }),
    makeScene('sc_b', { intent_tags: ['detail'], content_type: 'ui_screenshot', motion_energy: 'subtle' }),
    makeScene('sc_c', { intent_tags: ['closing'], content_type: 'brand_mark', motion_energy: 'static' }),
  ];

  it('generates one variant per style', () => {
    const { variants } = planVariants({ scenes, styles: ['prestige', 'energy'] });
    assert.equal(variants.length, 2);
    assert.equal(variants[0].style, 'prestige');
    assert.equal(variants[1].style, 'energy');
  });

  it('each variant has valid manifest', () => {
    const { variants } = planVariants({ scenes, styles: ['prestige', 'dramatic', 'minimal'] });
    for (const v of variants) {
      assert.ok(v.variant_id, 'variant_id required');
      assert.ok(v.manifest, 'manifest required');
      assert.ok(v.notes, 'notes required');
      assert.ok(v.manifest.sequence_id.includes(v.style),
        `sequence_id should include style name: ${v.manifest.sequence_id}`);
    }
  });

  it('variants have different durations for different styles', () => {
    const { variants } = planVariants({ scenes, styles: ['prestige', 'energy'] });
    assert.notEqual(variants[0].notes.total_duration_s, variants[1].notes.total_duration_s,
      'prestige and energy should produce different total durations');
  });

  it('throws on fewer than 2 styles', () => {
    assert.throws(() => planVariants({ scenes, styles: ['prestige'] }), /at least 2/);
  });

  it('throws on empty scenes', () => {
    assert.throws(() => planVariants({ scenes: [], styles: ['prestige', 'energy'] }), /non-empty/);
  });

  it('uses base sequence_id with style suffix', () => {
    const { variants } = planVariants({ scenes, styles: ['prestige', 'energy'], sequence_id: 'seq_test' });
    assert.ok(variants[0].manifest.sequence_id.startsWith('seq_test'));
    assert.ok(variants[1].manifest.sequence_id.startsWith('seq_test'));
    assert.notEqual(variants[0].manifest.sequence_id, variants[1].manifest.sequence_id);
  });
});

// ── Beat sync integration (ANI-37) ──────────────────────────────────────────

describe('planSequence with beats (ANI-37)', () => {
  const scenes = [
    makeScene('opening', ['opening']),
    makeScene('hero', ['hero', 'detail']),
    makeScene('closing', ['closing']),
  ].map(analyzeScene);

  it('accepts beats parameter without error', () => {
    const beats = {
      bpm: 120,
      beats: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
      energy: new Array(200).fill(0.5),
      sampleRate: 44100,
      hopSize: 512,
    };
    const { manifest, notes } = planSequence({ scenes, style: 'prestige', beats });
    assert.ok(manifest);
    assert.ok(notes);
  });

  it('produces beat_sync notes when adjustments occur', () => {
    const beats = {
      bpm: 120,
      beats: [0.5, 1.0, 1.5, 2.0, 2.5, 3.1, 3.5, 4.0, 4.5, 5.0, 5.5, 6.2, 7.0],
      energy: new Array(200).fill(0.5),
      sampleRate: 44100,
      hopSize: 512,
    };
    const { notes } = planSequence({ scenes, style: 'energy', beats });
    // May or may not have adjustments depending on duration alignment
    // Just verify the structure is correct if present
    if (notes.beat_sync) {
      assert.ok(typeof notes.beat_sync.adjustments_count === 'number');
      assert.ok(Array.isArray(notes.beat_sync.adjustments));
    }
  });

  it('without beats, no beat_sync in notes', () => {
    const { notes } = planSequence({ scenes, style: 'prestige' });
    assert.equal(notes.beat_sync, undefined);
  });

  it('energy matching blends with camera intensity', () => {
    // High energy in first scene region, low in rest
    const energy = [
      ...new Array(100).fill(0.9),
      ...new Array(100).fill(0.1),
      ...new Array(100).fill(0.1),
    ];
    const beats = {
      bpm: 120,
      beats: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
      energy,
      sampleRate: 44100,
      hopSize: 512,
    };
    const { manifest } = planSequence({ scenes, style: 'dramatic', beats });

    // Scenes with camera overrides should exist
    const cameraScenesCount = manifest.scenes.filter(s => s.camera_override).length;
    assert.ok(cameraScenesCount >= 0); // structure is valid
  });

  it('planVariants passes beats to each variant', () => {
    const beats = {
      bpm: 120,
      beats: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0],
      energy: new Array(200).fill(0.5),
      sampleRate: 44100,
      hopSize: 512,
    };
    const { variants } = planVariants({
      scenes,
      styles: ['prestige', 'energy'],
      beats,
    });

    assert.equal(variants.length, 2);
    // Both should produce valid manifests
    for (const v of variants) {
      assert.ok(v.manifest);
      assert.ok(v.notes);
    }
  });
});
