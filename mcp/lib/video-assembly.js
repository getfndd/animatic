/**
 * Video Assembly — Orchestrates the dual render target pipeline.
 *
 * Takes a manifest + scene definitions + render routes + captured plates,
 * produces a Remotion-ready render-props JSON and triggers the render.
 *
 * Pipeline:
 *   1. Resolve render targets (or accept pre-resolved routes)
 *   2. Verify all plate assets exist for browser_capture scenes
 *   3. Build routing manifest for SequenceComposition
 *   4. Write render-props.json
 *   5. Return the assembled config
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRenderTargets } from './render-routing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Assemble a video sequence from mixed render sources.
 *
 * @param {object} params
 * @param {object} params.manifest - Sequence manifest
 * @param {object} params.sceneDefs - Scene definitions keyed by scene_id
 * @param {object[]} [params.scenes] - Scene array (used for routing if sceneDefs not keyed)
 * @param {object} [params.routes] - Pre-resolved render routes (skips resolve step)
 * @param {object} [params.plates] - Plate asset paths keyed by scene_id: { src, format }
 * @param {object} [params.timelines] - Compiled timelines keyed by scene_id
 * @param {string} [params.outputDir] - Where to write render-props.json
 * @returns {{ renderProps, sceneRoutes, warnings, plateStatus }}
 */
export function assembleVideoSequence({
  manifest,
  sceneDefs = {},
  scenes,
  routes: preRoutes,
  plates = {},
  timelines = {},
  outputDir,
} = {}) {
  if (!manifest?.scenes) {
    throw new Error('assembleVideoSequence requires a manifest with scenes');
  }

  const warnings = [];

  // Build scene array for routing if not provided
  const sceneArray = scenes || Object.values(sceneDefs);

  // Step 1: Resolve render targets
  let routes;
  if (preRoutes) {
    routes = preRoutes;
  } else {
    const resolved = resolveRenderTargets(sceneArray);
    routes = {};
    for (const r of resolved.routes) {
      routes[r.scene_id] = r;
    }
  }

  // Step 2: Verify plate assets
  const plateStatus = {};
  for (const entry of manifest.scenes) {
    const sceneId = entry.scene || entry.scene_id;
    const route = routes[sceneId];
    const target = route?.render_target || 'remotion_native';

    if (target === 'browser_capture' || target === 'hybrid') {
      const plate = plates[sceneId];
      if (plate?.src) {
        const exists = existsSync(plate.src);
        plateStatus[sceneId] = { status: exists ? 'ready' : 'missing', src: plate.src };
        if (!exists) {
          warnings.push(`Plate missing for ${sceneId}: ${plate.src} — will fall back to native render`);
        }
      } else {
        plateStatus[sceneId] = { status: 'not_captured', src: null };
        warnings.push(`No plate for ${sceneId} — needs browser capture first`);
      }
    } else {
      plateStatus[sceneId] = { status: 'native', src: null };
    }
  }

  // Step 3: Build sceneRoutes for SequenceComposition
  const sceneRoutes = {};
  for (const entry of manifest.scenes) {
    const sceneId = entry.scene || entry.scene_id;
    const route = routes[sceneId];
    const target = route?.render_target || 'remotion_native';
    const plate = plates[sceneId];
    const hasPlate = plate?.src && existsSync(plate.src);

    sceneRoutes[sceneId] = {
      render_target: (target === 'browser_capture' && !hasPlate) ? 'remotion_native' : target,
      plate_src: hasPlate ? plate.src : null,
      plate_format: plate?.format || null,
    };
  }

  // Step 4: Build render-props
  const renderProps = {
    manifest,
    sceneDefs: typeof sceneDefs === 'object' && !Array.isArray(sceneDefs)
      ? sceneDefs
      : Object.fromEntries(sceneArray.map(s => [s.scene_id, s])),
    timelines,
    sceneRoutes,
  };

  // Optionally write to disk
  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    const outPath = resolve(outputDir, 'render-props.json');
    writeFileSync(outPath, JSON.stringify(renderProps, null, 2));
  }

  return { renderProps, sceneRoutes, warnings, plateStatus };
}

/**
 * Build a Remotion CLI render command from assembly output.
 *
 * @param {object} params
 * @param {string} params.propsPath - Path to render-props.json
 * @param {string} params.outputPath - Output video path
 * @param {object} [params.options] - { codec, crf, fps }
 * @returns {string} CLI command
 */
export function buildRenderCommand({ propsPath, outputPath, options = {} }) {
  const codec = options.codec || 'h264';
  const crf = options.crf || 16;

  const parts = [
    'NODE_OPTIONS="--dns-result-order=ipv4first"',
    'npx remotion render Sequence',
    `--props "${propsPath}"`,
    `--codec ${codec}`,
    `--crf ${crf}`,
    outputPath,
  ];

  return parts.join(' ');
}
