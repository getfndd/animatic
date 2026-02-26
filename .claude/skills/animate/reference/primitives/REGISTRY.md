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

### Content Effects

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `ed-count-up` | Animated Number Count | 800ms | editorial, neutral-light | engine |
| `nl-step-progress` | Step Indicator Update | 450ms | neutral-light | engine |
| `ct-word-carousel` | Word Carousel | 8000ms cycle | editorial | research |
| `bk-text-image-split` | Image Breathing Between Text | 3200ms cycle | editorial | breakdown |

### Interactions

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `ed-tab-switch` | Tab Highlight + Crossfade | CSS transition | editorial | engine |
| `nl-cursor-to` | Simulated Cursor | 600ms movement | neutral-light | engine |
| `bk-spring-card-hover` | Spring Card Hover | 200ms | universal | breakdown |

### Transitions (Phase-Level)

| ID | Name | Duration | Personality | Source |
|----|------|----------|-------------|--------|
| `cd-phase-transition` | Cinematic Phase Change | multi-speed | cinematic-dark | engine |
| `ed-phase-transition` | Editorial Phase Change | multi-speed | editorial | engine |
| `nl-phase-transition` | Neutral Phase Change | multi-speed | neutral-light | engine |
| `ct-camera-dolly` | Camera Dolly Forward | 1400ms | cinematic-dark | research |
| `ct-camera-pan` | Camera Pan | 1200ms | cinematic-dark | research |
| `ct-camera-tilt` | Camera Tilt Reveal | 1200ms | cinematic-dark | research |
| `ct-camera-orbit` | Camera Orbit | 1200ms | cinematic-dark | research |
| `bk-bars-scatter` | Horizontal Scatter & Reconverge | 3400ms cycle | cinematic-dark | breakdown |
| `bk-icon-to-layout` | Icon-to-Layout Morph | ~1000ms build | cinematic-dark | breakdown |

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

> **Note:** Typography entries duplicate some IDs from Entrances, Reveals, Content Effects, and Continuous categories above. This section is a cross-reference view for personality-filtered lookups.

---

## Personality Quick Filters

### Cinematic Dark — Drama and Impact

Best entrances: `cd-focus-stagger`, `ct-focus-pull`, `ct-zoom-from-space`, `as-zoomIn`
Best reveals: `ct-iris-open`, `ct-wipe-reveal`, `ct-bars-reveal`, `bk-arc-cascade`, `bk-content-line-stagger`
Best ambient: `ct-float`, `ct-glow-pulse`, `cd-progress-animation`, `bk-flow-field`
Best transitions: `cd-phase-transition`, `ct-camera-dolly`, `ct-camera-orbit`, `bk-bars-scatter`, `bk-icon-to-layout`
Best typography: `ct-text-hero`, `ct-char-stagger`, `cd-typewriter`

### Editorial — Content-Forward Restraint

Best entrances: `ed-slide-stagger`, `ed-blur-reveal`, `as-fadeInUp`, `as-fadeInLeft`
Best reveals: `ct-text-sweep`, `ed-all-typewriters`
Best ambient: `ed-content-cycle`
Best content: `ed-count-up`, `ct-word-carousel`, `bk-text-image-split`
Best transitions: `ed-phase-transition`, `ed-tab-switch`
Best typography: `cd-typewriter`, `ct-text-sweep`, `bk-text-image-split`

### Neutral Light — Clean and Guided

Best entrances: `nl-slide-stagger`, `as-fadeInUp`, `as-slideInUp`
Best attention: `nl-spotlight`, `nl-tooltip`, `as-pulse`, `as-headShake`
Best ambient: `bk-sparse-breathe`, `bk-nl-dot-breathe`
Best content: `nl-step-progress`, `ed-count-up`
Best interactions: `nl-cursor-to`
Best transitions: `nl-phase-transition`

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
| Reference breakdowns | `sources/breakdowns.md` | 15 |

**Total cataloged:** ~73 named primitives
