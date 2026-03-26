/**
 * Project Confidence Upgrade
 *
 * Safe metadata repair tool. Reads annotation audit results, generates
 * targeted patches for low-confidence fields, and optionally applies them.
 * Never changes authored content — only adds semantic metadata.
 *
 * Allowed: product_role, primary_subject, outcome, interaction_truth,
 *          layer product_role, layer clarity_weight, continuity_id,
 *          transition_in.match
 *
 * Not allowed: copy, timing, scene order, visual content, new scenes.
 */

import { annotateScenes, auditAnnotationQuality } from './scene-annotations.js';

// ── Patch ops ───────────────────────────────────────────────────────────────

const VALID_PATCH_OPS = ['set_scene_field', 'set_layer_field', 'add_continuity_link'];

const SAFE_SCENE_FIELDS = ['product_role', 'primary_subject', 'outcome', 'interaction_truth'];
const SAFE_LAYER_FIELDS = ['product_role', 'clarity_weight', 'content_class', 'continuity_id'];

// ── Scene ID heuristics ─────────────────────────────────────────────────────

const ROLE_HINTS = [
  { pattern: /prompt|input|search|query|ask/i, role: 'input', confidence: 0.85, source: 'inferred_from_scene_id' },
  { pattern: /chart|graph|metric|drilldown|analytics|visualization/i, role: 'result', confidence: 0.85, source: 'inferred_from_scene_id' },
  { pattern: /insight|card|evidence|proof|testimonial/i, role: 'proof', confidence: 0.80, source: 'inferred_from_scene_id' },
  { pattern: /dashboard|overview|panel/i, role: 'dashboard', confidence: 0.85, source: 'inferred_from_scene_id' },
  { pattern: /logo|brand|lockup|mark/i, role: 'cta', confidence: 0.85, source: 'inferred_from_scene_id' },
  { pattern: /tagline|open|close|intro|outro|title/i, role: 'atmosphere', confidence: 0.80, source: 'inferred_from_scene_id' },
  { pattern: /followup|follow_up|response|reply/i, role: 'result', confidence: 0.70, source: 'inferred_from_scene_id' },
  { pattern: /upload|process|loading/i, role: 'processing', confidence: 0.75, source: 'inferred_from_scene_id' },
];

const INTERACTION_PATTERNS = {
  has_typing: [
    { pattern: /input|prompt|placeholder|contenteditable|textarea/i, source: 'inferred_from_layer_content' },
    { pattern: /typewriter|cd-typewriter/i, source: 'inferred_from_animation' },
  ],
  has_state_change: [
    { pattern: /toggle|switch|expand|collapse|open|close|select|dropdown/i, source: 'inferred_from_layer_content' },
  ],
  has_cursor: [
    { pattern: /cursor/i, source: 'inferred_from_layer_id' },
  ],
};

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Generate and optionally apply safe metadata patches to improve annotation confidence.
 *
 * @param {object} params
 * @param {object[]} params.scenes - Scene definitions (will be annotated if not already)
 * @param {object} [params.audit] - Pre-computed annotation audit (will run if not provided)
 * @param {string} [params.mode='suggest'] - 'suggest' | 'apply' | 'apply_safe_only'
 * @param {string[]} [params.targets] - Specific scene IDs to target (null = all low-confidence)
 * @param {number} [params.max_patches=20] - Max patches to generate
 * @param {object} [params.rules] - Confidence thresholds
 * @returns {{ patches, patched_scenes, before_score, after_score, unlocked_scenes, remaining_gaps }}
 */
