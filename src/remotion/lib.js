/**
 * Pure utility functions for the Remotion pipeline.
 *
 * Extracted from composition files so they can be tested
 * without React/Remotion runtime dependencies.
 */

/**
 * Get default transition duration for a type (in ms).
 */
export function getDefaultTransitionDuration(type) {
  switch (type) {
    case 'hard_cut': return 0;
    case 'crossfade': return 400;
    case 'whip_left':
    case 'whip_right':
    case 'whip_up':
    case 'whip_down':
      return 250;
    default:
      return 0;
  }
}

/**
 * Calculate total duration in frames from a sequence manifest.
 * Accounts for transition overlaps per the sequence manifest spec.
 */
export function calculateDuration(manifest) {
  const fps = manifest.fps || 60;
  const scenes = manifest.scenes || [];

  const totalSeconds = scenes.reduce((sum, entry) => sum + (entry.duration_s || 3), 0);
  const transitionOverlap = scenes.reduce((sum, entry) => {
    const t = entry.transition_in;
    if (t && t.type !== 'hard_cut' && t.duration_ms) {
      return sum + t.duration_ms / 1000;
    }
    return sum;
  }, 0);

  return Math.ceil((totalSeconds - transitionOverlap) * fps);
}

/**
 * Calculate frame layout for all scenes in a sequence.
 * Returns array of layout items with startFrame, durationFrames, and transition info.
 */
export function calculateLayout(scenes, fps) {
  const layout = [];
  let currentFrame = 0;

  for (let i = 0; i < scenes.length; i++) {
    const entry = scenes[i];
    const durationS = entry.duration_s || 3;
    const durationFrames = Math.round(durationS * fps);

    const nextEntry = scenes[i + 1];
    const nextTransition = nextEntry?.transition_in || { type: 'hard_cut' };
    const nextTransitionMs = nextTransition.duration_ms ?? getDefaultTransitionDuration(nextTransition.type);
    const nextTransitionFrames = Math.round((nextTransitionMs / 1000) * fps);

    layout.push({
      entry,
      index: i,
      startFrame: currentFrame,
      durationFrames,
      nextTransition: nextEntry ? nextTransition : { type: 'hard_cut' },
      nextTransitionFrames: nextEntry ? nextTransitionFrames : 0,
    });

    currentFrame += durationFrames - nextTransitionFrames;
  }

  return layout;
}

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

  // format_version
  if (scene.format_version != null && ![1, 2].includes(scene.format_version)) {
    errors.push(`format_version must be 1 or 2 (got ${scene.format_version})`);
  }

  return { valid: errors.length === 0, errors };
}

// ── Layout Templates ─────────────────────────────────────────────────────────

const VALID_TEMPLATES = ['hero-center', 'split-panel', 'masonry-grid', 'full-bleed', 'device-mockup'];

/**
 * Resolve layout template slots to pixel positions.
 *
 * @param {{ template: string, config?: object }} layout
 * @param {number} canvasW - canvas width in pixels
 * @param {number} canvasH - canvas height in pixels
 * @returns {{ [slotName: string]: { x: number, y: number, w: number, h: number } } | null}
 */
export function resolveLayoutSlots(layout, canvasW, canvasH) {
  if (!layout || !layout.template) return null;
  if (!VALID_TEMPLATES.includes(layout.template)) return null;

  const config = layout.config || {};

  switch (layout.template) {
    case 'hero-center':
      return resolveHeroCenterSlots(config, canvasW, canvasH);
    case 'split-panel':
      return resolveSplitPanelSlots(config, canvasW, canvasH);
    case 'masonry-grid':
      return resolveMasonryGridSlots(config, canvasW, canvasH);
    case 'full-bleed':
      return resolveFullBleedSlots(config, canvasW, canvasH);
    case 'device-mockup':
      return resolveDeviceMockupSlots(config, canvasW, canvasH);
    default:
      return null;
  }
}

/**
 * Get available slot names for a layout template.
 *
 * @param {string} template
 * @param {object} [config]
 * @returns {string[]}
 */
