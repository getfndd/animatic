#!/bin/bash
# Dex Setup Hook - Repo Health Check
# Triggered via: claude --init, claude --init-only, claude --maintenance
#
# Runs basic repository health checks to ensure clean development environment.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Dex Repo Health Check"
echo "=========================================="

ISSUES_FOUND=0

# 1. Check for orphan worktrees
echo -n "Checking worktrees... "
ORPHAN_WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep -c "^worktree" || echo "0")
if [ "$ORPHAN_WORKTREES" -gt 1 ]; then
    echo -e "${YELLOW}$ORPHAN_WORKTREES worktrees found${NC}"
    git worktree list
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# 2. Check for uncommitted changes
echo -n "Checking working tree... "
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo -e "${YELLOW}Uncommitted changes detected${NC}"
    git status --short
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}Clean${NC}"
fi

# 3. Check remote sync status
echo -n "Checking remote sync... "
git fetch --quiet origin 2>/dev/null || true
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
if [ -z "$REMOTE" ]; then
    echo -e "${YELLOW}No upstream branch${NC}"
elif [ "$LOCAL" != "$REMOTE" ]; then
    AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
    BEHIND=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "0")
    echo -e "${YELLOW}Diverged (ahead: $AHEAD, behind: $BEHIND)${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}In sync${NC}"
fi

# 3b. Prune stale remote-tracking branches
echo -n "Pruning stale remotes... "
PRUNED=$(git remote prune origin --dry-run 2>/dev/null | grep -c "prune" || echo "0")
if [ "$PRUNED" -gt 0 ]; then
    git remote prune origin 2>/dev/null
    echo -e "${GREEN}Pruned $PRUNED stale remote branch(es)${NC}"
else
    echo -e "${GREEN}OK${NC}"
fi

# 4. Check for stale branches
echo -n "Checking branches... "
BRANCH_COUNT=$(git branch --list | wc -l | tr -d ' ')
if [ "$BRANCH_COUNT" -gt 5 ]; then
    echo -e "${YELLOW}$BRANCH_COUNT local branches${NC}"
    git branch --list | head -10
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}OK ($BRANCH_COUNT branches)${NC}"
fi

# 5. Check current branch
echo -n "Current branch... "
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    echo -e "${GREEN}$CURRENT_BRANCH${NC}"
else
    echo -e "${YELLOW}$CURRENT_BRANCH (not main)${NC}"
fi

# 6. Check for macOS hidden flags on project files
echo -n "Checking Finder visibility... "
HIDDEN_COUNT=$(ls -laO . 2>/dev/null | grep -c "hidden" || echo "0")
if [ "$HIDDEN_COUNT" -gt 5 ]; then
    echo -e "${RED}$HIDDEN_COUNT files have macOS hidden flag (Finder won't show them)${NC}"
    echo "  Fix: chflags nohidden *"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# 7. Check node_modules health
echo -n "Checking node_modules... "
if [ -L "node_modules" ] && [ ! -d "node_modules" ]; then
    echo -e "${RED}Broken symlink${NC}"
    echo "  Fix: rm node_modules && npm install"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
elif [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Missing — run npm install${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
elif [ "package-lock.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
    echo -e "${YELLOW}Out of date — run npm install${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# 8. Check root directory clutter
echo -n "Checking root clutter... "
ROOT_FILES=$(ls -1 . 2>/dev/null | grep -cE '\.(md|js|sh|sql|csv)$' || echo "0")
# Whitelist: CLAUDE.md, README.md, server.js, worker.js, vite-plugin-doc-metadata.js, eslint.config.js, vite.config.js, vitest.config.js, tailwind.config.js
EXPECTED_ROOT=9
if [ "$ROOT_FILES" -gt "$((EXPECTED_ROOT + 3))" ]; then
    echo -e "${YELLOW}$ROOT_FILES files (expected ~$EXPECTED_ROOT). Loose files may need archiving.${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}OK ($ROOT_FILES files)${NC}"
fi

echo "=========================================="

if [ $ISSUES_FOUND -gt 0 ]; then
    echo -e "${YELLOW}Found $ISSUES_FOUND issue(s). Consider running @dex repo check for details.${NC}"
else
    echo -e "${GREEN}Repository is healthy.${NC}"
fi

echo "=========================================="

# Always exit 0 - this is informational, not blocking
exit 0
