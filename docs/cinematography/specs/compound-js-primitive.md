# Compound-JS Primitive Tier Spec

**Status:** Draft
**Issue:** TBD (motion-recipes follow-on)
**Version:** 0.1

## Overview

Animatic's primitive registry today has four sources — `engine`, `research`, `animate.style`, `breakdown` — all CSS-based. CSS keyframes can't express physics-driven choreography (per-frame computation, conditional phase machines, spring solvers, timeline orchestration across multiple targets). The existing `compound` source partially closes this gap with bespoke Remotion components (`catalog/compound/card-conveyor.json`), but every compound primitive built that way costs a custom React component plus physics code.

This spec defines a sub-type of `compound` that delegates motion to a **vetted external library** — GSAP for timelines, Framer Motion (`motion`) for React spring physics — so future compound primitives ship as configuration plus a tiny adapter rather than as new engine code.

The capture pipeline supports this tier as of the spike landed in `prototypes/2026-05-05-gsap-capture-adapter-spike/`. Determinism contract is documented below.

## Why this tier exists

The "card conveyor" reference (memory: `project_js_compound_animations.md`) proved CSS-only animations cannot express:

- requestAnimationFrame physics loops with per-frame Z-position math
- Non-linear speed ramps by depth
- DOM recycling driven by phase state machines
- Pick-pop micro-interactions with `easeOutBack` overshoot composed onto a running timeline

These are exactly what GSAP timelines and Framer Motion springs are designed for. Building each one as a custom Remotion component (the current `compound` route) is correct for the most ambitious cases but overkill for the long tail.

## Source taxonomy

```
source: "compound"
└─ flavor:
   ├─ "remotion-native"   # current — bespoke Remotion component (card-conveyor)
   └─ "library-driven"    # this spec — GSAP / Framer Motion via prototype HTML
```

`flavor` is a new optional field on compound entries. When omitted, it defaults to `"remotion-native"` to preserve existing entries.

## Approved libraries

| Library            | Use for                                              | Capture cost    |
|--------------------|------------------------------------------------------|-----------------|
| `gsap`             | Sequenced timelines, custom easings, stagger groups  | Adapter (auto)  |
| `motion` (FM)      | React component springs, layout transitions          | None            |

Excluded for now:

- **Lenis** — smooth-scroll utility. Animatic renders fixed-duration video; smooth scroll is irrelevant.
- **GSAP plugins** (ScrollTrigger, MotionPath, etc.) — most depend on real-time scroll, viewport, or pointer events. Re-evaluate per-plugin if a use case appears.

Adding a new library to this tier requires: (1) a determinism spike of the same shape as `prototypes/2026-05-05-gsap-capture-adapter-spike/`, (2) confirmation that animation logic is byte-stable across two captures (sub-perceptual variance from Chrome rasterization is acceptable), (3) documentation of any required adapter.

## Capture contract

A library-driven compound primitive **must** capture deterministically under `--deterministic` mode. The pipeline guarantees:

- `Date.now()`, `performance.now()`, `requestAnimationFrame`, `setTimeout`, `setInterval`, `Math.random` are patched to virtual time / seeded PRNG (`scripts/capture-prototype.mjs:213` — `VIRTUAL_TIME_SCRIPT`).
- CSS animations are paused via CDP and stepped per virtual frame.
- For GSAP, the adapter at `scripts/capture-prototype.mjs:294` (`GSAP_ADAPTER_SCRIPT`) disables `lagSmoothing` and uncaps `ticker.fps` so timeline progression follows virtual time.

A primitive **must not**:

- Read wall-clock time directly (e.g. `new Date().getTime()` outside `Date.now()`, which is patched, is fine — but `Date.parse(new Date().toString())` is not).
- Use `Math.random()` in animation paths and assume entropy across runs (it is seeded — same sequence each capture).
- Listen for real DOM events that the capture pipeline doesn't synthesize (scroll, pointermove, intersection observer entries triggered by user behavior).
- Load motion code from a CDN that is not present in `node_modules` or pinned by importmap. Boot is 600ms — slow CDNs miss the window and produce blank frames.

ESM/React prototypes whose `gsap` import is not on `window` **must** opt in once after import:

```js
import { gsap } from 'gsap';
window.__animaticSyncGsap?.(gsap);
```

The hook is a no-op outside capture mode.

## Schema additions

`catalog/compound/<slug>.json` entries gain optional fields. Existing entries remain valid.

```jsonc
{
  "name": "...",
  "slug": "...",
  "source": "compound",
  "flavor": "library-driven",          // new — defaults to "remotion-native"
  "library": {                          // new — required when flavor=library-driven
    "name": "gsap" | "motion",
    "version": "^3.12.0",               // semver range, must match package.json
    "import": "gsap"                    // ESM specifier prototypes will use
  },
  "capture_contract": {                 // new — required when flavor=library-driven
    "needs_adapter": true,              // GSAP yes, Framer Motion no
    "boot_ms": 600,                     // must render first frame within this window
    "real_time_dependencies": []        // explicit list, must be empty
  },
  "prototype_template": "...",          // new — path to a self-contained HTML prototype
                                        //       that /animate emits when this primitive is selected
  "category": "compound-entrance" | "compound-loop" | "compound-emphasis",
  "personality_affinity": [...],
  "config_schema": { ... },             // unchanged from existing compound spec
  "ai_guidance": "..."
}
```

