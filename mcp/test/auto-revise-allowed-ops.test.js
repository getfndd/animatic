/**
 * autoReviseLoop allowed_ops constraint (ANI-186).
 *
 * render_master self-heals re-time-only (the master honesty contract — spike
 * fault line 2). `allowed_ops` restricts BOTH the JSON and frame phases to a set
 * of ops; RETIME_OPS (trim/extend_hold/compress) keeps every applied transform
 * duration-only, so structural fixes (boost_hierarchy/adjust_density/reorder)
 * the loop would otherwise apply are filtered out. Default (allowed_ops unset)
 * is byte-identical to the pre-ANI-186 loop.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { autoReviseLoop } from '../lib/scoring.js';
import { RETIME_OPS } from '../lib/master-profiles.js';

function layer(id, depth, role, weight) {
  return { id, type: 'html', depth_class: depth, product_role: role, clarity_weight: weight, content: `<div>${id}</div>` };
}
function strongScene(id) {
  return {
    scene_id: id, duration_s: 4, primary_subject: 'card', product_role: 'result',
    layers: [layer('bg', 'background', 'decorative', 1), layer('card', 'foreground', 'hero', 5)],
    motion: { groups: [{ targets: ['card'], primitive: 'as-fadeIn' }] },
  };
}
// No hero + no primary_subject → weak hero-frame legibility ⇒ the frame pass
// wants a structural boost_hierarchy (NOT a retime op).
function weakHeroScene(id) {
  return {
    scene_id: id, duration_s: 4, product_role: 'result',
    layers: [layer('bg', 'background', 'decorative', 1), layer('thing', 'foreground', 'functional', 2)],
    motion: { groups: [{ targets: ['thing'], primitive: 'as-fadeIn' }] },
  };
}
function manifestFor(ids) {
  return {
    sequence_id: 'seq_test', fps: 60,
    scenes: ids.map((id, i) => i === 0 ? { scene: id, duration_s: 4 } : { scene: id, duration_s: 4, transition_in: { type: 'crossfade', duration_ms: 400 } }),
  };
}
const STRUCTURAL_OPS = ['boost_hierarchy', 'adjust_density', 'reorder', 'swap_transition', 'add_continuity'];
const appliedOps = (result) => result.rounds.flatMap(r => (r.diff || []).map(d => d.op));
const sceneIds = (m) => m.scenes.map(s => s.scene || s.scene_id);

describe('autoReviseLoop — allowed_ops (ANI-186)', () => {
  const manifest = () => manifestFor(['sc_strong', 'sc_weak']);
  const scenes = () => [strongScene('sc_strong'), weakHeroScene('sc_weak')];

  it('RETIME_OPS filters the structural frame fix (boost_hierarchy) the default loop applies', async () => {
    const free = await autoReviseLoop({ manifest: manifest(), scenes: scenes(), frame_evidence: true, capture: async () => null });
    const retimed = await autoReviseLoop({ manifest: manifest(), scenes: scenes(), frame_evidence: true, capture: async () => null, allowed_ops: RETIME_OPS });

    // The default loop applies the structural boost…
    assert.ok(appliedOps(free).includes('boost_hierarchy'), 'baseline: default loop boosts the weak hero scene');
    // …the constrained loop never applies a structural op.
    for (const op of appliedOps(retimed)) {
      assert.ok(!STRUCTURAL_OPS.includes(op), `constrained loop applied a structural op: ${op}`);
      assert.ok(RETIME_OPS.includes(op), `constrained loop applied a non-retime op: ${op}`);
    }
    assert.ok(retimed.ops_filtered >= 1, 'at least one structural op was filtered out');
    assert.deepEqual(retimed.ops_allowed, RETIME_OPS, 'the constraint is surfaced for the caller to log');
  });

  it('the scene set + order are unchanged under RETIME_OPS (no re-authoring)', async () => {
    const before = manifest();
    const retimed = await autoReviseLoop({ manifest: before, scenes: scenes(), frame_evidence: true, capture: async () => null, allowed_ops: RETIME_OPS });
    assert.deepEqual(sceneIds(retimed.manifest), sceneIds(before), 'retime is duration-only — scene set/order preserved');
    assert.ok(retimed.improvement >= 0, 'the constrained pass does not regress the score');
  });

  it('default (allowed_ops unset) carries no ops_* fields — byte-identical shape', async () => {
    const free = await autoReviseLoop({ manifest: manifest(), scenes: scenes(), frame_evidence: true, capture: async () => null });
    assert.equal(free.ops_allowed, undefined);
    assert.equal(free.ops_filtered, undefined);
  });

  it('JSON-only loop honors allowed_ops too (both phases constrained)', async () => {
    const retimed = await autoReviseLoop({ manifest: manifest(), scenes: scenes(), allowed_ops: RETIME_OPS });
    for (const op of appliedOps(retimed)) {
      assert.ok(RETIME_OPS.includes(op), `JSON-phase applied a non-retime op: ${op}`);
    }
    assert.deepEqual(retimed.ops_allowed, RETIME_OPS);
  });
});
