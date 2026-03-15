# Interaction DSL

**Status:** Draft
**Issue:** ANI-67
**Version:** 1.0

## Overview

The Interaction DSL defines 9 named interaction kinds that describe *what happens* to semantic components during a scene. Each kind compiles to v2 motion group effects — the same timing model (cues, stagger, effects) powers both layers.

Interactions live inside `semantic.interactions[]` in a v3 scene. See [semantic-scene-format.md](semantic-scene-format.md) for the full schema.

## Interaction Kinds

### `focus`

Draws attention to a component. Compiles to an opacity/scale pulse on the target with sibling dimming.

| Field | Value |
|-------|-------|
| **Target Types** | any |
| **Default Duration** | 300ms |
| **Compiles To** | opacity/scale pulse on target, opacity dim on siblings |

**Params:** none required.

```json
{
  "id": "int_focus_search",
  "target": "cmp_search",
  "kind": "focus"
}
```

### `type_text`

Simulates typing into a text-accepting component. Compiles to a `text_chars` effect with caret opacity animation.

| Field | Value |
|-------|-------|
| **Target Types** | `input_field`, `prompt_card` |
| **Default Duration** | 50ms per character |
| **Compiles To** | text_chars effect + caret opacity |

**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to type |
| `speed` | number | No | ms per character (default: 50) |

```json
{
  "id": "int_type",
  "target": "cmp_input",
  "kind": "type_text",
  "params": { "text": "hello world", "speed": 45 }
}
```

### `replace_text`

Swaps displayed text with a crossfade or slide transition.

| Field | Value |
|-------|-------|
| **Target Types** | `input_field`, `prompt_card` |
| **Default Duration** | 400ms |
| **Compiles To** | crossfade/slide text transition |

**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Replacement text |
| `transition` | string | No | `crossfade` or `slide` (default: `crossfade`) |

```json
{
  "id": "int_replace",
  "target": "cmp_prompt",
  "kind": "replace_text",
  "params": { "text": "Updated prompt", "transition": "slide" }
}
```

### `open_menu`

Expands a dropdown menu. Compiles to height/opacity animation.

| Field | Value |
|-------|-------|
| **Target Types** | `dropdown_menu` |
| **Default Duration** | 300ms |
| **Compiles To** | height/opacity expand |

**Params:** none required.

```json
{
  "id": "int_open",
  "target": "cmp_menu",
  "kind": "open_menu"
}
```

### `select_item`

Highlights and selects an item from an open dropdown. Compiles to highlight animation + menu close.

| Field | Value |
|-------|-------|
| **Target Types** | `dropdown_menu` |
| **Default Duration** | 200ms |
| **Compiles To** | highlight + close animation |

**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `index` | number | Yes | Zero-based item index |

```json
{
  "id": "int_select",
  "target": "cmp_menu",
  "kind": "select_item",
  "params": { "index": 2 }
}
```

### `insert_items`

Adds items to a list-like component with staggered entrance. Compiles to translateY + opacity per item.

| Field | Value |
|-------|-------|
| **Target Types** | `result_stack`, `chip_row` |
| **Default Duration** | 120ms stagger per item |
| **Compiles To** | translateY + opacity per item (staggered) |

**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array | Yes | Items to insert |
| `stagger_ms` | number | No | Stagger interval (default: 120) |

```json
{
  "id": "int_results",
  "target": "cmp_stack",
  "kind": "insert_items",
  "params": { "items": ["A", "B", "C"], "stagger_ms": 100 }
}
```

### `fan_stack`

Fans stacked cards outward from their stack position. Compiles to rotate/translate animations.

| Field | Value |
|-------|-------|
| **Target Types** | `stacked_cards` |
| **Default Duration** | 600ms |
| **Compiles To** | rotate/translate fan |

**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `spread` | number | No | Fan angle in degrees (default: 15) |

```json
{
  "id": "int_fan",
  "target": "cmp_cards",
  "kind": "fan_stack",
  "params": { "spread": 20 }
}
```

### `settle`

Brings fanned or displaced elements to their final resting position. Uses spring or ease-out physics.

| Field | Value |
|-------|-------|
| **Target Types** | `stacked_cards`, `result_stack` |
| **Default Duration** | 400ms |
| **Compiles To** | spring/ease_out to final position |

**Params:** none required.

```json
{
  "id": "int_settle",
  "target": "cmp_cards",
  "kind": "settle"
}
```

### `pulse_focus`

Rhythmic scale oscillation to draw attention. Repeats `count` times.

| Field | Value |
|-------|-------|
| **Target Types** | any |
| **Default Duration** | 200ms × count |
| **Compiles To** | scale oscillation |

