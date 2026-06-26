/**
 * Tool group manifest — the single source of truth for which Animatic MCP
 * tools may be hosted on the stateless cloud edge vs. which require durable
 * project state or a local render runtime.
 *
 * Background: PRE-1439 (Preset App) — hosted Animatic MCP. An architecture
 * review (Alan/Hicks/Eames, 2026-05-24) established that the 78-tool server
 * is NOT a uniform "wrap in an edge function" target: a subset writes files
 * and shells out to Remotion (`npx remotion render`), which a Supabase edge
 * function (ephemeral Deno isolate, no writable FS, no Chromium/ffmpeg)
 * cannot run. Tools split into three availability tiers:
 *
 *   TIER 1 — reference/transform: stateless, pure logic over catalogs or
 *            inline args. Hosted on edge, free, account-gated (ak_* token).
 *   TIER 2 — project-state: durable per-user documents. Edge-hostable ONLY
 *            once backed by Supabase Storage / a projects table (deferred).
 *   TIER 3 — render/runtime: needs Chromium + ffmpeg + minutes of compute.
 *            Stays LOCAL — the hosted tool returns resolved render-props +
 *            a command for the user's local Remotion runtime to execute.
 *            (Nothing proprietary ships: Remotion is open source; the IP is
 *            the routing/scoring logic, which stays server-side in Tier 1.)
 *
 * The edge gateway derives its `exclude` list AND its per-tool schema
 * transforms from this manifest, mirroring the Preset gateway pattern
 * (universe sourced from the package so drift fails closed). A tool with
 * edgeReady:false is excluded from the hosted surface until proven safe —
 * never silently exposed.
 *
 * REGISTRATION CONTRACT (so this is a true registration source of truth, not
 * just an exclude list): `edgeReady:true` means edge-safe ONLY after the
 * registration helper applies the tool's declared `stripParams` to its input
 * schema. Some tools advertise params that imply server-side state or a disk
 * write (a dead `project:` slug, an `output_dir`) — unsafe on a stateless
 * edge but harmless once removed. That condition is encoded as machine-
 * enforceable data (`stripParams`), NOT a prose note: the seam MUST honor it.
 * A `note` is informational only and never gates edge-safety.
 *
 * Write/spawn evidence: lib audit (2026-05-25) flagged writes/spawns in
 * projects.js, brands.js, video.js (render), tts.js (audio), preflight.js,
 * video-assembly.js (optional output_dir). telemetry.js writes but is
 * wrapped in try/catch and degrades safely on edge.
 *
 * Read evidence (ANI-160): the first audit checked writes/spawns but not hidden
 * READS of a caller-supplied path. analyze_beats does readFileSync(audio_path)
 * on a local path — unusable on a stateless edge — so it is edgeReady:false.
 * When auditing a new edge-ready tool, also confirm it never reads a local FS
 * path from its args; inline data (base64/url) or catalog reads are fine.
 */

export const TIER = {
  REFERENCE: 'tier1-reference',   // pure catalog reads
  TRANSFORM: 'tier1-transform',   // pure logic over inline args (plan/score/validate/audit/recommend)
  PROJECT: 'tier2-project',       // durable project state — storage-back before edge
  RENDER: 'tier3-render',         // render/runtime — local execution only
};

/**
 * name -> { tier, edgeReady, note? }
 *
 * edgeReady === true  => safe to expose on the hosted edge surface NOW.
 * edgeReady === false => excluded from edge until the note's condition clears
 *                        (fail-closed: unverified == excluded).
 */
