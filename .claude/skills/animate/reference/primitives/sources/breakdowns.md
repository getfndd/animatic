# Primitives Extracted from Reference Breakdowns

New animation primitives discovered through reference analysis. Each links back to the breakdown that identified it.

---

## From `dot-grid-ripple`

### `bk-grid-wave` — Grid Wave Propagation
- **Category:** Continuous / Ambient
- **Duration:** ~2000ms per wave cycle
- **Easing:** ease-in-out (individual dot), distance-based delay
- **Description:** Radial wave propagation across a grid of elements. Dots/cards/icons scale up as the wave passes and settle back to baseline. Wave origin can drift for organic feel.
- **Parameters:** origin point, wave speed (ms per pixel), scale multiplier, wave radius, grid element selector
- **Personality:** cinematic-dark (primary), universal at low intensity
- **CSS/JS pattern:** JS distance calculation drives per-element setTimeout stagger. CSS transitions handle the scale/opacity animation.

### `bk-distance-stagger` — Distance-Based Stagger
- **Category:** Reveal / Stagger
- **Duration:** Variable (distance-dependent)
- **Description:** Instead of index-based stagger (0, 1, 2...), delay is calculated from Euclidean distance to a focal point. Creates organic radial reveal patterns.
- **Parameters:** focal point (x, y), speed factor, element selector
- **Personality:** universal
- **Formula:** `delay = Math.sqrt(dx² + dy²) * speedFactor`

## From `kinetic-type-scale-cascade`

### `bk-text-parallax-stack` — Text Parallax Stack
- **Category:** Typography / Continuous
- **Duration:** ~3000ms cycle (infinite loop)
- **Easing:** linear (scroll speed), expo-out (entrance)
- **Description:** Same text repeated at 3 scales (large/medium/small) scrolling at different speeds. Creates depth through scale differential and parallax motion.
- **Parameters:** text content, scale ratios [3, 2, 1], speed differential
- **Personality:** cinematic-dark
- **Note:** Loop-friendly — seamless infinite scroll for video capture.

## From `3d-card-cascade`

### `bk-grid-flip-cascade` — Grid Flip Cascade
- **Category:** Reveal / Stagger
- **Duration:** 600ms per card, 80ms stagger interval, ~2000ms total for 4x5 grid
- **Easing:** cubic-bezier(0.4, 0, 0.2, 1)
- **Description:** Staggered 3D Y-axis flip across a card grid. Each card rotates 180deg revealing its back face. Diagonal propagation (row + col index) creates wave effect.
- **Parameters:** grid dimensions, stagger interval, direction (row/diagonal/radial), flip axis (X/Y)
- **Personality:** editorial (primary), cinematic-dark (compatible)
- **Key mechanism:** `backface-visibility: hidden` with `transform: rotateY(180deg)` on back face.

## From `linear-homepage`

### `bk-spring-card-hover` — Spring Card Hover
- **Category:** Interaction
- **Duration:** 200ms
- **Easing:** CSS `linear()` spring curve or cubic-bezier(0.22, 1, 0.36, 1)
- **Description:** Card lifts with translateY(-4px), subtle scale(1.01), and elevated shadow. The Linear-standard hover pattern.
- **Parameters:** lift distance, scale factor, shadow elevation
- **Personality:** universal

### `bk-linear-spring-curve` — CSS linear() Spring
- **Category:** Easing (not an animation primitive per se)
- **Description:** True bounce curve encoded with 40+ stop points in CSS `linear()` function. Produces spring-like motion in pure CSS without JS.
- **Personality:** universal
- **CSS value:** See linear-homepage.md breakdown for full stop-point list.

## From `sparse-dot-breathing`

### `bk-sparse-breathe` — Sparse Grid Breathing
- **Category:** Continuous / Ambient
- **Duration:** ~4000ms cycle (infinite loop)
- **Easing:** ease-in-out
- **Description:** Sparse grid of dots oscillates between scale(0.6) and scale(1.0) with phase-decorrelated timing. Adjacent dots breathe at different phases via diagonal offset + random jitter, preventing mechanical synchronization. Opacity shifts (0.5–0.9) track with scale.
- **Parameters:** grid cols/rows, dot size, breathe duration range, gap size
- **Personality:** universal (primary), neutral-light
- **Key mechanism:** Per-dot `animation-delay` calculated as `(row + col) * 300 + random(0, 400)` with per-dot `animation-duration` jitter (3600–4400ms).

