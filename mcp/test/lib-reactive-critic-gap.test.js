/**
 * Characterization test for a known gap in the compile/critic chain
 * when scenes reference library-driven (`lib-*`) compound primitives.
 *
 * The discovery layer (recommend_choreography, search_primitives) wires
 * `lib-*` entries through correctly (#45–#51). The render-routing layer
 * routes them to browser_capture so the GSAP/Framer adapter can run them
 * at capture time. What's missing is the *quality gate* in between:
 * `compileMotion` → `critiqueTimeline` is silent or misleading for these
 * scenes, because `lib-*` primitives have no Level-2 (frame-addressed)
 * representation — their behavior lives at runtime in the adapter, not
 * in keyframe data.
 *
 * This file pins the current behavior across the three pathways a scene
 * can reference a `lib-*` primitive. Tests pass today; the goal is that
 * when the reactive-scene critic lands, these assertions flip and force
 * the implementer to confirm intent.
 *
 * TODO(ANI-XXX): replace these assertions with the new contract once a
 * scene-level critic for reactive output exists. See conversation notes
 * for design (personality affinity, config-key validation against
 * `config_schema`, capture_contract sanity, library/personality compat).
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

describe('compile/critic chain — known gap for lib-* primitives', () => {
  const catalogs = makeCatalogs();

  it('catalog loads the lib-* slug used by these tests', () => {
    assert.ok(
      catalogs.primitives.bySlug.has(LIB_SLUG),
      `${LIB_SLUG} must be present — these tests pin behavior against a real entry`
    );
  });

  // ── Path A: motion.compound + mode: 'reactive' ─────────────────────────
  // Compiler emits a reactive descriptor (init/step are resolved at runtime
  // by usePhysicsEngine), so there is nothing for the static critic to look
  // at. critiqueTimeline short-circuits at the !timeline.tracks guard
  // (mcp/lib/critic.js:59) and returns score=100 with no issues — every
  // reactive scene gets a free perfect score.

  describe('Path A — motion.compound + mode: reactive', () => {
    const scene = {
      scene_id: 'sc_lib_reactive',
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
      },
    };

    it('compileMotion returns a reactive descriptor without tracks', () => {
      const result = compileMotion(scene, catalogs, {
        mode: 'reactive',
        personality: 'cinematic-dark',
      });
      assert.equal(result.mode, 'reactive');
      assert.equal(result.compound, LIB_SLUG);
      assert.ok(!('tracks' in result), 'reactive output must not carry tracks');
    });

    it('critiqueTimeline silently passes any reactive scene with score 100', () => {
      const timeline = compileMotion(scene, catalogs, {
        mode: 'reactive',
        personality: 'cinematic-dark',
      });
      const critique = critiqueTimeline(timeline, scene);
      // This is the gap — it asserts the broken-by-design state so a fix
      // is forced to update the contract intentionally.
      assert.equal(critique.score, 100, 'gap: reactive scenes auto-pass');
      assert.deepEqual(critique.issues, [], 'gap: critic surfaces nothing');
      assert.match(critique.summary, /No timeline to critique/i);
    });

    it('a reactive scene with personality-affinity mismatch ALSO auto-passes', () => {
      // lib-gsap-spring-stagger declares affinity for cinematic-dark + editorial.
      // Compiling it under neutral-light should be flagged — it currently isn't.
      const result = compileMotion(scene, catalogs, {
        mode: 'reactive',
        personality: 'neutral-light',
      });
      const critique = critiqueTimeline(result, scene);
      assert.equal(
        critique.score,
        100,
        'gap: personality-affinity mismatch silent at critic layer'
      );
      assert.equal(critique.issues.length, 0);
    });
  });

  // ── Path B: layer.entrance.primitive ───────────────────────────────────
  // Static compile path: each layer carries an entrance with a lib-* slug.
  // Compiler returns a timeline shape, but the layer track map is empty —
  // the static expander has no keyframe data for lib-* slugs and produces
  // no per-layer tracks. The critic then runs against an empty tracks
  // object and reports orphan-layer warnings (the symptom), not the root
  // cause (the unsupported slug).

  describe('Path B — layer.entrance.primitive (static)', () => {
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

    it('compileMotion produces a timeline shape with empty layer tracks', () => {
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      assert.ok(timeline?.tracks, 'should have a tracks object');
      assert.deepEqual(
        Object.keys(timeline.tracks.layers),
        [],
        'gap: lib-* on entrance path expands to no layer tracks'
      );
    });

    it('critic runs against the empty timeline without flagging the unsupported primitive', () => {
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene);
      // The critic surfaces *something* (orphan-layer warnings) but never
      // identifies the underlying cause — that the entrance primitive isn't
      // expandable. A reactive-aware critic should report this directly.
      const mentionsLibSlug = critique.issues.some(i =>
        (i.message || '').includes(LIB_SLUG)
      );
      assert.equal(
        mentionsLibSlug,
        false,
        'gap: critic never names the unsupported lib-* primitive'
      );
    });
  });

  // ── Path C: motion.groups[].primitive (group-driven) ───────────────────
  // The most insidious case: the static expander falls back to generic
  // opacity/translateY keyframes when it can't resolve specific data for
  // the slug. Critic runs and produces a plausible-looking score against
  // *fabricated* motion that bears no relation to the real GSAP timeline.

  describe('Path C — motion.groups[].primitive (group-driven static)', () => {
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

    it('compileMotion fabricates generic opacity/translateY tracks for lib-* slugs', () => {
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      const layerKeys = Object.keys(timeline.tracks.layers);
      assert.deepEqual(layerKeys.sort(), ['card_1', 'card_2', 'card_3', 'card_4']);
      const props = Object.keys(timeline.tracks.layers.card_1);
      // The "motion" the critic sees is a fabrication — generic fallback
      // properties, not a representation of the GSAP back.out + counter
      // tween + reverse stagger that actually runs at capture time.
      assert.deepEqual(
        props.sort(),
        ['opacity', 'translateY'],
        'gap: lib-* falls back to a 2-property opacity/translateY stub'
      );
    });

    it('critic scores the fabricated timeline as if it were the real motion', () => {
      const timeline = compileMotion(scene, catalogs, { personality: 'cinematic-dark' });
      const critique = critiqueTimeline(timeline, scene);
      // Score range pinned loosely — the value isn't the point; the point
      // is that a number gets emitted for motion that doesn't exist.
      assert.ok(
        typeof critique.score === 'number' && critique.score >= 70,
        'gap: critic emits a confident score against fabricated motion'
      );
      const mentionsLibSlug = critique.issues.some(i =>
        (i.message || '').includes(LIB_SLUG)
      );
      assert.equal(
        mentionsLibSlug,
        false,
        'gap: critic does not flag that the real primitive is library-driven'
      );
    });
  });
});
