# Shot Grammar

**Status:** Implemented
**Issue:** ANI-26

## Overview

Shot grammar classifies each scene along three cinematic axes — shot size, angle, and framing — that map to CSS-achievable camera behaviors. The classification feeds into scene analysis and sequence planning to enforce shot variety and personality-appropriate camera work.

## Three Axes

| Axis | Values | CSS Mapping |
|------|--------|-------------|
| **Shot Size** | `wide`, `medium`, `close_up`, `extreme_close_up` | `scale` (1.0 → 1.4) |
| **Angle** | `eye_level`, `high`, `low`, `dutch` | `perspective-origin` + `rotateX`/`rotateZ` |
| **Framing** | `center`, `rule_of_thirds_left`, `rule_of_thirds_right`, `dynamic_offset` | `transform-origin` |

No 3D engine needed. Shot size = zoom level, angle = perspective shift, framing = where the camera zooms toward.

## Classification Rules

### Shot Size

Priority order:

1. **Layout template** — `masonry-grid`/`split-panel` → wide, `device-mockup` → medium, `hero-center` with single text → close_up
2. **Content type affinity** — maps via `content_type_affinity` in `catalog/shot-grammar.json`
3. **Foreground layer count** — 4+ → wide, 1 → close_up, else medium

### Angle

Priority order:

1. **Intent tags** — `hero`/`opening` → low (heroic), `informational`/`detail` → high (overview)
2. **Content type** — `portrait` → eye_level, `data_visualization` → high
3. **Default** → eye_level

### Framing

Priority order:

1. **Layout template** — `split-panel` → rule_of_thirds_left, `device-mockup` → based on `deviceSide`
2. **Intent** — `hero`/`opening` → center
3. **Default** → center

## Personality Restrictions

Each personality constrains which shot grammar values are allowed.

| Personality | Sizes | Angles | Framings | 3D Rotation | Max Scale |
|-------------|-------|--------|----------|-------------|-----------|
| cinematic-dark | All 4 | All 4 | All 4 | Yes | — |
| editorial | wide, medium, close_up | eye_level, high | center, rule_of_thirds_left, rule_of_thirds_right | No | 1.2 |
| neutral-light | wide, medium | eye_level | center | No | 1.08 |
| montage | All 4 | eye_level | center | No | — |

When a classifier produces a value not allowed by the personality, the validator corrects to safe fallbacks: size → medium, angle → eye_level, framing → center.

## Variety Rules

The sequence planner enforces:
- **No 3+ consecutive scenes with the same shot size** — swaps to break runs (mirrors the existing visual weight variety rule)

## Integration Points

### Scene Analysis (`mcp/lib/analyze.js`)

`analyzeScene()` returns `shot_grammar` in its metadata output:

```json
{
  "metadata": {
    "content_type": "typography",
    "visual_weight": "dark",
    "motion_energy": "moderate",
    "intent_tags": ["opening"],
    "shot_grammar": {
      "shot_size": "close_up",
      "angle": "low",
      "framing": "center"
    }
  }
}
```

### Sequence Planner (`mcp/lib/planner.js`)

- Shot size variety rule prevents monotonous sequences
- Validated `shot_grammar` added to each manifest scene entry
- Validation runs against the style pack's personality

### Manifest Validation (`src/remotion/lib.js`)

`validateManifest()` validates the optional `shot_grammar` field, checking axis values against allowed enums.

## Catalog

Source: `catalog/shot-grammar.json`

Contains shot sizes with CSS values and content type affinities, angles with perspective/rotation CSS, framings with transform-origin CSS, personality restrictions, and variety rules.

## Files

| File | Role |
|------|------|
| `catalog/shot-grammar.json` | Catalog data |
| `mcp/lib/shot-grammar.js` | Classifiers, validator, CSS resolver |
| `mcp/data/loader.js` | `loadShotGrammar()` function |
| `mcp/lib/analyze.js` | Integration — adds `shot_grammar` to analysis |
| `mcp/lib/planner.js` | Integration — variety rule + manifest field |
| `src/remotion/lib.js` | Manifest validation |
| `mcp/test/shot-grammar.test.js` | 39 unit tests |

## Not In Scope (Deferred)

- **CameraRig.jsx rendering** — Compound transforms from shot grammar CSS values (ANI-27 territory)
- **MCP tool additions** — No new tools; shot grammar is consumed by existing `analyze_scene` and planner tools
