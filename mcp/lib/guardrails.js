/**
 * Guardrails Enforcement Engine (ANI-29)
 *
 * Validates camera moves and full sequence manifests against safety bounds
 * defined in catalog/camera-guardrails.json. Checks speed limits, acceleration
 * easing, jerk/settling on reversals, lens bounds, and personality boundaries.
 *
 * Complements validate_choreography (which checks primitives) by checking
 * camera moves and manifests — the dynamic motion layer.
 */

import { loadCameraGuardrails } from '../data/loader.js';
import { CAMERA_CONSTANTS, getShotGrammarCSS } from '../../src/remotion/lib.js';

const guardrails = loadCameraGuardrails();

/**
 * Static lookup for easing deceleration phase ratio.
 * linear = 0% decel (uniform velocity, no slowdown → fails minimum).
 * ease_out = 60% of duration spent decelerating.
 * cinematic_scurve = 50% of duration spent decelerating.
 */
export const EASING_DECEL_PHASE = {
  linear: 0.0,
  ease_out: 0.60,
  cinematic_scurve: 0.50,
};

/**
 * Validate a single camera move against guardrail bounds.
 *
 * @param {object|null} camera - { move, intensity, easing }
 * @param {object|null} shotGrammar - { shot_size, angle, framing }
 * @param {number} durationS - scene duration in seconds
 * @param {string} personality - personality slug
 * @returns {{ verdict: string, blocks: object[], warnings: object[], notes: object[] }}
 */
