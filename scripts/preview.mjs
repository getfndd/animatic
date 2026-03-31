#!/usr/bin/env node

/**
 * preview.mjs — Launch Remotion Studio with live preview of a project/manifest
 *
 * Usage:
 *   node scripts/preview.mjs <render-props.json>
 *   node scripts/preview.mjs examples/ai-prompt-to-result/render-props.json
 *   npm run preview -- examples/fintech-sizzle/render-props.json
 *
 * Builds render-props if given a project slug or manifest + scenes dir.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Parse args ──────────────────────────────────────────────────────────────

const input = process.argv[2];
if (!input) {
  console.log('Usage: node scripts/preview.mjs <render-props.json | manifest.json | project-dir>');
  process.exit(1);
}

// ── Resolve input to render-props ───────────────────────────────────────────

let propsPath;

if (input.endsWith('render-props.json') && existsSync(input)) {
  propsPath = resolve(input);
} else if (input.endsWith('manifest.json') && existsSync(input)) {
  // Build render-props from manifest + sibling scenes/
  const dir = dirname(resolve(input));
  const manifest = JSON.parse(readFileSync(resolve(input), 'utf-8'));
  const scenesDir = resolve(dir, 'scenes');
  const sceneDefs = {};

  if (existsSync(scenesDir)) {
    for (const f of readdirSync(scenesDir).filter(f => f.endsWith('.json'))) {
      const scene = JSON.parse(readFileSync(resolve(scenesDir, f), 'utf-8'));
      sceneDefs[scene.scene_id] = scene;
    }
  }

  const renderProps = { manifest, sceneDefs, timelines: {}, sceneRoutes: {} };
  propsPath = resolve(dir, 'render-props.json');
  writeFileSync(propsPath, JSON.stringify(renderProps, null, 2));
  console.log(`Built render-props.json from manifest (${Object.keys(sceneDefs).length} scenes)`);
} else if (existsSync(resolve(input, 'manifest.json'))) {
  // Input is a project directory
  const manifest = JSON.parse(readFileSync(resolve(input, 'manifest.json'), 'utf-8'));
  const scenesDir = resolve(input, 'scenes');
  const sceneDefs = {};

  if (existsSync(scenesDir)) {
    for (const f of readdirSync(scenesDir).filter(f => f.endsWith('.json'))) {
      const scene = JSON.parse(readFileSync(resolve(scenesDir, f), 'utf-8'));
      sceneDefs[scene.scene_id] = scene;
    }
  }

  const renderProps = { manifest, sceneDefs, timelines: {}, sceneRoutes: {} };
  propsPath = resolve(input, 'render-props.json');
  writeFileSync(propsPath, JSON.stringify(renderProps, null, 2));
  console.log(`Built render-props.json from ${basename(input)}/ (${Object.keys(sceneDefs).length} scenes)`);
} else {
  console.error(`Cannot resolve input: ${input}`);
  console.error('Provide a render-props.json, manifest.json, or project directory');
  process.exit(1);
}

// ── Copy to well-known location for Studio ──────────────────────────────────

const studioPropsPath = resolve(ROOT, 'src/remotion/preview-props.json');
writeFileSync(studioPropsPath, readFileSync(propsPath, 'utf-8'));
console.log(`Linked to src/remotion/preview-props.json`);

// ── Check if Studio is already running ──────────────────────────────────────

let studioRunning = false;
try {
  const resp = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000', { timeout: 2000 });
  studioRunning = resp.toString().trim() === '200';
} catch {}

if (!studioRunning) {
  console.log('Starting Remotion Studio...');
  const studio = spawn('npx', ['remotion', 'studio'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' },
  });
  studio.unref();
  // Wait for studio to start
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000', { timeout: 2000 });
      studioRunning = true;
      break;
    } catch {}
  }
}

if (studioRunning) {
  // Open to Sequence composition
  const url = `http://localhost:3000/Sequence`;
  console.log(`\nOpening preview: ${url}`);
  execSync(`open "${url}"`);
} else {
  console.error('Could not start Remotion Studio');
  process.exit(1);
}

console.log(`\nPreview ready. Edit scenes and re-run to update.`);
console.log(`Props: ${propsPath}`);
