/**
 * Choreographer — Declarative timeline engine for browser prototypes.
 *
 * Replaces hardcoded CSS animation-delay values with a phase/timeline config.
 * Uses WAAPI (Web Animations API) for sequencing and the installed motion
 * package for spring physics when needed.
 *
 * DESIGN PRINCIPLES:
 * - CSS handles local primitives: blur, fade, scale, masks, caret, hover
 * - JS handles choreography: cue timing, orchestration, camera wrappers,
 *   content swaps, stateful interactions
 * - All timing is declarative — retiming is config, not code
 *
 * USAGE:
 *   import { Choreographer } from './choreographer.js';
 *
 *   const choreo = new Choreographer({
 *     phases: [
 *       { id: 'sc01', selector: '.sc01', start: 0, duration: 3600, ... },
 *       { id: 'sc02', selector: '.sc02', start: 2400, duration: 5400, ... },
 *     ],
 *     camera: { ... },
 *   });
 *
 *   choreo.play();
 */

// ── Phase Configuration ─────────────────────────────────────────────────────

/**
 * @typedef {object} PhaseConfig
 * @property {string} id - Unique phase identifier
 * @property {string} selector - CSS selector for the phase container
 * @property {number} start - Start time in ms
 * @property {number} duration - Phase duration in ms
 * @property {string} [transition_in] - Transition type: 'crossfade' | 'hard_cut' | 'whip_left' | etc.
 * @property {number} [transition_duration] - Transition overlap in ms
 * @property {CueConfig[]} [cues] - Sub-element animation cues within this phase
 * @property {CameraConfig} [camera] - Camera move for this phase
 * @property {Function} [onEnter] - Callback when phase becomes active
 * @property {Function} [onExit] - Callback when phase exits
 */

/**
 * @typedef {object} CueConfig
 * @property {string} selector - CSS selector (relative to phase container)
 * @property {number} delay - Delay from phase start in ms
 * @property {object[]} keyframes - WAAPI keyframes array
 * @property {object} [options] - WAAPI KeyframeEffectOptions (duration, easing, fill)
 */

/**
 * @typedef {object} CameraConfig
 * @property {string} move - Camera preset: 'push_in' | 'pull_out' | 'drift' | 'breathe' | 'static'
 * @property {number} [intensity] - 0-1 intensity
 * @property {number} [duration] - Override phase duration for camera
 */

// ── Camera Presets ──────────────────────────────────────────────────────────

const CAMERA_PRESETS = {
  static: () => [],
  push_in: (intensity = 0.5, duration) => [{
    transform: ['scale(1)', `scale(${1 + intensity * 0.06})`],
    easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
    duration,
    fill: 'forwards',
  }],
  pull_out: (intensity = 0.5, duration) => [{
    transform: [`scale(${1 + intensity * 0.06})`, 'scale(1)'],
    easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
    duration,
    fill: 'forwards',
  }],
  drift: (intensity = 0.5, duration) => [{
    transform: [
      'translate(0, 0)',
      `translate(${intensity * 4}px, ${intensity * 2}px)`,
      `translate(${-intensity * 3}px, ${intensity * 1.5}px)`,
      'translate(0, 0)',
    ],
    easing: 'ease-in-out',
    duration,
    fill: 'forwards',
  }],
  breathe: (intensity = 0.3, duration) => [{
    transform: [
      'scale(1)',
      `scale(${1 + intensity * 0.02})`,
      'scale(1)',
    ],
    easing: 'ease-in-out',
    duration,
    iterations: Math.ceil(duration / 4000),
  }],
  subtle: (intensity = 0.3, duration) => [{
    transform: ['scale(1) translateZ(0)', `scale(${1 + intensity * 0.03}) translateZ(${intensity * 10}px)`],
    easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
    duration,
    fill: 'forwards',
  }],
};

// ── Transition Presets ──────────────────────────────────────────────────────

