---
ref: sparse-dot-breathing
title: "Sparse Dot Grid — Ambient Breathing"
source: "inspiration/d554090aad9cd82e16d78252ed52d0d1.gif"
type: gif
date: 2026-02-24
personality_affinity: universal
tags: [grid, ambient, breathing, dot, subtle, background]
quality_tier: strong
---

# Sparse Dot Grid — Ambient Breathing

## Summary

A sparse grid of small white dots on dark gray breathes with subtle scale oscillation. The effect is nearly subliminal — dots pulse between ~2px and ~4px radius at staggered intervals. This is the archetype of ambient background texture: present enough to create life, quiet enough to never distract. Directly usable as a background layer in any personality.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / loop start | sparse-breathe | ~4000ms cycle | ease-in-out | Each dot oscillates scale(0.6) → scale(1.0) → scale(0.6) independently |
| continuous | phase-offset stagger | ~800ms offset between neighbors | ease-in-out | Adjacent dots breathe at different phases, creating organic ripple appearance |
| continuous | opacity micro-shift | synced with scale | ease-in-out | Dots at minimum scale drop to ~0.5 opacity, full scale at ~0.9 opacity |

## Technique Breakdown

```css
/* bk-sparse-breathe — Ambient dot grid breathing */
.dot-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 7), 1fr);
  gap: var(--grid-gap, 120px);
  padding: var(--grid-padding, 60px);
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  animation: sparse-breathe var(--breathe-duration, 4000ms) ease-in-out infinite;
  animation-delay: var(--breathe-offset, 0ms);
}

@keyframes sparse-breathe {
  0%, 100% { transform: scale(0.6); opacity: 0.5; }
  50% { transform: scale(1.0); opacity: 0.9; }
}
```

```js
/* Phase offset calculation — organic stagger */
dots.forEach((dot, i) => {
  const row = Math.floor(i / cols);
  const col = i % cols;
  // Diagonal phase offset creates wave-like breathing
  const offset = (row + col) * 300 + Math.random() * 400;
  dot.style.setProperty('--breathe-offset', `-${offset}ms`);
  // Slight duration variation prevents mechanical feel
  const duration = 3600 + Math.random() * 800;
  dot.style.setProperty('--breathe-duration', `${duration}ms`);
});
```

## Choreography Notes

- **No focal point.** Unlike the dense grid ripple (dot-grid-ripple), this has no wave center or propagation — every dot is equal weight. This is background, not foreground.
- **Stagger is decorrelated.** Diagonal offset + randomness means no visible wave pattern. The breathing feels ambient and organic, like stars twinkling.
- **Duration variation is key.** Without per-dot duration jitter, the grid looks mechanical. The 3600-4400ms range creates drift that prevents phase-locking.
- **Works on light or dark.** Change `currentColor` — dots at 0.5-0.9 opacity work against any solid background.

## What We Can Steal

- **`bk-sparse-breathe`** — Drop-in ambient background for any prototype. Works at any density. Zero interaction required. Perfect for hero sections, empty states, or loading screens that need life without distraction.
- **Phase decorrelation technique** — The diagonal-offset + random-jitter formula is reusable for any continuous grid animation where mechanical synchronization is the enemy.

## What to Avoid

- **Don't increase dot size beyond ~6px** — Larger dots become distracting. The power of this effect is its subtlety.
- **Don't increase scale range beyond 0.4-1.2** — Too much oscillation creates a "pulsing" look that pulls attention.
- **Don't use on busy backgrounds** — This needs a solid color field to breathe against. Layering over content creates noise.
