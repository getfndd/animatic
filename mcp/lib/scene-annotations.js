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
 */
export function inferSceneProductRole(scene, metadata) {
  const tags = metadata?.intent_tags || scene.metadata?.intent_tags || [];
  const contentType = metadata?.content_type || scene.metadata?.content_type || '';
  const sceneId = scene.scene_id || '';
  const layers = scene.layers || [];

  // Atmosphere: opening/closing scenes — check scene_id patterns too
  const isTaglineOrAtmosphere = /tagline|open|close|intro|outro|title/i.test(sceneId);
  if ((tags.includes('opening') || tags.includes('closing')) &&
      (contentType === 'typography' || contentType === 'brand_mark' || isTaglineOrAtmosphere)) {
    return 'atmosphere';
  }

  // Transition
  if (tags.includes('transition')) return 'transition';

  // Dashboard: scene_id keyword match (content_type may not be set)
  if (DASHBOARD_PATTERNS.test(sceneId)) {
    return 'dashboard';
  }

  // Result: data visualization or chart keywords
  if (contentType === 'data_visualization' || CHART_PATTERNS.test(sceneId)) {
    return 'result';
  }

  // CTA: logo/brand scenes (check before input — logo scenes may contain generic text)
  if (LOGO_PATTERNS.test(sceneId) || contentType === 'brand_mark') {
    return 'cta';
  }

  // Input: scene_id or foreground HTML with actual input/prompt UI patterns
  if (SCENE_ID_INPUT_PATTERNS.test(sceneId)) return 'input';
  const hasInputContent = layers.some(l => {
    if (l.depth_class === 'background') return false;
    const content = typeof l.content === 'string' ? l.content : (l.content?.text || '');
    return INPUT_PATTERNS.test(content);
  });
  if (hasInputContent) return 'input';

  // Proof: product shots, device mockups
  if (contentType === 'product_shot' || contentType === 'device_mockup') {
    return 'proof';
  }

  // Hero detail scenes default to result
  if (tags.includes('hero') || tags.includes('detail')) {
    return 'result';
  }

  // Atmosphere for typography-heavy scenes without product content
  if (contentType === 'typography') return 'atmosphere';

  return 'result';
}

/**
 * Identify the primary subject layer in a scene.
 * Returns the layer ID of the hero element.
 */
export function inferPrimarySubject(scene) {
  const layers = scene.layers || [];
  if (layers.length === 0) return null;

  const fgLayers = layers.filter(l => l.depth_class !== 'background');
  if (fgLayers.length === 0) return layers[0]?.id || null;

  // Prefer layer targeted by motion groups
  const motionTargets = new Set();
  const groups = scene.motion?.groups || [];
  for (const g of groups) {
    for (const t of (g.targets || [])) motionTargets.add(t);
  }

  const motionHero = fgLayers.find(l => motionTargets.has(l.id));
  if (motionHero) return motionHero.id;

  // First foreground layer
  return fgLayers[0].id;
}

/**
 * Infer interaction truthfulness signals from scene data.
 */
export function inferInteractionTruth(scene) {
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

  return { has_cursor: hasCursor, has_typing: hasTyping, has_state_change: hasStateChange, timing_realistic: timingRealistic };
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

  // Scene-level annotations (preserve explicit)
  if (result.product_role == null) {
    result.product_role = inferSceneProductRole(scene, meta);
  }
  if (result.primary_subject == null) {
    result.primary_subject = inferPrimarySubject(scene);
  }
  if (result.interaction_truth == null) {
    result.interaction_truth = inferInteractionTruth(scene);
  }
  if (result.outcome == null) {
    result.outcome = inferSceneOutcome(scene, result.product_role);
  }

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
