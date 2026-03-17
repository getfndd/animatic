# React Query Patterns for Preset

Reference patterns for data fetching and server state management. Load when working with hooks, mutations, or Supabase integration.

---

## Query Key Factory

All query keys are centralized at `apps/web/src/lib/query-keys.ts`.

### Structure

```ts
export const queryKeys = {
  tokens: {
    all: () => ['tokens'] as const,
    resolved: (dsId: string, layerId?: string | null) =>
      ['tokens', 'resolved', dsId, layerId ?? 'base'] as const,
    history: (tokenId: string) => ['tokens', 'history', tokenId] as const,
  },
  // ... other domains
} as const;
```

### Rules

| Rule | Rationale |
|------|-----------|
| Every new data domain gets an entry in `queryKeys` | Centralized invalidation |
| Use `as const` on return types | Type-safe key matching |
| `.all()` returns the broadest key for a domain | `queryClient.invalidateQueries({ queryKey: queryKeys.tokens.all() })` invalidates everything |
| More specific keys extend broader ones | Enables granular and broad invalidation |
| `layerId ?? 'base'` pattern for layer-aware queries | Consistent key shape whether layer is present or not |

### Adding a New Domain

```ts
// In @/lib/query-keys.ts
export const queryKeys = {
  // ... existing keys

  newFeature: {
    all: () => ['newFeature'] as const,
    list: (dsId: string) => ['newFeature', 'list', dsId] as const,
    detail: (id: string) => ['newFeature', 'detail', id] as const,
  },
};
```

---

## Standard Hook Pattern

The canonical hook pattern in Preset combines useQuery with the query key factory:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query-keys';

// ============================================================================
// Types
// ============================================================================

export interface FeatureItem {
  id: string;
  design_system_id: string;
  name: string;
  // ... fields
  created_at: string;
  updated_at: string;
}

export interface UseFeatureReturn {
  items: FeatureItem[];
  loading: boolean;
  error: string | null;
  createItem: (item: Omit<FeatureItem, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<FeatureItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

// ============================================================================
// Query Functions (private)
// ============================================================================

async function fetchItems(dsId: string): Promise<FeatureItem[]> {
  const { data, error } = await supabase
    .from('feature_table')
    .select('*')
    .eq('design_system_id', dsId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as FeatureItem[];
}

// ============================================================================
// Hook
// ============================================================================

export function useFeature(designSystemId: string | undefined): UseFeatureReturn {
  const qc = useQueryClient();
  const qk = queryKeys.newFeature.list(designSystemId!);

  // Query
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: qk,
    queryFn: () => fetchItems(designSystemId!),
    enabled: !!designSystemId,  // Don't fetch until ID is available
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (item: Omit<FeatureItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('feature_table').insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FeatureItem> }) => {
      const { error } = await supabase
        .from('feature_table')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feature_table').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
    },
  });

  return {
    items,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    createItem: (item) => createMutation.mutateAsync(item),
    updateItem: (id, updates) => updateMutation.mutateAsync({ id, updates }),
    deleteItem: (id) => deleteMutation.mutateAsync(id),
  };
}
```

### Key Conventions

| Convention | Example |
|------------|---------|
| `enabled: !!designSystemId` | Gate queries on required params |
| `data: items = []` | Default to empty array |
| Error normalization | `error ? (error as Error).message : null` |
| Return interface defined explicitly | `UseFeatureReturn` |
| `mutateAsync` in return object | Allows callers to await |
| Query functions are private | Not exported, only used by hook |

---

## Mutation Patterns

### Basic Mutation with Invalidation

```ts
const mutation = useMutation({
  mutationFn: async (data: CreateInput) => {
    const { error } = await supabase.from('table').insert(data);
    if (error) throw error;
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: queryKeys.domain.all() });
  },
});
```

### Mutation with Return Data

```ts
const mutation = useMutation({
  mutationFn: async (data: CreateInput) => {
    const { data: result, error } = await supabase
      .from('table')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  onSuccess: (newItem) => {
    // Use returned data if needed
    qc.invalidateQueries({ queryKey: queryKeys.domain.list(dsId) });
  },
});
```

### Optimistic Updates

Use sparingly — only for interactions where latency is noticeable (toggling, reordering):

```ts
const toggleMutation = useMutation({
  mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
    const { error } = await supabase
      .from('table')
      .update({ enabled })
      .eq('id', id);
    if (error) throw error;
  },
  onMutate: async ({ id, enabled }) => {
    // Cancel outgoing refetches
    await qc.cancelQueries({ queryKey: qk });

    // Snapshot previous value
    const previous = qc.getQueryData<Item[]>(qk);

    // Optimistically update
    qc.setQueryData<Item[]>(qk, (old) =>
      old?.map((item) =>
        item.id === id ? { ...item, enabled } : item
      )
    );

    return { previous };
  },
  onError: (_err, _vars, context) => {
    // Rollback on error
    if (context?.previous) {
      qc.setQueryData(qk, context.previous);
    }
  },
  onSettled: () => {
    // Always refetch after error or success
    qc.invalidateQueries({ queryKey: qk });
  },
});
```

**When to use optimistic updates:**
- Toggle switches
- Drag-and-drop reordering
- Inline editing

**When NOT to use:**
- Create operations (no ID to update)
- Delete operations (simpler to just invalidate)
- Complex mutations with side effects

---

## Query Invalidation Strategies

### Narrow Invalidation (preferred)

```ts
// Invalidate just the list for this design system
qc.invalidateQueries({ queryKey: queryKeys.tokens.resolved(dsId, layerId) });
```

### Broad Invalidation (when side effects cross domains)

```ts
// Invalidate all token queries (all design systems, all layers)
qc.invalidateQueries({ queryKey: queryKeys.tokens.all() });
```

### Cross-Domain Invalidation

```ts
// When deleting a token might affect presets that reference it
onSuccess: () => {
  qc.invalidateQueries({ queryKey: queryKeys.tokens.resolved(dsId, layerId) });
  qc.invalidateQueries({ queryKey: queryKeys.presets.resolved(dsId, layerId) });
},
```

### Invalidation Hierarchy

```
queryKeys.tokens.all()                    // Invalidates EVERYTHING below
  └── queryKeys.tokens.resolved(dsId)     // Invalidates this specific query
  └── queryKeys.tokens.history(tokenId)   // Invalidates this specific query
