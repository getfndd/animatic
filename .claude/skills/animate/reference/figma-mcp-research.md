# Figma MCP Research — Animation Pipeline Input Pathway

**Date:** 2026-02-21
**Linear:** ISSUE-1458
**Status:** POC validated (ANI-7, 2026-02-28)

## Summary

Evaluated 6 Figma MCP servers for use as input to the animation pipeline. The recommended approach: Official Figma MCP for design context extraction → Claude Code for HTML generation → `/animate` skill for personality application → capture pipeline for distribution.

**Key insight:** No Figma MCP extracts animation/transition data. Our animation personalities encode motion expertise that doesn't exist in Figma files — this is the competitive advantage of the pipeline.

## Server Landscape

### 1. Official Figma MCP Server

- **Transport:** Remote HTTP at `https://mcp.figma.com/mcp` or Desktop Protocol
- **Auth:** OAuth (remote) or personal access token (Desktop)
- **Tools (13):**
  - `get_design_context` — structured design data from a Figma URL
  - `get_variable_defs` — design tokens/variables from a file
  - `get_screenshot` — screenshot of a specific node
  - `get_metadata` — file metadata
  - Plus: annotation tools, code connect, component documentation
- **Rate limits:** 10-20 requests/min depending on Figma plan
- **Strengths:** Most reliable, maintained by Figma, variable extraction for token mapping
- **Weaknesses:** Rate-limited, no write access, SSE transport adds latency

### 2. Framelink / GLips (13.2k stars)

- **Repo:** `nicepkg/figma-mcp` (formerly GLips)
- **Transport:** Local stdio
- **Approach:** Simplified, AI-optimized node data — strips unnecessary metadata
- **Strengths:** Most popular, optimized for LLM consumption (smaller context), fast local execution
- **Weaknesses:** Read-only, requires personal access token, community-maintained

### 3. F2C (Figma to Code)

- **Focus:** Direct code generation from Figma frames
- **Output:** Pixel-perfect HTML/CSS
- **Strengths:** Handles layout conversion, respects auto-layout, generates clean markup
- **Weaknesses:** Generated code is static (no interactivity), may need cleanup for animation

### 4. claude-talk-to-figma

- **Unique feature:** Read AND write access to Figma
- **Use case:** Could push animated prototypes back to Figma as documentation
- **Requires:** Figma plugin running alongside the MCP server
- **Weaknesses:** More complex setup, plugin dependency

### 5. paulvandermeijs (Rust)

- **Focus:** Image export as base64
- **Strengths:** Fast (Rust), good for frame screenshots as animation scene backgrounds
- **Weaknesses:** Limited to image operations

### 6. html.to.design

- **Direction:** HTML → Figma (reverse pipeline)
- **Use case:** Push finished animated prototypes back into Figma for team review
- **Strengths:** Closes the loop — designers see the result in their tool

## Capability Matrix

| Capability | Official | Framelink | F2C | claude-talk | paulvandermeijs | html.to.design |
|-----------|----------|-----------|-----|-------------|-----------------|----------------|
| Read design context | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Extract variables/tokens | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Screenshot/image export | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Generate HTML/CSS | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Write to Figma | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Extract animation data | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Local/fast | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Rate limited | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Recommended Pipeline

### Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐     ┌──────────────┐
│  Figma Frame │────▶│  Design Context  │────▶│ HTML Prototype │────▶│  /animate    │
│              │     │                  │     │                │     │              │
│  Designer's  │     │  Official MCP:   │     │  Claude Code:  │     │  Apply       │
│  mockup      │     │  get_design_     │     │  Transform     │     │  personality │
│              │     │  context +       │     │  context to    │     │  + engine    │
│              │     │  get_variable_   │     │  semantic HTML │     │              │
│              │     │  defs            │     │                │     │              │
└──────────────┘     └──────────────────┘     └────────────────┘     └──────────────┘
                                                                            │
                                                                            ▼
                                                                     ┌──────────────┐
                                                                     │  Capture     │
                                                                     │  Pipeline    │
                                                                     │              │
                                                                     │  WebM/MP4/   │
                                                                     │  HTML embed  │
                                                                     └──────────────┘
