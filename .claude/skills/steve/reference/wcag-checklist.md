# WCAG 2.1 Compliance Checklist

The graded violation tables behind `@steve audit` and `@steve check`. Load when running either command, or whenever a finding needs a success-criterion citation.

Severity drives the audit score: Critical −10, Serious −5, Moderate −2, from a starting score of 100.

---

## Critical (Must Fix) — Score: -10 each

These are P0 violations. They block users entirely.

| Check | WCAG SC | What to Look For |
|-------|---------|------------------|
| Images without alt text | 1.1.1 | `<img>` without `alt` attribute. Decorative images need `alt=""` or `role="presentation"`. |
| Icon-only buttons without label | 4.1.2 | `<button>` containing only SVG/icon with no `aria-label`, `aria-labelledby`, or visually hidden text. |
| Form inputs without labels | 1.3.1, 4.1.2 | `<input>`, `<select>`, `<textarea>` without associated `<label>`, `aria-label`, or `aria-labelledby`. Placeholder is NOT a label. |
| Non-semantic click handlers | 2.1.1 | `<div onClick>` or `<span onClick>` without `role="button"`, `tabIndex="0"`, and `onKeyDown` (Enter/Space). |
| Missing link destination | 2.1.1 | `<a>` without `href` using only `onClick`. Either add `href` or use `<button>`. |
| Color contrast failure | 1.4.3 | Text contrast below 4.5:1 (normal text) or 3:1 (large text >=18pt or >=14pt bold). |
| Missing keyboard support | 2.1.1 | Interactive elements unreachable or inoperable via keyboard. Custom widgets without key handlers. |
| Auto-playing media without controls | 1.4.2 | Audio/video that plays automatically without pause/stop/mute mechanism. |
| Content that causes seizures | 2.3.1 | Flashing content more than 3 times per second. |

---

## Serious (Should Fix) — Score: -5 each

These are P1 violations. They significantly impair usability for AT users.

| Check | WCAG SC | What to Look For |
|-------|---------|------------------|
| Focus outline removed | 2.4.7 | `outline-none` or `outline: 0` without a visible custom focus indicator. |
| Color-only information | 1.4.1 | Status, errors, or state communicated solely by color (no icon, text, or pattern). |
| Touch target too small | 2.5.5 | Clickable/tappable elements smaller than 44x44px. Inline links exempt if text is sufficient. |
| Missing skip link | 2.4.1 | No skip-to-content link for keyboard users on pages with navigation. |
| Heading hierarchy violations | 1.3.1 | Skipped heading levels (h1 to h3), multiple h1 elements, headings used for styling only. |
| Missing error identification | 3.3.1 | Form validation errors not programmatically associated with the input. No `aria-describedby` or `aria-errormessage`. |
| Insufficient focus order | 2.4.3 | Tab order does not follow visual/logical reading order. Focus jumps unexpectedly. |
| Missing page/section titles | 2.4.2 | Pages without `<title>`, dialogs without accessible name, sections without headings. |
| Time limits without controls | 2.2.1 | Session timeouts or auto-advancing content without ability to extend, pause, or stop. |
| Missing text resize support | 1.4.4 | Content breaks or becomes inaccessible at 200% browser zoom. Fixed pixel font sizes. |

---

## Moderate (Consider Fixing) — Score: -2 each

These are P2 issues. They reduce quality but do not block access.

| Check | WCAG SC | What to Look For |
|-------|---------|------------------|
| Positive tabIndex | 2.4.3 | `tabIndex` > 0. Disrupts natural tab order. Use `tabIndex="0"` or `tabIndex="-1"` only. |
| Missing landmark regions | 1.3.1 | No `<main>`, `<nav>`, `<header>`, `<footer>` landmarks. Screen reader users cannot navigate by region. |
| Role without required attributes | 4.1.2 | `role="button"` without `tabIndex="0"`, `role="checkbox"` without `aria-checked`, etc. |
| Missing language attribute | 3.1.1 | `<html>` without `lang` attribute. Screen readers guess pronunciation. |
| Redundant ARIA | — | `role="button"` on `<button>`, `role="link"` on `<a>`. Native semantics are preferred. |
| Missing status messages | 4.1.3 | Dynamic content changes (toast, loading, error) not announced. Missing `role="status"` or `aria-live`. |
| Inconsistent navigation | 3.2.3 | Navigation mechanisms not consistent across pages. |
| Non-descriptive link text | 2.4.4 | "Click here", "Read more", "Learn more" without context. Links must describe destination. |
