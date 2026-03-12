---
name: animate
memory: project
description: Generate polished, self-running animated demos from prototypes. Applies Disney's 12 animation principles and spring physics to create cinematic product walkthroughs for landing pages, email, and marketing. Invoke with /animate to generate autoplay versions and capture video assets.
---

# /animate - Prototype Animation Pipeline

Transform interactive prototypes into polished, self-running animated demos that look like handcrafted product animations — not screen recordings.

---

## Command Interface

```
/animate <prototype-path> [options]
  --mode autoplay|capture|all (default: autoplay)
  --subject illustration|product-ui|mixed-media|hybrid (default: auto-detect)
  --personality editorial|cinematic|neutral-light|montage (default: editorial)
  --color-mode light|dark (default: inferred from personality)
  --format webm|mp4|av1|hevc|prores|gif|all (default: webm)
  --width 800 (viewport width)
  --fps 30 (frames per second)
  --quality 90 (encoding quality 1-100)
  --loops 1 (number of animation loops to capture)
  --kit (capture mode: full distribution kit — all formats + social + embed + thumb + email)
  --social (capture mode: generate social media aspect ratio variants)
  --embed (capture mode: generate embed.html with iframe snippet)
  --thumb (capture mode: generate thumbnail PNG)
  --email (capture mode: generate email kit — 600w GIF, static PNG, Apple Mail MP4, HTML snippet)
  --thumb-phase 3 (which animation phase to capture for thumbnail)
  --deterministic (capture mode: virtual time for frame-perfect capture)
  --output-dir ./captures (capture mode: output directory)
```

### Modes

| Mode | What It Does |
|------|-------------|
| `autoplay` | Generate a self-running version of an interactive prototype |
| `capture` | Record an existing autoplay prototype to video (WebM/MP4/GIF) |
| `all` | Generate autoplay + capture all formats |

### Personalities

Personalities define *how things move* (animation behavior), independent of color mode (light/dark). Use `--personality` to select, `--color-mode` to override the default color scheme. See `docs/design-patterns/motion-design-system.md` for the full personality roadmap.
| Personality | Token prefix | Engine | Visual | Best For |
|-------------|-------------|--------|--------|----------|
| `editorial` | `--ed-` | `EditorialEngine` | Content-forward, crossfade transitions, slide+fade staggers, content cycling | Product showcases, content tools |
| `cinematic` | `--cd-` | `CinematicDarkEngine` | 3D perspective, clip-path wipes, focus-pull, spring physics | Landing pages, marketing, investor decks |
| `neutral-light` | `--nl-` | `NeutralLightEngine` | Spotlight, cursor simulation, step indicators, slide+fade | Onboarding, tutorials, help docs |
| `montage` | `--mo-` | `MontageEngine` | Hard cuts, whip-wipes, full-screen type, stat callouts | Brand launches, sizzle reels, keynotes |

When `--personality cinematic` is specified:

1. **Load personality files** from `.claude/skills/animate/personalities/cinematic/`:
   - `motion.css` — easing, timing, component classes, keyframes (mode-independent)
   - `modes/dark.css` — dark mode color tokens (prefixed `--cd-`)
   - `engine.js` — `CinematicDarkEngine` class with playback, transitions, animation primitives
   - `PERSONALITY.md` — rules, do/don't, decision tree, timing guide
   - `reference.html` — canonical reference prototype

2. **Follow the personality rules** in `PERSONALITY.md`:
   - Use only `--cd-` prefixed tokens for all colors
   - Maintain 4-tier speed hierarchy (FAST/MEDIUM/SLOW/SPRING)
   - Use clip-path wipes for phase transitions (not opacity fades)
   - Use focus-pull for entrances (not slide-up)
   - Include 3D camera motion per phase
   - No gradients, glassmorphism, or ambient glows

3. **Instantiate the engine** in your `<script>` block:
   ```js
   const engine = new CinematicDarkEngine({
     phases: [...],
     titles: [...],
     subtitles: [...],
     interactions: { 0: async () => { ... } },
     onPhaseEnter: { 1: (e) => e.runFocusStagger('select', 200) },
   });
   engine.exposeGlobals();
   window.addEventListener('DOMContentLoaded', () => engine.boot());
   ```

When `--personality editorial` is specified:

1. **Load personality files** from `.claude/skills/animate/personalities/editorial/`:
   - `motion.css` — all tokens (prefixed `--ed-`), animation classes, keyframes
   - `engine.js` — `EditorialEngine` class with playback, transitions, content cycling
   - `PERSONALITY.md` — rules, do/don't, decision tree, timing guide
   - `reference.html` — canonical reference prototype

2. **Follow the personality rules** in `PERSONALITY.md`:
   - Use only `--ed-` prefixed tokens for all colors
   - Maintain 3-tier speed hierarchy (FAST/MEDIUM/SLOW)
   - Use opacity crossfade for phase transitions (not clip-path wipes)
   - Use slide+fade for entrances (not focus-pull blur)
   - No 3D perspective, no camera motion, no spring physics
   - Content cycling for "multiple use cases" moments
   - Interface-as-demo for product state changes

