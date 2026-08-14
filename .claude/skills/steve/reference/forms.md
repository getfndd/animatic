# Form Accessibility

Label association, error handling, and validation timing. Load when auditing any form, input group, or validation flow.

---

## Label Association

Every form input must have a programmatic label. Priority order:

1. **Visible `<label>` with `htmlFor`** — preferred, provides click target
2. **`aria-labelledby`** — when label is elsewhere in DOM
3. **`aria-label`** — when no visible label exists (e.g., search input with icon)
4. **Visually hidden text** — wrapping label with `.sr-only` class

**Never** use `placeholder` as the only label. Placeholders disappear on input and have insufficient contrast.

---

## Error Handling

| Requirement | Implementation |
|-------------|---------------|
| Error identification | `aria-invalid="true"` on the input |
| Error description | `aria-describedby` pointing to error message element |
| Error announcement | Error container uses `role="alert"` or `aria-live="assertive"` |
| Error prevention | Confirm destructive actions, allow undo, validate before submit |
| Error location | Error message adjacent to the input, not in a distant banner |

---

## Required Fields

| Method | Implementation |
|--------|---------------|
| Visual indicator | Asterisk (*) or "(required)" text |
| Programmatic | `aria-required="true"` or `required` attribute |
| Group label | "All fields required" at form top (only if ALL are required) |

---

## Validation Patterns

- Validate on blur for individual fields (not on every keystroke)
- Validate on submit for form-level errors
- Show errors inline, adjacent to the field
- Focus the first error field after submit validation
- Announce error count: "3 errors found. First error: [field name]"
