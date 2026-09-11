#!/usr/bin/env node
/**
 * Repro: auditMotionDensity cannot see compileMotion's real (non-reactive)
 * timeline shape.
 *
 * Background (ANI-210/ANI-211 gate-seam plan, docs/process/ani-210-211-gate-seam-plan.md):
 * mcp/lib/motion-density.js's normalizeLayers() only reads `timeline.layers`
 * as an array. compileMotion() (mcp/lib/compiler.js) has never produced that
 * shape for a non-reactive scene — its real return is
 * `{ tracks: { camera, layers: { <id>: { <prop>: [keyframes] } } } }`
 * (compiler.js's own JSDoc union type). So every real compiled timeline
 * falls through to motion-density.js's `scene.layers` fallback, whose
 * entries carry no `.keyframes`/`.animations`, producing an empty activity
 * map and a density score of 0 regardless of how much real motion the scene
 * has. Reactive/compound scenes (isReactiveScene() true) are a SEPARATE,
 * unrelated gap: compileMotion in `{mode:'reactive'}` returns
 * `{ mode: 'reactive', compound, config, contentCount, ... }` with no
 * `tracks` key at all (ANI-148) — there is no per-layer breakdown to read,
 * reactive or not, so no branch of normalizeLayers can produce a valid
 * signal for them. This script demonstrates both, against the exact
 * catalog-loading and call pattern mcp/lib/scoring.js uses in production
 * (loadPrimitivesCatalog + loadPersonalitiesCatalog + loadRecipes, then
 * compileMotion(sceneDef, catalogs, isReactiveScene(sceneDef) ? {mode:'reactive'} : {})
 * followed by auditMotionDensity(timeline, sceneDef); see scoring.js's
 * computeDensity()).
 *
 * Run from the repo root: `node docs/process/repro-motion-density.mjs`
 * No arguments, no environment variables, no writes. Read-only.
 */

import { loadBenchmarks, loadPrimitivesCatalog, loadPersonalitiesCatalog, loadRecipes } from '../../mcp/data/loader.js';
import { compileMotion, isReactiveScene } from '../../mcp/lib/compiler.js';
import { auditMotionDensity } from '../../mcp/lib/motion-density.js';

const catalogs = {
  primitives: loadPrimitivesCatalog(),
  personalities: loadPersonalitiesCatalog(),
  recipes: loadRecipes(),
};

const benchmarks = loadBenchmarks();
console.log(`Loaded ${benchmarks.length} benchmark scenes from catalog/benchmarks/.`);
console.log(`Catalogs loaded exactly as scoring.js does: ${Object.keys(catalogs).join(', ')}.\n`);

const rows = [];
for (const sceneDef of benchmarks) {
  const reactive = isReactiveScene(sceneDef);
  // Exact call shape from scoring.js's computeDensity().
  const timeline = compileMotion(sceneDef, catalogs, reactive ? { mode: 'reactive' } : {});
  const audit = auditMotionDensity(timeline, sceneDef);
  rows.push({
    scene_id: sceneDef.scene_id,
    reactive,
    'timeline.layers is Array': Array.isArray(timeline?.layers),
    'timeline.tracks.layers exists': !!timeline?.tracks?.layers,
    'auditMotionDensity.score': audit.score,
  });
}

console.table(rows);

const allZero = rows.every(r => r['auditMotionDensity.score'] === 0);
const noneHaveLayersArray = rows.every(r => r['timeline.layers is Array'] === false);
const nonReactiveHaveTracksLayers = rows.filter(r => !r.reactive).every(r => r['timeline.tracks.layers exists'] === true);

console.log('\n--- Repro assertions ---');
console.log(`All ${rows.length} scenes score density 0 regardless of real motion:`, allZero);
console.log('No scene ever produces the timeline.layers array shape normalizeLayers expects:', noneHaveLayersArray);
console.log('Every non-reactive scene DOES have timeline.tracks.layers (the shape normalizeLayers never reads):', nonReactiveHaveTracksLayers);

if (!allZero || !noneHaveLayersArray || !nonReactiveHaveTracksLayers) {
  console.log('\nRepro did NOT reproduce as documented in the plan. Do not trust the plan\'s claim without investigating why this changed.');
  process.exitCode = 1;
} else {
  console.log('\nRepro CONFIRMED: motion-density.js:198-217\'s normalizeLayers() cannot read a real compiled timeline for any of these 14 scenes.');
}
