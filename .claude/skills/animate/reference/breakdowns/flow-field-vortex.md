---
ref: flow-field-vortex
title: "Flow Field Vortex — Directional Line Segments"
source: "inspiration/5fb8c0ab314dfdca42f994a38c636ef2.gif"
type: gif
date: 2026-02-24
personality_affinity: cinematic-dark
tags: [flow-field, vortex, ambient, particle, rotation, generative, background, continuous]
quality_tier: strong
---

# Flow Field Vortex — Directional Line Segments

## Summary

A grid of short white line segments on black, each rotating to align with a flow field that creates a vortex pattern. The field has one or more attractor points — segments near the center rotate faster and point toward the center, while peripheral segments align tangentially. The overall effect reads as wind or magnetic field lines. This is generative ambient motion — mathematical, organic, and endlessly looping. Useful as a cinematic background layer that suggests energy and complexity without specific content.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / continuous | field rotation | per-segment, continuous | linear (angular velocity) | Each segment rotates to follow the flow field angle at its position |
| continuous | vortex formation | ~3000ms cycle | ease-in-out | Attractor point(s) drift slowly, segments re-orient to follow, creating shifting vortex patterns |
| continuous | speed gradient | — | — | Segments near attractor rotate faster (~180deg/s), peripheral segments barely move (~10deg/s). Clear speed hierarchy. |
| continuous | length variation | — | — | Segments nearer the center appear shorter (foreshortening from faster rotation), periphery segments at full length |
| continuous | opacity depth | — | — | Segments at periphery are dimmer (~0.3 opacity), center segments brighter (~0.9). Depth through luminance. |

## Technique Breakdown

```css
/* Individual line segment base style */
.flow-segment {
  position: absolute;
  width: var(--seg-length, 20px);
  height: 1px;
  background: white;
  opacity: var(--seg-opacity, 0.5);
  transform-origin: center;
  transform: rotate(var(--seg-angle, 0deg));
  transition: transform 100ms linear;
}
```

```js
/* bk-flow-field — Vortex flow field calculation */
class FlowField {
  constructor(canvas, { cols = 20, rows = 20, segLength = 18 } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.segLength = segLength;
    this.attractor = { x: 0.5, y: 0.5 }; // normalized
    this.segments = this.createGrid(canvas);
    this.time = 0;
  }

  createGrid(container) {
    const segments = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const el = document.createElement('div');
        el.className = 'flow-segment';
        const x = (c + 0.5) / this.cols;
        const y = (r + 0.5) / this.rows;
        el.style.left = `${x * 100}%`;
        el.style.top = `${y * 100}%`;
        container.appendChild(el);
        segments.push({ el, x, y });
      }
    }
    return segments;
  }

  update() {
    this.time += 0.01;
    // Drift the attractor slowly
    this.attractor.x = 0.5 + Math.sin(this.time * 0.3) * 0.2;
    this.attractor.y = 0.5 + Math.cos(this.time * 0.4) * 0.2;

    this.segments.forEach(seg => {
      const dx = seg.x - this.attractor.x;
      const dy = seg.y - this.attractor.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Angle: tangent to circle around attractor + noise
      const baseAngle = Math.atan2(dy, dx) + Math.PI / 2;
      const noise = Math.sin(seg.x * 4 + this.time) * 0.3;
      const angle = baseAngle + noise;

      // Speed hierarchy: closer = more rotation influence
      const influence = Math.max(0, 1 - dist * 2);

      // Opacity depth: periphery dimmer
      const opacity = 0.3 + influence * 0.6;

      seg.el.style.setProperty('--seg-angle', `${angle * (180 / Math.PI)}deg`);
      seg.el.style.setProperty('--seg-opacity', opacity);
    });

    requestAnimationFrame(() => this.update());
  }
}
```

## Choreography Notes

- **The attractor is the conductor.** It drifts slowly on a Lissajous path, and every segment responds. This is the speed hierarchy writ large: the attractor moves slowly (3000ms cycle), segments near it rotate quickly, segments far away barely respond.
- **Tangential alignment creates the vortex.** Segments point perpendicular to the radius from the attractor, not toward it. This creates swirl rather than convergence. The `+ Math.PI / 2` is the key line.
- **Noise prevents uniformity.** The `sin(x * 4 + time) * 0.3` term adds organic variation. Without it, the flow field is too perfect — like a textbook diagram. With it, the field feels like wind.
- **Opacity as depth cue.** Brighter = closer to the action. This creates a natural spotlight effect around the attractor without any additional glow or shadow.

## What We Can Steal

- **`bk-flow-field`** — A cinematic ambient background that suggests energy and intelligence. Perfect for AI product demos, data processing visualizations, or any context where "complex system at work" is the message. More sophisticated than particle effects, less heavy than WebGL.
- **Attractor-driven animation** — The concept of a single control point that influences a field of elements. Could adapt for cursor-following effects (attractor = mouse position), scroll-driven reveals (attractor = scroll progress), or focus indicators (attractor = focused element).
- **Speed gradient as meaning** — The distance-to-speed relationship communicates hierarchy without any labels. Closer = more important/active. This principle applies to any field of elements.

## What to Avoid

- **Don't use too many segments.** 20x20 (400) is the upper bound for CSS-based implementation. Beyond that, use Canvas. DOM elements with transform updates at 60fps get expensive.
- **Don't make the attractor move too fast.** If the vortex center moves quickly, the field looks chaotic rather than elegant. Keep the Lissajous cycle above 3000ms.
- **Don't overlay on text.** This is a background-only effect. Line segments crossing over readable text creates visual noise. Use it behind hero sections with large, high-contrast type.
