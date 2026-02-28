# Animation Primitives Registry

Master lookup table of named animation effects. Consult this when generating prototypes or autoplay animations to select personality-appropriate effects.

**How to use:** Filter by category and personality affinity. Each primitive has an ID, source, and CSS implementation.

---

## Quick Reference by Category

### Entrances

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `cd-focus-stagger` | Focus Pull Stagger | 180ms interval | cinematic-dark | engine |
| `cd-typewriter` | Typewriter Reveal | 28-50ms/char | cinematic-dark, editorial | engine |
| `ed-slide-stagger` | Slide + Fade Stagger | 120ms interval | editorial | engine |
| `ed-blur-reveal` | Blur-to-Sharp Reveal | 200ms interval | editorial | engine |
| `nl-slide-stagger` | Slide + Fade Stagger (Light) | 150ms interval | neutral-light | engine |
| `ct-focus-pull` | Focus Pull | 800ms | cinematic-dark | research |
| `ct-zoom-from-space` | Zoom From Space | 1800ms | cinematic-dark | research |
| `ct-dolly-zoom` | Dolly Zoom (Vertigo) | 2000ms | cinematic-dark | research |
| `ct-text-hero` | Dramatic Text Scale | 1200ms | cinematic-dark | research |
| `ct-char-stagger` | Per-Character Stagger | 30ms/char | cinematic-dark, editorial | research |
| `as-fadeIn` | Fade In | 400ms | universal | animate.style |
| `as-fadeInUp` | Fade In Up | 500ms | editorial, neutral-light | animate.style |
| `as-fadeInDown` | Fade In Down | 500ms | editorial, neutral-light | animate.style |
| `as-fadeInLeft` | Fade In Left | 500ms | editorial | animate.style |
| `as-fadeInRight` | Fade In Right | 500ms | editorial | animate.style |
| `as-slideInUp` | Slide In Up | 500ms | universal | animate.style |
| `as-slideInDown` | Slide In Down | 500ms | universal | animate.style |
| `as-slideInLeft` | Slide In Left | 500ms | universal | animate.style |
| `as-slideInRight` | Slide In Right | 500ms | universal | animate.style |
| `as-zoomIn` | Zoom In | 500ms | cinematic-dark | animate.style |
| `nl-field-reveal` | Form Field Height Reveal | 300ms | neutral-light | breakdown |
| `bk-chat-typewriter-submit` | Chat Input Typewriter → Bubble | ~2400ms | editorial, cinematic-dark | breakdown |
| `bk-report-card-materialize` | Document Report Card Entrance | 500ms | editorial, cinematic-dark | breakdown |
| `mo-scale-entrance` | Scale Entrance | 100ms interval | montage | engine |
| `mo-text-hero` | Text Hero Entrance | 400ms | montage | engine |
| `mo-stat-reveal` | Stat Reveal Pop | 150ms interval | montage | engine |

### Exits

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `as-fadeOut` | Fade Out | 300ms | universal | animate.style |
| `as-fadeOutUp` | Fade Out Up | 400ms | editorial, neutral-light | animate.style |
| `as-fadeOutDown` | Fade Out Down | 400ms | editorial | animate.style |
| `as-zoomOut` | Zoom Out | 400ms | cinematic-dark | animate.style |

### Attention Seekers

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `nl-spotlight` | Element Spotlight | 2000ms | neutral-light | engine |
| `nl-tooltip` | Positioned Tooltip | 2000ms | neutral-light | engine |
| `as-pulse` | Pulse | 1000ms | universal | animate.style |
| `as-headShake` | Head Shake | 1000ms | neutral-light | animate.style |
| `as-tada` | Tada | 1000ms | neutral-light | animate.style |

### Reveals / Staggers

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `cd-folder-reveal` | Folder Badge Stagger | configurable | cinematic-dark | engine |
| `cd-draw-checks` | Self-Drawing Checkmarks | 200ms stagger | cinematic-dark | engine |
| `ed-all-typewriters` | Batch Typewriter | 500ms stagger | editorial | engine |
| `ct-iris-open` | Iris Open (Circle Reveal) | 800ms | cinematic-dark | research |
| `ct-wipe-reveal` | Horizontal Wipe | 600ms | cinematic-dark | research |
| `ct-diamond-reveal` | Diamond Reveal | 700ms | cinematic-dark | research |
| `ct-text-sweep` | Text Clip-Path Sweep | 800ms | cinematic-dark, editorial | research |
| `ct-bars-reveal` | Staggered Bars Reveal | 1200ms | cinematic-dark | research |
| `bk-distance-stagger` | Distance-Based Stagger | variable | universal | breakdown |
| `bk-grid-flip-cascade` | Grid Flip Cascade | 80ms interval | editorial | breakdown |
| `bk-arc-cascade` | Arc Stagger Entrance | 80ms interval | cinematic-dark | breakdown |
| `bk-bidirectional-stagger` | Bidirectional Stagger | variable | universal | breakdown |
| `bk-content-line-stagger` | Content Line Stagger w/ Brightness | 100ms interval | cinematic-dark, editorial | breakdown |
| `nl-completion-stagger` | Completion Card Stagger | 80ms interval | neutral-light | breakdown |
| `nl-list-row-stagger` | List Row Stagger | 70ms interval | neutral-light | breakdown |
| `nl-staggered-card-entrance` | Staggered Card Entrance | 100ms interval | neutral-light | breakdown |
| `nl-provider-button-stagger` | Branded Button Stack Stagger | 120ms interval | neutral-light | breakdown |
| `nl-segmented-code-input` | Segmented Code Input | 60ms interval | neutral-light | breakdown |
| `bk-suggestion-chip-stagger` | Action Suggestion Chip Stack | 150ms interval | editorial, cinematic-dark | breakdown |
| `bk-table-row-stagger` | Data Table Row Reveal | 80ms interval | editorial, neutral-light | breakdown |
| `mo-grid-reveal` | Grid Reveal | 80ms interval | montage | engine |
| `mo-split-screen` | Split-Screen Reveal | 200ms stagger | montage | engine |

