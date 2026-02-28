# Animation Engine API Reference

Three animation engines drive Animatic's personality system. Each engine shares a common lifecycle and API surface, with personality-specific animation primitives on top.

---

## Engine Overview

| Engine | Personality | Transition Style | Signature Effects |
|--------|------------|------------------|-------------------|
| `CinematicDarkEngine` | Cinematic Dark | 3D camera + clip-path wipes | Focus-pull stagger, typewriter, self-drawing SVG, rAF progress |
| `EditorialEngine` | Editorial | Crossfade + height morph | Slide stagger, content cycling, count-up, blur reveal, tab switching |
| `NeutralLightEngine` | Neutral Light | Opacity crossfade | Slide stagger, spotlight, cursor simulation, tooltips, step progress |

**Source files:**
- `.claude/skills/animate/personalities/cinematic/engine.js`
- `.claude/skills/animate/personalities/editorial/engine.js`
- `.claude/skills/animate/personalities/neutral-light/engine.js`

---

## Shared Lifecycle

All three engines follow the same lifecycle:

```
constructor(config) → exposeGlobals() → DOMContentLoaded → boot()
                                                              ├── applyEmbedMode()
                                                              ├── measurePhases()
                                                              └── scheduleNext() ← playback loop
                                                                    ├── transitionTo(phase)
                                                                    ├── onPhaseEnter callbacks
                                                                    └── scheduleNext() (repeat)
                                                                         └── restart() (loop)
```

### Standard Usage

```js
const engine = new CinematicDarkEngine({
  phases: [
    { id: 0, label: 'Upload',     dwell: 2500 },
    { id: 1, label: 'Processing', dwell: 4000 },
    { id: 2, label: 'Results',    dwell: 3500 },
  ],
  titles: ['Upload Files', 'Analyzing...', 'Results'],
  subtitles: ['Drag and drop', 'Processing documents', 'Review suggestions'],
  onPhaseEnter: {
    1: (engine) => engine.startProgressAnimation(),
    2: (engine) => engine.runFocusStagger('results', 200),
  },
});

engine.exposeGlobals();
window.addEventListener('DOMContentLoaded', () => engine.boot());
```

---

## Config Schema

All engines accept the same base config object. Personality-specific options are noted.

```js
{
  // --- Required ---

  phases: [                    // Animation phases
    { id: 0, label: 'Name', dwell: 2500 },
    // id:    Integer, matches DOM element #phase-{id}
    // label: Display name in playback bar
    // dwell: Milliseconds before auto-advancing
  ],

  titles: ['...'],             // Title text per phase (length must match phases)
  subtitles: ['...'],          // Subtitle text per phase

  // --- Optional Callbacks ---

  onPhaseEnter: {              // Callbacks when a phase becomes active
    0: (engine) => { ... },    // Keyed by phase id
    2: (engine) => { ... },
  },

  interactions: {              // CinematicDark only — user action simulations
    0: async () => { ... },    // Async functions, run before phase transition
    1: async () => { ... },
  },

  // --- Optional Overrides ---

  loopPause: 1500,             // Ms to pause before restarting loop (default: 1500)
  interactionLeadTime: 1550,   // CinematicDark only — ms before transition to run interaction

  selectors: {                 // Override default DOM selectors
    scene: '#scene',
    card: '#card',
    phaseContainer: '#phase-container',
    phaseTitle: '#phase-title',
    phaseSubtitle: '#phase-subtitle',
    playbackBar: '#playback',
    // ... see engine source for full list
  },

  tokenOverrides: {            // Editorial only — override CSS custom properties
    '--ed-bg-body': '#0a0a0a',
    '--ed-text-primary': '#fff',
  },
}
```

---

## Shared Methods

Every engine exposes these methods:

### Lifecycle

| Method | Description |
|--------|-------------|
| `boot()` | Initialize engine: apply embed mode, measure phases, start playback. Call after DOMContentLoaded. |
| `exposeGlobals()` | Wire `window.togglePlay()`, `window.jumpTo(phase)`, `window.restart()` for HTML onclick handlers. |

### Playback Control

