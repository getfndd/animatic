/**
 * Shot Grammar Engine — ANI-26
 *
 * Classifies scenes along three cinematic axes (shot size, angle, framing),
 * validates against personality restrictions, and resolves to CSS values.
 *
 * Pure classification functions — deterministic, testable, no LLM calls.
 * Fed by catalog/shot-grammar.json via the data loader.
 */

import { loadShotGrammar } from '../data/loader.js';

// ── Load catalog data at module level ────────────────────────────────────────

const grammar = loadShotGrammar();

// ── Exported enums (for test assertions) ─────────────────────────────────────

export const SHOT_SIZES = grammar.shot_sizes.map(s => s.slug);
export const ANGLES = grammar.angles.map(a => a.slug);
export const FRAMINGS = grammar.framings.map(f => f.slug);

// ── Shot size classifier ─────────────────────────────────────────────────────

/**
 * Classify the shot size of a scene.
 *
 * Priority:
 * 1. Layout template mapping
 * 2. Content type affinity (from catalog)
 * 3. Foreground layer count fallback
 *
 * @param {object} scene — Scene object with layers, layout, metadata
 * @returns {{ value: string, confidence: number }}
 */
export function classifyShotSize(scene) {
  const layout = scene.layout;
  const layers = scene.layers || [];
  const contentType = scene.metadata?.content_type;

  // Priority 1: Layout template
  if (layout?.template) {
    switch (layout.template) {
      case 'masonry-grid':
      case 'split-panel':
        return { value: 'wide', confidence: 0.90 };
      case 'device-mockup':
        return { value: 'medium', confidence: 0.90 };
      case 'hero-center': {
        // Single text fg layer → close_up; otherwise medium
        const fgLayers = layers.filter(l => l.depth_class !== 'background');
        if (fgLayers.length === 1 && fgLayers[0].type === 'text') {
          return { value: 'close_up', confidence: 0.85 };
        }
        return { value: 'medium', confidence: 0.80 };
      }
      case 'full-bleed':
        return { value: 'medium', confidence: 0.80 };
    }
  }

  // Priority 2: Content type affinity
  if (contentType && grammar.affinityMap.has(contentType)) {
    return { value: grammar.affinityMap.get(contentType), confidence: 0.75 };
  }

  // Priority 3: Foreground layer count fallback
  const fgLayers = layers.filter(l => l.depth_class !== 'background');
  if (fgLayers.length >= 4) return { value: 'wide', confidence: 0.55 };
  if (fgLayers.length === 1) return { value: 'close_up', confidence: 0.55 };
  return { value: 'medium', confidence: 0.50 };
}

// ── Angle classifier ─────────────────────────────────────────────────────────

/**
 * Classify the camera angle of a scene.
 *
 * Priority:
 * 1. Intent tags (hero/opening → low, informational/detail → high)
 * 2. Content type (portrait → eye_level, data_visualization → high)
 * 3. Default → eye_level
 *
 * @param {object} scene — Scene object with metadata
 * @returns {{ value: string, confidence: number }}
 */
export function classifyAngle(scene) {
  const intentTags = scene.metadata?.intent_tags || [];
  const contentType = scene.metadata?.content_type;

  // Priority 1: Intent tags
  if (intentTags.includes('hero') || intentTags.includes('opening')) {
    return { value: 'low', confidence: 0.75 };
  }
  if (intentTags.includes('informational') || intentTags.includes('detail')) {
    return { value: 'high', confidence: 0.70 };
  }

  // Priority 2: Content type
  if (contentType === 'portrait') {
    return { value: 'eye_level', confidence: 0.85 };
  }
  if (contentType === 'data_visualization') {
    return { value: 'high', confidence: 0.75 };
  }

  // Priority 3: Default
  return { value: 'eye_level', confidence: 0.60 };
}

// ── Framing classifier ───────────────────────────────────────────────────────

/**
 * Classify the framing of a scene.
 *
 * Priority:
 * 1. Layout template (split-panel → rule_of_thirds_left, device-mockup → based on side)
 * 2. Intent (hero/opening → center)
 * 3. Default → center
 *
 * @param {object} scene — Scene object with layout, metadata
 * @returns {{ value: string, confidence: number }}
 */
