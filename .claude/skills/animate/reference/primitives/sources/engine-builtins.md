# Engine Builtins — Animation Primitives Catalog

Exhaustive catalog of every public animation method across our three engine files. Each entry is a named primitive with structured metadata for the registry.

**Source files:**
- `.claude/skills/animate/themes/cinematic-dark/engine.js` — `CinematicDarkEngine` (545 lines)
- `.claude/skills/animate/themes/editorial/engine.js` — `EditorialEngine` (556 lines)
- `.claude/skills/animate/themes/neutral-light/engine.js` — `NeutralLightEngine` (538 lines)

---

## Cinematic Dark Engine

### Entrances

#### `cd-focus-stagger` — Focus Pull Stagger
- **Method:** `runFocusStagger(groupName, interval)`
- **Category:** Entrance
- **Duration:** 180ms interval between items; individual transition ~400ms
- **Easing:** CSS transition (expo-out via theme)
- **Description:** Blur-to-sharp entrance for grouped items. Items start blurred and scaled down, then transition to sharp and full-size with staggered timing. The cinematic-dark signature entrance.
- **Data attribute:** `data-focus-group="{groupName}"`
- **CSS class:** Items get `.focus-enter` toggled via JS setTimeout stagger
- **Personality:** cinematic-dark (primary)

#### `cd-typewriter` — Typewriter Reveal
- **Method:** `runTypewriter(startDelay)`
- **Category:** Entrance / Reveal
- **Duration:** 28-50ms per character (randomized), 400ms final delay
- **Easing:** Linear per-character, random timing for organic feel
- **Description:** Character-by-character text reveal with blinking cursor. Reads text from data attribute and types it out.
- **Data attribute:** `data-text="{text content}"`
- **CSS class:** `.typewriter-text`
- **Personality:** cinematic-dark, editorial (shared)

### Reveals / Staggers

#### `cd-folder-reveal` — Folder Badge Stagger
- **Method:** `runFolderReveal(groupName, interval, startDelay)`
- **Category:** Reveal / Stagger
- **Duration:** Configurable interval and start delay
- **Easing:** CSS transition (opacity)
- **Description:** Staggered opacity fade-in for folder badge elements. Simple but effective for metadata reveals.
- **Data attribute:** `data-folder-group="{groupName}"`
- **Personality:** cinematic-dark

#### `cd-draw-checks` — Self-Drawing Checkmarks
- **Method:** `runDrawChecks(phaseSelector, staggerInterval, startDelay)`
- **Category:** Reveal / Stagger
- **Duration:** 200ms stagger, 700ms start delay (defaults)
- **Easing:** CSS animation (stroke-dashoffset)
- **Description:** SVG checkmarks that draw themselves with staggered timing. Applied after focus stagger for layered reveals.
- **Parameters:** CSS selector for phase container, stagger interval, start delay
- **Personality:** cinematic-dark

### Continuous / Ambient

#### `cd-progress-animation` — Multi-File Progress Bars
- **Method:** `startProgressAnimation(opts)` / `stopProgressAnimation()`
- **Category:** Continuous / Ambient
- **Duration:** Driven by phase dwell time (rAF loop)
- **Easing:** Ease-out cubic `(1 - Math.pow(1 - t, 3))`
- **Description:** Animated progress bars with step dot indicators. Tracks multi-file processing with staggered offsets per file. rAF-driven for smooth 60fps.
- **Parameters:** `{ fileCount, offsets, stepThresholds, phaseIndex }`
- **Defaults:** 3 files, offsets [0, 0.25, 0.50], thresholds [0.12, 0.37, 0.62, 0.87]
- **Personality:** cinematic-dark

### Transitions

#### `cd-phase-transition` — Cinematic Phase Transition
- **Method:** `transitionTo(targetPhase)`
- **Category:** Transition
- **Duration:** 300ms title, 100ms phase content, slow container height
- **Easing:** Multiple (expo-out for content, smooth for height)
- **Description:** Orchestrates 7 simultaneous transitions at different speeds: container height (slow), 3D camera motion (slow), title focus-pull (fast), clip-path wipe (medium), footer crossfade (fast), playback dots (fast), phase callback. The full cinematic phase change.
- **Personality:** cinematic-dark (exclusive)

