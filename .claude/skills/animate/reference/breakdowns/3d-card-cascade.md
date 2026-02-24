---
ref: 3d-card-cascade
title: "3D Card Cascade — Isometric Grid Flip"
source: "inspiration/4741682fe0bac7601c10dd15deb2a6fe.gif"
type: gif
date: 2026-02-24
personality_affinity: editorial
tags: [3d, grid, cascade, flip, stagger, card, reveal]
quality_tier: strong
---

# 3D Card Cascade — Isometric Grid Flip

## Summary

A 4x5 grid of cards that flip sequentially along the Y-axis, creating a wave-like cascade through the grid. Each card has a pink face and a hatched/textured back, so the flip reveals and conceals content in a rhythmic pattern. The stagger timing creates diagonal or row-by-row wave propagation. This pattern maps directly to feature grids, card-based layouts, and any grid of items that need a dramatic reveal.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / sequence start | card-flip-start | 600ms per card | cubic-bezier(0.4, 0, 0.2, 1) | First card begins Y-axis rotation from 0deg to 180deg |
| +80ms per card | cascade-propagation | 80ms interval | — | Each subsequent card flips 80ms after its neighbor, creating a wave |
| mid-flip (90deg) | face-swap | instant | — | At 90deg rotation, backface-visibility swaps which face is visible |
| full grid | wave-completion | ~2000ms total | — | Wave takes ~2s to propagate across the entire 4x5 grid |
| +500ms pause | reverse-cascade | same timing | — | Grid flips back in reverse order, revealing original faces |

## Technique Breakdown

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  perspective: 1000px;
}

.card {
  aspect-ratio: 1;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1);
}

.card.flipped {
  transform: rotateY(180deg);
}

.card-face,
.card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 4px;
}

.card-face {
  background: var(--card-color, #f4a0b0);
}

.card-back {
  background: var(--card-back, #3a3a3a);
  transform: rotateY(180deg);
  /* Hatched pattern via repeating-linear-gradient */
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(255,255,255,0.1) 3px,
    rgba(255,255,255,0.1) 4px
  );
}
```

```javascript
// Cascade propagation — row-by-row or diagonal
function cascadeFlip(grid, direction = 'row') {
  const cards = grid.querySelectorAll('.card');
  const cols = 4;

  cards.forEach((card, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    let delay;

    if (direction === 'row') {
      delay = row * 120 + col * 80;
    } else if (direction === 'diagonal') {
      delay = (row + col) * 80;
    }

    setTimeout(() => card.classList.toggle('flipped'), delay);
  });
}
```

## Choreography Notes

- **Diagonal propagation** (row + col index) looks more organic than strict row-by-row
- The **80ms interval** is fast enough to feel like a wave but slow enough to track individual cards
- **Backface-visibility** is the key mechanism — the card content genuinely flips, it's not a crossfade
- The **reverse cascade** (unflipping) provides a natural loop point and avoids the need for a separate exit animation

## What We Can Steal

- **`grid-flip-cascade` primitive** — Staggered 3D flip across a card grid. Parameters: grid dimensions, stagger interval, direction (row/diagonal/radial), flip axis (X/Y).
- **Backface as content reveal** — Two-sided cards where flipping reveals secondary information (metadata, descriptions, status badges).
- **Diagonal stagger timing** — `(row + col) * interval` creates a more organic wave than sequential index.

## What to Avoid

- **rotateX flips** — Vertical axis (rotateY) flips feel like turning pages; horizontal axis (rotateX) feels like a door hinge. Y-axis is more elegant for grids.
- **Perspective too shallow** — Below 600px perspective, the flip distortion becomes extreme. 1000px is a safe default.
- **Too many columns** — At 6+ columns, the cascade takes too long and loses impact. 3-5 columns is ideal.
