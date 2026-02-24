---
ref: dot-grid-ripple
title: "Dot Grid Ripple — Traveling Wave Distortion"
source: "inspiration/2b8d7583666fb3daf812352bb6a9f0aa.gif"
type: gif
date: 2026-02-24
personality_affinity: cinematic-dark
tags: [grid, ripple, ambient, particle, wave, continuous]
quality_tier: exemplary
---

# Dot Grid Ripple — Traveling Wave Distortion

## Summary

A dense grid of evenly spaced dots with a traveling wave distortion that causes dots to enlarge and shift as it passes through. The wave creates a sense of organic, living motion across a structured field. This is a foundational ambient pattern — it makes a static grid feel alive without being distracting, and maps directly to background textures for cinematic-dark presentations.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / continuous | grid-breathe | ~3000ms cycle | ease-in-out | Baseline dot grid at uniform small scale, barely perceptible |
| 0:00 / continuous | wave-propagation | ~2000ms per wave | ease-in-out | Circular distortion wave travels from origin point, enlarging dots in its path |
| wave center | dot-scale-peak | ~400ms per dot | ease-out | Individual dots scale from 1x to ~3x as wave passes over them |
| wave edge | dot-scale-settle | ~600ms per dot | ease-in-out | Dots smoothly return to baseline size after wave passes |
| continuous | origin-shift | ~4000ms | linear | Wave origin point slowly drifts across the grid between emissions |

## Technique Breakdown

The effect is achievable in CSS with a grid of elements and JS-driven distance calculations, or in Canvas for performance at high dot counts.

```css
/* CSS approach for moderate dot counts (~100-200) */
.dot-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: 0;
}

.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: transform 400ms ease-out, opacity 300ms ease-out;
  transform: scale(1);
}

.dot.wave-active {
  transform: scale(2.5);
  opacity: 1;
  background: rgba(255, 255, 255, 0.8);
}
```

```javascript
// JS wave propagation
function emitWave(originX, originY, speed = 0.15) {
  const dots = document.querySelectorAll('.dot');
  dots.forEach(dot => {
    const rect = dot.getBoundingClientRect();
    const dx = rect.left - originX;
    const dy = rect.top - originY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const delay = distance * speed; // ms per pixel of distance

    setTimeout(() => {
      dot.classList.add('wave-active');
      setTimeout(() => dot.classList.remove('wave-active'), 600);
    }, delay);
  });
}
```

## Choreography Notes

- The wave is **radial** — it emanates from a point and expands outward as a circle
- **Speed hierarchy is distance-based** — dots near the origin react immediately, distant dots react late, creating the wave illusion
- The wave origin **drifts slowly**, preventing the effect from feeling mechanical
- Multiple waves can overlap, creating **interference patterns** where dots scale even larger
- The grid itself is perfectly regular — all visual interest comes from the **temporal pattern**, not spatial arrangement

## What We Can Steal

- **`grid-wave` primitive** — A configurable wave propagation across any grid of elements. Parameters: origin point, wave speed, dot scale multiplier, wave radius. Applicable to card grids, feature grids, icon grids.
- **Distance-based stagger** — Instead of index-based stagger (0, 1, 2, 3...), use distance from a focal point. Creates organic, radial reveal patterns.
- **Ambient background texture** — The dot grid at baseline (without waves) is itself a subtle background pattern. With gentle waves, it becomes a living texture for dark backgrounds.

## What to Avoid

- **Too many dots** — At 500+ dots, CSS transitions become expensive. Switch to Canvas for large grids.
- **Constant wave emission** — Waves should have breathing room between them. Continuous waves become noise.
- **Colored dots** — The reference uses monochrome (white on black). Adding color would make it feel like a music visualizer, wrong register for product demos.
