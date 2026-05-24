/**
 * Scene Comprehension Analyzer — ANI-121
 *
 * An LLM "judge" that answers the one question rule-based scoring cannot:
 * *would a human understand the intent of this video?* It reads a rendered
 * frame strip (key still frames) plus scene annotations and returns a
 * comprehension score with explainable reasoning.
 *
 * Complement, not duplicate:
 *   - scoreProductDemoClarity (product-archetypes.js) scores STRUCTURAL clarity
 *     from the manifest — interaction truthfulness, camera-intent consistency,
 *     pacing variety, hierarchy.
 *   - scoreFrameStrip (frame-critique.js) scores VISUAL quality — contrast,
 *     readability, brand consistency.
 *   - This module scores PERCEPTUAL comprehension — can a viewer tell what the
 *     subject is, what is happening, and how the story progresses?
 *
 * Input contract (ANI-121 design decision — hybrid):
 *   - frame_strip: textual descriptors (always). Accepts the output of
 *     generate_contact_sheet ({ sheets }) or generate_key_moment_strip
 *     ({ moments }). Normalized internally.
 *   - annotations: annotated scene definitions (array or map).
 *   - images: OPTIONAL base64 stills. When provided AND a key is set, the judge
 *     upgrades to vision. Otherwise it reads descriptors.
 *
 * LLM-optional: when ANTHROPIC_API_KEY is set the LLM judge runs (vision if
 * images present, text otherwise). With no key — or on any LLM failure — a
 * deterministic heuristic produces the same score shape so tests/CI stay green.
 * The synchronous heuristic core is also what feeds score_candidate_video's
 * clarity dimension (that scorer is sync and cannot await).
 */

import Anthropic from '@anthropic-ai/sdk';
import { matchesKeyword } from './recommend-layout.js';
import { parseJSONResponse } from './llm.js';

// ── Client ──────────────────────────────────────────────────────────────────

let client = null;
let _clientOverride = null;