3. **Instantiate the engine** in your `<script>` block:
   ```js
   const engine = new EditorialEngine({
     phases: [...],
     titles: [...],
     subtitles: [...],
     onPhaseEnter: {
       0: (e) => e.runBlurReveal('hero', 250),
       1: (e) => e.runSlideStagger('features', 120),
       2: (e) => e.runContentCycle('queries', 2800),
       3: (e) => { e.runSlideStagger('results', 150); e.runCountUp(600); },
     },
     // Optional: override tokens for your design system
     tokenOverrides: { '--ed-bg-body': '#0a0a0a', '--ed-text-primary': '#fff' },
   });
   engine.exposeGlobals();
   window.addEventListener('DOMContentLoaded', () => engine.boot());
   ```

When `--personality neutral-light` is specified:

1. **Load personality files** from `.claude/skills/animate/personalities/neutral-light/`:
   - `motion.css` — all tokens (prefixed `--nl-`), animation classes, keyframes
   - `engine.js` — `NeutralLightEngine` class with playback, transitions, animation primitives
   - `PERSONALITY.md` — rules, do/don't, decision tree, timing guide
   - `reference.html` — canonical reference prototype (Data Room Setup onboarding)

2. **Follow the personality rules** in `PERSONALITY.md`:
   - Use only `--nl-` prefixed tokens for all colors
   - Maintain 3-tier speed hierarchy (FAST/MEDIUM/SLOW — no SPRING tier)
   - Use opacity crossfade for phase transitions (not clip-path wipes)
   - Use slide+fade for entrances (not focus-pull blur)
   - No 3D perspective, no camera motion, no spring physics, no blur
   - Spotlight, cursor simulation, step indicators for tutorial guidance

3. **Instantiate the engine** in your `<script>` block:
   ```js
   const engine = new NeutralLightEngine({
     phases: [...],
     titles: [...],
     subtitles: [...],
     onPhaseEnter: {
       0: (e) => e.runSlideStagger('welcome', 120),
       1: (e) => { e.runSpotlight('target'); e.runCursor('target'); },
       2: (e) => e.runSlideStagger('items', 150),
       3: (e) => e.runSlideStagger('summary', 120),
     },
   });
   engine.exposeGlobals();
   window.addEventListener('DOMContentLoaded', () => engine.boot());
   ```

When `--personality montage` is specified:

1. **Load personality files** from `.claude/skills/animate/personalities/montage/`:
   - `motion.css` — all tokens (prefixed `--mo-`), whip-wipe keyframes, scale entrances
   - `engine.js` — `MontageEngine` class with playback, per-phase transitions, animation primitives
   - `PERSONALITY.md` — rules, choreography, do/don't
   - `reference.html` — canonical reference prototype ("Introducing Velocity")

2. **Follow the personality rules** in `PERSONALITY.md`:
   - Use only `--mo-` prefixed tokens for all colors
   - Maintain 3-tier speed hierarchy (FAST/MEDIUM/SLOW — fastest of all personalities)
   - Per-phase transition mixing: hard cuts + whip-wipes within the same reel
   - Scale hero entrances (1.15→1.0) for hero elements
   - No 3D perspective, no spring physics, no blur, no content cycling
   - Title cards, stat callouts, split-screen, grid reveals

3. **Instantiate the engine** in your `<script>` block:
   ```js
   const engine = new MontageEngine({
     phases: [
       { id: 0, label: 'Title',  dwell: 2500, transition: 'hard-cut' },
       { id: 1, label: 'Demo',   dwell: 3500, transition: 'whip-left' },
       { id: 2, label: 'Stats',  dwell: 2500, transition: 'hard-cut' },
       { id: 3, label: 'Grid',   dwell: 3000, transition: 'whip-right' },
       { id: 4, label: 'CTA',    dwell: 2500, transition: 'hard-cut' },
     ],
     titles: [...],
     onPhaseEnter: {
       0: (e) => e.runTextHero('title'),
       1: (e) => e.runScaleEntrance('features', 100),
       2: (e) => e.runStatReveal('metrics', 150),
       3: (e) => e.runGridReveal('grid', 80),
     },
     tokenOverrides: { '--mo-accent': '#8b5cf6' },
   });
   engine.exposeGlobals();
   window.addEventListener('DOMContentLoaded', () => engine.boot());
   ```

### Examples

```
/animate prototypes/2026-02-21-file-upload/concept-v1.html
/animate prototypes/2026-02-21-file-upload/concept-v1.html --personality cinematic
/animate prototype.html --personality editorial
/animate prototype.html --personality neutral-light
/animate prototype.html --personality montage
/animate prototypes/2026-02-21-file-upload/autoplay-v1.html --mode capture --format all
/animate prototypes/2026-02-21-file-upload/concept-v1.html --mode all
```

