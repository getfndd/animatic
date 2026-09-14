/**
 * Lottie (Bodymovin / lottie-web ~5.x) raw-JSON parser — structure only, no
 * render (ANI-199).
 *
 * A `.json` Lottie is plain uncompressed JSON, so everything we need —
 * composition size/fps/duration, per-layer name/type/transform, and the colour
 * inventory — is extractable by walking the tree. We deliberately do NOT
 * interpolate animation: for an animated property we read its first keyframe's
 * start value, which is all the importer needs (Animatic supplies its own
 * motion). `.lottie` (a ZIP container) is out of scope for v0 and rejected with
 * a clear message rather than silently mis-parsed.
 *
 * Pure module: no Node-only imports, so the importer stays edge-safe
 * (TIER.TRANSFORM, edgeReady:true).
 */

/** Human-readable label per Lottie layer `ty`. */
const LAYER_TYPES = {
  0: 'precomp',
  1: 'solid',
  2: 'image',
  3: 'null',
  4: 'shape',
  5: 'text',
  6: 'audio',
  13: 'camera',
};

/** Layer types that carry no visual content and never become components. */
const NON_VISUAL = new Set([3 /* null */, 6 /* audio */, 13 /* camera */]);

// Hostile-input safety limits (ANI-199 P2). A Lottie is untrusted input on an
// edge runtime with no process-level sandbox, so unbounded recursion/fan-out
// must fail closed with a clear error instead of a stack overflow or OOM.
const MAX_SHAPE_GROUP_DEPTH = 64;   // nested `gr` shape groups
const MAX_SHAPES_VISITED = 20000;   // total shape items walked, across all layers
const MAX_PRECOMP_DEPTH = 8;        // nested precomp-inside-precomp levels
const MAX_TOTAL_LAYERS_VISITED = 4000; // layers walked, including inside precomps
const MAX_PARENT_CHAIN = 32;        // `parent` hops resolved per layer

/** Read a Lottie animated-property `{a, k}` wrapper → a static value.
 *  `a:0` → `k` is the value; `a:1` → `k` is a keyframe array, take the first
 *  keyframe's start (`s`). Returns `fallback` when the shape is unexpected. */
function staticValue(prop, fallback = null) {
  if (prop == null || typeof prop !== 'object') return fallback;
  if (prop.a === 1 && Array.isArray(prop.k)) {
    const first = prop.k[0];
    if (first && 's' in first) return first.s;
    return fallback;
  }
  return 'k' in prop ? prop.k : fallback;
}

/** [r,g,b(,a)] floats 0–1 → #rrggbb. */
function rgbToHex(c) {
  if (!Array.isArray(c) || c.length < 3) return null;
  const h = c.slice(0, 3).map(v => {
    const n = Math.round(Math.max(0, Math.min(1, Number(v))) * 255);
    return n.toString(16).padStart(2, '0');
  });
  return `#${h.join('')}`;
}

/** Normalise any Lottie colour representation to #rrggbb, or null. */
function normalizeColor(raw) {
  if (typeof raw === 'string') {
    // Solid layers carry a hex string (`sc`).
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : null;
  }
  return rgbToHex(raw);
}

/** Walk a shape-layer `shapes[]` tree, collecting fill/stroke/gradient colours.
 *  Groups (`gr`) nest children under `it[]`, so recurse (depth- and
 *  visit-count-bounded — ANI-199 P2, hostile input has no bound of its own).
 *  Gradient stops live in a flat `g.k.k` array. Lottie packs `g.p` *colour*
 *  stops first, each `[offset,r,g,b]`, immediately followed by (total_len -
 *  g.p*4)/2 *opacity* stops, each `[offset,alpha]` — a 2-wide record, not a
 *  4-wide one. Reading past `g.p*4` in groups of four walks into the opacity
 *  stops' 2-tuples misaligned and fabricates colours from offset/alpha pairs
 *  (ANI-199 P3); stop at `g.p*4`. */
function collectShapeColors(shapes, out, counters, depth = 0) {
  if (!Array.isArray(shapes)) return;
  if (depth > MAX_SHAPE_GROUP_DEPTH) {
    throw new Error(`Lottie shape group nesting exceeds the max depth (${MAX_SHAPE_GROUP_DEPTH}) — refusing to parse.`);
  }
  for (const item of shapes) {
    if (!item || typeof item !== 'object') continue;
    counters.shapes++;
    if (counters.shapes > MAX_SHAPES_VISITED) {
      throw new Error(`Lottie shape tree exceeds the max visited-shape limit (${MAX_SHAPES_VISITED}) — refusing to parse.`);
    }
    switch (item.ty) {
      case 'gr': // group → recurse
        collectShapeColors(item.it, out, counters, depth + 1);
        break;
      case 'fl': // fill
      case 'st': { // stroke
        const hex = normalizeColor(staticValue(item.c));
        if (hex) out.add(hex);
        break;
      }
      case 'gf': // gradient fill
      case 'gs': { // gradient stroke
        const stops = staticValue(item.g?.k);
        const colorStopCount = Number(item.g?.p) || 0;
        if (Array.isArray(stops) && colorStopCount > 0) {
          const colorSpan = Math.min(stops.length, colorStopCount * 4);
          for (let i = 0; i + 3 < colorSpan; i += 4) {
            const hex = rgbToHex([stops[i + 1], stops[i + 2], stops[i + 3]]);
            if (hex) out.add(hex);
          }
        }
        break;
      }
    }
  }
}

