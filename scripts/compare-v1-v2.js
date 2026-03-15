/**
 * V1 vs V2 Motion Spec Comparison Script
 *
 * Loads both comparison scenes, compiles the v2 scene through the motion
 * compiler, runs the critic on the compiled timeline, and prints a
 * side-by-side report showing the dramatic difference.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileMotion } from '../mcp/lib/compiler.js';
import { critiqueTimeline } from '../mcp/lib/critic.js';
import { loadRecipes, loadPrimitivesCatalog } from '../mcp/data/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load scenes ──────────────────────────────────────────────────────────────

const v1Scene = JSON.parse(
  readFileSync(resolve(ROOT, 'catalog/comparison/comparison-v1.json'), 'utf-8')
);
const v2Scene = JSON.parse(
  readFileSync(resolve(ROOT, 'catalog/comparison/comparison-v2.json'), 'utf-8')
);

// ── Load catalogs ────────────────────────────────────────────────────────────

const recipes = loadRecipes();
const primitives = loadPrimitivesCatalog();
const catalogs = { recipes, primitives };

// ── Compile ──────────────────────────────────────────────────────────────────

const v1Timeline = compileMotion(v1Scene, catalogs, { personality: v1Scene.personality });
const v2Timeline = compileMotion(v2Scene, catalogs, { personality: v2Scene.personality });

// ── Critique ─────────────────────────────────────────────────────────────────

const v2Critique = v2Timeline ? critiqueTimeline(v2Timeline, v2Scene) : null;

// ── Report ───────────────────────────────────────────────────────────────────

const SEPARATOR = '═'.repeat(70);
const THIN_SEP = '─'.repeat(70);

console.log();
console.log(SEPARATOR);
console.log('  MOTION SPEC COMPARISON: V1 (flat) vs V2 (choreographed)');
console.log(SEPARATOR);
console.log();

// V1 summary
console.log('  V1 SCENE: sc_comparison_v1');
console.log(THIN_SEP);
if (v1Timeline === null) {
  console.log('  Compilation:  null (no motion block — v1 format)');
  console.log('  Camera:       Single push_in at intensity 0.3');
  console.log('  Entrances:    All 5 layers use as-fadeInUp at delay 0ms');
  console.log('  Stagger:      None — everything enters simultaneously');
  console.log('  Effects:      None');
  console.log('  Cue sync:     None');
  console.log('  Hierarchy:    None — all layers treated identically');
  console.log('  Critic score: ~40 (estimated — flat motion, no hierarchy)');
} else {
  console.log('  Compilation:  Unexpected — v1 scene should return null');
}

console.log();
console.log('  V2 SCENE: sc_comparison_v2');
console.log(THIN_SEP);
if (v2Timeline) {
  console.log(`  Compilation:  Success — ${v2Timeline.duration_frames} frames @ ${v2Timeline.fps}fps`);

  // Camera details
  const camTracks = v2Timeline.tracks.camera;
  const camProps = Object.keys(camTracks);
  console.log(`  Camera:       push_in, intensity 0.4, synced to "headline_done" cue`);
  console.log(`                ${camProps.length} track(s): ${camProps.join(', ')}`);

  // Layer track summary
  const layerTracks = v2Timeline.tracks.layers;
  const layerIds = Object.keys(layerTracks);
  console.log(`  Layer tracks: ${layerIds.length} layers compiled`);
  for (const id of layerIds) {
    const props = Object.keys(layerTracks[id]);
    const kfCount = props.reduce((sum, p) => sum + (layerTracks[id][p]?.length || 0), 0);
    console.log(`                  ${id}: ${props.length} props, ${kfCount} keyframes [${props.join(', ')}]`);
  }

  // Stagger evidence
  const taglineStart = getEarliestFrame(layerTracks['tagline']);
  const ctaStart = getEarliestFrame(layerTracks['cta-button']);
  if (taglineStart !== null && ctaStart !== null) {
    const staggerFrames = ctaStart - taglineStart;
    const staggerMs = Math.round((staggerFrames / v2Timeline.fps) * 1000);
    console.log(`  Stagger:      tagline @ frame ${taglineStart}, cta-button @ frame ${ctaStart} (${staggerMs}ms offset)`);
  }

  // Effects
  console.log('  Effects:      blur 8->0 (600ms expo_out) + brightness 0.3->1.0 (800ms) on headline');
  console.log('                scale 1.05->1.0 (2000ms) on hero-image');

  // Cue sync
  console.log('  Cue sync:     "headline_done" triggers supporting group + camera peak');

  // Critic
  if (v2Critique) {
    console.log();
    console.log(`  CRITIC SCORE: ${v2Critique.score}/100`);
    console.log(`  Verdict:      ${v2Critique.summary}`);
    if (v2Critique.issues.length > 0) {
      console.log('  Issues:');
      for (const issue of v2Critique.issues) {
        const icon = issue.severity === 'error' ? '[ERR]' : issue.severity === 'warning' ? '[WRN]' : '[INF]';
        console.log(`    ${icon} ${issue.message}`);
        console.log(`         -> ${issue.suggestion}`);
      }
    }
  }
} else {
  console.log('  Compilation:  Failed — no timeline returned');
}

// Feature comparison table
console.log();
console.log(SEPARATOR);
console.log('  FEATURE COMPARISON');
console.log(SEPARATOR);
console.log();

const features = [
  ['Stagger',       'All layers enter at frame 0',                     '120ms interval, descending amplitude 1.0 -> 0.6'],
  ['Cue sync',      'No cue system',                                    '"headline_done" triggers cards + camera peak'],
  ['Effects',       'No per-layer effects',                             'Blur reveal (8->0), brightness fade (0.3->1.0), scale (1.05->1.0)'],
  ['Camera sync',   'Camera runs independently',                       'Peak aligns with headline completion via cue'],
  ['Hierarchy',     'All layers identical animation',                   'Hero has blur+brightness; supporting has stagger+amplitude decay'],
  ['Groups',        'No grouping concept',                              '4 groups: hero, supporting, background, bg-entrance'],
  ['Compiled tracks', 'null (not compilable)',                          `${v2Timeline ? Object.keys(v2Timeline.tracks.layers).length : 0} layers with per-property keyframes`],
  ['Critic score',  '~40 (estimated)',                                  v2Critique ? `${v2Critique.score}/100` : 'N/A'],
];

console.log('  Feature              V1                                    V2');
console.log('  ' + '─'.repeat(100));
for (const [feature, v1, v2] of features) {
  console.log(`  ${feature.padEnd(20)} ${v1.padEnd(40)} ${v2}`);
}

console.log();
console.log(SEPARATOR);
console.log('  Same 5 layers. Same content. Dramatically different motion.');
console.log(SEPARATOR);
console.log();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEarliestFrame(tracks) {
  if (!tracks) return null;
  let earliest = Infinity;
  for (const keyframes of Object.values(tracks)) {
    if (keyframes && keyframes.length > 0) {
      earliest = Math.min(earliest, keyframes[0].frame);
    }
  }
  return earliest === Infinity ? null : earliest;
}