export function classifyFraming(scene) {
  const layout = scene.layout;
  const intentTags = scene.metadata?.intent_tags || [];

  // Priority 1: Layout template
  if (layout?.template === 'split-panel') {
    return { value: 'rule_of_thirds_left', confidence: 0.85 };
  }
  if (layout?.template === 'device-mockup') {
    const side = layout.config?.deviceSide ?? 'right';
    if (side === 'left') {
      return { value: 'rule_of_thirds_left', confidence: 0.85 };
    }
    return { value: 'rule_of_thirds_right', confidence: 0.85 };
  }

  // Priority 2: Intent tags
  if (intentTags.includes('hero') || intentTags.includes('opening')) {
    return { value: 'center', confidence: 0.80 };
  }

  // Priority 3: Default
  return { value: 'center', confidence: 0.60 };
}

// ── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate shot grammar against a personality's restrictions.
 * Returns corrected values where needed — safe fallbacks:
 *   size → medium, angle → eye_level, framing → center
 *
 * @param {{ shot_size: string, angle: string, framing: string }} shotGrammar
 * @param {string} personalitySlug
 * @returns {{ valid: boolean, corrections: string[], result: object }}
 */
export function validateShotGrammar(shotGrammar, personalitySlug) {
  const restrictions = grammar.personality_restrictions[personalitySlug];
  if (!restrictions) {
    return { valid: true, corrections: [], result: { ...shotGrammar } };
  }

  const corrections = [];
  const result = { ...shotGrammar };

  if (!restrictions.allowed_sizes.includes(shotGrammar.shot_size)) {
    corrections.push(`shot_size "${shotGrammar.shot_size}" not allowed for ${personalitySlug}, corrected to "medium"`);
    result.shot_size = 'medium';
  }

  if (!restrictions.allowed_angles.includes(shotGrammar.angle)) {
    corrections.push(`angle "${shotGrammar.angle}" not allowed for ${personalitySlug}, corrected to "eye_level"`);
    result.angle = 'eye_level';
  }

  if (!restrictions.allowed_framings.includes(shotGrammar.framing)) {
    corrections.push(`framing "${shotGrammar.framing}" not allowed for ${personalitySlug}, corrected to "center"`);
    result.framing = 'center';
  }

  return {
    valid: corrections.length === 0,
    corrections,
    result,
  };
}

// ── CSS resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve shot grammar axes to concrete CSS values, respecting personality
 * constraints (max_scale, use_3d_rotation).
 *
 * @param {{ shot_size: string, angle: string, framing: string }} shotGrammar
 * @param {string} personalitySlug
 * @returns {{ scale: number, perspectiveOrigin: string, rotateX: number, rotateZ: number, transformOrigin: string }}
 */
export function resolveShotGrammarCSS(shotGrammar, personalitySlug) {
  const restrictions = grammar.personality_restrictions[personalitySlug] || {};
  const sizeEntry = grammar.sizeBySlug.get(shotGrammar.shot_size);
  const angleEntry = grammar.angleBySlug.get(shotGrammar.angle);
  const framingEntry = grammar.framingBySlug.get(shotGrammar.framing);

  let scale = sizeEntry?.css?.scale ?? 1.0;
  let perspectiveOrigin = angleEntry?.css?.perspectiveOrigin ?? '50% 50%';
  let rotateX = angleEntry?.css?.rotateX ?? 0;
  let rotateZ = angleEntry?.css?.rotateZ ?? 0;
  const transformOrigin = framingEntry?.css?.transformOrigin ?? '50% 50%';

  // Enforce max_scale
  if (restrictions.max_scale != null) {
    scale = Math.min(scale, restrictions.max_scale);
  }

  // Suppress 3D rotation
  if (restrictions.use_3d_rotation === false) {
    rotateX = 0;
    rotateZ = 0;
    perspectiveOrigin = '50% 50%';
  }

  return { scale, perspectiveOrigin, rotateX, rotateZ, transformOrigin };
}

// ── Convenience: classify all three axes ─────────────────────────────────────

/**
 * Classify all three shot grammar axes for a scene.
 *
 * @param {object} scene — Scene with layers, layout, metadata
 * @returns {{ grammar: { shot_size: string, angle: string, framing: string }, confidence: { shot_size: number, angle: number, framing: number } }}
 */
export function classifyShotGrammar(scene) {
  const size = classifyShotSize(scene);
  const angle = classifyAngle(scene);
  const framing = classifyFraming(scene);

  return {
    grammar: {
      shot_size: size.value,
      angle: angle.value,
      framing: framing.value,
    },
    confidence: {
      shot_size: size.confidence,
      angle: angle.confidence,
      framing: framing.confidence,
    },
  };
}
