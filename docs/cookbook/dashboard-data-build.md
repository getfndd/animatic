---
id: dashboard-data-build
title: "Dashboard Data Build"
category: data-viz
personality: [editorial, cinematic-dark]
duration: ~5s scene
primitives: [cd-bar-grow, cd-card-cascade, bk-table-row-stagger]
breakdown: mercury-insights-sizzle
tags: [dashboard, chart, stagger, data, product-demo, bar-chart]
---

# Dashboard Data Build

A dashboard assembles itself in reading order: chart bars grow from the baseline, insight cards cascade in, table rows fill top-down. The build order tells the viewer what to read first — chart (context), cards (insight), rows (evidence). This is the workhorse pattern for any analytics or fintech product demo.

**When to use:** demoing a data-dense screen, "your data comes alive" beats, dashboards after a chat/prompt scene.
**When not to use:** when the dashboard is incidental background — a build draws full attention.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Dashboard chrome present, data regions empty | — |
| 0.2s | Bars grow from baseline, 120ms stagger | 500ms + stagger |
| 1.2s | Insight cards cascade in | 400ms + 180ms stagger |
| 2.4s | Table rows reveal top-down | 80ms interval |
| 0–5s | Subtle push-in, peak at 60% | full scene |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "push_in", "intensity": 0.12, "sync": { "peak_at": 0.6 } },
    "groups": [
      { "id": "chart", "targets": ["revenue_chart"], "primitive": "cd-bar-grow" },
      { "id": "cards", "targets": ["card-0", "card-1", "card-2"], "primitive": "cd-card-cascade", "position": ">" },
      { "id": "rows", "targets": ["data_table"], "primitive": "bk-table-row-stagger", "position": ">-100" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_03_dashboard",
  "duration_s": 5,
  "transition_in": { "type": "crossfade", "duration_ms": 400 }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `cd-bar-grow` | Chart bars grow from baseline, 120ms stagger |
| `cd-card-cascade` | Insight cards enter after the chart establishes context |
| `bk-table-row-stagger` | Table rows fill last — evidence layer |

## Breakdown Reference

[mercury-insights-sizzle](../../.claude/skills/animate/reference/breakdowns/mercury-insights-sizzle.md) — the dashboard build sequence shows exactly this layering: chart → cards → drilldown, with the camera holding back until the data lands.

## Variations

- **Insight-first:** lead with `cd-card-cascade`, then grow the chart — use when the headline is the takeaway, not the trend
- **Drilldown continuation:** chain into [chart-drilldown-explain](chart-drilldown-explain.md) with a `cd-panel-drilldown` slide
- **Neutral-light:** swap to `nl-list-row-stagger` + `nl-staggered-card-entrance`, static camera
