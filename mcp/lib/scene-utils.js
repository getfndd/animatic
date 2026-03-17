/**
 * Pure scene utility functions extracted from src/remotion/lib.js.
 *
 * These have zero React/Remotion dependencies — just constants, validators,
 * and lookup tables. Used by compiler, generator, guardrails, planner, and llm.
 *
 * The Remotion pipeline re-exports these so downstream rendering code is unaffected.
 */

// ── Camera Constants ────────────────────────────────────────────────────────

/**
 * Camera constants extracted from the scene-format spec.
 *
 * Intensity mapping:
 *   push_in/pull_out: scale ±(intensity * SCALE_FACTOR)
 *   pan_left/right:   translateX ±(intensity * PAN_MAX_PX)px
 *   drift:            ±(intensity * DRIFT_AMPLITUDE)px sinusoidal
 */
export const CAMERA_CONSTANTS = {
  SCALE_FACTOR: 0.14,
  PAN_MAX_PX: 160,
  DRIFT_AMPLITUDE: 8,
  DRIFT_Y_RATIO: 0.6,
  DEFAULT_INTENSITY: 0.5,
  MIN_OVERSCAN: 0.02,
};

// ── Entrance Primitives ─────────────────────────────────────────────────────

const ENTRANCE_PRIMITIVES = {
  'as-fadeInUp': {
    durationMs: 420,
    easing: 'ease_out',
    keyframes: [
      { at: 0, opacity: 0, translateY: 24 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  'cd-focus-stagger': {
    durationMs: 540,
    easing: 'expo_out',
    keyframes: [
      { at: 0, opacity: 0, scale: 0.97, blur: 8 },
      { at: 1, opacity: 1, scale: 1, blur: 0 },
    ],
  },
  'cd-typewriter': {
    durationMs: 28,
    easing: 'linear',
    mode: 'typewriter',
  },
  'ed-slide-stagger': {
    durationMs: 400,
    easing: 'ease_out',
    keyframes: [
      { at: 0, opacity: 0, translateY: 10 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  'ed-blur-reveal': {
    durationMs: 600,
    easing: 'ease_out',
    keyframes: [
      { at: 0, opacity: 0, blur: 8 },
      { at: 1, opacity: 1, blur: 0 },
    ],
  },
  'nl-slide-stagger': {
    durationMs: 350,
    easing: 'ease_out',
    keyframes: [
      { at: 0, opacity: 0, translateY: 8 },
      { at: 1, opacity: 1, translateY: 0 },
    ],
  },
  'fade-in': {
    durationMs: 400,
    easing: 'ease_out',
    keyframes: [
      { at: 0, opacity: 0 },
      { at: 1, opacity: 1 },
    ],
  },
  'mo-scale-entrance': {
    durationMs: 400,
    easing: 'expo_out',
    keyframes: [
      { at: 0, opacity: 0, scale: 1.15 },
      { at: 1, opacity: 1, scale: 1 },
    ],
  },
  'mo-stat-reveal': {
    durationMs: 300,
    easing: 'expo_out',
    keyframes: [
      { at: 0, opacity: 0, scale: 0.8 },
      { at: 0.6, opacity: 1, scale: 1.05 },
      { at: 1, opacity: 1, scale: 1 },
    ],
  },
  'mo-text-hero': {
    durationMs: 400,
    easing: 'expo_out',
    keyframes: [
      { at: 0, opacity: 0, scale: 1.5 },
      { at: 1, opacity: 1, scale: 1 },
    ],
  },
};

export function resolveEntrancePrimitive(primitiveId) {
  return ENTRANCE_PRIMITIVES[primitiveId] || ENTRANCE_PRIMITIVES['as-fadeInUp'];
}

// ── Layout Templates ────────────────────────────────────────────────────────

const VALID_TEMPLATES = ['hero-center', 'split-panel', 'masonry-grid', 'full-bleed', 'device-mockup'];

/**
 * Get available slot names for a layout template.
 */
function getAvailableSlots(template, config) {
  switch (template) {
    case 'hero-center':
      return ['background', 'center'];
    case 'split-panel':
      return ['background', 'left', 'right'];
    case 'masonry-grid': {
      const cols = config?.columns || 3;
      const rows = config?.rows || 2;
      const cells = [];
      for (let i = 0; i < cols * rows; i++) {
        cells.push(`cell-${i}`);
      }
      return ['background', ...cells];
    }
    case 'full-bleed':
      return ['media', 'overlay'];
    case 'device-mockup':
      return ['background', 'content', 'device'];
    default:
      return [];
  }
}

// ── Scene Validator ─────────────────────────────────────────────────────────

/**
 * Validate a scene definition against the spec.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateScene(scene) {
  const errors = [];

  // scene_id
  if (!scene.scene_id) {
    errors.push('scene_id is required');
  } else if (!/^sc_[a-z0-9_]+$/.test(scene.scene_id)) {
    errors.push(`scene_id "${scene.scene_id}" must match ^sc_[a-z0-9_]+$`);
  }

  // duration_s
  if (scene.duration_s != null) {
    if (typeof scene.duration_s !== 'number' || scene.duration_s < 0.5 || scene.duration_s > 30) {
      errors.push(`duration_s must be between 0.5 and 30 (got ${scene.duration_s})`);
    }
  }

  // camera
  if (scene.camera) {
    const cam = scene.camera;
    const validMoves = ['static', 'push_in', 'pull_out', 'pan_left', 'pan_right', 'drift'];
    if (cam.move && !validMoves.includes(cam.move)) {
      errors.push(`camera.move "${cam.move}" is not valid`);
    }
    if (cam.intensity != null && (cam.intensity < 0 || cam.intensity > 1)) {
      errors.push(`camera.intensity must be between 0 and 1`);
    }
    if (cam.easing) {
      const validEasings = ['linear', 'ease_out', 'cinematic_scurve'];
      if (!validEasings.includes(cam.easing)) {
        errors.push(`camera.easing "${cam.easing}" is not valid`);
      }
    }
  }

  // layout
  if (scene.layout) {
    if (!scene.layout.template) {
      errors.push('layout.template is required');
    } else if (!VALID_TEMPLATES.includes(scene.layout.template)) {
      errors.push(`layout.template "${scene.layout.template}" is not valid (must be one of: ${VALID_TEMPLATES.join(', ')})`);
    }
  }

  // assets — check for duplicate IDs
  if (scene.assets && Array.isArray(scene.assets)) {
    const assetIds = new Set();
    for (const asset of scene.assets) {
      if (!asset.id) {
        errors.push('asset.id is required');
      } else if (assetIds.has(asset.id)) {
        errors.push(`duplicate asset.id "${asset.id}"`);
      } else {
        assetIds.add(asset.id);
      }
      if (!asset.src) {
        errors.push(`asset "${asset.id || '?'}".src is required`);
      }
    }

    // layers — check asset references resolve
    if (scene.layers && Array.isArray(scene.layers)) {
      const layerIds = new Set();
      for (const layer of scene.layers) {
        if (!layer.id) {
          errors.push('layer.id is required');
        } else if (layerIds.has(layer.id)) {
          errors.push(`duplicate layer.id "${layer.id}"`);
        } else {
          layerIds.add(layer.id);
        }

        const validTypes = ['html', 'video', 'image', 'text', 'svg'];
        if (!validTypes.includes(layer.type)) {
          errors.push(`layer "${layer.id || '?'}".type "${layer.type}" is not valid`);
        }

        // Text layer validation
        if (layer.type === 'text') {
          if (!layer.content || typeof layer.content !== 'string') {
            errors.push(`layer "${layer.id || '?'}".content is required for text layers and must be a non-empty string`);
          }
          if (layer.animation) {
            const validAnimations = ['word-reveal', 'scale-cascade', 'weight-morph'];
            if (!validAnimations.includes(layer.animation)) {
              errors.push(`layer "${layer.id || '?'}".animation "${layer.animation}" is not valid (must be one of: ${validAnimations.join(', ')})`);
            }
          }
        }

        if (layer.asset && !assetIds.has(layer.asset)) {
          errors.push(`layer "${layer.id || '?'}".asset "${layer.asset}" references unknown asset`);
        }

        if (layer.depth_class) {
          const validDepths = ['background', 'midground', 'foreground'];
          if (!validDepths.includes(layer.depth_class)) {
            errors.push(`layer "${layer.id || '?'}".depth_class "${layer.depth_class}" is not valid`);
          }
        }

        if (layer.blend_mode) {
          const validBlends = ['normal', 'screen', 'multiply', 'overlay'];
          if (!validBlends.includes(layer.blend_mode)) {
            errors.push(`layer "${layer.id || '?'}".blend_mode "${layer.blend_mode}" is not valid`);
          }
        }

        if (layer.opacity != null && (layer.opacity < 0 || layer.opacity > 1)) {
          errors.push(`layer "${layer.id || '?'}".opacity must be between 0 and 1`);
        }

        // mask_layer: must be a string referencing another layer
        if (layer.mask_layer != null && typeof layer.mask_layer !== 'string') {
          errors.push(`layer "${layer.id || '?'}".mask_layer must be a string`);
        }

        // mask_type: luminance or alpha
        if (layer.mask_type != null) {
          const validMaskTypes = ['luminance', 'alpha'];
          if (!validMaskTypes.includes(layer.mask_type)) {
            errors.push(`layer "${layer.id || '?'}".mask_type "${layer.mask_type}" is not valid (must be one of: ${validMaskTypes.join(', ')})`);
          }
        }

        // Validate slot references against layout
        if (layer.slot && scene.layout && scene.layout.template && VALID_TEMPLATES.includes(scene.layout.template)) {
          const validSlots = getAvailableSlots(scene.layout.template, scene.layout.config);
          if (!validSlots.includes(layer.slot)) {
            errors.push(`layer "${layer.id || '?'}".slot "${layer.slot}" is not valid for template "${scene.layout.template}" (valid: ${validSlots.join(', ')})`);
          }
        }
      }
    }
  }

  // v2: motion block validation
  if (scene.motion) {
    if (scene.motion.groups && !Array.isArray(scene.motion.groups)) {
      errors.push('motion.groups must be an array');
    }
    if (scene.motion.groups && Array.isArray(scene.motion.groups)) {
      for (let i = 0; i < scene.motion.groups.length; i++) {
        const group = scene.motion.groups[i];
        const gp = `motion.groups[${i}]`;
        if (!group.targets || !Array.isArray(group.targets) || group.targets.length === 0) {
          if (!group.recipe) {
            errors.push(`${gp} must have targets array or recipe reference`);
          }
        }
        if (group.stagger) {
          if (group.stagger.interval_ms != null && (typeof group.stagger.interval_ms !== 'number' || group.stagger.interval_ms < 0)) {
            errors.push(`${gp}.stagger.interval_ms must be >= 0`);
          }
          if (group.stagger.order) {
            const validOrders = ['sequential', 'reverse', 'center_out', 'random', 'distance'];
            if (!validOrders.includes(group.stagger.order)) {
              errors.push(`${gp}.stagger.order "${group.stagger.order}" is not valid`);
            }
          }
        }
      }
    }
    // v2 camera: multi-move or single move with sync
    if (scene.motion.camera) {
      const mc = scene.motion.camera;
      if (mc.moves && !Array.isArray(mc.moves)) {
        errors.push('motion.camera.moves must be an array');
      }
      if (mc.sync) {
        if (mc.sync.peak_at != null && (mc.sync.peak_at < 0 || mc.sync.peak_at > 1)) {
          errors.push('motion.camera.sync.peak_at must be between 0 and 1');
        }
      }
    }
  }

  // v3: semantic block validation
  if (scene.semantic) {
    const sem = scene.semantic;

    // Collect layer IDs for layer_ref cross-referencing
    const layerIds = new Set();
    if (scene.layers && Array.isArray(scene.layers)) {
      for (const layer of scene.layers) {
        if (layer.id) layerIds.add(layer.id);
      }
    }

    // Components
    const validComponentTypes = ['input_field', 'prompt_card', 'dropdown_menu', 'result_stack', 'upload_zone', 'chip_row', 'icon_label_row', 'stacked_cards'];
    const validRoles = ['hero', 'supporting', 'background', 'wildcard'];
    const componentIds = new Set();

    if (sem.components && Array.isArray(sem.components)) {
      for (let i = 0; i < sem.components.length; i++) {
        const c = sem.components[i];
        const cp = `semantic.components[${i}]`;

        if (!c.id) {
          errors.push(`${cp}.id is required`);
        } else if (!/^cmp_[a-z0-9_]+$/.test(c.id)) {
          errors.push(`${cp}.id "${c.id}" must match ^cmp_[a-z0-9_]+$`);
        } else if (componentIds.has(c.id)) {
          errors.push(`duplicate component id "${c.id}"`);
        } else {
          componentIds.add(c.id);
        }

        if (!c.type || !validComponentTypes.includes(c.type)) {
          errors.push(`${cp}.type "${c.type}" is not valid (must be one of: ${validComponentTypes.join(', ')})`);
        }

        if (c.role != null && !validRoles.includes(c.role)) {
          errors.push(`${cp}.role "${c.role}" is not valid (must be one of: ${validRoles.join(', ')})`);
        }

        if (c.layer_ref != null && !layerIds.has(c.layer_ref)) {
          errors.push(`${cp}.layer_ref "${c.layer_ref}" references unknown layer`);
        }

        if (c.anchor) {
          if (c.anchor.x != null && (c.anchor.x < 0 || c.anchor.x > 1)) {
            errors.push(`${cp}.anchor.x must be between 0 and 1`);
          }
          if (c.anchor.y != null && (c.anchor.y < 0 || c.anchor.y > 1)) {
            errors.push(`${cp}.anchor.y must be between 0 and 1`);
          }
        }
      }
    }

    // Interactions
    const validKinds = ['focus', 'type_text', 'replace_text', 'open_menu', 'select_item', 'insert_items', 'fan_stack', 'settle', 'pulse_focus'];
    const interactionIds = new Set();

    if (sem.interactions && Array.isArray(sem.interactions)) {
      for (let i = 0; i < sem.interactions.length; i++) {
        const int = sem.interactions[i];
        const ip = `semantic.interactions[${i}]`;

        if (!int.id) {
          errors.push(`${ip}.id is required`);
        } else if (!/^int_[a-z0-9_]+$/.test(int.id)) {
          errors.push(`${ip}.id "${int.id}" must match ^int_[a-z0-9_]+$`);
        } else if (interactionIds.has(int.id)) {
          errors.push(`duplicate interaction id "${int.id}"`);
        } else {
          interactionIds.add(int.id);
        }

        if (!int.target) {
          errors.push(`${ip}.target is required`);
        } else if (!componentIds.has(int.target)) {
          errors.push(`${ip}.target "${int.target}" references unknown component`);
        }

        if (!int.kind || !validKinds.includes(int.kind)) {
          errors.push(`${ip}.kind "${int.kind}" is not valid (must be one of: ${validKinds.join(', ')})`);
        }

        if (int.duration_ms != null && (typeof int.duration_ms !== 'number' || int.duration_ms < 0)) {
          errors.push(`${ip}.duration_ms must be >= 0`);
        }
      }
    }

    // Camera behavior
    if (sem.camera_behavior) {
      const validModes = ['reactive', 'ambient', 'static'];
      if (sem.camera_behavior.mode != null && !validModes.includes(sem.camera_behavior.mode)) {
        errors.push(`semantic.camera_behavior.mode "${sem.camera_behavior.mode}" is not valid (must be one of: ${validModes.join(', ')})`);
      }
    }

    // Art direction
    if (sem.art_direction) {
      const ad = sem.art_direction;
      if (ad.density != null && !['sparse', 'balanced', 'dense'].includes(ad.density)) {
        errors.push(`semantic.art_direction.density "${ad.density}" is not valid (must be one of: sparse, balanced, dense)`);
      }
      if (ad.focus != null && !['single', 'distributed'].includes(ad.focus)) {
        errors.push(`semantic.art_direction.focus "${ad.focus}" is not valid (must be one of: single, distributed)`);
      }
      if (ad.motion_profile != null && !['restrained', 'fluid', 'energetic'].includes(ad.motion_profile)) {
        errors.push(`semantic.art_direction.motion_profile "${ad.motion_profile}" is not valid (must be one of: restrained, fluid, energetic)`);
      }
    }
  }

  // format_version
  if (scene.format_version != null && ![1, 2, 3].includes(scene.format_version)) {
    errors.push(`format_version must be 1, 2, or 3 (got ${scene.format_version})`);
  }

  return { valid: errors.length === 0, errors };
}

// ── Manifest Validator ──────────────────────────────────────────────────────

/**
 * Validate a sequence manifest against the spec.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateManifest(manifest) {
  const errors = [];

  // sequence_id
  if (!manifest.sequence_id) {
    errors.push('sequence_id is required');
  } else if (!/^seq_[a-z0-9_]+$/.test(manifest.sequence_id)) {
    errors.push(`sequence_id "${manifest.sequence_id}" must match ^seq_[a-z0-9_]+$`);
  }

  // fps
  if (manifest.fps != null && ![24, 30, 60].includes(manifest.fps)) {
    errors.push(`fps must be 24, 30, or 60 (got ${manifest.fps})`);
  }

  // resolution
  if (manifest.resolution) {
    if (typeof manifest.resolution.w !== 'number' || typeof manifest.resolution.h !== 'number') {
      errors.push('resolution.w and resolution.h must be numbers');
    }
  }

  // scenes
  if (!manifest.scenes || !Array.isArray(manifest.scenes) || manifest.scenes.length === 0) {
    errors.push('scenes array is required and must have at least 1 entry');
  } else {
    for (let i = 0; i < manifest.scenes.length; i++) {
      const scene = manifest.scenes[i];
      const prefix = `scenes[${i}]`;

      if (!scene.scene) {
        errors.push(`${prefix}.scene is required`);
      }

      if (scene.duration_s != null) {
        if (typeof scene.duration_s !== 'number' || scene.duration_s < 0.5 || scene.duration_s > 30) {
          errors.push(`${prefix}.duration_s must be between 0.5 and 30 (got ${scene.duration_s})`);
        }
      }

      if (scene.transition_in) {
        const validTypes = ['hard_cut', 'crossfade', 'whip_left', 'whip_right', 'whip_up', 'whip_down'];
        if (!validTypes.includes(scene.transition_in.type)) {
          errors.push(`${prefix}.transition_in.type "${scene.transition_in.type}" is not valid`);
        }
        if (scene.transition_in.duration_ms != null) {
          if (typeof scene.transition_in.duration_ms !== 'number' || scene.transition_in.duration_ms < 0 || scene.transition_in.duration_ms > 2000) {
            errors.push(`${prefix}.transition_in.duration_ms must be between 0 and 2000`);
          }
        }
      }

      if (scene.camera_override) {
        const cam = scene.camera_override;
        const validMoves = ['static', 'push_in', 'pull_out', 'pan_left', 'pan_right', 'drift'];
        if (cam.move && !validMoves.includes(cam.move)) {
          errors.push(`${prefix}.camera_override.move "${cam.move}" is not valid`);
        }
        if (cam.intensity != null && (cam.intensity < 0 || cam.intensity > 1)) {
          errors.push(`${prefix}.camera_override.intensity must be between 0 and 1`);
        }
        if (cam.easing) {
          const validEasings = ['linear', 'ease_out', 'cinematic_scurve'];
          if (!validEasings.includes(cam.easing)) {
            errors.push(`${prefix}.camera_override.easing "${cam.easing}" is not valid`);
          }
        }
      }

      // ANI-26: Optional shot_grammar field
      if (scene.shot_grammar) {
        const sg = scene.shot_grammar;
        const validSizes = ['wide', 'medium', 'close_up', 'extreme_close_up'];
        const validAngles = ['eye_level', 'high', 'low', 'dutch'];
        const validFramings = ['center', 'rule_of_thirds_left', 'rule_of_thirds_right', 'dynamic_offset'];

        if (sg.shot_size && !validSizes.includes(sg.shot_size)) {
          errors.push(`${prefix}.shot_grammar.shot_size "${sg.shot_size}" is not valid`);
        }
        if (sg.angle && !validAngles.includes(sg.angle)) {
          errors.push(`${prefix}.shot_grammar.angle "${sg.angle}" is not valid`);
        }
        if (sg.framing && !validFramings.includes(sg.framing)) {
          errors.push(`${prefix}.shot_grammar.framing "${sg.framing}" is not valid`);
        }
      }
    }
  }

  // audio (sequence-level background track)
  if (manifest.audio) {
    const a = manifest.audio;
    if (!a.src || typeof a.src !== 'string') {
      errors.push('audio.src is required and must be a string');
    }
    if (a.volume != null && (typeof a.volume !== 'number' || a.volume < 0 || a.volume > 1)) {
      errors.push('audio.volume must be between 0 and 1');
    }
    if (a.fade_in_ms != null && (typeof a.fade_in_ms !== 'number' || a.fade_in_ms < 0)) {
      errors.push('audio.fade_in_ms must be >= 0');
    }
    if (a.fade_out_ms != null && (typeof a.fade_out_ms !== 'number' || a.fade_out_ms < 0)) {
      errors.push('audio.fade_out_ms must be >= 0');
    }
    if (a.offset_s != null && (typeof a.offset_s !== 'number' || a.offset_s < 0)) {
      errors.push('audio.offset_s must be >= 0');
    }
  }

  // per-scene audio
  if (manifest.scenes && Array.isArray(manifest.scenes)) {
    for (let i = 0; i < manifest.scenes.length; i++) {
      const scene = manifest.scenes[i];
      if (scene.audio) {
        const sa = scene.audio;
        const prefix = `scenes[${i}].audio`;
        if (!sa.src || typeof sa.src !== 'string') {
          errors.push(`${prefix}.src is required and must be a string`);
        }
        if (sa.volume != null && (typeof sa.volume !== 'number' || sa.volume < 0 || sa.volume > 1)) {
          errors.push(`${prefix}.volume must be between 0 and 1`);
        }
        if (sa.fade_in_ms != null && (typeof sa.fade_in_ms !== 'number' || sa.fade_in_ms < 0)) {
          errors.push(`${prefix}.fade_in_ms must be >= 0`);
        }
        if (sa.fade_out_ms != null && (typeof sa.fade_out_ms !== 'number' || sa.fade_out_ms < 0)) {
          errors.push(`${prefix}.fade_out_ms must be >= 0`);
        }
        if (sa.offset_s != null && (typeof sa.offset_s !== 'number' || sa.offset_s < 0)) {
          errors.push(`${prefix}.offset_s must be >= 0`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Shot Grammar CSS ────────────────────────────────────────────────────────

export const SHOT_SIZE_CSS = {
  wide:              { scale: 1.0 },
  medium:            { scale: 1.08 },
  close_up:          { scale: 1.2 },
  extreme_close_up:  { scale: 1.4 },
};

export const ANGLE_CSS = {
  eye_level: { perspectiveOrigin: '50% 50%', rotateX: 0 },
  high:      { perspectiveOrigin: '50% 30%', rotateX: 3 },
  low:       { perspectiveOrigin: '50% 70%', rotateX: -2 },
  dutch:     { perspectiveOrigin: '50% 50%', rotateX: 0, rotateZ: 3 },
};

export const FRAMING_CSS = {
  center:               { transformOrigin: '50% 50%' },
  rule_of_thirds_left:  { transformOrigin: '33% 50%' },
  rule_of_thirds_right: { transformOrigin: '67% 50%' },
  dynamic_offset:       { transformOrigin: '30% 40%' },
};

/**
 * Resolve shot grammar axes to CSS-ready values.
 *
 * Pure lookup — no catalog file dependency.
 */
export function getShotGrammarCSS(grammar) {
  const size = SHOT_SIZE_CSS[grammar?.shot_size] ?? SHOT_SIZE_CSS.wide;
  const angle = ANGLE_CSS[grammar?.angle] ?? ANGLE_CSS.eye_level;
  const framing = FRAMING_CSS[grammar?.framing] ?? FRAMING_CSS.center;

  return {
    scale: size.scale,
    rotateX: angle.rotateX,
    rotateZ: angle.rotateZ ?? 0,
    transformOrigin: framing.transformOrigin,
    perspectiveOrigin: angle.perspectiveOrigin,
  };
}
