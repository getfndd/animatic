# Animation Personality Research

Research conducted 2026-02-21 to inform the personality-based animation system.

## Revised Personality Model

Based on research across ~20 products and industry patterns, the personality system should be:

### 3 True Personalities + 1 Primitives Library

| Name | Type | Status | Identity |
|------|------|--------|----------|
| **Cinematic** | Personality | Built (as cinematic-dark) | Dramatic reveals, 3D camera, spring physics, clip-path wipes, focus-pull |
| **Editorial** | Personality | Research complete, ready to build | Content-forward staggers, crossfades, scroll-bound pacing, interface-as-demo |
| **Montage** | Personality (HTML layer) | Research complete | Rapid scene cuts, full-screen typography, stat callouts, split-screen compositions |
| **Processing** | Shared primitives | Mostly built in React app | Thinking indicators, status labels, streaming, progressive reveal |

**Tutorial** was absorbed: its primitives (spotlight, cursor, step indicators) can be composed from editorial personality + tutorial-specific primitives. Not different enough choreography to justify a full standalone personality.

---

## Editorial Personality

### Core Philosophy
"Animation should feel like typography. It creates rhythm, establishes hierarchy, and guides the eye. It never competes with the content it serves."

### Signature Techniques
1. **Gentle stagger reveals** — 80-150ms between siblings, 400-600ms per element, fade + translateY(8-12px)
2. **Crossfade transitions** — 300-500ms, ease-out between content states (not clip-path wipes)
3. **Scroll-bound pacing** — viewer controls progression (editorial = reading pace)
4. **Ambient atmospheric elements** — slow gradients, soft glows, subtle parallax
5. **Interface-as-demo** — the product shows itself transforming between states
6. **Blur-to-sharp reveals** — hero moments develop like photographs (Linear's signature)
7. **Content cycling** — verb + icon swap animations, search query refinement
8. **Morph/FLIP transitions** — only for spatially-related content (shared elements between views)

### Taxonomy vs Other Personalities

| Dimension | Editorial | Cinematic | Montage |
|-----------|-----------|-----------|---------|
| Pacing control | Viewer (scroll, click) | Director (timed sequence) | Director (rapid cuts) |
| Content relationship | Content is the star | Animation is the star | Variety is the star |
| Transition default | Crossfade | Clip-path wipe | Hard cut / whip-wipe |
| Timing | 300-600ms, ease-out | 800-1500ms, spring | 200-400ms, sharp |
| Stagger purpose | Establish hierarchy | Build anticipation | Create rhythm |
| Ambient motion | Yes, atmospheric | Yes, dramatic | No, too fast |
| Camera | No 3D perspective | 3D rotations | Full-screen scene cuts |
| Loop time | Scroll-driven or 12-16s | 17-20s | 30-45s |

### Reference Products
- **Linear** — blur reveal, specular highlights, ambient gradient, interface-as-demo
- **Readymag** — scroll-as-narrative-control, editorial layout, reader-paced
- **Pitch** — morph/FLIP transitions, snappy easing (200-400ms), slide-as-brand-object
- **Notion** — minimal animation, crossfade feature switching, AI character, whitespace-driven
- **Arc** — micro-interaction polish, spring-based panels, release notes as editorial content
- **Stripe** — WebGL gradient mesh, restrained CSS, multi-tool approach per element

### Key Pattern: Interface-as-Demo
The dominant 2025-2026 SaaS pattern. Show the actual product interface transforming between states on scroll or tab click. No annotated screenshots, no zooming cursors. Trust the material.

---

## Montage Personality

### The Critical Split

Research revealed two fundamentally different things conflated under "montage":

**Category A: Rapid-Scene Web Animation (achievable in HTML pipeline)**
- Full-screen typography cards between product demo micro-scenes
- Hard cuts or whip-wipe transitions (clip-path + transform, 200-400ms)
- Multiple mini product demos sequenced back-to-back (2-3s each)
- Number/stat callouts with count-up animations
- Split-screen compositions showing multiple features simultaneously
- Photography backgrounds behind text overlays (CSS parallax)
- Dramatic zoom-ins on UI details (CSS scale)
- Loop time: 30-45s

**Category B: Brand Film (requires video production tools)**
- Live-action footage intercut with UI
- Beat-synced editing with audio
- Camera moves through real photography
- Real 3D product renders
- Professional color grading
- Slow motion / speed ramping

### Recommended Three-Layer Architecture

```
LAYER 1: HTML Animation Pipeline (current + new montage personality)
  - Individual product demo scenes (cinematic)
  - Full-screen typography moments (montage)
  - Stat/number callouts, photography overlays
  Output: Standalone HTML embeds + captured video clips

LAYER 2: Remotion (future addition)
  - Assembles HTML-pipeline clips into sequenced video
  - Adds audio track and beat-sync
  - Scene-to-scene transitions at video level
  Output: Finished sizzle reel video files

LAYER 3: After Effects / Premiere (for premium brand films)
  - Live-action footage, professional compositing
  - One-off creative productions
  Output: Brand film / launch trailer
```

### Reference Products
- **Apple product pages** — scroll-driven image sequences (pre-rendered in 3D tools, played back on canvas) + CSS text animations
- **Stripe** — WebGL gradient + CSS product animations, multi-tool approach, "lightest tool that achieves the effect"
- **Vercel Ship** — WebGL ferrofluid shader + Motion (Framer Motion) + AI-generated imagery
- **Figma Config trailers** — traditional After Effects video production (NOT web animation)
- **Framer site** — most web-native: all interactive, scroll-driven, no video

### Key Insight: Remotion as Bridge
Remotion (remotion.dev) renders React components frame-by-frame into video files. Reuses React/CSS skills. Version-controllable. Could assemble our HTML scene captures + typography cards + audio into finished video. Best for template-driven videos, not one-off creative.

---

## Processing: Shared Primitives (NOT a Personality)

### Evidence
Every AI product composes from the same 7 primitives. No product has a unified "processing personality" — they all mix and match:
- Perplexity = Status Labels + Progressive Source Reveal + Token Streaming
- ChatGPT = Thinking Indicator + Duration-Gated Disclosure + Token Streaming
- Claude = Breathing Cursor + Dot Prelude + Intentional Pause + Token Streaming

### The 7 Fundamental Primitives

1. **Thinking Indicator** — visual signal before output (cursor pulse, gradient pulse, shimmer)
2. **Status Label Rotation** — sequential text: "Searching..." → "Analyzing..." → "Preparing..."
3. **Token/Character Streaming** — text appearing progressively with natural rhythm
4. **Progressive Source/Result Reveal** — result items stagger in as discovered
5. **Split-Pane Generation** — conversation on one side, artifact/preview on other
6. **Progressive Clarity** — output starts vague/rough and sharpens (noise → composition → detail)
7. **Duration-Gated Disclosure** — different UI feedback based on wait duration

### Current Coverage

| Primitive | Status | Implementation |
|-----------|--------|---------------|
| Thinking Indicator | Built | `useThinkingCursor` hook |
| Status Label Rotation | Built | `useDemoStreaming` phases |
| Token Streaming | Built | `useDemoStreaming` + `useProductionStreaming` |
| Progressive Source Reveal | Not built | Need staggered card entrance for citations |
| Split-Pane Generation | Not built | Would need for artifact/document features |
| Progressive Clarity | Not built | blur-to-sharp or skeleton-to-content |
| Duration-Gated Disclosure | Built | Thresholds in thinking cursor |

### Architecture

```
Processing Primitives (shared, personality-agnostic)
├── ThinkingIndicator
├── StatusLabelRotation
├── TokenStreaming
├── ProgressiveReveal
├── ProgressiveClarity
├── SplitPaneGeneration
└── DurationGatedDisclosure

Used by:
├── Cinematic personality (for marketing demos showing AI features)
├── Editorial personality (for content generation showcases)
├── Montage personality (for rapid AI workflow montages)
└── Production app (for actual in-app AI interactions)
```

---

## Tutorial: Absorbed, Not Separate

The research showed tutorial animation (spotlight, cursor sim, step indicators) doesn't have a distinct enough choreography to warrant its own personality. Instead:

- Tutorial **primitives** (spotlight, cursor, step indicators, tooltips) live as a shared library
- They compose with the **editorial** personality's gentle pacing + crossfade transitions
- The existing `neutral-light/engine.js` primitives are valid — they just attach to editorial personality rather than being standalone

This simplifies the system from 5 personalities to 3 + 2 shared primitive libraries.

---

## Broader Industry Trends (2025-2026)

1. **Ambient animation as default** — subtle, slow-moving details (the "sound mix" metaphor)
2. **CSS Scroll-Driven Animations** — broadly adopted, replaces GSAP ScrollTrigger for simple cases
3. **`linear()` CSS easing** — custom bounce curves without JS (could replace our keyframe spring approximations)
4. **View Transitions API** — browser-native morph transitions between states (Interop 2026 focus)
5. **Craft as counterweight to AI** — hand-crafted animation signals authenticity
6. **Interface-as-demo** — trust the product to show itself, no annotated screenshots

### Key People
- **Emil Kowalski** (Linear, formerly Vercel) — creator of animations.dev, most influential voice in SaaS product animation. Philosophy: spring physics, ease-out everything, short durations (150-300ms), purposeful only.

### Key Resources
- [animations.dev](https://animations.dev/) — Emil Kowalski, 42 lessons
- [scroll-driven-animations.style](https://scroll-driven-animations.style/) — CSS scroll animation demos
- [The Shape of AI](https://www.shapeof.ai) — AI UX patterns collection
- [AI UX Patterns Library](https://www.aiuxpatterns.com/)

---

## Sources

Full source lists in each research agent's output. Key sources:
- [The Linear Look (Frontend Horse)](https://frontend.horse/articles/the-linear-look/)
- [Smashing Magazine: Ambient Animations](https://www.smashingmagazine.com/2025/09/ambient-animations-web-design-principles-implementation/)
- [Stripe Blog: Connect Front-End Experience](https://stripe.com/blog/connect-front-end-experience)
- [Vercel Blog: Ship Conference Platform](https://vercel.com/blog/designing-and-building-the-vercel-ship-conference-platform)
- [CSS-Tricks: Apple Scrolling Animations](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/)
- [Gemini AI Visual Design (Google Design)](https://design.google/library/gemini-ai-visual-design)
- [Smashing Magazine: Design Patterns for AI Interfaces](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/)
- [Remotion.dev](https://www.remotion.dev/)
