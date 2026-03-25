/**
 * Scene Semantic Annotations
 *
 * Auto-infers product-level semantics from existing scene data:
 * scene product_role, primary_subject, interaction_truth, outcome,
 * and per-layer product_role, content_class, clarity_weight.
 *
 * Explicit values on scenes/layers are preserved — inference only
 * fills gaps. Pure functions, no side effects.
 */

// ── Enums ───────────────────────────────────────────────────────────────────

export const SCENE_PRODUCT_ROLES = [
  'input', 'processing', 'result', 'proof',
  'dashboard', 'cta', 'atmosphere', 'transition',
];

export const LAYER_PRODUCT_ROLES = ['hero', 'supporting', 'functional', 'decorative'];

export const LAYER_CONTENT_CLASSES = [
  'ui_control', 'data_viz', 'branding', 'atmosphere', 'typography', 'interaction',
];

// ── Scene-level inference ───────────────────────────────────────────────────

// Tightened: only match when these appear as UI element indicators, not prose
const INPUT_PATTERNS = /\binput\b|prompt|search|query|<input|placeholder=/i;
const SCENE_ID_INPUT_PATTERNS = /prompt|input|search|query/i;
const CHART_PATTERNS = /chart|graph|metric|drilldown|visualization|analytics/i;
const DASHBOARD_PATTERNS = /dashboard|overview|panel|grid/i;
const LOGO_PATTERNS = /logo|brand|lockup|mark/i;

/**
 * Infer the scene's product role from metadata and content.
 * Returns { value, confidence } when called with returnConfidence=true.
 */
export function inferSceneProductRole(scene, metadata, returnConfidence = false) {
  const result = _inferSceneProductRole(scene, metadata);
  return returnConfidence ? result : result.value;
}

function _inferSceneProductRole(scene, metadata) {
  const tags = metadata?.intent_tags || scene.metadata?.intent_tags || [];
  const contentType = metadata?.content_type || scene.metadata?.content_type || '';
  const sceneId = scene.scene_id || '';
  const layers = scene.layers || [];

  // Atmosphere: opening/closing + typography/brand or scene_id keyword — high confidence
  const isTaglineOrAtmosphere = /tagline|open|close|intro|outro|title/i.test(sceneId);
  if ((tags.includes('opening') || tags.includes('closing')) &&
      (contentType === 'typography' || contentType === 'brand_mark' || isTaglineOrAtmosphere)) {
    return { value: 'atmosphere', confidence: contentType ? 0.9 : 0.75 };
  }

  // Transition — explicit tag, high confidence
  if (tags.includes('transition')) return { value: 'transition', confidence: 0.9 };

  // Dashboard — scene_id keyword, good confidence
  if (DASHBOARD_PATTERNS.test(sceneId)) {
    return { value: 'dashboard', confidence: 0.8 };
  }

  // Result — content_type is strong signal, scene_id keyword is moderate
  if (contentType === 'data_visualization') return { value: 'result', confidence: 0.9 };
  if (CHART_PATTERNS.test(sceneId)) return { value: 'result', confidence: 0.75 };

  // CTA — logo/brand patterns
  if (LOGO_PATTERNS.test(sceneId)) return { value: 'cta', confidence: 0.8 };
  if (contentType === 'brand_mark') return { value: 'cta', confidence: 0.85 };

  // Input — scene_id keyword is strong, content scan is moderate
  if (SCENE_ID_INPUT_PATTERNS.test(sceneId)) return { value: 'input', confidence: 0.8 };
  const hasInputContent = layers.some(l => {
    if (l.depth_class === 'background') return false;
    const content = typeof l.content === 'string' ? l.content : (l.content?.text || '');
    return INPUT_PATTERNS.test(content);
  });
  if (hasInputContent) return { value: 'input', confidence: 0.6 };

  // Proof — content_type match
  if (contentType === 'product_shot' || contentType === 'device_mockup') {
    return { value: 'proof', confidence: 0.8 };
  }

  // Intent-tag fallbacks — lower confidence
  if (tags.includes('hero') || tags.includes('detail')) {
    return { value: 'result', confidence: 0.5 };
  }
  if (contentType === 'typography') return { value: 'atmosphere', confidence: 0.5 };

  // Default fallback — low confidence
  return { value: 'result', confidence: 0.3 };
}

/**
 * Identify the primary subject layer in a scene.
 * Returns layer ID, or { value, confidence } when returnConfidence=true.
 */
export function inferPrimarySubject(scene, returnConfidence = false) {
  const result = _inferPrimarySubject(scene);
  return returnConfidence ? result : result.value;
}

