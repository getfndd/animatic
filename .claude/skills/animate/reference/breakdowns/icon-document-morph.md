---
ref: icon-document-morph
title: "Icon-to-Document Morph — Terminal Identity Loop"
source: "inspiration/6310b8b8f16fea7893e24093a08ddb6b.mp4"
type: video
date: 2026-02-26
personality_affinity: cinematic-dark
tags: [morph, icon, document, scatter, reconverge, stagger, loading, transition, identity, loop]
quality_tier: strong
---

# Icon-to-Document Morph — Terminal Identity Loop

## Summary

A 6.7-second looping animation where a terminal prompt icon (`>_`) morphs into an abstract document/code editor layout, holds while content animates, then scatters apart and reconverges back into the original icon. The piece demonstrates three distinct motion patterns: geometric shape morphing (icon → layout → icon), staggered content line reveal with opacity cascade, and scatter/reconverge transitions. The icon-to-layout morph is the standout technique — it solves the "loading → content" transition that every app needs but few animate well.

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 | icon-hold | ~300ms | — | Terminal `>_` icon static in gray (#888) on black, centered |
| ~0:30 | icon-to-layout-morph | ~400ms | expo-out | Icon chevron fades as white rectangle expands from icon center; rectangle splits into sidebar bar + content rows |
| ~0:70 | content-line-stagger | ~600ms | ease-out, 100ms interval | 6 horizontal bars (text line placeholders) reveal top-to-bottom with opacity cascade — first lines full white, later lines enter at gray (#888) then brighten |
| ~1:30 | row-highlight-cycle | ~1200ms | ease-in-out | One row dims to gray while others stay white — highlight "selection" sweeps through rows, simulating active-line cycling |
| ~2:30 | content-rearrange | ~500ms | ease-out | Row widths animate to new values — content "updates" with varied line lengths, row 4 splits into two shorter segments (inline elements) |
| ~3:30 | document-scatter | ~600ms | expo-out | All elements (sidebar, rows, corner brackets) explode outward from center — each fragment takes a different trajectory with slight rotation |
| ~4:00 | fragment-reconverge | ~800ms | expo-in-out | Scattered fragments converge toward center, coalescing into interlocking L-bracket shapes — two corner pieces (`⌐` + `⌐` mirrored) |
| ~5:00 | bracket-to-icon-morph | ~800ms | ease-in-out | Bracket shapes compress and morph back into `>_` terminal prompt — geometric simplification from complex to simple |
| ~6:00 | icon-settle | ~300ms | ease-out | Icon returns to starting gray opacity; seamless loop point |

## Technique Breakdown

```css
/* bk-icon-to-layout — Icon expanding into content layout */
.icon-container {
  position: relative;
  width: 200px;
  height: 160px;
}

/* Phase 1: Icon fades, rectangle expands */
@keyframes icon-fade {
  0% { opacity: 1; }
  40% { opacity: 0; }
  100% { opacity: 0; }
}
@keyframes rect-expand {
  0% { transform: scale(0.2); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.icon-glyph {
  animation: icon-fade 400ms ease-out forwards;
}
.layout-rect {
  animation: rect-expand 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Phase 2: Rectangle splits into sidebar + content lines */
.sidebar-bar {
  width: 3px;
  height: 100%;
  background: #444;
  opacity: 0;
  animation: fade-in 200ms ease-out 300ms forwards;
}

.content-line {
  height: 3px;
  background: white;
  opacity: 0;
  transform: scaleX(0.3);
  transform-origin: left;
  animation: line-reveal 300ms ease-out forwards;
  animation-delay: calc(var(--line-index) * 100ms + 400ms);
}

@keyframes line-reveal {
  0% { opacity: 0; transform: scaleX(0.3); }
  60% { opacity: 0.6; }
  100% { opacity: 1; transform: scaleX(1); }
}
```

```css
/* bk-content-line-stagger — Staggered line reveal with brightness cascade */
.content-line {
  --line-width: 80%;
  width: var(--line-width);
  height: 3px;
  background: white;
  opacity: 0;
  animation: line-enter 300ms ease-out forwards;
  animation-delay: calc(var(--line-index) * 100ms);
}

@keyframes line-enter {
  0% { opacity: 0; transform: translateX(-8px); }
  100% { opacity: var(--line-brightness, 1); transform: translateX(0); }
}

/* Brightness cascade: first lines bright, later lines dimmer initially */
.content-line:nth-child(1) { --line-brightness: 1.0; --line-width: 70%; }
.content-line:nth-child(2) { --line-brightness: 1.0; --line-width: 85%; }
.content-line:nth-child(3) { --line-brightness: 0.9; --line-width: 65%; }
.content-line:nth-child(4) { --line-brightness: 0.7; --line-width: 90%; }
.content-line:nth-child(5) { --line-brightness: 0.8; --line-width: 75%; }
.content-line:nth-child(6) { --line-brightness: 0.5; --line-width: 55%; }
```

```js
/* Scatter/reconverge — fragment trajectories */
const fragments = document.querySelectorAll('.fragment');
const center = { x: containerWidth / 2, y: containerHeight / 2 };

function scatter() {
  fragments.forEach((frag, i) => {
    const angle = (i / fragments.length) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 150 + Math.random() * 100;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const rotate = (Math.random() - 0.5) * 30;
    frag.style.transition = 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease-out';
    frag.style.transform = `translate(${tx}px, ${ty}px) rotate(${rotate}deg)`;
    frag.style.opacity = '0.8';
  });
}

function reconverge() {
  fragments.forEach((frag, i) => {
    frag.style.transition = 'transform 800ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 600ms ease-in';
    frag.style.transform = 'translate(0, 0) rotate(0deg)';
    frag.style.opacity = '1';
  });
}
```

## Choreography Notes

- **Three-act structure.** Act 1: Build (icon → document, 0-1.5s). Act 2: Live (content animates, 1.5-3.3s). Act 3: Deconstruct (scatter → reconverge → icon, 3.3-6.7s). Build is fastest, Live is longest (content needs dwell time), Deconstruct takes longest (scatter + morph).
- **Brightness as depth cue.** During the line stagger, earlier lines enter at full white while later lines enter dimmer. This creates a sense of the document "loading" top-to-bottom — a brightness cascade that reads as progressive rendering.
- **Scatter is radial, not random.** Each fragment takes a trajectory based on its angular position relative to center (with jitter). This creates a clean explosion rather than chaotic noise. Fragments furthest from center travel furthest.
- **Reconvergence is slower than scatter.** 800ms vs 600ms. Scatter uses expo-out (fast departure, slow arrival at distant position). Reconverge uses ease-in-out (gentle start, smooth landing). This asymmetry makes scatter feel energetic and reconverge feel controlled.
- **Loop seam at the icon.** The `>_` icon serves as the resting state — same shape at start and end. The gray opacity (vs full white during the document phase) provides a visual "exhale" that marks the loop boundary.

## What We Can Steal

- **`bk-icon-to-layout`** — The icon → expanded content layout morph. This pattern solves loading transitions: show a compact icon/logo, then expand it into the actual content area. Useful for app splash → main view, or skeleton loading where the loading indicator transforms into the loaded content rather than being replaced. The key insight is that the icon and the layout share a geometric center — the expansion feels like unfolding, not replacement.
- **`bk-content-line-stagger`** — Staggered horizontal line reveal with per-line brightness variation. An evolution of standard slide-stagger that adds a "progressive rendering" feel. Each line enters slightly dimmer than the previous, then all brighten to full — like a document loading in real-time. Adaptable to any list/card reveal. The brightness cascade is the differentiator vs basic stagger.

## What to Avoid

- **Don't use scatter for functional UI transitions.** The scatter/explode effect is dramatic and disorienting — appropriate for identity animations and loading loops, but wrong for navigating between real views. Users need to track content, not watch it fly apart.
- **Don't morph between unrelated shapes.** The icon → document works because they share a visual language (rectangles, horizontal lines, the sidebar maps to the cursor line). Morphing between geometrically unrelated forms would feel arbitrary.
- **Don't loop in production UI.** This is a showcase/identity animation. In a real loading context, play the build phase once, hold at the document state, then transition to real content — never scatter/loop.
