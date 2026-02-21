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
  --theme default|cinematic-dark (default: default)
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

### Themes (Personality + Mode)

> **Architecture direction:** Themes are evolving to separate *personality* (animation behavior) from *mode* (light/dark colors). Current `--theme cinematic-dark` combines both. Future: `--personality cinematic --mode dark`. See `docs/design-patterns/motion-design-system.md` for the full personality roadmap.

| Theme | Visual | Best For |
|-------|--------|----------|
| `default` | Light UI, ITO design system colors, fade+translate transitions | Internal reviews, quick iteration |
| `cinematic-dark` | Inky palette, 3D perspective, clip-path wipes, focus-pull entrances | Landing pages, marketing demos, investor presentations |
| `editorial` | Content-forward, crossfade transitions, slide+fade staggers, content cycling | Product showcases, content tools, visual search demos |

When `--theme cinematic-dark` is specified:

1. **Load theme files** from `.claude/skills/animate/themes/cinematic-dark/`:
   - `theme.css` — all tokens (prefixed `--cd-`), component classes, keyframes
   - `engine.js` — `CinematicDarkEngine` class with playback, transitions, animation primitives
   - `THEME.md` — rules, do/don't, decision tree, timing guide
   - `reference.html` — canonical reference prototype

2. **Follow the theme rules** in `THEME.md`:
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

When `--theme editorial` is specified:

1. **Load theme files** from `.claude/skills/animate/themes/editorial/`:
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

### Examples

```
/animate prototypes/2026-02-21-file-upload/concept-v1.html
/animate prototypes/2026-02-21-file-upload/concept-v1.html --theme cinematic-dark
/animate prototype.html --theme editorial
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

#### 2. Load Animation Principles

Read these reference files:
- `.claude/skills/animate/reference/animation-principles.md` — Disney's 12 principles adapted for UI
- `.claude/skills/animate/reference/spring-physics.md` — Spring animation recipes and squash/stretch

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
- `.claude/skills/animate/reference/animation-principles.md` — Disney's 12 principles for UI
- `.claude/skills/animate/reference/spring-physics.md` — Spring recipes, icon wiggle, and stagger patterns
- `.claude/skills/animate/reference/industry-references.md` — Gold-standard products, libraries, and learning resources
- `.claude/skills/animate/reference/cinematic-techniques-research.md` — Research: camera motion, focus-pull, clip-path, parallax
- `.claude/skills/maya/reference/motion-design.md` — Duration/easing/performance reference
- `.claude/skills/prototype/SKILL.md` — Prototype generation skill (upstream)

### Theme Files

- `.claude/skills/animate/themes/cinematic-dark/theme.css` — Tokens, component classes, keyframes
- `.claude/skills/animate/themes/cinematic-dark/engine.js` — `CinematicDarkEngine` reusable class
- `.claude/skills/animate/themes/cinematic-dark/THEME.md` — Rules, decision tree, timing guide
- `.claude/skills/animate/themes/cinematic-dark/reference.html` — Canonical reference demo
- `docs/design-patterns/motion-design-system.md` — Motion design taxonomy and approach document

---

## Future: Remotion Upgrade Path

If we need true programmatic video at scale (batch rendering, dynamic data, AI-generated),
Remotion (remotion.dev) is the upgrade path. It uses the same model — React components
rendered frame by frame — with physics-based springs and a composition system. Our current
prototype → autoplay → capture pipeline would map cleanly to Remotion compositions.
