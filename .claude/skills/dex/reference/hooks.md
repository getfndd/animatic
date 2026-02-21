# Dex Hooks Reference

Claude Code hooks that support the Dex workflow.

---

## Setup Hook

**File:** `.claude/hooks/setup.sh`
**Event:** `Setup` (triggered via `--init`, `--init-only`, `--maintenance`)
**Purpose:** Automatic repo health check on initialization

### When It Runs

The Setup hook runs when:
- `claude --init` - First-time project initialization
- `claude --init-only` - Re-run initialization without starting session
- `claude --maintenance` - Run maintenance tasks

### What It Checks

1. **Worktrees** - Detects orphan worktrees that should be cleaned up
2. **Working tree** - Checks for uncommitted changes
3. **Remote sync** - Verifies local branch is in sync with remote
4. **Branch count** - Warns if too many local branches exist
5. **Current branch** - Shows current branch (warns if not main)

### Output

```
==========================================
Dex Repo Health Check
==========================================
Checking worktrees... OK
Checking working tree... Clean
Checking remote sync... In sync
Checking branches... OK (3 branches)
Current branch... main
==========================================
Repository is healthy.
==========================================
```

### Configuration

Configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "Setup": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/setup.sh"
          }
        ]
      }
    ]
  }
}
```

### Manual Invocation

The hook script can also be run manually:

```bash
.claude/hooks/setup.sh
```

Or use the Dex command for more detailed output:

```
@dex repo check
```

---

## Hook Events Reference

| Event | Trigger | Use Case |
|-------|---------|----------|
| `Setup` | `--init`, `--init-only`, `--maintenance` | Repo initialization |
| `SessionStart` | Session begins or resumes | Environment setup |
| `PreToolUse` | Before tool execution | Validation, context injection |
| `PostToolUse` | After tool execution | Logging, side effects |
| `UserPromptSubmit` | User submits prompt | Input validation |
| `Stop` | Claude finishes responding | Cleanup, notifications |
| `SubagentStop` | Subagent finishes responding | Subagent cleanup (v2.1+) |
| `TeammateIdle` | Agent team member becomes idle | Multi-agent coordination (v2.1+) |
| `TaskCompleted` | Agent task finishes | Multi-agent workflow triggers (v2.1+) |

### New in v2.1: `last_assistant_message` field

The `Stop` and `SubagentStop` hook events now include a `last_assistant_message` field in their input JSON. This contains the final message from Claude before the stop event, useful for post-processing or logging.

### Multi-Agent Hook Patterns

**`TeammateIdle`** — fires when a parallel agent becomes idle. Use to chain work:
```json
{
  "hooks": {
    "TeammateIdle": [{
      "hooks": [{
        "type": "command",
        "command": "echo 'Agent idle — check if work can be assigned'"
      }]
    }]
  }
}
```

**`TaskCompleted`** — fires when a Task tool subagent finishes. Use to trigger follow-up:
```json
{
  "hooks": {
    "TaskCompleted": [{
      "hooks": [{
        "type": "command",
        "command": "echo 'Task done — trigger next step'"
      }]
    }]
  }
}
```

These are useful for reactive multi-agent orchestration but are not yet adopted in our workflow. Consider for future use when we formalize subagent patterns.

---

## PreToolUse: Feature Branch Guard Hook

**File:** `.claude/hooks/pre-commit-branch-guard.sh`
**Event:** `PreToolUse`
**Matcher:** `Bash` (filters for `git commit` internally)
**Purpose:** Block `feat()` commits on main — enforce feature branch policy

### When It Runs

The hook runs on all Bash commands but only checks when:
- Command contains `git commit`
- Commit message contains `feat(`

### What It Does

1. Detects `feat()` pattern in the commit command
2. Checks if current branch is `main` or `master`
3. If on main: **blocks the commit** (exit code 2) with instructions to create a feature branch
4. If on a feature branch: exits silently

### Why It Hard-Blocks

Feature work must use feature branches per CLAUDE.md policy. `fix`, `chore`, `docs` commits are allowed directly on main.

---

## PreToolUse: Commit Context Hook

**File:** `.claude/hooks/pre-commit-context.sh`
**Event:** `PreToolUse`
**Matcher:** `Bash` (filters for `git commit` internally)
**Purpose:** Inject commit guidelines before git commits

### When It Runs

The hook runs on all Bash commands but only injects context when:
- Command contains `git commit`

### What It Provides

When a git commit is detected, adds `additionalContext` containing:

1. **Recent Commit Style** - Last 5 commit messages for reference
2. **Staged Files** - Files about to be committed
3. **Commit Message Guidelines** - Format, types, co-author tag

### Example Output

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "## Commit Context (from Dex)\n\n### Recent Commit Style\n```\nc10893e feat(ISSUE-1050): Add Setup hook...\n4b02a52 feat(skills): Add Dex DevOps skill...\n```\n\n### Commit Message Guidelines\n- Format: type(scope): Description\n- Include Co-Authored-By at the end\n..."
  }
}
```

### Configuration

Configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre-commit-context.sh"
          }
        ]
      }
    ]
  }
}
```

### Technical Notes

- Matcher is `Bash` (tool-level), not `Bash(git commit:*)` (parameter-level matchers not supported)
- Hook script filters commands internally with `grep "git commit"`
- Non-git commands exit silently (code 0, no output)
- Uses `jq` for JSON parsing (must be installed)

---

## SessionStart: Context Hook

**File:** `.claude/hooks/session-start.sh`
**Event:** `SessionStart`
**Purpose:** Automatic context loading on session start/resume

### When It Runs

The hook runs when:
- A new Claude session starts
- An existing session is resumed

### What It Provides

Outputs context including:

1. **Current Branch** - Git branch name
2. **Linear Issue** - Extracted ISSUE-XXX from branch name (with link)
3. **Sync Status** - Commits ahead/behind remote
4. **Uncommitted Changes** - First 5 changed files

### Example Output

```
## Session Context (from Dex)

