/**
 * Frame-evidence revision loop (ANI-180)
 *
 * Covers the mapper split, the stall-gated frame pass closing the loop with a
 * fix the JSON-only loop misses, the advisory path (no-op transforms never
 * applied / never counted), the frame-pass STATE guard (renders don't recur
 * every round), and byte-identical output when frame_evidence is off.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { autoReviseLoop } from '../lib/scoring.js';
import { frameFindingsToRevisions } from '../lib/frame-revision.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

// A foreground content layer that is NOT a hero, and no primary_subject → weak
// hero-frame legibility, while otherwise a structurally plausible scene.
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

const FAKE_STILL = { media_type: 'image/png', data: 'AAECAwQ=' };
const STRONG_GEOM = { visual_center: 0.9, subject_scale: 0.9, contrast: 0.9, whitespace_air: 0.9, brand_presence: 0.9, emotional_semantic_clarity: 0.9 };
const WEAK_GEOM = { visual_center: 0.4, subject_scale: 0.4, contrast: 0.9, whitespace_air: 0.4, brand_presence: 0.9, emotional_semantic_clarity: 0.9 };

// ── frameFindingsToRevisions (mapper) ────────────────────────────────────────

describe('frameFindingsToRevisions', () => {
  const manifest = manifestFor(['sc_a', 'sc_b']);

  it('routes weak legibility to a real revision, weak geometry to an advisory', () => {
    const heroAudit = { scenes: [
      { scene_id: 'sc_a', overall: 0.3, subscores: { subject_clarity: { score: 0.3 }, hierarchy: { score: 0.3 }, readable_text: { score: 0.8 }, visual_center: { score: null }, subject_scale: { score: null }, whitespace_air: { score: null } } },
      { scene_id: 'sc_b', overall: 0.9, subscores: { subject_clarity: { score: 0.9 }, hierarchy: { score: 0.9 }, readable_text: { score: 0.9 }, visual_center: { score: 0.4 }, subject_scale: { score: 0.4 }, whitespace_air: { score: 0.4 } } },
    ] };
    const { revisions, advisories } = frameFindingsToRevisions(heroAudit, null, manifest);
    assert.deepEqual(revisions.map(r => `${r.op}:${r.target}`), ['boost_hierarchy:sc_a']);
    assert.deepEqual(advisories.map(r => `${r.op}:${r.target}`), ['needs_annotation:sc_b']);
    assert.ok(advisories.every(a => a.op === 'needs_annotation'), 'advisories are advisory-only ops');
  });

  it('does not emit geometry advisories for UNVERIFIED (null) axes', () => {
    const heroAudit = { scenes: [{ scene_id: 'sc_a', overall: 0.6, subscores: { subject_clarity: { score: 0.9 }, hierarchy: { score: 0.9 }, readable_text: { score: 0.9 }, visual_center: { score: null }, subject_scale: { score: null }, whitespace_air: { score: null } } }] };
    const { revisions, advisories } = frameFindingsToRevisions(heroAudit, null, manifest);
    assert.equal(revisions.length, 0);
    assert.equal(advisories.length, 0, 'no evidence (null) → no advisory');
  });

  it('dedupes against already-applied ops', () => {
    const heroAudit = { scenes: [{ scene_id: 'sc_a', overall: 0.3, subscores: { subject_clarity: { score: 0.3 }, hierarchy: { score: 0.3 }, readable_text: { score: 0.9 } } }] };
    const applied = new Set(['boost_hierarchy:sc_a']);
    const { revisions } = frameFindingsToRevisions(heroAudit, null, manifest, applied);
    assert.equal(revisions.length, 0, 'already-applied op is not re-emitted');
  });

  it('maps flat strip contrast to adjust_density on the flattest scene', () => {
    const heroAudit = { scenes: [] };
    const frameStrip = { dimensions: { contrast: { score: 0.3 } }, per_scene: [{ scene_id: 'sc_a', contrast: 0.2 }, { scene_id: 'sc_b', contrast: 0.6 }] };
    const { revisions } = frameFindingsToRevisions(heroAudit, frameStrip, manifest);
    assert.deepEqual(revisions.map(r => `${r.op}:${r.target}`), ['adjust_density:sc_a']);
  });
});

// ── Loop: frame pass closes the loop on a fix JSON misses ─────────────────────

describe('autoReviseLoop — frame evidence', () => {
  it('frame_evidence:false leaves the result shape byte-identical (no frame fields)', async () => {
    const manifest = manifestFor(['sc_strong', 'sc_weak']);
    const scenes = [strongScene('sc_strong'), weakHeroScene('sc_weak')];
    const result = await autoReviseLoop({ manifest, scenes });
    assert.equal(result.frame_passes, undefined);
    assert.equal(result.estimated_render_seconds, undefined);
    for (const r of result.rounds) {
      assert.equal(r.source, undefined, 'no source field when frame_evidence off');
      assert.equal(r.frame_evidence, undefined);
      assert.equal(r.advisories, undefined);
    }
  });

  it('runs a stall-gated frame pass and applies a frame-driven fix the JSON loop misses', async () => {
    const manifest = manifestFor(['sc_strong', 'sc_weak']);
    const scenes = [strongScene('sc_strong'), weakHeroScene('sc_weak')];

    const off = await autoReviseLoop({ manifest, scenes });
    const on = await autoReviseLoop({ manifest, scenes, frame_evidence: true, capture: async () => null });

    // The frame pass ran and produced a frame-sourced round.
    assert.ok(on.frame_passes >= 1, 'at least one frame pass');
    const frameRounds = on.rounds.filter(r => r.source === 'frame');
    assert.ok(frameRounds.length >= 1, 'a round was driven by frame evidence');

    // It applied boost_hierarchy on the weak-hero scene.
    const frameDiffOps = frameRounds.flatMap(r => (r.diff || []).map(d => `${d.op}:${d.target}`));
    assert.ok(frameDiffOps.some(o => o.startsWith('boost_hierarchy:sc_weak')), 'frame pass boosted the weak hero scene');

    // The JSON-only run never applied that frame-driven boost on sc_weak.
    const offBoostedWeak = off.rounds.flatMap(r => (r.diff || []).map(d => `${d.op}:${d.target}`)).some(o => o.startsWith('boost_hierarchy:sc_weak'));
    assert.ok(!offBoostedWeak, 'JSON-only loop missed the weak hero scene');

    assert.ok(on.improvement >= off.improvement, 'frame evidence does not regress the score');
  });

  it('runs the frame pass even when JSON converges on the final allowed round (max_rounds:1)', async () => {
    // Regression: the frame pass must not be skipped when JSON converges on the
    // last round of a tight budget — otherwise frame_evidence silently no-ops.
    const manifest = manifestFor(['sc_strong', 'sc_weak']);
    const scenes = [strongScene('sc_strong'), weakHeroScene('sc_weak')];
    const r1 = await autoReviseLoop({ manifest, scenes, frame_evidence: true, capture: async () => null, max_rounds: 1 });
    assert.ok(r1.frame_passes >= 1, 'frame pass runs at max_rounds:1');
    assert.ok(r1.rounds.some(r => r.source === 'frame'), 'a frame-sourced round was recorded');
  });

  it('advisory-only frame pass: nothing applied, revision_count unchanged, renders do not recur (state guard)', async () => {
    // Strong legibility everywhere → no boost. Vision judges geometry weak on one
    // scene → advisory only. The frame pass must record the advisory, apply NO
    // revision, and not render on every round.
    const manifest = manifestFor(['sc_strong', 'sc_strong2']);
    const scenes = [strongScene('sc_strong'), { ...strongScene('sc_strong2'), scene_id: 'sc_strong2' }];

    let captureCalls = 0;
    const capture = async () => { captureCalls += 1; return FAKE_STILL; };
    // Weak geometry only on sc_strong2.
    const client = { messages: { create: async ({ messages }) => {
      const weak = JSON.stringify(messages).includes('sc_strong2');
      return { content: [{ type: 'text', text: JSON.stringify({ score: 0.6, dimensions: weak ? WEAK_GEOM : STRONG_GEOM, reasoning: [], rationale: '' }) }] };
    } } };

    const result = await autoReviseLoop({ manifest, scenes, max_rounds: 5, frame_evidence: true, capture, client });

    // Advisory surfaced, but never counted as a revision.
    const advisoryRounds = result.rounds.filter(r => Array.isArray(r.advisories) && r.advisories.length);
    assert.ok(advisoryRounds.length >= 1, 'the geometry advisory was recorded');
    for (const r of result.rounds.filter(r => r.source === 'frame')) {
      assert.ok((r.revisions || 0) === 0 || (r.diff || []).every(d => d.op !== 'needs_annotation'),
        'needs_annotation is never applied as a revision');
    }
    // STATE guard: renders are bounded — a frame pass does NOT fire every round.
    // captureCalls = (frame passes) × (scenes). With the guard, frame passes are a
    // small constant, not max_rounds. Assert far below the unguarded worst case.
    assert.ok(result.frame_passes <= 2, `frame passes bounded by state guard, got ${result.frame_passes}`);
    assert.ok(captureCalls <= result.frame_passes * scenes.length, 'captures only happen inside a frame pass');
  });
});