## From `arc-wave-cascade`

### `bk-arc-cascade` — Arc Stagger Entrance
- **Category:** Reveal / Stagger
- **Duration:** 600ms per arc, 80ms stagger interval
- **Easing:** expo-out (entrance), ease-in (exit)
- **Description:** Curved arcs stagger vertically (top-to-bottom entrance, bottom-to-top exit). Each arc scales from 0.3 to 1.0 with opacity fade-in. SVG variant uses stroke-dashoffset for true arc drawing. Bidirectional stagger creates breathing rhythm.
- **Parameters:** arc count, stagger interval, curvature variation, direction (enter/exit)
- **Personality:** cinematic-dark
- **Key mechanism:** CSS `animation-delay: calc(var(--arc-index) * 80ms)` with reversed index for exit stagger. SVG `stroke-dashoffset` for draw-on variant.

### `bk-bidirectional-stagger` — Bidirectional Stagger Pattern
- **Category:** Reveal / Stagger (technique)
- **Duration:** Variable
- **Description:** Enter top-to-bottom, exit bottom-to-top (or any opposing direction pair). Creates a natural breathing rhythm rather than uniform motion. Exit stagger interval is tighter than entrance (60ms vs 80ms) for crisper departure.
- **Parameters:** enter direction, exit direction, enter interval, exit interval
- **Personality:** universal
- **Note:** Technique applicable to any staggered sequence — cards, list items, nav links.

## From `text-image-reveal`

### `bk-text-image-split` — Image Breathing Between Text Blocks
- **Category:** Content Effects / Typography
- **Duration:** ~3200ms cycle (1800ms expand, 1400ms contract)
- **Easing:** ease-in-out
- **Description:** A centered image window expands/contracts between two typographic blocks, pushing them apart and pulling them together. Image crop shifts via object-position during expansion (parallax within frame). Letter-spacing on text blocks responds to image state — wider when expanded, tighter when contracted.
- **Parameters:** expand height, contract height, image crop range, tracking range, cycle timing
- **Personality:** editorial (primary), cinematic-dark (compatible)
- **Key mechanism:** CSS `@keyframes image-breathe` on height + `@keyframes image-crop-shift` on object-position + `@keyframes tracking-breathe` on letter-spacing, all synchronized to same duration.

## From `flow-field-vortex`

### `bk-flow-field` — Flow Field Vortex
- **Category:** Continuous / Ambient
- **Duration:** Continuous (attractor drifts on ~3000ms Lissajous cycle)
- **Easing:** linear (angular velocity per segment)
- **Description:** Grid of short line segments rotating to align with a flow field created by a drifting attractor point. Segments near the attractor rotate faster and are brighter; peripheral segments barely move and are dimmer. Creates a vortex/wind field pattern.
- **Parameters:** grid cols/rows, segment length, attractor drift speed, influence falloff
- **Personality:** cinematic-dark
- **Key mechanism:** JS `requestAnimationFrame` loop computing `Math.atan2` angle per segment relative to attractor, with tangential offset (`+ Math.PI/2`) for vortex rather than convergence. CSS custom property `--seg-angle` drives rotation.

## From `kinetic-bars-scatter`

### `bk-bars-scatter` — Horizontal Scatter & Reconverge
- **Category:** Transitions / Content Effects
- **Duration:** ~3400ms cycle (600ms scatter + 1200ms hold + 800ms converge + 800ms hold)
- **Easing:** expo-out (scatter), expo-in-out (converge)
- **Description:** Vertical bars scatter to random horizontal positions (with clustering tendency), hold, then reconverge to even distribution. Height micro-pulse keeps bars alive during hold states. Scatter is fast (tension), converge is slow (resolution).
- **Parameters:** bar count, scatter clustering, converge/scatter durations, hold durations, bar dimensions
- **Personality:** cinematic-dark (primary), editorial (compatible)
- **Key mechanism:** JS controls `--bar-target` CSS custom property per bar. Clustering logic biases random positions toward 2 focal zones. CSS `transition` handles smooth movement.

