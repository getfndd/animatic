---
name: storyboard
description: "Brief → storyboard panels with narrative arc, visual direction, and motion notes. The design checkpoint before any HTML is generated."
---

# /storyboard - Design-First Storyboarding

Transform a creative brief into a reviewable storyboard — the design checkpoint that determines whether the final video will be excellent or mediocre. Every panel must answer: what should the audience feel?

**This is not code generation.** A storyboard is a design document. It specifies intent, composition, typography, color, and motion in enough detail that a designer (or `/prototype`) can produce beautiful HTML from it — but it does NOT produce that HTML itself.

---

## Command Interface

```
/storyboard <brief.json | "prompt"> [options]
  --personality cinematic-dark|editorial|neutral-light|montage
  --style prestige|energy|dramatic|minimal|intimate|corporate|kinetic|fade
  --brand <brand_id>       (loads from catalog/brands/)
  --duration <seconds>     (total target duration, default: 30)
  --output <path>          (default: storyboards/)
```

## Philosophy

> "Design is not just what it looks like and feels like. Design is how it works." — Steve Jobs

A storyboard that specifies "fade in some cards" produces garbage. A storyboard that says "Three insight cards stack vertically, 560px max width, 14px gap, 15px/600 titles with trend icons in semantic green/slate, on 3.5% white surfaces with 6% borders at 14px radius" produces something worth rendering.

**Be specific or be bad.** There is no middle ground.

> "Less, but better." — Dieter Rams

Every panel must earn its place. If removing a panel doesn't weaken the narrative, remove it. If a transition doesn't serve the story, make it a hard cut. If a camera move doesn't reveal something new, keep it static. Restraint is the hardest skill.

---

## Execution Flow

### 1. Understand the Brief

Read the brief completely. Before writing a single panel, answer:
- **Who is the audience?** (developer, executive, designer, consumer)
- **What is the one thing they should remember?** (not three things — one)
- **What is the emotional arc?** (confident? playful? urgent? calm?)

### 2. Define the Direction

Before panels, establish:

```json
{
  "direction": {
    "narrative": "Open quiet, build through product demonstration, resolve with brand confidence",
    "tone": "Confident but not aggressive. Let the product speak.",
    "energy_arc": "quiet → build → peak → resolve → quiet"
  }
}
```