export function getAvailableSlots(template, config) {
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

// ── Internal resolvers ───────────────────────────────────────────────────────

function resolveHeroCenterSlots(config, W, H) {
  const padding = config.padding ?? 0.1;
  const maxWidth = config.maxWidth ?? 1;
  const maxHeight = config.maxHeight ?? 1;

  let cw = W * (1 - 2 * padding);
  let ch = H * (1 - 2 * padding);

  // Constrain by maxWidth/maxHeight (as fraction of canvas)
  if (maxWidth < 1) cw = Math.min(cw, W * maxWidth);
  if (maxHeight < 1) ch = Math.min(ch, H * maxHeight);

  const cx = Math.round((W - cw) / 2);
  const cy = Math.round((H - ch) / 2);

  return {
    background: { x: 0, y: 0, w: W, h: H },
    center: { x: cx, y: cy, w: Math.round(cw), h: Math.round(ch) },
  };
}

function resolveSplitPanelSlots(config, W, H) {
  const ratio = config.ratio ?? 0.5;
  const gap = config.gap ?? 0;

  const leftW = Math.round(W * ratio - gap / 2);
  const rightX = Math.round(W * ratio + gap / 2);
  const rightW = W - rightX;

  return {
    background: { x: 0, y: 0, w: W, h: H },
    left: { x: 0, y: 0, w: leftW, h: H },
    right: { x: rightX, y: 0, w: rightW, h: H },
  };
}

function resolveMasonryGridSlots(config, W, H) {
  const cols = config.columns ?? 3;
  const rows = config.rows ?? 2;
  const gap = config.gap ?? 10;

  const cellW = Math.round((W - (cols - 1) * gap) / cols);
  const cellH = Math.round((H - (rows - 1) * gap) / rows);

  const slots = {
    background: { x: 0, y: 0, w: W, h: H },
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = Math.round(c * (cellW + gap));
      const y = Math.round(r * (cellH + gap));
      // Clamp last column/row to prevent rounding overflow
      const w = (c === cols - 1) ? W - x : cellW;
      const h = (r === rows - 1) ? H - y : cellH;
      slots[`cell-${i}`] = { x, y, w, h };
    }
  }

  return slots;
}

const OVERLAY_POSITIONS = {
  'top-left':     (p, ow, oh, W, H) => ({ x: Math.round(W * p), y: Math.round(H * p) }),
  'top-center':   (p, ow, oh, W, H) => ({ x: Math.round((W - ow) / 2), y: Math.round(H * p) }),
  'top-right':    (p, ow, oh, W, H) => ({ x: Math.round(W - ow - W * p), y: Math.round(H * p) }),
  'center':       (p, ow, oh, W, H) => ({ x: Math.round((W - ow) / 2), y: Math.round((H - oh) / 2) }),
  'bottom-left':  (p, ow, oh, W, H) => ({ x: Math.round(W * p), y: Math.round(H - oh - H * p) }),
  'bottom-center':(p, ow, oh, W, H) => ({ x: Math.round((W - ow) / 2), y: Math.round(H - oh - H * p) }),
  'bottom-right': (p, ow, oh, W, H) => ({ x: Math.round(W - ow - W * p), y: Math.round(H - oh - H * p) }),
};

function resolveFullBleedSlots(config, W, H) {
  const overlayPos = config.overlayPosition ?? 'bottom-left';
  const overlayPad = config.overlayPadding ?? 0.05;
  const overlayW = Math.round(W * (config.overlayWidth ?? 0.45));
  const overlayH = Math.round(H * (config.overlayHeight ?? 0.3));

  const positionFn = OVERLAY_POSITIONS[overlayPos] || OVERLAY_POSITIONS['bottom-left'];
  const { x, y } = positionFn(overlayPad, overlayW, overlayH, W, H);

  return {
    media: { x: 0, y: 0, w: W, h: H },
    overlay: { x, y, w: overlayW, h: overlayH },
  };
}

function resolveDeviceMockupSlots(config, W, H) {
  const ratio = config.ratio ?? 0.55;
  const side = config.deviceSide ?? 'right';
  const pad = config.devicePadding ?? 0.05;

  const contentW = Math.round(W * ratio);
  const deviceW = W - contentW;

  const padX = Math.round(deviceW * pad);
  const padY = Math.round(H * pad);

  if (side === 'left') {
    return {
      background: { x: 0, y: 0, w: W, h: H },
      device: { x: padX, y: padY, w: deviceW - 2 * padX, h: H - 2 * padY },
      content: { x: deviceW, y: 0, w: contentW, h: H },
    };
  }

  // default: device on right
  return {
    background: { x: 0, y: 0, w: W, h: H },
    content: { x: 0, y: 0, w: contentW, h: H },
    device: { x: contentW + padX, y: padY, w: deviceW - 2 * padX, h: H - 2 * padY },
  };
}

// ── Camera Math ──────────────────────────────────────────────────────────────

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

/**
 * Clamp camera transform values to guardrail bounds.
 *
 * @param {{ scale?: number, rotateX?: number, rotateZ?: number, translateX?: number, translateY?: number }} values
 * @param {{ scaleMin?: number, scaleMax?: number, rotationMin?: number, rotationMax?: number, translateMax?: number }} bounds
 * @returns {{ scale: number, rotateX: number, rotateZ: number, translateX: number, translateY: number }}
 */