## From `icon-document-morph`

### `bk-icon-to-layout` — Icon-to-Layout Morph
- **Category:** Transitions
- **Duration:** ~400ms (morph) + ~600ms (line stagger) = ~1000ms total build
- **Easing:** expo-out (expand), ease-out (line reveal)
- **Description:** Compact icon expands into a full content layout. The icon fades as a rectangle grows from its center, then the rectangle splits into structural elements (sidebar + content rows) with staggered line reveal. Solves the loading → content transition: the loading indicator *becomes* the content rather than being replaced. Icon and layout share a geometric center for spatial continuity.
- **Parameters:** icon selector, layout container, line count, stagger interval, expand duration
- **Personality:** cinematic-dark (primary), universal (at reduced scale/speed)
- **Key mechanism:** CSS `scale(0.2) → scale(1)` expansion on layout container with `animation-delay: calc(var(--line-index) * 100ms)` stagger on child lines. Icon opacity fades during first 40% of expansion.

### `bk-content-line-stagger` — Content Line Stagger with Brightness Cascade
- **Category:** Reveals / Stagger
- **Duration:** 300ms per line, 100ms interval
- **Easing:** ease-out
- **Description:** Horizontal placeholder lines (representing text/content rows) reveal top-to-bottom with staggered opacity. Differentiator from standard stagger: each successive line enters slightly dimmer than the previous, creating a "progressive rendering" effect — like a document loading in real-time. All lines then normalize to full brightness. Per-line width variation adds visual rhythm.
- **Parameters:** line count, stagger interval, brightness range (1.0 → 0.5), line width variation
- **Personality:** cinematic-dark (primary), editorial (compatible)
- **Key mechanism:** CSS custom property `--line-brightness` per line sets target opacity in `@keyframes line-enter`. Combined with `--line-width` for varied lengths. `translateX(-8px) → 0` adds subtle slide from left.

## From `nl-dot-grid-breathing`

### `bk-nl-dot-breathe` — Light Palette Dot Grid Breathing
- **Category:** Continuous / Ambient
- **Duration:** ~4500ms cycle (infinite loop)
- **Easing:** ease-in-out
- **Description:** Dense grid (~9x9) of small dark dots on light background oscillates between scale(0.7) and scale(1.0) with phase-decorrelated timing. Adapted from `bk-sparse-breathe` for light palettes: denser grid, smaller dots (3px vs 4px), lower opacity range (0.35–0.6 vs 0.5–0.9), tighter scale range, and slower cycle. Uses `--nl-text-tertiary` (stone-500) for warm dot color.
- **Parameters:** grid cols/rows, dot size, breathe duration range, gap size, dot color token
- **Personality:** neutral-light (primary)
- **Key mechanism:** Per-dot `animation-delay` calculated as `(row + col) * 200 + random(0, 500)` with per-dot `animation-duration` jitter (4200–4800ms). Reduced base phase multiplier (200 vs 300) compensates for higher grid density.
- **Light-palette adaptation formula:** density +30%, element size -25%, opacity ceiling -35%, scale range -33% vs dark equivalent.

## From `nume-ai-chat-dashboard`

### `bk-chat-typewriter-submit` — Chat Input Typewriter → Bubble Submit
- **Category:** Entrances / Interaction
- **Duration:** ~2000ms (typing) + 400ms (submit transition)
- **Easing:** linear (per char ~80ms), ease-out (bubble appear)
- **Description:** Text types character-by-character into a chat input field (monospace font, block cursor), then on submit the input clears and the text reappears in a right-aligned user bubble. The bubble fades in with subtle scale(0.97→1.0). Block cursor (solid rectangle, not line) blinks at 530ms with step-end timing.
- **Parameters:** text content, type speed (ms/char), input selector, bubble selector
- **Personality:** editorial (primary), cinematic-dark (compatible)
- **Key mechanism:** Monospace font in the input creates the "someone is actually typing" effect. Block cursor vs line cursor is a deliberate choice — it says "terminal" and "command," not "word processor."

