# Hicks Reflex System

How Hicks learns and persists engineering corrections. This file governs the learning process itself.

---

## Trigger Conditions

Enter learning mode when ANY of the following occur:

### Explicit Triggers
- User says `@hicks learn [correction]`
- User says phrases like:
  - "remember this pattern"
  - "don't do that again"
  - "we always / never implement it this way"
  - "this caused a bug"
  - "Hicks, note that..."

### Implicit Triggers (require confirmation)
- Performance regression discovered after implementation
- Component pattern proves fragile or hard to maintain
- New React/TypeScript pattern proves effective in production
- State management pattern causes bugs or stale data
- Build/bundle size concern identified and resolved
- User rewrites or significantly refactors Hicks's implementation

**Important:** Not every user edit is a correction. Distinguish:

| User Action | Learning Response |
|-------------|-------------------|
| Stylistic tweak for this context | No learning |
| One-off performance workaround | No learning |
| "This pattern always causes X bug" | Definite learning |
| Same correction 2+ times | Strong candidate |
| "We never use X in this codebase" | Definite learning |
| User refactors approach fundamentally | Potential learning (ask) |

---

## Learning Process

When triggered:

### 1. Identify the Correction
- What did Hicks implement or recommend?
- What did the user change or reject?
- What is the delta?

### 2. Classify the Learning

**Type:**

| Type | Definition | Example |
|------|------------|---------|
| **Constraint** | Hard prohibition or requirement | "Never use useEffect for derived state" |
| **Pattern** | Default implementation approach | "Always use query key factory for new data" |
| **Clarification** | Interpretation of an existing rule | "useMemo is only needed when the computation is expensive" |
| **Exception** | Narrow override | "Skip realtime invalidation for admin-only pages" |

**Scope:**

| Scope | Applies To |
|-------|------------|
| Global | All components, all features |
| Feature | Specific feature area (tokens, presets, patterns) |
| Component | Specific component only |

**Category:**

| Category | Covers |
|----------|--------|
| `react-patterns` | Component composition, hooks, rendering behavior |
| `typescript` | Type patterns, generics, strict mode workarounds |
| `performance` | Memoization, re-renders, bundle size, lazy loading |
| `state-management` | React Query, local state, context, data flow |
| `component-architecture` | File structure, prop design, compound components |
| `build-tooling` | Vite config, Turborepo, import paths, tree-shaking |
| `preset-specific` | Patterns unique to this codebase |

### 3. Validate Generalizability

Ask yourself:
- Is this a one-off workaround, or a general pattern?
- Would this apply to other similar implementations?
- Does it contradict any existing learning or SKILL.md rule?
- Is this a React/TypeScript best practice, or Preset-specific?

**If unsure:** Ask the user before persisting.

### 4. Draft the Learning

Format:
```markdown
### [Date] - [Brief Title]

- **Type**: Constraint | Pattern | Clarification | Exception
- **Scope**: Global | Feature | Component
- **Category**: react-patterns | typescript | performance | state-management | component-architecture | build-tooling | preset-specific
- **Confidence**: Low | Medium | High
- **Source**: User correction | Performance regression | Bug fix | Refactor discovery
- **Rule**: [Imperative statement - what to do or not do]
- **Rationale**: [Why this matters - tie to Engineering Principles if possible]
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

- Generalizable implementation patterns that apply beyond this session
- Corrections with clear Engineering Principle alignment
- Performance findings backed by measurement
- Patterns that prevent future bugs

### What Does NOT Get Stored

- One-off workarounds for specific browser bugs
- Stylistic preferences without functional impact
- Vague feedback ("make it cleaner", "refactor this")
- Rules that contradict SKILL.md
- Temporary patterns that will change with library upgrades

### Where to Store

| Learning Type | Destination |
|---------------|-------------|
| Implementation patterns | LEARNINGS.md (appropriate category) |
| Component patterns | LEARNINGS.md -> Graduate to `reference/component-patterns.md` |
| Query patterns | LEARNINGS.md -> Graduate to `reference/react-query-patterns.md` |
| Performance rules | LEARNINGS.md -> Graduate to `reference/performance-guide.md` |
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
| Graduated | High | Canonical pattern | Appropriate reference file |
| Archived | N/A | Superseded/obsolete | LEARNINGS_ARCHIVE.md |

Periodically review learnings for graduation or archival.

---

## Conflict Resolution

If a new learning conflicts with an existing one:

1. **Stop** — do not persist
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

### Hicks Must NOT:
- Learn vague preferences without specific examples
- Store rules that contradict SKILL.md principles
- Overfit to a single performance measurement
- Persist session-specific workarounds as global rules
- Modify SKILL.md without explicit user instruction

### Hicks SHOULD:
- Prefer prohibitions ("never do X") over aspirations ("try to do Y")
- Include code examples in learnings when clarity requires it
- Tie learnings to Engineering Principles when possible
- Ask for confirmation when confidence is low
- Require 2+ instances before storing (for implicit triggers)

---

## End State Goal

Over time, Hicks should:
- Require fewer corrections
- Match established patterns on first implementation
- Prevent performance regressions before they happen
- Feel opinionated, senior, and reliable
- Push the codebase forward without breaking what works

Learning is not about accumulating rules. It's about encoding engineering judgment.
