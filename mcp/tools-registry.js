/**
 * Single tool registration path for the Animatic MCP server (PRE-1439).
 *
 * Builds the tools/list and the CallTool dispatch from one { name -> handler }
 * map, filtered by an \`exclude\` list and (on the edge surface) with each
 * tool's declared edgeStripParams() removed from its advertised input schema.
 * Stdio and the (future) Supabase edge function share THIS path, so the hosted
 * surface can never expose a tool or param the manifest hasn't cleared.
 *
 * The universe is cross-checked against tool-groups.js on every registration:
 * any drift between the manifest, the handler map, and the advertised tools is
 * a thrown error (fail-closed), never a silently mis-exposed tool.
 */

import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_GROUPS, edgeStripParams } from './tool-groups.js';
import * as H from './handlers.js';

/** Tool name -> handler. Mirrors the original index.js dispatch exactly. */
export const HANDLERS = {
  search_primitives: H.handleSearchPrimitives,
  get_primitive: H.handleGetPrimitive,
  get_personality: H.handleGetPersonality,
  search_breakdowns: H.handleSearchBreakdowns,
  get_breakdown: H.handleGetBreakdown,
  get_reference_doc: H.handleGetReferenceDoc,
  recommend_choreography: H.handleRecommendChoreography,
  validate_choreography: H.handleValidateChoreography,
  analyze_scene: H.handleAnalyzeScene,
  figma_frame_to_scene: H.handleFigmaFrameToScene,
  export_storyboard_to_figma: H.handleExportStoryboardToFigma,
  verify_figma_export: H.handleVerifyFigmaExport,
  import_figma_comments: H.handleImportFigmaComments,
  plan_sequence: H.handlePlanSequence,
  get_style_pack: H.handleGetStylePack,
  evaluate_sequence: H.handleEvaluateSequence,
  validate_manifest: H.handleValidateManifest,
  list_brief_templates: H.handleListBriefTemplates,
  get_brief_template: H.handleGetBriefTemplate,
  generate_scenes: H.handleGenerateScenes,
  plan_variants: H.handlePlanVariants,
  compare_variants: H.handleCompareVariants,
  analyze_beats: H.handleAnalyzeBeats,
  sync_sequence_to_beats: H.handleSyncSequenceToBeats,
  create_personality: H.handleCreatePersonality,
  list_personalities: H.handleListPersonalities,
  compile_motion: H.handleCompileMotion,
  critique_motion: H.handleCritiqueMotion,
  run_benchmarks: H.handleRunBenchmarks,
  generate_video: H.handleGenerateVideo,
  recommend_sequence_archetype: H.handleRecommendSequenceArchetype,
  init_project: H.handleInitProject,
  list_projects: H.handleListProjects,
  get_project: H.handleGetProject,
  get_project_context: H.handleGetProjectContext,
  save_project_artifact: H.handleSaveProjectArtifact,
  render_project: H.handleRenderProject,
  review_project: H.handleReviewProject,
  audit_video_accessibility: H.handleAuditVideoAccessibility,
  get_art_direction: H.handleGetArtDirection,
  list_art_directions: H.handleListArtDirections,
  plan_hero_moments: H.handlePlanHeroMoments,
  score_brand_finish: H.handleScoreBrandFinish,
  create_brand_package: H.handleCreateBrandPackage,
  get_brand_package: H.handleGetBrandPackage,
  list_brand_packages: H.handleListBrandPackages,
  validate_brand_compliance: H.handleValidateBrandCompliance,
  score_product_demo_clarity: H.handleScoreProductDemoClarity,
  analyze_scene_comprehension: H.handleAnalyzeSceneComprehension,
  instantiate_sequence_archetype: H.handleInstantiateSequenceArchetype,
  apply_finish_preset: H.handleApplyFinishPreset,
  audit_motion_density: H.handleAuditMotionDensity,
  generate_contact_sheet: H.handleGenerateContactSheet,
  compare_project_versions: H.handleCompareProjectVersions,
  create_editorial_canvas_scene: H.handleCreateEditorialCanvasScene,
  recommend_editorial_layout: H.handleRecommendEditorialLayout,
  recommend_ui_storyboard_layout: H.handleRecommendUiStoryboardLayout,
  recommend_personality_for_context: H.handleRecommendPersonalityForContext,
  get_motion_recipe: H.handleGetMotionRecipe,
  search_motion_recipes: H.handleSearchMotionRecipes,
  validate_motion_token: H.handleValidateMotionToken,
  audit_motion_coverage: H.handleAuditMotionCoverage,
  adapt_project_aspect_ratio: H.handleAdaptProjectAspectRatio,
  create_social_cutdown: H.handleCreateSocialCutdown,
  recommend_type_treatment: H.handleRecommendTypeTreatment,
  suggest_match_cuts: H.handleSuggestMatchCuts,
  plan_continuity_links: H.handlePlanContinuityLinks,
  extract_story_brief: H.handleExtractStoryBrief,
  compose_storyboard: H.handleComposeStoryboard,
  plan_story_beats: H.handlePlanStoryBeats,
  score_candidate_video: H.handleScoreCandidateVideo,
  score_hero_frame: H.handleScoreHeroFrame,
  audit_hero_frames: H.handleAuditHeroFrames,
  render_master: H.handleRenderMaster,
  revise_candidate_video: H.handleReviseCandidateVideo,
  compare_candidate_videos: H.handleCompareCandidateVideos,
  annotate_scenes: H.handleAnnotateScenes,
  auto_revise_loop: H.handleAutoReviseLoop,
  audit_annotation_quality: H.handleAuditAnnotationQuality,
  upgrade_project_confidence: H.handleUpgradeProjectConfidence,
  generate_brief_stub: H.handleGenerateBriefStub,
  score_frame_strip: H.handleScoreFrameStrip,
  resolve_render_targets: H.handleResolveRenderTargets,
  assemble_video_sequence: H.handleAssembleVideoSequence,
  preview_video: H.handlePreviewVideo,
  get_delivery_profile: H.handleGetDeliveryProfile,
};

