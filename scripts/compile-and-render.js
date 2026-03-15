#!/usr/bin/env node
/**
 * End-to-end: Level 1 scene → compile → Level 2 timeline → Remotion render.
 *
 * Proves the full motion spec v2 loop:
 *   1. Load a v2 scene JSON (has motion block)
 *   2. Run the compiler (Level 1 → Level 2 timeline)
 *   3. Write props file {scene, timeline}
 *   4. Call Remotion render
 *
 * Usage:
 *   node scripts/compile-and-render.js [scene.json] [--compile-only] [--gl=angle]
 *
 * Examples:
 *   node scripts/compile-and-render.js catalog/benchmarks/cinematic-dark-e2e.json
 *   node scripts/compile-and-render.js catalog/benchmarks/cinematic-dark-e2e.json --compile-only
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { compileMotion } from '../mcp/lib/compiler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

const scenePath = positional[0] || 'catalog/benchmarks/cinematic-dark-e2e.json';
const compileOnly = flags.includes('--compile-only');
const remotionFlags = flags.filter(f => f !== '--compile-only');

// ── Load scene ──────────────────────────────────────────────────────────────

const fullPath = resolve(ROOT, scenePath);
console.log(`\n  Loading scene: ${scenePath}`);
const scene = JSON.parse(readFileSync(fullPath, 'utf-8'));

if (!scene.motion) {
  console.error('  ERROR: Scene has no motion block — nothing to compile.');
  console.error('  This script requires a v2 scene with a motion intent block.');
  process.exit(1);
}

// ── Compile ─────────────────────────────────────────────────────────────────

console.log('  Compiling Level 1 → Level 2...');
const timeline = compileMotion(scene, {}, { personality: scene.personality });

if (!timeline) {
  console.error('  ERROR: Compiler returned null — check scene format.');
  process.exit(1);
}

// Report
const layerIds = Object.keys(timeline.tracks.layers);
const cameraProps = Object.keys(timeline.tracks.camera);
const totalKF = layerIds.reduce((sum, id) => {
  const tracks = timeline.tracks.layers[id];
  return sum + Object.values(tracks).reduce((s, t) => s + t.length, 0);
}, 0);

console.log(`  Compiled: ${timeline.duration_frames} frames @ ${timeline.fps}fps`);
console.log(`    Camera: ${cameraProps.length} tracks [${cameraProps.join(', ')}]`);
console.log(`    Layers: ${layerIds.length} layers, ${totalKF} total keyframes`);

for (const id of layerIds) {
  const tracks = timeline.tracks.layers[id];
  const props = Object.keys(tracks);
  const kf = props.reduce((s, p) => s + tracks[p].length, 0);
  console.log(`      ${id}: ${props.join(', ')} (${kf} kf)`);
}

// ── Write props ─────────────────────────────────────────────────────────────

const outDir = resolve(ROOT, 'public/e2e');
mkdirSync(outDir, { recursive: true });

const sceneBaseName = basename(scenePath, '.json');
const propsPath = resolve(outDir, `${sceneBaseName}-props.json`);
const timelinePath = resolve(outDir, `${sceneBaseName}-timeline.json`);

// Write the compiled timeline separately for inspection
writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
console.log(`\n  Timeline written: public/e2e/${sceneBaseName}-timeline.json`);

// Write the combined props for Remotion
const props = { scene, timeline };
writeFileSync(propsPath, JSON.stringify(props, null, 2));
console.log(`  Props written:    public/e2e/${sceneBaseName}-props.json`);

if (compileOnly) {
  console.log('\n  --compile-only: skipping render.\n');
  process.exit(0);
}

// ── Render ──────────────────────────────────────────────────────────────────

const outputPath = resolve(ROOT, `public/e2e/${sceneBaseName}.mp4`);

console.log(`\n  Rendering via Remotion...`);
console.log(`  Output: public/e2e/${sceneBaseName}.mp4`);

const renderArgs = [
  'remotion', 'render',
  'src/remotion/index.js', 'Scene',
  `--props=${propsPath}`,
  `--output=${outputPath}`,
  ...remotionFlags,
];

console.log(`  $ npx ${renderArgs.join(' ')}\n`);

try {
  execFileSync('npx', renderArgs, { cwd: ROOT, stdio: 'inherit' });
  console.log(`\n  Done! Output: public/e2e/${sceneBaseName}.mp4\n`);
} catch (err) {
  console.error(`\n  Render failed. Exit code: ${err.status}`);
  process.exit(1);
}
