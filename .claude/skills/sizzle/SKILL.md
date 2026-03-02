---
name: sizzle
description: Scenes folder + style → evaluated, validated, rendered sizzle reel video.
---

# /sizzle - Sizzle Reel Pipeline

Full AI cinematography pipeline: load scenes → analyze → plan → evaluate → validate → render video.

---

## Command Interface

```
/sizzle <scenes-dir> --style <name> [options]
  --style <name>        Style pack (required). One of:
                        prestige, energy, dramatic, minimal,
                        intimate, corporate, kinetic, fade
  --output <path>       Output path (default: renders/sizzle-{style}-{timestamp}.mp4)
  --dry-run             Generate manifest JSON only, skip render
  --skip-evaluate       Skip quality evaluation step
  --skip-validate       Skip guardrails validation step
  --sequence-id <id>    Custom sequence ID
  --verbose             Print per-scene analysis details
```

### Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `scenes-dir` | path | required | Directory containing scene JSON files |
| `--style` | pack name | required | Style pack to apply |
| `--output` | path | auto | Output video path |
| `--dry-run` | flag | false | Manifest only, no render |
| `--skip-evaluate` | flag | false | Skip quality scoring |
| `--skip-validate` | flag | false | Skip guardrail checks |
| `--sequence-id` | string | auto | Custom sequence identifier |
| `--verbose` | flag | false | Detailed output |

---

## Execution Flow

When `/sizzle` is invoked:

### 1. Read Scene Files

Load all `*.json` scene files from the specified directory. Validate each against the scene format spec.

### 2. Analyze Scenes

Call `analyze_scene` MCP tool on each scene to classify:
- Content type (typography, portrait, device-mockup, etc.)
- Visual weight (light, dark, mixed)
- Motion energy (static, subtle, moderate, high)
- Intent tags (opening, hero, closing, etc.)

### 3. Plan Sequence

Call `plan_sequence` MCP tool with analyzed scenes + style pack:
- Orders scenes by intent progression
- Assigns transitions per style pack rules
- Sets camera overrides per content type
- Assigns hold durations by motion energy

### 4. Evaluate Quality

Call `evaluate_sequence` MCP tool to score the manifest:
- **Pacing** — duration match to style pack hold durations
- **Variety** — shot size, content type, weight, energy diversity
- **Flow** — energy arc, intent progression, transition coherence
- **Adherence** — camera, transition, shot grammar compliance

Present the overall score (0-100) and per-dimension breakdown.

If the score is below 60, recommend reviewing the findings before proceeding.

### 5. Validate Guardrails

Call `validate_choreography` MCP tool to check safety bounds:
- Speed limits on camera moves
- Personality boundary enforcement
- Lens bounds (scale, rotation)
- Acceleration and jerk limits

**If verdict is BLOCK:** Must fix violations before rendering. Show the blocking issues and suggest corrections.

**If verdict is WARN:** Show warnings but allow proceeding.

**If verdict is PASS:** Continue silently.

### 6. Human Review

**Before rendering, always present the manifest for review:**
- Show scene order with durations
- Show transition types between scenes
- Show camera overrides
- Show the evaluate score and any warnings

Ask the user to:
- **Approve** — proceed to render
- **Edit** — modify the manifest JSON directly, then re-evaluate
- **Re-plan** — try a different style pack or adjust parameters
- **Cancel** — abort the pipeline

### 7. Render

On approval, run the CLI to produce the video:

```bash
node scripts/sizzle.mjs <scenes-dir> --style <name> [--dry-run] [--verbose]
```

---

## Style Packs

| Pack | Personality | Vibe |
|------|-------------|------|
| `prestige` | editorial | Elegant, content-forward |
| `energy` | montage | Fast cuts, high energy |
| `dramatic` | cinematic-dark | Slow, atmospheric, 3D |
| `minimal` | neutral-light | Clean, tutorial-like |
| `intimate` | cinematic-dark | Close, personal, moody |
| `corporate` | editorial | Professional, polished |
| `kinetic` | montage | Dynamic, rhythmic |
| `fade` | editorial | Gentle, crossfade-heavy |

---

## Examples

### Basic sizzle reel

```
/sizzle scenes/ --style prestige
```

### Dry run for review

```
/sizzle scenes/ --style dramatic --dry-run --verbose
```

### Fast pipeline (skip quality checks)

```
/sizzle scenes/ --style energy --skip-evaluate --skip-validate
```

---

## MCP Tools Used

| Tool | Step | Purpose |
|------|------|---------|
| `analyze_scene` | 2 | Classify scene metadata |
| `plan_sequence` | 3 | Generate sequence manifest |
| `evaluate_sequence` | 4 | Score manifest quality |
| `validate_choreography` | 5 | Check safety guardrails |
| `get_style_pack` | — | Inspect style pack rules |

---

## Rules

### DO
- Always show the manifest before rendering
- Always run evaluate + validate unless explicitly skipped
- Present findings clearly with severity levels
- Allow the user to edit and re-evaluate
- Use `--dry-run` for first iterations

### DO NOT
- Render without human approval
- Ignore BLOCK verdicts from guardrails
- Skip evaluation when the score matters (marketing, external use)
- Mix style packs within a single sizzle reel

---

## Related Commands

| Command | Purpose |
|---------|---------|
| `/review` | Evaluate + validate without rendering |
| `/brief` | Author a creative brief before scene creation |
| `/storyboard` | Brief → classified assets → generated scenes |