**The narrative must have shape.** If every panel has the same energy, the video is a slideshow. Professional videos have:
- A quiet opening (earn attention, don't grab it)
- A build (show the product doing something valuable)
- A peak (the moment that makes the audience want to learn more)
- A resolution (name the thing, state the value)
- A quiet close (logo, brand confidence)

### 3. Define the Brand Context

Load the brand from `catalog/brands/` or define inline. Be specific:

```json
{
  "brand": {
    "ref": "fintech-demo",
    "palette_note": "Dark navy backgrounds, warm off-white text, indigo accents",
    "typography_note": "Inter. Light weight (300) for display. Never bold for taglines.",
    "surface_note": "Subtle card surfaces with 4% white opacity. 6% borders."
  }
}
```

### 4. Write Panels

Each panel needs:

#### Required — Non-negotiable
| Field | Why it matters |
|-------|----------------|
| `intent` | If you can't say why this panel exists, delete it |
| `description` | Plain language — a human reads this for review |
| `visual_direction` | Specific typography, colors, composition. NOT "make it look nice" |
| `motion_notes` | How things enter, hold, and exit |

#### The Visual Direction Standard

**BAD** (will produce ugly output):
```
"visual_direction": "Show some cards with data"
```

**GOOD** (will produce Mercury-quality output):
```
"visual_direction": {
  "composition": "Cards centered, 560px max width, 14px gap. Vertically centered as a group.",
  "typography": "Card titles: 15px weight 600. Detail: 13px weight 400, 55% opacity. Trend icons: ↗/↘",
  "color": "Card bg: 3.5% white. Border: 6% white. Green (#34d399) for up, slate (#94a3b8) for down.",
  "surfaces": "14px border radius. 18-24px padding.",
  "reference": "Mercury insight cards — equal visual weight, stacked simply"
}
```

The difference between these two is the difference between a good video and a bad one. Be specific.

### 5. Check Quality Gates

Before saving, verify:

- [ ] Every panel has an `intent` that answers "what should the audience feel?"
- [ ] Every panel has `visual_direction` with specific sizes, weights, and colors
- [ ] The energy arc has genuine variation (not all same level)
- [ ] Transitions are intentional (each has a reason)
- [ ] At least one panel references real-world inspiration
- [ ] The storyboard works as a narrative even without seeing the visuals
- [ ] Total panel count: 7-12 for a 30s video. If more, consolidate. If fewer, you're probably skipping something.

### 6. Save Storyboard

Write to `storyboards/`:

```
storyboards/
└── {date}-{name}/
    ├── storyboard.json       # The full storyboard
    └── meta.json             # Metadata (brief ref, brand, etc.)
```

### 7. Present for Review

Output a summary table:

```
# Storyboard: [title]

| # | Act | Duration | Energy | Intent | Transition |
|---|-----|----------|--------|--------|------------|
| 1 | open | 3.0s | low | Set the tone | — |
| 2 | build | 5.0s | high | Show AI insights | crossfade |
| ...

Total: 30s | Panels: 9 | Arc: quiet→build→peak→resolve→quiet
```

**The storyboard is approved when:** a human reads the panel descriptions and `visual_direction` fields and says "yes, that's the video I want." Only then does production begin.

---

## Content Type Templates

These are the visual categories. Each maps to a `/prototype` generation approach:

| Content Type | What it contains | Design complexity |
|-------------|------------------|-------------------|
| `typography` | Centered text on dark/light field | Low — but restraint is hard |
| `insight_cards` | Vertical card stack with trends | Medium — spacing and hierarchy |
| `prompt_input` | Chat/search input with typed text | Medium — interaction simulation |
| `chart_panel` | Elevated panel with chart + controls | High — dense UI component |
| `dashboard` | Full app UI with nav + content + charts | Very high — requires product design |
| `logo_lockup` | Brand mark + wordmark + legal | Low — but precision matters |
| `device_mockup` | Product UI in a device frame | Medium — frame + content |
| `split_panel` | Two-column comparison or feature | Medium — balance and alignment |
| `stat_callout` | Large number with context | Low-medium — typography hierarchy |

---

## Act Templates

### 30-Second Product Demo (9 panels)
```
open:    1 tagline panel (3s)
build:   3 product panels (4-5s each)
peak:    1 full reveal panel (5s)
resolve: 2 tagline panels (2.5-3s each)
close:   1 logo panel (2.5s)
```

### 15-Second Social Cut (5 panels)
```
open:    1 hook panel (2s)
build:   1 product panel (4s)
peak:    1 feature panel (4s)
resolve: 1 tagline panel (3s)
close:   1 logo panel (2s)
```

### 60-Second Explainer (12-15 panels)
```
open:    1-2 problem panels (5s)
build:   4-5 solution panels (4-5s each)
peak:    2 demo panels (5-6s each)
resolve: 2-3 value panels (3-4s each)
close:   1-2 CTA + logo panels (3-4s)
```

---

## Downstream Pipeline

After storyboard approval, the production pipeline is:

```
For each panel in storyboard:
  /prototype "{panel.description}" --fidelity concept --chrome none
  → produces designed HTML

  /animate prototype.html --personality {storyboard.personality}
  → enriches with motion from panel.motion_notes

/sizzle scenes/ --style {storyboard.style}
  → captures sequence to video
```

Each step is a quality gate. Bad prototype? Fix the HTML before animating. Bad animation? Fix the timing before capturing. Don't push garbage downstream.

---

## Spec Reference

Full storyboard JSON format: `docs/cinematography/specs/storyboard-format.md`

## Related Commands

| Command | Purpose |
|---------|---------|
| `/brief` | Author the creative brief (upstream) |
| `/prototype` | Generate designed HTML for each panel (downstream) |
| `/animate` | Add motion to prototypes (downstream) |
| `/sizzle` | Capture to video (downstream) |
| `/review` | Evaluate sequence quality |
