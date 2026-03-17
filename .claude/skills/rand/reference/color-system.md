# Color System Reference

Complete color reference for Rand enforcement. All UI styling must use semantic tokens. Raw Tailwind color scales and hardcoded hex values are violations.

---

## Semantic Tokens (Light Mode)

| Token | HSL Value | Hex Approx | Usage |
|-------|-----------|------------|-------|
| `--background` | 0 0% 100% | #ffffff | Page background |
| `--foreground` | 0 0% 3.9% | #0a0a0a | Primary text, primary buttons |
| `--card` | 0 0% 100% | #ffffff | Card backgrounds |
| `--card-foreground` | 0 0% 3.9% | #0a0a0a | Card text |
| `--muted` | 0 0% 96.1% | #f5f5f5 | Muted backgrounds, chrome, containers |
| `--muted-foreground` | 0 0% 45.1% | #737373 | Secondary text, labels, descriptions |
| `--border` | 0 0% 89.8% | #e5e5e5 | Borders, dividers |
| `--primary` | 0 0% 9% | #171717 | Primary actions |
| `--primary-foreground` | 0 0% 98% | #fafafa | Text on primary |
| `--destructive` | 0 84.2% 60.2% | #ef4444 | Destructive actions |
| `--accent` | 0 0% 96.1% | #f5f5f5 | Accent backgrounds |
| `--accent-foreground` | 0 0% 9% | #171717 | Accent text |

---

## Semantic Tokens (Dark Mode)

| Token | HSL Value | Hex Approx | Usage |
|-------|-----------|------------|-------|
| `--background` | 0 0% 9% | #171717 | Page background |
| `--foreground` | 0 0% 98% | #fafafa | Primary text |
| `--card` | 0 0% 13% | #222222 | Card backgrounds |
| `--card-foreground` | 0 0% 98% | #fafafa | Card text |
| `--muted` | 0 0% 15% | #262626 | Muted backgrounds, chrome |
| `--muted-foreground` | 0 0% 65% | #a6a6a6 | Secondary text |
| `--border` | 0 0% 17% | #2b2b2b | Borders |
| `--primary` | 0 0% 98% | #fafafa | Primary actions |
| `--primary-foreground` | 0 0% 9% | #171717 | Text on primary |

---

## Tailwind Class Mapping

Use these semantic classes instead of raw Tailwind colors:

| Instead Of | Use |
|------------|-----|
| `bg-white` | `bg-background` |
| `bg-black` | `bg-foreground` |
| `bg-gray-50`, `bg-zinc-50`, `bg-slate-50` | `bg-muted` |
| `bg-gray-100`, `bg-zinc-100` | `bg-muted` |
| `bg-gray-900`, `bg-zinc-900` | `bg-foreground` |
| `text-black` | `text-foreground` |
| `text-white` | `text-background` |
| `text-gray-500`, `text-zinc-500` | `text-muted-foreground` |
| `text-gray-900`, `text-zinc-900` | `text-foreground` |
| `border-gray-200`, `border-zinc-200` | `border-border` |
| `border-gray-300`, `border-zinc-300` | `border-border` |

---

## Brand Colors (Strategic Use Only)

Brand colors are reserved for strategic brand emphasis. They must NOT be used for generic UI elements, links, buttons, or feature styling.

### Moss (Operations)
| Variant | Hex | Usage |
|---------|-----|-------|
| Dark | #5a6e66 | Text on light backgrounds |
| Medium | #728d82 | Borders, accents |
| Light | #d4e0dc | Subtle backgrounds |

### Terra (People)
| Variant | Hex | Usage |
|---------|-----|-------|
| Dark | #8b4d3d | Text on light backgrounds |
| Medium | #a15e4b | Borders, accents |
| Light | #e8d6d1 | Subtle backgrounds |

### Kasuri (Brand)
| Variant | Hex | Usage |
|---------|-----|-------|
| Dark | #1e3a5f | Text on light backgrounds |
| Medium | #2d5580 | Borders, accents |
| Light | #a3b8d6 | Subtle backgrounds |

**Allowed uses:**
- Brand callouts in marketing pages
- Strategic emphasis in onboarding
- Brand identity elements (logos, brand marks)

**Prohibited uses:**
- Generic UI backgrounds
- Button colors
- Link colors
- AI feature styling
- Icon container colors
- Status indicators

---

## Status Colors

Standard status colors for indicators, badges, and feedback.

### Status Dots
Small circular indicators (`h-2 w-2 rounded-full`):

| Status | Class |
|--------|-------|
| Success | `bg-emerald-500` |
| Error | `bg-red-500` |
| Warning | `bg-amber-500` |
| Info | `bg-blue-500` |

### Status Badges
Pill-shaped labels with background and text:

| Status | Background | Text |
|--------|------------|------|
| Success | `bg-emerald-500/10` | `text-emerald-600` |
| Error | `bg-destructive/10` | `text-destructive` |
| Warning | `bg-amber-500/10` | `text-amber-600` |
| Info | `bg-blue-500/10` | `text-blue-600` |

---

## AI Gradient (Marketing Only)

The AI gradient (indigo to purple to pink) is reserved exclusively for marketing surfaces.

```css
/* Marketing pages ONLY */
bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
```

**Allowed:**
- Landing page hero section
- Marketing feature highlights
- Brand moments in external-facing pages

**Prohibited:**
- Editor pages
- Studio pages
- Settings pages
- Any application chrome
- AI feature buttons in the app
- AI section containers in the app

---

## Enforcement Summary

| Color Type | Tier | Rule |
|------------|------|------|
| Hardcoded hex in styles | Blocking | Use semantic token |
| Raw Tailwind scales (zinc, gray, slate, neutral) | Blocking | Use semantic token |
| Gradients in app chrome | Blocking | Use flat color |
| Colored feature containers | Blocking | Use `bg-muted` |
| Brand colors for generic UI | Warning | Reserve for strategic emphasis |
| Non-standard status colors | Warning | Use standard status palette |