---

## Execution Flow

### Mode: autoplay

When generating an autoplay version from an interactive prototype:

#### 1. Analyze the Prototype

Read the source prototype and identify:
- **Phases** — distinct UI states (e.g., upload form, file list, processing, results)
- **Interactive elements** — buttons, drop zones, inputs that trigger transitions
- **Content hierarchy** — header, body, footer structure
- **Design tokens** — CSS custom properties used

#### 1b. Subject Detection

Determine the animation subject type. The `--subject` flag overrides auto-detection.

| Signal | Classification |
|--------|---------------|
| SVG root element (`.svg` file or `<svg>` as primary visual) | `illustration` |
| Inline SVGs as primary visual content (not icons in buttons) | `illustration` |
| `<video>` element or video src reference as background/hero layer | `mixed-media` |
| Video + UI card/text choreography on top | `mixed-media` |
| Phase-layer / phase-container structure with interactive UI | `product-ui` |
| SVG illustration embedded within a product UI prototype | `hybrid` |

**Auto-detection rules (in priority order):**
1. File is `.svg` or root element is `<svg>` → `illustration`
2. Primary visual content is inline SVGs (not icon-sized, not inside buttons/controls) → `illustration`
3. Has `<video>` element as background or hero layer → `mixed-media`
4. Has `.phase-layer`, `.phase-container`, or `PHASES` config → `product-ui`
5. Both SVG illustration content AND phase structure → `hybrid`
6. Default → `product-ui`

**Routing:**
- `product-ui` → Continue to Steps 2-8 (standard execution flow)
- `illustration` → Continue to Step 2, then branch to Steps 3i-6i (illustration execution flow)
- `mixed-media` → Continue to Step 2, then branch to Steps 3m-6m (mixed-media execution flow)
- `hybrid` → Product-ui flow for the chrome/UI, illustration flow for the SVG content within it

#### 2. Load Animation Principles

Read these reference files:
- `.claude/skills/animate/reference/animation-principles.md` — Disney's 12 principles adapted for UI, including spatial causality
- `.claude/skills/animate/reference/spring-physics.md` — Spring animation recipes and squash/stretch
- `.claude/skills/animate/reference/primitives/REGISTRY.md` — Named animation primitives with CSS implementations, filtered by personality
- `.claude/skills/animate/reference/svg-illustration-techniques.md` — Reveal/Draw/Morph techniques, causality chains, fill-after-stroke (required for `illustration` and `hybrid` subjects)
- `.claude/skills/animate/reference/mixed-media-composition.md` — Video layers, overlay blending, per-beat media switching, typography over video (required for `mixed-media` subjects)

#### 3. Design the Phase System

For each phase, determine:
- **Dwell time** — how long to show before transitioning (see timing guide below)
- **Entry direction** — where content comes FROM (see directional journey below)
- **Entry animation** — how content appears (stagger, fade, slide)
- **Interaction animation** — what simulated user action triggers the transition
- **Exit direction** — where content goes TO (narrative flow)

**Directional Journey ("Powers of 10"):** Each phase should enter/exit from a
**different direction** to create a sense of journeying through levels of detail.
Never have all phases enter the same way — that feels flat. Stagger items within
each phase should match the phase's entry direction for visual coherence.
See `reference/animation-principles.md` → "Directional Journey" for the full pattern.

#### 4. Apply Animation Principles

**Every autoplay animation MUST apply these principles:**

| Principle | Implementation | Required |
|-----------|---------------|----------|
| **Icon Wiggle** | Buttons use subtle scale + icon rotation (preferred over squash/stretch) | Yes |
| **Anticipation** | Interactive elements show a small reverse movement before the main action | Yes |
| **Staging** | Only one element animates at a time | Yes |
| **Follow Through** | Elements overshoot their target, then settle | Yes |
| **Overlapping Action** | Header, body, footer, height all transition at different speeds | Yes |
| **Slow In/Out** | Use easing curves, never linear (except progress bars) | Yes |
| **Secondary Action** | Brightness/color shifts accompany scale changes | Yes |
| **Timing** | Phases have enough dwell for comprehension | Yes |
| **Exaggeration** | Scale/brightness changes are theatrical, not subtle | Yes |

#### 5. Build Speed Hierarchy

**Critical — this is what separates good animation from flat animation:**

```
FAST (150-220ms)    → Header text swaps, footer button transitions
MEDIUM (450-600ms)  → Body content crossfades (the hero transition)
SLOW (650-800ms)    → Container height changes, stagger sequences
SPRING (900-1400ms) → Interaction animations (button press, drop zone receive)
```

Header and footer are **supporting cast** — they swap quickly and get out of the way.
Body content is the **star** — it transitions deliberately.
Container height is **scenery** — it moves slowly, organically.
Interaction springs are **moments** — they play fully before the transition fires.

