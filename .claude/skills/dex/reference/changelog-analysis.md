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
