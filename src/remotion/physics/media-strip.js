/**
 * Media Strip — Horizontal Scroll physics.
 * Horizontal scrolling filmstrip of images/video thumbnails
 * with optional pause-at support for editorial pacing.
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/media-strip
 */

import { clamp } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  item_width: 360,
  gap: 12,
  scroll_speed: 200,
  pause_at: [],
  pause_duration_ms: 400,
  item_height: 240,
  item_radius: 8,
  strip_y: 420,
  fade_in_ms: 300,
};

// ── Pause point computation ─────────────────────────────────────

/**
 * Compute the scroll offset that centers a given item index.
 *
 * @param {number} index - Item index to center
 * @param {number} total - Total items
 * @param {Object} config
 * @returns {number} Target scrollX to center this item
 */
function scrollOffsetForIndex(index, _total, config) {
  const itemStride = config.item_width + config.gap;
  const itemCenterX = index * itemStride + config.item_width / 2;
  return itemCenterX - 1920 / 2;
}

// ── Computed strip visual state ─────────────────────────────────

/**
 * Compute visual properties for the strip from simulation state.
 *
 * @param {Object} simState - Full simulation state
 * @param {Object} config
 * @returns {{ scrollX: number, opacity: number, items: { x: number, visible: boolean }[] }}
 */
export function computeStripVisuals(simState, config = DEFAULTS) {
  const items = [];
  const itemStride = config.item_width + config.gap;
  for (let i = 0; i < simState.itemCount; i++) {
    const x = i * itemStride - simState.scrollX;
    const itemRight = x + config.item_width;
    const visible = itemRight > -200 && x < 1920 + 200;
    items.push({ x, visible, contentIndex: i });
  }

  return {
    scrollX: simState.scrollX,
    opacity: simState.opacity,
    items,
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
    // Build sorted pause schedule
    const pausePoints = (config.pause_at || [])
      .filter((idx) => idx >= 0 && idx < itemCount)
      .sort((a, b) => a - b);

    return {
      scrollX: -100,  // Start slightly off-screen left for entrance
      opacity: 0,
      timelineMs: 0,
      itemCount,
      pausePoints,
      currentPauseIndex: 0,
      pauseElapsed: 0,
      isPaused: false,
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

    // Fade in
    const opacity = clamp(timelineMs / config.fade_in_ms, 0, 1);

    let scrollX = state.scrollX;
    let isPaused = state.isPaused;
    let pauseElapsed = state.pauseElapsed;
    let currentPauseIndex = state.currentPauseIndex;

    // Max scroll: stop when last item is centered
    const itemStride = config.item_width + config.gap;
    const maxScroll = (state.itemCount - 1) * itemStride - 1920 / 2 + config.item_width / 2;

    if (isPaused) {
      // Currently pausing
      pauseElapsed += dtMs;
      if (pauseElapsed >= config.pause_duration_ms) {
        isPaused = false;
        pauseElapsed = 0;
        currentPauseIndex++;
      }
      // Ease to a stop during pause: slight deceleration feel
    } else {
      // Scroll forward
      scrollX += config.scroll_speed * dt;

      // Check if we've reached the next pause point
      if (currentPauseIndex < state.pausePoints.length) {
        const pauseTarget = scrollOffsetForIndex(
          state.pausePoints[currentPauseIndex],
          state.itemCount,
          config
        );
        if (scrollX >= pauseTarget) {
          scrollX = pauseTarget;
          isPaused = true;
          pauseElapsed = 0;
        }
      }
    }

    // Clamp scroll
    scrollX = clamp(scrollX, -100, Math.max(maxScroll, 0));

    return {
      scrollX,
      opacity,
      timelineMs,
      itemCount: state.itemCount,
      pausePoints: state.pausePoints,
      currentPauseIndex,
      pauseElapsed,
      isPaused,
    };
  };
}
