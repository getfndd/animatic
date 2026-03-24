---
ref: card-conveyor-depth-rail
title: "Card Conveyor — Z-Space Depth Rail with Selection Hold"
source: "Internal prototype (test-cascade.html), adapted from editorial feed animation reference"
type: prototype
date: 2026-03-24
personality_affinity: editorial
tags: [conveyor, z-rail, perspective, depth, card-stack, selection, physics, rAF, compound, js-animation, feed, editorial]
quality_tier: exemplary
---

# Card Conveyor — Z-Space Depth Rail with Selection Hold

## Summary

A JavaScript-driven card conveyor where content cards travel forward through Z-space on a perspective rail, cycling through like a depth-based carousel. Cards spawn at the back, accelerate as they approach the viewer, exit past the camera with a rotateX tilt and opacity fade, then recycle to the back with new content. The animation culminates in a "hold" phase where the conveyor stops, the front card gets a pick-pop micro-interaction, and background cards softly recede. This is the first compound JS animation in the Animatic system — CSS keyframes cannot achieve the variable-speed depth physics, DOM recycling, or phase state machine required.

Worth studying for: perspective-driven scaling without explicit scale(), non-linear speed ramps by depth position, card DOM recycling, phase state machine (intro/loop/outro/hold), pick-pop micro-interaction with easeOutBack overshoot, ranked context recession.

## Scene Map

| Phase | Duration | Content | Behavior |
|-------|----------|---------|----------|
| intro | ~1.4s | Cards spawn at back, fill rail | 1 card at start, new cards every 170ms until 8 cards on rail |
| loop | 520ms | Steady-state conveyor | Cards cycle: exit front, recycle to back with new content |
| outro | ~1.5s | Drain remaining cards | Cards exit permanently, no recycling. Rail empties to 3 cards |
| hold | 280ms | Selection + recession | Front card picked, pop animation. Others recede by rank |

## Signature Moments

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / start | z-rail-spawn | 170ms interval | linear spawn | Cards created at Z:-1500 one at a time, immediately begin moving forward through perspective rail |
| continuous | z-speed-ramp | per-frame | custom curve | Cards accelerate from 0.92x at back to 2.32x at front. Non-linear power curves per Z-zone |
| continuous | perspective-scale | per-frame | native | perspective:1900px at origin 50% 24% — cards grow naturally as translateZ approaches 0. No explicit scale() |
| Z > 0 | exit-tilt-fade | ~200ms | power(1.15) | Cards past frontZ get rotateX tilt (0 to -18deg) and opacity fade (1 to 0). Fast exit |
| loop phase | card-recycle | instant | — | Exiting card DOM element repositioned to Z:-1500 with new story content. No DOM creation/destruction |
| outro to hold | pick-pop | 280ms | 3-phase | Front card: squeeze to 0.968 (easeOutCubic), overshoot to 1.072 (easeOutBack), settle to 1.0 (easeInOutCubic) |
| hold | context-recede | 280ms | linear | Non-selected cards: ranked recession. Rank 1: Z-90, scale 0.97, opacity x0.62. Rank 2: Z-220, scale 0.94, opacity x0.50 |

## Technique Breakdown

### Z-Space Physics Model

```javascript
// Cards live on a Z-rail from -1500 (back) to +260 (exit)
const PHYSICS = {
  farZ: -1500,    // spawn point
  frontZ: 0,      // front of the conveyor
  exitZ: 260,     // past-camera exit point
  gap: 225,       // Z-distance between cards
  speed: 470,     // base speed (Z-units per second)
  backY: -128,    // Y offset for back cards (higher = further back visually)
  frontY: 14      // Y offset for front cards
};

// Y position derived from Z — creates the stacked-above look
function worldYForZ(z) {
  const t = clamp((z - farZ) / (frontZ - farZ), 0, 1);
  return backY + (frontY - backY) * Math.pow(t, 1.08);
}

// Non-linear speed: cards accelerate as they approach viewer
// Back: 0.92x, Mid: 1.18-1.62x, Front: 2.32x, Exit: 2.66x
```

### Pick-Pop Micro-interaction

