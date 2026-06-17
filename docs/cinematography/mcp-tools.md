# MCP Tools Reference

86 tools across 11 categories. Run via MCP server (`mcp/index.js`).

## Primitives & Reference (8)

| Tool | What |
|------|------|
| `search_primitives` | Search animation primitives by keyword, personality, category |
| `get_primitive` | Get a single primitive by ID with CSS implementation |
| `get_personality` | Get personality rules (timing, easing, camera, guardrails) |
| `recommend_personality_for_context` | Rank the four personalities against a project context |
| `search_breakdowns` | Search animation reference breakdowns |
| `get_breakdown` | Get a single reference breakdown |
| `get_reference_doc` | Get a reference document by slug |
| `recommend_choreography` | Recommend animation choreography for a scene |

**Example — surface a cookbook pattern (ANI-123):**
```json
// search_primitives
{ "source": "pattern", "personality": "cinematic-dark" }
```
Returns the cinematic-dark cookbook patterns (e.g. `product-hero-push-in`, `logo-resolve-close`). Follow up with `get_primitive { "id": "product-hero-push-in" }` for the pattern's composed primitives and recipe doc, or `recommend_choreography { "intent": "dramatic-reveal", "personality": "cinematic-dark" }` for a full camera plan.

## Scene Authoring (10)

| Tool | What |
|------|------|
| `analyze_scene` | Classify content type, visual weight, motion energy, intent tags + semantic annotations |
| `generate_scenes` | Brief → classified assets → validated scene JSON with auto-annotations |
| `figma_frame_to_scene` | Convert a Figma frame into a v3 semantic scene (layers, components, roles, palette) — needs FIGMA_TOKEN, local only. `export_images` downloads real image-fill bitmaps and embeds them as data-URIs (faithful scaleMode incl. pan/zoom CROP); with `project` they're also saved to `brief/references/assets/`. Default off → image fills stay dark placeholders |
| `validate_choreography` | Validate animation choreography against guardrails |
| `compile_motion` | Compile scene motion (groups, stagger, camera) into a timeline |
| `critique_motion` | Critique a compiled timeline for static-track and reactive (lib-*) quality issues |
| `create_editorial_canvas_scene` | Create a flat art-directed editorial canvas scene |
| `recommend_editorial_layout` | Recommend editorial *video-canvas* layout for content |
| `recommend_ui_storyboard_layout` | Recommend a product-UI surface layout (split-pane, table+detail, master-detail, …) |
| `recommend_type_treatment` | Recommend typography animation treatment |

**Example — classify a scene:**
```json
// analyze_scene
{
  "scene": {
    "scene_id": "sc_02_feature_demo",
    "duration_s": 5,
    "layers": [
      { "id": "task_board", "type": "html", "depth_class": "foreground", "content": "<div>…</div>" }
    ]
  }
}
```
Returns content type, visual weight, motion energy, intent tags, and semantic annotations. Pass a real scene from `examples/product-demo/scenes/` to see full output.

## Motion Recipes (4)

| Tool | What |
|------|------|
| `get_motion_recipe` | Get a single motion-token recipe by ID (catalog/motion-recipes.json) |
| `search_motion_recipes` | Search motion recipes by intent / context / personality |
| `validate_motion_token` | Validate a motion usage (raw_duration / raw_easing / recipe_match) |
| `audit_motion_coverage` | Scan a directory for motion-token coverage (minimal in-repo scanner) |

**Example — find a recipe by intent:**
```json
// search_motion_recipes
{ "intent": "entrance", "context": "card", "personality": "editorial" }
```
Returns matching motion-token recipes (id, tokens, interrupt contract, reduced-motion fallback). Fetch one with `get_motion_recipe { "id": "enter.fade-up" }`.

## Sequence Planning (9)

| Tool | What |
|------|------|
| `plan_sequence` | Analyzed scenes + style pack → sequence manifest. Pass `archetype` to plan shot-grammar-first (ANI-179): scenes → shot roles → shot_grammar + camera from the shot, surfaced in notes.shot_list. Accepts the 6 main archetypes **and** the 4 ai-demo archetypes (`prompt_to_answer`, `brief_to_board`, `query_to_report`, `upload_to_insight`, ANI-187) |
| `plan_variants` | Generate multiple sequence variants |
| `compare_variants` | Rank sequence variants |
| `audit_video_accessibility` | WCAG-for-motion audit: flash/strobe, text contrast, captions coverage, autoplay-muted, motion intensity |
| `evaluate_sequence` | Score sequence (pacing, variety, flow, adherence) |
| `validate_manifest` | Validate manifest against personality guardrails |
| `recommend_sequence_archetype` | Recommend archetype for scenes (6 archetypes) |
| `instantiate_sequence_archetype` | Instantiate a sequence archetype |
| `get_style_pack` | Get style pack definition (10 packs) |
| `list_brief_templates` / `get_brief_template` | Brief template catalog (6 templates) |

