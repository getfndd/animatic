# Core Web Vitals

Field metrics for loading, responsiveness, and visual stability. Loaded when diagnosing a performance regression or when a Lighthouse/RUM score is the presenting problem.

| Metric | Measures | Good | Usual cause when bad |
|--------|----------|------|---------------------|
| **LCP** (Largest Contentful Paint) | Loading — when the main content appears | ≤ 2.5s | Unoptimized hero image, render-blocking CSS/JS, slow server response |
| **INP** (Interaction to Next Paint) | Responsiveness — worst-case interaction latency | ≤ 200ms | Long tasks on the main thread, expensive re-renders on input |
| **CLS** (Cumulative Layout Shift) | Visual stability — unexpected movement | ≤ 0.1 | Images without dimensions, injected banners, late-loading fonts |

**Fixes, in order of usual payoff:**

*LCP* — set `fetchpriority="high"` on the hero image and preload it; serve modern formats at display size; eliminate render-blocking resources; make sure the LCP element is server-rendered rather than fetched client-side.

*INP* — break long tasks. Anything over 50ms blocks the next paint. Yield to the main thread between chunks of work, move heavy computation off the critical path, and keep input handlers doing the minimum needed to show a response. INP is a *worst-case* metric, so the rare janky interaction is the one that scores you.

*CLS* — always set `width`/`height` (or `aspect-ratio`) on images and video; reserve space for anything that loads late (ads, embeds, banners); use `font-display: optional` or preload fonts to avoid reflow on swap; never insert content above existing content unless the user triggered it.

**Rules:**
- Measure in the field (RUM), not just in Lighthouse. Lab numbers on a fast laptop hide the p75 that actually counts.
- Judge at the 75th percentile. An average that looks fine routinely hides a quarter of users having a bad time.
- A skeleton that shifts on load is worse than a spinner that doesn't. Match skeleton dimensions to the real content.
