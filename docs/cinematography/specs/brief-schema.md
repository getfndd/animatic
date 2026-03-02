# Creative Brief Schema

**Status:** Draft
**Issue:** ANI-32
**Version:** 0.1

## Overview

A creative brief is the input to the scene generation pipeline (ANI-31). It captures what the human knows — intent, assets, key messages — and the system translates it into scene compositions.

The brief answers three questions:
1. **What are you making?** (type, tone, duration)
2. **What do you have?** (assets, text content)
3. **What matters most?** (hero moments, key messages)

Everything else — scene count, layout selection, camera moves, transitions — is the system's job.

## Schema

```json
{
  "brief_id": "string",
  "template": "product-launch | brand-story | tutorial | investor-pitch | photo-essay | custom",

  "project": {
    "title": "string",
    "description": "string (1-3 sentences — what is this video for?)",
    "duration_target_s": "number (optional — desired total duration in seconds)",
    "style": "string (optional — style pack name: prestige, energy, dramatic, minimal, intimate, corporate, kinetic, fade)"
  },

  "tone": {
    "mood": "string (e.g., confident, warm, urgent, playful, authoritative)",
    "energy": "low | medium | high (overall energy level)",
    "audience": "string (optional — who is watching?)"
  },

  "content": {
    "headline": "string (optional — primary headline or tagline)",
    "sections": [
      {
        "label": "string (e.g., 'Hero', 'Features', 'Social Proof', 'CTA')",
        "text": "string (the message for this section)",
        "emphasis": "normal | strong (optional — strong = hero/emotional treatment)",
        "assets": ["string (asset_id references)"]
      }
    ]
  },

  "assets": [
    {
      "id": "string (unique reference, used in content.sections)",
      "path": "string (relative file path)",
      "type": "image | video | svg | text-file",
      "hint": "string (optional — what this asset shows: 'team headshot', 'product UI', 'logo', 'dashboard screenshot')",
      "role": "hero | supporting | background | logo (optional — how prominent)"
    }
  ],

  "constraints": {
    "must_include": ["string (asset IDs that must appear)"],
    "scene_count": { "min": "number", "max": "number" },
    "brand_colors": ["string (hex values, optional)"],
    "font_family": "string (optional)"
  }
}
```

## Field Reference

### `template`

Selects a pre-built brief template that pre-fills structure and maps to recommended defaults. Templates live in `catalog/brief-templates.json`. Using `custom` means no template — the system infers everything from the content and assets.

### `project`

| Field | Required | Description |
|-------|----------|-------------|
| title | Yes | Project name. May appear in generated typography scenes. |
| description | Yes | 1-3 sentences explaining the video's purpose. Primary input for LLM scene planning. |
| duration_target_s | No | Desired total duration. System adjusts scene count to fit. Default: auto (8-12 scenes at style pack tempo). |
| style | No | Style pack override. If omitted, template provides a default. If no template, system infers from tone. |

### `tone`

Guides the system's creative decisions — which style pack, which animation primitives, how much camera movement.

| Mood | Maps To |
|------|---------|
| confident, authoritative | prestige, corporate |
| warm, intimate, emotional | intimate, dramatic |
| urgent, energetic, bold | energy, kinetic |
| calm, clean, minimal | minimal, fade |
| playful | energy with lighter content |

### `content.sections`

Ordered list of content blocks. Each section becomes one or more scenes. The `label` helps the system assign intent tags:

| Label Pattern | Intent Tag | Typical Treatment |
|---------------|------------|-------------------|
| Hero, Intro, Opening | opening, hero | First scene, strong visual weight |
| Features, Details, How It Works | detail, informational | Middle scenes, varied layouts |
| Testimonial, Social Proof, Quote | emotional | Crossfade transition, push_in camera |
| CTA, Closing, Contact | closing | Final scene, brand mark |
| Team, About | detail | Portrait layouts |

### `assets`

The asset manifest. Each entry references a file and optionally hints at what it contains.

**Classification priority:**
1. Explicit `hint` field (highest confidence)
2. Filename conventions (see below)
3. Vision model classification (when available)
4. File type fallback (image → generic, video → background)

