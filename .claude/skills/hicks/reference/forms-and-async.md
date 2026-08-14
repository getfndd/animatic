# Forms, Validation, and Async Data

The two areas where most frontend correctness bugs live, because both have more states than they appear to. Loaded when building or debugging a form, or when diagnosing a stale/racing request.

## Contents

- Forms and Validation — validation timing, rules, form state
- Async and Data Fetching — race conditions, the four states, mutations

---

## Forms and Validation

### Validation Timing

| Moment | Validate | Rationale |
|--------|----------|-----------|
| On change | Never, for a field the user hasn't finished | Errors appearing mid-typing are hostile |
| On blur | First validation for that field | The user has declared they're done with it |
| On change, after first blur | Yes | Once a field is in error, live feedback helps them fix it |
| On submit | Everything | The last line of defense |

This "validate on blur, then live" pattern is the default. Deviating from it needs a reason.

### Rules

- **Validate on the server too, always.** Client validation is a UX affordance, not a security boundary. Anything enforced only in the browser is not enforced.
- **One schema, both sides.** Define the shape once (Zod, Valibot, or equivalent) and derive both the client validation and the server parse from it. Two hand-maintained copies drift, and the drift shows up as a confusing server error on a form that said it was valid.
- **Never disable the submit button on invalid.** The user then has no way to discover *what* is wrong. Let them submit, then show the errors and move focus to the first one.
- **Errors go next to the field**, associated via `aria-describedby`, not only in a summary at the top.
- **Preserve input on failure.** Losing a filled form to a server error is the fastest way to lose the user.
- **Disable submit while submitting**, and make double-submit impossible — network latency guarantees someone will click twice.

### Form State

Track these independently. Collapsing them causes most form bugs:

| State | Meaning |
|-------|---------|
| `values` | Current field contents |
| `touched` | Which fields the user has visited — gates when errors may appear |
| `dirty` | Whether values differ from initial — gates "unsaved changes" prompts |
| `errors` | Validation results, per field |
| `isSubmitting` | An in-flight submit — gates the button |
| `submitCount` | Distinguishes "never tried" from "tried and failed" |

**Anti-pattern:** deriving "should I show this error" from `errors` alone. Without `touched`, every field screams on first render.

---

## Async and Data Fetching

### Race Conditions

The most common async bug in frontend code: a slow response arriving after a fast one and overwriting it.

```typescript
// Bad: type "ab" quickly and the response for "a" may land last
useEffect(() => {
  fetch(`/api/search?q=${query}`)
    .then(r => r.json())
    .then(setResults)
}, [query])

// Good: ignore any response that is no longer current
useEffect(() => {
  const controller = new AbortController()
  fetch(`/api/search?q=${query}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setResults)
    .catch(err => { if (err.name !== 'AbortError') setError(err) })
  return () => controller.abort()
}, [query])
```

**Rules:**
- Every fetch inside an effect gets an `AbortController` and aborts on cleanup
- Always exclude `AbortError` from error handling — an abort is expected, not a failure
- Prefer a server-state library (React Query, SWR, Supabase hooks) which handles this, plus caching and deduplication, correctly

### The Four States

Every async read has four states, and code that handles fewer is incomplete:

```
loading → the request is in flight
error   → it failed, with something the user can act on
empty   → it succeeded and there is nothing to show
success → it succeeded with data
```

**`empty` is the one that gets skipped**, and it is the one users hit on day one of using a product. An empty state that looks like a broken state is a real bug.

### Mutations

- Optimistic updates need a rollback path. If you can't write the rollback, don't do the optimistic update.
- Invalidate related queries after a mutation rather than hand-patching the cache — hand-patching is where stale-data bugs come from.
- Never fire a mutation from an effect. Mutations respond to user intent; effects respond to state.
- Make mutations idempotent where the backend allows it, so a retry is always safe.
