#!/usr/bin/env node
/**
 * End-to-end: Sequence manifest → compile all scenes → Remotion render.
 *
 * Sequence equivalent of compile-and-render.js:
 *   1. Load manifest JSON + scene definition files
 *   2. Compile all v2/v3 scenes via compileAllScenes
 *   3. Write combined props {manifest, sceneDefs, timelines} to public/e2e/
 *   4. Call Remotion render on the Sequence composition
 *
 * Usage:
 *   node scripts/compile-and-render-sequence.js <manifest.json> [--compile-only] [--gl=angle]
 *
 * Scene definitions are loaded from paths relative to the manifest file:
 *   manifest.scenes[].scene_file → path to scene JSON (relative to manifest dir)
 *   OR scenes are looked up in catalog/benchmarks/ by scene_id.
 *
 * Examples:
 *   node scripts/compile-and-render-sequence.js catalog/manifests/test.json
 *   node scripts/compile-and-render-sequence.js catalog/manifests/test.json --compile-only
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { compileAllScenes } from '../mcp/lib/compiler.js';
import { loadRecipes } from '../mcp/data/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

if (!positional[0]) {
  console.error('  Usage: node scripts/compile-and-render-sequence.js <manifest.json> [--compile-only]');
  process.exit(1);
}

const manifestPath = positional[0];
const compileOnly = flags.includes('--compile-only');
const remotionFlags = flags.filter(f => f !== '--compile-only');

// ── Load manifest ───────────────────────────────────────────────────────────

const fullManifestPath = resolve(ROOT, manifestPath);
console.log(`\n  Loading manifest: ${manifestPath}`);
const manifest = JSON.parse(readFileSync(fullManifestPath, 'utf-8'));

const scenes = manifest.scenes || [];
if (scenes.length === 0) {
  console.error('  ERROR: Manifest has no scenes.');
  process.exit(1);
}

// ── Load scene definitions ──────────────────────────────────────────────────

const manifestDir = dirname(fullManifestPath);
const sceneDefs = {};

for (const entry of scenes) {
  if (sceneDefs[entry.scene]) continue; // already loaded

  // Try scene_file relative to manifest, then catalog/benchmarks/
  const candidates = [
    entry.scene_file && resolve(manifestDir, entry.scene_file),
    resolve(ROOT, `catalog/benchmarks/${entry.scene}.json`),
    resolve(manifestDir, `${entry.scene}.json`),
  ].filter(Boolean);

  let loaded = false;
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      sceneDefs[entry.scene] = JSON.parse(readFileSync(candidate, 'utf-8'));
      console.log(`  Loaded scene: ${entry.scene} (${candidate.replace(ROOT + '/', '')})`);
      loaded = true;
      break;
    }
  }

  if (!loaded) {
    console.warn(`  WARN: No scene file found for ${entry.scene} — will use placeholder`);
  }
}

// ── Compile ─────────────────────────────────────────────────────────────────

console.log('  Compiling all scenes...');
const catalogs = { recipes: loadRecipes() };
const { sceneDefs: compiledSceneDefs, timelines } = compileAllScenes(
  manifest, sceneDefs, catalogs, { personality: manifest.personality }
);

// Report
const sceneIds = Object.keys(compiledSceneDefs);
const timelineIds = Object.keys(timelines);
console.log(`  Compiled: ${sceneIds.length} scenes, ${timelineIds.length} with timelines`);

for (const id of timelineIds) {
  const tl = timelines[id];
  const layerIds = Object.keys(tl.tracks.layers);
  const totalKF = layerIds.reduce((sum, lid) => {
    const tracks = tl.tracks.layers[lid];
    return sum + Object.values(tracks).reduce((s, t) => s + t.length, 0);
  }, 0);
  console.log(`    ${id}: ${tl.duration_frames}f @ ${tl.fps}fps, ${layerIds.length} layers, ${totalKF} kf`);
}

// ── Write props ─────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, 'public/e2e');
mkdirSync(outDir, { recursive: true });

const manifestBaseName = basename(manifestPath, '.json');
const propsPath = resolve(outDir, `${manifestBaseName}-sequence-props.json`);

const props = {
  manifest,
  sceneDefs: { ...sceneDefs, ...compiledSceneDefs },
  timelines,
};
writeFileSync(propsPath, JSON.stringify(props, null, 2));
console.log(`\n  Props written: public/e2e/${manifestBaseName}-sequence-props.json`);

if (compileOnly) {
  console.log('\n  --compile-only: skipping render.\n');
  process.exit(0);
}

// ── Render ──────────────────────────────────────────────────────────────────

const outputPath = resolve(ROOT, `public/e2e/${manifestBaseName}-sequence.mp4`);

console.log(`\n  Rendering via Remotion...`);
console.log(`  Output: public/e2e/${manifestBaseName}-sequence.mp4`);

const renderArgs = [
  'remotion', 'render',
  'src/remotion/index.js', 'Sequence',
  `--props=${propsPath}`,
  `--output=${outputPath}`,
  ...remotionFlags,
];

console.log(`  $ npx ${renderArgs.join(' ')}\n`);

try {
  execFileSync('npx', renderArgs, { cwd: ROOT, stdio: 'inherit' });
  console.log(`\n  Done! Output: public/e2e/${manifestBaseName}-sequence.mp4\n`);
} catch (err) {
  console.error(`\n  Render failed. Exit code: ${err.status}`);
  process.exit(1);
}
