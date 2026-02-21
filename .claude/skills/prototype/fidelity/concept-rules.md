# Concept Fidelity Rules

**Purpose:** Styled exploration that uses ITO design system tokens but allows creative freedom with component patterns. Good for testing visual direction before full production commitment.

## Design System Integration

### Colors
Use ITO semantic tokens:
```css
/* Backgrounds */
background: var(--surface-primary);
background: var(--surface-secondary);
background: var(--surface-tertiary);

/* Text */
color: var(--text-primary);
color: var(--text-secondary);
color: var(--text-tertiary);

/* Borders */
border-color: var(--border-default);
border-color: var(--border-subtle);

/* Status */
background: var(--status-success-bg);
color: var(--status-success);
background: var(--status-error-bg);
color: var(--status-error);
```

**Allowed:** Any token from the ITO design system
**Not required:** Exact preset component usage

### Typography
- Use design system font (Satoshi)
- Follow the type scale: 12px, 14px, 16px, 18px, 20px, 24px, 30px, 36px
- Use proper font weights: 400, 500, 700
- Follow line-height guidelines

### Spacing
Use design system spacing scale:
- `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px`, `64px`

### Border Radius
Use design system radius tokens:
- `var(--radius)` - default (8px)
- `calc(var(--radius) - 2px)` - medium (6px)
- `calc(var(--radius) - 4px)` - small (4px)

## Component Flexibility

### Allowed
- Custom button styles using design tokens
- Experimental card layouts
- Creative form patterns
- Novel navigation approaches
- Custom interactive patterns

### Required
- Consistent use of tokens (don't mix custom colors)
- Proper contrast ratios (WCAG AA minimum)
- Logical spacing rhythm
- Readable typography

## Interactive States

Include interactive states:
- Hover states (opacity, background change)
- Focus states (ring or outline)
- Active/pressed states
- Disabled states (where applicable)

Example hover pattern:
```css
.button:hover {
  opacity: 0.9;
}
/* or */
.card:hover {
  border-color: var(--border-strong);
}
```

## Example

```html
<div class="rounded-lg border p-6 max-w-md">
  <h2 class="text-xl font-semibold mb-4">Create Account</h2>

  <div class="space-y-4">
    <!-- Custom input style using tokens -->
    <div>
      <label class="text-sm font-medium mb-1.5 block">Email</label>
      <input
        type="email"
        placeholder="you@example.com"
        class="w-full px-4 py-2.5 rounded-md border bg-surface-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>

    <!-- Creative password input with toggle -->
    <div>
      <label class="text-sm font-medium mb-1.5 block">Password</label>
      <div class="relative">
        <input
          type="password"
          placeholder="********"
          class="w-full px-4 py-2.5 pr-10 rounded-md border bg-surface-primary"
        />
        <button class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
          <!-- Eye icon -->
        </button>
      </div>
    </div>

    <!-- Primary action using tokens but custom style -->
    <button class="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
      Create Account
    </button>

    <!-- Secondary option -->
    <p class="text-sm text-center text-text-secondary">
      Already have an account?
      <a href="#" class="text-text-primary underline hover:no-underline">Sign in</a>
    </p>
  </div>
</div>
```

## DO

- Use all design system color tokens
- Follow spacing and typography scales
- Add hover and focus states
- Experiment with component layouts
- Try different visual approaches
- Use Tailwind utility classes
- Make it visually polished

## DO NOT

- Use hardcoded colors outside the token system
- Ignore contrast requirements
- Mix design system tokens with arbitrary values
- Skip interactive states

## Purpose of Concept

Concept fidelity is for:
1. Exploring visual direction with real design tokens
2. Testing component variations before formalizing presets
3. Getting stakeholder feedback on look and feel
4. Validating that design system tokens work for the use case
