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
| `~/Desktop/fnddTech/{project}/` | Main checkout (human or lead agent) |

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
cp ~/Desktop/fnddTech/{project}/.env.local ~/.claude-worktrees/{project}/[name]/.env.local
```

## Remove Workflow

```bash
# 1. Check for uncommitted/unpushed work
cd ~/.claude-worktrees/{project}/[name]
git status
git log origin/main..HEAD --oneline

# 2. Remove worktree
git -C ~/Desktop/fnddTech/{project} worktree remove ~/.claude-worktrees/{project}/[name]

# 3. Delete branch if merged
git -C ~/Desktop/fnddTech/{project} branch -d feature/[name]
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
@dex worktree create FND-1274-meetings
  → owns: src/components/meetings/*, supabase/functions/seed-demo-content/*

@dex worktree create FND-1275-email
  → owns: src/components/email/*, supabase/functions/email-composer/*
```

Shared files (`package.json`, route files, shared utilities) are owned by the main checkout. Agents must not modify shared files without human coordination.

---

## Command Surface

Moved out of SKILL.md — these are command definitions plus their report
templates, which only matter while running one. The workflow reasoning above
is what you need to decide *whether* to use a worktree; this is the mechanics.

### `@dex worktree create [name]`

Create a new worktree for a Claude Code agent.

**Process:**
1. Validate name follows convention (e.g., `FND-1274-demo-enrichment`)
2. Create worktree at `~/.claude-worktrees/{project}/[name]`
3. Create branch `feature/[name]` from `main` (or specified base)
4. Run `npm install` in the worktree
5. Report the worktree path for agent use

**Usage:**
```
@dex worktree create FND-1274-demo-enrichment
@dex worktree create FND-1275-email-composer --base feature/FND-1274
```

**Safety checks:**
- Verify main is up to date before branching
- Verify no existing worktree with the same name

### `@dex worktree list`

List all active worktrees with status.

**Output:**
```
## Active Worktrees

| Worktree | Branch | Last Commit | Unpushed | Status |
|----------|--------|-------------|----------|--------|
| main checkout | feature/FND-1274-... | 6590ce2 (2h ago) | 0 | clean |
| FND-1275-email | feature/FND-1275-... | a1b2c3d (30m ago) | 2 | modified |
```

### `@dex worktree remove [name]`

Remove a worktree and optionally its branch.

**Process:**
1. Check for uncommitted changes (warn and block if found)
2. Check for unpushed commits (warn and block if found)
3. Run `git worktree remove [path]`
4. Delete local branch if merged to main
5. Report cleanup result

### `@dex worktree health`

Check health of all worktrees and the shared object store.

**Checks:**
- Stale `.lock` files from crashed processes
- Orphan worktrees (directory deleted but metadata remains)
- Worktrees with unpushed commits at risk
- Object store integrity (`git fsck --no-dangling`)
- `gc.auto` is set to 0 (safety config)

### `@dex worktree cleanup`

Clean up orphan worktrees and stale branches.

**Process:**
1. Run `git worktree prune`
2. Identify branches with no active worktree and no remote tracking
3. Report candidates for deletion (require confirmation)

### `@dex worktree gc`

Run garbage collection safely.

**Process:**
1. Verify NO active Claude Code agents in any worktree
2. Verify no git processes running (`ps aux | grep git`)
3. Run `git gc --aggressive`
4. Run `git fsck --no-dangling`
5. Report results

**Hard block:** Refuses to run if any agent processes detected.

### `@dex prune`

Clean up stale branches, merged remotes, and orphan worktrees in one pass.

**Process:**
1. `git remote prune origin` — remove stale remote-tracking branches
2. `git branch --merged main | grep -v main` — identify merged local branches
3. `git worktree prune` — clean orphan worktree metadata
4. Report what was cleaned, ask for confirmation before deleting local branches

**Output:**
```
## Prune Report

### Remote Branches Pruned
- origin/feature/FND-1234-old-feature (deleted on remote)

### Local Branches (merged to main)
- feature/FND-1234-old-feature — Delete? [requires confirmation]

### Worktree Metadata
- Pruned 0 orphan entries

Total cleaned: X items
```
