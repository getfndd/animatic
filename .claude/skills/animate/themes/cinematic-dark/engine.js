/**
 * CinematicDarkEngine — Reusable autoplay animation engine
 *
 * Drives the cinematic-dark theme: 3D camera motion, clip-path wipe
 * transitions, focus-pull staggers, typewriter reveals, self-drawing
 * SVG checkmarks, rAF-driven progress, and spring interactions.
 *
 * Usage:
 *   const engine = new CinematicDarkEngine({
 *     phases: [
 *       { id: 0, label: 'Source',      dwell: 2500 },
 *       { id: 1, label: 'Select',      dwell: 2500 },
 *       { id: 2, label: 'Processing',  dwell: 4500 },
 *       { id: 3, label: 'Suggestions', dwell: 4500 },
 *       { id: 4, label: 'Success',     dwell: 3500 },
 *     ],
 *     titles: ['Add Documents', 'Add Documents', 'Analyzing...', 'Review', 'Done'],
 *     subtitles: ['Subtitle 0', 'Subtitle 1', ...],
 *     interactions: {
 *       0: async () => { ... },  // drop zone spring
 *       1: async () => { ... },  // button press
 *     },
 *     onPhaseEnter: {
 *       1: (engine) => engine.runFocusStagger('select', 200),
 *       2: (engine) => engine.startProgressAnimation(),
 *       3: (engine) => { ... },
 *     },
 *     // Optional overrides
 *     selectors: { ... },
 *     loopPause: 1500,
 *     interactionLeadTime: 1550,
 *   });
 *   engine.boot();
 *
 * Reference: prototypes/2026-02-19-dataroom-upload-rename/autoplay-v4.html
 */
class CinematicDarkEngine {

