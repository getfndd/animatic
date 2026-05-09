/**
 * LLM Enhancement Layer — ANI-36
 *
 * Optional LLM (Claude) enhancement for scene generation.
 * Layers on top of the rule-based generator (ANI-31).
 *
 * Two enhancement stages:
 *   1. enhanceScenePlan — improve scene compositions, text, and narrative flow
 *   2. enrichSceneContent — improve individual scene text and camera suggestions
 *
 * All output passes through validateScene(). On any failure, falls back
 * to rule-based generation. No LLM calls in the critical validation path.
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import Anthropic from '@anthropic-ai/sdk';
import { validateScene } from '../../src/remotion/lib.js';

// ── Client ──────────────────────────────────────────────────────────────────

let client = null;
let _clientOverride = null;

/**
 * Get or create the Anthropic client.
 * Returns null if ANTHROPIC_API_KEY is not set.
 */
function getClient() {
  if (_clientOverride) return _clientOverride;
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

// Test-only seam: inject a mock { messages: { create } } client. Pass null
// to clear. Not part of the public API surface.
export function __setLLMClientForTest(mockClient) {
  _clientOverride = mockClient;
}

/**
 * Check if LLM enhancement is available.
 */
export function isLLMAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5-20250514';
const STORYBOARD_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;
const STORYBOARD_MAX_TOKENS = 4096;

// ── Stage 1: Enhance Scene Plan ─────────────────────────────────────────────

/**
 * Enhance a scene plan with LLM suggestions.
 *
 * Sends the rule-based plan to Claude for creative improvements:
 * - Better text content (headlines, subheads)
 * - Improved narrative arc and emotional flow
 * - More creative layout suggestions
 *
 * @param {object[]} plan — scene plan from buildScenePlan()
 * @param {object} brief — the original brief
 * @param {string} style — resolved style pack name
 * @returns {Promise<{ enhanced: object[], notes: string[] }>}
 */
export async function enhanceScenePlan(plan, brief, style) {
  const anthropic = getClient();
  if (!anthropic) {
    return { enhanced: plan, notes: ['LLM unavailable — using rule-based plan'] };
  }

  const systemPrompt = `You are a cinematography assistant that improves scene plans for animated video sequences.

You will receive a scene plan (array of scene entries) and a creative brief. Your job is to improve the TEXT CONTENT of each scene while preserving the structural fields (content_type, layout, intent_tags, assets).

Rules:
- Only modify the "text" field of each scene entry
- Keep text concise (under 8 words for headlines, under 15 for subtitles)
- Match the brief's tone and brand voice
- Create a narrative arc: hook → build → climax → resolve
- Do NOT change content_type, layout, intent_tags, or assets
- Return valid JSON array matching the input structure exactly`;

  const userPrompt = `Brief:
${JSON.stringify({
    title: brief.project?.title,
    tone: brief.tone,
    brand: brief.brand,
    style,
  }, null, 2)}

Scene plan to improve:
${JSON.stringify(plan.map(p => ({
    label: p.label,
    text: p.text,
    emphasis: p.emphasis,
    content_type: p.content_type,
    layout: p.layout,
    intent_tags: p.intent_tags,
    asset_count: p.assets.length,
  })), null, 2)}

Return a JSON array with only the fields: label, text (improved). One entry per scene, same order.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const content = response.content[0]?.text || '';
    const improvements = parseJSONResponse(content);

    if (!Array.isArray(improvements) || improvements.length !== plan.length) {
      return { enhanced: plan, notes: ['LLM response shape mismatch — using rule-based plan'] };
    }

    // Apply text improvements to plan entries
    const enhanced = plan.map((entry, i) => {
      const improved = improvements[i];
      if (improved?.text && typeof improved.text === 'string' && improved.text.length > 0) {
        return { ...entry, text: improved.text };
      }
      return entry;
    });

    return {
      enhanced,
      notes: [`LLM enhanced text for ${improvements.filter(i => i?.text).length}/${plan.length} scenes`],
    };
  } catch (err) {
    return {
      enhanced: plan,
      notes: [`LLM enhancement failed (${err.message}) — using rule-based plan`],
    };
  }
}

// ── Stage 2: Enrich Scene Content ───────────────────────────────────────────

/**
 * Enrich generated scenes with LLM-suggested improvements.
 *
 * Reviews each scene and suggests camera moves, entrance animations,
 * and text refinements based on the overall narrative context.
 *
 * @param {object[]} scenes — generated scenes from generateScene()
 * @param {string} style — resolved style pack name
 * @returns {Promise<{ enriched: object[], notes: string[] }>}
 */
export async function enrichSceneContent(scenes, style) {
  const anthropic = getClient();
  if (!anthropic) {
    return { enriched: scenes, notes: ['LLM unavailable — using rule-based scenes'] };
  }

  const validMoves = ['static', 'push_in', 'pull_out', 'pan_left', 'pan_right', 'drift'];

  const systemPrompt = `You are a cinematography assistant that suggests camera moves for animated scenes.

For each scene, suggest the best camera move based on the scene's content type, intent, and position in the sequence. The goal is cinematic storytelling — not random movement.

Rules:
- Camera moves must be one of: ${validMoves.join(', ')}
- Intensity must be 0.0 to 1.0 (0.1-0.3 is subtle, 0.3-0.5 is moderate, 0.5+ is dramatic)
- Opening scenes: prefer push_in or static
- Closing scenes: prefer pull_out or static
- Detail scenes: prefer drift or static
- Emotional scenes: prefer push_in with low intensity
- Style "${style}" — respect its personality
- Return valid JSON array`;

  const sceneSummaries = scenes.map((s, i) => ({
    index: i,
    scene_id: s.scene_id,
    content_type: s.metadata?.content_type,
    intent_tags: s.metadata?.intent_tags,
    current_camera: s.camera,
    layer_count: s.layers?.length,
    duration_s: s.duration_s,
  }));

  const userPrompt = `Scenes to enrich:
${JSON.stringify(sceneSummaries, null, 2)}

For each scene, return JSON array with: { index, camera: { move, intensity } }. Only suggest cameras that differ from the current "static" default.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const content = response.content[0]?.text || '';
    const suggestions = parseJSONResponse(content);

    if (!Array.isArray(suggestions)) {
      return { enriched: scenes, notes: ['LLM camera response invalid — using rule-based scenes'] };
    }

    let appliedCount = 0;
    const enriched = scenes.map((scene, i) => {
      const suggestion = suggestions.find(s => s.index === i);
      if (!suggestion?.camera?.move || !validMoves.includes(suggestion.camera.move)) {
        return scene;
      }

      const intensity = typeof suggestion.camera.intensity === 'number'
        ? Math.max(0, Math.min(1, suggestion.camera.intensity))
        : 0.3;

      const enrichedScene = {
        ...scene,
        camera: { move: suggestion.camera.move, intensity },
      };

      // Validate enriched scene — fall back to original if invalid
      const validation = validateScene(enrichedScene);
      if (validation.valid) {
        appliedCount++;
        return enrichedScene;
      }
      return scene;
    });

    return {
      enriched,
      notes: [`LLM suggested cameras for ${appliedCount}/${scenes.length} scenes`],
    };
  } catch (err) {
    return {
      enriched: scenes,
      notes: [`LLM enrichment failed (${err.message}) — using rule-based scenes`],
    };
  }
}

