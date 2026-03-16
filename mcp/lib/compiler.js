/**
 * Motion Compiler — Level 1 (Motion Intent) → Level 2 (Motion Timeline)
 *
 * 7-step pipeline:
 * 1. Resolve recipes — expand recipe references using target_map
 * 2. Build cue graph — topological sort of cue dependencies, assign frame numbers
 * 3. Expand primitives — catalog lookup per group, generate keyframes per element
 * 4. Apply stagger — intervals, amplitude curves, settle behavior per element
 * 5. Sync camera — shape camera easing so peak_at aligns with resolved cue frame
 * 6. Validate guardrails — check every property against personality boundaries
 * 7. Emit timeline — write per-layer keyframe tracks with absolute frames
 *
 * Pure functions. Catalog data passed in, no side effects.
 */

import { resolveEntrancePrimitive, CAMERA_CONSTANTS } from '../../src/remotion/lib.js';
import { resolveStateOverrides } from './state-machines.js';
import { resolveComponentLayout } from './layout-constraints.js';

// ── Constants ────────────────────────────────────────────────────────────────

const ANIMATABLE_DEFAULTS = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotate: 0,
  filter_blur: 0,
  filter_brightness: 1,
  filter_contrast: 1,
  filter_saturate: 1,
  clip_inset_top: 0,
  clip_inset_right: 0,
  clip_inset_bottom: 0,
  clip_inset_left: 0,
  // Clip-path shape properties
  clip_circle: 100,
  clip_circle_cx: 50,
  clip_circle_cy: 50,
  clip_ellipse: 100,
  clip_ellipse_ry: 100,
  clip_ellipse_cx: 50,
  clip_ellipse_cy: 50,
  // SVG-specific properties
  stroke_dashoffset: 0,
  stroke_dasharray: 0,
  fill_opacity: 1,
  stroke_opacity: 1,
  path_length: 0,
  // Text-specific properties
  text_chars: 0,
  text_replace_progress: 0,
  caret_opacity: 0,
  selection_start: 0,
  selection_end: 0,
  // List-specific properties
  list_insert_progress: 0,
  list_remove_progress: 0,
  list_reorder_progress: 0,
  // Counter properties
  counter_value: 0,
  // Surface effect properties
  surface_shadow: 0,
  surface_blur: 0,
  background_bloom: 0,
  // Compositing properties (ANI-75)
  shadow_offset_x: 0,
  shadow_offset_y: 0,
  shadow_blur_radius: 0,
  shadow_spread: 0,
  shadow_opacity: 0,
  inner_glow_spread: 0,
  inner_glow_opacity: 0,
  mask_gradient_start: 0,
  mask_gradient_end: 1,
  mask_gradient_angle: 180,
};

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Compile a v2/v3 scene's motion intent into a frame-addressed timeline.
 *
 * @param {object} scene - Scene with `motion` and/or `semantic` block (Level 1)
 * @param {object} catalogs - { recipes: { byId }, primitives: { bySlug } }
 * @param {object} [options] - { personality?: string }
 * @returns {{ scene_id: string, duration_frames: number, fps: number, tracks: { camera: object, layers: object } }}
 */
export function compileMotion(scene, catalogs = {}, options = {}) {
  const fps = scene.fps || 60;
  const durationS = scene.duration_s || 3;
  const durationFrames = Math.round(durationS * fps);

  // v3 semantic pre-processing — mutates scene in place
  if (scene.semantic) {
    compileSemantic(scene, options);
  }

  const motion = scene.motion;

  if (!motion) {
    return null; // v1 scene, no compilation needed
  }

  // Step 1: Resolve recipes
  const groups = resolveRecipes(motion, catalogs.recipes);

  // Step 2: Build cue graph
  const cues = buildCueGraph(groups, motion, durationFrames, fps);

  // Step 3 + 4: Expand primitives with stagger
  const layerTracks = expandGroups(groups, cues, durationFrames, fps, catalogs);

  // Step 4b: Compile per-group effects into layer tracks
  compileEffects(groups, layerTracks, cues, fps);

  // Step 5: Compile camera tracks (with personality-aware constants)
  const cameraConstants = resolveCameraConstantsForPersonality(options.personality);
  const cameraTracks = compileCamera(motion.camera, cues, durationFrames, fps, cameraConstants);

  // Step 6: Validate guardrails (placeholder — extends in Phase 3)
  // guardrails.validateMotionBlock(motion, options.personality);

  // Step 7: Emit timeline
  return {
    scene_id: scene.scene_id,
    duration_frames: durationFrames,
    fps,
    tracks: {
      camera: cameraTracks,
      layers: layerTracks,
    },
  };
}

// ── Step 1: Resolve Recipes ──────────────────────────────────────────────────

/**
 * If motion has a `recipe` field, expand it into groups using the catalog.
 * If motion already has `groups`, return them directly.
 */
function resolveRecipes(motion, recipeCatalog) {
  // Direct groups — pass through
  if (motion.groups && Array.isArray(motion.groups)) {
    // Also resolve per-group recipe references
    return motion.groups.map(group => {
      if (group.recipe && recipeCatalog?.byId) {
        const recipe = recipeCatalog.byId.get(group.recipe);
        if (recipe) {
          // Recipe provides defaults, group overrides
          return {
            primitive: recipe.groups?.[0]?.primitive,
            stagger: recipe.groups?.[0]?.stagger,
            ...group,
          };
        }
      }
      return group;
    });
  }

  // Top-level recipe reference
  if (motion.recipe && recipeCatalog?.byId) {
    const recipe = recipeCatalog.byId.get(motion.recipe);
    if (!recipe) {
      throw new Error(`Unknown recipe: ${motion.recipe}`);
    }

    const targetMap = motion.target_map || {};
    return recipe.groups.map(recipeGroup => ({
      id: recipeGroup.role,
      targets: targetMap[recipeGroup.role] || [],
      primitive: recipeGroup.primitive,
      stagger: recipeGroup.stagger || null,
      delay_after_hero_ms: recipeGroup.delay_after_hero_ms,
    }));
  }

  return [];
}

