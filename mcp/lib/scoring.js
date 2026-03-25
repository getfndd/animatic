/**
 * Unified Video Scoring
 *
 * Facade over all existing evaluators. Produces a single score card with
 * 6 weighted subscores, aggregated findings, and bounded revision
 * recommendations.
 *
 * Subscores (0-1 scale):
 *   hook (0.20) — opening impact and attention capture
 *   narrative_arc (0.20) — pacing, flow, and audio alignment
 *   clarity (0.20) — product comprehension and adherence
 *   visual_hierarchy (0.15) — motion density and variety
 *   motion_quality (0.15) — per-scene motion craftsmanship
 *   brand_finish (0.10) — brand compliance and compositing quality
 */

import { evaluateSequence } from './evaluate.js';
import { critiqueTimeline, critiqueScene } from './critic.js';
import { compileMotion } from './compiler.js';
import { auditMotionDensity } from './motion-density.js';
import { scoreBrandFinish } from './compositing.js';
import { validateBrandCompliance } from './brands.js';
import { scoreProductDemoClarity } from './product-archetypes.js';
import { scoreAudioSync } from './audio-sync.js';

import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadRecipes,
} from '../data/loader.js';

// ── Default weights ─────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  hook: 0.20,
  narrative_arc: 0.20,
  clarity: 0.20,
  visual_hierarchy: 0.15,
  motion_quality: 0.15,
  brand_finish: 0.10,
};

export const REVISION_OPS = [
  'trim', 'extend_hold', 'swap_transition', 'reorder',
  'boost_hierarchy', 'compress', 'add_continuity', 'adjust_density',
];

// ── Catalogs for compilation ────────────────────────────────────────────────

let _catalogs = null;
function getCatalogs() {
  if (!_catalogs) {
    _catalogs = {
      primitives: loadPrimitivesCatalog(),
      personalities: loadPersonalitiesCatalog(),
      recipes: loadRecipes(),
    };
  }
  return _catalogs;
}

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Score a candidate video manifest across 6 dimensions.
 *
 * @param {object} params
 * @param {object} params.manifest - Sequence manifest
 * @param {object[]} params.scenes - Scene definitions
 * @param {string} [params.style] - Style pack name
 * @param {object} [params.brand] - Brand package
 * @param {object} [params.audio_beats] - Beat data
 * @param {object} [params.weights] - Weight overrides
 * @returns {object} Score card
 */
export function scoreCandidateVideo({ manifest, scenes, style, brand, audio_beats, weights } = {}) {
  if (!manifest || !manifest.scenes) {
    throw new Error('scoreCandidateVideo requires a manifest with scenes');
  }
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('scoreCandidateVideo requires a non-empty scenes array');
  }

  const w = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  const usedStyle = style || brand?.style || 'prestige';

  // ── Run all evaluators ──────────────────────────────────────────────────

  const raw = {};

  // 1. Sequence evaluation (pacing, variety, flow, adherence)
  raw.evaluate = safeCall(() => evaluateSequence({ manifest, scenes, style: usedStyle }));

  // 2. Per-scene critic scores (requires compilation)
  raw.critic_per_scene = compileAndCritique(manifest, scenes);

  // 3. Motion density (first scene with compiled timeline)
  raw.motion_density = computeDensity(manifest, scenes);

  // 4. Brand finish
  raw.brand_finish = safeCall(() => scoreBrandFinish({
    personality: brand?.personality || 'cinematic-dark',
    style_pack: usedStyle,
  }));

  // 5. Brand compliance
  raw.brand_compliance = brand
    ? safeCall(() => validateBrandCompliance(brand, manifest, scenes))
    : { violations: [], warnings: [] };

  // 6. Product demo clarity
  raw.product_clarity = safeCall(() => scoreProductDemoClarity(manifest, scenes));

  // 7. Audio sync
  raw.audio_sync = audio_beats?.beats?.length
    ? safeCall(() => ({ sync_score: scoreAudioSync(manifest, audio_beats) }))
    : null;

  // ── Derive subscores ────────────────────────────────────────────────────

  const subscores = {};
  const allFindings = [];

  // Hook: opening energy + first-scene quality
  subscores.hook = deriveHook(raw, allFindings);

  // Narrative arc: pacing + flow + audio sync
  subscores.narrative_arc = deriveNarrativeArc(raw, allFindings);

  // Clarity: product demo clarity + adherence
  subscores.clarity = deriveClarity(raw, allFindings);

  // Visual hierarchy: motion density + variety
  subscores.visual_hierarchy = deriveVisualHierarchy(raw, allFindings);

  // Motion quality: mean critic score
  subscores.motion_quality = deriveMotionQuality(raw, allFindings);

  // Brand finish: finish score - violation penalty
  subscores.brand_finish = deriveBrandFinish(raw, allFindings);

  // ── Weighted overall ────────────────────────────────────────────────────

  let overall = 0;
  for (const [dim, weight] of Object.entries(w)) {
    overall += (subscores[dim]?.score ?? 0) * weight;
  }
  overall = Math.round(overall * 1000) / 1000;

  // ── Revision recommendations ────────────────────────────────────────────

  const recommended_revisions = generateRevisions(raw, subscores, manifest);

  return {
    overall,
    subscores,
    weights_used: w,
    findings: allFindings,
    recommended_revisions,
    raw,
  };
}

