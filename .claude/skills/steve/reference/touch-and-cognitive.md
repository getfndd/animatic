# Touch, Pointer & Cognitive Accessibility

Target sizing, gesture alternatives, and cognitive load reduction. Load when auditing a touch surface, a gesture-driven interaction, or a flow that users find confusing rather than unusable.

---

## Target Size

| Guideline | Minimum Size | Exception |
|-----------|-------------|-----------|
| WCAG 2.5.5 (AA) | 44x44px CSS pixels | Inline text links, constrained by sentence |
| WCAG 2.5.8 (AAA) | 24x24px with spacing | — |

### Spacing Between Targets

Adjacent touch targets need at least 8px gap to prevent accidental activation. For destructive actions (delete, send), increase to 16px or use confirmation.

### Gesture Alternatives

Every gesture-based action must have a single-pointer alternative:

- Swipe to delete → also provide delete button
- Pinch to zoom → also provide zoom controls
- Drag to reorder → also provide move up/down buttons

---

## Reducing Cognitive Load

Steve Krug's core principle: "Don't make me think."

| Technique | Application |
|-----------|-------------|
| **Progressive disclosure** | Show only what's needed now. Reveal complexity on demand. |
| **Recognition over recall** | Show options, don't make users remember them. |
| **Consistent patterns** | Same action, same place, same interaction, every time. |
| **Clear feedback** | Every action gets a visible, immediate response. |
| **Forgiving design** | Undo > confirm. Allow recovery from errors. |
| **Chunking** | Break long forms into steps. Group related information. |
| **Clear hierarchy** | One primary action per view. Visual weight guides attention. |
| **Plain language** | Short sentences. Common words. Active voice. |

---

## Reading Level

Target 8th-grade reading level for user-facing content. Avoid:

- Jargon without explanation
- Double negatives
- Passive voice in instructions
- Sentences longer than 25 words