### Continuous / Ambient

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `cd-progress-animation` | Multi-File Progress | phase dwell | cinematic-dark | engine |
| `ed-content-cycle` | Content Cycling | 2800ms/item | editorial | engine |
| `ct-float` | Zero-Gravity Float | 6000ms loop | cinematic-dark | research |
| `bk-grid-wave` | Grid Wave Propagation | ~2000ms/wave | cinematic-dark | breakdown |
| `ct-glow-pulse` | Ambient Glow Pulse | 4000ms loop | cinematic-dark | research |
| `ct-font-breathe` | Variable Font Breathe | 3000ms loop | cinematic-dark | research |
| `bk-sparse-breathe` | Sparse Grid Breathing | 4000ms loop | universal | breakdown |
| `bk-nl-dot-breathe` | Light Palette Dot Grid Breathing | 4500ms loop | neutral-light | breakdown |
| `bk-flow-field` | Flow Field Vortex | continuous | cinematic-dark | breakdown |
| `ct-scene-breathe` | Scene Breathing | 8000ms loop | cinematic-dark, editorial | research |
| `ct-ambient-drift` | Ambient Camera Drift | 12000ms loop | cinematic-dark, editorial | research |
| `ct-element-float` | Element Float | 6000ms loop | cinematic-dark | research |
| `ct-slow-push` | Slow Push-In (Ambient) | 6000ms | cinematic-dark, editorial | research |
| `ed-scene-breathe` | Editorial Scene Breathing | 10000ms loop | editorial | research |
| `nl-scene-breathe` | Neutral Scene Breathing | 12000ms loop | neutral-light | research |

### Content Effects

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `ed-count-up` | Animated Number Count | 800ms | editorial, neutral-light | engine |
| `nl-step-progress` | Step Indicator Update | 450ms | neutral-light | engine |
| `nl-progress-dots` | Progress Dot Indicator | 150ms per dot | neutral-light | breakdown |
| `ct-word-carousel` | Word Carousel | 8000ms cycle | editorial | research |
| `bk-text-image-split` | Image Breathing Between Text | 3200ms cycle | editorial | breakdown |
| `bk-ai-response-stream` | AI Response Word-Group Streaming | ~120ms/chunk | editorial, neutral-light | breakdown |
| `bk-stat-card-count-up` | Metric Card Stagger + Count-Up | 200ms interval | editorial, neutral-light | breakdown |
| `bk-scroll-trigger-typewriter` | Scroll-Triggered Typewriter w/ Pre-Blink | 50ms/char | editorial, universal | breakdown |

### Interactions

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `ed-tab-switch` | Tab Highlight + Crossfade | CSS transition | editorial | engine |
| `nl-cursor-to` | Simulated Cursor | 600ms movement | neutral-light | engine |
| `bk-spring-card-hover` | Spring Card Hover | 200ms | universal | breakdown |
| `nl-card-select` | Card Selection State | 150ms | neutral-light | breakdown |
| `nl-radio-card-select` | Radio Card Selection | 150ms | neutral-light | breakdown |
| `nl-tag-pill-select` | Tag Pill Selection | 150ms | neutral-light | breakdown |
| `nl-button-activate` | Button Activation State | 150ms | neutral-light | breakdown |
| `nl-button-loading-swap` | Button Loading Demotion | 200ms | neutral-light | breakdown |
| `nl-inline-expand` | Inline Expand Reveal | 300ms | neutral-light | breakdown |

