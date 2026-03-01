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
          "enum": ["html", "video", "image", "text"],
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

4. **Metadata is optional for authoring, required for AI.** A human can write a scene without metadata. The AI scene analysis engine (ANI-22) populates metadata for AI-planned sequences.

5. **No audio in v1.** The `audio` asset type exists for forward compatibility, but the v1 pipeline doesn't process it. Audio support comes with Remotion integration.
