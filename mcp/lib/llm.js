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
import { validateScene } from './scene-utils.js';

// ── Client ──────────────────────────────────────────────────────────────────

let client = null;

/**
 * Get or create the Anthropic client.
 * Returns null if ANTHROPIC_API_KEY is not set.
 */
function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Check if LLM enhancement is available.
 */
export function isLLMAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5-20250514';
const MAX_TOKENS = 2048;

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
