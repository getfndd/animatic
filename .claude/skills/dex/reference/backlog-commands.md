# Backlog Commands

Command definitions and report formats for Dex's Linear and backlog work.
Loaded when running any `@dex linear …`, `@dex backlog …`, or `@dex epic …`
command — the report templates below are long and only matter once you are
actually producing one.

The *methodology* behind these commands — ICE scoring, grooming protocol,
cleanup patterns, consolidation signals, epic lifecycle, cycle planning —
lives in `backlog-management.md`. This file is the command surface; that one
is the reasoning.

---

## Backlog Management

Maintain backlog health through regular audits, quality checks, and structured grooming.

**Reference:** `${CLAUDE_SKILL_DIR}/reference/backlog-management.md`

### Issue Quality Standards (INVEST)

Well-formed issues should be:

| Criterion | Question | Red Flag |
|-----------|----------|----------|
| **Independent** | Can this be worked on without blocking others? | Circular dependencies |
| **Negotiable** | Is scope flexible until committed? | Over-specified implementation |
| **Valuable** | Does it deliver user or business value? | Technical tasks without context |
| **Estimable** | Can we estimate effort? | Vague requirements, no acceptance criteria |
| **Small** | Can it be completed in a sprint? | Multi-week scope |
| **Testable** | Can we verify when it's done? | No success criteria |

### `@dex linear audit`

Comprehensive backlog audit. Identifies issues requiring attention.

**Checks for:**
- **Stale issues** — No updates in 30+ days while In Progress
- **Orphan issues** — Not linked to any project or epic
- **Missing fields** — No estimate, no labels, no assignee
- **Blocked chains** — Issues blocked by other blocked issues
- **Scope creep** — Issues that have grown beyond original estimate
- **Duplicates** — Similar titles or descriptions

**Output format:**
```
## Backlog Audit — [Team]

### Critical (Action Required)
- FND-XXX: Stale 45 days, In Progress — needs status update or reassignment
- FND-YYY: Blocked by FND-ZZZ which is also blocked — dependency chain

### Warnings
- FND-AAA: No estimate — add before sprint planning
- FND-BBB: Orphan issue — link to project or close

### Health Score: X/100
- Stale rate: X%
- Orphan rate: X%
- Estimated rate: X%
```

### `@dex linear health`

Quick backlog health metrics dashboard.

**Output format:**
```
## Backlog Health — [Team]

| Metric | Value | Status |
|--------|-------|--------|
| Total open issues | XX | — |
| Stale (>30 days) | XX | WARN if >10% |
| Orphan issues | XX | WARN if >5 |
| Missing estimates | XX | WARN if >20% |
| Blocked issues | XX | — |
| Avg issue age | XX days | — |

Overall: HEALTHY / NEEDS ATTENTION / CRITICAL
```

### `@dex linear stale [days]`

List issues with no activity in specified period.

**Default:** 30 days
**Parameters:** Optional day count (e.g., `@dex linear stale 14`)

**Output:** List of stale issues with last activity date, assignee, and suggested action.

### `@dex linear blockers`

Show all blocked issues and their dependency chains.

**Output format:**
```
## Blocked Issues — [Team]

### Blocking Chains
FND-AAA (blocked)
  └── blocked by: FND-BBB (in progress, @person)
      └── blocked by: FND-CCC (done) ← Unblock opportunity!

### Immediate Unblocks
These issues are blocked by completed work — update status:
- FND-XXX blocked by FND-YYY (completed 3 days ago)
```

### `@dex linear triage`

Process untriaged issues (Triage or Backlog status without project assignment).

**Process:**
1. List untriaged issues
2. For each, suggest: project assignment, labels, estimate range
3. Offer to bulk-update with confirmation

**Output format:**
```
## Triage Queue — [Team]

### Needs Assignment (X issues)
1. FND-XXX: "Feature title"
   Suggested: Project=Portal, Labels=[frontend, portal], Est=M

2. FND-YYY: "Bug title"
   Suggested: Project=Core, Labels=[bug, api], Est=S

### Actions
- Assign all suggestions? [requires confirmation]
- Skip and review individually
```

### `@dex linear groom [epic|project]`

Generate grooming agenda for an epic or project.