  /* ================================================================
     CONSTRUCTOR
     ================================================================ */
  constructor(config) {
    // Required
    this.phases = config.phases;
    this.titles = config.titles;
    this.subtitles = config.subtitles;

    // Optional callbacks
    this.interactions = config.interactions || {};
    this.phaseCallbacks = config.onPhaseEnter || {};

    // Optional overrides
    this.loopPause = config.loopPause ?? 1500;
    this.interactionLeadTime = config.interactionLeadTime ?? 1550;

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
    }, config.selectors || {});

    // State
    this.currentPhase = 0;
    this.playing = true;
    this.phaseTimer = null;
    this.progressRAF = null;
    this.progressStartTime = 0;
    this.phaseHeights = {};
    this._timers = [];

    // Embed mode
    this.isEmbed = new URLSearchParams(window.location.search).has('embed');
  }

  /* ================================================================
     HELPERS
     ================================================================ */
  $(selector) {
    return document.querySelector(selector);
  }

  $$(selector) {
    return document.querySelectorAll(selector);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  pushTimer(fn, ms) {
    const id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  }

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
  measurePhases() {
    const container = this.$(this.sel.phaseContainer);
    container.style.transition = 'none';

    this.phases.forEach(p => {
      const el = this.$('#phase-' + p.id);
      el.classList.remove('active');
      el.classList.add('measuring');

      // Show focus-enter items at full size for measurement
      el.querySelectorAll('.focus-enter').forEach(f => {
        f.style.opacity = '1';
        f.style.filter = 'none';
        f.style.transform = 'none';
      });

      // Show folder badges
      el.querySelectorAll('.suggest-folder').forEach(f => {
        f.style.opacity = '1';
      });

      el.offsetHeight; // force layout
      this.phaseHeights[p.id] = el.scrollHeight + 8;

      // Reset
      el.querySelectorAll('.focus-enter').forEach(f => {
        f.style.opacity = '';
        f.style.filter = '';
        f.style.transform = '';
      });
      el.querySelectorAll('.suggest-folder').forEach(f => {
        f.style.opacity = '';
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
     ================================================================ */

  /**
   * Focus-pull stagger — blur-to-sharp entrance for a group of items.
   * Items are identified by data-focus-group="groupName".
   * @param {string} groupName — matches data-focus-group attribute
   * @param {number} interval — ms between each item (default 180)
   */
  runFocusStagger(groupName, interval) {
    interval = interval || 180;
    const items = this.$$('[data-focus-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, i * interval);
    });
  }

  /**
   * Typewriter — character-by-character reveal with blinking cursor.
   * Targets all .typewriter-text elements. Text comes from data-text.
   * @param {number} startDelay — ms before first character
   */
  runTypewriter(startDelay) {
    const els = this.$$('.typewriter-text');
    els.forEach((el, elIdx) => {
      const text = el.dataset.text;
      if (!text) return;
      el.textContent = '';
      el.classList.remove('done');
      const charDelay = startDelay + elIdx * 500;
      let i = 0;
      const typeChar = () => {
        if (i < text.length) {
          el.textContent += text[i];
          i++;
          this.pushTimer(typeChar, 28 + Math.random() * 22);
        } else {
          this.pushTimer(() => el.classList.add('done'), 400);
        }
      };
      this.pushTimer(typeChar, charDelay);
    });
  }

  /**
   * Folder badge reveal — staggered opacity fade-in.
   * @param {string} groupName — matches data-folder-group attribute
   * @param {number} interval — ms between each badge
   * @param {number} startDelay — ms before first badge
   */
  runFolderReveal(groupName, interval, startDelay) {
    const items = this.$$('[data-folder-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, startDelay + i * interval);
    });
  }

  /**
   * Self-drawing SVG checkmarks — staged after focus stagger.
   * @param {string} phaseSelector — CSS selector for the phase container (e.g. '#phase-4')
   * @param {number} staggerInterval — ms between each check (default 200)
   * @param {number} startDelay — ms before first check draws (default 700)
   */
  runDrawChecks(phaseSelector, staggerInterval, startDelay) {
    staggerInterval = staggerInterval || 200;
    startDelay = startDelay || 700;
    this.pushTimer(() => {
      this.$$(phaseSelector + ' .draw-check').forEach((check, i) => {
        this.pushTimer(() => {
          check.classList.add('check-active');
        }, i * staggerInterval);
      });
    }, startDelay);
  }

  /* ================================================================
     PROGRESS ANIMATION (rAF-driven)

     Drives multi-file progress bars with step dot indicators.
     File count and step thresholds are configurable.
     ================================================================ */

  /**
   * Start animated progress for processing phase.
   * @param {Object} opts — Optional overrides
   * @param {number} opts.fileCount — number of files (default 3)
   * @param {number[]} opts.offsets — stagger offsets per file (default [0, 0.25, 0.5])
   * @param {number[]} opts.stepThresholds — when each step completes (default [0.12, 0.37, 0.62, 0.87])
   * @param {number} opts.phaseIndex — which phase to read dwell from (default 2)
   */
  startProgressAnimation(opts) {
    opts = opts || {};
    const phaseIndex = opts.phaseIndex ?? 2;
    const dwell = this.phases[phaseIndex].dwell;
    const fileCount = opts.fileCount ?? 3;
    const offsets = opts.offsets || [0, 0.25, 0.50];
    const stepThresholds = opts.stepThresholds || [0.12, 0.37, 0.62, 0.87];

    this.progressStartTime = performance.now();

    const tick = (now) => {
      const elapsed = now - this.progressStartTime;
      const t = Math.min(elapsed / dwell, 1);

      for (let f = 0; f < fileCount; f++) {
        const fileT = Math.max(0, Math.min((t - offsets[f]) / (1 - offsets[f]), 1));
        const eased = 1 - Math.pow(1 - fileT, 3); // ease-out cubic
        const pct = eased * 100;

        // Progress bar
        const bar = this.$('.progress-bar[data-file="' + f + '"]');
        if (bar) bar.style.width = pct + '%';

        // Step dots and labels
        for (let s = 0; s < stepThresholds.length; s++) {
          const dot = this.$('.step-dot[data-file="' + f + '"][data-step="' + s + '"]');
          const label = this.$('.step-label[data-file="' + f + '"][data-step="' + s + '"]');
          if (!dot || !label) continue;

          if (fileT >= stepThresholds[s]) {
            dot.classList.remove('active');
            dot.classList.add('done');
            label.classList.remove('active');
            label.classList.add('done');

            if (s < stepThresholds.length - 1) {
              const connector = this.$('.step-connector[data-file="' + f + '"][data-after="' + s + '"]');
              if (connector && !connector.classList.contains('connected')) {
                connector.classList.add('connected');
              }
            }
          } else if (s === 0 || fileT >= stepThresholds[s - 1]) {
            dot.classList.add('active');
            dot.classList.remove('done');
            label.classList.add('active');
            label.classList.remove('done');
          }
        }
      }

      if (t < 1) {
        this.progressRAF = requestAnimationFrame(tick);
      }
    };

    this.progressRAF = requestAnimationFrame(tick);
  }

  stopProgressAnimation() {
    if (this.progressRAF) {
      cancelAnimationFrame(this.progressRAF);
      this.progressRAF = null;
    }
    this.$$('.progress-bar').forEach(bar => bar.style.width = '0%');
    this.$$('.step-dot').forEach(dot => dot.classList.remove('active', 'done'));
    this.$$('.step-label').forEach(label => label.classList.remove('active', 'done'));
    this.$$('.step-connector').forEach(c => c.classList.remove('connected'));
  }

  /* ================================================================
     RESET ALL ANIMATIONS
     ================================================================ */
  resetAllAnimations() {
    this.clearAllTimers();

    // Focus-enter items
    this.$$('.focus-enter').forEach(el => el.classList.remove('visible'));

    // Typewriters
    this.$$('.typewriter-text').forEach(el => {
      el.textContent = '';
      el.classList.remove('done');
    });

    // Self-drawing checks
    this.$$('.draw-check').forEach(el => {
      el.classList.remove('check-active');
      el.style.strokeDashoffset = '230';
    });

    // Folder badges
    this.$$('.suggest-folder').forEach(el => el.classList.remove('visible'));

    // Button pressing
    this.$$('.btn').forEach(el => el.classList.remove('pressing'));

    // Drop zone
    const dz = this.$('.drop-zone');
    if (dz) dz.classList.remove('receiving');

    // Title
    const tb = this.$(this.sel.titleBlock);
    if (tb) tb.classList.add('visible');
  }

  /* ================================================================
     PHASE TRANSITION ORCHESTRATOR

     Coordinates 7 simultaneous transitions at different speeds:
     1. SLOW — container height
     2. SLOW — 3D camera motion
     3. FAST — title focus-pull out/in
     4. MEDIUM — clip-path wipe body content
     5. FAST — footer crossfade
     6. FAST — playback dot update
     7. — phase enter callback
     ================================================================ */
  transitionTo(targetPhase) {
    if (targetPhase === this.currentPhase) return;

    const container = this.$(this.sel.phaseContainer);
    const card = this.$(this.sel.card);
    const titleBlock = this.$(this.sel.titleBlock);
    const oldPhaseEl = this.$('#phase-' + this.currentPhase);
    const newPhaseEl = this.$('#phase-' + targetPhase);
    const oldFooter = this.$('#footer-' + this.currentPhase);
    const newFooter = this.$('#footer-' + targetPhase);

    // 1. SLOW: Container height
    container.style.height = this.phaseHeights[targetPhase] + 'px';

    // 2. SLOW: Camera motion
    card.className = 'card camera-' + targetPhase;

    // 3. FAST: Title focus-pull out then in
    if (titleBlock) {
      titleBlock.classList.remove('visible');
      this.pushTimer(() => {
        const title = this.$(this.sel.phaseTitle);
        const subtitle = this.$(this.sel.phaseSubtitle);
        if (title) title.textContent = this.titles[targetPhase];
        if (subtitle) subtitle.textContent = this.subtitles[targetPhase];
        titleBlock.classList.add('visible');
      }, 300);
    }

    // 4. MEDIUM: Clip-path wipe body content
    oldPhaseEl.classList.remove('active');
    oldPhaseEl.classList.add('exiting');
    this.pushTimer(() => {
      newPhaseEl.classList.add('active');
      oldPhaseEl.classList.remove('exiting');
    }, 100);

    // 5. FAST: Footer crossfade
    if (oldFooter) oldFooter.classList.remove('active');
    if (newFooter) newFooter.classList.add('active');

    // 6. Update playback dots
    this.$$('.phase-dot').forEach(dot => {
      const p = parseInt(dot.dataset.phase);
      dot.classList.remove('active', 'completed');
      if (p === targetPhase) dot.classList.add('active');
      else if (p < targetPhase) dot.classList.add('completed');
    });
    const label = this.$(this.sel.phaseLabel);
    if (label) label.textContent = this.phases[targetPhase].label;

    // 7. Cleanup old phase
    this.stopProgressAnimation();

    this.currentPhase = targetPhase;

    // 8. Phase enter callback
    const callback = this.phaseCallbacks[targetPhase];
    if (callback) callback(this);
  }

  /* ================================================================
     PLAYBACK ENGINE
     ================================================================ */
  scheduleNext() {
    if (!this.playing) return;
    clearTimeout(this.phaseTimer);

    const dwell = this.phases[this.currentPhase].dwell;
    const interaction = this.interactions[this.currentPhase];
    const leadTime = interaction ? this.interactionLeadTime : 0;

    this.phaseTimer = setTimeout(async () => {
      const next = this.currentPhase + 1;
      if (next < this.phases.length) {
        if (interaction) await interaction();
        this.transitionTo(next);
        this.scheduleNext();
      } else {
        // Loop pause, then restart
        setTimeout(() => {
          if (this.playing) this.restart();
        }, this.loopPause);
      }
    }, dwell - leadTime);
  }

  togglePlay() {
    this.playing = !this.playing;
    const iconPause = this.$(this.sel.iconPause);
    const iconPlay = this.$(this.sel.iconPlay);
    if (iconPause) iconPause.style.display = this.playing ? '' : 'none';
    if (iconPlay) iconPlay.style.display = this.playing ? 'none' : '';
    if (this.playing) this.scheduleNext();
    else clearTimeout(this.phaseTimer);
  }

  jumpTo(phase) {
    clearTimeout(this.phaseTimer);
    this.resetAllAnimations();
    this.stopProgressAnimation();
    this.transitionTo(phase);
    if (this.playing) this.scheduleNext();
  }

  restart() {
    clearTimeout(this.phaseTimer);
    this.stopProgressAnimation();
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
     Also enables iframe postMessage control for compare.html.
     ================================================================ */
  exposeGlobals() {
    window.togglePlay = () => this.togglePlay();
    window.jumpTo = (phase) => this.jumpTo(phase);
    window.restart = () => this.restart();
  }
}

// Export for both module and script-tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CinematicDarkEngine;
}
