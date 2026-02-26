---
ref: nl-dot-grid-breathing
title: "Neutral Light Dot Grid — Minimal Breathing"
source: "inspiration/c79fe55baf222da88a2552480b593def.gif"
type: gif
date: 2026-02-26
personality_affinity: neutral-light
tags: [grid, ambient, breathing, dot, subtle, background, light-mode, minimal]
quality_tier: exemplary
---

# Neutral Light Dot Grid — Minimal Breathing

## Summary

A dense ~9x9 grid of small black dots on a warm light background breathes with near-subliminal scale oscillation. This is the Neutral Light counterpart to `sparse-dot-breathing` — same family of ambient grid texture, but adapted for light palettes with denser spacing, darker dot color, and more restrained motion range. The effect reads as "alive but invisible" — exactly what tutorial and documentation backgrounds need. Present enough to prevent sterile emptiness, quiet enough that content remains the uncontested focal point.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / loop start | nl-dot-breathe | ~4500ms cycle | ease-in-out | Each dot oscillates scale(0.7) → scale(1.0) → scale(0.7) independently — tighter range than dark variant |
| continuous | phase-offset stagger | ~600ms offset between neighbors | ease-in-out | Adjacent dots breathe at staggered phases; diagonal offset + jitter creates organic ripple without visible wave pattern |
| continuous | opacity micro-shift | synced with scale | ease-in-out | Dots at minimum scale drop to ~0.35 opacity, full scale at ~0.6 opacity — more restrained than dark variant since dark-on-light has inherently higher contrast |

## Technique Breakdown

```css
/* bk-nl-dot-breathe — Light palette ambient dot grid */
.nl-dot-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 9), 1fr);
  gap: var(--grid-gap, 40px);
  padding: var(--grid-padding, 48px);
  background: var(--nl-bg-body, #fafaf9);
}

.nl-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--nl-text-tertiary, #78716c);
  animation: nl-dot-breathe var(--breathe-duration, 4500ms) ease-in-out infinite;
  animation-delay: var(--breathe-offset, 0ms);
}

@keyframes nl-dot-breathe {
  0%, 100% { transform: scale(0.7); opacity: 0.35; }
  50% { transform: scale(1.0); opacity: 0.6; }
}
```

```js
/* Phase offset calculation — organic stagger for dense grid */
dots.forEach((dot, i) => {
  const row = Math.floor(i / cols);
  const col = i % cols;
  // Diagonal phase offset — tighter multiplier for denser grid
  const offset = (row + col) * 200 + Math.random() * 500;
  dot.style.setProperty('--breathe-offset', `-${offset}ms`);
  // Duration variation prevents mechanical synchronization
  const duration = 4200 + Math.random() * 600;
  dot.style.setProperty('--breathe-duration', `${duration}ms`);
});
```

## Choreography Notes

- **Denser than sparse-dot-breathing.** ~9x9 grid (81 dots) vs ~7x7 (49 dots) with 40px gap vs 120px gap. Density works because light backgrounds tolerate more elements at lower contrast.
- **Smaller dots.** 3px base vs 4px. Dark-on-light dots read larger than white-on-dark at the same pixel size due to irradiation illusion. Compensate by reducing base size.
- **Tighter scale range.** 0.7–1.0 vs 0.6–1.0. Dark dots scaling large on light backgrounds are more noticeable — restraint is essential. The 30% range is enough to create life without pulling attention.
- **Lower opacity ceiling.** Peak opacity 0.6 vs 0.9. Dark dots at full opacity would be too prominent. The 0.35–0.6 range keeps dots feeling like texture, not content.
- **Slower cycle.** 4500ms vs 4000ms. Tutorials have longer dwell times and calmer pacing. The extra 500ms makes the breathing feel meditative rather than rhythmic.
- **Phase offset tuned for density.** 200ms base multiplier (vs 300ms for sparse) because more dots at tighter spacing need finer phase differentiation to avoid visible wave fronts.
- **No focal point.** Like sparse-dot-breathing, every dot has equal weight. This is background infrastructure, not foreground content.

## What We Can Steal

- **`bk-nl-dot-breathe`** — Drop-in ambient background for any Neutral Light prototype. Works behind cards, panels, empty states, and tutorial content. Uses only `--nl-*` tokens. The denser grid fills light backgrounds without the emptiness that sparse grids can create on light palettes.
- **Light-palette density formula** — When porting dark ambient textures to light: increase density, reduce element size, lower opacity ceiling, tighten scale range. This ratio (density +30%, size -25%, opacity -35%, scale range -33%) is reusable for any ambient effect crossing the dark→light boundary.
- **Phase offset scaling** — For denser grids, reduce the base phase multiplier proportionally to element count. Prevents visible wave patterns at high density: `baseMultiplier = 300 * (49 / elementCount)`.

## What to Avoid

- **Don't increase opacity above 0.7** — Dark dots on light backgrounds become distracting quickly. The power of this effect is its invisibility.
- **Don't use `currentColor` naively** — Unlike the universal sparse variant, this is specifically tuned for light backgrounds. Using stone-500 (`#78716c`) gives warmth. Pure black dots would feel clinical and harsh.
- **Don't reduce density below 7x7** — Sparse grids on light backgrounds feel empty and unintentional. The density creates a cohesive field.
- **Don't add blur or glow** — Neutral Light explicitly forbids these. The dots must remain sharp at all sizes. Blur on small elements at low opacity would make them disappear entirely.
- **Don't scale below 0.5** — At 3px base size, scale(0.5) produces sub-pixel dots (1.5px) that render inconsistently across displays and create shimmer artifacts.
