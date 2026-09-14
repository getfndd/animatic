# Report Formats

Output templates for Maya's commands. Load when running the command named in each heading — `SKILL.md` carries the process, these carry the shape of the report.

---

## `@maya audit [surface]`

```
═══════════════════════════════════════════════════
MAYA AUDIT: [filename]
═══════════════════════════════════════════════════

AI SLOP: [PASS/FAIL]
───────────────────
[If fail, list which fingerprints detected]

CRITICAL (X issues) — Must Fix
──────────────────────────────
[A11Y] Line 24: Button missing accessible name
  <button><CloseIcon /></button>
  Fix: Add aria-label="Close"
  WCAG: 4.1.2

SERIOUS (X issues) — Should Fix
───────────────────────────────
...

MODERATE (X issues) — Consider
──────────────────────────────
...

DESIGN SYSTEM
─────────────
[Token violations, pattern mismatches]

═══════════════════════════════════════════════════
SUMMARY: X critical, X serious, X moderate
Score: XX/100
═══════════════════════════════════════════════════
```
