# Testing Philosophy

What to test, at what level, and what not to bother with. Load when deciding coverage for a change.

---

### What to Test

- **Always test**: Business logic, data transformations, conditional rendering, error states
- **Usually test**: User interactions (click, type, submit), integration between components
- **Rarely test**: Styling, layout, third-party library behavior
- **Never test**: Implementation details (internal state, private methods, hook internals)

### How to Test

- Test behavior, not implementation: "when the user clicks Save, the form submits" not "when onClick fires, setState is called"
- Use Testing Library queries: `getByRole`, `getByLabelText`, `getByText` — in that order of preference
- Avoid `getByTestId` except as a last resort
- Write tests from the user's perspective

### Test Structure

```typescript
describe('InvestorCard', () => {
  it('renders investor name and firm', () => { ... })
  it('shows pipeline stage badge', () => { ... })
  it('calls onSelect when clicked', () => { ... })
  it('shows skeleton when loading', () => { ... })
  it('displays error state with retry', () => { ... })
})
```