function getClient() {
  if (_clientOverride) return _clientOverride;
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Test-only seam: inject a mock { messages: { create } } client. Pass null to
 * clear. Mirrors llm.js — not part of the public API surface.
 */
export function __setComprehensionClientForTest(mockClient) {
  _clientOverride = mockClient;
}

/** Whether the LLM judge can run (key present). */
export function isComprehensionLLMAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1536;
const MAX_VISION_IMAGES = 8;

export const COMPREHENSION_DIMENSIONS = [
  'subject_clarity',       // Can a viewer tell WHAT the subject is in each frame?
  'intent_legibility',     // Does each scene communicate its purpose / action?
  'progression_coherence', // Do the frames read as a followable story arc?
  'cognitive_load',        // Can each frame be absorbed in its dwell time?
];

const DIMENSION_WEIGHTS = {
  subject_clarity: 0.3,
  intent_legibility: 0.3,
  progression_coherence: 0.25,
  cognitive_load: 0.15,
};

// Action cues that signal a scene's intent is legible from text. Matched with
// word boundaries via matchesKeyword (never substring includes) — ANI-153.
const INTENT_ACTION_CUES = [
  'click', 'tap', 'type', 'typing', 'submit', 'enter', 'input', 'select',
  'process', 'processing', 'load', 'loading', 'analyze', 'generate',
  'result', 'output', 'reveal', 'confirm', 'success', 'complete', 'done',
  'dashboard', 'preview', 'compare', 'before', 'after',
];

// product_role buckets used for arc detection.
const OPENER_ROLES = new Set(['atmosphere', 'input', 'transition']);
const SETUP_ROLES = new Set(['input', 'processing', 'dashboard']);
const PAYOFF_ROLES = new Set(['result', 'proof', 'cta']);

// ── Public: async LLM/vision judge ────────────────────────────────────────────

/**
 * Analyze scene comprehension. LLM judge with deterministic fallback.
 *
 * @param {object} params
 * @param {object} params.frame_strip - { sheets } or { moments } (descriptors).
 * @param {object[]|object} params.annotations - Annotated scenes (array or map). Alias: `scenes`.
 * @param {object[]|object} [params.scenes] - Alias for `annotations`.
 * @param {object[]} [params.images] - Optional base64 stills:
 *        [{ scene_id?, media_type, data }]. Triggers vision when a key is set.
 * @param {object} [params.options] - { enhance?: boolean } enhance defaults on.
 * @returns {Promise<object>} { score, dimensions, reasoning, rationale, source, notes }
 */
export async function analyzeSceneComprehension({ frame_strip, annotations, scenes, images, options = {} } = {}) {
  const ann = annotations || scenes;
  const frames = normalizeFrames(frame_strip, ann);

  // Deterministic baseline always computed — it is the fallback and the
  // grounding the heuristic shares with the scoring path.
  const baseline = comprehensionHeuristic({ frame_strip, annotations: ann });

  // Gate on getClient() (not isComprehensionLLMAvailable) so an injected test
  // client is honored without a real key, and so a missing key falls through
  // to the deterministic baseline. Mirrors enhanceStoryboard in llm.js.
  const wantsEnhance = options.enhance !== false; // default-on
  const anthropic = getClient();
  if (!wantsEnhance || !anthropic || frames.length === 0) {
    return baseline;
  }

  const useVision = Array.isArray(images) && images.length > 0;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserContent(frames, useVision ? images : null) }],
    });

    const text = response.content?.find(c => c.type === 'text')?.text
      || response.content?.[0]?.text
      || '';
    const parsed = parseJSONResponse(text);
    const judged = coerceJudgeResult(parsed);

    if (!judged) {
      return { ...baseline, source: baseline.source, notes: [...baseline.notes, 'LLM response shape invalid — used deterministic heuristic'] };
    }

    return {
      score: judged.score,
      dimensions: judged.dimensions,
      reasoning: judged.reasoning,
      rationale: judged.rationale,
      source: useVision ? 'llm-vision' : 'llm-text',
      notes: [`Comprehension judged by ${MODEL} (${useVision ? 'vision' : 'text'}) over ${frames.length} key frame(s)`],
    };
  } catch (err) {
    return { ...baseline, notes: [...baseline.notes, `LLM judge failed (${err.message}) — used deterministic heuristic`] };
  }
}

// ── Public: deterministic heuristic core (sync) ──────────────────────────────

/**
 * Deterministic comprehension heuristic. Pure, synchronous — safe to call from
 * the synchronous scoring path (score_candidate_video). Operates only on the
 * descriptor frame strip + annotations.
 *
 * @param {object} params
 * @param {object} params.frame_strip - { sheets } or { moments }.
 * @param {object[]|object} params.annotations - Annotated scenes.
 * @returns {{ score, dimensions, reasoning, rationale, source, notes }}
 */
export function comprehensionHeuristic({ frame_strip, annotations } = {}) {
  const frames = normalizeFrames(frame_strip, annotations);

  if (frames.length === 0) {
    return {
      score: 0,
      dimensions: Object.fromEntries(COMPREHENSION_DIMENSIONS.map(d => [d, 0])),
      reasoning: ['No frame strip or annotations provided — comprehension cannot be assessed.'],
      rationale: 'Comprehension 0.000 — no key frames to read.',
      source: 'deterministic',
      notes: [],
    };
  }

  const reasoning = [];

  const subject_clarity = scoreSubjectClarity(frames, reasoning);
  const intent_legibility = scoreIntentLegibility(frames, reasoning);
  const progression_coherence = scoreProgressionCoherence(frames, reasoning);
  const cognitive_load = scoreCognitiveLoad(frames, reasoning);

  const dimensions = { subject_clarity, intent_legibility, progression_coherence, cognitive_load };

  let score = 0;
  for (const [dim, w] of Object.entries(DIMENSION_WEIGHTS)) {
    score += (dimensions[dim] ?? 0) * w;
  }
  score = round3(score);

  return {
    score,
    dimensions,
    reasoning,
    rationale: buildRationale(score, dimensions, frames.length, 'deterministic'),
    source: 'deterministic',
    notes: [],
  };
}

