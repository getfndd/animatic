/**
 * Figma frame → Animatic v3 scene (ANI-114)
 *
 * The conversion core: walks a Figma node document (from `fetchNode`) and
 * emits a v3 semantic scene — real HTML layers, semantic components with
 * `layer_ref`s, inferred roles, a conservative entrance choreography, and
 * annotation-friendly ids/tags so `annotate_scenes` lands at advisory
 * confidence without human touch-up.
 *
 * Pure: takes the node tree, returns the scene. Network lives in
 * `client.js`; the MCP handler glues them.
 *
 * What Preset's Figma code taught us (vendored patterns): color conversion
 * and confidence-scored name matching. What's new here (Preset is
 * token-focused by design): auto-layout extraction and the scene mapping
 * itself.
 */

import { figmaColorToHex } from './client.js';

// ── Name → semantics heuristics ─────────────────────────────────────────────

/**
 * Component-type inference from layer names, ordered most→least specific.
 * Confidence mirrors the scene-annotations convention (0-1, ≥0.5 advisory).
 */
const NAME_PATTERNS = [
  { re: /\b(cta|button|btn|sign[- ]?up|get[- ]?started|try[- ]now)\b/i, type: 'cta_button', role: 'cta', confidence: 0.85 },
  { re: /\b(prompt|search|input|field|form|ask)\b/i, type: 'input_field', role: 'input', confidence: 0.8 },
  { re: /\b(chart|graph|metric|stat|kpi|dashboard)\b/i, type: 'result_stack', role: 'result', confidence: 0.8 },
  { re: /\b(card|tile|panel)s?\b/i, type: 'ui_card', role: 'supporting', confidence: 0.7 },
  { re: /\b(nav|header|toolbar|menu|sidebar)\b/i, type: 'browser_frame', role: 'chrome', confidence: 0.75 },
  { re: /\b(logo|brand|mark|wordmark)\b/i, type: 'brand_mark', role: 'atmosphere', confidence: 0.8 },
  { re: /\b(hero|headline|title|h1)\b/i, type: 'headline', role: 'hero', confidence: 0.8 },
  { re: /\b(quote|testimonial|review)\b/i, type: 'quote_block', role: 'proof', confidence: 0.8 },
];

/** Slugify a Figma layer name into a stable id fragment. */
function slug(name, fallback) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback;
}

/** Infer { type, role, confidence } for a node from its name + structure. */
function inferComponentSemantics(node, { isLargestText = false, areaRatio = 0 } = {}) {
  for (const pattern of NAME_PATTERNS) {
    if (pattern.re.test(node.name || '')) {
      return { type: pattern.type, role: pattern.role, confidence: pattern.confidence };
    }
  }
  // Structural fallbacks: the biggest text is the headline; anything
  // covering most of the frame is background atmosphere.
  if (node.type === 'TEXT' && isLargestText) {
    return { type: 'headline', role: 'hero', confidence: 0.6 };
  }
  if (areaRatio > 0.85) {
    return { type: 'backdrop', role: 'atmosphere', confidence: 0.6 };
  }
  if (node.type === 'TEXT') {
    return { type: 'text_block', role: 'supporting', confidence: 0.5 };
  }
  return { type: 'ui_card', role: 'supporting', confidence: 0.4 };
}

// ── Style extraction ────────────────────────────────────────────────────────

/** First visible solid fill → hex, or null. */
function solidFill(node) {
  const fill = (node.fills || []).find(f => f.visible !== false && f.type === 'SOLID' && f.color);
  return fill ? figmaColorToHex({ ...fill.color, a: fill.opacity ?? fill.color.a }) : null;
}

/** Whether the node carries an image fill. */
function hasImageFill(node) {
  return (node.fills || []).some(f => f.visible !== false && f.type === 'IMAGE');
}

/** Map a Figma TEXT node's style to inline CSS. */
function textStyleToCss(node) {
  const s = node.style || {};
  const parts = [];
  if (s.fontFamily) parts.push(`font-family:'${s.fontFamily}',sans-serif`);
  if (s.fontSize) parts.push(`font-size:${Math.round(s.fontSize)}px`);
  if (s.fontWeight) parts.push(`font-weight:${s.fontWeight}`);
  if (s.lineHeightPx) parts.push(`line-height:${Math.round(s.lineHeightPx)}px`);
  if (s.letterSpacing) parts.push(`letter-spacing:${s.letterSpacing.toFixed(2)}px`);
  if (s.textAlignHorizontal) parts.push(`text-align:${s.textAlignHorizontal.toLowerCase()}`);
  const color = solidFill(node);
  if (color) parts.push(`color:${color}`);
  return parts.join(';');
}

/**
 * Map Figma auto-layout to CSS flexbox — the piece Preset deliberately
 * doesn't have. Only emitted when the node actually uses auto-layout.
 */
