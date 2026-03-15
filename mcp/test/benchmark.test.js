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
import { loadBenchmarks, loadRecipes } from '../data/loader.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function getCatalogs() {
  return { recipes: loadRecipes() };
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
      const timeline = compileMotion(scene, catalogs, {
        personality: scene.personality,
      });

      assert.ok(timeline, `compileMotion returned null for ${scene.scene_id}`);
      assert.ok(timeline.tracks, 'timeline should have tracks');
      assert.ok(timeline.tracks.layers, 'timeline should have layer tracks');
      assert.ok(timeline.duration_frames > 0, 'duration_frames should be positive');
      assert.ok(timeline.fps > 0, 'fps should be positive');
    });
  }
});

// ── Critic score threshold ───────────────────────────────────────────────────

describe('benchmark scenes pass critic', () => {
  const scenes = loadBenchmarks();
  const catalogs = getCatalogs();

  for (const scene of scenes) {
    it(`${scene.scene_id} scores >= ${QUALITY_THRESHOLD}`, () => {
      const timeline = compileMotion(scene, catalogs, {
        personality: scene.personality,
      });
      assert.ok(timeline);

      const critique = critiqueTimeline(timeline, scene);
      assert.ok(
        critique.score >= QUALITY_THRESHOLD,
        `Score ${critique.score} below threshold ${QUALITY_THRESHOLD} for ${scene.scene_id}: ${critique.summary}`
      );
    });

    it(`${scene.scene_id} has no error-severity issues`, () => {
      const timeline = compileMotion(scene, catalogs, {
        personality: scene.personality,
      });
      assert.ok(timeline);

      const critique = critiqueTimeline(timeline, scene);
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
    it(`${scene.scene_id} — all layers have timeline tracks`, () => {
      const timeline = compileMotion(scene, catalogs, {
        personality: scene.personality,
      });
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