export const TOOL_GROUPS = {
  // ── Tier 1: reference (pure catalog reads) ──────────────────────────────
  search_primitives: { tier: TIER.REFERENCE, edgeReady: true },
  get_primitive: { tier: TIER.REFERENCE, edgeReady: true },
  get_personality: { tier: TIER.REFERENCE, edgeReady: true },
  list_personalities: { tier: TIER.REFERENCE, edgeReady: true },
  search_breakdowns: { tier: TIER.REFERENCE, edgeReady: true },
  get_breakdown: { tier: TIER.REFERENCE, edgeReady: true },
  get_reference_doc: { tier: TIER.REFERENCE, edgeReady: true },
  get_style_pack: { tier: TIER.REFERENCE, edgeReady: true },
  list_brief_templates: { tier: TIER.REFERENCE, edgeReady: true },
  get_brief_template: { tier: TIER.REFERENCE, edgeReady: true },
  get_art_direction: { tier: TIER.REFERENCE, edgeReady: true },
  list_art_directions: { tier: TIER.REFERENCE, edgeReady: true },
  get_motion_recipe: { tier: TIER.REFERENCE, edgeReady: true },
  search_motion_recipes: { tier: TIER.REFERENCE, edgeReady: true },
  get_delivery_profile: { tier: TIER.REFERENCE, edgeReady: true },
  recommend_sequence_archetype: { tier: TIER.REFERENCE, edgeReady: true },
  recommend_personality_for_context: { tier: TIER.REFERENCE, edgeReady: true },

  // ── Tier 1: transform / plan (pure logic over inline args) ──────────────
  recommend_choreography: { tier: TIER.TRANSFORM, edgeReady: true },
  validate_choreography: { tier: TIER.TRANSFORM, edgeReady: true },
  analyze_scene: { tier: TIER.TRANSFORM, edgeReady: true },
  figma_frame_to_scene: { tier: TIER.TRANSFORM, edgeReady: false, note: 'reads the user-local FIGMA_TOKEN env (BYOK, ANI-114) and makes outbound Figma API calls; export_images also downloads fill bitmaps and writes them to the local project (ANI-175) — LOCAL only; a hosted variant would need per-account token storage' },
  lottie_to_scene: { tier: TIER.TRANSFORM, edgeReady: true, note: 'pure transform over inline Lottie JSON (ANI-199) — no FS, network, or Chromium; .json only (no .lottie ZIP). Edge-safe' },
  export_storyboard_to_figma: { tier: TIER.RENDER, edgeReady: false, note: 'reads project state + spawns Remotion stills for panel PNGs (ANI-113) — LOCAL only' },
  verify_figma_export: { tier: TIER.TRANSFORM, edgeReady: false, note: 'reads the user-local FIGMA_TOKEN env (BYOK, ANI-113) — LOCAL only, same constraint as figma_frame_to_scene' },
  import_figma_comments: { tier: TIER.TRANSFORM, edgeReady: false, note: 'reads the user-local FIGMA_TOKEN env (BYOK, ANI-113) — LOCAL only, same constraint as figma_frame_to_scene' },
  plan_sequence: { tier: TIER.TRANSFORM, edgeReady: true },
  evaluate_sequence: { tier: TIER.TRANSFORM, edgeReady: true },
  validate_manifest: { tier: TIER.TRANSFORM, edgeReady: true },
  plan_variants: { tier: TIER.TRANSFORM, edgeReady: true },
  compare_variants: { tier: TIER.TRANSFORM, edgeReady: true },
  // Not edge-ready: handleAnalyzeBeats does readFileSync(audio_path) on a
  // caller-supplied LOCAL path, which doesn't exist on a stateless edge isolate
  // (ANI-160). Re-enable only with an inline contract (audio_base64/audio_url +
  // stripParams:['audio_path']), not by flipping this back to true.
  analyze_beats: { tier: TIER.TRANSFORM, edgeReady: false, note: 'reads a local audio_path file; needs an inline-audio contract before edge (ANI-160)' },
  audit_video_accessibility: { tier: TIER.TRANSFORM, edgeReady: false, note: 'optionally reads a local video_path + shells to ffmpeg/ffprobe for frame analysis (ANI-122) — same local-path constraint as analyze_beats' },
  sync_sequence_to_beats: { tier: TIER.TRANSFORM, edgeReady: true },
  compile_motion: { tier: TIER.TRANSFORM, edgeReady: true },
  critique_motion: { tier: TIER.TRANSFORM, edgeReady: true },
  run_benchmarks: { tier: TIER.TRANSFORM, edgeReady: true },
  plan_hero_moments: { tier: TIER.TRANSFORM, edgeReady: true },
  score_brand_finish: { tier: TIER.TRANSFORM, edgeReady: true },
  validate_brand_compliance: { tier: TIER.TRANSFORM, edgeReady: true },
  score_product_demo_clarity: { tier: TIER.TRANSFORM, edgeReady: true },
  analyze_scene_comprehension: { tier: TIER.TRANSFORM, edgeReady: true },
  instantiate_sequence_archetype: { tier: TIER.TRANSFORM, edgeReady: true },
  apply_finish_preset: { tier: TIER.TRANSFORM, edgeReady: true },
  audit_motion_density: { tier: TIER.TRANSFORM, edgeReady: true },
  audit_motion_coverage: { tier: TIER.TRANSFORM, edgeReady: true },
  generate_contact_sheet: { tier: TIER.TRANSFORM, edgeReady: true, stripParams: ['project'], note: 'pure over inline manifest/scenes; the dead `project:` param is stripped on edge (enforced via stripParams)' },
  compare_project_versions: { tier: TIER.TRANSFORM, edgeReady: true, stripParams: ['project', 'version_a', 'version_b'], note: 'pure over inline manifest_a/b; dead project/version params stripped on edge (enforced via stripParams)' },
  create_editorial_canvas_scene: { tier: TIER.TRANSFORM, edgeReady: true },
  recommend_editorial_layout: { tier: TIER.TRANSFORM, edgeReady: true },
  recommend_ui_storyboard_layout: { tier: TIER.TRANSFORM, edgeReady: true },
  recommend_type_treatment: { tier: TIER.TRANSFORM, edgeReady: true },
  validate_motion_token: { tier: TIER.TRANSFORM, edgeReady: true },
  adapt_project_aspect_ratio: { tier: TIER.TRANSFORM, edgeReady: true, note: 'transforms inline manifest; "project" in name is a misnomer' },
  suggest_match_cuts: { tier: TIER.TRANSFORM, edgeReady: true },
  plan_continuity_links: { tier: TIER.TRANSFORM, edgeReady: true },
  extract_story_brief: { tier: TIER.TRANSFORM, edgeReady: true },
  compose_storyboard: { tier: TIER.TRANSFORM, edgeReady: true },
  plan_story_beats: { tier: TIER.TRANSFORM, edgeReady: true },
  score_candidate_video: { tier: TIER.TRANSFORM, edgeReady: true, note: 'pure scoring over inline objects (scoring.js — proprietary rubric, stays server-side)' },
  score_hero_frame: { tier: TIER.TRANSFORM, edgeReady: true, note: 'pure scoring over an inline scene; composition/aesthetic axes only score when given a pre-rendered frame + ANTHROPIC_API_KEY (vision), else UNVERIFIED' },
  audit_hero_frames: { tier: TIER.TRANSFORM, edgeReady: false, note: 'renders one still per scene via Remotion (bundler + headless Chrome) to score composition on real pixels — local toolchain, same constraint as audit_video_accessibility' },
  render_master: { tier: TIER.TRANSFORM, edgeReady: false, note: 'loads a project from disk + runs the hero-frame gate (Remotion stills) on each emitted artifact — local toolchain, like render_project/audit_hero_frames' },
  revise_candidate_video: { tier: TIER.TRANSFORM, edgeReady: true },
  compare_candidate_videos: { tier: TIER.TRANSFORM, edgeReady: true },
  audit_annotation_quality: { tier: TIER.TRANSFORM, edgeReady: true },
  upgrade_project_confidence: { tier: TIER.TRANSFORM, edgeReady: true, note: 'pure over inline scenes/manifest despite name' },
  generate_brief_stub: { tier: TIER.TRANSFORM, edgeReady: true },
  score_frame_strip: { tier: TIER.TRANSFORM, edgeReady: true },
  resolve_render_targets: { tier: TIER.TRANSFORM, edgeReady: true, note: 'deterministic render-target routing (render-routing.js — proprietary, stays server-side); emits routes, does not render' },
  assemble_video_sequence: { tier: TIER.TRANSFORM, edgeReady: true, stripParams: ['output_dir'], note: 'pure; emits a render COMMAND string. output_dir (the only disk write) is stripped on edge (enforced via stripParams)' },

  // ── Tier 2: project / session state (durable per-user docs) ─────────────
  init_project: { tier: TIER.PROJECT, edgeReady: false, note: 'mkdir + write project.json (projects.js); Tier 2 — storage-back' },
  list_projects: { tier: TIER.PROJECT, edgeReady: false, note: 'readdir over projects/ (projects.js); Tier 2' },
  get_project: { tier: TIER.PROJECT, edgeReady: false, note: 'reads project tree (projects.js); Tier 2' },
  get_project_context: { tier: TIER.PROJECT, edgeReady: false, note: 'read-fan-out over project tree (projects.js); Tier 2' },
  save_project_artifact: { tier: TIER.PROJECT, edgeReady: false, note: 'read-modify-write project.json (projects.js); Tier 2' },
  review_project: { tier: TIER.PROJECT, edgeReady: false, note: 'reads scenes, writes review/evaluation.json (projects.js + preflight.js); Tier 2' },
  record_render_feedback: { tier: TIER.PROJECT, edgeReady: false, note: 'appends human feedback to the local project review/feedback.json with a manifest snapshot (feedback.js, ANI-120) — LOCAL only' },
  recalibrate_scoring_weights: { tier: TIER.PROJECT, edgeReady: false, note: 'scans the local projects tree for accumulated feedback and proposes weight adjustments (feedback.js, ANI-120) — LOCAL only; proposal-only, never mutates' },
  create_brand_package: { tier: TIER.PROJECT, edgeReady: false, note: 'writeFileSync catalog/brands/{id}.json (brands.js); Tier 2 — storage-back the write path' },
  create_personality: { tier: TIER.PROJECT, edgeReady: false, note: 'in-memory customPersonalities Map, but the workflow DEPENDS on cross-call reuse (later calls reference the created personality). A stateless edge isolate drops it after the request → broken affordance. Needs session/storage backing before edge (line-113 review)' },

  // ── Tier 3: render / runtime (local execution only) ─────────────────────
  render_project: { tier: TIER.RENDER, edgeReady: false, note: 'spawns `npx remotion render` (video.js, 10-min timeout). LOCAL only — hosted variant returns resolved props + command' },
  preview_video: { tier: TIER.RENDER, edgeReady: false, note: 'spawns node scripts/preview.mjs → Remotion Studio on localhost. LOCAL only' },

  // ── Held back pending per-handler audit (fail-closed: likely write/spawn) ─
  generate_video: { tier: TIER.TRANSFORM, edgeReady: false, note: 'VERIFY: video.js has 5 write/spawn hits; does not render but may write scene files. Audit handler before edge' },
  generate_scenes: { tier: TIER.TRANSFORM, edgeReady: false, note: 'VERIFY: may write scene files. Audit handler before edge' },
  annotate_scenes: { tier: TIER.TRANSFORM, edgeReady: false, note: 'VERIFY: may write annotations to disk. Audit handler before edge' },
  auto_revise_loop: { tier: TIER.TRANSFORM, edgeReady: false, note: 'VERIFY: loop may persist intermediate artifacts. Audit handler before edge' },
  create_social_cutdown: { tier: TIER.TRANSFORM, edgeReady: false, note: 'VERIFY: may write cutdown files / touch tts.js audio. Audit handler before edge' },
  get_brand_package: { tier: TIER.REFERENCE, edgeReady: false, note: 'VERIFY: reads catalog/brands incl. runtime-created brands; on edge only bundled brands exist. Decide bundled-only vs Tier-2 storage read' },
  list_brand_packages: { tier: TIER.REFERENCE, edgeReady: false, note: 'VERIFY: as get_brand_package' },
};

/** Tools safe to expose on the hosted edge surface right now. */
export const EDGE_TOOLS = Object.keys(TOOL_GROUPS).filter((n) => TOOL_GROUPS[n].edgeReady);

/** Tools the edge gateway must exclude (Tier 2/3 + unverified). */
export const EDGE_EXCLUDE = Object.keys(TOOL_GROUPS).filter((n) => !TOOL_GROUPS[n].edgeReady);

/** True if `name` may be served from the stateless cloud edge. */
export function isEdgeReady(name) {
  return TOOL_GROUPS[name]?.edgeReady === true;
}

/**
 * Params the edge registration helper MUST strip from a tool's input schema
 * before exposing it. Enforces the REGISTRATION CONTRACT (see header): these
 * are unsafe on a stateless edge (imply server-side state or a disk write)
 * but harmless once removed. Returns [] for tools with no required transform.
 */
export function edgeStripParams(name) {
  return TOOL_GROUPS[name]?.stripParams ?? [];
}

/** Tools in a given tier (e.g. TIER.RENDER for the local-render skill surface). */
export function toolsInTier(tier) {
  return Object.keys(TOOL_GROUPS).filter((n) => TOOL_GROUPS[n].tier === tier);
}
