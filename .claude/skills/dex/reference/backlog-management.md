# Backlog Management Reference

Comprehensive backlog management framework for Dex. Covers health metrics, grooming, cleanup, consolidation, prioritization, epic lifecycle, and cycle planning.

---

## Guiding Principles

1. **A lean backlog is a fast backlog.** Important requests resurface; low-priority ones never get fixed. Prune aggressively.
2. **Completion over initiation.** Finish current epics before starting new ones. Resist scope creep.
3. **Dex orchestrates, Eames decides.** Dex runs the mechanics; Eames provides strategic judgment on what matters.
4. **Every item earns its place.** If an issue hasn't moved in 90 days, it needs a reason to stay.
5. **Group by outcome, not technology.** Epics serve user goals, not engineering layers.

---

## Health Metrics

### Dashboard Thresholds

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| **Backlog size** | < 3 months of work at current velocity | 3-6 months | > 6 months |
| **Stale rate** (no update 90+ days) | < 10% | 10-25% | > 25% |
| **Orphan rate** (no project/epic) | < 5% | 5-15% | > 15% |
| **Ready rate** (next cycle items with estimate + criteria) | > 60% | 40-60% | < 40% |
| **Estimation coverage** (next 2 cycles) | > 80% | 50-80% | < 50% |
| **Priority distribution** | Pyramid (few urgent, more normal) | Flat | Inverted (everything urgent) |
| **Triage inbox** | < 10 items | 10-25 | > 25 |
| **Avg issue age** (backlog items) | < 60 days | 60-120 days | > 120 days |

### Automated Checks

When running health metrics, query Linear for:
- Issue count by status (Backlog, Todo, In Progress, In Review, Done, Canceled)
- Issues with no project assignment (orphans)
- Issues with no estimate in upcoming cycle
- Issues with no update in 60/90/120 days
- Issues with no assignee in Todo or In Progress
- Priority distribution across open issues
- Epics with all sub-issues done but epic still open (close candidates)
- Issues with 2+ blockers (risky for cycle planning)

---

## ICE Scoring Framework

Used for relative ranking of backlog items. Lightweight — no ceremony.

### Formula

```
ICE Score = (Impact × Confidence × Ease) / 10
```

### Dimensions

| Dimension | Scale | Who Evaluates | What It Measures |
|-----------|-------|---------------|------------------|
| **Impact** | 1-10 | Eames (strategy), Rams (user value) | How much does this move the needle for users or business? |
| **Confidence** | 1-10 | Eames | How sure are we about the impact estimate? |
| **Ease** | 1-10 | Hicks (effort), Dex (risk) | How easy is this to ship? (inverse of effort/risk) |

### Impact Calibration

| Score | Meaning | Example |
|-------|---------|---------|
| 10 | Game-changing for most users | Core workflow that every user touches daily |
| 7-9 | High value for many users | Feature that addresses top user complaint |
| 4-6 | Moderate value or niche audience | Quality-of-life improvement, power-user feature |
| 1-3 | Minor improvement | Polish, edge case fix, rare workflow |

### Confidence Calibration

| Score | Meaning |
|-------|---------|
| 10 | We have user data / direct feedback confirming this |
| 7-9 | Strong signal from usage patterns or user conversations |
| 4-6 | Reasonable hypothesis, some supporting evidence |
| 1-3 | Gut feel, speculative, or copying competitors |

### Ease Calibration

| Score | Meaning | Rough Effort |
|-------|---------|-------------|
| 10 | Trivial — config change or copy fix | < 1 hour |
| 7-9 | Small — isolated change, well-understood | < 1 day |
| 4-6 | Medium — touches multiple files, some complexity | 1-3 days |
| 1-3 | Large — cross-cutting, new infrastructure, high risk | > 3 days |

### Strategic Tiers (MoSCoW at Epic Level)

Applied by Eames at the epic/initiative level before ICE scoring individual issues:

| Tier | Definition | Planning Rule |
|------|-----------|---------------|
| **Must** | Required this quarter. User-facing commitment or critical debt. | Always in cycle. |
| **Should** | High value, strong case, but not committed. | Fill remaining capacity. |
| **Could** | Nice to have. Would improve product but can wait. | Only if capacity allows. |
| **Won't** | Not this quarter. Explicitly deferred. | Remove from active backlog. |

---

## Grooming Session Protocol

### `@dex backlog groom` — Full Guided Session

A structured, multi-step grooming session. Each step pauses for user input before proceeding. Estimated time: 20-40 minutes depending on backlog size.

#### Step 1: Health Snapshot
- Run health metrics dashboard
- Highlight critical metrics
- Set context for the session

#### Step 2: Triage Inbox
- List issues in Triage/unassigned status
- For each: suggest project, labels, estimate
- Offer bulk-assign with confirmation

**Persona:** Dex leads. Eames consulted for priority calls on ambiguous items.

#### Step 3: Stale Sweep
- List issues with no update in 90+ days
- For each: recommend keep (re-prioritize), close (obsolete), or split (too big)
- Flag issues superseded by shipped work

**Persona:** Dex detects. Eames decides on strategic value.

#### Step 4: Orphan Round-Up
- List issues with no project/epic assignment
- Suggest project assignment based on title/description analysis
- Flag items that don't fit any project (candidates for new epic or closure)

**Persona:** Dex identifies. Eames assigns to strategic buckets.

#### Step 5: Duplicate Detection
- Fuzzy-match issue titles for potential duplicates
- Check for issues covering the same component/feature area
- Suggest merge candidates with canonical issue recommendation

**Persona:** Dex only.

#### Step 6: Superseded Check
- Cross-reference backlog items against recently completed work
- Identify issues whose scope was absorbed by shipped features
- Suggest closure with "Superseded by FND-XXX" note

**Persona:** Dex only.

#### Step 7: Epic Review
- List active epics with completion stats
- Flag scope creep (>50% new issues since kickoff)
- Flag duration creep (>3 months active)
- Identify epics ready to close
- Identify orphan sub-issues in completed epics

**Persona:** Eames leads epic-level decisions. Rams consulted on scope.

#### Step 8: Prioritize Top Items
- Take the top 15-20 items by current priority
- Run ICE scoring with Eames (Impact, Confidence) and Hicks (Ease)
- Re-rank based on scores
- Assign MoSCoW tiers to epics if not already set

**Persona:** Eames leads. Rams provides user-value lens. Hicks provides effort estimates.

#### Step 9: Summary & Actions
- Report what was cleaned (closed, merged, reassigned)
- Report what needs user decisions (items flagged but not acted on)
- Report updated health metrics (before/after)
- Suggest next grooming date

---

## Cleanup Patterns

### Detection & Action Matrix

| Category | Detection Signal | Action |
|----------|-----------------|--------|
| **Duplicates** | Fuzzy title match, same component/area | Merge into canonical issue, close duplicates with link |
| **Stale** (90+ days) | No update, no cycle assignment | Close if obsolete, re-scope if still valid |
| **Superseded** | Related shipped work covers this scope | Close with "Superseded by FND-XXX" |
| **Too Large** | Estimate > 1 cycle, or description keeps growing | Promote to epic, decompose into sub-issues |
| **Missing Context** | No description, no acceptance criteria | Flag for author; close after 30-day grace if unresolved |
| **Abandoned Spikes** | Investigation issue with no follow-up created | Close if findings captured; create follow-ups if not |
| **Zombie Features** | 6+ months old, never prioritized, no user demand | Close with "Will re-open if demand resurfaces" |
| **Orphan Issues** | No project, no epic, no cycle | Assign to project/epic or close |
| **Completed Epics** | All sub-issues done but epic still open | Close epic with summary |
| **Dead Labels** | Labels no longer matching taxonomy, < 3 uses | Archive or merge into active labels |

### Label Hygiene

Recommended taxonomy (if labels are used at all):

