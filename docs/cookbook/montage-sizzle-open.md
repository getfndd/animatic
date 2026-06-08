---
id: montage-sizzle-open
title: "Montage Sizzle Open"
category: hero
personality: [montage]
duration: ~2s per shot
primitives: [mo-text-hero, mo-scale-entrance, mo-stat-reveal]
breakdown: mercury-insights-sizzle
tags: [sizzle, montage, whip, opening, hard-cut, rapid, brand-launch]
---

# Montage Sizzle Open

The high-energy cold open: 3–5 shots of ~2s each, hard cuts and whip-wipes, each shot landing one element fast — a word, a UI fragment, a stat. No ambient motion, no slow builds; energy comes from the *cut rhythm*, not from any single animation. By shot four the viewer knows the product's tempo before they know its name.

**When to use:** sizzle reels, brand launches, event openers, anything competing for attention in a feed.
**When not to use:** tutorials or trust-building demos — montage tempo reads as hype, which undercuts instruction.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| Shot 1 (0–2s) | Word slams in (`mo-text-hero`) | 400ms in, hold |
| Shot 2 (2–4s) | UI fragment scales in (`mo-scale-entrance`), whip-wipe entry | 250ms whip |
| Shot 3 (4–6s) | Stat pops (`mo-stat-reveal`) | 150ms interval |
| Shot 4 (6–8s) | Second word or logo tease, hard cut | — |

## Manifest Snippet

Sequence manifest — the pattern lives in the cut structure:

```json
{
  "sequence_id": "seq_sizzle_open",
  "fps": 60,
  "scenes": [
    { "scene": "sc_01_word", "duration_s": 2 },
    { "scene": "sc_02_ui_fragment", "duration_s": 2, "transition_in": { "type": "whip_left", "duration_ms": 250 } },
    { "scene": "sc_03_stat", "duration_s": 2, "transition_in": { "type": "hard_cut" } },
    { "scene": "sc_04_word_2", "duration_s": 2, "transition_in": { "type": "whip_up", "duration_ms": 250 } }
  ]
}
```

Per-shot motion block (shot 3):

```json
{
  "motion": {
    "groups": [
      { "id": "stat", "targets": ["stat_block"], "primitive": "mo-stat-reveal" }
    ]
  }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `mo-text-hero` | Word shots — fast, heavy type entrance |
| `mo-scale-entrance` | UI fragment shots — 100ms-interval scale pops |
| `mo-stat-reveal` | Stat shots — pop without count-up (montage is too fast for counting) |

## Breakdown Reference

[mercury-insights-sizzle](../../.claude/skills/animate/reference/breakdowns/mercury-insights-sizzle.md) — study the shot lengths and where the whips land: whips connect related shots; hard cuts separate ideas.

## Variations

- **Beat-synced:** with a music track, align cuts via `analyze_beats` + `sync_sequence_to_beats` — montage without beat alignment wastes its main weapon
- **Close the loop:** end the reel with [logo-resolve-close](logo-resolve-close.md) (montage variant, no ambient glow)
- **Personality discipline:** montage forbids 3D, blur, and ambient motion — if a shot needs depth or atmosphere, it belongs to a different personality and a different video
