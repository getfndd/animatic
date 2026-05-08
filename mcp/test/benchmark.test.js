/**
 * Benchmark suite tests — ANI-66
 *
 * Verifies that all gold-standard benchmark scenes compile without errors,
 * pass the critic with score >= 70, and have no orphan layers.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/benchmark.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runBenchmarks, QUALITY_THRESHOLD } from '../lib/benchmark.js';
import { compileMotion } from '../lib/compiler.js';
import { critiqueTimeline } from '../lib/critic.js';
import { loadBenchmarks, loadRecipes, loadPrimitivesCatalog } from '../data/loader.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function getCatalogs() {
  return { recipes: loadRecipes(), primitives: loadPrimitivesCatalog() };
}

/**
 * Compile a benchmark scene, picking reactive vs static mode based on
 * whether the scene declares motion.compound (lib-* / bd-* primitive).
 * Mirrors runSingleBenchmark in mcp/lib/benchmark.js so the standalone
 * test loops stay aligned with what the runner does.
 */
function compileBenchmarkScene(scene, catalogs) {
  const isReactive = !!scene.motion?.compound;
  return compileMotion(scene, catalogs, {
    personality: scene.personality,
    ...(isReactive ? { mode: 'reactive' } : {}),
  });
}

function getBenchmarks() {
  const scenes = loadBenchmarks();
  assert.ok(scenes.length >= 4, `Expected at least 4 benchmark scenes, got ${scenes.length}`);
  return scenes;
}

// ── Individual scene compilation ─────────────────────────────────────────────

describe('benchmark scenes compile without errors', () => {
  const scenes = loadBenchmarks();
  const catalogs = getCatalogs();

  for (const scene of scenes) {
    it(`${scene.scene_id} compiles successfully`, () => {
      const timeline = compileBenchmarkScene(scene, catalogs);
      assert.ok(timeline, `compileMotion returned null for ${scene.scene_id}`);

      if (scene.motion?.compound) {
        // Reactive descriptor — no tracks, just the primitive + config.
        assert.equal(timeline.mode, 'reactive');
        assert.equal(timeline.compound, scene.motion.compound);
        assert.ok(timeline.durationFrames > 0);
        assert.ok(timeline.fps > 0);
      } else {
        assert.ok(timeline.tracks, 'timeline should have tracks');
        assert.ok(timeline.tracks.layers, 'timeline should have layer tracks');
        assert.ok(timeline.duration_frames > 0, 'duration_frames should be positive');
        assert.ok(timeline.fps > 0, 'fps should be positive');
      }
    });
  }
});

// ── Critic score threshold ───────────────────────────────────────────────────

describe('benchmark scenes pass critic', () => {
  const scenes = loadBenchmarks();
  const catalogs = getCatalogs();

  for (const scene of scenes) {
    it(`${scene.scene_id} scores >= ${QUALITY_THRESHOLD}`, () => {
      const timeline = compileBenchmarkScene(scene, catalogs);
      assert.ok(timeline);

      // Pass catalogs so the reactive-aware critic (ANI-146) runs for
      // lib-* / bd-* benchmark scenes — without it they auto-pass at 100.
      const critique = critiqueTimeline(timeline, scene, undefined, { catalogs });
      assert.ok(
        critique.score >= QUALITY_THRESHOLD,
        `Score ${critique.score} below threshold ${QUALITY_THRESHOLD} for ${scene.scene_id}: ${critique.summary}`
      );
    });

    it(`${scene.scene_id} has no error-severity issues`, () => {
      const timeline = compileBenchmarkScene(scene, catalogs);
      assert.ok(timeline);

      const critique = critiqueTimeline(timeline, scene, undefined, { catalogs });
      const errors = critique.issues.filter(i => i.severity === 'error');
      assert.equal(
        errors.length,
        0,
        `${scene.scene_id} has ${errors.length} error-severity issues: ${errors.map(e => e.rule).join(', ')}`
      );
    });
  }
});

// ── Orphan layer detection ───────────────────────────────────────────────────

describe('benchmark scenes have no orphan layers', () => {
  const scenes = loadBenchmarks();
  const catalogs = getCatalogs();

  for (const scene of scenes) {
    // Reactive scenes have no tracks by design (the runtime adapter is
    // the timeline) — the orphan check is a static-path concern only.
    if (scene.motion?.compound) continue;

    it(`${scene.scene_id} — all layers have timeline tracks`, () => {
      const timeline = compileBenchmarkScene(scene, catalogs);
      assert.ok(timeline);

      const layerIds = scene.layers.map(l => l.id);
      const trackedIds = Object.keys(timeline.tracks.layers);
      const orphans = layerIds.filter(id => !trackedIds.includes(id));

      assert.equal(
        orphans.length,
        0,
        `Orphan layers in ${scene.scene_id}: ${orphans.join(', ')}`
      );
    });
  }
});

// ── Aggregate stats ──────────────────────────────────────────────────────────