**Branch:** `feature/ISSUE-1053-posttooluse-hook`
**Linear Issue:** ISSUE-1053 (extract from branch name)
  → View: https://linear.app/{team}/issue/ISSUE-1053

**Uncommitted Changes:** (3 files)
```
 M .claude/hooks/new-hook.sh
 A src/components/NewFeature.jsx
```
```

### Configuration

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-start.sh"
          }
        ]
      }
    ]
  }
}
```

---

## PostToolUse: Linear Auto-Link Hook

**File:** `.claude/hooks/post-commit-linear.sh`
**Event:** `PostToolUse`
**Matcher:** `Bash` (filters for successful `git commit` internally)
**Purpose:** Prompt Linear status updates after commits

### When It Runs

The hook runs after all Bash commands but only outputs context when:
- Command was `git commit`
- Exit code was 0 (success)
- Commit message contained ISSUE-XXX issue ID

### What It Provides

When a commit with Linear issue ID is detected, adds `additionalContext` prompting:

1. **Commit Hash** - The new commit's short hash
2. **Issues Detected** - ISSUE-XXX IDs found in commit message
3. **Suggested Actions** - Update issue status in Linear

### Example Output

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "## Linear Update (from Dex)\n\n**Commit:** `abc1234`\n**Issues Detected:** ISSUE-1053\n\nConsider updating Linear:\n- If work is complete, move issue to **Done**\n- If work continues, ensure issue is **In Progress**\n..."
  }
}
```

### Configuration

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-commit-linear.sh"
          }
        ]
      }
    ]
  }
}
```

### Technical Notes

- Parses `tool_result.stdout`, `tool_result.stderr`, and `tool_result.exit_code`
- Only fires for successful commits (exit_code 0)
- Extracts issue IDs with `grep -oE 'ISSUE-[0-9]+'`
- Non-matching commands exit silently

---

## PreToolUse: ESLint Check Hook

