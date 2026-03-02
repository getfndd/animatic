---
name: storyboard
description: "[PLANNED] Brief → classified assets → generated scenes. Depends on ANI-31."
---

# /storyboard - Brief to Scenes (Planned)

> **Status: PLANNED** — This command is not yet functional. It depends on ANI-31 (asset classification + LLM scene generation).

Transform a creative brief into a set of scene JSON files ready for the sizzle pipeline.

---

## Planned Workflow

### 1. Load Brief

Read and validate `brief.json` against the schema in `docs/cinematography/specs/brief-schema.md`.

### 2. Classify Assets

For each asset referenced in the brief:
- Parse filename conventions for type hints
- Read asset hints from the brief
- (Future) Use vision model for content classification
- Assign asset roles: hero, supporting, background, overlay

### 3. Generate Scenes (LLM)

Use structured output from an LLM to generate scene specifications:
- Map brief sections to scenes
- Assign assets to layers
- Set duration targets from brief constraints
- Apply template-specific scene patterns

### 4. Validate Scenes

Validate each generated scene against the scene format spec (`docs/cinematography/specs/scene-format.md`):
- Required fields present
- Layer structure valid
- Duration within bounds
- Asset references resolve

### 5. Write Scene Files

Write individual scene JSON files to a directory:
```
scenes/
├── 00-opening.json
├── 01-hero.json
├── 02-features.json
├── 03-demo.json
└── 04-closing.json
```

---

## Not Yet Implemented

This skill requires:
- Asset classification engine (ANI-31)
- LLM structured output for scene generation (ANI-31)
- Scene template library

Until ANI-31 is complete, create scene files manually following the scene format spec.

---

## Related Commands

| Command | Purpose |
|---------|---------|
| `/brief` | Author the creative brief (upstream) |
| `/sizzle` | Scenes → rendered video (downstream) |
| `/review` | Evaluate sequence quality |
