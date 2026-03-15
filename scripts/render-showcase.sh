#!/bin/bash
# Render the Motion Spec v2 benchmark showcase sizzle reel
#
# Usage:
#   ./scripts/render-showcase.sh
#   ./scripts/render-showcase.sh --gl=angle   # for headless environments
#
# Prerequisites:
#   - Node.js 18+
#   - npm install (remotion dependencies)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=== Benchmark Showcase Renderer ==="
echo ""

# Ensure output directory exists
mkdir -p public/showcase

# Build the props file that combines the sequence manifest with scene definitions
echo "Assembling sequence props..."

node -e "
const fs = require('fs');
const path = require('path');

// Load the sequence manifest
const manifest = JSON.parse(
  fs.readFileSync('catalog/showcase-sequence.json', 'utf8')
);

// Load each scene definition
const sceneDefs = {};
const sceneFiles = [
  'catalog/benchmarks/cinematic-dark-hero.json',
  'catalog/benchmarks/editorial-feature.json',
  'catalog/benchmarks/neutral-light-tutorial.json',
  'catalog/benchmarks/montage-sizzle.json',
];

for (const file of sceneFiles) {
  const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
  sceneDefs[scene.scene_id] = scene;
}

// Write combined props
const props = { manifest, sceneDefs };
fs.writeFileSync(
  'public/showcase/showcase-props.json',
  JSON.stringify(props, null, 2)
);

console.log('Props assembled: public/showcase/showcase-props.json');
console.log('Scenes:', Object.keys(sceneDefs).join(', '));
"

echo ""
echo "Rendering sequence..."

npx remotion render src/remotion/Root.jsx Sequence \
  --props=public/showcase/showcase-props.json \
  --output=public/showcase/motion-spec-v2.mp4 \
  "$@"

echo ""
echo "Done! Output: public/showcase/motion-spec-v2.mp4"
