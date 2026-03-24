/**
 * Card Conveyor — Z-Space Depth Rail physics.
 * Pure functions extracted from test-cascade.html prototype.
 *
 * All functions are pure and deterministic.
 * No DOM, no side effects, no randomness.
 *
 * @module physics/card-conveyor
 */

import { clamp, smoothStep, pickPopScale, pickPopOffsetY } from './spring.js';

// ── Default configuration ───────────────────────────────────────

export const DEFAULTS = {
  farZ: -1500,
  frontZ: 0,
  exitZ: 260,
  gap: 225,
  speed: 470,
  backY: -128,
  frontY: 14,
  steadyCardCount: 8,
  introStartCount: 1,
  introSpawnIntervalMs: 170,
  loopDurationMs: 520,
  selectRemainingCount: 3,
  holdPopDurationMs: 280,
  firstCardFadeMs: 420,
  smoothRate: 10,
  introPhaseSpeed: 1.58,
  loopPhaseSpeed: 1.24,
  outroPhaseSpeed: 1.9,
};

// ── World functions (Z → visual properties) ─────────────────────

export function worldYForZ(z, config = DEFAULTS) {
  const t = clamp(
    (z - config.farZ) / (config.frontZ - config.farZ),
    0,
    1
  );
  return config.backY + (config.frontY - config.backY) * Math.pow(t, 1.08);
}

export function opacityForZ(z, config = DEFAULTS) {
  if (z <= config.frontZ) return 1;
  if (z >= config.exitZ) return 0;
  return clamp(
    1 - (z - config.frontZ) / (config.exitZ - config.frontZ),
    0,
    1
  );
}

export function tiltForZ(z, config = DEFAULTS) {
  if (z <= config.frontZ) return 0;
  const t = clamp(
    (z - config.frontZ) / (config.exitZ - config.frontZ),
    0,
    1
  );
  return Math.pow(t, 1.15) * -18;
}

export function speedMultiplierForZ(z) {
  if (z <= -900) return 0.92;
  if (z <= -420) {
    return 0.92 + clamp((z + 900) / 480, 0, 1) * 0.26;
  }
  if (z <= -120) {
    return 1.18 + Math.pow(clamp((z + 420) / 300, 0, 1), 1.05) * 0.44;
  }
  if (z <= 0) {
    return 1.62 + Math.pow(clamp((z + 120) / 120, 0, 1), 1.35) * 0.7;
  }
  return 2.32 + Math.pow(clamp(z / 260, 0, 1), 1.2) * 0.34;
}

function phaseSpeedTarget(phase, config = DEFAULTS) {
  if (phase === 'intro') return config.introPhaseSpeed;
  if (phase === 'loop') return config.loopPhaseSpeed;
  if (phase === 'outro') return config.outroPhaseSpeed;
  return 0; // hold
}

// ── Computed card visual state ──────────────────────────────────

/**
 * Compute the visual properties of a card given the simulation state.
 * Returns everything a renderer needs to position the card.
 *
 * @param {Object} card - Card state { id, z, contentIndex, createdAtMs }
 * @param {Object} simState - Full simulation state
 * @param {Object} config
 * @returns {Object} { y, z, opacity, tilt, shellScale, shellY, isPicked, zIndex }
 */
export function computeCardVisuals(card, simState, config = DEFAULTS) {
  const { phase, timelineMs, holdStartedAt, targetCardId, cards } = simState;
  const z = card.z;
  const y = worldYForZ(z, config);
  let opacity = opacityForZ(z, config);
  let tilt = tiltForZ(z, config);
  let extraY = 0;
  let extraZ = 0;
  let shellScale = 1;
  let shellY = 0;
  let isPicked = false;

  // Hold phase: pick-pop on target, recession on others
  if (phase === 'hold' && cards.length <= config.selectRemainingCount) {
    const progress = clamp(
      (timelineMs - holdStartedAt) / config.holdPopDurationMs,
      0,
      1
    );

    const sorted = [...cards]
      .sort((a, b) => b.z - a.z)
      .map((c) => c.id);
    const rank = sorted.indexOf(card.id);

    if (card.id === targetCardId) {
      shellScale = pickPopScale(progress);
      shellY = pickPopOffsetY(progress);
      extraZ = 10 * progress;
      isPicked = true;
    } else {
      const depthStep = rank === 1 ? 1 : 2;
      extraY = (-18 - depthStep * 8) * progress;
      extraZ = (-90 - depthStep * 65) * progress;
      shellScale = 1 - (0.03 + depthStep * 0.015) * progress;
      shellY = (-2 - depthStep) * progress;
      opacity *= 1 - (0.38 + depthStep * 0.12) * progress;
    }
  }

  // First card intro fade
  if (card.id === 1 && phase === 'intro') {
    const age = timelineMs - card.createdAtMs;
    const introFade = 1 - Math.pow(1 - clamp(age / config.firstCardFadeMs, 0, 1), 3);
    opacity *= introFade;
  }

  return {
    y: y + extraY,
    z: z + extraZ,
    opacity,
    tilt,
    shellScale,
    shellY,
    isPicked,
    zIndex: isPicked ? 20000 : 10000 + Math.round(z),
    contentIndex: card.contentIndex,
    id: card.id,
  };
}

