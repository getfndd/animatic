/**
 * Tutorial Animation Primitives
 *
 * Composable with any animation engine. Each function takes the engine
 * instance as its first argument for DOM access (engine.$(), engine.pushTimer()).
 *
 * Primitives:
 *   - spotlight: Highlight a specific element with dim overlay + blue border
 *   - cursorTo:  Simulate cursor movement to target coordinates
 *   - tooltip:   Show positioned tooltip near an anchor element
 *   - stepProgress: Update numbered step indicators (mark done, advance)
 *
 * CSS: Import tutorial.css alongside your personality's motion.css for
 * the spotlight overlay, cursor, tooltip, and step indicator styles.
 */

/**
 * Spotlight — highlights a specific element with a dim overlay and blue border.
 * Uses the spotlight-overlay element with a cutout positioned over the target.
 * @param {Object} engine — engine instance (needs $, pushTimer, sel.spotlightOverlay, sel.card)
 * @param {string} selector — CSS selector for the element to spotlight
 * @param {number} [duration=2000] — how long to keep spotlight active (ms)
 * @returns {Promise} — resolves when spotlight deactivates
 */
export function spotlight(engine, selector, duration) {
  duration = duration || 2000;
  const overlay = engine.$(engine.sel.spotlightOverlay);
  const target = engine.$(selector);
  if (!overlay || !target) return Promise.resolve();

  // Position the cutout over the target
  const card = engine.$(engine.sel.card);
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
    engine.pushTimer(() => {
      overlay.classList.remove('active');
      resolve();
    }, duration);
  });
}

/**
 * Cursor simulation — moves an SVG cursor to target coordinates.
 * @param {Object} engine — engine instance (needs $, pushTimer, sel.tutorialCursor)
 * @param {number} x — target x position relative to card
 * @param {number} y — target y position relative to card
 * @param {Object} [opts] — optional settings
 * @param {boolean} [opts.click] — simulate a click pulse at destination
 * @param {number} [opts.delay=200] — ms before cursor starts moving
 * @returns {Promise} — resolves after cursor arrives (and click if applicable)
 */
export function cursorTo(engine, x, y, opts) {
  opts = opts || {};
  const cursor = engine.$(engine.sel.tutorialCursor);
  if (!cursor) return Promise.resolve();

  const startDelay = opts.delay ?? 200;

  return new Promise(resolve => {
    // Show cursor
    engine.pushTimer(() => {
      cursor.classList.add('visible');
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';

      // Wait for movement to complete, then optionally click
      engine.pushTimer(() => {
        if (opts.click) {
          cursor.classList.add('clicking');
          engine.pushTimer(() => {
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
 * @param {Object} engine — engine instance (needs $, pushTimer, sel.card)
 * @param {string} anchorSelector — CSS selector for the element to annotate
 * @param {string} text — tooltip text to display
 * @param {string} [position='below'] — 'below' or 'above'
 * @param {number} [duration=2000] — how long to show (ms)
 * @returns {Promise} — resolves when tooltip hides
 */
export function tooltip(engine, anchorSelector, text, position, duration) {
  position = position || 'below';
  duration = duration || 2000;

  const tooltipEl = engine.$('.tutorial-tooltip');
  const anchor = engine.$(anchorSelector);
  if (!tooltipEl || !anchor) return Promise.resolve();

  const card = engine.$(engine.sel.card);
  const cardRect = card.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();

  // Position tooltip
  const tooltipText = tooltipEl.querySelector('.tutorial-tooltip-text');
  if (tooltipText) tooltipText.textContent = text;

  if (position === 'above') {
    tooltipEl.classList.add('above');
    tooltipEl.style.bottom = (cardRect.bottom - anchorRect.top + 10) + 'px';
    tooltipEl.style.top = 'auto';
  } else {
    tooltipEl.classList.remove('above');
    tooltipEl.style.top = (anchorRect.bottom - cardRect.top + 10) + 'px';
    tooltipEl.style.bottom = 'auto';
  }
  tooltipEl.style.left = (anchorRect.left - cardRect.left) + 'px';

  tooltipEl.classList.add('visible');

  return new Promise(resolve => {
    engine.pushTimer(() => {
      tooltipEl.classList.remove('visible');
      resolve();
    }, duration);
  });
}

/**
 * Step progress — updates numbered step indicators.
 * Marks the specified step as done with a scale pop animation,
 * and fills the connector line to the next step.
 * @param {Object} engine — engine instance (needs $$, pushTimer)
 * @param {number} stepNumber — 0-indexed step to mark as done
 */
export function stepProgress(engine, stepNumber) {
  const dots = engine.$$('.step-indicator-dot');
  const labels = engine.$$('.step-indicator-label');
  const connectors = engine.$$('.step-indicator-connector');

  // Mark this step as done
  if (dots[stepNumber]) {
    dots[stepNumber].classList.remove('active');
    dots[stepNumber].classList.add('done', 'pop');
    // Remove pop class after animation
    engine.pushTimer(() => {
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
