/**
 * NeutralLightEngine — Reusable autoplay animation engine
 *
 * Drives the neutral-light personality: opacity crossfade transitions,
 * slide+fade staggers, spotlight highlights, cursor simulation,
 * step indicators, and positioned tooltips.
 *
 * Usage:
 *   const engine = new NeutralLightEngine({
 *     phases: [
 *       { id: 0, label: 'Welcome',  dwell: 3000 },
 *       { id: 1, label: 'Upload',   dwell: 3500 },
 *       { id: 2, label: 'Organize', dwell: 3500 },
 *       { id: 3, label: 'Complete', dwell: 3000 },
 *     ],
 *     titles: ['Set Up Your Data Room', 'Upload Documents', ...],
 *     subtitles: ['Get started in 4 steps.', ...],
 *     onPhaseEnter: {
 *       1: (engine) => {
 *         engine.runSpotlight('.action-area', 2000);
 *         engine.runCursorTo(320, 200, { click: true });
 *       },
 *       2: (engine) => engine.runSlideStagger('files', 150),
 *     },
 *     // Optional overrides
 *     selectors: { ... },
 *     loopPause: 1500,
 *   });
 *   engine.exposeGlobals();
 *   window.addEventListener('DOMContentLoaded', () => engine.boot());
 *
 * Reference: personalities/neutral-light/reference.html
 */
class NeutralLightEngine {

  /* ================================================================
     CONSTRUCTOR
     ================================================================ */
  constructor(config) {
    // Required
    this.phases = config.phases;
    this.titles = config.titles;
    this.subtitles = config.subtitles;

    // Optional callbacks
    this.phaseCallbacks = config.onPhaseEnter || {};

    // Optional overrides
    this.loopPause = config.loopPause ?? 1500;

    // DOM selectors (overridable for non-standard layouts)
    this.sel = Object.assign({
      scene: '#scene',
      card: '#card',
      cardHeader: '#card-header',
      titleBlock: '#title-block',
      phaseTitle: '#phase-title',
      phaseSubtitle: '#phase-subtitle',
      phaseContainer: '#phase-container',
      playbackBar: '#playback',
      playBtn: '#play-btn',
      iconPause: '#icon-pause',
      iconPlay: '#icon-play',
      phaseDots: '#phase-dots',
      phaseLabel: '#phase-label',
      spotlightOverlay: '#spotlight-overlay',
      tutorialCursor: '#tutorial-cursor',
    }, config.selectors || {});

    // State
    this.currentPhase = 0;
    this.playing = true;
    this.phaseTimer = null;
    this.phaseHeights = {};
    this._timers = [];

    // Embed mode
    this.isEmbed = new URLSearchParams(window.location.search).has('embed');
  }

  /* ================================================================
     HELPERS
     ================================================================ */
  /** @param {string} selector — CSS selector @returns {Element|null} */
  $(selector) {
    return document.querySelector(selector);
  }

  /** @param {string} selector — CSS selector @returns {NodeList} */
  $$(selector) {
    return document.querySelectorAll(selector);
  }

  /** @param {number} ms — milliseconds to wait @returns {Promise<void>} */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Schedule a callback with automatic cleanup on reset.
   * Always use this instead of raw setTimeout.
   * @param {Function} fn — callback to execute
   * @param {number} ms — delay in milliseconds
   * @returns {number} timer ID
   */
  pushTimer(fn, ms) {
    const id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  }

