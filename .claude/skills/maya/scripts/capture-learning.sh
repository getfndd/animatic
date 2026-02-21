#!/bin/bash
# Capture a learning to LEARNINGS.md
# Usage: ./capture-learning.sh "type" "scope" "confidence" "source" "rule" "rationale"
#
# Types: Constraint, Preference, Clarification, Exception
# Scopes: Global, Surface, Component
# Confidence: Low, Medium, High

SKILL_DIR="$(dirname "$0")/.."
LEARNINGS_FILE="$SKILL_DIR/LEARNINGS.md"

TYPE="${1:-Preference}"
SCOPE="${2:-Global}"
CONFIDENCE="${3:-Low}"
SOURCE="${4:-User correction}"
RULE="${5:-No rule specified}"
RATIONALE="${6:-No rationale provided}"
DATE=$(date +%Y-%m-%d)

# Generate a title from the rule (first 50 chars)
TITLE=$(echo "$RULE" | cut -c1-50 | sed 's/[^a-zA-Z0-9 ]//g')

cat >> "$LEARNINGS_FILE" << EOF

### $DATE - $TITLE

- **Type**: $TYPE
- **Scope**: $SCOPE
- **Confidence**: $CONFIDENCE
- **Source**: $SOURCE
- **Rule**: $RULE
- **Rationale**: $RATIONALE

---
EOF

echo "Learning captured to $LEARNINGS_FILE"
echo ""
echo "Entry added:"
echo "  Type: $TYPE"
echo "  Scope: $SCOPE"
echo "  Confidence: $CONFIDENCE"
