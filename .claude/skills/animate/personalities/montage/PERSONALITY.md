# Montage Personality

> "The cut is the most powerful tool in cinema. Every transition is a decision — hard cuts demand attention, wipes carry energy. Montage is rhythm made visible."

Rapid-scene energy for brand campaigns and product reels. Hard cuts, full-screen typography, stat callouts, split-screen compositions, and whip-wipe transitions. The show, not the tell. Variety as proof.

**Designed for shareability.** All tokens use CSS custom properties that can be overridden by any design system. No hardcoded colors. No framework dependencies.

## When to Use

| Use Case | Fit |
|----------|-----|
| Brand launches, sizzle reels | **Perfect** |
| Product campaigns with multiple features | **Perfect** |
| Keynote/presentation hero animations | **Perfect** |
| Stat-heavy feature showcases | **Good** |
| Landing page above-the-fold impact | **Good** |
| Content-forward product demos | Not ideal (use editorial) |
| Dramatic single-feature highlights | Not ideal (use cinematic) |
| Onboarding / tutorials | Wrong tool (use neutral-light) |

## Files

| File | Purpose |
|------|---------|
| `PERSONALITY.md` | This document — rules, choreography, do/don't |
| `motion.css` | Animation classes, keyframes, token definitions |
| `engine.js` | Reusable `MontageEngine` class (playback, transitions, animation primitives) |
| `reference.html` | Canonical reference prototype — "Introducing Velocity" |

## Token System (Decoupled)

All tokens use the `--mo-` prefix and are defined as CSS custom properties at `:root` level. Consumers can override any token to match their design system.

### Override Example

```css
/* Default montage tokens (built-in) */
:root {
  --mo-bg-body: #0a0a0a;
  --mo-text-primary: #fafafa;
}

/* Your design system override */
:root {
  --mo-bg-body: var(--your-surface-primary);
  --mo-text-primary: var(--your-text-primary);
}
```

### Engine Override Example

```js
const engine = new MontageEngine({
  phases: [...],
  titles: [...],
  tokenOverrides: {
    '--mo-accent': '#8b5cf6',
    '--mo-bg-body': '#1a1a2e',
  }
});
```

### Surface Tokens

| Token | Default (Dark) | Use |
|-------|---------------|-----|
| `--mo-bg-body` | `#0a0a0a` | Page background |
| `--mo-surface-card` | `#141414` | Card/panel background |
| `--mo-surface-secondary` | `#1c1c1c` | Nested elements, grid tiles |
| `--mo-surface-glass` | `rgba(255,255,255,0.06)` | Frosted/overlay surfaces |

### Text Tokens

| Token | Default (Dark) | Use |
|-------|---------------|-----|
| `--mo-text-primary` | `#fafafa` | Headlines, hero text |
| `--mo-text-secondary` | `#a1a1aa` (zinc-400) | Body text, subtitles |
| `--mo-text-tertiary` | `#71717a` (zinc-500) | Hints, meta, labels |
| `--mo-text-quaternary` | `#52525b` (zinc-600) | Inactive, placeholder |

### Border Tokens

| Token | Default (Dark) | Use |
|-------|---------------|-----|
| `--mo-border-subtle` | `#27272a` (zinc-800) | Card borders, dividers |
| `--mo-border-medium` | `#3f3f46` (zinc-700) | Input borders |
| `--mo-border-active` | `#8b5cf6` (violet-500) | Active/focused elements |

### Accent Tokens

| Token | Default (Dark) | Use |
|-------|---------------|-----|
| `--mo-accent` | `#8b5cf6` (violet-500) | Active states, highlights |
| `--mo-accent-bg` | `rgba(139,92,246,0.12)` | Accent backgrounds |
| `--mo-accent-text` | `#a78bfa` (violet-400) | Accent text on dark backgrounds |
| `--mo-success` | `#22c55e` (green-500) | Completion indicators |
| `--mo-success-bg` | `rgba(34,197,94,0.12)` | Success backgrounds |

## Animation Rules

### Speed Hierarchy (3 Tiers)

