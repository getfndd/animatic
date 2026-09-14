# Component Architecture Rules

Composition, boundaries, and when to split a component. Load when structuring new components or judging whether an existing tree is right.

---

### Composition Over Inheritance

- Build components by composing smaller, focused pieces
- Never extend component classes or use HOC chains
- Prefer render props or hooks for shared behavior
- Compound components for complex, related UI (e.g., `Tabs` + `TabList` + `Tab` + `TabPanel`)

### Props Down, Events Up

- Data flows down through props
- State changes flow up through callbacks
- Never reach into a child component's internals
- Never mutate props

### Single Responsibility

- One component, one job
- If a component name needs "And" or does two things, split it
- Container components handle data; presentational components handle rendering
- Keep components under 200 lines — if longer, look for extraction opportunities

### Controlled vs Uncontrolled

- **Controlled**: Parent owns the state, component reflects it. Use for forms that need validation, interdependent fields, or programmatic updates.
- **Uncontrolled**: Component owns its own state. Use for isolated UI (accordions, tooltips) or when parent doesn't need the value.
- **Know when to use which.** Never mix — a component should not switch between controlled and uncontrolled during its lifetime.
- Refs for uncontrolled access (`useRef` + `ref.current.value`), state for controlled.

### Colocation

- Styles, tests, and types live near the component they serve
- Avoid global `types/` or `styles/` folders — colocate by feature
- Exception: shared types that cross module boundaries go in `src/types/`
- Exception: global styles (tokens, resets) live in `src/styles/`

### File Organization

```
ComponentName/
  ComponentName.tsx       # Main component
  ComponentName.test.tsx  # Tests
  useComponentName.ts     # Component-specific hook (if needed)
  index.ts                # Re-export
```

For simpler components, a single file is fine. Do not create folders for components under 100 lines with no tests or hooks.