### `bk-ai-response-stream` — AI Response Word-Group Streaming
- **Category:** Content Effects / Entrances
- **Duration:** Variable (~120ms per word-group, total 2000-3000ms for a paragraph)
- **Easing:** ease-out (per chunk fade+slide)
- **Description:** AI response text appears in word-groups (3-5 words at a time), simulating real-time LLM generation. Each chunk fades in with translateY(4px→0). Container height transitions smoothly as content is added. Fundamentally different from typewriter — chunked streaming reads naturally at paragraph scale, while character-by-character would be agonizingly slow.
- **Parameters:** chunk size (word count), chunk interval (ms), container selector
- **Personality:** editorial (primary), neutral-light (compatible)
- **Key mechanism:** JS splits text at word boundaries into ~4-word chunks, wraps each in a span with `--chunk-delay`, then CSS handles the fade+slide entrance. Container uses `transition: height 300ms ease-out` to grow smoothly.

### `bk-report-card-materialize` — Document Report Card Entrance
- **Category:** Entrances
- **Duration:** 500ms
- **Easing:** expo-out
- **Description:** Compact document card (icon + title + subtitle + arrow CTA) slides up from below with opacity 0→1. Dark elevated card on dark background with subtle border. The card is an intermediate object — it exists inline in conversation, then when clicked, becomes the anchor for a full dashboard panel. Icon is a document glyph, right side has an arrow affordance.
- **Parameters:** card selector, icon type, title, subtitle
- **Personality:** editorial (primary), cinematic-dark (compatible)
- **Key mechanism:** `opacity: 0; transform: translateY(16px);` → `opacity: 1; transform: translateY(0);` with expo-out. Card acts as a portal — its inline appearance in chat is a preview of the full report.

### `bk-chat-to-split-pane` — Single-to-Dual Pane Split Transition
- **Category:** Transitions (Phase-Level)
- **Duration:** 600ms
- **Easing:** expo-out
- **Description:** The signature choreography. A single-column chat view compresses leftward (~45% width) as a report panel slides in from the right edge (~55% width). Both panes gain header bars simultaneously. The chat content doesn't reflow — it compresses. The report panel enters with translateX(40px→0) + opacity 0→1 with a 200ms delay after the compression begins.
- **Parameters:** left pane width, right pane width, transition duration
- **Personality:** editorial (primary)
- **Key mechanism:** Chat container `transition: width 600ms expo-out`. Report panel `transition: opacity 400ms ease-out 200ms, transform 600ms expo-out`. Header bars use `height: 0→48px` transition. The 200ms stagger between compress-start and panel-appear prevents the eye from being split.

### `bk-stat-card-count-up` — Metric Card Stagger with Count-Up Values
- **Category:** Content Effects / Stagger
- **Duration:** 200ms interval stagger, 400ms entrance per card, 800ms count-up per value
- **Easing:** expo-out (entrance), ease-out (count-up)
- **Description:** Financial metric cards (label + large value + delta badge) enter left-to-right with stagger. After each card's entrance settles, its numeric value counts up from 0 to final. After value lands, a green/red delta badge fades in. Three sequential micro-animations on the same element, timed to the stagger offset: enter → count → badge.
- **Parameters:** card count, stagger interval, count duration, badge delay
- **Personality:** editorial (primary), neutral-light (compatible)
- **Key mechanism:** Card entrance via `animation-delay: calc(var(--stat-index) * 200ms)`. Count-up starts at `entrance-delay + 400ms`. Badge appears at `entrance-delay + 600ms`. Creates a waterfall of activity across the row.

