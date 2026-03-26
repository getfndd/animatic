# MCP Tools Reference

70 tools across 10 categories. Run via MCP server (`mcp/index.js`).

## Primitives & Reference (7)

| Tool | What |
|------|------|
| `search_primitives` | Search animation primitives by keyword, personality, category |
| `get_primitive` | Get a single primitive by ID with CSS implementation |
| `get_personality` | Get personality rules (timing, easing, camera, guardrails) |
| `search_breakdowns` | Search animation reference breakdowns |
| `get_breakdown` | Get a single reference breakdown |
| `get_reference_doc` | Get a reference document by slug |
| `recommend_choreography` | Recommend animation choreography for a scene |

## Scene Authoring (8)

| Tool | What |
|------|------|
| `analyze_scene` | Classify content type, visual weight, motion energy, intent tags + semantic annotations |
| `generate_scenes` | Brief → classified assets → validated scene JSON with auto-annotations |
| `validate_choreography` | Validate animation choreography against guardrails |
| `compile_motion` | Compile scene motion (groups, stagger, camera) into a timeline |
| `critique_motion` | Critique a compiled timeline for quality issues (13 rules) |
| `create_editorial_canvas_scene` | Create a flat art-directed editorial canvas scene |
| `recommend_editorial_layout` | Recommend editorial layout for content |
| `recommend_type_treatment` | Recommend typography animation treatment |

## Sequence Planning (9)

| Tool | What |
|------|------|
| `plan_sequence` | Analyzed scenes + style pack → sequence manifest |
| `plan_variants` | Generate multiple sequence variants |
| `compare_variants` | Rank sequence variants |
| `evaluate_sequence` | Score sequence (pacing, variety, flow, adherence) |
| `validate_manifest` | Validate manifest against personality guardrails |
| `recommend_sequence_archetype` | Recommend archetype for scenes (6 archetypes) |
| `instantiate_sequence_archetype` | Instantiate a sequence archetype |
| `get_style_pack` | Get style pack definition (8 packs) |
| `list_brief_templates` / `get_brief_template` | Brief template catalog (5 templates) |

## Autonomous Direction (7)

| Tool | What |
|------|------|
| `extract_story_brief` | Project context → structured brief with quality score |
| `plan_story_beats` | Brief + archetype → beat plan with durations, camera, continuity |
| `score_candidate_video` | Unified 6-dimension score card with per-scene subscores |
| `revise_candidate_video` | 9 bounded manifest transforms (trim, swap, reorder, etc.) |
| `compare_candidate_videos` | Rank 2-3 candidates with trade-off analysis |
| `auto_revise_loop` | Score → revise → re-score → repeat until convergence |
| `generate_brief_stub` | Generate structured brief markdown from project context |

## Scene Annotations & Governance (3)

| Tool | What |
|------|------|
| `annotate_scenes` | Auto-infer product_role, primary_subject, interaction_truth, hero layers with confidence |
| `audit_annotation_quality` | Check annotation quality (advisory/strict modes) |
| `upgrade_project_confidence` | Safe metadata repair — suggest/apply/apply_safe_only patches |

## Scoring & Critique (5)

| Tool | What |
|------|------|
| `score_candidate_video` | 6 weighted dimensions: hook, narrative_arc, clarity, visual_hierarchy, motion_quality, brand_finish |
| `score_brand_finish` | Compositing quality score per personality/style |
| `score_product_demo_clarity` | Product interaction truthfulness, camera intent, pacing, hierarchy |
| `score_frame_strip` | Visual quality: contrast, readability, hierarchy, brand consistency, pacing rhythm |
| `audit_motion_density` | Motion density audit + simplification suggestions |

## Brand & Art Direction (7)

| Tool | What |
|------|------|
| `create_brand_package` | Create brand package (colors, typography, motion, surfaces) |
| `get_brand_package` / `list_brand_packages` | Load brand packages |
| `validate_brand_compliance` | Check manifest against brand guardrails |
| `get_art_direction` / `list_art_directions` | Art direction presets (6 directions) |
| `apply_finish_preset` | Apply finish preset (grain, vignette, bloom, color grade) |

## Continuity & Social (5)

| Tool | What |
|------|------|
| `suggest_match_cuts` | Auto-suggest match cuts between adjacent scenes |
| `plan_continuity_links` | Auto-assign continuity_ids and match strategies |
| `adapt_project_aspect_ratio` | Adapt project to social format (4 ratios) |
| `create_social_cutdown` | Create shortened social version |

## Audio (2)

| Tool | What |
|------|------|
| `analyze_beats` | Analyze audio for beats, tempo, energy curve |
| `sync_sequence_to_beats` | Snap scene transitions to beat points |

## Project Management (7)

| Tool | What |
|------|------|
| `init_project` | Create project with directory structure |
| `list_projects` / `get_project` / `get_project_context` | Load projects |
| `save_project_artifact` | Save artifact (brief, manifest, render, review) to project |
| `render_project` | Trigger project render |
| `review_project` | Generate project review |

## Render Pipeline (4)

| Tool | What |
|------|------|
| `resolve_render_targets` | Route scenes to web_native, browser_capture, remotion_native, or hybrid |
| `assemble_video_sequence` | Remotion compositor for mixed plate + native sources |
| `get_delivery_profile` | Channel→quality encoding (8 presets: web-hero, social-feed, etc.) |
| `generate_contact_sheet` / `compare_project_versions` | Storyboard tools |

## Utility (3)

| Tool | What |
|------|------|
| `generate_video` | End-to-end prompt → video (6-stage pipeline) |
| `create_personality` / `list_personalities` | Manage custom personalities |
| `run_benchmarks` | Run benchmark suite |
