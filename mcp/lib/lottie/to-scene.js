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
 * Unlike the sibling figma importer, this one is held to `validateScene` (see
 * `lottieToScene`'s own tests) — so `type`/`role` values below are drawn from
 * the validator's actual enums, not hand-typed marketing-copy labels
 * (`headline`, `brand_mark`, `cta_button`, ...) that `validateScene` has never
 * accepted (ANI-199 P1). The v3 `semantic.components[].type` enum is scoped to
 * a narrow set of AI-tool-UI archetypes, so most Lottie content (logos,
 * headlines, backdrops) has no precise match; we map what we can name with
 * real confidence and fall back to the closest generic bucket (`stacked_cards`
 * / `prompt_card`) rather than inventing a type the validator would reject.
 *
 * Pure module (no Node-only imports) — platform-portable, though the tool is
 * registered `edgeReady: false` for v1 (see `mcp/tool-groups.js`); the
 * hostile-input bound isn't complete enough yet to expose on the hosted edge.
 */

import { parseLottie } from './parse.js';
import { VALID_SEMANTIC_COMPONENT_TYPES, SCENE_DURATION_S_BOUNDS } from '../../../src/remotion/lib.js';

const DEFAULT_DURATION_S = 4;
const CANVAS_W = 1920;
const CANVAS_H = 1080;

const VALID_TYPES = new Set(VALID_SEMANTIC_COMPONENT_TYPES);

/** Slugify a layer name into a stable id fragment. */
function slug(name, fallback) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback;
}

/** Escape text for embedding in HTML — both element content AND a quoted
 *  attribute value. Every `layerHtml` interpolation site is inside a
 *  double-quoted attribute or element text, so `"`/`'` must be escaped too:
 *  an unescaped `"` in an attacker-controlled value (e.g. an unrecognised
 *  Lottie layer `ty`, echoed into `data-lottie-layer`) breaks out of the
 *  attribute and injects arbitrary attributes/CSS into the `srcDoc` a
 *  renderer treats as trusted. */
function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// Name-pattern matches, restricted to the real `VALID_SEMANTIC_COMPONENT_TYPES`
// enum and to `validateScene`'s component `role` enum (hero/supporting/
// background/wildcard — never the old `cta`/`atmosphere` values, which
// `validateScene` has never accepted for a component role either).
const NAME_PATTERNS = [
  { re: /\b(hero|headline|title|cta|button|btn)\b/i, type: 'prompt_card', role: 'hero', confidence: 0.75 },
  { re: /\b(bg|background|backdrop)\b/i, type: 'stacked_cards', role: 'background', confidence: 0.7 },
  { re: /\b(dropdown|menu|select)\b/i, type: 'dropdown_menu', role: 'supporting', confidence: 0.75 },
  { re: /\b(upload|drop[- ]?zone|import)\b/i, type: 'upload_zone', role: 'supporting', confidence: 0.75 },
  { re: /\b(chip|tag|pill|badge)\b/i, type: 'chip_row', role: 'supporting', confidence: 0.7 },
  { re: /\b(result|stat|metric|chart|kpi)\b/i, type: 'result_stack', role: 'supporting', confidence: 0.7 },
  { re: /\b(icon|avatar|logo|brand|mark|wordmark)\b/i, type: 'icon_label_row', role: 'supporting', confidence: 0.65 },
  { re: /\b(input|search|field|prompt|ask)\b/i, type: 'input_field', role: 'supporting', confidence: 0.7 },
];

// Sanity guard: every NAME_PATTERNS type must be a real, validator-enforced
// component type. Catches the exact class of drift this file shipped with
// (ANI-199 P1) the moment it's reintroduced, instead of at review time.
for (const p of NAME_PATTERNS) {
  if (!VALID_TYPES.has(p.type)) {
    throw new Error(`lottie/to-scene.js: NAME_PATTERNS references invalid component type "${p.type}"`);
  }
}

/** Infer { type, role, confidence } from a normalised Lottie layer. `role` is
 *  always one of the validator's component roles (hero/supporting/background);
 *  `type` is always one of `VALID_SEMANTIC_COMPONENT_TYPES`. */
function inferSemantics(layer, { isLargestText, areaRatio }) {
  for (const p of NAME_PATTERNS) {
    if (p.re.test(layer.name || '')) return { type: p.type, role: p.role, confidence: p.confidence };
  }
  if (layer.ty === 5 && isLargestText) return { type: 'prompt_card', role: 'hero', confidence: 0.6 };
  if (areaRatio > 0.85) return { type: 'stacked_cards', role: 'background', confidence: 0.6 };
  // No confident, name- or shape-driven match: fall back to the closest
  // generic "visual content" bucket the enum offers rather than emit a type
  // validateScene would reject.
  return { type: 'stacked_cards', role: 'supporting', confidence: layer.ty === 5 ? 0.5 : 0.4 };
}

