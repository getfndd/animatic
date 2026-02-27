#!/usr/bin/env bash
#
# Install the post-commit git hook that syncs catalog changes to Preset.
# Run once after cloning the repo:
#   bash scripts/setup-hook.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_DIR="$REPO_ROOT/.git/hooks"
HOOK_FILE="$HOOK_DIR/post-commit"

# Ensure we're in a git repo
if [ ! -d "$HOOK_DIR" ]; then
  echo "Error: .git/hooks directory not found. Are you in a git repository?"
  exit 1
fi

# Check if hook already exists
if [ -f "$HOOK_FILE" ]; then
  if grep -q "sync-to-preset" "$HOOK_FILE" 2>/dev/null; then
    echo "Hook already installed. Nothing to do."
    exit 0
  fi
  # Append to existing hook
  echo "" >> "$HOOK_FILE"
  echo "# ── Animatic → Preset sync ──" >> "$HOOK_FILE"
else
  # Create new hook
  echo "#!/usr/bin/env bash" > "$HOOK_FILE"
  echo "" >> "$HOOK_FILE"
  echo "# ── Animatic → Preset sync ──" >> "$HOOK_FILE"
fi

cat >> "$HOOK_FILE" << 'HOOK'
CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD | grep "^catalog/" || true)
if [ -n "$CHANGED" ]; then
  echo ""
  echo "Catalog changed — syncing to Preset..."
  node scripts/sync-to-preset.mjs
  echo ""
fi
HOOK

chmod +x "$HOOK_FILE"
echo "Post-commit hook installed at $HOOK_FILE"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and fill in your Supabase credentials"
echo "  2. Run 'npm install' to install dependencies"
echo "  3. Test with: node scripts/sync-to-preset.mjs --dry-run"