**Example — plan a sequence from analyzed scenes:**
```json
// plan_sequence
{
  "scenes": [
    { "scene_id": "sc_01", "duration_s": 3, "metadata": { "motion_energy": "subtle" } },
    { "scene_id": "sc_02", "duration_s": 5, "metadata": { "motion_energy": "high" } }
  ],
  "style": "prestige",
  "duration_target_s": 30
}
```
Returns a sequence manifest with chosen transitions and camera. Validate it with `validate_manifest { "manifest": …, "personality": "cinematic-dark" }`.

## Autonomous Direction (9)

| Tool | What |
|------|------|
| `extract_story_brief` | Project context → structured brief with quality score |
| `compose_storyboard` | Brief + archetype + brand → storyboard panels with visual_direction (LLM-enhanced) |
| `plan_story_beats` | Brief + archetype (+ optional storyboard) → beat plan with durations, camera, continuity |
| `score_candidate_video` | Unified 6-dimension score card with per-scene subscores |
| `revise_candidate_video` | 9 bounded manifest transforms (trim, swap, reorder, etc.) |
| `compare_candidate_videos` | Rank 2-3 candidates with trade-off analysis |
| `auto_revise_loop` | Score → revise → re-score → repeat until convergence. `frame_evidence:true` adds a stall-gated rendered hero-frame pass (ANI-180) that drives bounded fixes the JSON loop misses. `allowed_ops` restricts both phases to a set of revision ops (ANI-186 — render_master passes RETIME_OPS to self-heal re-time-only) |
| `generate_brief_stub` | Generate structured brief markdown from project context |
| `render_master` | One Source, Four Masters — resolve+gate+compose a tier master (prototype/directed-html/video/hero-film); fail-closed hero-frame gate on each emitted artifact; renderable `{manifest,sceneDefs,timelines}` for assemble_video_sequence. Opt-in `auto_revise` (ANI-186) runs a bounded RETIME_OPS-constrained frame-evidence pass on a marginal-with-evidence master then re-gates (adopts only a verdict improvement). Opt-in `persist` writes artifacts under `masters/<tier>/` + registers them; `encode` (implies persist) chains assemble→Remotion for one master MP4 per aspect after the gate passes (fail-closed; `dry_run_encode` plans without spawning) — ANI-185 |

**Example — extract a structured brief from raw text:**
```json
// extract_story_brief
{ "brief": "A 25s cinematic-dark demo for Atlas AI, a research assistant. Promise: 10x faster literature review. Proof: 200+ universities, 50M papers." }
```
Returns a structured brief (audience, promise, features, proof) with a quality score. Feed it to `compose_storyboard` → `plan_story_beats` for the autonomous direction loop.

## Scene Annotations & Governance (3)

| Tool | What |
|------|------|
| `annotate_scenes` | Auto-infer product_role, primary_subject, interaction_truth, hero layers with confidence |
| `audit_annotation_quality` | Check annotation quality (advisory/strict modes) |
| `upgrade_project_confidence` | Safe metadata repair — suggest/apply/apply_safe_only patches |

**Example — auto-infer scene semantics:**
```json
// annotate_scenes
{
  "scenes": [
    { "scene_id": "sc_02_feature_demo", "duration_s": 5, "layers": [ { "id": "task_board", "type": "html" } ] }
  ]
}
```
Returns each scene with inferred `product_role`, `primary_subject`, `interaction_truth`, and hero layers (each with a confidence). Gate the result with `audit_annotation_quality`.

## Scoring & Critique (9)

| Tool | What |
|------|------|
| `score_candidate_video` | 6 weighted dimensions: hook, narrative_arc, clarity, visual_hierarchy, motion_quality, brand_finish |
| `score_brand_finish` | Compositing quality score per personality/style |
| `score_product_demo_clarity` | Product interaction truthfulness, camera intent, pacing, hierarchy (structural) |
| `score_frame_strip` | Visual quality: contrast, readability, hierarchy, brand consistency, pacing rhythm |
| `score_hero_frame` | Poster-frame contract — legibility (metadata) vs composition/aesthetic (real rendered pixels + vision judge); per-tier required axes; pixel axes UNVERIFIED without a frame |
| `audit_hero_frames` | Fail-closed gate over a sequence's hero frames — renders each, scores at a tier (T1–T4), BLOCKs on weak/unverified/missing scenes |
| `analyze_scene_comprehension` | LLM judge — perceptual comprehension ("would a human get it?") with reasoning; deterministic fallback |
| `audit_motion_density` | Motion density audit + simplification suggestions |

**Example — audit motion density of a compiled scene:**
```json
// audit_motion_density — `timeline` is the output of compile_motion
{
  "scene": { "scene_id": "sc_02", "duration_s": 5, "layers": [] },
  "timeline": { "tracks": [], "duration_ms": 5000 }
}
```
Returns a density score with per-track simplification suggestions. Get the `timeline` by first calling `compile_motion` on a scene with a `motion` block.

## Brand & Art Direction (7)

