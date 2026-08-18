# Effort Tracking Reference

Track estimated vs actual effort to improve planning accuracy over time.

---

## Purpose

Estimation accuracy is critical for:

1. **Sprint Planning** — Know how much work fits in a sprint
2. **Prioritization** — Factor true cost into priority decisions
3. **Predictability** — Give stakeholders realistic timelines
4. **Learning** — Identify which work types are consistently mis-estimated

---

## Point Scale

Use fibonacci numbers for relative sizing:

| Points | T-Shirt | Description |
|--------|---------|-------------|
| 1 | XS | Trivial — less than an hour |
| 2 | S | Small — a few hours |
| 3 | M | Medium — half a day to a day |
| 5 | L | Large — 1-2 days |
| 8 | XL | Extra large — 2-3 days |
| 13 | XXL | Epic-sized — should be broken down |

**Rule:** If estimate is 13+, the issue should be broken into smaller issues.

---

## Recording Estimates

## The store

Everything below reads and writes one file:

```
.claude/metrics/effort-tracking.json
```

`{ "issues": { "<issue-id>": {…} }, "summary": {…} }` — the per-issue shape is
under "What gets recorded" below, and `summary` is whatever
`recalculateSummary()` last returned.

Rules for touching it:

- **Absent is normal, not an error.** On first write, create the directory and
  the file with `{"issues":{},"summary":{}}`. Never treat a missing store as a
  reason to refuse the command.
- **Unreadable is an error — and a loud one.** If the file exists but does not
  parse, say so and stop. Do not overwrite it with a fresh object; that silently
  destroys the history the whole reference exists to accumulate.
- **Never block the underlying action on a tracking failure.** `@dex commit` and
  `@dex linear link` do their real work regardless. If the estimate or actual
  could not be recorded, complete the action and say the tracking step failed.
- **No estimate is a normal state.** Report accuracy as unavailable rather than
  assuming a default estimate, which would manufacture a ratio.

### Whose numbers are these?

Check, do not assume — the answer changes what the figures mean, and it differs
per project. There are **three** states, and the middle one is the common one:

```bash
if git check-ignore -q .claude/metrics/; then          echo ignored
elif git ls-files --error-unmatch .claude/metrics/ >/dev/null 2>&1; then echo tracked
else                                                    echo untracked
fi
```

`git check-ignore` alone is not enough. It exits non-zero for *both* a tracked
path and a path git has simply never seen, so treating "not ignored" as "shared"
reports a store that does not exist yet as the team's record.

**tracked** — the store accumulates every contributor's estimates, so report it
as the team's record. Two branches recording estimates will conflict in this
JSON: resolve by unioning the `issues` keys and re-running
`recalculateSummary()`, never by taking one side wholesale, which silently drops
the other branch's history.

**ignored** — one machine's record. Say so, and do not present it as team
velocity: an issue estimated by someone else is simply absent, which reads as a
gap in the work rather than a gap in the data.

**untracked** — one machine's record *for now*, and nobody has decided which it
should be. Report it exactly as `ignored`, and say the decision is open: the
first commit that includes it silently turns every figure into a team-wide claim.
If it should stay private, add `.claude/metrics/` to `.gitignore` rather than
relying on nobody running `git add -A`.

Either way it is a record of what was *recorded*, not of what happened. Work
that nobody estimated is invisible to it.

---

### At Issue Start

When linking to an issue (`@dex linear link`), record the estimate:

```
@dex estimate FND-1060 3
@dex estimate current M
```

**What gets recorded:**
- Issue ID and title (from Linear)
- Issue type and labels (from Linear)
- Estimate in points
- Timestamp

### From Linear

If the issue already has an estimate in Linear, import it:

```json
{
  "FND-1060": {
    "title": "Fix update templates UX",
    "type": "bug",
    "labels": ["fundraising", "ux"],
    "estimate": 2,
    "estimatedAt": "2026-01-19",
    "source": "linear"
  }
}
```

---

## Recording Actuals

### At Issue Close

