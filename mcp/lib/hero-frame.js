/**
 * Hero Frame Contract (ANI-178)
 *
 * Every scene declares — implicitly or explicitly — the single still that best
 * represents it: its poster frame. This module scores that frame and gates on it.
 * The forcing question is "what is this scene's poster frame, and does it hold up
 * with no motion?" — because if a scene has no strong still, motion won't save it.
 *
 * The rubric deliberately separates two things the issue (and Alan's caution)
 * insist on keeping apart:
 *   - LEGIBILITY — can a viewer read the frame? (subject, text, hierarchy)
 *     Derivable from scene structure; no pixels required.
 *   - COMPOSITION + AESTHETIC — is the frame well-composed and beautiful?
 *     (visual center, subject scale, contrast, air; brand presence, emotional
 *     clarity) Requires REAL rendered pixels judged by a vision model.
 *
 * Tiering (resolved in the ANI-182 master-profile spike): one scorer, a rising
 * threshold, and a widening required-axis set. T1 only asks "is the subject
 * clear?"; T4 asks "is the frame beautiful?". See HERO_FRAME_TIER_* below.
 *
 * Anti-vacuous-pass contract (the whole point of the gate):
 *   Composition/aesthetic axes are VERIFIED only when a real pixel was rendered
 *   AND a real vision judge scored it (source === 'llm-vision'). A metadata-only
 *   run, a missing render, or a deterministic fallback leaves those axes
 *   UNVERIFIED — and the gate fails CLOSED (BLOCK) at any tier that requires
 *   them. "I didn't look" is a finding, not a pass.
 */

import Anthropic from '@anthropic-ai/sdk';
import { parseJSONResponse } from './llm.js';
import {
  scoreSceneReadability,
  scoreSceneHierarchy,
  scoreSceneBrandMatch,
} from './frame-critique.js';
import { openHeroCaptureSession } from './hero-frame-capture.js';

// ── Client (mirrors scene-comprehension.js) ─────────────────────────────────

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

/** Test-only seam: inject a mock { messages: { create } } client. null clears. */
export function __setHeroFrameClientForTest(mockClient) {
  _clientOverride = mockClient;
}

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

// ── Axes, tiers, thresholds (from docs/process/master-profile-spike.md) ──────

export const LEGIBILITY_AXES = ['subject_clarity', 'readable_text', 'hierarchy'];
export const COMPOSITION_AXES = ['visual_center', 'subject_scale', 'contrast', 'whitespace_air'];
export const AESTHETIC_AXES = ['brand_presence', 'emotional_semantic_clarity'];
export const HERO_FRAME_AXES = [...LEGIBILITY_AXES, ...COMPOSITION_AXES, ...AESTHETIC_AXES];

// Axes that can only be trusted from rendered pixels + a vision judge.
const PIXEL_AXES = new Set([...COMPOSITION_AXES, ...AESTHETIC_AXES]);

export const HERO_FRAME_TIER_THRESHOLDS = { T1: 0.55, T2: 0.65, T3: 0.75, T4: 0.85 };

// Cumulative required axes — the bar widens as the tier rises.
export const HERO_FRAME_TIER_AXES = {
  T1: ['subject_clarity'],
  T2: ['subject_clarity', 'readable_text', 'hierarchy'],
  T3: ['subject_clarity', 'readable_text', 'hierarchy',
    'visual_center', 'subject_scale', 'contrast', 'whitespace_air', 'brand_presence'],
  T4: [...HERO_FRAME_AXES],
};

export const HERO_FRAME_TIERS = ['T1', 'T2', 'T3', 'T4'];

const MARGINAL_BAND = 0.05; // within this above threshold → WARN, not a clean PASS.

// ── Utilities ────────────────────────────────────────────────────────────────

function clamp01(n) { return Math.min(1, Math.max(0, n)); }
function round3(n) { return Math.round(n * 1000) / 1000; }
function normalizeTier(tier) {
  const t = String(tier || 'T3').toUpperCase();
  return HERO_FRAME_TIERS.includes(t) ? t : 'T3';
}

