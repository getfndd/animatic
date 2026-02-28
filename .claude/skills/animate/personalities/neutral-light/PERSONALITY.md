# Neutral Light Personality

> **Architecture note:** Tutorial primitives (spotlight, cursor simulation, step indicators, tooltips) have been extracted to `primitives/tutorial/`. The neutral-light personality composes editorial choreography + tutorial primitives + light mode colors. See `docs/design-patterns/motion-design-system.md` for the 3+2 personality model.

Approachable, educational light environment with spotlight highlights, cursor simulation, step indicators, and gentle slide+fade transitions. Designed for onboarding tutorials, help documentation, changelog introductions, and internal reviews.

## When to Use

| Use Case | Fit |
|----------|-----|
| Onboarding / first-time user experience | **Perfect** |
| Help center / documentation walkthroughs | **Perfect** |
| Changelog feature introductions | **Good** |
| Internal prototype reviews | **Good** |
| Marketing demos / landing page hero | Not ideal (use cinematic) |
| Brand campaigns | Wrong tool |

## Files

| File | Purpose |
|------|---------|
| `motion.css` | All tokens, component classes, keyframes, and layout |
| `engine.js` | Reusable `NeutralLightEngine` class (playback, transitions, animation primitives) |
| `reference.html` | Canonical reference prototype (Data Room Setup onboarding) |
| `PERSONALITY.md` | This document |

## Color Rules

### Surfaces (Light ITO Palette)

All backgrounds use warm stone tones. Clean and professional, never stark white.

| Token | Value | Use |
|-------|-------|-----|
| `--nl-bg-body` | `#fafaf9` (stone-50) | Page background |
| `--nl-surface-card` | `#ffffff` | Card/panel background |
| `--nl-surface-secondary` | `#f5f5f4` (stone-100) | Nested elements, secondary surfaces |
| `--nl-surface-hover` | `#e7e5e4` (stone-200) | Hover states |

### Text (Stone Dark)

| Token | Value | Use |
|-------|-------|-----|
| `--nl-text-primary` | `#1c1917` (stone-900) | Headings, primary labels |
| `--nl-text-secondary` | `#44403c` (stone-700) | Body text, subtitles |
| `--nl-text-tertiary` | `#78716c` (stone-500) | Hints, meta, timestamps |
| `--nl-text-quaternary` | `#a8a29e` (stone-400) | Inactive icons, step labels |

### Borders

| Token | Value | Use |
|-------|-------|-----|
| `--nl-border-subtle` | `#e7e5e4` (stone-200) | Card borders, dividers |
| `--nl-border-medium` | `#d6d3d1` (stone-300) | Input borders, stronger dividers |
| `--nl-border-active` | `#3b82f6` (blue-500) | Active/focused elements |

### Accents

| Token | Value | Use |
|-------|-------|-----|
| `--nl-accent` | `#3b82f6` (blue-500) | Active states, links, spotlight border |
| `--nl-accent-bg` | `#eff6ff` (blue-50) | Active backgrounds, spotlight fill |
| `--nl-accent-text` | `#1d4ed8` (blue-700) | Accent text on light backgrounds |
| `--nl-success` | `#16a34a` (green-600) | Completion indicators, done states |
| `--nl-success-bg` | `#f0fdf4` (green-50) | Success backgrounds |

## Animation Rules

### Speed Hierarchy (3 Tiers)

Gentler than cinematic. No SPRING tier — tutorials don't need dramatic spring presses.

| Tier | Duration | What | CSS Variable |
|------|----------|------|-------------|
| FAST | 150-200ms | Step dots, cursor blink, label swaps | `--nl-fast` |
| MEDIUM | 300-400ms | Content slide+fade, spotlight transition | `--nl-medium` |
| SLOW | 500-650ms | Container height, stagger sequences | `--nl-slow` |

### Easing

