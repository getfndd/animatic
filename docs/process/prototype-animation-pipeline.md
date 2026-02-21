# Prototype Animation Pipeline

End-to-end guide for transforming interactive prototypes into polished, self-running animated demos with video capture and distribution.

## Overview

The animation pipeline converts static or interactive HTML prototypes into cinematic product walkthroughs suitable for landing pages, marketing emails, investor decks, and documentation. It produces self-running autoplay HTML files, captured video in multiple formats, and complete distribution kits.

**What it produces:**
- Autoplay HTML with playback controls and `?embed` mode
- Video captures (WebM, MP4, AV1, HEVC, ProRes, GIF)
- Social media variants (square, landscape, portrait)
- Email kits (static PNG, animated GIF, Apple Mail MP4)
- Embed snippets for landing pages

## The Three Skills

| Skill | Command | Purpose |
|-------|---------|---------|
| **Prototype** | `/prototype "description"` | Build the interactive prototype with ITO design system tokens |
| **Animate** | `/animate <path> [options]` | Transform prototype into self-running animated demo |
| **Review** | `@maya animate review [path]` | Evaluate animation quality against theme rules and Disney's principles |

Each skill is independent — you can enter the pipeline at any point. `/prototype` creates raw material, `/animate` adds motion, `@maya animate review` provides quality feedback.

## End-to-End Workflow

```
1. BUILD         /prototype "feature description"
                 → prototypes/{date}-{name}/concept-v1.html

2. THEME         /animate <path> --theme cinematic-dark
                 → prototypes/{date}-{name}/autoplay-v1.html

3. REVIEW        @maya animate review prototypes/{date}-{name}/autoplay-v1.html
                 → Scorecard with pass/fail per quality item

4. ITERATE       Fix issues identified in review, re-run review

5. CAPTURE       /animate <path> --mode capture --kit
                 → captures/ directory with all formats

6. DISTRIBUTE    Use embed.html for landing pages,
                 social/ for social media, email/ for campaigns
```

## Theme Selection Guide

Choose a theme based on the animation's purpose and audience:

```
What are you building?
├── Marketing demo / landing page hero
│   └── cinematic-dark (3D perspective, clip-path wipes, spring physics)
├── Onboarding tutorial / help documentation
│   └── neutral-light (spotlight, cursor sim, step indicators, gentle transitions)
├── Internal review / quick iteration
│   └── default (light UI, fade+translate, no theme files)
├── Data visualization / dashboard
│   └── dashboard (planned)
└── Brand campaign / launch event
    └── brand-campaign (planned)
```

| Theme | Best For | Transitions | Entrances | Camera |
|-------|----------|-------------|-----------|--------|
| `cinematic-dark` | Marketing, investor decks | Clip-path wipes | Focus-pull (blur→sharp) | 3D perspective |
| `neutral-light` | Tutorials, onboarding, docs | Opacity crossfade | Slide+fade (translateY) | None (flat) |
| `default` | Internal reviews | Opacity fade | Translate | None |

## Three-Layer Architecture

Every themed animation separates concerns into three independent layers:

```
┌─────────────────────────────────────┐
│  THEME                               │
│  Visual identity: colors, shadows,   │
│  radii, typography, camera angles    │
│                                      │
│  THEME.md — rules & decision tree    │
│  theme.css — design tokens + classes │
├─────────────────────────────────────┤
│  ENGINE                              │
│  Mechanics: phase transitions,       │
│  staggers, animation primitives,     │
│  playback controls, embed mode       │
│                                      │
│  engine.js — reusable class          │
├─────────────────────────────────────┤
│  CONTENT                             │
│  Prototype-specific: HTML structure, │
│  data, phase callbacks, interactions │
│                                      │
│  autoplay-vN.html — per-prototype    │
└─────────────────────────────────────┘
```

**Theme** changes when the visual identity evolves. **Engine** changes when new animation capabilities are needed. **Content** changes for every new prototype.

## File Structure

