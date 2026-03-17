# Performance Guide for Preset

Reference for performance optimization. Load when auditing performance or deciding whether to optimize.

**Cardinal rule: Measure before you optimize.** Premature optimization adds complexity without proven benefit. Only optimize when you can demonstrate a problem.

---

## useMemo / useCallback Guidelines

### When useMemo IS Warranted

```tsx
// 1. Expensive computation over a large dataset
const byCategory = useMemo(() => {
  return tokens.reduce<TokensByCategory>((acc, token) => {
    const category = token.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(token);
    return acc;
  }, {});
}, [tokens]);

// 2. Creating a derived object that is passed to a memoized child
const sortedItems = useMemo(() =>
  items.slice().sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// 3. Preventing re-creation of objects used in dependency arrays
const queryOptions = useMemo(() => ({
  enabled: !!dsId && !!layerId,
  staleTime: 30_000,
}), [dsId, layerId]);
```

### When useMemo is NOT Warranted

```tsx
// WRONG - trivial computation, no performance benefit
const count = useMemo(() => items.length, [items]);
// Just use: const count = items.length;

// WRONG - primitive value, referential equality doesn't matter
const isActive = useMemo(() => status === 'active', [status]);
// Just use: const isActive = status === 'active';

// WRONG - new object created but never compared by reference
const style = useMemo(() => ({ color: 'red' }), []);
// Just use inline: style={{ color: 'red' }}
// (unless passed to a memoized child)
```

### useCallback Rules

```tsx
// WARRANTED - passed to a memoized child component
const handleClick = useCallback((id: string) => {
  setSelectedId(id);
}, []);

<MemoizedList onItemClick={handleClick} />

// NOT WARRANTED - handler used directly, no memoized children
const handleSubmit = () => {
  createToken(values);
};
```

### Decision Flowchart

```
Is it a function?
├── Yes → Is it passed as a prop to React.memo child?
│   ├── Yes → useCallback
│   └── No → Plain function
└── No → Is it an expensive computation (O(n) where n > 100)?
    ├── Yes → useMemo
    └── No → Is the result an object/array passed to a dependency array?
        ├── Yes → useMemo
        └── No → Plain expression
```

---

## Bundle Splitting with React.lazy

### Route-Level Splitting

```tsx
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load page-level components
const TokenStudio = lazy(() => import('@/pages/TokenStudio'));
const PresetStudio = lazy(() => import('@/pages/PresetStudio'));
const Settings = lazy(() => import('@/pages/Settings'));

function AppRoutes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/tokens" element={<TokenStudio />} />
        <Route path="/presets" element={<PresetStudio />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### Component-Level Splitting

Only split components that are:
- Large (> 50KB bundled)
- Not immediately visible (behind a tab, dialog, or scroll)
- Not on the critical rendering path

```tsx
// Dialog content that's heavy and not always needed
const ImportWizard = lazy(() => import('@/components/import/ImportWizard'));

function TokenPage() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <Button onClick={() => setShowImport(true)}>Import</Button>
      {showImport && (
        <Suspense fallback={<DialogSkeleton />}>
          <ImportWizard
            open={showImport}
            onOpenChange={setShowImport}
          />
        </Suspense>
      )}
    </>
  );
}
```

### What NOT to Split

- shadcn/ui components (small, used everywhere)
- Hooks and utilities (no JSX to suspend)
- Components that appear above the fold on page load
- Components used in the primary navigation shell

---

## Virtual Scrolling for Long Lists

Use virtual scrolling when rendering lists with > 100 items. Common in Preset for:
- Token tables (design systems can have 500+ tokens)
- Drift reports
- Audit logs

### With @tanstack/react-virtual

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualTokenList({ tokens }: { tokens: DesignToken[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tokens.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Estimated row height in px
    overscan: 10, // Render 10 extra rows above/below viewport
  });

  return (
    <div
      ref={parentRef}
      className="h-[400px] overflow-auto rounded-lg border border-border"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const token = tokens[virtualRow.index];
          return (
            <div
              key={token.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TokenRow token={token} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### When to Use

| Item Count | Recommendation |
|------------|----------------|
| < 50 | Render all items |
| 50-100 | Consider virtualizing if items are complex |
| 100+ | Virtualize |
| 500+ | Virtualize + paginate server-side |

---

## Re-render Prevention Strategies

### 1. Lift State Up Only When Necessary

```tsx
// WRONG - unnecessary shared state causes sibling re-renders
function Parent() {
  const [filter, setFilter] = useState('');
  return (
    <>
      <Header filter={filter} /> {/* Re-renders when filter changes */}
      <SearchBar value={filter} onChange={setFilter} />
      <ResultList filter={filter} />
    </>
  );
}

// BETTER - isolate state to the components that need it
function Parent() {
  return (
    <>
      <Header /> {/* Never re-renders from search */}
      <SearchWithResults />
    </>
  );
}
```

### 2. React.memo for Expensive Children

```tsx
// Only memoize components that are expensive to render
// AND receive props that change identity frequently
const TokenRow = React.memo(function TokenRow({
  token,
  onEdit,
  onDelete,
}: {
  token: DesignToken;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TableRow>
      {/* ... */}
    </TableRow>
  );
});
```

### 3. Avoid Object Literals in JSX Props

```tsx
// WRONG - creates new object every render, defeats memo
<TokenRow
  token={token}
  style={{ padding: 8 }}  // New object each render
  config={{ showActions: true }}  // New object each render
