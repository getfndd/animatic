# Dex Hooks Reference

Claude Code hooks that support the Dex workflow.

---

## Hook Architecture (v2 — Consolidated)

**Updated 2026-03-01.** Consolidated from 5 separate PreToolUse hooks into 1, added design guard and session health hooks.

### Hook Registry

| File | Event | Matcher | Purpose |
|------|-------|---------|---------|
| `setup.sh` | SessionStart | — | Repo health check on session start |
| `pre-commit.sh` | PreToolUse | Bash | Consolidated: branch guard + context + lint + typecheck + root clutter + destructive op guard |
| `design-guard.sh` | PreToolUse | Edit, Write | Design system violation detection at write time |
| `post-commit-linear.sh` | PostToolUse | Bash | Auto-update Linear issues after commits |
| `session-health.sh` | PostToolUse | — | Track session length, nudge on long sessions |

### Configuration (settings.json)

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "...setup.sh" }] }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "...pre-commit.sh" }]
      },
      {
        "matcher": "Edit",
        "hooks": [{ "type": "command", "command": "...design-guard.sh" }]
      },
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "...design-guard.sh" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "...post-commit-linear.sh" }]
      },
      {
        "hooks": [{ "type": "command", "command": "...session-health.sh" }]
      }
    ]
  }
}
```

---

## Setup Hook

**File:** `.claude/hooks/setup.sh`
**Event:** `SessionStart`
**Purpose:** Automatic repo health check on initialization

### What It Checks

1. **Worktrees** - Detects orphan worktrees that should be cleaned up
2. **Working tree** - Checks for uncommitted changes
3. **Remote sync** - Verifies local branch is in sync with remote
4. **Stale remotes** - Prunes stale remote-tracking branches
5. **Branch count** - Warns if too many local branches exist
6. **Current branch** - Shows current branch (warns if not main)
7. **Finder visibility** - Detects macOS hidden flags on files
8. **Node modules** - Health check (symlinks, package-lock sync)
9. **Root clutter** - Warns about non-essential files in root

### Manual Invocation

```bash
.claude/hooks/setup.sh
```

Or use `@dex repo check` for more detailed output.

---

## PreToolUse: Consolidated Pre-Commit Hook

**File:** `.claude/hooks/pre-commit.sh`
**Event:** `PreToolUse`
**Matcher:** `Bash`
**Purpose:** All pre-commit checks in a single process

### Performance

Previously: 5 hooks × shell spawn + JSON parse = 5 processes per Bash command.
Now: 1 hook, 1 JSON parse, early exit for non-commit commands.

### What It Does

**For ALL Bash commands:**
1. Parse JSON input once
2. Check for destructive git operations → **BLOCK** if found
3. Check for dangerous `rm -rf` targets → **BLOCK** if found
4. If not a `git commit` → exit immediately (no further processing)

**For `git commit` commands only:**
5. Branch guard — block `feat()` on main
6. Commit context — inject recent commits, staged files, guidelines
7. ESLint — lint staged JS/TS files (advisory)
8. TypeScript — `tsc --noEmit` (advisory)
9. Root clutter — warn about new files in project root

### Destructive Operations Guard

Blocks these patterns with exit code 2:

| Pattern | Safer Alternative |
|---------|-------------------|
| `git reset --hard` | `git stash` |
| `git push --force` / `-f` | `git push --force-with-lease` |
| `git checkout .` | `git stash` |
| `git clean -f` | `git clean -n` (dry run) |
| `git branch -D` | `git branch -d` (merged only) |
| `rm -rf .git\|src\|docs\|supabase\|apps\|node_modules\|.claude` | Manual confirmation |

### Exit Codes

- `0` — Allow (with optional additionalContext)
- `2` — Block (destructive op or feat() on main)

---

## PreToolUse: Design System Guard

**File:** `.claude/hooks/design-guard.sh`
**Event:** `PreToolUse`
**Matcher:** `Edit`, `Write`
**Purpose:** Catch design system violations at write time

### What It Checks

1. **Hardcoded hex colors** — `#xxx`, `#xxxxxx` etc. (except #fff/#000)
2. **Non-semantic Tailwind colors** — `bg-zinc-*`, `text-gray-*`, etc.
   - Exceptions: `text-zinc-900` (icon container rule), `{color}-100/200` (badge/avatar rule)
3. **Banned patterns:**
   - `border-l-*` accent bars
   - `text-text-primary` on colored `bg-{color}-100` backgrounds (dark mode bug)

