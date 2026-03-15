# Semantic Scene Format v3

**Status:** Draft
**Issue:** ANI-67
**Version:** 3.0

## Overview

v3 scenes add a `semantic` block that describes *what UI components do* rather than *how they animate*. Components compile to layers; interactions compile to v2 motion groups. The `layers[]` array remains the rendering target — `semantic` is an authoring-level abstraction that the compiler expands.

**Detection:** `if (scene.format_version === 3 || scene.semantic) → v3 path`

**Compilation chain:** v3 semantic → v2 motion+layers → Level 2 timeline

v1/v2 scenes without a `semantic` block continue to render via existing paths.

## Schema

### `semantic` Block

```json
{
  "semantic": {
    "components": [],
    "interactions": [],
    "camera_behavior": {},
    "art_direction": {}
  }
}
```

### Component Definition

```json
{
  "$defs": {
    "component": {
      "type": "object",
      "required": ["id", "type"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^cmp_[a-z0-9_]+$",
          "description": "Unique component identifier. Convention: cmp_{descriptive_name}"
        },
        "type": {
          "type": "string",
          "enum": [
            "input_field",
            "prompt_card",
            "dropdown_menu",
            "result_stack",
            "upload_zone",
            "chip_row",
            "icon_label_row",
            "stacked_cards"
          ],
          "description": "Semantic component type."
        },
        "role": {
          "type": "string",
          "enum": ["hero", "supporting", "background", "wildcard"],
          "default": "supporting",
          "description": "Compositional role. Affects camera attention and motion priority."
        },
        "layer_ref": {
          "type": "string",
          "description": "References an existing layer ID. If omitted, the compiler auto-generates a layer."
        },
        "anchor": {
          "type": "object",
          "properties": {
            "x": { "type": "number", "minimum": 0, "maximum": 1 },
            "y": { "type": "number", "minimum": 0, "maximum": 1 }
          },
          "description": "Normalized position hint (0–1). Used by the compiler for layout placement."
        },
        "layout": {
          "type": "object",
          "properties": {
            "slot": { "type": "string" }
          },
          "description": "Layout slot reference for template-based positioning."
        },
        "props": {
          "type": "object",
          "description": "Type-specific properties (placeholder, value, items, etc.)."
        },
        "style_tokens": {
          "type": "object",
          "properties": {
            "radius": { "type": "string" },
            "shadow": { "type": "string" },
            "bg": { "type": "string" },
            "fg": { "type": "string" },
            "border": { "type": "string" },
            "font_size": { "type": "string" }
          },
          "description": "Per-component visual variation tokens."
        }
      }
    }
  }
}
```

### Interaction Definition

```json
{
  "$defs": {
    "interaction": {
      "type": "object",
      "required": ["id", "target", "kind"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^int_[a-z0-9_]+$",
          "description": "Unique interaction identifier. Convention: int_{descriptive_name}"
        },
        "target": {
          "type": "string",
          "pattern": "^cmp_[a-z0-9_]+$",
          "description": "Component ID this interaction acts on."
        },
        "kind": {
          "type": "string",
          "enum": [
            "focus",
            "type_text",
            "replace_text",
            "open_menu",
            "select_item",
            "insert_items",
            "fan_stack",
            "settle",
            "pulse_focus"
          ],
          "description": "Interaction kind. See interaction-dsl.md for detailed definitions."
        },
        "params": {
          "type": "object",
          "description": "Kind-specific parameters (text, speed, index, items, count, etc.)."
        },
        "timing": {
          "type": "object",
          "properties": {
            "delay": {
              "type": "object",
              "properties": {
                "after": { "type": "string", "description": "Cue name to wait for." },
                "offset_ms": { "type": "number", "description": "Offset after cue fires." }
              }
            },
            "at": { "type": "number", "minimum": 0, "maximum": 1, "description": "Proportional scene time." },
            "at_ms": { "type": "number", "minimum": 0, "description": "Absolute time in ms." }
          },
          "description": "Timing control. Uses the same cue model as v2 motion groups."
        },
        "on_complete": {
          "type": "object",
          "properties": {
            "emit": { "type": "string", "description": "Cue name to emit on completion." }
          },
          "description": "Cue emission on interaction completion."
        },
        "duration_ms": {
          "type": "number",
          "minimum": 0,
          "description": "Override default duration for this interaction kind."
        }
      }
    }
  }
}
```

