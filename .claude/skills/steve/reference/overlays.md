# Modal & Dialog Accessibility

Requirements, focus-trap lifecycle, and the dialog/alertdialog distinction. Load when auditing any overlay — modal, dialog, drawer, slideout, or popover that takes focus.

---

## Requirements Checklist

| Requirement | Implementation |
|-------------|---------------|
| **Role** | `role="dialog"` or `role="alertdialog"` (for confirmations) |
| **Label** | `aria-labelledby` pointing to dialog title, or `aria-label` |
| **Description** | `aria-describedby` for dialog description (optional but recommended) |
| **Modal flag** | `aria-modal="true"` (tells AT the rest of page is inert) |
| **Focus trap** | Tab and Shift+Tab cycle within dialog only |
| **Initial focus** | Move focus to first interactive element, or dialog container |
| **Escape key** | Closes dialog and returns focus to trigger |
| **Focus return** | On close, focus returns to the element that opened the dialog |
| **Background inert** | Content behind dialog is not interactive (`inert` attribute or manual) |

---

## Focus Trap Implementation

```
On open:
  1. Store reference to trigger element
  2. Move focus to first focusable element (or close button)
  3. Trap Tab/Shift+Tab within dialog boundary

On close:
  1. Release focus trap
  2. Return focus to stored trigger element
  3. Announce closure if needed (for screen readers)
```

---

## Alert Dialog vs Dialog

| Type | Use When | Escape Behavior |
|------|----------|-----------------|
| `role="dialog"` | General purpose (forms, info, settings) | Escape closes (optional) |
| `role="alertdialog"` | Destructive confirmations, critical alerts | Escape should NOT close (force decision) |
