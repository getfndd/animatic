# Screen Reader Patterns for Preset

ARIA roles, live regions, descriptive labels, and semantic patterns for Preset's design system management interfaces. Designed for compatibility with VoiceOver (macOS), NVDA (Windows), and JAWS (Windows).

---

## ARIA Roles for Custom Components

### When to Use ARIA

**First rule of ARIA:** Don't use ARIA if you can use a native HTML element.

| Need | Native HTML (preferred) | ARIA (when native isn't possible) |
|------|------------------------|-----------------------------------|
| Button | `<button>` | `role="button" tabIndex={0}` + key handlers |
| Link | `<a href="...">` | `role="link" tabIndex={0}` |
| Checkbox | `<input type="checkbox">` | `role="checkbox" aria-checked` |
| Radio | `<input type="radio">` | `role="radio" aria-checked` |
| List | `<ul>` / `<ol>` | `role="list"` + `role="listitem"` |
| Table | `<table>` | `role="table"` + `role="row"` + `role="cell"` |

### Custom Component Roles

Components specific to Preset that need ARIA:

**Color Swatch Selector:**
```tsx
// Listbox pattern for selecting from a set of colors
<div role="listbox" aria-label="Color tokens" aria-orientation="horizontal">
  {colors.map((color) => (
    <div
      key={color.id}
      role="option"
      aria-selected={selectedId === color.id}
      aria-label={`${color.name}: ${color.value}`}
      tabIndex={selectedId === color.id ? 0 : -1}
    >
      <span
        className="h-8 w-8 rounded border border-border"
        style={{ backgroundColor: color.value }}
        aria-hidden="true"
      />
      <span className="text-sm">{color.name}</span>
    </div>
  ))}
</div>
```

**Preset Card Grid:**
```tsx
// Grid pattern for browsing design presets
<div
  role="grid"
  aria-label="Design presets"
  aria-rowcount={Math.ceil(presets.length / cols)}
  aria-colcount={cols}
>
  {rows.map((row, rowIndex) => (
    <div key={rowIndex} role="row" aria-rowindex={rowIndex + 1}>
      {row.map((preset, colIndex) => (
        <div
          key={preset.id}
          role="gridcell"
          aria-colindex={colIndex + 1}
          tabIndex={isActive(rowIndex, colIndex) ? 0 : -1}
          aria-label={`${preset.name}. ${preset.description}. ${preset.tokenCount} tokens.`}
        >
          <PresetCard preset={preset} />
        </div>
      ))}
    </div>
  ))}
</div>
```

**Tree View (Token Hierarchy):**
```tsx
// Tree pattern for nested token groups
<ul role="tree" aria-label="Token categories">
  {categories.map((category) => (
    <li
      key={category.id}
      role="treeitem"
      aria-expanded={expanded.has(category.id)}
      aria-level={1}
      aria-setsize={categories.length}
      aria-posinset={category.index + 1}
    >
      <button
        onClick={() => toggleExpand(category.id)}
        aria-label={`${category.name}, ${category.tokens.length} tokens, ${expanded.has(category.id) ? 'expanded' : 'collapsed'}`}
      >
        {category.name}
      </button>
      {expanded.has(category.id) && (
        <ul role="group">
          {category.tokens.map((token, i) => (
            <li
              key={token.id}
              role="treeitem"
              aria-level={2}
              aria-setsize={category.tokens.length}
              aria-posinset={i + 1}
            >
              {token.name}: {token.value}
            </li>
          ))}
        </ul>
      )}
    </li>
  ))}
</ul>
```

**Tab Panel with Editor Content:**
```tsx
<div role="tablist" aria-label="Design system editors">
  <button
    role="tab"
    id="tab-colors"
    aria-selected={activeTab === 'colors'}
    aria-controls="panel-colors"
    tabIndex={activeTab === 'colors' ? 0 : -1}
  >
    Colors
  </button>
  <button
    role="tab"
    id="tab-typography"
    aria-selected={activeTab === 'typography'}
    aria-controls="panel-typography"
    tabIndex={activeTab === 'typography' ? 0 : -1}
  >
    Typography
  </button>
</div>

<div
  role="tabpanel"
  id="panel-colors"
  aria-labelledby="tab-colors"
  tabIndex={0}
  hidden={activeTab !== 'colors'}
>
  {/* Color editor content */}
</div>
```

---

## Live Regions for Async Updates

Live regions announce dynamic content changes to screen readers without moving focus.

### Polite vs Assertive

| Type | Use When | `aria-live` Value |
|------|----------|-------------------|
| **Polite** | Non-urgent status updates | `"polite"` |
| **Assertive** | Errors, time-sensitive alerts | `"assertive"` |

**Rule:** Default to `polite`. Use `assertive` only for errors and critical alerts.

### Status Announcer Component

Create a reusable announcer for Preset:

```tsx
// components/ui/status-announcer.tsx
import { useEffect, useRef, useState } from 'react';

interface StatusAnnouncerProps {
  message: string;
  priority?: 'polite' | 'assertive';
}

export function StatusAnnouncer({ message, priority = 'polite' }: StatusAnnouncerProps) {
  // Use a ref to avoid re-rendering the container
  // Clear and re-set message to ensure AT announces repeated identical messages
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    if (message) {
      setAnnounced('');
      // Small delay ensures AT detects the change
      const timer = setTimeout(() => setAnnounced(message), 100);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      role={priority === 'assertive' ? 'alert' : 'status'}
      className="sr-only"
    >
      {announced}
    </div>
  );
}
```

### Preset-Specific Live Region Examples

**Sync Status:**
```tsx
// When design system syncs with source
<StatusAnnouncer
  message={
    syncStatus === 'syncing' ? 'Syncing design system...' :
    syncStatus === 'success' ? 'Design system synced successfully' :
    syncStatus === 'error' ? `Sync failed: ${errorMessage}` :
    ''
  }
  priority={syncStatus === 'error' ? 'assertive' : 'polite'}
/>
```

**Drift Detection:**
```tsx
// When drift scan completes
<StatusAnnouncer
  message={`Drift scan complete. ${driftCount} issues found. Health score: ${score} percent.`}
  priority="polite"
/>
```

**Token Import:**
```tsx
// During import flow
<StatusAnnouncer
  message={
    importStatus === 'parsing' ? `Parsing ${fileName}...` :
    importStatus === 'complete' ? `Import complete. ${added} tokens added, ${conflicts} conflicts.` :
    importStatus === 'error' ? `Import failed: ${errorMessage}` :
    ''
  }
  priority={importStatus === 'error' ? 'assertive' : 'polite'}
/>
```

**Connection Test (MCP):**
```tsx
// When testing MCP connection
<StatusAnnouncer
  message={
    testStatus === 'testing' ? 'Testing connection...' :
    testStatus === 'success' ? 'Connection test passed' :
    testStatus === 'error' ? `Connection failed: ${errorMessage}` :
    ''
  }
  priority={testStatus === 'error' ? 'assertive' : 'polite'}
/>
```

**Save Confirmation:**
```tsx
// After saving any configuration
<StatusAnnouncer message="Changes saved" priority="polite" />
```

**Search Results:**
```tsx
// When search/filter results update
<StatusAnnouncer
  message={`${resultCount} ${resultCount === 1 ? 'result' : 'results'} found`}
  priority="polite"
/>
```

### Loading States

For loading states, announce the transition:

```tsx
// Announce loading start and completion
{isLoading && (
  <StatusAnnouncer message="Loading design tokens..." priority="polite" />
)}
{!isLoading && wasLoading && (
  <StatusAnnouncer message={`${tokens.length} tokens loaded`} priority="polite" />
)}
```

---

## Descriptive Labels for Color Tokens

Color tokens are the most common element in Preset. They require special attention because color information is inherently visual.

### Color Swatch Labels

```tsx
// CORRECT - Full descriptive label
<div className="flex items-center gap-3">
  <span
    className="h-6 w-6 rounded border border-border flex-shrink-0"
    style={{ backgroundColor: token.value }}
    aria-hidden="true"  // Decorative; info conveyed by text
  />
  <div>
    <span className="text-sm font-medium">{token.name}</span>
    <span className="text-xs text-muted-foreground ml-2">{token.value}</span>
  </div>
</div>

// WRONG - No text, color only
<span
  className="h-6 w-6 rounded"
  style={{ backgroundColor: token.value }}
  title={token.name}  // title is not reliably announced
/>
```

### Color Picker Accessibility

```tsx
// Accessible color picker input
<div>
  <Label htmlFor="color-hex">Color value</Label>
  <div className="flex items-center gap-2">
    <span
      className="h-8 w-8 rounded border border-border"
      style={{ backgroundColor: hexValue }}
      aria-hidden="true"
    />
    <Input
      id="color-hex"
      value={hexValue}
      onChange={handleHexChange}
      placeholder="#000000"
      aria-describedby="color-hex-help"
      pattern="^#[0-9A-Fa-f]{6}$"
      aria-invalid={!isValidHex}
    />
  </div>
  <p id="color-hex-help" className="text-xs text-muted-foreground mt-1">
    Enter a 6-digit hex color code (e.g., #3B82F6)
  </p>
</div>
```

### Color Palette Display

```tsx
// Accessible color palette
<div role="list" aria-label="Color palette: Brand colors">
  {palette.map((color) => (
    <div key={color.id} role="listitem">
      <div className="flex items-center gap-2">
        <span
          className="h-10 w-10 rounded border border-border"
          style={{ backgroundColor: color.value }}
          aria-hidden="true"
        />
        <div>
          <div className="text-sm font-medium">{color.name}</div>
          <div className="text-xs text-muted-foreground">{color.value}</div>
          {color.contrastRatio && (
            <div className="text-xs text-muted-foreground">
              Contrast: {color.contrastRatio}:1
              {color.contrastRatio >= 4.5 ? ' (AA pass)' : ' (AA fail)'}
            </div>
          )}
        </div>
      </div>
    </div>
  ))}
</div>
```

---

## Table Accessibility

### Token Tables

```tsx
<table>
  <caption className="sr-only">
    {category} design tokens. {tokens.length} tokens.
  </caption>
  <thead>
    <tr>
      <th scope="col" aria-sort={sortCol === 'name' ? sortDir : 'none'}>
        <button
          onClick={() => handleSort('name')}
          aria-label={`Sort by name, currently ${sortCol === 'name' ? sortDir : 'unsorted'}`}
        >
          Name
        </button>
      </th>
      <th scope="col">Value</th>
      <th scope="col">Preview</th>
      <th scope="col">
        <span className="sr-only">Actions</span>
      </th>
    </tr>
  </thead>
  <tbody>
    {tokens.map((token) => (
      <tr key={token.id}>
        <td className="font-mono text-sm">{token.name}</td>
        <td className="text-sm text-muted-foreground">{token.value}</td>
        <td>
          <span
            className="inline-block h-4 w-4 rounded border border-border"
            style={{ backgroundColor: token.value }}
            aria-label={`Color preview: ${token.value}`}
          />
        </td>
        <td>
          <button aria-label={`Edit ${token.name}`}>Edit</button>
          <button aria-label={`Delete ${token.name}`}>Delete</button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### Drift Report Tables

```tsx
<table>
  <caption className="sr-only">
    Drift report. {issues.length} issues found.
  </caption>
  <thead>
    <tr>
      <th scope="col">Status</th>
      <th scope="col">Component</th>
      <th scope="col">Issue</th>
      <th scope="col">Severity</th>
      <th scope="col">
        <span className="sr-only">Actions</span>
      </th>
    </tr>
  </thead>
  <tbody>
    {issues.map((issue) => (
      <tr key={issue.id}>
        <td>
          {/* Color dot + text, never color alone */}
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${severityColor(issue.severity)}`}
              aria-hidden="true"
            />
            <span>{issue.status}</span>
          </span>
        </td>
        <td>{issue.component}</td>
        <td>{issue.description}</td>
        <td>
          <span aria-label={`Severity: ${issue.severity}`}>
            {issue.severity}
          </span>
        </td>
        <td>
          <button aria-label={`Fix ${issue.component}: ${issue.description}`}>
            Fix
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## Form Patterns

### Design System Settings Form

```tsx
<form aria-label="Design system settings" onSubmit={handleSubmit}>
  {/* Text input */}
  <div>
    <Label htmlFor="ds-name">
      Design system name <span aria-hidden="true">*</span>
      <span className="sr-only">(required)</span>
    </Label>
    <Input
      id="ds-name"
      required
      aria-required="true"
      aria-invalid={!!errors.name}
      aria-describedby={errors.name ? 'ds-name-error' : 'ds-name-help'}
    />
    <p id="ds-name-help" className="text-xs text-muted-foreground mt-1">
      The display name for your design system
    </p>
    {errors.name && (
      <p id="ds-name-error" className="text-sm text-destructive mt-1" role="alert">
        {errors.name}
      </p>
    )}
  </div>

  {/* Select */}
  <div>
    <Label htmlFor="ds-framework">Framework</Label>
    <Select aria-label="Select framework">
      <SelectTrigger id="ds-framework">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="react">React</SelectItem>
        <SelectItem value="vue">Vue</SelectItem>
        <SelectItem value="angular">Angular</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <Label htmlFor="ds-enforce">Enforce tokens</Label>
      <p id="ds-enforce-help" className="text-xs text-muted-foreground">
        Block non-token values in code review
      </p>
    </div>
    <Switch
      id="ds-enforce"
      aria-describedby="ds-enforce-help"
      checked={enforce}
      onCheckedChange={setEnforce}
    />
  </div>

  <Button type="submit">Save settings</Button>
</form>
```

### MCP Connection Form

```tsx
<form aria-label="MCP server connection" onSubmit={handleConnect}>
  <div>
    <Label htmlFor="mcp-url">Server URL</Label>
    <Input
      id="mcp-url"
      type="url"
      placeholder="https://mcp.example.com"
      aria-invalid={!!errors.url}
      aria-describedby={errors.url ? 'url-error' : 'url-help'}
    />
    <p id="url-help" className="text-xs text-muted-foreground mt-1">
      The URL of your MCP server endpoint
    </p>
    {errors.url && (
      <p id="url-error" role="alert" className="text-sm text-destructive mt-1">
        {errors.url}
      </p>
    )}
  </div>

  <div className="flex gap-2">
    <Button type="button" variant="outline" onClick={handleTest}>
      Test Connection
    </Button>
    <Button type="submit">Connect</Button>
  </div>

  {/* Connection test result - live region */}
  <StatusAnnouncer
    message={testResult ? `Connection test ${testResult.status}: ${testResult.message}` : ''}
    priority={testResult?.status === 'error' ? 'assertive' : 'polite'}
  />
</form>
```

---

## Screen Reader Testing Checklist

### VoiceOver (macOS)

| Action | Expected | Check |
|--------|----------|-------|
| VO + Right Arrow through page | All content announced in logical order | |
| VO + U (rotor) | Headings, links, landmarks listed correctly | |
| Tab through interactive elements | Focus visible, role announced, state announced | |
| Interact with color swatches | Color name and hex value announced | |
| Open/close modal | Focus trapped, modal announced, focus restored | |
| Trigger async action | Live region announces status change | |
| Navigate token table | Headers, cells, and row context announced | |

### NVDA (Windows)

| Action | Expected | Check |
|--------|----------|-------|
| Browse mode (arrow keys) | All content readable in order | |
| Tab mode | All interactive elements reachable | |
| H key | Jump between headings | |
| T key | Jump to tables, headers announced | |
| Forms mode | Labels, errors, descriptions announced | |
| Live regions | Status changes announced without focus move | |

### Common Gotchas

| Issue | Screen Reader | Fix |
|-------|--------------|-----|
| `title` attribute not announced | VoiceOver, NVDA | Use `aria-label` or visible text instead |
| `placeholder` used as label | All | Add proper `<label>` element |
| CSS `content` not announced | Some | Don't use CSS for meaningful content |
| `display: none` hides from AT | All | Use `sr-only` class instead for visually hidden but AT-accessible content |
| `aria-hidden="true"` on parent | All | Hides all children from AT -- use carefully |
| Dynamic content not announced | All | Use `aria-live` regions for updates |
| Too many live region updates | All | Debounce frequent updates (e.g., search as you type) |

---

## Utility Classes

### sr-only (Screen Reader Only)

Content visible only to screen readers:

```tsx
// Tailwind's sr-only class
<span className="sr-only">Additional context for screen readers</span>

// Make visible on focus (for skip links)
<a className="sr-only focus:not-sr-only">Skip to content</a>
```

### Use Cases in Preset

| Use Case | Pattern |
|----------|---------|
| Table caption | `<caption className="sr-only">Token list</caption>` |
| Action column header | `<th><span className="sr-only">Actions</span></th>` |
| Required field indicator | `<span className="sr-only">(required)</span>` |
| Status dot context | `<span className="sr-only">Status: connected</span>` |
| Icon button label | Prefer `aria-label` on button instead |
| Decorative separator | Mark with `aria-hidden="true"` |