| Purpose | Variable | Value |
|---------|----------|-------|
| Elements entering | `--nl-ease-out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (ease-out-quart) |
| Elements exiting | `--nl-ease-in` | `cubic-bezier(0.55, 0.06, 0.68, 0.19)` |
| Height changes | `--nl-ease-smooth` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| Spotlight movement | `--nl-ease-out` | Same as entering |
| Progress bars | — | `linear` (always) |

No spring `linear()` curves — tutorials use predictable, gentle motion.

### Transition Technique: Opacity Crossfade

Phase content transitions use simple opacity crossfade — not clip-path wipes.

```css
/* Hidden (waiting) */  opacity: 0; pointer-events: none;
/* Active (visible) */  opacity: 1; pointer-events: auto;
/* Exiting (leaving) */ opacity: 0; pointer-events: none;
```

This is deliberately gentler than cinematic's directional wipes. Tutorials prioritize clarity over drama.

### Entrance Technique: Slide+Fade

Elements enter by sliding up slightly while fading in:

```css
/* Initial */ opacity: 0; transform: translateY(8px);
/* Visible */ opacity: 1; transform: translateY(0);
```

Use `data-slide-group` attribute and `engine.runSlideStagger()` for staggered reveals.

No blur effects — tutorials should feel sharp and clear from the first frame.

### Signature Effects

| Effect | When to Use | How |
|--------|-------------|-----|
| **Spotlight** | Drawing attention to a specific UI area | Semi-transparent overlay with cutout around target element |
| **Cursor simulation** | Showing where the user should click | Animated SVG arrow cursor moving to target coordinates |
| **Step indicators** | Showing progress through a multi-step tutorial | Numbered horizontal dots with connector lines |
| **Positioned tooltips** | Explaining what a UI element does | Callout box with arrow pointing to target |

## Do / Don't

### Do

- Use only tokens from `motion.css` — all colors are prefixed `--nl-`
- Maintain 3-tier speed hierarchy in every transition
- Use opacity crossfade for phase transitions (not clip-path wipes)
- Use slide+fade for row/card entrances (not focus-pull blur)
- Use spotlight to guide attention to specific UI areas
- Include embed mode (`?embed` query parameter support)
- Use step indicators for multi-step tutorials
- Use Phosphor icons for all SVG icons (same as production app)

### Don't

- Add 3D perspective, camera motion, or `perspective: Xpx`
- Use clip-path wipe transitions (that's cinematic's identity)
- Use focus-pull blur entrances (too dramatic for tutorials)
- Add spring physics interactions (tutorials don't simulate button presses)
- Use glassmorphism, gradients, or backdrop-filter
- Use ambient glows, colored shadows, or bloom effects
- Use arbitrary hex colors — everything comes from the token system
- Make the animation feel "cinematic" — tutorials should feel helpful and clear

## Decision Tree

```
Is this an educational/tutorial animation?
├── YES → Use neutral-light
│   ├── Does it have 3+ steps? → Full engine with step indicators
│   ├── Does it have 1-2 steps? → Simplified engine (no step dots)
│   └── Is it for in-app embed? → Add ?embed mode, hide controls
└── NO
    ├── Is it a marketing demo? → Use cinematic
    ├── Is it a brand campaign? → Evaluate case-by-case
    └── Is it an internal review? → Use default (no theme)
```

## Phase Timing Guide

| Phase Type | Dwell Time | Why |
|------------|-----------|-----|
| Welcome / intro with step indicator | 2.5-3.0s | Read title, orient to steps |
| Action with spotlight + cursor | 3.0-3.5s | Spotlight + cursor movement + settle |
| Content reveal with slide stagger | 3.0-3.5s | Items need time to appear and register |
| Completion / success summary | 2.5-3.0s | Landing moment, CTA glow |
| Loop pause (before restart) | 1.5s | Separation between loops |

**Total loop time for 4 phases: ~13-15s**

Shorter than cinematic (17-19s) because tutorials are more focused and don't need dramatic pauses.
