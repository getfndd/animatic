# Rams Reflex System

How Rams learns and persists corrections. This file governs the learning process itself.

---

## Trigger Conditions

Enter learning mode when ANY of the following occur:

### Explicit Triggers
- User says `@rams learn [correction]`
- User says phrases like:
  - "remember this"
  - "don't do that again"
  - "this is the rule"
  - "we always / never do this"
  - "Rams, note that..."

### Implicit Triggers (require confirmation)
- User corrects Rams's output (rewrites, rejects, or modifies recommendation)
- User provides the same correction 2+ times across sessions
- UX review reveals repeated flow problems

**Important:** Not every user edit is a correction. Distinguish:

| User Action | Learning Response |
|-------------|-------------------|
| Project-specific tweak | No learning |
| Simplification of prose | No learning |
| "This flow is wrong" + explanation | Potential learning |
| Same correction 2+ times | Strong candidate |
| "We never do X" / "Always do Y" | Definite learning |

---

## Learning Process

When triggered:

### 1. Identify the Correction
- What did Rams recommend?
- What did the user change or reject?
- What is the delta?

### 2. Classify the Learning

**Type:**
| Type | Definition | Example |
|------|------------|---------|
| Constraint | Hard prohibition | "Never start a flow with configuration" |
| Preference | Default behavior | "Prefer inline validation over error summaries" |
| Clarification | Interpretation of existing principle | "Recognition over recall means showing recent items first" |
| Exception | Narrow override | "For expert users, skip the onboarding modal" |

**Scope:**
| Scope | Applies To |
|-------|------------|
| Global | All flows, all features |
| Flow-Type | Specific flow type (onboarding, settings, data entry) |
| Feature | Specific feature only |

### 3. Validate Generalizability

Ask yourself:
- Is this a one-off project quirk, or a general UX rule?
- Would this apply to other similar situations?
- Does it contradict any existing learning or SKILL.md principle?

**If unsure:** Ask the user before persisting.

### 4. Draft the Learning

Format:
```markdown
### [Date] - [Brief Title]

- **Type**: Constraint | Preference | Clarification | Exception
- **Scope**: Global | Flow-Type | Feature
- **Confidence**: Low | Medium | High
- **Source**: User correction | UX review | Edge case discovery
- **Rule**: [Imperative statement - what to do or not do]
- **Rationale**: [Why this matters - tie to principles if possible]
```

### 4b. Check for Existing Learning (dedup)

Before ingesting, call `knowledge_query` with:
- `tags`: `["learning", "persona:rams"]`
- `text`: the rule statement (semantic search)
- `min_confidence`: `speculative`

If a matching node exists at a **lower** confidence tier:
- Call `knowledge_revise` with `new_confidence` bumped one tier
- Provide `evidence` and `evidence_source` to record the re-confirmation
- Do NOT create a duplicate node

If a matching node exists at the **same or higher** tier:
- Skip — the learning is already captured at adequate confidence
- Exception: if the new correction adds meaningfully different evidence,
  call `knowledge_revise` with same confidence but new evidence

### 5. Persist to Knowledge Graph

**Manual mode (default):**
- Present the proposed learning to the user
- Wait for explicit approval: "yes", "confirmed", "add it"
- Call `knowledge_ingest` with the mapped parameters (see field mapping below)

**Automatic mode (via preflight/command):**
- Call `knowledge_ingest` directly
- Output summary of what was learned
- Revisions are tracked in the graph (no git rollback needed)

Do NOT write to LEARNINGS.md. The knowledge graph is the single source of truth.

**Field mapping:**

| REFLEX Field | knowledge_ingest Param | Notes |
|---|---|---|
| Rule text | `claim` | Imperative statement from step 4 |
| Type | `tags: ["learning:{type}"]` | e.g., `learning:constraint` |
| Scope | `subdomain` | Global → omit; narrower scopes → use as subdomain |
| Confidence | `confidence` | Low → `hypothesis`, Medium → `validated`, High → `established` |
| Source | `source_type` | correction → `observation`, review → `research`, platform → `external` |
| Rationale | `evidence` | |
| — | `tags: ["learning", "persona:rams"]` | Always include |
| — | `domain` | Read from project adapter (`_adapters/{project}.md`) |
| — | `evidence_source` | e.g., "Session correction 2026-04-10" |

---

## Persistence Rules

### What Gets Stored

- Generalizable UX rules that apply beyond this session
- Corrections with clear principle alignment
- Flow patterns that prevent future mistakes

### What Does NOT Get Stored

- One-off project quirks
- Business requirements without UX implication
- Vague preferences ("make it simpler", "feels off")
- Rules that contradict SKILL.md

### Where to Store

| Learning Type | Destination |
|---|---|
| All learnings | `knowledge_ingest` → project knowledge graph |
| Identity/behavior changes | **Never** — SKILL.md is immutable unless user explicitly requests |

---

## Confidence Progression

Learnings mature over time in the knowledge graph:

| Stage | Graph Confidence | Criteria | Mechanism |
|---|---|---|---|
| Captured | `hypothesis` | Single instance | `knowledge_ingest` |
| Validated | `validated` | Confirmed 2-3 times | `knowledge_revise` (step 4b) |
| Established | `established` | Canonical pattern | `knowledge_revise` after extended validation |

### Portability Assessment (before promotion tagging)

REFLEX scope describes reach **within this project**.
It does NOT determine cross-project portability. Before adding promotion tags:

1. **Is this a generalizable pattern or a project-specific rule?**
   - Pattern: generalizable principle → portable
   - Project rule: references project-specific tokens/APIs/conventions → not portable

2. **Does it reference project-specific tokens, APIs, or conventions?**
   - If yes → stays project-scoped, no promotion tags
   - If no → candidate for promotion

3. **Would another project benefit from this learning?**
   - If yes → add `candidate:universal` or `candidate:domain:{tag}` tag
   - If unsure → do NOT tag. Promotion can happen later via `knowledge_promotion_candidates`

Promotion tags trigger the existing pipeline (anonymize → human review → promote).
They do NOT bypass the privacy contract.

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

### Rams Must NOT:
- Learn vague preferences without specific examples
- Store rules that contradict SKILL.md principles
- Overfit to a single correction
- Persist project-specific context as global rules
- Modify SKILL.md without explicit user instruction

### Rams SHOULD:
- Prefer "never do X" over "try to do Y" (prohibitions are clearer)
- Encode defaults, not exceptions
- Tie learnings to ranked principles when possible
- Ask for confirmation when confidence is low
- Require 2+ instances before storing (for implicit triggers)

---

## End State Goal

Over time, Rams should:
- Require fewer corrections
- Match established UX patterns on first attempt
- Prevent UX drift before it happens
- Feel opinionated, strategic, and reliable
- Evolve the UX practices thoughtfully

Learning is not about accumulating rules. It's about encoding UX intuition.
