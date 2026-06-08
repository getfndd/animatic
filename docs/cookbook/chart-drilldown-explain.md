---
id: chart-drilldown-explain
title: "Chart Drilldown Explain"
category: data-viz
personality: [editorial, cinematic-dark]
duration: ~5s scene
primitives: [bd-chart-build-explain, cd-panel-drilldown, hm-chart-to-insight-reveal]
breakdown: mercury-insights-sizzle
tags: [chart, drilldown, explain, insight, panel, bar-chart, analysis]
---

# Chart Drilldown Explain

A chart builds, one segment gets interrogated, and the answer slides in as a panel: build → focus → explain. This is the analysis-product pattern — it demonstrates not just that the data exists but that the product can *answer questions about it*. The drilldown panel arriving from the side preserves the chart as context.

**When to use:** analytics features, "click any bar to see why" claims, AI-explanation features over data.
**When not to use:** when the explanation is generic — a drilldown that reveals boilerplate destroys the intelligence claim.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Chart builds with explanatory annotations | 3200ms |
| 2.0s | Target segment highlights (focus state) | 300ms |
| 2.4s | Detail panel slides in from the right | 500ms |
| 3.0s+ | Panel content staggers in: title, figures, insight line | 80–150ms intervals |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "chart", "targets": ["spend_chart"], "primitive": "bd-chart-build-explain" },
      { "id": "panel", "targets": ["detail_panel"], "primitive": "cd-panel-drilldown", "position": ">-600" },
      { "id": "rows", "targets": ["panel_rows"], "primitive": "bk-table-row-stagger", "position": ">" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_04_drilldown",
  "duration_s": 5,
  "transition_in": { "type": "hard_cut" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `bd-chart-build-explain` | Chart growth with built-in annotation beats, 3200ms |
| `cd-panel-drilldown` | The side-panel slide, 500ms |
| `hm-chart-to-insight-reveal` | Compound alternative — chart morphs directly into an insight card (editorial) |

## Breakdown Reference

[mercury-insights-sizzle](../../.claude/skills/animate/reference/breakdowns/mercury-insights-sizzle.md) — the chart-drilldown-panel-slide sequence: the chart never leaves frame during the drilldown, and the panel's stagger order mirrors how an analyst would read it.

## Variations

- **Insight-reveal form:** replace the panel with `hm-chart-to-insight-reveal` when the takeaway is one sentence, not a table
- **Chained drilldowns:** two levels max (chart → segment → line item); a third level needs a new scene with a `match_cut_scale`
- **Entry point:** works as the continuation of [dashboard-data-build](dashboard-data-build.md) — build the dashboard in scene N, drill into it in scene N+1