const TRANSITION_IN = {
  hard_cut: (el, _duration) => el.animate(
    [{ opacity: 1 }],
    { duration: 0, fill: 'forwards' }
  ),
  crossfade: (el, duration) => el.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
  ),
  zoom_crossfade: (el, duration) => el.animate(
    [{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
  ),
  focus_dissolve: (el, duration) => el.animate(
    [{ opacity: 0, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0px)' }],
    { duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
  ),
};

const TRANSITION_OUT = {
  crossfade: (el, duration) => el.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
  ),
  zoom_crossfade: (el, duration) => el.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.94)' }],
    { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
  ),
  focus_dissolve: (el, duration) => el.animate(
    [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)' }],
    { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
  ),
};

// ── Choreographer ───────────────────────────────────────────────────────────

export class Choreographer {
  /**
   * @param {object} config
   * @param {PhaseConfig[]} config.phases - Ordered array of phase configurations
   * @param {number} [config.totalDuration] - Total sequence duration in ms (auto-calculated if omitted)
   * @param {boolean} [config.loop=false] - Loop the sequence
   * @param {Function} [config.onComplete] - Callback when sequence finishes
   */
  constructor(config) {
    this.phases = config.phases || [];
    this.loop = config.loop || false;
    this.onComplete = config.onComplete || null;
    this.totalDuration = config.totalDuration || this._calcTotalDuration();
    this._animations = [];
    this._timers = [];
    this._running = false;
    this._startTime = null;
  }

  _calcTotalDuration() {
    let max = 0;
    for (const phase of this.phases) {
      const end = phase.start + phase.duration;
      if (end > max) max = end;
    }
    return max;
  }

  /**
   * Start the choreography sequence.
   */
  play() {
    if (this._running) return;
    this._running = true;
    this._startTime = performance.now();

    // Hide all phase elements initially
    for (const phase of this.phases) {
      const el = document.querySelector(phase.selector);
      if (el) el.style.opacity = '0';
    }

    // Schedule each phase
    for (const phase of this.phases) {
      this._schedulePhase(phase);
    }

    // Schedule completion
    const completeTimer = setTimeout(() => {
      this._running = false;
      if (this.loop) {
        this.stop();
        this.play();
      } else if (this.onComplete) {
        this.onComplete();
      }
    }, this.totalDuration);
    this._timers.push(completeTimer);
  }

  /**
   * Stop all animations and clear timers.
   */
  stop() {
    this._running = false;
    for (const timer of this._timers) clearTimeout(timer);
    this._timers = [];
    for (const anim of this._animations) {
      try { anim.cancel(); } catch { /* already finished */ }
    }
    this._animations = [];
  }

  /**
   * Schedule a single phase's entrance, cues, camera, and exit.
   */
  _schedulePhase(phase) {
    const el = document.querySelector(phase.selector);
    if (!el) return;

    const transType = phase.transition_in || 'crossfade';
    const transDuration = phase.transition_duration || 500;

    // Phase entrance
    const enterTimer = setTimeout(() => {
      // Transition in
      const transIn = TRANSITION_IN[transType] || TRANSITION_IN.crossfade;
      const enterAnim = transIn(el, transDuration);
      this._animations.push(enterAnim);

      // Camera move
      if (phase.camera && phase.camera.move !== 'static') {
        this._applyCamera(el, phase.camera, phase.duration);
      }

      // Fire cues
      if (phase.cues) {
        for (const cue of phase.cues) {
          this._scheduleCue(el, cue);
        }
      }

      if (phase.onEnter) phase.onEnter(el);
    }, phase.start);
    this._timers.push(enterTimer);

    // Phase exit
    const exitTime = phase.start + phase.duration - transDuration;
    const exitTimer = setTimeout(() => {
      const transOut = TRANSITION_OUT[transType] || TRANSITION_OUT.crossfade;
      if (transOut) {
        const exitAnim = transOut(el, transDuration);
        this._animations.push(exitAnim);
      }
      if (phase.onExit) phase.onExit(el);
    }, exitTime);
    this._timers.push(exitTimer);
  }

  /**
   * Apply camera preset to phase element.
   */
  _applyCamera(el, camera, phaseDuration) {
    const preset = CAMERA_PRESETS[camera.move];
    if (!preset) return;

    const duration = camera.duration || phaseDuration;
    const configs = preset(camera.intensity, duration);

    for (const config of configs) {
      const { transform, ...options } = config;
      const anim = el.animate(
        transform.map(t => ({ transform: t })),
        options
      );
      this._animations.push(anim);
    }
  }

  /**
   * Schedule a sub-element cue within a phase.
   */
  _scheduleCue(phaseEl, cue) {
    const cueTimer = setTimeout(() => {
      const targets = phaseEl.querySelectorAll(cue.selector);
      for (const target of targets) {
        const anim = target.animate(cue.keyframes, {
          duration: 600,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards',
          ...cue.options,
        });
        this._animations.push(anim);
      }
    }, cue.delay);
    this._timers.push(cueTimer);
  }

  /**
   * Get current playback time in ms.
   */
  get currentTime() {
    if (!this._startTime) return 0;
    return performance.now() - this._startTime;
  }

  /**
   * Retiming helper: scale all phase timings by a factor.
   * Returns a new Choreographer instance with adjusted timing.
   */
  retime(factor) {
    const scaled = this.phases.map(p => ({
      ...p,
      start: p.start * factor,
      duration: p.duration * factor,
      transition_duration: p.transition_duration ? p.transition_duration * factor : undefined,
      cues: p.cues?.map(c => ({
        ...c,
        delay: c.delay * factor,
        options: c.options ? { ...c.options, duration: (c.options.duration || 600) * factor } : undefined,
      })),
    }));
    return new Choreographer({
      phases: scaled,
      loop: this.loop,
      onComplete: this.onComplete,
    });
  }
}

// ── Convenience: create from a simple scene list ────────────────────────────

/**
 * Build a Choreographer from a simplified scene list.
 *
 * @param {object[]} scenes - Array of { id, selector, duration, transition?, camera?, cues? }
 * @param {object} [defaults] - Default transition, camera, overlap
 * @returns {Choreographer}
 */
export function createFromScenes(scenes, defaults = {}) {
  const defaultTransition = defaults.transition || 'crossfade';
  const defaultOverlap = defaults.overlap || 600;

  let cursor = 0;
  const phases = scenes.map((scene, i) => {
    const overlap = i > 0 ? (scene.overlap ?? defaultOverlap) : 0;
    const start = Math.max(0, cursor - overlap);
    const duration = scene.duration;

    cursor = start + duration;

    return {
      id: scene.id,
      selector: scene.selector,
      start,
      duration,
      transition_in: scene.transition || (i > 0 ? defaultTransition : 'hard_cut'),
      transition_duration: scene.transition_duration || (i > 0 ? overlap : 0),
      camera: scene.camera || null,
      cues: scene.cues || [],
      onEnter: scene.onEnter,
      onExit: scene.onExit,
    };
  });

  return new Choreographer({
    phases,
    loop: defaults.loop || false,
    onComplete: defaults.onComplete,
  });
}

// ── Stagger helper ──────────────────────────────────────────────────────────

/**
 * Generate staggered cue configs for a set of elements.
 *
 * @param {string} selector - CSS selector matching multiple elements
 * @param {object[]} keyframes - WAAPI keyframes
 * @param {object} options - { interval, baseDelay, duration, easing }
 * @returns {CueConfig[]}
 */
export function stagger(selector, keyframes, options = {}) {
  const {
    interval = 120,
    baseDelay = 0,
    count = 10, // max expected count, pruned at runtime
    duration = 600,
    easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
  } = options;

  return Array.from({ length: count }, (_, i) => ({
    selector: `${selector}:nth-child(${i + 1})`,
    delay: baseDelay + i * interval,
    keyframes,
    options: { duration, easing, fill: 'forwards' },
  }));
}