### Transitions (Phase-Level)

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `cd-phase-transition` | Cinematic Phase Change | multi-speed | cinematic-dark | engine |
| `ed-phase-transition` | Editorial Phase Change | multi-speed | editorial | engine |
| `nl-phase-transition` | Neutral Phase Change | multi-speed | neutral-light | engine |
| `mo-phase-transition` | Montage Phase Change | per-phase | montage | engine |
| `mo-hard-cut` | Hard Cut (Instant) | 0ms | montage | engine |
| `mo-whip-wipe` | Whip-Wipe (Directional) | 250ms | montage | engine |
| `ct-camera-dolly` | Camera Dolly Forward | 1400ms | cinematic-dark | research |
| `ct-camera-pan` | Camera Pan | 1200ms | cinematic-dark | research |
| `ct-camera-tilt` | Camera Tilt Reveal | 1200ms | cinematic-dark | research |
| `ct-camera-orbit` | Camera Orbit | 1200ms | cinematic-dark | research |
| `ct-camera-truck` | Camera Truck (Lateral) | 1200ms | cinematic-dark | research |
| `ct-camera-pedestal` | Camera Pedestal (Vertical) | 1200ms | cinematic-dark | research |
| `ct-camera-crane` | Camera Crane Shot | 1800ms | cinematic-dark | research |
| `ct-camera-arc` | Camera Arc Move | 1600ms | cinematic-dark | research |
| `ct-camera-push-in` | Slow Camera Push-In | 3000ms | cinematic-dark, editorial | research |
| `ct-camera-pull-out` | Camera Pull-Out Reveal | 2000ms | cinematic-dark | research |
| `ct-camera-rack-focus` | Rack Focus Shift | 800ms | cinematic-dark | research |
| `ct-camera-handheld` | Handheld Drift | 6000ms loop | cinematic-dark | research |
| `ct-camera-shake` | Camera Shake | 800ms | cinematic-dark | research |
| `ed-camera-push-in` | Editorial Slow Push-In | 6000ms | editorial | research |
| `ed-camera-drift` | Editorial Ambient Drift | 12000ms loop | editorial | research |
| `bk-bars-scatter` | Horizontal Scatter & Reconverge | 3400ms cycle | cinematic-dark | breakdown |
| `bk-icon-to-layout` | Icon-to-Layout Morph | ~1000ms build | cinematic-dark | breakdown |
| `nl-wizard-step-crossfade` | Wizard Step Crossfade | 300-400ms | neutral-light | breakdown |
| `nl-phase-crossfade` | Phase Content Crossfade | 300ms | neutral-light | breakdown |
| `nl-loading-gate` | Loading Gate Interstitial | 500-650ms | neutral-light | breakdown |
| `nl-app-materialize` | Onboarding-to-App Dissolve | 600ms stagger | neutral-light | breakdown |
| `bk-chat-to-split-pane` | Single-to-Dual Pane Split | 600ms | editorial | breakdown |
| `bk-panel-content-swap` | Dashboard Panel Interior Crossfade | 500ms | editorial, neutral-light | breakdown |

### Typography

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `ct-text-hero` | Dramatic Scale Entrance | 1200ms | cinematic-dark | research |
| `ct-char-stagger` | Per-Character Stagger | 30ms/char | cinematic-dark, editorial | research |
| `ct-text-sweep` | Text Clip-Path Sweep | 800ms | cinematic-dark, editorial | research |
| `ct-word-carousel` | Word Carousel | 8000ms cycle | editorial | research |
| `ct-font-breathe` | Variable Font Breathe | 3000ms loop | cinematic-dark | research |
| `cd-typewriter` | Typewriter Reveal | 28-50ms/char | cinematic-dark, editorial | engine |
| `bk-text-parallax-stack` | Text Parallax Stack | 3000ms cycle | cinematic-dark | breakdown |
| `bk-text-image-split` | Image Breathing Between Text | 3200ms cycle | editorial | breakdown |
| `bk-chat-typewriter-submit` | Chat Input Typewriter → Bubble | ~2400ms | editorial, cinematic-dark | breakdown |
| `bk-scroll-trigger-typewriter` | Scroll-Triggered Typewriter w/ Pre-Blink | 50ms/char | editorial, universal | breakdown |

> **Note:** Typography entries duplicate some IDs from Entrances, Reveals, Content Effects, and Continuous categories above. This section is a cross-reference view for personality-filtered lookups.

---

## Personality Quick Filters

### Cinematic Dark — Drama and Impact

Best entrances: `cd-focus-stagger`, `ct-focus-pull`, `ct-zoom-from-space`, `as-zoomIn`, `bk-chat-typewriter-submit`, `bk-report-card-materialize`
Best reveals: `ct-iris-open`, `ct-wipe-reveal`, `ct-bars-reveal`, `bk-arc-cascade`, `bk-content-line-stagger`, `bk-suggestion-chip-stagger`
Best ambient: `ct-float`, `ct-glow-pulse`, `cd-progress-animation`, `bk-flow-field`, `ct-scene-breathe`, `ct-ambient-drift`, `ct-element-float`, `ct-slow-push`
Best camera: `ct-camera-dolly`, `ct-camera-orbit`, `ct-camera-crane`, `ct-camera-push-in`, `ct-camera-rack-focus`, `ct-camera-handheld`, `ct-camera-shake`
Best transitions: `cd-phase-transition`, `ct-camera-dolly`, `ct-camera-orbit`, `bk-bars-scatter`, `bk-icon-to-layout`
Best typography: `ct-text-hero`, `ct-char-stagger`, `cd-typewriter`

