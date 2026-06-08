---
walkthrough: ai-prompt-to-result
title: "Walkthrough — Atlas AI Prompt-to-Result Demo"
project: examples/ai-prompt-to-result
personality: cinematic-dark
scenes: 5
duration: 19.6s
patterns: [chat-to-result-reveal, progress-resolve]
breakdown: nume-ai-chat-dashboard
---

# Walkthrough — Atlas AI Prompt-to-Result Demo

A 20-second AI product demo: a researcher types a question, the system visibly works, and structured results with citations resolve. The cleanest illustration of the prompt → working-state → payoff loop that anchors most AI demos.

**Project:** [`examples/ai-prompt-to-result/`](../../../examples/ai-prompt-to-result/)

## Contact Sheet

![Atlas AI contact sheet — 5 scenes](assets/ai-prompt-to-result-contact-sheet.png)

*Left to right: context setup, prompt typing in, processing/working state, result reveal with citations, CTA close.*

## 1. Brief

From [`brief.md`](../../../examples/ai-prompt-to-result/brief.md): Atlas AI, a research assistant. Promise — "10x faster literature review." Cinematic-dark, 25s authored. Proof points: 200+ universities, 50M+ papers, 4.2s average query-to-result.

## 2. Scenes → JSON

Scene 2 (prompt input) is the **chat-to-result-reveal** opening — a typewriter types the query while the cursor blinks, under a barely-there push-in:

```json
{
  "scene_id": "sc_02_prompt_input",
  "duration_s": 4,
  "motion": {
    "groups": [
      { "targets": ["chat_input"], "primitive": "cd-typewriter", "stagger": 40 },
      { "targets": ["cursor"], "primitive": "cd-cursor-blink", "delay_ms": 200 }
    ],
    "camera": { "move": "push_in", "intensity": 0.06, "sync": { "peak_at": 0.7 } }
  }
}
```

Scene 3 (`sc_03_processing`) is the **progress-resolve** beat — the working state that makes the answer feel earned. See [`scenes/sc_03_processing.json`](../../../examples/ai-prompt-to-result/scenes/sc_03_processing.json).

## 3. Manifest → ordering

```json
{
  "sequence_id": "seq_ai_prompt_to_result",
  "resolution": { "w": 1920, "h": 1080 },
  "fps": 60,
  "scenes": [
    { "scene": "sc_01_context", "duration_s": 4 },
    { "scene": "sc_02_prompt_input", "duration_s": 4, "transition_in": { "type": "crossfade", "duration_ms": 400 } },
    { "scene": "sc_03_processing", "duration_s": 4, "transition_in": { "type": "hard_cut" } },
    { "scene": "sc_04_result_reveal", "duration_s": 6, "transition_in": { "type": "crossfade", "duration_ms": 500 } },
    { "scene": "sc_05_cta", "duration_s": 4, "transition_in": { "type": "crossfade", "duration_ms": 500 } }
  ]
}
```

Full manifest at [`manifest.json`](../../../examples/ai-prompt-to-result/manifest.json). Total: 22s raw − 2.4s overlap = **19.6s**.

## 4. Render

Ships a precompiled `render-props.json`:

```bash
npx remotion render Sequence \
  --props=examples/ai-prompt-to-result/render-props.json \
  --output=renders/ai-prompt-to-result.mp4 --gl=angle

node scripts/render-cookbook-contact-sheets.mjs ai-prompt-to-result
```

## Patterns demonstrated

| Scene | Cookbook pattern |
|-------|------------------|
| sc_02 prompt input | [chat-to-result-reveal](../chat-to-result-reveal.md) |
| sc_03 processing | [progress-resolve](../progress-resolve.md) |
| sc_04 result reveal | [chat-to-result-reveal](../chat-to-result-reveal.md) (the payoff half) |
