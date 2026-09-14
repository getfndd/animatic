# TypeScript Patterns

Typing components, props, generics, and narrowing. Load when the type system is fighting the implementation.

---

### Type Safety

- **Never use `any`.** Use `unknown` + type guards if the type is truly unknown.
- **Never use `as` casts** unless you're narrowing from a validated unknown. `as` is a lie to the compiler.
- **Prefer inference** over explicit annotations when the compiler gets it right.
- **Strict mode always.** `strict: true` in tsconfig, no exceptions.

### Component Props

```typescript
// Good: interface for props, clear optionality
interface ButtonProps {
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick: () => void
}

// Bad: optional props that create impossible states
interface BadButtonProps {
  label?: string        // When would you not have a label?
  icon?: ReactNode      // If no label AND no icon, what renders?
  isLoading?: boolean   // Loading + disabled = ?
}
```

### Discriminated Unions

```typescript
// Good: impossible states are impossible
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

// Bad: optional props that allow impossible combinations
interface BadState<T> {
  isLoading?: boolean
  data?: T
  error?: Error
  // Can isLoading be true AND data be present? Who knows.
}
```

### Type vs Interface

- **Interfaces** for component props, API contracts, and anything that might be extended
- **Types** for unions, intersections, mapped types, and computed types
- Consistency within a codebase matters more than the rule — follow existing conventions

### Generics

- Use generics when you need type relationships across parameters/return values
- Name generics meaningfully: `TItem`, `TData`, `TError` — not `T`, `U`, `V`
- Constrain generics: `<TItem extends { id: string }>` not just `<TItem>`
- Avoid over-engineering — if a generic only has one use, it's probably premature

### Utility Types

- `Partial<T>` for optional updates
- `Pick<T, K>` and `Omit<T, K>` for subsetting
- `Record<K, V>` for dictionaries
- `NonNullable<T>` to strip null/undefined
- `ComponentProps<typeof Component>` to extract component prop types