// ── Stage 3: Enhance Storyboard ─────────────────────────────────────────────

/**
 * Enhance a storyboard skeleton with LLM-derived visual_direction specifics.
 *
 * Skeleton fields are categorized:
 *   - Immutable: panel_id, act, content_type, duration_s, transition_in/out, camera, energy
 *   - Mutable:   description, content (placeholders), visual_direction.*, motion_notes.entrance/choreography
 *
 * On any structural failure, returns the skeleton unchanged with
 * `_sources.llm_failure` set so downstream tools can detect.
 *
 * @param {object} skeleton - storyboard from composeStoryboard()
 * @param {object} context - { brief, brand, story_brief }
 * @returns {Promise<{ storyboard: object, notes: string[] }>}
 */
export async function enhanceStoryboard(skeleton, { brief, brand, story_brief } = {}) {
  const anthropic = getClient();
  if (!anthropic) {
    return {
      storyboard: { ...skeleton, _sources: { ...skeleton._sources, llm: 'unavailable' } },
      notes: ['LLM unavailable — using deterministic skeleton'],
    };
  }

  const systemPrompt = `You are a senior cinematography director enriching storyboard panels with specific visual direction.

You will receive a deterministic storyboard skeleton and creative context. Your job is to make each panel's visual_direction concrete: specific px sizes, weights, tracking, opacities, named colors, and surface treatments. Replace generic prose with specific, executable design specifications.

Rules:
- Reference the brand notes for typography family, color tokens, and surface conventions.
- Reference the brief for tone and content specifics.
- visual_direction must read like a designer wrote it for an engineer: "15px weight 600", "4% white border", "28px border radius", not "elegant" or "modern".
- description should make the panel visually unambiguous — what's on screen, where.
- motion_notes.entrance and choreography may be refined; keep recommended primitives if present.
- DO NOT change panel_id, act, content_type, duration_s, transition_in, transition_out, camera, or energy.
- Return a JSON array of panel improvements, one per skeleton panel, in the same order.`;

  const skeletonPanels = skeleton.panels.map((p) => ({
    panel_id: p.panel_id,
    act: p.act,
    content_type: p.content_type,
    intent: p.intent,
    description: p.description,
    content: p.content,
    visual_direction: p.visual_direction,
    motion_notes: { entrance: p.motion_notes?.entrance, choreography: p.motion_notes?.choreography },
  }));

  const userPrompt = `Brief:
${typeof brief === 'string' ? brief.slice(0, 4000) : JSON.stringify(story_brief || {}, null, 2)}

Brand:
${JSON.stringify({
    palette_note: skeleton.brand?.palette_note,
    typography_note: skeleton.brand?.typography_note,
    surface_note: skeleton.brand?.surface_note,
    direct: brand ? { colors: brand.colors, typography: brand.typography, surfaces: brand.surfaces } : null,
  }, null, 2)}

Direction:
${JSON.stringify(skeleton.direction, null, 2)}

Skeleton panels (improve visual_direction.{composition,typography,color,surfaces,reference}, description, and optionally motion_notes.{entrance,choreography}):
${JSON.stringify(skeletonPanels, null, 2)}

Return a JSON array of objects, one per panel, in the same order, shaped:
{
  "panel_id": "p_01",
  "description": "...",
  "visual_direction": { "composition": "...", "typography": "...", "color": "...", "surfaces": "...", "reference": "..." },
  "motion_notes": { "entrance": "...", "choreography": "..." }
}
Use the same panel_id as the skeleton. Omit any field you don't want to change.`;

  try {
    const response = await anthropic.messages.create({
      model: STORYBOARD_MODEL,
      max_tokens: STORYBOARD_MAX_TOKENS,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const content = response.content[0]?.text || '';
    const improvements = parseJSONResponse(content);

    if (!Array.isArray(improvements)) {
      return {
        storyboard: { ...skeleton, _sources: { ...skeleton._sources, llm: 'failed', llm_failure: 'response not an array' } },
        notes: ['LLM storyboard response not an array — using deterministic skeleton'],
      };
    }

    // Index improvements by panel_id (don't trust array order alone)
    const improvByPanel = new Map();
    for (const imp of improvements) {
      if (imp && typeof imp === 'object' && imp.panel_id) {
        improvByPanel.set(imp.panel_id, imp);
      }
    }

    let appliedCount = 0;
    const enrichedPanels = skeleton.panels.map((panel) => {
      const imp = improvByPanel.get(panel.panel_id);
      if (!imp) return panel;

      // Lockdown: only read from `imp` for the mutable fields enumerated below.
      // Immutable fields (panel_id, act, content_type, duration_s, transition_*,
      // camera, energy) are preserved by simply never copying them from imp.
      const merged = { ...panel };

      if (typeof imp.description === 'string' && imp.description.trim()) {
        merged.description = imp.description.trim();
      }
      if (imp.visual_direction && typeof imp.visual_direction === 'object') {
        merged.visual_direction = {
          ...panel.visual_direction,
          ...Object.fromEntries(
            Object.entries(imp.visual_direction).filter(
              ([, v]) => typeof v === 'string' && v.trim().length > 0,
            ),
          ),
        };
      }
      if (imp.motion_notes && typeof imp.motion_notes === 'object') {
        merged.motion_notes = {
          ...panel.motion_notes,
          ...Object.fromEntries(
            Object.entries(imp.motion_notes).filter(
              ([k, v]) => ['entrance', 'choreography'].includes(k) && typeof v === 'string' && v.trim().length > 0,
            ),
          ),
        };
      }
      appliedCount++;
      return merged;
    });

    return {
      storyboard: {
        ...skeleton,
        panels: enrichedPanels,
        _sources: { ...skeleton._sources, llm: 'enhanced', llm_panels_enriched: appliedCount },
      },
      notes: [`LLM enriched ${appliedCount}/${skeleton.panels.length} panels via ${STORYBOARD_MODEL}`],
    };
  } catch (err) {
    return {
      storyboard: { ...skeleton, _sources: { ...skeleton._sources, llm: 'failed', llm_failure: err.message } },
      notes: [`LLM storyboard enhancement failed (${err.message}) — using deterministic skeleton`],
    };
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

/**
 * Extract JSON from an LLM response that may contain markdown fences.
 */
export function parseJSONResponse(text) {
  // Try to extract JSON from markdown code blocks
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1] : text;

  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    // Try to find array boundaries
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