### Editorial — Content-Forward Restraint

Best entrances: `ed-slide-stagger`, `ed-blur-reveal`, `as-fadeInUp`, `as-fadeInLeft`, `bk-report-card-materialize`
Best reveals: `ct-text-sweep`, `ed-all-typewriters`, `bk-suggestion-chip-stagger`, `bk-table-row-stagger`
Best ambient: `ed-content-cycle`, `ed-scene-breathe`, `ed-camera-push-in`, `ed-camera-drift`, `ct-slow-push`
Best camera: `ed-camera-push-in`, `ed-camera-drift`, `ct-camera-push-in`
Best content: `ed-count-up`, `ct-word-carousel`, `bk-text-image-split`, `bk-ai-response-stream`, `bk-stat-card-count-up`
Best transitions: `ed-phase-transition`, `ed-tab-switch`, `bk-chat-to-split-pane`, `bk-panel-content-swap`
Best typography: `cd-typewriter`, `ct-text-sweep`, `bk-text-image-split`, `bk-chat-typewriter-submit`, `bk-scroll-trigger-typewriter`

### Neutral Light — Clean and Guided

Best entrances: `nl-slide-stagger`, `as-fadeInUp`, `nl-field-reveal`, `nl-staggered-card-entrance`, `nl-completion-stagger`
Best attention: `nl-spotlight`, `nl-tooltip`, `nl-progress-dots`
Best ambient: `bk-sparse-breathe`, `bk-nl-dot-breathe`, `nl-scene-breathe`
Best camera: `nl-spotlight`, `nl-cursor-to`
Best content: `nl-step-progress`, `ed-count-up`, `nl-progress-dots`, `bk-ai-response-stream`, `bk-stat-card-count-up`
Best interactions: `nl-cursor-to`, `nl-card-select`, `nl-radio-card-select`, `nl-button-activate`, `nl-tag-pill-select`
Best transitions: `nl-phase-transition`, `nl-wizard-step-crossfade`, `nl-phase-crossfade`, `nl-app-materialize`, `nl-loading-gate`, `bk-panel-content-swap`
Best stagger: `nl-list-row-stagger`, `nl-provider-button-stagger`, `nl-segmented-code-input`, `bk-table-row-stagger`

### Montage — Rapid-Scene Energy

Best entrances: `mo-scale-entrance`, `mo-text-hero`, `mo-stat-reveal`
Best reveals: `mo-grid-reveal`, `mo-split-screen`
Best transitions: `mo-phase-transition`, `mo-hard-cut`, `mo-whip-wipe`
Best content: `ed-count-up` (reused for stat count-ups)
Best typography: `mo-text-hero`

---

## Detail Blocks — Research Primitives (CSS)

Full CSS implementations for effects extracted from cinematic-techniques-research.md.

### `ct-focus-pull` — Focus Pull Entrance

```css
@keyframes focus-pull {
  0% { filter: blur(12px); opacity: 0; transform: scale(0.95); }
  50% { filter: blur(3px); opacity: 0.8; }
  100% { filter: blur(0); opacity: 1; transform: scale(1); }
}
.focus-pull { animation: focus-pull 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
```

### `ct-zoom-from-space` — Zoom From Space Entrance

```css
@keyframes zoom-from-space {
  0% { transform: perspective(1000px) translateZ(-2000px) scale(0.1); opacity: 0; filter: blur(20px); }
  40% { opacity: 1; filter: blur(4px); }
  100% { transform: perspective(1000px) translateZ(0) scale(1); filter: blur(0); }
}
.zoom-from-space { animation: zoom-from-space 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
```

### `ct-dolly-zoom` — Dolly Zoom (Vertigo Effect)

```css
@keyframes dolly-zoom {
  0% { transform: perspective(600px) scale(0.7) translateZ(0); }
  100% { transform: perspective(1800px) scale(1.0) translateZ(0); }
}
.dolly-zoom { animation: dolly-zoom 2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
```

### `ct-iris-open` — Circle Reveal

```css
@keyframes iris-open {
  from { clip-path: circle(0% at 50% 50%); }
  to { clip-path: circle(75% at 50% 50%); }
}
.iris-open { animation: iris-open 800ms ease-out forwards; }
```

### `ct-wipe-reveal` — Horizontal Wipe

```css
@keyframes wipe-reveal {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}
.wipe-reveal { animation: wipe-reveal 600ms ease-out forwards; }
```

### `ct-diamond-reveal` — Diamond Reveal

