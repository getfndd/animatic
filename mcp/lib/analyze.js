/**
 * Scene Analysis Engine — ANI-22
 *
 * Pure classification functions that analyze a scene JSON and produce
 * structured metadata: content_type, visual_weight, motion_energy, intent_tags.
 *
 * Rule-based foundation — deterministic, testable, no LLM calls.
 * Used by the analyze_scene MCP tool and consumed by ANI-23 (sequence planner).
 */

// ── Enum constants ──────────────────────────────────────────────────────────

export const CONTENT_TYPES = [
  'portrait', 'ui_screenshot', 'typography', 'brand_mark',
  'data_visualization', 'moodboard', 'product_shot', 'notification',
  'device_mockup', 'split_panel', 'collage',
];

export const VISUAL_WEIGHTS = ['light', 'dark', 'mixed'];

export const MOTION_ENERGIES = ['static', 'subtle', 'moderate', 'high'];

export const INTENT_TAGS = [
  'opening', 'hero', 'detail', 'closing',
  'transition', 'emotional', 'informational',
];

// ── Color utilities ─────────────────────────────────────────────────────────

/**
 * Convert a hex color to WCAG 2.0 relative luminance.
 * Accepts: #rgb, #rrggbb, rgb, rrggbb (with or without #).
 * Returns a number between 0 (black) and 1 (white), or null if unparseable.
 */