**Output format:**
```
## Grooming Agenda — [Epic/Project Name]

### Issues to Review (X total)

#### Needs Refinement
- FND-XXX: Missing acceptance criteria
- FND-YYY: Estimate seems low for scope described

#### Ready for Sprint
- FND-AAA: Well-defined, estimated, no blockers
- FND-BBB: Well-defined, estimated, no blockers

#### Parking Lot (Consider Closing)
- FND-ZZZ: No activity 60 days, may be obsolete

### Suggested Discussion Points
1. FND-XXX scope — is this one issue or should we split?
2. FND-YYY dependency on external team — status?
```

### `@dex linear cleanup`

Suggest issues to close or archive.

**Criteria for closure suggestions:**
- No activity in 90+ days
- Marked as "Won't Fix" or "Duplicate" without being closed
- Completed sub-issues of completed epics
- Issues superseded by other work

**Output:** List of candidates with reasoning, requires confirmation before action.

### `@dex linear sweep`

Cross-reference recent git history against open Linear issues to find completed work that hasn't been closed.

**Algorithm:**
1. Extract all `FND-XXXX` references from git log (last 7 days by default)
2. Query each referenced issue's Linear status
3. Flag any that are still Backlog/Todo/In Progress with matching commits as evidence
4. Present a table: issue, current status, relevant commits
5. **Never auto-close** — human decides what's actually done

**Parameters:** Optional day range (e.g., `@dex linear sweep 14` for last 14 days)

**Output:** Table of candidates for closure, or "sweep clean" if no stale issues found. Always requires human confirmation before any status change.

**Why not auto-close:** Commits don't mean done. Edge functions need deploying, migrations need applying, UI needs manual testing. The sweep surfaces candidates — the human decides.

### Recommended Labeling Taxonomy

For consistent backlog organization:

| Prefix | Purpose | Examples |
|--------|---------|----------|
| `type/` | Issue category | `type/feature`, `type/bug`, `type/chore`, `type/spike` |
| `area/` | Product area | `area/portal`, `area/cap-table`, `area/ai`, `area/auth` |
| `effort/` | T-shirt size | `effort/S`, `effort/M`, `effort/L`, `effort/XL` |
| `priority/` | Urgency | `priority/critical`, `priority/high`, `priority/low` |

### Grooming Cadence Recommendations

| Cadence | Activity | Command |
|---------|----------|---------|
| Daily | Check blockers | `@dex linear blockers` |
| Weekly | Sweep git↔Linear for stale issues | `@dex linear sweep` |
| Weekly | Quick health dashboard | `@dex backlog` |
| Bi-weekly | Full grooming session | `@dex backlog groom` |
| Cycle start | Plan next cycle | `@dex backlog plan` |
| Mid-cycle | Prioritize upcoming work | `@dex backlog prioritize` |
| Quarterly | Epic lifecycle review | `@dex epic health` on all active epics |

---

## Backlog Strategy & Prioritization

Strategic backlog management that goes beyond hygiene into prioritization, consolidation, and cycle planning. Dex orchestrates; Eames provides strategic judgment; the team contributes at their touch points.

**Reference:** `${CLAUDE_SKILL_DIR}/reference/backlog-management.md` — full framework, scoring model, health metrics, collaboration model.

### `@dex backlog`

Quick health dashboard. One-screen summary of backlog state.

**Process:**
1. Query Linear for issue counts by status
2. Calculate health metrics (stale rate, orphan rate, estimation coverage, priority distribution)
3. Compare against thresholds (Healthy / Warning / Critical)
4. Report with overall health grade

**Output format:**
```
## Backlog Dashboard — [Project]

| Metric | Value | Status |
|--------|-------|--------|
| Total open | XX | — |
| Backlog | XX | — |
| In Progress | XX | — |
| Stale (>90 days) | XX (X%) | HEALTHY / WARN / CRITICAL |
| Orphan (no project) | XX (X%) | HEALTHY / WARN / CRITICAL |
| Estimation coverage | X% | HEALTHY / WARN / CRITICAL |
| Triage inbox | XX | HEALTHY / WARN / CRITICAL |
| Avg backlog age | XX days | HEALTHY / WARN / CRITICAL |

Overall: HEALTHY / NEEDS ATTENTION / CRITICAL

### Action Items
- X stale issues need review
- X orphans need assignment
- X epics ready to close
```

### `@dex backlog groom`

Full guided grooming session. Multi-step, interactive. Pauses for user input at each step. Estimated time: 20-40 minutes.

