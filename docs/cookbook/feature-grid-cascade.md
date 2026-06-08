---
id: feature-grid-cascade
title: "Feature Grid Cascade"
category: layout
personality: [editorial]
duration: ~3s scene
primitives: [bk-grid-flip-cascade, bd-moodboard]
breakdown: 3d-card-cascade
tags: [grid, cascade, cards, reveal, features, gallery]
---

# Feature Grid Cascade

A grid of feature cards (or gallery tiles) reveals diagonally — top-left to bottom-right, 80ms intervals — so the eye sweeps the layout the way it would read it. The cascade direction *is* the information hierarchy: whatever enters first is what you claim matters most.

**When to use:** feature overviews, integration galleries, template/moodboard showcases, "everything you get" beats.
**When not to use:** more than ~16 tiles — past that the cascade tail feels like loading, not choreography. Cap the visible grid.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Grid container present, tiles hidden | — |
| 0.2s | Tiles cascade in diagonally | 80ms interval |
| 1.8s | Optional: one tile highlights (scale or border) as the narrative focus | 300ms |
| 0–3s | Camera static — the cascade is the motion | — |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      {
        "id": "tiles",
        "targets": ["tile-0", "tile-1", "tile-2", "tile-3", "tile-4", "tile-5"],
        "primitive": "bk-grid-flip-cascade",
        "stagger": { "interval_ms": 80, "from": "start" }
      }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_04_feature_grid",
  "duration_s": 3,
  "transition_in": { "type": "hard_cut" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `bk-grid-flip-cascade` | The diagonal tile reveal, 80ms interval |
| `bd-moodboard` | Compound alternative — staggered grid with built-in dwell, for image-heavy galleries |

## Breakdown Reference

[3d-card-cascade](../../.claude/skills/animate/reference/breakdowns/3d-card-cascade.md) — isometric grid flip reference. Note how the flip axis stays consistent across all tiles; mixed axes read as chaos.

## Variations

- **Center-out:** `"stagger": { "from": "center" }` — use when there's a hero tile in the middle
- **Cinematic-dark:** use `bk-arc-cascade` instead — the arc path suits dark, dramatic compositions
- **Result-style:** for data/search results, prefer [chat-to-result-reveal](chat-to-result-reveal.md)'s `bd-result-grid` — row fill reads as "found", cascade reads as "presented"
