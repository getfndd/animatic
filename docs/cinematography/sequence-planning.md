# Sequence Planning

**Status:** Implemented
**Issues:** ANI-23 (initial), ANI-24 (catalog-driven), ANI-30 (advanced packs + per-scene blending)
**Version:** 1.2 (8 style packs, per-scene style blending)

## Overview

The sequence planner automates editorial decisions for assembling a sequence manifest. Given analyzed scenes (with metadata from ANI-22) and a style pack, it determines shot order, hold durations, transitions, and camera overrides.

Rule-based v1 — deterministic, testable, no LLM calls. Style pack definitions are loaded from `catalog/style-packs.json` and interpreted by generic rule engines. Camera overrides are validated against the personality catalog. Per-scene style blending allows individual scenes to override the sequence-level style via `metadata.style_override`.

## Architecture

```
catalog/style-packs.json ──▶ loadStylePacks()
catalog/personalities.json ──▶ loadPersonalitiesCatalog()
                                    │
                                    ▼
scenes[] + style ──▶ planSequence()
                          │
                    ┌─────┼──────┬──────────────┐
                    ▼     ▼      ▼              ▼
              orderScenes  assignDurations  selectTransitions  assignCameraOverrides
                    │     │      │              │
                    │     │  interpretTransition interpretCamera
                    │     │  Rules()            Rules()
                    │     │      │              │
                    │     │      │         validateCameraMove()
                    │     │      │              │
                    └─────┼──────┴──────────────┘
                          ▼
                     manifest + notes
```

**Module:** `mcp/lib/planner.js` — pure functions, no MCP or React dependencies. Loads catalog data at module level.

**MCP tools:**
- `plan_sequence` — accepts `scenes` array + `style` string, returns markdown with shot list, transitions, manifest JSON, and editorial notes.
- `get_style_pack` — returns full style pack definition with hold durations, transition rules, camera rules, and personality constraints.

## Style Packs

Style packs are defined in `catalog/style-packs.json`. Each pack maps to an animation personality and defines hold durations, transition rules, and camera override rules as data.

| Style | Personality | Tempo | Transitions | Camera | Use Case |
|-------|------------|-------|-------------|--------|----------|
| prestige | editorial | Longer holds (2.5–3.5s) | Hard cuts default, crossfade on weight change or emotional/hero | Selective push_in/drift by content_type | Product showcases |
| energy | montage | Short holds (1.5–2.0s), 4s cap | Hard cuts (70%) + whip-wipes every 3rd (30%) | Always static | Sizzle reels |
| dramatic | cinematic-dark | Variable holds (2.5–3.5s) | Crossfade default, hard cut for same-weight | push_in for emotional/hero, drift for detail | Marketing, drama |
| minimal | neutral-light | Uniform holds (3.0–4.0s) | Hard cuts only | Always static | Tutorials, docs |
| intimate | cinematic-dark | Longer holds (3.0–4.0s) | Crossfade 800ms emotional, 500ms default | push_in 0.15 portrait/product, drift detail | Brand narratives |
| corporate | editorial | Uniform holds (2.5–3.0s) | Crossfade 300ms on weight change, hard cut default | push_in product, drift UI | Enterprise demos |
| kinetic | montage | Very short (1.0–1.5s), 3s cap | Whip every 2nd (200ms), hard cut default | Always static | Keynotes, launches |
| fade | editorial | Medium holds (2.0–3.0s) | All crossfade 500ms | push_in 0.1 portrait/product only | Photo essays |

### Style Pack Schema

```json
{
  "name": "string",
  "personality": "personality-slug",
  "description": "string",
  "hold_durations": {
    "static": 3.5,
    "subtle": 3.0,
    "moderate": 3.0,
    "high": 2.5
  },
  "max_hold_duration": null,
  "transitions": { /* rule object */ },
  "camera_overrides": { /* rule object */ }
}
```

### Transition Rule Types

Evaluated in priority order:

1. **`pattern`** — Positional (e.g., energy's every-3rd whip-wipe cycle)
2. **`on_same_weight`** — Fires when consecutive scenes have same `visual_weight` (dramatic's hard_cut)
3. **`on_weight_change`** — Fires when `visual_weight` differs (prestige's crossfade)
4. **`on_intent`** — Matches incoming scene's `intent_tags` (prestige/dramatic emotional crossfade)
5. **`default`** — Fallback

**Critical priority behavior:** `on_same_weight` fires before `on_intent`. This means dramatic's same-weight hard_cut beats its emotional crossfade. Prestige has no `on_same_weight` rule, so its emotional crossfade fires correctly for same-weight scenes.

### Camera Override Rule Types

1. **`force_static`** — All scenes get `{ move: 'static' }` (energy/montage)
2. **`by_content_type`** — Maps `content_type` → camera move (prestige)
3. **`by_intent`** — Maps intent tag → camera move (dramatic)

Camera overrides are validated against the personality's `allowed_movements`. Moves not allowed by the personality are downgraded to null. `drift` and `static` bypass validation (ambient motion / no-op).

## Planning Stages

### 1. Shot Order (`orderScenes`)

Intent-bucket approach with variety post-processing.

**Bucketing:** Each scene is placed into a bucket by its highest-priority intent tag. Priority order: `closing > opening > hero > emotional > detail > informational > transition > untagged`.

**Assembly:**
1. Opening scenes first
2. Hero scenes second
3. Middle: interleave detail/informational/transition/untagged, distributing emotional scenes at even intervals
4. Closing scenes last

**Post-processing:**
- **Variety rule:** No consecutive same `content_type` — swap with next different type (look-ahead up to 3)
- **Weight alternation:** No 3+ consecutive same `visual_weight` — swap to break run
- **Energy arc:** Don't start at peak energy unless tagged `hero`/`opening`

### 2. Durations (`assignDurations`)

Reads `hold_durations` from the style pack (resolved per scene when using style blending). If `max_hold_duration` is set, enforces it as a hard cap.

| motion_energy | prestige | energy | dramatic | minimal | intimate | corporate | kinetic | fade |
|--------------|----------|--------|----------|---------|----------|-----------|---------|------|
| static | 3.5s | 2.0s | 3.0s | 4.0s | 4.0s | 3.0s | 1.5s | 3.0s |
| subtle | 3.0s | 2.0s | 2.5s | 3.5s | 3.5s | 2.75s | 1.5s | 2.5s |
| moderate | 3.0s | 1.5s | 3.0s | 3.0s | 3.0s | 2.5s | 1.0s | 2.0s |
| high | 2.5s | 1.5s | 3.5s | 3.0s | 3.0s | 2.5s | 1.0s | 2.0s |

Hard caps: energy 4.0s, kinetic 3.0s.

### 3. Transitions (`selectTransitions`)

First scene always gets `null` (no `transition_in` per spec). Subsequent scenes evaluated through `interpretTransitionRules()` using the style pack's `transitions` object (resolved per scene when using style blending).

**Prestige:** Hard cut default. Crossfade (400ms) when `visual_weight` changes between scenes OR incoming scene has `emotional`/`hero` intent.

**Energy:** Deterministic mix — every 3rd transition is a whip-wipe (cycling `whip_left/right/up/down`), rest are hard cuts. Keeps whips at ~30%.

**Dramatic:** Crossfade (400ms) default. Hard cut between consecutive same-weight scenes. 600ms crossfade when incoming scene has `emotional` intent.

**Minimal:** Hard cuts only. Zero embellishment.

**Intimate:** Crossfade 500ms default. 800ms crossfade for `emotional` intent. Slow, deliberate.

**Corporate:** Hard cut default. Crossfade 300ms on weight change. Clean transitions.

**Kinetic:** Every 2nd transition is a whip-wipe (cycling `whip_left/right`, 200ms), rest are hard cuts. 50% whip rate.

**Fade:** All crossfade 500ms. Every transition blends softly.

### 4. Camera Overrides (`assignCameraOverrides`)

Evaluated through `interpretCameraRules()` using the style pack's `camera_overrides` object (resolved per scene), then validated against personality.

**Prestige:** `portrait`/`product_shot` -> push_in 0.2. `ui_screenshot`/`device_mockup`/`data_visualization` -> drift 0.2. `typography`/`brand_mark` -> no override.

**Energy:** Every scene gets `{ move: 'static' }` (montage forbids camera movement).

**Dramatic:** `emotional`/`hero` intent -> push_in 0.3. `detail` intent -> drift 0.3. `brand_mark`/`typography` -> no override.

**Minimal:** Every scene gets `{ move: 'static' }`.

**Intimate:** `portrait`/`product_shot` -> push_in 0.15. `detail` intent -> drift 0.15. Others -> no override.

**Corporate:** `product_shot` -> push_in 0.15. `ui_screenshot` -> drift 0.15. Others -> no override.

**Kinetic:** Every scene gets `{ move: 'static' }` (montage forbids camera movement).

**Fade:** `portrait`/`product_shot` -> push_in 0.1. Others -> no override.

## MCP Tool Usage

### `plan_sequence`

**Input:**
```json
{
  "scenes": [
    { "scene_id": "sc_brand_mark", "metadata": { "content_type": "brand_mark", "visual_weight": "light", "motion_energy": "subtle", "intent_tags": ["hero", "opening"] } },
    { "scene_id": "sc_product_ui", "metadata": { "content_type": "ui_screenshot", "visual_weight": "dark", "motion_energy": "moderate", "intent_tags": ["detail"] } }
  ],
  "style": "prestige"
}
```

**Output:** Markdown with shot list table, transition summary, ordering rationale, and full manifest JSON block.

### `get_style_pack`

**Input:**
```json
{ "name": "prestige" }
```

**Output:** Markdown with hold durations table, transition rules (priority-ordered), camera override rules, personality camera constraints, and raw JSON definition.

### Workflow

1. Prepare scene JSON files with the scene-format spec
2. Run `analyze_scene` on each to generate metadata
3. Use `get_style_pack` to understand style pack rules
4. Pass analyzed scenes + style to `plan_sequence`
5. Review the manifest and adjust as needed

## API Reference

### `planSequence({ scenes, style, sequence_id? })`

**Parameters:**
- `scenes` — Array of scene objects with `metadata` containing `content_type`, `visual_weight`, `motion_energy`, `intent_tags`. Optional: `metadata.style_override` for per-scene style blending.
- `style` — Default style pack. One of: `'prestige'`, `'energy'`, `'dramatic'`, `'minimal'`, `'intimate'`, `'corporate'`, `'kinetic'`, `'fade'`
- `sequence_id` — Optional. Defaults to `seq_planned_{timestamp}`

**Returns:**
```js
{
  manifest: {
    sequence_id: string,
    resolution: { w: 1920, h: 1080 },
    fps: 60,
    style: string,
    scenes: Array<{
      scene: string,
      duration_s: number,
      transition_in?: { type: string, duration_ms?: number },
      camera_override?: { move: string, intensity?: number }
    }>
  },
  notes: {
    total_duration_s: number,
    scene_count: number,
    style_personality: string,
    ordering_rationale: string,
    transition_summary: { [type: string]: number },
    style_overrides_used?: string[]  // only present when scenes use style_override
  }
}
```

### Exported Constants

Derived from `catalog/style-packs.json` at module load:

- `STYLE_PACKS` — `['prestige', 'energy', 'dramatic', 'minimal', 'intimate', 'corporate', 'kinetic', 'fade']`
- `STYLE_TO_PERSONALITY` — Maps style names to personality slugs

### Individual Stage Functions

All exported for testing and direct use:

- `orderScenes(scenes)` — Returns ordered copy of scenes array
- `assignDurations(orderedScenes, style)` — Returns array of duration_s values
- `selectTransitions(orderedScenes, style)` — Returns array of transition_in objects (or null)
- `assignCameraOverrides(orderedScenes, style)` — Returns array of camera_override objects (or null)

## Style Differentiation

Same 4 kinetic-type scenes, 3 styles produce measurably different manifests:

| Metric | prestige | energy | dramatic |
|--------|----------|--------|----------|
| Avg duration | ~3.0s | ~1.7s | ~3.0s |
| Dominant transition | hard_cut + crossfade | hard_cut + whips | crossfade |
| Camera overrides | selective | all static | selective |
| Total duration | ~11s | ~6s | ~10s |

## Per-Scene Style Blending (ANI-30)

A single sequence can mix styles by setting `metadata.style_override` on individual scenes. The override affects that scene's durations, transitions, and camera — while the rest of the sequence uses the default style.

### How It Works

Each scene is resolved via `resolveScenePack(scene, defaultStyle)`:
1. If `scene.metadata.style_override` is set and valid, use that pack
2. Otherwise, use the sequence-level default

The incoming scene's style pack governs its `transition_in`. Camera overrides are validated against the per-scene personality.

### Example

```json
{
  "scenes": [
    { "scene_id": "sc_intro", "metadata": { "content_type": "typography", "style_override": "minimal" } },
    { "scene_id": "sc_hero", "metadata": { "content_type": "product_shot" } },
    { "scene_id": "sc_closing", "metadata": { "content_type": "brand_mark", "style_override": "fade" } }
  ],
  "style": "prestige"
}
```

- `sc_intro` uses **minimal** (hard cut, static camera, longer hold)
- `sc_hero` uses **prestige** (sequence default)
- `sc_closing` uses **fade** (crossfade 500ms, minimal camera)

### Behavior

- `style_override` travels with the scene through `orderScenes()` reordering
- Unknown `style_override` throws in planner, falls back silently in evaluator
- When overrides are used, `notes.style_overrides_used` lists the unique override names
- No `style_override` = identical behavior to single-style planning (fully backward-compatible)

### Evaluator

The evaluator also resolves per-scene packs. Each scene is scored against its effective style pack for expected durations, transitions, and camera. The loop_time check uses the sequence-level personality.

## Adding New Style Packs

To add a new style pack:

1. Add a new entry to `catalog/style-packs.json` with the required fields
2. Set `personality` to a valid slug from `catalog/personalities.json`
3. Define `hold_durations`, `transitions`, and `camera_overrides` using the rule types above
4. The planner automatically picks it up — no code changes needed
5. Add tests to verify the new pack's behavior
