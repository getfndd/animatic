/**
 * Spotlight Cursor Reveal — Click-to-Illuminate physics.
 * Cursor moves along waypoints, clicks, spotlight expands.
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/spotlight-cursor-reveal
 */

import { clamp, easeInOutCubic, easeOutCubic, easeOutExpo } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  cursorPath: [
    { x: 200, y: 200, t: 0 },
    { x: 960, y: 540, t: 1 },
  ],
  spotlightRadius: 400,
  revealDelay: 150,
  glowColor: 'rgba(99,102,241,0.15)',
  cursorSize: 24,
  clickScale: 0.82,
  rippleMaxRadius: 32,
  rippleDuration: 300,
  // Phase boundaries (normalized 0-1)
  cursorEnd: 0.4,
  clickEnd: 0.55,
};

// ── Waypoint interpolation ──────────────────────────────────────

/**
 * Interpolate cursor position along waypoints.
 * Each waypoint has { x, y, t } where t is normalized 0-1.
 *
 * @param {Array} path - Array of { x, y, t } waypoints
 * @param {number} progress - 0 to 1 through the cursor phase
 * @returns {{ x: number, y: number }}
 */
function interpolatePath(path, progress) {
  if (!path || path.length === 0) return { x: 960, y: 540 };
  if (path.length === 1) return { x: path[0].x, y: path[0].y };

  // Find the segment
  const t = clamp(progress, 0, 1);
  let segStart = path[0];
  let segEnd = path[path.length - 1];

  for (let i = 0; i < path.length - 1; i++) {
    if (t >= path[i].t && t <= path[i + 1].t) {
      segStart = path[i];
      segEnd = path[i + 1];
      break;
    }
  }

  const segRange = segEnd.t - segStart.t;
  const segProgress = segRange > 0 ? (t - segStart.t) / segRange : 1;
  const eased = easeInOutCubic(segProgress);

  return {
    x: segStart.x + (segEnd.x - segStart.x) * eased,
    y: segStart.y + (segEnd.y - segStart.y) * eased,
  };
}

// ── Init / Step for usePhysicsEngine ────────────────────────────

/**
 * Create the init function for usePhysicsEngine.
 *
 * @param {Object} [config]
 * @returns {(fps: number) => Object}
 */
export function createInit(config = DEFAULTS) {
  const path = config.cursorPath || DEFAULTS.cursorPath;
  const startPos = path.length > 0 ? path[0] : { x: 960, y: 540 };

  return (_fps) => ({
    phase: 'cursor',         // 'cursor' | 'click' | 'reveal'
    timelineMs: 0,
    totalDurationMs: 3000,
    // Cursor state
    cursorX: startPos.x,
    cursorY: startPos.y,
    cursorScale: 1,
    cursorOpacity: 1,
    // Click state
    clickX: 0,
    clickY: 0,
    rippleScale: 0,
    rippleOpacity: 0,
    // Spotlight state
    spotlightRadius: 0,
    spotlightOpacity: 0,
    // Content reveal
    revealOpacity: 0,
  });
}

/**
 * Create the step function for usePhysicsEngine.
 * Pure: returns a new state object, never mutates input.
 *
 * @param {Object} [config]
 * @returns {(state: Object, dt: number, frameIndex: number) => Object}
 */
export function createStep(config = DEFAULTS) {
  const path = config.cursorPath || DEFAULTS.cursorPath;
  const lastWaypoint = path.length > 0 ? path[path.length - 1] : { x: 960, y: 540 };

  return (state, dt) => {
    const dtMs = dt * 1000;
    const timelineMs = state.timelineMs + dtMs;
    const totalMs = state.totalDurationMs;
    const progress = clamp(timelineMs / totalMs, 0, 1);

    let phase;
    if (progress < config.cursorEnd) {
      phase = 'cursor';
    } else if (progress < config.clickEnd) {
      phase = 'click';
    } else {
      phase = 'reveal';
    }

    let cursorX = state.cursorX;
    let cursorY = state.cursorY;
    let cursorScale = 1;
    let cursorOpacity = 1;
    let clickX = state.clickX;
    let clickY = state.clickY;
    let rippleScale = 0;
    let rippleOpacity = 0;
    let spotlightRadius = state.spotlightRadius;
    let spotlightOpacity = state.spotlightOpacity;
    let revealOpacity = state.revealOpacity;

    if (phase === 'cursor') {
      // Move cursor along waypoints
      const cursorProgress = clamp(progress / config.cursorEnd, 0, 1);
      const pos = interpolatePath(path, cursorProgress);
      cursorX = pos.x;
      cursorY = pos.y;
      cursorScale = 1;
      cursorOpacity = 1;
      // Fade in cursor at start
      if (cursorProgress < 0.1) {
        cursorOpacity = clamp(cursorProgress / 0.1, 0, 1);
      }
    } else if (phase === 'click') {
      // Click animation
      const clickProgress = clamp(
        (progress - config.cursorEnd) / (config.clickEnd - config.cursorEnd),
        0, 1
      );

      // Cursor stays at last waypoint
      cursorX = lastWaypoint.x;
      cursorY = lastWaypoint.y;
      clickX = lastWaypoint.x;
      clickY = lastWaypoint.y;

      // Scale pulse: squeeze down then back
      if (clickProgress < 0.4) {
        const squeezeP = clickProgress / 0.4;
        cursorScale = 1 - (1 - config.clickScale) * easeOutCubic(squeezeP);
      } else {
        const returnP = (clickProgress - 0.4) / 0.6;
        cursorScale = config.clickScale + (1 - config.clickScale) * easeOutCubic(returnP);
      }

      // Ripple ring
      const rippleProgress = clamp(clickProgress / 0.8, 0, 1);
      rippleScale = easeOutCubic(rippleProgress);
      rippleOpacity = 1 - rippleProgress;
    } else {
      // Reveal phase
      const revealProgress = clamp(
        (progress - config.clickEnd) / (1 - config.clickEnd),
        0, 1
      );

      // Cursor fades out
      cursorX = lastWaypoint.x;
      cursorY = lastWaypoint.y;
      cursorOpacity = clamp(1 - revealProgress * 3, 0, 1);
      clickX = lastWaypoint.x;
      clickY = lastWaypoint.y;

      // Spotlight expansion with delay
      const delayNorm = config.revealDelay / (totalMs * (1 - config.clickEnd));
      const spotlightProgress = clamp(
        (revealProgress - delayNorm) / (1 - delayNorm),
        0, 1
      );
      const easedSpotlight = easeOutExpo(spotlightProgress);

      spotlightRadius = config.spotlightRadius * easedSpotlight;
      spotlightOpacity = easedSpotlight;

      // Content fade-in after spotlight reaches ~30%
      const contentStart = 0.3;
      if (spotlightProgress > contentStart) {
        revealOpacity = easeOutCubic(
          clamp((spotlightProgress - contentStart) / (1 - contentStart), 0, 1)
        );
      }
    }

    return {
      phase,
      timelineMs,
      totalDurationMs: totalMs,
      cursorX,
      cursorY,
      cursorScale,
      cursorOpacity,
      clickX,
      clickY,
      rippleScale,
      rippleOpacity,
      spotlightRadius,
      spotlightOpacity,
      revealOpacity,
    };
  };
}
