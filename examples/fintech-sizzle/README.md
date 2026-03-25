# Mercury Insights — Example Sizzle Reel

Recreation of Mercury's "Introducing Insights" product sizzle reel using Animatic's cinematography pipeline. Based on the [breakdown analysis](../../.claude/skills/animate/reference/breakdowns/mercury-insights-sizzle.md).

## Scenes

| # | Scene | Duration | Primitive/Recipe | Camera |
|---|-------|----------|-----------------|--------|
| 1 | Opening tagline | 3.0s | `fade-in` | static |
| 2 | Insight cards cascade | 5.0s | `cd-insight-card-cascade` | push_in 0.15 |
| 3 | AI prompt input | 4.0s | `cd-panel-drilldown` + `cd-typewriter` | static |
| 4 | Chart drilldown | 5.0s | `cd-panel-drilldown` + `cd-bar-grow` | push_in 0.1 |
| 5 | Follow-up prompt | 3.5s | `cd-card-cascade` + `cd-typewriter` | static |
| 6 | Dashboard reveal | 5.0s | `cd-card-cascade` + `fade-in` | pull_out 0.4 |
| 7 | "Introducing Insights" | 3.0s | `fade-in` | static |
| 8 | "Radically different" | 2.5s | `fade-in` | static |
| 9 | Mercury logo | 2.5s | `fade-in` | static |

**Total:** 33.5s (authored) → 27.0s (planned by prestige style pack)

## Quality Scores

- **Avg critique:** 89/100
- **Sequence evaluation:** 80/100 (Pacing 91, Variety 100, Flow 64, Adherence 100)

## What's demonstrated

- **New primitives:** `cd-bar-grow`, `cd-card-cascade`, `cd-panel-drilldown`
- **New recipes:** `cd-insight-card-cascade`, `cd-bar-chart-reveal`
- **Brand tokens:** Mercury brand (`catalog/brands/mercury.json`)
- **Typewriter interaction:** `cd-typewriter` for AI prompt input simulation
- **Camera choreography:** push_in for detail scenes, pull_out for dashboard reveal
- **Multi-group motion:** panel + staggered bars + delayed labels in scene 4

## What's not recreated (capability gaps)

- Particle dissolve transitions (needs WebGL — see breakdown)
- Timeline date picker drag interaction
- Particle still life bookends

## Render

```bash
# Preview in Remotion Studio
npm run remotion:studio

# Render to MP4
npx remotion render Sequence --props examples/mercury-insights/manifest.json --output renders/mercury-insights.mp4
```

## Brand

Uses `catalog/brands/mercury.json` — dark navy (#1a1a2e), warm off-white (#e8e0d4), Inter font, card/panel surfaces with subtle borders and deep shadows.
