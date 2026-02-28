# Tutorial Primitives

Composable animation primitives for onboarding tutorials, help documentation, and guided walkthroughs. These are building blocks, not a standalone personality — compose them with any engine (typically editorial or neutral-light).

## Primitives

| Primitive | Function | Purpose |
|-----------|----------|---------|
| **Spotlight** | `spotlight(engine, selector, duration)` | Dim overlay with cutout highlighting a target element |
| **Cursor** | `cursorTo(engine, x, y, opts)` | Simulated cursor movement to target coordinates with optional click |
| **Tooltip** | `tooltip(engine, anchor, text, position, duration)` | Positioned callout box near an anchor element |
| **Step Progress** | `stepProgress(engine, stepNumber)` | Update numbered step indicators (mark done, advance next) |

## Usage

### JavaScript

Each function takes the engine instance as its first argument. The engine must provide `$()`, `$$()`, `pushTimer()`, and `sel` (selector map).

```javascript
import { spotlight, cursorTo, tooltip, stepProgress } from './tutorial-primitives.js';

// In your engine or phase callbacks:
onPhaseEnter: {
  1: (engine) => {
    spotlight(engine, '.action-area', 2000);
    cursorTo(engine, 320, 200, { click: true });
  },
  2: (engine) => tooltip(engine, '.upload-btn', 'Click to upload', 'below', 2000),
  3: (engine) => stepProgress(engine, 0),
}
```

### CSS

Import `tutorial.css` alongside your personality's motion.css:

```html
<link rel="stylesheet" href="personalities/editorial/motion.css">
<link rel="stylesheet" href="primitives/tutorial/tutorial.css">
```

Tutorial CSS references personality tokens with fallback values (e.g. `var(--nl-accent, #3b82f6)`), so it works with any personality's color system.

### Required HTML Elements

- `#spotlight-overlay > .spotlight-cutout` — spotlight overlay with positioned cutout
- `#tutorial-cursor` — SVG cursor element for simulation
- `.tutorial-tooltip > .tutorial-tooltip-text` + `.tutorial-tooltip-arrow` — tooltip
- `.step-indicator-dot`, `.step-indicator-label`, `.step-indicator-connector` — step progress

## Integration with NeutralLightEngine

The `NeutralLightEngine` provides engine-bound versions of the same logic:

```javascript
// engine.js has equivalent methods with identical logic:
engine.runSpotlight(sel, dur)    // same as spotlight(engine, sel, dur)
engine.runCursorTo(x, y, opts)   // same as cursorTo(engine, x, y, opts)
engine.runTooltip(anchor, ...)   // same as tooltip(engine, anchor, ...)
engine.runStepProgress(step)     // same as stepProgress(engine, step)
```

Existing autoplay files using `NeutralLightEngine` methods continue to work unchanged. The standalone functions here enable composition with other engines without depending on `NeutralLightEngine`.
