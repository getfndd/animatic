/**
 * Benchmark Runner — ANI-66
 *
 * Loads gold-standard benchmark scenes from catalog/benchmarks/,
 * compiles each through the motion compiler, runs the critic,
 * and returns a structured report with per-scene scores and aggregates.
 *
 * Pure functions. Catalog data passed in, no side effects.
 */

import { compileMotion } from './compiler.js';
import { critiqueTimeline } from './critic.js';

// ── Constants ────────────────────────────────────────────────────────────────

const QUALITY_THRESHOLD = 70;

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run the full benchmark suite against a set of benchmark scenes.
 *
 * @param {object[]} benchmarkScenes - Array of v2 scene definitions from catalog/benchmarks/
 * @param {object} catalogs - { recipes: { byId } } — same format as compiler expects
 * @returns {{ scenes: Array, aggregate: { avgScore, minScore, maxScore, passCount, failCount } }}
 */
export function runBenchmarks(benchmarkScenes, catalogs = {}) {
  const results = [];

  for (const scene of benchmarkScenes) {
    results.push(runSingleBenchmark(scene, catalogs));
  }

  const scores = results.map(r => r.score);
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.length - passCount;

  return {
    scenes: results,
    aggregate: {
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      passCount,
      failCount,
    },
  };
}

// ── Single Scene Benchmark ───────────────────────────────────────────────────

/**
 * Run a single benchmark: compile + critique + evaluate pass/fail.
 *
 * @param {object} scene - A v2 scene definition
 * @param {object} catalogs - { recipes }
 * @returns {{ scene_id, personality, pass, score, compileError, issues, orphanLayers }}
 */
function runSingleBenchmark(scene, catalogs) {
  const result = {
    scene_id: scene.scene_id,
    personality: scene.personality || 'unknown',
    pass: false,
    score: 0,
    compileError: null,
    issues: [],
    orphanLayers: [],
  };

  // Step 1: Compile
  let timeline;
  try {
    timeline = compileMotion(scene, catalogs, {
      personality: scene.personality,
    });
  } catch (err) {
    result.compileError = err.message;
    return result;
  }

  if (!timeline) {
    result.compileError = 'No motion block — compilation returned null';
    return result;
  }

  // Step 2: Check for orphan layers (layers without tracks)
  const layerIds = (scene.layers || []).map(l => l.id);
  const trackedIds = Object.keys(timeline.tracks.layers || {});
  result.orphanLayers = layerIds.filter(id => !trackedIds.includes(id));

  // Step 3: Run critic
  const critique = critiqueTimeline(timeline, scene);
  result.score = critique.score;
  result.issues = critique.issues;

  // Step 4: Evaluate pass/fail
  const hasErrorSeverity = critique.issues.some(i => i.severity === 'error');
  const meetsThreshold = critique.score >= QUALITY_THRESHOLD;
  const noOrphans = result.orphanLayers.length === 0;

  result.pass = !result.compileError && meetsThreshold && !hasErrorSeverity && noOrphans;

  return result;
}

// ── Exports ──────────────────────────────────────────────────────────────────

export { QUALITY_THRESHOLD };
