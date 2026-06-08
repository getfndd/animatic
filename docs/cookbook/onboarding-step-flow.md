---
id: onboarding-step-flow
title: "Onboarding Step Flow"
category: onboarding
personality: [neutral-light]
duration: ~4s per step
primitives: [nl-slide-stagger, nl-field-reveal, nl-provider-button-stagger]
breakdown: linear-onboarding-wizard
tags: [onboarding, wizard, form, stagger, multi-step, light-mode]
---

# Onboarding Step Flow

A multi-step setup wizard rendered as motion: each step's fields slide-fade in as a gentle stagger, conditional fields unfold via height reveal, and auth/provider buttons stack in one by one. Steps transition with opacity crossfades — never slides — so the wizard frame feels stationary while content swaps inside it.

**When to use:** onboarding walkthroughs, settings tours, any "how setup works" tutorial video.
**When not to use:** brand or sizzle content — this pattern's restraint reads as instructional, not promotional.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Step frame + progress indicator present | — |
| 0.2s | Form fields slide-fade in, top-down | 150ms interval |
| 1.5s | Conditional field unfolds (height reveal) | 300ms |
| 2.5s | Provider buttons stack in | 120ms interval |
| 4.0s | Step crossfades to next step | 400ms |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "fields", "targets": ["field-0", "field-1", "field-2"], "primitive": "nl-slide-stagger" },
      { "id": "unfold", "targets": ["team_size_field"], "primitive": "nl-field-reveal", "position": ">400" },
      { "id": "providers", "targets": ["auth_buttons"], "primitive": "nl-provider-button-stagger", "position": ">" }
    ]
  }
}
```

Sequence manifest entry (per step, crossfade between):

```json
{
  "scene": "sc_02_workspace_step",
  "duration_s": 4,
  "transition_in": { "type": "crossfade", "duration_ms": 400 },
  "camera_override": { "move": "static" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `nl-slide-stagger` | Form fields enter top-down, 150ms interval |
| `nl-field-reveal` | Conditional fields unfold by height — form feels responsive |
| `nl-provider-button-stagger` | Branded button stack (Google/GitHub/SSO) enters last |

## Breakdown Reference

[linear-onboarding-wizard](../../.claude/skills/animate/reference/breakdowns/linear-onboarding-wizard.md) — the exemplary multi-step reference: progress dots, card selection states, and crossfade step transitions. See also [vercel-onboarding-flow](../../.claude/skills/animate/reference/breakdowns/vercel-onboarding-flow.md) for the centered-minimal variant.

## Variations

- **Verification step:** insert `nl-segmented-code-input` for OTP/code entry beats
- **Completion celebration:** end with `nl-completion-stagger` cards — earned, not decorative
- **With cursor guidance:** overlay [tutorial-spotlight](tutorial-spotlight.md) when the video must teach *where to click*, not just *what happens*
