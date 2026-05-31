#!/bin/bash
# Copies all runtime dependencies into the package directory for npm publish.
# Run from packages/animatic-mcp/

set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"

echo "Packing animatic-mcp from $REPO_ROOT"

# Clean previous build artifacts
rm -rf "$PKG_DIR/mcp" "$PKG_DIR/catalog" "$PKG_DIR/reference" "$PKG_DIR/src"

# Copy MCP server code. index.js statically imports a graph of top-level
# siblings (tools.js, tools-registry.js, runtime.js → tool-groups.js,
# handlers.js → lib.js). Copy mcp/*.js WHOLESALE rather than an explicit
# allowlist: naming files individually repeatedly drifted as the server was
# refactored, shipping a server that crashes on boot with ERR_MODULE_NOT_FOUND
# (ANI-154: tools.js missing; ANI-159: runtime/handlers/tools-registry/
# tool-groups missing after the PRE-1439 handler extraction).
mkdir -p "$PKG_DIR/mcp/data" "$PKG_DIR/mcp/lib"
cp "$REPO_ROOT"/mcp/*.js "$PKG_DIR/mcp/"
cp "$REPO_ROOT/mcp/data/loader.js" "$PKG_DIR/mcp/data/"
cp "$REPO_ROOT"/mcp/lib/*.js "$PKG_DIR/mcp/lib/"

# Copy catalog data (exclude comparison/showcase — not needed at runtime)
mkdir -p "$PKG_DIR/catalog/benchmarks"
cp "$REPO_ROOT"/catalog/*.json "$PKG_DIR/catalog/"
cp "$REPO_ROOT"/catalog/benchmarks/*.json "$PKG_DIR/catalog/benchmarks/" 2>/dev/null || true

# Copy reference docs (primitives registry + breakdowns + reference docs)
mkdir -p "$PKG_DIR/reference"
cp -r "$REPO_ROOT/.claude/skills/animate/reference/primitives" "$PKG_DIR/reference/"
cp -r "$REPO_ROOT/.claude/skills/animate/reference/breakdowns" "$PKG_DIR/reference/"
# Copy individual reference docs
for f in animation-principles spring-physics cinematic-techniques-research camera-rig personality-research SCHEMA industry-references figma-mcp-research ambient-generative-techniques figma-conventions mixed-media-composition svg-illustration-techniques; do
  if [ -f "$REPO_ROOT/.claude/skills/animate/reference/$f.md" ]; then
    cp "$REPO_ROOT/.claude/skills/animate/reference/$f.md" "$PKG_DIR/reference/"
  fi
done
# Skip inspiration/ — large binary assets not needed at runtime

# Copy remotion lib (imported by compiler.js)
mkdir -p "$PKG_DIR/src/remotion"
cp "$REPO_ROOT/src/remotion/lib.js" "$PKG_DIR/src/remotion/"

# Smoke check: every relative import in the packed server must resolve, or the
# pack fails here rather than crashing on the user's first boot (ANI-159).
node "$PKG_DIR/scripts/verify-pack.mjs" "$PKG_DIR"

echo "Pack complete: $(find "$PKG_DIR" -name '*.js' -o -name '*.json' -o -name '*.md' | wc -l | tr -d ' ') files"
