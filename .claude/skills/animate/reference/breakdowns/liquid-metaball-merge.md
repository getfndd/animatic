---
ref: liquid-metaball-merge
title: "Liquid Metaball Merge — Gooey Color Blob Chain"
source: "inspiration/981eda34a95fef99dac182a771eb027d.gif"
type: gif
date: 2026-03-03
personality_affinity: cinematic-dark
tags: [metaball, liquid, gooey, svg-filter, blob, color, continuous, ambient, generative, brand]
quality_tier: exemplary
---

# Liquid Metaball Merge — Gooey Color Blob Chain

## Summary

Four colored circles (yellow, green, magenta, cyan) on a dark navy background oscillate horizontally and merge with a liquid gooey effect. When circles overlap, they form organic bridges — the connection stretches and snaps like surface tension on a liquid. Each circle maintains its own color, with gradients blending at merge points. The effect is achieved via SVG `feGaussianBlur` + `feColorMatrix` alpha threshold filter — a well-documented metaball technique that's pure CSS/SVG with no canvas or WebGL required. This is the canonical "liquid brand animation" and appears constantly in brand identities, loading states, and hero backgrounds.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| continuous | metaball merge | — | SVG filter (not easing) | Circles that overlap produce gooey bridge connections via blur+threshold filter. The merge is a visual artifact of the filter, not explicit geometry. |
| continuous | horizontal oscillation | ~2000-3000ms per cycle | sine (ease-in-out) | Each circle oscillates left-right on its own frequency. Slight frequency differences create phase drift — circles merge and separate organically. |
| continuous | color gradient blend | — | — | At merge points, adjacent circle colors blend (yellow↔green, green↔magenta, magenta↔cyan). The blur step creates smooth gradients between them. |
| continuous | scale breathing | ~4000ms cycle | sine | Circles subtly pulse in size (±10-15%), varying the merge threshold — sometimes barely touching, sometimes deeply merged. |
| continuous | vertical stillness | — | — | Circles only move horizontally. No vertical drift. This constraint makes the motion feel intentional, like beads on a wire. |

## Technique Breakdown

```html
<!-- SVG filter that creates the metaball/gooey effect -->
<svg style="position:absolute; width:0; height:0;">
  <defs>
    <filter id="gooey">
      <!-- Step 1: Blur all shapes together -->
      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
      <!-- Step 2: Threshold the alpha channel — only bright areas survive -->
      <feColorMatrix in="blur" type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 20 -10" result="gooey" />
      <!-- Step 3: Composite original colors back through the gooey mask -->
      <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
    </filter>
  </defs>
</svg>
```

**How the filter works:**
- `feGaussianBlur` blurs all shapes together. Where shapes overlap, their blurred fields combine and become brighter/more opaque.
- `feColorMatrix` applies a steep alpha threshold: `alpha * 20 - 10`. This means only areas with combined alpha > 0.5 survive. The effect: individual circles stay circular, but overlapping blur zones become solid, creating the organic bridge.
- `feComposite atop` brings the original sharp colors back through the gooey alpha mask.

```css
/* Container applies the filter to all child circles */
.metaball-container {
  filter: url(#gooey);
  position: relative;
  width: 400px;
  height: 200px;
}

/* Individual blobs — CSS keyframe oscillation */
.blob {
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  top: 50%;
  transform: translateY(-50%);
}

.blob-1 {
  background: #faff00; /* yellow */
  left: 80px;
  animation: oscillate-1 2400ms ease-in-out infinite alternate;
}
.blob-2 {
  background: #00ff66; /* green */
  left: 140px;
  animation: oscillate-2 2800ms ease-in-out infinite alternate;
}
.blob-3 {
  background: #ff33ff; /* magenta */
  left: 200px;
  animation: oscillate-3 2200ms ease-in-out infinite alternate;
}
.blob-4 {
  background: #00ffee; /* cyan */
  left: 260px;
  animation: oscillate-4 2600ms ease-in-out infinite alternate;
}

/* Each blob gets a different frequency to create phase drift */
@keyframes oscillate-1 { to { transform: translateY(-50%) translateX(30px); } }
@keyframes oscillate-2 { to { transform: translateY(-50%) translateX(-20px); } }
@keyframes oscillate-3 { to { transform: translateY(-50%) translateX(25px); } }
@keyframes oscillate-4 { to { transform: translateY(-50%) translateX(-30px); } }
```

```js
/* Optional: scale breathing for organic feel */
const blobs = document.querySelectorAll('.blob');
let time = 0;

function breathe() {
  time += 0.008;
  blobs.forEach((blob, i) => {
    const phase = i * 1.2;  // offset each blob
    const scale = 1 + Math.sin(time + phase) * 0.12;
    blob.style.transform += ` scale(${scale})`;
  });
  requestAnimationFrame(breathe);
}
// Note: if using CSS keyframes for position, use a separate
// wrapper element for JS-driven scale to avoid transform conflicts.
```

## Choreography Notes

- **The filter does the choreography.** There's no explicit merge animation — circles just move, and the SVG filter creates the liquid connection automatically when they're close enough. This is fundamentally different from illustration animation: no causality graph, no sequenced reveals. The "choreography" is choosing oscillation frequencies that produce pleasing phase drift patterns.
- **Frequency ratios create the rhythm.** The four circles at 2400/2800/2200/2600ms create a polyrhythmic pattern that never exactly repeats. This is what makes it feel organic vs. a fixed loop. The ratios are close enough to synchronize periodically (all-merge moments) but different enough to constantly vary.
- **Scale breathing modulates the merge threshold.** When a blob scales up, it reaches its neighbor sooner, creating unexpected merges. When it scales down, it separates cleanly. This adds a second dimension of variation without more complex motion paths.
- **Dark background is structural.** The filter relies on alpha blending. On a light background, the blur halos would be visible. The dark background hides the filter artifacts and makes the neon colors pop.

## What We Can Steal

- **`bk-metaball-gooey`** — The SVG filter technique itself. A 6-line filter definition that turns any group of overlapping circles into liquid-merging blobs. Zero JS required for the effect — only for motion. Applicable to: loading states, brand hero backgrounds, ambient decorations, connection visualizations.
- **Polyrhythmic frequency drift** — Using slightly different animation durations on similar elements to create organic, never-exactly-repeating patterns. Applicable beyond metaballs: any grid of elements that should feel alive (dots, cards, icons).
- **Filter as animation** — The concept that the animation isn't in the shapes themselves but in a post-processing filter applied to a group. This inverts our normal model (animate individual elements) and opens up a category of effects where simple motion + filter = complex visual.
- **Neon-on-dark color system** — Saturated, bright colors on deep navy. Each color is at maximum chroma. The filter's blur step creates natural gradients between them — no explicit gradient definition needed.

## What to Avoid

- **Don't use on light backgrounds.** The blur halo becomes visible as a grey smudge around shapes. This technique needs dark backgrounds (or a more complex filter chain with `feFlood` background).
- **Don't add too many blobs.** 3-5 is the sweet spot. More than 6-7 and the merged shape becomes an undifferentiated mass — the individual blob identity is lost, which removes the "merge and separate" drama.
- **Don't use for content-bearing elements.** The filter distorts edges and creates blur artifacts. Fine for abstract shapes, not for text, icons, or anything that needs crisp boundaries.
- **Don't make oscillation too fast.** If blobs move quickly, the merge/separate cycle happens too fast to read. The gooey bridge should stretch visibly before snapping. Keep cycle times above 2000ms.
