# State Management Patterns

Where state lives, when to lift it, and which primitive fits. Load when state is the presenting problem — prop drilling, stale reads, or a reducer that has outgrown itself.

---

### The State Decision Tree

```
Where does this state belong?

1. Is it only used for rendering this component?
   → useState (local state)

2. Is it shared across many components but not persisted?
   → Context (theme, auth, toast, feature flags)

3. Should it survive page refreshes / be shareable via URL?
   → URL state (search params, route params)

4. Does it come from the server?
   → Server state (Supabase hooks, React Query, SWR)

5. Can it be computed from other state?
   → Derived state (useMemo, inline computation)
```

### Local State (useState)

- UI-only state: open/closed, hover, selection, form inputs
- Keep it as close to where it's used as possible
- Lift state only when a sibling genuinely needs it
- Never initialize state from props unless it's a seed value (use a key to reset)

### Context

- Cross-cutting concerns only: theme, auth, toast, modal stack, feature flags
- Never use context for data that changes frequently (causes full subtree re-render)
- Split contexts by concern — never a single "AppContext" god object
- Provide a custom hook (`useAuth()`, not `useContext(AuthContext)`)

### URL State

- Anything the user might bookmark, share, or navigate back to
- Filters, search queries, pagination, selected tabs, sort order
- Use search params for flat state, route params for hierarchical navigation
- Sync with local state only when necessary — URL is the source of truth

### Server State

- All backend data is server state — never copy it into `useState`
- Treat server data as a cache: stale, loading, error, fresh
- Optimistic updates for responsive UI, rollback on failure
- Invalidate related queries after mutations (not manual state updates)

### Derived State

- If you can compute it from existing state, compute it — do not store it
- `useMemo` for expensive computations, inline for cheap ones
- Never `useEffect` to sync state A into state B — that's derived state disguised as a side effect
- Common mistake: `useEffect(() => setFilteredItems(items.filter(...)))` — just compute it inline

### Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Duplicating server state in local state | Stale data, sync bugs | Use server state directly |
| `useEffect` to derive state | Extra render cycle, bugs | `useMemo` or inline computation |
| Single "AppContext" with everything | Performance death | Split by concern |
| `useState` for URL-worthy state | Lost on refresh, not shareable | Search params |
| Lifting state "just in case" | Unnecessary complexity | Lift when needed, not before |
