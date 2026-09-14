# Performance Patterns

Memoization, list virtualization, bundle and render cost. Load when something is slow and the cause is in the component layer. For field metrics see `web-vitals.md`.

---

### Rendering

- `React.memo` only when you've measured a performance problem — not by default
- `useMemo` for expensive computations (filtering large lists, complex transforms)
- `useCallback` for stable references passed to memoized children or effect dependencies
- Never optimize what you haven't profiled. React DevTools Profiler is the tool.

### Code Splitting

- Lazy load at the route level: `React.lazy(() => import('./pages/Settings'))`
- Do not lazy-load leaf components — the overhead isn't worth it
- Suspense boundaries at route transitions, not around every lazy component
- Prefetch critical routes on hover or when likely to be visited

### List Rendering

- Under 100 items: just render them
- 100-1000 items: consider windowing, but measure first
- 1000+ items: virtual scrolling (react-window, @tanstack/virtual)
- Always key by stable ID, never by index (unless list is static and never reorders)

### Input Handling

- Debounce search inputs (300ms default)
- Debounce filter changes (150ms default)
- Throttle scroll handlers (16ms = 1 frame)
- Never debounce discrete actions (button clicks, toggle switches)

### DOM Performance

- Never read and write DOM in the same frame (layout thrashing)
- Batch DOM reads, then batch DOM writes
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `padding`, `margin` — use `transform: scale()` or `grid-template-rows`

### Image & Asset Performance

- Lazy load images below the fold (`loading="lazy"`)
- Use appropriate formats: WebP for photos, SVG for icons
- Size images to display dimensions — never serve 2000px for a 200px container
- Preload critical images with `<link rel="preload">`

### Bundle Performance

- Watch bundle size in CI — set a budget and alert on regression
- Tree-shake unused exports — prefer named exports over default
- Avoid barrel files (`index.ts` re-exporting everything) in large modules
- Analyze with `vite-plugin-visualizer` or equivalent

### Core Web Vitals

LCP (loading), INP (responsiveness), and CLS (visual stability) are the field metrics users actually experience. Read `reference/web-vitals.md` for thresholds, the usual cause behind each bad score, and the fixes in payoff order — load it when a vitals score is the presenting problem rather than carrying it in context for every build task.

Two things worth knowing without opening it: judge at the 75th percentile, because an average routinely hides a quarter of users having a bad time; and a skeleton that shifts on load is worse than a spinner that doesn't.