```css
@keyframes diamond-reveal {
  from { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); }
  to { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
}
.diamond-reveal { animation: diamond-reveal 700ms ease-out forwards; }
```

### `ct-text-sweep` — Text Clip-Path Sweep

```css
@keyframes text-sweep {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}
.text-sweep { animation: text-sweep 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
```

### `ct-bars-reveal` — Staggered Bars Reveal

```css
/* Simplified — uses pseudo-element with linear-gradient bars */
.bars-reveal::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to right,
    var(--bg) 0 calc(100% / 7),
    transparent calc(100% / 7)
  );
  animation: bars-wipe 1.2s steps(7) forwards;
}
@keyframes bars-wipe { to { opacity: 0; } }
```

### `ct-text-hero` — Dramatic Text Scale Entrance

```css
@keyframes text-hero-entrance {
  0% { transform: scale(3); opacity: 0; filter: blur(8px); letter-spacing: 0.5em; }
  60% { filter: blur(0); letter-spacing: 0.02em; }
  100% { transform: scale(1); opacity: 1; letter-spacing: normal; }
}
.text-hero { animation: text-hero-entrance 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
```

### `ct-char-stagger` — Per-Character Stagger

```css
.char {
  opacity: 0;
  transform: translateY(20px) rotateX(-20deg);
  animation: char-enter 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(var(--char-index) * 30ms);
}
@keyframes char-enter {
  to { opacity: 1; transform: translateY(0) rotateX(0deg); }
}
```

### `ct-float` — Zero-Gravity Float

```css
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(0.5deg); }
  75% { transform: translateY(4px) rotate(-0.3deg); }
}
.float { animation: float 6s ease-in-out infinite; }
/* Stagger children with different durations for organic feel */
.float:nth-child(2) { animation-delay: -1.5s; animation-duration: 7s; }
.float:nth-child(3) { animation-delay: -3s; animation-duration: 5.5s; }
```

### `ct-glow-pulse` — Ambient Glow

```css
@keyframes glow-pulse {
  from { opacity: 0.4; transform: scale(0.9); }
  to { opacity: 0.7; transform: scale(1.1); }
}
.glow-pulse {
  background: radial-gradient(ellipse at 50% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 60%);
  filter: blur(80px);
  animation: glow-pulse 4s ease-in-out infinite alternate;
}
```

### `ct-font-breathe` — Variable Font Weight Morph

```css
@keyframes font-breathe {
  0% { font-variation-settings: "wght" 100; }
  50% { font-variation-settings: "wght" 900; }
  100% { font-variation-settings: "wght" 100; }
}
.font-breathe {
  font-family: 'Inter Variable', sans-serif;
  animation: font-breathe 3s ease-in-out infinite;
}
```

### `ct-word-carousel` — Word Carousel

```css
.word-carousel {
  overflow: hidden;
  height: 1.2em;
  display: inline-block;
  vertical-align: bottom;
}
.word-carousel .word-list {
  animation: word-cycle 8s ease-in-out infinite;
}
@keyframes word-cycle {
  0%, 18% { transform: translateY(0); }
  20%, 38% { transform: translateY(-1.2em); }
  40%, 58% { transform: translateY(-2.4em); }
  60%, 78% { transform: translateY(-3.6em); }
  80%, 98% { transform: translateY(-4.8em); }
  100% { transform: translateY(0); }
}
```

### Camera Motion Primitives

```css
/* Camera Rig — apply to parent container */
.camera-rig {
  perspective: 1200px;
  perspective-origin: 50% 40%;
  transform-style: preserve-3d;
}
.camera-rig .scene {
  transform-style: preserve-3d;
  transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ct-camera-dolly — Push forward into content */
.scene.dolly-forward { transform: translateZ(200px); }

/* ct-camera-pan — Pan right with slight push */
.scene.pan-right { transform: translateX(-300px) translateZ(50px); }

/* ct-camera-tilt — Tilt down to reveal */
.scene.tilt-down { transform: rotateX(8deg) translateY(-40px); }

/* ct-camera-orbit — Orbit around content */
.scene.orbit { transform: rotateY(15deg) rotateX(5deg); }
```

### `ct-camera-truck` — Camera Truck (Lateral Movement)

```css
/* Truck right — lateral movement revealing adjacent content */
@keyframes camera-truck-right {
  0% { transform: translateX(0) translateZ(30px); }
  100% { transform: translateX(-250px) translateZ(30px); }
}
.scene.truck-right {
  animation: camera-truck-right 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
/* Truck left: use translateX(250px). Slight Z push adds depth. */
```

### `ct-camera-pedestal` — Camera Pedestal (Vertical Movement)

```css
/* Pedestal up — vertical rise revealing content below */
@keyframes camera-pedestal-up {
  0% { transform: translateY(0); }
  100% { transform: translateY(150px); }
}
.scene.pedestal-up {
  animation: camera-pedestal-up 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
/* Pedestal down: use negative translateY. Combine with slight scale for crane feel. */
```

