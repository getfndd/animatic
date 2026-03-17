# Focus Management Patterns for Preset

Focus management patterns for Preset's design system management interfaces. Covers focus indicators, trapping, restoration, roving tabindex, and skip links.

---

## Standard Focus Ring

All interactive elements in Preset use this focus ring:

```tsx
className="focus:outline-none focus:ring-1 focus:ring-foreground/50 focus:ring-offset-1"
```

**Properties:**
- `ring-1` -- thin, subtle (never `ring-2`)
- `ring-foreground/50` -- semantic token at 50% opacity, works in light and dark mode
- `ring-offset-1` -- minimal gap between element and ring (never `ring-offset-2`)

**Variations:**

```tsx
// Standard interactive element (buttons, inputs, links)
className="focus:outline-none focus:ring-1 focus:ring-foreground/50 focus:ring-offset-1"

// Focus-visible only (keyboard users, not mouse clicks)
className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/50 focus-visible:ring-offset-1"

// Within dark containers (invert the offset background)
className="focus:outline-none focus:ring-1 focus:ring-foreground/50 focus:ring-offset-1 focus:ring-offset-background"

// Inset focus (for elements where offset looks wrong, like table cells)
className="focus:outline-none focus:ring-1 focus:ring-inset focus:ring-foreground/50"
```

**Anti-patterns:**
```tsx
// WRONG - too thick
className="focus:ring-2 focus:ring-foreground"

// WRONG - colored, breaks design system
className="focus:ring-blue-500"

// WRONG - full opacity, too harsh
className="focus:ring-foreground"

// WRONG - removes focus with no replacement
className="focus:outline-none"

// WRONG - removes focus globally
className="outline-none"
```

---

## Modal / Dialog Focus Trapping

When a modal opens, focus must be trapped inside until it closes.

### Pattern

shadcn/ui Dialog (built on Radix) handles focus trapping automatically. When using custom modals:

```tsx
import { useEffect, useRef } from 'react';

function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store the element that had focus before modal opened
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the first focusable element inside the modal
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable?.length) {
        (focusable[0] as HTMLElement).focus();
      }
    }

    return () => {
      // Restore focus when modal closes
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  // Handle Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }

    // Trap focus: cycle between first and last focusable elements
    if (e.key === 'Tab') {
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dialog title"
      ref={modalRef}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
```

### Key Requirements

| Requirement | Implementation |
|-------------|---------------|
| Focus moves into modal on open | Auto-focus first focusable element or close button |
| Focus trapped inside modal | Tab cycles within modal, does not escape to page |
| Escape closes modal | `onKeyDown` handler for Escape |
| Focus restored on close | Store `document.activeElement` before open, restore on close |
| Background is inert | Use `aria-modal="true"` + overlay click to close |

---

## Tab Order in Complex Layouts

### Token Editor Layout

Typical Preset token editor has: sidebar navigation, main content area, property panels.

```
Tab order flow:
1. Skip link (hidden until focused)
2. Sidebar navigation items
3. Main content area (token list/grid)
4. Property panel (when open)
5. Action bar (save, cancel)
```

**Rules:**
- DOM order matches visual left-to-right, top-to-bottom flow
- Sidebar items are a single tab stop with arrow key navigation (roving tabindex)
- Property panel receives focus when opened
- Action bar buttons are in natural tab flow at the bottom

### Preset Grid Layout

Design presets displayed in a grid (cards or tiles):

