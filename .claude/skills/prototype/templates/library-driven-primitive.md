# Library-Driven Primitive Emission

When a storyboard scene maps to a `flavor: "library-driven"` compound primitive (see `catalog/compound/lib-*.json`), the emitted HTML prototype must satisfy the capture contract documented in `docs/cinematography/specs/compound-js-primitive.md`. This file is the recipe.

## Source of truth

Always start by reading the primitive's `prototype_template` field. The file at that path is the canonical reference and already meets the contract — copying its structure is faster and safer than rebuilding from scratch. Replace the choreography inside, keep the wrapper.

## The four invariants

Every emitted prototype must:

1. **Declare a `dwell` annotation in source.** `capture-prototype.mjs` parses `dwell: NNNN` to auto-detect duration. Without it, the capture defaults to 15s and your scene runs for the wrong duration.
2. **Render a `.scene` root element.** The capture pipeline measures content height by querying `.scene` (falling back to `body`). A missing `.scene` makes viewport sizing unreliable.
3. **Boot within 600ms.** Real-wall-clock — ESM imports, font loads, library evaluation. Slow CDNs miss the boot window and produce blank frames.
4. **Have no real-time dependencies** (scroll, pointer, IntersectionObserver triggered by user behavior). The capture pipeline does not synthesize these.

## GSAP prototypes

Reference: `catalog/compound/templates/lib-gsap-spring-stagger.html`.

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
```

GSAP loaded as a global (via the CDN script tag above) auto-attaches to the capture adapter — no extra code needed. The adapter at `scripts/capture-prototype.mjs` (`GSAP_ADAPTER_SCRIPT`) detects `window.gsap` and disables `lagSmoothing`.

If you import GSAP via an ESM bundler instead, add one line after the import:

```js
import { gsap } from 'gsap';
window.__animaticSyncGsap?.(gsap);  // no-op outside capture mode
```

Without that hook, the adapter cannot reach the GSAP instance and lagSmoothing stays on, decoupling timeline progress from virtual time.

## Framer Motion prototypes

Reference: `catalog/compound/templates/lib-framer-spring-stagger.html`.

Framer Motion needs **no adapter** — it rides on `requestAnimationFrame` and `performance.now()`, both already patched by virtual time. The work for Framer Motion prototypes is in the importmap, not the runtime.

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19.0.0",
    "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
    "react-dom/client": "https://esm.sh/react-dom@19.0.0/client?deps=react@19.0.0",
    "motion/react": "https://esm.sh/motion@12.0.0/react?deps=react@19.0.0,react-dom@19.0.0&external=react,react-dom"
  }
}
</script>
```

The `?deps=react@19.0.0` query parameter is **required** on every dependent package — without it, esm.sh ships a second copy of React and `useContext` fails with "Cannot read properties of null". This was discovered during the ANI-143 spike; see memory `reference_framer_motion_esm_dual_react.md`.

## What not to do

- **Do not load motion libraries in `<script type="module">` without an importmap.** Bare specifiers (`import { gsap } from 'gsap'`) only resolve via importmap or a bundler.
- **Do not use `setInterval` for animation timing.** Although the capture pipeline patches `setInterval` to virtual time, animation libraries already drive themselves on rAF; competing timers fight the library scheduler.
- **Do not use real-time-only browser APIs.** No `IntersectionObserver` triggered by user scroll, no `pointermove`, no `requestIdleCallback`-as-animation-trigger.
- **Do not assume the prototype runs in a specific tab/window context.** Capture mounts in a headless Chromium with no user input.

## Testing the contract

After emitting, run:

```bash
node scripts/capture-prototype.mjs <path-to-prototype>.html --deterministic --format mp4 --width 800
```

If the resulting MP4 is blank or near-blank for the first half-second after boot, the prototype is missing something — typically: imports loading too slowly, no `.scene` root, or no `dwell` annotation so duration was wrong.

For determinism testing, capture twice and compare. Sub-perceptual byte differences (YMAX ≤ 5/255) are normal Chrome compositor noise, not prototype bugs. See memory `reference_capture_determinism_bounds.md`.