```
.claude/skills/animate/
├── SKILL.md                          # Skill definition + command interface
├── reference/
│   ├── animation-principles.md       # Disney's 12 principles for UI
│   ├── spring-physics.md             # Spring recipes + icon wiggle
│   ├── industry-references.md        # Gold-standard products
│   └── cinematic-techniques-research.md
└── themes/
    ├── cinematic-dark/
    │   ├── THEME.md                  # Rules, do/don't, decision tree
    │   ├── theme.css                 # Tokens + component classes
    │   ├── engine.js                 # CinematicDarkEngine class
    │   └── reference.html            # Canonical example
    └── neutral-light/
        ├── THEME.md                  # Rules, do/don't, decision tree
        ├── theme.css                 # Tokens + component classes
        ├── engine.js                 # NeutralLightEngine class
        └── reference.html            # Canonical example

scripts/
└── capture-prototype.mjs             # Puppeteer + ffmpeg capture pipeline

docs/design-patterns/
└── motion-design-system.md           # Taxonomy, principles, theme roadmap
```

## Common Workflows

### Marketing Demo

Quick path for a landing page hero animation:

```bash
# 1. Prototype the feature
/prototype "data room upload with AI rename" --fidelity concept

# 2. Animate with cinematic theme
/animate prototypes/2026-02-19-dataroom-upload/concept-v1.html --theme cinematic-dark

# 3. Review quality
@maya animate review prototypes/2026-02-19-dataroom-upload/autoplay-v1.html

# 4. Capture for web
/animate prototypes/2026-02-19-dataroom-upload/autoplay-v1.html --mode capture --format webm
```

### Onboarding Tutorial

Step-by-step guide with spotlight and cursor simulation:

```bash
# 1. Prototype the flow
/prototype "data room setup onboarding" --fidelity concept

# 2. Animate with neutral-light theme
/animate prototypes/2026-02-21-dataroom-onboarding/concept-v1.html --theme neutral-light

# 3. Review
@maya animate review prototypes/2026-02-21-dataroom-onboarding/autoplay-v1.html

# 4. Embed directly (HTML iframe, no video capture needed)
# <iframe src="autoplay-v1.html?embed" width="640" height="480"></iframe>
```

### Internal Review

Fast iteration without theme overhead:

```bash
# Animate with default theme (no --theme flag)
/animate prototypes/2026-02-21-settings-page/concept-v1.html

# Preview in browser — no capture needed
```

### Full Distribution Kit

Complete asset generation for multi-channel distribution:

```bash
# Generate everything: all video formats + social + embed + thumbnail + email
/animate prototypes/2026-02-19-dataroom-upload/autoplay-v1.html --mode capture --kit

# Output:
# captures/
# ├── dataroom-upload-master.mov     (ProRes lossless)
# ├── thumb.png                       (thumbnail)
# ├── web/                            (WebM, MP4, AV1, HEVC, GIF)
# ├── social/                         (square, landscape, portrait)
# ├── embed/                          (embed.html + iframe snippet)
# └── email/                          (600w PNG, GIF, MP4, HTML snippet)
```

## Troubleshooting

### Fonts Not Loading

The pipeline uses Satoshi via Fontshare CDN. If fonts appear as system fallbacks:
- Check network connectivity (the CDN link is in the `<head>`)
- The capture script waits 150ms for font load — increase if needed
- For offline use, download Satoshi and reference locally

### Embed Mode Issues

If `?embed` mode doesn't work correctly:
- Verify the autoplay file checks for `new URLSearchParams(window.location.search).has('embed')`
- Ensure the engine's `applyEmbedMode()` runs on boot
- Card shadows may clip at iframe edges — add generous padding (56px+) in the iframe container

### Capture Quality

If captured video looks blurry or has artifacts:
- The capture script runs at 2x device scale by default — don't reduce this
- Use `--deterministic` for frame-perfect capture (overrides rAF timing)
- PNG frames capture alpha — ensure ffmpeg encodes with alpha for WebM/HEVC
- GIF requires gifski for high quality — the built-in ffmpeg GIF encoder is poor

### Loop Replay Glitches

If animations don't reset cleanly between loops:
- All stagger timing must use JS class toggling, not CSS `animation-delay`
- CSS `animation-delay` only fires once — JS timers reset properly
- SVG `stroke-dashoffset` must be explicitly reset in the cleanup function
- Check that `resetAllAnimations()` covers every animated element class

### Phase Height Jumps

If the card container snaps instead of smoothly animating height:
- `measurePhases()` must run after fonts load (the 150ms delay handles this)
- Focus-enter items must be temporarily shown at full opacity during measurement
- Folder badges must be temporarily visible during measurement
- The measuring class sets `position: static` so `scrollHeight` is accurate