// ── Subscore derivation ─────────────────────────────────────────────────────

function deriveHook(raw, findings) {
  const result = { score: 0.5, findings: [] };

  if (raw.evaluate?.dimensions) {
    const pacing = raw.evaluate.dimensions.pacing?.score ?? 50;
    const flow = raw.evaluate.dimensions.flow?.score ?? 50;
    // Hook weights opening pacing heavily
    result.score = clamp01((pacing * 0.6 + flow * 0.4) / 100);

    // Check first-scene energy
    const pacingFindings = raw.evaluate.dimensions.pacing?.findings || [];
    for (const f of pacingFindings) {
      const msg = typeof f === 'string' ? f : (f.message || '');
      if (msg.toLowerCase().includes('opening') || msg.toLowerCase().includes('first') || (f.scene_index === 0)) {
        result.findings.push(msg);
        findings.push({ dimension: 'hook', severity: f.severity || 'warning', message: msg });
      }
    }
  }

  // Boost/penalize from first critic score
  if (raw.critic_per_scene?.length > 0) {
    const firstScore = raw.critic_per_scene[0].score ?? 50;
    result.score = clamp01(result.score * 0.7 + (firstScore / 100) * 0.3);
  }

  return result;
}

function deriveNarrativeArc(raw, findings) {
  const result = { score: 0.5, findings: [] };
  const parts = [];

  if (raw.evaluate?.dimensions) {
    parts.push(raw.evaluate.dimensions.pacing?.score ?? 50);
    parts.push(raw.evaluate.dimensions.flow?.score ?? 50);

    const flowFindings = raw.evaluate.dimensions.flow?.findings || [];
    for (const f of flowFindings) {
      const msg = typeof f === 'string' ? f : (f.message || '');
      result.findings.push(msg);
      findings.push({ dimension: 'narrative_arc', severity: f.severity || 'info', message: msg });
    }
  }

  if (raw.audio_sync?.sync_score != null) {
    parts.push(raw.audio_sync.sync_score);
  }

  if (parts.length > 0) {
    result.score = clamp01(parts.reduce((a, b) => a + b, 0) / (parts.length * 100));
  }

  return result;
}

function deriveClarity(raw, findings) {
  const result = { score: 0.5, findings: [] };
  const parts = [];

  if (raw.product_clarity?.score != null) {
    parts.push(raw.product_clarity.score);
    for (const w of (raw.product_clarity.warnings || [])) {
      result.findings.push(w);
      findings.push({ dimension: 'clarity', severity: 'warning', message: w });
    }
  }

  if (raw.evaluate?.dimensions?.adherence?.score != null) {
    parts.push(raw.evaluate.dimensions.adherence.score);
  }

  if (parts.length > 0) {
    result.score = clamp01(parts.reduce((a, b) => a + b, 0) / (parts.length * 100));
  }

  return result;
}

function deriveVisualHierarchy(raw, findings) {
  const result = { score: 0.5, findings: [] };
  const parts = [];

  if (raw.motion_density?.score != null) {
    // Motion density ideal is ~50 on 0-100 scale; map to 0-1
    // Score decreases as density moves away from 50
    const densityScore = 100 - Math.abs(raw.motion_density.score - 50) * 2;
    parts.push(Math.max(0, densityScore));

    for (const s of (raw.motion_density.suggestions || [])) {
      result.findings.push(s);
      findings.push({ dimension: 'visual_hierarchy', severity: 'info', message: s });
    }
  }

  if (raw.evaluate?.dimensions?.variety?.score != null) {
    parts.push(raw.evaluate.dimensions.variety.score);
  }

  if (parts.length > 0) {
    result.score = clamp01(parts.reduce((a, b) => a + b, 0) / (parts.length * 100));
  }

  return result;
}

function deriveMotionQuality(raw, findings) {
  const result = { score: 0.5, findings: [] };

  if (raw.critic_per_scene?.length > 0) {
    const scores = raw.critic_per_scene.map(c => c.score ?? 50);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    result.score = clamp01(mean / 100);

    // Collect worst issues
    for (const c of raw.critic_per_scene) {
      for (const issue of (c.issues || [])) {
        if (issue.severity === 'error' || issue.severity === 'warning') {
          const msg = `${c.scene_id}: ${issue.message || issue.rule}`;
          result.findings.push(msg);
          findings.push({ dimension: 'motion_quality', severity: issue.severity, message: msg });
        }
      }
    }
  }

  return result;
}

