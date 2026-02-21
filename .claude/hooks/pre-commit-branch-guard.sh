#!/bin/bash
# Dex PreToolUse Hook - Feature Branch Guard
# Matches: Bash tool with git commit commands
# Purpose: Block feat() commits on main — require a feature branch
#
# Exit code 2 = block the tool call

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

# Check if commit message contains feat() pattern
if ! echo "$COMMAND" | grep -qE 'feat\('; then
    exit 0
fi

# feat() commit detected — check if we're on main
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    CONTEXT="## Branch Guard (from Dex)

### BLOCKED: Feature commit on main

You're trying to commit a \`feat()\` change directly to \`main\`. Per workflow policy, feature work must use a feature branch.

**Fix:** Create a feature branch first:
\`\`\`
git checkout -b feature/ISSUE-XXX-description
\`\`\`

Then retry the commit. Use \`fix\`, \`chore\`, or \`docs\` for small changes that can go directly to main."

    cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "decision": "block",
    "reason": $(echo "$CONTEXT" | jq -Rs .)
  }
}
EOF
    exit 2
fi

exit 0
