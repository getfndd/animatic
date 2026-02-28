/**
 * MontageEngine — Rapid-scene autoplay animation engine
 *
 * Drives the montage personality: hard cuts, whip-wipe transitions,
 * scale entrances, stat pops, split-screen reveals, grid staggers,
 * full-screen typography, and count-up numbers.
 *
 * Key differentiator: transitionTo() reads per-phase transition types
 * (hard-cut, whip-left, whip-right, whip-up, whip-down) instead of
 * using a single global transition style.
 *
 * Designed for shareability — accepts optional tokenOverrides to adapt
 * to any design system. No hardcoded colors.
 *
 * Usage:
 *   const engine = new MontageEngine({
 *     phases: [
 *       { id: 0, label: 'Title',   dwell: 2500, transition: 'hard-cut' },
 *       { id: 1, label: 'Demo',    dwell: 3500, transition: 'whip-left' },
 *       { id: 2, label: 'Stats',   dwell: 2500, transition: 'hard-cut' },
 *       { id: 3, label: 'Split',   dwell: 3000, transition: 'whip-right' },
 *       { id: 4, label: 'Grid',    dwell: 3000, transition: 'whip-up' },
 *       { id: 5, label: 'CTA',     dwell: 2500 },
 *     ],
 *     titles: ['Velocity', 'Dashboard', 'By the Numbers', ...],
 *     subtitles: ['Real-time analytics', 'Live metrics', ...],
 *     onPhaseEnter: {
 *       0: (engine) => engine.runTextHero('#hero-title'),
 *       2: (engine) => engine.runStatReveal('stats', 150),
 *     },
 *     tokenOverrides: { '--mo-accent': '#8b5cf6' },
 *   });
 *   engine.boot();
 */
class MontageEngine {

  /* ================================================================
     CONSTRUCTOR
     ================================================================ */
  constructor(config) {
    // Required
    this.phases = config.phases;
    this.titles = config.titles;
    this.subtitles = config.subtitles || [];

    // Optional callbacks
    this.phaseCallbacks = config.onPhaseEnter || {};

    // Optional overrides
    this.loopPause = config.loopPause ?? 1500;
    this.tokenOverrides = config.tokenOverrides || null;

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
    this.phaseHeights = {};
    this._timers = [];
    this._intervals = [];
    this._rafs = [];

    // Embed mode
    this.isEmbed = new URLSearchParams(window.location.search).has('embed');
  }

  /* ================================================================
     HELPERS
     ================================================================ */
  /** @param {string} selector @returns {Element|null} */
  $(selector) {
    return document.querySelector(selector);
  }

  /** @param {string} selector @returns {NodeList} */
  $$(selector) {
    return document.querySelectorAll(selector);
  }

  /** @param {number} ms @returns {Promise<void>} */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Schedule a callback with automatic cleanup on reset.
   * @param {Function} fn
   * @param {number} ms
   * @returns {number} timer ID
   */
  pushTimer(fn, ms) {
    const id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  }

  /**
   * Schedule a repeating callback with automatic cleanup on reset.
   * @param {Function} fn
   * @param {number} ms
   * @returns {number} interval ID
   */
  pushInterval(fn, ms) {
    const id = setInterval(fn, ms);
    this._intervals.push(id);
    return id;
  }