/** Text string + fill colour from a text layer (`t.d.k[0].s`). */
function textDocument(layer) {
  const doc = layer?.t?.d?.k?.[0]?.s;
  if (!doc) return { text: null, color: null };
  return {
    text: typeof doc.t === 'string' ? doc.t : null,
    color: normalizeColor(doc.fc),
  };
}

/** Best-effort layer size. Lottie layers store no bounding box, so this is
 *  per-type and may be null (e.g. shape layers, whose size is geometric).
 *  Precomp layers (`ty:0`) never reach here — they're traversed into their
 *  referenced layers by `walkComposition`, not pushed as a leaf. */
function layerSize(layer, assetsById) {
  switch (layer.ty) {
    case 1: // solid
      return { w: layer.sw, h: layer.sh };
    case 2: { // image → asset dimensions
      const asset = assetsById.get(layer.refId);
      return asset && asset.w ? { w: asset.w, h: asset.h } : null;
    }
    default:
      return null;
  }
}

/** Resolve a layer's position by walking its `parent` chain and summing raw
 *  `ks.p` offsets (position-only composition — anchor point, scale and
 *  rotation inheritance are out of scope for v0; a full affine composition is
 *  a larger, separate change). `parent` is an `ind` reference scoped to the
 *  same layer list (`levelMap`), never across composition levels. Bounded by
 *  `MAX_PARENT_CHAIN` and a visited-`ind` guard so a cyclic `parent` chain
 *  can't loop forever. */
function resolvePosition(layer, levelMap) {
  const raw = staticValue(layer.ks?.p, [0, 0]);
  let x = Array.isArray(raw) ? Number(raw[0]) || 0 : 0;
  let y = Array.isArray(raw) ? Number(raw[1]) || 0 : 0;
  let current = layer;
  const visited = new Set();
  for (let depth = 0; current?.parent != null && depth < MAX_PARENT_CHAIN; depth++) {
    if (visited.has(current.parent)) break; // cyclic parent chain — stop, don't loop forever
    visited.add(current.parent);
    const parentLayer = levelMap.get(current.parent);
    if (!parentLayer) break; // dangling parent ref
    const parentPos = staticValue(parentLayer.ks?.p, [0, 0]);
    x += Array.isArray(parentPos) ? Number(parentPos[0]) || 0 : 0;
    y += Array.isArray(parentPos) ? Number(parentPos[1]) || 0 : 0;
    current = parentLayer;
  }
  return { x, y };
}

/**
 * Recursively walk a composition's `layers[]`, collecting the flat colour
 * palette and visual-layer list (ANI-199 P1). Precomp layers (`ty:0`) are
 * traversed into their referenced asset's own `layers[]` rather than treated
 * as an opaque leaf sized only by the precomp's viewport — otherwise a Lottie
 * whose root is a single precomp imports blank. Each precomp's children
 * inherit the precomp layer's own resolved position as a translation offset
 * (see `resolvePosition`); nested-precomp cycles and runaway depth are
 * guarded against so a hostile/malformed asset graph fails closed.
 *
 * @param {object[]} layerList - This composition level's raw Lottie layers.
 * @param {Map} assetsById - All top-level `assets[]`, keyed by `id`.
 * @param {{depth:number, offsetX:number, offsetY:number, visitedRefIds:Set, counters:{layers:number, shapes:number}}} ctx
 * @param {Set<string>} palette - Accumulator, mutated in place.
 * @param {object[]} out - Flat visual-layer accumulator, mutated in place.
 */