// ── Dimension scorers (deterministic) ─────────────────────────────────────────

function scoreSubjectClarity(frames, reasoning) {
  let named = 0;
  const unclear = [];

  for (const f of frames) {
    let pts = 0;
    if (f.primary_subject || f.hasHeroLayer) pts += 0.5;
    if (describesConcreteSubject(f.description)) pts += 0.3;
    if (f.hasFocalHierarchy) pts += 0.2;
    if (pts >= 0.5) named++;
    else unclear.push(f.scene_id);
  }

  const score = round3(named / frames.length);
  reasoning.push(
    `Subject clarity ${score.toFixed(2)} — ${named}/${frames.length} key frame(s) present an identifiable subject`
    + (unclear.length ? `; unclear in ${unclear.slice(0, 3).join(', ')}` : '') + '.'
  );
  return score;
}

function scoreIntentLegibility(frames, reasoning) {
  let legible = 0;
  const opaque = [];

  for (const f of frames) {
    let pts = 0;
    if (f.product_role) pts += 0.4;
    if (f.outcome || f.hasInteractionSignal) pts += 0.3;
    if (telegraphsAction(f)) pts += 0.3;
    if (pts >= 0.5) legible++;
    else opaque.push(f.scene_id);
  }

  const score = round3(legible / frames.length);
  reasoning.push(
    `Intent legibility ${score.toFixed(2)} — ${legible}/${frames.length} scene(s) telegraph their purpose`
    + (opaque.length ? `; opaque in ${opaque.slice(0, 3).join(', ')}` : '') + '.'
  );
  return score;
}

function scoreProgressionCoherence(frames, reasoning) {
  let score = 0.4;
  const notes = [];

  const first = frames[0];
  const last = frames[frames.length - 1];

  const opensWell = frames.length === 1
    || (first && (OPENER_ROLES.has(first.product_role) || first.isOpeningMoment || hasTag(first, ['opening', 'hook', 'intro'])));
  if (opensWell) { score += 0.2; } else { notes.push('opening scene does not read as a clear entry point'); }

  const closesWell = frames.length === 1
    || (last && (PAYOFF_ROLES.has(last.product_role) || last.isClosingMoment || hasTag(last, ['cta', 'closing', 'outro', 'resolve'])));
  if (closesWell) { score += 0.2; } else { notes.push('closing scene does not land a payoff (result/CTA)'); }

  const roles = frames.map(f => f.product_role).filter(Boolean);
  const distinctRoles = new Set(roles).size;
  if (distinctRoles >= 2) score += 0.1;

  if (hasArcOrdering(frames)) score += 0.1;
  else if (frames.length > 2) notes.push('no setup→payoff ordering detected across scenes');

  score = round3(clamp01(score));
  reasoning.push(
    `Progression coherence ${score.toFixed(2)} — ${distinctRoles} distinct role(s) across ${frames.length} frame(s)`
    + (notes.length ? `; ${notes.join('; ')}` : '; reads as a followable arc') + '.'
  );
  return score;
}

function scoreCognitiveLoad(frames, reasoning) {
  let sum = 0;
  const dense = [];

  for (const f of frames) {
    const dwell = Math.max(f.duration_s || 3, 0.5);
    const elementsPerSec = (f.layer_count || 0) / dwell;
    // 0 elements/s is fully readable (1.0); load rises past ~2.5/s, unreadable
    // by ~6.5/s. An empty frame is mildly penalized (nothing to comprehend).
    let s;
    if ((f.layer_count || 0) === 0) {
      s = 0.6;
    } else if (elementsPerSec <= 2.5) {
      s = 1;
    } else {
      s = clamp01(1 - (elementsPerSec - 2.5) / 4);
      if (s < 0.5) dense.push(`${f.scene_id} (${f.layer_count} in ${dwell}s)`);
    }
    sum += s;
  }

  const score = round3(sum / frames.length);
  reasoning.push(
    `Cognitive load ${score.toFixed(2)} — ${dense.length ? `dense frame(s): ${dense.slice(0, 3).join(', ')}` : 'all frames absorbable in their dwell time'}.`
  );
  return score;
}