### Camera Behavior Definition

```json
{
  "$defs": {
    "camera_behavior": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": ["reactive", "ambient", "static"],
          "default": "ambient",
          "description": "Camera response mode. Reactive follows interactions; ambient drifts; static holds."
        },
        "ambient": {
          "type": "object",
          "properties": {
            "drift": { "type": "number", "minimum": 0, "maximum": 1, "description": "Drift intensity." },
            "breathe": { "type": "number", "minimum": 0, "maximum": 1, "description": "Breathing scale intensity." }
          },
          "description": "Ambient motion parameters. Only active when mode is ambient."
        },
        "push_in_on_focus": {
          "type": "boolean",
          "default": false,
          "description": "Camera pushes toward focused component. Only active when mode is reactive."
        }
      }
    }
  }
}
```

### Art Direction Definition

```json
{
  "$defs": {
    "art_direction": {
      "type": "object",
      "properties": {
        "density": {
          "type": "string",
          "enum": ["sparse", "balanced", "dense"],
          "description": "Component density hint for layout generation."
        },
        "focus": {
          "type": "string",
          "enum": ["single", "distributed"],
          "description": "Attention distribution. Single = one hero; distributed = ensemble."
        },
        "motion_profile": {
          "type": "string",
          "enum": ["restrained", "fluid", "energetic"],
          "description": "Overall motion energy budget."
        },
        "readability_priority": {
          "type": "boolean",
          "default": false,
          "description": "When true, adds extra hold time for text-heavy components."
        }
      }
    }
  }
}
```

## Field Tables

### Component Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | `cmp_*` pattern. Unique within scene. |
| `type` | enum | Yes | — | One of 8 component types. |
| `role` | enum | No | `supporting` | `hero`, `supporting`, `background`, `wildcard` |
| `layer_ref` | string | No | — | Existing layer ID. Omit for auto-generation. |
| `anchor` | `{x, y}` | No | — | Normalized 0–1 position hint. |
| `layout` | `{slot}` | No | — | Layout slot reference. |
| `props` | object | No | — | Type-specific (placeholder, value, items, etc.) |
| `style_tokens` | object | No | — | radius, shadow, bg, fg, border, font_size |

### Interaction Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | `int_*` pattern. Unique within scene. |
| `target` | string | Yes | — | Must reference a component `id`. |
| `kind` | enum | Yes | — | One of 9 interaction kinds. |
| `params` | object | No | — | Kind-specific (text, speed, index, items, etc.) |
| `timing` | object | No | — | `{delay: {after, offset_ms}, at, at_ms}` |
| `on_complete` | `{emit}` | No | — | Cue emission. |
| `duration_ms` | number | No | kind default | Override duration (>= 0). |

### Camera Behavior Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | enum | No | `ambient` | `reactive`, `ambient`, `static` |
| `ambient` | `{drift, breathe}` | No | — | 0–1 intensity values |
| `push_in_on_focus` | boolean | No | `false` | Camera follows focus target |

### Art Direction Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `density` | enum | No | — | `sparse`, `balanced`, `dense` |
| `focus` | enum | No | — | `single`, `distributed` |
| `motion_profile` | enum | No | — | `restrained`, `fluid`, `energetic` |
| `readability_priority` | boolean | No | `false` | Extra hold time for text components |

## Examples

### 1. Single Input Field + Type Text (Minimal v3)

