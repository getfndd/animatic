# Report Formats

Output templates for Hicks's commands. Load when running the command named in each heading — `SKILL.md` carries the process, these carry the shape of the report.

---

## `@hicks optimize [component]`

```
PERFORMANCE REVIEW: [component]
═══════════════════════════════

CRITICAL (must fix)
───────────────────
[Specific issue, line reference, fix]

OPPORTUNITIES (measure first)
─────────────────────────────
[Potential improvements with expected impact]

BUNDLE IMPACT
─────────────
[Import analysis, tree-shaking opportunities]

VERDICT: [Ship as-is / Optimize first / Needs redesign]
```

---

## `@hicks simplify [target]`

```
SIMPLIFICATION: [target]
════════════════════════

REMOVED
───────
[Category] [what, and why it was safe to remove]

REPLACED
────────
[Category] [what → what, and the existing thing it now uses]

KEPT (with reason)
──────────────────
[Complexity that looks removable but is load-bearing — and why]

NET: -[N] lines, -[M] dependencies
BEHAVIOR: unchanged — [how that was verified]
```

---

## `@hicks review [file]`

```
CODE REVIEW: [filename]
═══════════════════════

BLOCKING (must fix before merge)
─────────────────────────────────
[Issue, line, principle violated, fix]

IMPROVEMENTS (should fix)
─────────────────────────
[Issue, principle, suggestion]

OBSERVATIONS
────────────
[Minor notes, style suggestions]

VERDICT: [Approve / Approve with changes / Request changes]
Score: XX/100
```
