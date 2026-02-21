# Cinematic Product Demo Animation Techniques (2025-2026)

Research document covering experimental and cinematic approaches that go BEYOND
showing UI in a box. Techniques for dramatic camera motion, element entrances,
depth, typography, and the "Apple keynote" effect.

---

## Table of Contents

1. [Camera Motion in CSS/JS](#1-camera-motion-in-cssjs)
2. [Cinematic Element Entrances](#2-cinematic-element-entrances)
3. [Depth and Parallax](#3-depth-and-parallax)
4. [Typography as Hero](#4-typography-as-hero)
5. [The "Apple Keynote" Effect](#5-the-apple-keynote-effect)
6. [View Transitions API — Element Morphing](#6-view-transitions-api--element-morphing)
7. [Scroll-Driven Animations (Native CSS)](#7-scroll-driven-animations-native-css)
8. [GSAP ScrollTrigger Cinematic Patterns](#8-gsap-scrolltrigger-cinematic-patterns)
9. [Application to 5-Phase Data Room Upload Flow](#9-application-to-5-phase-data-room-upload-flow)
10. [Sources and References](#10-sources-and-references)

---

## 1. Camera Motion in CSS/JS

### The Core Idea

Instead of animating elements inside a static viewport, animate the **viewport itself**
as if a camera is moving through the scene. Zoom in, pan across, tilt to reveal,
dolly forward into content. This transforms a flat phase transition into a spatial
journey.

### How Linear, Raycast, and Apple Do It

**Linear:** Spring physics with extreme restraint. 150-300ms micro-interactions.
Speed hierarchy across elements (header swaps fast, body moves deliberately,
container breathes slowly). Everything uses `ease-out` (fast start, gentle stop).
The secret sauce is the CSS `linear()` easing function which can encode true
bounce curves with 50+ stop points, producing spring-like motion in pure CSS.

**Raycast:** CSS animations preferred over JS. Framer Motion only for complex
sequences. `ease-out` as default curve. Their homepage uses a dynamic slider
showing the product in action — "show don't tell." Interactive product demos
that let users see the tool rather than read about it.

**Apple:** Scroll-driven image sequences. `position: sticky` pins content while
scroll drives animation. `<canvas>` renders frames at high performance. Two types
of motion: lightweight CSS transitions for content (text fades, slides) and heavy
graphical motion (video scrubbing, image sequences) used sparingly at key moments.

### CSS Perspective Camera System

The fundamental mechanism: `perspective` on a parent creates a shared 3D space.
`perspective-origin` sets the camera angle (vanishing point position).
`transform-origin` on children controls their pivot point.

```css
/* The "Camera Rig" — parent container */
.camera-rig {
  perspective: 1200px;
  perspective-origin: 50% 40%;  /* camera slightly above center */
  transform-style: preserve-3d;
}

/* Scene that the camera looks at */
.scene {
  transform-style: preserve-3d;
  transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Camera moves: animate the scene's transform */
.scene.zoom-in {
  transform: translateZ(200px);  /* dolly forward */
}

.scene.pan-right {
  transform: translateX(-300px) translateZ(50px);  /* pan + slight push */
}

.scene.tilt-down {
  transform: rotateX(8deg) translateY(-40px);  /* tilt reveal */
}

.scene.orbit {
  transform: rotateY(15deg) rotateX(5deg);  /* orbit around content */
}
```

### Dolly Zoom (Vertigo Effect) in CSS

The famous Hitchcock effect: zoom in while pulling back (or vice versa),
changing perspective while maintaining subject size. Unsettling, dramatic.

```css
/* Dolly zoom: increase perspective (pull back) while scaling up */
@keyframes dolly-zoom {
  0%   { transform: perspective(600px) scale(0.7) translateZ(0); }
  100% { transform: perspective(1800px) scale(1.0) translateZ(0); }
}

.dolly-zoom-element {
  animation: dolly-zoom 2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

This creates the visual sensation of the background expanding/contracting
while the subject stays the same size — extremely cinematic.

### Camera Motion Applied to Phase Transitions

Instead of crossfading between phases, move the camera:

```css
/* Phase container with 3D perspective */
.phase-world {
  perspective: 1000px;
  perspective-origin: 50% 50%;
  overflow: hidden;
}

/* Each phase lives at a different Z-depth */
.phase-0 { transform: translateZ(0); }
.phase-1 { transform: translateZ(-800px) translateY(200px); }
.phase-2 { transform: translateZ(-1600px) translateX(300px); }

/* To transition: animate the world's transform to "fly to" the next phase */
.phase-world.at-phase-1 {
  transform: translateZ(800px) translateY(-200px);
  transition: transform 1.4s cubic-bezier(0.16, 1, 0.3, 1);
}
```

### The "Zoom From Space" Entrance

Content starts infinitely far away and zooms into view, like the opening shot
of a film zooming from orbit to ground level.

```css
@keyframes zoom-from-space {
  0% {
    transform: perspective(1000px) translateZ(-2000px) scale(0.1);
    opacity: 0;
    filter: blur(20px);
  }
  40% {
    opacity: 1;
    filter: blur(4px);
  }
  100% {
    transform: perspective(1000px) translateZ(0) scale(1);
    filter: blur(0);
  }
}

.zoom-entrance {
  animation: zoom-from-space 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

---

## 2. Cinematic Element Entrances

### Focus Pull (Blur to Sharp)

Simulates a camera pulling focus — elements emerge from blur into sharp clarity.
Combined with scale and opacity for maximum impact.

```css
@keyframes focus-pull {
  0% {
    filter: blur(12px);
    opacity: 0;
    transform: scale(0.95);
  }
  50% {
    filter: blur(3px);
    opacity: 0.8;
  }
  100% {
    filter: blur(0);
    opacity: 1;
    transform: scale(1);
  }
}

.focus-pull-entrance {
  animation: focus-pull 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

**Performance note:** Keep blur radius under 20px for animations. On mobile,
reduce to under 8px. `filter: blur()` is not GPU-accelerated in all browsers.
For heavy use, consider pre-rendering blurred copies and cross-fading with
`opacity` instead of animating the blur value directly.

### Clip-Path Reveal (Cinematic Wipe)

Elements are revealed by expanding a clipping shape — like a camera iris opening,
a horizontal wipe, or a geometric reveal.

```css
/* Circle reveal — like a camera iris opening */
@keyframes iris-open {
  from { clip-path: circle(0% at 50% 50%); }
  to   { clip-path: circle(75% at 50% 50%); }
}

/* Horizontal wipe — cinematic left-to-right reveal */
@keyframes wipe-reveal {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}

/* Diamond reveal — geometric entrance */
@keyframes diamond-reveal {
  from { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); }
  to   { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
}

.iris-entrance   { animation: iris-open 0.8s ease-out forwards; }
.wipe-entrance   { animation: wipe-reveal 0.6s ease-out forwards; }
.diamond-entrance { animation: diamond-reveal 0.7s ease-out forwards; }
```

**Key resource:** transition.style offers drop-in CSS clip-path transitions
including wipes, slots, and geometric reveals. Emil Kowalski's "The Magic of
Clip Path" covers creative real-world use cases.

### Staggered Bars Reveal

A cinematic intro effect using a single pseudo-element with complex
`linear-gradient` backgrounds. Seven bars slide into place sequentially,
creating a rhythmic wipe effect. Zero JavaScript required.

```css
/* Simplified version — staggered bar reveal */
.reveal-bars::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to right, var(--bg) 0 14.28%, transparent 14.28%),
    linear-gradient(to right, transparent 14.28%, var(--bg) 14.28% 28.57%, transparent 28.57%);
    /* ... repeat for 7 bars */
  animation: bars-wipe 1.2s steps(1) forwards;
}

@keyframes bars-wipe {
  0%   { opacity: 1; }
  14%  { /* first bar slides away */ }
  28%  { /* second bar slides away */ }
  /* ... each bar reveals in sequence */
  100% { opacity: 0; }
}
```

### Particle-to-Solid Materialization

Elements assemble from scattered particles into their final solid form.
Best achieved with Canvas + html2canvas for DOM-to-particle conversion.

**Approach using html2canvas + Canvas:**
1. Take a snapshot of the target element with html2canvas
2. Break the snapshot into a grid of pixel-sized particles
3. Scatter particles to random positions with random velocities
4. Animate particles converging to their target positions using spring physics
5. Once settled, swap Canvas for the actual DOM element

```javascript
// Conceptual flow
async function materialize(element) {
  const canvas = await html2canvas(element);
  const pixels = getPixelGrid(canvas, gridSize);

  // Each pixel starts at a random position
  pixels.forEach(p => {
    p.x = p.targetX + (Math.random() - 0.5) * 800;
    p.y = p.targetY + (Math.random() - 0.5) * 800;
    p.opacity = 0;
  });

  // Spring-animate each pixel to its target
  function frame() {
    pixels.forEach(p => {
      p.x += (p.targetX - p.x) * 0.08; // spring
      p.y += (p.targetY - p.y) * 0.08;
      p.opacity = Math.min(1, p.opacity + 0.03);
    });
    drawPixels(ctx, pixels);
    if (!settled) requestAnimationFrame(frame);
  }
}
```

**Lighter CSS alternative:** Use `box-shadow` trick to create pseudo-particles,
animate them from scattered positions to grid using `@keyframes`.

### Scale from Tiny — "Zoom In From Space"

Already covered in Camera Motion section. The key: combine `scale(0.1)` with
`translateZ(-2000px)` and `blur(20px)` at the start, animate to neutral.
Add a slight `rotateX(3deg)` for dimensionality.

---

## 3. Depth and Parallax

### Pure CSS Parallax with translateZ

The original technique by Keith Clark. No JavaScript. Uses the browser's
own scroll machinery for performance.

```css
/* The viewport/camera */
body {
  perspective: 1px;          /* activates 3D space for scroll */
  transform-style: preserve-3d;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
}

/* Layers at different depths */
.layer-far {
  transform: translateZ(-3px) scale(4);
  /* scale compensates for apparent size reduction */
  /* Formula: scale = 1 + (translateZ * -1) / perspective */
  /* scale = 1 + (3 / 1) = 4 */
}

.layer-mid {
  transform: translateZ(-1px) scale(2);
}

.layer-near {
  transform: translateZ(0);  /* moves at scroll speed */
}
```

**Scale compensation formula:**
`scale = (perspective - distance) / perspective`
or equivalently: `scale = 1 + (|translateZ| / perspective)`

### Multi-Layer Depth for Product Demos

Create depth by placing UI elements at different Z-layers:

```css
.product-scene {
  perspective: 800px;
  perspective-origin: 50% 40%;
}

/* Background context (investor list, dashboard) */
.bg-context {
  transform: translateZ(-200px) scale(1.25);
  filter: blur(2px);
  opacity: 0.4;
}

/* Main product UI (the hero) */
.main-ui {
  transform: translateZ(0);
}

/* Foreground element (tooltip, modal, notification) */
.fg-element {
  transform: translateZ(100px) scale(0.875);
  filter: drop-shadow(0 20px 60px rgba(0,0,0,0.3));
}
```

### Parallax During Transitions

Different parts of the UI move at different speeds during a phase transition,
creating depth:

```css
/* During phase transition, elements move at different rates */
.transitioning .bg-element {
  transform: translateY(-20px);  /* slow */
  transition: transform 800ms cubic-bezier(0.16, 1, 0.3, 1);
}

.transitioning .mid-element {
  transform: translateY(-40px);  /* medium */
  transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
}

.transitioning .fg-element {
  transform: translateY(-80px);  /* fast — foreground moves more */
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### The Dropbox Brand Technique

Dropbox's brand site (brand.dropbox.com) uses scroll-driven zoom navigation:
- 8 tiles start at `scale(2)`, scale down as you scroll
- Each tile has a unique directional vector creating an "explosion" effect
- Click-to-fullscreen transitions where a tile expands to fill the viewport
  with the title at `scale(4)` before navigating
- Gridlines expand from center on load using `scaleX`/`scaleY` from center origin

This is wayfinding as theater — navigation itself becomes animation.

---

## 4. Typography as Hero

### Dramatic Scale Entrance

Text doesn't just appear — it scales from enormous or tiny with spring physics.

```css
@keyframes text-hero-entrance {
  0% {
    transform: scale(3);
    opacity: 0;
    filter: blur(8px);
    letter-spacing: 0.5em;
  }
  60% {
    filter: blur(0);
    letter-spacing: 0.02em;
  }
  100% {
    transform: scale(1);
    opacity: 1;
    letter-spacing: normal;
  }
}

.hero-text {
  animation: text-hero-entrance 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  transform-origin: center center;
}
```

### Variable Font Weight Morphing

Animate font weight in real-time using `font-variation-settings`. The text
appears to "breathe" or transition between light and bold.

```css
@keyframes font-breathe {
  0%   { font-variation-settings: "wght" 100; }
  50%  { font-variation-settings: "wght" 900; }
  100% { font-variation-settings: "wght" 100; }
}

.breathing-text {
  font-family: 'Inter Variable', sans-serif;
  animation: font-breathe 3s ease-in-out infinite;
}
```

**Word swap with weight contrast:**
```css
/* Two words with opposite weight animations */
.word-a { animation: weight-up 2s ease-in-out infinite alternate; }
.word-b { animation: weight-down 2s ease-in-out infinite alternate; }

@keyframes weight-up {
  from { font-variation-settings: "wght" 100, "wdth" 75; }
  to   { font-variation-settings: "wght" 900, "wdth" 125; }
}
@keyframes weight-down {
  from { font-variation-settings: "wght" 900, "wdth" 125; }
  to   { font-variation-settings: "wght" 100, "wdth" 75; }
}
```

### Kinetic Text Swap (Word Carousel)

Words cycle through a position with sliding/morphing transitions.

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
  0%, 18%  { transform: translateY(0); }
  20%, 38% { transform: translateY(-1.2em); }
  40%, 58% { transform: translateY(-2.4em); }
  60%, 78% { transform: translateY(-3.6em); }
  80%, 98% { transform: translateY(-4.8em); }
  100%     { transform: translateY(0); }
}
```

### Text Clip-Path Reveal

Text revealed by a sweeping clip-path — like a spotlight passing over it.

```css
@keyframes text-sweep {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}

.swept-text {
  animation: text-sweep 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### Per-Character Stagger with Splitting.js

Split text into individual characters and stagger their entrance:

```css
/* Each character enters with staggered delay */
.char {
  opacity: 0;
  transform: translateY(20px) rotateX(-20deg);
  animation: char-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Stagger using CSS custom property */
.char {
  animation-delay: calc(var(--char-index) * 30ms);
}

@keyframes char-enter {
  to {
    opacity: 1;
    transform: translateY(0) rotateX(0deg);
  }
}
```

---

## 5. The "Apple Keynote" Effect

### The Philosophy

Apple's technique boils down to: **one thing at a time, in dark space, with
extreme staging.** The dark background is the canvas. Content floats in a void.
Spotlight draws attention. Motion is purposeful and slow enough to register.

### Dark Space + Radial Gradient Spotlight

```css
.keynote-stage {
  background: #000;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Spotlight that follows the featured element */
.spotlight {
  position: absolute;
  width: 600px;
  height: 600px;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.02) 40%,
    transparent 70%
  );
  pointer-events: none;
  transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Content floating in the void */
.featured-element {
  position: relative;
  z-index: 1;
  transform: translateZ(0);
}
```

### Sequential Reveal (Extreme Staging)

Only one element is visible at a time. Each fades/scales in, holds, then fades
out before the next appears.

```javascript
// Apple-style sequential reveal
const SEQUENCE = [
  { el: '.headline',      delay: 0,    duration: 800,  hold: 2000 },
  { el: '.product-image',  delay: 200,  duration: 1200, hold: 3000 },
  { el: '.feature-text',   delay: 0,    duration: 600,  hold: 2500 },
  { el: '.spec-callout',   delay: 100,  duration: 500,  hold: 2000 },
];

async function playSequence() {
  for (const item of SEQUENCE) {
    await wait(item.delay);
    fadeIn(item.el, item.duration);
    await wait(item.duration + item.hold);
    fadeOut(item.el, 400);
    await wait(500); // breathing room between reveals
  }
}
```

### Floating in Space with Subtle Motion

Elements have a constant, barely perceptible floating animation suggesting
they exist in zero-gravity space.

```css
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25%      { transform: translateY(-8px) rotate(0.5deg); }
  75%      { transform: translateY(4px) rotate(-0.3deg); }
}

.floating-element {
  animation: float 6s ease-in-out infinite;
}

/* Stagger multiple floating elements for organic feel */
.floating-element:nth-child(2) {
  animation-delay: -1.5s;
  animation-duration: 7s;
}
.floating-element:nth-child(3) {
  animation-delay: -3s;
  animation-duration: 5.5s;
}
```

### The Pin + Scroll Technique

Pin a section in place while scroll drives content changes within it.
This is how Apple product pages work.

```css
.pinned-section {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
}

/* The scrollable "runway" that drives the animation */
.scroll-runway {
  height: 400vh; /* 4x viewport = 3 screen-lengths of scroll to drive animation */
}
```

With GSAP ScrollTrigger:
```javascript
gsap.timeline({
  scrollTrigger: {
    trigger: '.pinned-section',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,   // 1s catch-up for smooth feel
    pin: true
  }
})
.to('.headline', { opacity: 1, y: 0, duration: 0.3 })
.to('.product-image', { scale: 1, opacity: 1, duration: 0.4 }, '+=0.1')
.to('.headline', { opacity: 0, duration: 0.2 }, '+=0.3')
.to('.feature-callout', { opacity: 1, x: 0, duration: 0.3 });
```

### Ambient Glow / Backdrop Effects

```css
/* Ambient glow behind featured element */
.ambient-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at 50% 50%,
    rgba(59, 130, 246, 0.15) 0%,
    transparent 60%
  );
  filter: blur(80px);
  animation: glow-pulse 4s ease-in-out infinite alternate;
}

@keyframes glow-pulse {
  from { opacity: 0.4; transform: scale(0.9); }
  to   { opacity: 0.7; transform: scale(1.1); }
}
```

---

## 6. View Transitions API — Element Morphing

### The Native Browser Approach (2025+)

The View Transitions API enables element morphing between states without any
animation library. The browser takes before/after snapshots and interpolates.

**Browser support:** Chrome 126+, Edge 126+, Firefox 144+, Safari 26+.
Part of Interop 2025.

```css
/* Mark elements that should morph between states */
.upload-card    { view-transition-name: main-card; }
.file-list      { view-transition-name: main-card; }  /* same name = morph */
.process-view   { view-transition-name: main-card; }

/* Customize the morphing animation */
::view-transition-group(main-card) {
  animation-duration: 0.6s;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

/* Disable default root crossfade */
::view-transition-group(root) {
  animation: none;
}
```

```javascript
// Trigger the morphing transition
async function transitionPhase(updateCallback) {
  const transition = document.startViewTransition(() => {
    updateCallback();
  });
  await transition.finished;
}
```

**How this applies to product demos:**
Instead of crossfading between phases, the upload card morphs into the file list,
which morphs into the processing view. The container literally transforms shape.

---

## 7. Scroll-Driven Animations (Native CSS)

### The New Standard (No JavaScript)

CSS Scroll-Driven Animations let you bind any CSS animation to scroll position
instead of time. Runs on the compositor thread for guaranteed 60fps.

```css
/* Bind animation to scroll position */
.scroll-animated {
  animation: reveal-on-scroll linear both;
  animation-timeline: view();  /* triggers as element enters viewport */
  animation-range: entry 0% cover 40%;
}

@keyframes reveal-on-scroll {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}
```

### Named Scroll Timelines

```css
.scroll-container {
  scroll-timeline-name: --main-scroll;
  scroll-timeline-axis: y;
}

.progress-indicator {
  animation: fill-bar linear both;
  animation-timeline: --main-scroll;
}

@keyframes fill-bar {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
```

### Apple-Style Section Pinning in Pure CSS

```css
.sticky-section {
  position: sticky;
  top: 0;
  height: 100vh;
}

.sticky-section .content {
  animation: pin-content linear both;
  animation-timeline: view(block);
  animation-range: contain 0% contain 100%;
}

@keyframes pin-content {
  0%   { opacity: 0; transform: scale(0.9); }
  20%  { opacity: 1; transform: scale(1); }
  80%  { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.05); }
}
```

---

## 8. GSAP ScrollTrigger Cinematic Patterns

### Pinned Cinematic Camera (Codrops 2025)

From Codrops' "How to Build Cinematic 3D Scroll Experiences with GSAP"
(November 2025):

```javascript
// Cinematic camera path driven by scroll
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '.cinematic-section',
    start: 'top top',
    end: '+=4000',  // 4000px of scroll drives the timeline
    scrub: 1.5,     // 1.5s smoothing
    pin: true
  }
});

// Camera moves through scene
tl.to('.camera', {
    x: -200, y: -100, z: 500,
    ease: 'none'
  }, 0)
  .to('.camera', {
    rotateY: 15,
    ease: 'power1.inOut'
  }, 0.2)
  .to('.scene-content', {
    opacity: 1, scale: 1,
    ease: 'power2.out'
  }, 0.3);
```

### Layered Zoom Scroll (Codrops October 2025)

From "Building a Layered Zoom Scroll Effect with GSAP ScrollSmoother":
Combination of scaling, blur, and smooth scrolling creates a layered motion
that gives the impression of a 3D scene coming to life as you scroll.

```javascript
// Layered zoom — deeper layers scale faster
gsap.to('.layer-back', {
  scale: 3,
  filter: 'blur(8px)',
  scrollTrigger: {
    trigger: '.zoom-section',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    pin: true
  }
});

gsap.to('.layer-mid', {
  scale: 2,
  filter: 'blur(2px)',
  scrollTrigger: { /* same trigger */ }
});

gsap.to('.layer-front', {
  scale: 1.2,
  scrollTrigger: { /* same trigger */ }
});
```

### Staggered Blinds Reveal

A cinematic transition mimicking venetian blinds opening:
slats slide away and rotate sequentially, revealing content underneath.

---

## 9. Application to 5-Phase Data Room Upload Flow

### The Vision

Transform a linear 5-phase flow into a **cinematic journey** through
increasingly deeper levels of detail — inspired by the Eames' "Powers of 10."

### Phase Map

| # | Phase | Story Beat | Cinematic Technique |
|---|-------|-----------|-------------------|
| 1 | Source Selection | "The beginning" | Iris-open reveal in dark space |
| 2 | File Upload/List | "Content arrives" | Camera dolly forward into document grid |
| 3 | AI Processing | "The transformation" | Depth-of-field blur on files, spotlight on processor |
| 4 | Results/Rename | "The reveal" | Clip-path wipe reveals each result, parallax layers |
| 5 | Completion | "The resolution" | Scale-down to see the whole, ambient glow celebration |

### Phase 1: Source Selection — Iris Open

```css
/* Dark void. Circle reveals the upload card. */
.phase-1-entrance {
  clip-path: circle(0% at 50% 50%);
  animation: iris-open 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes iris-open {
  to { clip-path: circle(75% at 50% 50%); }
}

/* Upload card floats in dark space with subtle ambient glow */
.upload-card {
  background: var(--surface-primary);
  border-radius: 12px;
  box-shadow: 0 0 120px rgba(59, 130, 246, 0.1);
  animation: float 6s ease-in-out infinite;
}
```

### Phase 2: File Upload — Camera Dolly Forward

```css
/* Camera pushes into the document grid */
.phase-2-entrance {
  transform: perspective(1000px) translateZ(-400px) scale(0.6);
  filter: blur(6px);
  opacity: 0;
  animation: dolly-into-files 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes dolly-into-files {
  40% {
    filter: blur(2px);
    opacity: 1;
  }
  100% {
    transform: perspective(1000px) translateZ(0) scale(1);
    filter: blur(0);
  }
}

/* Individual files stagger in from different depths */
.file-item {
  opacity: 0;
  transform: translateZ(-100px) translateY(20px);
}
.file-item.visible {
  opacity: 1;
  transform: translateZ(0) translateY(0);
  transition: all 500ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Phase 3: AI Processing — Depth of Field

```css
/* Files recede into background blur while processor is spotlit */
.phase-3-bg-files {
  filter: blur(3px);
  opacity: 0.3;
  transform: translateZ(-100px) scale(0.95);
  transition: all 800ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Processing indicator is sharp, centered, spotlit */
.phase-3-processor {
  filter: blur(0);
  transform: translateZ(50px);
  position: relative;
}

/* Ambient processing glow */
.phase-3-processor::before {
  content: '';
  position: absolute;
  inset: -40px;
  background: radial-gradient(
    circle,
    rgba(59, 130, 246, 0.12) 0%,
    transparent 70%
  );
  filter: blur(30px);
  animation: process-glow 2s ease-in-out infinite alternate;
}
```

### Phase 4: Results — Wipe Reveal with Parallax

```css
/* Each result wipes in from left to right, staggered */
.result-item {
  clip-path: inset(0 100% 0 0);
  opacity: 0;
}
.result-item.revealed {
  clip-path: inset(0 0 0 0);
  opacity: 1;
  transition: clip-path 600ms cubic-bezier(0.16, 1, 0.3, 1),
              opacity 400ms ease-out;
}

/* Parallax: file names move faster than folder assignments */
.result-filename {
  transition-delay: 0ms;
  transform: translateX(30px);
}
.result-filename.revealed {
  transform: translateX(0);
  transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
}

.result-folder {
  transition-delay: 100ms;
  transform: translateX(50px);  /* starts further right, moves more = parallax */
}
.result-folder.revealed {
  transform: translateX(0);
  transition: transform 700ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Phase 5: Completion — Scale Down + Glow

```css
/* Zoom out to see the whole — everything scales down slightly */
.phase-5-entrance {
  transform: scale(1.15);
  filter: blur(2px);
  animation: completion-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes completion-reveal {
  to {
    transform: scale(1);
    filter: blur(0);
  }
}

/* Success glow pulse */
.success-glow {
  background: radial-gradient(
    circle at 50% 50%,
    rgba(34, 197, 94, 0.15) 0%,
    transparent 60%
  );
  animation: success-pulse 2s ease-out forwards;
}

@keyframes success-pulse {
  0%   { transform: scale(0); opacity: 0; }
  50%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 0.6; }
}
```

### Combined Technique: The Full Cinematic Pipeline

For maximum impact, layer these techniques:

1. **Dark space container** with `background: #0a0a0a` or transparent
2. **Perspective camera rig** on the outer container
3. **Per-phase Z-depth** — each phase lives at a different depth
4. **Camera motion transitions** instead of crossfades
5. **Focus pull** (blur-to-sharp) on entering content
6. **Clip-path reveals** for individual elements within each phase
7. **Parallax stagger** — elements within a phase move at different speeds
8. **Ambient glow/spotlight** tracking the current focal point
9. **Typography entrances** — hero text scales or morphs into view
10. **Spring physics** on all interaction animations

---

## 10. Sources and References

### Tutorials and Guides

- [CSS-Tricks: Fancy Scrolling Animations Used on Apple Product Pages](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/)
- [Brad Holmes: Why Most Scroll Animations Miss What Apple Gets Right](https://www.brad-holmes.co.uk/web-performance-ux/why-most-scroll-animations-miss-what-apple-gets-right/)
- [Builder.io: Apple-style scroll animations with CSS view-timeline](https://www.builder.io/blog/view-timeline)
- [Codrops: Cinematic 3D Scroll Experiences with GSAP](https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/)
- [Codrops: Layered Zoom Scroll Effect with GSAP](https://tympanus.net/codrops/2025/10/29/building-a-layered-zoom-scroll-effect-with-gsap-scrollsmoother-and-scrolltrigger/)
- [Codrops: 3D Scroll-Driven Text Animations with CSS and GSAP](https://tympanus.net/codrops/2025/11/04/creating-3d-scroll-driven-text-animations-with-css-and-gsap/)
- [Chrome Developers: Performant Parallaxing](https://developer.chrome.com/blog/performant-parallaxing)
- [Chrome Developers: Animating a blur](https://developer.chrome.com/blog/animated-blur)
- [Keith Clark: Pure CSS Parallax Websites](https://keithclark.co.uk/articles/pure-css-parallax-websites/)

### CSS 3D Perspective

- [David DeSandro: Intro to CSS 3D Transforms](https://3dtransforms.desandro.com/perspective)
- [Polypane: CSS 3D Transform Perspective Examples](https://polypane.app/css-3d-transform-examples/)
- [CSS-Tricks: How CSS Perspective Works](https://css-tricks.com/how-css-perspective-works/)
- [Frontend.fyi: CSS 3D Perspective Animations](https://www.frontend.fyi/tutorials/css-3d-perspective-animations)

### Clip-Path and Reveals

- [CSS-Tricks: Animating with Clip-Path](https://css-tricks.com/animating-with-clip-path/)
- [Emil Kowalski: The Magic of Clip Path](https://emilkowal.ski/ui/the-magic-of-clip-path)
- [transition.style: Easy transitions with clip-path](https://www.transition.style/)
- [Codrops: Image Layer Animations with Clip-Path](https://tympanus.net/codrops/2023/10/31/image-layer-animations-with-clip-path/)

### Kinetic Typography

- [IK Agency: Kinetic Typography Complete Guide (2026)](https://www.ikagency.com/graphic-design-typography/kinetic-typography/)
- [Envato Tuts+: Kinetic Web Typography Trend](https://webdesign.tutsplus.com/exploring-the-kinetic-typography-trend-in-2024--cms-108476a)
- [FreeFrontend: 96 CSS Text Animations](https://freefrontend.com/css-text-animations/)
- [Val Head: Animating Variable Fonts with CSS](https://valhead.com/2020/11/15/animating-variable-fonts-with-css/)

### Emil Kowalski / Animation Philosophy

- [Emil Kowalski: Great Animations](https://emilkowal.ski/ui/great-animations)
- [Emil Kowalski: Good vs Great Animations](https://emilkowal.ski/ui/good-vs-great-animations)
- [animations.dev: Animations on the Web Course](https://animations.dev/)
- [Josh W. Comeau: Springs and Bounces in Native CSS](https://www.joshwcomeau.com/animation/linear-timing-function/)

### View Transitions API

- [MDN: View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [DevToolbox: CSS View Transitions Complete Guide (2026)](https://devtoolbox.dedyn.io/blog/css-view-transitions-complete-guide)
- [patterns.dev: Animating View Transitions](https://www.patterns.dev/vanilla/view-transitions/)
- [FreeFrontend: 16 View Transition API Examples](https://freefrontend.com/view-transition-api/)

### CSS Scroll-Driven Animations

- [MDN: CSS Scroll-Driven Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- [design.dev: CSS Scroll-Driven Animations Guide](https://design.dev/guides/scroll-timeline/)
- [FreeFrontend: 25 CSS Scroll-Driven Animations](https://freefrontend.com/css-scroll-driven/)

### GSAP ScrollTrigger

- [GSAP: ScrollTrigger Documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [GSAP: Scroll Overview](https://gsap.com/scroll/)
- [FreeFrontend: 51 GSAP ScrollTrigger Examples](https://freefrontend.com/scroll-trigger-js/)
- [GSAPify: Complete Guide with 20+ Examples (2025)](https://gsapify.com/gsap-scrolltrigger)

### Spotlight and Dark Space Effects

- [Frontend Masters Blog: CSS Spotlight Effect](https://frontendmasters.com/blog/css-spotlight-effect/)
- [Finiam: Spotlight Effect with JS and CSS](https://blog.finiam.com/blog/spotlight-effect-with-js-and-css)
- [Aceternity UI: Spotlight Component](https://ui.aceternity.com/components/spotlight)

### Parallax and Depth

- [Medium: Pure CSS Parallax Effects](https://medium.com/@farihatulmaria/pure-css-parallax-effects-creating-depth-and-motion-without-a-single-line-of-javascript-f4ecc35c928e)
- [LogRocket: Parallax Scrolling with CSS](https://blog.logrocket.com/create-parallax-scrolling-css/)
- [FreeFrontend: 43 CSS Parallax Effects](https://freefrontend.com/css-parallax/)

### Blur and Focus Effects

- [Chrome Developers: Animating a blur](https://developer.chrome.com/blog/animated-blur)
- [FreeFrontend: 28 CSS Blur Effects](https://freefrontend.com/css-blur-effects/)
- [CSS-Tricks: Realistic Motion Blur with CSS](https://css-tricks.com/how-to-create-a-realistic-motion-blur-with-css-transitions/)

### Particles and Materialization

- [CSS-Tricks: Particle Effects on DOM Elements with Canvas](https://css-tricks.com/adding-particle-effects-to-dom-elements-with-canvas/)
- [CSS-Tricks: Particles Using the Web Animations API](https://css-tricks.com/playing-with-particles-using-the-web-animations-api/)
- [Smashing Magazine: Particle Trail Animation](https://www.smashingmagazine.com/2020/04/particle-trail-animation-javascript/)

### Inspiration Galleries

- [Awwwards: Animation Websites](https://www.awwwards.com/websites/animation/)
- [Awwwards: 3D Websites](https://www.awwwards.com/websites/3d/)
- [School of Motion: 10 Websites with Great Animation in 2026](https://www.schoolofmotion.com/blog/10-websites-with-great-animation-in-2026)
- [Dropbox Brand](https://brand.dropbox.com/) — Scroll-driven zoom navigation
- [FreeFrontend: 50 CSS Perspective Examples](https://freefrontend.com/css-perspective/)

### CSS Easing and Springs

- [Smashing Magazine: CSS Easing With linear()](https://www.smashingmagazine.com/2023/09/path-css-easing-linear-function/)
- [CSS-Tricks: linear() Function](https://css-tricks.com/almanac/functions/l/linear/)
- [pqina: CSS Spring Animations With linear()](https://pqina.nl/blog/css-spring-animation-with-linear-easing-function)

### Framer Motion / Motion Library

- [Motion: Layout Animations Documentation](https://www.framer.com/motion/layout-animations/)
- [Motion: Official Examples](https://motion.dev/examples)
- [FreeFrontend: 19 React Framer Motion Examples](https://freefrontend.com/react-framer-motion/)
