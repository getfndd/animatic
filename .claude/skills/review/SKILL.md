---
name: review
description: Evaluate a sequence manifest for quality and guardrail compliance. No rendering.
---

# /review - Sequence Quality Review

Evaluate and validate a sequence manifest (or generate one from scenes) without rendering. Produces a structured quality report with scores, findings, and improvement suggestions.

---

## Command Interface

```
/review <manifest.json> [--style <name>]
/review <scenes-dir> --style <name>
```

### Two Input Modes

| Mode | Input | What Happens |
|------|-------|-------------|
| **Mode A** | Manifest JSON file | Evaluate + validate directly |
| **Mode B** | Scenes directory + style | Analyze → plan → evaluate → validate |

### Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `input` | path | required | Manifest JSON file or scenes directory |
| `--style` | pack name | required for Mode B | Style pack (inferred from manifest in Mode A) |

---

## Execution Flow

### Mode A: Manifest File

1. Read the manifest JSON file
2. Infer style from `manifest.metadata.style` or require `--style`
3. Load scene definitions from `manifest.sceneDefs` or companion files
4. Call `evaluate_sequence` MCP tool → score + dimension breakdown
5. Call `validate_choreography` MCP tool → PASS/WARN/BLOCK verdict
6. Synthesize report

### Mode B: Scenes Directory

1. Load scene JSON files from directory
2. Call `analyze_scene` MCP tool on each scene
3. Call `plan_sequence` MCP tool → generate manifest
4. Call `evaluate_sequence` MCP tool → score + dimension breakdown
5. Call `validate_choreography` MCP tool → PASS/WARN/BLOCK verdict
6. Synthesize report

---

## Output Format

Present a structured markdown report:

### Overall Score

```
Score: 82/100
```

### Dimension Breakdown

```
Pacing:    ████████░░  85/100
Variety:   ███████░░░  75/100
Flow:      █████████░  88/100
Adherence: ████████░░  80/100
```

### Findings by Severity

Group findings into:
- **Warnings** — issues that degrade quality
- **Info** — observations and suggestions

### Guardrails Verdict

```
Guardrails: PASS | WARN (2 warnings) | BLOCK (1 violation)
```

If BLOCK: list blocking violations with scene numbers and specific fix suggestions.

### Improvement Suggestions

Synthesize actionable suggestions from findings:
- Which scenes to adjust duration on
- Where to add variety (same content type/weight runs)
- Transition alternatives that better match the style
- Camera override adjustments

---

## Examples

### Review an existing manifest

```
/review renders/sizzle-prestige-1709000000.json
```

### Review scenes with a style

```
/review scenes/ --style dramatic
```

### Compare styles

```
/review scenes/ --style prestige
/review scenes/ --style dramatic
```

---

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `analyze_scene` | Classify scene metadata (Mode B only) |
| `plan_sequence` | Generate manifest (Mode B only) |
| `evaluate_sequence` | Score manifest quality |
| `validate_choreography` | Check safety guardrails |

---

## Rules

### DO
- Present all four dimension scores
- Group findings by severity
- Offer specific, actionable improvement suggestions
- Compare against the style pack's rules when explaining findings

### DO NOT
- Render video (use `/sizzle` for that)
- Modify scene files or manifests
- Skip the guardrails check
- Present raw findings without synthesis

---

## Related Commands

| Command | Purpose |
|---------|---------|
| `/sizzle` | Full pipeline including render |
| `/brief` | Author a creative brief |