export function clampCameraValues(values, bounds) {
  const {
    scaleMin = 0.95,
    scaleMax = 1.05,
    rotationMin = -20,
    rotationMax = 20,
    translateMax = 400,
  } = bounds || {};

  return {
    scale: Math.min(scaleMax, Math.max(scaleMin, values.scale ?? 1)),
    rotateX: Math.min(rotationMax, Math.max(rotationMin, values.rotateX ?? 0)),
    rotateZ: Math.min(rotationMax, Math.max(rotationMin, values.rotateZ ?? 0)),
    translateX: Math.min(translateMax, Math.max(-translateMax, values.translateX ?? 0)),
    translateY: Math.min(translateMax, Math.max(-translateMax, values.translateY ?? 0)),
  };
}

/**
 * Parallax factor based on depth class.
 * Foreground moves 1:1, midground 0.6, background 0.3.
 */
export function getParallaxFactor(depthClass) {
  switch (depthClass) {
    case 'foreground':
      return 1.0;
    case 'midground':
      return 0.6;
    case 'background':
      return 0.3;
    default:
      return 0.6;
  }
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function findSegment(keyframes, progress) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return null;
  if (progress <= keyframes[0].at) return { from: keyframes[0], to: keyframes[0], localProgress: 0 };

  for (let i = 0; i < keyframes.length - 1; i++) {
    const from = keyframes[i];
    const to = keyframes[i + 1];
    if (progress <= to.at) {
      const span = Math.max(0.0001, to.at - from.at);
      return {
        from,
        to,
        localProgress: (progress - from.at) / span,
      };
    }
  }

  const last = keyframes[keyframes.length - 1];
  return { from: last, to: last, localProgress: 1 };
}

function interpolateKeyframeValue(from, to, key, progress, fallback = 0) {
  const start = from?.[key] ?? fallback;
  const end = to?.[key] ?? start;
  return lerp(start, end, progress);
}

function extractBackgroundFromHtml(html) {
  if (!html || typeof html !== 'string') return null;

  const styleMatch = html.match(/style\s*=\s*["']([^"']+)["']/i);
  if (!styleMatch) return null;

  const style = styleMatch[1];
  const backgroundMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
  return backgroundMatch ? backgroundMatch[1].trim() : null;
}

export function resolveSceneBackground(scene) {
  const explicitBackground =
    scene?.background?.fill ||
    scene?.background?.color ||
    scene?.background ||
    scene?.canvas?.background;

  if (typeof explicitBackground === 'string' && explicitBackground.trim()) {
    return explicitBackground.trim();
  }

  const backgroundLayer = (scene?.layers || []).find((layer) => {
    if (layer.depth_class !== 'background' || layer.type !== 'html') return false;
    if (layer.slot && layer.slot !== 'background') return false;
    return true;
  });

  return extractBackgroundFromHtml(backgroundLayer?.content) || '#0a0a0a';
}

export function resolveEntrancePrimitive(primitiveId) {
  return ENTRANCE_PRIMITIVES[primitiveId] || ENTRANCE_PRIMITIVES['as-fadeInUp'];
}

export function resolveEntranceAnimation(layer, frame, fps, options = {}) {
  const primitiveId = layer?.entrance?.primitive || 'as-fadeInUp';
  const primitive = resolveEntrancePrimitive(primitiveId);
  const delayMs = layer?.entrance?.delay_ms || 0;
  const delayFrames = Math.round((delayMs / 1000) * fps);
  const typewriterDurationMs = primitive.mode === 'typewriter'
    ? Math.max(280, (layer?.content?.length || 1) * primitive.durationMs)
    : primitive.durationMs;
  const durationMs = layer?.entrance?.duration_ms || typewriterDurationMs || 400;
  const durationFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const rawProgress = (frame - delayFrames) / durationFrames;
  const progress = Math.min(1, Math.max(0, rawProgress));
  const parallaxFactor = options.parallaxFactor ?? 1;

  if (primitive.mode === 'typewriter') {
    return {
      primitiveId,
      easing: primitive.easing,
      mode: primitive.mode,
      progress,
      durationFrames,
      delayFrames,
      opacity: layer?.opacity ?? 1,
      filter: 'none',
      transform: 'none',
    };
  }

  const segment = findSegment(primitive.keyframes, progress);
  const opacity = interpolateKeyframeValue(segment?.from, segment?.to, 'opacity', segment?.localProgress, 1)
    * (layer?.opacity ?? 1);
  const translateY = interpolateKeyframeValue(segment?.from, segment?.to, 'translateY', segment?.localProgress, 0)
    * parallaxFactor;
  const scale = interpolateKeyframeValue(segment?.from, segment?.to, 'scale', segment?.localProgress, 1);
  const blur = interpolateKeyframeValue(segment?.from, segment?.to, 'blur', segment?.localProgress, 0);

  const transformParts = [];
  if (translateY !== 0) transformParts.push(`translateY(${translateY}px)`);
  if (scale !== 1) transformParts.push(`scale(${scale})`);

  return {
    primitiveId,
    easing: primitive.easing,
    mode: 'style',
    progress,
    durationFrames,
    delayFrames,
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : 'none',
    transform: transformParts.length > 0 ? transformParts.join(' ') : 'none',
  };
}