| Prefix | Purpose | Examples |
|--------|---------|----------|
| `type/` | Issue category | `type/feature`, `type/bug`, `type/chore`, `type/spike` |
| `area/` | Product area | `area/portal`, `area/cap-table`, `area/ai`, `area/data-room` |
| `effort/` | T-shirt size | `effort/S`, `effort/M`, `effort/L`, `effort/XL` |

**Labels to avoid** (use Linear's built-in fields instead):
- Priority labels (use Linear's priority field)
- Status labels (use Linear's status field)
- Phase labels (use parent/child structure or projects)

---

## Consolidation Signals

### When to Create an Epic

| Signal | Action |
|--------|--------|
| 3+ issues share the same user goal or outcome | Group into epic |
| Issues reference the same screen/component/data model | Consider parent issue |
| Work spans 2+ cycles serving one outcome | Epic with sub-issues |
| Single issue has grown beyond one cycle | Promote to epic, decompose |
| Multiple bug reports stem from same root cause | Consolidate into one fix |
| Feature request duplicates with different wording | Merge, link originals |

### When NOT to Create an Epic

- Work fits in one cycle with 2-3 sub-tasks → single issue with checklist
- No clear completion criteria → it's a label/category, not an epic
- "Bucket" grouping with no shared outcome → use project instead

### Consolidation Process

1. Search for issues with overlapping titles, descriptions, or affected components
2. Group by **user outcome**, not technical similarity
3. Create epic with clear scope statement and exit criteria
4. Move related issues as sub-issues
5. Close duplicates with a link to the canonical issue
6. Set epic owner (usually Eames for strategic, Dex for operational)

---

## Epic Lifecycle

### States

```
PROPOSED  →  ACTIVE  →  COMPLETED  →  ARCHIVED
   |             |            |
   v             v            v
 REJECTED      SPLIT       CLOSED
             (spawn 2+     (partial
              new epics)    delivery)
```

### Decision Criteria

| Decision | Criteria |
|----------|---------|
| **Create** | Work spans 2+ cycles, has 3+ sub-issues, serves a clear user outcome |
| **Split** | Scope has grown beyond 3 months, or natural phase boundaries emerge |
| **Close (Done)** | All sub-issues done, success criteria met |
| **Close (Partial)** | Enough value delivered, remaining items deprioritized or moved to new epic |
| **Archive** | Closed for 30+ days, no longer needs visibility |
| **Reject** | Strategy shifted, epic no longer aligns with goals |

### Scope Creep Detection

- If an epic gains >50% new issues after kickoff → scope creep
- New issues discovered during an epic: "Is this essential to the original goal?"
  - If no → create as separate issue/epic
  - If yes → add but adjust timeline
- Maximum epic duration guideline: 3-6 months

### Epic Health Check (`@dex epic health`)

Report for each epic:
- Sub-issue count (original vs. current — delta = scope creep indicator)
- Completion percentage
- Duration (start date → now)
- Stale sub-issues (in backlog/todo with no recent activity)
- Blocked sub-issues
- Missing estimates on remaining sub-issues

---

## Cycle Planning

### `@dex backlog plan` — Cycle Planning Flow

```
1. REVIEW STRATEGIC GOALS
   Eames: What are the must-haves this cycle?
   |
2. ASSESS CAPACITY
   Rule: Plan to 80% capacity. Reserve 20% for unplanned work.
   Solo: ~8 productive days per 2-week cycle
   Duo: ~14-15 productive days
   |
3. PULL FROM PRIORITIZED BACKLOG
   - Start with must-finish carryovers from last cycle
   - Then highest ICE-scored ready items
   - Check dependencies: don't pull blocked items
   |
4. VALIDATE SCOPE
   - Does total estimate fit within 80% capacity?
   - Is there a clear cycle goal (1-2 sentences)?
   - Are items small enough to complete within the cycle?
   |
5. DEPENDENCY CHECK
   Dex: Flag items with unresolved blockers
   Hicks: Flag technical dependencies
   |
6. ASSIGN OWNERS
   Every item needs one owner, not "the team"
   |
7. OUTPUT CYCLE PLAN
   Goal statement + ranked issue list + risk flags
```

### Cycle Plan Output Format

```markdown
## Cycle Plan — [Date Range]

### Goal
[1-2 sentence cycle goal]

### Capacity
- Available: X person-days
- Planned: Y person-days (Z% utilization)

### Must Complete (carryover)
1. FND-XXX — [Title] — [Estimate] — @owner

### Planned
1. FND-XXX — [Title] — [Estimate] — ICE: XX — @owner
2. FND-XXX — [Title] — [Estimate] — ICE: XX — @owner

### Stretch (if capacity allows)
1. FND-XXX — [Title] — [Estimate] — ICE: XX

### Dependencies & Risks
- FND-XXX blocked by FND-YYY (In Progress)
- FND-ZZZ touches auth flow — ELEVATED risk

### Not This Cycle (deferred)
- FND-AAA — Reason: [why deferred]
```

---

## Collaboration Model

### Who Does What

| Activity | Dex (Orchestrator) | Eames (Strategist) | Rams (UX) | Hicks (Eng) |
|----------|-------------------|--------------------|-----------|-|
| Health metrics | Runs, reports | — | — | — |
| Stale/orphan detection | Detects, flags | Decides keep/close | — | — |
| Duplicate detection | Detects, suggests merge | — | — | — |
| Epic review | Reports stats | Decides scope/close/split | Scope input | — |
| Consolidation | Identifies candidates | Decides grouping | User outcome lens | — |
| ICE: Impact | — | Scores (1-10) | User value input | — |
| ICE: Confidence | — | Scores (1-10) | — | — |
| ICE: Ease | — | — | — | Scores (1-10) |
| Cycle planning | Runs flow, checks deps | Sets goals, tiers | — | Effort estimates |
| Linear updates | Executes all changes | — | — | — |

### Invoking Collaboration

During grooming and prioritization, Dex explicitly surfaces the other persona's perspective:

```
**Eames:** This issue aligns with our Q2 goal of reducing onboarding friction.
Impact: 8, Confidence: 7.

**Rams:** Users drop off at this step — we've seen it in session recordings.
Supports Impact: 8.

**Hicks:** Isolated change, well-understood component. Ease: 8.

**Dex:** ICE Score: (8 × 7 × 8) / 10 = 44.8. Ranked #3.
```

---

## Recommended Cadences

| Cadence | Activity | Command |
|---------|----------|---------|
| Daily | Check blockers | `@dex linear blockers` |
| Weekly | Quick health check | `@dex backlog` |
| Bi-weekly | Full grooming session | `@dex backlog groom` |
| Cycle start | Plan next cycle | `@dex backlog plan` |
| Mid-cycle | Prioritize upcoming work | `@dex backlog prioritize` |
| Quarterly | Epic lifecycle review | `@dex epic health` on all active epics |

---

## Issue Quality Standards (INVEST)

Well-formed issues should be:

| Criterion | Question | Red Flag |
|-----------|----------|----------|
| **Independent** | Can this be worked on without blocking others? | Circular dependencies |
| **Negotiable** | Is scope flexible until committed? | Over-specified implementation |
| **Valuable** | Does it deliver user or business value? | Technical tasks without context |
| **Estimable** | Can we estimate effort? | Vague requirements, no acceptance criteria |
| **Small** | Can it be completed in a cycle? | Multi-week scope |
| **Testable** | Can we verify when it's done? | No success criteria |

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Fix |
|--------------|---------|-----|
| Backlog as idea graveyard | Noise drowns signal | Prune quarterly, use "Won't" tier |
| Everything is high priority | Nothing is high priority | Enforce pyramid distribution |
| Epics without exit criteria | They never close | Add "Definition of Done" to every epic |
| Estimate-free planning | Over-commitment, surprise delays | Estimate top 2 cycles minimum |
| Grooming as ceremony | Time wasted on low-value items | Only groom next 2-3 cycles of work |
| Skipping consolidation | Fragmented work, duplicate effort | Run consolidation check monthly |