export function validateCameraMove(camera, shotGrammar, durationS, personality) {
  const blocks = [];
  const warnings = [];
  const notes = [];

  // No camera or static — only personality checks apply
  const hasCamera = camera && camera.move && camera.move !== 'static';
  const intensity = camera?.intensity ?? CAMERA_CONSTANTS.DEFAULT_INTENSITY;

  // ── Check 1: Speed limits ──────────────────────────────────────────────────

  if (hasCamera) {
    let velocity = 0;
    let property = '';
    let unit = 'px/s';

    switch (camera.move) {
      case 'pan_left':
      case 'pan_right': {
        const displacement = intensity * CAMERA_CONSTANTS.PAN_MAX_PX;
        velocity = displacement / durationS;
        property = 'translateX';
        break;
      }
      case 'push_in':
      case 'pull_out': {
        // Scale change as percentage per second
        const scaleChange = intensity * CAMERA_CONSTANTS.SCALE_FACTOR * 100;
        velocity = scaleChange / durationS;
        property = 'scale_ambient';
        unit = 'percent/s';
        break;
      }
      case 'drift': {
        // Peak velocity of sinusoidal motion: amplitude * 2π / period
        const amplitude = intensity * CAMERA_CONSTANTS.DRIFT_AMPLITUDE;
        velocity = amplitude * 2 * Math.PI / durationS;
        property = 'translateX';
        break;
      }
    }

    if (property) {
      const limit = guardrails.speed_limits[property];
      if (limit && velocity > limit.max_velocity) {
        warnings.push({
          check: 'speed_limit',
          message: `${camera.move} velocity ${velocity.toFixed(1)} ${unit} exceeds ${property} limit of ${limit.max_velocity} ${limit.unit}`,
          value: velocity,
          limit: limit.max_velocity,
        });
      }
    }
  }

  // ── Check 2: Acceleration — easing deceleration phase ──────────────────────

  if (hasCamera && camera.move !== 'drift') {
    const easing = camera.easing || 'cinematic_scurve';
    const decelPhase = EASING_DECEL_PHASE[easing] ?? 0.50;
    const minimum = guardrails.acceleration.deceleration_phase_minimum;

    if (decelPhase < minimum) {
      warnings.push({
        check: 'acceleration',
        message: `Easing "${easing}" has ${(decelPhase * 100).toFixed(0)}% deceleration phase, below minimum ${(minimum * 100).toFixed(0)}%`,
        value: decelPhase,
        limit: minimum,
      });
    }
  }

  // ── Check 3: Jerk / settling — drift reversal timing ───────────────────────

  if (hasCamera && camera.move === 'drift') {
    // Drift reverses direction every half-period
    const reversalIntervalMs = (durationS / 2) * 1000;
    const settlingMin = guardrails.jerk.settling_on_reversal_ms;

    if (reversalIntervalMs < settlingMin) {
      warnings.push({
        check: 'jerk',
        message: `Drift reversal interval ${reversalIntervalMs.toFixed(0)}ms is below settling minimum of ${settlingMin}ms`,
        value: reversalIntervalMs,
        limit: settlingMin,
      });
    }
  }

  // ── Check 4: Lens bounds — camera scale and rotation ───────────────────────

  if (hasCamera) {
    const scaleBounds = guardrails.lens_bounds.scale;
    const rotationBounds = guardrails.lens_bounds.rotation;

    // Camera-only scale delta (not combined with shot grammar)
    if (camera.move === 'push_in' || camera.move === 'pull_out') {
      const cameraScale = 1 + intensity * CAMERA_CONSTANTS.SCALE_FACTOR;
      if (cameraScale < scaleBounds.min || cameraScale > scaleBounds.max) {
        warnings.push({
          check: 'lens_bounds',
          message: `Camera scale factor ${cameraScale.toFixed(3)} exceeds lens bounds [${scaleBounds.min}, ${scaleBounds.max}]`,
          value: cameraScale,
          limit: { min: scaleBounds.min, max: scaleBounds.max },
        });
      }
    }

    // Shot grammar rotation check (independent of camera move)
    if (shotGrammar) {
      const sgCSS = getShotGrammarCSS(shotGrammar);
      if (sgCSS.rotateX !== 0) {
        if (sgCSS.rotateX < rotationBounds.min || sgCSS.rotateX > rotationBounds.max) {
          warnings.push({
            check: 'lens_bounds',
            message: `Shot grammar rotateX ${sgCSS.rotateX}deg exceeds rotation bounds [${rotationBounds.min}, ${rotationBounds.max}]deg`,
            value: sgCSS.rotateX,
            limit: { min: rotationBounds.min, max: rotationBounds.max },
          });
        }
      }
      if (sgCSS.rotateZ !== 0) {
        if (sgCSS.rotateZ < rotationBounds.min || sgCSS.rotateZ > rotationBounds.max) {
          warnings.push({
            check: 'lens_bounds',
            message: `Shot grammar rotateZ ${sgCSS.rotateZ}deg exceeds rotation bounds [${rotationBounds.min}, ${rotationBounds.max}]deg`,
            value: sgCSS.rotateZ,
            limit: { min: rotationBounds.min, max: rotationBounds.max },
          });
        }
      }
    }
  }

  // ── Check 5: Personality boundaries ────────────────────────────────────────

  const boundaries = guardrails.personality_boundaries[personality];
  if (boundaries) {
    const forbiddenFeatures = boundaries.forbidden_features || [];

    // Forbidden: camera_movement
    if (hasCamera && forbiddenFeatures.includes('camera_movement')) {
      blocks.push({
        check: 'personality',
        message: `Camera movement "${camera.move}" is forbidden in ${personality}`,
        feature: 'camera_movement',
      });
    }

    // Forbidden: 3d_transforms (shot grammar rotation counts)
    if (forbiddenFeatures.includes('3d_transforms') && shotGrammar) {
      const sgCSS = getShotGrammarCSS(shotGrammar);
      if (sgCSS.rotateX !== 0 || sgCSS.rotateZ !== 0) {
        blocks.push({
          check: 'personality',
          message: `3D transforms (rotation) forbidden in ${personality}`,
          feature: '3d_transforms',
        });
      }
    }

    // Forbidden: ambient_motion (drift is ambient)
    if (hasCamera && camera.move === 'drift' && forbiddenFeatures.includes('ambient_motion')) {
      blocks.push({
        check: 'personality',
        message: `Ambient motion (drift) is forbidden in ${personality}`,
        feature: 'ambient_motion',
      });
    }

    // Forbidden: camera_shake
    if (hasCamera && camera.move === 'shake' && forbiddenFeatures.includes('camera_shake')) {
      blocks.push({
        check: 'personality',
        message: `Camera shake is forbidden in ${personality}`,
        feature: 'camera_shake',
      });
    }

    // Translation limits
    if (hasCamera && boundaries.max_translateXY != null) {
      let maxDisplacement = 0;
      if (camera.move === 'pan_left' || camera.move === 'pan_right') {
        maxDisplacement = intensity * CAMERA_CONSTANTS.PAN_MAX_PX;
      } else if (camera.move === 'drift') {
        maxDisplacement = intensity * CAMERA_CONSTANTS.DRIFT_AMPLITUDE;
      }
      if (maxDisplacement > boundaries.max_translateXY) {
        warnings.push({
          check: 'personality',
          message: `Translation ${maxDisplacement.toFixed(1)}px exceeds ${personality} max of ${boundaries.max_translateXY}px`,
          value: maxDisplacement,
          limit: boundaries.max_translateXY,
        });
      }
    }

    // Scale limits
    if (hasCamera && boundaries.max_scale_change_percent != null) {
      if (camera.move === 'push_in' || camera.move === 'pull_out') {
        const scaleChangePercent = intensity * CAMERA_CONSTANTS.SCALE_FACTOR * 100;
        if (scaleChangePercent > boundaries.max_scale_change_percent) {
          warnings.push({
            check: 'personality',
            message: `Scale change ${scaleChangePercent.toFixed(1)}% exceeds ${personality} max of ${boundaries.max_scale_change_percent}%`,
            value: scaleChangePercent,
            limit: boundaries.max_scale_change_percent,
          });
        }
      }
    }

    // Ambient condition checks
    if (hasCamera && camera.move === 'drift') {
      if (boundaries.ambient_condition === 'never — scenes too short (2-4s)') {
        blocks.push({
          check: 'personality',
          message: `Ambient motion (drift) is never allowed in ${personality}`,
          feature: 'ambient_condition',
        });
      } else if (boundaries.ambient_condition === 'only for scenes >10s' && durationS <= 10) {
        warnings.push({
          check: 'personality',
          message: `Drift ambient motion in ${personality} only allowed for scenes >10s (scene is ${durationS}s)`,
          value: durationS,
          limit: 10,
        });
      }
    }
  }

  const verdict = blocks.length > 0 ? 'BLOCK' : warnings.length > 0 ? 'WARN' : 'PASS';
  return { verdict, blocks, warnings, notes };
}

