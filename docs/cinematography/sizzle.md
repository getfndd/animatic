# Sizzle CLI — Scenes Folder + Style → Rendered Video

**ANI-25** · Wires the full AI cinematography pipeline into a single CLI command.

## Quick Start

```bash
# Dry run — generates manifest JSON, skips Remotion render
node scripts/sizzle.mjs scenes/ --style prestige --dry-run

# Full render
node scripts/sizzle.mjs scenes/ --style prestige

# Via npm script
npm run sizzle -- scenes/ --style energy --output renders/demo.mp4
```

## Usage

```
node scripts/sizzle.mjs <scenes-dir> [options]

Options:
  --style <name>   Style pack: prestige, energy, dramatic (required)
  --output <path>  Output path (default: renders/sizzle-{style}-{timestamp}.mp4)
  --dry-run        Generate manifest JSON only, skip Remotion render
  --verbose        Print per-scene analysis and planning details
  --help           Show usage
```

## Style Packs

| Style | Personality | Character |
|-------|------------|-----------|
| `prestige` | editorial | Content-forward, crossfades on weight change, subtle camera |
| `energy` | montage | Fast cuts, whip-wipes every 3rd transition, static camera |
| `dramatic` | cinematic-dark | Long holds on high-energy, crossfades, push-in camera |

## Input Format

Point `<scenes-dir>` at a folder of scene JSON files. Each file must conform to the [scene format spec](specs/scene-format.md). Files are loaded alphabetically.

If a scene is missing `scene_id`, one is derived from the filename: `my-cool-scene.json` → `sc_my_cool_scene`.

## Data Flow

```
scenes/*.json
  ↓  loadScenes() — read, derive scene_id if missing, validateScene()
scene objects[]
  ↓  analyzeAll() — analyzeScene() on each, adds .metadata
analyzed scenes[]
  ↓  planSequence({ scenes, style }) — order, durations, transitions, camera
manifest
  ↓  assembleProps(manifest, scenes) — build { manifest, sceneDefs }
props JSON (temp file)
  ↓  npx remotion render Sequence --props temp.json output.mp4
rendered video
```

## Pipeline Stages

### 1. Load Scenes

Reads all `*.json` files from the directory, sorted alphabetically. Validates each against the scene format spec. Fails fast on invalid JSON or validation errors.

### 2. Analyze Scenes

Runs `analyzeScene()` (ANI-22) on each scene to produce metadata:
- `content_type` — portrait, typography, ui_screenshot, etc.
- `visual_weight` — light, dark, mixed
- `motion_energy` — static, subtle, moderate, high
- `intent_tags` — opening, hero, detail, closing, emotional, etc.

### 3. Plan Sequence

Runs `planSequence()` (ANI-23/24) to determine:
- **Shot order** — intent-bucket ordering with variety post-processing
- **Hold durations** — per style pack rules based on motion energy
- **Transitions** — crossfade, hard_cut, whip-wipes per style rules
- **Camera overrides** — validated against personality guardrails

### 4. Render

Assembles the Remotion props object (`{ manifest, sceneDefs }`) and either:
- **Dry run**: Writes the props JSON to disk for inspection
- **Full render**: Spawns `npx remotion render Sequence` with the props

## Console Output

```
Sizzle Pipeline
──────────────────────────────────────────────────
1. Loading scenes...
   5 files from scenes/my-project/

  Input:  scenes/my-project/ (5 scenes)
  Style:  prestige (editorial)
  Output: renders/sizzle-prestige-1709312400.mp4

2. Analyzing scenes...
   done
3. Planning sequence...
   18.5s total, 2 crossfade + 2 hard_cut
4. Rendering video...

──────────────────────────────────────────────────
Done in 28.3s → renders/sizzle-prestige-1709312400.mp4
```

With `--verbose`, steps 2–3 expand with per-scene details:

```
2. Analyzing scenes...
   sc_hero: brand_mark, dark, moderate, [hero, opening]
   sc_detail_1: ui_screenshot, light, subtle, [detail]
   sc_detail_2: device_mockup, dark, moderate, [detail]
   done
3. Planning sequence...
   18.5s total, 2 crossfade + 2 hard_cut
   Order: sc_hero → sc_detail_1 → sc_detail_2
   Rationale: Opens with hero scene; 3 content type(s) across 3 scenes
```

## Architecture

The CLI (`scripts/sizzle.mjs`) is a thin orchestrator. It imports from existing modules — no pipeline logic is duplicated:

| Import | Source | Purpose |
|--------|--------|---------|
| `analyzeScene` | `mcp/lib/analyze.js` | Scene analysis (ANI-22) |
| `planSequence`, `STYLE_PACKS`, `STYLE_TO_PERSONALITY` | `mcp/lib/planner.js` | Sequence planning (ANI-23/24) |
| `validateScene`, `validateManifest` | `src/remotion/lib.js` | Validation |

Three functions are exported for unit testing: `loadScenes`, `analyzeAll`, `assembleProps`.

## Tests

Tests live in `mcp/test/sizzle.test.js` and use existing ground truth data from `test-kinetic-type.json` and `test-layouts.json`.

```bash
npm test  # runs all tests including sizzle
```
