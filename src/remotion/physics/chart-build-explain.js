/**
 * Chart Build Explain — Bar Growth with Annotation physics.
 * Bars grow from zero, highlight bar pulses, annotation slides in.
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/chart-build-explain
 */

import { clamp, easeOutCubic, easeOutExpo, easeInOutCubic } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  barCount: 6,
  maxBarHeight: 320,
  highlightIndex: 3,
  annotationDelay: 200,
  barWidth: 56,
  barGap: 24,
  barRadius: 6,
  growStagger: 80,
  highlightScale: 1.06,
  dimOpacity: 0.4,
  // Phase boundaries (normalized 0-1)
  growEnd: 0.5,
  highlightEnd: 0.75,
};

// ── Init / Step for usePhysicsEngine ────────────────────────────

/**
 * Create the init function for usePhysicsEngine.
 *
 * @param {number} barCount - Number of bars
 * @param {Array} barValues - Array of normalized values (0-1)
 * @param {Object} [config]
 * @returns {(fps: number) => Object}
 */
export function createInit(barCount, barValues, config = DEFAULTS) {
  return (_fps) => {
    const count = barCount || config.barCount;
    const bars = [];
    for (let i = 0; i < count; i++) {
      bars.push({
        id: i,
        targetValue: barValues[i] !== undefined ? barValues[i] : (i + 1) / count,
        height: 0,
        opacity: 1,
        scale: 1,
        glowOpacity: 0,
      });
    }

    return {
      bars,
      phase: 'grow',        // 'grow' | 'highlight' | 'annotate'
      timelineMs: 0,
      totalDurationMs: 3200,
      annotationOpacity: 0,
      annotationX: 24,       // slide offset
      lineProgress: 0,       // connecting line draw progress 0-1
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

    let phase;
    if (progress < config.growEnd) {
      phase = 'grow';
    } else if (progress < config.highlightEnd) {
      phase = 'highlight';
    } else {
      phase = 'annotate';
    }

    const bars = state.bars.map((bar, i) => {
      const b = { ...bar };

      if (phase === 'grow') {
        // Grow phase: bars grow from 0 to target height with stagger
        const growProgress = clamp(progress / config.growEnd, 0, 1);
        const staggerOffset = (i * config.growStagger) / (totalMs * config.growEnd);
        const barProgress = clamp((growProgress - staggerOffset) / (1 - staggerOffset), 0, 1);
        const easedProgress = easeOutCubic(barProgress);

        b.height = b.targetValue * config.maxBarHeight * easedProgress;
        b.opacity = 1;
        b.scale = 1;
        b.glowOpacity = 0;
      } else if (phase === 'highlight') {
        // Highlight phase: target bar pulses, others dim
        const highlightProgress = clamp(
          (progress - config.growEnd) / (config.highlightEnd - config.growEnd),
          0, 1
        );

        b.height = b.targetValue * config.maxBarHeight;

        if (i === config.highlightIndex) {
          // Pulse: scale up then back
          const pulse = Math.sin(highlightProgress * Math.PI);
          b.scale = 1 + (config.highlightScale - 1) * pulse;
          b.opacity = 1;
          b.glowOpacity = pulse * 0.6;
        } else {
          // Dim non-highlighted bars
          const dimProgress = easeInOutCubic(highlightProgress);
          b.opacity = 1 - (1 - config.dimOpacity) * dimProgress;
          b.scale = 1;
          b.glowOpacity = 0;
        }
      } else {
        // Annotate phase: maintain highlight state
        b.height = b.targetValue * config.maxBarHeight;

        if (i === config.highlightIndex) {
          b.scale = 1;
          b.opacity = 1;
          b.glowOpacity = 0.3;
        } else {
          b.opacity = config.dimOpacity;
          b.scale = 1;
          b.glowOpacity = 0;
        }
      }

      return b;
    });

    // Annotation slide-in
    let annotationOpacity = state.annotationOpacity;
    let annotationX = state.annotationX;
    let lineProgress = state.lineProgress;

    if (phase === 'annotate') {
      const annotateProgress = clamp(
        (progress - config.highlightEnd) / (1 - config.highlightEnd),
        0, 1
      );
      // Account for delay
      const delayNorm = config.annotationDelay / (totalMs * (1 - config.highlightEnd));
      const slideProgress = clamp(
        (annotateProgress - delayNorm) / (1 - delayNorm),
        0, 1
      );
      const easedSlide = easeOutExpo(slideProgress);

      annotationOpacity = easedSlide;
      annotationX = 24 * (1 - easedSlide);
      lineProgress = easeOutCubic(clamp(annotateProgress / 0.5, 0, 1));
    }

    return {
      bars,
      phase,
      timelineMs,
      totalDurationMs: totalMs,
      annotationOpacity,
      annotationX,
      lineProgress,
    };
  };
}
