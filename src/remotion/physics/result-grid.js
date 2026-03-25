/**
 * Result Grid — Row Fill physics.
 * Cards fill a grid row by row with staggered entrances
 * and an optional highlight pulse on a selected card.
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/result-grid
 */

import { clamp, easeOutCubic } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  columns: 3,
  gap: 16,
  card_height: 140,
  stagger_ms: 100,
  highlight_index: -1,
  highlight_delay_ms: 800,
  highlight_duration_ms: 600,
  card_radius: 12,
  card_width: 0,     // Computed from grid
  enter_offset_y: 16, // Pixels to slide up during entrance
  fade_duration_ms: 350,
  padding: 80,        // Viewport padding
};

// ── Grid layout computation ─────────────────────────────────────

/**
 * Compute the grid card position for a given index.
 * Grid is centered in a 1920x1080 viewport.
 *
 * @param {number} index - Card index
 * @param {number} total - Total card count
 * @param {Object} config
 * @returns {{ x: number, y: number, w: number }}
 */
function cardPosition(index, total, config) {
  const cols = config.columns;
  const rows = Math.ceil(total / cols);

  const availW = 1920 - config.padding * 2 - config.gap * (cols - 1);
  const cardW = availW / cols;

  const totalH = rows * config.card_height + (rows - 1) * config.gap;
  const startY = (1080 - totalH) / 2;

  const col = index % cols;
  const row = Math.floor(index / cols);

  return {
    x: config.padding + col * (cardW + config.gap),
    y: startY + row * (config.card_height + config.gap),
    w: cardW,
  };
}

// ── Computed card visual state ──────────────────────────────────

/**
 * Compute visual properties for a single card from simulation state.
 *
 * @param {Object} card - Card state from simulation
 * @param {Object} simState - Full simulation state
 * @param {Object} config
 * @returns {{ x: number, y: number, w: number, opacity: number, offsetY: number, highlightGlow: number }}
 */
export function computeCardVisuals(card, _simState, _config = DEFAULTS) {
  return {
    x: card.x,
    y: card.y,
    w: card.w,
    opacity: card.opacity,
    offsetY: card.offsetY,
    highlightGlow: card.highlightGlow,
    contentIndex: card.contentIndex,
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
    const cards = [];

    for (let i = 0; i < itemCount; i++) {
      const pos = cardPosition(i, itemCount, config);
      cards.push({
        id: i,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        opacity: 0,
        offsetY: config.enter_offset_y,
        highlightGlow: 0,
        contentIndex: i,
      });
    }

    return {
      cards,
      timelineMs: 0,
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

    const cards = state.cards.map((card) => {
      const c = { ...card };

      // Entrance animation
      const enterStart = card.id * config.stagger_ms;
      const enterEnd = enterStart + config.fade_duration_ms;

      if (timelineMs < enterStart) {
        c.opacity = 0;
        c.offsetY = config.enter_offset_y;
      } else if (timelineMs >= enterEnd) {
        c.opacity = 1;
        c.offsetY = 0;
      } else {
        const progress = clamp((timelineMs - enterStart) / config.fade_duration_ms, 0, 1);
        const eased = easeOutCubic(progress);
        c.opacity = eased;
        c.offsetY = config.enter_offset_y * (1 - eased);
      }

      // Highlight pulse
      if (config.highlight_index >= 0 && card.id === config.highlight_index) {
        const hlStart = config.highlight_delay_ms;
        const hlEnd = hlStart + config.highlight_duration_ms;

        if (timelineMs >= hlStart && timelineMs < hlEnd) {
          const hlProgress = clamp((timelineMs - hlStart) / config.highlight_duration_ms, 0, 1);
          // Pulse: rise then fall
          c.highlightGlow = Math.sin(hlProgress * Math.PI);
        } else if (timelineMs >= hlEnd) {
          c.highlightGlow = 0;
        }
      }

      return c;
    });

    return {
      cards,
      timelineMs,
    };
  };
}