// ── Step 2: Build Cue Graph ──────────────────────────────────────────────────

/**
 * Build a cue resolution map: cue name → frame number.
 *
 * Sources:
 * - "scene_start" → frame 0
 * - "scene_end" → last frame
 * - { at: 0.5 } → proportional
 * - { at_ms: 2000 } → absolute ms
 * - on_complete on groups → computed from group timing
 */
function buildCueGraph(groups, motion, durationFrames, fps) {
  const cues = {
    scene_start: 0,
    scene_end: durationFrames,
  };

  // Proportional / absolute cues from camera sync
  if (motion.camera?.sync) {
    const sync = motion.camera.sync;
    if (sync.peak_at != null) {
      cues.__camera_peak = Math.round(sync.peak_at * durationFrames);
    }
  }

  // Estimate group completion frames for on_complete cues
  for (const group of groups) {
    if (!group.on_complete?.emit && !group.on_complete_cue) continue;

    const cueName = group.on_complete?.emit || group.on_complete_cue;
    const groupEndFrame = estimateGroupEndFrame(group, cues, durationFrames, fps);
    cues[cueName] = groupEndFrame;
  }

  // Resolve delay references (after: cueName)
  for (const group of groups) {
    if (group.delay?.after && cues[group.delay.after] != null) {
      const offsetMs = group.delay.offset_ms || 0;
      group._resolvedDelayFrame = cues[group.delay.after] + Math.round((offsetMs / 1000) * fps);
    }
  }

  return cues;
}

/**
 * Estimate when a group's last element finishes animating.
 */
function estimateGroupEndFrame(group, cues, durationFrames, fps) {
  const targets = group.targets || [];
  const primitive = resolveEntrancePrimitive(group.primitive);
  const durationMs = primitive.durationMs || 400;
  const durationF = Math.round((durationMs / 1000) * fps);

  // Start frame: delay or beginning
  let startFrame = 0;
  if (group.delay?.after && cues[group.delay.after] != null) {
    startFrame = cues[group.delay.after] + Math.round(((group.delay.offset_ms || 0) / 1000) * fps);
  } else if (group.delay_after_hero_ms) {
    startFrame = Math.round((group.delay_after_hero_ms / 1000) * fps);
  }

  // Stagger extends the end
  const staggerMs = group.stagger?.interval_ms || 0;
  const staggerTotal = Math.max(0, targets.length - 1) * staggerMs;
  const staggerFrames = Math.round((staggerTotal / 1000) * fps);

  return Math.min(durationFrames, startFrame + durationF + staggerFrames);
}

// ── Step 3 + 4: Expand Primitives + Stagger ──────────────────────────────────

/**
 * Expand all groups into per-layer keyframe tracks.
 */
function expandGroups(groups, cues, durationFrames, fps) {
  const layerTracks = {};

  for (const group of groups) {
    const targets = group.targets || [];
    if (targets.length === 0) continue;

    const primitive = resolveEntrancePrimitive(group.primitive);
    const stagger = group.stagger;

    // Resolve start frame
    let groupStartFrame = 0;
    if (group._resolvedDelayFrame != null) {
      groupStartFrame = group._resolvedDelayFrame;
    } else if (group.delay_after_hero_ms) {
      groupStartFrame = Math.round((group.delay_after_hero_ms / 1000) * fps);
    }

    // Sort targets by stagger order
    const ordered = applyStaggerOrder(targets, stagger?.order);

    for (let i = 0; i < ordered.length; i++) {
      const targetId = ordered[i];
      const staggerMs = stagger?.interval_ms || 0;
      const elementDelay = Math.round((i * staggerMs / 1000) * fps);
      const startFrame = groupStartFrame + elementDelay;

      // Apply amplitude curve
      const amplitude = computeAmplitude(i, ordered.length, stagger?.amplitude);

      // Generate keyframes from primitive
      const tracks = primitiveToTracks(primitive, startFrame, fps, amplitude);
      layerTracks[targetId] = mergeTracksInto(layerTracks[targetId], tracks);
    }
  }

  return layerTracks;
}

/**
 * Reorder targets based on stagger order.
 */