When closing an issue (`@dex commit` with "fixes FND-XXX"), record actual effort:

```
@dex actual FND-1060 1
@dex actual current less
```

**Relative input options:**
- `less` — Took less than estimated (0.5x)
- `expected` — Took about as estimated (1.0x)
- `more` — Took more than estimated (1.5x)
- `much-more` — Took significantly more (2.0x+)

**What gets recorded:**
- Actual points
- Ratio (actual / estimate)
- Close timestamp
- Optional notes

---

## Calculating Accuracy

### Per Issue

```
ratio = actual / estimate
```

| Ratio | Interpretation |
|-------|----------------|
| < 0.8 | Over-estimated |
| 0.8 - 1.2 | Accurate |
| 1.2 - 1.5 | Slightly under-estimated |
| 1.5 - 2.0 | Under-estimated |
| > 2.0 | Significantly under-estimated |

### Aggregated

For groups (by type, by label), calculate:

```
avgRatio = sum(actual) / sum(estimate)
```

This weighted average prevents small issues from skewing results.

---

## Velocity Report

### Default View (last 30 days)

```
## Velocity Report

### Overall Accuracy
- Issues tracked: 24
- Average ratio: 1.2x (20% under-estimation)

### By Type
| Type | Count | Ratio | Trend |
|------|-------|-------|-------|
| feature | 8 | 1.4x | ⚠️ Under |
| bug | 12 | 0.9x | ✓ Accurate |
| improvement | 4 | 1.1x | ✓ Accurate |

### By Label
| Label | Count | Ratio | Trend |
|-------|-------|-------|-------|
| ai | 5 | 1.8x | ⚠️ Under |
| frontend | 10 | 1.1x | ✓ Accurate |
| backend | 6 | 1.0x | ✓ Accurate |

### Recommendations
- When estimating AI features, multiply by 1.8x
- Features in general run 1.4x over — consider padding
```

### Filtered Views

```
@dex velocity --type feature
@dex velocity --label ai
@dex velocity --days 90
```

---

## Workflow Integration

### At `@dex linear link`

1. Fetch issue from Linear
2. Check if estimate exists
3. If yes, import to the store
4. If no, prompt user for estimate
5. Record with timestamp

### At `@dex commit` (closing issue)

1. Detect closure keywords: "fixes", "closes", "resolves"
2. Look up issue in the store
3. If estimate exists but no actual, prompt for actual
4. Record actual and calculate ratio
5. Update summary statistics

### At `@dex what's next`

1. Load summary statistics
2. When recommending issues, note accuracy patterns:
   ```
   FND-1065: Add AI summarization (3 pts)
   ⚠️ Note: AI features typically take 1.8x estimated
   ```

---

## Data Maintenance

### Recalculating Summary

When actuals are recorded, recalculate:

```javascript
function recalculateSummary(issues) {
  const completed = Object.values(issues).filter(i => i.actual);

  return {
    totalTracked: completed.length,
    avgAccuracyRatio: sum(completed.map(i => i.actual)) / sum(completed.map(i => i.estimate)),
    byType: groupAndCalculate(completed, 'type'),
    byLabel: groupAndCalculate(completed, 'labels')
  };
}
```

### Archiving Old Data

After 6 months, move closed issues out of the active store:

```
.claude/metrics/effort-tracking-archive-<year>.json
```

Keep summary statistics but reduce detail. Archives are read only when someone
asks for a window older than the active store covers.

---

## Privacy & Sharing

- Effort tracking data is **local to the repository**
- Committed to git for transparency and backup
- Does not sync to Linear (estimates stay in Linear, actuals stay local)
- Team members can see historical accuracy data

---

## Anti-Patterns

### Don't

- Track time, track effort (points)
- Penalize inaccurate estimates (it's for learning)
- Compare individuals (it's team data)
- Over-optimize for accuracy (perfect estimation isn't the goal)

### Do

- Use data to inform planning, not judge
- Celebrate improved accuracy over time
- Break down high-variance work types
- Adjust estimates based on patterns
