#!/usr/bin/env bash
#
# Animatic Install Script
# Copies skills, hooks, and scripts into a consuming project's .claude/ directory.
#
# Usage:
#   .claude/vendor/animatic/install.sh
#
# Behavior:
#   - Copies skills/ → .claude/skills/ (skips LEARNINGS.md if local version exists)
#   - Copies hooks/ → .claude/hooks/
#   - Copies scripts/update-skill-registry.sh → .claude/scripts/
#   - Never overwrites: LEARNINGS.md, settings.local.json, project-specific skills
#   - Prints diff summary so changes are reviewable

set -euo pipefail

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANIMATIC_DIR="$SCRIPT_DIR"

# Find project root (walk up from .claude/vendor/animatic to project root)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLAUDE_DIR="$PROJECT_ROOT/.claude"

echo "Animatic Install"
echo "  Source:  $ANIMATIC_DIR"
echo "  Target:  $CLAUDE_DIR"
echo ""

# Ensure target directories exist
mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/hooks" "$CLAUDE_DIR/scripts"

# Track changes
CHANGES=0

# --- Skills ---
SKILL_DIRS=(maya rams dex animate prototype)

for skill in "${SKILL_DIRS[@]}"; do
  SRC="$ANIMATIC_DIR/.claude/skills/$skill"
  DST="$CLAUDE_DIR/skills/$skill"

  if [ ! -d "$SRC" ]; then
    echo "  SKIP  skills/$skill (not found in source)"
    continue
  fi

  # Create skill directory if needed
  mkdir -p "$DST"

  # Copy all files except LEARNINGS.md (preserve local learnings)
  while IFS= read -r -d '' file; do
    rel="${file#$SRC/}"
    dst_file="$DST/$rel"
    dst_dir="$(dirname "$dst_file")"

    # Skip LEARNINGS.md if local version exists
    if [[ "$rel" == "LEARNINGS.md" ]] && [[ -f "$dst_file" ]]; then
      echo "  KEEP  skills/$skill/LEARNINGS.md (local learnings preserved)"
      continue
    fi

    mkdir -p "$dst_dir"

    # Check if file changed
    if [ -f "$dst_file" ] && diff -q "$file" "$dst_file" > /dev/null 2>&1; then
      continue  # No change, skip silently
    fi

    cp "$file" "$dst_file"

    if [ -f "$dst_file" ]; then
      echo "  UPDATE skills/$skill/$rel"
    else
      echo "  ADD    skills/$skill/$rel"
    fi
    CHANGES=$((CHANGES + 1))
  done < <(find "$SRC" -type f -print0)
done

# --- Hooks ---
while IFS= read -r -d '' file; do
  filename="$(basename "$file")"
  dst_file="$CLAUDE_DIR/hooks/$filename"

  if [ -f "$dst_file" ] && diff -q "$file" "$dst_file" > /dev/null 2>&1; then
    continue
  fi

  cp "$file" "$dst_file"
  chmod +x "$dst_file"
  echo "  UPDATE hooks/$filename"
  CHANGES=$((CHANGES + 1))
done < <(find "$ANIMATIC_DIR/.claude/hooks" -type f -name "*.sh" -print0)

# --- Scripts ---
SRC_SCRIPT="$ANIMATIC_DIR/.claude/scripts/update-skill-registry.sh"
DST_SCRIPT="$CLAUDE_DIR/scripts/update-skill-registry.sh"

if [ -f "$SRC_SCRIPT" ]; then
  if [ ! -f "$DST_SCRIPT" ] || ! diff -q "$SRC_SCRIPT" "$DST_SCRIPT" > /dev/null 2>&1; then
    cp "$SRC_SCRIPT" "$DST_SCRIPT"
    chmod +x "$DST_SCRIPT"
    echo "  UPDATE scripts/update-skill-registry.sh"
    CHANGES=$((CHANGES + 1))
  fi
fi

# --- Summary ---
echo ""
if [ "$CHANGES" -eq 0 ]; then
  echo "No changes. Everything is up to date."
else
  echo "$CHANGES file(s) updated."
  echo ""
  echo "Review changes:"
  echo "  git diff .claude/skills/"
  echo "  git diff .claude/hooks/"
fi
