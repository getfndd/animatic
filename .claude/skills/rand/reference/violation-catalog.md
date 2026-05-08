# Violation Catalog

Searchable catalog of design system violations. Each entry has: Pattern, Rule, Fix, Tier.

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

### Zinc Usage
- **Tier**: Blocking
- **Pattern**: Any `zinc-*` class (`bg-zinc-*`, `text-zinc-*`, `border-zinc-*`, `ring-zinc-*`)
- **Rule**: Never use `zinc`. Use semantic tokens instead.
- **Fix**: Map to semantic equivalents (see Raw Tailwind Color Classes above)

### Gradients in UI Chrome
- **Tier**: Blocking
- **Pattern**: `bg-gradient-to-r`, `bg-gradient-to-l`, `bg-gradient-to-b`, `bg-gradient-to-t` in editor/studio pages
- **Rule**: No gradients in application chrome. Gradients are for marketing pages only.
- **Fix**: Replace with flat color (`bg-muted`, `bg-foreground`, or `bg-background`)

### Colored Icon Containers
- **Tier**: Blocking
- **Pattern**: `bg-indigo-*`, `bg-blue-500/10`, `bg-purple-*`, `bg-violet-*`, `bg-pink-*` wrapping icons for feature representation
- **Rule**: Icon containers use neutral styling only
- **Fix**: Replace with `bg-muted`

### Brand Color Misuse
- **Tier**: Warning
- **Pattern**: Moss (#5a6e66, #728d82), Terra (#8b4d3d, #a15e4b), Kasuri (#1e3a5f, #2d5580) used for generic UI elements
- **Rule**: Brand colors are reserved for strategic brand emphasis
- **Fix**: Use semantic tokens for generic UI. Reserve brand colors for intentional brand moments.

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

### Card Shadows in Editor Pages
- **Tier**: Blocking
- **Pattern**: `shadow-md`, `shadow-lg`, `shadow-xl` in studio/editor page components
- **Rule**: Editor pages use flat design. No shadows on content cards.
- **Fix**: Replace shadow with `border border-border`

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

### Thick Focus Ring
- **Tier**: Blocking
- **Pattern**: `ring-2` on interactive elements
- **Rule**: Focus rings use `ring-1` for subtlety
- **Fix**: Replace with `focus:outline-none focus:ring-1 focus:ring-foreground/50 focus:ring-offset-1`

### Colored Focus Ring
- **Tier**: Blocking
- **Pattern**: `ring-blue-500`, `ring-indigo-500`, `ring-purple-500` or any non-semantic focus ring color
- **Rule**: Focus rings use semantic `foreground` token
- **Fix**: Replace with `ring-foreground/50`

### Full Opacity Focus Ring
- **Tier**: Warning
- **Pattern**: `ring-foreground` without opacity modifier (no `/50`)
- **Rule**: Focus rings use 50% opacity for softness
- **Fix**: Replace `ring-foreground` with `ring-foreground/50`

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

## Museum Principle Violations

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

---

## Motion / Accessibility Violations

### Reduced Motion Fallback Missing — Recipe (motion/requires-reduced-motion-fallback)
- **Tier**: Blocking
- **Pattern**: Recipe in `catalog/motion-recipes.json` missing `accessibility_fallback.reduced_motion` (or any required field inside it: `from`, `to`, `differentiation`)
- **Rule**: Every motion recipe must ship a reduced-motion variant. Schema requires it; the validator surfaces the same error at the Rand gate.
- **Fix**: Add the fallback. For opacity+transform recipes, opacity-only is usually correct:
  ```json
  "accessibility_fallback": {
    "reduced_motion": {
      "from": { "opacity": 0 },
      "to": { "opacity": 1 },
      "differentiation": "Opacity-only fade preserves the enter signal; translation removed so vestibular users are not affected."
    }
  }
  ```

### Reduced Motion Fallback Missing — Composition (motion/requires-reduced-motion-fallback)
- **Tier**: Blocking
- **Pattern**: `.tsx`/`.jsx` file imports `framer-motion` or `motion/react` and uses `<motion.X>` / `useAnimate()` / spring-typed variants, but does NOT call `useReducedMotion()`, `useMotionRecipe()`, or define a `reduced` variant key
- **Rule**: Custom motion compositions must declare reduced-motion behavior. Routing through `useMotionRecipe()` inherits the recipe's fallback automatically; inline variants must opt in explicitly.
- **Fix**: Either route through `useMotionRecipe('enter.fade-up')` (recipe handles fallback) or:
  ```tsx
  import { motion, useReducedMotion } from 'framer-motion';
  const reduced = useReducedMotion();
  return <motion.div animate={{ y: reduced ? 0 : -20, opacity: 1 }} />;
  ```

### Reduced Motion Fallback Missing — CSS (motion/requires-reduced-motion-fallback)
- **Tier**: Warning
- **Pattern**: CSS file containing `@keyframes` or `animation:` declarations with no `@media (prefers-reduced-motion: reduce)` query in the same file
- **Rule**: CSS animations need a reduced-motion override. Warning only — some files legitimately define keyframes consumed elsewhere.
- **Fix**: Add a sibling query:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .animated { animation: none; transition: none; }
  }
  ```
  Or, if the file is a pure keyframe library, silence with: `/* rand-disable motion/requires-reduced-motion-fallback: keyframe library consumed elsewhere */`

### Per-File Disable Mechanism

Any file may silence the rule with a comment containing a required reason:

- JS/TSX: `// rand-disable motion/requires-reduced-motion-fallback: <reason>`
- CSS: `/* rand-disable motion/requires-reduced-motion-fallback: <reason> */`

Disabled files appear in the Rand report with their reason so reviewers can audit. Use sparingly; legitimate cases include decorative loading spinners, keyframe-only library files, and Framer Motion usage inside Remotion compositions (rendered to MP4, not live web).

### Validator

Programmatic check: `npm run rand:motion-a11y` (or `node scripts/rand-motion-a11y.mjs`). Returns exit code 1 on any blocking violation; warnings do not block. The validator lives in `mcp/lib/rand-motion-a11y.js` and can be imported by other Rand-enabled repos via `import { checkProject } from 'animatic/mcp/lib/rand-motion-a11y.js'`.

References: ANI-138, [WCAG 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html), Recipe contract from ANI-134.