// ── Resolve the declared (or defaulted) hero frame ───────────────────────────

/**
 * Resolve a scene's hero-frame declaration. Absent block → 60%-through default
 * with the subject inferred from `primary_subject`/hero layer. A declared subject
 * that references no layer is a contract violation (subject_valid:false + finding).
 *
 * @returns {{ at, subject, intent, declared, subject_valid, finding }}
 */
export function resolveHeroFrame(scene) {
  const hf = scene?.hero_frame || {};
  const at = Number.isFinite(hf.at) ? clamp01(hf.at) : 0.6;
  const layers = scene?.layers || [];
  const layerIds = new Set(layers.map(l => l.id));
  const heroLayer = layers.find(l => l.product_role === 'hero');

  const declared = hf.subject != null ? hf.subject : null;
  const subject = declared || scene?.primary_subject || heroLayer?.id || null;

  let subject_valid = true;
  let finding = null;
  if (declared != null && !layerIds.has(declared)) {
    // Explicitly broken: the author named a subject that doesn't exist.
    subject_valid = false;
    finding = {
      axis: 'subject', severity: 'block_high_tier',
      message: `hero_frame.subject "${declared}" references no layer in ${scene?.scene_id || 'scene'} — subject scale/placement cannot be trusted`,
    };
  } else if (subject != null && !layerIds.has(subject)) {
    // Defaulted subject (e.g. stale primary_subject) doesn't resolve — softer.
    subject_valid = false;
    finding = {
      axis: 'subject', severity: 'warning',
      message: `resolved hero subject "${subject}" not found among layers in ${scene?.scene_id || 'scene'}`,
    };
  } else if (subject == null) {
    finding = {
      axis: 'subject', severity: 'warning',
      message: `${scene?.scene_id || 'scene'} declares no hero subject and has no primary_subject or hero layer to default to`,
    };
    subject_valid = false;
  }

  return { at, subject, intent: hf.intent || null, declared: declared != null, subject_valid, finding };
}

// ── Legibility axes (metadata — no pixels required) ──────────────────────────

function scoreSubjectClarity(scene, resolved) {
  if (!resolved.subject_valid) return 0.3;
  const layers = scene?.layers || [];
  const subj = layers.find(l => l.id === resolved.subject);
  if (!subj) return 0.3;
  const weights = layers.map(l => l.clarity_weight || 0);
  const maxW = Math.max(1, ...weights);
  let s = 0.4;
  if (subj.product_role === 'hero') s += 0.3;
  if ((subj.clarity_weight || 0) >= maxW) s += 0.2;
  if ((subj.clarity_weight || 0) >= 4) s += 0.1;
  return clamp01(s);
}

/** Compute the three legibility axes from scene structure. */
function scoreLegibility(scene, resolved, brand) {
  return {
    subject_clarity: round3(scoreSubjectClarity(scene, resolved)),
    readable_text: round3(scoreSceneReadability(scene, brand)),
    hierarchy: round3(scoreSceneHierarchy(scene)),
  };
}

// ── Composition + aesthetic axes (rendered pixels + vision judge) ─────────────

function buildVisionSystemPrompt() {
  return `You are a composition judge for a single poster frame (one still) from an animated product/marketing scene.

You score how WELL-COMPOSED and how BEAUTIFUL the frame is — NOT merely whether it is legible (a separate pass handles legibility). A frame can be perfectly readable and still be a weak poster. Judge from the attached image; the caption gives the intended subject and intent.

Axes (0.0 = poor, 1.0 = excellent):
- visual_center: is the subject placed with intent (optical center / rule of thirds), not awkwardly cropped or dead-centered by accident?
- subject_scale: does the subject occupy an apt fraction of the frame — present and readable, neither lost in space nor overflowing the edges?
- contrast: does the subject separate cleanly from its background (figure/ground, tonal/colour separation)?
- whitespace_air: is there deliberate negative space and breathing room, or is the frame cluttered/cramped?
- brand_presence: is brand identity present and on-spec for this frame (colour/type/mark felt, neither absent nor garish)?
- emotional_semantic_clarity: does the still convey what it is about AND feel composed and intentional — would it stop a scroll? This is the beauty+meaning axis, not legibility.

Be critical. Return ONLY JSON:
{
  "score": 0.0-1.0,
  "dimensions": { "visual_center":0-1, "subject_scale":0-1, "contrast":0-1, "whitespace_air":0-1, "brand_presence":0-1, "emotional_semantic_clarity":0-1 },
  "reasoning": ["one short sentence per axis"],
  "rationale": "one-sentence overall verdict"
}`;
}