// ── Frame normalization ───────────────────────────────────────────────────────

/**
 * Normalize a frame strip (contact sheet OR key-moment strip) plus annotations
 * into a uniform list of frames the scorers and prompt can consume.
 */
function normalizeFrames(frame_strip, annotations) {
  const sceneMap = toSceneMap(annotations);
  const raw = [];

  if (frame_strip?.sheets?.length) {
    for (const s of frame_strip.sheets) {
      raw.push({
        scene_id: s.scene_id,
        description: s.thumbnail_description || '',
        duration_s: s.duration_s,
        layer_count: s.layer_count,
        energy: s.energy,
        camera_move: s.camera_move,
        content_type: s.content_type,
        intent_tags: s.intent_tags,
      });
    }
  } else if (frame_strip?.moments?.length) {
    for (const m of frame_strip.moments) {
      raw.push({
        scene_id: m.scene_id,
        description: m.description || '',
        moment_type: m.type,
        isOpeningMoment: m.type === 'first_frame',
        isClosingMoment: m.type === 'final_frame',
      });
    }
  } else if (sceneMap.size > 0) {
    // No strip provided but annotations exist — derive a minimal strip so the
    // judge still has something to read.
    for (const [scene_id] of sceneMap) {
      raw.push({ scene_id, description: '' });
    }
  }

  // Enrich each frame from its scene annotation.
  return raw.map((f) => {
    const scene = sceneMap.get(f.scene_id) || {};
    const layers = scene.layers || [];
    const it = scene.interaction_truth || {};
    const weights = layers.map(l => l.clarity_weight).filter(w => w != null);
    return {
      ...f,
      duration_s: f.duration_s ?? scene.duration_s ?? scene.duration ?? 3,
      layer_count: f.layer_count ?? layers.length,
      intent_tags: f.intent_tags ?? scene.metadata?.intent_tags ?? scene.intent_tags ?? [],
      product_role: scene.product_role || null,
      primary_subject: scene.primary_subject || null,
      outcome: scene.outcome || null,
      hasHeroLayer: layers.some(l => l.product_role === 'hero'),
      hasFocalHierarchy: new Set(weights).size > 1 || layers.filter(l => l.product_role === 'hero').length === 1,
      hasInteractionSignal: !!(it.has_cursor || it.has_typing || it.has_state_change),
    };
  });
}

function toSceneMap(annotations) {
  const map = new Map();
  if (!annotations) return map;
  const arr = Array.isArray(annotations) ? annotations : Object.values(annotations);
  for (const s of arr) {
    const id = s?.scene_id || s?.id;
    if (id) map.set(id, s);
  }
  return map;
}

// ── Text / arc helpers ────────────────────────────────────────────────────────

function describesConcreteSubject(description) {
  if (!description) return false;
  const d = description.trim();
  if (!d || d === 'Scene' || d === 'Empty scene') return false;
  // A concrete subject is a named text/image/component, not a bare type label.
  return /Text:\s*"[^"]+"/.test(d)
    || matchesKeyword(d.toLowerCase(), 'image')
    || matchesKeyword(d.toLowerCase(), 'component')
    || matchesKeyword(d.toLowerCase(), 'video');
}

function telegraphsAction(frame) {
  const corpus = [frame.description, frame.product_role, frame.outcome, ...(frame.intent_tags || [])]
    .filter(Boolean).join(' ').toLowerCase();
  if (!corpus) return false;
  return INTENT_ACTION_CUES.some(cue => matchesKeyword(corpus, cue));
}

function hasTag(frame, tags) {
  const t = (frame.intent_tags || []).map(x => String(x).toLowerCase());
  return tags.some(tag => t.includes(tag));
}

/** True when a setup role (input/processing/dashboard) precedes a payoff role (result/proof/cta). */
function hasArcOrdering(frames) {
  let sawSetup = false;
  for (const f of frames) {
    if (SETUP_ROLES.has(f.product_role)) sawSetup = true;
    if (sawSetup && PAYOFF_ROLES.has(f.product_role)) return true;
  }
  return false;
}