---

## Editorial Engine

### Entrances

#### `ed-slide-stagger` — Slide + Fade Stagger
- **Method:** `runSlideStagger(groupName, interval)`
- **Category:** Entrance
- **Duration:** 120ms interval between items; individual transition ~300ms
- **Easing:** CSS transition (expo-out via theme)
- **Description:** Items slide up from `translateY(10px)` while fading in. The editorial signature entrance — restrained, content-forward.
- **Data attribute:** `data-stagger-group="{groupName}"`
- **CSS class:** Items get `.slide-enter` toggled via JS setTimeout stagger
- **Personality:** editorial (primary), neutral-light (compatible)

### Reveals

#### `ed-blur-reveal` — Blur-to-Sharp Reveal
- **Method:** `runBlurReveal(groupName, interval)`
- **Category:** Reveal
- **Duration:** 200ms interval; individual transition ~500ms
- **Easing:** CSS transition (filter, opacity, transform)
- **Description:** Hero moment reveal — elements transition from blurred + scaled to sharp + full. Lighter than cinematic focus-pull, suited for content-forward contexts.
- **Data attribute:** `data-blur-group="{groupName}"`
- **Personality:** editorial (primary)

#### `ed-typewriter` — Typewriter Reveal
- **Method:** `runTypewriter(selector, startDelay)`
- **Category:** Entrance / Reveal
- **Duration:** 28-50ms per character (randomized), 400ms final delay
- **Easing:** Linear per-character, random timing
- **Description:** Same typewriter effect as cinematic-dark. Accepts CSS selector or DOM element.
- **Data attribute:** `data-text="{text content}"`
- **Personality:** editorial, cinematic-dark (shared)

#### `ed-all-typewriters` — Batch Typewriter
- **Method:** `runAllTypewriters(startDelay)`
- **Category:** Reveal / Stagger
- **Duration:** 500ms stagger between typewriter elements
- **Description:** Runs all typewriters in the current phase with 500ms inter-element stagger.
- **Personality:** editorial

### Continuous / Ambient

#### `ed-content-cycle` — Content Cycling
- **Method:** `runContentCycle(groupName, intervalMs)` / `stopContentCycle(groupName)`
- **Category:** Continuous / Ambient
- **Duration:** 2800ms per item (default), 300ms crossfade
- **Easing:** CSS transition (opacity, translateY)
- **Description:** The editorial signature effect. Cycles through content items with crossfade + translateY transition. Shows "multiple use cases" by rotating content in place.
- **Data attribute:** `data-cycle-group="{groupName}"`
- **Personality:** editorial (exclusive)

### Content Effects

#### `ed-count-up` — Animated Number Count
- **Method:** `runCountUp(duration)`
- **Category:** Content Effect
- **Duration:** 800ms (default)
- **Easing:** Ease-out quad `(1 - (1 - t) * (1 - t))`
- **Description:** Counts animated numbers from 0 to target value. Targets elements with data attribute.
- **Data attribute:** `data-count-target="{number}"`
- **Personality:** editorial (primary), neutral-light (compatible)

### Interactions

#### `ed-tab-switch` — Tab Highlight + Content Crossfade
- **Method:** `runTabSwitch(tabGroup, tabIndex)`
- **Category:** Interaction
- **Duration:** CSS transition duration
- **Description:** Highlights active tab and crossfades content between panels. Clean state-based switching.
- **Data attribute:** `data-tab-group="{group}"`, `data-tab-panel="{group}"`
- **Personality:** editorial (primary)

### Transitions

#### `ed-phase-transition` — Editorial Phase Transition
- **Method:** `transitionTo(targetPhase)`
- **Category:** Transition
- **Duration:** 200ms title, 100ms phase content, slow container height
- **Easing:** Multiple (expo-out for content, smooth for height)
- **Description:** Orchestrates 6 simultaneous transitions: container height (slow), title crossfade (fast), phase content crossfade (medium), footer crossfade (fast), playback dots (fast), phase callback. No 3D camera, no clip-path wipes — opacity crossfade only.
- **Personality:** editorial (exclusive)

---

## Neutral Light Engine