export function resolveCameraConstants(camera) {
  return {
    ...CAMERA_CONSTANTS,
    ...(camera?.tuning || {}),
  };
}

export function getCameraMotionValues(camera, progress, easingFn, clampBounds) {
  if (!camera || camera.move === 'static') {
    return { scale: 1, translateX: 0, translateY: 0 };
  }

  const intensity = camera.intensity ?? CAMERA_CONSTANTS.DEFAULT_INTENSITY;
  const constants = resolveCameraConstants(camera);
  const eased = easingFn ? easingFn(progress) : progress;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  switch (camera.move) {
    case 'push_in':
      scale = 1 + eased * intensity * constants.SCALE_FACTOR;
      break;
    case 'pull_out':
      scale = (1 + intensity * constants.SCALE_FACTOR) - eased * intensity * constants.SCALE_FACTOR;
      break;
    case 'pan_left':
      translateX = -eased * intensity * constants.PAN_MAX_PX;
      break;
    case 'pan_right':
      translateX = eased * intensity * constants.PAN_MAX_PX;
      break;
    case 'drift': {
      const amplitude = intensity * constants.DRIFT_AMPLITUDE;
      translateX = Math.sin(progress * Math.PI * 2) * amplitude;
      translateY = Math.cos(progress * Math.PI * 1.5) * amplitude * constants.DRIFT_Y_RATIO;
      break;
    }
  }

  if (!clampBounds) {
    return { scale, translateX, translateY };
  }

  return clampCameraValues({ scale, translateX, translateY }, clampBounds);
}

/**
 * Compute camera transform CSS values for a given move, progress, and easing.
 *
 * Pure function — easing function is passed in so this stays free of
 * Remotion Easing dependency.
 *
 * @param {object|null} camera  - { move, intensity, easing }
 * @param {number} progress     - 0..1 linear progress through the scene
 * @param {function} easingFn   - (t: number) => number
 * @param {object} [clampBounds] - Optional guardrail bounds for clamping. When provided,
 *   camera values are clamped before composing the transform string.
 * @returns {{ transform: string }}
 */
export function getCameraTransformValues(camera, progress, easingFn, clampBounds) {
  if (!camera || camera.move === 'static') {
    return { transform: 'none' };
  }
  const { scale, translateX, translateY } = getCameraMotionValues(camera, progress, easingFn, clampBounds);
  const move = camera.move;

  // For known move types, always output the relevant transform property
  // (even at identity values) so CSS transitions interpolate correctly.
  switch (move) {
    case 'push_in':
    case 'pull_out':
      return { transform: `scale(${scale})` };
    case 'pan_left':
    case 'pan_right':
      return { transform: `translateX(${translateX}px)` };
    case 'drift':
      return { transform: `translate(${translateX}px, ${translateY}px)` };
    default:
      return { transform: 'none' };
  }
}

/**
 * Calculate overscan canvas dimensions for a camera move.
 *
 * The oversized canvas prevents content edges from revealing during
 * pan/scale moves. The outer clip div stays at viewport size with
 * overflow: hidden; the inner canvas is larger and offset to center.
 *
 * @param {number} viewportW - viewport width (e.g. 1920)
 * @param {number} viewportH - viewport height (e.g. 1080)
 * @param {object|null} camera - { move, intensity }
 * @returns {{ canvasW: number, canvasH: number, offsetX: number, offsetY: number }}
 */
