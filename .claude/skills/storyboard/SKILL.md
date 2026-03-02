---
name: storyboard
description: "Brief → classified assets → generated scenes. Validates, classifies, generates, writes scene JSON files."
---

# /storyboard - Brief to Scenes

Transform a creative brief into a set of scene JSON files ready for the `/sizzle` pipeline.

## Usage

```
/storyboard <brief.json> [--style <name>] [--output <dir>]
```

| Argument | Description |
|----------|-------------|
| `<brief.json>` | Path to creative brief JSON file (required) |
| `--style <name>` | Override style pack (default: inferred from brief template/tone) |
| `--output <dir>` | Output directory for scene files (default: `scenes/`) |

## Workflow

### 1. Validate Brief

Read and validate `brief.json` — checks required fields (project, content.sections), template ID, asset uniqueness, and referential integrity.

### 2. Classify Assets

For each asset in the brief, classify using 3-tier priority:
1. **Explicit hint** (confidence 1.0) — `hint: "product"` → `product_shot`
2. **Filename convention** (confidence 0.8) — `hero-dashboard.png` → `product_shot`
3. **Extension fallback** (confidence 0.3) — `.svg` → `brand_mark`

Assigns roles: hero, supporting, background, closing.

### 3. Resolve Template + Style

- Load named template (`product-launch`, `brand-story`, etc.) or infer virtual structure for `custom`
- Resolve style: explicit > template default > tone inference > fallback to `prestige`

### 4. Build Scene Plan

Expand template sections into concrete scenes:
- Handle repeats (`repeat.min`/`max`) and optionals
- Assign assets: honor explicit section refs → distribute unassigned by affinity → force `must_include`
- 4+ assets in one section → auto-classify as collage/masonry-grid

### 5. Generate Scenes

Build validated scene JSON for each plan entry:
- Content-type-specific layer structures (typography, device-mockup, split-panel, etc.)
- Camera always `static` (camera moves are the planner's job)
- Weighted duration allocation (strong emphasis = 1.5×)
- Brand colors and font applied to all text layers

### 6. Write Scene Files

Write individual scene JSON files:
```
scenes/
├── 00-sc_00_hero.json
├── 01-sc_01_product.json
├── 02-sc_02_features.json
└── 03-sc_03_cta.json
```

## MCP Tool

Uses `generate_scenes` — pass a brief object, get validated scenes back.

## Content Type → Layout Mapping

| Content Type | Layout | Layers |
|---|---|---|
| typography | hero-center | bg HTML + fg text (word-reveal or scale-cascade) |
| ui_screenshot | device-mockup | bg + device slot (image) + content slot (text) |
| product_shot | device-mockup | bg + device slot (image) + content (text) |
| portrait | split-panel | bg + left (image) + right (text) |
| brand_mark | hero-center | bg + center (image/svg) + optional text |
| collage | masonry-grid | cell-N slots (images) |
| data_visualization | hero-center | bg + center (image) + text |

## Templates

| Template | Sections | Default Style |
|----------|----------|---------------|
| `product-launch` | Hero → Product → Features → Social Proof → CTA | prestige |
| `brand-story` | Opening → Problem → People → Vision → Proof → Closing | intimate |
| `investor-pitch` | Hook → Product → Traction → Team → Ask | corporate |
| `photo-essay` | Title → Visual (repeat) → Grid → Closing | fade |
| `tutorial` | Title → Step (repeat) → Result → Next Steps | minimal |
| `custom` | Inferred from content sections | prestige |

## Related Commands

| Command | Purpose |
|---------|---------|
| `/brief` | Author the creative brief (upstream) |
| `/sizzle` | Scenes → rendered video (downstream) — also supports `--brief` flag |
| `/review` | Evaluate sequence quality |
