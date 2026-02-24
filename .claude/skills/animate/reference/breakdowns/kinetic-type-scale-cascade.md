---
ref: kinetic-type-scale-cascade
title: "Kinetic Typography — Scale Cascade"
source: "inspiration/2d93764cc6f62e90fddf91a91920d737.gif"
type: gif
date: 2026-02-24
personality_affinity: cinematic-dark
tags: [typography, kinetic-type, scale, cascade, parallax, scroll-driven]
quality_tier: strong
---

# Kinetic Typography — Scale Cascade

## Summary

Bold text ("ALICIA KEYS") displayed at three different scales, cascading vertically with scroll-like parallax motion. The same text repeats at large, medium, and small sizes, creating a rhythmic falling-stack effect. The parallax differential between the three instances creates depth and drama. This is a pure typography-as-motion study — the text itself is the entire visual, animated only through scale and vertical position.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / loop start | text-stack-entrance | 800ms | expo-out | Three text instances stagger in from below, largest first |
| continuous | parallax-scroll | ~3000ms cycle | linear | Three text layers scroll at different speeds — large moves slow, small moves fast |
| scroll midpoint | scale-pulse | 200ms | ease-out | Subtle scale(1.02) pulse on the middle instance as it passes center |
| loop end | text-cascade-exit | 600ms | ease-in | All three instances accelerate upward and off-screen |

## Technique Breakdown

```css
/* Three-layer text stack with parallax differential */
.kinetic-text-container {
  overflow: hidden;
  height: 100vh;
  position: relative;
}

.text-layer {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-weight: 900;
  text-transform: uppercase;
  color: white;
  white-space: nowrap;
}

.text-layer--large {
  font-size: clamp(8rem, 15vw, 12rem);
  animation: scroll-slow 3s linear infinite;
}

.text-layer--medium {
  font-size: clamp(5rem, 10vw, 8rem);
  animation: scroll-medium 3s linear infinite;
  animation-delay: -0.3s;
}

.text-layer--small {
  font-size: clamp(3rem, 6vw, 5rem);
  animation: scroll-fast 3s linear infinite;
  animation-delay: -0.6s;
}

@keyframes scroll-slow {
  0% { transform: translateY(100vh); }
  100% { transform: translateY(-100%); }
}

@keyframes scroll-medium {
  0% { transform: translateY(120vh); }
  100% { transform: translateY(-100%); }
}

@keyframes scroll-fast {
  0% { transform: translateY(140vh); }
  100% { transform: translateY(-100%); }
}
```

## What We Can Steal

- **`text-parallax-stack` primitive** — Repeat the same text at 3 scales with different scroll speeds. Useful for hero sections, title sequences, loading states. Parameters: text content, scale ratios, speed differential.
- **Scale-as-depth** — Instead of 3D perspective transforms, using font-size differences alone creates convincing depth. Lighter than perspective camera rigs.
- **Loop-friendly typography** — The infinite scroll creates seamless loops for video capture, unlike fade-in/out which has dead time.

## What to Avoid

- **More than 3 layers** — Tested at 4-5 layers and it becomes visual noise. Three is the sweet spot for depth illusion.
- **Mixed fonts or colors** — The power is in repetition. Varying the text defeats the rhythm.
- **Slow speeds** — The cascade needs to feel like falling, not floating. Under 2s/cycle feels too slow for this pattern.
