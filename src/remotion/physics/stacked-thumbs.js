/**
 * Stacked Thumbs — Fan Reveal physics.
 * Overlapping thumbnails stacked at slight offsets, fanning out
 * to reveal all items with spring-driven rotation.
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/stacked-thumbs
 */

import { clamp, springStep } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  stack_offset_x: 8,
  stack_offset_y: 6,
  fan_angle: 12,
  max_visible: 6,
  thumb_width: 320,
  thumb_height: 220,
  fan_spread: 180,
  spring_stiffness: 260,
  spring_damping: 24,
  // Phase boundaries (normalized 0-1)
  stack_hold_end: 0.15,
  fan_end: 0.85,
};

// ── Fan target computation ──────────────────────────────────────

/**
 * Compute the fanned-out target position for a thumb.
 * Thumbs spread horizontally and rotate from center.
 *
 * @param {number} index - Thumb index
 * @param {number} total - Total thumb count
 * @param {Object} config
 * @returns {{ x: number, y: number, rotate: number }}
 */
function fanTarget(index, total, config) {
  const centerX = 1920 / 2;
  const centerY = 1080 / 2;

  const spreadStep = total > 1 ? config.fan_spread / (total - 1) : 0;
  const targetX = centerX - config.fan_spread / 2 + index * spreadStep;

  // Rotation: distribute across fan_angle range
  const angleStep = total > 1 ? (config.fan_angle * 2) / (total - 1) : 0;
  const targetRotate = -config.fan_angle + index * angleStep;

  return { x: targetX, y: centerY, rotate: targetRotate };
}

// ── Computed thumb visual state ─────────────────────────────────

/**
 * Compute visual properties for a single thumb from simulation state.
 *
 * @param {Object} thumb - Thumb state from simulation
 * @param {Object} simState - Full simulation state
 * @param {Object} config
 * @returns {{ x: number, y: number, rotate: number, scale: number, opacity: number }}
 */
export function computeThumbVisuals(thumb, _simState, _config = DEFAULTS) {
  return {
    x: thumb.x,
    y: thumb.y,
    rotate: thumb.rotate,
    scale: thumb.scale,
    opacity: thumb.opacity,
    contentIndex: thumb.contentIndex,
  };
}

// ── Init / Step for usePhysicsEngine ────────────────────────────

/**
 * Create the init function for usePhysicsEngine.
 *
 * @param {number} itemCount - Number of content items
 * @param {Object} [config]
 * @returns {(fps: number) => Object}
 */
export function createInit(itemCount, config = DEFAULTS) {
  return (_fps) => {
    const count = Math.min(itemCount, config.max_visible);
    const centerX = 1920 / 2;
    const centerY = 1080 / 2;

    const thumbs = [];
    for (let i = 0; i < count; i++) {
      const target = fanTarget(i, count, config);
      thumbs.push({
        id: i,
        // Start stacked at center with slight offsets
        x: centerX + i * config.stack_offset_x,
        y: centerY + i * config.stack_offset_y,
        rotate: 0,
        scale: 1,
        opacity: 1,
        // Spring velocities
        vx: 0,
        vy: 0,
        vRotate: 0,
        // Targets
        targetX: target.x,
        targetY: target.y,
        targetRotate: target.rotate,
        contentIndex: i,
      });
    }

    return {
      thumbs,
      phase: 'stacked',  // 'stacked' | 'fanning' | 'settled'
      timelineMs: 0,
      totalDurationMs: 2000,
    };
  };
}

/**
 * Create the step function for usePhysicsEngine.
 * Pure: returns a new state object, never mutates input.
 *
 * @param {Object} [config]
 * @returns {(state: Object, dt: number, frameIndex: number) => Object}
 */
export function createStep(config = DEFAULTS) {
  return (state, dt) => {
    const dtMs = dt * 1000;
    const timelineMs = state.timelineMs + dtMs;
    const totalMs = state.totalDurationMs;
    const progress = clamp(timelineMs / totalMs, 0, 1);
    const count = state.thumbs.length;

    let phase;
    if (progress < config.stack_hold_end) {
      phase = 'stacked';
    } else if (progress < config.fan_end) {
      phase = 'fanning';
    } else {
      phase = 'settled';
    }

    const centerX = 1920 / 2;
    const centerY = 1080 / 2;

    const thumbs = state.thumbs.map((thumb, i) => {
      const t = { ...thumb };

      if (phase === 'stacked') {
        // Hold in stack position with slight offsets
        t.x = centerX + i * config.stack_offset_x;
        t.y = centerY + i * config.stack_offset_y;
        t.rotate = 0;
        t.opacity = 1;
      } else if (phase === 'fanning') {
        // Fan out using spring physics
        const fanProgress = clamp(
          (progress - config.stack_hold_end) / (config.fan_end - config.stack_hold_end),
          0, 1
        );

        // Stagger: each thumb starts slightly later
        const staggerOffset = i / count * 0.3;
        const thumbProgress = clamp((fanProgress - staggerOffset) / (1 - staggerOffset), 0, 1);

        if (thumbProgress <= 0) {
          t.x = centerX + i * config.stack_offset_x;
          t.y = centerY + i * config.stack_offset_y;
          t.rotate = 0;
        } else {
          // Spring toward fan target
          const xSpring = springStep(t.x, t.vx, t.targetX, config.spring_stiffness, config.spring_damping, dt);
          const ySpring = springStep(t.y, t.vy, t.targetY, config.spring_stiffness, config.spring_damping, dt);
          const rSpring = springStep(t.rotate, t.vRotate, t.targetRotate, config.spring_stiffness, config.spring_damping, dt);

          t.x = xSpring.position;
          t.vx = xSpring.velocity;
          t.y = ySpring.position;
          t.vy = ySpring.velocity;
          t.rotate = rSpring.position;
          t.vRotate = rSpring.velocity;
        }

        t.opacity = 1;
      } else {
        // Settled — hold at fan targets (spring should have converged)
        const xSpring = springStep(t.x, t.vx, t.targetX, config.spring_stiffness, config.spring_damping, dt);
        const ySpring = springStep(t.y, t.vy, t.targetY, config.spring_stiffness, config.spring_damping, dt);
        const rSpring = springStep(t.rotate, t.vRotate, t.targetRotate, config.spring_stiffness, config.spring_damping, dt);

        t.x = xSpring.position;
        t.vx = xSpring.velocity;
        t.y = ySpring.position;
        t.vy = ySpring.velocity;
        t.rotate = rSpring.position;
        t.vRotate = rSpring.velocity;
        t.opacity = 1;
      }

      t.scale = 1;
      return t;
    });

    // Initialize spring velocities at stacked→fanning transition
    if (state.phase === 'stacked' && phase === 'fanning') {
      for (const thumb of thumbs) {
        thumb.vx = 0;
        thumb.vy = 0;
        thumb.vRotate = 0;
      }
    }

    return {
      thumbs,
      phase,
      timelineMs,
      totalDurationMs: totalMs,
    };
  };
}