function _inferPrimarySubject(scene) {
  const layers = scene.layers || [];
  if (layers.length === 0) return { value: null, confidence: 0 };

  const fgLayers = layers.filter(l => l.depth_class !== 'background');
  if (fgLayers.length === 0) return { value: layers[0]?.id || null, confidence: 0.2 };

  // Prefer layer targeted by motion groups — strong signal
  const motionTargets = new Set();
  const groups = scene.motion?.groups || [];
  for (const g of groups) {
    for (const t of (g.targets || [])) motionTargets.add(t);
  }

  const motionHero = fgLayers.find(l => motionTargets.has(l.id));
  if (motionHero) return { value: motionHero.id, confidence: 0.85 };

  // First foreground — moderate confidence (could be wrong with multiple fg layers)
  return { value: fgLayers[0].id, confidence: fgLayers.length === 1 ? 0.7 : 0.5 };
}

/**
 * Infer interaction truthfulness signals from scene data.
 * Returns { value, confidence } when returnConfidence=true.
 */
export function inferInteractionTruth(scene, returnConfidence = false) {
  const result = _inferInteractionTruth(scene);
  return returnConfidence ? result : result.value;
}

function _inferInteractionTruth(scene) {
  const layers = scene.layers || [];
  const groups = scene.motion?.groups || [];
  const interactions = scene.interactions || scene.interaction_sequence || [];
  const durationS = scene.duration_s || 0;

  let hasCursor = false;
  let hasTyping = false;
  let hasStateChange = false;

  // Scan layers
  for (const layer of layers) {
    const id = (layer.id || '').toLowerCase();
    const type = layer.type || '';
    const content = typeof layer.content === 'string' ? layer.content : '';

    if (type === 'cursor' || id.includes('cursor')) hasCursor = true;
    if (layer.animation === 'typewriter' || layer.primitive === 'cd-typewriter') hasTyping = true;
    if (/\binput\b|prompt|placeholder=/i.test(content) && groups.length > 0) hasTyping = true;
  }

  // V3 interactions
  for (const inter of interactions) {
    const kind = inter.kind || '';
    if (kind.includes('cursor') || kind === 'click') hasCursor = true;
    if (kind === 'type_text') hasTyping = true;
    if (['replace_text', 'select_item', 'insert_items', 'open_menu'].includes(kind)) hasStateChange = true;
  }

  // Multiple motion groups suggest state changes
  if (groups.length >= 2) hasStateChange = true;

  // Timing realism: needs duration ≥ 3s AND some form of delay/stagger
  const hasDelays = groups.some(g => g.stagger || g.delay_ms || g.delay);
  const timingRealistic = durationS >= 3 && (hasDelays || interactions.length > 0);

  const truth = { has_cursor: hasCursor, has_typing: hasTyping, has_state_change: hasStateChange, timing_realistic: timingRealistic };

  // Confidence: v3 interactions are high, layer heuristics are moderate, pure inference is low
  const hasV3 = interactions.length > 0;
  const trueCount = [hasCursor, hasTyping, hasStateChange, timingRealistic].filter(Boolean).length;
  let confidence = 0.3; // baseline
  if (hasV3) confidence = 0.9;
  else if (trueCount >= 2) confidence = 0.7;
  else if (trueCount === 1) confidence = 0.5;

  return { value: truth, confidence };
}

/**
 * Generate a brief outcome description.
 */
export function inferSceneOutcome(scene, productRole) {
  const sceneId = scene.scene_id || '';
  const clean = sceneId.replace(/^sc_\d+_/, '').replace(/_/g, ' ');

  const outcomeMap = {
    input: `User initiates interaction: ${clean}`,
    processing: `System processes request: ${clean}`,
    result: `System presents result: ${clean}`,
    proof: `Evidence validates product: ${clean}`,
    dashboard: `Overview reveals data context: ${clean}`,
    cta: `Brand identity resolves: ${clean}`,
    atmosphere: `Visual tone established: ${clean}`,
    transition: `Scene transitions: ${clean}`,
  };

  return outcomeMap[productRole] || `Scene: ${clean}`;
}

// ── Layer-level inference ────────────────────────────────────────────────────

/**
 * Infer a layer's product role.
 * @param {object} layer
 * @param {boolean} isFirstForeground - whether this is the first foreground layer
 */
