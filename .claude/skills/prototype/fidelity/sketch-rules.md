---
name: sketch-rules
fidelity: sketch
scope: portable
---

# Sketch Fidelity Rules

**Purpose:** Rapid wireframing to explore layout and structure. No design
system — just grey boxes and system fonts.

Sketch is the one fidelity that deliberately ignores the project's palette.
That is not a licence to invent one: it means greyscale, so the output reads as
structure rather than as a proposal about colour. Raw hex is acceptable *here
and only here*, because there is no token system in play to route through.

## Colors
Only grayscale:
- `#fafafa` — lightest background
- `#f0f0f0` — card/section background
- `#e0e0e0` — borders, dividers
- `#9e9e9e` — secondary text
- `#616161` — primary text
- `#424242` — headings
- `#212121` — emphasis

## Typography
- System fonts only: `-apple-system, system-ui, sans-serif`
- Monospace: `ui-monospace, SFMono-Regular, monospace`
- Sizes: 12px, 14px, 16px, 20px, 24px
- Weights: 400, 500, 700

## Spacing
- 8px grid: 8, 16, 24, 32, 48, 64

## Components
- Rectangles with 1px #e0e0e0 borders
- No rounded corners larger than 4px
- No shadows
- No gradients
- No icons — use text labels

## Interactive States
- None required at sketch level

## DO
- Focus on layout and hierarchy
- Use placeholder text that matches real content length
- Show all major sections and content areas
- Use boxes for images/media

## DO NOT
- Use any brand colors
- Add hover/focus states
- Use custom fonts
- Add any decoration