  /** Cancel all timers, intervals, and animation frames. */
  clearAllTimers() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers.length = 0;
    this._intervals.forEach(i => clearInterval(i));
    this._intervals.length = 0;
    this._rafs.forEach(r => cancelAnimationFrame(r));
    this._rafs.length = 0;
  }

  /* ================================================================
     TOKEN OVERRIDES
     ================================================================ */
  /** Apply tokenOverrides config to document root CSS custom properties. */
  applyTokenOverrides() {
    if (!this.tokenOverrides) return;
    const root = document.documentElement;
    Object.entries(this.tokenOverrides).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
  }

  /* ================================================================
     MEASURE PHASE HEIGHTS
     ================================================================ */
  /** Pre-measure all phase heights for smooth height animation. */
  measurePhases() {
    const container = this.$(this.sel.phaseContainer);
    container.style.transition = 'none';

    this.phases.forEach(p => {
      const el = this.$('#phase-' + p.id);
      el.classList.remove('active');
      el.classList.add('measuring');

      // Show scale-enter items at full size for measurement
      el.querySelectorAll('.scale-enter').forEach(f => {
        f.style.opacity = '1';
        f.style.transform = 'none';
      });

      // Show slide-enter items at full size
      el.querySelectorAll('.slide-enter').forEach(f => {
        f.style.opacity = '1';
        f.style.transform = 'none';
      });

      // Show stat-pop items
      el.querySelectorAll('.stat-pop').forEach(f => {
        f.style.opacity = '1';
        f.style.transform = 'none';
      });

      // Show text-hero items
      el.querySelectorAll('.text-hero').forEach(f => {
        f.style.opacity = '1';
        f.style.transform = 'none';
      });

      // Show split panels
      el.querySelectorAll('.split-panel').forEach(f => {
        f.style.opacity = '1';
        f.style.transform = 'none';
      });

      el.offsetHeight; // force layout
      this.phaseHeights[p.id] = el.scrollHeight + 8;

      // Reset
      el.querySelectorAll('.scale-enter').forEach(f => {
        f.style.opacity = '';
        f.style.transform = '';
      });
      el.querySelectorAll('.slide-enter').forEach(f => {
        f.style.opacity = '';
        f.style.transform = '';
      });
      el.querySelectorAll('.stat-pop').forEach(f => {
        f.style.opacity = '';
        f.style.transform = '';
      });
      el.querySelectorAll('.text-hero').forEach(f => {
        f.style.opacity = '';
        f.style.transform = '';
      });
      el.querySelectorAll('.split-panel').forEach(f => {
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
     ================================================================ */

  /**
   * Scale entrance stagger — the montage entrance.
   * Items scale from 1.15 to 1.0 while fading in.
   * @param {string} groupName — matches data-stagger-group attribute
   * @param {number} interval — ms between each item (default 100)
   */
  runScaleEntrance(groupName, interval) {
    interval = interval || 100;
    const items = this.$$('[data-stagger-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, i * interval);
    });
  }

  /**
   * Slide+fade stagger — reused from editorial for grid items.
   * @param {string} groupName — matches data-stagger-group attribute
   * @param {number} interval — ms between items (default 120)
   */
  runSlideStagger(groupName, interval) {
    interval = interval || 120;
    const items = this.$$('[data-stagger-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, i * interval);
    });
  }

  /**
   * Stat reveal — stat cards stagger with pop animation + auto count-up.
   * @param {string} groupName — matches data-stagger-group attribute
   * @param {number} interval — ms between stat cards (default 150)
   */
  runStatReveal(groupName, interval) {
    interval = interval || 150;
    const items = this.$$('[data-stagger-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, i * interval);
    });
    // Auto-trigger count-up after all stats are visible
    this.pushTimer(() => this.runCountUp(600), items.length * interval + 100);
  }

  /**
   * Split-screen reveal — left panel first, then right.
   * @param {string} leftGroup — selector or data attribute for left panel
   * @param {string} rightGroup — selector or data attribute for right panel
   * @param {number} staggerMs — delay between panels (default 200)
   */
  runSplitScreen(leftGroup, rightGroup, staggerMs) {
    staggerMs = staggerMs || 200;
    const left = this.$(leftGroup);
    const right = this.$(rightGroup);
    if (left) {
      left.classList.remove('visible');
      this.pushTimer(() => left.classList.add('visible'), 0);
    }
    if (right) {
      right.classList.remove('visible');
      this.pushTimer(() => right.classList.add('visible'), staggerMs);
    }
  }

  /**
   * Grid reveal — fast tile stagger for feature grids.
   * @param {string} groupName — matches data-stagger-group attribute
   * @param {number} interval — ms between tiles (default 80)
   */
  runGridReveal(groupName, interval) {
    interval = interval || 80;
    const items = this.$$('[data-stagger-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, i * interval);
    });
  }

  /**
   * Text hero — full-screen typography scale entrance.
   * @param {string} selector — CSS selector for the hero text element
   */
  runTextHero(selector) {
    const el = typeof selector === 'string' ? this.$(selector) : selector;
    if (!el) return;
    el.classList.remove('visible');
    this.pushTimer(() => el.classList.add('visible'), 50);
  }

  /**
   * Count-up animation — animate numbers from 0 to target value.
   * @param {number} duration — ms for the count animation (default 800)
   */
  runCountUp(duration) {
    duration = duration || 800;
    const els = this.$$('[data-count-target]');

    els.forEach(el => {
      const target = parseFloat(el.dataset.countTarget);
      const prefix = el.dataset.countPrefix || '';
      const suffix = el.dataset.countSuffix || '';
      const decimals = (el.dataset.countDecimals || '0') | 0;
      const start = performance.now();

      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        // ease-out-quad
        const eased = 1 - (1 - t) * (1 - t);
        const value = (eased * target).toFixed(decimals);
        el.textContent = prefix + value + suffix;
        if (t < 1) {
          const raf = requestAnimationFrame(tick);
          this._rafs.push(raf);
        }
      };

      const raf = requestAnimationFrame(tick);
      this._rafs.push(raf);
    });
  }

  /**
   * Typewriter — character-by-character reveal.
   * @param {string} selector — CSS selector for the typewriter element
   * @param {number} startDelay — ms before first character (default 0)
   */
  runTypewriter(selector, startDelay) {
    startDelay = startDelay || 0;
    const el = typeof selector === 'string' ? this.$(selector) : selector;
    if (!el) return;

    const text = el.dataset.text;
    if (!text) return;
    el.textContent = '';
    el.classList.remove('done');

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
    this.pushTimer(typeChar, startDelay);
  }

  /**
   * Run all typewriters in the current phase.
   * @param {number} startDelay — ms before first character
   */
  runAllTypewriters(startDelay) {
    startDelay = startDelay || 0;
    const els = this.$$('.typewriter-text');
    els.forEach((el, idx) => {
      this.runTypewriter(el, startDelay + idx * 500);
    });
  }

  /* ================================================================
     RESET ALL ANIMATIONS
     ================================================================ */
  /** Reset all animation state for clean loop replay. */
  resetAllAnimations() {
    this.clearAllTimers();

    // Scale-enter items
    this.$$('.scale-enter').forEach(el => el.classList.remove('visible'));

    // Slide-enter items
    this.$$('.slide-enter').forEach(el => el.classList.remove('visible'));

    // Stat-pop items
    this.$$('.stat-pop').forEach(el => {
      el.classList.remove('visible');
      el.style.animation = '';
    });

    // Text-hero items
    this.$$('.text-hero').forEach(el => el.classList.remove('visible'));

    // Split panels
    this.$$('.split-panel').forEach(el => el.classList.remove('visible'));

    // Whip-wipe exit classes
    this.$$('.phase').forEach(el => {
      el.classList.remove('whip-exit-left', 'whip-exit-right', 'whip-exit-up', 'whip-exit-down');
    });

    // Typewriters
    this.$$('.typewriter-text').forEach(el => {
      el.textContent = '';
      el.classList.remove('done');
    });

    // Count-up numbers
    this.$$('[data-count-target]').forEach(el => {
      el.textContent = '0';
    });

    // Title block
    const tb = this.$(this.sel.titleBlock);
    if (tb) tb.classList.remove('transitioning');
  }

  /* ================================================================
     PHASE TRANSITION ORCHESTRATOR

     Per-phase transition types:
     - 'hard-cut': instant swap (0ms)
     - 'whip-left/right/up/down': directional clip-path wipe (250ms)

     Default: 'hard-cut' if transition not specified on phase config.
     ================================================================ */
  /**
   * Orchestrate transition to a target phase.
   * Reads current phase's transition property to determine exit animation.
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

    // Read transition type from current phase config
    const currentPhaseConfig = this.phases[this.currentPhase];
    const transitionType = currentPhaseConfig.transition || 'hard-cut';

    // 1. Container height morph
    container.style.height = this.phaseHeights[targetPhase] + 'px';

    // 2. Title crossfade
    if (titleBlock) {
      titleBlock.classList.add('transitioning');
      this.pushTimer(() => {
        const title = this.$(this.sel.phaseTitle);
        const subtitle = this.$(this.sel.phaseSubtitle);
        if (title) title.textContent = this.titles[targetPhase];
        if (subtitle && this.subtitles[targetPhase]) {
          subtitle.textContent = this.subtitles[targetPhase];
        }
        titleBlock.classList.remove('transitioning');
      }, 150);
    }

    // 3. Phase content transition (per-phase type)
    if (transitionType === 'hard-cut') {
      // Instant swap — no animation
      oldPhaseEl.classList.remove('active');
      newPhaseEl.classList.add('active');
    } else {
      // Whip-wipe — directional clip-path exit
      const whipClass = 'whip-exit-' + transitionType.replace('whip-', '');
      oldPhaseEl.classList.remove('active');
      oldPhaseEl.classList.add(whipClass);

      // Show new phase immediately (behind the wipe)
      newPhaseEl.classList.add('active');

      // Clean up exit animation after wipe completes
      this.pushTimer(() => {
        oldPhaseEl.classList.remove(whipClass);
      }, 260);
    }

    // 4. Footer crossfade
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
        this.pushTimer(() => {
          if (this.playing) this.restart();
        }, this.loopPause);
      }
    }, dwell);
  }

  /** Toggle play/pause. */
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
   * Jump directly to a specific phase.
   * @param {number} phase — target phase index
   */
  jumpTo(phase) {
    clearTimeout(this.phaseTimer);
    this.resetAllAnimations();
    this.transitionTo(phase);
    if (this.playing) this.scheduleNext();
  }

  /** Reset to phase 0 and restart playback. */
  restart() {
    clearTimeout(this.phaseTimer);
    this.resetAllAnimations();
    if (this.currentPhase !== 0) this.transitionTo(0);
    // Re-trigger phase 0 callback on restart
    const callback = this.phaseCallbacks[0];
    if (callback) callback(this);
    if (this.playing) this.scheduleNext();
  }

  /* ================================================================
     EMBED MODE
     ================================================================ */
  /** Apply embed mode: hide controls, transparent background, full-width. */
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
     ================================================================ */
  /** Initialize engine after DOMContentLoaded. */
  boot() {
    this.applyTokenOverrides();
    this.applyEmbedMode();
    // Small delay for fonts to load
    setTimeout(() => {
      this.measurePhases();
      // Trigger phase 0 callback
      const callback = this.phaseCallbacks[0];
      if (callback) callback(this);
      setTimeout(() => this.scheduleNext(), 400);
    }, 150);
  }

  /* ================================================================
     EXPOSE GLOBAL API
     ================================================================ */
  /** Wire window-level functions for HTML onclick handlers. */
  exposeGlobals() {
    window.togglePlay = () => this.togglePlay();
    window.jumpTo = (phase) => this.jumpTo(phase);
    window.restart = () => this.restart();
  }
}

// Export for both module and script-tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MontageEngine;
}
