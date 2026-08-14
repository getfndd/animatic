---
name: concept-rules
fidelity: concept
scope: portable
version: 1
---

# Concept Fidelity Rules

Visual direction testing. Token discipline enforced. Component design flexible.

At **concept fidelity**, you may invent new components and layouts. You may **not** break the token system. Every prototype must be fully grounded in the palette resolved for *this* project.

## The organizing principle

**Conform to the palette that is defined. Do not bring one.**

These rules constrain how colour is used; they never say which colours exist. That is the project's call, and it is resolved in this order:

1. The project adapter's `semantic_tokens` (`_adapters/{project}.md`)
2. Inferred from the project — an existing tokens file, Tailwind theme, or CSS custom properties already in the repo
3. The achromatic placeholders in `templates/_tokens.css`

If you reached step 2 or 3, say so on the page with `.palette-notice`. Inference can pick up a stale or half-migrated palette, and a silent pickup is indistinguishable from a deliberate choice.

A project whose defined palette is *neutrals only* is conforming, not unfinished — restraint is a definition like any other. But that has to come from the project's definition, not from the prototype skill's defaults.

Organizing word: **atelier × laboratory × studio** — crafted, instrumented, working space.

## Palette rules

**USE** (via semantic tokens, not raw scale):

```
--surface, --surface-2, --surface-raised
--ink, --ink-soft, --ink-quiet, --ink-faint, --ink-ghost
--rule, --rule-strong
```

**USE sparingly** (status only, never as accents):

```
--success-600, --error-600, --warning-600
```

**BANNED**:

- No colour from outside the project's resolved palette — including a palette borrowed from a sibling product, a previous client, or this skill's own placeholders
- No raw hex codes in component styles (all colors must resolve through tokens)
- No Tailwind color utility classes (`text-blue-500`, `bg-emerald-100`, etc.)
- No custom gradients
- No colored shadows
- No neon / saturated accents

## Typography rules

**Fonts**: whatever the project's resolved palette defines, held in `--font-sans` / `--font-mono` / `--font-display`. Reference the variables, never a family name — that is what makes a swap a one-line change instead of a find-and-replace.

If the palette resolved to placeholders, that is a system stack. Do not reach for a webfont to make an unadapted prototype look finished; declare the gap with `.palette-notice` instead.

**Role-based scale** (use tokens, not raw numbers):

| Role | Token basis | When to use |
|---|---|---|
| Display | `--type-display-*` | Hero headlines only, one per page |
| H1 | `--type-h1-*` | Page-level titles |
| H2 | `--type-h2-*` | Section headings |
| Body | `--type-body-*` | Default paragraph |
| Body lg | `--type-body-lg-*` | Answer text, synthesis body |
| Meta | `--type-meta-*` | Mono uppercase labels, kickers, badges |
| Meta sm | `--type-meta-sm-*` | Very small labels |
| Mono data | `--type-mono-data-*` | Numbers, timestamps, IDs, technical values |

**Typographic laws**:

- Every numeric data point (count, %, currency, timestamp, duration, ID, hash) uses `--font-mono`
- Every label or kicker above a heading uses `--font-mono`, uppercase
- Hero headlines use `text-wrap: balance`
- Body paragraphs use `text-wrap: pretty`
- Never ALL CAPS except in mono micro-labels
- Never mix sans weights heavier than necessary — prefer 400 → 500 → 700 progression

## Motion rules

Three tiers only. Durations from tokens.

| Tier | Enter | Exit | When |
|---|---|---|---|
| 1 (feedback) | `--dur-tier1` (140ms) | same | Hover, press, focus |
| 2 (structural) | `--dur-tier2-in` (200ms) | `--dur-tier2-out` (160ms) | Modals, page transitions, content swaps |
| 3 (spatial) | `--dur-tier3-in` (250ms) | `--dur-tier3-out` (200ms) | Drawers, slide-ins, large panels |

**Easing laws**:

- `--ease-out` for arrivals
- `--ease-in` for departures
- **Never** `ease-in-out` — it's decorative, not intentional
- Never bouncy / elastic
- Never longer than 300ms for any transition
- Always respect `prefers-reduced-motion`

## Spacing rules

Use the 8-based rhythm via tokens: `--space-1` (4px) through `--space-24` (96px). Never arbitrary values. Never odd numbers outside the 4-based sequence.

## Radius rules

Only three values:

- `--radius-sm` (2px) — pills, chips, small tags
- `--radius-md` (6px) — cards, panels, inputs
- `--radius-full` — buttons, dots, organic shapes

No `rounded-xl`, no `rounded-2xl`, no custom radii.

## Dark mode rules

**Every prototype must work in both light and dark mode.**

Implementation: use semantic tokens (`--surface`, `--ink`, etc.), never raw `--ink-*` scale values in components. The `@media (prefers-color-scheme: dark)` block in tokens.css swaps the semantic tokens automatically.

When reviewing a prototype, open it, then toggle your OS to dark mode and verify it still reads correctly. Both states are required; "will do dark mode later" is not acceptable at concept fidelity.

## Component freedom vs token discipline

At **concept** fidelity:

- ✅ You may invent new components (cards, panels, citation widgets, gesture studies)
- ✅ You may arrange them in any layout that serves the idea
- ✅ You may try multiple variations of the same component
- ❌ You may not use raw hex or Tailwind color classes
- ❌ You may not add brand colors
- ❌ You may not add a typeface the project's palette does not define

At **spec** fidelity, stricter rules apply — components must be production presets. That's a future concern.

## Metadata requirement

Every generated prototype must have a `meta.json` in its folder listing:

```json
{
  "id": "2026-04-11-{project}-gesture-number",
  "name": "Gesture study: the number",
  "description": "Mono-data as the visual heartbeat of the portal",
  "fidelity": "concept",
  "chrome": "none",
  "tokens_used": [
    "--font-mono", "--ink", "--ink-quiet", "--type-mono-data-*"
  ],
  "dark_mode_tested": true,
  "reduced_motion_tested": true,
  "created_at": "2026-04-11T..."
}
```

## Validation checklist (run before sharing)

- [ ] Opens cleanly in a browser (no console errors, no 404s on fonts)
- [ ] Works in light mode
- [ ] Works in dark mode (toggle OS setting)
- [ ] `prefers-reduced-motion: reduce` doesn't break layout
- [ ] No raw hex codes in the CSS (all tokens)
- [ ] No brand colors
- [ ] Typography roles match the scale above
- [ ] `meta.json` exists and lists tokens used
