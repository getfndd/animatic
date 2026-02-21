#!/bin/bash
# Dex PreToolUse Hook - ESLint Check Before Commit
# Matches: Bash tool with git commit commands
# Purpose: Run ESLint on staged files to catch code quality issues
#
# Warns but does not block (exit 0) — same philosophy as typecheck hook

set -e

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool name and command
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process Bash commands
if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

# Check if this is a git commit command
if ! echo "$COMMAND" | grep -q "git commit"; then
    exit 0
fi

# Get staged JS/JSX/TS/TSX files only
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(js|jsx|ts|tsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
    # No lintable files staged — skip
    exit 0
fi

# Run ESLint on staged files only (fast)
LINT_OUTPUT=$(echo "$STAGED_FILES" | xargs npx eslint --no-warn-ignored --format compact 2>&1 | tail -40) || LINT_EXIT=$?

if [ "${LINT_EXIT:-0}" -ne 0 ]; then
    CONTEXT="## Lint Check (from Dex)

### ESLint: WARNINGS FOUND

\`\`\`
$LINT_OUTPUT
\`\`\`

**Note:** Lint issues detected in staged files. Review whether these are related to your changes before committing."

    cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": $(echo "$CONTEXT" | jq -Rs .)
  }
}
EOF
    exit 0
fi

# Lint passed
CONTEXT="## Lint Check (from Dex)

### ESLint: PASSED"

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": $(echo "$CONTEXT" | jq -Rs .)
  }
}
EOF

exit 0