/** Remove a tool's edge-stripped params from a deep copy of its input schema. */
function stripToolParams(tool) {
  const strip = edgeStripParams(tool.name);
  if (!strip.length || !tool.inputSchema || !tool.inputSchema.properties) return tool;
  const t = JSON.parse(JSON.stringify(tool));
  for (const p of strip) {
    delete t.inputSchema.properties[p];
    if (Array.isArray(t.inputSchema.required)) {
      t.inputSchema.required = t.inputSchema.required.filter((r) => r !== p);
    }
  }
  return t;
}

/**
 * Remove a tool's edge-stripped params from the INCOMING call arguments, so the
 * edge-safety contract is enforced at dispatch — not merely advertised in the
 * schema. Without this a non-conforming client could still send a stripped
 * param (e.g. `output_dir`) and trigger the disk write the edge surface forbids.
 * Returns a shallow copy with the params removed; pass-through when nothing to strip.
 */
function stripCallArgs(name, args) {
  const strip = edgeStripParams(name);
  if (!strip.length || !args || typeof args !== 'object') return args;
  const out = { ...args };
  for (const p of strip) delete out[p];
  return out;
}

/**
 * Register the tools/list + CallTool handlers onto an MCP server.
 *
 * @param {object} server - MCP Server instance.
 * @param {object} opts
 * @param {object[]} opts.tools - Full tool definitions (from buildTools()).
 * @param {string[]} [opts.exclude=[]] - Tool names to withhold from this surface.
 * @param {boolean} [opts.stripParams=true] - Apply edgeStripParams() to exposed
 *   schemas. Defaults true (fail-safe for the edge); stdio passes false to keep
 *   its byte-for-byte schema surface.
 * @param {(name:string)=>void} [opts.beforeCall] - Per-call hook (stdio uses it
 *   for trackTool + reloadCatalogsIfStale; edge omits it).
 * @returns {{ exposed: object[], names: string[] }}
 */
export function registerTools(server, { tools, exclude = [], stripParams = true, beforeCall } = {}) {
  if (!Array.isArray(tools)) throw new Error('registerTools requires { tools } (array from buildTools)');
  const excludeSet = new Set(exclude);

  // Fail-closed: handler map and manifest must describe the same universe.
  const groupNames = Object.keys(TOOL_GROUPS);
  const handlerNames = Object.keys(HANDLERS);
  for (const n of groupNames) if (!HANDLERS[n]) throw new Error(`tool-groups lists ${n} but no handler is registered`);
  for (const n of handlerNames) if (!TOOL_GROUPS[n]) throw new Error(`handler ${n} is not in the tool-groups manifest`);

  const exposed = [];
  const seen = new Set();
  for (const t of tools) {
    if (excludeSet.has(t.name)) continue;
    if (!HANDLERS[t.name]) throw new Error(`advertised tool ${t.name} has no handler`);
    // Fail-closed: a duplicate advertised name would expose the tool twice and
    // make dispatch ambiguous — the canonical surface must list each tool once.
    if (seen.has(t.name)) throw new Error(`duplicate advertised tool ${t.name}`);
    seen.add(t.name);
    exposed.push(stripParams ? stripToolParams(t) : t);
  }
  const exposedNames = seen;

  // Fail-closed: the advertised `tools` array must cover the full non-excluded
  // manifest. A short array (a tool silently dropped from buildTools) must not
  // quietly shrink the surface — every expected tool has to be present.
  for (const n of groupNames) {
    if (!excludeSet.has(n) && !exposedNames.has(n)) {
      throw new Error(`tool ${n} is in the manifest but missing from the advertised tools array`);
    }
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: exposed }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs = {} } = request.params;
    if (beforeCall) beforeCall(name);
    if (!exposedNames.has(name)) throw new Error(`Unknown tool: ${name}`);
    // Enforce the strip contract on real arguments too, not just the schema.
    const args = stripParams ? stripCallArgs(name, rawArgs) : rawArgs;
    return HANDLERS[name](args);
  });

  return { exposed, names: [...exposedNames] };
}
