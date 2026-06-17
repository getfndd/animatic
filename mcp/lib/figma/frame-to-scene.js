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

/**
 * The first visible image fill paint on a node, normalized to the fields the
 * exporter needs, or null. `scaleMode`/`imageTransform` drive the CSS the fill
 * renders with (see `fillImgHtml`).
 */
export function imageFillPaint(node) {
  const fill = (node.fills || []).find(f => f.visible !== false && f.type === 'IMAGE');
  if (!fill) return null;
  return {
    imageRef: fill.imageRef || null,
    scaleMode: fill.scaleMode || 'FILL',
    imageTransform: fill.imageTransform || null,
    rotation: fill.rotation || 0,
    scalingFactor: fill.scalingFactor,
  };
}

/**
 * Collect `{ nodeId, imageRef }` for every visible image-fill node in a
 * subtree, mirroring `nodeToHtml`'s visibility + depth-6 cutoff so we only
 * gather fills that actually render. CALL PER DIRECT CHILD at depth 0 — that's
 * the depth origin `nodeToHtml(child)` uses, so collecting from the frame root
 * would be off by one and miss fills 6 levels into a child (ANI-175).
 */
export function collectImageFills(node, depth = 0) {
  if (!node || node.visible === false || depth > 6) return [];
  const out = [];
  const paint = imageFillPaint(node);
  if (paint?.imageRef) out.push({ nodeId: node.id, imageRef: paint.imageRef });
  for (const child of node.children || []) out.push(...collectImageFills(child, depth + 1));
  return out;
}

/**
 * Translate a Figma CROP `imageTransform` into CSS for an inner `<img>`.
 *
 * Figma's `imageTransform` is a normalized 2×3 affine `[[a,b,tx],[c,d,ty]]`
 * mapping container-space [0..1]² → the image sample point. To *render* the
 * image we apply its inverse (image → container). The convention is
 * reverse-engineered (Figma doesn't document it and its own SVG export is
 * buggy here) — the rendered-pixel test pins the mechanism.
 *
 * Returns one of:
 *  - { mode:'panzoom', widthPct, heightPct, leftPct, topPct } — pure pan/zoom
 *    (diagonal, positive scales); exact, needs no pixel box, `object-fit:fill`.
 *  - { mode:'matrix', css } — a 90° multiple (or axis flip): the linear part is
 *    diagonal or anti-diagonal. Needs the node box to conjugate the normalized
 *    linear part into pixel space.
 *  - null — non-invertible, OR genuine shear / non-90° rotation (the linear part
 *    has both diagonal AND anti-diagonal components), OR a matrix case with no
 *    known box. The caller degrades to cover + advisory. We deliberately refuse
 *    shear/arbitrary rotation: those aren't a Figma image-fill DOF and the
 *    matrix→CSS convention is reverse-engineered — better an honest cover than a
 *    confidently-wrong crop.
 */
export function cropFillCss(imageTransform, boxW, boxH) {
  const m = imageTransform;
  if (!Array.isArray(m) || m.length < 2 || !Array.isArray(m[0]) || !Array.isArray(m[1])) return null;
  const [a, b, tx] = m[0];
  const [c, d, ty] = m[1];
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
  // Affine inverse (image → container), normalized.
  const A = d / det, B = -b / det, C = -c / det, D = a / det;
  const Tx = -(A * tx + B * ty);
  const Ty = -(C * tx + D * ty);

  const diagonal = Math.abs(B) < 1e-6 && Math.abs(C) < 1e-6;       // 0° / 180° / flips
  const antidiagonal = Math.abs(A) < 1e-6 && Math.abs(D) < 1e-6;   // 90° / 270°
  // Both components present → a shear or a non-90° rotation → degrade honestly.
  if (!diagonal && !antidiagonal) return null;

  if (diagonal && A > 0 && D > 0) {
    return {
      mode: 'panzoom',
      widthPct: round4(100 * A),
      heightPct: round4(100 * D),
      leftPct: round4(100 * Tx),
      topPct: round4(100 * Ty),
    };
  }
  // 90° multiple / flip: conjugate the linear part by S=diag(W,H) into pixel space.
  if (!boxW || !boxH) return null;
  const bpx = round4(B * boxH / boxW);
  const cpx = round4(C * boxW / boxH);
  // CSS matrix(a,b,c,d,e,f): x'=a·x+c·y+e, y'=b·x+d·y+f.
  return { mode: 'matrix', css: `matrix(${round4(A)},${cpx},${bpx},${round4(D)},${round4(Tx * boxW)},${round4(Ty * boxH)})` };
}

const round4 = (n) => (Math.round(n * 1e4) / 1e4) || 0; // `|| 0` collapses -0 → 0

/**
 * Build the inner fill element for a node whose image fill was exported.
 * Rendered as an absolutely-positioned `<img>` (not `background-image`) so a
 * faithful CROP `transform` is possible. The caller places this BEHIND the
 * node's real children (z-index:0 vs the children's z-index:1 wrapper) inside
 * a `position:relative;overflow:hidden` node — no double-render (ANI-175).
 *
 * @param {object} node
 * @param {{ dataUri: string, assetPath?: string }} asset
 * @param {string[]} advisories - degradation messages are pushed here
 */
