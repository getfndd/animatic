---
id: testimonial-crossfade
title: "Testimonial Crossfade Cycle"
category: content
personality: [editorial]
duration: ~3s per quote
primitives: [ed-content-cycle, as-fadeIn]
breakdown: text-image-reveal
tags: [testimonial, crossfade, content-cycle, quote, social-proof]
---

# Testimonial Crossfade Cycle

Quotes cycle in place with opacity crossfades — no movement, no theatrics. The stillness is the point: testimonials are someone else's voice, and motion grammar should defer to the words. Attribution lines fade in slightly after their quote, the way a byline follows a headline.

**When to use:** social-proof beats in product demos, customer-logo sections, closing credibility moments.
**When not to use:** when you only have one quote (use a single `as-fadeIn` entrance — a cycle of one reads as a glitch).

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | First quote fades in | 400ms |
| 0.3s | Attribution fades in below | 400ms |
| 2.8s | Quote crossfades to next | 2800ms/item |
| repeat | Cycle continues for scene duration | — |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "quotes", "targets": ["quote_cycler"], "primitive": "ed-content-cycle" },
      { "id": "logos", "targets": ["logo_row"], "primitive": "as-fadeIn", "position": ">300" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_05_social_proof",
  "duration_s": 6,
  "transition_in": { "type": "crossfade", "duration_ms": 400 },
  "camera_override": { "move": "static" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `ed-content-cycle` | The cycle itself — 2800ms per quote, opacity crossfade |
| `as-fadeIn` | Static supporting elements (logo row, section label) |

## Breakdown Reference

[text-image-reveal](../../.claude/skills/animate/reference/breakdowns/text-image-reveal.md) — editorial restraint reference: content-forward reveals where typography carries the scene and motion stays out of the way.

## Variations

- **With portraits:** pair each quote with a photo layer in the same cycle group — both crossfade together
- **Cinematic-dark:** allowed, but add `ct-scene-breathe` ambient and keep the cycle — dark palettes need subtle life behind static content
- **Hard-cut cycle (montage):** replace crossfade cycling with per-phase hard cuts — see montage personality rules before mixing
