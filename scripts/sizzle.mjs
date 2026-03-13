#!/usr/bin/env node

/**
 * sizzle.mjs — Scenes folder + style → evaluated, validated, rendered video (ANI-25)
 *
 * Full AI cinematography pipeline:
 * load scene JSONs → analyze → plan → evaluate → validate → render.
 *
 * Usage:
 *   node scripts/sizzle.mjs <scenes-dir> [options]
 *   node scripts/sizzle.mjs --brief <brief.json> [options]
 *
 * Options:
 *   --brief <path>         Brief JSON file (alternative to scenes-dir)
 *   --style <name>         Style pack (required with scenes-dir, inferred from brief)
 *   --output <path>        Output path (default: renders/sizzle-{style}-{timestamp}.mp4)
 *   --dry-run              Generate manifest JSON only, skip Remotion render
 *   --skip-evaluate        Skip quality evaluation step
 *   --skip-validate        Skip guardrails validation step
 *   --sequence-id <id>     Custom sequence ID (default: auto-generated)
 *   --verbose              Print per-scene analysis and planning details
 *   --help                 Show usage
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
import { evaluateSequence } from '../mcp/lib/evaluate.js';
import { validateFullManifest } from '../mcp/lib/guardrails.js';
import { validateScene, validateManifest } from '../src/remotion/lib.js';
import { generateScenes } from '../mcp/lib/generator.js';

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
 * Evaluate a manifest for quality across 4 dimensions.
 *
 * @param {object} manifest — Sequence manifest from planSequence().
 * @param {object[]} scenes — Analyzed scene objects with metadata.
 * @param {string} style — Style pack name.
 * @returns {{ score: number, dimensions: object, findings: object[] }}
 */
export function evaluateManifest(manifest, scenes, style) {
  return evaluateSequence({ manifest, scenes, style });
}

/**
 * Validate a manifest against personality guardrails.
 *
 * @param {object} manifest — Sequence manifest from planSequence().
 * @param {string} style — Style pack name.
 * @returns {{ verdict: string, sceneResults: object[], cumulativeFindings: object[] }}
 */
