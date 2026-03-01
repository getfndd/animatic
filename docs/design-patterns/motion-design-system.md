# Motion Design System

How Animatic codifies, produces, and governs animation across prototypes, marketing assets, and the production app.

## The Problem

Every animated prototype is a one-off. Colors, timings, easing curves, and interaction patterns get reinvented each time. When something looks good, it's trapped in a single HTML file. When we want to create a new demo, we start from scratch.

## The Solution: Personality-Based Animation System

We organize animation around two independent axes:

1. **Personality** — the animation behavior, choreography, timing, and primitives
2. **Mode** — the color environment (light or dark)

A personality defines *how things move*. A mode defines *what color they are*. The same editorial personality can run on a dark landing page or a light in-app embed. The same cinematic personality works in a dark landing page hero or a light investor deck.

### Three-Layer Architecture

```
┌────────────────────────────────────────┐
│  PERSONALITY + MODE                     │
│                                         │
│  Personality: animation primitives,     │
│  choreography patterns, timing,         │
│  easing, signature effects              │
│                                         │
│  Mode: color tokens (light/dark),       │
│  surface colors, text colors, shadows   │
│                                         │
│  PERSONALITY.md — rules & decision tree │
│  motion.css — animation classes         │
│  {mode}.css — color tokens              │
├────────────────────────────────────────┤
│  ENGINE                                 │
│  Mechanics: phase transitions,          │
│  staggers, typewriter, progress,        │
│  playback controls, embed mode          │
│                                         │
│  engine.js — reusable class             │
├────────────────────────────────────────┤
│  CONTENT                                │
│  Prototype-specific: HTML structure,    │
│  data, phase callbacks, interactions    │
│                                         │
│  autoplay-vN.html — per-prototype       │
└────────────────────────────────────────┘
```

### What Each Layer Owns

| Layer | Contains | Changes When |
|-------|----------|-------------|
| **Personality** | Animation primitives, choreography patterns, timing rules, easing curves, signature effects | New animation style needed |
| **Mode** | Color tokens (surfaces, text, borders, accents), shadows, visual weight | Demo context changes (landing page vs in-app) |
| **Engine** | Phase management, animation primitives, playback, embed mode | New animation capabilities needed |
| **Content** | HTML structure, phase config, titles, data, interaction callbacks | New prototype created |

### File Structure

```
.claude/skills/animate/
├── SKILL.md                          # Skill definition + --personality flag
├── reference/                        # Shared animation knowledge
│   ├── animation-principles.md       # Disney's 12 principles for UI
│   ├── spring-physics.md             # Spring recipes
│   ├── industry-references.md        # Gold-standard products
│   └── cinematic-techniques-research.md  # Camera, focus-pull, clip-path
├── personalities/
│   ├── cinematic/                    # Cinematic personality (built)
│   │   ├── PERSONALITY.md            # Rules, choreography, do/don't
│   │   ├── motion.css                # Animation classes, keyframes (mode-independent)
│   │   ├── engine.js                 # CinematicDarkEngine class
│   │   ├── modes/
│   │   │   └── dark.css              # Dark color tokens (--cd-*)
│   │   └── reference.html            # Canonical example
│   ├── editorial/                    # Editorial personality (built)
│   │   ├── PERSONALITY.md            # Rules, choreography, do/don't
│   │   ├── motion.css                # Tokens + animation classes (--ed- prefix)
│   │   ├── engine.js                 # EditorialEngine class
│   │   └── reference.html            # Canonical example (Product Search demo)
│   └── neutral-light/               # Neutral light personality (tutorial-focused)
│       ├── PERSONALITY.md            # Rules, do/don't, decision tree
│       ├── motion.css                # Tokens + component classes (--nl- prefix)
│       └── engine.js                 # NeutralLightEngine class
└── primitives/
    └── tutorial/                     # Pedagogical primitives (compose with any engine)
        ├── tutorial-primitives.js    # spotlight, cursorTo, tooltip, stepProgress
        ├── tutorial.css              # Spotlight, cursor, tooltip, step indicator styles
        └── README.md                 # Usage documentation
```

