# Violation Catalog

Searchable catalog of design system violations. Each entry has: Pattern, Rule,
Fix, Tier.

## What this file owns, and what it does not

This catalog owns the **violation shapes** — the patterns worth grepping for and
why each is a violation. It does **not** own your palette, your tier
assignments, or your house style.

- **Concrete class and token names below are illustrative**, drawn from a
  Tailwind + semantic-token stack. `bg-muted` and `border-border` are the
  convention this catalog assumes, not a requirement it imposes. Substitute your
  own.
- **Tiers are the project's call.** A Blocking here means "this is usually worth
  blocking on"; the project's `adapters/{project}.md` decides what actually
  blocks a commit.
- **Brand colours, specific palette bans, and elevation doctrine belong in the
  adapter, not here.** A rule of the form "never use *this* scale" or "*our*
  editor pages are flat" is a project decision. Enforce it — from the adapter.
- **Where a rule touches accessibility, `@steve` is authoritative and this file
  is not.** Focus indicators in particular: aesthetic preferences about ring
  width and opacity lose to the contrast requirement every time.

---

## Color Violations

### Hardcoded Hex Colors
- **Tier**: Blocking
- **Pattern**: `style={{ color: '#` or `style={{ backgroundColor: '#` or `style="color: #` in JSX/TSX
- **Rule**: No hardcoded hex values in component styling
- **Fix**: Use semantic token (`text-foreground`, `bg-muted`, etc.)
- **Exception**: Color swatch previews showing user-configured data

### Raw Tailwind Color Classes
- **Tier**: Blocking
- **Pattern**: `bg-zinc-*`, `text-zinc-*`, `border-zinc-*`, `bg-gray-*`, `text-gray-*`, `bg-slate-*`, `text-slate-*`, `bg-neutral-*`, `text-neutral-*`
- **Rule**: No raw Tailwind color scales. Use semantic tokens only.
- **Fix**: Replace with semantic equivalents:
  - `bg-zinc-50` / `bg-gray-50` -> `bg-muted`
  - `bg-zinc-100` / `bg-gray-100` -> `bg-muted`
  - `bg-zinc-900` / `bg-gray-900` -> `bg-foreground`
  - `text-zinc-500` / `text-gray-500` -> `text-muted-foreground`
  - `text-zinc-900` / `text-gray-900` -> `text-foreground`
  - `border-zinc-200` / `border-gray-200` -> `border-border`

### Gradients in UI Chrome
- **Tier**: Blocking
- **Pattern**: `bg-gradient-to-r`, `bg-gradient-to-l`, `bg-gradient-to-b`, `bg-gradient-to-t` in application chrome
- **Rule**: No gradients in application chrome. Marketing surfaces are exempt —
  the distinction is app-vs-marketing, not any particular route naming.
- **Fix**: Replace with flat color (`bg-muted`, `bg-foreground`, or `bg-background`)

### Colored Icon Containers
- **Tier**: Blocking
- **Pattern**: `bg-indigo-*`, `bg-blue-500/10`, `bg-purple-*`, `bg-violet-*`, `bg-pink-*` wrapping icons for feature representation
- **Rule**: Icon containers use neutral styling only
- **Fix**: Replace with `bg-muted`

### Brand Color Misuse
- **Tier**: Warning
- **Pattern**: A named brand colour used for generic UI. The project's brand
  colours and their hex values are declared in `adapters/{project}.md` — read
  them from there; this catalog deliberately names none.
- **Rule**: Brand colours are reserved for intentional brand moments
- **Fix**: Use semantic tokens for generic UI

---

## Typography Violations

### Oversized Section Headers
- **Tier**: Warning
- **Pattern**: `text-xl`, `text-2xl`, `text-3xl` on section labels within editor/studio pages
- **Rule**: Section labels use `text-sm font-medium text-muted-foreground`
- **Fix**: Replace with `text-sm font-medium text-muted-foreground`

### ALL CAPS Text
- **Tier**: Warning
- **Pattern**: `uppercase tracking-wider` or `uppercase tracking-wide`
- **Rule**: Use sentence case. ALL CAPS creates visual noise.
- **Fix**: Remove `uppercase tracking-wider`. Use sentence case with `font-medium`.

### Wrong Muted Text
- **Tier**: Blocking
- **Pattern**: `text-gray-500`, `text-gray-400`, `text-zinc-500`, `text-zinc-400` for secondary text
- **Rule**: Use semantic muted token
- **Fix**: Replace with `text-muted-foreground`

### Bold Overuse
- **Tier**: Suggestion
- **Pattern**: `font-bold` on labels that are not page titles
- **Rule**: Labels use `font-medium`, not `font-bold`
- **Fix**: Replace `font-bold` with `font-medium`

---

## Component Violations

### Nested Cards
- **Tier**: Warning
- **Pattern**: `<Card>` component inside another `<Card>` component
- **Rule**: No card-in-card nesting. Flatten structure.
- **Fix**: Replace inner card with `<div className="rounded-lg border border-border p-4">`