**Filename conventions** (auto-detected):
- `hero-*`, `product-*` → role: hero, content_type: product_shot
- `team-*`, `headshot-*`, `portrait-*` → content_type: portrait
- `ui-*`, `screen-*`, `dashboard-*` → content_type: ui_screenshot
- `logo-*`, `brand-*`, `mark-*` → content_type: brand_mark
- `bg-*`, `background-*` → role: background

### `constraints`

Hard constraints the system must respect:
- `must_include` — asset IDs that must appear in at least one scene
- `scene_count` — min/max bounds on generated scene count
- `brand_colors` — hex values available for typography and backgrounds
- `font_family` — font to use for generated text layers

## Processing Pipeline

```
brief.json
    │
    ▼
[1. Validate brief schema]
    │
    ▼
[2. Classify assets]  ←── vision model (optional)
    │                      filename conventions
    │                      explicit hints
    ▼
[3. Generate scenes]  ←── LLM structured output
    │                      brief + classified assets → scene specs
    │                      single call, JSON output
    ▼
[4. Validate scenes]  ←── scene format spec
    │
    ▼
scenes/*.json  →  sizzle CLI  →  video
```

### Step 2: Asset Classification

Each asset gets a classification object:

```json
{
  "asset_id": "product-dashboard",
  "file_type": "image",
  "content_type": "ui_screenshot",
  "content_type_source": "filename",
  "content_type_confidence": 0.8,
  "suggested_role": "supporting",
  "suggested_layout": "device-mockup"
}
```

Sources in priority order:
1. **hint** (from brief) → confidence 1.0
2. **filename** (convention match) → confidence 0.8
3. **vision** (model classification) → confidence varies
4. **file_type** (fallback) → confidence 0.3

### Step 3: Scene Generation (LLM)

Single structured generation call. Input: brief + classified assets. Output: array of scene specs.

**LLM is responsible for:**
- Deciding scene count (within constraints)
- Assigning assets to scenes
- Choosing layout templates per scene
- Writing text content (headlines, captions, labels)
- Setting layer structure (what goes in foreground/midground/background)
- Suggesting intent tags

**LLM is NOT responsible for:**
- Camera moves (style pack handles this)
- Transitions (planner handles this)
- Scene ordering (planner handles this)
- Hold durations (planner handles this)
- Animation primitives (can suggest, but planner validates)

**Output schema** — each generated scene conforms to the scene format spec. Metadata is optional (analyzeScene fills it in), but the LLM can set `intent_tags` to guide the planner.

### Step 4: Validation

Generated scenes are validated against:
1. Scene format spec (required fields, valid values)
2. Asset references exist
3. Layout template slots match layer assignments
4. Constraint satisfaction (must_include assets, scene count bounds)

Failures are returned to the LLM for a single retry.

## Style Inference

When no `style` is specified:

| Template | Default Style |
|----------|--------------|
| product-launch | prestige |
| brand-story | intimate |
| tutorial | minimal |
| investor-pitch | corporate |
| photo-essay | fade |

When no template either, infer from `tone.energy`:
- low → fade or minimal
- medium → prestige or corporate
- high → energy or kinetic

## Minimal Example

```json
{
  "brief_id": "brief_product_v1",
  "template": "product-launch",
  "project": {
    "title": "Acme Dashboard",
    "description": "30-second product launch sizzle for our new analytics dashboard. Show the UI, highlight key features, end with brand."
  },
  "tone": {
    "mood": "confident",
    "energy": "medium"
  },
  "content": {
    "headline": "Analytics, Reimagined",
    "sections": [
      { "label": "Hero", "text": "Introducing Acme Dashboard", "assets": ["product-hero"], "emphasis": "strong" },
      { "label": "Features", "text": "Real-time metrics. Custom reports. Team sharing.", "assets": ["ui-metrics", "ui-reports"] },
      { "label": "CTA", "text": "Start free today", "assets": ["logo"] }
    ]
  },
  "assets": [
    { "id": "product-hero", "path": "assets/hero-dashboard.png", "type": "image", "hint": "product UI hero shot" },
    { "id": "ui-metrics", "path": "assets/screen-metrics.png", "type": "image" },
    { "id": "ui-reports", "path": "assets/screen-reports.png", "type": "image" },
    { "id": "logo", "path": "assets/logo-acme.svg", "type": "svg", "hint": "company logo" }
  ]
}
```

This brief would generate ~4-5 scenes: opening typography, hero product shot (device-mockup), feature split-panels, closing brand mark.
