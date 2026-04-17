---
project: animatic
version: 1.0
---

# Animatic — Project Adapter

AI cinematography pipeline for Claude Code. Transforms creative briefs into
branded videos with animation personalities and 100+ motion primitives.

## Design System
name: n/a (video output, not interactive UI)
token_format: none
semantic_tokens: {}
mcp_tools: [animatic]
principles:
  - Physics-based animation — spring, conveyor, stack-fan, spotlight
  - Animation personalities define motion character, not raw keyframes
  - Video is the output artifact, not interactive UI

## Component Architecture
scene_path: src/remotion/
runtime_path: src/prototype-runtime/
mcp_path: mcp/
preferred_import: relative imports
component_library: remotion compositions

## Tech Stack
framework: remotion 4 + react 19
styling: motion (framer-motion successor)
runtime: node 18+
build: node scripts + remotion render
test_runner: node --test (native)
capture: puppeteer
backend: supabase (asset storage)
ai_providers: anthropic claude
deployment: mp4 video render (local + cloud)

## Issue Tracking
provider: linear
branch_format: "feature/{description}"
commit_format: "feat: {message}"

## Project-Specific Rules
rules:
  - This is a video pipeline, not an interactive UI — no DOM events, no hover states
  - Animation timing uses physics (spring constants), not CSS easing
  - Scenes are Remotion compositions, not React components
  - 11 animation personas (e.g., Saul for animation design)
  - MCP server exposes 21 tools for video generation
  - Prototype runtime handles choreography and sequencing