function buildVisionUserContent(scene, resolved, image) {
  const caption = `Scene "${scene?.scene_id || '(unknown)'}" — intended subject: ${resolved.subject || '(none)'} | intent: ${resolved.intent || '(none declared)'} | frame at ${Math.round((resolved.at) * 100)}% of the scene.`;
  return [
    { type: 'text', text: `${caption}\n\nJudge the attached poster frame:` },
    { type: 'image', source: { type: 'base64', media_type: image.media_type || 'image/png', data: image.data } },
  ];
}

const PIXEL_AXIS_KEYS = [...COMPOSITION_AXES, ...AESTHETIC_AXES];

function coerceVisionResult(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const dims = parsed.dimensions && typeof parsed.dimensions === 'object' ? parsed.dimensions : {};
  const out = {};
  let any = false;
  for (const k of PIXEL_AXIS_KEYS) {
    if (typeof dims[k] === 'number') { out[k] = round3(clamp01(dims[k])); any = true; }
    else out[k] = null;
  }
  if (!any) return null;
  return { dimensions: out, reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [], rationale: parsed.rationale || null };
}

/**
 * Judge the rendered frame's composition + aesthetic axes with a vision model.
 * Returns { dimensions, source:'llm-vision', reasoning, rationale } on success,
 * or null on any failure (no client, no image, bad response) — null keeps those
 * axes UNVERIFIED so the gate fails closed rather than fabricating a pass.
 */
async function judgeComposition({ scene, resolved, image, client: explicitClient }) {
  const anthropic = explicitClient || getClient();
  if (!anthropic || !image?.data) return null;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildVisionSystemPrompt(),
      messages: [{ role: 'user', content: buildVisionUserContent(scene, resolved, image) }],
    });
    const text = response.content?.find(c => c.type === 'text')?.text || response.content?.[0]?.text || '';
    const coerced = coerceVisionResult(parseJSONResponse(text));
    if (!coerced) return null;
    return { ...coerced, source: 'llm-vision' };
  } catch {
    return null;
  }
}

// ── Score one hero frame ─────────────────────────────────────────────────────

/**
 * Score a scene's hero frame. Legibility axes always compute from metadata;
 * composition/aesthetic axes compute only from a real rendered `frame` judged by
 * a real vision model. Required axes lacking that evidence are reported as
 * UNVERIFIED (null) so the gate can fail closed.
 *
 * @param {object} params
 * @param {object} params.scene - Scene definition.
 * @param {object} [params.frame] - Rendered still { media_type, data(base64) }.
 * @param {object} [params.brand] - Brand package for the brand axis prior.
 * @param {string} [params.tier='T3'] - Master tier (T1–T4) — sets required axes + threshold.
 * @param {object} [params.client] - Vision client override (tests).
 * @returns {Promise<object>} hero-frame score record.
 */
