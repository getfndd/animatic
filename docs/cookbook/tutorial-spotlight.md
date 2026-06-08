---
id: tutorial-spotlight
title: "Tutorial Spotlight Walkthrough"
category: onboarding
personality: [neutral-light]
duration: ~3s per step
primitives: [nl-spotlight, nl-tooltip, bd-spotlight-cursor-reveal]
breakdown: notion-onboarding-flow
tags: [tutorial, spotlight, cursor, walkthrough, step-indicator, teaching]
---

# Tutorial Spotlight Walkthrough

The teaching pattern: the UI dims except for a spotlit element, a tooltip names it, and a cursor (real or implied) moves to it before anything happens. Each step follows the same grammar — spotlight → label → action — so the viewer always knows whether they're being *shown* or something is *happening*.

**When to use:** feature tutorials, "here's how to" segments, support/help content, in-app tour videos.
**When not to use:** marketing demos — spotlights say "learn this", which deflates aspirational pacing.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Full UI visible, neutral state | — |
| 0.3s | Spotlight isolates the target element | 2000ms hold |
| 0.6s | Tooltip appears, positioned at the target | 2000ms hold |
| 1.8s | Cursor travels to the target and the action fires | ~1200ms |
| 3.0s | Spotlight releases; next step begins | crossfade |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "focus", "targets": ["export_button"], "primitive": "nl-spotlight" },
      { "id": "label", "targets": ["tooltip_export"], "primitive": "nl-tooltip", "position": ">300" },
      { "id": "guide", "targets": ["cursor_layer"], "primitive": "bd-spotlight-cursor-reveal", "position": ">" }
    ]
  }
}
```

Sequence manifest entry (steps chain with crossfades):

```json
{
  "scene": "sc_03_step_export",
  "duration_s": 3,
  "transition_in": { "type": "crossfade", "duration_ms": 300 },
  "camera_override": { "move": "static" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `nl-spotlight` | Dims everything but the target |
| `nl-tooltip` | Positioned label naming the target |
| `bd-spotlight-cursor-reveal` | Compound cursor-travel + spotlight reveal |

## Breakdown Reference

[notion-onboarding-flow](../../.claude/skills/animate/reference/breakdowns/notion-onboarding-flow.md) — progressive disclosure pacing: each step waits for the previous one to fully resolve. Tutorials fail when steps overlap.

## Variations

- **Step indicators:** add a persistent progress-dots layer (see [onboarding-step-flow](onboarding-step-flow.md)) when the tour has 4+ steps
- **Zoom-assist:** pair the spotlight with a gentle `push_in` camera override (intensity ≤ 0.1) when the target is small — the only camera move this pattern tolerates
- **Confirmation beat:** fire `as-tada` or `as-headShake` on the target after the action to confirm success/failure states