Montage uses 3 speed tiers — the fastest of all personalities. No SPRING tier, no ambient motion. Every millisecond earns its place.

| Tier | Duration | What | CSS Variable |
|------|----------|------|-------------|
| FAST | 100-200ms | Hard cuts, stat reveals, label swaps, text-hero entrances | `--mo-fast` |
| MEDIUM | 300-500ms | Typography entrances, whip-wipes, count-ups, scale entrances | `--mo-medium` |
| SLOW | 600-900ms | Scene dwell transitions, grid staggers, container morphs | `--mo-slow` |

### Easing

| Purpose | Variable | Value |
|---------|----------|-------|
| Elements entering | `--mo-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) |
| Elements exiting | `--mo-ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` |
| Container morphs | `--mo-ease-smooth` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| Count-up numbers | — | ease-out-quad (JS) |

Same expo-out curve as cinematic but at shorter durations — the same physical energy, compressed into rapid cuts.

### Transition Technique: Per-Phase Mixing

Montage's signature: each phase specifies its own transition type. Mix hard cuts and whip-wipes within the same reel.

**Hard cut** — instant (0ms), no animation. Phase swap in a single frame.

```css
/* Old phase instantly hidden, new phase instantly shown */
.phase.exiting { opacity: 0; }
.phase.active { opacity: 1; }
```

**Whip-wipe** — 250ms directional clip-path wipe. Four directions: left, right, up, down.

```css
@keyframes mo-whip-left {
  from { clip-path: inset(0 0 0 0); }
  to   { clip-path: inset(0 0 0 100%); }
}
```

Configure per-phase in engine:

```js
phases: [
  { id: 0, label: 'Title',   dwell: 2500, transition: 'hard-cut' },
  { id: 1, label: 'Demo',    dwell: 3500, transition: 'whip-left' },
  { id: 2, label: 'Stats',   dwell: 2500, transition: 'hard-cut' },
  { id: 3, label: 'Split',   dwell: 3000, transition: 'whip-right' },
]
```

### Entrance Technique: Scale Hero

Elements enter by scaling down from 1.15 to 1.0 while fading in:

```css
/* Initial */ opacity: 0; transform: scale(1.15);
/* Visible */ opacity: 1; transform: scale(1);
```

Use `data-stagger-group` attribute and `engine.runScaleEntrance()` for staggered reveals.

Stagger timing: **80-120ms between siblings**, **300-500ms per element**.

### Signature Effects

| Effect | When to Use | How |
|--------|-------------|-----|
| **Hard cut** | Maximum impact between contrasting scenes | Instant phase swap, no transition |
| **Whip-wipe** | Directional energy, carrying momentum | 250ms clip-path inset animation |
| **Title card** | Full-screen typography between demo scenes | Scale 1.5→1.0, centered text |
| **Stat pop** | Numeric impact with overshoot | Scale 0.8→1.05→1.0 + count-up |
| **Split screen** | Side-by-side feature comparison | Left→right staggered panel reveal |
| **Grid reveal** | Feature abundance, variety proof | 2×3 tile grid, 80ms stagger |
| **Count-up** | Stat callouts, metric impact | Animate from 0 to target with ease-out |

### Title Card Pattern

Full-screen typography cards separate demo scenes, creating rhythm and breathing room:

```
┌─────────────────────────────┐
│                             │
│       V E L O C I T Y       │
│     Real-time analytics     │
│                             │
└─────────────────────────────┘
```

Implementation: `.title-card` class + `engine.runTextHero()`. Text scales from 1.5→1.0 with expo-out easing. Keep to 2-3 words maximum.

### Stat Reveal Pattern

Stat cards pop in with overshoot, then numbers count up:

```
┌──────────┐ ┌──────────┐ ┌──────────┐
│   10M+   │ │   99.9%  │ │   <50ms  │
│  Events  │ │  Uptime  │ │ Latency  │
└──────────┘ └──────────┘ └──────────┘
```

Implementation: `engine.runStatReveal()`. Cards stagger at 150ms with `mo-stat-pop` keyframe (scale overshoot), then `runCountUp()` auto-triggers.

## Do / Don't

### Do

- Use only `--mo-` prefixed tokens — all visual properties flow from the token system
- Mix hard cuts and whip-wipes within the same reel for rhythm
- Use full-screen typography cards between demo scenes
- Show 5-7 scenes in a 30-40s loop
- Stagger at tight intervals (80-120ms) for rapid rhythm
- Use count-up numbers for stat impact
- Use scale entrances (1.15→1.0) for hero elements
- Use split-screen for feature comparisons
- Include embed mode (`?embed` query parameter support)
- Keep individual scenes to 2-4s maximum

### Don't

- Use opacity crossfade between phases (too gentle — that's editorial)
- Use 3D perspective or camera motion (that's cinematic)
- Use spring physics or interaction animations (no user simulation)
- Use ambient motion (scenes are too short to perceive it)
- Linger on any single scene >4s (kills the energy)
- Use blur effects on entrances or transitions
- Use slow easings or long durations (>800ms for anything)
- Use content cycling (scenes change too fast to cycle within)
- Use arbitrary colors — everything comes from the token system

## Decision Tree

```
Is this a rapid-scene brand showcase?
├── YES → Use montage
│   ├── Does it have contrasting scenes? → Mix hard cuts + whip-wipes
│   ├── Does it have stats/metrics? → Stat pop + count-up
│   ├── Does it compare features? → Split-screen panels
│   ├── Does it have many features? → Grid reveal (2×3)
│   ├── Does it need breathing room? → Title cards between scenes
│   └── Is it for embedding? → Add ?embed mode, hide controls
└── NO
    ├── Is it a content-forward demo? → Use editorial
    ├── Is it a dramatic single feature? → Use cinematic
    ├── Is it a tutorial? → Use neutral-light
    └── Is it an internal review? → Use default (no personality)