```javascript
// 3-phase scale animation over 280ms
function pickPopScale(progress) {
  if (progress <= 0.16)       // Phase 1: squeeze
    return mix(1, 0.968, easeOutCubic(progress / 0.16));
  if (progress <= 0.58)       // Phase 2: overshoot
    return mix(0.968, 1.072, easeOutBack((progress - 0.16) / 0.42));
  return mix(1.072, 1, easeInOutCubic((progress - 0.58) / 0.42));  // Phase 3: settle
}
```

### Stage Setup

```css
.stage {
  perspective: 1900px;
  perspective-origin: 50% 24%;  /* shallow overhead angle */
}

.rail {
  transform-style: preserve-3d;
}

.card {
  transform-origin: center 0%;  /* top-anchored */
  will-change: transform, opacity;
}
```

## Choreography Notes

- **Speed hierarchy is the star.** The non-linear speed ramp (slow at back, fast at front) is what makes this feel cinematic vs a flat conveyor belt.
- **Perspective does the scaling.** No scale() during the conveyor phase — the 1900px perspective naturally makes cards grow as they approach Z:0.
- **The overhead origin matters.** perspective-origin: 50% 24% creates a shallow downward viewing angle. Cards at the back appear above the front cards.
- **Phase transitions are smoothed.** The smoothedPhaseMultiplier lerps between phase speeds so the conveyor does not snap between speeds.
- **Card recycling preserves DOM health.** Instead of creating/destroying DOM nodes, exiting cards get repositioned to the back with new content.

## Primitives Extracted

| Primitive ID | Name | Type | Description |
|-------------|------|------|-------------|
| `bd-z-rail` | Z-Space Depth Rail | Compound/JS | Cards on translateZ rail with perspective-driven scaling. Requires rAF loop. |
| `bd-speed-ramp` | Depth Speed Ramp | Compound/JS | Non-linear acceleration by Z position. 4-zone power curves. |
| `bd-exit-tilt` | Exit Tilt Fade | CSS-possible | rotateX 0 to -18deg + opacity fade as card passes Z:0. |
| `bd-pick-pop` | Pick Pop | CSS-possible | 3-phase squeeze/overshoot/settle. 280ms. Could be CSS keyframes. |
| `bd-context-recede` | Context Recession | CSS-possible | Ranked recession of non-selected items. Z-push + scale + opacity by rank. |
| `bd-card-recycle` | Card DOM Recycle | JS-only | Reposition exited card to back of rail with new content. Zero DOM churn. |
| `bd-phase-machine` | Phase State Machine | JS-only | intro/loop/outro/hold with smoothed speed transitions. |

## Capability Gaps Identified

### 1. JS Compound Animation Support
**Gap:** The Animatic primitive system is CSS-only. This conveyor requires a requestAnimationFrame loop, per-frame physics calculations, DOM recycling, and a phase state machine. None of this can be expressed as CSS keyframes.
**What we need:** A new primitive tier — compound JS recipes — that ships as self-contained scripts with a configuration API (physics params, content array, phase timing). These would be embeddable in Remotion scenes via a custom component wrapper. GSAP or Motion (motion.dev) are strong candidates to replace hand-rolled rAF loops.
**Complexity:** Medium-high. The recipe pattern is established by this prototype. Generalizing it into a configurable component is the work.
**Value:** Very high. This is the first animation where CSS primitives demonstrably failed and JS physics were required.

## What We Can Steal

- **`bd-pick-pop`** — The 3-phase squeeze/overshoot/settle is pure CSS-achievable and valuable for any selection interaction. Extract as a standalone keyframe.
- **`bd-exit-tilt`** — The rotateX tilt on exit is a great departure animation. Could work as a CSS primitive.
- **Speed ramp concept** — Even if we cannot do per-frame Z-physics in CSS, the principle (faster at front, slower at back) could inform stagger intervals.
- **Perspective origin as editorial tool** — 50% 24% is a specific creative choice worth documenting. Lowering the perspective origin creates a "looking down at a pile" feel.

## What to Avoid

- **Applying this to everything.** This is a heavy animation — 8+ DOM elements animated at 60fps via JS. Reserve for hero moments.
- **Literal translateZ in CSS as a substitute.** The CSS translateZ approach reads as "flying at camera" without the speed ramp and perspective tuning. Use the full JS recipe or use a different primitive entirely.
