# animatic-mcp

**AI cinematography MCP server.** Gives your AI assistant a full motion-design pipeline — 78 tools, 4 animation personalities, 156 motion primitives, and 20 reference breakdowns — so it can search, compose, validate, and compile production CSS and video sequences without writing keyframes by hand.

Works with any MCP-compatible assistant: Claude Code, Claude Desktop, Cursor, and VS Code.

## Install

```bash
claude mcp add animatic -- npx -y animatic-mcp
```

Or add it to your MCP client config:

```json
{
  "mcpServers": {
    "animatic": {
      "command": "npx",
      "args": ["-y", "animatic-mcp"]
    }
  }
}
```

Requires Node.js ≥ 20. The Anthropic SDK is an optional peer dependency — set `ANTHROPIC_API_KEY` to enable LLM-enhanced tools (scene generation, storyboard composition, comprehension judging); without a key, those tools fall back to deterministic output.

## What you get

- **78 tools** — search, compose, validate, compile, score, capture, and direct.
- **4 personalities** — `cinematic-dark`, `editorial`, `neutral-light`, `montage`. Each is a complete motion system (timing tiers, easing curves, camera constraints, forbidden techniques) that narrows the AI's decision space to consistent, on-brand output.
- **156 primitives** across engine, research, animate.style, and breakdown sources.
- **10 style packs**, **6 sequence archetypes**, **6 art directions**, **8 delivery profiles**.
- **20 reference breakdowns** — frame-by-frame analyses of exemplary animations.

## Quick start

Ask your assistant:

```
Use generate_video to create a 30-second promo for an AI finance dashboard,
cinematic-dark personality, prestige style.
```

It generates scenes, plans the sequence, compiles motion timelines, and scores quality — in one call. For step-by-step control, the pipeline splits into discover → compose → compile.

## Docs

Full documentation: https://presetai.dev/animatic

## License

MIT © fndd, LLC