/**
 * Validate a single manifest scene entry.
 *
 * @param {object} sceneEntry - { scene, duration_s, camera_override, shot_grammar, transition_in }
 * @param {string} personality - personality slug
 * @param {number} sceneIndex - 0-based scene index in manifest
 * @returns {{ verdict: string, blocks: object[], warnings: object[], notes: object[], sceneIndex: number }}
 */
export function validateManifestScene(sceneEntry, personality, sceneIndex) {
  const camera = sceneEntry.camera_override || null;
  const shotGrammar = sceneEntry.shot_grammar || null;
  const durationS = sceneEntry.duration_s || 3;

  const result = validateCameraMove(camera, shotGrammar, durationS, personality);
  return { ...result, sceneIndex };
}

/**
 * Validate a full sequence manifest against guardrails.
 *
 * Runs per-scene validation and adds cumulative checks.
 *
 * @param {object} manifest - { scenes: [...], ... }
 * @param {string} personality - personality slug
 * @returns {{ verdict: string, sceneResults: object[], cumulativeFindings: object[] }}
 */
export function validateFullManifest(manifest, personality) {
  const scenes = manifest.scenes || [];
  const sceneResults = scenes.map((entry, i) => validateManifestScene(entry, personality, i));
  const cumulativeFindings = [];

  // Cumulative check: warn if >2 consecutive linear easings
  let consecutiveLinear = 0;
  for (let i = 0; i < scenes.length; i++) {
    const easing = scenes[i].camera_override?.easing;
    if (easing === 'linear') {
      consecutiveLinear++;
      if (consecutiveLinear > 2) {
        cumulativeFindings.push({
          check: 'consecutive_linear',
          severity: 'warning',
          message: `${consecutiveLinear} consecutive scenes with linear easing (scenes ${i - consecutiveLinear + 2}–${i + 1}) — consider varying easing`,
          sceneIndex: i,
        });
      }
    } else {
      consecutiveLinear = 0;
    }
  }

  // Determine overall verdict
  let verdict = 'PASS';
  for (const r of sceneResults) {
    if (r.verdict === 'BLOCK') {
      verdict = 'BLOCK';
      break;
    }
    if (r.verdict === 'WARN') {
      verdict = 'WARN';
    }
  }
  // Cumulative findings can only escalate to WARN (not BLOCK)
  if (verdict === 'PASS' && cumulativeFindings.length > 0) {
    verdict = 'WARN';
  }

  return { verdict, sceneResults, cumulativeFindings };
}