export function validateManifestGuardrails(manifest, style) {
  const personality = STYLE_TO_PERSONALITY[style];
  return validateFullManifest(manifest, personality);
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
      brief:             { type: 'string' },
      style:             { type: 'string' },
      output:            { type: 'string' },
      'dry-run':         { type: 'boolean', default: false },
      'skip-evaluate':   { type: 'boolean', default: false },
      'skip-validate':   { type: 'boolean', default: false },
      'sequence-id':     { type: 'string' },
      verbose:           { type: 'boolean', default: false },
      help:              { type: 'boolean', default: false },
    },
  });

  if (opts.help) {
    console.log(`
  Usage: node scripts/sizzle.mjs <scenes-dir> [options]
         node scripts/sizzle.mjs --brief <brief.json> [options]

  Input (one required):
    <scenes-dir>          Directory of scene JSON files
    --brief <path>        Brief JSON file (generates scenes automatically)

  Options:
    --style <name>        Style pack (required with scenes-dir, inferred from brief).
                          One of: ${STYLE_PACKS.join(', ')}
    --output <path>       Output path (default: renders/sizzle-{style}-{timestamp}.mp4)
    --dry-run             Generate manifest JSON only, skip Remotion render
    --skip-evaluate       Skip quality evaluation step
    --skip-validate       Skip guardrails validation step
    --sequence-id <id>    Custom sequence ID (default: auto-generated)
    --verbose             Print per-scene analysis and planning details
    --help                Show usage

  Pipeline (--brief mode):
    0. Generate    → Brief → classified assets → scene JSON files
    1. Analyze     → Classify content type, weight, energy, intent
    2. Plan        → Generate sequence manifest with style pack rules
    3. Evaluate    → Score pacing, variety, flow, adherence (skippable)
    4. Validate    → Check guardrails — blocks on safety violations (skippable)
    5. Render      → Remotion video render (or dry-run JSON)

  Pipeline (scenes-dir mode):
    1. Load scenes → Read *.json from directory
    2. Analyze     → Classify content type, weight, energy, intent
    3. Plan        → Generate sequence manifest with style pack rules
    4. Evaluate    → Score pacing, variety, flow, adherence (skippable)
    5. Validate    → Check guardrails — blocks on safety violations (skippable)
    6. Render      → Remotion video render (or dry-run JSON)
    `);
    process.exit(0);
  }

  // Validation: need either scenes-dir or --brief
  const briefMode = !!opts.brief;
  if (!briefMode && positionals.length === 0) {
    console.error('Error: <scenes-dir> or --brief <path> is required. Run with --help for usage.');
    process.exit(1);
  }
  if (briefMode && positionals.length > 0) {
    console.error('Error: Cannot use both <scenes-dir> and --brief. Choose one.');
    process.exit(1);
  }

  const startTime = Date.now();
  const verbose = opts.verbose;
  const dryRun = opts['dry-run'];
  const timestamp = Math.floor(Date.now() / 1000);
  let scenes;
  let style;
  let scenesDir;
  let tmpScenesDir;

  if (briefMode) {
    // ── Brief mode: generate scenes from brief ─────────────────────────────
    const briefPath = path.resolve(opts.brief);
    if (!fs.existsSync(briefPath)) {
      console.error(`Error: Brief file "${briefPath}" not found`);
      process.exit(1);
    }

    let brief;
    try {
      brief = JSON.parse(fs.readFileSync(briefPath, 'utf-8'));
    } catch (err) {
      console.error(`Error: Invalid JSON in brief file: ${err.message}`);
      process.exit(1);
    }

    console.log(`\nSizzle Pipeline (brief mode)`);
    console.log(`${'─'.repeat(50)}`);

    // Step 0: Generate scenes
    console.log(`0. Generating scenes from brief...`);
    const { scenes: generatedScenes, notes } = await generateScenes(brief);
    console.log(`   ${notes.scene_count} scenes generated (template: ${notes.template}, style: ${notes.style})`);
    if (verbose) {
      for (const ps of notes.plan_summary) {
        console.log(`   ${ps.label}: ${ps.content_type} (${ps.layout}), ${ps.asset_count} assets, [${ps.intent_tags.join(', ')}]`);
      }
    }

    scenes = generatedScenes;

    // Infer style from brief if not explicitly provided
    style = opts.style || notes.style;

    // Write generated scenes to temp dir for downstream compatibility
    tmpScenesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sizzle-scenes-'));
    for (let i = 0; i < scenes.length; i++) {
      const filename = `${String(i).padStart(2, '0')}-${scenes[i].scene_id}.json`;
      fs.writeFileSync(path.join(tmpScenesDir, filename), JSON.stringify(scenes[i], null, 2));
    }
    scenesDir = tmpScenesDir;
  } else {
    // ── Scenes-dir mode: load existing scenes ──────────────────────────────
    if (!opts.style) {
      console.error(`Error: --style is required. Valid styles: ${STYLE_PACKS.join(', ')}`);
      process.exit(1);
    }
    style = opts.style;

    scenesDir = path.resolve(positionals[0]);
    if (!fs.existsSync(scenesDir) || !fs.statSync(scenesDir).isDirectory()) {
      console.error(`Error: "${scenesDir}" is not a directory`);
      process.exit(1);
    }

    console.log(`\nSizzle Pipeline`);
    console.log(`${'─'.repeat(50)}`);

    // Step 1: Load scenes
    console.log(`1. Loading scenes...`);
    scenes = loadScenes(scenesDir);
    console.log(`   ${scenes.length} files from ${scenesDir}`);
  }

  if (!STYLE_PACKS.includes(style)) {
    console.error(`Error: Unknown style "${style}". Valid styles: ${STYLE_PACKS.join(', ')}`);
    process.exit(1);
  }

  // Default output path
  const outputPath = opts.output
    ? path.resolve(opts.output)
    : path.resolve(PROJECT_ROOT, 'renders', `sizzle-${style}-${timestamp}.mp4`);

  console.log(`\n  Input:  ${briefMode ? `brief → ${scenes.length} scenes` : `${scenesDir} (${scenes.length} scenes)`}`);
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
  const seqId = opts['sequence-id'] || `seq_sizzle_${style}_${timestamp}`;
  const { manifest, notes } = planSequence({
    scenes: analyzed,
    style,
    sequence_id: seqId,
  });

  const transitionSummary = Object.entries(notes.transition_summary)
    .map(([type, count]) => `${count} ${type}`)
    .join(' + ');
  console.log(`   ${notes.total_duration_s}s total, ${transitionSummary || 'no transitions'}`);

  if (verbose) {
    console.log(`   Order: ${manifest.scenes.map(s => s.scene).join(' → ')}`);
    console.log(`   Rationale: ${notes.ordering_rationale}`);
  }

  // Step 4: Evaluate sequence quality
  if (!opts['skip-evaluate']) {
    console.log(`4. Evaluating sequence...`);
    const evaluation = evaluateManifest(manifest, analyzed, style);
    const dims = evaluation.dimensions;
    console.log(`   Score: ${evaluation.score}/100  (pacing: ${dims.pacing.score}, variety: ${dims.variety.score}, flow: ${dims.flow.score}, adherence: ${dims.adherence.score})`);
    if (verbose && evaluation.findings.length > 0) {
      for (const f of evaluation.findings) {
        console.log(`   [${f.severity}] ${f.message}`);
      }
    }
  } else {
    console.log(`4. Evaluate — skipped`);
  }

  // Step 5: Validate guardrails
  if (!opts['skip-validate']) {
    console.log(`5. Validating guardrails...`);
    const result = validateManifestGuardrails(manifest, style);
    if (result.verdict === 'BLOCK') {
      console.error(`   BLOCKED — guardrail violations:`);
      for (const sr of result.sceneResults) {
        for (const b of sr.blocks) {
          console.error(`   Scene ${sr.sceneIndex + 1}: ${b.message}`);
        }
      }
      process.exit(1);
    } else if (result.verdict === 'WARN') {
      console.log(`   WARN — guardrail warnings:`);
      for (const sr of result.sceneResults) {
        for (const w of sr.warnings) {
          console.log(`   Scene ${sr.sceneIndex + 1}: ${w.message}`);
        }
      }
      for (const cf of result.cumulativeFindings) {
        console.log(`   ${cf.message}`);
      }
    } else {
      console.log(`   PASS`);
    }
  } else {
    console.log(`5. Validate — skipped`);
  }

  // Step 6: Render or dry-run
  const props = assembleProps(manifest, analyzed);

  if (dryRun) {
    const dryRunOutput = outputPath.replace(/\.mp4$/, '.json');
    fs.mkdirSync(path.dirname(dryRunOutput), { recursive: true });
    fs.writeFileSync(dryRunOutput, JSON.stringify(props, null, 2));
    console.log(`6. Dry run — manifest written to ${dryRunOutput}`);

    // Validate the assembled manifest
    const validation = validateManifest(manifest);
    console.log(`   Manifest valid: ${validation.valid}`);
    if (!validation.valid) {
      console.error(`   Errors: ${validation.errors.join('; ')}`);
    }
  } else {
    console.log(`6. Rendering video...`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await renderVideo(props, outputPath);
  }

  // Cleanup temp dir
  if (tmpScenesDir) {
    fs.rmSync(tmpScenesDir, { recursive: true, force: true });
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
