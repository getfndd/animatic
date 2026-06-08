---
id: chat-to-result-reveal
title: "Chat Prompt → Result Reveal"
category: conversational
personality: [editorial, cinematic-dark]
duration: ~6s scene
primitives: [bk-chat-typewriter-submit, bk-suggestion-chip-stagger, bd-result-grid]
breakdown: nume-ai-chat-dashboard
tags: [chat, ai, typewriter, progressive-reveal, prompt, product-demo]
---

# Chat Prompt → Result Reveal

The defining pattern of AI product demos: a prompt types itself into an input, submits into a chat bubble, and the answer *builds* — results grid filling row by row, suggestion chips stacking up for the next turn. The typing creates anticipation; the progressive build makes the answer feel computed, not pasted.

**When to use:** any AI-product demo where the prompt→response loop is the story.
**When not to use:** when the response is a single number or sentence — a progressive build of one item deflates.

## Recipe

| Beat | What happens | Timing |
|------|--------------|--------|
| 0.0s | Chat input present, cursor blinking | — |
| 0.2s | Prompt types in, submits to bubble | ~2400ms |
| 2.8s | Result grid fills row by row | 2500ms |
| 4.5s | Suggestion chips stack in | 150ms interval |
| 0–6s | Camera static or minimal drift — UI motion carries the scene | — |

## Manifest Snippet

Scene motion block:

```json
{
  "motion": {
    "camera": { "move": "static", "intensity": 0 },
    "groups": [
      { "id": "prompt", "targets": ["chat_input"], "primitive": "bk-chat-typewriter-submit" },
      { "id": "results", "targets": ["result_grid"], "primitive": "bd-result-grid", "position": ">200" },
      { "id": "chips", "targets": ["suggestion_chips"], "primitive": "bk-suggestion-chip-stagger", "position": ">" }
    ]
  }
}
```

Sequence manifest entry:

```json
{
  "scene": "sc_02_prompt_to_result",
  "duration_s": 6,
  "transition_in": { "type": "hard_cut" }
}
```

## Primitives Used

| ID | Role in pattern |
|----|-----------------|
| `bk-chat-typewriter-submit` | Prompt types → submits → becomes a chat bubble |
| `bd-result-grid` | Answer assembles row by row — the "computed" feel |
| `bk-suggestion-chip-stagger` | Next-turn affordances stack in last |

## Breakdown Reference

[nume-ai-chat-dashboard](../../.claude/skills/animate/reference/breakdowns/nume-ai-chat-dashboard.md) — the canonical chat-to-dashboard progressive build: typewriter, split-pane report assembly, count-ups, streaming rhythm.

## Variations

- **Chat → full dashboard:** chain into [dashboard-data-build](dashboard-data-build.md) with a split-pane layout — the nume breakdown shows the full version
- **Voice-prompt variant:** replace the typewriter with a waveform layer, keep the result build identical
- **Cinematic-dark:** add `ct-glow-pulse` behind the result grid; keep typing speed unchanged (28–50ms/char reads as "real")
