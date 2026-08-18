# Report Formats

Output templates for Bobby's commands. Load when running the command named in each heading — the command definitions in `SKILL.md` carry the process, these carry the shape of the report.

---

## `@bobby review [component]`

```
═══════════════════════════════════════════════════
BOBBY REVIEW: [filename]
═══════════════════════════════════════════════════

VIOLATIONS (X issues) — Must Fix
─────────────────────────────────
[LABEL] Line 24: Button says "Submit"
  Fix: Use verb + object: "Save changes" or "Create round"
  Rule: Absolute Rule — verb + object button labels

[ERROR] Line 48: Error says "Something went wrong"
  Fix: "We couldn't save this investor. Check your connection and try again."
  Rule: Error formula — what/why/fix

WARNINGS (X issues) — Should Fix
─────────────────────────────────
[TONE] Line 62: "Oops! No data found"
  Fix: "No activity yet" — remove exclamatory opener
  Rule: Tone boundaries — no blame, no cutesy

SUGGESTIONS (X issues) — Consider
──────────────────────────────────
[BREVITY] Line 15: "successfully" is redundant
  Fix: "Changes saved" not "Changes saved successfully"
  Rule: Brevity (R2)

TERMINOLOGY
───────────
[DRIFT] Line 30: Uses "remove" but line 55 uses "delete" for same action
  Fix: Standardize on "delete" (permanent) or "remove" (reversible)

═══════════════════════════════════════════════════
SUMMARY: X violations, X warnings, X suggestions
═══════════════════════════════════════════════════
```

---

## `@bobby write [element]`

```
Element: [type]
Context: [user scenario]

Recommended:
  "[copy]"
  — [Rationale tied to principles]

Alternative A:
  "[copy]"
  — [When this might be better]

Alternative B:
  "[copy]"
  — [When this might be better]
```

---

## `@bobby simplify [copy]`

```
Original (X words):
  "[original copy]"

Simplified (Y words, -Z%):
  "[simplified copy]"

Cuts:
  - "successfully" → removed (redundant)
  - "in order to" → "to"
  - "at this time" → "now"
  - "utilize" → "use"
```

---

## `@bobby errors [feature]`

```
═══════════════════════════════════════════════════
ERROR MESSAGES: [feature]
═══════════════════════════════════════════════════

BLOCKING (user cannot proceed)
──────────────────────────────
[Trigger]: Field-level validation — invalid email
[Message]: "Enter a valid email address, like name@company.com."
[Placement]: Below the email field

RECOVERABLE (user can retry or work around)
────────────────────────────────────────────
[Trigger]: Network failure on save
[Message]: "We couldn't save your changes. Check your connection and try again."
[Placement]: Toast

INFORMATIONAL (user should know, no action required)
─────────────────────────────────────────────────────
[Trigger]: Data synced with stale timestamp
[Message]: "This data was last updated 3 hours ago."
[Placement]: Inline, below the data
═══════════════════════════════════════════════════
```

---

## `@bobby terms`

```
═══════════════════════════════════════════════════
TERMINOLOGY AUDIT
═══════════════════════════════════════════════════

INCONSISTENCIES
───────────────
"delete" vs "remove" — used for same action
  Recommendation: "Delete" (permanent), "Remove" (detachment)
  Files using "remove" where "delete" is correct:
    - src/components/DataRoom/FolderActions.jsx:42
    - src/components/Pipeline/InvestorRow.jsx:88

"workspace" vs "organization"
  Recommendation: "workspace" (established in nav + settings)
  Files using "organization":
    - src/components/Settings/BillingPanel.jsx:15

CONSISTENT (no action needed)
─────────────────────────────
"investor" — used consistently across 24 files
"round" — used consistently across 12 files
═══════════════════════════════════════════════════
```