function walkComposition(layerList, assetsById, ctx, palette, out) {
  if (!Array.isArray(layerList)) return;
  const levelMap = new Map(
    layerList.filter(l => l && typeof l === 'object' && l.ind != null).map(l => [l.ind, l]),
  );

  for (const layer of layerList) {
    if (!layer || typeof layer !== 'object') continue;
    if (layer.hd === true) continue; // hidden

    ctx.counters.layers++;
    if (ctx.counters.layers > MAX_TOTAL_LAYERS_VISITED) {
      throw new Error(`Lottie exceeds the layer safety limit (${MAX_TOTAL_LAYERS_VISITED} layers visited) — refusing to parse further.`);
    }

    // Colour inventory is collected from every layer (visual or not).
    const colors = new Set();
    if (layer.ty === 4) collectShapeColors(layer.shapes, colors, ctx.counters);
    if (layer.ty === 1) { const hex = normalizeColor(layer.sc); if (hex) colors.add(hex); }
    const { text, color: textColor } = layer.ty === 5 ? textDocument(layer) : { text: null, color: null };
    if (textColor) colors.add(textColor);
    for (const c of colors) palette.add(c);

    if (layer.ty === 0) { // precomp → traverse into its referenced layers
      const asset = assetsById.get(layer.refId);
      if (!asset || !Array.isArray(asset.layers)) continue; // dangling refId — nothing to traverse
      if (ctx.visitedRefIds.has(layer.refId)) {
        throw new Error(`Cyclic precomp reference at refId "${layer.refId}" — refusing to parse.`);
      }
      if (ctx.depth + 1 > MAX_PRECOMP_DEPTH) {
        throw new Error(`Precomp nesting exceeds the max depth (${MAX_PRECOMP_DEPTH}) — refusing to parse.`);
      }
      const offset = resolvePosition(layer, levelMap);
      walkComposition(asset.layers, assetsById, {
        depth: ctx.depth + 1,
        offsetX: ctx.offsetX + offset.x,
        offsetY: ctx.offsetY + offset.y,
        visitedRefIds: new Set(ctx.visitedRefIds).add(layer.refId),
        counters: ctx.counters,
      }, palette, out);
      continue;
    }

    if (NON_VISUAL.has(layer.ty)) continue; // controllers / audio / camera aren't components

    const pos = resolvePosition(layer, levelMap);
    out.push({
      name: typeof layer.nm === 'string' ? layer.nm : null,
      ty: layer.ty,
      typeLabel: LAYER_TYPES[layer.ty] || `unknown(${layer.ty})`,
      index: layer.ind ?? null,
      parent: layer.parent ?? null,
      position: { x: pos.x + ctx.offsetX, y: pos.y + ctx.offsetY },
      size: layerSize(layer, assetsById),
      opacity: staticValue(layer.ks?.o, 100),
      text,
      colors: [...colors],
    });
  }
}

const ZIP_CONTAINER_MESSAGE =
  'Input looks like a .lottie ZIP container, not raw JSON. ' +
  '.lottie support is out of scope for this tool (v0) — unzip and pass the animation .json.';

/**
 * Parse a raw Lottie animation into a normalised structure.
 *
 * @param {string|object|Uint8Array} input - Lottie `.json` content: a string,
 *   an already-parsed object, or raw UTF-8 bytes (e.g. `Buffer` on Node — a
 *   `Buffer` *is* a `Uint8Array`, so it's handled by the same branch without
 *   ever naming the Node-only `Buffer` global, which doesn't exist on the
 *   Deno edge runtime this tool is bundled for, `edgeReady: true`).
 * @returns {{ name, fps, width, height, durationFrames, durationS, layers, palette }}
 */
export function parseLottie(input) {
  let anim = input;

  if (input instanceof Uint8Array) {
    // ZIP containers open with the local-file-header magic bytes 'PK' (0x50,
    // 0x4B) — check the raw bytes before decoding, since decoding arbitrary
    // binary as UTF-8 is lossy but the ASCII magic survives it either way.
    if (input.length >= 2 && input[0] === 0x50 && input[1] === 0x4b) {
      throw new Error(ZIP_CONTAINER_MESSAGE);
    }
    anim = new TextDecoder('utf-8').decode(input);
  }

  if (typeof anim === 'string') {
    const trimmed = anim.trimStart();
    if (trimmed.startsWith('PK')) {
      throw new Error(ZIP_CONTAINER_MESSAGE);
    }
    try {
      anim = JSON.parse(anim);
    } catch (err) {
      throw new Error(`Invalid Lottie JSON: ${err.message}`);
    }
  }

  if (!anim || typeof anim !== 'object' || !Array.isArray(anim.layers)) {
    throw new Error('Not a Lottie animation: missing top-level `layers` array.');
  }

  const fps = Number(anim.fr) || 60;
  const ip = Number(anim.ip) || 0;
  const op = Number(anim.op) || 0;
  const durationFrames = Math.max(0, op - ip);
  const assetsById = new Map((anim.assets || []).filter(a => a && a.id).map(a => [a.id, a]));

  const palette = new Set();
  const layers = [];

  walkComposition(
    anim.layers,
    assetsById,
    { depth: 0, offsetX: 0, offsetY: 0, visitedRefIds: new Set(), counters: { layers: 0, shapes: 0 } },
    palette,
    layers,
  );

  return {
    name: typeof anim.nm === 'string' ? anim.nm : null,
    fps,
    width: Number(anim.w) || 1920,
    height: Number(anim.h) || 1080,
    durationFrames,
    durationS: durationFrames > 0 ? durationFrames / fps : 0,
    layers,
    palette: [...palette],
  };
}
