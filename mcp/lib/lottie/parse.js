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
 *  Groups (`gr`) nest children under `it[]`, so recurse. Gradient stops live in
 *  a flat `g.k.k` array `[offset,r,g,b, offset,r,g,b, ...]`. */
function collectShapeColors(shapes, out) {
  if (!Array.isArray(shapes)) return;
  for (const item of shapes) {
    if (!item || typeof item !== 'object') continue;
    switch (item.ty) {
      case 'gr': // group → recurse
        collectShapeColors(item.it, out);
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
        if (Array.isArray(stops)) {
          for (let i = 0; i + 3 < stops.length; i += 4) {
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
 *  per-type and may be null (e.g. shape layers, whose size is geometric). */
function layerSize(layer, assetsById) {
  switch (layer.ty) {
    case 1: // solid
      return { w: layer.sw, h: layer.sh };
    case 2: { // image → asset dimensions
      const asset = assetsById.get(layer.refId);
      return asset && asset.w ? { w: asset.w, h: asset.h } : null;
    }
    case 0: // precomp → viewport on the layer
      return layer.w ? { w: layer.w, h: layer.h } : null;
    default:
      return null;
  }
}

/**
 * Parse a raw Lottie animation into a normalised structure.
 *
 * @param {string|object} input - Lottie `.json` content (string or parsed object).
 * @returns {{ name, fps, width, height, durationFrames, durationS, layers, palette }}
 */
export function parseLottie(input) {
  let anim = input;
  if (typeof input === 'string') {
    const trimmed = input.trimStart();
    if (trimmed.startsWith('PK')) {
      throw new Error(
        'Input looks like a .lottie ZIP container, not raw JSON. ' +
        '.lottie support is out of scope for this tool (v0) — unzip and pass the animation .json.',
      );
    }
    try {
      anim = JSON.parse(input);
    } catch (err) {
      throw new Error(`Invalid Lottie JSON: ${err.message}`);
    }
  }
  if (Buffer.isBuffer?.(input) || input instanceof Uint8Array) {
    throw new Error('Binary input (likely .lottie) is not supported — pass raw Lottie JSON.');
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

  for (const layer of anim.layers) {
    if (!layer || typeof layer !== 'object') continue;
    if (layer.hd === true) continue; // hidden

    // Colour inventory is collected from every layer (visual or not).
    const colors = new Set();
    if (layer.ty === 4) collectShapeColors(layer.shapes, colors);
    if (layer.ty === 1) { const hex = normalizeColor(layer.sc); if (hex) colors.add(hex); }
    const { text, color: textColor } = layer.ty === 5 ? textDocument(layer) : { text: null, color: null };
    if (textColor) colors.add(textColor);
    for (const c of colors) palette.add(c);

    if (NON_VISUAL.has(layer.ty)) continue; // controllers / audio / camera aren't components

    const pos = staticValue(layer.ks?.p, [0, 0]);
    layers.push({
      name: typeof layer.nm === 'string' ? layer.nm : null,
      ty: layer.ty,
      typeLabel: LAYER_TYPES[layer.ty] || `unknown(${layer.ty})`,
      index: layer.ind ?? null,
      parent: layer.parent ?? null,
      position: { x: Array.isArray(pos) ? Number(pos[0]) || 0 : 0, y: Array.isArray(pos) ? Number(pos[1]) || 0 : 0 },
      size: layerSize(layer, assetsById),
      opacity: staticValue(layer.ks?.o, 100),
      text,
      colors: [...colors],
    });
  }

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