## Validator hooks

Two checks live in the manifest validator (gates the **catalog entry** at load time):

1. **`flavor` consistency** — if `flavor === "library-driven"`, fields `library`, `capture_contract`, and `prototype_template` must be present.
2. **Library version pin** — `library.version` must satisfy a range present in the project's `package.json` (or a CDN URL pinned in the `prototype_template`).

A third check, **capture-contract-spike**, is recommended but not blocking: every library-driven primitive ships with a sibling `*.spike.html` that the existing capture pipeline can run as a smoke test. This is how new entries demonstrate they meet the determinism contract before being added to the registry. The two existing spike prototypes (`prototypes/2026-05-05-gsap-capture-adapter-spike/`, `prototypes/2026-05-05-framer-motion-capture-spike/`) are the templates.

## Critic hooks

The motion critic (`critiqueTimeline` in `mcp/lib/critic.js`) runs a separate set of checks that gate **scene usage** of these entries — distinct from the manifest validator above, which only checks the entry definition. When `critiqueTimeline` is called with `options.catalogs.primitives`, the following reactive-aware rules fire (ANI-146):

| Rule | Severity | Triggers when |
|---|---|---|
| `reactive_compound_unknown` | error | `motion.compound` references a slug not in the catalog |
| `reactive_personality_mismatch` | warning | scene personality is not in the primitive's `personality_affinity` |
| `reactive_unknown_config_key` | warning | a key in `motion.compound_config` isn't declared in `config_schema` |
| `reactive_boot_dominates_duration` | warning | `capture_contract.boot_ms` exceeds 25% of `scene.duration_s` |
| `lib_primitive_static_path` | error | a `flavor=library-driven` slug appears on `layer.entrance.primitive` or `motion.groups[].primitive` (must use `motion.compound` + `mode: 'reactive'` instead) |

These run regardless of whether the timeline is a static keyframe set or a reactive descriptor — the checks operate on `scene` and the catalog, not on the timeline shape. Without this layer, `lib-*` scenes silently auto-pass the critic with score 100 because they have no Level-2 representation for the static-track rules to inspect.

## How `/prototype` emits these

When a storyboard scene's intent maps to a library-driven compound primitive, `/prototype` emits HTML that:

1. Imports the library from `node_modules` (preferred) or a pinned esm.sh URL with `?deps=` to avoid dual-React issues (see Framer Motion spike for the exact form).
2. Calls `window.__animaticSyncGsap?.(gsap)` once after import if the library is GSAP.
3. Includes a `dwell:` annotation in the source for `capture-prototype.mjs` duration auto-detection.
4. Renders a `.scene` root so the capture pipeline can measure content height.

`/animate` does not need to enrich library-driven prototypes with extra motion — the library is the motion. Its job becomes selecting the right primitive, populating `config_schema` values, and validating the capture contract.

## How `/sizzle` handles these

Library-driven compound scenes route to `browser_capture` automatically (the existing `render-routing.js` heuristics already favor this for HTML-heavy layers). `assemble_video_sequence` composites the resulting plate with native Remotion scenes as it does today. No new render path is required.

## Resolved questions (ANI-145)

- **Personality fit**: kept per-entry `personality_affinity` rather than a per-flavor blacklist. Validator emits an advisory warning when an entry declares all four personalities — a near-certain over-claim, since each personality carries tone (overshoot for cinematic-dark, restraint for tutorial) the others reject.
- **Capture cost**: `resolveRenderTargets` summary now includes `library_driven` (count) and `estimated_capture_seconds` (rough budget — browser_capture and hybrid each cost ~8–10s; remotion_native ~1s). Surfaces budget pressure as the long tail grows without imposing a hard cap.
- **Plugin allowlist**: schema's `library.plugins[]` exists with `maxItems: 0`. Adding a plugin requires both a schema bump (controlled, reviewable change) and the per-plugin determinism spike documented above. The validator additionally inspects each `prototype_template` for known GSAP plugin imports (`gsap/ScrollTrigger`, `registerPlugin(MotionPathPlugin)`, etc.) and rejects any not declared on the entry. This is enforced today even though no plugins are allowed yet — the door is locked, not just closed.

## References

- Spike validating the GSAP adapter: `prototypes/2026-05-05-gsap-capture-adapter-spike/`
- Spike validating Framer Motion under virtual time: `prototypes/2026-05-05-framer-motion-capture-spike/`
- Adapter implementation: `scripts/capture-prototype.mjs` (`GSAP_ADAPTER_SCRIPT`)
- Existing compound primitive precedent: `catalog/compound/card-conveyor.json`
- Memory: `project_js_compound_animations.md` (origin of this tier)