```

## Phase Timing Guide

| Phase Type | Dwell Time | Why |
|------------|-----------|-----|
| Title card (full-screen text) | 2.0-2.5s | Impact, read, move on |
| Product demo scene | 3.0-3.5s | Show UI, stagger reveals, comprehend |
| Stat callout | 2.0-2.5s | Pop + count-up + read |
| Split-screen comparison | 2.5-3.0s | Both panels reveal + compare |
| Feature grid | 2.5-3.0s | Stagger in 6 tiles + scan |
| Closing CTA | 2.0-2.5s | Product name + CTA visible |
| Loop pause (before restart) | 1.5s | Separation between loops |

**Total loop time for 6 phases: ~30-40s**

Longer than editorial (12-16s) and cinematic (17-20s) because montage packs more scenes. Each scene is shorter but there are more of them.

## Comparison with Other Personalities

| Dimension | Cinematic | Editorial | Montage |
|-----------|-----------|-----------|---------|
| Pacing control | Director (timed sequence) | Viewer or timed | Director (rapid cuts) |
| Content relationship | Animation is the star | Content is the star | Variety is the star |
| Transition default | Clip-path wipe (500ms) | Opacity crossfade (400ms) | Hard cut (0ms) / whip-wipe (250ms) |
| Entrance style | Focus-pull blur | Slide+fade | Scale hero / grid reveal |
| Timing | 4 tiers + spring | 3 tiers | 3 tiers (fastest) |
| Signature | 3D camera motion | Content cycling | Per-phase transition mixing |
| Ambient motion | Yes (dramatic) | Yes (subtle) | No (too fast) |
| Loop time | 17-20s | 12-16s | 30-40s |
| Scene count | 4-5 | 3-5 | 5-7 |
| Use case | Feature highlights | Product showcases | Sizzle reels, brand launches |

## Reference Products

- **Apple keynotes** — rapid cuts, full-screen typography, stat callouts, product beauty shots
- **Stripe Sessions** — whip transitions, split-screen comparisons, metric callouts
- **Linear launch videos** — hard cuts, dark palette, compressed energy
- **Vercel ship announcements** — rapid feature montages, grid reveals, dark mode
- **Arc launch reel** — split-screen, variety proof, rapid cuts between features