#### 6. Build Interaction Animations

Each interactive element gets a spring-physics keyframe animation with **icon wiggle**:

**Buttons** (~1100ms) — subtle scale + icon rotation:
```
Signal (scale 1.02 + brightness glow) → Press (scale 0.97) → Release overshoot (scale 1.01) → Settle
Icon: synced wiggle ±14deg rotation that decays (14° → 6° → 4° → 0°)
```

**Drop zones / containers** (~1350ms, gentler) — border/bg pulse + icon wiggle:
```
Signal (border/bg color shift) → Receive (scale 1.005, barely perceptible) → Settle (scale 0.998) → Rest
Icon: gentler wiggle ±10deg with slight translateY(-2px) lift
```

The icon wiggle pattern is preferred over full-body squash/stretch.
The drop zone animation should be slightly slower and gentler than the button.

#### 7. Add Embed Mode

Every autoplay file must support `?embed` query parameter:
- Hides backdrop overlay
- Hides playback controls
- Strips body centering/padding
- Makes background transparent
- Sets modal to full-width

This enables `<iframe src="autoplay.html?embed">` embedding on landing pages.

#### 8. Generate the File

Create `autoplay-v1.html` alongside the source prototype. Update `meta.json` with
the new version entry.

---

### Illustration Execution Flow (Steps 3i–6i)

**When subject is `illustration` or `hybrid`.** These steps replace Steps 3–8 above.
Steps 1, 1b, and 2 still apply. Embed mode (Step 7) still applies.

#### 3i. Analyze the Illustration

Instead of phases/interactions/content-hierarchy, analyze the SVG structure:

- **Inventory every distinct element** — paths, groups, text nodes, decorative shapes
- **Classify each as a technique candidate** using the decision tree from `svg-illustration-techniques.md`:
  - Stroke being constructed → **Draw**
  - Shape changing form → **Morph** (if geometrically similar) or **Reveal crossfade**
  - Filled area being uncovered → **Reveal**
  - Ambient/decorative → **Fade**
- **Map spatial relationships** — which elements are adjacent, overlapping, connected, or contain each other
- **Identify the narrative arc** — what the viewer should see first, second, third. This is usually: largest/central element → supporting elements → details → text

#### 4i. Build the Causality Graph

Instead of phase dwell timers, build a dependency graph where each animation triggers the next:

1. **Identify root element(s)** — what animates first (usually the most prominent shape or outer boundary)
2. **Define spatial triggers** between elements:
   - "Logo outline stroke reaches bottom-right corner → tagline reveals left-to-right from that corner"
   - "Background reveal edge reaches icon position → icon begins drawing"
   - "Icon draw completes → icon fill blooms"
3. **Build the chain** — every non-root element must have a spatial cause. No orphan timers.
4. **Mark overlap points** — where timed causality (75% trigger) creates better flow than strict `animationend` chains

```
Example causality graph:
  [border draws]
       │ stroke-75%
       ▼
  [background reveals from top-left]
       │ reveal-edge-reaches-center
       ▼
  [logo outline draws] ──stroke-complete──▶ [logo fill blooms]
       │                                          │ fill-complete
       │ stroke-75%                               ▼
       ▼                                   [tagline reveals ltr]
  [decorative lines draw]
```

#### 5i. Apply Illustration Principles

Required checklist — every item must be addressed:

| Principle | Requirement |
|-----------|-------------|
| **Spatial causality** | Every non-root animation has a spatial trigger from a preceding element |
| **Technique matching** | Each element uses the correct technique per the decision tree (no Reveal on strokes, no Draw on fills) |
| **Individual text treatment** | Text elements animate as individual words or lines, never as one block |
| **Directional variety** | Entry directions derive from spatial logic (where the cause is), not a uniform direction |
| **Speed hierarchy** | Primary shapes: slow/deliberate. Secondary shapes: moderate. Details/decorations: fast. |
| **No scale-from-center** | Do not use `scale()` as a default entrance. Use Reveal, Draw, or directional transforms. |
| **Fill follows stroke** | If an element has both stroke and fill, always draw the stroke first, then bloom the fill |
| **Personality rules** | Timing, technique bias, and extras follow the active personality's illustration notes |

#### 6i. Generate the File

Output structure differs from product-ui autoplay:

- **No phase-layer system** — the entire illustration is one continuous sequence, not discrete phases
- **Inline JS with causality chains** — use `animationend` listeners or timed causality (NOT a shared engine class). Illustration choreography is bespoke; reusable engines encourage the wrong patterns.
- **SVG elements with semantic class names** — `.logo-outline`, `.tagline-text`, `.decorative-border` (not `.phase-layer`, `.stagger-item`)
- **Path length measurement on boot** — JS measures `getTotalLength()` for all Draw elements and sets `--path-length` custom properties
- **Loop via reverse-draw** — to loop, reverse the causality chain (elements un-draw/un-reveal in reverse order), then restart. Not a hard reset.