## Workflow: Creating a New Animated Demo

1. **Start with `/prototype`** — build the interactive prototype with ITO design system tokens
2. **Choose a personality** — what animation behavior fits the story? (cinematic for drama, editorial for content, tutorial for teaching)
3. **Choose a mode** — light or dark, based on where this will be embedded
4. **Run `/animate`** — the skill reads the prototype, loads the personality + mode, and generates the autoplay
5. **Content layer only** — the generated file uses personality tokens and engine class, only writing new HTML and phase config
6. **Capture** — `--mode capture` to produce WebM/MP4 for embedding

> **Current syntax:** `--personality cinematic --color-mode dark`. The old `--theme cinematic-dark` is supported as a deprecated alias.

## Motion Design Taxonomy

Not all animation serves the same purpose. Different contexts need different approaches.

### Category 1: Feature Highlight

**Purpose:** Demonstrate a specific product feature in action. Show the "before and after" or the complete workflow.

| Property | Value |
|----------|-------|
| Duration | 15-20s loop |
| Phases | 3-6 distinct UI states |
| Interaction | Simulated user actions (click, drag, type) |
| Personality | Cinematic (dramatic), Editorial (content-forward) |
| Mode | Dark (landing pages), Light (docs, in-app) |
| Embed | Landing page hero, feature section, email header |
| Example | Data Room Upload with AI Rename |

**Techniques:** Phase-based transitions, spring button press, typewriter reveals, progress visualization, self-drawing checkmarks, stagger entrances.

**When:** New feature launch, landing page hero, product tour, investor deck.

### Category 2: Onboarding / Tutorial

**Purpose:** Guide a user through a process step by step. Teach, don't just show.

| Property | Value |
|----------|-------|
| Duration | 30-60s (longer, educational) |
| Phases | Sequential steps with pauses |
| Interaction | Highlighted click targets, cursor animation |
| Personality | Editorial + tutorial primitives |
| Mode | Light (approachable), Dark (help centers) |
| Embed | In-app tooltip, help center, onboarding modal |

**Techniques:** Spotlight/highlight focus, cursor movement simulation, tooltip reveals, numbered step indicators, gentle transitions (no 3D, no wipes).

**When:** First-time user experience, help documentation, changelog feature intro.

### Category 3: Status & Progress

**Purpose:** Communicate ongoing state — loading, processing, syncing, uploading.

| Property | Value |
|----------|-------|
| Duration | Indefinite (matches actual process) |
| Phases | Single state with progress indication |
| Interaction | None (passive) |
| Personality | Processing primitives (shared across personalities) |
| Mode | Matches surrounding UI context |
| Embed | Inline in the product UI |

**Techniques:** Step dot progress, animated progress bars, spinner with label transitions, skeleton loading, pulse effects.

**When:** File upload, AI processing, data sync, search indexing.

### Category 4: Micro-Interaction

**Purpose:** Provide instant feedback for a single user action. Acknowledge, confirm, delight.

| Property | Value |
|----------|-------|
| Duration | 150-400ms |
| Phases | 1 (single state change) |
| Interaction | Direct response to user action |
| Personality | N/A (production CSS, not prototype animations) |
| Embed | Production React components |

**Techniques:** Spring press, icon wiggle, scale bounce, color transition, checkmark draw, ripple, tooltip fade.

**When:** Button click, toggle switch, form validation, save confirmation, delete acknowledgment.

### Category 5: Brand & Marketing

**Purpose:** Establish visual identity, create emotional connection, build anticipation.

| Property | Value |
|----------|-------|
| Duration | 5-15s (short, looping) |
| Phases | 1-2 (atmospheric, not functional) |
| Interaction | None (ambient) |
| Personality | Montage, Cinematic |
| Mode | Typically dark (brand impact) |
| Embed | Landing page background, social media, email |

**Techniques:** Parallax depth, gradient shifts, particle systems, ambient motion, scroll-driven reveals, kinetic typography.

