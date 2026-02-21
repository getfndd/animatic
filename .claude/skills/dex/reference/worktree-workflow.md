# Worktree Workflow Reference

Multi-instance Claude Code worktree management. Loaded by `@dex worktree *` commands.

---

## Quick Isolation: `claude -w`

Claude Code v2.1+ has built-in worktree support. For quick, ad-hoc isolation:

```bash
# Quick worktree (auto-named, branch from HEAD)
claude --worktree
claude -w

# Named worktree
claude --worktree my-experiment
claude -w my-experiment
```

**Built-in behavior:**
- Creates worktree in `.claude/worktrees/` (inside the repo)
- Auto-creates a new branch based on HEAD
- On session exit, prompts to keep or remove the worktree

**When to use `claude -w` vs `@dex worktree create`:**

| | `claude -w` | `@dex worktree create` |
|---|-------------|----------------------|
| **Use when** | Quick experiments, ad-hoc isolation | Structured multi-agent sessions |
| **Path** | `.claude/worktrees/` | `~/.claude-worktrees/{project}/` |
| **Branch naming** | Auto-generated | `feature/[name]` convention |
| **Deps installed** | No | Yes (`npm install`) |
| **Env copied** | No | Yes (`.env.local`) |
| **Linear linkage** | No | Yes (file ownership docs) |

**Recommendation:** Use `claude -w` for solo exploration. Use `@dex worktree create` for coordinated multi-agent work where branch naming, deps, and Linear tracking matter.

---

## Subagent Worktree Isolation (v2.1+)

The Task tool supports `isolation: "worktree"` to run subagents in their own worktree. This enables parallel work within a single session:

```
# Example: review in isolation while continuing work
Task(subagent_type: "general-purpose", isolation: "worktree", prompt: "Review the changes...")
```

**Safety notes:**
- Git corruption prevention rules still apply — one network op at a time
- Subagent isolation helps with file conflicts, not git operation serialization
- Worktree is auto-cleaned if the subagent makes no changes

---

## Paths

| Path | Purpose |
|------|---------|
| `~/.claude-worktrees/{project}/` | Structured worktrees (via `@dex worktree create`) |
| `.claude/worktrees/` | Quick worktrees (via `claude -w`) |
| `~/projects/{project}/` | Main checkout (human or lead agent) |

## Create Workflow

```bash
# 1. Ensure main is current
git fetch origin main
git checkout main && git pull origin main

# 2. Create worktree
git worktree add ~/.claude-worktrees/{project}/[name] -b feature/[name] main

# 3. Install deps
cd ~/.claude-worktrees/{project}/[name] && npm install

# 4. Copy local env (if needed)
cp ~/projects/{project}/.env.local ~/.claude-worktrees/{project}/[name]/.env.local
```

## Remove Workflow

```bash
# 1. Check for uncommitted/unpushed work
cd ~/.claude-worktrees/{project}/[name]
git status
git log origin/main..HEAD --oneline

# 2. Remove worktree
git -C ~/projects/{project} worktree remove ~/.claude-worktrees/{project}/[name]

# 3. Delete branch if merged
git -C ~/projects/{project} branch -d feature/[name]
```

## Health Check Workflow

```bash
# 1. List all worktrees
git worktree list

# 2. Check for stale locks
find .git -name "*.lock" -ls

# 3. Check object integrity
git fsck --no-dangling

# 4. Check for unpushed commits in each worktree
for wt in ~/.claude-worktrees/{project}/*/; do
  echo "=== $(basename $wt) ==="
  git -C "$wt" log origin/main..HEAD --oneline 2>/dev/null || echo "no remote tracking"
done

# 5. Verify safety config
git config gc.auto  # should be 0
```

## GC Safety Protocol

**NEVER run gc while agents are active.**

```bash
# 1. Verify no claude processes
ps aux | grep -c claude  # should be 0 (or just this terminal)

# 2. Verify no git processes
ps aux | grep -c "git "  # should be 0

# 3. Run gc
git gc --aggressive

# 4. Verify integrity
git fsck --no-dangling
```

## Recovery: Corrupted Object Store

If an agent crashes and corrupts the object store:

1. Kill all git processes: `pkill -9 -f "git"`
2. For each worktree with unpushed work:
   - `cd ~/.claude-worktrees/{project}/[name]`
   - `git format-patch main..HEAD` (exports patches)
   - Save any uncommitted changes: `git diff > /tmp/[name]-uncommitted.diff`
3. Fresh clone: `git clone <remote> <new-path>`
4. Re-create worktrees from the fresh clone
5. Apply patches: `git am *.patch`
6. Restore diffs: `git apply /tmp/[name]-uncommitted.diff`

## Git Config Requirements

These must be set on the repo (verified by `@dex worktree health`):

```
gc.auto = 0
gc.pruneExpire = 30.days.ago
gc.worktreePruneExpire = 90.days.ago
core.fsync = objects,derived-metadata,reference
transfer.fsckObjects = true
fetch.fsckObjects = true
receive.fsckObjects = true
```

## File Ownership Convention

When creating worktrees, document which directories each agent owns:

```
@dex worktree create ISSUE-101-meetings
  → owns: src/components/meetings/*, supabase/functions/seed-demo-content/*

@dex worktree create ISSUE-102-email
  → owns: src/components/email/*, supabase/functions/email-composer/*
```

Shared files (`package.json`, route files, shared utilities) are owned by the main checkout. Agents must not modify shared files without human coordination.