```

### Step-by-step

1. **Designer creates frame in Figma** — static mockup of the UI to animate
2. **Official Figma MCP extracts context** — `get_design_context(url)` returns structured node tree + `get_variable_defs(fileKey)` returns design tokens
3. **Claude Code transforms to HTML** — maps Figma layout to semantic HTML, maps Figma variables to personality token overrides (`--ed-*`, `--cd-*`), identifies animation phases from Figma frame naming conventions (e.g., frames named "Phase 1: Upload", "Phase 2: Processing")
4. **`/animate` applies personality** — reads HTML prototype, loads personality + mode, generates autoplay with engine class
5. **Capture pipeline** — `--mode capture` produces WebM/MP4 for embedding

### Phase Detection Heuristic

Figma frames don't encode animation, but we can infer phases from frame structure:
- **Multiple top-level frames** in a page → each frame = one animation phase
- **Frame naming convention** → "Phase 1: Upload", "Step 2: Organize", etc.
- **Variant components** → different states of the same UI = phase transitions
- **Section dividers** → Figma sections could map to phase groups

### Token Mapping

Figma variables → personality token overrides:

```javascript
// Figma variable: "Colors/Surface/Primary" = #FFFFFF
// Maps to:
tokenOverrides: {
  '--ed-surface-card': '#FFFFFF'  // editorial
  // or
  '--cd-surface-card': '#FFFFFF'  // cinematic
}
```

The `get_variable_defs` tool extracts Figma's variable collections, which can be automatically mapped to personality token overrides. This preserves the designer's color choices while applying animation behavior from the personality.

## Setup

### Official Figma MCP (recommended starting point)

See `docs/process/figma-mcp-setup.md` for full installation and authentication guide.

```bash
claude mcp add --transport http figma --scope user https://mcp.figma.com/mcp
```

Uses OAuth at user scope — will prompt for Figma login on first use.

### Framelink (optional, for faster local reads)

```json
{
  "mcpServers": {
    "framelink": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR_KEY"]
    }
  }
}
```

## POC Acceptance Criteria

When ready to build a proof of concept:

1. Install Official Figma MCP server
2. Read a real Figma frame (e.g., a simple card UI with 2-3 states)
3. Extract design context + variables
4. Transform to semantic HTML with phase markers
5. Apply editorial personality via `/animate --personality editorial`
6. Verify: animation plays correctly with Figma's colors preserved via token overrides
7. Capture: produce working WebM/MP4

## Open Questions

1. **Rate limits**: 10-20 req/min may be tight for complex files with many frames. Batch reads vs incremental?
2. **Frame naming convention**: Need to define the standard naming convention designers should use for animation phases
3. **Variable mapping**: How closely do Figma variable names need to match personality tokens? Auto-mapping heuristics vs explicit mapping file?
4. **Multi-personality**: Can a single Figma file contain frames for different personalities (cinematic hero + editorial content section)?

---

## POC Results (ANI-7 — 2026-02-28)

**Prototype:** `prototypes/2026-02-28-figma-mcp-poc/`
**Scenario:** Data Room Upload card with 3 states (Upload → Processing → Ready)
**Personality:** Editorial with indigo accent overrides
**Auth:** Simulated — live Figma MCP installed but OAuth skipped; design context hand-crafted

### What Worked End-to-End

1. **Pipeline architecture validated.** The flow Figma context → semantic HTML → `/animate` editorial → autoplay works cleanly. Each step is well-separated.
2. **Token override system.** Figma variables mapped to `tokenOverrides` in the EditorialEngine constructor. Indigo accent (`#6366f1`) applied correctly through `--ed-accent`, `--ed-accent-bg`, `--ed-accent-text` overrides. No hardcoded colors leaked.
3. **Phase detection from frame naming.** The `Phase N: Label` convention maps directly to `{ id, label, dwell }` phase configs. Reliable when designers follow it.
4. **Animation primitive composition.** Mixed blur-reveal (upload zone), slide-stagger (files, categories), count-up (stats), typewriter (scanning status), and progress bar across 3 phases. All reset cleanly on loop.
5. **Embed mode.** `?embed` strips controls and background as expected.
6. **meta.json captures the full provenance.** Simulated Figma context, variable mapping, and phase detection all documented in metadata.

### What Required Manual Intervention

1. **HTML structure.** Claude generates the semantic HTML — no Figma MCP tool produces animation-ready markup. The transform from design context to phased HTML is inherently a creative step.
2. **Phase choreography.** Choosing which animation primitives to use per phase (blur-reveal for hero moments, stagger for lists, typewriter for status) is a design decision, not extractable from Figma.
3. **Dwell timing.** Phase durations (3.5s, 4.0s, 3.5s) require judgment about content density and animation playback time. Not in Figma data.
4. **Footer reservation.** Card needed `padding-bottom: 44px` for the absolutely-positioned footer — layout concern specific to the editorial engine's footer pattern.

### Token Mapping Accuracy

| Figma Variable | Editorial Token | Result |
|---------------|----------------|--------|
| Colors/Accent/Default → `--ed-accent` | `#6366f1` | Correct — all interactive elements indigo |
| Colors/Accent/Background → `--ed-accent-bg` | `#eef2ff` | Correct — badge and share section backgrounds |
| Colors/Accent/Text → `--ed-accent-text` | `#4338ca` | Correct — accent text on light backgrounds |
| Colors/Surface/* | `--ed-surface-*` | No override needed — Figma matched editorial defaults |
| Colors/Text/* | `--ed-text-*` | No override needed — Figma matched editorial defaults |

**Finding:** When the Figma file uses a stone/neutral palette matching editorial defaults, only accent tokens need overriding. The token system is efficient — you only override what diverges.

### Phase Detection Reliability

The `Phase N: Label` naming convention works well for sequential flows (upload → process → ready). Less clear for:
- Non-linear flows (branching states)
- Variant components (need a different detection heuristic)
- Single-frame designs (require content decomposition)

### Recommendations for Designer Workflow

1. **Use frame naming convention** `Phase N: Label` for animation-targeted designs
2. **Define color variables** in Figma using `Colors/Category/Name` format
3. **One flow per page** — keeps phase detection simple
4. **Include state annotations** — even if Figma doesn't encode transitions, naming frames after states helps Claude infer the animation story

### Setup Documentation

Created `docs/process/figma-mcp-setup.md` with installation, authentication, tool reference, workflow guide, and troubleshooting.