```json
{
  "scene_id": "sc_search_input",
  "format_version": 3,
  "duration_s": 3,
  "camera": { "move": "static" },
  "layers": [],
  "semantic": {
    "components": [
      {
        "id": "cmp_search",
        "type": "input_field",
        "role": "hero",
        "anchor": { "x": 0.5, "y": 0.4 },
        "props": { "placeholder": "Search anything..." }
      }
    ],
    "interactions": [
      {
        "id": "int_type_query",
        "target": "cmp_search",
        "kind": "type_text",
        "params": { "text": "best restaurants nearby", "speed": 50 },
        "timing": { "at_ms": 500 }
      }
    ]
  }
}
```

### 2. Prompt Card + Dropdown (Cue Linking)

```json
{
  "scene_id": "sc_prompt_select",
  "format_version": 3,
  "duration_s": 4,
  "camera": { "move": "static" },
  "layers": [],
  "semantic": {
    "components": [
      {
        "id": "cmp_prompt",
        "type": "prompt_card",
        "role": "hero",
        "anchor": { "x": 0.5, "y": 0.3 },
        "props": { "value": "Generate a report for..." }
      },
      {
        "id": "cmp_format_menu",
        "type": "dropdown_menu",
        "role": "supporting",
        "anchor": { "x": 0.5, "y": 0.55 },
        "props": { "items": ["PDF", "Slides", "Spreadsheet"] }
      }
    ],
    "interactions": [
      {
        "id": "int_focus_prompt",
        "target": "cmp_prompt",
        "kind": "focus",
        "timing": { "at_ms": 300 },
        "on_complete": { "emit": "prompt_focused" }
      },
      {
        "id": "int_open_format",
        "target": "cmp_format_menu",
        "kind": "open_menu",
        "timing": { "delay": { "after": "prompt_focused", "offset_ms": 400 } },
        "on_complete": { "emit": "menu_open" }
      },
      {
        "id": "int_select_pdf",
        "target": "cmp_format_menu",
        "kind": "select_item",
        "params": { "index": 0 },
        "timing": { "delay": { "after": "menu_open", "offset_ms": 600 } }
      }
    ],
    "camera_behavior": {
      "mode": "ambient",
      "ambient": { "drift": 0.1 }
    }
  }
}
```

### 3. Result Stack Fan + Settle (Reactive Camera)

```json
{
  "scene_id": "sc_results_fan",
  "format_version": 3,
  "duration_s": 4,
  "camera": { "move": "static" },
  "layers": [],
  "semantic": {
    "components": [
      {
        "id": "cmp_results",
        "type": "result_stack",
        "role": "hero",
        "anchor": { "x": 0.5, "y": 0.5 },
        "props": { "items": ["Result A", "Result B", "Result C", "Result D"] }
      }
    ],
    "interactions": [
      {
        "id": "int_fan",
        "target": "cmp_results",
        "kind": "fan_stack",
        "timing": { "at_ms": 400 },
        "on_complete": { "emit": "fanned" }
      },
      {
        "id": "int_settle",
        "target": "cmp_results",
        "kind": "settle",
        "timing": { "delay": { "after": "fanned", "offset_ms": 300 } }
      }
    ],
    "camera_behavior": {
      "mode": "reactive",
      "push_in_on_focus": true
    }
  }
}
```

### 4. Full Search Flow (5+ Components, Interaction Chain)

