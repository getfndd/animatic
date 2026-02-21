#!/bin/bash
# Dex PostToolUse Hook - Linear Auto-Link After Commits
# Triggered after: Bash commands that look like git commits
#
# Detects successful commits with ISSUE-XXX issue IDs and prompts
# Claude to update Linear status.

set -e

# Read JSON input from stdin
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
STDOUT=$(echo "$INPUT" | jq -r '.tool_result.stdout // ""')
STDERR=$(echo "$INPUT" | jq -r '.tool_result.stderr // ""')
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // "0"')

# Only process Bash tool
if [ "$TOOL_NAME" != "Bash" ]; then
    exit 0
fi

# Only process git commit commands
if ! echo "$COMMAND" | grep -q "git commit"; then
    exit 0
fi

# Only process successful commits (exit code 0)
if [ "$EXIT_CODE" != "0" ]; then
    exit 0
fi

# Check for commit success indicators in output
if ! echo "$STDOUT$STDERR" | grep -qE "^\[.*\]|^create mode|files? changed"; then
    exit 0
fi

# Extract FND issue IDs from the commit message part of command
# Look for ISSUE-XXX pattern in the commit message
ISSUE_IDS=$(echo "$COMMAND" | grep -oE 'ISSUE-[0-9]+' | sort -u | tr '\n' ' ' | xargs)

if [ -z "$ISSUE_IDS" ]; then
    # No Linear issue mentioned, exit silently
    exit 0
fi

# Extract commit hash from output (first 7+ char hex string after bracket)
COMMIT_HASH=$(echo "$STDOUT$STDERR" | grep -oE '\[[a-zA-Z0-9/_-]+ [a-f0-9]{7,}\]' | head -1 | grep -oE '[a-f0-9]{7,}' || echo "")

# Build context for Claude
CONTEXT="## Linear Update (from Dex)

**Commit:** \`$COMMIT_HASH\`
**Issues Detected:** $ISSUE_IDS

Consider updating Linear:
- If work is complete, move issue to **Done**
- If work continues, ensure issue is **In Progress**
- Add commit link to issue if significant

Use: \`@dex linear update [status]\` or manual Linear MCP calls."

# Return additionalContext to Claude
cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": $(echo "$CONTEXT" | jq -Rs .)
  }
}
EOF

exit 0
