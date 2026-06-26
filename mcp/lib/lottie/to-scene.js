/**
 * Lottie → Animatic v3 semantic scene (ANI-199).
 *
 * Mirrors `figma/frame-to-scene.js`: each visual Lottie layer becomes a
 * semantic component with a placeholder HTML layer, a descriptive type/role,
 * an extracted brand palette, and a conservative staggered `enter`
 * choreography with a reactive camera. Animatic supplies the actual motion
 * (the default `as-fadeInUp` entrance primitive compiles every `enter`), so we
 * do not translate Lottie's own keyframes — vector/shape fidelity is out of
 * scope for v0. The scene compiles to real layer tracks; it is intentionally a
 * starting point an editor refines, not a pixel-faithful reproduction.
 *
 * Pure module (no Node-only imports) — keeps the tool edge-safe.
 */

import { parseLottie } from './parse.js';

const DEFAULT_DURATION_S = 4;
const CANVAS_W = 1920;
const CANVAS_H = 1080;

/** Slugify a layer name into a stable id fragment. */
function slug(name, fallback) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback;
}

/** Escape text for embedding in HTML. */
function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Snap a normalised (0–1) centre point to the nearest 9-point named anchor. */
function nearestAnchor(nx, ny) {
  const col = nx < 0.34 ? 'left' : nx > 0.66 ? 'right' : 'center';
  const row = ny < 0.34 ? 'top' : ny > 0.66 ? 'bottom' : 'center';
  if (row === 'center' && col === 'center') return 'center';
  if (row === 'center') return `center-${col}`;
  if (col === 'center') return `${row}-center`;
  return `${row}-${col}`;
}

const NAME_PATTERNS = [
  { re: /\b(logo|brand|mark|wordmark)\b/i, type: 'brand_mark', role: 'atmosphere' },
  { re: /\b(cta|button|btn)\b/i, type: 'cta_button', role: 'cta' },
  { re: /\b(bg|background|backdrop)\b/i, type: 'backdrop', role: 'atmosphere' },
  { re: /\b(hero|headline|title)\b/i, type: 'headline', role: 'hero' },
];

/** Infer { type, role, confidence } from a normalised Lottie layer. */
function inferSemantics(layer, { isLargestText, areaRatio }) {
  for (const p of NAME_PATTERNS) {
    if (p.re.test(layer.name || '')) return { type: p.type, role: p.role, confidence: 0.8 };
  }
  if (layer.ty === 5 && isLargestText) return { type: 'headline', role: 'hero', confidence: 0.6 };
  if (areaRatio > 0.85) return { type: 'backdrop', role: 'atmosphere', confidence: 0.6 };
  if (layer.ty === 5) return { type: 'text_block', role: 'supporting', confidence: 0.5 };
  if (layer.ty === 2) return { type: 'ui_card', role: 'supporting', confidence: 0.45 };
  return { type: 'ui_card', role: 'supporting', confidence: 0.4 };
}

/** Placeholder HTML for a layer — text string, or a fill-coloured box. */
function layerHtml(layer) {
  const root = 'position:absolute;inset:0;margin:0;box-sizing:border-box';
  if (layer.ty === 5 && layer.text) {
    const color = layer.colors[0] || '#ffffff';
    return `<div style="${root};display:flex;align-items:center;justify-content:center;` +
      `color:${color};font-family:system-ui,sans-serif;text-align:center">${esc(layer.text)}</div>`;
  }
  const bg = layer.colors[0] || 'transparent';
  return `<div data-lottie-layer="${esc(layer.typeLabel)}" style="${root};background:${bg}"></div>`;
}

/** Layout-constraint fields (anchor + canvas-space size caps) for a layer. */
function constraints(layer, comp) {
  const nx = comp.width ? Math.max(0, Math.min(1, layer.position.x / comp.width)) : 0.5;
  const ny = comp.height ? Math.max(0, Math.min(1, layer.position.y / comp.height)) : 0.5;
  const out = { anchor: nearestAnchor(nx, ny) };
  if (layer.size && layer.size.w && comp.width) {
    out.max_width = Math.round((layer.size.w / comp.width) * CANVAS_W);
    out.max_height = Math.round((layer.size.h / comp.height) * CANVAS_H);
  }
  return out;
}

/**
 * Convert a parsed Lottie (or raw JSON / object) into a v3 semantic scene.
 *
 * @param {string|object} input - Raw Lottie `.json` (string/object) or a value
 *   already produced by `parseLottie`.
 * @param {object} [options] - { personality?, duration_s?, source_name? }
 * @returns {{ scene: object, report: object }}
 */
