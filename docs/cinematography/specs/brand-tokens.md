# Brand Token System

Brand tokens define the visual identity applied to generated scenes — colors, typography, surfaces, and chart styles. They bridge Animatic's motion engine with Preset's design system renderer.

## Architecture

```
Brief (brand_id: "mercury")
  ↓
Animatic: resolves tokens → injects CSS custom properties → generates scenes
  ↓
Standalone (Remotion): CSS vars available on :root, HTML layers use them
Preset renderer: reads brand_id → applies full component library + design tokens
```

Animatic is the **motion + structure** layer. Preset is the **design fidelity** layer. Brand tokens are the contract between them.

## Brand File Format

Brand definitions live in `catalog/brands/{brand_id}.json`:

```json
{
  "brand_id": "mercury",
  "name": "Mercury",
  "description": "Fintech banking platform",
  "personality": "cinematic-dark",
  "style": "prestige",

  "colors": {
    "bg_primary": "#1a1a2e",
    "bg_surface": "rgba(255,255,255,0.04)",
    "bg_elevated": "#1c1c2e",
    "text_primary": "#e8e0d4",
    "text_secondary": "rgba(232,224,212,0.6)",
    "text_muted": "rgba(232,224,212,0.4)",
    "accent": "#6366f1",
    "trend_up": "#4ade80",
    "trend_down": "#94a3b8",
    "border": "rgba(255,255,255,0.06)",
    "shadow": "rgba(0,0,0,0.6)"
  },

  "typography": {
    "font_family": "'Inter', sans-serif",
    "font_mono": "'JetBrains Mono', monospace",
    "hero":    { "size": "48px", "weight": "400", "line_height": "1.1", "letter_spacing": "-0.02em" },
    "tagline": { "size": "36px", "weight": "400", "line_height": "1.2" },
    "heading": { "size": "20px", "weight": "600", "line_height": "1.3" },
    "body":    { "size": "16px", "weight": "400", "line_height": "1.5" },
    "caption": { "size": "13px", "weight": "400", "line_height": "1.4" },
    "label":   { "size": "14px", "weight": "500", "line_height": "1.3" }
  },

  "surfaces": {
    "card":  { "background": "rgba(255,255,255,0.04)", "border": "1px solid rgba(255,255,255,0.06)", "border_radius": "12px", "padding": "20px 24px" },
    "panel": { "background": "#1c1c2e", "border_radius": "16px", "shadow": "0 24px 80px rgba(0,0,0,0.6)" },
    "input": { "background": "rgba(255,255,255,0.06)", "border_radius": "24px", "padding": "16px 20px" }
  },

  "chart": {
    "bar_color": "rgba(255,255,255,0.3)",
    "bar_active": "#6366f1",
    "axis_color": "rgba(255,255,255,0.2)",
    "grid_color": "rgba(255,255,255,0.05)"
  }
}
```

## Resolution Priority

1. **Inline `brief.brand` object** — full brand definition in the brief itself
2. **`brief.brand_id`** — lookup from `catalog/brands/{id}.json`
3. **`brief.brand` as string** — treated as brand_id lookup
4. **Default** — `catalog/brands/_default.json`

## CSS Custom Properties

Brand tokens are injected as CSS custom properties into the first scene's background layer. This makes them available to all HTML content in the Remotion render.

### Color variables
| Variable | Maps to |
|----------|---------|
| `--brand-bg-primary` | `colors.bg_primary` |
| `--brand-bg-surface` | `colors.bg_surface` |
| `--brand-text-primary` | `colors.text_primary` |
| `--brand-accent` | `colors.accent` |
| `--brand-border` | `colors.border` |
| ... | All `colors.*` keys |

### Typography variables
| Variable | Maps to |
|----------|---------|
| `--brand-font` | `typography.font_family` |
| `--brand-font-mono` | `typography.font_mono` |
| `--brand-hero-size` | `typography.hero.size` |
| `--brand-hero-weight` | `typography.hero.weight` |
| `--brand-hero-lh` | `typography.hero.line_height` |
| ... | All scale entries |

### Surface variables
| Variable | Maps to |
|----------|---------|
| `--brand-card-bg` | `surfaces.card.background` |
| `--brand-card-border` | `surfaces.card.border` |
| `--brand-card-radius` | `surfaces.card.border_radius` |
| `--brand-panel-bg` | `surfaces.panel.background` |
| `--brand-panel-shadow` | `surfaces.panel.shadow` |
| ... | All surface entries |

## Usage in Briefs

### With brand_id (recommended)
```json
{
  "project": { "title": "Mercury Insights" },
  "brand_id": "mercury",
  "template": "product-launch",
  "content": { ... }
}
```

### With inline brand
```json
{
  "project": { "title": "My Product" },
  "brand": {
    "brand_id": "custom",
    "colors": { "bg_primary": "#0d1117", "text_primary": "#f0f6fc", "accent": "#58a6ff" },
    "typography": { "font_family": "'Mona Sans', sans-serif" }
  },
  "content": { ... }
}
```

## Preset Integration Contract

When Preset renders an Animatic scene:

1. Read `scene.brand` field (brand_id string set by the generator)
2. Look up the full brand definition from Preset's design system
3. Resolve brand tokens to Preset component props (typography components, color tokens, surface styles)
4. Render layers using Preset's component library instead of raw HTML

The CSS custom properties serve as the **fallback** when Preset's renderer isn't available (standalone Remotion render). They ensure scenes look reasonable even without the full design system.