function applyStaggerOrder(targets, order) {
  if (!order || order === 'sequential') return [...targets];
  if (order === 'reverse') return [...targets].reverse();
  if (order === 'random') {
    const shuffled = [...targets];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  if (order === 'center_out') {
    const result = [];
    const mid = Math.floor(targets.length / 2);
    let left = mid - 1;
    let right = targets.length % 2 === 0 ? mid : mid + 1;
    result.push(targets[mid]);
    while (left >= 0 || right < targets.length) {
      if (left >= 0) result.push(targets[left--]);
      if (right < targets.length) result.push(targets[right++]);
    }
    return result;
  }
  return [...targets]; // 'distance' and unknown → sequential
}

/**
 * Compute amplitude multiplier for an element at index i.
 */
function computeAmplitude(index, total, amplitudeConfig) {
  if (!amplitudeConfig) return 1.0;

  const { curve, start = 1.0, end = 1.0 } = amplitudeConfig;
  if (total <= 1) return start;

  const t = index / (total - 1);

  switch (curve) {
    case 'uniform':
      return start;
    case 'descending':
      return start + (end - start) * t;
    case 'ascending':
      return start + (end - start) * t;
    case 'wave':
      return start + (end - start) * 0.5 * (1 - Math.cos(2 * Math.PI * t));
    default:
      return start;
  }
}

/**
 * Convert an entrance primitive definition to frame-addressed tracks.
 */
function primitiveToTracks(primitive, startFrame, fps, amplitude = 1.0) {
  const tracks = {};
  const durationMs = primitive.durationMs || 400;
  const durationFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const endFrame = startFrame + durationFrames;

  // Map easing to cubic-bezier string for Level 2 format
  const easing = primitiveEasingToCubicBezier(primitive.easing);

  if (!primitive.keyframes || primitive.keyframes.length === 0) {
    // Typewriter or other modes — just set opacity
    tracks.opacity = [
      { frame: startFrame, value: 0 },
      { frame: endFrame, value: 1, easing },
    ];
    return tracks;
  }

  // Expand each property from keyframes
  const properties = new Set();
  for (const kf of primitive.keyframes) {
    for (const key of Object.keys(kf)) {
      if (key !== 'at') properties.add(key);
    }
  }

  for (const prop of properties) {
    const propName = mapPrimitiveProperty(prop);
    tracks[propName] = primitive.keyframes.map(kf => ({
      frame: startFrame + Math.round(kf.at * durationFrames),
      value: scalePrimitiveValue(prop, kf[prop], amplitude),
      easing: kf.at > 0 ? easing : undefined,
    }));
  }

  return tracks;
}

/**
 * Map primitive keyframe property names to Level 2 track property names.
 */
function mapPrimitiveProperty(prop) {
  switch (prop) {
    case 'blur': return 'filter_blur';
    case 'brightness': return 'filter_brightness';
    default: return prop;
  }
}

/**
 * Scale a primitive value by amplitude. Only spatial values scale.
 */
function scalePrimitiveValue(prop, value, amplitude) {
  if (value == null) return ANIMATABLE_DEFAULTS[mapPrimitiveProperty(prop)] ?? 0;
  // Scale translateX/Y and blur by amplitude; opacity/scale stay as-is
  if (prop === 'translateY' || prop === 'translateX' || prop === 'blur') {
    return value * amplitude;
  }
  return value;
}

/**
 * Map primitive easing names to cubic-bezier strings.
 */
function primitiveEasingToCubicBezier(easing) {
  switch (easing) {
    case 'linear': return 'linear';
    case 'ease_out': return 'cubic-bezier(0.25,0.46,0.45,0.94)';
    case 'expo_out': return 'cubic-bezier(0.16,1,0.3,1)';
    case 'ease_in': return 'cubic-bezier(0.42,0,1,1)';
    case 'spring': return 'cubic-bezier(0.22,1,0.36,1)';
    default: return 'cubic-bezier(0.25,0.46,0.45,0.94)';
  }
}

/**
 * Merge new tracks into existing tracks for a layer.
 * Later groups can add additional properties or extend existing ones.
 */
function mergeTracksInto(existing, incoming) {
  if (!existing) return incoming;
  const merged = { ...existing };
  for (const [prop, track] of Object.entries(incoming)) {
    if (!merged[prop]) {
      merged[prop] = track;
    } else {
      // Append and sort by frame
      merged[prop] = [...merged[prop], ...track].sort((a, b) => a.frame - b.frame);
    }
  }
  return merged;
}

// ── Step 5: Compile Camera ───────────────────────────────────────────────────

/**
 * Compile camera motion intent into frame-addressed tracks.
 */
function compileCamera(cameraMotion, cues, durationFrames, fps, constants) {
  if (!cameraMotion) return {};
  const cc = constants || CAMERA_CONSTANTS;

  // Multi-move camera
  if (cameraMotion.moves && Array.isArray(cameraMotion.moves)) {
    return compileCameraMoves(cameraMotion.moves, cameraMotion.sync, cues, durationFrames, cc);
  }

  // Single move
  const move = cameraMotion.move || 'static';
  if (move === 'static') return {};

  const intensity = cameraMotion.intensity ?? cc.DEFAULT_INTENSITY;
  const peakFrame = resolveCameraPeak(cameraMotion.sync, cues, durationFrames);
  const easing = 'cubic-bezier(0.33,0,0.2,1)'; // cinematic_scurve default

  switch (move) {
    case 'push_in': {
      const endScale = 1 + intensity * cc.SCALE_FACTOR;
      return {
        scale: [
          { frame: 0, value: 1 },
          { frame: peakFrame, value: endScale, easing },
        ],
      };
    }
    case 'pull_out': {
      const startScale = 1 + intensity * cc.SCALE_FACTOR;
      return {
        scale: [
          { frame: 0, value: startScale },
          { frame: peakFrame, value: 1, easing },
        ],
      };
    }
    case 'pan_left': {
      const maxPx = intensity * cc.PAN_MAX_PX;
      return {
        translateX: [
          { frame: 0, value: 0 },
          { frame: peakFrame, value: -maxPx, easing },
        ],
      };
    }
    case 'pan_right': {
      const maxPx = intensity * cc.PAN_MAX_PX;
      return {
        translateX: [
          { frame: 0, value: 0 },
          { frame: peakFrame, value: maxPx, easing },
        ],
      };
    }
    case 'drift': {
      const amp = intensity * cc.DRIFT_AMPLITUDE;
      // Approximate sinusoidal with keyframes at quarter-periods
      const q = Math.round(durationFrames / 4);
      return {
        translateX: [
          { frame: 0, value: 0 },
          { frame: q, value: amp, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
          { frame: q * 2, value: 0, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
          { frame: q * 3, value: -amp, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
          { frame: durationFrames, value: 0, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
        translateY: [
          { frame: 0, value: 0 },
          { frame: q, value: amp * cc.DRIFT_Y_RATIO, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
          { frame: q * 2, value: 0, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
          { frame: q * 3, value: -amp * cc.DRIFT_Y_RATIO, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
          { frame: durationFrames, value: 0, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
      };
    }
    default:
      return {};
  }
}

/**
 * Compile multi-move camera into tracks.
 */
function compileCameraMoves(moves, _sync, _cues, durationFrames, cc) {
  const scaleTracks = [];
  const translateXTracks = [];

  for (const move of moves) {
    const fromFrame = Math.round((move.from ?? 0) * durationFrames);
    const toFrame = Math.round((move.to ?? 1) * durationFrames);
    const intensity = move.intensity ?? cc.DEFAULT_INTENSITY;
    const easing = 'cubic-bezier(0.33,0,0.2,1)';

    switch (move.move) {
      case 'push_in':
        scaleTracks.push({ frame: fromFrame, value: 1 });
        scaleTracks.push({ frame: toFrame, value: 1 + intensity * cc.SCALE_FACTOR, easing });
        break;
      case 'pull_out':
        scaleTracks.push({ frame: fromFrame, value: 1 + intensity * cc.SCALE_FACTOR });
        scaleTracks.push({ frame: toFrame, value: 1, easing });
        break;
      case 'pan_left':
        translateXTracks.push({ frame: fromFrame, value: 0 });
        translateXTracks.push({ frame: toFrame, value: -intensity * cc.PAN_MAX_PX, easing });
        break;
      case 'pan_right':
        translateXTracks.push({ frame: fromFrame, value: 0 });
        translateXTracks.push({ frame: toFrame, value: intensity * cc.PAN_MAX_PX, easing });
        break;
      case 'drift':
        // For multi-move drift, just hold gentle translate
        translateXTracks.push({ frame: fromFrame, value: 0 });
        translateXTracks.push({ frame: toFrame, value: intensity * cc.DRIFT_AMPLITUDE, easing });
        break;
      case 'static':
        // No contribution
        break;
    }
  }

  const tracks = {};
  if (scaleTracks.length > 0) tracks.scale = scaleTracks;
  if (translateXTracks.length > 0) tracks.translateX = translateXTracks;
  return tracks;
}

/**
 * Resolve camera peak frame from sync config.
 */
function resolveCameraPeak(sync, cues, durationFrames) {
  if (!sync) return durationFrames;

  // Cue reference
  if (sync.cue && cues[sync.cue] != null) {
    return cues[sync.cue];
  }

  // Proportional
  if (sync.peak_at != null) {
    return Math.round(sync.peak_at * durationFrames);
  }

  return durationFrames;
}

// ── Step 4b: Compile Effects ─────────────────────────────────────────────────

/**
 * Compile per-group effects arrays into layer tracks.
 *
 * Effects are per-layer visual property animations (blur, brightness, clip, etc.)
 * defined at the group level and applied to all targets in the group.
 *
 * Level 1 format:
 *   { type: "blur", from: 8, to: 0, duration_ms: 600, easing: "ease_out" }
 *
 * Compiles to Level 2 keyframe tracks merged into existing layer tracks.
 */
function compileEffects(groups, layerTracks, cues, fps) {
  for (const group of groups) {
    if (!group.effects || !Array.isArray(group.effects)) continue;
    const targets = group.targets || [];

    // Resolve start frame (same logic as expandGroups)
    let groupStartFrame = 0;
    if (group._resolvedDelayFrame != null) {
      groupStartFrame = group._resolvedDelayFrame;
    } else if (group.delay_after_hero_ms) {
      groupStartFrame = Math.round((group.delay_after_hero_ms / 1000) * fps);
    }

    for (const effect of group.effects) {
      const propName = effectTypeToProperty(effect.type);
      if (!propName) continue;

      const durationMs = effect.duration_ms || 400;
      const durationFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
      const delayMs = effect.delay_ms || 0;
      const delayFrames = Math.round((delayMs / 1000) * fps);
      const startFrame = groupStartFrame + delayFrames;
      const endFrame = startFrame + durationFrames;
      const easing = primitiveEasingToCubicBezier(effect.easing || 'ease_out');

      // Selection emits paired tracks (selection_start + selection_end)
      if (effect.type === 'selection') {
        const startTrack = [
          { frame: startFrame, value: effect.from_start ?? 0 },
          { frame: endFrame, value: effect.to_start ?? 0, easing },
        ];
        const endTrack = [
          { frame: startFrame, value: effect.from_end ?? 0 },
          { frame: endFrame, value: effect.to_end ?? 0, easing },
        ];
        for (const targetId of targets) {
          layerTracks[targetId] = mergeTracksInto(layerTracks[targetId] || {}, {
            selection_start: startTrack,
            selection_end: endTrack,
          });
        }
        continue;
      }

      const track = [
        { frame: startFrame, value: effect.from },
        { frame: endFrame, value: effect.to, easing },
      ];

      for (const targetId of targets) {
        layerTracks[targetId] = mergeTracksInto(layerTracks[targetId] || {}, { [propName]: track });
      }
    }
  }
}

/**
 * Map effect type names to Level 2 track property names.
 */
function effectTypeToProperty(type) {
  switch (type) {
    case 'blur': return 'filter_blur';
    case 'brightness': return 'filter_brightness';
    case 'contrast': return 'filter_contrast';
    case 'saturate': return 'filter_saturate';
    case 'scale': return 'scale';
    case 'clip': return 'clip_inset_top'; // simplified — full clip needs all 4
    case 'clip_top': return 'clip_inset_top';
    case 'clip_right': return 'clip_inset_right';
    case 'clip_bottom': return 'clip_inset_bottom';
    case 'clip_left': return 'clip_inset_left';
    case 'clip_circle': return 'clip_circle';
    case 'clip_ellipse': return 'clip_ellipse';
    // SVG-specific effect types
    case 'stroke_dashoffset': return 'stroke_dashoffset';
    case 'fill_opacity': return 'fill_opacity';
    case 'stroke_opacity': return 'stroke_opacity';
    // Text-specific effect types
    case 'typewriter': return 'text_chars';
    case 'text_replace': return 'text_replace_progress';
    case 'caret': return 'caret_opacity';
    case 'selection': return 'selection_start'; // paired track, see compileEffects
    // List-specific effect types
    case 'list_insert': return 'list_insert_progress';
    case 'list_remove': return 'list_remove_progress';
    case 'list_reorder': return 'list_reorder_progress';
    // Surface effect types
    case 'surface_shadow': return 'surface_shadow';
    case 'surface_blur': return 'surface_blur';
    case 'background_bloom': return 'background_bloom';
    // Compositing effect types (ANI-75)
    case 'shadow_offset_x': return 'shadow_offset_x';
    case 'shadow_offset_y': return 'shadow_offset_y';
    case 'shadow_blur_radius': return 'shadow_blur_radius';
    case 'shadow_spread': return 'shadow_spread';
    case 'shadow_opacity': return 'shadow_opacity';
    case 'inner_glow_spread': return 'inner_glow_spread';
    case 'inner_glow_opacity': return 'inner_glow_opacity';
    case 'mask_gradient_start': return 'mask_gradient_start';
    case 'mask_gradient_end': return 'mask_gradient_end';
    case 'mask_gradient_angle': return 'mask_gradient_angle';
    // Counter effect type
    case 'counter': return 'counter_value';
    // Pass-through property types (used by semantic compiler)
    case 'opacity': return 'opacity';
    case 'translateX': return 'translateX';
    case 'translateY': return 'translateY';
    case 'rotate': return 'rotate';
    default: return null;
  }
}

// ── Personality-Aware Camera Constants ──────────────────────────────────────

/**
 * Personality-specific camera constant overrides.
 * Widens creative range for dramatic personalities, constrains for editorial.
 */
const PERSONALITY_CAMERA = {
  'cinematic-dark': {
    SCALE_FACTOR: 0.18,     // deeper zoom
    PAN_MAX_PX: 200,        // wider pans
    DRIFT_AMPLITUDE: 12,    // more pronounced drift
  },
  editorial: {
    SCALE_FACTOR: 0.10,     // subtle zoom
    PAN_MAX_PX: 120,        // restrained pans
    DRIFT_AMPLITUDE: 6,     // gentle drift
  },
  'neutral-light': {
    SCALE_FACTOR: 0.08,     // minimal zoom
    PAN_MAX_PX: 80,         // minimal pans
    DRIFT_AMPLITUDE: 4,     // barely perceptible drift
  },
  montage: {
    SCALE_FACTOR: 0.16,     // punchy zoom
    PAN_MAX_PX: 240,        // wide pans for energy
    DRIFT_AMPLITUDE: 10,    // noticeable drift
  },
};

/**
 * Resolve camera constants for a given personality.
 * Falls back to base CAMERA_CONSTANTS from lib.js.
 */
function resolveCameraConstantsForPersonality(personality) {
  const overrides = personality ? PERSONALITY_CAMERA[personality] : null;
  return {
    ...CAMERA_CONSTANTS,
    ...(overrides || {}),
  };
}

// ── Semantic Compiler (v3 → v2) ─────────────────────────────────────────────

/**
 * Pre-process a v3 scene's semantic block into v2 motion groups + layers.
 * Mutates scene in place: populates scene.layers, scene.motion.groups, scene.motion.camera.
 *
 * @param {object} scene - Scene with `semantic` block
 * @param {object} [options] - { personality?: string }
 */
function compileSemantic(scene, options = {}) {
  const semantic = scene.semantic;
  if (!semantic) return;

  const personality = options.personality || scene.personality || null;
  const fps = scene.fps || 60;
  const durationS = scene.duration_s || 3;
  const durationFrames = Math.round(durationS * fps);

  const components = semantic.components || [];
  const interactions = semantic.interactions || [];

  // Build component lookup map
  const componentMap = new Map();
  for (const cmp of components) {
    componentMap.set(cmp.id, cmp);
  }

  // Step 1: Generate layers for components without layer_ref
  if (!scene.layers) scene.layers = [];
  const existingLayerIds = new Set(scene.layers.map(l => l.id));

  for (const cmp of components) {
    if (cmp.layer_ref) {
      // Validate layer_ref exists
      if (!existingLayerIds.has(cmp.layer_ref)) {
        throw new Error(`Component ${cmp.id} references non-existent layer: ${cmp.layer_ref}`);
      }
    } else {
      // Auto-generate a layer using the component ID as layer ID
      if (!existingLayerIds.has(cmp.id)) {
        scene.layers.push({
          id: cmp.id,
          type: 'html',
          content: `<div data-component="${cmp.type}">${cmp.id}</div>`,
        });
        existingLayerIds.add(cmp.id);
      }
    }
  }

  // Step 2: Map interactions → motion groups
  const semanticGroups = [];
  for (const interaction of interactions) {
    const groups = interactionToGroup(interaction, componentMap, personality, fps);
    semanticGroups.push(...groups);
  }

  // Step 3: Apply personality constraints
  if (personality) {
    applySemanticConstraints(semanticGroups, personality);
  }

  // Step 4: Map camera_behavior → motion.camera
  if (!scene.motion) scene.motion = {};
  if (semantic.camera_behavior) {
    const cameraBehavior = compileCameraBehavior(
      semantic.camera_behavior, durationFrames, fps, personality, interactions
    );
    if (cameraBehavior && Object.keys(cameraBehavior).length > 0) {
      // Only set if scene doesn't already have explicit camera motion
      if (!scene.motion.camera) {
        scene.motion.camera = cameraBehavior;
      }
    }
  }

  // Step 5: Merge semantic groups with existing explicit groups
  // Semantic groups come first, then explicit groups (explicit take precedence on cue conflicts)
  const existingGroups = scene.motion.groups || [];
  scene.motion.groups = [...semanticGroups, ...existingGroups];

  // Step 6: Resolve layout constraints → layer positions (ANI-74)
  const positionMap = resolveComponentLayout(components, 1920, 1080);
  for (const [cmpId, pos] of positionMap) {
    const layerId = componentMap.get(cmpId)?.layer_ref || cmpId;
    const layer = scene.layers.find(l => l.id === layerId);
    if (layer) layer.position = pos;
  }
}

/**
 * Map a single interaction to one or more v2 motion groups.
 *
 * @param {object} interaction - Interaction definition from semantic.interactions[]
 * @param {Map} componentMap - Component ID → component definition
 * @param {string|null} personality - Active personality name
 * @param {number} fps - Frames per second
 * @returns {object[]} Array of motion group objects
 */
function interactionToGroup(interaction, componentMap, personality, fps = 60) {
  const { id, target, kind, params = {}, timing, on_complete, duration_ms } = interaction;
  const component = componentMap.get(target);
  const layerId = component?.layer_ref || target;

  // Resolve timing into group-compatible fields
  const timingFields = resolveInteractionTiming(timing);

  const baseGroup = {
    id,
    targets: [layerId],
    ...timingFields,
    ...(on_complete ? { on_complete } : {}),
  };

  // ── Component-local state machine overrides (ANI-76) ───────────────────
  const override = resolveStateOverrides(component?.type, kind, params);

  if (override && kind === 'fan_stack') {
    // fan_stack special path: use override spread/easing but keep per-card loop
    const spread = override.fan_spread || params.spread || 15;
    const fanEasing = override.fan_easing || 'spring';
    const dur = duration_ms || 600;
    const items = component?.props?.items || [];
    const count = Math.max(items.length, 3);
    const itemTargets = Array.from({ length: count }, (_, i) => `${layerId}_card_${i}`);

    const groups = [];
    for (let i = 0; i < count; i++) {
      const centerOffset = i - (count - 1) / 2;
      const angle = centerOffset * (spread / (count - 1 || 1));
      const tx = centerOffset * 30;
      groups.push({
        id: `${id}_card_${i}`,
        targets: [itemTargets[i]],
        ...timingFields,
        effects: [
          { type: 'rotate', from: 0, to: angle, duration_ms: dur, easing: fanEasing },
          { type: 'translateX', from: 0, to: tx, duration_ms: dur, easing: fanEasing },
        ],
      });
    }
    if (on_complete && groups.length > 0) {
      groups[groups.length - 1].on_complete = on_complete;
      for (let i = 0; i < groups.length - 1; i++) {
        delete groups[i].on_complete;
      }
    }
    return groups;
  }

  if (override && override.effects) {
    // Resolve null easing to personality default
    const defaultEasing = personality === 'cinematic-dark' ? 'spring' : 'ease_out';
    const effects = override.effects.map(e => ({
      ...e,
      easing: e.easing === null ? defaultEasing : e.easing,
    }));

    // Use override duration if provided, else interaction-level, else effect-level
    const dur = duration_ms || override.duration_ms;
    if (dur) {
      for (const e of effects) {
        // Scale effect durations proportionally if override has a base duration
        if (override.duration_ms && e.duration_ms) {
          const ratio = e.duration_ms / override.duration_ms;
          e.duration_ms = Math.round(dur * ratio);
          if (e.delay_ms != null) {
            e.delay_ms = Math.round(dur * (e.delay_ms / override.duration_ms));
          }
        }
      }
    }

    if (kind === 'focus') {
      // Focus path: build target group + sibling dim group
      const groups = [{ ...baseGroup, effects }];

      const siblingIds = [];
      for (const [cmpId, cmp] of componentMap) {
        if (cmpId !== target) {
          siblingIds.push(cmp.layer_ref || cmpId);
        }
      }
      if (siblingIds.length > 0) {
        const dimOpacity = override.sibling_dim_opacity != null
          ? override.sibling_dim_opacity
          : (personality === 'editorial' ? 0.4 : 0.2);
        const halfDur = (dur || 300) / 2;
        groups.push({
          id: `${id}_sibling_dim`,
          targets: siblingIds,
          ...timingFields,
          effects: [
            { type: 'opacity', from: 1, to: dimOpacity, duration_ms: halfDur, easing: defaultEasing },
            { type: 'opacity', from: dimOpacity, to: 1, duration_ms: halfDur, delay_ms: halfDur, easing: defaultEasing },
          ],
        });
      }
      return groups;
    }

    if (kind === 'insert_items') {
      // insert_items path: keep stagger structure, use override effects
      const items = params.items || [];
      const staggerMs = params.stagger_ms || 120;
      const itemTargets = items.map((_, i) => `${layerId}_item_${i}`);
      return [{
        ...baseGroup,
        targets: itemTargets.length > 0 ? itemTargets : [layerId],
        stagger: { interval_ms: staggerMs, order: 'sequential' },
        effects,
      }];
    }

    // Generic override path (settle, open_menu, select_item, etc.)
    return [{ ...baseGroup, effects }];
  }
  // ── End state machine overrides ────────────────────────────────────────

  switch (kind) {
    case 'focus': {
      const dur = duration_ms || 300;
      const groups = [{
        ...baseGroup,
        effects: [
          { type: 'opacity', from: 1, to: 0.7, duration_ms: dur / 2, easing: 'ease_out' },
          { type: 'opacity', from: 0.7, to: 1, duration_ms: dur / 2, delay_ms: dur / 2, easing: 'ease_out' },
          { type: 'scale', from: 1, to: 1.05, duration_ms: dur / 2, easing: 'ease_out' },
          { type: 'scale', from: 1.05, to: 1, duration_ms: dur / 2, delay_ms: dur / 2, easing: 'ease_out' },
        ],
      }];

      // Emit sibling dim group — dim all other components
      const siblingIds = [];
      for (const [cmpId, cmp] of componentMap) {
        if (cmpId !== target) {
          siblingIds.push(cmp.layer_ref || cmpId);
        }
      }
      if (siblingIds.length > 0) {
        const dimOpacity = personality === 'editorial' ? 0.4 : 0.2;
        groups.push({
          id: `${id}_sibling_dim`,
          targets: siblingIds,
          ...timingFields,
          effects: [
            { type: 'opacity', from: 1, to: dimOpacity, duration_ms: dur / 2, easing: 'ease_out' },
            { type: 'opacity', from: dimOpacity, to: 1, duration_ms: dur / 2, delay_ms: dur / 2, easing: 'ease_out' },
          ],
        });
      }

      return groups;
    }

    case 'type_text': {
      const text = params.text || '';
      const speed = params.speed || 50;
      const dur = duration_ms || text.length * speed;
      return [{
        ...baseGroup,
        effects: [
          { type: 'typewriter', from: 0, to: text.length, duration_ms: dur, easing: 'linear' },
          { type: 'caret', from: 1, to: 1, duration_ms: dur, easing: 'linear' },
          { type: 'caret', from: 1, to: 0, duration_ms: 1, delay_ms: dur, easing: 'linear' },
        ],
      }];
    }

    case 'replace_text': {
      const dur = duration_ms || 400;
      return [{
        ...baseGroup,
        effects: [
          { type: 'text_replace', from: 0, to: 1, duration_ms: dur, easing: 'ease_out' },
          { type: 'caret', from: 1, to: 1, duration_ms: dur, easing: 'linear' },
          { type: 'caret', from: 1, to: 0, duration_ms: 1, delay_ms: dur, easing: 'linear' },
        ],
      }];
    }

    case 'open_menu': {
      const dur = duration_ms || 300;
      return [{
        ...baseGroup,
        effects: [
          { type: 'translateY', from: -20, to: 0, duration_ms: dur, easing: 'ease_out' },
          { type: 'opacity', from: 0, to: 1, duration_ms: dur, easing: 'ease_out' },
        ],
      }];
    }

    case 'select_item': {
      const dur = duration_ms || 200;
      return [{
        ...baseGroup,
        effects: [
          { type: 'opacity', from: 0.5, to: 1, duration_ms: dur, easing: 'ease_out' },
        ],
      }];
    }

    case 'insert_items': {
      const items = params.items || [];
      const staggerMs = params.stagger_ms || 120;
      const dur = duration_ms || 300;
      // Create one group with stagger for all item sub-layers
      const itemTargets = items.map((_, i) => `${layerId}_item_${i}`);
      return [{
        ...baseGroup,
        targets: itemTargets.length > 0 ? itemTargets : [layerId],
        stagger: { interval_ms: staggerMs, order: 'sequential' },
        effects: [
          { type: 'translateY', from: 20, to: 0, duration_ms: dur, easing: 'ease_out' },
          { type: 'opacity', from: 0, to: 1, duration_ms: dur, easing: 'ease_out' },
        ],
      }];
    }

    case 'fan_stack': {
      const spread = params.spread || 15;
      const dur = duration_ms || 600;
      const items = component?.props?.items || [];
      const count = Math.max(items.length, 3);
      const itemTargets = Array.from({ length: count }, (_, i) => `${layerId}_card_${i}`);

      // Each card gets rotate + translateX based on its position relative to center
      const groups = [];
      for (let i = 0; i < count; i++) {
        const centerOffset = i - (count - 1) / 2;
        const angle = centerOffset * (spread / (count - 1 || 1));
        const tx = centerOffset * 30;
        groups.push({
          id: `${id}_card_${i}`,
          targets: [itemTargets[i]],
          ...timingFields,
          effects: [
            { type: 'rotate', from: 0, to: angle, duration_ms: dur, easing: 'spring' },
            { type: 'translateX', from: 0, to: tx, duration_ms: dur, easing: 'spring' },
          ],
        });
      }
      // Emit on_complete only on the last card group
      if (on_complete && groups.length > 0) {
        groups[groups.length - 1].on_complete = on_complete;
        // Remove on_complete from earlier groups
        for (let i = 0; i < groups.length - 1; i++) {
          delete groups[i].on_complete;
        }
      }
      return groups;
    }

    case 'settle': {
      const dur = duration_ms || 400;
      const easing = personality === 'cinematic-dark' ? 'spring' : 'ease_out';
      return [{
        ...baseGroup,
        effects: [
          { type: 'scale', from: 1.05, to: 1, duration_ms: dur, easing },
        ],
      }];
    }

    case 'pulse_focus': {
      const count = params.count || 2;
      const intensity = params.intensity || 1.05;
      const cycleDur = duration_ms ? Math.round(duration_ms / count) : 200;
      const effects = [];
      for (let i = 0; i < count; i++) {
        effects.push(
          { type: 'scale', from: 1, to: intensity, duration_ms: cycleDur / 2, delay_ms: i * cycleDur, easing: 'ease_out' },
          { type: 'scale', from: intensity, to: 1, duration_ms: cycleDur / 2, delay_ms: i * cycleDur + cycleDur / 2, easing: 'ease_out' },
        );
      }
      return [{ ...baseGroup, effects }];
    }

    default:
      return [baseGroup];
  }
}

/**
 * Resolve interaction timing fields into v2 group-compatible fields.
 */
function resolveInteractionTiming(timing) {
  if (!timing) return {};

  const fields = {};

  if (timing.at_ms != null) {
    fields.delay_after_hero_ms = timing.at_ms;
  } else if (timing.at != null) {
    // Proportional — stored as a marker, resolved during cue graph building
    fields._at_proportional = timing.at;
  }

  if (timing.delay) {
    fields.delay = { ...timing.delay };
  }

  return fields;
}

/**
 * Map semantic.camera_behavior to v2 motion.camera format.
 *
 * @param {object} cameraBehavior - { mode, ambient, push_in_on_focus }
 * @param {number} durationFrames - Total scene duration in frames
 * @param {number} fps - Frames per second
 * @param {string|null} personality - Active personality
 * @param {object[]} interactions - Scene interactions (for reactive sync)
 * @returns {object} v2-compatible camera motion object
 */
function compileCameraBehavior(cameraBehavior, durationFrames, fps, personality, interactions = []) {
  let mode = cameraBehavior.mode || 'ambient';

  // Montage: no ambient camera — fall through to static
  if (personality === 'montage' && mode === 'ambient') {
    mode = 'static';
  }

  switch (mode) {
    case 'reactive': {
      // Sync push_in to first focus interaction
      const firstFocus = interactions.find(i => i.kind === 'focus');
      const camera = {
        move: 'push_in',
        intensity: 0.2,
      };
      if (firstFocus?.timing?.at_ms != null) {
        camera.sync = { peak_at: firstFocus.timing.at_ms / ((durationFrames / fps) * 1000) };
      }
      return camera;
    }

    case 'ambient': {
      const driftIntensity = cameraBehavior.ambient?.drift ?? 0.15;
      return {
        move: 'drift',
        intensity: driftIntensity,
      };
    }

    case 'static':
      return {};

    default:
      return {};
  }
}

/**
 * Post-processing pass: apply personality constraints to semantic groups.
 *
 * @param {object[]} groups - Generated motion groups
 * @param {string} personality - Personality name
 */
function applySemanticConstraints(groups, personality) {
  for (const group of groups) {
    if (!group.effects) continue;

    switch (personality) {
      case 'editorial':
        for (const effect of group.effects) {
          // settle easing → ease_out (not spring)
          if (effect.easing === 'spring') {
            effect.easing = 'ease_out';
          }
          // fan_stack spread ≤ 10° — handled by capping rotate values
          if (effect.type === 'rotate' && Math.abs(effect.to) > 10) {
            effect.to = Math.sign(effect.to) * 10;
          }
          // Cap shadow_opacity at 0.1 for editorial
          if (effect.type === 'shadow_opacity' && effect.to > 0.1) {
            effect.to = 0.1;
          }
        }
        break;

      case 'neutral-light':
        // Strip shadow and glow effects for neutral-light
        group.effects = group.effects.filter(e =>
          !['shadow_offset_x', 'shadow_offset_y', 'shadow_blur_radius',
            'shadow_spread', 'shadow_opacity', 'inner_glow_spread',
            'inner_glow_opacity'].includes(e.type)
        );
        for (const effect of group.effects) {
          // fan_stack → slide fallback: convert rotate to translateX
          if (effect.type === 'rotate') {
            effect.type = 'translateX';
            effect.from = 0;
            effect.to = effect.to > 0 ? 20 : -20;
            effect.easing = 'ease_out';
          }
        }
        // pulse_focus max 1 count — trim extra scale effects
        if (group.id && group.effects.filter(e => e.type === 'scale').length > 2) {
          // Keep only first scale up + scale down pair
          const scaleEffects = group.effects.filter(e => e.type === 'scale');
          const nonScaleEffects = group.effects.filter(e => e.type !== 'scale');
          group.effects = [...nonScaleEffects, ...scaleEffects.slice(0, 2)];
        }
        break;

      case 'montage':
        // insert_items stagger → 0ms (simultaneous)
        if (group.stagger) {
          group.stagger.interval_ms = 0;
        }
        break;
    }
  }
}

// ── Batch Compilation ────────────────────────────────────────────────────────

/**
 * Compile all scenes referenced by a sequence manifest.
 *
 * Deep-clones each scene before compilation (compileSemantic mutates in place),
 * then runs compileMotion on the clone. Returns post-mutation sceneDefs
 * (with generated layers) and the compiled timelines map.
 *
 * Duplicate scene references are compiled only once.
 * Scenes without a matching definition are skipped.
 * v1 scenes (no motion/semantic block) produce null timelines.
 *
 * @param {object} manifest - Sequence manifest with `scenes` array
 * @param {object} sceneDefs - Scene definitions keyed by scene_id
 * @param {object} [catalogs] - { recipes, primitives } for compiler
 * @param {object} [options] - { personality?: string }
 * @returns {{ sceneDefs: object, timelines: object }}
 */
export function compileAllScenes(manifest, sceneDefs, catalogs = {}, options = {}) {
  const compiledSceneDefs = {};
  const timelines = {};
  const scenes = manifest.scenes || [];

  for (const entry of scenes) {
    const sceneId = entry.scene;
    if (compiledSceneDefs[sceneId]) continue; // already compiled (duplicate refs)
    const original = sceneDefs[sceneId];
    if (!original) continue;

    const scene = structuredClone(original);
    const personality = options.personality || scene.personality;
    const timeline = compileMotion(scene, catalogs, { personality });

    compiledSceneDefs[sceneId] = scene;  // post-mutation (has generated layers)
    if (timeline) timelines[sceneId] = timeline;
  }

  return { sceneDefs: compiledSceneDefs, timelines };
}

// ── Exports for testing ──────────────────────────────────────────────────────

export {
  resolveRecipes,
  buildCueGraph,
  expandGroups,
  compileCamera,
  compileEffects,
  effectTypeToProperty,
  applyStaggerOrder,
  computeAmplitude,
  primitiveToTracks,
  resolveCameraConstantsForPersonality,
  compileSemantic,
  compileCameraBehavior,
  interactionToGroup,
  applySemanticConstraints,
  ANIMATABLE_DEFAULTS,
  PERSONALITY_CAMERA,
};