export function lottieToScene(input, options = {}) {
  // Accept either raw Lottie or a pre-parsed structure.
  const parsed = input && Array.isArray(input.layers) && 'palette' in input
    ? input
    : parseLottie(input);

  if (parsed.layers.length === 0) {
    throw new Error('Lottie has no visual layers to convert (only null/audio/camera or hidden layers).');
  }

  const comp = { width: parsed.width, height: parsed.height };
  const compArea = (comp.width || 1) * (comp.height || 1);

  // Largest text layer is the headline candidate.
  let largestTextIdx = -1;
  let largestTextSize = -1;
  parsed.layers.forEach((l, i) => {
    if (l.ty === 5) {
      const area = l.size ? (l.size.w || 0) * (l.size.h || 0) : 1;
      if (area > largestTextSize) { largestTextSize = area; largestTextIdx = i; }
    }
  });

  const layers = [];
  const components = [];
  const inferences = [];

  parsed.layers.forEach((layer, i) => {
    const areaRatio = layer.size ? ((layer.size.w || 0) * (layer.size.h || 0)) / compArea : 0;
    const sem = inferSemantics(layer, { isLargestText: i === largestTextIdx, areaRatio });
    const id = `${sem.role}_${slug(layer.name, `layer_${i}`)}`;

    layers.push({
      id,
      type: 'html',
      depth_class: sem.role === 'atmosphere' ? 'background' : 'foreground',
      content: layerHtml(layer),
      product_role: sem.role,
    });
    components.push({
      id: `cmp_${id}`,
      type: sem.type,
      role: sem.role === 'hero' ? 'hero' : 'supporting',
      layer_ref: id,
      ...constraints(layer, comp),
      props: { source: 'lottie', lottie_layer: layer.typeLabel, name: layer.name || id },
    });
    inferences.push({
      layer: id,
      name: layer.name,
      lottie_type: layer.typeLabel,
      inferred_type: sem.type,
      inferred_role: sem.role,
      confidence: sem.confidence,
    });
  });

  // Conservative motion: staggered entrances in z-order, hero last so it lands
  // after its context; reactive camera lets the personality decide movement.
  const ordered = [...components].sort((a, b) =>
    (a.role === 'hero' ? 1 : 0) - (b.role === 'hero' ? 1 : 0));
  const interactions = ordered.map((cmp, i) => ({
    id: `int_enter_${cmp.layer_ref}`,
    target: cmp.id,
    kind: 'enter',
    timing: { at_ms: 150 * i },
  }));

  const heroComponent = components.find(c => c.role === 'hero');
  const heroInference = inferences.find(inf => `cmp_${inf.layer}` === heroComponent?.id);
  const sceneSlug = slug(parsed.name || options.source_name, 'lottie_import');

  const scene = {
    scene_id: `sc_${sceneSlug}`,
    format_version: 3,
    duration_s: options.duration_s || (parsed.durationS >= 0.5 ? Math.min(parsed.durationS, 30) : DEFAULT_DURATION_S),
    fps: 60,
    ...(options.personality ? { personality: options.personality } : {}),
    tags: ['lottie_import', ...(heroInference ? [heroInference.inferred_role] : [])],
    source: {
      kind: 'lottie',
      name: parsed.name || options.source_name || null,
      lottie_fps: parsed.fps,
      lottie_duration_s: Number(parsed.durationS.toFixed(3)),
    },
    primary_subject: heroComponent?.props?.name || parsed.name || 'lottie',
    layers,
    semantic: {
      components,
      interactions,
      camera_behavior: { mode: 'reactive' },
    },
    brand: parsed.palette.length > 0 ? { palette: parsed.palette } : undefined,
  };

  return {
    scene,
    report: {
      source: { name: parsed.name, width: parsed.width, height: parsed.height, fps: parsed.fps, duration_s: Number(parsed.durationS.toFixed(3)) },
      components: inferences,
      visual_layers: parsed.layers.length,
      palette: parsed.palette,
      advisory: [
        ...inferences.filter(i => i.confidence < 0.5).map(i =>
          `${i.layer}: low-confidence inference (${i.confidence}) — review inferred_type/${i.inferred_type}`),
        'Lottie motion is not translated — Animatic re-animates via personality (vector fidelity out of scope for v0).',
      ],
    },
  };
}
