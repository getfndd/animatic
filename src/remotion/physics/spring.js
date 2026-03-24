/**
 * Shared physics primitives for personality engines and Remotion compositions.
 * All functions are pure — no side effects, no DOM, no randomness.
 *
 * @module physics/spring
 */

// ── Math utilities ──────────────────────────────────────────────

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

// ── Easing functions ────────────────────────────────────────────

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutBack(t, overshoot = 1.70158) {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// ── Damped spring ───────────────────────────────────────────────

/**
 * Step a damped spring forward by dt seconds.
 * Returns new { position, velocity }.
 *
 * @param {number} position   - Current position
 * @param {number} velocity   - Current velocity
 * @param {number} target     - Target position
 * @param {number} stiffness  - Spring stiffness (e.g., 300)
 * @param {number} damping    - Damping coefficient (e.g., 30)
 * @param {number} dt         - Time step in seconds
 * @returns {{ position: number, velocity: number }}
 */
export function springStep(position, velocity, target, stiffness, damping, dt) {
  const displacement = position - target;
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * velocity;
  const acceleration = springForce + dampingForce;

  const newVelocity = velocity + acceleration * dt;
  const newPosition = position + newVelocity * dt;

  return { position: newPosition, velocity: newVelocity };
}

/**
 * Check if a spring has settled (within epsilon of target, low velocity).
 */
export function springSettled(position, velocity, target, epsilon = 0.01) {
  return Math.abs(position - target) < epsilon && Math.abs(velocity) < epsilon;
}

// ── Exponential smoothing ───────────────────────────────────────

/**
 * Smooth a value toward a target using exponential interpolation.
 * Used for phase speed transitions, camera smoothing, etc.
 *
 * @param {number} current - Current value
 * @param {number} target  - Target value
 * @param {number} rate    - Blend rate (higher = faster, e.g., 10)
 * @param {number} dt      - Time step in seconds
 * @returns {number}
 */
export function smoothStep(current, target, rate, dt) {
  const blend = Math.min(dt * rate, 1);
  return current + (target - current) * blend;
}

// ── Pick-pop micro-interaction ──────────────────────────────────

/**
 * 3-phase scale animation: squeeze → overshoot → settle.
 * Extracted from card conveyor prototype.
 *
 * @param {number} progress - 0 to 1 through the pop animation
 * @returns {number} scale value
 */
export function pickPopScale(progress) {
  if (progress <= 0.16) {
    return mix(1, 0.968, easeOutCubic(progress / 0.16));
  }
  if (progress <= 0.58) {
    return mix(0.968, 1.072, easeOutBack((progress - 0.16) / 0.42));
  }
  return mix(1.072, 1, easeInOutCubic((progress - 0.58) / 0.42));
}

/**
 * 3-phase Y-offset animation paired with pickPopScale.
 *
 * @param {number} progress - 0 to 1 through the pop animation
 * @returns {number} Y offset in pixels
 */
export function pickPopOffsetY(progress) {
  if (progress <= 0.16) {
    return mix(0, 3, easeOutCubic(progress / 0.16));
  }
  if (progress <= 0.58) {
    return mix(3, -4, easeOutBack((progress - 0.16) / 0.42));
  }
  return mix(-4, 0, easeInOutCubic((progress - 0.58) / 0.42));
}