```tsx
// Grid container with roving tabindex
function PresetGrid({ presets }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const cols = 3; // columns in grid
    let newIndex = activeIndex;

    switch (e.key) {
      case 'ArrowRight':
        newIndex = Math.min(activeIndex + 1, presets.length - 1);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(activeIndex - 1, 0);
        break;
      case 'ArrowDown':
        newIndex = Math.min(activeIndex + cols, presets.length - 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(activeIndex - cols, 0);
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = presets.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    setActiveIndex(newIndex);
  };

  return (
    <div
      role="grid"
      aria-label="Design presets"
      ref={gridRef}
      onKeyDown={handleKeyDown}
    >
      <div role="row" className="grid grid-cols-3 gap-4">
        {presets.map((preset, i) => (
          <div
            key={preset.id}
            role="gridcell"
            tabIndex={i === activeIndex ? 0 : -1}
            aria-label={`${preset.name}: ${preset.description}`}
            className="focus:outline-none focus:ring-1 focus:ring-foreground/50 focus:ring-offset-1"
            ref={(el) => {
              if (i === activeIndex && el) el.focus();
            }}
          >
            <PresetCard preset={preset} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Token Table Tab Order

Token tables with sortable columns and row actions:

```
Tab order:
1. Sort column header (Enter to toggle sort)
2. First row, first actionable element
3. Continue through row actions
4. Next row...
5. Pagination controls
```

**Rules:**
- Column headers are focusable when sortable (`tabIndex={0}`, `role="columnheader"`, `aria-sort`)
- Row data cells are NOT individually focusable (unless editable)
- Action buttons within rows are focusable
- Use `aria-sort="ascending"` / `"descending"` / `"none"` on sortable headers

---

## Focus Restoration After Actions

### After Delete

```tsx
function TokenList({ tokens, onDelete }) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleDelete = (index: number) => {
    onDelete(tokens[index].id);

    // After delete, focus the next item (or previous if last)
    requestAnimationFrame(() => {
      const items = listRef.current?.querySelectorAll('[role="listitem"]');
      if (!items?.length) return;

      const focusIndex = Math.min(index, items.length - 1);
      (items[focusIndex] as HTMLElement).focus();
    });
  };

  return (
    <div role="list" ref={listRef}>
      {tokens.map((token, i) => (
        <div key={token.id} role="listitem" tabIndex={0}>
          <span>{token.name}</span>
          <button
            aria-label={`Delete ${token.name}`}
            onClick={() => handleDelete(i)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### After Create

When a new item is created:
1. Focus moves to the new item
2. If the new item has an editable name field, focus that field
3. Announce creation via `aria-live` region

```tsx
// After creating a new token
const handleCreate = async () => {
  const newToken = await createToken(data);

  // Announce creation
  setStatusMessage(`Token "${newToken.name}" created`);

  // Focus the new item after render
  requestAnimationFrame(() => {
    const newElement = document.getElementById(`token-${newToken.id}`);
    newElement?.focus();
  });
};
```

### After Edit (Inline)

When inline editing completes:
1. Escape: cancel edit, restore focus to the element that was edited
2. Enter/Save: commit edit, restore focus to the element or its container
3. Tab: commit edit, move focus to next focusable element

---

## Skip Links

### Implementation

```tsx
// Place as the very first element inside <body> or app root
function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-4 left-4 z-50 bg-background px-4 py-2 rounded-md border border-border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-foreground/50 focus:ring-offset-1"
      >
        Skip to main content
      </a>
    </div>
  );
}

// Target element
<main id="main-content" tabIndex={-1}>
  {/* Page content */}
</main>
```

**Rules:**
- Skip link is the first focusable element on the page
- Hidden visually but exposed to screen readers and keyboard
- Becomes visible on focus
- Links to `#main-content` which has `tabIndex={-1}`
- Use `tabIndex={-1}` on the target so it receives focus but is not in the tab order

### Multiple Skip Links (Complex Layouts)

For pages with multiple significant sections:

```tsx
<div className="sr-only focus-within:not-sr-only">
  <nav aria-label="Skip links" className="fixed top-4 left-4 z-50 flex flex-col gap-1">
    <a href="#main-content" className="...">Skip to main content</a>
    <a href="#token-editor" className="...">Skip to token editor</a>
    <a href="#preview" className="...">Skip to preview</a>
  </nav>
</div>
```

---

## Roving Tabindex

For composite widgets where arrow keys navigate between items but the group is a single tab stop.

### When to Use

| Widget | Navigation | Pattern |
|--------|-----------|---------|
| Tab list | Left/Right arrows | Roving tabindex |
| Menu | Up/Down arrows | Roving tabindex |
| Radio group | Up/Down or Left/Right | Roving tabindex |
| Grid (preset cards) | Arrow keys (2D) | Roving tabindex |
| Toolbar | Left/Right arrows | Roving tabindex |
| Tree view | Up/Down arrows, Left/Right for expand | Roving tabindex |

### Implementation Pattern

```tsx
function RovingGroup({ items, orientation = 'horizontal' }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

    switch (e.key) {
      case nextKey:
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % items.length);
        break;
      case prevKey:
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Group label"
      onKeyDown={handleKeyDown}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          tabIndex={i === activeIndex ? 0 : -1}
          ref={(el) => {
            if (i === activeIndex && el) el.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

### Key Behaviors

| Behavior | Implementation |
|----------|---------------|
| Only active item has `tabIndex={0}` | All others have `tabIndex={-1}` |
| Tab enters group at active item | Tab leaves group to next widget |
| Arrow keys move within group | Wrap at edges or stop at boundaries |
| Home/End jump to first/last | Always supported |
| Focus follows active item | `ref` + `focus()` on state change |

---

## Preset-Specific Focus Patterns

### Color Picker Focus

Color pickers in token editors need special focus handling:

1. The color swatch button receives focus normally
2. Opening the picker moves focus to the hex input
3. Escape closes picker and returns focus to swatch button
4. The gradient/hue slider is keyboard accessible (arrow keys)

### Drift Report Navigation

When reviewing drift items:
1. Drift items are a list with roving tabindex
2. Enter expands details for an item
3. Escape collapses and returns focus to the item
4. Action buttons within expanded details are in tab order

### Import Flow Focus

Multi-step import wizards:
1. Focus moves to the first interactive element in each step
2. "Next" button is last in tab order within the step
3. Completing a step moves focus to the heading of the next step
4. Back button returns focus to the previous step's heading
5. Errors focus the first field with an error