**Process:**
1. **Health Snapshot** — Run dashboard, highlight critical metrics, set context
2. **Triage Inbox** — Process untriaged items. Suggest project, labels, estimate. *(Dex leads, Eames consulted on priority calls)*
3. **Stale Sweep** — Review items with no update in 90+ days. Recommend keep/close/split. *(Dex detects, Eames decides strategic value)*
4. **Orphan Round-Up** — Find issues with no project/epic. Suggest assignment or closure. *(Dex identifies, Eames assigns to strategic buckets)*
5. **Duplicate Detection** — Fuzzy-match titles, find overlapping scope. Suggest merges. *(Dex only)*
6. **Superseded Check** — Cross-reference backlog against shipped work. Suggest closures. *(Dex only)*
7. **Epic Review** — Active epics: completion stats, scope creep, duration. Close candidates. *(Eames leads, Rams consulted on scope)*
8. **Prioritize Top Items** — ICE scoring on top 15-20 items. MoSCoW tiers on epics. *(Eames leads Impact/Confidence. Hicks provides Ease. Rams provides user-value lens)*
9. **Summary & Actions** — Report changes, outstanding decisions, updated health, next grooming date

**Output:** Each step produces its own section. Final summary includes before/after health metrics.

**Persona collaboration:**
- Eames is consulted at steps 2 (priority calls), 3 (strategic value), 4 (bucket assignment), 7 (epic decisions), 8 (ICE scoring)
- Rams is consulted at steps 7 (scope) and 8 (user value)
- Hicks is consulted at step 8 (effort/ease scoring)

### `@dex backlog prioritize [scope]`

Score and rank backlog items using ICE framework. Can be scoped to a project, epic, or the full backlog.

**Parameters:**
- `[scope]` — Optional. Project name, epic ID, or "all" (default: items in Todo + top Backlog)

**Process:**
1. Pull candidate issues from Linear (filtered by scope)
2. For each issue, evaluate:
   - **Impact** (1-10) — Eames scores: business value, user impact, strategic alignment
   - **Confidence** (1-10) — Eames scores: evidence quality, certainty of impact
   - **Ease** (1-10) — Hicks scores: effort, complexity, risk (inverse)
3. Calculate ICE score: `(Impact × Confidence × Ease) / 10`
4. Rank by score descending
5. Apply MoSCoW tiers at epic level if not already set
6. Present ranked list with rationale

**Output format:**
```
## Backlog Prioritization — [Scope]

### MoSCoW Tiers (Epic Level)
| Tier | Epics |
|------|-------|
| Must | [Epic A], [Epic B] |
| Should | [Epic C] |
| Could | [Epic D], [Epic E] |
| Won't (this quarter) | [Epic F] |

### Ranked Issues (Top 20)

| Rank | Issue | Title | I | C | E | ICE | Tier |
|------|-------|-------|---|---|---|-----|------|
| 1 | FND-XXX | [Title] | 9 | 8 | 7 | 50.4 | Must |
| 2 | FND-YYY | [Title] | 8 | 7 | 8 | 44.8 | Must |
| ... | | | | | | | |

### Rationale
- **FND-XXX**: [Eames: why high impact] [Hicks: why easy/hard]
- **FND-YYY**: [Eames: strategic alignment note]

### Recommended Next Cycle
Pull items 1-5 (estimated X days, fits within capacity)
```

### `@dex backlog consolidate`

Find related issues that should be grouped into epics. Detect duplicates. Suggest merges.

**Process:**
1. Scan backlog for issues with overlapping titles, descriptions, or affected components
2. Group candidates by user outcome (not technical similarity)
3. For each group, recommend:
   - **Merge** — duplicates covering the same scope → close duplicates, keep canonical
   - **Epic** — 3+ related issues serving one outcome → create parent epic
   - **Absorb** — issue scope already covered by shipped work → close as superseded
4. Present recommendations with Eames providing scope/outcome judgment
5. Execute changes only with user confirmation

**Output format:**
```
## Consolidation Report — [Project]

### Duplicate Groups (merge candidates)
1. **Email Integration** (3 issues → 1)
   - FND-66: "Add email integration" (Oct 2025) — CLOSE (superseded)
   - FND-1671: "Microsoft Outlook Integration" (Mar 2026) — CLOSE (absorbed)
   - FND-1678: "Multi-Provider Email Integration" (Mar 2026) — KEEP (canonical)

### Epic Candidates (group into parent)
1. **[Suggested Epic Name]** (X issues)
   - FND-AAA, FND-BBB, FND-CCC
   - Shared outcome: [description]
   - Eames: [strategic rationale]

### Superseded (close candidates)
- FND-70: "Thesis matching" — Shipped as FND-1637
- FND-698: "Bulk upload" — Shipped in Data Room Upload epic

### Actions
- Close X duplicates/superseded issues? [requires confirmation]
- Create X new epics? [requires confirmation]
```