export function hexToLuminance(hex) {
  if (!hex || typeof hex !== 'string') return null;

  let clean = hex.replace(/^#/, '');

  // Expand shorthand (#rgb → rrggbb)
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }

  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) return null;

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  // WCAG 2.0 sRGB linearization
  const linearize = (c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Extract hex colors from inline HTML style attributes.
 * Targets: color, background-color, background (including gradient stops).
 * Returns an array of hex strings (lowercase, 6-digit).
 */
export function extractColorsFromHTML(html) {
  if (!html || typeof html !== 'string') return [];

  const colors = [];
  // Match hex colors: #rgb or #rrggbb
  const hexPattern = /#([0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)\b/g;
  let match;
  while ((match = hexPattern.exec(html)) !== null) {
    let val = match[1].toLowerCase();
    if (val.length === 3) {
      val = val[0] + val[0] + val[1] + val[1] + val[2] + val[2];
    }
    colors.push('#' + val);
  }

  return colors;
}

// ── Visual weight classifier ────────────────────────────────────────────────

/**
 * Classify the visual weight (light/dark/mixed) of a scene.
 * Collects colors from text layer styles and html layer inline styles.
 *
 * Text layer style.color is inverted — white text implies dark scene, and
 * dark text implies light scene (text color is inverse-correlated with
 * visual weight).
 */
export function classifyVisualWeight(scene) {
  const colors = [];
  const layers = scene.layers || [];

  for (const layer of layers) {
    // Text layer style.color — invert luminance (white text → dark scene)
    if (layer.style?.color) {
      const lum = hexToLuminance(layer.style.color);
      if (lum !== null) colors.push(1 - lum);
    }

    // HTML layer inline styles — background colors are direct weight signals
    if (layer.type === 'html' && layer.content) {
      const htmlColors = extractColorsFromHTML(layer.content);
      for (const hc of htmlColors) {
        const lum = hexToLuminance(hc);
        if (lum !== null) colors.push(lum);
      }
    }
  }

  if (colors.length === 0) {
    return { value: 'mixed', confidence: 0.30 };
  }

  const darkCount = colors.filter(l => l < 0.25).length;
  const lightCount = colors.filter(l => l > 0.6).length;
  const total = colors.length;
  const darkRatio = darkCount / total;
  const lightRatio = lightCount / total;

  if (darkRatio > 0.7) {
    return { value: 'dark', confidence: 0.70 + darkRatio * 0.25 };
  }
  if (lightRatio > 0.7) {
    return { value: 'light', confidence: 0.70 + lightRatio * 0.25 };
  }
  return { value: 'mixed', confidence: 0.60 };
}

// ── Motion energy classifier ────────────────────────────────────────────────

/**
 * Classify the motion energy of a scene based on camera, text animations,
 * entrances, stagger, and video layers.
 */
export function classifyMotionEnergy(scene) {
  let score = 0;
  const layers = scene.layers || [];
  const camera = scene.camera || {};

  // Camera contribution
  if (camera.move && camera.move !== 'static') {
    const intensity = camera.intensity ?? 0.5;
    if (intensity < 0.2) score += 1;
    else if (intensity <= 0.5) score += 2;
    else score += 3;
  }

  // Text animation contribution
  for (const layer of layers) {
    if (layer.animation === 'word-reveal') score += 2;
    else if (layer.animation === 'scale-cascade') score += 6;
    else if (layer.animation === 'weight-morph') score += 2;
  }

  // Entrance contribution
  const entranceLayers = layers.filter(l => l.entrance?.primitive);
  if (entranceLayers.length >= 3) score += 3;
  else if (entranceLayers.length >= 1) score += 1;

  // Stagger contribution (unique delay_ms values)
  const delays = new Set(
    layers
      .filter(l => l.entrance?.delay_ms != null && l.entrance.delay_ms > 0)
      .map(l => l.entrance.delay_ms)
  );
  if (delays.size >= 3) score += 2;
  else if (delays.size >= 2) score += 1;

  // Video layer contribution
  const hasVideo = layers.some(l => l.type === 'video');
  if (hasVideo) score += 1;

  // Map score to energy level (calibrated against ground truth)
  let value;
  if (score === 0) value = 'static';
  else if (score <= 1) value = 'subtle';
  else if (score <= 5) value = 'moderate';
  else value = 'high';

  // Confidence based on signal strength
  const confidence = score === 0 ? 0.90 : Math.min(0.50 + score * 0.08, 0.95);

  return { value, confidence };
}

// ── Content type classifier ─────────────────────────────────────────────────

/**
 * Classify the content type using priority-ordered rules.
 * Layout template is the strongest signal, followed by layer composition.
 */
export function classifyContentType(scene) {
  const layers = scene.layers || [];
  const layout = scene.layout;
  const sceneId = scene.scene_id || '';

  // Priority 1-6: Layout template signals
  if (layout?.template === 'device-mockup') {
    return { value: 'device_mockup', confidence: 0.95 };
  }
  if (layout?.template === 'split-panel') {
    return { value: 'split_panel', confidence: 0.95 };
  }
  if (layout?.template === 'masonry-grid') {
    const cellCount = layers.filter(l => l.slot?.startsWith('cell-')).length;
    if (cellCount >= 4) return { value: 'collage', confidence: 0.90 };
    return { value: 'moodboard', confidence: 0.85 };
  }
  if (layout?.template === 'full-bleed') {
    return { value: 'product_shot', confidence: 0.85 };
  }
  if (layout?.template === 'hero-center') {
    return { value: 'brand_mark', confidence: 0.80 };
  }

  // Priority 7: All text layers (or text + single bg html/video)
  const fgLayers = layers.filter(l => l.depth_class !== 'background');
  const bgLayers = layers.filter(l => l.depth_class === 'background');
  const allFgText = fgLayers.length > 0 && fgLayers.every(l => l.type === 'text');
  const bgOnlyHtmlOrVideo = bgLayers.length <= 1 && bgLayers.every(l => l.type === 'html' || l.type === 'video');

  if (allFgText && bgOnlyHtmlOrVideo) {
    return { value: 'typography', confidence: 0.90 };
  }

  // Priority 8: Video asset + text/html fg layer, portrait-like scene_id
  const hasVideoBg = layers.some(l => l.type === 'video' && l.depth_class === 'background');
  const hasFgTextOrHtml = fgLayers.some(l => l.type === 'text' || l.type === 'html');
  if (hasVideoBg && hasFgTextOrHtml && /portrait|face|person|headshot/i.test(sceneId)) {
    return { value: 'portrait', confidence: 0.75 };
  }

  // Priority 9: Single fg html, brand/logo scene_id
  const fgHtmlLayers = fgLayers.filter(l => l.type === 'html');
  if (fgHtmlLayers.length === 1 && fgLayers.length === 1 && /brand|logo/i.test(sceneId)) {
    return { value: 'brand_mark', confidence: 0.80 };
  }

  // Priority 10: Single fg html, notification scene_id
  if (fgHtmlLayers.length === 1 && fgLayers.length === 1 && /notif/i.test(sceneId)) {
    return { value: 'notification', confidence: 0.80 };
  }

  // Priority 11: Image assets with ui/dashboard keywords
  const imageLayers = layers.filter(l => l.type === 'image');
  if (imageLayers.length > 0 && /ui|dashboard|screenshot|interface/i.test(sceneId)) {
    return { value: 'ui_screenshot', confidence: 0.70 };
  }

  // Priority 12: Multiple image layers, no text
  const textLayers = layers.filter(l => l.type === 'text');
  if (imageLayers.length >= 2 && textLayers.length === 0) {
    return { value: 'moodboard', confidence: 0.65 };
  }

  // Priority 13: Video bg + html/text fg
  if (hasVideoBg && hasFgTextOrHtml) {
    return { value: 'product_shot', confidence: 0.50 };
  }

  // Priority 14: Fallback
  return { value: 'ui_screenshot', confidence: 0.20 };
}

// ── Intent tag inference ────────────────────────────────────────────────────

/**
 * Infer intent tags from content type, scene structure, and motion.
 * Sequence-position tags (opening/closing) are partially handled here
 * for structural signals; full sequence-aware tagging is ANI-23's job.
 */
export function inferIntentTags(scene, contentType, motionEnergy) {
  const tags = [];
  const layers = scene.layers || [];
  const fgLayers = layers.filter(l => l.depth_class !== 'background');
  const duration = scene.duration_s ?? 3;

  switch (contentType) {
    case 'brand_mark':
      tags.push('hero');
      if (fgLayers.length <= 1) tags.push('opening');
      break;
    case 'typography': {
      const textLayers = fgLayers.filter(l => l.type === 'text');
      if (textLayers.length === 1) {
        if (motionEnergy === 'high') {
          tags.push('hero');
        } else if (textLayers[0].animation === 'word-reveal') {
          tags.push('opening');
        } else {
          tags.push('detail');
        }
      }
      break;
    }
    case 'ui_screenshot':
      tags.push('detail');
      break;
    case 'data_visualization':
      tags.push('detail', 'informational');
      break;
    case 'device_mockup':
      tags.push('detail');
      break;
    case 'portrait':
      tags.push('emotional');
      break;
    case 'collage':
    case 'moodboard':
    case 'split_panel':
      tags.push('informational');
      break;
    default:
      break;
  }

  // Video bg + text fg → emotional (if not already tagged)
  const hasVideoBg = layers.some(l => l.type === 'video' && l.depth_class === 'background');
  const hasFgText = fgLayers.some(l => l.type === 'text');
  if (hasVideoBg && hasFgText && !tags.includes('emotional')) {
    tags.push('emotional');
  }

  // Short duration with few layers → transition
  if (duration <= 1.5 && layers.length <= 2) {
    tags.push('transition');
  }

  // Confidence based on tag count and content type confidence
  const confidence = tags.length === 0 ? 0.30 : Math.min(0.55 + tags.length * 0.10, 0.90);

  return { value: tags, confidence };
}

// ── Top-level orchestrator ──────────────────────────────────────────────────

/**
 * Analyze a scene JSON and produce structured metadata with confidence scores.
 *
 * @param {object} scene — A scene object conforming to the scene-format spec.
 * @returns {{ metadata: object, _confidence: object }}
 */
export function analyzeScene(scene) {
  if (!scene || typeof scene !== 'object') {
    throw new Error('analyzeScene requires a scene object');
  }

  const contentType = classifyContentType(scene);
  const visualWeight = classifyVisualWeight(scene);
  const motionEnergy = classifyMotionEnergy(scene);
  const intentTags = inferIntentTags(scene, contentType.value, motionEnergy.value);

  return {
    metadata: {
      content_type: contentType.value,
      visual_weight: visualWeight.value,
      motion_energy: motionEnergy.value,
      intent_tags: intentTags.value,
    },
    _confidence: {
      content_type: contentType.confidence,
      visual_weight: visualWeight.confidence,
      motion_energy: motionEnergy.confidence,
      intent_tags: intentTags.confidence,
    },
  };
}
