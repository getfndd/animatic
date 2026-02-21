/**
 * EditorialEngine — Content-forward autoplay animation engine
 *
 * Drives the editorial personality: crossfade transitions, slide+fade
 * staggers, content cycling, interface-as-demo, blur-to-sharp reveals,
 * count-up numbers, and typewriter text.
 *
 * Designed for shareability — accepts optional tokenOverrides to adapt
 * to any design system. No hardcoded colors.
 *
 * Usage:
 *   const engine = new EditorialEngine({
 *     phases: [
 *       { id: 0, label: 'Overview',  dwell: 3000 },
 *       { id: 1, label: 'Features',  dwell: 3000 },
 *       { id: 2, label: 'Search',    dwell: 3500 },
 *       { id: 3, label: 'Results',   dwell: 3000 },
 *     ],
 *     titles: ['Product Name', 'Features', 'Smart Search', 'Results'],
 *     subtitles: ['Overview', 'What it does', 'Find anything', 'Instant answers'],
 *     onPhaseEnter: {
 *       1: (engine) => engine.runSlideStagger('features', 120),
 *       2: (engine) => engine.runContentCycle('search-terms', 2800),
 *       3: (engine) => engine.runCountUp(),
 *     },
 *     // Optional: override tokens for your design system
 *     tokenOverrides: {
 *       '--ed-bg-body': '#0a0a0a',
 *       '--ed-text-primary': '#ffffff',
 *     },
 *   });
 *   engine.boot();
 */
class EditorialEngine {

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

  pushInterval(fn, ms) {
    const id = setInterval(fn, ms);
    this._intervals.push(id);
    return id;
  }

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

     Apply custom CSS custom property values to the document root.
     This allows any design system to adapt the editorial personality.
     ================================================================ */
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

      // Show blur-reveal items
      el.querySelectorAll('.blur-reveal').forEach(f => {
        f.style.opacity = '1';
        f.style.filter = 'none';
        f.style.transform = 'none';
      });

      el.offsetHeight; // force layout
      this.phaseHeights[p.id] = el.scrollHeight + 8;

      // Reset
      el.querySelectorAll('.slide-enter').forEach(f => {
        f.style.opacity = '';
        f.style.transform = '';
      });
      el.querySelectorAll('.blur-reveal').forEach(f => {
        f.style.opacity = '';
        f.style.filter = '';
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
   * Slide+fade stagger — the editorial entrance.
   * Items slide up from translateY(10px) while fading in.
   * @param {string} groupName — matches data-stagger-group attribute
   * @param {number} interval — ms between each item (default 120)
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
   * Blur-to-sharp reveal — for hero moments.
   * Elements go from blurred+scaled to sharp+full.
   * @param {string} groupName — matches data-blur-group attribute
   * @param {number} interval — ms between items (default 200)
   */
  runBlurReveal(groupName, interval) {
    interval = interval || 200;
    const items = this.$$('[data-blur-group="' + groupName + '"]');
    items.forEach(el => el.classList.remove('visible'));
    items.forEach((el, i) => {
      this.pushTimer(() => {
        el.classList.add('visible');
      }, i * interval);
    });
  }

  /**
   * Content cycling — the editorial signature effect.
   * Cycles through items in a container with crossfade + translateY.
   * @param {string} groupName — matches data-cycle-group attribute
   * @param {number} intervalMs — ms per cycle item (default 2800)
   */
  runContentCycle(groupName, intervalMs) {
    intervalMs = intervalMs || 2800;
    const items = this.$$('[data-cycle-group="' + groupName + '"]');
    if (items.length === 0) return;

    let current = 0;
    items[0].classList.add('active');

    const cycle = () => {
      const prev = current;
      current = (current + 1) % items.length;

      items[prev].classList.remove('active');
      items[prev].classList.add('exiting');

      this.pushTimer(() => {
        items[prev].classList.remove('exiting');
        items[current].classList.add('active');
      }, 300);
    };

    this.pushInterval(cycle, intervalMs);
  }

  /**
   * Stop content cycling for a specific group.
   * @param {string} groupName — matches data-cycle-group attribute
   */
  stopContentCycle(groupName) {
    const items = this.$$('[data-cycle-group="' + groupName + '"]');
    items.forEach(el => {
      el.classList.remove('active', 'exiting');
    });
  }

  /**
   * Tab switching — highlight active tab and crossfade content.
   * @param {string} tabGroup — matches data-tab-group attribute
   * @param {number} tabIndex — which tab to activate
   */
  runTabSwitch(tabGroup, tabIndex) {
    const tabs = this.$$('[data-tab-group="' + tabGroup + '"]');
    const panels = this.$$('[data-tab-panel="' + tabGroup + '"]');

    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === tabIndex);
    });

    panels.forEach((panel, i) => {
      if (i === tabIndex) {
        panel.classList.add('active');
        panel.classList.remove('exiting');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  /**
   * Count-up animation — animate numbers from 0 to target value.
   * Targets elements with data-count-target attribute.
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
  resetAllAnimations() {
    this.clearAllTimers();

    // Slide-enter items
    this.$$('.slide-enter').forEach(el => el.classList.remove('visible'));

    // Blur-reveal items
    this.$$('.blur-reveal').forEach(el => el.classList.remove('visible'));

    // Content cycling
    this.$$('.cycle-item').forEach(el => {
      el.classList.remove('active', 'exiting');
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

    // Tabs
    this.$$('.tab').forEach(el => el.classList.remove('active'));

    // Title block
    const tb = this.$(this.sel.titleBlock);
    if (tb) tb.classList.remove('transitioning');
  }

  /* ================================================================
     PHASE TRANSITION ORCHESTRATOR

     Coordinates transitions at different speeds:
     1. SLOW — container height morph
     2. FAST — title crossfade
     3. MEDIUM — phase content crossfade
     4. FAST — footer crossfade
     5. FAST — playback dot update
     6. — phase enter callback
     ================================================================ */
  transitionTo(targetPhase) {
    if (targetPhase === this.currentPhase) return;

    const container = this.$(this.sel.phaseContainer);
    const titleBlock = this.$(this.sel.titleBlock);
    const oldPhaseEl = this.$('#phase-' + this.currentPhase);
    const newPhaseEl = this.$('#phase-' + targetPhase);
    const oldFooter = this.$('#footer-' + this.currentPhase);
    const newFooter = this.$('#footer-' + targetPhase);

    // 1. SLOW: Container height morph
    container.style.height = this.phaseHeights[targetPhase] + 'px';

    // 2. FAST: Title crossfade
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
      }, 200);
    }

    // 3. MEDIUM: Phase content crossfade
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
    this.transitionTo(phase);
    if (this.playing) this.scheduleNext();
  }

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
  exposeGlobals() {
    window.togglePlay = () => this.togglePlay();
    window.jumpTo = (phase) => this.jumpTo(phase);
    window.restart = () => this.restart();
  }
}

// Export for both module and script-tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EditorialEngine;
}
