/**
 * usePhysicsEngine — Run a physics simulation deterministically
 * for Remotion's frame-addressed renderer.
 *
 * Pre-simulates all frames upfront using fixed dt = 1/fps.
 * Same frame always produces identical output.
 *
 * @module hooks/usePhysicsEngine
 */

import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useMemo } from 'react';

/**
 * @typedef {Object} PhysicsConfig
 * @property {(fps: number) => Object} init
 *   Pure function returning the initial state for the simulation.
 * @property {(state: Object, dt: number, frameIndex: number) => Object} step
 *   Pure function that advances state by one time step.
 *   MUST return a new object — never mutate the input state.
 * @property {number} [substeps=1]
 *   Number of physics substeps per frame for stability.
 * @property {((state: Object) => Object)|null} [snapshot=null]
 *   Optional function to create a minimal read-only view of state
 *   for the cache. If null, the step return value is cached directly.
 *   Use this when state is large and you only need a subset for rendering.
 */

/**
 * Hook that pre-simulates a physics engine and returns state at the current frame.
 *
 * @param {PhysicsConfig} config
 * @returns {Object} The simulation state at the current Remotion frame.
 *
 * @example
 * ```jsx
 * function MyScene() {
 *   const state = usePhysicsEngine({
 *     init: (fps) => ({ x: 0, v: 0 }),
 *     step: (s, dt) => {
 *       const v = s.v + (-100 * s.x - 10 * s.v) * dt;
 *       return { x: s.x + v * dt, v };
 *     },
 *   });
 *   return <div style={{ transform: `translateX(${state.x}px)` }} />;
 * }
 * ```
 */
export function usePhysicsEngine(config) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { init, step, substeps = 1, snapshot = null } = config;

  const cache = useMemo(() => {
    const dt = 1 / fps;
    const subDt = dt / substeps;
    let state = init(fps);
    const frames = new Array(durationInFrames + 1);

    frames[0] = snapshot ? snapshot(state) : state;

    for (let f = 1; f <= durationInFrames; f++) {
      for (let s = 0; s < substeps; s++) {
        state = step(state, subDt, f);
      }
      frames[f] = snapshot ? snapshot(state) : state;
    }

    return frames;
  }, [fps, durationInFrames, init, step, substeps, snapshot]);

  return cache[Math.min(frame, cache.length - 1)];
}