export function autoLayoutToCss(node) {
  if (!node.layoutMode || node.layoutMode === 'NONE') return null;
  const parts = ['display:flex'];
  parts.push(`flex-direction:${node.layoutMode === 'VERTICAL' ? 'column' : 'row'}`);
  if (node.itemSpacing) parts.push(`gap:${Math.round(node.itemSpacing)}px`);
  const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
  if (pad.some(v => v)) parts.push(`padding:${pad.map(v => `${Math.round(v || 0)}px`).join(' ')}`);
  const justify = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
  if (node.primaryAxisAlignItems) parts.push(`justify-content:${justify[node.primaryAxisAlignItems] || 'flex-start'}`);
  if (node.counterAxisAlignItems) parts.push(`align-items:${justify[node.counterAxisAlignItems] || 'flex-start'}`);
  return parts.join(';');
}

// ── Node → HTML ─────────────────────────────────────────────────────────────

/** Escape text content for HTML embedding. */
function esc(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Render a node subtree to simple HTML. Depth-limited; auto-layout becomes
 * flexbox, text keeps its typography, image fills become placeholders that
 * reference the Figma image (export wiring is follow-up scope).
 */
function nodeToHtml(node, depth = 0) {
  if (node.visible === false) return '';
  if (depth > 6) return '';

  if (node.type === 'TEXT') {
    return `<div style="${textStyleToCss(node)}">${esc(node.characters)}</div>`;
  }

  const styles = [];
  const layout = autoLayoutToCss(node);
  if (layout) styles.push(layout);
  const bg = solidFill(node);
  if (bg && node.type !== 'TEXT') styles.push(`background:${bg}`);
  if (node.cornerRadius) styles.push(`border-radius:${Math.round(node.cornerRadius)}px`);
  if (hasImageFill(node)) {
    styles.push('background:#222');
    styles.push(`min-height:${Math.round(node.absoluteBoundingBox?.height || 120)}px`);
  }

  const children = (node.children || [])
    .map(child => nodeToHtml(child, depth + 1))
    .filter(Boolean)
    .join('');

  const attrs = [
    `data-figma-node="${esc(node.id)}"`,
    hasImageFill(node) ? 'data-image-fill="true"' : null,
  ].filter(Boolean).join(' ');

  return `<div ${attrs} style="${styles.join(';')}">${children}</div>`;
}

// ── Geometry → layout constraints ──────────────────────────────────────────

/**
 * Snap a normalized (0-1) center point to the nearest named anchor on the
 * layout-constraint system's 9-point grid (layout-constraints.js, ANI-74).
 */
export function nearestAnchor(nx, ny) {
  const snap = (v) => {
    const stops = [[0.15, 0], [0.5, 1], [0.85, 2]];
    stops.sort((a, b) => Math.abs(a[0] - v) - Math.abs(b[0] - v));
    return stops[0][1];
  };
  const cols = ['left', 'center', 'right'];
  const rows = ['top', 'center', 'bottom'];
  const col = cols[snap(nx)];
  const row = rows[snap(ny)];
  if (row === 'center' && col === 'center') return 'center';
  if (row === 'center') return `center-${col}`;
  return `${row}-${col}`;
}

/**
 * Derive layout-constraint fields (anchor + max size caps) for a child from
 * its Figma geometry relative to the frame, scaled onto the render canvas.
 * This is what keeps the converted scene's composition recognizably the
 * Figma layout instead of everything collapsing to role defaults.
 */
function geometryConstraints(child, frameBox, canvasW = 1920, canvasH = 1080) {
  const box = child.absoluteBoundingBox;
  if (!box || !frameBox.width || !frameBox.height) return {};
  const nx = ((box.x ?? 0) - (frameBox.x ?? 0) + (box.width ?? 0) / 2) / frameBox.width;
  const ny = ((box.y ?? 0) - (frameBox.y ?? 0) + (box.height ?? 0) / 2) / frameBox.height;
  return {
    anchor: nearestAnchor(nx, ny),
    max_width: Math.round(((box.width ?? 0) / frameBox.width) * canvasW),
    max_height: Math.round(((box.height ?? 0) / frameBox.height) * canvasH),
  };
}

/**
 * Exact pixel rect for a child, scaled from frame coordinates onto the
 * render canvas. SceneComposition honors `layer.position` directly, so
 * raw (uncompiled) renders reproduce the Figma layout faithfully; the
 * semantic compile path re-derives positions from the anchor/max
 * constraints above (approximate, gap-enforced) and overwrites these.
 */
function geometryPosition(child, frameBox, canvasW = 1920, canvasH = 1080) {
  const box = child.absoluteBoundingBox;
  if (!box || !frameBox.width || !frameBox.height) return null;
  const sx = canvasW / frameBox.width;
  const sy = canvasH / frameBox.height;
  return {
    x: Math.round(((box.x ?? 0) - (frameBox.x ?? 0)) * sx),
    y: Math.round(((box.y ?? 0) - (frameBox.y ?? 0)) * sy),
    w: Math.round((box.width ?? 0) * sx),
    h: Math.round((box.height ?? 0) * sy),
  };
}

// ── Frame → scene ───────────────────────────────────────────────────────────

const DEFAULT_DURATION_S = 4;

/**
 * Convert a fetched Figma frame document into a v3 semantic scene.
 *
 * @param {object} input
 * @param {object} input.document - Frame node from `fetchNode`
 * @param {string} [input.file_key] - For provenance metadata
 * @param {string} [input.node_id]
 * @param {object} [options]
 * @param {string} [options.personality] - Personality to pin on the scene
 * @param {number} [options.duration_s=4]
 * @returns {{ scene: object, report: object }}
 */
export function frameToScene(input, options = {}) {
  const frame = input?.document;
  if (!frame) throw new Error('frameToScene requires { document } from fetchNode');
  if (frame.type !== 'FRAME' && frame.type !== 'COMPONENT' && frame.type !== 'INSTANCE' && frame.type !== 'SECTION') {
    throw new Error(`Node ${frame.id} is a ${frame.type}, not a frame — point at a FRAME/COMPONENT node.`);
  }

  const frameBox = frame.absoluteBoundingBox || { width: 1920, height: 1080 };
  const frameArea = (frameBox.width || 1) * (frameBox.height || 1);

  // Direct children become components; each child's full subtree becomes
  // that component's layer HTML. Nested frames are therefore handled by
  // recursion inside nodeToHtml rather than exploding into more components.
  const children = (frame.children || []).filter(c => c.visible !== false);

  // Identify the largest text node (headline candidate) across direct children.
  let largestTextId = null;
  let largestTextSize = 0;
  for (const child of children) {
    const probe = child.type === 'TEXT' ? child : null;
    if (probe?.style?.fontSize > largestTextSize) {
      largestTextSize = probe.style.fontSize;
      largestTextId = probe.id;
    }
  }

  const sceneSlug = slug(frame.name, 'figma_frame');
  const layers = [];
  const components = [];
  const inferences = [];
  const palette = new Set();

  const frameBg = solidFill(frame);
  if (frameBg) palette.add(frameBg);

  children.forEach((child, i) => {
    const childBox = child.absoluteBoundingBox || {};
    const areaRatio = ((childBox.width || 0) * (childBox.height || 0)) / frameArea;
    const sem = inferComponentSemantics(child, {
      isLargestText: child.id === largestTextId,
      areaRatio,
    });

    const id = `${sem.role}_${slug(child.name, `layer_${i}`)}`;
    const html = nodeToHtml(child);
    if (!html) return;

    const color = solidFill(child);
    if (color) palette.add(color);

    const position = geometryPosition(child, frameBox);
    layers.push({
      id,
      type: 'html',
      depth_class: sem.role === 'atmosphere' ? 'background' : 'foreground',
      content: html,
      product_role: sem.role,
      ...(position ? { position } : {}),
    });
    components.push({
      id: `cmp_${id}`,
      type: sem.type,
      role: sem.role === 'hero' ? 'hero' : 'supporting',
      layer_ref: id,
      ...geometryConstraints(child, frameBox),
      props: { source: 'figma', figma_node: child.id, name: child.name },
    });
    inferences.push({
      layer: id,
      figma_node: child.id,
      name: child.name,
      inferred_type: sem.type,
      inferred_role: sem.role,
      confidence: sem.confidence,
    });
  });

  if (components.length === 0) {
    throw new Error(`Frame "${frame.name}" has no visible children to convert.`);
  }

  // Conservative motion intent: staggered entrances in z-order, hero last
  // (it should land after its context), reactive camera so the personality
  // decides movement. Editors refine from here — the point is a scene that
  // compiles and renders without touch-up.
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

  const scene = {
    scene_id: `sc_${sceneSlug}`,
    format_version: 3,
    duration_s: options.duration_s || DEFAULT_DURATION_S,
    fps: 60,
    ...(options.personality ? { personality: options.personality } : {}),
    tags: ['figma_import', ...(heroInference ? [heroInference.inferred_role] : [])],
    source: {
      kind: 'figma',
      file_key: input.file_key || null,
      node_id: input.node_id || frame.id,
      frame_name: frame.name,
    },
    primary_subject: heroComponent?.props?.name || frame.name,
    layers,
    semantic: {
      components,
      interactions,
      camera_behavior: { mode: 'reactive' },
    },
    brand: palette.size > 0 ? { palette: [...palette] } : undefined,
  };

  return {
    scene,
    report: {
      frame: { id: frame.id, name: frame.name, width: frameBox.width, height: frameBox.height },
      components: inferences,
      auto_layout_frames: children.filter(c => c.layoutMode && c.layoutMode !== 'NONE').length,
      image_fills: children.filter(hasImageFill).length,
      palette: [...palette],
      advisory: inferences.filter(i => i.confidence < 0.5).map(i =>
        `${i.layer}: low-confidence inference (${i.confidence}) — review inferred_type/${i.inferred_type}`),
    },
  };
}
