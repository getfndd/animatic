# Ambient & Generative Techniques

Reference guide for brand illustration animations: SVG filters, gradient animation, texture overlays, organic shapes, and composition patterns.

---

## Architecture: Composition Layer

Ambient effects are a **visual layer that runs during or after choreography**, not an alternative execution flow. They don't need phases or causality chains — they're always-on background effects.

```
┌──────────────────────────────────────────┐
│  Ambient Layer (continuous, throughout)   │
│  SVG filters, gradients, textures, blobs │
├──────────────────────────────────────────┤
│  Choreography Layer (subject-dependent)   │
│  product-ui: phases + engine              │
│  illustration: causality chains           │
└──────────────────────────────────────────┘
```

Choreography completes → ambient layer continues → illustration feels alive, not frozen.

---

## Technique Categories

### 1. SVG Filter Effects

Procedural visual effects using SVG `<filter>` elements. GPU-accelerated, resolution-independent, infinitely parameterizable.

**Core filters:**

| Filter | Effect | Use Case |
|--------|--------|----------|
| `feTurbulence` | Procedural noise (Perlin/fractal) | Grain, displacement maps, organic textures |
| `feDisplacementMap` | Warp geometry using a map | Liquid distortion, heat haze, glitch |
| `feGaussianBlur` | Gaussian blur | Depth-of-field, glow base, soft reveals |
| `feColorMatrix` | Color channel manipulation | Desaturation, tinting, channel isolation |
| `feMorphology` | Erode/dilate shapes | Outline effects, bold/thin text animation |
| `feComposite` | Layer compositing | Masking, knockout text, blend operations |

**Gooey/Metaball pattern:**

```css
/* SVG filter for metaball merge effect */
<filter id="gooey">
  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
  <feColorMatrix in="blur" mode="matrix"
    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="gooey" />
</filter>

.gooey-container { filter: url(#gooey); }
```

The high contrast matrix (`18 -7`) snaps the blurred alpha channel to hard edges, creating the illusion of liquid merging when shapes overlap.

**Displacement warp pattern:**

```css
<filter id="displacement">
  <feTurbulence type="fractalNoise" baseFrequency="0.015"
    numOctaves="3" seed="1" result="noise" />
  <feDisplacementMap in="SourceGraphic" in2="noise"
    scale="20" xChannelSelector="R" yChannelSelector="G" />
</filter>

/* Animate displacement intensity */
.warped {
  filter: url(#displacement);
  animation: warp-pulse 4000ms ease-in-out infinite;
}
@keyframes warp-pulse {
  0%, 100% { filter: url(#displacement-low); }
  50% { filter: url(#displacement-high); }
}
```

### 2. Gradient Animations

Animated color gradients using CSS `@property` for individually animatable stops.

**CSS `@property` registration:**

```css
@property --gradient-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@property --color-a {
  syntax: '<color>';
  initial-value: #6366f1;
  inherits: false;
}

@property --color-b {
  syntax: '<color>';
  initial-value: #ec4899;
  inherits: false;
}

.gradient-shift {
  background: linear-gradient(var(--gradient-angle), var(--color-a), var(--color-b));
  animation: gradient-rotate 8000ms ease-in-out infinite;
}

@keyframes gradient-rotate {
  0% { --gradient-angle: 0deg; }
  50% { --gradient-angle: 180deg; }
  100% { --gradient-angle: 360deg; }
}
```

**Aurora gradient pattern:**

```css
.aurora {
  background:
    radial-gradient(ellipse at 20% 50%, var(--color-a) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, var(--color-b) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, var(--color-c) 0%, transparent 50%);
  animation: aurora-drift 12000ms ease-in-out infinite;
}

@keyframes aurora-drift {
  0%   { background-position: 0% 0%, 100% 0%, 50% 100%; }
  33%  { background-position: 100% 50%, 0% 100%, 80% 0%; }
  66%  { background-position: 50% 100%, 50% 0%, 0% 50%; }
  100% { background-position: 0% 0%, 100% 0%, 50% 100%; }
}
```

