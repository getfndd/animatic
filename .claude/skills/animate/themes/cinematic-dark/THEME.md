# Cinematic Dark Theme

Immersive, inky-palette dark environment with 3D perspective, clip-path wipes, focus-pull entrances, and spring physics interactions. Designed for high-impact feature demos, landing page embeds, and product marketing.

## When to Use

| Use Case | Fit |
|----------|-----|
| Feature highlight demos (landing page embeds) | **Perfect** |
| Product walkthrough / marketing films | **Perfect** |
| Investor presentation demos | **Good** |
| Internal prototype reviews | Acceptable (prefer light theme for speed) |
| Onboarding / tutorial | Not ideal (too cinematic, use neutral theme) |
| Status indicators / micro-interactions | Wrong tool |

## Files

| File | Purpose |
|------|---------|
| `theme.css` | All tokens, component classes, keyframes, and layout |
| `engine.js` | Reusable `CinematicDarkEngine` class (playback, transitions, animation primitives) |
| `reference.html` | Canonical reference prototype (Data Room Upload v4) |
| `THEME.md` | This document |

## Color Rules

### Surfaces (Inky Palette)

All backgrounds use the ITO inky scale. Never use arbitrary dark grays.

| Token | Value | Use |
|-------|-------|-----|
| `--cd-bg-body` | `#1a1a1a` (inky-900) | Page background |
| `--cd-surface-card` | `#262626` (inky-800) | Card/panel background |
| `--cd-surface-glass` | `rgba(64,64,64,0.5)` (inky-700 @ 50%) | Nested elements (file rows, process cards) |
| `--cd-surface-glass-hover` | `#4d4d4d` (inky-600) | Hover states |

### Text (Stone)

| Token | Value | Use |
|-------|-------|-----|
| `--cd-text-primary` | `#ffffff` | Headings, primary labels |
| `--cd-text-secondary` | `#e7e5e4` (stone-200) | Body text, subtitles |
| `--cd-text-tertiary` | `#c7c4c0` (stone-300) | Hints, file sizes, timestamps |
| `--cd-text-quaternary` | `#a8a29e` (stone-400) | Inactive icons, step labels |

### Accent Pastels (Tailwind 100-shade)

All accents use Tailwind 100-shade pastels on inky backgrounds. Never use bright saturated colors.

| Token | Value | Use |
|-------|-------|-----|
| `--cd-success` | `#d1fae5` (emerald-100) | Completion indicators, done states |
| `--cd-accent` | `#dbeafe` (blue-100) | Active states, links, borders |
| `--cd-processing` | `#fef3c7` (amber-100) | Progress indicators, spinners |

### Category Badges

Folder/category badges use 100-shade backgrounds with 800-shade text for readability.

| Category | Background | Text |
|----------|-----------|------|
| Financials | amber-100 | amber-800 |
| Fundraising | violet-100 | violet-800 |
| Legal | blue-100 | blue-800 |
| Operations | emerald-100 | emerald-800 |
| Governance | pink-100 | pink-800 |
| Team | teal-100 | teal-800 |

## Animation Rules

### Speed Hierarchy (Mandatory)

Every prototype using this theme MUST have 4 distinct speed tiers visible simultaneously during transitions:

| Tier | Duration | What | CSS Variable |
|------|----------|------|-------------|
| FAST | 180-220ms | Header text swaps, footer crossfade, playback dots | `--cd-fast` |
| MEDIUM | 500ms | Body clip-path wipes, focus-pull entrances | `--cd-medium` |
| SLOW | 700ms | Container height, camera rotation, stagger sequences | `--cd-slow` |
| SPRING | 1100-1350ms | Button press, drop zone receive (interaction) | `--cd-spring-dur` |

### Easing

| Purpose | Variable | Value |
|---------|----------|-------|
| Elements entering | `--cd-ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Elements exiting | `--cd-ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` |
| Height changes | `--cd-ease-smooth` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| Spring interactions | `--cd-ease-spring-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Camera motion | `--cd-spring` | CSS `linear()` spring curve |
| Progress bars | — | `linear` (always) |

### 3D Camera System

- Scene uses `perspective: 1200px` — deeper than typical (800px) for subtle effect
- Each phase gets a `.camera-N` class with different `rotateX`/`rotateY` values
- Camera transitions use `--cd-spring` easing (CSS `linear()` spring)
- Keep angles subtle: max ±2deg on each axis
- Success/completion phase may include `scale(0.97)` for a "landing" feel