/>

// BETTER - stable references
const rowStyle = { padding: 8 };
const rowConfig = { showActions: true };

<TokenRow token={token} style={rowStyle} config={rowConfig} />
```

### 4. Use Children Pattern to Avoid Re-renders

```tsx
// WRONG - ContextProvider re-renders all children when value changes
function App() {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Header />      {/* Re-renders when theme changes */}
      <MainContent />  {/* Re-renders when theme changes */}
      <Footer />       {/* Re-renders when theme changes */}
    </ThemeContext.Provider>
  );
}

// BETTER - children are stable, only consumers re-render
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}  {/* children reference is stable */}
    </ThemeContext.Provider>
  );
}
```

---

## React Query Caching Strategies

### Stale-While-Revalidate

React Query defaults to stale-while-revalidate: show cached data immediately, refetch in background.

```ts
const { data } = useQuery({
  queryKey: qk,
  queryFn: fetchFn,
  staleTime: 30_000,     // Data is "fresh" for 30 seconds
  gcTime: 5 * 60_000,    // Keep in cache for 5 minutes after unmount
  refetchOnWindowFocus: true,  // Refetch when user returns to tab (default)
});
```

### Background Refetch Tuning

| Scenario | staleTime | gcTime | refetchOnWindowFocus |
|----------|-----------|--------|---------------------|
| Collaborative editing (tokens) | 0-5s | 5 min | true |
| Dashboard metrics | 30s | 10 min | true |
| User preferences | 5 min | 30 min | false |
| Static reference data | 30 min | 60 min | false |

### Placeholder Data

Show previous data while fetching new data (e.g., when switching design systems):

```ts
const { data } = useQuery({
  queryKey: queryKeys.tokens.resolved(dsId, layerId),
  queryFn: () => fetchResolvedTokens(dsId!, layerId),
  enabled: !!dsId,
  placeholderData: keepPreviousData,  // TanStack Query v5
});
```

---

## Debouncing Search and Filter Inputs

### useDeferredValue (preferred for React 18)

```tsx
import { useDeferredValue, useMemo } from 'react';

function TokenSearch({ tokens }: { tokens: DesignToken[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() =>
    tokens.filter((t) =>
      t.name.toLowerCase().includes(deferredQuery.toLowerCase())
    ),
    [tokens, deferredQuery]
  );

  return (
    <>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tokens..."
      />
      <TokenList tokens={filtered} />
    </>
  );
}
```

### Custom Debounce Hook (for API calls)

```tsx
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// Usage in search with API call
function SearchPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data: results } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAPI(debouncedQuery),
    enabled: debouncedQuery.length > 2,
  });
}
```

### When to Use Which

| Scenario | Approach |
|----------|----------|
| Filtering local data | `useDeferredValue` |
| Triggering API calls | `useDebounce` (300ms) |
| Typing in a form field | Neither (update immediately) |
| Real-time search suggestions | `useDebounce` (150ms) |

---

## Image Optimization

### Lazy Loading

```tsx
// Browser-native lazy loading for images below the fold
<img
  src={imageSrc}
  alt={altText}
  loading="lazy"
  decoding="async"
  className="rounded-lg"
/>
```

### Responsive Images

```tsx
<img
  src={imageSrc}
  srcSet={`${imageSrc}?w=400 400w, ${imageSrc}?w=800 800w`}
  sizes="(max-width: 768px) 100vw, 50vw"
  alt={altText}
  loading="lazy"
/>
```

### SVG Icons

Phosphor Icons are SVG-based and tree-shakeable. Import individual icons:

```tsx
// CORRECT - tree-shakeable
import { GearSix } from '@phosphor-icons/react';

// WRONG - imports entire library
import * as Icons from '@phosphor-icons/react';
```

---

## Performance Audit Checklist

Use this when running `@hicks performance`:

| Category | Check | Severity |
|----------|-------|----------|
| **Re-renders** | Component re-renders when parent state changes but its props haven't | Critical |
| **Re-renders** | Object/array literals in JSX props defeating React.memo | Critical |
| **Re-renders** | Context value changes causing unnecessary consumer re-renders | Optimization |
| **Data** | Server data duplicated in useState | Critical |
| **Data** | Missing `enabled` flag on conditional queries | Critical |
| **Data** | No staleTime configured (defaults to 0, refetches constantly) | Optimization |
| **Bundle** | Large component not code-split | Optimization |
| **Bundle** | Importing entire library instead of specific exports | Optimization |
| **DOM** | Rendering 100+ items without virtualization | Critical |
| **DOM** | Layout properties animated (width, height, padding) | Critical |
| **Hooks** | useMemo/useCallback on trivial computations | Premature |
| **Hooks** | useEffect for derived state | Critical |
| **Hooks** | useEffect for event handling | Optimization |
