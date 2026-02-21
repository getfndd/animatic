# Sketch Fidelity Rules

**Purpose:** Rapid layout exploration with zero design system dependency. Focus on structure, hierarchy, and content placement.

## Visual Constraints

### Colors
Use ONLY these grayscale values:
- `#f5f5f5` - Light background, containers
- `#e0e0e0` - Borders, dividers
- `#9e9e9e` - Secondary text, icons
- `#616161` - Primary text
- `#424242` - Headings, emphasis
- `#212121` - High contrast elements

**Never use:** Brand colors, status colors, gradients, shadows

### Typography
- Font family: `system-ui, -apple-system, sans-serif` (no custom fonts)
- Sizes: 12px, 14px, 16px, 20px, 24px, 32px only
- Weights: 400 (regular), 600 (semibold) only
- Line height: 1.5 for body, 1.2 for headings

### Spacing
Use 8px grid only:
- `8px`, `16px`, `24px`, `32px`, `48px`, `64px`
- No odd spacing values

### Components
Represent components as simple boxes:
- Buttons: Bordered rectangle with label
- Inputs: Bordered rectangle with placeholder
- Cards: Bordered rectangle with content
- Images: Gray rectangle with "x" or icon placeholder
- Icons: 16px or 24px gray squares

### Interactive States
- **No hover states**
- **No focus states**
- **No animations**
- Use dashed borders for "clickable" indication if needed

## Structure Rules

### Layout
- Use CSS Grid or Flexbox
- Clear visual hierarchy through size and position
- Generous whitespace
- Left-aligned text (no justified)

### Content
- Use real labels where known
- Use "Lorem ipsum" or "[Content]" for unknown text
- Use realistic data lengths
- Show edge cases (empty states, long text)

## Example

```html
<div style="border: 1px solid #e0e0e0; padding: 24px; max-width: 400px;">
  <div style="font-size: 20px; font-weight: 600; color: #424242; margin-bottom: 16px;">
    Form Title
  </div>

  <!-- Input placeholder -->
  <div style="border: 1px solid #e0e0e0; padding: 12px 16px; margin-bottom: 16px; color: #9e9e9e;">
    Email address
  </div>

  <!-- Input placeholder -->
  <div style="border: 1px solid #e0e0e0; padding: 12px 16px; margin-bottom: 24px; color: #9e9e9e;">
    Password
  </div>

  <!-- Button placeholder -->
  <div style="border: 1px solid #424242; padding: 12px 24px; text-align: center; color: #424242; font-weight: 600;">
    Sign In
  </div>
</div>
```

## DO NOT

- Use any design system tokens
- Use brand colors
- Add shadows or gradients
- Include hover/focus states
- Use custom fonts
- Add icons (use placeholders)
- Make it "look nice" - focus on structure

## Purpose of Sketch

Sketch fidelity is for:
1. Exploring layout options quickly
2. Validating information architecture
3. Testing content hierarchy
4. Discussing structure before committing to design
