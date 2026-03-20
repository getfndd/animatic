# Scene Format Spec

**Status:** Draft
**Issue:** ANI-12
**Version:** 1.0

## Overview

A scene is the atomic unit of the cinematography pipeline — a self-contained composition with declared dimensions, duration, assets, camera intent, and layer structure. Scenes can contain HTML elements, video, images, or any combination.

## Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["scene_id", "duration_s"],
  "properties": {
    "scene_id": {
      "type": "string",
      "pattern": "^sc_[a-z0-9_]+$",
      "description": "Unique scene identifier. Convention: sc_{descriptive_name}"
    },
    "canvas": {
      "type": "object",
      "properties": {
        "w": { "type": "integer", "default": 1920 },
        "h": { "type": "integer", "default": 1080 }
      },
      "description": "Scene dimensions in pixels. Defaults to 1080p."
    },
    "duration_s": {
      "type": "number",
      "minimum": 0.5,
      "maximum": 30,
      "description": "Scene hold duration in seconds. Can be overridden by sequence manifest."
    },
    "assets": {
      "type": "array",
      "items": { "$ref": "#/$defs/asset" },
      "description": "External media referenced by layers."
    },
    "camera": {
      "$ref": "#/$defs/camera",
      "description": "Camera directive for this scene. Can be overridden by sequence manifest."
    },
    "layout": {
      "$ref": "#/$defs/layout",
      "description": "Optional layout template. Layers reference named slots that auto-resolve to pixel positions."
    },
    "layers": {
      "type": "array",
      "items": { "$ref": "#/$defs/layer" },
      "description": "Ordered layer stack. First layer is deepest (background). Last layer is topmost (foreground)."
    },
    "metadata": {
      "$ref": "#/$defs/metadata",
      "description": "Content classification for AI analysis. Optional for hand-authored scenes, required for AI-planned sequences."
    }
  }
}
```

### Asset Definition

```json
{
  "$defs": {
    "asset": {
      "type": "object",
      "required": ["id", "type", "src"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique asset identifier within this scene."
        },
        "type": {
          "type": "string",
          "enum": ["video", "image", "audio"],
          "description": "Asset media type."
        },
        "src": {
          "type": "string",
          "description": "File path (relative to scene) or URL."
        },
        "trim": {
          "type": "object",
          "properties": {
            "start_s": { "type": "number", "default": 0 },
            "end_s": { "type": "number" }
          },
          "description": "For video/audio: trim to a subrange."
        },
        "loop": {
          "type": "boolean",
          "default": false,
          "description": "Loop video/audio for the scene duration."
        },
        "muted": {
          "type": "boolean",
          "default": true,
          "description": "Mute video audio track."
        }
      }
    }
  }
}
```

### Camera Definition

```json
{
  "$defs": {
    "camera": {
      "type": "object",
      "properties": {
        "move": {
          "type": "string",
          "enum": ["static", "push_in", "pull_out", "pan_left", "pan_right", "drift"],
          "default": "static",
          "description": "Camera movement type."
        },
        "intensity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.5,
          "description": "Movement intensity. 0 = imperceptible, 1 = maximum. Maps to transform magnitude per move type."
        },
        "easing": {
          "type": "string",
          "enum": ["linear", "ease_out", "cinematic_scurve"],
          "default": "cinematic_scurve",
          "description": "Interpolation curve for camera movement."
        }
      }
    }
  }
}
```

#### Intensity Mapping

| Move | Intensity 0.0 | Intensity 0.5 | Intensity 1.0 |
|------|--------------|---------------|----------------|
| `push_in` | scale 1.0 → 1.005 | scale 1.0 → 1.03 | scale 1.0 → 1.08 |
| `pull_out` | scale 1.005 → 1.0 | scale 1.03 → 1.0 | scale 1.08 → 1.0 |
| `pan_left` | translateX 0 → -5px | translateX 0 → -30px | translateX 0 → -80px |
| `pan_right` | translateX 0 → 5px | translateX 0 → 30px | translateX 0 → 80px |
| `drift` | ±0.2px sinusoidal | ±1px sinusoidal | ±3px sinusoidal |
| `static` | No transform | No transform | No transform |

### Layer Definition

```json
{
  "$defs": {
    "layer": {
      "type": "object",
      "required": ["id", "type"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique layer identifier within this scene."
        },
        "type": {
          "type": "string",
          "enum": ["html", "video", "image", "text", "svg"],
          "description": "Layer content type."
        },
        "slot": {
          "type": "string",
          "description": "Layout slot name. Overrides position when a layout template is active. See layout-templates.md."
        },
        "asset": {
          "type": "string",
          "description": "Asset ID reference (for video/image layers)."
        },
        "src": {
          "type": "string",
          "description": "HTML file path (for html layers)."
        },
        "content": {
          "type": "string",
          "description": "Text content (required for text layers)."
        },
        "animation": {
          "type": "string",
          "enum": ["word-reveal", "scale-cascade", "weight-morph"],
          "description": "Text animation primitive (for text layers). Omit for static text."
        },
        "style": {
          "type": "object",
          "properties": {
            "fontFamily": { "type": "string", "default": "system-ui" },
            "fontSize": { "type": "number", "default": 72 },
            "fontWeight": { "type": "integer", "default": 700 },
            "fontWeightStart": { "type": "integer", "description": "Start weight for weight-morph." },
            "fontWeightEnd": { "type": "integer", "description": "End weight for weight-morph." },
            "color": { "type": "string", "default": "#ffffff" },
            "textTransform": { "type": "string", "enum": ["none", "uppercase", "lowercase", "capitalize"], "default": "none" },
            "textAlign": { "type": "string", "enum": ["left", "center", "right"], "default": "center" },
            "letterSpacing": { "type": "string", "default": "normal" },
            "lineHeight": { "type": "number", "default": 1.1 }
          },
          "description": "Typography styles for text layers."
        },
        "depth_class": {
          "type": "string",
          "enum": ["background", "midground", "foreground"],
          "default": "midground",
          "description": "Depth classification for parallax and camera rig behavior."
        },
        "fit": {
          "type": "string",
          "enum": ["cover", "contain", "fill", "none"],
          "default": "cover",
          "description": "How the layer content fits the canvas."
        },
        "position": {
          "type": "object",
          "properties": {
            "x": { "type": "number", "default": 0 },
            "y": { "type": "number", "default": 0 },
            "w": { "type": "number" },
            "h": { "type": "number" }
          },
          "description": "Layer position and size within canvas. Omit for full-canvas layers."
        },
        "opacity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 1
        },
        "blend_mode": {
          "type": "string",
          "enum": ["normal", "screen", "multiply", "overlay"],
          "default": "normal"
        },
        "mask_layer": {
          "type": "string",
          "description": "ID of another layer to use as an alpha/luminance mask source."
        },
        "mask_type": {
          "type": "string",
          "enum": ["alpha", "luminance"],
          "default": "alpha",
          "description": "Mask compositing mode. Alpha uses opacity channel; luminance uses brightness."
        },
        "entrance": {
          "type": "object",
          "properties": {
            "primitive": {
              "type": "string",
              "description": "Animation primitive ID from the catalog (e.g., 'as-fadeInUp', 'cd-typewriter')."
            },
            "delay_ms": {
              "type": "integer",
              "default": 0,
              "description": "Delay before entrance starts."
            }
          },
          "description": "Optional entrance animation for this layer."
        }
      }
    }
  }
}
```

### Metadata Definition

```json
{
  "$defs": {
    "metadata": {
      "type": "object",
      "properties": {
        "content_type": {
          "type": "string",
          "enum": [
            "portrait",
            "ui_screenshot",
            "typography",
            "brand_mark",
            "data_visualization",
            "moodboard",
            "product_shot",
            "notification",
            "device_mockup",
            "split_panel",
            "collage"
          ],
          "description": "Primary content classification."
        },
        "visual_weight": {
          "type": "string",
          "enum": ["light", "dark", "mixed"],
          "description": "Dominant tone."
        },
        "motion_energy": {
          "type": "string",
          "enum": ["static", "subtle", "moderate", "high"],
          "description": "Amount of internal animation."
        },
        "intent_tags": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Semantic tags: 'opening', 'hero', 'detail', 'closing', 'transition', 'emotional', 'informational'."
        }
      }
    }
  }
}
```

### Layout Definition

```json
{
  "$defs": {
    "layout": {
      "type": "object",
      "required": ["template"],
      "properties": {
        "template": {
          "type": "string",
          "enum": ["hero-center", "split-panel", "masonry-grid", "full-bleed", "device-mockup"],
          "description": "Layout template name. See docs/cinematography/layout-templates.md for details."
        },
        "config": {
          "type": "object",
          "description": "Template-specific configuration. Each template has its own config options with sensible defaults."
        }
      }
    }
  }
}
```

When a scene has a `layout`, layers can reference named `slot` values. The pipeline resolves each slot to a `position: { x, y, w, h }` before rendering. If both `slot` and `position` are present, the slot-resolved position wins. Layers without a `slot` are unaffected.

## Examples

### HTML-Only Scene (backward compatible with current prototypes)

```json
{
  "scene_id": "sc_brand_mark",
  "canvas": { "w": 1920, "h": 1080 },
  "duration_s": 2.5,
  "camera": { "move": "static" },
  "layers": [
    {
      "id": "logo",
      "type": "html",
      "src": "scenes/brand-mark.html",
      "depth_class": "foreground"
    }
  ],
  "metadata": {
    "content_type": "brand_mark",
    "visual_weight": "light",
    "motion_energy": "subtle",
    "intent_tags": ["hero"]
  }
}
```

### Mixed Media Scene (video background + text overlay)

```json
{
  "scene_id": "sc_portrait_type",
  "canvas": { "w": 1920, "h": 1080 },
  "duration_s": 3.0,
  "assets": [
    { "id": "portrait_clip", "type": "video", "src": "assets/portrait.mp4", "loop": true, "muted": true }
  ],
  "camera": { "move": "push_in", "intensity": 0.3, "easing": "cinematic_scurve" },
  "layers": [
    {
      "id": "bg_video",
      "type": "video",
      "asset": "portrait_clip",
      "depth_class": "background",
      "fit": "cover"
    },
    {
      "id": "type_overlay",
      "type": "html",
      "src": "scenes/kinetic-type.html",
      "depth_class": "foreground",
      "blend_mode": "normal",
      "entrance": { "primitive": "type-reveal-word", "delay_ms": 500 }
    }
  ],
  "metadata": {
    "content_type": "portrait",
    "visual_weight": "light",
    "motion_energy": "moderate",
    "intent_tags": ["opening", "emotional"]
  }
}
```

### Kinetic Type Scene (text layer with word-reveal)

```json
{
  "scene_id": "sc_word_reveal",
  "duration_s": 3,
  "camera": { "move": "static" },
  "layers": [
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
        "textTransform": "uppercase"
      }
    }
  ]
}
```

### Type Over Media (text + video composition)

```json
{
  "scene_id": "sc_type_over_media",
  "duration_s": 3,
  "assets": [
    { "id": "bg_clip", "type": "video", "src": "assets/background.mp4", "muted": true }
  ],
  "camera": { "move": "push_in", "intensity": 0.3 },
  "layers": [
    {
      "id": "video-bg",
      "type": "video",
      "asset": "bg_clip",
      "depth_class": "background",
      "fit": "cover"
    },
    {
      "id": "title",
      "type": "text",
      "content": "TYPE OVER MEDIA",
      "animation": "word-reveal",
      "depth_class": "foreground",
      "entrance": { "delay_ms": 500 }
    }
  ]
}
```

### Device Mockup Scene

```json
{
  "scene_id": "sc_brand_check_device",
  "canvas": { "w": 1920, "h": 1080 },
  "duration_s": 4.0,
  "assets": [
    { "id": "brand_collage", "type": "video", "src": "assets/pirelli-collage.mp4", "loop": true, "muted": true },
    { "id": "ui_screenshot", "type": "image", "src": "assets/brand-check-ui.png" }
  ],
  "camera": { "move": "push_in", "intensity": 0.2, "easing": "ease_out" },
  "layers": [
    {
      "id": "collage_bg",
      "type": "video",
      "asset": "brand_collage",
      "depth_class": "background",
      "position": { "x": 0, "y": 0, "w": 960, "h": 1080 }
    },
    {
      "id": "dashboard",
      "type": "image",
      "asset": "ui_screenshot",
      "depth_class": "foreground",
      "position": { "x": 960, "y": 0, "w": 960, "h": 1080 },
      "entrance": { "primitive": "as-fadeInRight", "delay_ms": 300 }
    }
  ],
  "metadata": {
    "content_type": "device_mockup",
    "visual_weight": "mixed",
    "motion_energy": "moderate",
    "intent_tags": ["detail", "closing"]
  }
}
```

### Layout Template Scene (split-panel with slot references)

```json
{
  "scene_id": "sc_product_split",
  "duration_s": 3,
  "layout": {
    "template": "split-panel",
    "config": { "ratio": 0.55, "gap": 20 }
  },
  "camera": { "move": "static" },
  "layers": [
    {
      "id": "left",
      "type": "image",
      "slot": "left",
      "asset": "product_photo",
      "depth_class": "midground"
    },
    {
      "id": "right",
      "type": "text",
      "slot": "right",
      "content": "REIMAGINED",
      "animation": "word-reveal",
      "depth_class": "foreground"
    }
  ]
}
```

### SVG Layer (vector shapes with stroke draw-on animation)

```json
{
  "scene_id": "sc_icon_reveal",
  "duration_s": 3,
  "format_version": 2,
  "camera": { "move": "static" },
  "layers": [
    {
      "id": "icon",
      "type": "svg",
      "content": "<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><circle cx='50' cy='50' r='40' fill='none' stroke='white' stroke-width='2' style='stroke-dasharray: var(--stroke-dasharray); stroke-dashoffset: var(--stroke-dashoffset); fill-opacity: var(--fill-opacity)'/></svg>",
      "depth_class": "foreground"
    }
  ],
  "motion": {
    "groups": [
      {
        "id": "draw_on",
        "targets": ["icon"],
        "primitive": "as-fadeIn",
        "effects": [
          { "type": "stroke_dashoffset", "from": 251, "to": 0, "duration_ms": 1500, "easing": "ease_out" },
          { "type": "fill_opacity", "from": 0, "to": 1, "duration_ms": 800, "delay_ms": 1000 }
        ]
      }
    ]
  }
}
```

#### SVG Layer Details

The `svg` layer type supports two content modes:

- **Inline SVG** (`content`): SVG markup rendered directly in the DOM via `innerHTML`. This allows SVG elements to reference CSS custom properties set by the timeline system (e.g., `var(--stroke-dashoffset)`).
- **External SVG** (`src`): An `.svg` file rendered as an `<img>` element. External SVGs cannot be animated via CSS custom properties — use this mode for static vector graphics.

**SVG-specific animatable properties** (exposed as CSS custom properties on the layer wrapper):

| Property | CSS Custom Property | Default | Use Case |
|----------|-------------------|---------|----------|
| `stroke_dashoffset` | `--stroke-dashoffset` | 0 | Stroke draw-on animation |
| `stroke_dasharray` | `--stroke-dasharray` | 0 | Stroke pattern animation |
| `fill_opacity` | `--fill-opacity` | 1 | Fill fade independent of layer opacity |
| `stroke_opacity` | `--stroke-opacity` | 1 | Stroke fade independent of layer opacity |
| `path_length` | `--path-length` | 0 | Length-based morphing |

Inline SVG elements should reference these via CSS `var()` functions in their `style` attributes. The timeline system interpolates the values per frame and sets them as CSS custom properties on the layer's wrapper `<div>`.

## Validation

The schema must describe all 12 shot types from the reference `high.mp4`:

| Shot | scene_id | content_type | layers | camera |
|------|----------|-------------|--------|--------|
| 1 | sc_portrait_closeup | portrait | video(bg) | push_in 0.3 |
| 2 | sc_portrait_type | portrait | video(bg) + html(fg) | push_in 0.3 |
| 3 | sc_architecture_grid | moodboard | image(bg) * N | pan_left 0.3 |
| 4 | sc_toc_scroll | typography | html(fg) | static |
| 5 | sc_product_ui | ui_screenshot | html(fg) | drift 0.3 |
| 6 | sc_biodiversity_logo | brand_mark | html(fg) | static |
| 7 | sc_notification_card | notification | html(fg) | static |
| 8-10 | sc_virtual_tryon | product_shot | video(bg) | push_in 0.2 |
| 11 | sc_collab_doc | split_panel | html(fg) + image(bg) | drift 0.2 |
| 12-13 | sc_brand_check | device_mockup | video(bg) + image(fg) | push_in 0.2 |

All 12 shots are representable with this schema.

## Design Decisions

1. **Layers, not elements.** Scenes compose layers, not individual DOM elements. Each layer is a self-contained content unit (an HTML file, a video, an image). This keeps the scene format simple while allowing arbitrary complexity within HTML layers.

2. **Camera at scene level, not layer level.** The camera rig moves the entire scene (all layers move together, with depth-class-based parallax). Individual layer animation is handled by entrance primitives, not camera.

3. **Assets are declared, not inline.** Media files are referenced by ID, allowing reuse across layers and enabling preloading. Asset resolution (file path → loaded media) is the renderer's job.

4. **Metadata is optional for authoring, required for AI.** A human can write a scene without metadata. The AI scene analysis engine (ANI-22) populates metadata for AI-planned sequences. The analyzer also produces a `reasoning` block explaining each classification decision (ANI-45), enabling traceability from intent to output.

5. **Audio at sequence level.** The `audio` asset type is supported for scene-level assets. Background music and per-scene audio clips (narration, SFX) are rendered at the sequence manifest level via Remotion's `<Audio>` component.

---

## Scene Format v2 — Motion Block

### Overview

v2 scenes add a `motion` block that describes rich choreography at a semantic level (Level 1: Motion Intent). A compiler transforms this into frame-addressed keyframe tracks (Level 2: Motion Timeline) consumable by the Remotion renderer.

**Detection:** `if (scene.format_version === 2 || scene.motion) → v2 path`

v1 scenes without a `motion` block continue to render via the existing camera/entrance path.

### `format_version`

Optional. When set to `2`, signals v2 rendering path. Also triggered by presence of `motion` block.

### `motion` Block

```json
{
  "motion": {
    "camera": { ... },
    "groups": [ ... ],
    "recipe": "recipe-id",
    "target_map": { ... }
  }
}
```

### Groups

Each group targets a set of layers sharing an animation primitive and timing:

```json
{
  "id": "cards",
  "targets": ["card-0", "card-1", "card-2"],
  "primitive": "ed-slide-stagger",
  "position": ">200",
  "stagger": {
    "interval_ms": 120,
    "from": "center",
    "ease": "power1_out",
    "amplitude": { "curve": "descending", "start": 1.0, "end": 0.6 },
    "settle": { "easing": "spring", "duration_ms": 600 }
  },
  "on_complete": { "emit": "cards_done" }
}
```

### Position Parameter

Controls when a group starts relative to the previous group or a named cue.
Inspired by GSAP's position parameter. Takes precedence over legacy `delay` / `delay_after_hero_ms`.

| Syntax | Meaning |
|--------|---------|
| `">"` | Start at previous group's end |
| `"<"` | Start at previous group's start |
| `">200"` | 200ms after previous group's end |
| `">-200"` | 200ms before previous group's end (overlap) |
| `"<200"` | 200ms after previous group's start |
| `"label"` | Start at named cue |
| `"label+300"` | 300ms after named cue |
| `"label-100"` | 100ms before named cue |

Legacy fields `delay: { after, offset_ms }` and `delay_after_hero_ms` still work but
`position` is preferred for new scenes.

**Stagger directive fields:**
- `interval_ms` — time between element starts (>= 0)
- `amount_ms` — total stagger time distributed across all elements (alternative to `interval_ms`)
- `order` — `sequential`, `reverse`, `center_out`, `random`, `distance` (legacy)
- `from` — distribution origin, takes precedence over `order`:
  - `"start"` — first element animates first (default)
  - `"end"` — last element animates first
  - `"center"` — middle element first, expanding outward
  - `"edges"` — outer elements first, converging to center
  - `"random"` — random order
  - `<number>` — from specific index outward
- `ease` — easing curve on the stagger delay distribution:
  - `"linear"` — even spacing (default)
  - `"power1_in"` / `"power1_out"` — quadratic acceleration/deceleration
  - `"power2_in"` / `"power2_out"` — cubic
  - `"power3_in"` / `"power3_out"` — quartic
  - `"center"` — ease-in-out (elements bunch at edges, spread in middle)
- `amplitude.curve` — `uniform`, `descending`, `ascending`, `wave`
- `amplitude.start` / `amplitude.end` — multiplier range
- `settle` — shared settle curve for "landing together" feel

### Cues

Named sync points for coordinating motion across groups and camera:

**Sources:**
- `on_complete` on groups — fires when last element finishes
- `{ "at": 0.5 }` — proportional scene time
- `{ "at_ms": 2000 }` — absolute time
- `"scene_start"`, `"scene_end"` — implicit

### Camera (v2)

Single move with sync:
```json
{
  "camera": {
    "move": "push_in",
    "intensity": 0.3,
    "sync": { "peak_at": 0.6, "cue": "headline_done" }
  }
}
```

Multi-move:
```json
{
  "camera": {
    "moves": [
      { "move": "push_in", "intensity": 0.4, "from": 0, "to": 0.6 },
      { "move": "drift", "intensity": 0.15, "from": 0.6, "to": 1.0 }
    ]
  }
}
```

### Recipes

Composable motion modules that expand into groups:

```json
{
  "motion": {
    "recipe": "editorial-feature-reveal",
    "target_map": { "hero": ["title"], "supporting": ["card-0", "card-1"] }
  }
}
```

Recipes are defined in `catalog/recipes.json` (12 initial recipes, 3 per personality).

### Per-Layer Effects

```json
{
  "effects": [
    { "type": "blur", "from": 8, "to": 0, "duration_ms": 600, "easing": "ease_out" },
    { "type": "brightness", "from": 0.3, "to": 1.0, "duration_ms": 800 }
  ]
}
```

### Clip-Path Reveal Shapes

Beyond `clip_inset_*` (rectangular reveals), the pipeline supports circle, ellipse, and polygon clip-path shapes. These are animatable via keyframe tracks — the radius/size values interpolate between keyframes.

**Circle reveal:** `clip_circle` controls the radius percentage. Optional `clip_circle_cx` / `clip_circle_cy` control the center (default 50%, 50%).

```json
{
  "effects": [
    { "type": "clip_circle", "from": 0, "to": 100, "duration_ms": 800 }
  ]
}
```

Renders as `clip-path: circle(R% at CX% CY%)`.

**Ellipse reveal:** `clip_ellipse` controls the X radius. Optional `clip_ellipse_ry` controls the Y radius (defaults to matching X). Optional `clip_ellipse_cx` / `clip_ellipse_cy` control the center.

```json
{
  "effects": [
    { "type": "clip_ellipse", "from": 0, "to": 100, "duration_ms": 600 }
  ]
}
```

Renders as `clip-path: ellipse(RX% RY% at CX% CY%)`.

**Polygon reveal:** `clip_polygon` is a serialized polygon string passed directly. Useful for custom shapes like diagonal wipes or star reveals.

At the Level 2 timeline level, the `clip_polygon` track value is a string:

```json
{
  "clip_polygon": [
    { "frame": 0, "value": "0% 0%, 0% 0%, 0% 0%" },
    { "frame": 48, "value": "0% 0%, 100% 0%, 100% 100%" }
  ]
}
```

Renders as `clip-path: polygon(...)`.

### Layer Masking

A layer can reference another layer as an alpha or luminance mask using `mask_layer` and `mask_type`.

```json
{
  "layers": [
    {
      "id": "mask-shape",
      "type": "html",
      "content": "<div style='background: white; border-radius: 50%; width: 100%; height: 100%'></div>"
    },
    {
      "id": "content",
      "type": "video",
      "asset": "hero_clip",
      "mask_layer": "mask-shape",
      "mask_type": "alpha"
    }
  ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mask_layer` | string | — | ID of another layer to use as the mask source |
| `mask_type` | `"alpha"` \| `"luminance"` | `"alpha"` | Mask compositing mode. Alpha uses the mask's opacity channel; luminance uses brightness. |

The mask source layer is rendered but hidden (`visibility: hidden`). The renderer applies CSS `mask-mode` for compositing. The mask layer can itself be animated via timeline tracks (e.g., animating a clip-path on the mask layer creates a shaped, animated reveal).

### Level 2 Motion Timeline (compiled output)

Frame-addressed, per-property, fully expanded. No semantic references.

```json
{
  "scene_id": "sc_hero",
  "duration_frames": 240,
  "fps": 60,
  "tracks": {
    "camera": {
      "scale": [
        { "frame": 0, "value": 1, "easing": "cubic-bezier(0.33,0,0.2,1)" },
        { "frame": 144, "value": 1.042 }
      ]
    },
    "layers": {
      "title": {
        "opacity": [ { "frame": 0, "value": 0 }, { "frame": 36, "value": 1, "easing": "..." } ],
        "filter_blur": [ { "frame": 0, "value": 8 }, { "frame": 36, "value": 0, "easing": "..." } ]
      }
    }
  }
}
```

**Animatable properties:** `opacity`, `translateX`, `translateY`, `scale`, `rotate`, `filter_blur`, `filter_brightness`, `filter_contrast`, `filter_saturate`, `clip_inset_top`, `clip_inset_right`, `clip_inset_bottom`, `clip_inset_left`, `clip_circle`, `clip_circle_cx`, `clip_circle_cy`, `clip_ellipse`, `clip_ellipse_ry`, `clip_ellipse_cx`, `clip_ellipse_cy`, `clip_polygon`, `stroke_dashoffset`, `stroke_dasharray`, `fill_opacity`, `stroke_opacity`, `path_length`

### MCP Tools

- `compile_motion` — Compile v2 scene → Level 2 timeline
- `validate_manifest` — Extended for v2 fields
- `validate_choreography` — Extended for motion group validation