### Elevation Inconsistent With the Project's Doctrine
- **Tier**: Project's call — see `adapters/{project}.md`
- **Pattern**: `shadow-md`, `shadow-lg`, `shadow-xl` on content surfaces
- **Rule**: Whether elevation is expressed with shadow or with borders is a
  project decision. Flag *inconsistency* with whichever the adapter declares,
  not shadow itself. A project with no declared doctrine has no violation here.
- **Fix**: Match the adapter. Where it prefers borders, `border border-border`

### Colored Status Icon Containers
- **Tier**: Warning
- **Pattern**: Icon wrapped in colored circle (e.g., `<div className="bg-green-100 rounded-full p-2"><CheckIcon className="text-green-600" /></div>`)
- **Rule**: Use status dots for status indication
- **Fix**: Replace with `<span className="h-2 w-2 rounded-full bg-emerald-500" />`

### Wrong Status Colors
- **Tier**: Warning
- **Pattern**: Custom or non-standard colors for status indicators
- **Rule**: Use standard status colors:
  - Success: `emerald-500` (dot), `emerald-500/10 bg + emerald-600 text` (badge)
  - Error: `red-500` (dot), `destructive` token (badge)
  - Warning: `amber-500` (dot), `amber-500/10 bg + amber-600 text` (badge)
  - Info: `blue-500` (dot)
- **Fix**: Replace with standard status color

---

## Interaction Violations

### Missing Hover State
- **Tier**: Warning
- **Pattern**: Clickable element (`<button>`, `<a>`, `onClick` handler) without any `hover:` class
- **Rule**: All interactive elements need visible hover feedback
- **Fix**: Add `hover:border-muted-foreground/50 transition-colors` or appropriate hover variant

### Missing Focus Indicator
- **Tier**: Blocking
- **Pattern**: `focus:outline-none` with no `focus-visible:` ring, outline, or
  other visible indicator replacing it
- **Rule**: Removing the default outline without substituting an indicator makes
  the element unreachable for keyboard users
- **Fix**: Add a `focus-visible:` indicator

### Non-Semantic Focus Ring Color
- **Tier**: Blocking
- **Pattern**: `ring-blue-500`, `ring-indigo-500`, `ring-purple-500` or any raw
  palette scale on a focus ring
- **Rule**: Focus rings use a semantic token so they follow the theme
- **Fix**: Replace with the project's semantic focus token

> **Ring width and opacity are not this file's call.** A project may prefer a
> thin, low-opacity ring, but that is house style and belongs in
> `adapters/{project}.md` — and it is subordinate to the contrast requirement.
> WCAG asks focus indicators to reach **3:1 against adjacent colours**; a
> narrowed or 50%-opacity ring frequently does not. Do not raise a violation for
> a ring being "too thick" or "too opaque". If a project's adapter mandates one,
> check the rendered indicator against 3:1 and defer to `@steve` — see
> `steve/reference/color-and-contrast.md` and `keyboard-and-focus.md`.

### Missing Transition
- **Tier**: Suggestion
- **Pattern**: `hover:` or `focus:` classes without `transition-colors` or `transition-all`
- **Rule**: State changes should animate smoothly
- **Fix**: Add `transition-colors` to the element

---

## Spacing Violations

### Borders as Separators
- **Tier**: Warning
- **Pattern**: `border-t` or `border-b` between content sections or between content and footer in dialogs/modals
- **Rule**: Let spacing alone create visual separation. Borders add visual noise.
- **Fix**: Remove border. Increase spacing between sections if needed.

### Over-Separated Content
- **Tier**: Suggestion
- **Pattern**: Multiple `border-t` or `<Separator>` components in close proximity
- **Rule**: Too many dividers create noise. Let whitespace create hierarchy.
- **Fix**: Remove dividers. Use varied spacing to create visual grouping.

---

## AI-Assumed Design Violations

Intelligence is infrastructure, not a feature to market. An AI-backed control
looks like every other control.

### AI Feature Gradient
- **Tier**: Blocking
- **Pattern**: `bg-gradient-to-*` combined with AI-related content (suggest, generate, magic, smart)
- **Rule**: AI features use standard styling, not gradients
- **Fix**: Replace with `bg-foreground text-background` or `variant="outline"`

### AI Feature Special Styling
- **Tier**: Blocking
- **Pattern**: `border-indigo-*`, `bg-indigo-*/5`, `from-indigo-*`, `text-purple-*` on AI feature sections
- **Rule**: AI features do not get special colored treatment
- **Fix**: Use `border-border`, `bg-muted`, `text-muted-foreground`

### Unequal Feature Path Weight
- **Tier**: Warning
- **Pattern**: One feature path (typically AI) with visually heavier styling (more color, larger size, "Recommended" badge) than sibling paths
- **Rule**: All paths to the same goal get equal visual weight
- **Fix**: Normalize all paths to same styling pattern
