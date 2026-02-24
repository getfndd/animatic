# Animation Reference Breakdown Schema

Template for analyzing any animation reference — video, website, GIF, or motion study. Each breakdown captures signature moments that map directly to primitive candidates in the registry.

---

## Template

Copy this template to `breakdowns/{ref-slug}.md` and fill in.

````markdown
---
ref: {ref-slug}
title: "{Descriptive Title}"
source: "{URL or file path}"
type: website | gif | video | motion-study | prototype
date: YYYY-MM-DD
personality_affinity: cinematic-dark | editorial | neutral-light | universal
tags: [tag1, tag2, tag3]
quality_tier: exemplary | strong | interesting
---

# {Title}

## Summary

2-3 sentences describing what this reference demonstrates and why it matters
for our animation vocabulary. What makes it worth studying?

## Signature Moments

The core of every breakdown. Each row is a candidate for the primitives registry.

| Timestamp / Trigger | Effect | Duration | Easing | Description |
|---------------------|--------|----------|--------|-------------|
| 0:00 / page load | focus-pull entrance | 800ms | expo-out | Hero text emerges from blur with scale 0.95 → 1.0 |
| 0:02 / after hero | staggered slide-up | 120ms interval | expo-out | Feature cards enter bottom-to-top with 120ms stagger |
| hover / card | scale + shadow lift | 200ms | ease-out | Card lifts with scale(1.02) and elevated shadow |
| scroll 40% | clip-path wipe | 600ms | expo-out | Section revealed left-to-right via inset clip-path |

### Column Guide

- **Timestamp / Trigger**: When it happens (time code for video, scroll position, or interaction trigger)
- **Effect**: Named effect — use registry primitive names when possible
- **Duration**: Total duration of the effect
- **Easing**: Easing curve used (expo-out, ease-out, spring, linear, custom)
- **Description**: What visually happens, with specific CSS property values when observable

## Technique Breakdown *(optional)*

CSS/JS implementation analysis for effects worth stealing.

```css
/* Effect name — from Signature Moments row N */
@keyframes effect-name {
  0% { /* start state */ }
  100% { /* end state */ }
}

.effect-class {
  animation: effect-name 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

## Choreography Notes *(optional)*

How the animation sequences are orchestrated. Timing relationships between
elements, speed hierarchy, staging decisions.

- What moves first, second, third?
- What speed tiers are visible?
- How do elements relate spatially during transitions?

## What We Can Steal

Specific techniques or patterns worth extracting to the primitives registry.
Each bullet should reference a Signature Moments row.

- **Effect name** — Why it works, how we'd adapt it, which personality benefits

## What to Avoid

Anti-patterns or choices that don't fit our animation philosophy.

- **Effect name** — Why it doesn't work for us (too playful, too slow, wrong context)
````

---

## Frontmatter Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `ref` | string | URL-safe slug used as filename (e.g., `linear-homepage`) |
| `title` | string | Human-readable title |
| `source` | string | URL, file path, or description of origin |
| `type` | enum | `website`, `gif`, `video`, `motion-study`, `prototype` |
| `date` | date | When the breakdown was created |
| `personality_affinity` | enum | Which personality benefits most: `cinematic-dark`, `editorial`, `neutral-light`, `universal` |
| `tags` | list | Searchable tags (e.g., `stagger`, `3d`, `typography`, `parallax`) |
| `quality_tier` | enum | `exemplary` (study deeply), `strong` (good patterns), `interesting` (one or two ideas) |

### Quality Tiers

| Tier | Criteria | Expected Detail |
|------|----------|-----------------|
| **Exemplary** | Best-in-class execution, multiple techniques worth studying | Full breakdown with Technique Breakdown and Choreography Notes |
| **Strong** | Good execution of specific techniques | Signature Moments + What We Can Steal |
| **Interesting** | One or two notable effects worth extracting | Signature Moments table only |

### Tags (Common)

`stagger`, `blur`, `focus-pull`, `clip-path`, `parallax`, `3d`, `perspective`, `spring`, `typography`, `kinetic-type`, `scroll-driven`, `content-cycle`, `morphing`, `particle`, `grid`, `ripple`, `cascade`, `ambient`, `glow`, `spotlight`, `wipe`, `reveal`, `entrance`, `exit`, `hover`, `interaction`

---

## Workflow

1. **Watch/interact** with the reference 2-3 times
2. **Log Signature Moments** — timestamp every distinct animation effect
3. **Name effects** using registry primitive names where possible, or propose new names
4. **Note implementation** — inspect CSS/JS for technique details (DevTools for websites)
5. **Extract primitives** — add new effects to `primitives/sources/breakdowns.md`
6. **Update index** — add entry to `breakdowns/INDEX.md`
