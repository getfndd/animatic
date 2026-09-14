# Claude Code Changelog Analysis Reference

Protocol for ingesting and analyzing Claude Code platform changes.

---

## Changelog Sources

### Primary Sources
- Claude Code GitHub releases: https://github.com/anthropics/claude-code/releases
- Anthropic changelog: https://docs.anthropic.com/en/changelog
- Claude Code documentation updates

### Ingestion Triggers
- `@dex changelog check` command
- Monday Platform Scan ritual
- User provides changelog content
- Notification of new release

---

## Analysis Protocol

### Step 1: Detect Changes

Categorize each change:

| Category | Examples | Impact Level |
|----------|----------|--------------|
| **New Features** | New tools, new commands, new capabilities | Variable |
| **Behavioral Changes** | Different default behavior, changed outputs | High |
| **Deprecations** | Removed features, sunset warnings | High |
| **Bug Fixes** | Corrected behavior | Low-Medium |
| **Performance** | Speed improvements, reduced token usage | Low |
| **Security** | Security patches, new safeguards | Critical |

### Step 2: Assess Impact

For each change, evaluate:

**Code Review Impact:**
- Does this affect what we should check for?
- Does this enable new patterns we should recommend?
- Does this make previously safe code unsafe?

**Prompt Design Impact:**
- Do our instructions need updating?
- Are there new capabilities to leverage?
- Are there deprecated patterns to remove?

**Security Impact:**
- Does this change trust boundaries?
- Does this affect data handling?
- Does this require new safeguards?

**Documentation Impact:**
- Do our docs reference changed behavior?
- Do our examples still work?
- Do our workflows need updating?

**Workflow Impact:**
- Does this change how we commit/review/release?
- Does this affect our automation?
- Does this change our gates?

### Step 3: Classify

| Classification | Criteria | Action Required |
|---------------|----------|-----------------|
| **No Action** | Informational, doesn't affect our workflow | Log only |
| **Optional Improvement** | Could improve workflow but not required | Propose, prioritize later |
| **Required Change** | Workflow is broken or unsafe without update | Immediate action |

**Required Change triggers:**
- Security-related changes
- Breaking changes to tools we use
- Deprecated features we depend on
- Behavioral changes that affect correctness

### Step 4: Act

For each Required or Optional change:

1. **Identify affected artifacts:**
   - SKILL.md commands
   - REFLEX.md triggers
   - Reference docs
   - CLAUDE.md instructions
   - Automation scripts

2. **Draft specific updates:**
   - What exact text changes?
   - What new rules needed?
   - What old rules removed?

3. **Estimate effort:**
   - Immediate (< 30 min)
   - Short-term (< 1 day)
   - Planned (needs scheduling)

---

## Output Template

```markdown
## Claude Code Change Summary

**Release:** [Version or Date]
**Source:** [URL or reference]

### Changes Detected

| Change | Category | Impact |
|--------|----------|--------|
| [Description] | [Category] | [High/Med/Low] |

### Analysis

#### [Change 1]

**What Changed:**
[Concise description]

**Why It Matters:**
[Impact on our workflow]

**Affected Areas:**
- [ ] Code review
- [ ] Documentation
- [ ] Security
- [ ] Workflow
- [ ] Release

**Classification:** No Action | Optional Improvement | Required Change

**Recommended Actions:**
1. [Specific action]
2. [Specific action]

**Gate Impact:** Does this block commits? Yes / No

---

### Summary

| Classification | Count |
|---------------|-------|
| No Action | X |
| Optional Improvement | X |
| Required Change | X |

**Immediate Actions Required:**
- [Action 1]
- [Action 2]

**Scheduled for Later:**
- [Action 1]
```

---

## Weekly Platform Scan Ritual

**Trigger:** Every Monday or `@dex platform scan`

**Process:**

1. **Gather:**
   - Check Claude Code releases since last scan
   - Check Anthropic changelog
   - Review any user-reported issues

2. **Analyze:**
   - Run full protocol on each change
   - Aggregate findings

3. **Report:**
   - Use output template
   - Highlight Required Changes prominently
   - Note Optional Improvements for backlog

4. **Enforce:**
   - If Required Changes exist:
     - Flag in-progress work
     - Block commits if security-related
     - Schedule immediate updates

5. **Update:**
   - Persist learnings to LEARNINGS.md
   - Update reference docs as needed
   - Log scan completion date

**Scan Log Format:**
```markdown
## Platform Scan Log

| Date | Release Checked | Required Changes | Actions Taken |
|------|-----------------|------------------|---------------|
| [Date] | [Version] | [Count] | [Brief summary] |
```

---

## Common Impact Patterns

### Tool Changes

**New tool added:**
- Evaluate if it improves our workflow
- Document usage patterns
- Update relevant commands

**Tool behavior changed:**
- Check if our instructions assume old behavior
- Update prompts if needed
- Test affected workflows

**Tool deprecated:**
- Find all uses in our prompts
- Plan migration
- Set deadline for removal

### Security Changes

**New safeguard added:**
- Understand what it protects against
- May need to update our patterns to work with it
- Usually no action needed

**Safeguard removed/relaxed:**
- Critical review needed
- May need to add our own checks
- Document in LEARNINGS.md

### Capability Changes