### `@dex backlog plan [cycle]`

Generate a cycle plan from the prioritized backlog. Checks capacity, dependencies, and strategic goals.

**Parameters:**
- `[cycle]` — Optional. "next" (default), or a date range

**Process:**
1. **Review goals** — Eames: What are the must-haves this cycle?
2. **Assess capacity** — Plan to 80% (reserve 20% for unplanned). Solo: ~8 productive days per 2-week cycle.
3. **Pull from backlog** — Start with carryovers, then highest ICE-scored ready items
4. **Dependency check** — Don't pull blocked items. Flag items with unresolved blockers.
5. **Validate scope** — Total estimate fits capacity? Clear cycle goal? Items small enough?
6. **Assign owners** — Every item needs one owner
7. **Output plan** — Goal + ranked list + risks + deferred items

**Output format:**
```
## Cycle Plan — [Date Range]

### Goal
[1-2 sentence cycle goal — set by Eames]

### Capacity
- Available: X person-days
- Planned: Y person-days (Z% utilization)

### Must Complete (carryover)
1. FND-XXX — [Title] — Est: M — @owner

### Planned
1. FND-XXX — [Title] — Est: S — ICE: 50.4 — @owner
2. FND-YYY — [Title] — Est: M — ICE: 44.8 — @owner

### Stretch (if capacity allows)
1. FND-ZZZ — [Title] — Est: S — ICE: 38.0

### Dependencies & Risks
- FND-AAA blocked by FND-BBB (In Progress, expected done Day 3)
- FND-CCC touches auth flow — ELEVATED risk (see @dex risk)

### Deferred (not this cycle)
- FND-DDD — Reason: blocked by external dependency
- FND-EEE — Reason: Could tier, insufficient capacity
```

### `@dex epic health [epic]`

Check health of a specific epic or all active epics.

**Parameters:**
- `[epic]` — Optional. Epic issue ID (e.g., FND-1627) or "all" (default)

**Process:**
1. Pull epic and all sub-issues from Linear
2. Calculate metrics:
   - Sub-issue count (original vs. current — delta = scope creep)
   - Completion percentage
   - Duration (start → now)
   - Stale sub-issues (in backlog/todo, no recent activity)
   - Blocked sub-issues
   - Missing estimates on remaining work
3. Flag issues:
   - Scope creep: >50% new issues since kickoff
   - Duration creep: >3 months active
   - Ready to close: all sub-issues done
4. Eames evaluates: still strategically relevant? Scope appropriate?

**Output format:**
```
## Epic Health — [Epic Title]

| Metric | Value | Status |
|--------|-------|--------|
| Sub-issues | X total (Y original, Z added) | WARN if Z > 50% of Y |
| Completed | X/Y (Z%) | — |
| Duration | X months | WARN if > 3 months |
| Stale sub-issues | X | WARN if > 0 |
| Blocked sub-issues | X | — |
| Estimated | X/Y remaining | WARN if < 80% |

### Scope Creep
[Analysis — added issues list if applicable]

### Eames Assessment
[Strategic relevance, scope recommendation: continue / split / close / pivot]

### Recommendations
- [Specific actions: close epic, split, re-estimate, unblock, etc.]
```

### `@dex epic close [epic]`

Close an epic with a summary. Handle orphan sub-issues.

**Parameters:**
- `[epic]` — Epic issue ID (required)

**Process:**
1. Verify all sub-issues are Done or Canceled
2. If open sub-issues remain:
   - List them with status
   - Ask: close as partial delivery, or finish first?
3. Generate epic summary (what shipped, what was cut, duration)
4. Move any orphan sub-issues to appropriate project or close
5. Update Linear: mark epic Done
6. Suggest release note if user-facing work

**Output format:**
```
## Epic Closed — [Epic Title]

### Summary
- Duration: X weeks (started [date])
- Shipped: X/Y sub-issues
- Canceled: X sub-issues
- Scope change: +X/-Y issues during lifecycle

### What Shipped
- FND-XXX: [Title]
- FND-YYY: [Title]

### What Was Cut
- FND-ZZZ: [Title] — Reason: [deprioritized / moved to new epic / obsolete]

### Orphan Sub-Issues (moved)
- FND-AAA → moved to [Project/Epic]

### Release Note
[Suggested user-facing release note if applicable]
```
