# Keyboard Navigation & Focus Management

Patterns behind `@steve keyboard` and `@steve focus`. Load when reviewing tab order, focus trapping, or any composite widget with arrow-key navigation.

---

## Focus Management

| Pattern | Implementation | When to Use |
|---------|---------------|-------------|
| **Focus trap** | Trap focus within container using `Tab` and `Shift+Tab` cycling | Modals, dialogs, slideouts, drawer panels |
| **Focus return** | Return focus to trigger element on close | After any overlay/dialog closes |
| **Focus redirect** | Move focus to new content | After route change, after inline expansion, after error |
| **Roving tabindex** | Single tab stop for group, arrow keys within | Toolbars, radio groups, tab lists, menu bars |
| **Focus visible** | Show focus indicator only on keyboard interaction | All interactive elements (use `:focus-visible`) |

---

## Tab Order Rules

1. Tab order must follow visual reading order (left-to-right, top-to-bottom for LTR)
2. Never use `tabIndex` > 0 — it creates unpredictable focus order
3. Use `tabIndex="0"` to add non-interactive elements to tab order (with role)
4. Use `tabIndex="-1"` for programmatic focus (not user-tabbable)
5. Skip links must be the first focusable element on the page

---

## Arrow Key Patterns

| Context | Keys | Behavior |
|---------|------|----------|
| **Tabs** | Left/Right | Switch between tabs. Wrap at ends. |
| **Menu** | Up/Down | Navigate items. Home/End jump to first/last. |
| **Grid** | Arrow keys | Navigate cells. Ctrl+Home/End for corners. |
| **Tree** | Up/Down, Left/Right | Navigate siblings. Left collapses, Right expands. |
| **Combobox** | Up/Down | Navigate options. Enter selects. Escape closes. |
| **Radio group** | Up/Down or Left/Right | Move selection. Wrap at ends. |

---

## Escape Key Convention

`Escape` always closes the topmost overlay. In nested contexts (dropdown inside modal), escape closes the dropdown first, then the modal on second press. Never trap users in a context with no escape path.

---

## Keyboard Test Matrix

Used by `@steve keyboard` to check a component systematically.

| Key | Expected Behavior |
|-----|-------------------|
| Tab | Focus moves to next interactive element |
| Shift+Tab | Focus moves to previous interactive element |
| Enter | Activates buttons, follows links, submits forms |
| Space | Activates buttons, toggles checkboxes |
| Escape | Closes overlays, cancels operations |
| Arrow keys | Navigates within composite widgets |
| Home/End | Jumps to first/last item in lists |
