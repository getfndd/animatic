---
id: ambient-brand-loop
title: "Ambient Brand Loop"
category: ambient
personality: [cinematic-dark]
duration: loop (6–12s cycle)
primitives: [bk-flow-field, ct-aurora-gradient, bk-sparse-breathe]
breakdown: flow-field-vortex
tags: [ambient, background, loop, generative, brand, atmosphere]
---

# Ambient Brand Loop

A continuously-living background — flow-field lines, aurora gradients, or a breathing dot grid — that runs *behind* foreground content or stands alone as an atmosphere beat. Nothing enters, nothing exits; the scene is already alive when we cut to it and still alive when we leave. Ambient loops establish mood without making a claim.

**When to use:** opening atmosphere before the first message, backgrounds behind statement typography, holding scenes for narration-heavy passages.
**When not to use:** behind data or UI content — ambient motion competes with information. Montage personality forbids ambient motion entirely.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Loop already in motion at cut-in (start mid-cycle) | — |
| 0–N | Flow field / gradient / grid breathes continuously | 6–12s cycle |
| any | Foreground typography enters independently if present | per its own group |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "drift", "intensity": 0.1 },
    "groups": [
      { "id": "field", "targets": ["flow_bg"], "primitive": "bk-flow-field" },
      { "id": "statement", "targets": ["headline"], "primitive": "ct-char-stagger", "position": ">500" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_01_atmosphere_open",
  "duration_s": 4,
  "camera_override": { "move": "drift", "intensity": 0.1 }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `bk-flow-field` | Directional line-segment vortex — high-energy ambient |
| `ct-aurora-gradient` | Multi-gradient drift — soft, premium ambient |
| `bk-sparse-breathe` | Sparse dot grid breathing — the quietest option, works behind text |

## Breakdown Reference

[flow-field-vortex](../../.claude/skills/animate/reference/breakdowns/flow-field-vortex.md) — generative ambient reference. See also [sparse-dot-breathing](../../.claude/skills/animate/reference/breakdowns/sparse-dot-breathing.md) and, for light palettes, [nl-dot-grid-breathing](../../.claude/skills/animate/reference/breakdowns/nl-dot-grid-breathing.md).

## Variations

- **Neutral-light:** swap to `bk-nl-dot-breathe` — same role, light-palette grammar
- **Brand-blob variant:** `bk-metaball-gooey` or `bk-blob-morph` for organic brand identities — see [grainy-organic-blob](../../.claude/skills/animate/reference/breakdowns/grainy-organic-blob.md)
- **Texture pass:** layer `bk-grain-texture` or `ct-film-grain` over any ambient for filmic depth — texture, not motion, so it survives `prefers-reduced-motion` policies