### `bk-suggestion-chip-stagger` — Action Suggestion Chip Stack
- **Category:** Entrances / Interaction
- **Duration:** 150ms interval, 350ms per chip
- **Easing:** expo-out (enter), ease-in (dismiss)
- **Description:** Outlined pill buttons with monospace text and cyan/teal accent border stagger top-to-bottom. On selection: selected chip border brightens with a subtle pulse, unselected chips fade out simultaneously. Selected chip's text migrates to a right-aligned user bubble. The monospace font inside rounded pills is a strong design choice — it signals "these are commands" not "these are suggestions."
- **Parameters:** chip count, stagger interval, accent color, dismiss duration
- **Personality:** editorial (primary), cinematic-dark (compatible)
- **Key mechanism:** Stagger via `animation-delay: calc(var(--chip-index) * 150ms)`. Select state: `border-color` brightens + 200ms scale pulse. Dismiss: `opacity 0, translateY(-4px)` at 200ms ease-in.

### `bk-panel-content-swap` — Dashboard Panel Interior Crossfade
- **Category:** Transitions
- **Duration:** 500ms total (200ms exit + 300ms enter)
- **Easing:** ease-in (exit), expo-out (enter)
- **Description:** Report panel frame stays fixed while interior content crossfades between different views. Old content fades out (opacity 1→0, 200ms), new content fades in with micro-slide (opacity 0→1 + translateY(8px→0), 300ms). Header updates in sync. Keeps the user oriented — the container is stable, only the content changes.
- **Parameters:** exit duration, enter duration, enter slide distance
- **Personality:** editorial (primary), neutral-light (compatible)
- **Key mechanism:** Position old and new content absolutely within the panel. Old: `opacity → 0` at 200ms. New: `opacity → 1, translateY → 0` starting at 150ms (slight overlap for seamless feel).

### `bk-table-row-stagger` — Data Table Row Reveal
- **Category:** Reveals / Stagger
- **Duration:** 80ms interval per row
- **Easing:** ease-out
- **Description:** Data table rows enter top-to-bottom with tight stagger. Header row appears first as a group, then data rows follow individually. Each row: opacity 0→1 + translateX(-4px→0) (subtle leftward slide). Column values can include color-coded text (red for overruns, green for savings) that appears as part of the row entrance.
- **Parameters:** row count, stagger interval, slide distance
- **Personality:** editorial (primary), neutral-light (compatible)
- **Key mechanism:** `animation-delay: calc(var(--row-index) * 80ms)`. Header row at index 0 enters without slide. Color-coded cells use inline `color` property that becomes visible with the opacity transition.

### `bk-scroll-trigger-typewriter` — Scroll-Triggered Typewriter with Pre-Blink
- **Category:** Content Effects / Typography
- **Duration:** Variable (50ms/char) + 800ms pre-blink
- **Easing:** linear (typing), power1.inOut (blinks)
- **Description:** A heading typewriter effect triggered by GSAP ScrollTrigger (start: "top 90%"). Before typing begins, the cursor blinks twice (400ms each, yoyo) to create a "thinking before speaking" beat. After typing completes, cursor continues blinking indefinitely. Uses Typed.js for the typing, GSAP for the scroll trigger and cursor animation.
- **Parameters:** trigger selector, text content, type speed, cursor selector
- **Personality:** editorial (primary), universal
- **Key mechanism:** GSAP ScrollTrigger `once: true` fires → GSAP cursor blink (repeat: 1, yoyo) → `onComplete` triggers `new Typed()` → Typed `onComplete` starts infinite cursor blink. Three chained animation layers.

---

## Summary

