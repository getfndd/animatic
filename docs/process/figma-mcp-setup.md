# Figma MCP Server — Setup Guide

How to connect Claude Code to Figma for reading design context, extracting variables, and capturing screenshots.

## Prerequisites

- Claude Code CLI installed
- Figma account (Professional or higher for variable extraction)
- Access to the Figma files you want to read

## Installation

The Figma MCP server runs at user scope (each person authenticates with their own account). It's not checked into the repo.

```bash
claude mcp add --transport http figma --scope user https://mcp.figma.com/mcp
```

This adds the server to `~/.claude.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

## Authentication

1. Start Claude Code
2. Run `/mcp` to open the MCP management menu
3. Select **figma**
4. Click **Authenticate**
5. Browser opens — sign in to Figma and click **Allow Access**

Authentication uses OAuth. Tokens are managed by Claude Code and refreshed automatically.

## Available Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `get_design_context` | Structured design data from a Figma URL | Starting point — extracts layout, components, text, colors |
| `get_variable_defs` | Design tokens/variables from a file | Map Figma variables to personality token overrides (`--ed-*`, `--cd-*`) |
| `get_screenshot` | Screenshot of a specific node | Visual reference for comparison after HTML generation |
| `get_metadata` | File metadata (name, last modified, etc.) | Checking file info before extraction |
| `whoami` | Current user info | Verifying connection and access level |

Plus annotation tools, code connect, and component documentation tools.

## Workflow: Figma → Animate Pipeline

```
Figma Frame → get_design_context → Claude generates HTML → /animate → autoplay
                get_variable_defs → token overrides (--ed-*, --cd-*)
                get_screenshot → visual comparison
```

### Step-by-step

1. **Copy the Figma frame URL** — select the frame in Figma, copy the URL from the address bar
2. **Extract design context:** `get_design_context(url)` returns structured node tree
3. **Extract variables:** `get_variable_defs(fileKey)` returns design tokens
4. **Generate HTML** — Claude transforms context to semantic HTML with phase markers
5. **Apply personality** — `/animate prototype.html --personality editorial`

### Phase Detection from Figma Frames

The pipeline infers animation phases from Figma frame structure:

| Figma Pattern | Detection |
|---------------|-----------|
| Multiple top-level frames named "Phase N: Label" | Each frame = one phase |
| Frames named "Step 1: Upload", "Step 2: Process" | Parsed as sequential phases |
| Variant components with different states | States map to phase transitions |
| Single frame with logical sections | Decomposed into phases by content hierarchy |

**Designer tip:** Name your frames with the pattern `Phase N: Label` for automatic detection.

### Token Mapping

Figma variables map to personality token overrides:

```
Figma: Colors/Accent/Default = #6366f1
  →  tokenOverrides: { '--ed-accent': '#6366f1' }

Figma: Colors/Surface/Card = #ffffff
  →  tokenOverrides: { '--ed-surface-card': '#ffffff' }
```

The mapping convention:

| Figma Variable Path | Editorial Token | Cinematic Token |
|-------------------|-----------------|-----------------|
| Colors/Surface/Primary | `--ed-bg-body` | `--cd-bg-body` |
| Colors/Surface/Card | `--ed-surface-card` | `--cd-surface-card` |
| Colors/Surface/Secondary | `--ed-surface-secondary` | `--cd-surface-secondary` |
| Colors/Text/Primary | `--ed-text-primary` | `--cd-text-primary` |
| Colors/Text/Secondary | `--ed-text-secondary` | `--cd-text-secondary` |
| Colors/Accent/Default | `--ed-accent` | `--cd-accent` |
| Colors/Accent/Background | `--ed-accent-bg` | `--cd-accent-bg` |

## Troubleshooting

### Authentication Issues

**"Not authenticated" error:**
Re-run `/mcp` → figma → Authenticate. OAuth tokens may have expired.

**"Rate limited" error:**
The Official Figma MCP has rate limits of 10-20 requests/min depending on your Figma plan. Wait 60 seconds and retry. For complex files with many frames, batch your reads.

**"File not found" error:**
Verify you have access to the file in Figma (open it in browser first). The MCP uses your personal access — shared files require explicit access.

### Variable Extraction

**No variables returned:**
Variables require Figma Professional plan or higher. Free accounts can't access `get_variable_defs`.

**Variables don't map to tokens:**
The mapping is convention-based. If your Figma file uses non-standard variable naming, you'll need to manually map them. Standard convention: `Colors/Category/Name`.

### Connection Issues

**MCP server not responding:**
Check `/mcp` status. If the server shows as disconnected, try:
1. Restart Claude Code
2. Re-add the server: `claude mcp add --transport http figma --scope user https://mcp.figma.com/mcp`
3. Re-authenticate

**Tools not appearing in search:**
The Figma MCP tools load after authentication. If `ToolSearch` doesn't find Figma tools, authentication hasn't completed successfully.
