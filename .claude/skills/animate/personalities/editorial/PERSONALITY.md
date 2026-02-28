# Editorial Personality

> "Animation should feel like typography. It creates rhythm, establishes hierarchy, and guides the eye. It never competes with the content it serves."

Content-forward animation where the product speaks for itself. Gentle stagger reveals, opacity crossfades, content cycling, and interface-as-demo patterns. The animation serves the content rather than framing it.

**Designed for shareability.** All tokens use CSS custom properties that can be overridden by any design system. No hardcoded colors. No framework dependencies.

## When to Use

| Use Case | Fit |
|----------|-----|
| Product showcases, feature pages | **Perfect** |
| Content tool demos (search, editing, generation) | **Perfect** |
| Visual search / AI feature demos | **Perfect** |
| Data visualization reveals | **Good** |
| Landing page hero (content-forward) | **Good** |
| Marketing demos (dramatic) | Not ideal (use cinematic) |
| Onboarding / tutorials | Use editorial + tutorial primitives |
| Brand campaigns / sizzle reels | Wrong tool (use montage) |

## Files

| File | Purpose |
|------|---------|
| `PERSONALITY.md` | This document — rules, choreography, do/don't |
| `motion.css` | Animation classes, keyframes, token definitions (mode-independent) |
| `engine.js` | Reusable `EditorialEngine` class (playback, transitions, animation primitives) |
| `reference.html` | Canonical reference prototype |

## Token System (Decoupled)

All tokens use the `--ed-` prefix and are defined as CSS custom properties at `:root` level. Consumers can override any token to match their design system.

### Override Example

```css
/* Default editorial tokens (built-in) */
:root {
  --ed-bg-body: #fafaf9;
  --ed-text-primary: #1c1917;
}

/* Your design system override */
:root {
  --ed-bg-body: var(--your-surface-primary);
  --ed-text-primary: var(--your-text-primary);
}
```

### Engine Override Example

```js
const engine = new EditorialEngine({
  phases: [...],
  titles: [...],
  tokenOverrides: {
    '--ed-bg-body': '#0a0a0a',
    '--ed-text-primary': '#ffffff',
    '--ed-accent': '#3b82f6',
  }
});
```

### Surface Tokens

| Token | Default (Light) | Use |
|-------|----------------|-----|
| `--ed-bg-body` | `#fafaf9` (stone-50) | Page background |
| `--ed-surface-card` | `#ffffff` | Card/panel background |
| `--ed-surface-secondary` | `#f5f5f4` (stone-100) | Nested elements, tab backgrounds |
| `--ed-surface-hover` | `#e7e5e4` (stone-200) | Hover states |
| `--ed-surface-overlay` | `rgba(0,0,0,0.03)` | Subtle depth layers |

### Text Tokens

| Token | Default (Light) | Use |
|-------|----------------|-----|
| `--ed-text-primary` | `#1c1917` (stone-900) | Headings, primary labels |
| `--ed-text-secondary` | `#44403c` (stone-700) | Body text, subtitles |
| `--ed-text-tertiary` | `#78716c` (stone-500) | Hints, meta, timestamps |
| `--ed-text-quaternary` | `#a8a29e` (stone-400) | Inactive, placeholder |

### Border Tokens

| Token | Default (Light) | Use |
|-------|----------------|-----|
| `--ed-border-subtle` | `#e7e5e4` (stone-200) | Card borders, dividers |
| `--ed-border-medium` | `#d6d3d1` (stone-300) | Input borders |
| `--ed-border-active` | `#3b82f6` (blue-500) | Active/focused elements |

### Accent Tokens

| Token | Default (Light) | Use |
|-------|----------------|-----|
| `--ed-accent` | `#3b82f6` (blue-500) | Active states, links, tabs |
| `--ed-accent-bg` | `#eff6ff` (blue-50) | Active tab backgrounds |
| `--ed-accent-text` | `#1d4ed8` (blue-700) | Accent text on light backgrounds |
| `--ed-success` | `#16a34a` (green-600) | Completion indicators |
| `--ed-success-bg` | `#f0fdf4` (green-50) | Success backgrounds |

## Animation Rules

### Speed Hierarchy (3 Tiers)

Editorial uses 3 speed tiers. Gentler and faster than cinematic. No SPRING tier — editorial doesn't simulate button presses.

| Tier | Duration | What | CSS Variable |
|------|----------|------|-------------|
| FAST | 120-200ms | Tab switches, label swaps, icon rotations | `--ed-fast` |
| MEDIUM | 300-500ms | Content crossfade, stagger items, slide reveals | `--ed-medium` |
| SLOW | 600-800ms | Container morphs, ambient gradients, full section transitions | `--ed-slow` |

### Easing