| Tool | What |
|------|------|
| `create_brand_package` | Create brand package (colors, typography, motion, surfaces) |
| `get_brand_package` / `list_brand_packages` | Load brand packages |
| `validate_brand_compliance` | Check manifest against brand guardrails |
| `get_art_direction` / `list_art_directions` | Art direction presets (6 directions) |
| `apply_finish_preset` | Apply finish preset (grain, vignette, bloom, color grade) |

**Example — load an art-direction preset:**
```json
// get_art_direction
{ "slug": "prestige-dark" }
```
Returns the preset's palette, type, surface, and finish tokens. Valid slugs: `prestige-dark`, `clean-corporate`, `editorial-warm`, `tech-gradient`, `bold-contrast`, `organic-soft`. List all with `list_art_directions`.

## Continuity & Social (5)

| Tool | What |
|------|------|
| `suggest_match_cuts` | Auto-suggest match cuts between adjacent scenes |
| `plan_continuity_links` | Auto-assign continuity_ids and match strategies |
| `adapt_project_aspect_ratio` | Adapt project to social format (4 ratios) |
| `create_social_cutdown` | Create shortened social version |

**Example — adapt a 16:9 manifest to vertical:**
```json
// adapt_project_aspect_ratio
{
  "manifest": { "sequence_id": "seq_demo", "resolution": { "w": 1920, "h": 1080 }, "scenes": [] },
  "target_aspect_ratio": "9:16",
  "recompose": true
}
```
Returns the manifest re-targeted to 9:16 with recomposed layouts. Valid ratios: `16:9`, `1:1`, `4:5`, `9:16`.

## Audio (2)

| Tool | What |
|------|------|
| `analyze_beats` | Analyze audio for beats, tempo, energy curve |
| `sync_sequence_to_beats` | Snap scene transitions to beat points |

**Example — analyze an audio track for beats:**
```json
// analyze_beats (local only — reads a file path)
{ "audio_path": "public/music/brand-theme.mp3" }
```
Returns tempo, beat timestamps, and an energy curve. Feed it to `sync_sequence_to_beats` to snap transitions onto beats — the payoff of a montage edit.

## Project Management (10)

| Tool | What |
|------|------|
| `init_project` | Create project with directory structure |
| `list_projects` / `get_project` / `get_project_context` | Load projects |
| `save_project_artifact` | Save artifact (brief, manifest, render, review) to project |
| `render_project` | Trigger project render |
| `export_storyboard_to_figma` | Storyboard→Figma export payload + panel stills (agent drives the Figma MCP; sb_<scene_id> contract) |
| `verify_figma_export` | REST read-back: created Figma file vs payload contract (fail-closed) |
| `import_figma_comments` | Designer comments → per-scene storyboard revision notes |
| `review_project` | Generate project review |

**Example — create a project:**
```json
// init_project
{
  "title": "Atlas AI Demo",
  "slug": "atlas-ai-demo",
  "personality": "cinematic-dark",
  "style_pack": "prestige",
  "duration_target_s": 25
}
```
Creates the project directory structure and returns its path/context. Load it later with `get_project_context { "slug": "atlas-ai-demo" }` and save artifacts with `save_project_artifact`.

## Render Pipeline (4)

| Tool | What |
|------|------|
| `resolve_render_targets` | Route scenes to web_native, browser_capture, remotion_native, or hybrid |
| `assemble_video_sequence` | Remotion compositor for mixed plate + native sources |
| `get_delivery_profile` | Channel→quality encoding (8 presets: web-hero, social-feed, etc.) |
| `generate_contact_sheet` / `compare_project_versions` | Storyboard tools |

**Example — route scenes to render targets:**
```json
// resolve_render_targets
{
  "scenes": [
    { "scene_id": "sc_01_atmosphere", "product_role": "atmosphere", "layers": [] },
    { "scene_id": "sc_02_ui_hero", "layers": [ { "id": "app", "type": "html", "content": "<div>…</div>" } ] }
  ],
  "strict": true
}
```
Returns one render target per scene (`web_native` / `browser_capture` / `remotion_native` / `hybrid`) with confidence and the rule that fired — atmosphere routes to `remotion_native`, complex HTML heroes to `browser_capture`.

## Utility (3)

| Tool | What |
|------|------|
| `generate_video` | End-to-end prompt → video (6-stage pipeline) |
| `create_personality` / `list_personalities` | Manage custom personalities |
| `run_benchmarks` | Run benchmark suite |

**Example — prompt → video in one call:**
```json
// generate_video (end-to-end 6-stage pipeline)
{
  "prompt": "A 20s cinematic-dark teaser for Canvas, a design tool. Confident, unhurried, atmosphere over feature lists.",
  "personality": "cinematic-dark",
  "style": "prestige",
  "enhance": true
}
```
Runs brief → scenes → plan → evaluate → validate → render and returns the project with its manifest. Use the granular tools above when you need to steer any single stage.

---

> **Tip:** every example above is a real, paste-able tool call. For complete brief→video examples that chain these tools, see the [cookbook walkthroughs](../cookbook/walkthroughs/INDEX.md).