// ── Init / Step for usePhysicsEngine ────────────────────────────

/**
 * Create the init function for usePhysicsEngine.
 *
 * @param {number} contentCount - Number of content items available
 * @param {Object} [config]
 * @returns {(fps: number) => Object}
 */
export function createInit(contentCount, config = DEFAULTS) {
  return (_fps) => {
    const cards = [];
    let nextId = 1;
    let cursor = 0;

    for (let i = 0; i < config.introStartCount; i++) {
      cards.push({
        id: nextId++,
        z: config.farZ - i * config.gap,
        contentIndex: cursor % contentCount,
        createdAtMs: 0,
      });
      cursor++;
    }

    return {
      cards,
      phase: 'intro',
      timelineMs: 0,
      loopElapsed: 0,
      introSpawnElapsed: 0,
      targetCardId: null,
      nextId,
      holdStartedAt: 0,
      smoothedPhaseMultiplier: config.introPhaseSpeed,
      storyCursor: cursor,
      contentCount,
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
    // Shallow-copy mutable arrays/objects
    let {
      cards, phase, timelineMs, loopElapsed, introSpawnElapsed,
      targetCardId, nextId, holdStartedAt, smoothedPhaseMultiplier,
      storyCursor, contentCount,
    } = state;

    cards = cards.map((c) => ({ ...c }));
    const dtMs = dt * 1000;
    timelineMs += dtMs;

    // Smooth phase speed
    const target = phaseSpeedTarget(phase, config);
    smoothedPhaseMultiplier = smoothStep(
      smoothedPhaseMultiplier,
      target,
      config.smoothRate,
      dt
    );

    // Loop timer
    if (phase === 'loop') {
      loopElapsed += dtMs;
      if (loopElapsed >= config.loopDurationMs) {
        phase = 'outro';
        targetCardId = null;
      }
    }

    // Move cards forward (not during hold)
    if (phase !== 'hold') {
      for (const card of cards) {
        card.z += config.speed * smoothedPhaseMultiplier * speedMultiplierForZ(card.z) * dt;
      }
    }

    // Check for hold trigger
    if (phase === 'outro' && cards.length <= config.selectRemainingCount) {
      const front = cards.reduce(
        (best, c) => (!best || c.z > best.z ? c : best),
        null
      );
      if (front) {
        targetCardId = front.id;
        front.z = config.frontZ;
        phase = 'hold';
        holdStartedAt = timelineMs;
      }
    }

    // Handle exiting cards
    const exiting = cards.filter((c) => c.z > config.exitZ);
    for (const card of exiting) {
      if (phase === 'loop') {
        // Recycle to back
        const backZ = cards.length > 0
          ? Math.min(...cards.map((c) => c.z))
          : config.farZ;
        card.z = backZ - config.gap;
        card.contentIndex = storyCursor % contentCount;
        card.createdAtMs = timelineMs;
        storyCursor++;
      } else if (card.id === targetCardId) {
        card.z = config.frontZ;
      } else {
        cards = cards.filter((c) => c.id !== card.id);
      }
    }

    // Intro spawning
    if (phase === 'intro') {
      introSpawnElapsed += dtMs;
      while (
        introSpawnElapsed >= config.introSpawnIntervalMs &&
        cards.length < config.steadyCardCount
      ) {
        introSpawnElapsed -= config.introSpawnIntervalMs;
        cards.push({
          id: nextId++,
          z: config.farZ,
          contentIndex: storyCursor % contentCount,
          createdAtMs: timelineMs,
        });
        storyCursor++;
      }
      if (cards.length >= config.steadyCardCount) {
        phase = 'loop';
        loopElapsed = 0;
      }
    }

    return {
      cards,
      phase,
      timelineMs,
      loopElapsed,
      introSpawnElapsed,
      targetCardId,
      nextId,
      holdStartedAt,
      smoothedPhaseMultiplier,
      storyCursor,
      contentCount,
    };
  };
}