```html
<!-- Illustration autoplay structure -->
<svg viewBox="0 0 800 600" id="illustration">
  <!-- Elements with semantic classes -->
  <path class="border-outline draw-path" d="..." />
  <rect class="background-fill reveal-target" ... />
  <g class="logo">
    <path class="logo-fill fill-layer" d="..." />
    <path class="logo-outline draw-path" d="..." />
  </g>
  <text class="tagline reveal-target">...</text>
</svg>

<script>
  // 1. Measure all drawable paths
  document.querySelectorAll('.draw-path').forEach(p => {
    const len = p.getTotalLength();
    p.style.setProperty('--path-length', len);
  });

  // 2. Run causality chain
  chainAnimations([
    { element: qs('.border-outline'), className: 'draw-active' },
    { element: qs('.background-fill'), className: 'reveal-active' },
    { element: qs('.logo-outline'), className: 'draw-active' },
    { element: qs('.logo-fill'), className: 'fill-active' },
    { element: qs('.tagline'), className: 'reveal-active' },
  ]);
</script>
```

---

### Mixed-Media Execution Flow (Steps 3m–6m)

**When subject is `mixed-media`.** These steps replace Steps 3–8 above.
Steps 1, 1b, and 2 still apply. Embed mode (Step 7) still applies.

Read `reference/mixed-media-composition.md` before proceeding.

#### 3m. Analyze the Composition

Instead of pure phases or pure SVG, analyze the layered structure:

- **Video layers** — `<video>` elements, their sources, loop behavior, playback intent
- **Overlay layers** — Dark tints, gradient overlays, blend modes for text legibility
- **Content layers** — Typography, UI cards, data callouts that choreograph on top
- **Per-beat media map** — Which beats use video backgrounds vs. solid canvas
- **Aspect ratio** — Source video ratio vs. container ratio, focal point needs

#### 4m. Design the Beat System

Mixed-media uses the same phase/beat model as product-ui, but with media switching:

1. **Map beats to media** — Beat 0 might use video, beats 1-4 might use dark canvas
2. **Plan overlay strategy** — Minimum overlay opacity per beat (see contrast rules in reference)
3. **Design content choreography** — What text/UI enters on each beat, using which primitives
4. **Plan video transitions** — Crossfade video opacity on beat change (300-400ms), never hard cut

**Key constraints:**
- **No blur entrances over video** — Video motion + blur = unreadable
- **Always muted** — Browser autoplay policies require `muted` on `<video>`
- **Preload multiple clips** — If using different video per beat, preload in hidden elements
- **Overlay minimum 0.30** — Text over video needs contrast (see reference for exact values)

#### 5m. Apply Mixed-Media Principles

| Principle | Requirement |
|-----------|-------------|
| **Legibility** | All text over video has sufficient overlay (0.30+ for bold, 0.40+ for body) |
| **Video speed** | Background video uses slow, steady motion — never fast/jerky footage |
| **Media crossfade** | Beat transitions crossfade video opacity (300-400ms), never hard cut |
| **Focal point** | `object-position` adjusted so video subject stays visible in container |
| **Loop sync** | Video loop boundary handled gracefully (crossfade restart or matched duration) |
| **Content hierarchy** | Video is atmosphere, content layer is the message — video never competes |
| **Personality rules** | Timing, entrance style, and overlay treatment follow active personality |

#### 6m. Generate the File

Output structure combines product-ui phases with video layer management:

- **Phase system for content** — Same engine-based phase management as product-ui
- **Video layer below phases** — Managed separately from phase content
- **Beat-to-media mapping** — JS switches video/canvas per beat on phase enter
- **Video elements always muted, playsinline, with object-fit: cover**

```html
<!-- Mixed-media autoplay structure -->
<div class="scene">
  <!-- Video layer -->
  <div class="video-layer">
    <video class="bg-video" src="hero.mp4" muted playsinline loop autoplay></video>
    <div class="video-overlay"></div>
  </div>

  <!-- Phase content layer (standard engine) -->
  <div class="content-layer">
    <div class="phase-layer" data-phase="0">
      <h1 class="hero-title stagger-item">Your raise.</h1>
    </div>
    <div class="phase-layer" data-phase="1">
      <!-- UI cards, data, etc. -->
    </div>
  </div>
</div>

<script>
  // Beat media map
  const beatMedia = {
    0: { type: 'video', overlay: 0.40 },
    1: { type: 'canvas', color: '#0a0a0a' },
  };

  const engine = new CinematicDarkEngine({
    phases: [...],
    onPhaseEnter: {
      0: (e) => { switchBeatMedia(0); e.runFocusStagger('title', 200); },
      1: (e) => { switchBeatMedia(1); e.runFocusStagger('cards', 180); },
    },
  });
</script>
```

---

### Mode: capture