```

---

## Supabase Integration

### Client Access

```ts
import { supabase } from '@/lib/supabase';
```

### RPC Calls

For complex queries, use Supabase RPC functions:

```ts
async function fetchResolved(dsId: string, layerId?: string | null) {
  const { data, error } = await supabase.rpc('get_resolved_tokens', {
    p_design_system_id: dsId,
    p_layer_id: layerId || null,
  });

  if (error) throw error;
  return (data || []) as DesignToken[];
}
```

### Realtime Invalidation

Preset uses a `useRealtimeInvalidation` hook to automatically invalidate queries when Supabase Realtime detects changes:

```ts
import { useRealtimeInvalidation } from '@/hooks/useRealtimeInvalidation';

// Inside a hook
useRealtimeInvalidation({
  table: 'design_tokens',
  filter: `design_system_id=eq.${designSystemId}`,
  queryKeys: [qk],
  enabled: !!designSystemId,
});
```

**When to use realtime:**
- Multi-user editing scenarios
- Data that changes from external sources (MCP, CLI, edge functions)
- Tables where another user's changes should be immediately visible

**When NOT to use:**
- Admin-only pages with single-user access
- Read-only data that rarely changes

### Tables Not Yet in Generated Types

When a migration adds a table that hasn't been regenerated into TypeScript types:

```ts
// Temporary pattern — use `as any` with a TODO
const { data, error } = await supabase
  .from('new_table' as any)  // TODO: Regenerate types with `npx supabase gen types`
  .select('*')
  .eq('design_system_id', dsId);
```

**Always:**
- Add a `// TODO:` comment explaining why
- Include the command to fix it
- Remove `as any` after types are regenerated

---

## Prefetching Strategies

### On Hover (for navigation)

```ts
import { useQueryClient } from '@tanstack/react-query';

function DesignSystemCard({ ds }: { ds: DesignSystem }) {
  const qc = useQueryClient();

  const handleMouseEnter = () => {
    // Prefetch tokens when user hovers on a design system card
    qc.prefetchQuery({
      queryKey: queryKeys.tokens.resolved(ds.id),
      queryFn: () => fetchResolvedTokens(ds.id),
      staleTime: 30_000, // Don't refetch if data is < 30s old
    });
  };

  return (
    <div onMouseEnter={handleMouseEnter}>
      {/* Card content */}
    </div>
  );
}
```

### On Mount (for related data)

```ts
// In a page component, prefetch data the user will likely need
useEffect(() => {
  if (dsId) {
    qc.prefetchQuery({
      queryKey: queryKeys.presets.resolved(dsId),
      queryFn: () => fetchResolvedPresets(dsId),
    });
  }
}, [dsId, qc]);
```

### Stale Time Configuration

```ts
const { data } = useQuery({
  queryKey: qk,
  queryFn: fetchFn,
  staleTime: 5 * 60 * 1000,  // 5 minutes — data rarely changes
  gcTime: 10 * 60 * 1000,    // 10 minutes — keep in cache
});
```

| Data Type | Recommended staleTime |
|-----------|-----------------------|
| User profile | 5 minutes |
| Design system config | 2 minutes |
| Token lists | 30 seconds (collaborative editing) |
| Credit balance | 1 minute |
| Static reference data | 30 minutes |

---

## Error Handling

### In Query Functions

```ts
async function fetchItems(dsId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('design_system_id', dsId);

  if (error) throw error;  // Let React Query handle it
  return (data || []) as Item[];
}
```

### In Components

```tsx
function FeatureList() {
  const { items, loading, error } = useFeature(dsId);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (loading) return <FeatureSkeleton />;
  if (items.length === 0) return <EmptyState />;

  return <>{/* Render items */}</>;
}
```

### Mutation Error Handling

```tsx
const handleSave = async () => {
  try {
    await createItem(newItem);
    toast({ title: 'Created successfully' });
  } catch (err) {
    toast({
      title: 'Failed to create',
      description: (err as Error).message,
      variant: 'destructive',
    });
  }
};
```
