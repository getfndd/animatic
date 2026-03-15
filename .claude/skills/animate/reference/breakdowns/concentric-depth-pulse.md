---
ref: concentric-depth-pulse
title: "Concentric Depth Pulse — Layered Ring Breathing"
source: "inspiration/e6f6f8559f8e7583812dcc45ec6f7de1.gif"
type: gif
date: 2026-03-03
personality_affinity: universal
tags: [concentric, rings, pulse, breathing, depth, scale, ambient, continuous, brand, minimal, tunnel]
quality_tier: strong
---

# Concentric Depth Pulse — Layered Ring Breathing

## Summary

Five to six concentric circles on a light grey background, each a slightly different shade of grey-blue — lighter on the outside, darker toward the center. The circles pulse inward and outward with staggered timing, creating a tunnel/vortex breathing effect. The darkest ring at center reads as infinite depth — a hole into space. The effect is pure CSS: stacked `<div>`s with `border-radius: 50%` and staggered `scale` keyframes. No filters, no canvas, no JS required. Deceptively simple but hypnotic. This is the minimal end of the brand animation spectrum — achievable with the least code but still visually compelling.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| continuous | ring scale pulse | ~3000ms per cycle | ease-in-out | Each ring scales between ~0.92 and ~1.08. The inner rings pulse with a slight delay after the outer rings, creating a wave traveling inward. |
| continuous | stagger delay | ~200ms per ring | — | Each successive ring (outside→in) starts its pulse ~200ms later. This creates the "wave traveling toward center" illusion. |
| continuous | color depth gradient | — | — | Outer rings: `hsl(220, 10%, 75%)`. Inner rings: `hsl(220, 15%, 20%)`. The darkening toward center creates the tunnel/depth illusion. |
| continuous | edge softness | — | — | Ring edges are slightly soft — adjacent rings overlap at similar values, so boundaries between them are subtle, not hard lines. |
| continuous | infinite center | — | — | The innermost circle is the darkest value, reading as a void. No bottom to the tunnel — it suggests infinite depth. |

## Technique Breakdown

```css
.tunnel-container {
  position: relative;
  width: 500px;
  height: 500px;
}

.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: ring-pulse 3000ms ease-in-out infinite;
}

/* Each ring: smaller, darker, more delayed */
.ring-1 {
  background: hsl(220, 10%, 75%);
  transform: scale(1);
  animation-delay: 0ms;
}
.ring-2 {
  background: hsl(220, 11%, 62%);
  inset: 12%;
  animation-delay: 200ms;
}
.ring-3 {
  background: hsl(220, 12%, 50%);
  inset: 24%;
  animation-delay: 400ms;
}
.ring-4 {
  background: hsl(220, 13%, 38%);
  inset: 36%;
  animation-delay: 600ms;
}
.ring-5 {
  background: hsl(220, 14%, 28%);
  inset: 48%;
  animation-delay: 800ms;
}
.ring-6 {
  background: hsl(220, 15%, 18%);
  inset: 60%;
  animation-delay: 1000ms;
}

@keyframes ring-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.08); }
}
```

```html
<div class="tunnel-container">
  <div class="ring ring-1"></div>
  <div class="ring ring-2"></div>
  <div class="ring ring-3"></div>
  <div class="ring ring-4"></div>
  <div class="ring ring-5"></div>
  <div class="ring ring-6"></div>
</div>
```

### Variation: Asymmetric Breathing

```css
/* More organic: different rings scale different amounts */
.ring-1 { animation: ring-pulse-outer 3200ms ease-in-out infinite; }
.ring-3 { animation: ring-pulse-mid   2800ms ease-in-out infinite; }
.ring-5 { animation: ring-pulse-inner 3400ms ease-in-out infinite; }

@keyframes ring-pulse-outer { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes ring-pulse-mid   { 0%,100% { transform: scale(1); } 50% { transform: scale(1.10); } }
@keyframes ring-pulse-inner { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
```

Using different durations per ring (not just delay) breaks the strict wave pattern and creates a more organic, less mechanical feel. The rings drift in and out of sync — similar to the polyrhythmic technique in the metaball reference.

## Choreography Notes

- **Stagger delay creates the wave.** This is the entire effect: identical animations with offset start times. The 200ms delay between rings means the pulse "travels" from outer to inner in ~1000ms, then the cycle repeats. This is a radial version of the classic CSS stagger pattern.
- **Color gradient creates the depth.** Without the darkening toward center, this reads as flat pulsing circles. The luminance gradient is what transforms it into a tunnel. The hue shift is minimal (10% → 15% saturation) — it's primarily a lightness effect.
- **Scale amount is restrained.** The ±8% scale change is barely perceptible per ring. The effect comes from all rings pulsing together with stagger — the aggregate motion reads as breathing even though individual changes are subtle.
- **Works on any background.** Unlike the metaball (needs dark) or grain blob (needs flat), this works on light, dark, or colored backgrounds. Adjust the ring color palette to match. This makes it the most versatile ambient technique of the three.

## What We Can Steal

- **`bk-concentric-pulse`** — Pure CSS ambient background. Zero JS, zero filters, minimal DOM (6 elements). Works at any size, any color scheme, any personality. The lowest-cost ambient animation in the toolkit.
- **Stagger-as-wave** — The insight that staggered identical animations create a traveling wave. We already use linear stagger (items appearing in sequence). This is radial stagger — items pulsing in a wave from outside to center (or vice versa). Could apply to: ring menus, status indicators, focus rings, loading states.
- **Luminance-as-depth** — The tunnel illusion is entirely from the color gradient. No perspective, no 3D transforms, no blur. This is the cheapest way to imply depth. Applicable to: layered card stacks, nested containers, hierarchical data visualization.
- **Polyrhythmic variation** — The asymmetric breathing variant (different durations per ring) is more organic and should be preferred for brand use. The strict stagger version is more mechanical — better for loading/processing states where regularity implies "working."

## What to Avoid

- **Don't use too many rings.** 5-7 is the sweet spot. More than 8 and the inner rings become too small to see, plus the stagger delay pushes the wave cycle too long. Fewer than 4 and there's no tunnel effect.
- **Don't scale too aggressively.** Beyond ±12%, the rings start to overlap/separate visibly, breaking the smooth gradient. The subtlety is the point.
- **Don't add borders.** Hard ring boundaries would expose the layering trick and make each ring read as a separate element rather than a continuous gradient. The overlapping edges at similar values create the smooth look.
- **Don't center content inside.** It's tempting to put a logo or icon in the center of the tunnel. This breaks the "infinite depth" read — suddenly the tunnel has a bottom. If content is needed, place it overlaid with opacity, not nested inside the rings.
