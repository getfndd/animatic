/**
 * ANI-148 — lib-* compound tier must reach the autonomous direction loop.
 *
 * PRs #52–#56 hardened the reactive (lib-*) compound primitive tier, but the
 * benchmark runner was the *only* caller that detected `motion.compound` and
 * compiled with `mode: 'reactive'`. The compile_motion MCP tool and the
 * scoring chain compiled compound scenes statically, yielding a zero-track
 * timeline and (for scoring) a flood of bogus `orphan_layer` warnings the
 * revision loop would chase.
 *
 * These tests pin both gaps against the shared `isReactiveScene` detector:
 *   Gap A — compound scene compiles to a reactive descriptor, not zero tracks.
 *   Gap B — scoreCandidateVideo emits 0 orphan_layer on a compound scene.
 * Plus a no-regression guard proving static scenes still flag orphan layers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadPrimitivesCatalog, loadRecipes } from '../data/loader.js';
import { compileMotion, isReactiveScene } from '../lib/compiler.js';
import { critiqueScene } from '../lib/critic.js';
import { scoreCandidateVideo } from '../lib/scoring.js';

const LIB_SLUG = 'lib-gsap-spring-stagger';

function makeCatalogs() {
  return { primitives: loadPrimitivesCatalog(), recipes: loadRecipes() };
}

// Five bare layers with no entrance and no motion.groups: under a static
// compile these have no tracks and read as orphans. The compound primitive
// is what animates them at capture time.
function makeCompoundScene(overrides = {}) {
  return {
    scene_id: 'sc_compound',
    fps: 60,
    duration_s: 2.5,
    personality: 'cinematic-dark',
    product_role: 'result',
    layers: [
      { id: 'card_1', type: 'html', product_role: 'hero', content: 'Velocity' },
      { id: 'card_2', type: 'html', content: 'Precision' },
      { id: 'card_3', type: 'html', content: 'Clarity' },
      { id: 'card_4', type: 'html', content: 'Depth' },
      { id: 'card_5', type: 'html', content: 'Focus' },
    ],
    motion: { compound: LIB_SLUG, content_count: 5 },
    ...overrides,
  };
}

// A static scene whose layers carry no tracks and no compound — these SHOULD
// still be flagged as orphans (the detection we must not regress).
function makeStaticOrphanScene() {
  return {
    scene_id: 'sc_static',
    fps: 60,
    duration_s: 3,
    personality: 'cinematic-dark',
    layers: [
      { id: 'orphan_a', type: 'html', content: 'A' },
      { id: 'orphan_b', type: 'html', content: 'B' },
    ],
    motion: { groups: [] },
  };
}

function orphanIssues(critique) {
  return critique.issues.filter(i => i.rule === 'orphan_layer');
}

describe('ANI-148 — lib-* tier reaches the direction loop', () => {
  const catalogs = makeCatalogs();

  it('the lib-* slug under test is registered', () => {
    assert.ok(catalogs.primitives.bySlug.has(LIB_SLUG));
  });

  describe('isReactiveScene detector', () => {
    it('is true when motion.compound is present', () => {
      assert.equal(isReactiveScene(makeCompoundScene()), true);
    });
    it('is false for static scenes (no compound)', () => {
      assert.equal(isReactiveScene(makeStaticOrphanScene()), false);
    });
    it('is false for null/undefined and motionless scenes', () => {
      assert.equal(isReactiveScene(undefined), false);
      assert.equal(isReactiveScene({}), false);
      assert.equal(isReactiveScene({ motion: { groups: [] } }), false);
    });
  });

  describe('Gap A — compile_motion path returns a reactive descriptor', () => {
    it('compound scene compiled with auto-detected mode is reactive, not zero-track static', () => {
      const scene = makeCompoundScene();
      // Mirror handleCompileMotion / the scoring chain's call shape.
      const timeline = compileMotion(scene, catalogs,
        isReactiveScene(scene) ? { mode: 'reactive', personality: scene.personality } : {});

      assert.equal(timeline.mode, 'reactive');
      assert.equal(timeline.compound, LIB_SLUG);
      assert.equal(timeline.contentCount, 5);
      assert.ok(timeline.durationFrames > 0);
      assert.equal(timeline.tracks, undefined, 'reactive descriptor must carry no Level-2 tracks');
    });

    it('characterizes the old bug: a compound scene compiled statically yields zero tracks', () => {
      const scene = makeCompoundScene();
      const stat = compileMotion(scene, catalogs, {}); // no mode → static path
      const trackCount = Object.values(stat.tracks?.layers || {})
        .reduce((n, t) => n + Object.keys(t).length, 0);
      assert.equal(trackCount, 0, 'static compile of a compound scene produces no tracks (the bug)');
    });

    it('static scenes still compile to a Level-2 timeline (no regression)', () => {
      const scene = makeStaticOrphanScene();
      const timeline = compileMotion(scene, catalogs,
        isReactiveScene(scene) ? { mode: 'reactive' } : {});
      assert.notEqual(timeline.mode, 'reactive');
      assert.ok(timeline.tracks, 'static scene must produce a tracks object');
    });
  });

  describe('Gap B — scoring no longer flags compound layers as orphans', () => {
    it('reactive descriptor + catalogs → 0 orphan_layer; static compile of same scene → orphans (proof the fix matters)', () => {
      const scene = makeCompoundScene();

      const reactive = compileMotion(scene, catalogs, { mode: 'reactive', personality: 'cinematic-dark' });
      const reactiveCritique = critiqueScene(reactive, scene, { catalogs });
      assert.equal(orphanIssues(reactiveCritique).length, 0,
        'reactive descriptor skips the static orphan-layer check');

      const stat = compileMotion(scene, catalogs, {});
      const staticCritique = critiqueScene(stat, scene, { catalogs });
      assert.ok(orphanIssues(staticCritique).length > 0,
        'the old static path flagged the compound layers as orphans');
    });

    it('scoreCandidateVideo produces 0 orphan_layer on the compound scene', () => {
      const scenes = [makeCompoundScene(), makeStaticOrphanScene()];
      const manifest = {
        sequence_id: 'seq_ani_148',
        fps: 60,
        personality: 'cinematic-dark',
        scenes: [{ scene: 'sc_compound' }, { scene: 'sc_static' }],
      };

      const card = scoreCandidateVideo({ manifest, scenes });
      const compoundCritic = card.raw.critic_per_scene.find(c => c.scene_id === 'sc_compound');
      assert.ok(compoundCritic, 'compound scene must appear in critic_per_scene');
      const orphans = (compoundCritic.issues || []).filter(i => i.rule === 'orphan_layer');
      assert.equal(orphans.length, 0, 'compound scene must not be flagged as orphan_layer (was 5)');
    });

    it("video.js Stage 4/5 loop shape: compile-with-detection then critiqueScene → 0 orphan_layer", () => {
      // Mirrors generateVideo()'s compile (line 201) + critique (line 217)
      // for a compound scene. generateVideo can't be coerced to emit a
      // compound scene from a prompt, so we pin the loop's logic directly.
      const scene = makeCompoundScene();
      const timeline = compileMotion(scene, catalogs,
        isReactiveScene(scene) ? { mode: 'reactive' } : {});
      const critique = critiqueScene(timeline, scene, { catalogs });
      assert.equal(timeline.mode, 'reactive');
      assert.equal(orphanIssues(critique).length, 0,
        'video.js critique must not flag compound layers as orphans');
    });

    it('no regression: a genuine static orphan scene is still flagged through scoring', () => {
      const scenes = [makeStaticOrphanScene()];
      const manifest = {
        sequence_id: 'seq_ani_148_static',
        fps: 60,
        personality: 'cinematic-dark',
        scenes: [{ scene: 'sc_static' }],
      };

      const card = scoreCandidateVideo({ manifest, scenes });
      const staticCritic = card.raw.critic_per_scene.find(c => c.scene_id === 'sc_static');
      assert.ok(staticCritic, 'static scene must appear in critic_per_scene');
      const orphans = (staticCritic.issues || []).filter(i => i.rule === 'orphan_layer');
      assert.ok(orphans.length > 0, 'static orphan layers must still be flagged');
    });
  });
});
