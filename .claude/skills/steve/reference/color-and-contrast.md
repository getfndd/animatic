# Color & Contrast

Ratio requirements and colour-blind-safe pairing behind `@steve contrast`. Load when checking text-on-background pairs, focus indicators, or any status signalled by colour.

---

## WCAG Contrast Requirements

| Level | Normal Text (<18pt) | Large Text (>=18pt or >=14pt bold) | UI Components & Graphics |
|-------|--------------------|------------------------------------|--------------------------|
| **AA** (minimum) | 4.5:1 | 3:1 | 3:1 |
| **AAA** (enhanced) | 7:1 | 4.5:1 | Not defined |

---

## Color-Blind Safe Patterns

Never rely on color alone to convey meaning. Always pair color with at least one additional indicator:

| Color Signal | Required Pairing |
|-------------|------------------|
| Red = error | Red + error icon + error text |
| Green = success | Green + check icon + success text |
| Yellow = warning | Yellow + warning icon + warning text |
| Blue = info | Blue + info icon + info text |
| Status dots | Dot color + text label |
| Chart series | Color + pattern/texture + legend with text |

---

## Contrast Checking Process

1. Identify all text-on-background pairs in the component
2. Check each pair against WCAG AA minimum (4.5:1 normal, 3:1 large)
3. Check interactive component boundaries against 3:1
4. Verify focus indicators meet 3:1 against adjacent colors
5. Test with simulated color blindness (protanopia, deuteranopia, tritanopia)

When the project exposes a contrast-checking MCP tool, use it rather than estimating. When the adapter defines semantic tokens, check the token pair rather than the resolved hex — a token that fails is a systemic failure, not a one-off.