| Purpose | Variable | Value |
|---------|----------|-------|
| Elements entering | `--ed-ease-out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (ease-out-quart) |
| Elements exiting | `--ed-ease-in` | `cubic-bezier(0.55, 0.06, 0.68, 0.19)` |
| Container morphs | `--ed-ease-smooth` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| Content cycling | `--ed-ease-out` | Same as entering |
| Progress bars | — | `linear` (always) |

No spring `linear()` curves. Editorial motion should feel predictable and rhythmic, like well-set typography.

### Transition Technique: Opacity Crossfade

Phase content transitions use simple opacity crossfade — not clip-path wipes.

```css
/* Hidden (waiting) */  opacity: 0; pointer-events: none;
/* Active (visible) */  opacity: 1; pointer-events: auto;
/* Exiting (leaving) */ opacity: 0; pointer-events: none;
```

This is the editorial signature: content appears and disappears like turning a page. No directional movement between phases.

### Entrance Technique: Slide+Fade

Elements enter by sliding up slightly while fading in:

```css
/* Initial */ opacity: 0; transform: translateY(10px);
/* Visible */ opacity: 1; transform: translateY(0);
```

Use `data-stagger-group` attribute and `engine.runSlideStagger()` for staggered reveals.

Stagger timing: **80-150ms between siblings**, **400-600ms per element**.

### Signature Effects

| Effect | When to Use | How |
|--------|-------------|-----|
| **Content cycling** | Showing multiple use cases for one feature | Swap text/icon/image in a fixed container with crossfade |
| **Interface-as-demo** | Showing the product transforming between states | Morph/crossfade between UI states within a card |
| **Tab switching** | Showing multiple views of the same data | Highlight active tab, crossfade content panel |
| **Ambient gradient** | Background atmosphere, hero moments | Slow-moving radial gradient (12-16s loop) |
| **Blur-to-sharp reveal** | Hero moments, key statistics | `filter: blur(8px)` → `blur(0)` over 600-800ms |
| **Count-up numbers** | Statistics, metrics, scores | Animate from 0 to target with ease-out-quad |
| **Typewriter** | AI-generated text, search queries | Character-by-character reveal with cursor |

### Content Cycling Pattern

The editorial signature effect. Shows multiple variations of a concept by cycling content in a fixed container:

```
Frame 1: "Search for [modern accent chairs]"     + [chair icon]
Frame 2: "Search for [sustainable packaging]"     + [box icon]
Frame 3: "Search for [editorial photography]"     + [camera icon]
```

Implementation: `engine.runContentCycle()` method. Each cycle item crossfades in/out with `--ed-medium` timing and `--ed-ease-out` easing. Cycle interval: 2.5-3.5s per item.

### Interface-as-Demo Pattern

The dominant 2025-2026 SaaS pattern. Show the actual product interface transforming between states. No annotated screenshots, no zooming cursors. Trust the material.

Implementation: `engine.runInterfaceDemo()` method. Crossfades between UI states within a card container. Each state shows a different view of the product (list → detail, search → results, compose → preview).

## Do / Don't

### Do

- Use only `--ed-` prefixed tokens — all visual properties flow from the token system
- Maintain 3-tier speed hierarchy in every transition
- Use opacity crossfade for phase transitions
- Use slide+fade (translateY) for item entrances
- Use content cycling for "multiple use cases" moments
- Show the interface transforming between real states (interface-as-demo)
- Include embed mode (`?embed` query parameter support)
- Let whitespace do the work — generous padding, minimal decoration
- Use Phosphor icons for all SVG icons

### Don't

- Add 3D perspective, camera motion, or `perspective: Xpx`
- Use clip-path wipe transitions (that's cinematic's identity)
- Use focus-pull blur entrances for content items (reserve blur for hero moments only)
- Add spring physics interactions (no simulated button presses)
- Use glassmorphism, heavy gradients, or backdrop-filter
- Use colored shadows, bloom effects, or glow
- Use arbitrary colors — everything comes from the token system
- Make the animation compete with the content — content is the star

## Decision Tree

```
Is this a content-forward product demo?
├── YES → Use editorial
│   ├── Does it show multiple features? → Content cycling + tab switching
│   ├── Does it show a single workflow? → Interface-as-demo between states
│   ├── Does it have statistics? → Count-up numbers + blur-to-sharp reveal
│   └── Is it for embedding? → Add ?embed mode, hide controls
└── NO
    ├── Is it dramatic/marketing? → Use cinematic
    ├── Is it a rapid sizzle reel? → Use montage
    ├── Is it a tutorial? → Use editorial + tutorial primitives
    └── Is it an internal review? → Use default (no personality)
```

## Phase Timing Guide

| Phase Type | Dwell Time | Why |
|------------|-----------|-----|
| Hero / intro with ambient gradient | 3.0-3.5s | Set the mood, read headline |
| Tab switch with content crossfade | 2.5-3.0s | Switch + new content appears + read |
| Content cycling (per cycle) | 2.5-3.5s | Each variation needs time to register |
| Interface-as-demo state change | 3.0-4.0s | UI morphs, new state settles, read |
| Statistics with count-up | 2.5-3.0s | Numbers animate + comprehend |
| Completion / CTA | 2.5-3.0s | Landing moment, CTA visible |
| Loop pause (before restart) | 1.5s | Separation between loops |

**Total loop time for 4-5 phases: ~12-16s**

Shorter than cinematic (17-19s) because editorial trusts the content to carry itself. No dramatic pauses needed.

## Comparison with Other Personalities

| Dimension | Editorial | Cinematic | Montage |
|-----------|-----------|-----------|---------|
| Pacing control | Viewer (scroll, click) or timed | Director (timed sequence) | Director (rapid cuts) |
| Content relationship | Content is the star | Animation is the star | Variety is the star |
| Transition default | Crossfade | Clip-path wipe | Hard cut / whip-wipe |
| Timing | 300-600ms, ease-out | 800-1500ms, spring | 200-400ms, sharp |
| Stagger purpose | Establish hierarchy | Build anticipation | Create rhythm |
| Ambient motion | Yes, atmospheric | Yes, dramatic | No, too fast |
| Camera | No 3D perspective | 3D rotations | Full-screen scene cuts |
| Loop time | 12-16s | 17-20s | 30-45s |

## Reference Products

- **Linear** — blur reveal, specular highlights, ambient gradient, interface-as-demo
- **Readymag** — scroll-as-narrative-control, editorial layout, reader-paced
- **Pitch** — morph/FLIP transitions, snappy easing (200-400ms), slide-as-brand-object
- **Notion** — minimal animation, crossfade feature switching, AI character, whitespace-driven
- **Arc** — micro-interaction polish, spring-based panels, release notes as editorial content
- **Stripe** — WebGL gradient mesh, restrained CSS, multi-tool approach per element
