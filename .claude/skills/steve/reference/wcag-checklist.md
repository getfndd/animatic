# WCAG AA Checklist for Preset

Practical WCAG 2.1 AA checklist organized by principle. Each item includes specific code patterns for a design system management tool.

---

## 1. Perceivable

Content must be presentable to users in ways they can perceive.

### 1.1.1 Non-text Content (Level A)

All non-text content has a text alternative.

| Element | Pattern | Fix |
|---------|---------|-----|
| Images | `<img>` without `alt` | Add `alt="descriptive text"` or `alt=""` for decorative |
| Icon buttons | `<button><Icon /></button>` | Add `aria-label="action"` to button |
| SVG icons | Inline `<svg>` | Add `aria-hidden="true"` if decorative, or `role="img" aria-label="..."` if meaningful |
| Color swatches | `<div style={{ background: color }}>` | Add visible text label AND `aria-label="Blue 500, #3B82F6"` |
| Logo | `<img src="logo.svg">` | `alt="Preset"` |

**Preset-specific:** Color swatches in token editors, palette views, and preset previews MUST have text labels with the color name and value. Color alone is never sufficient.

```tsx
// CORRECT - Color swatch with accessible label
<div className="flex items-center gap-2">
  <span
    className="h-6 w-6 rounded border border-border"
    style={{ backgroundColor: token.value }}
    aria-hidden="true"
  />
  <span className="text-sm">{token.name}</span>
  <span className="text-xs text-muted-foreground">{token.value}</span>
</div>

// WRONG - Color only, no text
<div
  className="h-6 w-6 rounded"
  style={{ backgroundColor: token.value }}
/>
```

### 1.3.1 Info and Relationships (Level A)

Information, structure, and relationships conveyed visually are available programmatically.

| Element | Pattern | Fix |
|---------|---------|-----|
| Headings | Visual heading without `<h1>`-`<h6>` | Use proper heading elements |
| Heading hierarchy | `<h1>` followed by `<h3>` | Use sequential levels (h1 > h2 > h3) |
| Lists | Visual list without `<ul>`/`<ol>` | Use proper list elements |
| Tables | Grid data without `<table>` | Use `<table>`, `<th>`, `<td>` with `scope` |
| Form groups | Related inputs without grouping | Use `<fieldset>` + `<legend>` |
| Landmarks | Page without `<main>`, `<nav>`, `<header>` | Add landmark elements |

**Preset-specific token tables:**
```tsx
// CORRECT - Token table with proper semantics
<table>
  <caption className="sr-only">Design tokens for {category}</caption>
  <thead>
    <tr>
      <th scope="col">Token Name</th>
      <th scope="col">Value</th>
      <th scope="col">Preview</th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>{token.name}</td>
      <td>{token.value}</td>
      <td>
        <span aria-label={`Preview: ${token.name}, ${token.value}`}>
          {/* visual preview */}
        </span>
      </td>
      <td>{/* action buttons with aria-labels */}</td>
    </tr>
  </tbody>
</table>
```

### 1.3.2 Meaningful Sequence (Level A)

Reading order matches visual order in the DOM.

- Tab order follows visual layout (left-to-right, top-to-bottom)
- CSS `order`, `flex-direction: row-reverse`, and absolute positioning do not reorder content
- Modals appear after their trigger in the DOM (or use portal with focus management)

### 1.4.1 Use of Color (Level A)

Color is not the sole means of conveying information.

| Context | Pattern to Avoid | Fix |
|---------|-----------------|-----|
| Status indicators | Color dot only | Add text label: "Connected", "Error", "Warning" |
| Drift scores | Red/green only | Add score number + text status |
| Token categories | Color-coded tabs only | Add text labels to tabs |
| Validation | Red border only | Add error icon + error message text |
| Form errors | Red text only | Add error icon + descriptive message |

**Preset-specific:** Drift reports and health scores are common. Always pair color with text.

```tsx
// CORRECT - Status with color AND text
<div className="flex items-center gap-2">
  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
  <span className="text-sm">Connected</span>
</div>

// WRONG - Color only
<span className="h-2 w-2 rounded-full bg-emerald-500" />
```

### 1.4.3 Contrast (Minimum) (Level AA)

Text has sufficient contrast against its background.

| Text Type | Minimum Ratio | Check |
|-----------|--------------|-------|
| Normal text (<18px or <14px bold) | 4.5:1 | All body text, labels, descriptions |
| Large text (>=18px or >=14px bold) | 3:1 | Headings, large labels |
| UI components and graphical objects | 3:1 | Borders, icons, focus indicators |

