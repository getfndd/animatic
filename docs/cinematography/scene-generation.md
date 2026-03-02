# Scene Generation — ANI-31

**Status:** Shipped
**Module:** `mcp/lib/generator.js`
**MCP Tool:** `generate_scenes`
**CLI:** `node scripts/sizzle.mjs --brief <brief.json>`

## Overview

Rule-based scene generator that transforms a creative brief into validated scene JSON files. Bridges the gap between brief authoring (`/brief`) and the sizzle pipeline (`/sizzle`), completing the full automated cinematography pipeline.

```
brief.json + assets/
    → [generateScenes]    ANI-31 (this module)
    → scenes/*.json
    → [analyzeScene]      ANI-22
    → [planSequence]      ANI-23
    → [evaluate/validate] ANI-28/29
    → render              Remotion
```

## Architecture

### 8 Stage Pipeline

| # | Function | Purpose |
|---|----------|---------|
| 1 | `validateBrief()` | Schema validation — required fields, template ID, asset uniqueness, referential integrity |
| 2 | `classifyAssets()` | 3-tier asset classification: hint → filename → extension fallback |
| 3 | `resolveTemplate()` | Load named template or infer virtual structure for custom briefs |
| 4 | `resolveStyle()` | Priority: explicit > template default > tone inference > fallback |
| 5 | `allocateDurationsWeighted()` | Weighted division with emphasis (strong = 1.5×), clamped to [0.5, 30] |
| 6 | `buildScenePlan()` | Expand sections → handle repeats/optionals → assign assets → must_include |
| 7 | `generateScene()` | Build layers, slots, assets per content type |
| 8 | `generateScenes()` | Orchestrator — composes stages 1-7, self-validates via `validateScene()` |

### Asset Classification Priority

| Tier | Source | Confidence | Example |
|------|--------|-----------|---------|
| 1 | Explicit `hint` field | 1.0 | `hint: "product"` → `product_shot` |
| 2 | Filename convention | 0.8 | `hero-dashboard.png` → `product_shot` |
| 3 | Extension fallback | 0.3 | `.svg` → `brand_mark` |
| 4 | Default | 0.1 | Unknown → `product_shot` |

### Asset Assignment (Two-Pass)

1. **Explicit refs** — Honor `content.sections[].assets[]` references
2. **Affinity distribution** — Unassigned assets matched to scenes by content type, then role (hero→opening, logo→closing, bg→heavy scenes)
3. **Force must_include** — Remaining `constraints.must_include` assets forced into best-matching scene

### Content Type → Scene Structure

| Content Type | Layout | Key Layers |
|---|---|---|
| `typography` | hero-center | bg (HTML) + fg text (word-reveal or scale-cascade) |
| `ui_screenshot` | device-mockup | bg + device (image) + content (text) |
| `product_shot` | device-mockup | bg + device (image) + content (text) |
| `portrait` | split-panel | bg + left (image) + right (text) |
| `brand_mark` | hero-center | bg + center (image) + optional text |
| `collage` | masonry-grid | cell-N (images) |
| `data_visualization` | hero-center | bg + center (image) + text |

### Design Decisions

- **Camera always static** — Camera moves are the planner's job (ANI-23). Generated scenes set `{ move: 'static' }` to avoid conflicting with style pack camera overrides.
- **Metadata pre-populated** — `content_type` and `intent_tags` set from the plan. The analyzer (ANI-22) re-derives and validates these independently.
- **Self-validation** — Every generated scene passes through `validateScene()` before returning. Invalid output throws.
- **No LLM calls** — Entirely rule-based. Deterministic, testable, fast. LLM enhancement can layer on top later.

## Module Pattern

Follows the same pattern as `analyze.js` and `planner.js`:
- Catalog data loaded at module level (brief templates, style packs, personalities)
- Pure exported functions for each stage
- Single orchestrator function (`generateScenes`)
- Self-validates output

## Testing

~94 tests in `mcp/test/generator.test.js`:
- Unit tests for each stage function
- Integration tests for all 5 template types
- Validates generated scenes pass both `validateScene()` and `analyzeScene()`
- Constants verification (pattern completeness, map consistency)

Run: `npm test`