| Method | Description |
|--------|-------------|
| `togglePlay()` | Pause/resume playback. Updates play/pause icon visibility. |
| `jumpTo(phase)` | Jump directly to a phase. Resets animations, transitions, resumes scheduling. |
| `restart()` | Reset to phase 0 and restart playback from the beginning. |
| `scheduleNext()` | Schedule the next phase transition based on current phase's dwell time. Called internally. |

### Phase Transitions

| Method | Description |
|--------|-------------|
| `transitionTo(targetPhase)` | Orchestrate multi-speed transition to target phase. Coordinates container height, title swap, content crossfade, footer swap, playback dots, and phase enter callbacks. |
| `measurePhases()` | Pre-measure all phase heights for smooth height animation. Must run before first transition. |

### Animation Cleanup

| Method | Description |
|--------|-------------|
| `resetAllAnimations()` | Reset all animation state for clean loop replay. Clears timers, resets CSS classes. |
| `clearAllTimers()` | Cancel all pending setTimeout/setInterval timers tracked by the engine. |

### Helpers

| Method | Description |
|--------|-------------|
| `$(selector)` | Shorthand for `document.querySelector()`. |
| `$$(selector)` | Shorthand for `document.querySelectorAll()`. |
| `delay(ms)` | Returns a Promise that resolves after `ms` milliseconds. |
| `pushTimer(fn, ms)` | `setTimeout` that registers for cleanup on reset. Always use this instead of raw `setTimeout`. |
| `applyEmbedMode()` | If `?embed` is in URL, hide controls and make background transparent. |

### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `currentPhase` | `number` | Currently active phase index. |
| `playing` | `boolean` | Whether playback is active. |
| `phaseHeights` | `object` | Pre-measured heights keyed by phase id. |
| `isEmbed` | `boolean` | Whether `?embed` query param is present. |

---

## Personality-Specific Primitives

### CinematicDarkEngine

| Method | Signature | Description |
|--------|-----------|-------------|
| `runFocusStagger` | `(groupName, interval?)` | Blur-to-sharp entrance. Items identified by `data-focus-group` attribute. Default interval: 180ms. |
| `runTypewriter` | `(startDelay?)` | Character-by-character reveal for `.typewriter-text` elements. Text from `data-text` attribute. |
| `runFolderReveal` | `(groupName, interval, startDelay)` | Staggered opacity fade-in for items with `data-folder-group`. |
| `runDrawChecks` | `(phaseSelector, staggerInterval?, startDelay?)` | Self-drawing SVG checkmarks. Targets `.draw-check` elements. |
| `startProgressAnimation` | `(opts?)` | rAF-driven multi-file progress bars with step dots. Options: `fileCount`, `offsets`, `stepThresholds`, `phaseIndex`. |
| `stopProgressAnimation` | `()` | Cancel progress animation and reset bars/dots. |

**HTML data attributes:**
- `data-focus-group="name"` — groups elements for focus-pull stagger
- `data-folder-group="name"` — groups elements for folder reveal
- `data-text="content"` — text content for typewriter reveal
- `data-file="0"` — file index for progress bars
- `data-step="0"` — step index for progress dots

---

### EditorialEngine

| Method | Signature | Description |
|--------|-----------|-------------|
| `runSlideStagger` | `(groupName, interval?)` | Slide-up + fade entrance. Items by `data-stagger-group`. Default: 120ms. |
| `runBlurReveal` | `(groupName, interval?)` | Blur-to-sharp for hero moments. Items by `data-blur-group`. Default: 200ms. |
| `runContentCycle` | `(groupName, intervalMs?)` | Crossfade cycling through items in `data-cycle-group`. Default: 2800ms. |
| `stopContentCycle` | `(groupName)` | Stop cycling for a specific group. |
| `runTabSwitch` | `(tabGroup, tabIndex)` | Highlight active tab and crossfade panel content. |
| `runCountUp` | `(duration?)` | Animate numbers from 0 to target. Elements with `data-count-target`. Default: 800ms. |
| `runTypewriter` | `(selector, startDelay?)` | Character-by-character reveal for a single element. |
| `runAllTypewriters` | `(startDelay?)` | Run all `.typewriter-text` elements with stagger. |
| `applyTokenOverrides` | `()` | Apply `tokenOverrides` config to document root CSS custom properties. |