**Preset semantic token contrast:**
| Token Pair | Usage | Verify |
|------------|-------|--------|
| `text-foreground` on `bg-background` | Primary content | Must pass 4.5:1 |
| `text-muted-foreground` on `bg-background` | Secondary content | Must pass 4.5:1 |
| `text-muted-foreground` on `bg-muted` | Labels on muted sections | Must pass 4.5:1 |
| `text-background` on `bg-foreground` | Inverted buttons | Must pass 4.5:1 |

**Museum principle caution:** When chrome recedes (muted, low-contrast elements), verify it hasn't dropped below AA thresholds. `text-muted-foreground` at full opacity typically passes; adding further opacity (e.g., `/50`, `/60`) often fails.

### 1.4.4 Resize Text (Level AA)

Text can be resized up to 200% without loss of content or functionality.

- Use `rem` or `em` for font sizes, not `px`
- Containers use flexible sizing (min-height, not fixed height)
- No text truncation without tooltip or expand option
- Test at browser zoom 200%

### 1.4.10 Reflow (Level AA)

Content reflows at 320px viewport width without horizontal scrolling.

- Use responsive layouts (flex, grid)
- No fixed-width containers above 320px
- Token tables reflow to card/list layout on narrow viewports
- Test at 1280x1024 with 400% zoom

### 1.4.11 Non-text Contrast (Level AA)

UI components and graphical objects have 3:1 contrast.

- Form input borders visible against background
- Focus indicators visible (ring-foreground/50 provides this)
- Icon buttons distinguishable from background
- Color swatch borders visible against both light and dark backgrounds

### 1.4.13 Content on Hover or Focus (Level AA)

Tooltip and popover content is dismissible, hoverable, and persistent.

```tsx
// Tooltips must:
// 1. Dismiss with Escape key
// 2. Stay visible while hovering the tooltip itself
// 3. Stay visible until user dismisses or trigger loses focus/hover
```

---

## 2. Operable

UI components and navigation must be operable.

### 2.1.1 Keyboard (Level A)

All functionality is operable via keyboard.

| Element | Required Keys | Pattern |
|---------|--------------|---------|
| Buttons | Enter, Space | Native `<button>` handles this |
| Links | Enter | Native `<a href>` handles this |
| Checkboxes | Space | Native `<input type="checkbox">` handles this |
| Dropdowns | Enter, Space, Arrow keys, Escape | Use Radix/shadcn Select |
| Modals | Escape to close, Tab trapped inside | Use Radix/shadcn Dialog |
| Tabs | Arrow keys to navigate, Enter/Space to select | Use Radix/shadcn Tabs |
| Menus | Arrow keys, Enter, Escape | Use Radix/shadcn DropdownMenu |
| Custom grids | Arrow keys (roving tabindex) | See `reference/focus-patterns.md` |
| Sliders | Arrow keys | Use Radix/shadcn Slider |

**Critical anti-pattern:**
```tsx
// WRONG - div with click handler, no keyboard access
<div onClick={handleClick}>Click me</div>

// CORRECT - use a button
<button onClick={handleClick}>Click me</button>

// CORRECT - if div is necessary, add full keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click me
</div>
```

### 2.1.2 No Keyboard Trap (Level A)

Focus can always be moved away using standard keys.

- Modals: Escape closes and returns focus to trigger
- Dropdown menus: Escape closes and returns focus to trigger
- Inline editors: Escape cancels editing, Tab moves to next field
- Custom widgets: Never trap focus without an Escape exit

### 2.4.1 Bypass Blocks (Level A)

Skip link to bypass repeated navigation.

```tsx
// Add as first focusable element in the app
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:rounded focus:ring-1 focus:ring-foreground/50"
>
  Skip to main content
</a>

// Target in main content area
<main id="main-content" tabIndex={-1}>
  {/* page content */}
</main>
```

### 2.4.3 Focus Order (Level A)

Focus order preserves meaning and operability.

- DOM order matches visual order
- No positive `tabIndex` values (use 0 or -1 only)
- Sidebar navigation focuses before main content
- Modal content focuses before page content (when open)

### 2.4.6 Headings and Labels (Level AA)

Headings and labels describe topic or purpose.

- Every section has a heading
- Form inputs have descriptive labels
- Headings are concise and describe the section content
- Labels describe what the input expects, not just the field name

### 2.4.7 Focus Visible (Level AA)

Keyboard focus indicator is always visible.

```tsx
// Preset standard focus ring
className="focus:outline-none focus:ring-1 focus:ring-foreground/50 focus:ring-offset-1"

// NEVER remove focus without replacement
// WRONG:
className="focus:outline-none"  // No replacement!

// WRONG:
className="outline-none"  // Removes focus for everyone!
```

### 2.5.5 Target Size (Level AAA, but recommended)

Touch targets are at least 44x44px.

