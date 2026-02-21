# Z-Index Scale

A fixed scale for managing stacking contexts. No arbitrary values.

---

## The Scale

| Token | Value | Use Case | Examples |
|-------|-------|----------|----------|
| `z-base` | 0 | Default stacking | Page content, cards, sections |
| `z-dropdown` | 10 | Dropdowns and menus | Select menus, dropdown menus, combobox lists |
| `z-sticky` | 20 | Sticky/fixed elements | Sticky headers, floating action buttons, sidebars |
| `z-modal` | 30 | Modal dialogs | Modal, slideout panel, drawer, lightbox |
| `z-popover` | 40 | Popovers and tooltips | Tooltip, popover, context menu |
| `z-toast` | 50 | Toast notifications | Toast, snackbar, alert banner |
| `z-max` | 9999 | Emergency override | Debug overlays, critical system UI |

---

## Rules

### Never Use Arbitrary Values

```jsx
// ❌ Wrong - arbitrary z-index
<div className="z-[999]">

// ✅ Correct - semantic token
<div className="z-modal">
```

### Stacking Within Layers

Elements within the same layer (e.g., two modals) should use the same z-index. The DOM order determines which appears on top.

```jsx
// Both use z-modal (30), second one stacks on top due to DOM order
<Modal /> {/* z-modal */}
<Modal /> {/* z-modal - appears on top */}
```

### Creating New Stacking Contexts

Use `isolation: isolate` to create a new stacking context without z-index:

```jsx
// Creates contained stacking context
<div className="isolate">
  {/* z-indices inside here don't affect outside */}
</div>
```

### When Scale Doesn't Fit

If you need something between layers, you likely have an architectural problem:

1. **Dropdown inside modal** → Both should use modal's stacking context
2. **Tooltip over toast** → Reconsider if this is actually needed
3. **Multiple overlapping modals** → Use a modal stack manager

If you genuinely need a value outside the scale, document why and consider if the scale needs updating.

---

## Tailwind Configuration

Add to `tailwind.config.js`:

```js
theme: {
  extend: {
    zIndex: {
      'base': '0',
      'dropdown': '10',
      'sticky': '20',
      'modal': '30',
      'popover': '40',
      'toast': '50',
      'max': '9999',
    },
  },
},
```

---

## Common Patterns

### Modal with Dropdown

```jsx
<Dialog className="z-modal">
  {/* Dropdown inside modal uses relative positioning */}
  <Dropdown className="z-dropdown">
    {/* Works because dropdown is within modal's stacking context */}
  </Dropdown>
</Dialog>
```

### Sticky Header with Dropdown

```jsx
<header className="sticky top-0 z-sticky">
  <nav>
    <Dropdown className="z-dropdown">
      {/* Dropdown needs higher z than sticky to appear above */}
      {/* Wait - this won't work! */}
    </Dropdown>
  </nav>
</header>
```

**Fix:** Don't put dropdowns inside sticky headers, or portal them out:

```jsx
<header className="sticky top-0 z-sticky">
  <nav>
    <DropdownTrigger />
  </nav>
</header>
<DropdownPortal className="z-dropdown">
  {/* Portaled to body, independent stacking context */}
</DropdownPortal>
```

### Toast Over Modal

Toasts should always be visible, even over modals:

```jsx
<Modal className="z-modal" />
<ToastContainer className="z-toast">
  {/* Always on top */}
</ToastContainer>
```

---

## Anti-Patterns

| Don't | Why | Do Instead |
|-------|-----|------------|
| `z-[999]`, `z-[9999]` | Arbitrary values cause wars | Use semantic tokens |
| `z-50` (Tailwind default) | Collides with our toast layer | Use `z-toast` explicitly |
| Negative z-index for "behind" | Hard to reason about | Use `isolation: isolate` |
| Z-index on everything | Creates unnecessary complexity | Only when stacking matters |

---

## Debugging Z-Index Issues

1. **Check stacking contexts** — A child can't escape its parent's stacking context
2. **Check `position`** — Z-index only works on positioned elements (relative, absolute, fixed, sticky)
3. **Check `isolation`** — Look for `isolate` creating unexpected contexts
4. **Use DevTools** — Chrome's 3D view shows stacking layers

### Common Fixes

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| Dropdown hidden behind sibling | Parent has lower z-index | Portal dropdown or raise parent |
| Modal not covering everything | Content has higher z-index | Check for `z-max` abuse |
| Tooltip clipped by container | `overflow: hidden` on ancestor | Portal tooltip |
| Elements fighting for top | Multiple arbitrary z-indices | Reset to scale tokens |
