---
ref: linear-homepage
title: "Linear Homepage — Spring Physics Product Demo"
source: "https://linear.app"
type: website
date: 2026-02-24
personality_affinity: cinematic-dark
tags: [spring, speed-hierarchy, stagger, hover, product-demo, dark-ui, bento]
quality_tier: exemplary
---

# Linear Homepage — Spring Physics Product Demo

## Summary

Linear's homepage is the gold standard for product animation in SaaS. Every transition uses spring physics with extreme restraint — 150-300ms micro-interactions, a visible speed hierarchy across elements, and purposeful-only motion. The dark UI creates a cinematic canvas where the product speaks through real interface demos, not marketing abstraction. This is the reference Saul should consult for calibrating "how much is enough."

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| page load | hero-fade-up | 600ms | spring (stiff) | Hero text and CTA fade up from translateY(20px) with spring settle |
| page load + 200ms | product-screenshot-reveal | 800ms | spring (gentle) | Product screenshot scales from 0.95 to 1.0 with blur-to-sharp |
| scroll 20% | bento-stagger | 120ms interval | spring | Bento grid cards stagger in with fade + translateY, spring overshoot |
| hover / bento card | card-lift | 200ms | spring (snappy) | Card lifts with translateY(-4px) + elevated shadow + subtle scale(1.01) |
| hover / nav item | underline-slide | 150ms | ease-out | Active indicator slides to hovered nav item position |
| scroll / feature section | feature-demo-play | auto | spring | Embedded product demos auto-play showing real interface interactions |
| scroll / metrics | count-up | 800ms | ease-out | Numbers count from 0 to target value with ease-out deceleration |

## Technique Breakdown

```css
/* Linear's CSS linear() spring curve — the signature */
/* Encodes true bounce with 50+ stop points */
--spring-bounce: linear(
  0, 0.004, 0.016, 0.035, 0.063, 0.098, 0.141, 0.191,
  0.25, 0.316, 0.391, 0.473, 0.562, 0.659, 0.763, 0.876,
  1.000, 1.025, 1.042, 1.052, 1.056, 1.054, 1.047,
  1.036, 1.022, 1.007, 0.992, 0.979, 0.970, 0.966,
  0.966, 0.969, 0.975, 0.983, 0.991, 0.998, 1.003,
  1.005, 1.005, 1.003, 1.000
);

/* Speed hierarchy — the key insight */
.nav-item { transition: all 150ms ease-out; }           /* FAST */
.hero-text { transition: all 300ms var(--spring-bounce); } /* MEDIUM */
.bento-card { transition: all 200ms var(--spring-bounce); } /* MEDIUM */
.product-demo { transition: all 500ms var(--spring-bounce); } /* SLOW */
.page-section { transition: all 800ms ease-out; }          /* SCENE */

/* Card hover — minimal but precise */
.bento-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}
```

## Choreography Notes

- **Speed hierarchy is the secret.** Header and navigation are fast (150ms). Cards are medium (200ms). Product demos are slow (500ms). Page sections are scene-level (800ms). This creates the illusion of a camera focusing — fast peripheral motion, deliberate center-stage motion.
- **Spring physics everywhere, but with high damping.** The bounce is barely perceptible — maybe 2-5% overshoot. It's felt more than seen.
- **Staging is extreme.** Only one section demands attention at a time. Scroll reveals are sequential, never simultaneous.
- **Dark UI is the canvas.** The near-black background means every element is a light source. Motion of light against dark is inherently more cinematic than motion on white.
- **Real product demos, not illustrations.** The bento cards show actual interface states, not abstract graphics. The product is the animation.

## What We Can Steal

- **CSS `linear()` spring curves** — Replace our cubic-bezier spring approximations with true bounce curves. Our existing speed hierarchy already models this; `linear()` makes the bounce mathematically accurate.
- **Speed hierarchy calibration** — Linear's specific tier durations (150 / 200-300 / 500 / 800ms) are well-tested. Use as defaults for neutral-light and editorial.
- **Card hover pattern** — translateY(-4px) + scale(1.01) + shadow elevation. Minimal, precise, satisfying. Better than scale-only hovers.
- **Bento stagger at 120ms** — This interval is fast enough to feel cohesive but slow enough to read each card. Use as the default stagger interval for grid reveals.

## What to Avoid

- **Over-constraining to Linear's taste.** Linear is deliberately minimal. Our cinematic-dark personality should go further — deeper springs, longer staggers, camera motion. Linear is the editorial/neutral-light benchmark, not the cinematic one.
- **Copying their exact spring values.** Their spring tuning is specific to their UI density and element sizes. Test springs in context.
