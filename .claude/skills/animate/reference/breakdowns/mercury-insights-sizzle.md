---
ref: mercury-insights-sizzle
title: "Mercury Insights — AI Finance Dashboard Sizzle Reel"
source: "Mercury fintech product marketing video (MP4, 38s)"
type: video
date: 2026-03-18
personality_affinity: cinematic-dark
tags: [sizzle, particle, dissolve, dashboard, ai, chat, typewriter, chart, bar-chart, timeline, date-picker, card-cascade, input-field, drilldown, panel-slide, product-demo, fintech, brand, tagline, logo-lockup]
quality_tier: exemplary
---

# Mercury Insights — AI Finance Dashboard Sizzle Reel

## Summary

A 38-second product sizzle reel for Mercury's "Insights" feature — an AI-powered financial analysis tool. The video opens and closes with a **pointillist particle effect** (a still life painting dissolving into/from particles), bookending cinematic product demos of the dashboard. The core narrative is: tagline → interaction demo → tagline → brand lockup. What makes this exemplary is the **particle dissolve transition** — the entire dashboard UI disintegrates into scattered color particles and reconverges into the painting — and the seamless choreography of UI interactions that feel like watching a real user, not a slideshow.

Worth studying for: particle dissolve as scene transition, timeline scrubber interaction, staggered insight cards with live data, chat input typing, chart bar-grow animation, panel slide-in drilldown, and the bookend structure of art → product → art → brand.

## Scene Map

| # | Time | Content | Camera | Duration |
|---|------|---------|--------|----------|
| 1 | 0:00–0:03 | Particle still life (establishing shot) | static | 3s |
| 2 | 0:03–0:06 | "Clarity takes craft." tagline | static, center | 3s |
| 3 | 0:06–0:09 | Timeline date picker interaction | close_up, center | 3s |
| 4 | 0:09–0:15 | Insight cards cascade (revenue, credit, software) | push_in, slow | 6s |
| 5 | 0:15–0:18 | AI prompt input: "Tell me more about: Increased software spend." | static, center | 3s |
| 6 | 0:18–0:22 | Chart drilldown panel (Top software vendors bar chart) | push_in | 4s |
| 7 | 0:22–0:24 | Follow-up prompt: "Show me my largest transactions in March" | static | 2s |
| 8 | 0:24–0:28 | Full dashboard reveal (sidebar + insights + cashflow chart) | pull_out | 4s |
| 9 | 0:28–0:31 | Particle dissolve transition (dashboard → particles) | static | 3s |
| 10 | 0:31–0:33 | Particle still life (reprise) | static | 2s |
| 11 | 0:33–0:35 | "Introducing Insights." tagline | static | 2s |
| 12 | 0:35–0:37 | "Radically different banking." tagline | static | 2s |
| 13 | 0:37–0:38 | Mercury logo lockup + legal disclaimer | static | 1s |

## Signature Moments

### Scene 1 — Particle Still Life (0:00–0:03)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| particle-field-hold | 3000ms | static | A classical still life painting (flowers, fruits, vases) rendered as a dense particle field. Each "pixel" is a small dot with slight jitter — the image shimmers but holds form. Dark background (#1a1a2e). The particles are color-accurate to the source painting — reds, greens, golds, whites. |

### Scene 3 — Timeline Date Picker (0:06–0:09)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| timeline-slide-in | 400ms | expo-out | Horizontal month timeline slides in from right. Months (Nov–Sep) evenly spaced. Dark surface with subtle grid lines. |
| range-select-drag | 1200ms | ease-in-out | Blue highlight rectangle animates from Jan to Jun 30 — simulating a click-drag selection. "Jan 01 - Jun 30" label appears in the selection bar. |
| cursor-resize | continuous | — | Resize cursor (⟺) appears at the right edge of the selection, implying draggable handles. |
| date-label-fade | 300ms | ease-out | "Jun 30" tooltip fades in below the selection endpoint. |