### `ct-camera-crane` — Camera Crane Shot

```css
/* Crane: combined vertical rise + depth push + slight tilt */
@keyframes camera-crane {
  0% { transform: translateY(0) translateZ(0) rotateX(0deg); }
  60% { transform: translateY(120px) translateZ(100px) rotateX(-2deg); }
  100% { transform: translateY(180px) translateZ(150px) rotateX(-4deg); }
}
.scene.crane-up {
  animation: camera-crane 1800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### `ct-camera-arc` — Camera Arc Move

```css
/* Arc: curved movement path around content */
@keyframes camera-arc {
  0% { transform: rotateY(-10deg) translateX(50px) translateZ(0); }
  50% { transform: rotateY(0deg) translateX(0) translateZ(80px); }
  100% { transform: rotateY(10deg) translateX(-50px) translateZ(0); }
}
.scene.arc-move {
  animation: camera-arc 1600ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
}
```

### `ct-camera-push-in` — Slow Camera Push-In

```css
/* Slow push-in: builds tension, focuses attention. Works for CD (3D) and ED (scale). */

/* Cinematic Dark version (3D dolly) */
@keyframes camera-push-in-3d {
  0% { transform: translateZ(0); }
  100% { transform: translateZ(120px); }
}
.camera-rig .scene.push-in {
  animation: camera-push-in-3d 3000ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

/* Editorial version (2D scale) */
@keyframes camera-push-in-2d {
  0% { transform: scale(1); }
  100% { transform: scale(1.02); }
}
.ed-scene.push-in {
  animation: camera-push-in-2d 6000ms ease-in-out forwards;
}
```

### `ct-camera-pull-out` — Camera Pull-Out Reveal

```css
/* Pull-out: reveals full context, used for resolution/completion */
@keyframes camera-pull-out {
  0% { transform: translateZ(150px) scale(1.05); }
  100% { transform: translateZ(0) scale(1); }
}
.scene.pull-out {
  animation: camera-pull-out 2000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### `ct-camera-rack-focus` — Rack Focus Shift

```css
/* Rack focus: shifts sharp focus between foreground and background layers */
/* Apply to the layer LOSING focus */
@keyframes rack-blur-out {
  0% { filter: blur(0); opacity: 1; }
  100% { filter: blur(4px); opacity: 0.5; }
}
/* Apply to the layer GAINING focus */
@keyframes rack-blur-in {
  0% { filter: blur(4px); opacity: 0.5; }
  100% { filter: blur(0); opacity: 1; }
}
.layer.rack-out { animation: rack-blur-out 800ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards; }
.layer.rack-in { animation: rack-blur-in 800ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards; }
```

### `ct-camera-handheld` — Handheld Drift

```css
/* Handheld: subtle organic movement simulating a real camera operator */
@keyframes handheld-drift {
  0% { transform: translate(0, 0) rotate(0deg); }
  15% { transform: translate(1.2px, -0.8px) rotate(0.15deg); }
  30% { transform: translate(-0.5px, 1px) rotate(-0.1deg); }
  45% { transform: translate(0.8px, 0.3px) rotate(0.08deg); }
  60% { transform: translate(-1px, -0.5px) rotate(-0.12deg); }
  75% { transform: translate(0.3px, 0.8px) rotate(0.05deg); }
  90% { transform: translate(-0.6px, -0.3px) rotate(-0.08deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
.scene.handheld {
  animation: handheld-drift 6000ms ease-in-out infinite;
}
```

### `ct-camera-shake` — Camera Shake (Tension Enhancer)

```css
/* Camera shake: randomized micro-transforms with exponential decay.
   Max amplitude 3px, frequency 0.5-2Hz. Cinematic Dark only. */
@keyframes camera-shake {
  0%   { transform: translate(0, 0) rotate(0deg); }
  10%  { transform: translate(2px, -1.5px) rotate(0.3deg); }
  20%  { transform: translate(-2.5px, 1px) rotate(-0.2deg); }
  30%  { transform: translate(1.5px, 2px) rotate(0.15deg); }
  40%  { transform: translate(-1px, -1.5px) rotate(-0.25deg); }
  50%  { transform: translate(1.8px, 0.5px) rotate(0.1deg); }
  60%  { transform: translate(-0.8px, 1.2px) rotate(-0.1deg); }
  70%  { transform: translate(0.5px, -0.8px) rotate(0.05deg); }
  80%  { transform: translate(-0.3px, 0.3px) rotate(-0.03deg); }
  90%  { transform: translate(0.1px, -0.1px) rotate(0.01deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
.scene.camera-shake {
  animation: camera-shake 800ms linear forwards;
}
/* Exponential decay baked into keyframe amplitudes.
   Combine with ct-camera-push-in for tension build. */
```

### `ed-camera-push-in` — Editorial Slow Push-In (2D)

```css
/* Editorial push-in: 2D scale only, very slow, barely perceptible */
@keyframes ed-push-in {
  0% { transform: scale(1); }
  100% { transform: scale(1.01); }
}
.ed-scene.push-in {
  animation: ed-push-in 6000ms ease-in-out forwards;
}
/* Max 1% scale change. Anything more breaks editorial restraint. */
```

### `ed-camera-drift` — Editorial Ambient Drift (2D)

```css
/* Editorial drift: subtle 2D translation, no rotation, no 3D */
@keyframes ed-drift {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(0.5px, -0.3px); }
  50% { transform: translate(-0.3px, 0.5px); }
  75% { transform: translate(0.2px, 0.2px); }
}
.ed-scene.drift {
  animation: ed-drift 12000ms ease-in-out infinite;
}
/* Max 1px translation. Rotation forbidden in editorial. */
```

### Ambient Micro-Movement Primitives

### `ct-scene-breathe` — Scene Breathing

```css
/* Scene-level breathing: entire composition pulses subtly */
@keyframes scene-breathe-cd {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.004); }
}
.scene.breathe-cd {
  animation: scene-breathe-cd 8000ms ease-in-out infinite;
}
```

### `ct-ambient-drift` — Ambient Camera Drift

```css
/* Ambient drift: scene-level subtle positional shift */
@keyframes ambient-drift-cd {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(1.5px, -1px); }
  50% { transform: translate(-1px, 1.5px); }
  75% { transform: translate(0.5px, 0.5px); }
}
.scene.ambient-drift {
  animation: ambient-drift-cd 12000ms ease-in-out infinite;
}
```

### `ct-element-float` — Element Float

```css
/* Individual element float: organic independent movement */
@keyframes element-float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-5px) rotate(0.3deg); }
  75% { transform: translateY(3px) rotate(-0.2deg); }
}
/* Stagger children with different durations */
.float-item:nth-child(1) { animation: element-float 6000ms ease-in-out infinite; }
.float-item:nth-child(2) { animation: element-float 7000ms ease-in-out infinite -1500ms; }
.float-item:nth-child(3) { animation: element-float 5500ms ease-in-out infinite -3000ms; }
```

### `ct-slow-push` — Slow Push-In (Ambient)

```css
/* Ambient push-in: imperceptible scale increase over time */
@keyframes slow-push-ambient {
  0% { transform: scale(1); }
  100% { transform: scale(1.015); }
}
.scene.slow-push {
  animation: slow-push-ambient 6000ms ease-in-out forwards;
}
/* CD: 1.5% max. ED: 0.5-1% max. NL: not used. */
```

### `ed-scene-breathe` — Editorial Scene Breathing

```css
/* Editorial breathing: even more subtle than cinematic-dark */
@keyframes scene-breathe-ed {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.002); }
}
.ed-scene.breathe {
  animation: scene-breathe-ed 10000ms ease-in-out infinite;
}
/* 0.2% max scale change — barely perceptible */
```

### `nl-scene-breathe` — Neutral Light Scene Breathing

```css
/* Neutral Light breathing: near-zero, only for long-running scenes (>10s) */
@keyframes scene-breathe-nl {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.001); }
}
.nl-scene.breathe {
  animation: scene-breathe-nl 12000ms ease-in-out infinite;
}
/* 0.1% max. Use only when scene runs >10 seconds. Prefer stillness. */
```

---

## Detail Blocks — Breakdown Primitives (CSS)

Full CSS implementations for effects extracted from reference breakdowns.

### `bk-sparse-breathe` — Sparse Grid Breathing

```css
@keyframes sparse-breathe {
  0%, 100% { transform: scale(0.6); opacity: 0.5; }
  50% { transform: scale(1.0); opacity: 0.9; }
}
.dot {
  width: 4px; height: 4px; border-radius: 50%; background: currentColor;
  animation: sparse-breathe var(--breathe-duration, 4000ms) ease-in-out infinite;
  animation-delay: var(--breathe-offset, 0ms);
}
/* Phase decorrelation: offset = (row + col) * 300 + random(0, 400)ms */
/* Duration jitter: 3600-4400ms per dot prevents phase-locking */
```

### `bk-icon-to-layout` — Icon-to-Layout Morph

```css
/* Phase 1: Icon fades while layout rectangle expands from center */
@keyframes icon-fade { 0% { opacity: 1; } 40%, 100% { opacity: 0; } }
@keyframes layout-expand {
  0% { transform: scale(0.2); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.icon-glyph { animation: icon-fade 400ms ease-out forwards; }
.layout-container { animation: layout-expand 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }

/* Phase 2: Content lines stagger in with brightness cascade */
.content-line {
  opacity: 0; transform: translateX(-8px);
  animation: line-reveal 300ms ease-out forwards;
  animation-delay: calc(var(--line-index) * 100ms + 400ms);
}
@keyframes line-reveal {
  0% { opacity: 0; transform: translateX(-8px); }
  100% { opacity: var(--line-brightness, 1); transform: translateX(0); }
}
/* Per-line brightness: 1.0, 1.0, 0.9, 0.7, 0.8, 0.5 (cascade) */
```

### `bk-content-line-stagger` — Content Line Stagger with Brightness Cascade

```css
.content-line {
  --line-width: 80%;
  width: var(--line-width);
  height: 3px;
  background: white;
  opacity: 0;
  animation: line-enter 300ms ease-out forwards;
  animation-delay: calc(var(--line-index) * 100ms);
}
@keyframes line-enter {
  0% { opacity: 0; transform: translateX(-8px); }
  100% { opacity: var(--line-brightness, 1); transform: translateX(0); }
}
/* Brightness descends per line: nth-child(1) 1.0, (2) 1.0, (3) 0.9, (4) 0.7, (5) 0.8, (6) 0.5 */
/* Width varies per line for visual rhythm: 70%, 85%, 65%, 90%, 75%, 55% */
```

### `bk-nl-dot-breathe` — Light Palette Dot Grid Breathing

```css
@keyframes nl-dot-breathe {
  0%, 100% { transform: scale(0.7); opacity: 0.35; }
  50% { transform: scale(1.0); opacity: 0.6; }
}
.nl-dot {
  width: 3px; height: 3px; border-radius: 50%;
  background: var(--nl-text-tertiary, #78716c);
  animation: nl-dot-breathe var(--breathe-duration, 4500ms) ease-in-out infinite;
  animation-delay: var(--breathe-offset, 0ms);
}
/* Phase decorrelation: offset = (row + col) * 200 + random(0, 500)ms */
/* Duration jitter: 4200-4800ms per dot prevents phase-locking */
/* Grid: 9x9, gap 40px, on --nl-bg-body (#fafaf9) */
```

### `bk-arc-cascade` — Arc Stagger Entrance

```css
.arc {
  opacity: 0;
  transform: scale(0.3) rotate(calc(var(--arc-rotation, 0) * 1deg));
  animation: arc-enter 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(var(--arc-index) * 80ms);
}
@keyframes arc-enter {
  0% { opacity: 0; transform: scale(0.3) rotate(calc(var(--arc-rotation, 0) * 1deg)); }
  40% { opacity: 1; }
  100% { opacity: 0.85; transform: scale(1) rotate(calc(var(--arc-rotation, 0) * 1deg)); }
}
/* Exit: reverse stagger (bottom-to-top), tighter interval (60ms), ease-in */
```

### `bk-text-image-split` — Image Breathing Between Text

```css
@keyframes image-breathe {
  0%, 100% { height: 60px; }
  50% { height: 200px; }
}
@keyframes image-crop-shift {
  0%, 100% { object-position: 50% 40%; }
  50% { object-position: 50% 55%; }
}
@keyframes tracking-breathe {
  0%, 100% { letter-spacing: 0.01em; }
  50% { letter-spacing: 0.06em; }
}
.image-window { animation: image-breathe 3200ms ease-in-out infinite; }
.image-window img { animation: image-crop-shift 3200ms ease-in-out infinite; }
.text-block { animation: tracking-breathe 3200ms ease-in-out infinite; }
```

### `bk-flow-field` — Flow Field Vortex

```css
.flow-segment {
  position: absolute;
  width: var(--seg-length, 20px); height: 1px;
  background: white;
  opacity: var(--seg-opacity, 0.5);
  transform: rotate(var(--seg-angle, 0deg));
  transition: transform 100ms linear;
}
/* JS drives --seg-angle per segment via requestAnimationFrame:
   angle = atan2(dy, dx) + PI/2 + noise
   opacity = 0.3 + influence * 0.6
   Attractor drifts on Lissajous path (3000ms cycle) */
```

### `bk-bars-scatter` — Horizontal Scatter & Reconverge

```css
.bar {
  width: 3px; height: var(--bar-height, 60px);
  background: white; position: absolute;
  left: var(--bar-target, 50%);
  transition: left var(--scatter-duration, 600ms) cubic-bezier(0.16, 1, 0.3, 1);
  animation: bar-breathe 2000ms ease-in-out infinite;
}
@keyframes bar-breathe {
  0%, 100% { height: var(--bar-height, 60px); }
  50% { height: calc(var(--bar-height, 60px) + 5px); }
}
/* JS toggles --bar-target between even distribution and clustered random positions.
   Scatter: 600ms expo-out. Converge: 800ms expo-in-out. */
```

---

## Sources

| Source | File | Primitives |
|--------|------|-----------|
| Engine builtins | `sources/engine-builtins.md` | 20 |
| animate.style (Use tier) | `sources/animate-style.md` | 18 |
| Cinematic techniques research | `../cinematic-techniques-research.md` | ~20 |
| Camera & ambient primitives | `../camera-rig.md` | 20 |
| Reference breakdowns | `sources/breakdowns.md` | 42 |

**Total cataloged:** ~120 named primitives