Run the capture script on an existing autoplay prototype:

```bash
node scripts/capture-prototype.mjs <autoplay-file> [options]
  --format webm|mp4|av1|hevc|prores|gif|all (default: webm)
  --kit                    # Full distribution kit (all formats + social + embed + thumb + email)
  --social                 # Generate social media aspect ratio variants
  --embed                  # Generate embed.html with iframe snippet
  --thumb                  # Generate thumbnail PNG
  --email                  # Generate email kit (600w GIF, static PNG, Apple Mail MP4, HTML snippet)
  --thumb-phase 3          # Which phase to capture for thumbnail (default: 3)
  --deterministic          # Use virtual time for frame-perfect capture
  --output-dir ./captures  # Output directory (default: alongside source)
  --width 800              # Viewport width
  --fps 30                 # Frames per second
  --loops 1                # Number of animation loops to capture
```

The capture script:
1. Launches headless Puppeteer at 2x device scale
2. Sets transparent background via CDP `Emulation.setDefaultBackgroundColorOverride`
3. Auto-detects duration from the prototype's PHASES config
4. Measures max element height for consistent frame size
5. Captures PNG frames with alpha at configured FPS
6. Encodes to requested format(s) via ffmpeg/gifski
7. Optionally generates social variants, embed HTML, and thumbnail

**`--kit` produces a full distribution directory:**

```
captures/
├── {name}-master.mov        # ProRes 4444 (lossless master)
├── thumb.png                # Thumbnail at configured phase
├── web/
│   ├── {name}.webm          # VP9 with alpha (Chrome/Firefox/Edge)
│   ├── {name}.mp4           # H.264 universal fallback
│   ├── {name}.av1.mp4       # AV1 smallest file size
│   ├── {name}-hevc.mov      # HEVC alpha (Safari, macOS only)
│   └── {name}.gif           # gifski high-quality GIF
├── social/
│   ├── {name}-square-1080.mp4       # 1080×1080 (Product Hunt, X)
│   ├── {name}-landscape-1080p.mp4   # 1920×1080 (LinkedIn, YouTube)
│   └── {name}-portrait-1080x1920.mp4 # 1080×1920 (Instagram Reels)
├── embed/
│   ├── embed.html           # Self-contained embed page
│   └── embed-snippet.html   # Copy-paste iframe snippet
└── email/
    ├── {name}-hero-600w.png   # Static fallback (Outlook desktop)
    ├── {name}-hero-600w.gif   # Animated GIF (Gmail, Yahoo, Outlook.com)
    ├── {name}-hero-600w.mp4   # Inline video (Apple Mail only)
    └── email-snippet.html     # Progressive enhancement HTML template
```

**Format Reference:**

| Format | Alpha | Encoder | Quality | File Size | Use Case |
|--------|-------|---------|---------|-----------|----------|
| WebM | Yes | VP9 (libvpx-vp9) | CRF 25 | 3-8 MB | Landing pages (Chrome/Firefox/Edge) |
| MP4 | No | H.264 (libx264) | CRF 18 | 1-3 MB | Universal fallback, social media |
| AV1 | No | SVT-AV1 (libsvtav1) | CRF 28 | 1-2 MB | Smallest web delivery |
| HEVC | Yes | VideoToolbox | Quality 65 | 2-4 MB | Safari/macOS native alpha |
| ProRes | Yes | prores_ks (4444) | Lossless | 30-80 MB | Editor handoff, archival master |
| GIF | No | gifski (256 colors) | Quality 90 | 2-4 MB | Legacy email, Notion embeds |

**Graceful degradation:** HEVC requires macOS VideoToolbox, AV1 requires libsvtav1 in ffmpeg, GIF requires gifski. Missing encoders are skipped with warnings.

**Deterministic mode (`--deterministic`):** Overrides `requestAnimationFrame`, `setTimeout`, `Date.now`, and `performance.now` with virtual time, advancing exactly `1000/fps` ms per frame. Ensures frame-perfect capture regardless of system load.

---

## Phase Timing Guide

| Phase Type | Dwell Time | Why |
|------------|-----------|-----|
| Simple display (upload form, source selection) | 2.0-2.5s | Quick scan, one concept |
| File list with stagger reveals | 2.5-3.0s | Items need time to appear and register |
| Processing with progress bars | 3.5-4.5s | Progress animation needs to play through |
| Results with stagger + sub-animations | 3.5-4.0s | Rename reveals, folder assignments need time |
| Success / completion | 2.5-3.0s | Landing moment, let it breathe |
| Loop pause (before restart) | 1.5s | Separation between loops |

**Total loop time for 5 phases: ~16-19s**

---

## Easing Reference

| Purpose | Curve | CSS |
|---------|-------|-----|
| Elements entering (body content) | Expo out | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Elements leaving | Expo in | `cubic-bezier(0.7, 0, 0.84, 0)` |
| Height changes | Smooth | `cubic-bezier(0.25, 0.1, 0.25, 1)` |
| Spring interactions | Quint out | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Progress bars | Linear | `linear` |