**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `count` | number | No | Number of pulses (default: 2) |
| `intensity` | number | No | Scale factor (default: 1.05) |

```json
{
  "id": "int_pulse",
  "target": "cmp_badge",
  "kind": "pulse_focus",
  "params": { "count": 3, "intensity": 1.08 }
}
```

## Summary Table

| Kind | Target Types | Default Duration | Compiles To |
|------|-------------|-----------------|-------------|
| `focus` | any | 300ms | opacity/scale pulse, sibling dim |
| `type_text` | input_field, prompt_card | 50ms/char | text_chars effect + caret opacity |
| `replace_text` | input_field, prompt_card | 400ms | crossfade/slide text transition |
| `open_menu` | dropdown_menu | 300ms | height/opacity expand |
| `select_item` | dropdown_menu | 200ms | highlight + close |
| `insert_items` | result_stack, chip_row | 120ms stagger | translateY + opacity per item |
| `fan_stack` | stacked_cards | 600ms | rotate/translate fan |
| `settle` | stacked_cards, result_stack | 400ms | spring/ease_out to final pos |
| `pulse_focus` | any | 200ms × count | scale oscillation |

## Personality Constraints

Each personality may restrict or modify interaction behavior:

| Personality | Constraints |
|-------------|-------------|
| **cinematic-dark** | All kinds allowed. `fan_stack` uses spring physics. `type_text` may add blur entrance on caret. |
| **editorial** | No spring physics on `settle` — use `ease_out` only. `fan_stack` uses restrained angles (≤ 10°). `focus` dims siblings to 0.4 opacity (not 0.2). |
| **neutral-light** | No `fan_stack` — stacked_cards use simple slide. `focus` uses spotlight highlight instead of dim. `pulse_focus` limited to 1 pulse. |
| **montage** | No ambient interactions. All interactions must complete within hard cuts. `insert_items` uses simultaneous entrance (0ms stagger). |

## Timing Defaults

Interactions use the same timing model as v2 motion groups:

- **`at`** — Proportional scene time (0–1). `at: 0.5` fires at the midpoint.
- **`at_ms`** — Absolute time in milliseconds from scene start.
- **`delay.after`** — Waits for a named cue. Combined with `offset_ms` for sequencing.
- **`on_complete.emit`** — Fires a cue when the interaction finishes.
- **Implicit cues:** `scene_start` and `scene_end` are always available.

When no timing is specified, the interaction fires at `scene_start`.

## Sequence Examples

### Search → Results → Focus

```json
[
  {
    "id": "int_type_query",
    "target": "cmp_search",
    "kind": "type_text",
    "params": { "text": "design tokens" },
    "timing": { "at_ms": 300 },
    "on_complete": { "emit": "typed" }
  },
  {
    "id": "int_load_results",
    "target": "cmp_results",
    "kind": "insert_items",
    "params": { "items": ["Token library", "Design system guide", "Color tokens"] },
    "timing": { "delay": { "after": "typed", "offset_ms": 500 } },
    "on_complete": { "emit": "loaded" }
  },
  {
    "id": "int_highlight_first",
    "target": "cmp_results",
    "kind": "focus",
    "timing": { "delay": { "after": "loaded", "offset_ms": 300 } }
  }
]
```

### Menu Open → Select → Confirm

```json
[
  {
    "id": "int_open",
    "target": "cmp_dropdown",
    "kind": "open_menu",
    "timing": { "at_ms": 500 },
    "on_complete": { "emit": "opened" }
  },
  {
    "id": "int_select",
    "target": "cmp_dropdown",
    "kind": "select_item",
    "params": { "index": 1 },
    "timing": { "delay": { "after": "opened", "offset_ms": 600 } },
    "on_complete": { "emit": "selected" }
  },
  {
    "id": "int_confirm_pulse",
    "target": "cmp_dropdown",
    "kind": "pulse_focus",
    "params": { "count": 1 },
    "timing": { "delay": { "after": "selected", "offset_ms": 200 } }
  }
]
```

### Card Fan → Settle → Focus

```json
[
  {
    "id": "int_fan",
    "target": "cmp_cards",
    "kind": "fan_stack",
    "timing": { "at_ms": 400 },
    "on_complete": { "emit": "fanned" }
  },
  {
    "id": "int_settle",
    "target": "cmp_cards",
    "kind": "settle",
    "timing": { "delay": { "after": "fanned", "offset_ms": 200 } },
    "on_complete": { "emit": "settled" }
  },
  {
    "id": "int_highlight",
    "target": "cmp_cards",
    "kind": "focus",
    "timing": { "delay": { "after": "settled", "offset_ms": 300 } }
  }
]
```