function fillImgHtml(node, asset, advisories = []) {
  const paint = imageFillPaint(node) || {};
  const mode = String(paint.scaleMode || 'FILL').toUpperCase();
  const base = 'position:absolute;z-index:0';

  if (mode === 'TILE') {
    // A single <img> can't repeat — a tiled background is the faithful path.
    return `<div data-image-fill-asset style="${base};inset:0;background-image:url(${asset.dataUri});background-repeat:repeat;background-position:top left"></div>`;
  }

  let style;
  if (mode === 'CROP') {
    const box = node.absoluteBoundingBox || {};
    const dimsKnown = Number.isFinite(asset.width) && Number.isFinite(asset.height);
    // Honesty path: only claim a faithful crop when we have the full picture —
    // the source's intrinsic dims (null for unparsed WebP/GIF) AND a supported
    // transform (pan/zoom or a 90° multiple). Anything else degrades to cover
    // with an advisory rather than a confidently-wrong crop.
    const crop = dimsKnown ? cropFillCss(paint.imageTransform, box.width, box.height) : null;
    if (!crop) {
      const why = dimsKnown ? 'unsupported transform (shear / non-90° rotation)' : 'unknown source dimensions';
      advisories.push(`${node.id}: CROP fell back to cover — ${why}`);
      style = `${base};inset:0;width:100%;height:100%;object-fit:cover`;
    } else if (crop.mode === 'panzoom') {
      style = `${base};left:${crop.leftPct}%;top:${crop.topPct}%;width:${crop.widthPct}%;height:${crop.heightPct}%;object-fit:fill`;
    } else {
      style = `${base};inset:0;width:100%;height:100%;object-fit:fill;transform-origin:0 0;transform:${crop.css}`;
    }
  } else {
    const fit = mode === 'FIT' ? 'contain' : mode === 'STRETCH' ? 'fill' : 'cover';
    style = `${base};inset:0;width:100%;height:100%;object-fit:${fit}`;
  }
  return `<img data-image-fill-asset alt="" src="${asset.dataUri}" style="${style}" />`;
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
 *
 * Sizing rules (review findings on PR #89 — bare divs collapse to 0 height):
 *   - the layer ROOT (depth 0) is `position:absolute;inset:0` so it fills
 *     its container in EVERY embedding the renderer uses: inside an iframe
 *     srcDoc (HtmlLayer — a bare fragment's body has default margin and no
 *     height chain, so width/height:100% computes to 0 there) it anchors
 *     to the iframe viewport; inside dangerouslySetInnerHTML it anchors to
 *     the positioned layer wrapper
 *   - childless non-text nodes with a fill get explicit px dimensions from
 *     their bounding box, so they hold their shape inside flex parents
 */
function nodeToHtml(node, depth = 0, ctx = {}) {
  if (node.visible === false) return '';
  if (depth > 6) return '';

  const rootStyles = depth === 0
    ? ['position:absolute', 'inset:0', 'margin:0', 'box-sizing:border-box']
    : [];

  if (node.type === 'TEXT') {
    return `<div style="${[...rootStyles, textStyleToCss(node)].join(';')}">${esc(node.characters)}</div>`;
  }

  // An exported image fill (ANI-175): the node renders a real `<img>` behind
  // its children. Otherwise an image fill stays the dark placeholder.
  const fillAsset = hasImageFill(node) ? ctx.imageAssets?.[node.id] : null;
  const renderFill = Boolean(fillAsset?.dataUri);

  const styles = [...rootStyles];
  const layout = autoLayoutToCss(node);
  if (layout) styles.push(layout);
  const bg = solidFill(node);
  if (bg && node.type !== 'TEXT') styles.push(`background:${bg}`);
  if (node.cornerRadius) styles.push(`border-radius:${Math.round(node.cornerRadius)}px`);
  if (hasImageFill(node)) {
    if (renderFill) {
      // Clip the absolutely-positioned fill `<img>` and establish a containing
      // block + stacking context. The depth-0 root is already `position:absolute`
      // (its own containing block) — only nested nodes need `position:relative`.
      if (depth > 0) styles.push('position:relative');
      styles.push('overflow:hidden');
    } else {
      styles.push('background:#222');
    }
  }

  const hasChildren = (node.children || []).some(c => c.visible !== false);
  const filled = Boolean(bg) || hasImageFill(node);
  if (depth > 0 && !hasChildren && filled) {
    const box = node.absoluteBoundingBox || {};
    if (box.width) styles.push(`width:${Math.round(box.width)}px`);
    if (box.height) styles.push(`height:${Math.round(box.height)}px`);
    styles.push('flex-shrink:0');
  }

  const children = (node.children || [])
    .map(child => nodeToHtml(child, depth + 1, ctx))
    .filter(Boolean)
    .join('');

  // The fill paints at z-index:0; real children ride above in a z-index:1
  // wrapper so positioned/transformed descendants can't slip behind the fill.
  let inner = children;
  if (renderFill) {
    const fillEl = fillImgHtml(node, fillAsset, ctx.advisories);
    inner = children
      ? `${fillEl}<div style="position:relative;z-index:1">${children}</div>`
      : fillEl;
  }

  const attrs = [
    `data-figma-node="${esc(node.id)}"`,
    hasImageFill(node) ? 'data-image-fill="true"' : null,
    renderFill && fillAsset.assetPath ? `data-asset-path="${esc(fillAsset.assetPath)}"` : null,
  ].filter(Boolean).join(' ');

  return `<div ${attrs} style="${styles.join(';')}">${inner}</div>`;
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
  // Exported image fills (ANI-175) + any CROP degradations collected while
  // walking the tree. Empty/no-op when `options.imageAssets` is absent.
  const ctx = { imageAssets: options.imageAssets || {}, advisories: [] };

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
    const html = nodeToHtml(child, 0, ctx);
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
      rendered_image_fills: Object.keys(ctx.imageAssets).length,
      palette: [...palette],
      advisory: [
        ...inferences.filter(i => i.confidence < 0.5).map(i =>
          `${i.layer}: low-confidence inference (${i.confidence}) — review inferred_type/${i.inferred_type}`),
        ...ctx.advisories,
      ],
    },
  };
}
