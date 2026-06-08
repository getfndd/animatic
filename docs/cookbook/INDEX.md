# Animation Pattern Cookbook — Index

Reusable pattern recipes: named choreography you can paste into a scene and adapt. Each entry ties a pattern to its primitives (registry IDs) and a reference breakdown to study. Patterns surface in `search_primitives` with `source: pattern`.

**Format per entry:** description + when-to-use, beat-table recipe, manifest snippet, primitives table, breakdown reference, variations.

For complete brief→video walkthroughs (full project, rendered output), see [walkthroughs/](walkthroughs/INDEX.md).

---

## All Patterns

| Ref | Title | Category | Personality | Duration | Primitives | Breakdown | Tags |
|-----|-------|----------|-------------|----------|------------|-----------|------|
| [product-hero-push-in](product-hero-push-in.md) | Product Hero with Push-In + Text Reveal | hero | cinematic-dark | ~4s scene | ct-text-hero, ct-char-stagger, ct-slow-push | linear-homepage | hero, typography, camera, push-in, entrance, product-demo |
| [dashboard-data-build](dashboard-data-build.md) | Dashboard Data Build | data-viz | editorial, cinematic-dark | ~5s scene | cd-bar-grow, cd-card-cascade, bk-table-row-stagger | mercury-insights-sizzle | dashboard, chart, stagger, data, product-demo, bar-chart |
| [testimonial-crossfade](testimonial-crossfade.md) | Testimonial Crossfade Cycle | content | editorial | ~3s per quote | ed-content-cycle, as-fadeIn | text-image-reveal | testimonial, crossfade, content-cycle, quote, social-proof |
| [chat-to-result-reveal](chat-to-result-reveal.md) | Chat Prompt → Result Reveal | conversational | editorial, cinematic-dark | ~6s scene | bk-chat-typewriter-submit, bk-suggestion-chip-stagger, bd-result-grid | nume-ai-chat-dashboard | chat, ai, typewriter, progressive-reveal, prompt, product-demo |
| [onboarding-step-flow](onboarding-step-flow.md) | Onboarding Step Flow | onboarding | neutral-light | ~4s per step | nl-slide-stagger, nl-field-reveal, nl-provider-button-stagger | linear-onboarding-wizard | onboarding, wizard, form, stagger, multi-step, light-mode |
| [feature-grid-cascade](feature-grid-cascade.md) | Feature Grid Cascade | layout | editorial | ~3s scene | bk-grid-flip-cascade, bd-moodboard | 3d-card-cascade | grid, cascade, cards, reveal, features, gallery |
| [logo-resolve-close](logo-resolve-close.md) | Logo Resolve Closing Card | brand | cinematic-dark, montage | ~3s scene | hm-logo-resolve, ct-glow-pulse, mo-text-hero | mercury-insights-sizzle | logo, brand, closing, tagline, logo-lockup, end-card |
| [metric-highlight-pop](metric-highlight-pop.md) | Metric Highlight Pop | data-viz | cinematic-dark, editorial | ~2.5s scene | hm-metric-explosion, cd-bar-grow | mercury-insights-sizzle | metric, stat, count-up, hero-moment, number, proof |
| [ambient-brand-loop](ambient-brand-loop.md) | Ambient Brand Loop | ambient | cinematic-dark | loop (6–12s cycle) | bk-flow-field, ct-aurora-gradient, bk-sparse-breathe | flow-field-vortex | ambient, background, loop, generative, brand, atmosphere |
| [before-after-morph](before-after-morph.md) | Before/After Morph | transition | editorial, neutral-light | ~3s scene | hm-before-after-morph | icon-document-morph | before-after, morph, match-cut, transformation, comparison |
| [card-conveyor-feed](card-conveyor-feed.md) | Card Conveyor Feed | layout | editorial, cinematic-dark | ~4s scene | bd-card-conveyor, hm-card-fan-out | card-conveyor-depth-rail | conveyor, depth, card-stack, feed, z-rail, selection |
| [tutorial-spotlight](tutorial-spotlight.md) | Tutorial Spotlight Walkthrough | onboarding | neutral-light | ~3s per step | nl-spotlight, nl-tooltip, bd-spotlight-cursor-reveal | notion-onboarding-flow | tutorial, spotlight, cursor, walkthrough, step-indicator, teaching |
| [kinetic-type-statement](kinetic-type-statement.md) | Kinetic Type Statement | typography | cinematic-dark | ~3s scene | ct-char-stagger, ct-text-sweep, ct-text-hero | kinetic-type-scale-cascade | typography, kinetic-type, statement, scale, cascade, manifesto |
| [montage-sizzle-open](montage-sizzle-open.md) | Montage Sizzle Open | hero | montage | ~2s per shot | mo-text-hero, mo-scale-entrance, mo-stat-reveal | mercury-insights-sizzle | sizzle, montage, whip, opening, hard-cut, rapid, brand-launch |
| [chart-drilldown-explain](chart-drilldown-explain.md) | Chart Drilldown Explain | data-viz | editorial, cinematic-dark | ~5s scene | bd-chart-build-explain, cd-panel-drilldown, hm-chart-to-insight-reveal | mercury-insights-sizzle | chart, drilldown, explain, insight, panel, bar-chart, analysis |
| [progress-resolve](progress-resolve.md) | Working-State Progress Resolve | conversational | cinematic-dark, editorial | ~4s scene | cd-progress-animation, cd-draw-checks, bk-report-card-materialize | icon-document-morph | progress, loading, processing, checkmark, ai, working-state, resolve |

---

## By Category

**Hero:** product-hero-push-in, montage-sizzle-open
**Data-viz:** dashboard-data-build, metric-highlight-pop, chart-drilldown-explain
**Conversational:** chat-to-result-reveal, progress-resolve
**Onboarding:** onboarding-step-flow, tutorial-spotlight
**Layout:** feature-grid-cascade, card-conveyor-feed
**Brand:** logo-resolve-close
**Ambient:** ambient-brand-loop
**Typography:** kinetic-type-statement
**Transition:** before-after-morph
**Content:** testimonial-crossfade

## By Personality

**Cinematic Dark:** product-hero-push-in, dashboard-data-build, chat-to-result-reveal, logo-resolve-close, metric-highlight-pop, ambient-brand-loop, card-conveyor-feed, kinetic-type-statement, chart-drilldown-explain, progress-resolve
**Editorial:** dashboard-data-build, testimonial-crossfade, chat-to-result-reveal, feature-grid-cascade, metric-highlight-pop, before-after-morph, card-conveyor-feed, chart-drilldown-explain, progress-resolve
**Neutral Light:** onboarding-step-flow, tutorial-spotlight, before-after-morph
**Montage:** montage-sizzle-open, logo-resolve-close

---

## Adding a New Pattern

1. Copy the section structure from any entry (frontmatter → description → recipe → manifest snippet → primitives → breakdown → variations)
2. Save as `docs/cookbook/{pattern-id}.md`
3. Verify every primitive ID exists in the registry and its personality tags include the pattern's personality
4. Add a row to the All Patterns table above — the MCP loader parses this table (`parseCookbookIndex`)
5. Confirm with `search_primitives source=pattern` that the new pattern surfaces
