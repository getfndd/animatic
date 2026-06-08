---
id: logo-resolve-close
title: "Logo Resolve Closing Card"
category: brand
personality: [cinematic-dark, montage]
duration: ~3s scene
primitives: [hm-logo-resolve, ct-glow-pulse, mo-text-hero]
breakdown: mercury-insights-sizzle
tags: [logo, brand, closing, tagline, logo-lockup, end-card]
---

# Logo Resolve Closing Card

The last shot: scattered marks, particles, or a wordmark's parts converge and *resolve* into the logo lockup, hold, and breathe. Every demo and sizzle reel ends here. The resolve says "all of the above adds up to this"; the hold gives the brand the final, longest beat of the video.

**When to use:** the final scene of any branded video. Non-negotiable in sizzle reels.
**When not to use:** mid-sequence — a logo resolve reads as an ending; using it early makes everything after feel like a post-credits scene.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Previous scene crossfades out | 500ms |
| 0.3s | Logo parts converge and resolve | 2200ms |
| 2.0s | Tagline resolves below the mark | 400ms |
| 2.2s+ | Glow pulse breathes behind the lockup, hold to end | 4000ms loop |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "logo", "targets": ["logo_lockup"], "primitive": "hm-logo-resolve" },
      { "id": "tagline", "targets": ["tagline"], "primitive": "mo-text-hero", "position": ">-400" },
      { "id": "ambient", "targets": ["glow_bg"], "primitive": "ct-glow-pulse" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_09_logo_close",
  "duration_s": 3.5,
  "transition_in": { "type": "crossfade", "duration_ms": 500 },
  "camera_override": { "move": "static" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `hm-logo-resolve` | The convergence — hero-moment compound, 2200ms |
| `mo-text-hero` | Tagline entrance (montage variant; use `ct-text-hero` in cinematic-dark) |
| `ct-glow-pulse` | Ambient breath behind the lockup during the hold (cinematic-dark only — montage forbids ambient motion) |

## Breakdown Reference

[mercury-insights-sizzle](../../.claude/skills/animate/reference/breakdowns/mercury-insights-sizzle.md) — the tagline → logo-lockup close shows the resolve-then-hold rhythm, and how long to hold (longer than feels comfortable in the edit; right in the export).

## Variations

- **Montage close:** whip-wipe into the resolve (`transition_in: whip_up`), drop the glow — montage forbids ambient loops
- **Quiet close (editorial):** skip the resolve; crossfade directly to a static lockup with `as-fadeIn` — restraint as confidence
- **With CTA:** add a URL/CTA line via `as-fadeIn` at `position: ">600"` — never animate the CTA aggressively; it must be readable in the final freeze