**Color cycling pattern:**

```css
@keyframes color-cycle {
  0%   { --color-a: #6366f1; --color-b: #ec4899; }
  33%  { --color-a: #ec4899; --color-b: #f59e0b; }
  66%  { --color-a: #f59e0b; --color-b: #10b981; }
  100% { --color-a: #6366f1; --color-b: #ec4899; }
}
```

### 3. Texture Overlays

Grain, noise, and film textures applied as overlay layers.

**SVG noise overlay:**

```css
.grain-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: overlay;
  opacity: 0.08;
}

/* SVG inline for animated grain */
<svg width="100%" height="100%">
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.65"
      numOctaves="3" seed="0" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#grain)" />
</svg>
```

Animate the `seed` attribute via JS or CSS for frame-varying grain:

```js
// Change grain seed every 3 frames for organic variation
let frameCount = 0;
function updateGrain() {
  frameCount++;
  if (frameCount % 3 === 0) {
    turbulence.setAttribute('seed', Math.floor(frameCount / 3));
  }
  requestAnimationFrame(updateGrain);
}
```

**Film grain CSS-only fallback:**

```css
.film-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* inline noise SVG */
  mix-blend-mode: overlay;
  opacity: 0.06;
  pointer-events: none;
  animation: grain-shift 200ms steps(4) infinite;
}

@keyframes grain-shift {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-2%, -1%); }
  50% { transform: translate(1%, 2%); }
  75% { transform: translate(-1%, -2%); }
}
```

### 4. Soft-Edge Reveals

Gradient-masked reveals using `mask-image` or `clip-path` for organic, non-rectangular entrances.

**Gradient mask reveal:**

```css
.soft-reveal {
  mask-image: linear-gradient(to right, black 0%, transparent 0%);
  animation: soft-reveal 1200ms ease-out forwards;
}

@keyframes soft-reveal {
  to {
    mask-image: linear-gradient(to right, black 100%, transparent 100%);
  }
}
```

**Radial soft reveal:**

```css
.radial-reveal {
  mask-image: radial-gradient(circle at center, black 0%, transparent 0%);
  animation: radial-grow 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes radial-grow {
  to {
    mask-image: radial-gradient(circle at center, black 100%, transparent 100%);
  }
}
```

### 5. Organic Shapes

Blob morphs, liquid borders, and biomorphic animations using SVG paths and border-radius.

**CSS blob morph:**

```css
.blob {
  border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  animation: blob-morph 8000ms ease-in-out infinite;
}

@keyframes blob-morph {
  0%   { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
  25%  { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
  50%  { border-radius: 50% 60% 30% 60% / 30% 50% 60% 40%; }
  75%  { border-radius: 40% 30% 60% 50% / 60% 40% 30% 70%; }
  100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
}
```

**Liquid border pattern:**

```css
.liquid-border {
  border: 2px solid transparent;
  background-clip: padding-box;
  position: relative;
}

.liquid-border::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: conic-gradient(from var(--border-angle), #6366f1, #ec4899, #f59e0b, #6366f1);
  z-index: -1;
  animation: border-spin 4000ms linear infinite;
}

@property --border-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes border-spin {
  to { --border-angle: 360deg; }
}
```

### 6. Concentric Patterns

Radial pulse, ripple, and depth effects using layered elements.

**Concentric pulse:**

```css
.concentric-pulse {
  position: relative;
}

.concentric-pulse .ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid currentColor;
  opacity: 0;
  animation: ring-pulse 3000ms ease-out infinite;
}

.concentric-pulse .ring:nth-child(1) { animation-delay: 0ms; }
.concentric-pulse .ring:nth-child(2) { animation-delay: 600ms; }
.concentric-pulse .ring:nth-child(3) { animation-delay: 1200ms; }

@keyframes ring-pulse {
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(2.0); opacity: 0; }
}
```

---

## Decision Tree: Choosing Ambient Effects

