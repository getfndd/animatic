/**
 * Contract tests for the reactive-aware motion critic (ANI-146).
 *
 * The critic now inspects scenes that reference library-driven (`lib-*`)
 * compound primitives — these have no Level-2 (frame-addressed)
 * representation, so the static-track rules in critic.js are blind to
 * them. The reactive checks operate on scene + catalog directly and run
 * whenever `options.catalogs.primitives` is supplied to critiqueTimeline.
 *
 * History: this file started as `lib-reactive-critic-gap.test.js` in
 * PR #52, which pinned the silent-pass behavior with characterization
 * assertions. Those assertions are now flipped: each pathway that
 * previously returned score 100 / no issues now produces concrete
 * issues with the rule names asserted below.
 *
 * Backwards compatibility: when callers omit `options.catalogs`, the
 * critic falls back to the historical behavior (no reactive checks).
 * That path is also exercised here so existing call sites that don't
 * pass catalogs aren't broken by the upgrade.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadPrimitivesCatalog, loadRecipes } from '../data/loader.js';
import { compileMotion } from '../lib/compiler.js';
import { critiqueTimeline } from '../lib/critic.js';

const LIB_SLUG = 'lib-gsap-spring-stagger';

function makeCatalogs() {
  return {
    primitives: loadPrimitivesCatalog(),
    recipes: loadRecipes(),
  };
}

function findIssue(critique, rule) {
  return critique.issues.find(i => i.rule === rule);
}

describe('reactive-aware critic (ANI-146)', () => {
  const catalogs = makeCatalogs();
  const criticOptions = { catalogs, personality: 'cinematic-dark' };

  it('catalog loads the lib-* slug used by these tests', () => {
    assert.ok(catalogs.primitives.bySlug.has(LIB_SLUG));
  });

  // ── Path A: motion.compound + mode: 'reactive' ─────────────────────────

  describe('Path A — motion.compound + mode: reactive', () => {
    function makeReactiveScene(overrides = {}) {
      return {
        scene_id: 'sc_reactive',
        fps: 60,
        duration_s: 4,
        layers: [
          { id: 'card_1', type: 'html', content: 'Card 1' },
          { id: 'card_2', type: 'html', content: 'Card 2' },
          { id: 'card_3', type: 'html', content: 'Card 3' },
          { id: 'card_4', type: 'html', content: 'Card 4' },
        ],
        motion: {
          compound: LIB_SLUG,
          compound_config: { stagger_ms: 80, hold_ms: 1500 },
          content_count: 4,
          ...overrides,
        },
      };
    }

    it('happy path: matched personality + valid config produces no reactive issues', () => {
      const scene = makeReactiveScene();
      const timeline = compileMotion(scene, catalogs, { mode: 'reactive', personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      const reactiveRules = [
        'reactive_compound_unknown',
        'reactive_personality_mismatch',
        'reactive_unknown_config_key',
        'reactive_boot_dominates_duration',
      ];
      for (const rule of reactiveRules) {
        assert.equal(findIssue(critique, rule), undefined, `expected no ${rule} issue`);
      }
    });

    it('emits reactive_personality_mismatch when scene personality is outside affinity', () => {
      const scene = makeReactiveScene();
      const timeline = compileMotion(scene, catalogs, { mode: 'reactive', personality: 'neutral-light' });
      const critique = critiqueTimeline(timeline, scene, undefined, {
        ...criticOptions,
        personality: 'neutral-light',
      });
      const issue = findIssue(critique, 'reactive_personality_mismatch');
      assert.ok(issue, 'expected reactive_personality_mismatch issue');
      assert.equal(issue.severity, 'warning');
      assert.match(issue.message, /neutral-light/);
      assert.match(issue.message, new RegExp(LIB_SLUG));
      assert.ok(critique.score < 100, 'score should drop below 100');
    });

    it('emits reactive_unknown_config_key for typo\'d config keys', () => {
      const scene = makeReactiveScene({
        compound_config: { stagger_ms: 80, staggerMs: 80, holdMs: 1500 },
      });
      const timeline = compileMotion(scene, catalogs, { mode: 'reactive', personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      const issues = critique.issues.filter(i => i.rule === 'reactive_unknown_config_key');
      assert.equal(issues.length, 2, 'one issue per unknown key');
      const flaggedKeys = issues.map(i => i.message.match(/key "([^"]+)"/)?.[1]).sort();
      assert.deepEqual(flaggedKeys, ['holdMs', 'staggerMs']);
    });

    it('emits reactive_compound_unknown when slug is not in catalog', () => {
      const scene = makeReactiveScene({ compound: 'lib-gsap-spring-staggar' });
      const timeline = compileMotion(scene, catalogs, { mode: 'reactive', personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      const issue = findIssue(critique, 'reactive_compound_unknown');
      assert.ok(issue, 'expected reactive_compound_unknown issue');
      assert.equal(issue.severity, 'error');
      assert.match(issue.message, /lib-gsap-spring-staggar/);
    });

    it('emits reactive_boot_dominates_duration when scene is too short for boot_ms', () => {
      // lib-gsap-spring-stagger.capture_contract.boot_ms is 600. At the 25%
      // ratio limit a 1.5s scene blows past the threshold (600/1500 = 40%).
      const scene = makeReactiveScene();
      scene.duration_s = 1.5;
      const timeline = compileMotion(scene, catalogs, { mode: 'reactive', personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      const issue = findIssue(critique, 'reactive_boot_dominates_duration');
      assert.ok(issue, 'expected reactive_boot_dominates_duration issue');
      assert.equal(issue.severity, 'warning');
    });

    it('backwards compat: critiqueTimeline without catalogs still returns the historical silent verdict', () => {
      const scene = makeReactiveScene();
      const timeline = compileMotion(scene, catalogs, { mode: 'reactive', personality: 'neutral-light' });
      const critique = critiqueTimeline(timeline, scene); // no options
      assert.equal(critique.score, 100);
      assert.deepEqual(critique.issues, []);
      assert.match(critique.summary, /No timeline to critique/);
    });
  });

  // ── Path B: layer.entrance.primitive ───────────────────────────────────

  describe('Path B — layer.entrance.primitive', () => {
    const scene = {
      scene_id: 'sc_lib_entrance',
      fps: 60,
      duration_s: 4,
      layers: [
        { id: 'card_1', type: 'html', content: 'Card 1', entrance: { primitive: LIB_SLUG, delay_ms: 0 } },
        { id: 'card_2', type: 'html', content: 'Card 2', entrance: { primitive: LIB_SLUG, delay_ms: 80 } },
        { id: 'card_3', type: 'html', content: 'Card 3', entrance: { primitive: LIB_SLUG, delay_ms: 160 } },
        { id: 'card_4', type: 'html', content: 'Card 4', entrance: { primitive: LIB_SLUG, delay_ms: 240 } },
      ],
      motion: { groups: [], camera: { moves: [{ move: 'static' }] } },
    };

    it('emits lib_primitive_static_path errors for each layer using a lib-* entrance', () => {
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      const issues = critique.issues.filter(i => i.rule === 'lib_primitive_static_path');
      assert.equal(issues.length, 4, 'one per layer with a lib-* entrance');
      for (const issue of issues) {
        assert.equal(issue.severity, 'error');
        assert.match(issue.message, /static-compile path/);
      }
    });

    it('suggestion points to the reactive route', () => {
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      const issue = critique.issues.find(i => i.rule === 'lib_primitive_static_path');
      assert.match(issue.suggestion, /motion\.compound/);
      assert.match(issue.suggestion, /reactive/);
    });
  });

  // ── Path C: motion.groups[].primitive ──────────────────────────────────

  describe('Path C — motion.groups[].primitive', () => {
    const scene = {
      scene_id: 'sc_lib_group',
      fps: 60,
      duration_s: 4,
      layers: [
        { id: 'card_1', type: 'html', content: 'Card 1' },
        { id: 'card_2', type: 'html', content: 'Card 2' },
        { id: 'card_3', type: 'html', content: 'Card 3' },
        { id: 'card_4', type: 'html', content: 'Card 4' },
      ],
      motion: {
        groups: [{
          id: 'cards',
          targets: ['card_1', 'card_2', 'card_3', 'card_4'],
          primitive: LIB_SLUG,
          stagger: { interval_ms: 80 },
        }],
        camera: { moves: [{ move: 'static' }] },
      },
    };

    it('emits lib_primitive_static_path error for the offending group', () => {
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      const issue = critique.issues.find(i => i.rule === 'lib_primitive_static_path');
      assert.ok(issue);
      assert.equal(issue.severity, 'error');
      assert.match(issue.message, /motion\.groups/);
      assert.match(issue.message, new RegExp(LIB_SLUG));
    });
  });

  // ── Non-lib primitives are unaffected ──────────────────────────────────

  describe('engine primitives still pass cleanly through the reactive checks', () => {
    it('motion.groups with a non-lib primitive does not emit lib_primitive_static_path', () => {
      const scene = {
        scene_id: 'sc_engine',
        fps: 60,
        duration_s: 3,
        layers: [{ id: 'hero', type: 'text' }],
        motion: {
          groups: [{ targets: ['hero'], primitive: 'cd-focus-stagger' }],
          camera: { moves: [{ move: 'static' }] },
        },
      };
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene, undefined, criticOptions);
      assert.equal(findIssue(critique, 'lib_primitive_static_path'), undefined);
    });
  });
});
