/**
 * Shot-grammar-first sequence planning (ANI-179).
 *
 * The planner picks the shot list from the archetype FIRST, then derives
 * shot_grammar + camera from the shot role. Opt-in via `archetype`; absent ⇒
 * the metadata-led behavior is unchanged.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { planSequence } from '../lib/planner.js';

// Scenes whose ids end with archetype role slugs → deterministic role assignment.
function scenesFor(roleSuffixes) {
  return roleSuffixes.map((role, i) => ({
    scene_id: `sc_0${i + 1}_${role}`,
    duration_s: 3,
    metadata: { content_type: 'typography', intent_tags: [] },
    layers: [{ id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' }],
  }));
}

const BRAND = ['atmosphere_open', 'brand_statement', 'product_glimpse', 'tagline_close', 'logo_lockup'];
const FEATURE = ['context_setup', 'problem_frame', 'feature_demo', 'detail_zoom', 'benefit_proof', 'cta_close'];

describe('shot-grammar-first — opt-in', () => {
  it('assigns scenes to shot roles, stamps shot_grammar from the template, takes camera from the role', () => {
    const { manifest, notes } = planSequence({ scenes: scenesFor(BRAND), style: 'dramatic', sequence_id: 'seq_t', archetype: 'brand-teaser' });
    assert.equal(notes.shot_grammar_mode, 'archetype:brand-teaser');
    assert.equal(notes.shot_list.length, 5);
    const establish = notes.shot_list[0];
    assert.equal(establish.shot_role, 'establish');
    assert.deepEqual(establish.shot_grammar, { shot_size: 'wide', angle: 'eye_level', framing: 'center' });
    assert.ok(establish.motion_candidates.length > 0, 'shot role carries motion candidates');
    assert.equal(establish.match, 'scene_id_suffix');
    // shot_grammar reached the manifest
    assert.ok(manifest.scenes[0].shot_grammar, 'manifest scene carries shot_grammar');
  });
});

describe('shot-grammar-first — shot-role-conditioned motion', () => {
  it('an establish shot and an insert shot get different motion candidates + camera', () => {
    const { notes } = planSequence({ scenes: scenesFor(FEATURE), style: 'dramatic', sequence_id: 'seq_t', archetype: 'feature-reveal' });
    const establish = notes.shot_list.find(s => s.shot_role === 'establish');
    const insert = notes.shot_list.find(s => s.shot_role === 'insert');
    assert.ok(establish && insert);
    assert.notDeepEqual(establish.motion_candidates, insert.motion_candidates, 'different shot roles → different motion candidates');
    assert.notDeepEqual(establish.shot_grammar, insert.shot_grammar, 'establish is wide, insert is close_up');
    assert.equal(insert.shot_grammar.shot_size, 'close_up');
  });
});

describe('shot-grammar-first — per-archetype distinctness (no universal list)', () => {
  it('brand-teaser and feature-reveal produce different shot-role sequences', () => {
    const brand = planSequence({ scenes: scenesFor(BRAND), style: 'dramatic', sequence_id: 'seq_t', archetype: 'brand-teaser' });
    const feature = planSequence({ scenes: scenesFor(FEATURE), style: 'dramatic', sequence_id: 'seq_t', archetype: 'feature-reveal' });
    const brandSeq = brand.notes.shot_list.map(s => s.shot_role).join('>');
    const featureSeq = feature.notes.shot_list.map(s => s.shot_role).join('>');
    assert.notEqual(brandSeq, featureSeq);
    assert.equal(brandSeq, 'establish>statement>tease>restraint>resolve');
    assert.equal(featureSeq, 'establish>frame>reveal>insert>payoff>close');
  });
});

describe('shot-grammar-first — regression (archetype absent = unchanged)', () => {
  it('a no-archetype plan carries no shot-grammar-first fields', () => {
    const scenes = scenesFor(BRAND);
    const { manifest, notes } = planSequence({ scenes, style: 'dramatic', sequence_id: 'seq_t' });
    assert.ok(!('shot_grammar_mode' in notes), 'no shot_grammar_mode without archetype');
    assert.ok(!('shot_list' in notes), 'no shot_list without archetype');
    for (const r of notes.reasoning) assert.ok(!('shot_role' in r), 'no shot_role in reasoning without archetype');
    for (const s of manifest.scenes) {
      if (s.shot_grammar) assert.deepEqual(Object.keys(s.shot_grammar).sort(), ['angle', 'framing', 'shot_size']);
    }
  });

  it('is deterministic when sequence_id is pinned (no Date.now drift)', () => {
    const scenes = scenesFor(BRAND);
    const a = planSequence({ scenes, style: 'dramatic', sequence_id: 'seq_fixed' });
    const b = planSequence({ scenes, style: 'dramatic', sequence_id: 'seq_fixed' });
    assert.deepEqual(a.manifest, b.manifest);
    assert.deepEqual(a.notes, b.notes);
  });
});

describe('shot-grammar-first — personality safety', () => {
  it('a grammar the personality forbids is corrected, not emitted raw', () => {
    // brand-teaser product_glimpse template = { medium, low, dynamic_offset }.
    // Under a montage-mapped style, low angle + dynamic_offset are disallowed.
    const { manifest, notes } = planSequence({ scenes: scenesFor(BRAND), style: 'energy', sequence_id: 'seq_t', archetype: 'brand-teaser' });
    const glimpse = manifest.scenes[2].shot_grammar; // product_glimpse
    assert.equal(glimpse.angle, 'eye_level', 'low angle corrected to eye_level for montage');
    assert.equal(glimpse.framing, 'center', 'dynamic_offset corrected to center for montage');
    assert.ok(notes.shot_grammar_corrections && notes.shot_grammar_corrections.length > 0, 'corrections surfaced');
  });
});

describe('shot-grammar-first — no schema drift at the manifest boundary', () => {
  it('every manifest shot_grammar has exactly {shot_size, angle, framing} — no shot_role leak', () => {
    const { manifest } = planSequence({ scenes: scenesFor(FEATURE), style: 'dramatic', sequence_id: 'seq_t', archetype: 'feature-reveal' });
    for (const s of manifest.scenes) {
      assert.ok(s.shot_grammar, 'archetype path stamps shot_grammar');
      assert.deepEqual(Object.keys(s.shot_grammar).sort(), ['angle', 'framing', 'shot_size']);
      assert.ok(!('shot_role' in s.shot_grammar), 'shot_role must not leak into the manifest');
    }
  });
});