### Skipped Files

Config, tokens, CSS, markdown, JSON, shell scripts, demo/prototype/seed/migration files.

### Enforcement Level

Advisory only (exit 0). Warnings surface as `additionalContext`. Rand blocks at commit time for hard violations.

---

## PostToolUse: Linear Auto-Update

**File:** `.claude/hooks/post-commit-linear.sh`
**Event:** `PostToolUse`
**Matcher:** `Bash`
**Purpose:** Automatically update Linear issues after commits

### Issue Classification

The hook classifies issues by commit message keywords:

| Keyword | Action |
|---------|--------|
| `Fixes: FND-XXX` / `Closes:` / `Resolves:` | Mark **Done** |
| `Relates: FND-XXX` / `Ref:` / `References:` | Ensure **In Progress** |
| `feat(FND-XXX):` / `fix(FND-XXX):` | Ensure **In Progress** |
| Bare `FND-XXX` mention | Ensure **In Progress** |

### Behavior

- Instructs Claude to call Linear MCP tools automatically
- No user confirmation needed for status updates
- Commit hash included for issue linking

### Previous Behavior (v1)

Old hook only suggested updates passively. v2 gives directive instructions to Claude.

---

## PostToolUse: Session Health

**File:** `.claude/hooks/session-health.sh`
**Event:** `PostToolUse`
**Matcher:** None (all tools)
**Purpose:** Track session length and nudge on long sessions

### How It Works

- Increments a counter file in `/tmp/claude-session-health/`
- Checks threshold every 50 tool calls (minimal overhead)
- At 200+ calls: suggests `/clear` or fresh session
- At 300+ calls: stronger recommendation for fresh session

### Counter Reset

Counter resets when:
- `/tmp` is cleared (system reboot)
- New session starts in a different directory
- Manual: `rm /tmp/claude-session-health/*`

---

## Retired Hooks (v1)

These individual hooks were consolidated into `pre-commit.sh` on 2026-03-01:

| File | Status |
|------|--------|
| `pre-commit-branch-guard.sh` | Merged into `pre-commit.sh` |
| `pre-commit-context.sh` | Merged into `pre-commit.sh` |
| `pre-commit-lint.sh` | Merged into `pre-commit.sh` |
| `pre-commit-typecheck.sh` | Merged into `pre-commit.sh` |
| `check-root-clutter.sh` | Merged into `pre-commit.sh` (also fixed $TOOL_INPUT bug) |

Old files can be safely deleted. They are no longer referenced in `settings.json`.

---

## Creating New Hooks

### Using /hooks Command (Recommended)

```
/hooks
```

Interactive dialog to add/edit hooks.

### Manual Configuration

1. Add hook to `.claude/settings.json` (project) or `~/.claude/settings.json` (global)
2. Create script in `.claude/hooks/`
3. Make script executable: `chmod +x .claude/hooks/your-hook.sh`

### Hook Script Template

```bash
#!/bin/bash
# Description: What this hook does
# Event: Which event triggers this
# Matcher: Tool pattern if applicable

set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Your logic here

# Exit codes:
# 0 = Allow (stdout parsed as JSON for additionalContext)
# 2 = Block (reason in JSON output)
exit 0
```

### Output Format

To return context to Claude:

```bash
cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "Your context here"
  }
}
EOF
exit 0
```

To block a tool call:

```bash
cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "decision": "block",
    "reason": "Why this is blocked"
  }
}
EOF
exit 2
```

---

## Hook Events Reference

| Event | Trigger | Use Case |
|-------|---------|----------|
| `SessionStart` | Session begins or resumes | Environment setup |
| `PreToolUse` | Before tool execution | Validation, context injection |
| `PostToolUse` | After tool execution | Logging, side effects |
| `UserPromptSubmit` | User submits prompt | Input validation |
| `Stop` | Claude finishes responding | Cleanup, notifications |
| `SubagentStop` | Subagent finishes responding | Subagent cleanup |
| `TeammateIdle` | Agent team member becomes idle | Multi-agent coordination |
| `TaskCompleted` | Agent task finishes | Multi-agent workflow triggers |

### Future Hook Opportunities

- **HTTP hooks** (new in v2.1.63): POST JSON to a URL instead of shell commands. Candidate for Linear integration (remove Claude as middleman).
- **TeammateIdle/TaskCompleted**: For reactive multi-agent orchestration when we formalize subagent patterns.
