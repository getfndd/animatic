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
import { reviseCandidateVideo } from './revision.js';
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

  // ── Per-scene scoring ──────────────────────────────────────────────────

  const per_scene = scorePerScene(manifest, scenes, raw);

  // ── Revision recommendations ────────────────────────────────────────────

  const recommended_revisions = generateRevisions(raw, subscores, manifest, per_scene);

  return {
    overall,
    subscores,
    weights_used: w,
    findings: allFindings,
    recommended_revisions,
    per_scene,
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

// ── Per-scene scoring ───────────────────────────────────────────────────────

/**
 * Score each scene individually for clarity, hierarchy, pacing, motion quality,
 * and continuity to the next scene.
 */
function scorePerScene(manifest, scenes, raw) {
  const entries = manifest.scenes || [];
  const criticMap = new Map();
  for (const c of (raw.critic_per_scene || [])) {
    criticMap.set(c.scene_id, c);
  }

  return entries.map((entry, i) => {
    const sceneId = entry.scene || entry.scene_id;
    const sceneDef = scenes.find(s => (s.scene_id || s.id) === sceneId);
    const critic = criticMap.get(sceneId);
    const nextEntry = entries[i + 1];
    const findings = [];

    // Clarity: does scene have product annotations + interaction truth?
    let clarity = 0.5;
    if (sceneDef) {
      let clarityPts = 0;
      if (sceneDef.product_role) clarityPts += 0.2;
      if (sceneDef.primary_subject) clarityPts += 0.2;
      if (sceneDef.outcome) clarityPts += 0.1;
      if (sceneDef.interaction_truth) {
        const it = sceneDef.interaction_truth;
        if (it.has_cursor || it.has_typing) clarityPts += 0.15;
        if (it.has_state_change) clarityPts += 0.15;
        if (it.timing_realistic) clarityPts += 0.2;
      }
      clarity = clamp01(clarityPts);
      if (clarity < 0.4) findings.push(`${sceneId}: low clarity (${clarity.toFixed(2)}) — add product_role, primary_subject, interaction annotations`);
    }

    // Hierarchy: does the hero layer exist and dominate?
    let hierarchy = 0.5;
    if (sceneDef?.layers?.length > 0) {
      const heroLayer = sceneDef.layers.find(l => l.product_role === 'hero')
        || sceneDef.layers.find(l => l.depth_class === 'foreground');
      if (heroLayer) {
        hierarchy = 0.6;
        // Bonus if hero has motion targeting
        const groups = sceneDef.motion?.groups || [];
        if (groups.some(g => g.targets?.includes(heroLayer.id))) hierarchy = 0.8;
        // Bonus if hero has highest clarity_weight
        const maxWeight = Math.max(...sceneDef.layers.map(l => l.clarity_weight || 0));
        if ((heroLayer.clarity_weight || 0) >= maxWeight && maxWeight > 0) hierarchy = Math.min(1, hierarchy + 0.1);
      } else {
        findings.push(`${sceneId}: no hero layer identified — add product_role='hero' to primary layer`);
        hierarchy = 0.3;
      }
    }

    // Pacing: is duration appropriate for scene role?
    let pacing = 0.7;
    const duration = entry.duration_s || 3;
    const role = sceneDef?.product_role;
    if (role === 'atmosphere' && duration > 4) {
      pacing = 0.5;
      findings.push(`${sceneId}: atmosphere scene at ${duration}s may be too long — consider trimming to ≤3s`);
    } else if (role === 'cta' && duration > 3) {
      pacing = 0.5;
      findings.push(`${sceneId}: CTA/logo at ${duration}s — consider trimming to 2-2.5s`);
    } else if (role === 'dashboard' && duration < 4) {
      pacing = 0.5;
      findings.push(`${sceneId}: dashboard at ${duration}s may be too short for comprehension — consider 4-6s`);
    }

    // Motion quality: from critic score
    const motionQuality = critic ? clamp01(critic.score / 100) : 0.5;
    if (motionQuality < 0.5) {
      const worstIssue = critic?.issues?.[0];
      if (worstIssue) findings.push(`${sceneId}: ${worstIssue.rule} — ${worstIssue.message || worstIssue.suggestion || ''}`);
    }

    // Continuity to next scene
    let continuity = null;
    if (nextEntry) {
      const nextId = nextEntry.scene || nextEntry.scene_id;
      const nextDef = scenes.find(s => (s.scene_id || s.id) === nextId);
      continuity = 0.5;

      // Check for transition
      if (nextEntry.transition_in && nextEntry.transition_in.type !== 'hard_cut') {
        continuity += 0.2;
      }
      // Check for continuity_id match
      if (sceneDef?.layers && nextDef?.layers) {
        const currIds = new Set(sceneDef.layers.map(l => l.continuity_id).filter(Boolean));
        const nextIds = new Set(nextDef.layers.map(l => l.continuity_id).filter(Boolean));
        const shared = [...currIds].filter(id => nextIds.has(id));
        if (shared.length > 0) continuity += 0.3;
        else if (currIds.size === 0 && nextIds.size === 0) {
          findings.push(`${sceneId}→${nextId}: no continuity link — consider add_continuity`);
        }
      }
      continuity = clamp01(continuity);
    }

    // Scene overall: weighted mean of available dimensions
    const dims = [clarity, hierarchy, pacing, motionQuality];
    if (continuity !== null) dims.push(continuity);
    const sceneOverall = clamp01(dims.reduce((a, b) => a + b, 0) / dims.length);

    return {
      scene_id: sceneId,
      overall: sceneOverall,
      clarity,
      hierarchy,
      pacing,
      motion_quality: motionQuality,
      continuity_to_next: continuity,
      duration_s: duration,
      product_role: sceneDef?.product_role || null,
      findings,
    };
  });
}

// ── Revision recommendations ────────────────────────────────────────────────

function generateRevisions(raw, subscores, manifest, perScene) {
  const revisions = [];

  // Per-scene targeted revisions (Item 4: actionable)
  if (perScene) {
    // Sort scenes by overall ascending — worst first
    const sorted = [...perScene].sort((a, b) => a.overall - b.overall);

    for (const ps of sorted) {
      if (ps.overall >= 0.80) continue; // scene is good enough

      // Pacing issues → trim or extend
      if (ps.pacing < 0.6) {
        const role = ps.product_role;
        if ((role === 'atmosphere' || role === 'cta') && ps.duration_s > 3) {
          revisions.push({
            op: 'trim',
            target: ps.scene_id,
            amount_s: Math.round((ps.duration_s - 2.5) * 10) / 10,
            reason: `${ps.scene_id}: ${role} scene at ${ps.duration_s}s — trim to ~2.5s`,
          });
        } else if (role === 'dashboard' && ps.duration_s < 4) {
          revisions.push({
            op: 'extend_hold',
            target: ps.scene_id,
            amount_s: Math.round((5 - ps.duration_s) * 10) / 10,
            reason: `${ps.scene_id}: dashboard needs more time — extend to ~5s`,
          });
        }
      }

      // Hierarchy issues → boost hero
      if (ps.hierarchy < 0.5) {
        revisions.push({
          op: 'boost_hierarchy',
          target: ps.scene_id,
          reason: `${ps.scene_id}: no clear hero layer — promote primary element`,
        });
      }

      // Motion quality issues → adjust density
      if (ps.motion_quality < 0.5) {
        revisions.push({
          op: 'adjust_density',
          target: ps.scene_id,
          target_density: 'moderate',
          reason: `${ps.scene_id}: motion quality ${ps.motion_quality.toFixed(2)} — simplify or stagger animations`,
        });
      }

      // Continuity gaps → add continuity link
      if (ps.continuity_to_next !== null && ps.continuity_to_next < 0.75) {
        const nextIdx = perScene.findIndex(p => p.scene_id === ps.scene_id) + 1;
        if (nextIdx < perScene.length) {
          revisions.push({
            op: 'add_continuity',
            from_scene: ps.scene_id,
            to_scene: perScene[nextIdx].scene_id,
            strategy: 'position',
            reason: `${ps.scene_id}→${perScene[nextIdx].scene_id}: no continuity link — add match cut`,
          });
        }
      }
    }
  }

  // Sequence-level fallbacks (only if per-scene didn't generate targeted revisions)
  if (revisions.length === 0) {
    if ((subscores.hook?.score ?? 1) < 0.7 && manifest.scenes?.length > 1) {
      revisions.push({
        op: 'trim',
        target: manifest.scenes[0].scene,
        amount_s: 0.5,
        reason: 'Opening scene may be too slow — trim to improve hook',
      });
    }

    if ((subscores.brand_finish?.score ?? 1) < 0.6) {
      revisions.push({
        op: 'boost_hierarchy',
        target: manifest.scenes[manifest.scenes.length - 1]?.scene,
        reason: 'Brand finish is weak — ensure brand elements are prominent in closing',
      });
    }
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

// ── Auto-revise loop ────────────────────────────────────────────────────────

/**
 * Autonomous revision loop: score → revise → re-score → repeat.
 *
 * Picks the worst-scoring scenes, applies targeted revisions, re-scores,
 * and repeats until convergence (improvement < threshold) or max rounds.
 *
 * @param {object} params
 * @param {object} params.manifest - Starting manifest
 * @param {object[]} params.scenes - Starting scene definitions
 * @param {string} [params.style] - Style pack
 * @param {object} [params.brand] - Brand package
 * @param {object} [params.audio_beats] - Beat data
 * @param {number} [params.max_rounds=3] - Max revision rounds
 * @param {number} [params.min_improvement=0.01] - Stop if improvement below this
 * @returns {{ manifest, scenes, score_before, score_after, rounds: object[], total_revisions }}
 */
export function autoReviseLoop({ manifest, scenes, style, brand, audio_beats, max_rounds = 3, min_improvement = 0.01 }) {
  let currentManifest = JSON.parse(JSON.stringify(manifest));
  let currentScenes = JSON.parse(JSON.stringify(scenes));

  const initialCard = scoreCandidateVideo({ manifest: currentManifest, scenes: currentScenes, style, brand, audio_beats });
  const scoreBefore = initialCard.overall;
  let currentScore = scoreBefore;
  const rounds = [];
  let totalRevisions = 0;

  for (let round = 1; round <= max_rounds; round++) {
    const card = scoreCandidateVideo({ manifest: currentManifest, scenes: currentScenes, style, brand, audio_beats });
    const targeted = card.recommended_revisions.filter(r => r.target || r.from_scene);

    if (targeted.length === 0) {
      rounds.push({ round, revisions: 0, score_before: currentScore, score_after: currentScore, delta: 0, stopped: 'no_revisions' });
      break;
    }

    // Apply up to 3 revisions per round (avoid over-correcting)
    const batch = targeted.slice(0, 3);

    let revised;
    try {
      revised = reviseCandidateVideo({
        manifest: currentManifest,
        scenes: currentScenes,
        revisions: batch,
      });
    } catch {
      rounds.push({ round, revisions: 0, score_before: currentScore, score_after: currentScore, delta: 0, stopped: 'revision_error' });
      break;
    }

    const reScored = scoreCandidateVideo({ manifest: revised.manifest, scenes: revised.scenes, style, brand, audio_beats });
    const delta = reScored.overall - currentScore;

    const roundInfo = {
      round,
      revisions: revised.revision_count,
      diff: revised.diff,
      score_before: currentScore,
      score_after: reScored.overall,
      delta: Math.round(delta * 1000) / 1000,
    };

    if (delta < -0.005) {
      // Score got worse — revert
      roundInfo.stopped = 'score_decreased';
      rounds.push(roundInfo);
      break;
    }

    currentManifest = revised.manifest;
    currentScenes = revised.scenes;
    currentScore = reScored.overall;
    totalRevisions += revised.revision_count;
    rounds.push(roundInfo);

    if (delta < min_improvement) {
      roundInfo.stopped = 'converged';
      break;
    }
  }

  return {
    manifest: currentManifest,
    scenes: currentScenes,
    score_before: scoreBefore,
    score_after: currentScore,
    improvement: Math.round((currentScore - scoreBefore) * 1000) / 1000,
    rounds,
    total_revisions: totalRevisions,
  };
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