```
Is the subject an illustration/brand visual?
├─ Yes → Does it have SVG paths?
│  ├─ Yes → Draw/reveal primitives (ct-complex-draw, ct-handwriting-draw)
│  │         + ambient layer (grain, gradient, blob)
│  └─ No → Raster/photo treatment
│           + ambient layer (grain, soft-reveal, gradient)
├─ No → Product UI demo
│  └─ Consider ambient layer for hero sections only
│     (grain overlay, subtle gradient shift behind UI)
└─ What personality?
   ├─ cinematic-dark → Full ambient: gradient + grain + blur + blob
   ├─ editorial → Restrained: gradient shift OR grain, not both
   ├─ neutral-light → Minimal: grain overlay only, low opacity
   └─ montage → None: ambient loops conflict with rapid cuts
```

---

## Composition Pattern

When combining choreography with ambient effects:

1. **Ambient layer starts immediately** — no entrance animation needed
2. **Ambient opacity stays low** (0.05-0.15) to avoid competing with content
3. **Choreography runs on top** — z-index above ambient
4. **After choreography completes**, ambient continues indefinitely
5. **Multiple ambient effects can stack** — use `mix-blend-mode` to composite

```html
<div class="scene">
  <!-- Ambient layer: always running, low z-index -->
  <div class="ambient-layer">
    <div class="grain-overlay"></div>
    <div class="gradient-shift"></div>
  </div>

  <!-- Content layer: choreography runs here -->
  <div class="content-layer">
    <!-- Subject with entrance/reveal/draw animations -->
  </div>
</div>
```

---

## `prefers-reduced-motion` Contract

Three enforcement tiers for accessibility:

### Tier 1: Freeze

Ambient loops pause. Choreography completes but doesn't repeat.

```css
@media (prefers-reduced-motion: reduce) {
  .ambient-layer * {
    animation-play-state: paused !important;
    animation-iteration-count: 1 !important;
  }
}
```

### Tier 2: Reduce

Choreography simplified to crossfade-only. No spatial transforms.

```css
@media (prefers-reduced-motion: reduce) {
  [class*="stagger"],
  [class*="reveal"],
  [class*="draw"] {
    animation: fade-in 400ms ease-out forwards !important;
  }
}
```

### Tier 3: Remove

Decorative filters hidden entirely. Content visible immediately.

```css
@media (prefers-reduced-motion: reduce) {
  .grain-overlay,
  .gradient-shift,
  .blob,
  .concentric-pulse .ring {
    display: none !important;
  }
}
```

**Which tier to apply:** The personality determines the default tier. See personality files for specific rules.

---

## Personality Adaptations

| Personality | Ambient Budget | Allowed Effects | Reduced-Motion Tier |
|-------------|---------------|-----------------|-------------------|
| cinematic-dark | Rich | All 6 categories. Multiple stacking. Full SVG filters. | Tier 1 (Freeze) |
| editorial | Restrained | Gradient shift OR grain, not both. No blob morph. Low opacity. | Tier 2 (Reduce) |
| neutral-light | Minimal | Grain overlay only. Opacity ≤ 0.05. No gradients, no blobs. | Tier 3 (Remove) |
| montage | None | No ambient effects. Rapid cuts preclude continuous loops. | N/A |

---

## Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| Stack 3+ ambient effects on editorial | Overwhelms content-forward aesthetic | Pick one: gradient OR grain |
| Use blob morph on neutral-light | Too playful for tutorial context | Use grain overlay at very low opacity |
| Animate grain seed every frame | GPU thrashing, visual noise | Update every 3-5 frames |
| Use `mix-blend-mode: difference` | Unpredictable color results | Use `overlay` or `soft-light` |
| Full-opacity gradient behind content | Content becomes unreadable | Max ambient opacity 0.15 |
| Ambient effects on montage | Conflicts with rapid hard cuts | Let the editing rhythm carry energy |
| Ignore `prefers-reduced-motion` | Accessibility violation | Apply personality's tier |
| Use `filter` on parent of animated children | Triggers compositing on entire subtree | Apply filters to leaf elements |
