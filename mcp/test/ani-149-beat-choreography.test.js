/**
 * ANI-149 — plan_story_beats consults the choreography discovery layer.
 *
 * The beat planner used to draw recommended_primitives only from each
 * archetype's hand-listed pool, so lib-* compound primitives never reached
 * the autonomous loop without manual injection — even when
 * recommend_choreography knew they were the right answer for the intent +
 * personality. The planner now maps multi-subject reveal roles to
 * choreographic intents and merges the fitting companion-entrance primitives.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { planStoryBeats } from '../lib/story-beats.js';
import { recommendCompanionEntrances } from '../lib/choreography.js';

const isLib = (p) => typeof p === 'string' && p.startsWith('lib-');

function brief(personality, overrides = {}) {
  return {
    inferred_personality: personality,
    duration_target_s: 24,
    features: ['Velocity', 'Precision', 'Clarity', 'Depth'],
    ...overrides,
  };
}

describe('recommendCompanionEntrances (shared choreography core)', () => {
  it('returns lib-* companions for dramatic-reveal under cinematic-dark', () => {
    const prims = recommendCompanionEntrances('dramatic-reveal', 'cinematic-dark');
    assert.ok(prims.includes('lib-gsap-spring-stagger'),
      `expected lib-gsap-spring-stagger, got ${JSON.stringify(prims)}`);
  });

  it('returns [] when the personality is not supported by the intent', () => {
    // dramatic-reveal supports cinematic-dark only.
    assert.deepEqual(recommendCompanionEntrances('dramatic-reveal', 'neutral-light'), []);
  });

  it('returns [] for an unknown intent', () => {
    assert.deepEqual(recommendCompanionEntrances('not-an-intent', 'cinematic-dark'), []);
  });

  it('filters companions to the requested personality', () => {
    // editorial-reveal companions include both editorial and lib-framer entries;
    // none should be cinematic-dark-only.
    const prims = recommendCompanionEntrances('editorial-reveal', 'editorial');
    assert.ok(prims.length > 0);
    assert.ok(prims.includes('lib-framer-spring-stagger'));
  });
});

describe('ANI-149 — beat planner surfaces lib-* via choreography', () => {
  it('feature-reveal under cinematic-dark surfaces a lib-* primitive on the feature_demo beat', () => {
    const result = planStoryBeats({ story_brief: brief('cinematic-dark'), archetype_slug: 'feature-reveal' });
    const featureBeat = result.beats.find(b => b.role === 'feature_demo');
    assert.ok(featureBeat, 'feature_demo beat must exist');
    assert.ok(featureBeat.recommended_primitives.some(isLib),
      `feature_demo should carry a lib-* primitive, got ${JSON.stringify(featureBeat.recommended_primitives)}`);
    assert.equal(featureBeat.choreography_intent, 'dramatic-reveal');
  });

  it('at least one beat across the archetype carries a lib-* primitive', () => {
    const result = planStoryBeats({ story_brief: brief('cinematic-dark'), archetype_slug: 'feature-reveal' });
    const anyLib = result.beats.some(b => b.recommended_primitives.some(isLib));
    assert.ok(anyLib, 'expected at least one lib-* primitive across the beat plan');
  });

  it('preserves the archetype/panel choice at index 0 (companions are appended)', () => {
    const result = planStoryBeats({ story_brief: brief('cinematic-dark'), archetype_slug: 'feature-reveal' });
    for (const beat of result.beats) {
      // Every lib-* addition is appended, never at index 0 unless the archetype
      // already led with it (none do today).
      if (beat.recommended_primitives.length > 1) {
        assert.ok(!isLib(beat.recommended_primitives[0]),
          `index 0 should remain the archetype/panel choice on ${beat.role}`);
      }
    }
  });
});

describe('ANI-149 — no regressions', () => {
  it('neutral-light gets no lib-* primitives (it has none) and no choreography_intent', () => {
    const result = planStoryBeats({ story_brief: brief('neutral-light'), archetype_slug: 'onboarding-explainer' });
    const anyLib = result.beats.some(b => b.recommended_primitives.some(isLib));
    assert.equal(anyLib, false, 'neutral-light must not surface lib-* primitives');
    assert.ok(result.beats.every(b => b.choreography_intent === undefined),
      'neutral-light beats should carry no choreography_intent');
  });

  it('editorial surfaces lib-framer-* (its own compound flavor), not gsap', () => {
    const result = planStoryBeats({ story_brief: brief('editorial'), archetype_slug: 'feature-reveal' });
    const libs = result.beats.flatMap(b => b.recommended_primitives.filter(isLib));
    assert.ok(libs.length > 0, 'editorial should still surface its lib-framer-* primitives');
    assert.ok(libs.every(p => !p.startsWith('lib-gsap')),
      `editorial must not get gsap (cinematic-dark) primitives, got ${JSON.stringify(libs)}`);
  });

  it('no personality → no choreography merge, beat shape unchanged', () => {
    const result = planStoryBeats({
      story_brief: { duration_target_s: 24, features: ['A', 'B'] },
      archetype_slug: 'feature-reveal',
    });
    assert.ok(result.beats.every(b => b.choreography_intent === undefined));
    assert.ok(result.beats.every(b => !b.recommended_primitives.some(isLib)),
      'without a personality, no companions should be merged');
  });
});
