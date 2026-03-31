#!/usr/bin/env node

/**
 * animatic — CLI for the AI cinematography pipeline
 *
 * Commands:
 *   animatic analyze <scene.json>           Analyze a scene (content type, energy, annotations)
 *   animatic validate <scene.json>          Validate scene against schema
 *   animatic compile <scene.json>           Compile scene motion to timeline
 *   animatic score <manifest> <scenes-dir>  Score a video manifest
 *   animatic annotate <scenes-dir>          Annotate scenes with product roles
 *   animatic audit <scenes-dir>             Audit annotation quality
 *   animatic route <scenes-dir>             Resolve render targets
 *   animatic preview <path>                 Open live preview in Remotion Studio
 *   animatic brief <project-dir>            Generate brief stub
 *   animatic mcp                            Start MCP server
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const [,, command, ...args] = process.argv;

if (!command || command === '--help' || command === '-h') {
  console.log(`
animatic — AI cinematography pipeline CLI

Commands:
  analyze <scene.json>           Analyze scene (content type, energy, annotations)
  validate <scene.json>          Validate scene against schema
  compile <scene.json>           Compile motion to timeline
  score <manifest> <scenes-dir>  Score a video manifest (6 dimensions + per-scene)
  annotate <scenes-dir>          Annotate scenes with product roles + confidence
  audit <scenes-dir> [--strict]  Audit annotation quality
  route <scenes-dir>             Resolve render targets (browser_capture vs remotion_native)
  preview <path>                 Open live preview in Remotion Studio
  brief <project-dir>            Generate brief stub markdown
  mcp                            Start MCP server (stdio)

Examples:
  npx animatic analyze examples/ai-prompt-to-result/scenes/sc_02_prompt_input.json
  npx animatic score examples/fintech-sizzle/manifest.json examples/fintech-sizzle/scenes
  npx animatic annotate examples/ai-prompt-to-result/scenes
  npx animatic preview examples/ai-prompt-to-result
  npx animatic mcp
`);
  process.exit(0);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadScene(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf-8'));
}

function loadScenes(dir) {
  const d = resolve(dir);
  return readdirSync(d).filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(readFileSync(resolve(d, f), 'utf-8')));
}

function printJSON(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// ── Commands ────────────────────────────────────────────────────────────────

async function run() {
  switch (command) {
    case 'analyze': {
      const { analyzeScene } = await import('../mcp/lib/analyze.js');
      const scene = loadScene(args[0]);
      printJSON(analyzeScene(scene));
      break;
    }

    case 'validate': {
      const { validateScene } = await import('../src/remotion/lib.js');
      const scene = loadScene(args[0]);
      const result = validateScene(scene);
      if (result.valid) {
        console.log('VALID');
      } else {
        console.error('INVALID:');
        result.errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }
      break;
    }

    case 'compile': {
      const { compileMotion } = await import('../mcp/lib/compiler.js');
      const { loadPrimitivesCatalog, loadPersonalitiesCatalog, loadRecipes } = await import('../mcp/data/loader.js');
      const scene = loadScene(args[0]);
      const catalogs = { primitives: loadPrimitivesCatalog(), personalities: loadPersonalitiesCatalog(), recipes: loadRecipes() };
      printJSON(compileMotion(scene, catalogs));
      break;
    }

    case 'score': {
      const { scoreCandidateVideo } = await import('../mcp/lib/scoring.js');
      const { annotateScenes } = await import('../mcp/lib/scene-annotations.js');
      const manifest = JSON.parse(readFileSync(resolve(args[0]), 'utf-8'));
      const scenes = annotateScenes(loadScenes(args[1]));
      const style = args[2] || 'prestige';
      const card = scoreCandidateVideo({ manifest, scenes, style });

      console.log(`Overall: ${card.overall.toFixed(3)}\n`);
      for (const [dim, sub] of Object.entries(card.subscores)) {
        const bar = '\u2588'.repeat(Math.round(sub.score * 20)) + '\u2591'.repeat(20 - Math.round(sub.score * 20));
        console.log(`  ${dim.padEnd(18)} ${bar} ${sub.score.toFixed(2)}`);
      }
      console.log(`\nPer-scene:`);
      for (const ps of card.per_scene) {
        console.log(`  ${ps.scene_id.padEnd(25)} ${ps.overall.toFixed(2)} (${ps.product_role || '?'})`);
      }
      if (card.recommended_revisions.length > 0) {
        console.log(`\nRevisions (${card.recommended_revisions.length}):`);
        for (const r of card.recommended_revisions.slice(0, 5)) {
          console.log(`  ${r.op} ${r.target || r.from_scene || ''}: ${r.reason.slice(0, 60)}`);
        }
      }
      break;
    }

    case 'annotate': {
      const { annotateScenes } = await import('../mcp/lib/scene-annotations.js');
      const scenes = annotateScenes(loadScenes(args[0]));
      for (const s of scenes) {
        const conf = s._annotation_confidence;
        const hero = s.layers?.find(l => l.product_role === 'hero');
        console.log(`${s.scene_id.padEnd(25)} ${(s.product_role || '?').padEnd(12)} conf=${(conf?.overall || 0).toFixed(2)} hero=${hero?.id || 'none'}`);
      }
      if (args.includes('--json')) printJSON(scenes);
      break;
    }

    case 'audit': {
      const { annotateScenes, auditAnnotationQuality } = await import('../mcp/lib/scene-annotations.js');
      const scenes = annotateScenes(loadScenes(args[0]));
      const mode = args.includes('--strict') ? 'strict' : 'advisory';
      const result = auditAnnotationQuality(scenes, { mode });
      console.log(`Quality: ${result.quality.toFixed(2)} | Pass: ${result.pass ? 'YES' : 'NO'} | Mode: ${mode}`);
      console.log(result.summary);
      if (result.issues.length > 0) {
        console.log('\nIssues:');
        for (const i of result.issues) {
          console.log(`  ${i.severity === 'error' ? 'X' : i.severity === 'warning' ? '!' : '-'} ${i.message}`);
        }
      }
      break;
    }

    case 'route': {
      const { resolveRenderTargets } = await import('../mcp/lib/render-routing.js');
      const { annotateScenes } = await import('../mcp/lib/scene-annotations.js');
      const scenes = annotateScenes(loadScenes(args[0]));
      const { routes, summary } = resolveRenderTargets(scenes);
      console.log(`browser_capture: ${summary.browser_capture} | remotion_native: ${summary.remotion_native}\n`);
      for (const r of routes) {
        const tag = r.render_target === 'browser_capture' ? 'B' : r.render_target === 'remotion_native' ? 'R' : r.render_target === 'hybrid' ? 'H' : 'W';
        console.log(`[${tag}] ${r.scene_id.padEnd(25)} ${r.render_target.padEnd(16)} (${r.confidence.toFixed(2)}) ${r.reason.slice(0, 45)}`);
      }
      break;
    }

    case 'preview': {
      const { execFileSync } = await import('node:child_process');
      execFileSync('node', [resolve(ROOT, 'scripts/preview.mjs'), args[0]], { cwd: ROOT, stdio: 'inherit' });
      break;
    }

    case 'brief': {
      const { generateBriefStub } = await import('../mcp/lib/story-brief.js');
      const dir = resolve(args[0]);
      let project = null;
      try { project = JSON.parse(readFileSync(resolve(dir, 'project.json'), 'utf-8')); } catch {}
      const stub = generateBriefStub({ project });
      console.log(stub);
      break;
    }

    case 'mcp': {
      // Just exec the MCP server
      const { execFileSync } = await import('node:child_process');
      execFileSync('node', [resolve(ROOT, 'mcp/index.js')], { cwd: ROOT, stdio: 'inherit' });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "animatic --help" for usage');
      process.exit(1);
  }
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