**When:** Product launch announcement, brand refresh, marketing campaign, social media content.

### Category 6: Data Visualization

**Purpose:** Make numbers and relationships comprehensible through motion.

| Property | Value |
|----------|-------|
| Duration | 3-10s per visualization |
| Phases | Build-up → reveal → highlight |
| Interaction | Hover tooltips, filter transitions |
| Personality | Editorial (content-forward reveal) |
| Mode | Matches dashboard context |
| Embed | Dashboard, reports, investor updates |

**Techniques:** Counter animation (number roll-up), bar/line chart drawing, pie chart segment reveals, connection line animations, highlight pulses.

**When:** Cap table visualization, revenue charts, usage analytics, portfolio performance.

### Taxonomy Summary

| Category | Duration | Phases | Personality | Primary Use |
|----------|----------|--------|-------------|-------------|
| Feature Highlight | 15-20s | 3-6 | Cinematic, Editorial | Landing pages, marketing |
| Onboarding | 30-60s | Sequential | Editorial + tutorial primitives | In-app, help center |
| Status & Progress | Indefinite | 1 | Processing (primitives) | Product UI |
| Micro-Interaction | 150-400ms | 1 | N/A (production CSS) | Component-level |
| Brand & Marketing | 5-15s | 1-2 | Montage, Cinematic | Social, email, launch |
| Data Visualization | 3-10s | Build→reveal | Editorial | Reports, analytics |

## Personality Roadmap

Based on research across ~20 products and industry patterns (see `reference/personality-research.md`), the animation system uses **4 personalities + 2 shared primitive libraries**.

### 4 Personalities

Animation personalities define *how things move*, independent of color mode (light/dark).

| Personality | Status | Animation Identity | Best For |
|-------------|--------|-------------------|----------|
| **`cinematic`** | **Built** (as `cinematic-dark`) | 3D camera, clip-path wipes, spring physics, focus-pull entrances | Feature highlights, marketing demos, investor decks |
| **`editorial`** | **Built** (as `editorial`) | Content-forward staggers, crossfades, scroll-bound pacing, interface-as-demo | Product showcases, content tools, visual search demos |
| **`montage`** | **Built** (as `montage`) | Hard cuts + whip-wipes, scale entrances, stat pops, split-screen, grid reveals | Brand campaigns, product reels, sizzle content |
| `default` | Built (no personality file, inline in SKILL.md) | Simple fade+translate transitions | Internal reviews, quick iteration |

### 2 Shared Primitive Libraries

These are reusable animation building blocks, not standalone personalities. Any personality can compose with them.

| Library | Status | Primitives | Used By |
|---------|--------|-----------|---------|
| **Processing** | 4/7 built (React app) | Thinking indicator, status labels, token streaming, progressive reveal, progressive clarity, split-pane generation, duration-gated disclosure | All personalities (for AI feature demos), production app |
| **Tutorial** | Partial (built as `neutral-light`) | Spotlight overlay, cursor simulation, step indicators, positioned tooltips | Composes with editorial personality for onboarding demos |

**Why not 5 personalities?** Research showed tutorial and processing don't have distinct enough *choreography* to be standalone. Tutorial uses editorial's gentle pacing + its own primitives. Processing primitives are mixed-and-matched identically across every AI product (ChatGPT, Perplexity, Claude, Gemini) — it's a toolkit, not a style.

### Key Distinction: Personality vs Mode

The old model named themes by color (`cinematic-dark`, `neutral-light`). The new model separates concerns:

```
Old: --theme cinematic-dark          → locked to dark colors
New: --personality cinematic --mode dark  → same motion, flexible colors
     --personality cinematic --mode light → cinematic motion on light background
```

Each personality supports both light and dark modes. Mode selection is a tactical decision based on where the demo will be embedded (dark landing page hero vs light in-app embed), not an animation design decision.

### Personality Details