export function calculateOverscanDimensions(viewportW, viewportH, camera) {
  if (!camera || camera.move === 'static') {
    return { canvasW: viewportW, canvasH: viewportH, offsetX: 0, offsetY: 0 };
  }

  const intensity = camera.intensity ?? CAMERA_CONSTANTS.DEFAULT_INTENSITY;
  const constants = resolveCameraConstants(camera);
  let overscanX = 0;
  let overscanY = 0;

  switch (camera.move) {
    case 'pan_left':
    case 'pan_right': {
      const maxDisplacement = intensity * constants.PAN_MAX_PX;
      overscanX = maxDisplacement / viewportW;
      overscanY = maxDisplacement / viewportH;
      break;
    }
    case 'push_in':
    case 'pull_out': {
      const scaleFactor = intensity * constants.SCALE_FACTOR;
      overscanX = scaleFactor;
      overscanY = scaleFactor;
      break;
    }
    case 'drift': {
      const driftPx = intensity * constants.DRIFT_AMPLITUDE;
      overscanX = driftPx / viewportW;
      overscanY = driftPx / viewportH;
      break;
    }
    default:
      break;
  }

  // Floor at MIN_OVERSCAN for any non-static move
  overscanX = Math.max(overscanX, CAMERA_CONSTANTS.MIN_OVERSCAN);
  overscanY = Math.max(overscanY, CAMERA_CONSTANTS.MIN_OVERSCAN);

  const canvasW = Math.ceil(viewportW * (1 + 2 * overscanX));
  const canvasH = Math.ceil(viewportH * (1 + 2 * overscanY));
  const offsetX = (canvasW - viewportW) / 2;
  const offsetY = (canvasH - viewportH) / 2;

  return { canvasW, canvasH, offsetX, offsetY };
}

// ── Shot Grammar CSS ─────────────────────────────────────────────────────────

const SHOT_SIZE_CSS = {
  wide:              { scale: 1.0 },
  medium:            { scale: 1.08 },
  close_up:          { scale: 1.2 },
  extreme_close_up:  { scale: 1.4 },
};

const ANGLE_CSS = {
  eye_level: { perspectiveOrigin: '50% 50%', rotateX: 0 },
  high:      { perspectiveOrigin: '50% 30%', rotateX: 3 },
  low:       { perspectiveOrigin: '50% 70%', rotateX: -2 },
  dutch:     { perspectiveOrigin: '50% 50%', rotateX: 0, rotateZ: 3 },
};

const FRAMING_CSS = {
  center:               { transformOrigin: '50% 50%' },
  rule_of_thirds_left:  { transformOrigin: '33% 50%' },
  rule_of_thirds_right: { transformOrigin: '67% 50%' },
  dynamic_offset:       { transformOrigin: '30% 40%' },
};

/**
 * Resolve shot grammar axes to CSS-ready values.
 *
 * Pure lookup — no catalog file dependency.
 *
 * @param {{ shot_size?: string, angle?: string, framing?: string }} grammar
 * @returns {{ scale: number, rotateX: number, rotateZ: number, transformOrigin: string, perspectiveOrigin: string }}
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

/**
 * Compose shot grammar (static framing) with camera move (dynamic motion).
 *
 * Shot grammar defines the baseline framing — scale, rotation, origin.
 * Camera moves layer on top — additional scale, translation.
 * They compose via multiplicative scale and additive translation.
 *
 * @param {object|null} sgCSS - Output of getShotGrammarCSS()
 * @param {object|null} camera - { move, intensity, easing }
 * @param {number} progress - 0..1 linear progress through the scene
 * @param {function} easingFn - (t: number) => number
 * @param {object} [clampBounds] - Optional guardrail bounds for clamping camera-only delta.
 *   When provided, camera contribution (scale, translate) is clamped before composing with SG.
 * @returns {{ transform: string, transformOrigin: string, perspectiveOrigin: string }}
 */
export function composeCameraTransform(sgCSS, camera, progress, easingFn, clampBounds) {
  let scale = sgCSS?.scale ?? 1;
  let rotateX = sgCSS?.rotateX ?? 0;
  let rotateZ = sgCSS?.rotateZ ?? 0;
  let translateX = 0;
  let translateY = 0;

  if (camera && camera.move !== 'static') {
    const { scale: cameraScale, translateX: cameraX, translateY: cameraY } = getCameraMotionValues(
      camera,
      progress,
      easingFn,
      clampBounds
    );
    translateX = cameraX;
    translateY = cameraY;
    scale *= cameraScale;
  }

  const parts = [];
  if (scale !== 1) parts.push(`scale(${scale})`);
  if (rotateX !== 0) parts.push(`rotateX(${rotateX}deg)`);
  if (rotateZ !== 0) parts.push(`rotateZ(${rotateZ}deg)`);
  if (translateX !== 0 || translateY !== 0) parts.push(`translate(${translateX}px, ${translateY}px)`);

  return {
    transform: parts.length > 0 ? parts.join(' ') : 'none',
    transformOrigin: sgCSS?.transformOrigin ?? 'center center',
    perspectiveOrigin: sgCSS?.perspectiveOrigin ?? '50% 50%',
  };
}

