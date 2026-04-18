#!/usr/bin/env node

/**
 * Preflight CLI — ANI-115
 *
 * Usage:
 *   npm run preflight <manifest.json>
 *   npm run preflight <manifest.json> --scenes <dir>
 *
 * Reads the manifest + optional scene directory, runs the preflight doctor,
 * and prints a pass/fail report. Exits 0 on ok, 1 on any fail-level check.
 */

import { parseArgs } from 'node:util';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';

import { runPreflight, formatReport } from '../mcp/lib/preflight.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scenes: { type: 'string' },
    'output-dir': { type: 'string' },
    help: { type: 'boolean' },
  },
});

if (values.help || positionals.length === 0) {
  console.log(`
  Usage: npm run preflight -- <manifest.json> [options]

  Options:
    --scenes <dir>        Directory containing scene JSON files to resolve manifest refs
    --output-dir <path>   Where the render will write (for disk-space check)
    --help                Show this help

  Exits 0 on pass, 1 on any fail-level check.
  `);
  process.exit(values.help ? 0 : 1);
}

const manifestPath = resolve(positionals[0]);
if (!existsSync(manifestPath)) {
  console.error(`Error: manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Optional: load scene definitions from a directory so manifest_refs can verify
let sceneDefs = {};
if (values.scenes) {
  const scenesDir = resolve(values.scenes);
  if (!existsSync(scenesDir)) {
    console.error(`Error: scenes directory not found at ${scenesDir}`);
    process.exit(1);
  }
  for (const entry of readdirSync(scenesDir)) {
    if (extname(entry) !== '.json') continue;
    const scene = JSON.parse(readFileSync(resolve(scenesDir, entry), 'utf-8'));
    const id = scene.scene_id || scene.id;
    if (id) sceneDefs[id] = scene;
  }
}

const report = await runPreflight(manifest, {
  sceneDefs,
  outputDir: values['output-dir'],
});

console.log(`\nPreflight — ${manifestPath}`);
console.log('─'.repeat(Math.min(80, manifestPath.length + 15)));
console.log(formatReport(report));

process.exit(report.ok ? 0 : 1);
