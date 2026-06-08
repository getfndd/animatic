---
id: metric-highlight-pop
title: "Metric Highlight Pop"
category: data-viz
personality: [cinematic-dark, editorial]
duration: ~2.5s scene
primitives: [hm-metric-explosion, cd-bar-grow]
breakdown: mercury-insights-sizzle
tags: [metric, stat, count-up, hero-moment, number, proof]
---

# Metric Highlight Pop

One number gets the hero treatment: the metric counts up at scale while its supporting context (label, trend arrow, micro-chart) settles in around it. A demo earns one or two of these — they're the exclamation points of the story. The count-up makes the number feel *measured*; an instant number feels asserted.

**When to use:** the proof beat — "12% revenue growth", "3.2x faster", "50k users". Place after the feature that causes it.
**When not to use:** more than twice per video, or for numbers that aren't impressive in isolation (a count-up to "4" undermines itself).

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Scene enters on the metric region | — |
| 0.2s | Metric explodes in: scale + count-up | 2400ms |
| 0.8s | Label and trend arrow settle in beside it | 400ms |
| 1.4s | Optional micro-chart grows under the number | 500ms |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "push_in", "intensity": 0.15, "sync": { "peak_at": 0.5 } },
    "groups": [
      { "id": "metric", "targets": ["headline_stat"], "primitive": "hm-metric-explosion" },
      { "id": "context", "targets": ["stat_label", "trend_arrow"], "primitive": "as-fadeIn", "position": ">-1600" },
      { "id": "spark", "targets": ["sparkline"], "primitive": "cd-bar-grow", "position": ">" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_06_proof_metric",
  "duration_s": 2.5,
  "transition_in": { "type": "hard_cut" },
  "camera_override": { "move": "push_in", "intensity": 0.15 }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `hm-metric-explosion` | The hero count-up + scale moment, 2400ms |
| `cd-bar-grow` | Supporting micro-chart/sparkline growth |

## Breakdown Reference

[mercury-insights-sizzle](../../.claude/skills/animate/reference/breakdowns/mercury-insights-sizzle.md) — count-up rhythm in the insight cards: numbers land *before* the camera peaks, so the peak frames a finished figure, not a moving target.

## Variations

- **Montage:** use `mo-stat-reveal` instead — 150ms pop-interval, no count-up, suits rapid-fire stat runs
- **Stat triptych:** three metrics with `position: ">"` chaining — cap at three; four becomes a table
- **Inside a dashboard:** don't combine with [dashboard-data-build](dashboard-data-build.md) in the same scene — one pattern per scene; cut between them
