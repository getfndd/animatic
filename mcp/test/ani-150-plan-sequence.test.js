/**
 * ANI-150 — plan_sequence honors duration_target_s and preserves source order.
 *
 * Two bugs from the 2026-05-08 loop run:
 *   1. duration_target_s was ignored — style-pack hold presets produced ~13s
 *      for a 28s brief.
 *   2. Scenes were silently reordered (0,1,2,3,4 → 0,1,3,2,4), putting social
 *      proof before the feature it proves.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { planSequence, scaleDurationsToTarget } from '../lib/planner.js';

// The polaris-observability scene order: hero → product → features → proof → CTA.
// intent_tags are chosen so the old planner would have reordered them.
function polarisScenes() {
  return [
    { scene_id: 'sc_00_hero', duration_s: 3, metadata: { intent_tags: ['opening', 'hero'], motion_energy: 'moderate', content_type: 'typography' } },
    { scene_id: 'sc_01_product', duration_s: 3, metadata: { intent_tags: ['detail'], motion_energy: 'moderate', content_type: 'ui_screenshot' } },
    { scene_id: 'sc_02_features', duration_s: 3, metadata: { intent_tags: ['detail'], motion_energy: 'high', content_type: 'ui_screenshot' } },
    { scene_id: 'sc_03_social_proof', duration_s: 3, metadata: { intent_tags: ['emotional'], motion_energy: 'moderate', content_type: 'data_viz' } },
    { scene_id: 'sc_04_cta', duration_s: 3, metadata: { intent_tags: ['closing'], motion_energy: 'static', content_type: 'brand_mark' } },
  ];
}

const order = (manifest) => manifest.scenes.map(s => s.scene);
const sum = (manifest) => Math.round(manifest.scenes.reduce((a, s) => a + s.duration_s, 0) * 10) / 10;

describe('ANI-150 — duration_target_s', () => {
  it('lands within ±3s of a 28s target on a 5-scene brief', () => {
    const { manifest, notes } = planSequence({
      scenes: polarisScenes(), style: 'prestige', sequence_id: 'seq_dur', duration_target_s: 28,
    });
    assert.ok(Math.abs(sum(manifest) - 28) <= 3,
      `scene durations should sum near 28s, got ${sum(manifest)}s`);
    assert.equal(notes.duration_target.target_s, 28);
    assert.ok(Math.abs(notes.duration_target.achieved_s - 28) <= 3);
    assert.ok(!notes.duration_target.warning, 'no warning expected when target is reachable');
  });

  it('warns when the target is below the per-scene duration_s floor sum', () => {
    // Five scenes with 3s floors = 15s minimum; a 6s target can't be honored.
    const { manifest, notes } = planSequence({
      scenes: polarisScenes(), style: 'prestige', sequence_id: 'seq_floor', duration_target_s: 6,
    });
    assert.ok(notes.duration_target.warning, 'expected a floor warning');
    assert.ok(sum(manifest) >= 15, `floors (15s) should hold, got ${sum(manifest)}s`);
    assert.equal(notes.duration_target.achieved_s, sum(manifest));
  });

  it('leaves durations untouched when no target is given', () => {
    const { notes } = planSequence({ scenes: polarisScenes(), style: 'prestige', sequence_id: 'seq_none' });
    assert.equal(notes.duration_target, undefined);
  });

  describe('scaleDurationsToTarget (unit)', () => {
    it('scales up proportionally to hit the target', () => {
      const scenes = [{ duration_s: 2 }, { duration_s: 2 }, { duration_s: 2 }];
      const { durations, note } = scaleDurationsToTarget([2, 2, 2], scenes, 12);
      assert.equal(durations.reduce((a, b) => a + b, 0), 12);
      assert.equal(note.achieved_s, 12);
      assert.ok(!note.warning);
    });

    it('respects per-scene floors and warns when target is too short', () => {
      const scenes = [{ duration_s: 4 }, { duration_s: 4 }];
      const { durations, note } = scaleDurationsToTarget([4, 4], scenes, 3);
      assert.deepEqual(durations, [4, 4], 'floors hold');
      assert.ok(note.warning);
      assert.equal(note.achieved_s, 8);
    });
  });
});

describe('ANI-150 — source order preservation', () => {
  it('preserves source order by default (polaris → 0,1,2,3,4)', () => {
    const { manifest, notes } = planSequence({
      scenes: polarisScenes(), style: 'prestige', sequence_id: 'seq_order',
    });
    assert.deepEqual(order(manifest),
      ['sc_00_hero', 'sc_01_product', 'sc_02_features', 'sc_03_social_proof', 'sc_04_cta']);
    assert.equal(notes.ordering_mode, 'source_order_preserved');
  });

  it('preserves source order across all style packs by default', () => {
    const src = polarisScenes().map(s => s.scene_id);
    for (const style of ['prestige', 'energy', 'dramatic']) {
      const { manifest } = planSequence({ scenes: polarisScenes(), style, sequence_id: `seq_${style}` });
      assert.deepEqual(order(manifest), src, `${style} should preserve source order`);
    }
  });

  it('reorders only when explicitly requested, and logs the rewrite', () => {
    const { notes } = planSequence({
      scenes: polarisScenes(), style: 'prestige', sequence_id: 'seq_reorder', preserve_source_order: false,
    });
    assert.equal(notes.ordering_mode, 'planner_reordered');
    assert.ok(/planner reorder/i.test(notes.ordering_rationale),
      `rationale should record the reorder decision, got: ${notes.ordering_rationale}`);
  });
});