### Scene 4 — Insight Cards Cascade (0:09–0:15)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| card-stagger-entrance | 180ms interval, ~900ms total | expo-out per card | Three dark cards stagger top-to-bottom. Each card: opacity 0→1 + translateY(16px→0). Cards have trend icons (↗ green, ↘ neutral, ↗ neutral). |
| content-reveal-per-card | 400ms per card | ease-out | Title appears first (bold), then description text fades in 120ms later. Description includes specific dollar values and percentages. |
| fourth-card-peek | 200ms | ease-out | A fourth card ("12% revenue growth") peeks from below — partially visible, implying more content. Vertical scroll affordance. |

### Scene 5 — AI Prompt Input (0:15–0:18)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| input-field-entrance | 400ms | expo-out | Rounded input field (pill shape) fades in center-screen on dark background. Dark fill, subtle border. Upload icon + submit button (purple circle with ↵). |
| typewriter-input | 2000ms | linear (~40ms/char) | "Tell me more about: Increased software spend." types into the field character by character. White text on dark field. Natural cadence. |

### Scene 6 — Chart Drilldown Panel (0:18–0:22)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| panel-slide-in | 500ms | expo-out | Dark elevated panel slides in from right (or scales up from center). Header: "Increased software spend" with +, emoji, × controls. |
| summary-text-fade | 300ms | ease-out | Explanatory sentence fades in below header. |
| chart-container-fade | 200ms | ease-out | Chart frame ("Top software vendors" title + "Money Out" legend) appears. |
| bar-grow-stagger | 120ms interval, ~600ms total | expo-out per bar | Four bars grow upward from baseline: Anthropic (tallest), Cloudflare, Zoom, Notion (shortest). Each bar: scaleY(0→1) from bottom with transform-origin bottom. Gray bars on dark background. Y-axis label "~$1K". |
| input-field-below | 300ms | ease-out | "Ask anything..." input field appears below the chart. Purple submit button. |

### Scene 7–8 — Follow-up + Full Dashboard (0:22–0:28)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| second-typewriter | 1800ms | linear | "Show me my largest transactions overall in March" types into the input field. |
| pull-out-reveal | 1200ms | cinematic_scurve | Camera pulls out to reveal the full Mercury dashboard: left sidebar (Home, Tasks (10), Transactions, Insights, Payments > Cards), main content area with Insights page (Overview/Money In/Money Out tabs), timeline at top, cashflow bar chart at right. |
| sidebar-fade | 400ms | ease-out | Sidebar navigation becomes visible as camera pulls out. "Mercury" logo top-left. Active state on "Insights". |
| cashflow-bars | 600ms | ease-out | Monthly cashflow waterfall chart renders: blue bars (money in) above zero line, gray bars (money out) below. Jan through Jun visible. |

### Scene 9 — Particle Dissolve (0:28–0:31)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| ui-to-particles | 2000ms | expo-in then expo-out | **The showstopper.** Every pixel of the dashboard UI explodes into individual colored particles. The particles scatter outward with slight randomness, then drift and reconverge into the still life painting from Scene 1. During transition: particles carry the color of their source pixel — blue from charts, white from text, dark from backgrounds — creating a brief moment of chromatic chaos before the painting resolves. |

### Scenes 11–13 — Taglines + Logo (0:33–0:38)

