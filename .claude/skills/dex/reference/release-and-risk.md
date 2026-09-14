# Release Notes and Risk Assessment

Command definitions, report formats, and the risk-pattern table for the
release-quality side of Dex's work. Loaded when running `@dex release`,
`@dex release-note`, `@dex release-notes check`, or `@dex risk` — the
templates are long and only matter while producing one.

## Contents

- Release Notes — accumulation model, format, `@dex release-note`, audit
- Risk Assessment — risk patterns, levels, `@dex risk`, commit-flow integration

---

## Release Notes

Track what shipped in user-facing language. Release notes accumulate as features ship — not as a separate ceremony.

**File:** `docs/RELEASE_NOTES.md`

**Format:**
```markdown
# [Project] Release Notes

## [date] — [optional theme]

### New
- Brief user-facing description of what shipped

### Improved
- Brief description of enhancement

### Fixed
- Brief description of bug fix
```

**Rules:**
- Write for users, not developers — no internal jargon, no file paths, no technical details
- One line per change, action-oriented ("Added X" not "X was added")
- Group by date, newest first
- Only user-facing changes get release notes (refactors, internal tooling, infra do not)
- If a commit includes user-facing changes and no release note entry exists, flag it as a soft gate

### `@dex release-note [description]`

Append a release note entry to `docs/RELEASE_NOTES.md`.

**Process:**
1. Determine category (New / Improved / Fixed)
2. Write user-facing description (rewrite if too technical)
3. Append under today's date heading (create if needed)
4. Confirm what was added

**Example:**
```
@dex release-note Added privacy policy links to settings and Google integration
```

### `@dex release-notes check`

Audit recent commits against `docs/RELEASE_NOTES.md` for gaps.

**Process:**
1. List commits since last release note entry date
2. Identify commits with user-facing changes (features, UI changes, fixes)
3. Flag any missing release note entries
4. Suggest release note text for each gap

**Output:**
```
## Release Notes Audit

### Covered
- e1a43fb: Privacy policy links — release note exists

### Missing Release Notes
- 212f29b: ScoreCard narrative gaps — Suggested: "Added narrative gap analysis to ScoreCard with category-level empty states"
- 84853aa: Beta badges on integrations — Suggested: "Added Beta badges to live integrations, moved Outlook to Coming Soon"

### Action: Add 2 missing release notes? [requires confirmation]
```

### Release Notes in Commit Flow

During `@dex commit`, after the documentation check:
1. Detect if the commit includes user-facing changes (new features, UI changes, user-visible fixes)
2. If yes, check whether a release note entry exists in `docs/RELEASE_NOTES.md` for this change
3. If missing, flag as soft gate: "Release note missing for user-facing change. Add one with `@dex release-note [description]` or acknowledge skip."
4. If the change is purely internal (refactor, infra, tooling), mark as N/A

---

## Risk Assessment

Flag changes that are likely to break things or require focused testing. This is advisory — it doesn't block commits, but it makes sure nobody ships something fragile without knowing it.

### Risk Patterns

| Pattern | Risk Level | Why | Test Focus |
|---------|-----------|-----|------------|
| Database migrations (DDL) | HIGH | Schema changes affect live data, can't easily roll back | Run migration on staging, verify existing data integrity |
| RLS policy changes | HIGH | Wrong policy = data leak or lockout | Test as multiple user roles, verify row-level access |
| RPC/edge function signature changes | ELEVATED | Callers may break silently | Test all callers, check for stale client code |
| Auth flow changes | HIGH | Broken auth = total lockout | Test login, signup, invite, session refresh, role switching |
| Shared component prop changes | ELEVATED | Consumers may break or render wrong | Grep all usages, verify each call site |
| Context provider changes | ELEVATED | Cascades through component tree | Test all consumers, check for missing provider wrapping |
| State management changes (hooks, stores) | ELEVATED | Side effects, stale closures, re-render storms | Test affected flows end-to-end |
| Payment/billing logic | HIGH | Financial accuracy, compliance | Verify calculations, test edge cases (zero, negative, rounding) |
| Email/notification changes | ELEVATED | Wrong audience, wrong content, can't unsend | Test recipient targeting, content rendering, unsubscribe |
| Third-party API integration changes | ELEVATED | External dependencies, rate limits, auth | Test with real API (not just mocks), verify error handling |
| Delete/destroy operations | HIGH | Data loss is irreversible | Test soft-delete behavior, verify cascades, check recovery path |

### Risk Levels

| Level | Meaning | Action |
|-------|---------|--------|
| **NONE** | Internal refactor, docs, tooling | No special testing needed |
| **LOW** | Isolated UI change, new component, additive-only | Normal smoke test |
| **ELEVATED** | Changes to shared code, API surfaces, or state | Test specific areas listed in callout |
| **HIGH** | Data, auth, payments, destructive ops | Dedicated testing session before calling it done |

### `@dex risk [file, commit, or description]`

Analyze risk for a specific change.

**Output:**
```
## Risk Assessment

### Risk Level: ELEVATED

### Patterns Detected
- Shared component prop change: `Button.jsx` — `preset` prop type widened
- Context provider change: `AdvisorContext.tsx` — new state field added

### Focused Testing Required
1. Grep all `<Button` usages — verify no breakage from prop change
2. Test Advisor panel open/close/transition — new state field may affect render
3. Test Heddle spotlight → panel → fullscreen transitions

### Estimated Testing Effort: 15-30 minutes
```

### Risk Assessment in Commit Flow

During `@dex commit`, after documentation and release notes checks:
1. Scan changed files against the risk patterns table
2. If any patterns match, determine the highest risk level
3. Output a **Focused Testing Required** callout with specific areas to test
4. For HIGH risk: strongly recommend a dedicated testing pass before considering the work done
5. For ELEVATED risk: list the specific test areas as a checklist
6. For LOW/NONE: note it and move on

**The risk assessment does not block the commit.** It ensures the developer knows what to test. Shipping fast without testing the right things is how bugs get to production.

### Linear Integration

When risk is ELEVATED or HIGH:
- Suggest adding a `needs-testing` label to the Linear issue
- If the issue is being marked Done, ask: "Have the flagged risk areas been tested?"