**File:** `.claude/hooks/pre-commit-lint.sh`
**Event:** `PreToolUse`
**Matcher:** `Bash` (filters for `git commit` internally)
**Purpose:** Run ESLint on staged files before commits

### When It Runs

The hook runs on all Bash commands but only performs linting when:
- Command contains `git commit`
- Staged files include `.js`, `.jsx`, `.ts`, or `.tsx` files

### What It Does

1. Gets list of staged JS/TS files via `git diff --cached`
2. Runs `npx eslint --no-warn-ignored` on those files only (fast)
3. If issues found: injects warning context (does not block)
4. If clean: injects confirmation context
5. If no lintable files staged: skips silently

### Why It Doesn't Hard-Block

Same philosophy as the typecheck hook — lint issues in existing code shouldn't prevent unrelated commits. Advisory only.

---

## PreToolUse: Build Verification Hook

**File:** `.claude/hooks/pre-commit-typecheck.sh`
**Event:** `PreToolUse`
**Matcher:** `Bash` (filters for `git commit` internally)
**Purpose:** Run TypeScript type checking before commits

### When It Runs

The hook runs on all Bash commands but only performs type checking when:
- Command contains `git commit`

### What It Does

1. Runs `npx tsc --noEmit` to check for type errors
2. If errors found: injects warning context (does not block)
3. If clean: injects confirmation context

### Why It Doesn't Hard-Block

Type errors in existing code shouldn't prevent unrelated commits. The hook surfaces warnings so the committer can make an informed decision. If type errors are introduced by the current changes, the code review gate (`@dex review`) catches them.

### Example Output (Pass)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "## Build Verification (from Dex)\n\n### TypeScript Check: PASSED"
  }
}
```

### Example Output (Warnings)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "## Build Verification (from Dex)\n\n### TypeScript Check: WARNINGS FOUND\n\n```\nsrc/utils/calc.ts(12,5): error TS2322: Type 'string' is not assignable...\n```\n\n**Note:** Type errors detected. Review whether these are related to your changes before committing."
  }
}
```

### Configuration

Configured in `.claude/settings.json`. Full pre-commit hook chain:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "...pre-commit-branch-guard.sh" },
          { "type": "command", "command": "...pre-commit-context.sh" },
          { "type": "command", "command": "...pre-commit-lint.sh" },
          { "type": "command", "command": "...pre-commit-typecheck.sh" },
          { "type": "command", "command": "...check-root-clutter.sh" }
        ]
      }
    ]
  }
}
```

**Execution order:**
1. Branch guard (blocking) — prevents `feat()` on main
2. Commit context — injects guidelines
3. ESLint (advisory) — code quality warnings
4. TypeScript (advisory) — type error warnings
5. Root clutter — warns about files in project root

### Technical Notes

- All hooks run on `Bash` matcher and filter for `git commit` internally
- Uses `tail -30`/`tail -40` to limit output
- Advisory hooks exit 0; branch guard exits 2 to block
- All use `jq` for JSON construction

---

## Future Hook Ideas

---

## Creating New Hooks

### Using /hooks Command (Recommended)

```
/hooks
```

Interactive dialog to add/edit hooks.

### Manual Configuration

1. Add hook to `.claude/settings.json` (project) or `~/.claude/settings.json` (global)
2. Create script in `.claude/hooks/` (optional)
3. Make script executable: `chmod +x .claude/hooks/your-hook.sh`

### Hook Script Template

```bash
#!/bin/bash
# Description: What this hook does
# Event: Which event triggers this
# Matcher: Tool pattern if applicable

set -e

# Read JSON input from stdin (optional)
# INPUT=$(cat)
# TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Your logic here

# Exit codes:
# 0 = Success (stdout parsed as JSON)
# 2 = Block (stderr shown to Claude)
exit 0
```

### Output Format

To return data to Claude (PreToolUse `additionalContext`):

```bash
echo '{"additionalContext": "Your context here"}'
exit 0
```

To block a tool call:

```bash
echo "Reason for blocking" >&2
exit 2
```
