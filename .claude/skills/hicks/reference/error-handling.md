# Error Handling

Boundaries, fallbacks, and surfacing failure to the user. Load when designing failure behaviour for a component or route.

---

### Error Boundaries

- Place error boundaries at route level — one per page/view
- Fallback UI must be actionable: what happened, what the user can do (retry, go back, contact support)
- Log errors to monitoring (Sentry, etc.) from the boundary
- Never catch errors silently

### Graceful Degradation

- Show the last good state when fresh data fails to load
- Stale data with a warning is better than an empty screen
- Partial failures should not take down unrelated UI
- Non-critical features fail silently (analytics, prefetch) — critical features fail loudly

### User-Facing Errors

Every error message must answer three questions:
1. **What happened?** (in plain language)
2. **Why?** (if the user can understand — omit technical details)
3. **What can they do?** (retry, try different input, contact support)

```typescript
// Good
"We couldn't save your changes. Check your connection and try again."

// Bad
"Error: NETWORK_TIMEOUT"
"Something went wrong."
"Error occurred. Please try again later."
```

### Async Error Patterns

```typescript
// Good: handle loading, error, and empty states explicitly
function InvestorList() {
  const { data, error, isLoading } = useInvestors()

  if (isLoading) return <Skeleton />
  if (error) return <ErrorState message="..." onRetry={refetch} />
  if (!data?.length) return <EmptyState />

  return <List items={data} />
}

// Bad: only handle the happy path
function BadInvestorList() {
  const { data } = useInvestors()
  return <List items={data} /> // Crashes on undefined
}
```

### Network Errors

- Distinguish between client errors (4xx — user's problem) and server errors (5xx — our problem)
- Retry server errors automatically (with backoff), never retry client errors automatically
- Timeout after a reasonable duration (10-30s), don't let requests hang indefinitely
- Show inline errors next to the action that triggered them, not in distant toasts