| ID | Name | Category | Source Breakdown |
|----|------|----------|-----------------|
| `bk-grid-wave` | Grid Wave Propagation | Continuous / Ambient | dot-grid-ripple |
| `bk-distance-stagger` | Distance-Based Stagger | Reveal / Stagger | dot-grid-ripple |
| `bk-text-parallax-stack` | Text Parallax Stack | Typography | kinetic-type-scale-cascade |
| `bk-grid-flip-cascade` | Grid Flip Cascade | Reveal / Stagger | 3d-card-cascade |
| `bk-spring-card-hover` | Spring Card Hover | Interaction | linear-homepage |
| `bk-linear-spring-curve` | CSS linear() Spring | Easing | linear-homepage |
| `bk-sparse-breathe` | Sparse Grid Breathing | Continuous / Ambient | sparse-dot-breathing |
| `bk-arc-cascade` | Arc Stagger Entrance | Reveal / Stagger | arc-wave-cascade |
| `bk-bidirectional-stagger` | Bidirectional Stagger | Reveal / Stagger | arc-wave-cascade |
| `bk-text-image-split` | Image Breathing Between Text | Content Effects | text-image-reveal |
| `bk-flow-field` | Flow Field Vortex | Continuous / Ambient | flow-field-vortex |
| `bk-bars-scatter` | Horizontal Scatter & Reconverge | Transitions | kinetic-bars-scatter |
| `bk-icon-to-layout` | Icon-to-Layout Morph | Transitions | icon-document-morph |
| `bk-content-line-stagger` | Content Line Stagger w/ Brightness | Reveals / Stagger | icon-document-morph |
| `bk-nl-dot-breathe` | Light Palette Dot Grid Breathing | Continuous / Ambient | nl-dot-grid-breathing |
| `nl-wizard-step-crossfade` | Wizard Step Crossfade | Transitions | linear-onboarding-wizard |
| `nl-progress-dots` | Progress Dot Indicator | Component / State | linear-onboarding-wizard |
| `nl-inline-expand` | Inline Expand Reveal | Transitions / Interaction | linear-onboarding-wizard |
| `nl-card-select` | Card Selection State | Interaction / State | linear-onboarding-wizard |
| `nl-completion-stagger` | Completion Card Stagger | Entrances / Stagger | linear-onboarding-wizard |
| `nl-list-row-stagger` | List Row Stagger | Entrances / Stagger | linear-onboarding-wizard |
| `nl-loading-gate` | Loading Gate Interstitial | Transitions / State | linear-onboarding-wizard |
| `nl-phase-crossfade` | Phase Content Crossfade | Transitions | notion-onboarding-flow, vercel-onboarding-flow |
| `nl-field-reveal` | Form Field Height Reveal | Entrances | notion-onboarding-flow, vercel-onboarding-flow |
| `nl-staggered-card-entrance` | Staggered Card Entrance | Entrances / Stagger | notion-onboarding-flow |
| `nl-tag-pill-select` | Tag Pill Selection | Interaction / State | notion-onboarding-flow |
| `nl-button-activate` | Button Activation State | Interaction / State | notion-onboarding-flow, vercel-onboarding-flow |
| `nl-app-materialize` | Onboarding-to-App Dissolve | Transitions / Choreography | notion-onboarding-flow |
| `nl-radio-card-select` | Radio Card Selection | Interaction | vercel-onboarding-flow |
| `nl-provider-button-stagger` | Branded Button Stack Stagger | Entrances / Stagger | vercel-onboarding-flow |
| `nl-segmented-code-input` | Segmented Code Input | Entrances / Stagger | vercel-onboarding-flow |
| `nl-button-loading-swap` | Button Loading State Demotion | Interaction / Loading | vercel-onboarding-flow |
| `bk-chat-typewriter-submit` | Chat Input Typewriter → Bubble Submit | Entrances / Interaction | nume-ai-chat-dashboard |
| `bk-ai-response-stream` | AI Response Word-Group Streaming | Content Effects / Entrances | nume-ai-chat-dashboard |
| `bk-report-card-materialize` | Document Report Card Entrance | Entrances | nume-ai-chat-dashboard |
| `bk-chat-to-split-pane` | Single-to-Dual Pane Split | Transitions | nume-ai-chat-dashboard |
| `bk-stat-card-count-up` | Metric Card Stagger + Count-Up | Content Effects / Stagger | nume-ai-chat-dashboard |
| `bk-suggestion-chip-stagger` | Action Suggestion Chip Stack | Entrances / Interaction | nume-ai-chat-dashboard |
| `bk-panel-content-swap` | Dashboard Panel Interior Crossfade | Transitions | nume-ai-chat-dashboard |
| `bk-table-row-stagger` | Data Table Row Reveal | Reveals / Stagger | nume-ai-chat-dashboard |
| `bk-scroll-trigger-typewriter` | Scroll-Triggered Typewriter w/ Pre-Blink | Content Effects / Typography | nume-ai-chat-dashboard |
