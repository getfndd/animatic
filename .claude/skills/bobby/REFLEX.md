# Bobby Learning Governance (REFLEX)

## Purpose

Controls how Bobby's UX writing knowledge evolves. Ensures microcopy standards remain consistent while adapting to validated patterns from real usage.

## Categories

### Button Labels
- Action verb patterns that work
- Label length preferences
- Context-specific phrasing

### Error Messages
- Effective error structures
- Tone calibrations for severity
- Recovery guidance patterns

### Empty States
- Copy structures that motivate action
- Context-appropriate tone shifts
- Feature-specific patterns

### Tone Corrections
- Voice adjustments based on feedback
- Context-dependent tone shifts
- Consistency refinements

## Learning Rules

### What Gets Captured

| Trigger | Action | Category |
|---------|--------|----------|
| User corrects a label suggestion | Record correction + rationale | Button Labels |
| Error message pattern confirmed effective | Record pattern + context | Error Messages |
| Empty state copy approved | Record structure + context | Empty States |
| Tone feedback received | Record adjustment + scope | Tone Corrections |

### What Does NOT Get Captured

- One-off phrasing preferences without rationale
- Temporary copy (placeholder text)
- Copy for features that are later removed
- Personal writing style preferences (vs product voice decisions)

## Validation Requirements

### Before Recording a Learning

1. **Consistency** — Does this align with existing tone guide principles?
2. **Rationale** — Is there a clear reason for the preference?
3. **Scope** — Is this a product-wide pattern or a one-off context?
4. **Clarity** — Would another writer understand and apply this?

### Before Applying a Learning

1. Check the context matches (error vs success vs neutral)
2. Verify the component type matches (modal vs toast vs inline)
3. Confirm no conflict with newer learnings
4. Ensure accessibility is maintained

## Conflict Resolution

When learnings conflict:

1. Clarity wins over brevity
2. Accessibility wins over style
3. Consistency wins over local optimization
4. More recent validated pattern wins over older
5. Product-wide decisions win over page-specific

## Anti-Drift Rules

These principles are FIXED and learnings cannot override them:

- Sentence case everywhere (no Title Case, no ALL CAPS)
- No periods in buttons
- No exclamation marks in UI text
- No emojis in interface text
- Error messages must include recovery path
- Empty states must include action path
- Clarity over cleverness, always

## Review Cadence

- After each UX writing session: capture confirmed patterns
- When tone feedback is received: record with full context
- When new UI patterns are introduced: define copy conventions
- Monthly: review all learnings for consistency with tone guide