export async function scoreHeroFrame({ scene, frame, brand, tier = 'T3', client: explicitClient } = {}) {
  const t = normalizeTier(tier);
  const threshold = HERO_FRAME_TIER_THRESHOLDS[t];
  const required = new Set(HERO_FRAME_TIER_AXES[t]);
  const resolved = resolveHeroFrame(scene);

  // Legibility — always available from structure.
  const legibility = scoreLegibility(scene, resolved, brand);

  // Composition + aesthetic — only from a real rendered frame + real vision judge.
  const hasPixels = !!(frame && frame.data);
  const vision = hasPixels ? await judgeComposition({ scene, resolved, image: frame, client: explicitClient }) : null;
  const visionVerified = vision?.source === 'llm-vision';

  // Brand presence has a structural prior, but it only counts as VERIFIED when
  // the vision judge actually scored it on pixels — otherwise it stays UNVERIFIED.
  const brandPrior = round3(scoreSceneBrandMatch(scene, brand));

  const subscores = {};
  const reasoning = vision?.reasoning || [];
  for (const axis of HERO_FRAME_AXES) {
    const isPixel = PIXEL_AXES.has(axis);
    let score = null;
    if (!isPixel) {
      score = legibility[axis];
    } else if (visionVerified && typeof vision.dimensions[axis] === 'number') {
      score = vision.dimensions[axis];
    } else {
      score = null; // UNVERIFIED — no trustworthy pixel evidence.
    }
    subscores[axis] = {
      score,
      required: required.has(axis),
      verified: score != null,
      ...(axis === 'brand_presence' && !visionVerified ? { metadata_prior: brandPrior } : {}),
    };
  }

  // Required axes that lack evidence — these force a fail-closed BLOCK.
  const unverified = [...required].filter(a => subscores[a].score == null);

  // Overall = mean over the tier's required axes that DID score (equal weight;
  // the bar rises because more — and harder, pixel-judged — axes enter per tier).
  const scoredRequired = [...required].map(a => subscores[a].score).filter(s => s != null);
  const overall = scoredRequired.length
    ? round3(scoredRequired.reduce((a, b) => a + b, 0) / scoredRequired.length)
    : null;

  const evidence = visionVerified ? 'rendered' : 'metadata-only';

  const findings = [];
  if (resolved.finding) findings.push(resolved.finding);
  if (unverified.length) {
    findings.push({
      axis: unverified.join(','), severity: 'unverified',
      message: `${unverified.length} required ${t} ax${unverified.length === 1 ? 'is' : 'es'} could not be verified (needs a rendered frame + vision judge): ${unverified.join(', ')}`,
    });
  }

  return {
    scene_id: scene?.scene_id || null,
    tier: t,
    threshold,
    at: resolved.at,
    subject: resolved.subject,
    intent: resolved.intent,
    evidence,
    vision_source: vision?.source || null,
    overall,
    subscores,
    unverified,
    reasoning,
    rationale: vision?.rationale || null,
    findings,
  };
}

// ── Per-scene verdict + the fail-closed gate ─────────────────────────────────

/**
 * Reduce a hero-frame score to a verdict against its tier. Fail-closed:
 *   BLOCK — any required axis UNVERIFIED, an explicitly-broken subject at T3/T4,
 *           or overall below threshold.
 *   WARN  — marginal (within MARGINAL_BAND above threshold), or a broken subject
 *           at a lower tier.
 *   PASS  — all required axes verified and overall clears threshold with margin.
 */
export function verdictForScore(score) {
  const reasons = [];
  const highTier = score.tier === 'T3' || score.tier === 'T4';
  const brokenSubject = score.findings.some(f => f.axis === 'subject' && f.severity === 'block_high_tier');

  if (score.unverified.length) {
    reasons.push(`unverified required axes: ${score.unverified.join(', ')}`);
    return { verdict: 'BLOCK', reasons };
  }
  if (brokenSubject && highTier) {
    reasons.push('declared hero subject does not exist (cannot trust composition at this tier)');
    return { verdict: 'BLOCK', reasons };
  }
  if (score.overall == null) {
    reasons.push('no scorable required axes');
    return { verdict: 'BLOCK', reasons };
  }
  if (score.overall < score.threshold) {
    const failing = Object.entries(score.subscores)
      .filter(([, s]) => s.required && s.score != null && s.score < score.threshold)
      .map(([a]) => a);
    reasons.push(`overall ${score.overall} < ${score.tier} threshold ${score.threshold}` + (failing.length ? ` — weakest: ${failing.join(', ')}` : ''));
    return { verdict: 'BLOCK', reasons };
  }
  if (score.overall < score.threshold + MARGINAL_BAND) {
    reasons.push(`overall ${score.overall} only marginally clears ${score.threshold}`);
    return { verdict: 'WARN', reasons };
  }
  if (brokenSubject) {
    reasons.push('declared hero subject does not exist (advisory at this tier)');
    return { verdict: 'WARN', reasons };
  }
  return { verdict: 'PASS', reasons };
}

