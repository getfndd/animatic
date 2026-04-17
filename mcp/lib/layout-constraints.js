/**
 * Constraint-Based Layout Resolver (ANI-74).
 *
 * Compile-time layout resolution: components declare anchors, gaps, and sizing →
 * resolver computes pixel positions → positions applied to generated layers.
 * Not a runtime constraint solver — positions are fixed at compile, motion operates relative.
 */

// ── Named Anchors (normalized 0–1) ──────────────────────────────────────────

const NAMED_ANCHORS = {
  'center':        { x: 0.5,  y: 0.5 },
  'top-left':      { x: 0.15, y: 0.15 },
  'top-center':    { x: 0.5,  y: 0.15 },
  'top-right':     { x: 0.85, y: 0.15 },
  'center-left':   { x: 0.15, y: 0.5 },
  'center-right':  { x: 0.85, y: 0.5 },
  'bottom-left':   { x: 0.15, y: 0.85 },
  'bottom-center': { x: 0.5,  y: 0.85 },
  'bottom-right':  { x: 0.85, y: 0.85 },
};

// ── Default Sizes by Component Type (fraction of canvas) ─────────────────────

const COMPONENT_SIZE_DEFAULTS = {
  prompt_card:    { w: 0.5,  h: 0.15 },
  input_field:    { w: 0.45, h: 0.08 },
  dropdown_menu:  { w: 0.25, h: 0.2 },
  result_stack:   { w: 0.5,  h: 0.35 },
  stacked_cards:  { w: 0.35, h: 0.3 },
  icon_label_row: { w: 0.4,  h: 0.05 },
  upload_zone:    { w: 0.4,  h: 0.35 },
  chip_row:       { w: 0.5,  h: 0.06 },
};

const DEFAULT_SIZE = { w: 0.3, h: 0.2 };
const DEFAULT_GAP = 20; // px

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve named anchor string to normalized {x, y} coordinates.
 * @param {string} anchor - Anchor name (e.g. 'center', 'top-left')
 * @returns {{ x: number, y: number }} Normalized coordinates (0–1)
 */
export function resolveNamedAnchor(anchor) {
  return NAMED_ANCHORS[anchor] || NAMED_ANCHORS['center'];
}

/**
 * Compute pixel size for a component based on type defaults and constraints.
 * @param {object} component - Component definition
 * @param {number} canvasW - Canvas width in px
 * @param {number} canvasH - Canvas height in px
 * @returns {{ w: number, h: number }} Size in pixels
 */
export function computeComponentSize(component, canvasW, canvasH) {
  const defaults = COMPONENT_SIZE_DEFAULTS[component.type] || DEFAULT_SIZE;
  let w = Math.round(defaults.w * canvasW);
  let h = Math.round(defaults.h * canvasH);

  // Apply max constraints
  if (component.max_width != null) w = Math.min(w, component.max_width);
  if (component.max_height != null) h = Math.min(h, component.max_height);

  return { w, h };
}

/**
 * Enforce minimum gap between positioned rects.
 * Pushes overlapping rects apart along the axis of least overlap.
 *
 * @param {Map<string, {x,y,w,h}>} positions - Mutable position map
 * @param {object[]} components - Component definitions (for gap overrides)
 * @param {number} [minGap] - Minimum gap in px
 * @returns {Map<string, {x,y,w,h}>} Same map, mutated
 */
export function enforceGaps(positions, components, minGap = DEFAULT_GAP) {
  const ids = [...positions.keys()];
  // Simple O(n²) pairwise — fine for typical component counts (<20)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = positions.get(ids[i]);
      const b = positions.get(ids[j]);

      const overlapX = (a.x + a.w + minGap) - b.x;
      const overlapY = (a.y + a.h + minGap) - b.y;
      const overlapXR = (b.x + b.w + minGap) - a.x;
      const overlapYR = (b.y + b.h + minGap) - a.y;

      // Check if rects actually overlap (including gap)
      const xOverlap = a.x < b.x + b.w + minGap && b.x < a.x + a.w + minGap;
      const yOverlap = a.y < b.y + b.h + minGap && b.y < a.y + a.h + minGap;

      if (xOverlap && yOverlap) {
        // Find minimum push distance on each axis
        const pushX = Math.min(overlapX, overlapXR);
        const pushY = Math.min(overlapY, overlapYR);

        if (pushX <= pushY) {
          // Push apart on X axis
          const half = Math.ceil(pushX / 2);
          if (a.x <= b.x) {
            a.x -= half;
            b.x += half;
          } else {
            b.x -= half;
            a.x += half;
          }
        } else {
          // Push apart on Y axis
          const half = Math.ceil(pushY / 2);
          if (a.y <= b.y) {
            a.y -= half;
            b.y += half;
          } else {
            b.y -= half;
            a.y += half;
          }
        }
      }
    }
  }
  return positions;
}

/**
 * Resolve layout positions for all components in a scene.
 *
 * @param {object[]} components - Component definitions from semantic.components[]
 * @param {number} [canvasW=1920] - Canvas width
 * @param {number} [canvasH=1080] - Canvas height
 * @returns {Map<string, {x: number, y: number, w: number, h: number}>} Position map
 */
export function resolveComponentLayout(components, canvasW = 1920, canvasH = 1080) {
  const positions = new Map();

  for (const cmp of components) {
    // Step 1: Resolve anchor → center point (normalized)
    const anchorName = cmp.anchor || cmp.position?.anchor || 'center';
    const anchor = resolveNamedAnchor(anchorName);

    // Step 2: Compute size
    const size = computeComponentSize(cmp, canvasW, canvasH);

    // Step 3: Convert center + size → pixel rect
    const cx = Math.round(anchor.x * canvasW);
    const cy = Math.round(anchor.y * canvasH);
    const x = cx - Math.round(size.w / 2);
    const y = cy - Math.round(size.h / 2);

    positions.set(cmp.id, { x, y, w: size.w, h: size.h });
  }

  // Step 4: Gap enforcement
  if (positions.size > 1) {
    enforceGaps(positions, components);
  }

  return positions;
}

// ── Exports for testing ──────────────────────────────────────────────────────

export { NAMED_ANCHORS, COMPONENT_SIZE_DEFAULTS };
