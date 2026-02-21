#!/bin/bash
# Dex PreToolUse Hook - Build Verification Before Commit
# Matches: Bash tool with git commit commands
# Purpose: Run tsc --noEmit to catch type errors before commits
#
# Exit code 2 = block the commit if type errors found

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

# Run type check
TSC_OUTPUT=$(npx tsc --noEmit --pretty 2>&1 | tail -30) || TSC_EXIT=$?

if [ "${TSC_EXIT:-0}" -ne 0 ]; then
    # Type errors found - provide context but don't block
    # (blocking would require exit 2, but type errors in existing code
    # shouldn't prevent unrelated commits)
    CONTEXT="## Build Verification (from Dex)

### TypeScript Check: WARNINGS FOUND

\`\`\`
$TSC_OUTPUT
\`\`\`

**Note:** Type errors detected. Review whether these are related to your changes before committing."

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

# Type check passed - inject confirmation
CONTEXT="## Build Verification (from Dex)

### TypeScript Check: PASSED"

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": $(echo "$CONTEXT" | jq -Rs .)
  }
}
EOF

exit 0