function deriveBrandFinish(raw, findings) {
  const result = { score: 0.5, findings: [] };

  if (raw.brand_finish?.quality_score?.score != null) {
    result.score = clamp01(raw.brand_finish.quality_score.score / (raw.brand_finish.quality_score.max || 100));
  }

  // Penalize for compliance violations
  const violations = raw.brand_compliance?.violations || [];
  if (violations.length > 0) {
    result.score = clamp01(result.score - violations.length * 0.1);
    for (const v of violations) {
      const msg = typeof v === 'string' ? v : (v.message || v.rule || JSON.stringify(v));
      result.findings.push(msg);
      findings.push({ dimension: 'brand_finish', severity: 'warning', message: msg });
    }
  }

  return result;
}

// ── Revision recommendations ────────────────────────────────────────────────

function generateRevisions(raw, subscores, manifest) {
  const revisions = [];

  // Hook too low → trim opening
  if ((subscores.hook?.score ?? 1) < 0.7 && manifest.scenes?.length > 1) {
    revisions.push({
      op: 'trim',
      target: manifest.scenes[0].scene,
      reason: 'Opening scene may be too slow — trim to improve hook',
    });
  }

  // Narrative arc issues → reorder
  if ((subscores.narrative_arc?.score ?? 1) < 0.6) {
    revisions.push({
      op: 'reorder',
      target: null,
      reason: 'Narrative arc is flat — consider reordering scenes for better flow',
    });
  }

  // Motion quality low → adjust density
  const criticIssues = (raw.critic_per_scene || []).flatMap(c => c.issues || []);
  const flatMotion = criticIssues.filter(i => i.rule === 'flat_motion');
  if (flatMotion.length > 0) {
    revisions.push({
      op: 'adjust_density',
      target: flatMotion[0].layer || null,
      reason: `${flatMotion.length} scene(s) have flat motion — stagger layer entrances`,
    });
  }

  // Repetitive transitions → swap
  const repetitive = criticIssues.filter(i => i.rule === 'repetitive_easing' || i.rule === 'flat_pacing');
  if (repetitive.length > 0) {
    revisions.push({
      op: 'swap_transition',
      target: null,
      reason: 'Repetitive transitions detected — vary transition types',
    });
  }

  // Brand violations → boost hierarchy
  if ((subscores.brand_finish?.score ?? 1) < 0.6) {
    revisions.push({
      op: 'boost_hierarchy',
      target: null,
      reason: 'Brand finish is weak — ensure brand elements are prominent',
    });
  }

  return revisions;
}

// ── Compilation + critique pipeline ─────────────────────────────────────────

function compileAndCritique(manifest, scenes) {
  const results = [];
  const catalogs = getCatalogs();

  for (const entry of manifest.scenes) {
    const sceneId = entry.scene || entry.scene_id;
    const sceneDef = scenes.find(s => (s.scene_id || s.id) === sceneId);
    if (!sceneDef) {
      results.push({ scene_id: sceneId, score: 50, issues: [], summary: 'Scene not found' });
      continue;
    }

    try {
      const timeline = compileMotion(sceneDef, catalogs);
      const critique = critiqueTimeline(timeline, sceneDef);
      results.push({
        scene_id: sceneId,
        score: critique.score ?? 50,
        issues: critique.issues || [],
        summary: critique.summary || '',
      });
    } catch {
      // If compilation fails, try scene-level critique
      try {
        const critique = critiqueScene(sceneDef);
        results.push({
          scene_id: sceneId,
          score: critique.score ?? 50,
          issues: critique.issues || [],
          summary: critique.summary || '',
        });
      } catch {
        results.push({ scene_id: sceneId, score: 50, issues: [], summary: 'Critique unavailable' });
      }
    }
  }

  return results;
}

function computeDensity(manifest, scenes) {
  const catalogs = getCatalogs();

  // Compile first scene with layers for density analysis
  for (const entry of manifest.scenes) {
    const sceneId = entry.scene || entry.scene_id;
    const sceneDef = scenes.find(s => (s.scene_id || s.id) === sceneId);
    if (!sceneDef?.layers?.length) continue;

    try {
      const timeline = compileMotion(sceneDef, catalogs);
      return auditMotionDensity(timeline, sceneDef);
    } catch {
      continue;
    }
  }

  return { score: 50, suggestions: [] };
}

// ── Utilities ───────────────────────────────────────────────────────────────

function clamp01(n) {
  return Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}