  /** Cancel all timers registered via pushTimer. */
  clearAllTimers() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers.length = 0;
  }

  /* ================================================================
     MEASURE PHASE HEIGHTS

     Temporarily shows each phase in static layout mode
     to measure its natural height. Required before any
     transitions so the container can animate height smoothly.
     ================================================================ */
  /** Pre-measure all phase heights for smooth height animation. Must run before first transition. */
  measurePhases() {
    const container = this.$(this.sel.phaseContainer);
    container.style.transition = 'none';

    this.phases.forEach(p => {
      const el = this.$('#phase-' + p.id);
      el.classList.remove('active');
      el.classList.add('measuring');

      // Show slide-enter items at full size for measurement
      el.querySelectorAll('.slide-enter').forEach(f => {
        f.style.opacity = '1';
        f.style.transform = 'none';
      });

      el.offsetHeight; // force layout
      this.phaseHeights[p.id] = el.scrollHeight + 8;

      // Reset
      el.querySelectorAll('.slide-enter').forEach(f => {
        f.style.opacity = '';
        f.style.transform = '';
      });

      el.classList.remove('measuring');
    });

    // Restore phase 0 as active
    this.$('#phase-0').classList.add('active');
    container.style.height = this.phaseHeights[0] + 'px';

    requestAnimationFrame(() => { container.style.transition = ''; });
  }

  /* ================================================================
     ANIMATION PRIMITIVES

     Tutorial-specific primitives (spotlight, cursorTo, tooltip,
     stepProgress) are also available as standalone functions in
     primitives/tutorial/tutorial-primitives.js for composition
     with other engines. The methods below are the engine-bound
     versions that delegate to the same logic.
     ================================================================ */

  /**
   * Slide+fade stagger — translateY(8px) entrance for a group of items.
   * Items are identified by data-slide-group="groupName".
   * @param {string} groupName — matches data-slide-group attribute
   * @param {number} interval — ms between each item (default 150)
   */
  runSlideStagger(groupName, interval) {
    interval = interval || 150;
    const items = this.$$('[data-slide-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, i * interval);
    });
  }

  /**
   * Spotlight — highlights a specific element with a dim overlay and blue border.
   * Uses the spotlight-overlay element with a cutout positioned over the target.
   * @param {string} selector — CSS selector for the element to spotlight
   * @param {number} duration — how long to keep spotlight active (ms)
   * @returns {Promise} — resolves when spotlight deactivates
   */
  runSpotlight(selector, duration) {
    duration = duration || 2000;
    const overlay = this.$(this.sel.spotlightOverlay);
    const target = this.$(selector);
    if (!overlay || !target) return Promise.resolve();

    // Position the cutout over the target
    const card = this.$(this.sel.card);
    const cardRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const cutout = overlay.querySelector('.spotlight-cutout');
    if (cutout) {
      cutout.style.top = (targetRect.top - cardRect.top - 4) + 'px';
      cutout.style.left = (targetRect.left - cardRect.left - 4) + 'px';
      cutout.style.width = (targetRect.width + 8) + 'px';
      cutout.style.height = (targetRect.height + 8) + 'px';
    }

    overlay.classList.add('active');

    return new Promise(resolve => {
      this.pushTimer(() => {
        overlay.classList.remove('active');
        resolve();
      }, duration);
    });
  }

  /**
   * Cursor simulation — moves an SVG cursor to target coordinates.
   * @param {number} x — target x position relative to card
   * @param {number} y — target y position relative to card
   * @param {Object} opts — optional settings
   * @param {boolean} opts.click — simulate a click pulse at destination
   * @param {number} opts.delay — ms before cursor starts moving (default 200)
   * @returns {Promise} — resolves after cursor arrives (and click if applicable)
   */
  runCursorTo(x, y, opts) {
    opts = opts || {};
    const cursor = this.$(this.sel.tutorialCursor);
    if (!cursor) return Promise.resolve();

    const startDelay = opts.delay ?? 200;

    return new Promise(resolve => {
      // Show cursor
      this.pushTimer(() => {
        cursor.classList.add('visible');
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';

        // Wait for movement to complete, then optionally click
        this.pushTimer(() => {
          if (opts.click) {
            cursor.classList.add('clicking');
            this.pushTimer(() => {
              cursor.classList.remove('clicking');
              resolve();
            }, 500);
          } else {
            resolve();
          }
        }, 600); // movement duration matches --nl-slow
      }, startDelay);
    });
  }

  /**
   * Tooltip — shows a positioned tooltip near an anchor element.
   * @param {string} anchorSelector — CSS selector for the element to annotate
   * @param {string} text — tooltip text to display
   * @param {string} position — 'below' or 'above' (default 'below')
   * @param {number} duration — how long to show (ms, default 2000)
   * @returns {Promise} — resolves when tooltip hides
   */
  runTooltip(anchorSelector, text, position, duration) {
    position = position || 'below';
    duration = duration || 2000;

    const tooltip = this.$('.tutorial-tooltip');
    const anchor = this.$(anchorSelector);
    if (!tooltip || !anchor) return Promise.resolve();

    const card = this.$(this.sel.card);
    const cardRect = card.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    // Position tooltip
    const tooltipText = tooltip.querySelector('.tutorial-tooltip-text');
    if (tooltipText) tooltipText.textContent = text;

    if (position === 'above') {
      tooltip.classList.add('above');
      tooltip.style.bottom = (cardRect.bottom - anchorRect.top + 10) + 'px';
      tooltip.style.top = 'auto';
    } else {
      tooltip.classList.remove('above');
      tooltip.style.top = (anchorRect.bottom - cardRect.top + 10) + 'px';
      tooltip.style.bottom = 'auto';
    }
    tooltip.style.left = (anchorRect.left - cardRect.left) + 'px';

    tooltip.classList.add('visible');

    return new Promise(resolve => {
      this.pushTimer(() => {
        tooltip.classList.remove('visible');
        resolve();
      }, duration);
    });
  }

  /**
   * Step progress — updates numbered step indicators.
   * Marks the specified step as done with a scale pop animation,
   * and fills the connector line to the next step.
   * @param {number} stepNumber — 0-indexed step to mark as done
   */
  runStepProgress(stepNumber) {
    const dots = this.$$('.step-indicator-dot');
    const labels = this.$$('.step-indicator-label');
    const connectors = this.$$('.step-indicator-connector');

    // Mark this step as done
    if (dots[stepNumber]) {
      dots[stepNumber].classList.remove('active');
      dots[stepNumber].classList.add('done', 'pop');
      // Remove pop class after animation
      this.pushTimer(() => {
        dots[stepNumber].classList.remove('pop');
      }, 450);
    }
    if (labels[stepNumber]) {
      labels[stepNumber].classList.remove('active');
      labels[stepNumber].classList.add('done');
    }

    // Fill connector after this step
    if (connectors[stepNumber]) {
      connectors[stepNumber].classList.add('connected');
    }

    // Mark next step as active (if exists)
    const next = stepNumber + 1;
    if (dots[next]) {
      dots[next].classList.add('active');
    }
    if (labels[next]) {
      labels[next].classList.add('active');
    }
  }

  /* ================================================================
     RESET ALL ANIMATIONS
     ================================================================ */
  /** Reset all animation state for clean loop replay. Clears timers, spotlight, cursor, tooltips, step indicators. */
  resetAllAnimations() {
    this.clearAllTimers();

    // Slide-enter items
    this.$$('.slide-enter').forEach(el => el.classList.remove('visible'));

    // Spotlight
    const overlay = this.$(this.sel.spotlightOverlay);
    if (overlay) overlay.classList.remove('active');

    // Cursor
    const cursor = this.$(this.sel.tutorialCursor);
    if (cursor) {
      cursor.classList.remove('visible', 'clicking');
    }

    // Tooltips
    this.$$('.tutorial-tooltip').forEach(el => el.classList.remove('visible'));

    // Step indicators
    this.$$('.step-indicator-dot').forEach((el, i) => {
      el.classList.remove('active', 'done', 'pop');
      if (i === 0) el.classList.add('active');
    });
    this.$$('.step-indicator-label').forEach((el, i) => {
      el.classList.remove('active', 'done');
      if (i === 0) el.classList.add('active');
    });
    this.$$('.step-indicator-connector').forEach(el => {
      el.classList.remove('connected');
    });

    // CTA glow
    this.$$('.btn').forEach(el => el.classList.remove('cta-glow'));

    // Title
    const tb = this.$(this.sel.titleBlock);
    if (tb) tb.classList.remove('hidden');
  }

  /* ================================================================
     PHASE TRANSITION ORCHESTRATOR

     Coordinates transitions at different speeds:
     1. SLOW — container height
     2. FAST — title fade out/in
     3. MEDIUM — opacity crossfade body content
     4. FAST — footer crossfade
     5. FAST — playback dot update
     6. — phase enter callback
     ================================================================ */
  /**
   * Orchestrate multi-speed transition to a target phase.
   * Coordinates container height, title fade, opacity crossfade,
   * footer crossfade, playback dots, and phase enter callbacks.
   * @param {number} targetPhase — phase index to transition to
   */
  transitionTo(targetPhase) {
    if (targetPhase === this.currentPhase) return;

    const container = this.$(this.sel.phaseContainer);
    const titleBlock = this.$(this.sel.titleBlock);
    const oldPhaseEl = this.$('#phase-' + this.currentPhase);
    const newPhaseEl = this.$('#phase-' + targetPhase);
    const oldFooter = this.$('#footer-' + this.currentPhase);
    const newFooter = this.$('#footer-' + targetPhase);

    // 1. SLOW: Container height
    container.style.height = this.phaseHeights[targetPhase] + 'px';

    // 2. FAST: Title fade out then in
    if (titleBlock) {
      titleBlock.classList.add('hidden');
      this.pushTimer(() => {
        const title = this.$(this.sel.phaseTitle);
        const subtitle = this.$(this.sel.phaseSubtitle);
        if (title) title.textContent = this.titles[targetPhase];
        if (subtitle) subtitle.textContent = this.subtitles[targetPhase];
        titleBlock.classList.remove('hidden');
      }, 300);
    }

    // 3. MEDIUM: Opacity crossfade body content
    oldPhaseEl.classList.remove('active');
    oldPhaseEl.classList.add('exiting');
    this.pushTimer(() => {
      newPhaseEl.classList.add('active');
      oldPhaseEl.classList.remove('exiting');
    }, 100);

    // 4. FAST: Footer crossfade
    if (oldFooter) oldFooter.classList.remove('active');
    if (newFooter) newFooter.classList.add('active');

    // 5. Update playback dots
    this.$$('.phase-dot').forEach(dot => {
      const p = parseInt(dot.dataset.phase);
      dot.classList.remove('active', 'completed');
      if (p === targetPhase) dot.classList.add('active');
      else if (p < targetPhase) dot.classList.add('completed');
    });
    const label = this.$(this.sel.phaseLabel);
    if (label) label.textContent = this.phases[targetPhase].label;

    this.currentPhase = targetPhase;

    // 6. Phase enter callback
    const callback = this.phaseCallbacks[targetPhase];
    if (callback) callback(this);
  }

  /* ================================================================
     PLAYBACK ENGINE
     ================================================================ */
  /** Schedule the next phase transition based on current phase's dwell time. */
  scheduleNext() {
    if (!this.playing) return;
    clearTimeout(this.phaseTimer);

    const dwell = this.phases[this.currentPhase].dwell;

    this.phaseTimer = setTimeout(() => {
      const next = this.currentPhase + 1;
      if (next < this.phases.length) {
        this.transitionTo(next);
        this.scheduleNext();
      } else {
        // Loop pause, then restart
        setTimeout(() => {
          if (this.playing) this.restart();
        }, this.loopPause);
      }
    }, dwell);
  }

  /** Toggle play/pause. Updates icon visibility and pauses or resumes scheduling. */
  togglePlay() {
    this.playing = !this.playing;
    const iconPause = this.$(this.sel.iconPause);
    const iconPlay = this.$(this.sel.iconPlay);
    if (iconPause) iconPause.style.display = this.playing ? '' : 'none';
    if (iconPlay) iconPlay.style.display = this.playing ? 'none' : '';
    if (this.playing) this.scheduleNext();
    else clearTimeout(this.phaseTimer);
  }

  /**
   * Jump directly to a specific phase. Resets all animations, transitions, and resumes scheduling.
   * @param {number} phase — target phase index
   */
  jumpTo(phase) {
    clearTimeout(this.phaseTimer);
    this.resetAllAnimations();
    this.transitionTo(phase);
    if (this.playing) this.scheduleNext();
  }

  /** Reset to phase 0 and restart playback from the beginning. */
  restart() {
    clearTimeout(this.phaseTimer);
    this.resetAllAnimations();
    if (this.currentPhase !== 0) this.transitionTo(0);
    if (this.playing) this.scheduleNext();
  }

  /* ================================================================
     EMBED MODE

     When ?embed is in the URL:
     - Hide playback controls
     - Transparent background
     - Full-width scene
     ================================================================ */
  /** Apply embed mode: hide controls, transparent background, full-width scene. Activated by ?embed URL param. */
  applyEmbedMode() {
    if (!this.isEmbed) return;
    const playback = this.$(this.sel.playbackBar);
    if (playback) playback.style.display = 'none';
    document.body.style.background = 'transparent';
    document.body.style.padding = '0';
    document.body.style.minHeight = 'auto';
    const scene = this.$(this.sel.scene);
    if (scene) {
      scene.style.maxWidth = '100%';
      scene.style.padding = '16px';
    }
  }

  /* ================================================================
     BOOT

     Call this after DOMContentLoaded. Applies embed mode,
     measures phases, and starts playback.
     ================================================================ */
  /** Initialize engine after DOMContentLoaded. Applies embed mode, measures phase heights, starts playback. */
  boot() {
    this.applyEmbedMode();
    // Small delay for fonts to load
    setTimeout(() => {
      this.measurePhases();
      setTimeout(() => this.scheduleNext(), 400);
    }, 150);
  }

  /* ================================================================
     EXPOSE GLOBAL API

     Wires up window-level functions so onclick handlers in
     HTML (onclick="togglePlay()") work without changes.
     ================================================================ */
  /** Wire window-level togglePlay(), jumpTo(), restart() for HTML onclick handlers. */
  exposeGlobals() {
    window.togglePlay = () => this.togglePlay();
    window.jumpTo = (phase) => this.jumpTo(phase);
    window.restart = () => this.restart();
  }
}

// Export for both module and script-tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeutralLightEngine;
}
