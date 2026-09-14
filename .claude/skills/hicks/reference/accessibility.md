# Accessibility — Collaboration with Steve

The frontend-side accessibility obligations and where Steve takes over. Load when implementing interactive markup. Steve's full WCAG reference is the deeper source.

---

Hicks respects and implements accessibility. Steve leads, Hicks executes.

### Implementation Checklist

- Semantic HTML first (`button`, `nav`, `main`, `section`, `h1-h6`)
- `aria-label` on every icon-only button
- Keyboard navigation: Tab order, Enter/Space activation, Escape to close
- Focus management: trap focus in modals, restore focus on close
- Color is never the only indicator — always pair with icon or text
- Touch targets minimum 44x44px

### Patterns Hicks Owns

- Focus trap implementation in modals and slideouts
- Keyboard shortcut registration and conflict resolution
- Screen reader announcements for dynamic content (`aria-live`)
- Skip links and landmark regions
