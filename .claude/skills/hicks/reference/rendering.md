# Rendering, Hydration, and Server Components

Loaded when working in Next.js, Remix, or any server-rendered React app. Skip for pure SPAs.

---

## Rendering Strategies

| Strategy | HTML built | Use when | Cost |
|----------|-----------|----------|------|
| **Static (SSG)** | At build | Content that changes rarely and is the same for everyone | Rebuild to update |
| **Incremental (ISR)** | At build, revalidated on a timer | Mostly-static content that changes without a deploy | Staleness window |
| **Server (SSR)** | Per request | Personalized or fast-changing content that must be in the initial HTML | Server time per request |
| **Client (CSR)** | In the browser | Behind auth, highly interactive, SEO-irrelevant | Blank until JS loads |

**Default to the most static option the content allows.** Escalate only when the content genuinely requires it — personalization, freshness, or auth. Rendering strategy is a per-route decision, not a per-app one.

**The LCP rule:** whatever element is the Largest Contentful Paint must be in the server-rendered HTML. If it arrives via a client fetch, LCP includes a full JS download, parse, and round trip.

---

## Server Components

### The Boundary

`'use client'` marks the boundary, and everything imported below it joins the client bundle. The boundary is about *imports*, not the file tree — a client component importing a 200KB library pulls that library to the browser regardless of where the file lives.

**Rules:**
- Push `'use client'` as far down the tree as possible. Marking a layout as client makes every child client too.
- A server component may render a client component. A client component may not import a server component — but it can accept one as `children`, which is the standard escape hatch:

```tsx
// Server component passes server-rendered content through a client shell
<ClientAccordion>
  <ServerRenderedPanel />   {/* stays on the server */}
</ClientAccordion>
```

- Data fetching belongs in server components. Fetching in a client component means a round trip that starts only after JS loads.
- Secrets, API keys, and database access only exist in server components. Anything referenced by a client component is public — assume it will be read.

### Serialization

Props crossing the server→client boundary are serialized. Functions, class instances, `Symbol`, and `Date` (in some setups) do not survive.

Pass plain data and IDs across the boundary; construct the rich objects on the client side. A serialization error at the boundary is usually a sign that too much is being pushed across — reconsider where the boundary sits.

---

## Hydration

Hydration attaches event handlers to server-rendered HTML. It fails when the client's first render disagrees with the server's output.

### Causes of Mismatch

| Cause | Why | Fix |
|-------|-----|-----|
| `Date.now()`, `Math.random()`, `new Date()` in render | Different value on each side | Compute in an effect, or pass a fixed value from the server |
| `window`, `localStorage`, `navigator` accessed in render | Absent on the server | Read in `useEffect`, render a stable placeholder first |
| Locale/timezone formatting | Server and client differ | Format on the server and pass the string, or format in an effect |
| Browser extensions mutating the DOM | Outside your control | Not fixable; don't chase it |
| Invalid HTML nesting (`<div>` inside `<p>`) | The parser repairs it, so the trees differ | Fix the markup |

### Rules

- **Never suppress a hydration warning to make it go away.** It means the server and client disagree about what the page is; the visible symptom is the smaller half of the problem.
- `suppressHydrationWarning` is legitimate for exactly one thing: content that is *known* to differ and is a single text node, like a timestamp.
- The "render nothing until mounted" pattern trades a hydration error for a layout shift and a worse LCP. Use it only when the content genuinely cannot exist on the server, and reserve the space.
- Test with JS disabled. What renders is what the user gets before hydration completes — and on a slow connection, that is a meaningful window.

---

## Streaming and Suspense

Streaming sends HTML as it becomes ready instead of waiting for the slowest query.

```tsx
<Shell>
  <FastContent />                        {/* streams immediately */}
  <Suspense fallback={<TableSkeleton />}>
    <SlowTable />                        {/* streams when ready */}
  </Suspense>
</Shell>
```

**Rules:**
- Put Suspense boundaries around genuinely slow, genuinely independent subtrees. A boundary around everything is the same as no boundary.
- **Fallbacks must match the real content's dimensions.** A skeleton of the wrong size converts a loading state into a layout shift, trading a rendering win for a CLS penalty.
- Content above the fold should not be inside a Suspense boundary if it can be avoided — streaming it in delays LCP.
- Sequential `await`s in a server component serialize the waterfall. Start independent requests together and await them together.

```tsx
// Bad: waterfall — user waits for both, in sequence
const user = await getUser(id)
const posts = await getPosts(id)

// Good: parallel — user waits for the slower one only
const [user, posts] = await Promise.all([getUser(id), getPosts(id)])
```

---

## Caching

Server rendering introduces cache layers that do not exist in an SPA, and a wrong answer here shows up as "why is this data stale."

**Know, for the framework in use:**
1. What is cached by default (request memoization, data cache, full-route cache, router cache)
2. What the default lifetime is
3. How to opt out per request
4. How to invalidate on mutation

**Rules:**
- Anything user-specific must be explicitly excluded from a shared cache. A personalized response served from a shared cache is a data leak, not a performance bug — this is the highest-severity mistake in this document.
- After a mutation, invalidate by tag or path. Waiting for a timer to expire is not invalidation.
- State the cache behavior in code review. "It works locally" often means "the cache was cold locally."

---

## Review Checklist

1. Is the rendering strategy the most static the content allows?
2. Is the LCP element in the server-rendered HTML?
3. Is `'use client'` as far down the tree as it can go?
4. Does anything client-side reference a value that must stay secret?
5. Any non-deterministic values in render paths that run on both sides?
6. Do Suspense fallbacks match the real content's dimensions?
7. Are independent server requests parallel rather than sequential?
8. Is user-specific data excluded from every shared cache?
9. Does the page work, and look intentional, with JS disabled?
