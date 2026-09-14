# Hook Patterns

Custom hook design, dependency arrays, effect discipline. Load when writing a hook or debugging one that fires wrong.

---

### Custom Hooks

- Extract reusable logic into custom hooks — `use` prefix, always
- A custom hook is just a function that calls other hooks
- Keep hooks focused: `useDebounce`, `useLocalStorage`, `useMediaQuery` — not `useEverything`
- Custom hooks should return the minimum interface needed

### useEffect Rules

1. **Cleanup subscriptions.** Every `addEventListener`, `subscribe`, `setInterval` needs a cleanup function.
2. **Dependency arrays must be correct.** Lint them. Never suppress `eslint-disable-next-line react-hooks/exhaustive-deps` unless you can explain exactly why.
3. **Never use useEffect for derived state.** If you're setting state inside useEffect based on other state, you want `useMemo`.
4. **Never use useEffect for event handlers.** If you're responding to a user action, use a callback.
5. **One effect, one concern.** Split unrelated side effects into separate useEffect calls.
6. **Avoid cascading effects.** If effect A sets state that triggers effect B, redesign to avoid the cascade.

### useEffect Decision Tree

```
Do I need useEffect?

- Computing derived values → useMemo
- Responding to user action → event handler / callback
- Subscribing to external system → useEffect with cleanup
- Fetching data → server state library (React Query, SWR, Supabase hooks)
- Syncing with external system → useEffect (but consider if a ref works)
- Initializing on mount → useEffect with [] deps (but consider if you can initialize in state)
```

### useRef Patterns

- DOM access: `const inputRef = useRef<HTMLInputElement>(null)`
- Mutable values that don't trigger re-renders: timers, previous values, instance tracking
- Never use ref for state that should trigger UI updates — use useState
- `ref.current` is always synchronous and immediate

### Hook Composition

```typescript
// Good: compose focused hooks
function useSearchableList(items, searchKeys) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const filtered = useMemo(
    () => filterByQuery(items, debouncedQuery, searchKeys),
    [items, debouncedQuery, searchKeys]
  )
  return { query, setQuery, filtered }
}

// Bad: monolithic hook doing everything
function useComplexFeature() {
  // 200 lines of mixed concerns...
}
```
