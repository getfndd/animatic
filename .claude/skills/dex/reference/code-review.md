# Code Review Reference

Deep technical analysis checklist and patterns for `@dex review` and `@dex commit`.

---

## Review Checklist

### 1. Patterns

**Check:**
- [ ] Does code follow established patterns in the codebase?
- [ ] Are there existing utilities being reinvented?
- [ ] Is the abstraction level consistent with similar code?
- [ ] Are naming conventions followed?

**Common Issues:**
- Custom hooks duplicating existing ones
- Manual state management where React Query exists
- Inline styles where design tokens should be used
- Direct API calls bypassing service layer

### 2. Types

**Check:**
- [ ] Are types explicit, not inferred `any`?
- [ ] Are function parameters and returns typed?
- [ ] Are interfaces preferred over inline types for complex shapes?
- [ ] Are nullable types handled (optional chaining, nullish coalescing)?

**Common Issues:**
- `any` or `unknown` used as escape hatch
- Missing return types on functions
- Implicit `any` from untyped imports
- Type assertions (`as`) hiding real issues

### 3. Imports

**Check:**
- [ ] Are imports from the correct paths (not relative reaching across modules)?
- [ ] Are there unused imports?
- [ ] Is the import order consistent (external, internal, relative)?
- [ ] Are type imports using `import type`?

**Common Issues:**
- Circular dependencies
- Importing from `index` files unnecessarily
- Deep relative imports (`../../../`)
- Missing `import type` for type-only imports

### 4. Security

**Critical - Always Block:**
- [ ] No secrets, API keys, or credentials in code
- [ ] No hardcoded passwords or tokens
- [ ] No .env files committed
- [ ] No private keys or certificates

**High - Block Feature Commits:**
- [ ] User input is validated/sanitized
- [ ] SQL queries use parameterization (if applicable)
- [ ] HTML output is escaped (no XSS)
- [ ] Authentication checks are in place for protected routes
- [ ] Authorization checks verify user permissions

**Medium - Warn:**
- [ ] Sensitive data is not logged
- [ ] Error messages don't leak internal details
- [ ] CORS is configured appropriately
- [ ] Rate limiting is considered for public endpoints

### 5. Performance

**Check:**
- [ ] Are expensive operations memoized where appropriate?
- [ ] Are unnecessary re-renders avoided?
- [ ] Is data fetching optimized (no N+1 queries)?
- [ ] Are large lists virtualized if needed?

**Common Issues:**
- Missing `useMemo` or `useCallback` for expensive calculations
- Inline object/function creation causing re-renders
- Fetching data in loops
- Loading entire datasets when pagination exists

### 6. Edge Cases

**Check:**
- [ ] Are error states handled?
- [ ] Are loading states handled?
- [ ] Are empty states handled?
- [ ] Are null/undefined values handled?
- [ ] Are network failures handled?

**Common Issues:**
- Missing error boundaries
- No loading indicators
- Empty arrays causing crashes
- Assuming API always returns data

---

## Security Scanning

### Secrets Patterns

Scan for these patterns (case-insensitive):

```
API_KEY=
api_key=
apiKey=
secret=
SECRET=
password=
PASSWORD=
token=
TOKEN=
private_key
PRIVATE_KEY
-----BEGIN.*PRIVATE KEY-----
aws_access_key
AWS_ACCESS_KEY
database_url
DATABASE_URL
```

### File Patterns to Flag

```
.env
.env.local
.env.production
*.pem
*.key
credentials.json
service-account.json
```

### Safe Patterns (Allowlist)

These are typically safe:
- `process.env.VARIABLE_NAME` (reading env, not setting)
- `import.meta.env.VARIABLE_NAME` (Vite env)
- Example/placeholder values in documentation
- Test fixtures with fake data

---

## Review Output Format

```markdown
## Code Review: [File/Feature]

### Summary
[Brief description of what was reviewed]

### Findings

#### Critical (Blocks Commit)
- [Issue]: [Description] - [File:Line]

#### High (Blocks Feature Commits)
- [Issue]: [Description] - [File:Line]

#### Medium (Should Fix)
- [Issue]: [Description] - [File:Line]

#### Low (Consider)
- [Issue]: [Description] - [File:Line]

### Positive Notes
- [What's done well]

### Decision
[APPROVE / REQUEST CHANGES / BLOCK]
```

---

## Review Depth by Context

| Context | Depth | Focus |
|---------|-------|-------|
| Feature commit | Full | All categories |
| Bugfix | Targeted | Related code, regression potential |
| Refactor | Patterns | Consistency, no behavior change |
| Hotfix | Security | Security, minimal change |
| Dependency update | Security | Known vulnerabilities, breaking changes |
| Documentation | Light | Accuracy, completeness |
