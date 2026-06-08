---
id: product-hero-push-in
title: "Product Hero with Push-In + Text Reveal"
category: hero
personality: [cinematic-dark]
duration: ~4s scene
primitives: [ct-text-hero, ct-char-stagger, ct-slow-push]
breakdown: linear-homepage
tags: [hero, typography, camera, push-in, entrance, product-demo]
---

# Product Hero with Push-In + Text Reveal

The canonical opening shot: a product screenshot or brand statement holds center frame while the camera pushes in slowly and the headline resolves character by character. The push-in adds gravity; the per-character stagger adds craft. Use it to open a demo or sizzle reel when you want the first three seconds to feel deliberate, not busy.

**When to use:** opening scene of a product demo, hero moment before a feature run, brand statement beats.
**When not to use:** mid-sequence (the slow push reads as a restart), neutral-light tutorials (3D depth and dramatic scale violate the personality).

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Background and product frame are present (no entrance — confidence) | — |
| 0.2s | Headline resolves via per-character stagger | 30ms/char |
| 0.8s | Sub-line fades in under the headline | 400ms |
| 0.0–4.0s | Camera pushes in continuously, peak at 70% | full scene |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "push_in", "intensity": 0.2, "sync": { "peak_at": 0.7 } },
    "groups": [
      { "id": "headline", "targets": ["headline"], "primitive": "ct-char-stagger" },
      { "id": "subline", "targets": ["subline"], "primitive": "as-fadeIn", "position": ">200" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_01_hero",
  "duration_s": 4,
  "camera_override": { "move": "push_in", "intensity": 0.2, "easing": "cinematic_scurve" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `ct-text-hero` | Alternative headline treatment — dramatic scale resolve instead of per-character |
| `ct-char-stagger` | Headline reveal, 30ms/char |
| `ct-slow-push` | Ambient camera fallback when the scene camera is owned by another move |

## Breakdown Reference

[linear-homepage](../../.claude/skills/animate/reference/breakdowns/linear-homepage.md) — study the speed hierarchy: the slowest element (camera) sets the gravity, the fastest (character stagger) sets the craft. Nothing moves at the same speed.

## Variations

- **Statement-only:** drop the product frame, run `ct-text-hero` full-bleed — see [kinetic-type-statement](kinetic-type-statement.md)
- **Editorial:** swap `ct-char-stagger` for `ed-blur-reveal` is **not allowed** (blur entrances violate editorial); use `as-fadeInUp` and a static camera instead
- **Montage:** use [montage-sizzle-open](montage-sizzle-open.md) — hard cuts, no push
