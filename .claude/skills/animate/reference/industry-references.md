# Web Animation Industry References (2026)

Curated guide to the state of the art in product animation for SaaS.

## Gold Standard Products (Study These)

| Product | Why | Key Technique |
|---------|-----|---------------|
| **[Linear](https://linear.app)** | Spring physics with restraint, 150-300ms micro-interactions, purposeful-only motion | Speed hierarchy, bento grid features page, dark UI |
| **[Raycast](https://raycast.com)** | "Show don't tell" homepage — dynamic slider shows product in action | CSS animations preferred, Framer Motion for complex, ease-out always |
| **[Vercel](https://vercel.com)** | SSG + progressive enhancement, animations load instantly | Motion library + Tailwind, server-rendered shell → client animation |
| **[Rive](https://rive.app)** | Their own site is the best demo — interactive characters respond to scroll/cursor | State machine animations, 10-15x smaller than Lottie |
| **[Figma](https://figma.com)** | Scroll-driven storytelling, WebGL for depth | Scrollytelling, micro-animations |
| **[Notion](https://notion.so)** | Bento design masterpiece, animation serves information architecture | Template previews and features flow together |

## Key Person: Emil Kowalski

Design engineer at Linear (formerly Vercel). Creator of [animations.dev](https://animations.dev/) — 42-lesson video course ($199). **The single most influential voice in SaaS product animation.** His philosophy:
- Spring physics, not duration-based
- Ease-out for everything (fast start, gentle stop)
- Short durations (150-300ms)
- Purposeful motion only — nothing decorative
- Speed hierarchy (different elements move at different speeds)

## Library Landscape

| Library | Best For | Bundle | License |
|---------|----------|--------|---------|
| **[Motion](https://motion.dev)** (fka Framer Motion) | React UI animations, gestures, layout | ~32KB | MIT |
| **[GSAP](https://gsap.com)** | Complex cinematic timelines, framework-agnostic | ~23KB | Webflow-owned |
| **[React Spring](https://react-spring.dev)** | Natural physics motion, Three.js | Modular | MIT |
| **[Rive](https://rive.app)** | Interactive state-machine animations, icons | Small binary | Commercial |
| **[Lottie](https://lottiefiles.com)** | Simple looping animations, icons | JSON | Open source |
| **[animate.style](https://animate.style/)** | Drop-in CSS entrance/exit/attention effects | ~16KB CSS | MIT |
| **[TailwindCSS Motion](https://motion.tailwindcss.com/)** | Utility-first CSS animations for Tailwind projects | ~5KB CSS | Open source |
| **[Animate UI](https://animate-ui.com/)** | Pre-built animated React components (80+), Shadcn-compatible | Copy-paste | MIT |
| **[Remotion](https://remotion.dev/)** | Programmatic video from React components | Framework | Open source |
| **[Anime.js](https://animejs.com/)** | Lightweight timeline/stagger, SVG animation | ~7KB | MIT |

**For product demos:** CSS animations with spring-physics keyframes (what we already do) — zero dependencies, instant load, embeddable. For production React app: Motion is the right choice. For Tailwind prototypes: TailwindCSS Motion for zero-JS animation utilities.

**In our toolbox:**
- **animate.style** — Curated subset (18 Use, 12 Adapt, 50+ Skip). See `reference/primitives/sources/animate-style.md`.
- **TailwindCSS Motion** — Active tool for Tailwind-based prototypes. ~5KB pure CSS, zero JS, composes via utility classes. Highest performance scores alongside native CSS.

**Rive > Lottie** for 2026: 10-15x smaller files, ~60 FPS vs ~17 FPS, built-in state machines. Intercom migrated from Lottie to Rive.

**Remotion** is the upgrade path for programmatic video at scale. Same mental model as our pipeline (React components as animation source → video frames). Their AI Skills system validates our agent-driven approach. See SKILL.md "Future: Remotion Upgrade Path."

## CSS Features Now Production-Ready

| Feature | Status | Replaces |
|---------|--------|----------|
| Scroll-Driven Animations | Chrome/Edge/Safari 26+ | GSAP ScrollTrigger |
| Same-Doc View Transitions | All browsers | Custom JS transitions |
| Cross-Doc View Transitions | Interop 2026 focus | Full-page transitions |
| `linear()` easing function | All browsers | JS spring approximation |

The `linear()` CSS function enables custom bounce curves without JS — could replace our keyframe spring approximations.

## Spring Physics Constants

Common recipes (same math as Apple's `CASpringAnimation`):

| Feel | Stiffness | Damping | Mass |
|------|-----------|---------|------|
| Snappy UI response | 300 | 30 | 1 |
| Gentle settle | 200 | 20 | 1 |
| Bouncy entrance | 150 | 12 | 1 |
| Heavy element | 200 | 25 | 2 |

## Why Linear Feels So Good

1. Spring physics, not fixed duration
2. Ease-out for all interactive responses
3. Short durations (150-300ms)
4. Purposeful motion only
5. Staging — one attention point at a time
6. Speed hierarchy across elements

## Learning Resources

1. **[animations.dev](https://animations.dev/)** — Emil Kowalski, $199, 42 lessons. Most relevant for product animation.
2. **[scroll-driven-animations.style](https://scroll-driven-animations.style/)** — Interactive CSS scroll animation demos
3. **[Codrops](https://tympanus.net/codrops/)** — Cutting-edge WebGL and animation experiments
4. **[bentogrids.com](https://bentogrids.com/)** — Curated bento grid design collection

## Awwwards Collections (Browse for Inspiration)

| Collection | URL | Focus |
|-----------|-----|-------|
| **Animation** | [awwwards.com/websites/animation/](https://www.awwwards.com/websites/animation/) | Best animation websites, curated by the Awwwards jury |
| **Framer Motion** | [awwwards.com/websites/motion/](https://www.awwwards.com/websites/motion/) | Sites built with Motion (fka Framer Motion) |
| **GSAP** | [awwwards.com/websites/gsap/](https://www.awwwards.com/websites/gsap/) | Sites using GSAP timeline animations |
| **3D** | [awwwards.com/websites/3d/](https://www.awwwards.com/websites/3d/) | Three.js, WebGL, WebGPU experiences |
| **Interactive** | [awwwards.com/websites/web-interactive/](https://www.awwwards.com/websites/web-interactive/) | Gamified, storytelling, interactive narrative |
| **Sites of the Day** | [awwwards.com/websites/sites_of_the_day/](https://www.awwwards.com/websites/sites_of_the_day/) | Daily winners across all categories |

Recent notable animation SOTD winners (Feb 2026):
- SILEENT (Developer Award)
- The Renaissance Edition (Developer Award)
- Ciridae (Developer Award)
- Explore Primland (Developer Award)
- Liquid Technology by DD.NYC (Framer Motion)
- 12 Mil (SOTD Dec 2025)

## Case Studies Worth Studying

### [Dropbox Brand](https://brand.dropbox.com/)
Brand guidelines as a spatial environment you enter, not a document you read.
- **Scroll-driven zoom navigation** — 8 tiles start at `scale(2)`, scale down as you scroll, each with a unique directional vector creating an "explosion" effect
- **Click-to-fullscreen transitions** — Tile expands to fill viewport with title at `scale(4)` before navigating. Wayfinding as theater.
- **Outline-to-fill motif** — Recurring brand signature. Elements transition from outlined to filled on hover. Every tile has a bespoke hover.
- **Gridline expansion** — Lines expand from center on load using `scaleX`/`scaleY` from a central origin
- **Credits avatars** — Team member avatars fly in from random positions with staggered delays on mouse-enter
- **Key takeaway:** Animation as spatial metaphor. Scrolling = zooming into the brand.

### [Brand.ai](https://brand.ai/)
AI-powered brand management platform. Premium editorial aesthetic.
- **Role-based content switching** — Tabbed carousel cycles through use cases with tailored imagery
- **Large editorial imagery** — Tall portrait-ratio screenshots dominate, suggesting scroll-driven reveal
- **Natural language search UI** — Conversational interface rather than filter-based
- **Minimal chrome** — Clean, generous whitespace, brand-forward photography
- **Key takeaway:** Premium SaaS positioning through restraint and editorial quality over animation quantity.

### SVGator Animation Taxonomy
[svgator.com/blog/website-animation-examples-and-effects/](https://www.svgator.com/blog/website-animation-examples-and-effects/)

Comprehensive taxonomy of 30+ animation effect types. Most relevant for SaaS demos:

| Priority | Effect | Best Use Case |
|----------|--------|---------------|
| **High** | Microinteractions | Form feedback, button states, toggle switches |
| **High** | Hero Section Animations | Above-fold product previews |
| **High** | Scrollytelling | Sequential feature explanation |
| **High** | Self-Drawing SVG | Animated diagrams that "draw themselves" |
| **Medium** | Morphing Effects | State transitions (button → loader) |
| **Medium** | Animated Icons | Navigation, feature callouts |
| **Medium** | Page Transitions | Multi-step onboarding |
| **Lower** | Liquid/Glass/Clay effects | Consumer-facing, playful products |

### Notable Marketing Animation Techniques
[outmost.studio — top 11 marketing animated videos](https://www.outmost.studio/post/top-11-marketing-animated-videos-of-2024-updated-best-in-creativity-and-strategy)

| Brand | Technique | Takeaway |
|-------|-----------|----------|
| Google Workspace | Clean modern animation + narration | Real-world app demos > abstract concepts |
| VISA Threat Intel | Minimalist tech aesthetic, snappy transitions | Simplify complexity through clean motion |
| Intel "Hype" | Text-led typographic animation | Copy-forward animation can be powerful |
| Amex Platinum | Hand-crafted texture at 12fps | Lower frame rate = luxury/warmth feel |
| Facebook Brand | Interface scenes + character animation | Breaking brand color conventions with animation |

## Where to Push Animation Further

1. **CSS `linear()` easing** — Could replace our keyframe spring approximations with true bounce curves in pure CSS
2. **Scroll-driven animations** on marketing site — feature sections that animate on scroll, no JS
3. **Bento grid feature showcase** — The expected format for SaaS features pages in 2026
4. **Rive** for marketing site illustrations/icons — not for product demos (those should stay real UI)
5. **Motion (Framer Motion)** in the React app — for production transitions beyond prototypes