### Transition Technique: Clip-Path Wipes

Phase content transitions use `clip-path: inset()` instead of opacity fades:

```css
/* Hidden (waiting) */  clip-path: inset(0 100% 0 0);
/* Active (visible) */  clip-path: inset(0 0 0 0);
/* Exiting (leaving) */ clip-path: inset(0 0 0 100%);
```

New phase wipes in from the right. Old phase wipes out to the left. This creates directional movement that opacity fades lack.

### Entrance Technique: Focus-Pull

Elements enter by going from blurred + slightly scaled down to sharp + full size:

```css
/* Initial */ opacity: 0; filter: blur(8px); transform: scale(0.97);
/* Visible */ opacity: 1; filter: blur(0);   transform: scale(1);
```

Use `data-focus-group` attribute and `engine.runFocusStagger()` for staggered reveals.

### Special Effects

| Effect | When to Use | How |
|--------|-------------|-----|
| **Typewriter** | Revealing AI-generated text (renamed filenames, suggestions) | `.typewriter-text` + `data-text` attribute |
| **Self-drawing checkmarks** | Success/completion confirmation | SVG `<polyline class="draw-check">` with `stroke-dashoffset` animation |
| **Step dot progress** | Multi-step processing visualization | `.step-dot` + `.step-connector` with data attributes |
| **Spring button press** | Simulating user clicking a CTA | `.btn.pressing` class triggers `btn-press` keyframes |
| **Drop zone receive** | Simulating file drop/upload | `.drop-zone.receiving` triggers `zone-receive` keyframes |

## Do / Don't

### Do

- Use only tokens from `theme.css` — all colors are prefixed `--cd-`
- Maintain 4-tier speed hierarchy in every transition
- Use clip-path wipes for phase transitions (not opacity fades)
- Use focus-pull for row/card entrances (not slide-up)
- Use spring interactions for every user-simulated action
- Include embed mode (`?embed` query parameter support)
- Stagger effects within a phase (rows first, then checks/badges)
- Use Phosphor icons for all SVG icons (same as production app)

### Don't

- Add gradients, glassmorphism, or backdrop-filter
- Use ambient glows, colored shadows, or bloom effects
- Use arbitrary hex colors — everything comes from the token system
- Use opacity fades for phase body transitions (use clip-path)
- Make all elements transition at the same speed (breaks hierarchy)
- Skip the camera motion (3D perspective is core to the theme identity)
- Use the theme for micro-interactions or status badges (wrong scope)

## Decision Tree

```
Is this a multi-phase product demo?
├── YES → Use cinematic-dark
│   ├── Does it have 3+ phases? → Full engine with playback controls
│   ├── Does it have 1-2 phases? → Simplified engine (no progress dots)
│   └── Is it for landing page? → Add ?embed mode, hide controls
└── NO
    ├── Is it a tutorial/onboarding? → Use neutral theme (TBD)
    ├── Is it a status/loading indicator? → Use micro-interaction (TBD)
    └── Is it a brand/marketing animation? → Evaluate case-by-case
```

## Extending the Category Palette

To add new folder/badge categories:

1. Add CSS variables to `theme.css` `:root`:
   ```css
   --cd-cat-newcat-bg: #Tailwind-100;
   --cd-cat-newcat-text: #Tailwind-800;
   ```

2. Add CSS selectors:
   ```css
   .suggest-folder[data-category="newcat"] { background: var(--cd-cat-newcat-bg); color: var(--cd-cat-newcat-text); }
   .success-folder[data-category="newcat"] { background: var(--cd-cat-newcat-bg); color: var(--cd-cat-newcat-text); }
   ```

3. Always pair Tailwind 100-shade background with matching 800-shade text.

## Phase Timing Guide

| Phase Type | Dwell Time | Why |
|------------|-----------|-----|
| Simple display (upload form, source selection) | 2.0-2.5s | Quick scan, one concept |
| File list with stagger reveals | 2.5-3.0s | Items need time to appear and register |
| Processing with progress bars | 4.0-4.5s | Progress animation needs to play through |
| Results with typewriter + badges | 4.0-4.5s | Rename reveals, folder assignments need time |
| Success / completion with self-drawing checks | 3.0-3.5s | Landing moment, let it breathe |
| Loop pause (before restart) | 1.5s | Separation between loops |

**Total loop time for 5 phases: ~17-19s**