```json
{
  "scene_id": "sc_search_flow",
  "format_version": 3,
  "duration_s": 8,
  "camera": { "move": "drift", "intensity": 0.1 },
  "layers": [],
  "semantic": {
    "components": [
      {
        "id": "cmp_search_bar",
        "type": "input_field",
        "role": "hero",
        "anchor": { "x": 0.5, "y": 0.15 },
        "props": { "placeholder": "Search..." }
      },
      {
        "id": "cmp_filters",
        "type": "chip_row",
        "role": "supporting",
        "anchor": { "x": 0.5, "y": 0.25 },
        "props": { "items": ["All", "Images", "Videos", "News"] }
      },
      {
        "id": "cmp_results",
        "type": "result_stack",
        "role": "hero",
        "anchor": { "x": 0.5, "y": 0.55 }
      },
      {
        "id": "cmp_sidebar",
        "type": "stacked_cards",
        "role": "supporting",
        "anchor": { "x": 0.85, "y": 0.5 }
      },
      {
        "id": "cmp_status",
        "type": "icon_label_row",
        "role": "background",
        "anchor": { "x": 0.5, "y": 0.92 },
        "props": { "label": "About 1,240,000 results" }
      }
    ],
    "interactions": [
      {
        "id": "int_type_query",
        "target": "cmp_search_bar",
        "kind": "type_text",
        "params": { "text": "design systems", "speed": 45 },
        "timing": { "at_ms": 300 },
        "on_complete": { "emit": "query_typed" }
      },
      {
        "id": "int_focus_search",
        "target": "cmp_search_bar",
        "kind": "focus",
        "timing": { "at_ms": 200 }
      },
      {
        "id": "int_insert_results",
        "target": "cmp_results",
        "kind": "insert_items",
        "params": { "items": ["Result 1", "Result 2", "Result 3", "Result 4", "Result 5"] },
        "timing": { "delay": { "after": "query_typed", "offset_ms": 400 } },
        "on_complete": { "emit": "results_loaded" }
      },
      {
        "id": "int_fan_sidebar",
        "target": "cmp_sidebar",
        "kind": "fan_stack",
        "timing": { "delay": { "after": "results_loaded", "offset_ms": 200 } },
        "on_complete": { "emit": "sidebar_fanned" }
      },
      {
        "id": "int_settle_sidebar",
        "target": "cmp_sidebar",
        "kind": "settle",
        "timing": { "delay": { "after": "sidebar_fanned", "offset_ms": 100 } }
      },
      {
        "id": "int_pulse_status",
        "target": "cmp_status",
        "kind": "pulse_focus",
        "params": { "count": 1 },
        "timing": { "delay": { "after": "results_loaded", "offset_ms": 300 } }
      }
    ],
    "camera_behavior": {
      "mode": "reactive",
      "push_in_on_focus": true
    },
    "art_direction": {
      "density": "balanced",
      "focus": "single",
      "motion_profile": "fluid",
      "readability_priority": true
    }
  }
}
```

### 5. Upload Zone + Stacked Cards (Dense Art Direction)

```json
{
  "scene_id": "sc_upload_cards",
  "format_version": 3,
  "duration_s": 5,
  "camera": { "move": "static" },
  "layers": [],
  "semantic": {
    "components": [
      {
        "id": "cmp_upload",
        "type": "upload_zone",
        "role": "hero",
        "anchor": { "x": 0.3, "y": 0.5 },
        "style_tokens": { "radius": "16px", "border": "2px dashed rgba(255,255,255,0.3)" }
      },
      {
        "id": "cmp_previews",
        "type": "stacked_cards",
        "role": "supporting",
        "anchor": { "x": 0.7, "y": 0.5 },
        "props": { "items": ["photo_1.jpg", "photo_2.jpg", "photo_3.jpg"] }
      }
    ],
    "interactions": [
      {
        "id": "int_focus_upload",
        "target": "cmp_upload",
        "kind": "focus",
        "timing": { "at_ms": 300 },
        "on_complete": { "emit": "upload_focused" }
      },
      {
        "id": "int_insert_previews",
        "target": "cmp_previews",
        "kind": "insert_items",
        "params": { "items": ["photo_1.jpg", "photo_2.jpg", "photo_3.jpg"] },
        "timing": { "delay": { "after": "upload_focused", "offset_ms": 800 } },
        "on_complete": { "emit": "previews_loaded" }
      },
      {
        "id": "int_fan_previews",
        "target": "cmp_previews",
        "kind": "fan_stack",
        "timing": { "delay": { "after": "previews_loaded", "offset_ms": 200 } },
        "on_complete": { "emit": "fanned" }
      },
      {
        "id": "int_settle_previews",
        "target": "cmp_previews",
        "kind": "settle",
        "timing": { "delay": { "after": "fanned", "offset_ms": 300 } }
      }
    ],
    "art_direction": {
      "density": "dense",
      "focus": "distributed",
      "motion_profile": "energetic"
    }
  }
}
```

