---
id: kinetic-type-statement
title: "Kinetic Type Statement"
category: typography
personality: [cinematic-dark]
duration: ~3s scene
primitives: [ct-char-stagger, ct-text-sweep, ct-text-hero]
breakdown: kinetic-type-scale-cascade
tags: [typography, kinetic-type, statement, scale, cascade, manifesto]
---

# Kinetic Type Statement

Typography *is* the scene: a short, declarative line (3–7 words) enters with scale, sweep, or per-character cascade against a dark field. No UI, no imagery — the statement carries the beat alone. Used between product scenes, these are the chapter titles of a sizzle reel; they reset attention and set up what's next.

**When to use:** manifesto lines ("Finance moves fast"), chapter breaks between feature runs, claim → proof setups.
**When not to use:** sentences longer than ~7 words — kinetic treatment of a paragraph is a reading test, not a statement.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Dark field, optional subtle ambient | — |
| 0.2s | Line 1 sweeps/cascades in | 800ms |
| 1.2s | Optional line 2 enters smaller, below | 600ms |
| 2.0s+ | Hold; camera drift keeps the frame alive | rest of scene |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "drift", "intensity": 0.1 },
    "groups": [
      { "id": "statement", "targets": ["line_1"], "primitive": "ct-text-sweep" },
      { "id": "support", "targets": ["line_2"], "primitive": "ct-char-stagger", "position": ">200" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_04_statement",
  "duration_s": 3,
  "transition_in": { "type": "hard_cut" },
  "camera_override": { "move": "drift", "intensity": 0.1 }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `ct-text-sweep` | Clip-path sweep reveal — the cleanest single-line entrance |
| `ct-char-stagger` | Per-character cascade for the supporting line |
| `ct-text-hero` | Scale-resolve alternative when the line is one or two words |

## Breakdown Reference

[kinetic-type-scale-cascade](../../.claude/skills/animate/reference/breakdowns/kinetic-type-scale-cascade.md) — scale-cascade mechanics with parallax; note how scale and stagger never peak at the same instant.

## Variations

- **Editorial:** use `as-fadeInUp` per line, light palette, static camera — the statement gets quieter, the words work harder
- **With ambient:** layer over [ambient-brand-loop](ambient-brand-loop.md) — keep ambient intensity low so the type owns the frame
- **Hard-cut pair:** statement scene → product scene with `hard_cut` is the strongest claim→proof edit; resist the crossfade