**Cinematic** (built) — The dramatic, high-production personality. Uses 3D perspective, clip-path directional wipes between phases, focus-pull blur entrances, spring-physics button interactions. Four-tier speed hierarchy (FAST/MEDIUM/SLOW/SPRING). Currently built as `cinematic-dark` with dark-mode tokens only.

**Editorial** (research complete) — "Animation should feel like typography." Content-forward, trusting the material to carry the story. Gentle stagger reveals (80-150ms between siblings, 400-600ms per element), opacity crossfades (300-500ms), scroll-bound pacing, content cycling (verb + icon swaps), interface-as-demo pattern. No 3D, no clip-path wipes, no blur effects. The animation serves the content rather than framing it. Reference: Linear, Readymag, Pitch, Notion, Arc, Stripe.

**Montage** (research complete, two tiers) — Rapid-scene energy with full-screen typography and visual variety. Research revealed two tiers:
- **Tier 1 (HTML pipeline):** Full-screen typography cards, hard cuts / whip-wipes (200-400ms), mini product demo sequences (2-3s each), stat callouts with count-up, split-screen compositions, photography backgrounds with CSS parallax. Loop: 30-45s. Achievable in current HTML animation pipeline.
- **Tier 2 (video tools):** Live-action footage intercut with UI, beat-synced editing with audio, real 3D renders, professional color grading. Requires Remotion or After Effects. Reference: Figma Config trailers, Apple product pages.

Remotion (remotion.dev) is the bridge: renders React components frame-by-frame into video. Could assemble Tier 1 HTML scenes + audio into finished sizzle reels. This is now being built as the [AI Cinematography Pipeline](../cinematography/README.md) — see that doc for the full architecture and phased delivery plan.

## Principles

These apply across all categories:

1. **Speed hierarchy** — At least 3 distinct speed tiers in any animation with multiple elements. Fast elements (labels, dots) set context. Medium elements (content) carry the story. Slow elements (containers, backgrounds) provide stability.

2. **Spring physics over duration-based** — Use `linear()` CSS springs or keyframe approximations. Never use pure `ease` or `linear` for interactive elements. Progress bars are the only exception (always linear).

3. **Staging** — One attention point at a time. Never animate two independent elements simultaneously unless they're a deliberate group (like stagger reveals). The eye should always know where to look.

4. **Purposeful only** — Every animation must serve comprehension, feedback, or delight. Remove any animation that exists purely for decoration. Ask: "If I removed this motion, would the user lose information?"

5. **Token-driven** — All visual properties (colors, shadows, radii, easing, durations) come from theme tokens. No hardcoded values in prototype HTML. This ensures visual consistency and enables theme switching.

6. **Embed-first** — Every autoplay prototype must work in an iframe with `?embed`. This is the primary consumption context (landing pages, pitch decks, email). Standalone playback controls are secondary.

## Integration with Production App

The taxonomy maps to implementation strategies:

| Category | Personality | Implementation | Library |
|----------|-------------|---------------|---------|
| Feature Highlight | Cinematic, Editorial | `/animate` skill → HTML → capture | Pure CSS + vanilla JS |
| Onboarding | Editorial + tutorial primitives | React components with Framer Motion | `motion` (fka Framer Motion) |
| Status & Progress | Processing primitives | CSS animations + Tailwind | Pure CSS |
| Micro-Interaction | N/A | CSS transitions + Tailwind | Pure CSS (production) |
| Brand & Marketing | Montage, Cinematic | `/animate` skill → HTML → capture | Pure CSS + vanilla JS |
| Data Visualization | Editorial | React + D3/Recharts + Framer Motion | `motion` + chart lib |

**Key distinction:** Feature Highlight, Brand, and Montage animations live as captured assets (WebM/MP4/HTML embed). They don't need React. Onboarding, Status, Micro-Interaction, and Data Viz live in the production React app and use Framer Motion or pure CSS.

**Montage tooling (resolved):** Montage Tier 1 (rapid scene cuts, typography, stat callouts) works in the existing HTML animation pipeline. Tier 2 (live footage, audio sync, 3D renders) requires Remotion or After Effects. See Personality Roadmap above for details.
