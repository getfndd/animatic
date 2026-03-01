#!/usr/bin/env node

/**
 * sizzle.mjs — Scenes folder + style → rendered video (ANI-25)
 *
 * Wires the full AI cinematography pipeline into a single CLI command:
 * load scene JSONs → analyze → plan sequence → assemble props → render.
 *
 * Usage:
 *   node scripts/sizzle.mjs <scenes-dir> [options]
 *
 * Options:
 *   --style <name>   Style pack: prestige, energy, dramatic (required)
 *   --output <path>  Output path (default: renders/sizzle-{style}-{timestamp}.mp4)
 *   --dry-run        Generate manifest JSON only, skip Remotion render
 *   --verbose        Print per-scene analysis and planning details
 *   --help           Show usage
 */

import { parseArgs } from 'node:util';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { analyzeScene } from '../mcp/lib/analyze.js';
import { planSequence, STYLE_PACKS, STYLE_TO_PERSONALITY } from '../mcp/lib/planner.js';
import { validateScene, validateManifest } from '../src/remotion/lib.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Pipeline Functions (exported for testing) ────────────────────────────────

/**
 * Load all *.json scene files from a directory.
 * Derives scene_id from filename if missing, validates each scene.
 *
 * @param {string} dir — Path to directory containing scene JSON files.
 * @returns {object[]} — Parsed and validated scene objects.
 */
