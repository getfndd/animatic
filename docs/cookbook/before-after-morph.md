---
id: before-after-morph
title: "Before/After Morph"
category: transition
personality: [editorial, neutral-light]
duration: ~3s scene
primitives: [hm-before-after-morph]
breakdown: icon-document-morph
tags: [before-after, morph, match-cut, transformation, comparison]
---

# Before/After Morph

The "before" state transforms into the "after" state in place — messy spreadsheet → clean dashboard, draft → polished doc. The morph carries the argument: *same thing, made better*. A hard cut between before and after makes the viewer reconcile two images; a morph does the reconciliation for them.

**When to use:** transformation claims — cleanup, automation, redesign, summarization. The core beat of most product value props.
**When not to use:** when before and after share no visual structure — a morph between unrelated layouts reads as a glitch. Use a `match_cut_scale` transition on a shared element instead.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | "Before" state holds — long enough to register the pain | 800ms |
| 0.8s | Morph: layout, color, density transform in place | 3000ms |
| 2.6s+ | "After" state settles and holds | rest of scene |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "morph", "targets": ["surface"], "primitive": "hm-before-after-morph" }
    ]
  }
}
```

Cross-scene alternative — match cut on a shared element:

```json
{
  "scene": "sc_05_after",
  "duration_s": 3,
  "transition_in": {
    "type": "match_cut_scale",
    "duration_ms": 400,
    "match": { "from_layer": "report_card", "to_layer": "report_card_full" }
  }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `hm-before-after-morph` | The in-place transformation, 3000ms compound |

## Breakdown Reference

[icon-document-morph](../../.claude/skills/animate/reference/breakdowns/icon-document-morph.md) — scatter/reconverge morph mechanics: the elements that persist through the morph are what make it legible. Identify your invariants first.

## Variations

- **Split-screen compare:** when the morph is too lossy, hold before/after side by side with a staggered reveal — but this trades drama for clarity
- **Multi-step morph:** chain two morphs (raw → structured → styled) only if each intermediate state is meaningful on its own
- **As sequence transition:** use `match_cut_scale` (snippet above) when before and after live in different scenes — see `suggest_match_cuts` for automated candidates