export function inferLayerProductRole(layer, isFirstForeground) {
  if (layer.depth_class === 'background') return 'decorative';

  if (isFirstForeground) return 'hero';

  // Text labels/captions are functional
  if (layer.type === 'text' && (layer.block_role === 'label' || layer.block_role === 'caption')) {
    return 'functional';
  }

  return 'supporting';
}

/**
 * Infer a layer's content class.
 */
export function inferLayerContentClass(layer, scene) {
  const type = layer.type || '';
  const id = (layer.id || '').toLowerCase();
  const content = typeof layer.content === 'string' ? layer.content : '';
  const sceneId = (scene?.scene_id || '').toLowerCase();

  if (type === 'text' || type === 'typography') return 'typography';
  if (type === 'cursor' || id.includes('cursor')) return 'interaction';

  if (type === 'html') {
    if (layer.depth_class === 'background') return 'atmosphere';
    if (/chart|graph|bar|metric|line-chart|pie/i.test(content) || /chart|graph/i.test(id)) return 'data_viz';
    if (INPUT_PATTERNS.test(content) || /input|button|select|form/i.test(content)) return 'ui_control';
    return 'ui_control'; // HTML foreground defaults to UI
  }

  if ((type === 'image' || type === 'video') && LOGO_PATTERNS.test(sceneId)) return 'branding';
  if (type === 'image' || type === 'video') return 'ui_control';

  // Compound types
  if (['card_conveyor', 'stack_fan_settle', 'chart_build_explain', 'result_grid',
       'moodboard', 'stacked_thumbs', 'media_strip'].includes(type)) {
    return 'data_viz';
  }

  if (type === 'spotlight_cursor_reveal') return 'interaction';

  return 'ui_control';
}

/**
 * Infer a layer's clarity weight from its product role.
 */
export function inferLayerClarityWeight(layerProductRole) {
  switch (layerProductRole) {
    case 'hero': return 5;
    case 'supporting': return 3;
    case 'functional': return 2;
    case 'decorative': return 1;
    default: return 2;
  }
}

// ── Main annotation functions ───────────────────────────────────────────────

/**
 * Annotate a single scene with inferred semantic fields.
 * Explicit values are preserved — inference only fills gaps.
 *
 * @param {object} scene - Scene object
 * @param {object} [metadata] - Pre-computed analysis metadata { content_type, intent_tags, motion_energy }
 * @returns {object} Annotated scene (shallow copy, layers deep-copied)
 */
export function annotateScene(scene, metadata) {
  if (!scene || typeof scene !== 'object') return scene;

  const meta = metadata || scene.metadata || {};
  const result = { ...scene };
  const confidence = {};

  // Scene-level annotations (preserve explicit → confidence 1.0)
  if (result.product_role == null) {
    const inferred = inferSceneProductRole(scene, meta, true);
    result.product_role = inferred.value;
    confidence.product_role = inferred.confidence;
  } else {
    confidence.product_role = 1.0;
  }

  if (result.primary_subject == null) {
    const inferred = inferPrimarySubject(scene, true);
    result.primary_subject = inferred.value;
    confidence.primary_subject = inferred.confidence;
  } else {
    confidence.primary_subject = 1.0;
  }

  if (result.interaction_truth == null) {
    const inferred = inferInteractionTruth(scene, true);
    result.interaction_truth = inferred.value;
    confidence.interaction_truth = inferred.confidence;
  } else {
    confidence.interaction_truth = 1.0;
  }

  if (result.outcome == null) {
    result.outcome = inferSceneOutcome(scene, result.product_role);
    confidence.outcome = confidence.product_role * 0.8; // outcome depends on product_role
  } else {
    confidence.outcome = 1.0;
  }

  // Has a hero layer?
  const hasHeroLayer = (scene.layers || []).some(l => l.product_role === 'hero');
  confidence.has_hero = hasHeroLayer ? 1.0 : confidence.primary_subject;

  // Overall annotation confidence — compositional (weakest link matters)
  confidence.overall = Math.round(
    Math.min(confidence.product_role, confidence.primary_subject, confidence.has_hero) * 1000
  ) / 1000;

  result._annotation_confidence = confidence;

  // Layer-level annotations
  const layers = scene.layers || [];
  let foundFirstFg = false;

  result.layers = layers.map(layer => {
    const annotated = { ...layer };
    const isFg = layer.depth_class !== 'background';
    const isFirstFg = isFg && !foundFirstFg;
    if (isFirstFg) foundFirstFg = true;

    if (annotated.product_role == null) {
      annotated.product_role = inferLayerProductRole(layer, isFirstFg);
    }
    if (annotated.content_class == null) {
      annotated.content_class = inferLayerContentClass(layer, scene);
    }
    if (annotated.clarity_weight == null) {
      annotated.clarity_weight = inferLayerClarityWeight(annotated.product_role);
    }

    return annotated;
  });

  return result;
}

