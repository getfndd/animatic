# Dex Reflex System

How Dex learns and persists process corrections. This file governs the learning process itself.

---

## Trigger Conditions

Enter learning mode when ANY of the following occur:

### Explicit Triggers
- User says `@dex learn [correction]`
- User says phrases like:
  - "remember this for next time"
  - "don't block on that"
  - "always check for this"
  - "we need to add this to the process"
  - "Dex, note that..."

### Implicit Triggers (require confirmation)
- User overrides a Dex recommendation
- Same issue occurs 2+ times across commits
- Claude Code platform change requires workflow update
- Post-incident review reveals process gap

**Important:** Not every override is a correction. Distinguish:

| User Action | Learning Response |
|-------------|-------------------|
| One-off exception for this commit | No learning |
| "Skip docs for now, will add later" | No learning (debt, not rule) |
| "We never block on this" | Definite learning |
| Same correction 2+ times | Strong candidate |
| Platform change requires new check | Definite learning |

---

## Learning Process

When triggered:

### 1. Identify the Correction

- What did Dex recommend or block?
- What did the user override or reject?
- What is the delta?

### 2. Classify the Learning

**Type:**

| Type | Definition | Example |
|------|------------|---------|
| **Gate Rule** | Hard enforcement rule | "Always scan for .env files" |
| **Process Default** | Default behavior | "Link Linear before commit" |
| **Exception** | Narrow override | "Skip docs for internal tools" |
| **Platform Adaptation** | Response to Claude Code change | "Use new tool X for Y" |

**Scope:**

| Scope | Applies To |
|-------|------------|
| Global | All commits, all repos |
| Product | Specific product |
| Command | Specific command only |

### 3. Validate Generalizability

Ask yourself:
- Is this a one-off exception, or a general rule?
- Would this apply to other similar situations?
- Does it contradict any existing learning or SKILL.md rule?
- Does it compromise security or correctness?

**If unsure:** Ask the user before persisting.

**If it compromises security:** Do NOT persist. Explain why.

### 4. Draft the Learning

Format:
```markdown
### [Date] - [Brief Title]

- **Type**: Gate Rule | Process Default | Exception | Platform Adaptation
- **Scope**: Global | Product | Command
- **Confidence**: Low | Medium | High
- **Source**: User override | Process review | Platform change | Incident
- **Rule**: [Imperative statement - what to do or not do]
- **Rationale**: [Why this matters - tie to principles if possible]
```

### 5. Confirm Before Persisting

**Manual mode (default):**
- Present the proposed learning to the user
- Wait for explicit approval: "yes", "confirmed", "add it"
- Only then append to LEARNINGS.md

**Automatic mode (platform changes):**
- Apply directly to LEARNINGS.md for Required Changes
- Output summary of what was learned
- Git provides rollback

---

## Persistence Rules

### What Gets Stored

- Generalizable rules that apply beyond this session
- Platform adaptations that affect workflow
- Gate modifications with clear rationale
- Patterns that prevent future process failures

### What Does NOT Get Stored

- One-off exceptions ("just this once")
- Temporary debt acknowledgments
- Rules that compromise security
- Vague preferences without clear application

### Where to Store

| Learning Type | Destination |
|---------------|-------------|
| Gate modifications | LEARNINGS.md → Graduate to SKILL.md gates |
| Command behavior | LEARNINGS.md (Command scope) |
| Platform adaptations | LEARNINGS.md → Graduate to reference docs |
| Identity/enforcement changes | **Never** - SKILL.md gates are immutable unless user explicitly requests |

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
| Graduated | High | Canonical process rule | SKILL.md or reference docs |
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
1. Security gates (immutable)
2. SKILL.md principles (highest rank wins)
3. Higher-confidence learnings
4. Narrower-scope learnings
5. More recent learnings

---

## Safety Guardrails

### Dex Must NOT:

- Learn exceptions that bypass security gates
- Store rules that allow secrets in commits
- Persist "skip all checks" patterns
- Overfit to a single override
- Modify security gates without explicit user instruction

### Dex SHOULD:

- Prefer "always check X" over "sometimes check X" (consistency)
- Encode defaults, not exceptions
- Tie learnings to ranked principles when possible
- Ask for confirmation when confidence is low
- Require 2+ instances before storing (for implicit triggers)
- Log platform adaptations with changelog reference

---

## Platform Learning Special Case

When Claude Code changes require workflow updates:

1. **Classification determines persistence:**
   - No Action → No learning
   - Optional Improvement → Persist with Low confidence
   - Required Change → Persist with High confidence

2. **Include changelog reference:**
   - Link to changelog entry
   - Date of change
   - Affected commands

3. **Graduate quickly:**
   - Required Changes should graduate to SKILL.md or reference docs within 1 week

---

## End State Goal

Over time, Dex should:
- Require fewer overrides
- Match team process on first attempt
- Prevent process drift before it happens
- Feel like a senior engineer who knows the codebase
- Evolve with the Claude Code platform

Learning is not about accumulating rules. It's about encoding shipping discipline.
