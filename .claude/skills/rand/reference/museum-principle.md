# Museum Principle

**The UI is the frame. The user's work is the art.**

In editor and studio pages (Colors, Typography, Icons, Spacing, etc.), the user's configuration and preview should be the visual hero. Our chrome recedes. Their work advances.

---

## Core Rules

### 1. Chrome Recedes, Content Advances

The application UI (navigation, controls, settings panels) should use neutral, subdued styling. The user's work (previews, configurations, outputs) gets visual prominence.

```tsx
// CORRECT - Chrome uses muted styling
<div className="bg-muted text-muted-foreground p-4 rounded-lg">
  <h3 className="text-sm font-medium">Settings</h3>
  {/* controls */}
</div>

// INCORRECT - Chrome demands attention
<div className="bg-indigo-50 text-indigo-900 p-4 rounded-lg border border-indigo-200">
  <h3 className="text-lg font-bold text-indigo-800">Settings</h3>
  {/* controls */}
</div>
```

### 2. All Feature Paths Get Equal Weight

Manual configuration, import, and AI assistance are equally valid paths to the same goal. No path should be visually elevated above others.

```tsx
// CORRECT - Equal visual weight
<div className="flex gap-2">
  <Button variant="outline">Configure Manually</Button>
  <Button variant="outline">Import from File</Button>
  <Button variant="outline">Suggest with AI</Button>
</div>

// INCORRECT - AI path is visually elevated
<div className="flex gap-2">
  <Button variant="outline">Configure Manually</Button>
  <Button variant="outline">Import from File</Button>
  <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
    Suggest with AI
  </Button>
</div>
```

### 3. AI Features Use Standard Styling

AI-powered features integrate naturally. They do not demand attention with gradients, sparkle icons, or special colors.

```tsx
// CORRECT - Standard AI button
<Button className="bg-foreground text-background hover:bg-foreground/90">
  Suggest with AI
</Button>

// CORRECT - Subtle AI indicator
<div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-medium">
  AI
</div>

// INCORRECT - Gradient AI button
<Button className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
  Suggest with AI
</Button>

// INCORRECT - Sparkle icon AI treatment
<Button>
  <SparklesIcon className="text-purple-500" />
  Magic AI Feature
</Button>

// INCORRECT - Special colored border for AI sections
<div className="border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
  AI-powered suggestions
</div>
```

### 4. When in Doubt, Go Neutral

If you are unsure whether styling is appropriate, use `bg-muted` and `text-muted-foreground`. Neutral is always safe.

```tsx
// CORRECT - Neutral default
<div className="bg-muted text-muted-foreground rounded-lg p-3">
  <span className="text-sm font-medium">Feature Label</span>
</div>

// INCORRECT - Colored default
<div className="bg-blue-50 text-blue-800 rounded-lg p-3">
  <span className="text-sm font-medium">Feature Label</span>
</div>
```

---

## Correct vs Incorrect Examples

### AI Buttons

```tsx
// CORRECT
<button className="bg-foreground text-background hover:bg-foreground/90 px-4 py-2 rounded-md text-sm font-medium">
  Suggest with AI
</button>

// INCORRECT
<button className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white px-4 py-2 rounded-md text-sm font-medium shadow-lg">
  ✨ Magic AI Feature
</button>
```

### AI Indicators

```tsx
// CORRECT - Text label in muted container
<div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
  <span className="text-xs font-medium text-muted-foreground">AI</span>
</div>

// INCORRECT - Icon in colored container
<div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
  <SparklesIcon className="w-4 h-4 text-purple-600" />
</div>
```

### Section Styling

```tsx
// CORRECT - Neutral border
<div className="rounded-lg border border-border p-4">
  <h2 className="text-sm font-medium text-muted-foreground">Token Configuration</h2>
  {/* content */}
</div>

// INCORRECT - Colored border
<div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
  <h2 className="text-sm font-medium text-indigo-700">Token Configuration</h2>
  {/* content */}
</div>
```

### Feature Cards (Equal Weight)

```tsx
// CORRECT - All paths equal
<div className="grid grid-cols-3 gap-4">
  <div className="rounded-lg border border-border p-4 hover:border-muted-foreground/50 transition-colors">
    <h3 className="text-sm font-medium">Manual</h3>
    <p className="text-xs text-muted-foreground">Configure by hand</p>
  </div>
  <div className="rounded-lg border border-border p-4 hover:border-muted-foreground/50 transition-colors">
    <h3 className="text-sm font-medium">Import</h3>
    <p className="text-xs text-muted-foreground">From CSS or JSON</p>
  </div>
  <div className="rounded-lg border border-border p-4 hover:border-muted-foreground/50 transition-colors">
    <h3 className="text-sm font-medium">AI Suggest</h3>
    <p className="text-xs text-muted-foreground">Generate from description</p>
  </div>
</div>

// INCORRECT - AI path highlighted
<div className="grid grid-cols-3 gap-4">
  <div className="rounded-lg border border-border p-4">
    <h3 className="text-sm font-medium">Manual</h3>
  </div>
  <div className="rounded-lg border border-border p-4">
    <h3 className="text-sm font-medium">Import</h3>
  </div>
  <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-4 shadow-md">
    <h3 className="text-sm font-medium text-purple-800">AI Suggest ✨</h3>
    <span className="text-xs text-purple-600">Recommended</span>
  </div>
</div>
```

---

## Pre-Ship Checklist

Before shipping any feature in an editor or studio page:

- [ ] Does this styling draw attention to the tool or the user's work?
- [ ] If we removed all special styling, would the feature still be discoverable?
- [ ] Are we designing for our excitement or user goals?
- [ ] Does every path to the goal get equal visual weight?

---

## Exceptions

The Museum principle applies to **editor and studio pages** — surfaces where users configure and preview their design system.

The following are **exempt** from Museum enforcement:

| Exempt Surface | Reason |
|----------------|--------|
| Marketing pages | Brand expression is the goal |
| Landing page hero | First impression, brand moment |
| Onboarding flows | Guided experience, not editor chrome |
| Brand callouts | Strategic emphasis by design |
| Color swatch previews | Showing user data, not chrome |

When in doubt, ask: "Is the user working here, or are we presenting to them?" If they are working, Museum applies. If we are presenting, it may not.