| Effect | Duration | Easing | Description |
|--------|----------|--------|-------------|
| tagline-crossfade | 400ms per transition | ease-out | "Introducing Insights. / An intelligent view of your finances." → crossfade → "Radically different banking." → crossfade → Mercury logo lockup. Each text: opacity 0→1, centered, large sans-serif. Warm off-white (#e8e0d4) on dark (#1a1a2e). |
| logo-lockup | 600ms | ease-out | Mercury celtic-knot icon + "MERCURY" wordmark fade in side-by-side. Legal disclaimer text appears at bottom in small type, 300ms after logo settles. |

## Technique Breakdown

### Particle Dissolve Transition

```css
/* Concept — requires canvas/WebGL, not pure CSS */
/* Each pixel becomes an independent particle with:
   - source position (pixel location in the UI)
   - target position (pixel location in the painting)
   - color: sampled from source at t=0, blended to target at t=1
   - velocity: random scatter vector, dampened by spring physics
   - size: 1-3px dots with slight variance
*/

/* Timing envelope: */
/* 0.0–0.3: particles separate from UI (exponential scatter) */
/* 0.3–0.7: free-floating chaos (brownian drift) */
/* 0.7–1.0: particles converge on painting positions (spring settle) */

/* In Remotion, this would be a custom <Canvas> component that: */
/* 1. Captures the UI as an image (html2canvas or OffscreenCanvas) */
/* 2. Samples every Nth pixel for particle data */
/* 3. Renders particles in a WebGL shader */
/* 4. Interpolates position/color per frame */
```

### Bar Chart Grow Animation

```css
.bar {
  transform-origin: bottom center;
  transform: scaleY(0);
  animation: bar-grow 500ms expo-out forwards;
}

@keyframes bar-grow {
  from { transform: scaleY(0); opacity: 0.6; }
  to   { transform: scaleY(1); opacity: 1; }
}

/* Stagger: each bar delays 120ms from the previous */
.bar:nth-child(1) { animation-delay: 0ms; }
.bar:nth-child(2) { animation-delay: 120ms; }
.bar:nth-child(3) { animation-delay: 240ms; }
.bar:nth-child(4) { animation-delay: 360ms; }
```

### Panel Slide-In Drilldown

```css
.drilldown-panel {
  position: fixed;
  inset: 10% 8%;
  background: #1c1c2e;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  transform: translateY(20px) scale(0.97);
  opacity: 0;
  animation: panel-enter 500ms expo-out forwards;
}

@keyframes panel-enter {
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
```

### Staggered Insight Cards

```css
.insight-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 20px 24px;
  opacity: 0;
  transform: translateY(16px);
  animation: card-enter 400ms expo-out forwards;
}

.insight-card:nth-child(1) { animation-delay: 0ms; }
.insight-card:nth-child(2) { animation-delay: 180ms; }
.insight-card:nth-child(3) { animation-delay: 360ms; }
.insight-card:nth-child(4) { animation-delay: 540ms; }

@keyframes card-enter {
  to { opacity: 1; transform: translateY(0); }
}

/* Trend icon colors */
.trend-up   { color: #4ade80; } /* green-400 */
.trend-down { color: #94a3b8; } /* slate-400 */
```

## Primitives Extracted

| Primitive ID | Name | Duration | Category | Description |
|-------------|------|----------|----------|-------------|
| `bd-particle-dissolve` | Particle Dissolve | 2000ms | Transitions | Full-screen pixel-to-particle scatter/reconverge. Requires WebGL canvas. Source and target can be any rendered frame. |
| `bd-bar-grow` | Bar Chart Grow | 500ms + 120ms stagger | Data Viz | Bars grow from baseline with scaleY(0→1). Transform-origin bottom. Stagger per bar. |
| `bd-panel-drilldown` | Panel Drilldown Slide | 500ms | Overlays | Elevated panel enters with translateY(20px)+scale(0.97)→identity. Dark surface, rounded corners, deep shadow. |
| `bd-insight-card-cascade` | Insight Card Cascade | 400ms + 180ms stagger | Cards | Dark cards stagger vertically with translateY(16px→0). Content reveals within each card (title then description). |
| `bd-timeline-range-select` | Timeline Range Select | 1200ms | Interactions | Horizontal date scrubber with animated range selection. Blue highlight bar with drag handles. |
| `bd-tagline-crossfade` | Tagline Crossfade | 400ms per transition | Typography | Centered tagline text crossfades through multiple lines. Warm off-white on dark. |

## Capability Gaps Identified

These are techniques visible in this reference that Animatic cannot currently produce:

### 1. Particle Dissolve Transitions
**Gap:** No primitive for pixel-level decomposition/recomposition. Our transitions are element-level (crossfade, whip-wipe, hard-cut), not pixel-level.
**What we'd need:** A custom Remotion `<Canvas>` component that captures frames as images, decomposes to particles, and animates them with spring physics. This is a WebGL/shader operation — not CSS-achievable.
**Complexity:** High. Would need html2canvas integration + a particle system.
**Value:** Very high. This is a showstopper transition that elevates any sizzle reel from "slideshow" to "cinema".

### 2. Chart/Data Visualization Animation
**Gap:** No primitives for bar charts, line charts, or data viz. Our layers are html/image/video/text/svg — we don't have a "chart" layer type or chart animation primitives.
**What we'd need:** Either a chart-aware layer type that accepts data + renders animated SVG bars/lines, or a recipe that generates SVG layers with bar-grow animations baked in.
**Complexity:** Medium. SVG bar-grow is straightforward. Feeding data in is the design question.
**Value:** High. Every SaaS product demo needs charts.

### 3. Interactive UI Simulation (Drag, Click, Hover)
**Gap:** We have `cd-typewriter` for text input and semantic interactions (focus, type_text, select_item), but no cursor simulation, no drag interaction, no hover state changes.
**What we'd need:** A cursor layer that moves along a path with easing, triggering state changes on target elements at keyframes. The timeline scrubber drag is a coordinated animation: cursor position + selection width + label updates.
**Complexity:** Medium. Cursor path animation is simple. Coordinating UI state changes at cursor positions is the hard part.
**Value:** High. Makes demos feel like real usage, not slideshows.

### 4. Layout Transitions (Pull-Out Reveal)
**Gap:** We have camera pull_out, but not a coordinated reveal where the camera pulls back to show additional UI chrome (sidebar, header) that wasn't visible before. This requires generating the full dashboard at render time and using camera framing to control what's visible.
**What we'd need:** Full-scene rendering with camera crop. Start zoomed into one area, pull out to show the whole composition. We partially support this with camera intensity, but the sidebar/nav appearing requires the full UI to exist off-screen.
**Complexity:** Low-medium. Our overscan system already renders larger-than-viewport. We'd need to start at a tighter crop.
**Value:** Medium. Great for "big reveal" moments in product demos.

### 5. Bookend Art Direction (Thematic Transitions)
**Gap:** The particle still life as a thematic bookend — opening and closing with art that dissolves into/from the product UI — is a narrative structure we don't support. Our sequences are scene→transition→scene, not scene→dissolve-into-different-medium→scene.
**What we'd need:** Beyond particle dissolve (#1), a choreography concept of "thematic bookends" where opening/closing scenes share a visual motif that the product scenes don't.
**Complexity:** Low (concept) + High (particle dissolve implementation).
**Value:** Medium. Elevates brand sizzle reels significantly.

## Buildable Improvements

Ranked by value × feasibility:

### Immediate (CSS/existing primitives)

1. **Bar-grow primitive** (`bd-bar-grow`) — Add to the registry. Pure CSS scaleY animation with stagger. Works with SVG or HTML div bars.
2. **Insight card cascade** (`bd-insight-card-cascade`) — Very similar to existing `cd-focus-stagger` but with content sub-timing (title then body). Could be a recipe rather than a new primitive.
3. **Tagline crossfade sequence** (`bd-tagline-crossfade`) — Already possible with our crossfade transition + text layers. Document as a recipe.

### Short-term (new components/recipes)

4. **Panel drilldown** (`bd-panel-drilldown`) — New overlay entrance primitive. Would pair well with the existing `fan_stack` semantic interaction.
5. **Cursor path animation** — A new layer type or overlay that renders a pointer cursor moving along a bezier path. Trigger events at path points.
6. **Timeline/scrubber interaction recipe** — Compound animation: horizontal bar + expanding selection + label reveals. Could be a semantic interaction recipe.

### Medium-term (new Remotion components)

7. **Chart layer type** — `type: 'chart'` with `data`, `chart_type` (bar, line, pie), and animation options. Renders as animated SVG inside the layer.
8. **Camera crop reveal** — Start scene at tighter-than-viewport crop, animate to full viewport. Extends existing overscan system.

### Aspirational (R&D)

9. **Particle dissolve transition** — WebGL canvas component. Captures source/target frames, decomposes to particles, animates with spring physics. Would be the single highest-impact visual capability addition.
