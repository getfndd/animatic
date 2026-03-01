# Scene Analysis Engine

**Status:** Active
**Issue:** ANI-22
**Module:** `mcp/lib/analyze.js`
**MCP Tool:** `analyze_scene`

## Overview

The scene analysis engine classifies scene JSON into structured metadata — `content_type`, `visual_weight`, `motion_energy`, and `intent_tags` — using deterministic, rule-based heuristics. This metadata populates the `metadata` field in the [scene-format spec](specs/scene-format.md) and is consumed by the sequence planner (ANI-23) for editorial decisions about shot order, transitions, and timing.

## Architecture

```
Scene JSON → analyzeScene() → { metadata, _confidence }
                 │
                 ├── classifyContentType()   → { value, confidence }
                 ├── classifyVisualWeight()   → { value, confidence }
                 ├── classifyMotionEnergy()   → { value, confidence }
                 └── inferIntentTags()        → { value, confidence }
```

Pure functions with no MCP, React, or external dependencies. Located in `mcp/lib/analyze.js` alongside shared helpers in `mcp/lib.js`.

## Classification Heuristics

### content_type

Priority-ordered rules — first match wins. Layout template is the strongest signal.

| Priority | Signal | Result | Confidence |
|----------|--------|--------|------------|
| 1 | `layout.template === 'device-mockup'` | `device_mockup` | 0.95 |
| 2 | `layout.template === 'split-panel'` | `split_panel` | 0.95 |
| 3 | `layout.template === 'masonry-grid'` + 4+ cells | `collage` | 0.90 |
| 4 | `layout.template === 'masonry-grid'` + 2-3 cells | `moodboard` | 0.85 |
| 5 | `layout.template === 'full-bleed'` | `product_shot` | 0.85 |
| 6 | `layout.template === 'hero-center'` | `brand_mark` | 0.80 |
| 7 | All fg layers are text (bg is html/video or absent) | `typography` | 0.90 |
| 8 | Video bg + fg text/html, portrait keywords in scene_id | `portrait` | 0.75 |
| 9 | Single fg html, brand/logo in scene_id | `brand_mark` | 0.80 |
| 10 | Single fg html, notif in scene_id | `notification` | 0.80 |
| 11 | Image layers + ui/dashboard keywords | `ui_screenshot` | 0.70 |
| 12 | Multiple images, no text | `moodboard` | 0.65 |
| 13 | Video bg + html/text fg | `product_shot` | 0.50 |
| 14 | Fallback | `ui_screenshot` | 0.20 |

### visual_weight

Collects colors from text layer `style.color` and html layer inline styles. Text colors are **inverted** — white text implies a dark scene (light text is inverse-correlated with visual weight).

- Dark: >70% of collected luminance values < 0.25
- Light: >70% of collected luminance values > 0.6
- Mixed: everything else, or no parseable colors

### motion_energy

Score-based classification from multiple signal sources:

| Signal | Score |
|--------|-------|
| Camera: static | 0 |
| Camera: intensity < 0.2 | +1 |
| Camera: intensity 0.2–0.5 | +2 |
| Camera: intensity > 0.5 | +3 |
| Text: word-reveal | +2 |
| Text: scale-cascade | +6 |
| Text: weight-morph | +2 |
| Entrances: 1-2 layers | +1 |
| Entrances: 3+ layers | +3 |
| Stagger: 2 unique delays | +1 |
| Stagger: 3+ unique delays | +2 |
| Video layer present | +1 |

Score mapping: 0 → static, 1 → subtle, 2-5 → moderate, 6+ → high

### intent_tags

Structural inference based on content type, animation type, and motion energy:

| Content Type | Condition | Tags |
|-------------|-----------|------|
| brand_mark | single fg layer | `["hero", "opening"]` |
| typography | high motion energy | `["hero"]` |
| typography | word-reveal animation | `["opening"]` |
| typography | other animations | `["detail"]` |
| ui_screenshot | — | `["detail"]` |
| data_visualization | — | `["detail", "informational"]` |
| device_mockup | — | `["detail"]` |
| portrait | — | `["emotional"]` |
| collage/moodboard/split_panel | — | `["informational"]` |

Additional rules:
- Video bg + text fg → adds `"emotional"` if not already present
- Duration ≤ 1.5s with ≤ 2 layers → adds `"transition"`

## Confidence Scoring

Every classifier returns a confidence value between 0 and 1. These let downstream consumers (ANI-23) know which classifications are solid vs. guesses.

- **> 0.80**: High confidence — layout template match, clear structural signals
- **0.50–0.80**: Medium confidence — heuristic match with some ambiguity
- **< 0.50**: Low confidence — fallback or missing signals, consider LLM-assisted reclassification

## MCP Tool: analyze_scene

### Input

```json
{
  "scene": { /* scene-format JSON */ }
}
```

### Output

Markdown with:
- Classification table (field, value, confidence %)
- Metadata JSON block
- Confidence JSON block
- Diagnostics (layer count, layout, camera, duration)
- Low confidence warnings (any field < 50%)

### Example

```
# Scene Analysis: sc_word_reveal

| Field | Value | Confidence |
|-------|-------|------------|
| content_type | `typography` | 90% |
| visual_weight | `dark` | 95% |
| motion_energy | `moderate` | 66% |
| intent_tags | `opening` | 65% |
```

## API Reference

All functions are exported from `mcp/lib/analyze.js`.

| Function | Input | Output |
|----------|-------|--------|
| `analyzeScene(scene)` | Scene object | `{ metadata, _confidence }` |
| `classifyContentType(scene)` | Scene object | `{ value, confidence }` |
| `classifyVisualWeight(scene)` | Scene object | `{ value, confidence }` |
| `classifyMotionEnergy(scene)` | Scene object | `{ value, confidence }` |
| `inferIntentTags(scene, contentType, motionEnergy)` | Scene + classifications | `{ value, confidence }` |
| `hexToLuminance(hex)` | Hex color string | Number (0–1) or null |
| `extractColorsFromHTML(html)` | HTML string | Array of hex strings |

Constants: `CONTENT_TYPES`, `VISUAL_WEIGHTS`, `MOTION_ENERGIES`, `INTENT_TAGS`

## Ground Truth Validation

4 scenes in `test-kinetic-type.json` have hand-authored metadata. All 4 match the analyzer output exactly:

| Scene | content_type | visual_weight | motion_energy | intent_tags |
|-------|-------------|---------------|---------------|-------------|
| sc_word_reveal | typography | dark | moderate | [opening] |
| sc_scale_cascade | typography | dark | high | [hero] |
| sc_weight_morph | typography | dark | moderate | [detail] |
| sc_type_over_media | typography | dark | moderate | [opening, emotional] |

5 layout template scenes also validate correctly against their template types.

## Testing

63 tests across 9 describe blocks in `mcp/test/analyze.test.js`:

```bash
npm test                              # run all tests
node --test mcp/test/analyze.test.js  # run analyze tests only
```
