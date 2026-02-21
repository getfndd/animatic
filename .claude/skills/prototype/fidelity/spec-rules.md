# Spec Fidelity Rules

**Purpose:** Production-accurate prototype that MUST use exact ITO design system presets and components. This is what will be built.

## Strict Requirements

### Components MUST Use Presets

Before writing any component, query the ITO Design System MCP for the correct preset:

```
Use MCP tool: suggest_preset({ intent: "submit form" })
Use MCP tool: get_preset_code({ presetName: "primary-action" })
```

All interactive elements MUST use a preset. Do not create custom button/input/badge styles.

### Color Usage MUST Be Validated

Before using any color, verify it's appropriate:

```
Use MCP tool: get_color_guidance({ context: "error message background" })
Use MCP tool: check_contrast({ foreground: "#...", background: "#..." })
```

Never use arbitrary hex codes. All colors come from ITO design tokens.

### Component Props MUST Be Validated

After writing component code, validate the props:

```
Use MCP tool: validate_component_props({
  component: "button",
  props: { intent: "primary", size: "md" },
  context: "form submission"
})
```

## Required Elements

### Every Spec Must Include

1. **Exact preset components** - No custom styling
2. **All interactive states** - Hover, focus, active, disabled
3. **Loading states** - Where applicable
4. **Error states** - Form validation, API errors
5. **Empty states** - When data is missing
6. **Responsive behavior** - Mobile, tablet, desktop

### Accessibility Requirements

- All interactive elements keyboard accessible
- Proper ARIA labels where needed
- Focus indicators visible
- Color contrast WCAG AA minimum
- Screen reader friendly structure

## Component Reference

### Buttons (use presets)

```html
<!-- Primary action - use preset="primary-action" -->
<button class="inline-flex items-center justify-center rounded-full bg-surface-inverse px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-surface-inverse/20 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none">
  Save Changes
</button>

<!-- Secondary action - use preset="secondary-action" -->
<button class="inline-flex items-center justify-center rounded-full border border-border-default bg-surface-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-surface-inverse/20 focus:ring-offset-2">
  Cancel
</button>

<!-- Destructive action - use preset="destructive-action" -->
<button class="inline-flex items-center justify-center rounded-full bg-status-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-status-error/20 focus:ring-offset-2">
  Delete
</button>
```

### Inputs (use presets)

```html
<!-- Standard input - use preset="default-input" -->
<input
  type="text"
  class="flex h-10 w-full rounded-md border border-border-default bg-surface-primary px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-surface-inverse/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  placeholder="Enter text..."
/>

<!-- With error state -->
<input
  type="text"
  class="flex h-10 w-full rounded-md border border-status-error bg-surface-primary px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-status-error/20"
/>
<p class="text-sm text-status-error mt-1">This field is required</p>
```

### Cards

```html
<!-- Standard card -->
<div class="rounded-lg border border-border-default bg-surface-primary p-6">
  <h3 class="font-semibold text-text-primary">Card Title</h3>
  <p class="text-sm text-text-secondary mt-1">Card description</p>
</div>
```

### Badges (use presets)

```html
<!-- Status badge -->
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-success-bg text-status-success">
  Active
</span>

<!-- Category badge -->
<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-surface-secondary text-text-secondary">
  Category
</span>
```

## Validation Checklist

Before completing a spec prototype, verify:

- [ ] All buttons use appropriate presets (query ITO MCP)
- [ ] All inputs use appropriate presets (query ITO MCP)
- [ ] All colors validated (query ITO MCP)
- [ ] All component props validated (query ITO MCP)
- [ ] Hover states present on all interactive elements
- [ ] Focus states present on all interactive elements
- [ ] Disabled states styled correctly
- [ ] Loading states included where needed
- [ ] Error states included for forms
- [ ] Empty states included for lists/data
- [ ] Responsive behavior defined
- [ ] Keyboard navigation works
- [ ] Contrast ratios pass WCAG AA

## DO

- Query ITO MCP for presets before writing components
- Validate colors and contrast
- Include ALL interactive states
- Use exact design system patterns
- Follow accessibility guidelines
- Document any deviations with reasoning

## DO NOT

- Create custom button/input/badge styles
- Use colors without MCP validation
- Skip interactive states
- Ignore accessibility requirements
- Deviate from presets without explicit approval

## Purpose of Spec

Spec fidelity is for:
1. Final prototype before implementation
2. Exact representation of what will be built
3. Developer handoff documentation
4. Design system compliance verification
5. Accessibility audit baseline