/** Map a component's (role, type) to a valid `layer.product_role`
 *  (hero/supporting/functional/decorative — a distinct, smaller enum from the
 *  component role above). */
function productRoleFor(role, type) {
  if (role === 'hero') return 'hero';
  if (role === 'background') return 'decorative';
  const FUNCTIONAL_TYPES = new Set(['input_field', 'dropdown_menu', 'upload_zone', 'chip_row']);
  return FUNCTIONAL_TYPES.has(type) ? 'functional' : 'supporting';
}

/**
 * Validate/normalise a colour before it's interpolated into an inline
 * `style` value. `esc()` escapes markup/attribute delimiters, but a colour is
 * interpolated bare into a CSS property value (`color:${c}`), where escaping
 * `"`/`<`/`>` doesn't help — a value like `red;background-image:url(...)`
 * contains none of those characters and would still inject a second CSS
 * declaration. `parse.js`'s own `normalizeColor` already constrains every
 * entry in `layer.colors` to `#rrggbb`, but this is a second, independent
 * check at the point of interpolation: never trust a colour string just
 * because it arrived in a field named `colors` — validate its shape here too,
 * so a future change to parse.js (or a differently-sourced colour) can't
 * turn into a CSS/attribute injection on its own.
 */
export function safeColor(c, fallback) {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : fallback;
}

/** Placeholder HTML for a layer — text string, or a fill-coloured box. */
function layerHtml(layer) {
  const root = 'position:absolute;inset:0;margin:0;box-sizing:border-box';
  if (layer.ty === 5 && layer.text) {
    const color = safeColor(layer.colors[0], '#ffffff');
    return `<div style="${root};display:flex;align-items:center;justify-content:center;` +
      `color:${color};font-family:system-ui,sans-serif;text-align:center">${esc(layer.text)}</div>`;
  }
  const bg = safeColor(layer.colors[0], 'transparent');
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
 * Convert a raw Lottie animation into a v3 semantic scene.
 *
 * Always goes through `parseLottie` — there is deliberately no "input already
 * looks parsed, skip parsing" shortcut. The MCP schema accepts an arbitrary
 * object, so a shortcut keyed on shape (e.g. "has a `layers` array and a
 * `palette` key") is attacker-steerable: a caller can hand a normalized-
 * looking object with an oversized `layers` array and bypass every hostile-
 * input limit `parseLottie` enforces, and a genuine raw Lottie that merely
 * happens to carry an extra top-level `palette` property would be
 * misdetected as pre-parsed and crash (its raw layers lack `colors`/
 * `position`). If an internal caller ever needs to pass an already-parsed
 * structure, that's a distinct, non-exported entry point the MCP handler
 * can't reach — not a public-input heuristic.
 *
 * @param {string|object} input - Raw Lottie `.json` content (string or object).
 * @param {object} [options] - { personality?, duration_s?, source_name? }
 * @returns {{ scene: object, report: object }}
 */
export function lottieToScene(input, options = {}) {
  const parsed = parseLottie(input);

  if (parsed.layers.length === 0) {
    throw new Error('Lottie has no visual layers to convert (only null/audio/camera or hidden layers).');
  }

  // A caller-supplied duration_s that validateScene would reject (e.g. 100,
  // -2) must fail here with a clear message, not flow through into a scene
  // the handler returns without ever calling validateScene on its own output.
  if (options.duration_s != null) {
    const { min, max } = SCENE_DURATION_S_BOUNDS;
    if (typeof options.duration_s !== 'number' || Number.isNaN(options.duration_s) || options.duration_s < min || options.duration_s > max) {
      throw new Error(`duration_s must be between ${min} and ${max} (got ${options.duration_s})`);
    }
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
    // Layer names aren't unique in Lottie (legal, and common with
    // copy-pasted layers) — a name-derived id alone collides and the
    // compiler's id-keyed maps silently overwrite one layer/component/
    // interaction with the next (ANI-199 P1). `i` is this layer's position
    // in the already-flattened (precomp-traversed) list, so it's unique and
    // stable across runs; suffixing it makes every id unique without
    // discarding the readable name-derived prefix.
    const id = `${sem.role}_${slug(layer.name, 'layer')}_${i}`;

    layers.push({
      id,
      type: 'html',
      depth_class: sem.role === 'background' ? 'background' : 'foreground',
      content: layerHtml(layer),
      product_role: productRoleFor(sem.role, sem.type),
    });
    components.push({
      id: `cmp_${id}`,
      type: sem.type,
      role: sem.role,
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
    // Must be a real layer id (validateScene resolves it against scene.layers,
    // not against a display name) — the hero component's own layer, or the
    // first visual layer when nothing was inferred as hero (ANI-199 P1).
    primary_subject: heroComponent?.layer_ref || layers[0].id,
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
