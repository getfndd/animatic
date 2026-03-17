# Component Patterns for Preset

Reference patterns for building components in the Preset codebase. Load when making component architecture decisions.

---

## Flat Styling Pattern

The Museum principle dictates: the UI is the frame, the user's work is the art. Chrome recedes, content advances.

### Preferred: Flat with Borders

```tsx
// Section container
<div className="rounded-lg border border-border p-4">
  <h2 className="text-sm font-semibold">Section Title</h2>
  <p className="text-sm text-muted-foreground mt-1">Description text</p>
  {/* Content */}
</div>

// With hover interaction
<div className="rounded-lg border border-border p-4 hover:border-muted-foreground/50 transition-colors">
  {/* Interactive content */}
</div>
```

### Avoid: Nested Cards

```tsx
// WRONG - nested cards with shadows
<Card>
  <CardHeader>
    <CardTitle>Section</CardTitle>
  </CardHeader>
  <CardContent>
    <Card>  {/* card-in-card */}
      <CardContent>...</CardContent>
    </Card>
  </CardContent>
</Card>
```

### When Cards ARE Appropriate

Cards (`<Card>`) are acceptable for:
- Top-level page sections that need visual separation from the background
- Modal/dialog content containers
- Standalone content blocks (not nested inside other cards)

---

## shadcn/ui Composition Patterns

### Button Variants

```tsx
import { Button } from '@/components/ui/button';

// Primary action
<Button>Save Changes</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Destructive
<Button variant="destructive">Delete</Button>

// Ghost (toolbar actions)
<Button variant="ghost" size="icon" aria-label="Settings">
  <GearSix className="h-4 w-4" />
</Button>

// Small button
<Button variant="outline" size="sm">Add Token</Button>
```

### Dialog Pattern

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

function FeatureDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            Brief description of what this dialog does.
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-4">
          {/* Form fields or content */}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Dialog rules:**
- Use `rounded-xl` and `shadow-xl` (never `rounded-2xl` or `shadow-2xl`)
- No `border-t` on footer areas — spacing alone creates separation
- DialogDescription is required for accessibility

### Tabs Pattern

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs defaultValue="general" className="space-y-4">
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="advanced">Advanced</TabsTrigger>
  </TabsList>
  <TabsContent value="general">
    {/* Content */}
  </TabsContent>
  <TabsContent value="advanced">
    {/* Content */}
  </TabsContent>
</Tabs>
```

---

## Form Patterns

### With react-hook-form

```tsx
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface FormValues {
  name: string;
  description: string;
}

function FeatureForm({ onSubmit }: { onSubmit: (data: FormValues) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...register('name', { required: 'Name is required' })}
          placeholder="Enter name"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          {...register('description')}
          placeholder="Optional description"
        />
      </div>

      <Button type="submit">Save</Button>
    </form>
  );
}
```

**Form rules:**
- Errors display adjacent to the triggering field, not in toasts
- Labels are always associated with inputs (htmlFor + id)
- Use `space-y-4` for field spacing, `space-y-2` within a field group

---

## Table Patterns

### Token Table Pattern

Used for token lists, drift reports, and similar tabular data:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function TokenTable({ tokens }: { tokens: DesignToken[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => (
            <TableRow key={token.id}>
              <TableCell className="font-medium">{token.name}</TableCell>
              <TableCell>{token.value.light}</TableCell>
              <TableCell>
                <Badge variant="secondary">{token.category}</Badge>
              </TableCell>
              <TableCell>
                {/* Action buttons */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Table rules:**
- Wrap in `rounded-lg border border-border` container
- Use `font-medium` for the primary column
- Action column gets fixed width
- Use `tabular-nums` for numerical data columns

---

## Loading States

### Skeleton Pattern

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Card skeleton
function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-3 w-[300px]" />
      <Skeleton className="h-3 w-[250px]" />
    </div>
  );
}

// Table row skeleton
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
      <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
    </TableRow>
  );
}

// Conditional rendering
function FeatureList({ loading, data }: { loading: boolean; data: Item[] }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return <>{/* Real content */}</>;
}
```

**Loading rules:**
- Use structural skeletons, not spinners (better perceived performance)
- Match skeleton dimensions to expected content
- Show 3 skeleton items by default for lists

---

## Error Boundaries

```tsx
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground mt-1">
            {this.state.error?.message}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Error boundary rules:**
- Wrap at feature boundaries (pages, major sections)
- Provide meaningful fallback UI, not blank screens
- Error styling uses `destructive` semantic token

---

## Compound Components

### Tab Group Pattern

```tsx
// Parent manages state, children compose layout
function SettingsPanel() {
  return (
    <Tabs defaultValue="general">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <Button variant="outline" size="sm">Export</Button>
      </div>

      <TabsContent value="general" className="mt-4">
        <GeneralSettings />
      </TabsContent>
      <TabsContent value="tokens" className="mt-4">
        <TokenSettings />
      </TabsContent>
      <TabsContent value="advanced" className="mt-4">
        <AdvancedSettings />
      </TabsContent>
    </Tabs>
  );
}
```

### Accordion Pattern

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

<Accordion type="single" collapsible>
  <AccordionItem value="section-1">
    <AccordionTrigger>Section One</AccordionTrigger>
    <AccordionContent>
      {/* Content */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

## Icon Usage

Preset uses **Phosphor Icons**:

```tsx
import { GearSix, Plus, Trash, PencilSimple, MagnifyingGlass } from '@phosphor-icons/react';

// Standard icon size in buttons
<Button variant="ghost" size="icon" aria-label="Settings">
  <GearSix className="h-4 w-4" />
</Button>

// Icon with text
<Button variant="outline" size="sm">
  <Plus className="h-4 w-4 mr-2" />
  Add Token
</Button>

// Status indicators: use dots, NOT icons in colored circles
<span className="h-2 w-2 rounded-full bg-emerald-500" />
```

**Icon rules:**
- Use `h-4 w-4` (16px) as the default icon size
- Use `h-5 w-5` (20px) for primary navigation icons
- Icon-only buttons MUST have `aria-label`
- Decorative icons that repeat label text should be removed
- Never use icons in colored circle containers (Museum principle)

---

## Empty States

```tsx
function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && (
        <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

**Empty state rules:**
- Center vertically with generous padding (`py-12`)
- Title in `text-foreground`, description in `text-muted-foreground`
- Optional action button below
- No decorative illustrations unless they serve a purpose