export function upgradeProjectConfidence({
  scenes,
  audit: preAudit,
  mode = 'suggest',
  targets,
  max_patches = 20,
  rules = {},
} = {}) {
  const {
    only_safe_metadata = true,
    min_confidence_to_apply_continuity = 0.8,
    min_confidence_to_apply_structural_unlock = 0.75,
  } = rules;

  if (!scenes || scenes.length === 0) {
    return { patches: [], patched_scenes: [], before_score: 0, after_score: 0, unlocked_scenes: [], remaining_gaps: [] };
  }

  // Ensure scenes are annotated
  const annotated = scenes[0]._annotation_confidence ? scenes : annotateScenes(scenes);
  const auditBefore = preAudit || auditAnnotationQuality(annotated);
  const beforeScore = auditBefore.quality;

  // Filter to target scenes
  const targetSet = targets ? new Set(targets) : null;
  const scenesToPatch = annotated.filter(s => {
    if (targetSet && !targetSet.has(s.scene_id)) return false;
    const conf = s._annotation_confidence;
    return !conf || conf.overall < min_confidence_to_apply_structural_unlock;
  });

  // Generate patches
  const patches = [];

  for (const scene of scenesToPatch) {
    if (patches.length >= max_patches) break;

    const sceneId = scene.scene_id || '';
    const conf = scene._annotation_confidence || {};

    // 1. Product role upgrade
    if (conf.product_role < min_confidence_to_apply_structural_unlock) {
      const hint = suggestProductRole(scene);
      if (hint && hint.confidence > (conf.product_role || 0)) {
        patches.push({
          op: 'set_scene_field',
          scene_id: sceneId,
          path: 'product_role',
          value: hint.role,
          reason: `Scene ID "${sceneId}" matches ${hint.role} pattern`,
          confidence: hint.confidence,
          source: hint.source,
        });
      }
    }

    // 2. Primary subject
    if (conf.primary_subject < min_confidence_to_apply_structural_unlock) {
      const hero = suggestHeroLayer(scene);
      if (hero) {
        patches.push({
          op: 'set_scene_field',
          scene_id: sceneId,
          path: 'primary_subject',
          value: hero.layerId,
          reason: hero.reason,
          confidence: hero.confidence,
          source: hero.source,
        });
        // Also mark the layer as hero
        patches.push({
          op: 'set_layer_field',
          scene_id: sceneId,
          layer_id: hero.layerId,
          path: 'product_role',
          value: 'hero',
          reason: `Promoted to hero: ${hero.reason}`,
          confidence: hero.confidence,
          source: hero.source,
        });
      }
    }

    // 3. Interaction truth
    if (conf.interaction_truth < 0.7) {
      const truth = suggestInteractionTruth(scene);
      if (truth.patches.length > 0) {
        patches.push({
          op: 'set_scene_field',
          scene_id: sceneId,
          path: 'interaction_truth',
          value: truth.value,
          reason: truth.reason,
          confidence: truth.confidence,
          source: truth.source,
        });
      }
    }

    // 4. Outcome
    if (!scene.outcome || conf.outcome < 0.5) {
      const role = scene.product_role || 'result';
      const clean = sceneId.replace(/^sc_\d+_/, '').replace(/_/g, ' ');
      patches.push({
        op: 'set_scene_field',
        scene_id: sceneId,
        path: 'outcome',
        value: generateOutcome(role, clean),
        reason: `Generated from product_role "${role}" and scene name`,
        confidence: 0.7,
        source: 'inferred_from_product_role',
      });
    }
  }

  // 5. Continuity links between high-confidence adjacent scenes
  if (!only_safe_metadata || min_confidence_to_apply_continuity <= 1) {
    const continuityPatches = suggestContinuityPatches(annotated, min_confidence_to_apply_continuity);
    for (const cp of continuityPatches) {
      if (patches.length >= max_patches) break;
      patches.push(cp);
    }
  }

  // Apply patches if mode allows
  let patchedScenes;
  if (mode === 'apply' || mode === 'apply_safe_only') {
    patchedScenes = applyPatches(annotated, patches, mode === 'apply_safe_only');
  } else {
    patchedScenes = annotated;
  }

  // Re-annotate and re-audit
  const reAnnotated = (mode === 'suggest') ? annotated : annotateScenes(patchedScenes);
  const auditAfter = auditAnnotationQuality(reAnnotated);

  // Determine which scenes are now unlocked
  const unlocked = [];
  const remaining = [];
  for (const s of reAnnotated) {
    const conf = s._annotation_confidence;
    if (!conf) { remaining.push({ scene_id: s.scene_id, issue: 'not annotated' }); continue; }
    if (conf.overall >= min_confidence_to_apply_structural_unlock) {
      // Check if it was below before
      const orig = annotated.find(o => o.scene_id === s.scene_id);
      if (orig?._annotation_confidence?.overall < min_confidence_to_apply_structural_unlock) {
        unlocked.push(s.scene_id);
      }
    } else {
      remaining.push({ scene_id: s.scene_id, issue: `confidence ${conf.overall.toFixed(2)} below threshold` });
    }
  }

  return {
    patches,
    patched_scenes: [...new Set(patches.map(p => p.scene_id))],
    before_score: beforeScore,
    after_score: auditAfter.quality,
    unlocked_scenes: unlocked,
    remaining_gaps: remaining,
    scenes: (mode !== 'suggest') ? reAnnotated : undefined,
  };
}