export function loadScenes(dir) {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .json files found in ${dir}`);
  }

  const scenes = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    let scene;
    try {
      scene = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      throw new Error(`Invalid JSON in ${file}: ${err.message}`);
    }

    // Derive scene_id from filename if missing
    if (!scene.scene_id) {
      const basename = path.basename(file, '.json');
      const sanitized = basename.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      scene.scene_id = `sc_${sanitized}`;
    }

    const validation = validateScene(scene);
    if (!validation.valid) {
      throw new Error(`Scene validation failed for ${file}: ${validation.errors.join('; ')}`);
    }

    scenes.push(scene);
  }

  return scenes;
}

/**
 * Run analyzeScene on each scene, merging metadata onto the scene object.
 *
 * @param {object[]} scenes — Array of scene objects.
 * @returns {object[]} — Scenes with .metadata added.
 */
export function analyzeAll(scenes) {
  return scenes.map(scene => {
    const { metadata } = analyzeScene(scene);
    return { ...scene, metadata };
  });
}

/**
 * Assemble the props object that Remotion's --props expects.
 * Builds sceneDefs map: scene_id → full scene object.
 *
 * @param {object} manifest — Sequence manifest from planSequence().
 * @param {object[]} scenes — Full scene objects (with metadata).
 * @returns {{ manifest: object, sceneDefs: object }}
 */
export function assembleProps(manifest, scenes) {
  const sceneDefs = {};
  for (const scene of scenes) {
    sceneDefs[scene.scene_id] = scene;
  }
  return { manifest, sceneDefs };
}

/**
 * Render video using Remotion CLI.
 * Writes props to a temp file, spawns npx remotion render.
 *
 * @param {object} props — The { manifest, sceneDefs } object.
 * @param {string} outputPath — Path for the output MP4.
 */
async function renderVideo(props, outputPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sizzle-'));
  const propsPath = path.join(tmpDir, 'props.json');

  try {
    fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));

    await execFileAsync('npx', [
      'remotion', 'render', 'Sequence',
      '--props', propsPath,
      '--output', outputPath,
    ], {
      cwd: PROJECT_ROOT,
      timeout: 600_000,
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      style:     { type: 'string' },
      output:    { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      verbose:   { type: 'boolean', default: false },
      help:      { type: 'boolean', default: false },
    },
  });

  if (opts.help) {
    console.log(`
  Usage: node scripts/sizzle.mjs <scenes-dir> [options]

  Options:
    --style <name>   Style pack: ${STYLE_PACKS.join(', ')} (required)
    --output <path>  Output path (default: renders/sizzle-{style}-{timestamp}.mp4)
    --dry-run        Generate manifest JSON only, skip Remotion render
    --verbose        Print per-scene analysis and planning details
    --help           Show usage
    `);
    process.exit(0);
  }

  // Validation
  if (positionals.length === 0) {
    console.error('Error: <scenes-dir> is required. Run with --help for usage.');
    process.exit(1);
  }

  if (!opts.style) {
    console.error(`Error: --style is required. Valid styles: ${STYLE_PACKS.join(', ')}`);
    process.exit(1);
  }

  if (!STYLE_PACKS.includes(opts.style)) {
    console.error(`Error: Unknown style "${opts.style}". Valid styles: ${STYLE_PACKS.join(', ')}`);
    process.exit(1);
  }

  const scenesDir = path.resolve(positionals[0]);
  if (!fs.existsSync(scenesDir) || !fs.statSync(scenesDir).isDirectory()) {
    console.error(`Error: "${scenesDir}" is not a directory`);
    process.exit(1);
  }

  const startTime = Date.now();
  const style = opts.style;
  const verbose = opts.verbose;
  const dryRun = opts['dry-run'];
  const timestamp = Math.floor(Date.now() / 1000);

  // Default output path
  const outputPath = opts.output
    ? path.resolve(opts.output)
    : path.resolve(PROJECT_ROOT, 'renders', `sizzle-${style}-${timestamp}.mp4`);

  // Header
  console.log(`\nSizzle Pipeline`);
  console.log(`${'─'.repeat(50)}`);

  // Step 1: Load scenes
  console.log(`1. Loading scenes...`);
  const scenes = loadScenes(scenesDir);
  console.log(`   ${scenes.length} files from ${scenesDir}`);

  console.log(`\n  Input:  ${scenesDir} (${scenes.length} scenes)`);
  console.log(`  Style:  ${style} (${STYLE_TO_PERSONALITY[style]})`);
  console.log(`  Output: ${dryRun ? '(dry run)' : outputPath}\n`);

  // Step 2: Analyze
  console.log(`2. Analyzing scenes...`);
  const analyzed = analyzeAll(scenes);
  if (verbose) {
    for (const scene of analyzed) {
      const m = scene.metadata;
      console.log(`   ${scene.scene_id}: ${m.content_type}, ${m.visual_weight}, ${m.motion_energy}, [${m.intent_tags.join(', ')}]`);
    }
  }
  console.log(`   done`);

  // Step 3: Plan sequence
  console.log(`3. Planning sequence...`);
  const { manifest, notes } = planSequence({
    scenes: analyzed,
    style,
    sequence_id: `seq_sizzle_${style}_${timestamp}`,
  });

  const transitionSummary = Object.entries(notes.transition_summary)
    .map(([type, count]) => `${count} ${type}`)
    .join(' + ');
  console.log(`   ${notes.total_duration_s}s total, ${transitionSummary || 'no transitions'}`);

  if (verbose) {
    console.log(`   Order: ${manifest.scenes.map(s => s.scene).join(' → ')}`);
    console.log(`   Rationale: ${notes.ordering_rationale}`);
  }

  // Step 4: Render or dry-run
  const props = assembleProps(manifest, analyzed);

  if (dryRun) {
    const dryRunOutput = outputPath.replace(/\.mp4$/, '.json');
    fs.mkdirSync(path.dirname(dryRunOutput), { recursive: true });
    fs.writeFileSync(dryRunOutput, JSON.stringify(props, null, 2));
    console.log(`4. Dry run — manifest written to ${dryRunOutput}`);

    // Validate the assembled manifest
    const validation = validateManifest(manifest);
    console.log(`   Manifest valid: ${validation.valid}`);
    if (!validation.valid) {
      console.error(`   Errors: ${validation.errors.join('; ')}`);
    }
  } else {
    console.log(`4. Rendering video...`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await renderVideo(props, outputPath);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(50)}`);
  if (dryRun) {
    console.log(`Done in ${elapsed}s → ${outputPath.replace(/\.mp4$/, '.json')}`);
  } else {
    console.log(`Done in ${elapsed}s → ${outputPath}`);
  }
}

// Run only when executed directly, not when imported for testing
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch(err => {
    console.error(`\nFatal error: ${err.message}`);
    process.exit(1);
  });
}
