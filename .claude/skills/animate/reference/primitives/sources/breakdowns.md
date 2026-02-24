# Primitives Extracted from Reference Breakdowns

New animation primitives discovered through reference analysis. Each links back to the breakdown that identified it.

---

## From `dot-grid-ripple`

### `bk-grid-wave` — Grid Wave Propagation
- **Category:** Continuous / Ambient
- **Duration:** ~2000ms per wave cycle
- **Easing:** ease-in-out (individual dot), distance-based delay
- **Description:** Radial wave propagation across a grid of elements. Dots/cards/icons scale up as the wave passes and settle back to baseline. Wave origin can drift for organic feel.
- **Parameters:** origin point, wave speed (ms per pixel), scale multiplier, wave radius, grid element selector
- **Personality:** cinematic-dark (primary), universal at low intensity
- **CSS/JS pattern:** JS distance calculation drives per-element setTimeout stagger. CSS transitions handle the scale/opacity animation.

### `bk-distance-stagger` — Distance-Based Stagger
- **Category:** Reveal / Stagger
- **Duration:** Variable (distance-dependent)
- **Description:** Instead of index-based stagger (0, 1, 2...), delay is calculated from Euclidean distance to a focal point. Creates organic radial reveal patterns.
- **Parameters:** focal point (x, y), speed factor, element selector
- **Personality:** universal
- **Formula:** `delay = Math.sqrt(dx² + dy²) * speedFactor`

## From `kinetic-type-scale-cascade`

### `bk-text-parallax-stack` — Text Parallax Stack
- **Category:** Typography / Continuous
- **Duration:** ~3000ms cycle (infinite loop)
- **Easing:** linear (scroll speed), expo-out (entrance)
- **Description:** Same text repeated at 3 scales (large/medium/small) scrolling at different speeds. Creates depth through scale differential and parallax motion.
- **Parameters:** text content, scale ratios [3, 2, 1], speed differential
- **Personality:** cinematic-dark
- **Note:** Loop-friendly — seamless infinite scroll for video capture.

## From `3d-card-cascade`

### `bk-grid-flip-cascade` — Grid Flip Cascade
- **Category:** Reveal / Stagger
- **Duration:** 600ms per card, 80ms stagger interval, ~2000ms total for 4x5 grid
- **Easing:** cubic-bezier(0.4, 0, 0.2, 1)
- **Description:** Staggered 3D Y-axis flip across a card grid. Each card rotates 180deg revealing its back face. Diagonal propagation (row + col index) creates wave effect.
- **Parameters:** grid dimensions, stagger interval, direction (row/diagonal/radial), flip axis (X/Y)
- **Personality:** editorial (primary), cinematic-dark (compatible)
- **Key mechanism:** `backface-visibility: hidden` with `transform: rotateY(180deg)` on back face.

## From `linear-homepage`

### `bk-spring-card-hover` — Spring Card Hover
- **Category:** Interaction
- **Duration:** 200ms
- **Easing:** CSS `linear()` spring curve or cubic-bezier(0.22, 1, 0.36, 1)
- **Description:** Card lifts with translateY(-4px), subtle scale(1.01), and elevated shadow. The Linear-standard hover pattern.
- **Parameters:** lift distance, scale factor, shadow elevation
- **Personality:** universal

### `bk-linear-spring-curve` — CSS linear() Spring
- **Category:** Easing (not an animation primitive per se)
- **Description:** True bounce curve encoded with 40+ stop points in CSS `linear()` function. Produces spring-like motion in pure CSS without JS.
- **Personality:** universal
- **CSS value:** See linear-homepage.md breakdown for full stop-point list.

## From `sparse-dot-breathing`

### `bk-sparse-breathe` — Sparse Grid Breathing
- **Category:** Continuous / Ambient
- **Duration:** ~4000ms cycle (infinite loop)
- **Easing:** ease-in-out
- **Description:** Sparse grid of dots oscillates between scale(0.6) and scale(1.0) with phase-decorrelated timing. Adjacent dots breathe at different phases via diagonal offset + random jitter, preventing mechanical synchronization. Opacity shifts (0.5–0.9) track with scale.
- **Parameters:** grid cols/rows, dot size, breathe duration range, gap size
- **Personality:** universal (primary), neutral-light
- **Key mechanism:** Per-dot `animation-delay` calculated as `(row + col) * 300 + random(0, 400)` with per-dot `animation-duration` jitter (3600–4400ms).

## From `arc-wave-cascade`

### `bk-arc-cascade` — Arc Stagger Entrance
- **Category:** Reveal / Stagger
- **Duration:** 600ms per arc, 80ms stagger interval
- **Easing:** expo-out (entrance), ease-in (exit)
- **Description:** Curved arcs stagger vertically (top-to-bottom entrance, bottom-to-top exit). Each arc scales from 0.3 to 1.0 with opacity fade-in. SVG variant uses stroke-dashoffset for true arc drawing. Bidirectional stagger creates breathing rhythm.
- **Parameters:** arc count, stagger interval, curvature variation, direction (enter/exit)
- **Personality:** cinematic-dark
- **Key mechanism:** CSS `animation-delay: calc(var(--arc-index) * 80ms)` with reversed index for exit stagger. SVG `stroke-dashoffset` for draw-on variant.