// ── Heuristic suggestion functions ──────────────────────────────────────────

function suggestProductRole(scene) {
  const sceneId = scene.scene_id || '';
  for (const hint of ROLE_HINTS) {
    if (hint.pattern.test(sceneId)) {
      return { role: hint.role, confidence: hint.confidence, source: hint.source };
    }
  }

  // Content-based: scan foreground layers
  const layers = (scene.layers || []).filter(l => l.depth_class !== 'background');
  for (const layer of layers) {
    const content = typeof layer.content === 'string' ? layer.content : '';
    if (/input|prompt|placeholder/i.test(content)) return { role: 'input', confidence: 0.7, source: 'inferred_from_layer_content' };
    if (/chart|graph|bar.*chart/i.test(content)) return { role: 'result', confidence: 0.7, source: 'inferred_from_layer_content' };
  }

  return null;
}

function suggestHeroLayer(scene) {
  const layers = scene.layers || [];
  const fgLayers = layers.filter(l => l.depth_class !== 'background');
  if (fgLayers.length === 0) return null;

  // Prefer motion-targeted layer
  const groups = scene.motion?.groups || [];
  const motionTargets = new Set();
  for (const g of groups) for (const t of (g.targets || [])) motionTargets.add(t);

  const motionHero = fgLayers.find(l => motionTargets.has(l.id));
  if (motionHero) {
    return {
      layerId: motionHero.id,
      confidence: 0.85,
      reason: `Layer "${motionHero.id}" is targeted by motion groups`,
      source: 'inferred_from_motion_targeting',
    };
  }

  // Single foreground layer — high confidence
  if (fgLayers.length === 1) {
    return {
      layerId: fgLayers[0].id,
      confidence: 0.8,
      reason: `Only foreground layer in scene`,
      source: 'inferred_from_layer_structure',
    };
  }

  // Multiple — pick the one with most complex content
  const scored = fgLayers.map(l => {
    const content = typeof l.content === 'string' ? l.content : '';
    return { layer: l, score: content.length };
  }).sort((a, b) => b.score - a.score);

  return {
    layerId: scored[0].layer.id,
    confidence: 0.6,
    reason: `Most content-rich foreground layer`,
    source: 'inferred_from_content_complexity',
  };
}

function suggestInteractionTruth(scene) {
  const layers = scene.layers || [];
  const groups = scene.motion?.groups || [];
  const result = { has_cursor: false, has_typing: false, has_state_change: false, timing_realistic: false };
  const reasons = [];
  let bestSource = 'inferred_from_layer_content';

  for (const layer of layers) {
    const content = typeof layer.content === 'string' ? layer.content : '';
    const id = (layer.id || '').toLowerCase();

    for (const [field, patterns] of Object.entries(INTERACTION_PATTERNS)) {
      for (const p of patterns) {
        const testStr = field === 'has_cursor' ? id : (layer.animation || content);
        if (p.pattern.test(testStr)) {
          result[field] = true;
          reasons.push(`${field}: matched "${p.pattern.source}" in ${p.source.replace('inferred_from_', '')}`);
          bestSource = p.source;
        }
      }
    }
  }

  // Timing: >= 3s + delays/stagger
  const hasDelays = groups.some(g => g.stagger || g.delay_ms || g.delay);
  result.timing_realistic = (scene.duration_s || 0) >= 3 && (hasDelays || groups.length >= 2);
  if (result.timing_realistic) reasons.push('timing_realistic: duration >= 3s with stagger/delays');

  const trueCount = Object.values(result).filter(Boolean).length;
  const confidence = trueCount >= 3 ? 0.85 : trueCount >= 2 ? 0.75 : trueCount >= 1 ? 0.65 : 0.4;

  return {
    value: result,
    confidence,
    reason: reasons.join('; ') || 'No interaction signals detected',
    source: bestSource,
    patches: reasons,
  };
}