/**
 * Bulk-annotate an array of scenes.
 */
export function annotateScenes(scenes) {
  if (!Array.isArray(scenes)) return [];
  return scenes.map(s => annotateScene(s));
}

// ── Annotation Quality Audit ────────────────────────────────────────────────

/**
 * Audit annotation quality across a set of scenes.
 *
 * @param {object[]} scenes - Annotated scenes (with _annotation_confidence)
 * @param {object} [options]
 * @param {string} [options.mode='advisory'] - 'advisory' (warnings) or 'strict' (errors)
 * @param {number} [options.confidence_threshold=0.6] - Min confidence to consider reliable
 * @returns {{ quality: number, pass: boolean, issues: object[], summary: string }}
 */
export function auditAnnotationQuality(scenes, options = {}) {
  const { mode = 'advisory', confidence_threshold = 0.6 } = options;
  const issues = [];

  if (!scenes || scenes.length === 0) {
    return { quality: 0, pass: false, issues: [{ severity: 'error', message: 'No scenes to audit' }], summary: 'No scenes' };
  }

  let totalConfidence = 0;
  let scenesWithHero = 0;
  let scenesWithOutcome = 0;
  let lowConfidenceScenes = 0;

  for (const scene of scenes) {
    const conf = scene._annotation_confidence;
    const sceneId = scene.scene_id || '(unnamed)';

    if (!conf) {
      issues.push({ severity: 'warning', scene: sceneId, field: 'annotations', message: `${sceneId}: not annotated — run annotateScene first` });
      lowConfidenceScenes++;
      continue;
    }

    totalConfidence += conf.overall;

    // No hero layer
    if (!scene.layers?.some(l => l.product_role === 'hero')) {
      issues.push({ severity: mode === 'strict' ? 'error' : 'warning', scene: sceneId, field: 'hero', message: `${sceneId}: no hero layer (product_role='hero')` });
    } else {
      scenesWithHero++;
    }

    // Missing outcome
    if (!scene.outcome) {
      issues.push({ severity: 'info', scene: sceneId, field: 'outcome', message: `${sceneId}: no outcome description` });
    } else {
      scenesWithOutcome++;
    }

    // Low-confidence product_role
    if (conf.product_role < confidence_threshold) {
      issues.push({
        severity: mode === 'strict' ? 'error' : 'warning',
        scene: sceneId,
        field: 'product_role',
        confidence: conf.product_role,
        message: `${sceneId}: product_role "${scene.product_role}" inferred with low confidence (${conf.product_role.toFixed(2)})`,
      });
      lowConfidenceScenes++;
    }

    // Low-confidence primary_subject
    if (conf.primary_subject < confidence_threshold) {
      issues.push({
        severity: mode === 'strict' ? 'error' : 'warning',
        scene: sceneId,
        field: 'primary_subject',
        confidence: conf.primary_subject,
        message: `${sceneId}: primary_subject "${scene.primary_subject}" inferred with low confidence (${conf.primary_subject.toFixed(2)})`,
      });
    }

    // Low overall
    if (conf.overall < confidence_threshold) {
      issues.push({
        severity: 'warning',
        scene: sceneId,
        field: 'overall',
        confidence: conf.overall,
        message: `${sceneId}: overall annotation confidence ${conf.overall.toFixed(2)} — consider adding explicit annotations`,
      });
    }
  }

  // Quality score: 0-1 based on mean confidence + coverage
  const meanConfidence = totalConfidence / scenes.length;
  const heroCoverage = scenesWithHero / scenes.length;
  const outcomeCoverage = scenesWithOutcome / scenes.length;
  const quality = Math.round((meanConfidence * 0.5 + heroCoverage * 0.3 + outcomeCoverage * 0.2) * 1000) / 1000;

  // Pass/fail
  const errors = issues.filter(i => i.severity === 'error');
  const pass = mode === 'strict' ? errors.length === 0 : quality >= 0.4;

  const summary = `Annotation quality: ${quality.toFixed(2)} | ` +
    `${scenesWithHero}/${scenes.length} scenes with hero | ` +
    `${lowConfidenceScenes} low-confidence | ` +
    `${errors.length} errors, ${issues.filter(i => i.severity === 'warning').length} warnings`;

  return { quality, pass, issues, summary };
}
