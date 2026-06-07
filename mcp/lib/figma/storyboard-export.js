/**
 * Storyboard → Figma export (ANI-113)
 *
 * Architecture (team consult, 2026-06-06): Figma's REST API cannot create
 * frames, so Animatic does NOT write into Figma. Instead it emits a
 * deterministic export payload — panel stills, scene metadata, a layout
 * plan, and a frame-naming contract — and the agent drives the
 * already-configured Figma MCP server to create the file. The pipeline is
 * deterministic at both ends: this payload going in, and the REST
 * read-back in `figma-roundtrip.js` verifying the created file against it.
 *
 * Frame-naming contract: every storyboard frame in Figma is named
 * `sb_<scene_id>`. The verifier and the comment importer both key on it —
 * the agent must follow it exactly, which is why it's stated in
 * `figma_instructions` rather than left to prose.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { describeThumbnail } from '../storyboard-tools.js';
import { computeSceneTimeline } from '../captions.js';

/** Prefix for the frame-naming contract. */
export const STORYBOARD_FRAME_PREFIX = 'sb_';

/** Panel render scale — 960x540 thumbnails keep Figma files light. */
const PANEL_SCALE = 0.5;
const PANEL_W = 960;
const PANEL_H = 540;
const GRID_GAP = 80;
const GRID_COLUMNS = 3;

/**
 * Build the deterministic export payload for a project's storyboard.
 * Pure — panel stills are referenced by the paths the renderer will write
 * to; rendering itself is `renderStoryboardPanels` below.
 *
 * @param {object} manifest - Sequence manifest
 * @param {object} sceneDefs - scene_id → scene definition map
 * @param {object} [options]
 * @param {string} [options.project_title]
 * @param {string} [options.panels_dir='storyboards/figma-export'] - Where panel PNGs land (project-relative)
 * @returns {{ panels: object[], layout_plan: object, figma_instructions: string, naming_contract: object }}
 */
export function buildStoryboardExportPayload(manifest, sceneDefs, options = {}) {
  const entries = manifest?.scenes || [];
  if (entries.length === 0) {
    throw new Error('buildStoryboardExportPayload requires a manifest with scenes');
  }
  const panelsDir = options.panels_dir || 'storyboards/figma-export';
  const timeline = computeSceneTimeline(manifest);

  const panels = entries.map((entry, i) => {
    const sceneId = entry.scene || entry.scene_id;
    const scene = sceneDefs?.[sceneId];
    const start = timeline[i] || { start_ms: 0, duration_ms: 0 };
    // Manifests use transition_in.type (see planner/revision/audio-sync);
    // `kind` accepted as a fallback for hand-authored variants.
    const transition = entry.transition_in
      ? `${entry.transition_in.type || entry.transition_in.kind || 'transition'} (${entry.transition_in.duration_ms || 0}ms)`
      : i === 0 ? 'cut (open)' : 'cut';

    return {
      index: i,
      scene_id: sceneId,
      frame_name: `${STORYBOARD_FRAME_PREFIX}${sceneId}`,
      panel_png: `${panelsDir}/${sceneId}.png`,
      title: scene?.primary_subject || sceneId,
      scene_loaded: Boolean(scene),
      description: scene ? describeThumbnail(scene) : 'Scene definition not loaded',
      duration_s: entry.duration_s || scene?.duration_s || 0,
      starts_at_ms: start.start_ms,
      camera: entry.camera_override?.move
        || scene?.semantic?.camera_behavior?.mode
        || scene?.camera?.move
        || 'static',
      transition_in: transition,
      voiceover: scene?.voiceover?.text || null,
    };
  });

  const rows = Math.ceil(panels.length / GRID_COLUMNS);
  const layout_plan = {
    page_name: `Storyboard — ${options.project_title || manifest.sequence_id || 'Animatic'}`,
    grid: { columns: GRID_COLUMNS, rows, panel_w: PANEL_W, panel_h: PANEL_H, gap: GRID_GAP },
    positions: panels.map((p, i) => ({
      frame_name: p.frame_name,
      x: (i % GRID_COLUMNS) * (PANEL_W + GRID_GAP),
      y: Math.floor(i / GRID_COLUMNS) * (PANEL_H + GRID_GAP + 120), // +120 for the metadata caption below each panel
    })),
  };

  const naming_contract = {
    frame_prefix: STORYBOARD_FRAME_PREFIX,
    rule: `One top-level frame per scene, named exactly "${STORYBOARD_FRAME_PREFIX}<scene_id>". No other top-level frames on the page.`,
    expected_frames: panels.map(p => p.frame_name),
  };

  const missing_scene_defs = panels.filter(p => !p.scene_loaded).map(p => p.scene_id);

  const figma_instructions = [
    `Create a Figma page "${layout_plan.page_name}" with one frame per storyboard panel.`,
    `NAMING CONTRACT (verification + comment round-trip key on this): ${naming_contract.rule}`,
    `Place frames on the grid in layout_plan.positions (${PANEL_W}x${PANEL_H} each).`,
    'Fill each frame with its panel_png image. Below the image, add a small caption text node with: title, duration_s, camera, transition_in (and voiceover when present).',
    'After creation, report the file key so verify_figma_export can run the read-back.',
  ].join('\n');

  return { panels, layout_plan, naming_contract, figma_instructions, missing_scene_defs };
}

/**
 * Render one panel still per scene via the Remotion node API (bundle once,
 * renderStill per scene at mid-frame). RENDER-tier — local only.
 *
 * @param {object} manifest
 * @param {object} sceneDefs
 * @param {object} opts
 * @param {string} opts.outputDir - Absolute directory for the PNGs
 * @param {string} [opts.entryPoint] - Remotion entry (default src/remotion/index.js)
 * @param {object} [opts.renderer] - { bundle, selectComposition, renderStill } override (tests)
 * @returns {Promise<Array<{ scene_id, path, frame }>>}
 */
export async function renderStoryboardPanels(manifest, sceneDefs, opts) {
  const { outputDir } = opts || {};
  if (!outputDir) throw new Error('renderStoryboardPanels requires opts.outputDir');
  mkdirSync(outputDir, { recursive: true });

  let renderer = opts.renderer;
  if (!renderer) {
    const bundler = await import('@remotion/bundler');
    const r = await import('@remotion/renderer');
    renderer = { bundle: bundler.bundle, selectComposition: r.selectComposition, renderStill: r.renderStill };
  }

  const serveUrl = await renderer.bundle({
    entryPoint: opts.entryPoint || join(process.cwd(), 'src/remotion/index.js'),
    publicDir: join(process.cwd(), 'public'),
  });

  const results = [];
  for (const entry of manifest.scenes || []) {
    const sceneId = entry.scene || entry.scene_id;
    const scene = sceneDefs?.[sceneId];
    if (!scene) continue;
    const inputProps = { scene };
    const composition = await renderer.selectComposition({
      serveUrl, id: 'Scene', inputProps,
    });
    // Mid-scene frame: representative of the held composition, past entrances.
    const frame = Math.min(
      composition.durationInFrames - 1,
      Math.max(0, Math.round(composition.durationInFrames / 2)),
    );
    const output = join(outputDir, `${sceneId}.png`);
    await renderer.renderStill({
      serveUrl, composition, inputProps, frame, output,
      scale: PANEL_SCALE,
      chromiumOptions: { gl: 'swangle' },
    });
    results.push({ scene_id: sceneId, path: output, frame });
  }
  return results;
}