// ── Timeline Interpolation (Level 2 Motion Timeline) ─────────────────────────

/**
 * Named easing presets as cubic-bezier control points.
 * Used by the Level 2 timeline format.
 */
const EASING_PRESETS = {
  linear: null,
  ease_out: [0.25, 0.46, 0.45, 0.94],
  ease_in: [0.42, 0, 1, 1],
  ease_in_out: [0.42, 0, 0.58, 1],
  expo_out: [0.16, 1, 0.3, 1],
  expo_in: [0.7, 0, 0.84, 0],
  cinematic_scurve: [0.33, 0, 0.2, 1],
  spring: [0.22, 1, 0.36, 1],
};

/**
 * Parse a cubic-bezier string into [x1, y1, x2, y2].
 * Accepts "cubic-bezier(x1, y1, x2, y2)" format.
 * Returns null for linear or invalid strings.
 */
export function parseCubicBezier(str) {
  if (!str || str === 'linear') return null;
  const match = str.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (!match) return null;
  return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
}

/**
 * Evaluate a cubic bezier curve at parameter t using De Casteljau's algorithm.
 * Returns the y-value for a given x-progress (0..1).
 *
 * Uses Newton-Raphson iteration to solve for t given x, then evaluates y(t).
 */
export function evaluateCubicBezier(points, x) {
  if (!points) return x; // linear

  const [x1, y1, x2, y2] = points;

  // Newton-Raphson to find t for given x
  let t = x;
  for (let i = 0; i < 8; i++) {
    const currentX = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    t -= (currentX - x) / dx;
    t = Math.min(1, Math.max(0, t));
  }

  // Evaluate y at solved t
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

/**
 * Resolve an easing value to cubic-bezier control points.
 * Accepts named presets ("ease_out"), cubic-bezier strings, or null (linear).
 *
 * @param {string|null} easing
 * @returns {number[]|null} [x1, y1, x2, y2] or null for linear
 */
export function resolveEasing(easing) {
  if (!easing || easing === 'linear') return null;
  if (EASING_PRESETS[easing]) return EASING_PRESETS[easing];
  return parseCubicBezier(easing);
}

/**
 * Find the active segment in a frame-addressed keyframe track.
 *
 * Level 2 tracks use `{ frame, value, easing? }` instead of
 * the Level 1 `{ at (0..1), ... }` format used by findSegment().
 *
 * @param {Array<{ frame: number, value: number, easing?: string }>} track
 * @param {number} frame - current frame number
 * @returns {{ from: object, to: object, localProgress: number }|null}
 */
export function findTrackSegment(track, frame) {
  if (!Array.isArray(track) || track.length === 0) return null;
  if (frame <= track[0].frame) return { from: track[0], to: track[0], localProgress: 0 };

  for (let i = 0; i < track.length - 1; i++) {
    const from = track[i];
    const to = track[i + 1];
    if (frame <= to.frame) {
      const span = Math.max(1, to.frame - from.frame);
      return { from, to, localProgress: (frame - from.frame) / span };
    }
  }

  const last = track[track.length - 1];
  return { from: last, to: last, localProgress: 1 };
}

/**
 * Interpolate a single value from a frame-addressed keyframe track.
 *
 * This is the core interpolation function for Level 2 Motion Timelines.
 * Each keyframe has { frame, value, easing? }. Between keyframes,
 * values are interpolated with the segment's easing curve.
 *
 * @param {Array<{ frame: number, value: number, easing?: string }>} track
 * @param {number} frame - current frame number
 * @returns {number} interpolated value
 */
export function interpolateTrack(track, frame) {
  const segment = findTrackSegment(track, frame);
  if (!segment) return 0;

  const { from, to, localProgress } = segment;
  if (from === to || localProgress === 0) return typeof from.value === 'string' ? from.value : from.value;
  if (localProgress >= 1) return typeof to.value === 'string' ? to.value : to.value;

  // String values (like transform strings) — no interpolation, snap at midpoint
  if (typeof from.value === 'string' || typeof to.value === 'string') {
    return localProgress < 0.5 ? from.value : to.value;
  }

  // Apply easing from the destination keyframe
  const easingPoints = resolveEasing(to.easing);
  const easedProgress = evaluateCubicBezier(easingPoints, localProgress);

  return lerp(from.value, to.value, easedProgress);
}

/**
 * Interpolate all tracks for a layer at a given frame.
 *
 * Takes a layer's track map (property name → keyframe array)
 * and returns resolved values for all properties.
 *
 * @param {Object<string, Array>} tracks - { opacity: [...], translateX: [...], ... }
 * @param {number} frame
 * @returns {Object<string, number>} - { opacity: 0.5, translateX: 12, ... }
 */
export function interpolateAllTracks(tracks, frame) {
  if (!tracks) return {};
  const result = {};
  for (const [prop, track] of Object.entries(tracks)) {
    result[prop] = interpolateTrack(track, frame);
  }
  return result;
}

/**
 * Convert interpolated track values into CSS style properties.
 *
 * Maps the flat property namespace to CSS:
 *   opacity → opacity
 *   translateX, translateY → transform: translate(Xpx, Ypx)
 *   scale → transform: scale(v)
 *   rotate → transform: rotate(vdeg)
 *   filter_blur → filter: blur(vpx)
 *   filter_brightness → filter: brightness(v)
 *   filter_contrast → filter: contrast(v)
 *   filter_saturate → filter: saturate(v)
 *   clip_inset_top/right/bottom/left → clipPath: inset(t r b l)
 *
 * @param {Object<string, number>} values - output of interpolateAllTracks()
 * @returns {{ opacity: number, transform: string, filter: string, clipPath?: string }}
 */
export function trackValuesToCSS(values) {
  const style = {};

  // Opacity
  if (values.opacity != null) {
    style.opacity = values.opacity;
  }

  // Transform
  const transformParts = [];
  if (values.translateX != null || values.translateY != null) {
    transformParts.push(`translate(${values.translateX ?? 0}px, ${values.translateY ?? 0}px)`);
  }
  if (values.scale != null && values.scale !== 1) {
    transformParts.push(`scale(${values.scale})`);
  }
  if (values.rotate != null && values.rotate !== 0) {
    transformParts.push(`rotate(${values.rotate}deg)`);
  }
  style.transform = transformParts.length > 0 ? transformParts.join(' ') : 'none';

  // Filter
  const filterParts = [];
  if (values.filter_blur != null && values.filter_blur > 0) {
    filterParts.push(`blur(${values.filter_blur}px)`);
  }
  if (values.filter_brightness != null && values.filter_brightness !== 1) {
    filterParts.push(`brightness(${values.filter_brightness})`);
  }
  if (values.filter_contrast != null && values.filter_contrast !== 1) {
    filterParts.push(`contrast(${values.filter_contrast})`);
  }
  if (values.filter_saturate != null && values.filter_saturate !== 1) {
    filterParts.push(`saturate(${values.filter_saturate})`);
  }
  style.filter = filterParts.length > 0 ? filterParts.join(' ') : 'none';

  // Clip-path: circle, ellipse, polygon, or inset
  if (values.clip_circle != null) {
    const cx = values.clip_circle_cx ?? 50;
    const cy = values.clip_circle_cy ?? 50;
    style.clipPath = `circle(${values.clip_circle}% at ${cx}% ${cy}%)`;
  } else if (values.clip_ellipse != null) {
    const rx = values.clip_ellipse;
    const ry = values.clip_ellipse_ry ?? rx;
    const cx = values.clip_ellipse_cx ?? 50;
    const cy = values.clip_ellipse_cy ?? 50;
    style.clipPath = `ellipse(${rx}% ${ry}% at ${cx}% ${cy}%)`;
  } else if (values.clip_polygon != null) {
    style.clipPath = `polygon(${values.clip_polygon})`;
  } else {
    const hasClip = values.clip_inset_top != null || values.clip_inset_right != null ||
      values.clip_inset_bottom != null || values.clip_inset_left != null;
    if (hasClip) {
      const t = values.clip_inset_top ?? 0;
      const r = values.clip_inset_right ?? 0;
      const b = values.clip_inset_bottom ?? 0;
      const l = values.clip_inset_left ?? 0;
      style.clipPath = `inset(${t}% ${r}% ${b}% ${l}%)`;
    }
  }

  // SVG-specific properties — exposed as CSS custom properties
  // so inline SVG can reference them via var(--stroke-dashoffset) etc.
  const svgProps = {};
  if (values.stroke_dashoffset != null) svgProps['--stroke-dashoffset'] = values.stroke_dashoffset;
  if (values.stroke_dasharray != null) svgProps['--stroke-dasharray'] = values.stroke_dasharray;
  if (values.fill_opacity != null) svgProps['--fill-opacity'] = values.fill_opacity;
  if (values.stroke_opacity != null) svgProps['--stroke-opacity'] = values.stroke_opacity;
  if (values.path_length != null) svgProps['--path-length'] = values.path_length;
  if (Object.keys(svgProps).length > 0) {
    style.svgProperties = svgProps;
  }

  return style;
}

// ── Text Animation Math ─────────────────────────────────────────────────────

export const TEXT_ANIMATION_DEFAULTS = {
  WORD_REVEAL_STAGGER: 0.15,
  WORD_REVEAL_TRANSLATE_Y: 20,
  SCALE_CASCADE_SCALES: [3.0, 2.0, 1.0],
  SCALE_CASCADE_SPEEDS: [0.6, 1.0, 1.5],
  WEIGHT_MORPH_MIN: 300,
  WEIGHT_MORPH_MAX: 900,
  WEIGHT_MORPH_CHAR_STAGGER: 0.04,
};

/**
 * Compute word reveal state for a single word.
 *
 * Each word occupies a staggered window within 0..1 progress.
 * Windows overlap by WORD_REVEAL_STAGGER to create a cascade effect.
 *
 * @param {number} wordIndex   - 0-based index of the word
 * @param {number} totalWords  - total number of words
 * @param {number} progress    - 0..1 overall animation progress
 * @returns {{ opacity: number, translateY: number }}
 */
export function getWordRevealState(wordIndex, totalWords, progress) {
  if (totalWords <= 0) return { opacity: 0, translateY: TEXT_ANIMATION_DEFAULTS.WORD_REVEAL_TRANSLATE_Y };
  if (totalWords === 1) {
    const opacity = Math.min(1, Math.max(0, progress));
    const translateY = (1 - opacity) * TEXT_ANIMATION_DEFAULTS.WORD_REVEAL_TRANSLATE_Y;
    return { opacity, translateY };
  }

  const stagger = TEXT_ANIMATION_DEFAULTS.WORD_REVEAL_STAGGER;
  // Each word's window: starts at wordStart, ends at wordEnd
  // Total span divided across words with overlap
  const windowDuration = 1 / (totalWords - stagger * (totalWords - 1));
  const wordStart = wordIndex * windowDuration * (1 - stagger);
  const wordEnd = wordStart + windowDuration;

  const localProgress = Math.min(1, Math.max(0, (progress - wordStart) / (wordEnd - wordStart)));
  const opacity = Math.min(1, Math.max(0, localProgress));
  const translateY = (1 - localProgress) * TEXT_ANIMATION_DEFAULTS.WORD_REVEAL_TRANSLATE_Y;

  return { opacity, translateY };
}

/**
 * Compute scroll position and scale for a scale-cascade layer.
 *
 * Three text layers at different scales scroll vertically at different speeds.
 * Layers start below the viewport and scroll upward past the top.
 *
 * @param {number} layerIndex     - 0, 1, or 2
 * @param {number} progress       - 0..1 overall animation progress
 * @param {number} viewportHeight - viewport height in px
 * @returns {{ y: number, scale: number }}
 */
export function getScaleCascadePosition(layerIndex, progress, viewportHeight) {
  const scales = TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SCALES;
  const speeds = TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SPEEDS;

  const scale = scales[layerIndex] ?? 1.0;
  const speed = speeds[layerIndex] ?? 1.0;

  // Start below viewport, scroll to above viewport
  // At progress=0, y = viewportHeight (below). At progress=1, y moves upward.
  const totalTravel = viewportHeight * 2 * speed;
  const y = viewportHeight - progress * totalTravel;

  return { y, scale };
}

/**
 * Compute interpolated font-weight value.
 *
 * Linear interpolation between start and end weights, with optional
 * per-character stagger that creates a wave effect.
 *
 * @param {number} progress    - 0..1 overall animation progress
 * @param {number} startWeight - starting font-weight (e.g. 300)
 * @param {number} endWeight   - ending font-weight (e.g. 900)
 * @param {number} [charIndex] - 0-based character index (for stagger)
 * @param {number} [totalChars] - total characters (for stagger)
 * @returns {number} integer font-weight
 */
export function getWeightMorphValue(progress, startWeight, endWeight, charIndex, totalChars) {
  let adjustedProgress = progress;

  if (charIndex != null && totalChars != null && totalChars > 0) {
    const staggerOffset = charIndex * TEXT_ANIMATION_DEFAULTS.WEIGHT_MORPH_CHAR_STAGGER;
    adjustedProgress = progress - staggerOffset;
  }

  adjustedProgress = Math.min(1, Math.max(0, adjustedProgress));
  const weight = startWeight + adjustedProgress * (endWeight - startWeight);
  return Math.round(weight);
}
