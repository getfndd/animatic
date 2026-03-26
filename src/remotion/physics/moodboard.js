/**
 * Moodboard — Staggered Grid physics.
 * Grid of images/colors with staggered fade-in, soft shadows,
 * and slight rotation randomness (deterministic).
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/moodboard
 */

import { clamp, easeOutCubic } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  columns: 3,
  rows: 3,
  gap: 12,
  rotation_range: 3,
  stagger_ms: 120,
  cell_width: 0,   // Computed from grid
  cell_height: 0,  // Computed from grid
  cell_radius: 8,
  fade_duration_ms: 400,
};

// ── Deterministic rotation per cell ─────────────────────────────

/**
 * Compute a deterministic rotation for a cell based on its index.
 * Uses a simple hash-like distribution to avoid actual randomness.
 *
 * @param {number} index - Cell index
 * @param {number} range - Max rotation in degrees
 * @returns {number} Rotation in degrees
 */
function cellRotation(index, range) {
  // Deterministic pseudo-random using golden ratio fractional part
  const phi = (1 + Math.sqrt(5)) / 2;
  const frac = (index * phi) % 1;
  return (frac - 0.5) * 2 * range;
}

// ── Grid layout computation ─────────────────────────────────────

/**
 * Compute the grid cell position and size for a given index.
 * Grid is centered in a 1920x1080 viewport.
 *
 * @param {number} index - Cell index
 * @param {number} total - Total cell count
 * @param {Object} config
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function cellPosition(index, total, config) {
  const cols = config.columns;
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);

  const availW = 1920 - config.gap * (cols + 1);
  const availH = 1080 - config.gap * (rows + 1);
  const cellW = availW / cols;
  const cellH = availH / rows;

  const startX = config.gap + col * (cellW + config.gap);
  const startY = config.gap + row * (cellH + config.gap);

  return { x: startX, y: startY, w: cellW, h: cellH };
}

// ── Computed cell visual state ──────────────────────────────────

/**
 * Compute visual properties for a single cell from simulation state.
 *
 * @param {Object} cell - Cell state from simulation
 * @param {Object} simState - Full simulation state
 * @param {Object} config
 * @returns {{ x: number, y: number, w: number, h: number, opacity: number, scale: number, rotation: number }}
 */
export function computeCellVisuals(cell, _simState, _config = DEFAULTS) {
  return {
    x: cell.x,
    y: cell.y,
    w: cell.w,
    h: cell.h,
    opacity: cell.opacity,
    scale: cell.scale,
    rotation: cell.rotation,
  };
}

// ── Init / Step for usePhysicsEngine ────────────────────────────

/**
 * Create the init function for usePhysicsEngine.
 *
 * @param {number} cellCount - Number of content items
 * @param {Object} [config]
 * @returns {(fps: number) => Object}
 */
export function createInit(cellCount, config = DEFAULTS) {
  return (_fps) => {
    const total = Math.min(cellCount, config.columns * config.rows);
    const cells = [];

    for (let i = 0; i < total; i++) {
      const pos = cellPosition(i, total, config);
      cells.push({
        id: i,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        opacity: 0,
        scale: 0.95,
        rotation: cellRotation(i, config.rotation_range),
        contentIndex: i,
      });
    }

    return {
      cells,
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

    const cells = state.cells.map((cell) => {
      const c = { ...cell };
      const enterStart = cell.id * config.stagger_ms;
      const enterEnd = enterStart + config.fade_duration_ms;

      if (timelineMs < enterStart) {
        c.opacity = 0;
        c.scale = 0.95;
      } else if (timelineMs >= enterEnd) {
        c.opacity = 1;
        c.scale = 1;
      } else {
        const progress = clamp((timelineMs - enterStart) / config.fade_duration_ms, 0, 1);
        const eased = easeOutCubic(progress);
        c.opacity = eased;
        c.scale = 0.95 + 0.05 * eased;
      }

      return c;
    });

    return {
      cells,
      timelineMs,
    };
  };
}