---

## Autoplay File Structure

```html
<!-- CSS custom properties matching design system tokens -->
<style>
  :root { /* Design tokens */ }

  /* Phase crossfade system */
  .phase-layer { /* absolute positioned, opacity/transform transition */ }
  .phase-layer.active { opacity: 1; }
  .phase-container { /* relative, height animated by JS */ }

  /* Speed hierarchy */
  .phase-layer { transition: opacity 500ms, transform 600ms; }  /* MEDIUM */
  .phase-container { transition: height 650ms; }                  /* SLOW */
  .footer-layer { transition: opacity 220ms; }                    /* FAST */
  #modal-title { transition: opacity 180ms; }                     /* FAST */

  /* Spring interaction keyframes */
  @keyframes btn-spring-press { /* squash-stretch with anticipation */ }
  @keyframes zone-spring-receive { /* gentler variant */ }
</style>

<!-- Phase layers stacked in a container -->
<div class="phase-container">
  <div class="phase-layer active" id="phase-0">...</div>
  <div class="phase-layer" id="phase-1">...</div>
  <!-- ... -->
</div>

<!-- Footer layers for each phase -->
<div id="modal-footer">
  <div class="footer-layer active" id="footer-0">...</div>
  <!-- ... -->
</div>

<script>
  // Phase config with dwell times
  const PHASES = [
    { id: 0, label: 'Source', dwell: 2500 },
    // ...
  ];

  // Height measurement on boot
  function measurePhases() { /* ... */ }

  // Crossfade transition engine
  function transitionTo(phase) { /* ... */ }

  // Spring interaction definitions
  const INTERACTIONS = {
    0: async () => { /* drop zone spring */ },
    1: async () => { /* button spring */ },
    // ...
  };

  // Playback engine with embed mode detection
  const isEmbed = new URLSearchParams(window.location.search).has('embed');
</script>
```

---

## Ambient Composition (Brand Illustrations)

When animating brand illustrations or visual assets (not product UI), add an ambient composition layer:

1. **Identify subject type** — Is this product-ui (phases + engine) or illustration (SVG/brand visual)?
2. **If illustration**, read `reference/ambient-generative-techniques.md` for technique categories
3. **Select ambient effects** based on personality budget:
   - cinematic-dark: Full ambient (gradient + grain + blob). Multiple stacking allowed.
   - editorial: One effect only (gradient OR grain). Low opacity (≤0.10).
   - neutral-light: Grain overlay only. Opacity ≤ 0.05.
   - montage: No ambient effects.
4. **Layer ambient below content** — z-index lower than choreography, `pointer-events: none`
5. **Ambient starts immediately** — no entrance animation, runs continuously
6. **Apply `prefers-reduced-motion`** at the personality's default tier
7. **For SVG illustrations**, consider draw primitives (`ct-complex-draw`, `ct-handwriting-draw`)

**Reading list for brand illustration work:**
- `reference/ambient-generative-techniques.md` — Full technique guide
- `reference/primitives/REGISTRY.md` → SVG Filters / Generative section
- `reference/animation-principles.md` → `prefers-reduced-motion` section

---

## Quality Checklist

Before finalizing any animation, verify:

- [ ] **Icon Wiggle**: Button icons rotate (±14deg) synced to button press animation
- [ ] **Drop Zone Icon**: Container icons wiggle gentler (±10deg with translateY lift)
- [ ] **Subtle Scale**: Button body scale ≤3%, drop zone scale <0.5% (no rubbery feel)
- [ ] **Anticipation**: Every interaction starts with a visual signal (brightness/color)
- [ ] **Speed hierarchy**: At least 3 distinct speed tiers are visible
- [ ] **Directional journey**: Each phase enters/exits from a different direction (Powers of 10)
- [ ] **Stagger direction**: Stagger items match their phase's entry direction
- [ ] **JS staggers**: Stagger timing uses JS class toggling, NOT CSS `animation-delay` (replay-safe)
- [ ] **Staging**: Only one element demands attention at any moment
- [ ] **Dwell time**: Each phase has enough time to comprehend content
- [ ] **Loop replay**: All animations reset cleanly and replay without refresh
- [ ] **Embed mode**: `?embed` parameter works (no backdrop, no controls)
- [ ] **Design system**: All colors use semantic tokens, no hardcoded hex
- [ ] **Reduced motion**: `prefers-reduced-motion` respected at personality's tier
- [ ] **Ambient budget**: Ambient effects within personality's allowed budget
- [ ] **Ambient opacity**: Ambient layer opacity ≤ personality maximum (cinematic: 0.15, editorial: 0.10, neutral: 0.05)

**Additional checks for `mixed-media` subjects:**