- Buttons: min-height 44px (or use padding to achieve it)
- Icon buttons: min 44x44px clickable area (use padding if icon is small)
- Links in text: acceptable at text size, but isolated links should be larger
- Mobile: all interactive elements at least 44x44px

---

## 3. Understandable

Information and UI operation must be understandable.

### 3.1.1 Language of Page (Level A)

Page has a `lang` attribute.

```html
<html lang="en">
```

### 3.2.1 On Focus (Level A)

Focus does not trigger unexpected context changes.

- Focusing a form field does not submit the form
- Focusing a tab does not switch the tab (arrow keys do, then Enter/Space activates)
- Focusing a link does not navigate

### 3.2.2 On Input (Level A)

Changing a form input does not trigger unexpected context changes.

- Selecting a radio button does not submit the form
- Typing in a search field does not navigate away
- Selecting a filter updates content in-place (not full page navigation)

### 3.3.1 Error Identification (Level A)

Errors are identified and described in text.

```tsx
// CORRECT - Error with description adjacent to input
<div>
  <Label htmlFor="token-name">Token Name</Label>
  <Input
    id="token-name"
    aria-invalid={!!error}
    aria-describedby={error ? "token-name-error" : undefined}
  />
  {error && (
    <p id="token-name-error" className="text-sm text-destructive mt-1" role="alert">
      {error}
    </p>
  )}
</div>
```

### 3.3.2 Labels or Instructions (Level A)

Form inputs have labels or instructions.

- Every `<input>` has a `<label>` with matching `htmlFor`/`id`
- Complex inputs have `aria-describedby` for additional instructions
- Required fields are indicated (asterisk + screen reader text)

```tsx
// Required field pattern
<Label htmlFor="name">
  Token Name <span aria-hidden="true">*</span>
  <span className="sr-only">(required)</span>
</Label>
<Input id="name" required aria-required="true" />
```

### 3.3.3 Error Suggestion (Level AA)

When an error is detected, suggestions for correction are provided.

```tsx
// CORRECT - Error with suggestion
<p id="hex-error" role="alert" className="text-sm text-destructive mt-1">
  Invalid hex color. Use format: #RRGGBB (e.g., #3B82F6)
</p>
```

---

## 4. Robust

Content must be robust enough for assistive technologies.

### 4.1.1 Parsing (Level A)

HTML is well-formed.

- No duplicate `id` attributes
- All elements properly nested and closed
- Valid HTML5

### 4.1.2 Name, Role, Value (Level A)

All UI components have accessible name, role, and state.

| Component | Name Source | Role | State |
|-----------|-----------|------|-------|
| Button | Text content or `aria-label` | `button` (native) | `aria-disabled`, `aria-pressed` |
| Link | Text content or `aria-label` | `link` (native) | — |
| Checkbox | Label text | `checkbox` (native) | `aria-checked` (native `checked`) |
| Switch | Label text | `switch` | `aria-checked` |
| Tab | Text content | `tab` | `aria-selected` |
| Tab panel | `aria-labelledby` | `tabpanel` | — |
| Dialog | `aria-label` or `aria-labelledby` | `dialog` | `aria-modal="true"` |
| Combobox | Label text | `combobox` | `aria-expanded`, `aria-activedescendant` |
| Tree view | `aria-label` | `tree` | `aria-expanded` on items |
| Grid | `aria-label` | `grid` | `aria-rowcount`, `aria-colcount` |

### 4.1.3 Status Messages (Level AA)

Status messages are announced without receiving focus.

```tsx
// CORRECT - Live region for status updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>

// Preset-specific examples:
// - "Design system synced successfully"
// - "3 drift issues detected"
// - "Token imported: primary-blue"
// - "Preset saved"
// - "Connection test passed"
// - "Import complete: 24 tokens added, 3 conflicts"
```

---

## Quick Reference: Preset-Specific Patterns

| Preset Feature | Key Accessibility Concerns |
|----------------|---------------------------|
| Color token editor | Color swatches need text labels; color picker needs text input; contrast validation results announced |
| Typography studio | Font previews need alt text or aria-label; size/weight controls keyboard accessible |
| Token tables | Full `<table>` semantics; sortable columns with `aria-sort`; actions have labels |
| Drift reports | Scores conveyed by text not just color; status changes via `aria-live` |
| Preset grid | Roving tabindex for grid navigation; each card has descriptive label |
| Import wizard | Progress steps announced; errors identified; file upload keyboard accessible |
| MCP connection | Connection status via `aria-live`; test results announced; error guidance accessible |
| Settings forms | All inputs labeled; save confirmation announced; validation errors adjacent |
| Design system layers | Layer switching announced; active layer indicated via `aria-current` |
