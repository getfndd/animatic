#!/bin/bash
# Dex PreToolUse Hook - Git Commit Context Injection
# Matches: Bash tool with git commit commands
# Purpose: Inject helpful context before commits
#
# Returns additionalContext to Claude when a git commit is detected.

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

# This is a git commit - gather context

# Get recent commit messages for style reference
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null | head -5 || echo "")

# Check for uncommitted files to remind about staging
UNSTAGED=$(git diff --name-only 2>/dev/null | head -3 || echo "")
STAGED=$(git diff --cached --name-only 2>/dev/null | head -5 || echo "")

# Build context message
CONTEXT="## Commit Context (from Dex)

### Recent Commit Style
\`\`\`
$RECENT_COMMITS
\`\`\`

### Staged Files
\`\`\`
$STAGED
\`\`\`

### Commit Message Guidelines
- Format: type(scope): Description
- Types: feat, fix, refactor, docs, chore, test
- Include 'Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>' at the end
- Link Linear issues with 'Fixes: ISSUE-XXX' or 'Relates: ISSUE-XXX'
- Use HEREDOC format for multi-line messages"

# Return JSON with additionalContext
cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": $(echo "$CONTEXT" | jq -Rs .)
  }
}
EOF

exit 0