### Entrances

#### `nl-slide-stagger` — Slide + Fade Stagger
- **Method:** `runSlideStagger(groupName, interval)`
- **Category:** Entrance
- **Duration:** 150ms interval; individual transition ~250ms
- **Easing:** CSS transition
- **Description:** Items slide up from `translateY(8px)` while fading in. Slightly shorter offset than editorial (8px vs 10px) for a lighter feel.
- **Data attribute:** `data-slide-group="{groupName}"`
- **Personality:** neutral-light (primary)

### Attention Seekers

#### `nl-spotlight` — Element Spotlight
- **Method:** `runSpotlight(selector, duration)` → Promise
- **Category:** Attention
- **Duration:** 2000ms (default)
- **Description:** Highlights a specific element with dim overlay and blue border. Positions a cutout over the target element, dimming everything else.
- **Parameters:** CSS selector, duration in ms
- **Personality:** neutral-light (exclusive)

#### `nl-tooltip` — Positioned Tooltip
- **Method:** `runTooltip(anchorSelector, text, position, duration)` → Promise
- **Category:** Attention
- **Duration:** 2000ms (default)
- **Description:** Shows positioned tooltip near an anchor element. Supports 'above' and 'below' positioning.
- **Parameters:** anchor selector, text content, position ('above'|'below'), duration
- **Personality:** neutral-light (exclusive)

### Interactions

#### `nl-cursor-to` — Simulated Cursor Movement
- **Method:** `runCursorTo(x, y, opts)` → Promise
- **Category:** Interaction
- **Duration:** 200ms delay + 600ms movement + optional 500ms click
- **Easing:** Matches `--nl-slow` token
- **Description:** Simulates cursor movement to target coordinates with optional click pulse. Creates guided walkthrough feel.
- **Parameters:** x, y coordinates; opts: `{ click, delay }`
- **Personality:** neutral-light (exclusive)

### Content Effects

#### `nl-step-progress` — Step Indicator Update
- **Method:** `runStepProgress(stepNumber)`
- **Category:** Content Effect
- **Duration:** 450ms pop animation
- **Description:** Marks numbered step as done with scale pop animation and fills the connector line. Sequential progress visualization.
- **Parameters:** 0-indexed step number
- **Personality:** neutral-light (exclusive)

### Transitions

#### `nl-phase-transition` — Neutral Phase Transition
- **Method:** `transitionTo(targetPhase)`
- **Category:** Transition
- **Duration:** 300ms title, 100ms phase content, slow container height
- **Easing:** Multiple
- **Description:** Orchestrates 6 simultaneous transitions: container height (slow), title fade (fast), opacity crossfade (medium), footer crossfade (fast), playback dots (fast), phase callback. Clean, minimal transitions.
- **Personality:** neutral-light (exclusive)

---

## Shared Infrastructure (All Engines)

These methods exist on all three engines and are not animation primitives per se, but playback utilities:

| Method | Description |
|--------|-------------|
| `boot()` | Initialize engine: embed mode, measure phases, start playback |
| `exposeGlobals()` | Wire togglePlay/jumpTo/restart to window scope |
| `togglePlay()` | Pause/resume playback |
| `jumpTo(phase)` | Jump to specific phase |
| `restart()` | Restart from phase 0 |
| `applyEmbedMode()` | Hide controls, transparent bg, full-width for iframe embedding |
| `measurePhases()` | Measure natural height of each phase for height transitions |
| `resetAllAnimations()` | Reset all active animations to initial state |
| `scheduleNext()` | Schedule next phase transition based on dwell time |

---

## Summary by Category

| Category | Cinematic Dark | Editorial | Neutral Light | Total |
|----------|---------------|-----------|---------------|-------|
| Entrances | 2 | 1 | 1 | 4 |
| Reveals / Staggers | 2 | 3 | — | 5 |
| Attention | — | — | 2 | 2 |
| Continuous / Ambient | 1 | 1 | — | 2 |
| Content Effects | — | 1 | 1 | 2 |
| Interactions | — | 1 | 1 | 2 |
| Transitions | 1 | 1 | 1 | 3 |
| **Total primitives** | **6** | **8** | **6** | **20** |