// ── LLM prompt construction ────────────────────────────────────────────────────

function buildSystemPrompt() {
  return `You are a comprehension judge for short animated product and marketing videos.

You assess one thing only: would a HUMAN VIEWER understand the video's intent from its key frames? You are NOT scoring visual polish, motion craft, or brand finish — separate tools handle those. Judge comprehension:
- subject_clarity: in each key frame, is it clear WHAT the primary subject is?
- intent_legibility: does each scene communicate its purpose or the action happening?
- progression_coherence: do the frames read as a followable story (setup → payoff)?
- cognitive_load: can each frame be absorbed in the time it is on screen?

Score each dimension and the overall from 0.0 (incomprehensible) to 1.0 (instantly clear). Be specific and critical — cite scene_ids. Return ONLY JSON:
{
  "score": 0.0-1.0,
  "dimensions": { "subject_clarity": 0-1, "intent_legibility": 0-1, "progression_coherence": 0-1, "cognitive_load": 0-1 },
  "reasoning": ["one short sentence per dimension, citing scene_ids"],
  "rationale": "one-sentence overall verdict"
}`;
}

function buildUserContent(frames, images) {
  const stripText = frames.map((f, i) => {
    return `Frame ${i + 1} — scene "${f.scene_id}"${f.moment_type ? ` [${f.moment_type}]` : ''}:
  what's on screen: ${f.description || '(no description)'}
  product_role: ${f.product_role || '(none)'} | primary_subject: ${f.primary_subject || '(none)'} | outcome: ${f.outcome || '(none)'}
  duration: ${f.duration_s ?? '?'}s | layers: ${f.layer_count ?? '?'} | intent_tags: ${(f.intent_tags || []).join(', ') || '(none)'}`;
  }).join('\n\n');

  const textBlock = {
    type: 'text',
    text: `Frame strip (${frames.length} key frame(s)) and scene annotations:\n\n${stripText}\n\n`
      + (images ? 'The rendered stills for these frames are attached below, in order. Judge primarily from the images, using the annotations as context.' : 'No rendered images are available — judge from the descriptions and annotations.'),
  };

  if (!images) return [textBlock];

  const imageBlocks = images.slice(0, MAX_VISION_IMAGES).map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.media_type || 'image/png', data: img.data },
  }));
  return [textBlock, ...imageBlocks];
}

// ── LLM result coercion ────────────────────────────────────────────────────────

/** Validate + clamp an LLM judge response. Returns null if unusable. */
function coerceJudgeResult(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (typeof parsed.score !== 'number') return null;

  const dims = parsed.dimensions && typeof parsed.dimensions === 'object' ? parsed.dimensions : {};
  const dimensions = {};
  for (const d of COMPREHENSION_DIMENSIONS) {
    dimensions[d] = typeof dims[d] === 'number' ? round3(clamp01(dims[d])) : null;
  }

  const reasoning = Array.isArray(parsed.reasoning)
    ? parsed.reasoning.filter(r => typeof r === 'string' && r.trim()).map(r => r.trim())
    : [];

  return {
    score: round3(clamp01(parsed.score)),
    dimensions,
    reasoning,
    rationale: typeof parsed.rationale === 'string' && parsed.rationale.trim()
      ? parsed.rationale.trim()
      : buildRationale(round3(clamp01(parsed.score)), dimensions, reasoning.length, 'llm'),
  };
}

// ── Utilities ───────────────────────────────────────────────────────────────

function buildRationale(score, dimensions, frameCount, source) {
  const weakest = Object.entries(dimensions)
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => a[1] - b[1])[0];
  const tag = source === 'deterministic' ? 'deterministic' : 'judged';
  const weakNote = weakest ? ` weakest: ${weakest[0]} (${weakest[1].toFixed(2)})` : '';
  return `Comprehension ${score.toFixed(3)} (${tag}) across ${frameCount} key frame(s) —${weakNote}.`;
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
