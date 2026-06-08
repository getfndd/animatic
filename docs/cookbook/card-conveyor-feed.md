---
id: card-conveyor-feed
title: "Card Conveyor Feed"
category: layout
personality: [editorial, cinematic-dark]
duration: ~4s scene
primitives: [bd-card-conveyor, hm-card-fan-out]
breakdown: card-conveyor-depth-rail
tags: [conveyor, depth, card-stack, feed, z-rail, selection]
---

# Card Conveyor Feed

Content cards ride a z-space depth rail — approaching from the background, holding briefly in the focus plane, then passing on. One card can pause in focus (selection hold) while the rail continues behind it. This is how you show *a stream* of things (insights, notifications, candidates) without a scrolling list — depth implies flow and abundance.

**When to use:** "your feed comes to you" beats, insight streams, queues, review pipelines — anywhere volume + triage is the story.
**When not to use:** neutral-light tutorials (z-depth violates the personality) or when exact card content must be read fully — conveyor dwell time is short by design.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Rail already populated — cards mid-travel at cut-in | — |
| 0–4s | Cards advance along the depth rail | 3500ms compound |
| 1.5s | Hero card pauses in focus plane (selection hold) | ~1000ms |
| 2.5s | Rail resumes, hero rejoins flow | — |

## Manifest Snippet

Scene with a `card_conveyor` layer (the primitive drives the layer type directly):

```json
{
  "layers": [
    { "id": "bg", "type": "html", "content": "<div style=\"width:100%;height:100%;background:#111827\"></div>", "depth_class": "background" },
    {
      "id": "insight_conveyor",
      "type": "card_conveyor",
      "depth_class": "foreground",
      "stories": [
        { "title": "12% revenue growth", "excerpt": "Revenue increased from $12,459 to $13,954.", "meta": "treasury · 2d", "trend": "↗", "trendColor": "#34d399" }
      ]
    }
  ],
  "motion": {
    "camera": { "move": "push_in", "intensity": 0.12, "sync": { "peak_at": 0.7 } }
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_02_insight_feed",
  "duration_s": 5,
  "transition_in": { "type": "crossfade", "duration_ms": 400 }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `bd-card-conveyor` | The z-space depth rail compound, 3500ms |
| `hm-card-fan-out` | Alternative climax — the stream fans out into a reviewable spread |

## Breakdown Reference

[card-conveyor-depth-rail](../../.claude/skills/animate/reference/breakdowns/card-conveyor-depth-rail.md) — the exemplary prototype: perspective math, physics-based rail speed, and the selection-hold interaction that makes the stream feel curated rather than relentless.

## Variations

- **Horizontal strip (montage):** use `bd-media-strip` — flat horizontal scroll, montage-safe (no z-depth)
- **Stack fan:** `bd-stack-fan-settle` or `bd-stacked-thumbs` when cards should *arrive as a pile* and fan for review
- **Feed → focus:** end the scene with the hero card scaling toward camera, then `match_cut_scale` into a detail scene
