# Screen Reader Patterns

Live regions, announcements, and the ARIA role reference behind `@steve screen-reader`. Load when reviewing how a component is announced or navigated by assistive technology.

---

## Live Regions

| Type | Attribute | Use Case | Example |
|------|-----------|----------|---------|
| **Polite** | `aria-live="polite"` | Non-urgent updates, search results count | "3 results found" |
| **Assertive** | `aria-live="assertive"` | Urgent errors, critical alerts | "Session expiring in 30 seconds" |
| **Status** | `role="status"` | Status changes, save confirmations | "Changes saved" |
| **Alert** | `role="alert"` | Errors, warnings requiring attention | "Invalid email address" |
| **Log** | `role="log"` | Chat messages, activity feeds | New message arrival |
| **Timer** | `role="timer"` | Countdown displays | "2:30 remaining" |

**Rules:**
- Live regions must exist in DOM before content changes (not injected)
- Avoid `aria-live` on containers with frequent updates (causes verbosity)
- Use `aria-atomic="true"` when the entire region should be re-announced
- Never use `aria-live="assertive"` for non-critical updates

---

## Announcements

| Action | Announcement Method |
|--------|-------------------|
| Page navigation | Update `<title>`, focus `<h1>` or `<main>` |
| Form error | `role="alert"` + `aria-describedby` on input |
| Toast notification | `role="status"` or `role="alert"` (severity-dependent) |
| Loading start | `aria-busy="true"` on container + "Loading..." live region |
| Loading complete | Remove `aria-busy`, announce result count |
| Delete action | Announce "Deleted [item]" via live region |
| Sort/filter change | Announce new result count via live region |

---

## ARIA Roles Reference

**Landmark roles** (use semantic HTML first):

| Semantic Element | ARIA Role | Purpose |
|-----------------|-----------|---------|
| `<main>` | `role="main"` | Primary content |
| `<nav>` | `role="navigation"` | Navigation section |
| `<aside>` | `role="complementary"` | Supporting content |
| `<header>` | `role="banner"` | Site header (top-level only) |
| `<footer>` | `role="contentinfo"` | Site footer (top-level only) |
| `<form>` | `role="form"` | Form (when labeled) |
| `<section>` | `role="region"` | Named section (`aria-label` required) |
| — | `role="search"` | Search functionality |

**Widget roles** (prefer native HTML):

| Native Element | ARIA Equivalent | Use ARIA When |
|---------------|-----------------|---------------|
| `<button>` | `role="button"` | Custom element must behave as button |
| `<a href>` | `role="link"` | Custom element must behave as link |
| `<input type="checkbox">` | `role="checkbox"` | Custom checkbox with `aria-checked` |
| `<select>` | `role="listbox"` | Custom dropdown with keyboard support |
| `<dialog>` | `role="dialog"` | Custom dialog (prefer native `<dialog>`) |
| `<details>` | `role="group"` with `aria-expanded` | Custom disclosure |

**Rule of thumb**: If a native HTML element does what you need, use it. ARIA is a repair tool, not a first choice.

---

## Screen Reader Review Checklist

1. Are all elements properly labeled (visible labels, `aria-label`, `aria-labelledby`)?
2. Is the role correct for each interactive element?
3. Are state changes announced (`aria-expanded`, `aria-selected`, `aria-checked`)?
4. Are dynamic updates captured by live regions?
5. Is the heading hierarchy logical and complete?
6. Are landmark regions present and labeled?
7. Is decorative content hidden (`aria-hidden="true"`, `role="presentation"`)?
8. Are grouping relationships conveyed (`role="group"`, `fieldset`/`legend`)?
