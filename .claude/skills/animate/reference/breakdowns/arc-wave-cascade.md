---
ref: arc-wave-cascade
title: "Arc Wave Cascade — Vertical Stagger"
source: "inspiration/1dbb8e843ebd768cc3d74370493489ac.gif"
type: gif
date: 2026-02-24
personality_affinity: cinematic-dark
tags: [arc, cascade, stagger, wave, curve, entrance, reveal]
quality_tier: strong
---

# Arc Wave Cascade — Vertical Stagger

## Summary

Curved white arcs on black stagger vertically, each one entering and exiting in sequence to create a cascading wave pattern. The arcs are thin, delicate, and spaced with generous rhythm — approximately 8-10 arcs distributed vertically, each offset ~80ms from its neighbor. The overall motion reads as a single flowing gesture, not individual elements. This is stagger choreography at its most musical.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / loop start | arc entrance | ~600ms per arc | expo-out | Each arc draws from center outward via stroke-dashoffset or clip-path, growing from 0 to full width |
| 0:00+ | vertical cascade stagger | ~80ms interval | — | Each successive arc begins 80ms after the one above, creating a top-to-bottom wave |
| ~0:01 / mid-cycle | horizontal drift | ~2000ms | ease-in-out | The entire column of arcs shifts horizontally, arcs on top drifting more than bottom (parallax) |
| ~0:02 / exit | arc dissolution | ~400ms per arc | ease-in | Arcs fade + scale down in reverse order (bottom-to-top), creating bidirectional cascade |
| continuous | curvature variation | per-arc | — | Each arc has slightly different radius and rotation, preventing uniformity |

## Technique Breakdown

```css
/* bk-arc-cascade — Staggered arc entrance */
.arc {
  width: 120px;
  height: 60px;
  border: 2px solid white;
  border-radius: 50%;
  border-bottom-color: transparent;
  border-left-color: transparent;
  border-right-color: transparent;
  opacity: 0;
  transform: scale(0.3) rotate(calc(var(--arc-rotation, 0) * 1deg));
  animation: arc-enter 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(var(--arc-index) * 80ms);
}

@keyframes arc-enter {
  0% { opacity: 0; transform: scale(0.3) rotate(calc(var(--arc-rotation) * 1deg)); }
  40% { opacity: 1; }
  100% { opacity: 0.85; transform: scale(1) rotate(calc(var(--arc-rotation) * 1deg)); }
}

/* Alternative: SVG stroke-dashoffset for true arc drawing */
.arc-svg path {
  stroke-dasharray: var(--arc-length);
  stroke-dashoffset: var(--arc-length);
  animation: arc-draw 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(var(--arc-index) * 80ms);
}

@keyframes arc-draw {
  to { stroke-dashoffset: 0; }
}
```

```css
/* Exit — reverse stagger, bottom-to-top */
.arc.exit {
  animation: arc-exit 400ms ease-in forwards;
  animation-delay: calc((var(--total-arcs) - var(--arc-index)) * 60ms);
}

@keyframes arc-exit {
  to { opacity: 0; transform: scale(0.5) rotate(calc(var(--arc-rotation) * 1deg)); }
}
```

## Choreography Notes

- **Bidirectional cascade.** Entrance flows top-to-bottom, exit flows bottom-to-top. This creates a natural breathing rhythm — the wave goes down, then comes back up.
- **Speed hierarchy between enter and exit.** Entry is 600ms (slow, dramatic). Exit is 400ms (faster, retreating). The asymmetry makes the entrance feel like arrival and the exit feel like departure.
- **Stagger interval tightens on exit.** 80ms entry, 60ms exit. Faster stagger on exit prevents the exit from dragging.
- **Curvature variation prevents barcode effect.** Each arc has slight rotation and radius differences. Without variation, stacked arcs look like a loading spinner.

## What We Can Steal

- **`bk-arc-cascade`** — A new stagger shape. We have grid staggers (grid-flip-cascade), distance staggers (distance-stagger), and slide staggers (engines). This adds curved/arc stagger — elegant for feature list reveals, timeline entries, or decorative transitions between phases.
- **Bidirectional stagger technique** — Enter top-down, exit bottom-up. Applies to any staggered sequence — cards, list items, navigation links. More sophisticated than enter and exit in the same direction.
- **SVG stroke-dashoffset drawing** — The self-drawing arc is the same technique as `cd-draw-checks` but applied to decorative curves. Could be used for diagram reveals, connection lines, or decorative borders.

## What to Avoid

- **Don't use for dense content.** Arcs work as decorative punctuation between content sections, not as content containers. They're scenery.
- **Don't synchronize curvature.** Identical arcs in a stack look like a loading indicator. Variation is what makes this look organic rather than utilitarian.