**Additional helpers:**
- `pushInterval(fn, ms)` — `setInterval` with cleanup tracking.

**HTML data attributes:**
- `data-stagger-group="name"` — groups elements for slide stagger
- `data-blur-group="name"` — groups elements for blur reveal
- `data-cycle-group="name"` — groups elements for content cycling
- `data-tab-group="name"` / `data-tab-panel="name"` — tab/panel pairing
- `data-count-target="42"` — target value for count-up
- `data-count-prefix="$"` — prefix for count-up display
- `data-count-suffix="%"` — suffix for count-up display
- `data-count-decimals="1"` — decimal places for count-up

---

### NeutralLightEngine

| Method | Signature | Description |
|--------|-----------|-------------|
| `runSlideStagger` | `(groupName, interval?)` | Slide-up + fade entrance. Items by `data-slide-group`. Default: 150ms. |
| `runSpotlight` | `(selector, duration?)` | Dim overlay with cutout highlighting target element. Returns Promise. Default: 2000ms. |
| `runCursorTo` | `(x, y, opts?)` | Animate SVG cursor to coordinates. Options: `click` (boolean), `delay` (ms). Returns Promise. |
| `runTooltip` | `(anchorSelector, text, position?, duration?)` | Positioned tooltip near anchor. Position: `'above'` or `'below'`. Returns Promise. Default: 2000ms. |
| `runStepProgress` | `(stepNumber)` | Mark numbered step as done with scale-pop animation. Updates connectors and next step. |

**Additional selectors:**
- `spotlightOverlay: '#spotlight-overlay'` — overlay element for spotlight effect
- `tutorialCursor: '#tutorial-cursor'` — SVG cursor element

**HTML data attributes:**
- `data-slide-group="name"` — groups elements for slide stagger

**HTML elements required:**
- `#spotlight-overlay > .spotlight-cutout` — spotlight overlay with positioned cutout
- `#tutorial-cursor` — SVG cursor element for simulation
- `.tutorial-tooltip > .tutorial-tooltip-text` — tooltip container
- `.step-indicator-dot`, `.step-indicator-label`, `.step-indicator-connector` — step progress UI

---

## Extending: Creating a New Personality

To create a new animation personality:

1. **Create directory:** `.claude/skills/animate/personalities/{personality-name}/`

2. **Required files:**
   - `engine.js` — Engine class extending the shared lifecycle pattern
   - `motion.css` — Animation classes, keyframes, easing, timing (mode-independent)
   - `modes/dark.css` / `modes/light.css` — Color tokens per mode
   - `PERSONALITY.md` — Rules, decision tree, timing guide
   - `reference.html` — Canonical example demonstrating all primitives

3. **Engine must implement:**
   - Constructor accepting the config schema above
   - `boot()`, `exposeGlobals()`, `measurePhases()`
   - `transitionTo(phase)`, `scheduleNext()`, `togglePlay()`, `jumpTo()`, `restart()`
   - `resetAllAnimations()`, `clearAllTimers()`
   - `applyEmbedMode()`
   - At least 2-3 personality-specific animation primitives

4. **Register in SKILL.md:** Add theme entry to the animate skill's theme table and document the engine usage pattern.

5. **Follow conventions:**
   - Use `pushTimer()` instead of raw `setTimeout` (ensures cleanup on reset)
   - Track all intervals and rAFs for cleanup
   - Support `?embed` query parameter
   - Export for both module and script-tag usage

---

## Related Documentation

- `.claude/skills/animate/SKILL.md` — Full animate skill reference
- `.claude/skills/animate/reference/animation-principles.md` — Disney's 12 principles for UI
- `.claude/skills/animate/reference/spring-physics.md` — Spring recipes and patterns
- `docs/design-patterns/motion-design-system.md` — Motion design taxonomy
- `docs/process/capture-guide.md` — Capture pipeline for recording to video
