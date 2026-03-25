/**
 * Stack Fan Settle — Playing Card Spread physics.
 * Cards start stacked, fan out with rotation, spring-settle to grid.
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/stack-fan-settle
 */

import { clamp, easeOutCubic, springStep } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  fanAngle: 35,
  spreadRadius: 320,
  settleDelay: 120,
  cardCount: 5,
  springStiffness: 280,
  springDamping: 22,
  gridColumns: 3,
  gridGap: 16,
  cardWidth: 280,
  cardHeight: 180,
  // Phase boundaries (normalized 0-1)
  fanEnd: 0.4,
};

// ── Grid target computation ─────────────────────────────────────

/**
 * Compute the final grid position for a card by index.
 * Grid is centered in a 1920x1080 viewport.
 *
 * @param {number} index - Card index
 * @param {number} total - Total card count
 * @param {Object} config
 * @returns {{ x: number, y: number }}
 */
function gridTarget(index, total, config) {
  const cols = Math.min(config.gridColumns, total);
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);

  const totalWidth = cols * config.cardWidth + (cols - 1) * config.gridGap;
  const totalHeight = rows * config.cardHeight + (rows - 1) * config.gridGap;
  const startX = (1920 - totalWidth) / 2;
  const startY = (1080 - totalHeight) / 2;

  return {
    x: startX + col * (config.cardWidth + config.gridGap) + config.cardWidth / 2,
    y: startY + row * (config.cardHeight + config.gridGap) + config.cardHeight / 2,
  };
}

// ── Fan position computation ────────────────────────────────────

/**
 * Compute the fan-out position for a card.
 * Cards spread in an arc from center.
 *
 * @param {number} index - Card index
 * @param {number} total - Total card count
 * @param {number} fanProgress - 0 to 1 through the fan phase
 * @param {Object} config
 * @returns {{ x: number, y: number, rotate: number }}
 */
function fanPosition(index, total, fanProgress, config) {
  const centerX = 1920 / 2;
  const centerY = 1080 / 2;

  // Distribute angle evenly across the fan range
  const angleStep = total > 1 ? config.fanAngle / (total - 1) : 0;
  const targetAngle = -config.fanAngle / 2 + index * angleStep;

  // Stagger: each card starts its fan slightly later
  const staggerOffset = index / total * 0.3;
  const cardProgress = clamp((fanProgress - staggerOffset) / (1 - staggerOffset), 0, 1);
  const easedProgress = easeOutCubic(cardProgress);

  const angle = targetAngle * easedProgress;
  const rad = (angle * Math.PI) / 180;
  const radius = config.spreadRadius * easedProgress;

  return {
    x: centerX + Math.sin(rad) * radius,
    y: centerY - Math.cos(rad) * radius * 0.3 + Math.abs(angle) * 0.8,
    rotate: angle,
  };
}

// ── Computed card visual state ──────────────────────────────────

/**
 * Compute visual properties for a single card from simulation state.
 *
 * @param {Object} card - Card state from simulation
 * @param {Object} simState - Full simulation state
 * @param {Object} config
 * @returns {{ x: number, y: number, rotate: number, scale: number, opacity: number }}
 */
export function computeCardVisuals(card, _simState, _config = DEFAULTS) {
  return {
    x: card.x,
    y: card.y,
    rotate: card.rotate,
    scale: card.scale,
    opacity: card.opacity,
  };
}

// ── Init / Step for usePhysicsEngine ────────────────────────────

/**
 * Create the init function for usePhysicsEngine.
 *
 * @param {number} cardCount - Number of cards
 * @param {Object} [config]
 * @returns {(fps: number) => Object}
 */
export function createInit(cardCount, config = DEFAULTS) {
  return (fps) => {
    const count = Math.min(cardCount, config.cardCount);
    const centerX = 1920 / 2;
    const centerY = 1080 / 2;

    const cards = [];
    for (let i = 0; i < count; i++) {
      const target = gridTarget(i, count, config);
      cards.push({
        id: i,
        // Current position
        x: centerX,
        y: centerY,
        rotate: 0,
        scale: 1,
        opacity: 0,
        // Spring velocities (for settle phase)
        vx: 0,
        vy: 0,
        vRotate: 0,
        // Targets
        targetX: target.x,
        targetY: target.y,
      });
    }

    return {
      cards,
      phase: 'fan',       // 'fan' | 'settle'
      timelineMs: 0,
      totalDurationMs: 2800,
      fps,
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
    const count = state.cards.length;

    const fanEnd = config.fanEnd;
    let phase = progress < fanEnd ? 'fan' : 'settle';

    const cards = state.cards.map((card, i) => {
      const c = { ...card };

      if (phase === 'fan') {
        // Fan phase: rotate cards outward from center stack
        const fanProgress = clamp(progress / fanEnd, 0, 1);
        const fan = fanPosition(i, count, fanProgress, config);
        c.x = fan.x;
        c.y = fan.y;
        c.rotate = fan.rotate;
        c.scale = 1;
        // Fade in during first 20% of fan
        c.opacity = clamp(fanProgress / 0.2, 0, 1);
      } else {
        // Settle phase: spring from current fan position to grid target
        const settleProgress = clamp((progress - fanEnd) / (1 - fanEnd), 0, 1);

        // Stagger: each card begins its spring settle with a delay
        const staggerNorm = (i * config.settleDelay) / (totalMs * (1 - fanEnd));
        const cardSettleProgress = clamp((settleProgress - staggerNorm) / (1 - staggerNorm), 0, 1);

        if (cardSettleProgress <= 0) {
          // Not yet started settling — hold at last fan position
          const fan = fanPosition(i, count, 1, config);
          c.x = fan.x;
          c.y = fan.y;
          c.rotate = fan.rotate;
        } else {
          // Spring toward target
          const xSpring = springStep(c.x, c.vx, c.targetX, config.springStiffness, config.springDamping, dt);
          const ySpring = springStep(c.y, c.vy, c.targetY, config.springStiffness, config.springDamping, dt);
          const rSpring = springStep(c.rotate, c.vRotate, 0, config.springStiffness, config.springDamping, dt);

          c.x = xSpring.position;
          c.vx = xSpring.velocity;
          c.y = ySpring.position;
          c.vy = ySpring.velocity;
          c.rotate = rSpring.position;
          c.vRotate = rSpring.velocity;
        }

        c.scale = 1;
        c.opacity = 1;
      }

      return c;
    });

    // Initialize spring velocities at fan→settle transition
    if (state.phase === 'fan' && phase === 'settle') {
      for (const card of cards) {
        card.vx = 0;
        card.vy = 0;
        card.vRotate = 0;
      }
    }

    return {
      cards,
      phase,
      timelineMs,
      totalDurationMs: totalMs,
      fps: state.fps,
    };
  };
}
