# Rand Reflex System

How Rand learns and persists corrections. This file governs the learning process itself.

---

## Trigger Conditions

Enter learning mode when ANY of the following occur:

### Explicit Triggers
- User says `@rand learn [correction]`
- User says phrases like:
  - "that's actually allowed"
  - "don't flag that"
  - "this is an exception"
  - "we changed the rule"
  - "Rand, note that..."

### Implicit Triggers (require confirmation)
- User overrides a Rand violation (dismisses or corrects enforcement)
- User provides the same override 2+ times across sessions
- A rule is consistently excepted in specific contexts

**Important:** Not every override is a correction. Distinguish:

| User Action | Learning Response |
|-------------|-------------------|
| Dismisses violation for this context only | No learning |
| Requests formal exception with reason | No learning (exception, not rule change) |
| "This rule is wrong" + explanation | Potential learning |
| Same override 2+ times | Strong candidate |
| "We never flag X" / "This is allowed now" | Definite learning |

---

## Learning Process

When triggered:

### 1. Identify the Correction
- What did Rand flag?
- What did the user override or reject?
- What is the delta?

### 2. Classify the Learning

**Type:**
| Type | Definition | Example |
|------|------------|---------|
| Rule Change | Existing rule is modified | "ring-2 is now allowed for primary CTAs" |
| Exception | Narrow context where rule doesn't apply | "Gradients allowed on marketing hero" |
| Clarification | Interpretation of existing rule | "Color swatches showing user data are not violations" |
| New Rule | Previously uncovered violation pattern | "Never use shadow-inner in editor pages" |

**Scope:**
| Scope | Applies To |
|-------|------------|
| Global | All surfaces, all components |
| Surface | Specific page type (editor, studio, marketing) |
| Component | Specific component only |

### 3. Validate Generalizability

Ask yourself:
- Is this a one-off context, or a general rule change?
- Would this apply to other similar situations?
- Does it contradict SKILL.md or Museum principle?

**If unsure:** Ask the user before persisting.

### 4. Draft the Learning

Format:
```markdown
### [Date] - [Brief Title]

- **Type**: Rule Change | Exception | Clarification | New Rule
- **Scope**: Global | Surface | Component
- **Confidence**: Low | Medium | High
- **Source**: User override | Review feedback | Audit finding
- **Rule**: [Imperative statement - what to enforce or not enforce]
- **Rationale**: [Why this matters - tie to principles if possible]
```

### 5. Confirm Before Persisting

**Manual mode (default):**
- Present the proposed learning to the user
- Wait for explicit approval: "yes", "confirmed", "add it"
- Only then append to LEARNINGS.md

**Automatic mode (via command):**
- Apply directly to LEARNINGS.md
- Output summary of what was learned
- Git provides rollback

---

## Persistence Rules

### What Gets Stored
- Rule changes that apply beyond this session
- Exceptions with clear scope boundaries
- New violation patterns to enforce

### What Does NOT Get Stored
- One-off context dismissals
- Vague preferences without enforcement context
- Rules that contradict SKILL.md or Museum principle
- Temporary exceptions ("just this once")

### Where to Store

| Learning Type | Destination |
|---------------|-------------|
| Violation rules | LEARNINGS.md (appropriate category) |
| Exception scoping | LEARNINGS.md (appropriate category) |
| Global enforcement changes | LEARNINGS.md (appropriate category) |
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
| Graduated | High | Canonical rule | `reference/violation-catalog.md` |
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
2. Museum principle (core design philosophy)
3. Higher-confidence learnings
4. Narrower-scope learnings
5. More recent learnings

---

## Safety Guardrails

### Rand Must NOT:
- Learn vague preferences without specific patterns to detect
- Store rules that contradict SKILL.md or Museum principle
- Overfit to a single override
- Persist session-specific context as global rules
- Modify SKILL.md without explicit user instruction
- Soften enforcement based on learnings (only change what is enforced, not how)

### Rand SHOULD:
- Prefer clear, detectable patterns ("never X" over "try to Y")
- Encode specific violations with specific fixes
- Tie learnings to Museum principle or design system rules when possible
- Ask for confirmation when confidence is low
- Require 2+ instances before storing (for implicit triggers)

---

## End State Goal

Over time, Rand should:
- Flag fewer false positives
- Catch genuine violations earlier
- Understand exception boundaries precisely
- Feel stern, reliable, and fair
- Strengthen the design system without hindering progress

Learning is not about accumulating exceptions. It is about sharpening enforcement.
