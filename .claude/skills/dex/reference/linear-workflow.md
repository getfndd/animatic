# Linear Workflow Reference

Linear issue management patterns for `@dex linear *` commands.

---

## Issue Lifecycle

### States

| State | Meaning | When to Use |
|-------|---------|-------------|
| **Backlog** | Not started, not prioritized | Captured ideas, future work |
| **Todo** | Prioritized, ready to start | Committed to this sprint/cycle |
| **In Progress** | Actively being worked on | Someone is working on it now |
| **In Review** | Code complete, awaiting review | PR open, awaiting feedback |
| **Done** | Shipped to production | Merged and deployed |
| **Canceled** | Will not be done | Descoped, duplicate, or obsolete |

### State Transitions

```
Backlog → Todo → In Progress → In Review → Done
                     ↓              ↓
                 Canceled       Canceled
```

**Rules:**
- Only one state change per action
- Never skip states (except to Canceled)
- Update state promptly as work progresses

---

## Issue Linking

### Commit Messages

Format:
```
type(scope): Description

[Body if needed]

Fixes: ISSUE-123
```

**Link types:**
- `Fixes: ISSUE-123` - Closes issue when merged
- `Relates: ISSUE-123` - Related but doesn't close
- `Part of: ISSUE-123` - Partial progress on issue

### PR Linking

**PR title format:**
```
[ISSUE-123] Brief description of change
```

**PR body should include:**
```markdown
## Linear Issue
Fixes [ISSUE-123](https://linear.app/{team}/issue/ISSUE-123)

## Changes
- Change 1
- Change 2

## Testing
- [ ] Test case 1
- [ ] Test case 2
```

---

## Issue Types

### Bug

**Required fields:**
- Title: Clear description of the bug
- Description: Steps to reproduce, expected vs actual behavior
- Priority: Based on impact and frequency

**Template:**
```markdown
## Bug Report

**Steps to Reproduce:**
1. ...
2. ...

**Expected Behavior:**
...

**Actual Behavior:**
...

**Environment:**
- Browser/OS: ...
- User type: ...
```

### Feature

**Required fields:**
- Title: Clear description of the feature
- Description: User story, acceptance criteria
- Priority: Based on business value

**Template:**
```markdown
## Feature Request

**User Story:**
As a [role], I want to [action] so that [benefit].

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Out of Scope:**
- ...
```

### Task

**Required fields:**
- Title: Clear description of the task
- Description: What needs to be done

**Template:**
```markdown
## Task

**Objective:**
...

**Steps:**
1. ...
2. ...

**Definition of Done:**
- [ ] ...
```

### Sub-Issue

**When to create:**
- Breaking down a large feature
- Parallel workstreams
- Tracking individual components

**Rules:**
- Always link to parent issue
- Inherit labels from parent
- Status updates should reflect on parent

---

## Labels

### Type Labels

| Label | Use For |
|-------|---------|
| `bug` | Something is broken |
| `feature` | New functionality |
| `enhancement` | Improvement to existing |
| `refactor` | Code improvement, no behavior change |
| `docs` | Documentation only |
| `chore` | Maintenance, dependencies |

### Area Labels

| Label | Use For |
|-------|---------|
| `frontend` | UI/React code |
| `backend` | API/server code |
| `infrastructure` | DevOps, CI/CD |
| `design` | Design system, UX |

### Priority Labels

| Label | Criteria |
|-------|----------|
| `urgent` | Production down, security issue |
| `high` | Blocks other work, significant user impact |
| `medium` | Important but not blocking |
| `low` | Nice to have |

---

## Epic Management

### Epic Structure

```
Epic: [Major Feature/Initiative]
├── Issue: [Component 1]
├── Issue: [Component 2]
├── Issue: [Component 3]
└── Issue: [Testing/Polish]
```

### Epic Progress Tracking

**Check epic progress before asking "what's next":**

1. List all issues in the epic
2. Count by status:
   - Done: X
   - In Progress: X
   - Todo: X
   - Blocked: X
3. Calculate completion percentage
4. Identify blockers

**Epic completion criteria:**
- All sub-issues Done or Canceled
- Documentation complete
- No known bugs in scope

---

## Commands Reference

### `@dex linear status`

**Output:**
```markdown
## Current Linear Status

**Active Issue:** ISSUE-123 - [Title]
**State:** In Progress
**Epic:** [Epic Name] (3/7 issues complete)

**Related Issues:**
- ISSUE-124 - Blocked by this issue
- ISSUE-125 - Related work

**Recent Activity:**
- [Date]: State changed to In Progress
- [Date]: Comment added
```

### `@dex linear link [issue]`

**Process:**
1. Validate issue exists
2. Update issue state to In Progress (if not already)
3. Store issue ID in session context
4. Report confirmation

### `@dex linear update [status]`

**Process:**
1. Validate current issue is linked
2. Validate status transition is allowed
3. Update issue status
4. Add comment with context (optional)
5. Report confirmation

### `@dex linear create [title]`

**Process:**
1. Create issue with title
2. Prompt for:
   - Description (optional)
   - Labels (optional)
   - Priority (optional)
   - Parent issue (optional)
3. Link to current work
4. Report issue ID

### `@dex what's next`

**Priority order:**
1. Issues assigned to me, In Progress
2. Issues blocking other work
3. Issues in current epic, Todo state
4. Issues assigned to me, Todo state
5. Unassigned issues in current sprint

**Output:**
```markdown
## What's Next

**Current epic:** [Epic Name]

### In Progress (finish these first)
1. ISSUE-123 - [Title] - [time in progress]

### Ready to Start
1. ISSUE-124 - [Title] - [priority]
2. ISSUE-125 - [Title] - [priority]

### Blocked
- ISSUE-126 - Blocked by: [reason]

**Recommendation:** Continue with ISSUE-123, then ISSUE-124.
```

---

## Anti-Patterns

### Don't Do This

| Anti-Pattern | Why Bad | Do Instead |
|--------------|---------|------------|
| Skip states | Loses tracking | Move through each state |
| Multiple issues In Progress | Context switching | Focus on one |
| No issue for work | Invisible work | Create issue first |
| Issue too big | Never finishes | Break into sub-issues |
| Forget to close | Stale issues | Close when merged |
| Start new epic before finishing | Scope creep | Complete current epic |

### Scope Creep Prevention

**Before starting new work, check:**
1. Is current issue complete?
2. Is current epic complete?
3. Is the new work urgent?

**If current work incomplete:**
- Don't start new work
- Report remaining items
- Ask for explicit approval to switch context

---

## Integration Points

### Git Integration

- Commits reference issue IDs
- PR titles include issue IDs
- Merge closes linked issues automatically

### CI/CD Integration

- Deploys update issue status
- Test results can be linked
- Build failures can create issues

### Slack/Discord Integration

- Issue updates notify channel
- Comments sync (if configured)
- Status changes visible