function suggestContinuityPatches(scenes, minConfidence) {
  const patches = [];

  for (let i = 0; i < scenes.length - 1; i++) {
    const from = scenes[i];
    const to = scenes[i + 1];
    const fromConf = from._annotation_confidence?.overall || 0;
    const toConf = to._annotation_confidence?.overall || 0;

    // Both scenes need sufficient confidence
    if (fromConf < minConfidence || toConf < minConfidence) continue;

    // Already has continuity
    const fromHasLink = from.layers?.some(l => l.continuity_id);
    const toHasLink = to.layers?.some(l => l.continuity_id);
    if (fromHasLink && toHasLink) continue;

    // Find hero layers
    const fromHero = from.layers?.find(l => l.product_role === 'hero');
    const toHero = to.layers?.find(l => l.product_role === 'hero');
    if (!fromHero || !toHero) continue;

    const cid = `${fromHero.id}_to_${toHero.id}`;
    patches.push({
      op: 'add_continuity_link',
      from_scene: from.scene_id,
      to_scene: to.scene_id,
      from_layer_id: fromHero.id,
      to_layer_id: toHero.id,
      continuity_id: cid,
      strategy: 'position',
      reason: `Hero-to-hero continuity between "${fromHero.id}" and "${toHero.id}"`,
      confidence: Math.min(fromConf, toConf),
      source: 'matched_from_hero_layers',
    });
  }

  return patches;
}

function generateOutcome(role, sceneName) {
  const map = {
    input: `User initiates: ${sceneName}`,
    processing: `System processes: ${sceneName}`,
    result: `System presents: ${sceneName}`,
    proof: `Evidence validates: ${sceneName}`,
    dashboard: `Data overview: ${sceneName}`,
    cta: `Brand resolves: ${sceneName}`,
    atmosphere: `Tone establishes: ${sceneName}`,
    transition: `Visual transition: ${sceneName}`,
  };
  return map[role] || `Scene: ${sceneName}`;
}

// ── Patch application ───────────────────────────────────────────────────────

function applyPatches(scenes, patches, safeOnly) {
  // Deep clone
  const result = JSON.parse(JSON.stringify(scenes));
  const sceneMap = new Map();
  for (const s of result) sceneMap.set(s.scene_id, s);

  for (const patch of patches) {
    // In safe-only mode, skip continuity links (they modify structure)
    if (safeOnly && patch.op === 'add_continuity_link') continue;

    if (patch.op === 'set_scene_field') {
      const scene = sceneMap.get(patch.scene_id);
      if (scene && SAFE_SCENE_FIELDS.includes(patch.path)) {
        scene[patch.path] = patch.value;
      }
    } else if (patch.op === 'set_layer_field') {
      const scene = sceneMap.get(patch.scene_id);
      const layer = scene?.layers?.find(l => l.id === patch.layer_id);
      if (layer && SAFE_LAYER_FIELDS.includes(patch.path)) {
        layer[patch.path] = patch.value;
      }
    } else if (patch.op === 'add_continuity_link') {
      const fromScene = sceneMap.get(patch.from_scene);
      const toScene = sceneMap.get(patch.to_scene);
      const fromLayer = fromScene?.layers?.find(l => l.id === patch.from_layer_id);
      const toLayer = toScene?.layers?.find(l => l.id === patch.to_layer_id);
      if (fromLayer) fromLayer.continuity_id = patch.continuity_id;
      if (toLayer) toLayer.continuity_id = patch.continuity_id;
    }
  }

  return result;
}

export { VALID_PATCH_OPS, SAFE_SCENE_FIELDS, SAFE_LAYER_FIELDS };