- [ ] **Video overlay**: All text over video has overlay opacity ≥ 0.30 (bold) or ≥ 0.40 (body text)
- [ ] **No blur over video**: No blur-based entrances used on content over video layers
- [ ] **Video muted**: All `<video>` elements have `muted` attribute
- [ ] **Media crossfade**: Beat transitions crossfade video opacity (no hard cuts on video layer)
- [ ] **Focal point**: `object-position` set correctly for video subject within container ratio

**Additional checks for `illustration` and `hybrid` subjects:**

- [ ] **Technique match**: Every element uses the correct technique per the decision tree (Draw for strokes, Reveal for fills, Morph only for similar shapes)
- [ ] **Spatial causality**: Every non-root animation has a spatial trigger — no orphan timers
- [ ] **No timer sequences**: Animations are chained via `animationend` or timed causality, not independent `setTimeout` calls
- [ ] **Individual text treatment**: Text animates as individual words/lines, never as a single group
- [ ] **No scale-from-center**: Elements do not use `scale()` as a default entrance technique
- [ ] **No uniform direction**: Entry directions vary based on spatial relationships, not a single direction for all
- [ ] **Fill follows stroke**: Elements with both stroke and fill always draw stroke first, then bloom fill
- [ ] **Speed hierarchy**: Primary shapes move slowly, secondary shapes faster, details fastest
- [ ] **Designed loop exit**: Loop uses reverse-draw/reverse-reveal, not a hard reset to initial state

---

## Output

The skill produces:
1. **Autoplay HTML** — `autoplay-v1.html` with playback controls + `?embed` mode
2. **WebM** — VP9 with alpha transparency for landing pages
3. **MP4** — H.264 fallback for universal compatibility
4. Updated **meta.json** with new version entries

---

## Related Files

- `scripts/capture-prototype.mjs` — Puppeteer + ffmpeg capture pipeline
- `.claude/skills/animate/SAUL.md` — Saul (Animation Design Lead) persona and commands
- `.claude/skills/animate/reference/animation-principles.md` — Disney's 12 principles for UI, spatial causality
- `.claude/skills/animate/reference/spring-physics.md` — Spring recipes, icon wiggle, and stagger patterns
- `.claude/skills/animate/reference/svg-illustration-techniques.md` — Reveal/Draw/Morph techniques, causality chains, fill-after-stroke
- `.claude/skills/animate/reference/primitives/REGISTRY.md` — Named animation primitives with CSS implementations
- `.claude/skills/animate/reference/ambient-generative-techniques.md` — SVG filters, gradients, textures, organic shapes for brand illustration
- `.claude/skills/animate/reference/mixed-media-composition.md` — Video layers, overlay blending, per-beat media switching, typography over video
- `.claude/skills/animate/reference/breakdowns/INDEX.md` — Animation reference breakdown index
- `.claude/skills/animate/reference/SCHEMA.md` — Template for creating new reference breakdowns
- `.claude/skills/animate/reference/industry-references.md` — Gold-standard products, libraries, and learning resources
- `.claude/skills/animate/reference/cinematic-techniques-research.md` — Research: camera motion, focus-pull, clip-path, parallax
- `.claude/skills/animate/reference/inspiration/INDEX.md` — Collected GIF/video reference catalog
- `.claude/skills/maya/reference/motion-design.md` — Duration/easing/performance reference
- `.claude/skills/prototype/SKILL.md` — Prototype generation skill (upstream)

### Personality Files

- `.claude/skills/animate/personalities/cinematic/motion.css` — Animation classes, keyframes, timing
- `.claude/skills/animate/personalities/cinematic/modes/dark.css` — Dark mode color tokens
- `.claude/skills/animate/personalities/cinematic/engine.js` — `CinematicDarkEngine` reusable class
- `.claude/skills/animate/personalities/cinematic/PERSONALITY.md` — Rules, decision tree, timing guide
- `.claude/skills/animate/personalities/cinematic/reference.html` — Canonical reference demo
- `.claude/skills/animate/personalities/editorial/` — Editorial personality (motion.css, engine.js, PERSONALITY.md, reference.html)
- `.claude/skills/animate/personalities/neutral-light/` — Neutral light personality (motion.css, engine.js, PERSONALITY.md, reference.html)
- `.claude/skills/animate/personalities/montage/` — Montage personality (motion.css, engine.js, PERSONALITY.md, reference.html)
- `.claude/skills/animate/primitives/tutorial/` — Tutorial primitives (spotlight, cursor, tooltip, step progress)
- `docs/design-patterns/motion-design-system.md` — Motion design taxonomy and approach document

---

## Future: Remotion Upgrade Path

If we need true programmatic video at scale (batch rendering, dynamic data, AI-generated),
Remotion (remotion.dev) is the upgrade path. It uses the same model — React components
rendered frame by frame — with physics-based springs and a composition system. Our current
prototype → autoplay → capture pipeline would map cleanly to Remotion compositions.
