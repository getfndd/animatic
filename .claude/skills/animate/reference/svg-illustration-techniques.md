# SVG Illustration Animation Techniques

Reference guide for animating SVG illustrations, brand graphics, and non-UI visuals.
Product UI demos use phases, crossfades, and springs — illustrations use a different
vocabulary: **reveal**, **draw**, and **morph**, sequenced by **spatial causality**.

---

## The Three Techniques

### Reveal

**What it is:** A clip-path or mask expands to uncover a static filled shape. The shape
exists fully rendered underneath — the animation controls *when* it becomes visible.

**When to use it:**
- Filled areas being uncovered (backgrounds, solid shapes, color blocks)
- Large regions that need directional entrance (left-to-right, top-to-bottom)
- Text blocks appearing as a unit

**When NOT to use it:**
- Strokes being constructed (use Draw)
- Shapes changing form (use Morph)
- Small icons or simple paths (fade or Draw is usually better)

**CSS implementation:**

```css
/* Directional reveal — left to right */
@keyframes reveal-ltr {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}

/* Directional reveal — bottom to top */
@keyframes reveal-btt {
  from { clip-path: inset(100% 0 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}

/* Circular reveal from center */
@keyframes reveal-circle {
  from { clip-path: circle(0% at 50% 50%); }
  to   { clip-path: circle(75% at 50% 50%); }
}

/* Circular reveal from point */
@keyframes reveal-circle-from {
  from { clip-path: circle(0% at var(--origin-x, 50%) var(--origin-y, 50%)); }
  to   { clip-path: circle(100% at var(--origin-x, 50%) var(--origin-y, 50%)); }
}

.shape-reveal {
  animation: reveal-ltr 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

**Variations:**
- **Directional:** `inset()` with one edge animated (ltr, rtl, ttb, btt)
- **Circular:** `circle()` expanding from center or from a specific point
- **Polygon:** `polygon()` for custom wipe shapes (diagonal, chevron)
- **Staggered reveal:** Same clip-path on multiple elements with offset delays

---

### Draw

**What it is:** `stroke-dashoffset` animates from the full path length to zero, making
the stroke appear to trace itself along the path boundary. The stroke is *constructed*
visually, not uncovered.

**When to use it:**
- Line art, outlines, and borders being traced
- Handwriting or signature effects
- Paths that connect elements (arrows, connectors, flow lines)
- Any stroke that should appear to be "drawn" by an invisible pen

**When NOT to use it:**
- Filled shapes with no meaningful stroke (use Reveal)
- Large solid areas (Draw only works on strokes)
- Shapes changing form (use Morph)

**CSS implementation:**

```css
/* Calculate path length with JS, set as custom property */
.draw-path {
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  animation: draw 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes draw {
  to { stroke-dashoffset: 0; }
}
```

**JS setup (required):**

```js
// Measure and set path length for each drawable element
document.querySelectorAll('.draw-path').forEach(path => {
  const length = path.getTotalLength();
  path.style.setProperty('--path-length', length);
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
});
```

**Variations:**
- **Partial draw:** Animate to a non-zero offset to draw only part of the path
- **Reverse draw (erase):** Animate `stroke-dashoffset` from 0 back to path length
- **Multi-segment:** Different paths draw at different speeds for visual hierarchy
- **Draw with trailing gap:** Use `stroke-dasharray: segment gap` for dashed drawing

---

### Morph

**What it is:** A shape transitions smoothly from one form to another. The geometry
interpolates between two states — vertices move, curves bend, the shape *transforms*.

**When to use it:**
- Icon state changes (hamburger → X, play → pause)
- Shape evolution where both states are visible in sequence
- Logo animations where letterforms transform
- Geometrically similar shapes (same vertex count, similar topology)

**When NOT to use it:**
- Dissimilar shapes (different vertex counts, wildly different topology) — use Reveal with crossfade
- Filled areas being uncovered (use Reveal)
- Strokes being constructed (use Draw)

**CSS implementation (CSS `d` property — modern browsers):**

```css
/* Simple path morph using CSS d property */
.morph-shape path {
  d: path('M10,80 Q52,10 95,80');  /* start state */
  transition: d 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
.morph-shape.morphed path {
  d: path('M10,80 Q52,150 95,80');  /* end state */
}
```

**JS implementation (flubber — for complex morphs):**

```js
// For dissimilar shapes, use flubber for vertex interpolation
import { interpolate } from 'flubber';
const interp = interpolate(startPath, endPath, { maxSegmentLength: 10 });

function animateMorph(progress) {
  element.setAttribute('d', interp(progress));
  if (progress < 1) {
    requestAnimationFrame(() => animateMorph(progress + 0.016));
  }
}
```

**Constraints:**
- CSS `d` property requires same number of path commands in both states
- For dissimilar paths, use a JS interpolation library (flubber, GSAP MorphSVG)
- If shapes are too dissimilar, abandon Morph — use Reveal crossfade instead

---

## Technique Selection Decision Tree

```
Is the element a stroke being constructed?
├── YES → Draw (stroke-dashoffset)
└── NO
    └── Is the shape transitioning to a different form?
        ├── YES → Are the shapes geometrically similar?
        │   ├── YES → Morph (CSS d property or flubber)
        │   └── NO  → Reveal crossfade (fade out old, reveal new)
        └── NO
            └── Is it a filled area being uncovered?
                ├── YES → Reveal (clip-path)
                └── NO  → Fade (simple opacity for ambient elements)
```

**Quick reference:**

| Element Type | Technique | Why |
|-------------|-----------|-----|
| Outlined icon | Draw | Strokes trace naturally |
| Solid background shape | Reveal | Large fill, directional entrance |
| Text block | Reveal (ltr) | Words uncover left-to-right |
| Individual letter | Draw (if outlined) or Reveal | Depends on visual style |
| Connecting arrow | Draw | Path traces from source to target |
| Icon state change | Morph | Same element, new form |
| Complex illustration | Draw outlines → Reveal fills | Layered composition |
| Decorative pattern | Reveal (circular) | Expands from focal point |

---

## Spatial Causality

**The principle:** Element B's animation begins *because* element A's animation reached
it — not because a timer fired. Causality chains create the illusion that one element's
motion *causes* the next to appear, like a Rube Goldberg machine.

### Timer Sequence vs. Causality Chain

```
TIMER SEQUENCE (product-ui phases — fixed delays):
  0ms     → Element A fades in
  400ms   → Element B fades in
  800ms   → Element C fades in
  Problem: Elements appear independently. No visual connection.

CAUSALITY CHAIN (illustration — spatial triggers):
  A's stroke reaches corner → B reveals from that corner
  B's clip-path edge reaches C → C begins drawing
  C's draw completes → D's fill blooms from C's endpoint
  Result: Each animation causes the next. Visually connected.
```

### Spatial Milestone Types

| Milestone | What Triggers It | Example |
|-----------|-----------------|---------|
| Stroke endpoint | Draw reaches the end of a path | Arrow tip drawn → target element reveals |
| Clip-path edge | Reveal wipe reaches a boundary | Background reveal reaches logo → logo draws |
| Transform completion | Scale/translate reaches final state | Element lands in position → adjacent element responds |
| Fill bloom | Fill-after-stroke completes | Shape colored in → next shape begins |

### Example Causality Graph

```
[Logo outline draws] ──stroke-complete──▶ [Logo fill blooms]
                                                │
                                          fill-complete
                                                │
                                                ▼
                                    [Tagline reveals left-to-right]
                                                │
                                          reveal-edge-reaches-icon
                                                │
                                                ▼
                                    [Icon draws from tagline edge]
```

---

## The Causality Chain Pattern

Two implementation approaches, used depending on whether animations overlap.

### Approach 1: `animationend` Chains (Precision)

Each animation waits for the previous to fully complete before starting. Use when
animations must be strictly sequential — no overlap.

```js
function chainAnimations(steps) {
  let i = 0;
  function runNext() {
    if (i >= steps.length) return;
    const { element, className, onComplete } = steps[i];
    element.addEventListener('animationend', function handler() {
      element.removeEventListener('animationend', handler);
      if (onComplete) onComplete();
      i++;
      runNext();
    }, { once: true });
    element.classList.add(className);
  }
  runNext();
}

// Usage
chainAnimations([
  { element: logoOutline, className: 'draw-active' },
  { element: logoFill, className: 'fill-bloom' },
  { element: tagline, className: 'reveal-active' },
  { element: icon, className: 'draw-active' },
]);
```

### Approach 2: Timed Causality (Overlapping Starts)

Element B starts when A is ~75% complete. Use when you want elements to feel
connected but not rigidly sequential — the overlap creates flow.

```js
function timedCausality(steps) {
  let elapsed = 0;
  steps.forEach(({ element, className, duration, triggerAt }) => {
    const delay = elapsed + (triggerAt || 0);
    setTimeout(() => element.classList.add(className), delay);
    elapsed = delay + duration;
  });
  return elapsed; // total sequence duration
}

// Usage — each element starts when previous is 75% done
timedCausality([
  { element: outline, className: 'draw-active', duration: 1200, triggerAt: 0 },
  { element: fill, className: 'fill-bloom', duration: 600, triggerAt: 900 },   // 75% of 1200
  { element: text, className: 'reveal-active', duration: 800, triggerAt: 450 }, // 75% of 600
]);
```

### When to Use Each

| Approach | Use When |
|----------|----------|
| `animationend` chains | Strict sequence, no overlap, precision matters |
| Timed causality | Overlapping flow, organic feel, musical rhythm |
| Hybrid | Critical transitions use `animationend`, ambient uses timed |

---

## Fill-After-Stroke Pattern

The most important illustration-specific technique. A shape's outline draws first,
then the fill "blooms" in — mimicking how an illustrator works (pencil outline, then
color). Never show fill and stroke animating simultaneously.

### Full Implementation

```css
/* Phase 1: Stroke draws */
.shape .outline {
  fill: none;
  stroke: var(--stroke-color, #1a1a1a);
  stroke-width: 2;
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
}
.shape.draw-active .outline {
  animation: stroke-draw 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes stroke-draw {
  to { stroke-dashoffset: 0; }
}

/* Phase 2: Fill blooms after stroke completes */
.shape .fill-layer {
  opacity: 0;
  transform: scale(0.95);
  transform-origin: center;
}
.shape.fill-active .fill-layer {
  animation: fill-bloom 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fill-bloom {
  0%   { opacity: 0; transform: scale(0.95); }
  40%  { opacity: 1; transform: scale(1.02); }
  100% { opacity: 1; transform: scale(1); }
}
```

### JS Sequencing

```js
const shape = document.querySelector('.shape');
const outline = shape.querySelector('.outline');

// Measure path
const length = outline.getTotalLength();
outline.style.setProperty('--path-length', length);

// Chain: draw → fill
shape.classList.add('draw-active');
outline.addEventListener('animationend', () => {
  shape.classList.add('fill-active');
}, { once: true });
```

### SVG Structure

```html
<g class="shape" id="logo-mark">
  <!-- Fill layer: hidden initially, blooms after stroke -->
  <path class="fill-layer" d="M..." fill="#3b82f6" />
  <!-- Stroke layer: draws first -->
  <path class="outline" d="M..." />
</g>
```

**Key rule:** The fill layer and stroke layer use the *same* `d` attribute but are
separate `<path>` elements. The fill is hidden (`opacity: 0`), the stroke draws,
then the fill blooms.

---

## Anti-Patterns

| Anti-Pattern | What Goes Wrong | Correct Approach |
|-------------|----------------|------------------|
| **Everything same direction** | Flat, mechanical feel — looks auto-generated | Derive direction from spatial relationships: elements enter from the direction of their cause |
| **Scale-from-center on everything** | Generic, no spatial logic, doesn't tell a story | Use Reveal with directional clip-path; reserve scale for emphasis moments only |
| **Iris-open on static shapes** | Circular reveal on a rectangle looks arbitrary | Match reveal shape to element geometry (inset for rectangles, circle for round elements) |
| **Text as one group** | Entire text block pops in — feels abrupt, no rhythm | Animate individual words or lines; use staggered Reveal or per-character Draw |
| **Timer sequences** | Elements appear on a clock, no visual connection | Use spatial causality — each animation triggers the next |
| **Fill and stroke together** | Competing animations, visual noise, no clear read | Fill-after-stroke: draw the outline first, then bloom the fill |
| **Morph between dissimilar shapes** | Grotesque intermediate states, vertex soup | Use Reveal crossfade instead — fade out shape A, reveal shape B |
| **Uniform speed** | Everything moves at the same rate — monotonous | Speed hierarchy: primary shapes slow and deliberate, secondary shapes faster, details fastest |

---

## Personality Adaptations

Brief notes on how each personality adjusts illustration animation. Full personality
rules remain in each personality's `PERSONALITY.md`.

### cinematic-dark
- **Timing:** Slower draws (1200-1800ms), dramatic pauses between causality steps
- **Technique bias:** Draw with ambient glow (`filter: drop-shadow`), reveal with blur clear
- **Fill-after-stroke:** Fill bloom can include subtle brightness pulse
- **Extras:** Ambient particle/glow effects around completed shapes (secondary action)
- **Looping:** Slow reverse-draw with fade, not abrupt reset

### editorial
- **Timing:** Moderate draws (800-1200ms), brisk causality (minimal pauses)
- **Technique bias:** Reveal-dominant — clean directional wipes, less Draw
- **Fill-after-stroke:** Quick opacity fade for fill, no scale bloom
- **Extras:** None — content-forward, no decorative effects
- **Looping:** Opacity crossfade to reset state

### neutral-light
- **Timing:** Standard draws (800-1000ms), steady pacing
- **Technique bias:** Fade + slide for most elements; Draw for instructional paths/arrows
- **Fill-after-stroke:** Simple opacity fill, no bloom
- **Extras:** Step indicators or labels can annotate the sequence ("Step 1: Logo", "Step 2: Tagline")
- **Looping:** Fade out entirely, brief pause, restart

### montage
- **Timing:** Fast draws (400-700ms), hard cuts between causality groups
- **Technique bias:** No gradual Draw — use fast Reveal wipes and hard cuts between shape states
- **Fill-after-stroke:** Not used — shapes appear fully formed via fast Reveal
- **Extras:** Full-screen type cards can intercut between illustration segments
- **Looping:** Hard cut to black, restart