### 6. Mixed v2 + v3 (Motion Block + Semantic Block Coexistence)

```json
{
  "scene_id": "sc_mixed_v2_v3",
  "format_version": 3,
  "duration_s": 5,
  "camera": { "move": "push_in", "intensity": 0.2 },
  "layers": [
    {
      "id": "bg_gradient",
      "type": "html",
      "src": "scenes/gradient-bg.html",
      "depth_class": "background"
    },
    {
      "id": "logo",
      "type": "image",
      "asset": "brand_logo",
      "depth_class": "foreground",
      "position": { "x": 60, "y": 40, "w": 200, "h": 80 }
    }
  ],
  "assets": [
    { "id": "brand_logo", "type": "image", "src": "assets/logo.png" }
  ],
  "motion": {
    "groups": [
      {
        "id": "logo_entrance",
        "targets": ["logo"],
        "primitive": "as-fadeIn",
        "effects": [
          { "type": "opacity", "from": 0, "to": 1, "duration_ms": 600 }
        ]
      }
    ]
  },
  "semantic": {
    "components": [
      {
        "id": "cmp_search",
        "type": "input_field",
        "role": "hero",
        "anchor": { "x": 0.5, "y": 0.5 },
        "props": { "placeholder": "Ask anything..." }
      }
    ],
    "interactions": [
      {
        "id": "int_type",
        "target": "cmp_search",
        "kind": "type_text",
        "params": { "text": "How does this work?", "speed": 50 },
        "timing": { "at_ms": 1000 }
      }
    ],
    "camera_behavior": {
      "mode": "ambient",
      "ambient": { "drift": 0.15, "breathe": 0.05 }
    }
  }
}
```

## Design Decisions

1. **Components compile to layers, not replace them.** A component either references an existing layer via `layer_ref` or auto-generates one at compile time. The `layers[]` array remains the rendering target for Remotion. This ensures v3 is additive — existing rendering infrastructure works unchanged.

2. **Interactions compile to v2 motion groups.** Same timing model (cues, `delay.after`, `at`/`at_ms`, `on_complete`). No new timing primitive. The compiler maps each interaction `kind` to appropriate effects, primitives, and group structures.

3. **Art direction is scene-level only.** Per-component visual variation uses `style_tokens` on individual components. Scene-level `art_direction` controls density, focus distribution, motion energy, and readability — these inform the compiler's layout and timing decisions.

4. **ID prefixes disambiguate namespaces.** Components use `cmp_*`, interactions use `int_*`. These are distinct from layer IDs (no prefix convention) and motion group IDs. Cross-references always know which namespace they're addressing.

5. **Validation boundary.** `validateScene()` checks structural correctness: required fields, enum values, ID patterns, cross-references (interaction targets → component IDs, component `layer_ref` → layer IDs). Semantic correctness — kind-type compatibility, personality constraints, timing feasibility — is deferred to the compiler (ANI-68).

6. **v2 + v3 coexistence.** A scene can have both `motion` and `semantic` blocks. The compiler processes `semantic` first, generates additional motion groups, then merges with any explicit `motion` groups. Explicit groups take precedence on conflict.

## MCP Tools

- `validate_manifest` — Extended for v3 `format_version` and `semantic` block
- `analyze_scene` — Will classify v3 components (ANI-68)
- `generate_scenes` — Will emit v3 scenes from briefs (ANI-68)
