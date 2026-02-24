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
