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
  planSequence,
  STYLE_PACKS,
  STYLE_TO_PERSONALITY,
} from '../lib/planner.js';

import { analyzeScene } from '../lib/analyze.js';
import { validateManifest } from '../../src/remotion/lib.js';

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

// ── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('STYLE_PACKS has 3 entries', () => {
    assert.equal(STYLE_PACKS.length, 3);
    assert.ok(STYLE_PACKS.includes('prestige'));
    assert.ok(STYLE_PACKS.includes('energy'));
    assert.ok(STYLE_PACKS.includes('dramatic'));
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

  it('style-packs.json defines all 3 styles', () => {
    const names = stylePacks.map(p => p.name);
    assert.deepEqual(names.sort(), ['dramatic', 'energy', 'prestige']);
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