describe('runBenchmarks aggregate stats', () => {
  it('computes correct aggregate statistics', () => {
    const scenes = getBenchmarks();
    const catalogs = getCatalogs();
    const report = runBenchmarks(scenes, catalogs);

    assert.ok(report.scenes.length >= 4, 'Expected at least 4 scene results');
    assert.ok(report.aggregate, 'Expected aggregate stats');

    // avgScore should be the mean
    const expectedAvg = Math.round(
      report.scenes.reduce((sum, s) => sum + s.score, 0) / report.scenes.length
    );
    assert.equal(report.aggregate.avgScore, expectedAvg, 'avgScore should match computed mean');

    // min/max bounds
    assert.ok(report.aggregate.minScore <= report.aggregate.maxScore, 'min <= max');
    assert.ok(report.aggregate.minScore >= 0, 'min >= 0');
    assert.ok(report.aggregate.maxScore <= 100, 'max <= 100');

    // pass + fail = total
    assert.equal(
      report.aggregate.passCount + report.aggregate.failCount,
      report.scenes.length,
      'passCount + failCount should equal total scenes'
    );

    // All benchmark scenes should pass
    assert.equal(
      report.aggregate.failCount,
      0,
      `${report.aggregate.failCount} benchmark scene(s) failed: ${report.scenes.filter(s => !s.pass).map(s => s.scene_id).join(', ')}`
    );
  });
});

// ── Edge case: invalid scene ─────────────────────────────────────────────────

describe('benchmark runner handles invalid scenes', () => {
  it('handles a scene with no motion block gracefully', () => {
    const invalidScene = {
      scene_id: 'bench_invalid',
      duration_s: 3,
      fps: 60,
      format_version: 2,
      layers: [{ id: 'layer-a', type: 'text', depth_class: 'foreground' }],
      // no motion block
    };

    const report = runBenchmarks([invalidScene], getCatalogs());

    assert.equal(report.scenes.length, 1);
    assert.equal(report.scenes[0].pass, false, 'Scene without motion should fail');
    assert.ok(report.scenes[0].compileError, 'Should have a compile error message');
  });

  it('handles empty benchmark list', () => {
    const report = runBenchmarks([], getCatalogs());

    assert.equal(report.scenes.length, 0);
    assert.equal(report.aggregate.avgScore, 0);
    assert.equal(report.aggregate.passCount, 0);
    assert.equal(report.aggregate.failCount, 0);
  });
});

// ── Library-driven (lib-*) end-to-end benchmark ─────────────────────────────
// Closes the loop on the compound-js library-driven tier (#45–#54). The
// scene exercises all three layers in one shot: discovery (the primitive
// is registered + reachable), routing (motion.compound keeps render-routing
// reactive-aware), and the ANI-146 reactive critic (matched personality,
// valid config keys, boot_ms within duration → no warnings, no errors).
describe('lib-* end-to-end benchmark — full stack happy path', () => {
  const scenes = loadBenchmarks();
  const catalogs = getCatalogs();
  const libBench = scenes.find(s => s.scene_id === 'bench_cinematic_dark_lib_stagger');

  it('the lib-* benchmark scene is loaded from the catalog', () => {
    assert.ok(libBench, 'expected bench_cinematic_dark_lib_stagger to be in catalog/benchmarks/');
    assert.equal(libBench.motion?.compound, 'lib-gsap-spring-stagger');
    assert.equal(libBench.personality, 'cinematic-dark');
  });

  it('compiles to a reactive descriptor that carries personality forward', () => {
    const timeline = compileBenchmarkScene(libBench, catalogs);
    assert.equal(timeline.mode, 'reactive');
    assert.equal(timeline.compound, 'lib-gsap-spring-stagger');
    assert.equal(timeline.personality, 'cinematic-dark');
    // Catalog defaults merged with scene overrides:
    assert.equal(timeline.config.stagger_ms, 90);
    assert.equal(timeline.config.entrance_ease, 'back.out(1.7)');
    assert.equal(timeline.config.hold_ms, 1500);
  });

  it('reactive critic produces a clean verdict (no warnings, no errors)', () => {
    const timeline = compileBenchmarkScene(libBench, catalogs);
    const critique = critiqueTimeline(timeline, libBench, undefined, { catalogs });
    const reactiveRules = [
      'reactive_compound_unknown',
      'reactive_personality_mismatch',
      'reactive_unknown_config_key',
      'reactive_boot_dominates_duration',
      'lib_primitive_static_path',
    ];
    for (const rule of reactiveRules) {
      const hit = critique.issues.find(i => i.rule === rule);
      assert.equal(hit, undefined, `expected no ${rule} on the happy-path benchmark`);
    }
    assert.equal(critique.score, 100, 'happy path should score 100 — no warnings deduct');
  });

  it('runs through runBenchmarks and passes', () => {
    const report = runBenchmarks([libBench], catalogs);
    const result = report.scenes[0];
    assert.equal(result.compileError, null);
    assert.equal(result.pass, true,
      `expected pass=true; got score=${result.score}, issues=${result.issues.map(i => i.rule).join(',')}`);
    assert.equal(result.orphanLayers.length, 0, 'orphan check should be skipped for reactive scenes');
  });
});
