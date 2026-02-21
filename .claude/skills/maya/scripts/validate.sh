#!/bin/bash
# Run Maya validation on the codebase
# Usage: ./validate.sh [file-or-directory]

TARGET="${1:-src/}"

echo "Running Maya validation on $TARGET..."
echo ""

# Run maya-lint if available
if command -v maya-lint &> /dev/null; then
    maya-lint lint "$TARGET"
elif [ -f "packages/maya-runtime/bin/maya-lint" ]; then
    node packages/maya-runtime/bin/maya-lint lint "$TARGET"
elif [ -f "node_modules/.bin/maya-lint" ]; then
    npx maya-lint lint "$TARGET"
else
    echo "Maya lint not found. Running pattern validation only..."
    echo ""

    # Fallback: Check for common violations
    echo "Checking for raw Tailwind colors..."
    grep -rn "text-zinc-\|text-gray-\|text-slate-\|bg-zinc-\|bg-gray-\|bg-slate-" "$TARGET" --include="*.jsx" --include="*.tsx" 2>/dev/null | head -20

    echo ""
    echo "Checking for rectangular buttons (missing pill/round)..."
    grep -rn "<Button" "$TARGET" --include="*.jsx" --include="*.tsx" 2>/dev/null | grep -v "preset=" | grep -v "pill" | grep -v "rounded-full" | head -10

    echo ""
    echo "Checking for native select elements..."
    grep -rn "<select" "$TARGET" --include="*.jsx" --include="*.tsx" 2>/dev/null | head -10
fi

echo ""
echo "Validation complete."