const VERDICT_RANK = { PASS: 0, WARN: 1, BLOCK: 2 };

/**
 * Audit every scene's hero frame against a tier and return a fail-closed verdict.
 *
 * Resolves each manifest entry to its scene definition; an entry whose scene is
 * missing/empty is reported (no placeholder is ever scored). Renders one still
 * per scene via a shared capture session unless a `capture` override is supplied.
 *
 * @param {object} params
 * @param {object} params.manifest - Sequence manifest ({ scenes: [{ scene, ... }] }).
 * @param {object[]|object} params.scenes - Scene defs (array or scene_id→def map).
 * @param {string} [params.tier='T3']
 * @param {object} [params.brand]
 * @param {function} [params.capture] - async (scene, at) => still|null. Overrides
 *   the real renderer (tests / pre-rendered frames / metadata-only runs).
 * @param {object} [params.client] - Vision client override.
 * @returns {Promise<{ verdict, tier, threshold, scenes: [...], findings: [...], evidence_summary }>}
 */
export async function auditHeroFrames({ manifest, scenes, tier = 'T3', brand, capture, client: explicitClient } = {}) {
  const t = normalizeTier(tier);
  const entries = manifest?.scenes || [];
  const sceneMap = toSceneMap(scenes);

  // Resolve capture: explicit override > real session > none (metadata-only).
  let session = null;
  let captureFn = capture || null;
  if (!captureFn) {
    session = await openHeroCaptureSession({});
    if (session && !session.unavailable) {
      captureFn = (scene, at) => session.capture(scene, at);
    }
  }

  const results = [];
  try {
    for (const entry of entries) {
      const sceneId = entry.scene || entry.scene_id;
      const scene = sceneMap.get(sceneId);

      if (!scene || !scene.layers?.length) {
        // Missing/empty scene def — never rendered, never scored as a placeholder.
        results.push({
          scene_id: sceneId,
          tier: t,
          missing_definition: true,
          evidence: 'none',
          verdict: 'BLOCK',
          reasons: [`no usable scene definition for "${sceneId}" — cannot evaluate its hero frame`],
        });
        continue;
      }

      const resolved = resolveHeroFrame(scene);
      let frame = null;
      if (captureFn) {
        const still = await captureFn(scene, resolved.at);
        if (still && !still.error && still.data) frame = still;
      }

      const score = await scoreHeroFrame({ scene, frame, brand, tier: t, client: explicitClient });
      const v = verdictForScore(score);
      results.push({ ...score, verdict: v.verdict, reasons: v.reasons });
    }
  } finally {
    if (session && session.close) await session.close();
  }

  // Roll up: BLOCK dominates WARN dominates PASS.
  let verdict = 'PASS';
  for (const r of results) {
    if (VERDICT_RANK[r.verdict] > VERDICT_RANK[verdict]) verdict = r.verdict;
  }

  const findings = [];
  for (const r of results) {
    for (const reason of r.reasons || []) {
      findings.push({ scene_id: r.scene_id, verdict: r.verdict, message: reason });
    }
  }

  const rendered = results.filter(r => r.evidence === 'rendered').length;
  const evidence_summary = {
    scenes: results.length,
    rendered,
    metadata_only: results.filter(r => r.evidence === 'metadata-only').length,
    missing: results.filter(r => r.missing_definition).length,
  };

  return {
    verdict,
    tier: t,
    threshold: HERO_FRAME_TIER_THRESHOLDS[t],
    scenes: results,
    findings,
    evidence_summary,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toSceneMap(scenes) {
  const map = new Map();
  if (!scenes) return map;
  if (Array.isArray(scenes)) {
    for (const s of scenes) if (s?.scene_id) map.set(s.scene_id, s);
  } else if (typeof scenes === 'object') {
    for (const [k, v] of Object.entries(scenes)) map.set(k, v);
  }
  return map;
}
