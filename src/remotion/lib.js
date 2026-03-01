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

        const validTypes = ['html', 'video', 'image'];
        if (!validTypes.includes(layer.type)) {
          errors.push(`layer "${layer.id || '?'}".type "${layer.type}" is not valid`);
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
      }
    }
  }

  return { valid: errors.length === 0, errors };
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
