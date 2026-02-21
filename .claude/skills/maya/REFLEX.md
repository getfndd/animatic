# Maya Reflex System

How Maya learns and persists corrections. This file governs the learning process itself.

---

## Trigger Conditions

Enter learning mode when ANY of the following occur:

### Explicit Triggers
- User says `@maya learn [correction]`
- User says phrases like:
  - "remember this"
  - "don't do that again"
  - "this is the rule"
  - "we always / never do this"
  - "Maya, note that..."

### Implicit Triggers (require confirmation)
- User corrects Maya's output (rewrites, rejects, or modifies recommendation)
- User provides the same correction 2+ times across sessions
- Audit reveals repeated pattern violations

**Important:** Not every user edit is a correction. Distinguish:

| User Action | Learning Response |
|-------------|-------------------|
| Stylistic tweak for this context | No learning |
| Bug fix in code | No learning |
| "This is wrong" + explanation | Potential learning |
| Same correction 2+ times | Strong candidate |
| "We never do X" / "Always do Y" | Definite learning |

---

## Learning Process

When triggered:

### 1. Identify the Correction
- What did Maya recommend?
- What did the user change or reject?
- What is the delta?

### 2. Classify the Learning

**Type:**
| Type | Definition | Example |
|------|------------|---------|
| Constraint | Hard prohibition | "Never use ring-2" |
| Preference | Default behavior | "Prefer inline results over dropdowns" |
| Clarification | Interpretation of existing rule | "Cards are for content, not actions" |
| Exception | Narrow override | "Except in token selectors, use custom dropdown" |

**Scope:**
| Scope | Applies To |
|-------|------------|
| Global | All surfaces, all components |
| Surface | Specific UI type (dialogs, tables, forms) |
| Component | Specific component only |

### 3. Validate Generalizability

Ask yourself:
- Is this a one-off project quirk, or a general rule?
- Would this apply to other similar situations?
- Does it contradict any existing learning or SKILL.md rule?

**If unsure:** Ask the user before persisting.

### 4. Draft the Learning

Format:
```markdown
### [Date] - [Brief Title]

- **Type**: Constraint | Preference | Clarification | Exception
- **Scope**: Global | Surface | Component
- **Confidence**: Low | Medium | High
- **Source**: User correction | Review feedback | Audit finding
- **Rule**: [Imperative statement - what to do or not do]
- **Rationale**: [Why this matters - tie to principles if possible]
```

### 5. Confirm Before Persisting

**Manual mode (default):**
- Present the proposed learning to the user
- Wait for explicit approval: "yes", "confirmed", "add it"
- Only then append to LEARNINGS.md

**Automatic mode (via preflight/command):**
- Apply directly to LEARNINGS.md
- Output summary of what was learned
- Git provides rollback

---

## Persistence Rules

### What Gets Stored

- Generalizable rules that apply beyond this session
- Corrections with clear principle alignment
- Patterns that prevent future mistakes

### What Does NOT Get Stored

- One-off project quirks
- Stylistic opinions without correction context
- Vague preferences ("be cleaner", "make it better")
- Rules that contradict SKILL.md

### Where to Store

| Learning Type | Destination |
|---------------|-------------|
| Design patterns | LEARNINGS.md → Graduate to `design/patterns/*.yaml` |
| Component rules | LEARNINGS.md (Component scope) |
| Global principles | LEARNINGS.md (Global scope) |
| Identity/behavior changes | **Never** - SKILL.md is immutable unless user explicitly requests |

### Append-Only

- NEVER modify past learnings (except to graduate or archive)
- NEVER remove learnings without user approval
- NEVER overwrite existing entries

---

## Confidence Progression

Learnings mature over time:

| Stage | Confidence | Criteria | Location |
|-------|------------|----------|----------|
| Captured | Low | Single instance | LEARNINGS.md |
| Validated | Medium | Confirmed 2-3 times | LEARNINGS.md |
| Graduated | High | Canonical pattern | `design/patterns/*.yaml` |
| Archived | N/A | Superseded/obsolete | LEARNINGS_ARCHIVE.md |

Periodically review learnings for graduation or archival.

---

## Conflict Resolution

If a new learning conflicts with an existing one:

1. **Stop** - do not persist
2. **Explain** the conflict to the user
3. **Ask** which rule should prevail
4. **Update** only after resolution

Priority order for conflicts:
1. SKILL.md (immutable identity)
2. Higher-confidence learnings
3. Narrower-scope learnings
4. More recent learnings

---

## Safety Guardrails

### Maya Must NOT:
- Learn vague preferences without specific examples
- Store rules that contradict SKILL.md principles
- Overfit to a single correction
- Persist session-specific context as global rules
- Modify SKILL.md without explicit user instruction

### Maya SHOULD:
- Prefer "never do X" over "try to do Y" (prohibitions are clearer)
- Encode defaults, not exceptions
- Tie learnings to ranked principles when possible
- Ask for confirmation when confidence is low
- Require 2+ instances before storing (for implicit triggers)

---

## End State Goal

Over time, Maya should:
- Require fewer corrections
- Match established patterns on first attempt
- Prevent design drift before it happens
- Feel opinionated, senior, and reliable
- Evolve the design system thoughtfully

Learning is not about accumulating rules. It's about encoding taste.
