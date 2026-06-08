#!/usr/bin/env node
/**
 * render-cookbook-contact-sheets.mjs — ANI-123
 *
 * Renders a contact-sheet frame strip (one representative still per scene) for
 * each cookbook walkthrough example, then montages the stills into a single
 * horizontal PNG with ffmpeg. Bundles the Remotion project ONCE and reuses it
 * across every still, so the cost is one bundle + N fast stills.
 *
 * Output: docs/cookbook/walkthroughs/assets/<example>-contact-sheet.png
 * (renders/ is gitignored; these committed sheets live under docs/).
 *
 * Usage:
 *   node scripts/render-cookbook-contact-sheets.mjs [example ...]
 *   (default: all examples in WALKTHROUGHS)
 */

import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill } from '@remotion/renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FPS = 60;
const STILL_W = 480; // per-thumbnail width in the contact sheet
const TMP = resolve(ROOT, 'renders/.cookbook-stills');
const OUT_DIR = resolve(ROOT, 'docs/cookbook/walkthroughs/assets');

// Examples that become walkthroughs. Each must have scenes/*.json + manifest.json.
const WALKTHROUGHS = ['fintech-sizzle', 'ai-prompt-to-result', 'product-demo', 'brand-teaser'];

const only = process.argv.slice(2);
const targets = only.length ? WALKTHROUGHS.filter(w => only.includes(w)) : WALKTHROUGHS;

/** Scene order from the manifest; falls back to sorted scene files. */
function sceneOrder(exampleDir) {
  const manifest = JSON.parse(readFileSync(join(exampleDir, 'manifest.json'), 'utf-8'));
  return manifest.scenes.map(s => s.scene);
}

function loadScene(exampleDir, sceneId) {
  const p = join(exampleDir, 'scenes', `${sceneId}.json`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });

  console.log('Bundling Remotion project (once)…');
  const serveUrl = await bundle({
    entryPoint: resolve(ROOT, 'src/remotion/index.js'),
    onProgress: () => {},
  });
  console.log('Bundle ready.\n');

  for (const example of targets) {
    const exampleDir = resolve(ROOT, 'examples', example);
    if (!existsSync(exampleDir)) { console.warn(`skip ${example}: no dir`); continue; }
    const order = sceneOrder(exampleDir);
    console.log(`${example}: ${order.length} scenes`);

    const stillPaths = [];
    for (let i = 0; i < order.length; i++) {
      const scene = loadScene(exampleDir, order[i]);
      const durS = scene.duration_s || 3;
      // Sample at 60% through the scene — past entrances, before exits.
      const frame = Math.max(0, Math.round(durS * FPS * 0.6) - 1);
      const out = join(TMP, `${example}-${String(i).padStart(2, '0')}.png`);
      const comp = await selectComposition({
        serveUrl,
        id: 'Scene',
        inputProps: { scene },
      });
      await renderStill({
        composition: comp,
        serveUrl,
        output: out,
        frame,
        inputProps: { scene },
        chromiumOptions: { gl: 'angle' },
        scale: STILL_W / 1920,
      });
      stillPaths.push(out);
      process.stdout.write(`  ✓ ${order[i]} @ f${frame}\n`);
    }

    // Montage into a horizontal strip with labels via ffmpeg tile filter.
    const sheet = join(OUT_DIR, `${example}-contact-sheet.png`);
    const inputs = stillPaths.flatMap(p => ['-i', p]);
    const n = stillPaths.length;
    execFileSync('ffmpeg', [
      '-y', ...inputs,
      '-filter_complex', `hstack=inputs=${n}`,
      sheet,
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log(`  → ${sheet.replace(ROOT + '/', '')}\n`);
  }

  rmSync(TMP, { recursive: true, force: true });
  console.log('Done.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
