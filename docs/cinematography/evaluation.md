# Sequence Evaluation

**Status:** Implemented
**Issue:** ANI-28
**Version:** 1.0

## Overview

The evaluation engine scores a planned sequence manifest across four dimensions: **pacing**, **variety**, **flow**, and **style adherence**. Returns 0-100 scores per dimension, a weighted overall score, and actionable findings.

Designed to answer: "How good is this sequence?" — both for planner-generated manifests and manually-edited ones. Re-derives expected transitions and camera overrides from raw style pack rules (does not import planner functions) to catch drift in hand-tuned manifests.

## Architecture

```
manifest (from planSequence)
  + scenes (analyzed metadata)
  + style pack name
         │
         ▼
  evaluateSequence()
         │
   ┌─────┼──────┬───────────┐
   ▼     ▼      ▼           ▼
scorePacing  scoreVariety  scoreFlow  scoreAdherence
   │     │      │           │
   └─────┼──────┴───────────┘
         ▼
  { score, dimensions, findings }
```

**Key files:**
- `mcp/lib/evaluate.js` — 4 scoring functions + orchestrator + helpers
- `mcp/test/evaluate.test.js` — 43 tests across all dimensions
- `mcp/index.js` — `evaluate_sequence` MCP tool

## Scoring Dimensions

### Pacing (25%)

Compares each scene's `duration_s` against the style pack's `hold_durations[motion_energy]`.

| Check | Scoring |
|-------|---------|
| Per-scene deviation | Within ±0.5s = full marks; >1s = warning |
| Total duration vs `loop_time` range | Within range = +5 bonus |
| `max_hold_duration` violations | Each = warning + penalty |
| Confidence weighting | Low-confidence `motion_energy` = less penalty |

### Variety (25%)

Style-agnostic cinematography quality. Four equally-weighted sub-scores:

| Sub-score | Penalty |
|-----------|---------|
| Shot size runs | 2-run = -10, 3+ = -25 |
| Adjacent same `content_type` | Each pair = -20 |
| Visual weight dominance >80% | -30 |
| All-same motion energy | -40; 3+ unique levels = +10 |

Short sequences (1-2 scenes) score 100 — not enough data to penalize.

### Flow (25%)

Three weighted sub-scores:

| Sub-score | Weight | Good |
|-----------|--------|------|
| Energy arc | 40% | Peak in middle 30-70% |
| Intent progression | 30% | Opening at start, closing at end, hero in first half |
| Transition coherence | 30% | Transitions match style pack rules |

### Style Adherence (25%)

Four equally-weighted sub-scores:

| Sub-score | How |
|-----------|-----|
| Camera override match | Re-derive from style pack rules, compare |
| Transition type match | Re-derive from style pack rules, compare |
| Shot grammar compliance | Check axes against `personality_restrictions` |
| Duration match | Compare against `hold_durations[energy]` |

### Overall Score

```
Math.round(pacing * 0.25 + variety * 0.25 + flow * 0.25 + adherence * 0.25)
```

## Output Format

```js
{
  score: 78,
  dimensions: {
    pacing:    { score: 85, findings: [...] },
    variety:   { score: 72, findings: [...] },
    flow:      { score: 80, findings: [...] },
    adherence: { score: 75, findings: [...] },
  },
  findings: [
    { severity: 'warning', dimension: 'pacing', message: '...', scene_index: 2 },
    { severity: 'info', dimension: 'variety', message: '...', scene_index: 4 },
  ],
}
```

**Severities:** `warning` (significant issue), `info` (minor), `suggestion` (improvement opportunity).

## MCP Tool

**Name:** `evaluate_sequence`

**Inputs:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `manifest` | object | Sequence manifest from `plan_sequence` |
| `scenes` | array | Analyzed scene objects with metadata |
| `style` | string | Style pack: `prestige`, `energy`, or `dramatic` |

**Output:** Markdown-formatted scores table + findings grouped by severity + raw JSON result.

## Transition Rule Priority (re-derived)

The evaluation engine re-derives expected transitions independently from the planner, using the same priority order:

1. `pattern` — positional (every-Nth whip-wipe)
2. `on_same_weight` — consecutive same `visual_weight`
3. `on_weight_change` — `visual_weight` differs
4. `on_intent` — intent tag match on incoming scene
5. `default` — fallback

## Camera Rule Priority (re-derived)

1. `force_static` — all scenes static
2. `by_content_type` — content_type → camera move
3. `by_intent` — intent tag → camera move

## Exported Functions

| Function | Purpose |
|----------|---------|
| `evaluateSequence({ manifest, scenes, style })` | Orchestrator — returns full evaluation |
| `scorePacing(manifestScenes, sceneMap, style)` | Pacing dimension scorer |
| `scoreVariety(manifestScenes, sceneMap)` | Variety dimension scorer |
| `scoreFlow(manifestScenes, sceneMap, style)` | Flow dimension scorer |
| `scoreAdherence(manifestScenes, sceneMap, style)` | Adherence dimension scorer |
| `parseLoopTimeRange(str)` | Parse "12-16s" → `{ min, max }` |
| `getExpectedDuration(energy, pack)` | Expected duration from style pack |
| `getExpectedTransition(rules, prev, curr, idx)` | Re-derive expected transition |
| `getExpectedCamera(rules, scene, personality)` | Re-derive expected camera override |

## Design Decisions

**Why re-derive instead of importing planner functions?** Testing the planner against itself would be circular — the evaluation would always match. By re-deriving from raw catalog rules, the evaluator catches both planner bugs and manually-edited manifests.

**Why equal 25% weights?** All four dimensions are equally important for a good sequence. Pacing without variety is monotonous; variety without flow is chaotic; flow without adherence drifts from the style; adherence without pacing feels mechanical.

**Why 100 for short sequences?** With 1-2 scenes there's not enough data to meaningfully score variety, flow, or arc. Penalizing would create noisy false negatives.