**New capability:**
- Evaluate for workflow improvements
- Add to Optional Improvements if useful
- Document patterns

**Capability removed:**
- Check for dependencies
- Required Change if we depend on it
- Plan workaround

---

## Escalation Criteria

**Escalate to team immediately if:**
- Security vulnerability discovered
- Breaking change to critical tool
- Data handling behavior changed
- Authentication/authorization affected

**Escalation format:**
```markdown
## URGENT: Claude Code Platform Change

**Severity:** Critical / High
**Change:** [Brief description]
**Impact:** [What breaks or becomes unsafe]
**Recommended Action:** [What to do now]
**Deadline:** [When this must be addressed]
```

---

# Platform Evolution, Remote Execution, and the Weekly Scan

Moved out of SKILL.md. These are the command surface and output formats for
Dex's platform-monitoring work, plus the remote/teleport workflow. Load when
running a platform scan, a changelog analysis, or a remote task.

## Platform Evolution Responsibility

You actively monitor Claude Code platform changes and treat them as inputs to our engineering process.

Your job is not to summarize updates — it is to **translate them into workflow decisions**.

When Claude Code changes, you are responsible for determining:

1. Does this affect how we write code?
2. Does this affect how we review code?
3. Does this affect security or correctness guarantees?
4. Does this require prompt, process, or documentation updates?

---

## Changelog Ingestion & Analysis Protocol

Whenever a Claude Code changelog is provided (manually or via automation), run the following evaluation loop without being asked:

### Step 1: Detect

Identify:
- New features
- Behavioral changes
- Deprecations
- Tooling or capability shifts

### Step 2: Assess Impact

Evaluate impact on:
- Code review depth or reliability
- Prompt design and structure
- Security assumptions
- Documentation expectations
- Release or CI workflows

### Step 3: Classify

Classify each change as one of:

| Classification | Definition | Action |
|---------------|------------|--------|
| **No Action** | Informational only | Log and acknowledge |
| **Optional Improvement** | Workflow enhancement | Propose update |
| **Required Change** | Must update process or gates | Immediate action |

### Step 4: Act

For any Optional or Required change, propose specific updates to:
- Dex commands
- Review checklists
- Commit / PR requirements
- Team documentation
- Automation rituals

---

## Required Output Format for Changelog Analysis

When reporting on Claude Code changes, use this structure:

```markdown
## Claude Code Change Summary
- What changed (concise)

## Why It Matters
- Impact on quality, safety, or velocity

## Affected Areas
- Code review / Docs / Security / Workflow / Release

## Classification
- No Action | Optional Improvement | Required Change

## Recommended Actions
- Concrete steps (commands, prompt updates, docs to change)

## Gate Impact
- Does this block commits? Yes / No
```

**Vague recommendations are not allowed.**

---

## Commands (Platform Evolution)

### `@dex changelog check`

Ingest latest Claude Code changelog and analyze impact.

**Input:** Changelog URL, text, or "latest"
**Output:** Structured analysis per format above

### `@dex workflow suggest`

Propose workflow or process updates based on recent learnings.

### `@dex impact analysis`

Risk/benefit analysis of recent platform changes.

---

## Remote Execution & Teleport Workflow

Dex supports offloading tasks to cloud sessions and pulling them back locally.

### Parallel Remote Tasks (`&` prefix)

Send independent tasks to run on claude.ai/code while continuing local work:

```
& Run the full test suite and fix any failures
& Update the design system health report
& Audit accessibility across portal components
```

Each `&` creates a separate cloud session. Monitor with `/tasks`.

**Best pattern — Plan locally, execute remotely:**
```
@rams plan the button migration

[... refine the plan ...]

& Execute the button migration plan we discussed
```

### Teleport (`/teleport`)

Pull cloud sessions back to your terminal:

```
/teleport       # interactive picker
/tp             # shorthand
```

Or from the command line:
```bash
claude --teleport
claude --teleport <session-id>
```

**Requirements:**
- Clean git state (no uncommitted changes)
- Same repository checkout (not a fork)
- Same Claude.ai account
- Branch pushed to remote

**Limitation:** One-way only. Can pull web → terminal, but not push terminal → web. If you might need cloud execution, start with `&`.

### When to Use Remote Execution

| Scenario | Approach |
|----------|----------|
| Long test suite | `& Run tests and fix failures` |
| Independent doc generation | `& Generate API docs for the KB module` |
| Parallel bug fixes | Multiple `&` commands |
| Complex feature (needs steering) | Work locally |
| Quick fix | Work locally |

### Monitoring

- `/tasks` — List all background sessions
- Press `t` on a session to teleport into it
- Sessions also visible at claude.ai/code and Claude iOS app

---

## Weekly Automation Ritual: Monday Platform Scan

Every Monday (or when invoked), perform the Platform Scan Ritual.

### Ritual Steps

**1. Ingest**
- Review the latest Claude Code changelog since last scan

**2. Analyze**
- Run the full Changelog Ingestion & Analysis Protocol

**3. Report**
- Summarize findings using the required output format

**4. Enforce**
- If a change is classified as **Required Change**:
  - Flag active work as process-blocked
  - Recommend immediate updates to prompts, workflows, or docs

### Ritual Output Title
```
## Weekly Dex Platform Scan — Claude Code
[Date range]
```

This ritual exists to **prevent process drift**.
