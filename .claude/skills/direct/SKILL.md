---
name: direct
description: Autonomous video direction — load project, plan story, generate candidates, score, revise, save.
---

# /direct — Autonomous Video Direction

Generate the best possible video manifest for a project. Runs a multi-candidate generation → scoring → revision loop autonomously, saving artifacts back to the project.

---

## Command Interface

```
/direct <project-slug> [options]
```

**Recommended effort:** Run `/direct` with `/effort xhigh` (Opus 4.7). The autonomous scoring/revision loop benefits materially from xhigh over the default; `max` is rarely worth the cost on this workload.

### Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `project` | slug | required | Project slug (from `list_projects`) |
| `--strategies` | comma-list | `prestige,energy,dramatic` | Style strategies for candidates |
| `--max-revisions` | 0-3 | `2` | Max revision rounds on winner |
| `--save` | flag | on | Save artifacts to project folder |
| `--dry-run` | flag | off | Print plan without executing |

---

## Execution Loop (9 Steps)

Execute these steps in order. At each step, call the appropriate MCP tool and use the result to inform the next step.

### Step 1: Load Project Context

Call `get_project_context` with the project slug:
```
include: ['brief', 'storyboard', 'scenes', 'manifest', 'review']
```
If the project has a brand, call `get_brand_package` to load it.

### Step 2: Extract Story Brief

Call `extract_story_brief` with:
- `project`: the project.json contents
- `brief`: the brief markdown text (from step 1)
- `scenes`: scene definitions (from step 1)
- `brand`: brand package (if loaded)

This produces the structured brief: audience, promise, tone, features, closing beat, narrative template.

### Step 2.5: Compose Storyboard

Call `compose_storyboard` with:
- `story_brief`: output from step 2
- `brief`: brief markdown text (from step 1) — feeds LLM enrichment
- `brand`: brand package (if loaded)
- `project`: project.json contents
- `options.enhance`: `true` (default — uses Claude Sonnet 4.6 to add specific px/weight/color values to each panel's `visual_direction`. Falls back to a deterministic skeleton when no API key.)

This produces a `storyboard.json` shaped per `docs/cinematography/specs/storyboard-format.md`: panels with `act`, `intent`, `visual_direction`, `motion_notes`, and `content_type`. Save to `concept/storyboard.json` via `save_project_artifact` (kind: `storyboard`).

**Surface to the user:** panel count, distinct content_types, and any panels with empty `visual_direction.composition`. The loop continues either way — this is the design checkpoint, not a hard gate.

**Conflict resolution:** in Step 3, panel-level motion_notes and visual_direction override archetype defaults per beat; archetype values remain the fallback when no panel ref is present.

### Step 3: Plan Beats (×3 Strategies)

For each strategy (e.g., prestige, energy, dramatic), call `plan_story_beats` with:
- `story_brief`: output from step 2
- `archetype_slug`: the `narrative_template` from the brief (or override per strategy)
- `storyboard`: output from step 2.5 — panel-level visual_direction and motion_notes refine each beat
- `audio_beats`: from project context if available

This produces 3 beat plans with different pacing and camera approaches. Each beat carries a `panel_ref` block when a storyboard panel was matched, so downstream scene generation can read panel intent and visual direction.

### Step 4: Materialize Manifests

For each beat plan, call `plan_sequence` (existing tool) to turn the beat plan into a concrete sequence manifest:
- Convert beats to analyzed scenes (or use existing project scenes)
- Apply the strategy's style pack
- Include transition and camera overrides from the beat plan

### Step 5: Score All Candidates

For each manifest, call `score_candidate_video` with:
- `manifest`: the materialized manifest
- `scenes`: the project's scene definitions
- `style`: the strategy's style pack
- `brand`: brand package if available

Collect all score cards.

### Step 6: Compare Candidates

Call `compare_candidate_videos` with all scored candidates:
```json
{
  "candidates": [
    { "candidate_id": "prestige", "strategy": "prestige", "score_card": {...}, "manifest": {...} },
    { "candidate_id": "energy", "strategy": "energy", "score_card": {...}, "manifest": {...} },
    { "candidate_id": "dramatic", "strategy": "dramatic", "score_card": {...}, "manifest": {...} }
  ]
}
```

Report the ranking and recommendation to the user.

### Step 7: Revise Winner (Loop)

Take the winning manifest and its `recommended_revisions` from the score card.

**Revision loop** (max `--max-revisions` rounds):

1. Call `revise_candidate_video` with the recommended revisions
2. Re-score with `score_candidate_video`
3. If improvement > 0.02, repeat with new recommendations
4. If improvement ≤ 0.02 or max rounds reached, stop

Report each revision round: what changed, score before/after.

### Step 8: Save Artifacts

If `--save` is active, call `save_project_artifact` for each:

| Artifact | Kind | Path |
|----------|------|------|
| Story brief | `brief` | `brief/story-brief.json` |
| Storyboard | `storyboard` | `concept/storyboard.json` |
| Beat plans | `storyboard` | `concept/beat-plan-{strategy}.json` |
| Winning manifest | `manifest` | `motion/manifests/directed-{timestamp}.json` |
| Score card | `review` | `review/score-card.json` |
| Comparison | `review` | `review/comparison.json` |
| Contact sheet | `review` | `review/contact-sheet.md` |

Update the project's `entrypoints.root_manifest` to point to the winning manifest.

---

## Output Format

After all steps, present a summary:

```
## Direction Complete

**Project:** {slug}
**Winner:** {strategy} (overall: {score})
**Revision rounds:** {n}

### Score Card
- Hook: {score}
- Narrative Arc: {score}
- Clarity: {score}
- Visual Hierarchy: {score}
- Motion Quality: {score}
- Brand Finish: {score}

### Revisions Applied
- {diff entries}

### Artifacts Saved
- {list of saved files}
```

---

## Strategy Presets

When the user provides strategy names, map them:

| Strategy | Style Pack | Personality | Archetype Override |
|----------|------------|-------------|-------------------|
| `prestige` | prestige | cinematic-dark | (use brief's template) |
| `energy` | energy | montage | launch-reel |
| `dramatic` | dramatic | cinematic-dark | brand-teaser |
| `minimal` | minimal | editorial | testimonial-cutdown |
| `social` | energy | montage | social-loop |

If the strategy doesn't match a preset, use it as a raw style pack name.

---

## Error Handling

- If project not found: stop, report error
- If no scenes in project: use archetype defaults, generate placeholder scenes
- If scoring fails on a candidate: exclude it, continue with remaining
- If all candidates fail: report the best partial result with findings
- If revision makes score worse: revert, keep pre-revision version
