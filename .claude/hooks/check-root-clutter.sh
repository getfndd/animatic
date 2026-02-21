#!/bin/bash
# Dex Pre-Commit Check: Root Directory Clutter Guard
# Blocks commits that add new files to the project root that should be elsewhere.
#
# Allowlist: Only these file types belong in root:
#   - Essential configs: package.json, vite.config.js, etc.
#   - Active code: server.js, worker.js
#   - Project docs: CLAUDE.md, README.md
#   - Directories: src/, docs/, supabase/, etc.

# Only check when tool_input contains "git commit"
if ! echo "$TOOL_INPUT" 2>/dev/null | grep -q "git commit"; then
    exit 0
fi

# Check staged files for new root-level additions
NEW_ROOT_FILES=$(git diff --cached --name-only --diff-filter=A 2>/dev/null | grep -E '^[^/]+\.(md|js|sh|sql|csv|txt)$' || true)

if [ -z "$NEW_ROOT_FILES" ]; then
    exit 0
fi

# Allowlisted root files
ALLOWLIST="CLAUDE.md|README.md|server.js|worker.js|vite-plugin-doc-metadata.js|eslint.config.js|vite.config.js|vitest.config.js|tailwind.config.js|index.html|vercel.json|package.json|package-lock.json"

VIOLATIONS=""
while IFS= read -r file; do
    if ! echo "$file" | grep -qE "^($ALLOWLIST)$"; then
        VIOLATIONS="${VIOLATIONS}\n  - $file"
    fi
done <<< "$NEW_ROOT_FILES"

if [ -n "$VIOLATIONS" ]; then
    echo ""
    echo "⚠️  Dex: New files being added to project root:"
    echo -e "$VIOLATIONS"
    echo ""
    echo "Root should only contain essential config and active code."
    echo "Move docs to docs/ or docs/archive/, scripts to scripts/."
    echo ""
fi

exit 0
