# Layout Templates

**Status:** Implemented
**Issue:** ANI-21

## Overview

Layout templates are reusable spatial arrangements for common sizzle reel patterns. Instead of manually calculating `position: { x, y, w, h }` for each layer, scenes declare a template name + config, and layers reference named **slots** that auto-resolve to pixel positions.

Layout templates are **not animations** — they are spatial arrangements. Any layer type (video, image, text, html) works in any slot.

## How It Works

1. Scene declares `layout: { template, config }` at the scene level
2. Layers reference slots via `slot: "slotName"` instead of `position`
3. `resolveLayoutSlots()` in `lib.js` computes slot positions as `{ x, y, w, h }` pixel values
4. SceneComposition merges resolved positions into layers before rendering
5. `slot` overrides `position` if both present; layers without `slot` are unaffected

```json
{
  "scene_id": "sc_example",
  "layout": {
    "template": "split-panel",
    "config": { "ratio": 0.55, "gap": 20 }
  },
  "layers": [
    { "id": "left", "type": "video", "slot": "left" },
    { "id": "right", "type": "text", "slot": "right", "content": "PRODUCT" }
  ]
}
```

## Templates

### hero-center

Centered content with padding. Use for logo reveals, brand marks, hero type.

**Slots:** `background`, `center`

**Config:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `padding` | number | `0.1` | Padding as fraction of canvas (each side) |
| `maxWidth` | number | `1` | Max center width as fraction of canvas |
| `maxHeight` | number | `1` | Max center height as fraction of canvas |

```
+----------------------------------+
|           background             |
|   +------------------------+    |
|   |                        |    |
|   |        center          |    |
|   |                        |    |
|   +------------------------+    |
|                                  |
+----------------------------------+
```

### split-panel

Two panels side by side. Use for before/after, content + photo, comparison.

**Slots:** `background`, `left`, `right`

**Config:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ratio` | number | `0.5` | Left panel width as fraction of canvas |
| `gap` | number | `0` | Gap between panels in pixels |

```
+---------------+--+---------------+
|               |  |               |
|     left      |gap|    right     |
|               |  |               |
+---------------+--+---------------+
```

### masonry-grid

Grid of cells in row-major order. Use for moodboards, portfolios, multi-image layouts.

**Slots:** `background`, `cell-0` through `cell-N` (where N = columns * rows - 1)

**Config:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `columns` | number | `3` | Number of columns |
| `rows` | number | `2` | Number of rows |
| `gap` | number | `10` | Gap between cells in pixels |

```
+--------+--+--------+--+--------+
| cell-0 |  | cell-1 |  | cell-2 |
+--------+--+--------+--+--------+
|  gap   |  |  gap   |  |  gap   |
+--------+--+--------+--+--------+
| cell-3 |  | cell-4 |  | cell-5 |
+--------+--+--------+--+--------+
```

### full-bleed

Fullscreen media with positioned overlay. Use for hero videos, title cards, cinematic shots.

**Slots:** `media`, `overlay`

**Config:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `overlayPosition` | string | `'bottom-left'` | Overlay anchor position |
| `overlayPadding` | number | `0.05` | Padding from edge as fraction of canvas |
| `overlayWidth` | number | `0.45` | Overlay width as fraction of canvas |
| `overlayHeight` | number | `0.3` | Overlay height as fraction of canvas |

**Overlay positions:** `top-left`, `top-center`, `top-right`, `center`, `bottom-left`, `bottom-center`, `bottom-right`

```
+----------------------------------+
|                                  |
|            media                 |
|                                  |
|  +----------+                    |
|  | overlay  |                    |
|  +----------+                    |
+----------------------------------+
```

### device-mockup

Content panel + device panel with padding. Use for dashboard demos, app screenshots, product UI.

**Slots:** `background`, `content`, `device`

**Config:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ratio` | number | `0.55` | Content panel width as fraction of canvas |
| `deviceSide` | string | `'right'` | Which side the device is on (`'left'` or `'right'`) |
| `devicePadding` | number | `0.05` | Device inset padding as fraction of device panel |

```
+------------------+--+-----------+
|                  |  |  padding  |
|                  |  | +-------+ |
|     content      |  | | device| |
|                  |  | +-------+ |
|                  |  |  padding  |
+------------------+--+-----------+
```

## Validation

The pipeline validates layout at scene validation time:

- `layout.template` must be one of the 5 template names
- Layer `slot` references are checked against `getAvailableSlots()` for the template
- Invalid slots produce validation errors with the list of valid slot names

## API

### `resolveLayoutSlots(layout, canvasW, canvasH)`

Resolves a layout declaration to pixel positions.

- **Input:** `{ template: string, config?: object }`, canvas dimensions
- **Output:** `{ [slotName]: { x, y, w, h } }` or `null` if no valid template

### `getAvailableSlots(template, config)`

Returns valid slot names for a template.

- **Input:** template name, optional config (needed for masonry-grid cell count)
- **Output:** `string[]`

## Files

| File | Role |
|------|------|
| `src/remotion/lib.js` | Layout math: `resolveLayoutSlots`, `getAvailableSlots`, 5 internal resolvers |
| `src/remotion/compositions/SceneComposition.jsx` | Resolves slots before rendering |
| `src/remotion/manifests/test-layouts.json` | Test manifest with all 5 templates |
| `src/remotion/test/remotion.test.js` | 37 layout tests |
| `docs/cinematography/specs/scene-format.md` | Schema: `layout` + `slot` definitions |
