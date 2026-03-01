# Kinetic Type Primitives

**Status:** Implemented
**Issue:** ANI-20

## Overview

Kinetic type adds frame-synced text animation to the Remotion pipeline. Unlike HTML layers (rendered in iframes, disconnected from the frame clock), text layers use native React rendering driven by `useCurrentFrame()`, enabling precise per-frame animation control.

## Layer Schema

```json
{
  "id": "title",
  "type": "text",
  "content": "THE FUTURE IS HERE",
  "animation": "word-reveal",
  "depth_class": "foreground",
  "style": {
    "fontFamily": "system-ui",
    "fontSize": 72,
    "fontWeight": 700,
    "color": "#ffffff",
    "textTransform": "uppercase",
    "textAlign": "center"
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"text"` | Yes | Layer type identifier |
| `content` | string | Yes | Text content to animate |
| `animation` | string | No | Animation primitive: `word-reveal`, `scale-cascade`, `weight-morph`. Omit for static text. |
| `style` | object | No | Typography styles (fontFamily, fontSize, fontWeight, color, textTransform, textAlign, letterSpacing, lineHeight) |
| `style.fontWeightStart` | number | No | Start weight for weight-morph (default: 300) |
| `style.fontWeightEnd` | number | No | End weight for weight-morph (default: 900) |

## Primitives

### word-reveal

Words appear sequentially with opacity fade and upward translate. Each word occupies a staggered window within 0..1 progress — windows overlap by `WORD_REVEAL_STAGGER` (0.15) to create a cascade effect.

**Math:**
- Window duration per word: `1 / (totalWords - stagger * (totalWords - 1))`
- Word start: `wordIndex * windowDuration * (1 - stagger)`
- Local progress mapped to opacity (0→1) and translateY (20px→0px)

### scale-cascade

Same text rendered at 3 scales, scrolling vertically at different speeds. Creates a typographic depth effect inspired by the Alicia Keys concert visual reference.

**Math:**
- 3 layers at scales `[3.0, 2.0, 1.0]` (large to small)
- Scroll speeds `[0.6, 1.0, 1.5]` (slow to fast — parallax effect)
- Each layer starts below viewport and scrolls upward
- Largest text is slowest (background), smallest is fastest (foreground)

### weight-morph

Font weight animates from light to bold with a per-character stagger wave. Creates a ripple effect across the text.

**Math:**
- Linear interpolation: `startWeight + progress * (endWeight - startWeight)`
- Per-character stagger offset: `charIndex * 0.04` subtracted from progress
- Result clamped 0..1 and rounded to integer font-weight

## Composition: type-over-media

Text layers stack naturally with video/image layers via the existing layer system. No special composition code is needed — the scene's layer order determines z-stacking, and `depth_class` enables parallax via the camera rig.

```json
{
  "layers": [
    { "id": "bg", "type": "video", "depth_class": "background", ... },
    { "id": "title", "type": "text", "animation": "word-reveal", "depth_class": "foreground", ... }
  ]
}
```

## Architecture

```
lib.js (pure math)          TextLayer.jsx (React)
─────────────────           ──────────────────────
getWordRevealState()    →   WordRevealRenderer
getScaleCascadePosition()→  ScaleCascadeRenderer
getWeightMorphValue()   →   WeightMorphRenderer
TEXT_ANIMATION_DEFAULTS     (shared constants)
```

All animation math lives in `lib.js` as pure functions — testable without React/Remotion. The `TextLayer` component reads frame data via Remotion hooks and delegates to sub-renderers. This follows the same pattern established by `CameraRig` (ANI-19).

## Files

| File | Role |
|------|------|
| `src/remotion/lib.js` | Pure math functions + constants + validation |
| `src/remotion/compositions/TextLayer.jsx` | React component with 3 sub-renderers |
| `src/remotion/compositions/SceneComposition.jsx` | Integration (import + switch case) |
| `src/remotion/manifests/test-kinetic-type.json` | 4-scene test manifest |
| `src/remotion/test/remotion.test.js` | ~30 tests for math functions + validation |