### `bk-bidirectional-stagger` — Bidirectional Stagger Pattern
- **Category:** Reveal / Stagger (technique)
- **Duration:** Variable
- **Description:** Enter top-to-bottom, exit bottom-to-top (or any opposing direction pair). Creates a natural breathing rhythm rather than uniform motion. Exit stagger interval is tighter than entrance (60ms vs 80ms) for crisper departure.
- **Parameters:** enter direction, exit direction, enter interval, exit interval
- **Personality:** universal
- **Note:** Technique applicable to any staggered sequence — cards, list items, nav links.

## From `text-image-reveal`

### `bk-text-image-split` — Image Breathing Between Text Blocks
- **Category:** Content Effects / Typography
- **Duration:** ~3200ms cycle (1800ms expand, 1400ms contract)
- **Easing:** ease-in-out
- **Description:** A centered image window expands/contracts between two typographic blocks, pushing them apart and pulling them together. Image crop shifts via object-position during expansion (parallax within frame). Letter-spacing on text blocks responds to image state — wider when expanded, tighter when contracted.
- **Parameters:** expand height, contract height, image crop range, tracking range, cycle timing
- **Personality:** editorial (primary), cinematic-dark (compatible)
- **Key mechanism:** CSS `@keyframes image-breathe` on height + `@keyframes image-crop-shift` on object-position + `@keyframes tracking-breathe` on letter-spacing, all synchronized to same duration.

## From `flow-field-vortex`

### `bk-flow-field` — Flow Field Vortex
- **Category:** Continuous / Ambient
- **Duration:** Continuous (attractor drifts on ~3000ms Lissajous cycle)
- **Easing:** linear (angular velocity per segment)
- **Description:** Grid of short line segments rotating to align with a flow field created by a drifting attractor point. Segments near the attractor rotate faster and are brighter; peripheral segments barely move and are dimmer. Creates a vortex/wind field pattern.
- **Parameters:** grid cols/rows, segment length, attractor drift speed, influence falloff
- **Personality:** cinematic-dark
- **Key mechanism:** JS `requestAnimationFrame` loop computing `Math.atan2` angle per segment relative to attractor, with tangential offset (`+ Math.PI/2`) for vortex rather than convergence. CSS custom property `--seg-angle` drives rotation.

## From `kinetic-bars-scatter`

### `bk-bars-scatter` — Horizontal Scatter & Reconverge
- **Category:** Transitions / Content Effects
- **Duration:** ~3400ms cycle (600ms scatter + 1200ms hold + 800ms converge + 800ms hold)
- **Easing:** expo-out (scatter), expo-in-out (converge)
- **Description:** Vertical bars scatter to random horizontal positions (with clustering tendency), hold, then reconverge to even distribution. Height micro-pulse keeps bars alive during hold states. Scatter is fast (tension), converge is slow (resolution).
- **Parameters:** bar count, scatter clustering, converge/scatter durations, hold durations, bar dimensions
- **Personality:** cinematic-dark (primary), editorial (compatible)
- **Key mechanism:** JS controls `--bar-target` CSS custom property per bar. Clustering logic biases random positions toward 2 focal zones. CSS `transition` handles smooth movement.

---

## Summary

| ID | Name | Category | Source Breakdown |
|----|------|----------|-----------------|
| `bk-grid-wave` | Grid Wave Propagation | Continuous / Ambient | dot-grid-ripple |
| `bk-distance-stagger` | Distance-Based Stagger | Reveal / Stagger | dot-grid-ripple |
| `bk-text-parallax-stack` | Text Parallax Stack | Typography | kinetic-type-scale-cascade |
| `bk-grid-flip-cascade` | Grid Flip Cascade | Reveal / Stagger | 3d-card-cascade |
| `bk-spring-card-hover` | Spring Card Hover | Interaction | linear-homepage |
| `bk-linear-spring-curve` | CSS linear() Spring | Easing | linear-homepage |
| `bk-sparse-breathe` | Sparse Grid Breathing | Continuous / Ambient | sparse-dot-breathing |
| `bk-arc-cascade` | Arc Stagger Entrance | Reveal / Stagger | arc-wave-cascade |
| `bk-bidirectional-stagger` | Bidirectional Stagger | Reveal / Stagger | arc-wave-cascade |
| `bk-text-image-split` | Image Breathing Between Text | Content Effects | text-image-reveal |
| `bk-flow-field` | Flow Field Vortex | Continuous / Ambient | flow-field-vortex |
| `bk-bars-scatter` | Horizontal Scatter & Reconverge | Transitions | kinetic-bars-scatter |
