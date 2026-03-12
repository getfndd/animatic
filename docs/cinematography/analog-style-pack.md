# Analog / VHS Style Pack

## Overview

The `analog` style pack applies VHS-inspired retro aesthetics to video sequences. It targets the "analog nostalgia" trend — warm golden tones, film grain, scan lines, and soft focus that evoke vintage camcorder footage.

**Personality:** `editorial` (content-forward, no 3D or blur entrances)

## Visual Treatment

The analog look is achieved through CSS post-processing layers rendered on top of scene content:

| Effect | Implementation | Purpose |
|--------|---------------|---------|
| Color grading | `filter: contrast(1.1) saturate(0.85) sepia(0.15)` | Warm, slightly desaturated tones |
| Film grain | SVG `feTurbulence` noise overlay | Organic texture, changes per-frame |
| Scan lines | Repeating linear gradient (2px intervals) | CRT/VHS horizontal line pattern |
| Softness | `backdrop-filter: blur(0.3px)` | Low-resolution analog feel |
| Vignette | Radial gradient, darkened edges | Analog camera lens falloff |
| Flicker | Sinusoidal brightness variation | VHS tape instability |

## Activation

Two ways to enable the analog overlay:

### 1. Via style pack (sequence-wide)

Use `"style": "analog"` in your sequence manifest. The style pack sets timing, transitions, and camera — the `visual_treatment: "analog"` field signals the renderer to apply the overlay.

### 2. Per-scene opt-in

Set `scene.metadata.visual_treatment = "analog"` on individual scenes:

```json
{
  "scene_id": "sc_hero",
  "metadata": { "visual_treatment": "analog" },
  "layers": [...]
}
```

## Timing & Transitions

| Property | Value | Rationale |
|----------|-------|-----------|
| Hold (static) | 4.0s | Longer holds let the texture breathe |
| Hold (high energy) | 2.5s | Still slower than energy/kinetic |
| Transitions | Crossfade (400-600ms) | Soft dissolves match the analog aesthetic |
| Camera | Gentle push_in/drift | Subtle movement, nothing jarring |

## Component

`src/remotion/compositions/AnalogOverlay.jsx` — Renders as `<AnalogOverlay />` inside `SceneComposition` when `visual_treatment === 'analog'`.

## Design Decisions

1. **CSS-only effects** — No WebGL or canvas. VHS aesthetics are achievable with CSS filters, SVG noise, and blend modes, keeping the pipeline simple.
2. **Overlay architecture** — Effects render on top of scene content rather than modifying layers. This means any scene can opt into the treatment without restructuring.
3. **Animated grain** — The `feTurbulence` seed changes every 3 frames for organic variation without per-frame jitter.
4. **Editorial personality** — Analog maps to editorial because it's content-forward (the footage matters, the effect enhances it) rather than cinematic-dark (which would add 3D and blur).
