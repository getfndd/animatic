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

        const validTypes = ['html', 'video', 'image', 'text'];
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
  SCALE_FACTOR: 0.08,
  PAN_MAX_PX: 80,
  DRIFT_AMPLITUDE: 3,
  DRIFT_Y_RATIO: 0.6,
  DEFAULT_INTENSITY: 0.5,
  MIN_OVERSCAN: 0.02,
};

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

/**
 * Compute camera transform CSS values for a given move, progress, and easing.
 *
 * Pure function — easing function is passed in so this stays free of
 * Remotion Easing dependency.
 *
 * @param {object|null} camera  - { move, intensity, easing }
 * @param {number} progress     - 0..1 linear progress through the scene
 * @param {function} easingFn   - (t: number) => number
 * @returns {{ transform: string }}
 */
export function getCameraTransformValues(camera, progress, easingFn) {
  if (!camera || camera.move === 'static') {
    return { transform: 'none' };
  }

  const intensity = camera.intensity ?? CAMERA_CONSTANTS.DEFAULT_INTENSITY;
  const eased = easingFn ? easingFn(progress) : progress;

  switch (camera.move) {
    case 'push_in': {
      const scale = 1 + eased * intensity * CAMERA_CONSTANTS.SCALE_FACTOR;
      return { transform: `scale(${scale})` };
    }
    case 'pull_out': {
      const startScale = 1 + intensity * CAMERA_CONSTANTS.SCALE_FACTOR;
      const scale = startScale - eased * intensity * CAMERA_CONSTANTS.SCALE_FACTOR;
      return { transform: `scale(${scale})` };
    }
    case 'pan_left': {
      const tx = -eased * intensity * CAMERA_CONSTANTS.PAN_MAX_PX;
      return { transform: `translateX(${tx}px)` };
    }
    case 'pan_right': {
      const tx = eased * intensity * CAMERA_CONSTANTS.PAN_MAX_PX;
      return { transform: `translateX(${tx}px)` };
    }
    case 'drift': {
      // Drift uses raw progress (not eased) — sinusoidal motion
      const amplitude = intensity * CAMERA_CONSTANTS.DRIFT_AMPLITUDE;
      const tx = Math.sin(progress * Math.PI * 2) * amplitude;
      const ty = Math.cos(progress * Math.PI * 1.5) * amplitude * CAMERA_CONSTANTS.DRIFT_Y_RATIO;
      return { transform: `translate(${tx}px, ${ty}px)` };
    }
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
  let overscanX = 0;
  let overscanY = 0;

  switch (camera.move) {
    case 'pan_left':
    case 'pan_right': {
      const maxDisplacement = intensity * CAMERA_CONSTANTS.PAN_MAX_PX;
      overscanX = maxDisplacement / viewportW;
      overscanY = maxDisplacement / viewportH;
      break;
    }
    case 'push_in':
    case 'pull_out': {
      const scaleFactor = intensity * CAMERA_CONSTANTS.SCALE_FACTOR;
      overscanX = scaleFactor;
      overscanY = scaleFactor;
      break;
    }
    case 'drift': {
      const driftPx = intensity * CAMERA_CONSTANTS.DRIFT_AMPLITUDE;
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
