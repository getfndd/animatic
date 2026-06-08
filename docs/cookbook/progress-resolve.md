---
id: progress-resolve
title: "Working-State Progress Resolve"
category: conversational
personality: [cinematic-dark, editorial]
duration: ~4s scene
primitives: [cd-progress-animation, cd-draw-checks, bk-report-card-materialize]
breakdown: icon-document-morph
tags: [progress, loading, processing, checkmark, ai, working-state, resolve]
---

# Working-State Progress Resolve

The honest middle of every AI demo: the system visibly *works* — multi-file progress lines advance, checkmarks draw themselves on completed steps — and then the finished artifact materializes. Showing the working state makes the result feel earned; cutting straight from prompt to result reads as a magic trick, and viewers discount magic tricks.

**When to use:** between a [chat-to-result-reveal](chat-to-result-reveal.md) prompt and its payoff, batch-processing features, build/deploy/scan products.
**When not to use:** when real latency is the product's weakness — don't choreograph a wait you're trying to claim doesn't exist. Keep it under ~2.5s of working state.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Task list / file list visible, pending state | — |
| 0.2s | Progress lines advance per item | phase dwell |
| 1.6s | Checkmarks draw on completed items | 200ms stagger |
| 2.4s | Result card materializes below/beside | 500ms |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "work", "targets": ["file_progress"], "primitive": "cd-progress-animation" },
      { "id": "done", "targets": ["check-0", "check-1", "check-2"], "primitive": "cd-draw-checks", "position": ">" },
      { "id": "result", "targets": ["report_card"], "primitive": "bk-report-card-materialize", "position": ">200" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_03_processing",
  "duration_s": 4,
  "transition_in": { "type": "hard_cut" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `cd-progress-animation` | Multi-file progress with per-phase dwell |
| `cd-draw-checks` | Self-drawing completion checkmarks, 200ms stagger |
| `bk-report-card-materialize` | The finished artifact's entrance |

## Breakdown Reference

[icon-document-morph](../../.claude/skills/animate/reference/breakdowns/icon-document-morph.md) — the loading-identity loop: how a working state can carry brand identity instead of being a generic spinner.

## Variations

- **Spinner ban:** never use an undifferentiated spinner — progress must show *what* is being processed, or it's dead air
- **Kinetic placeholder:** for abstract computation, `ct-bars-reveal` or kinetic bars (see [kinetic-bars-scatter](../../.claude/skills/animate/reference/breakdowns/kinetic-bars-scatter.md)) as a branded working texture
- **Hard cut to payoff:** if the result deserves a full scene, cut to [metric-highlight-pop](metric-highlight-pop.md) or a hero scene instead of materializing in place
