/**
 * Sequence Evaluation Engine — ANI-28
 *
 * Scores a planned sequence manifest across four dimensions:
 * pacing, variety, flow, and style adherence. Returns 0-100 scores
 * per dimension plus actionable findings.
 *
 * Pure scoring functions — deterministic, testable, no LLM calls.
 * Re-derives expected transitions/camera from raw style pack rules
 * (does not import planner functions) to catch manually-edited manifests.
 */

import { loadStylePacks, loadPersonalitiesCatalog, loadShotGrammar } from '../data/loader.js';

// ── Load catalog data at module level ────────────────────────────────────────

const personalitiesCatalog = loadPersonalitiesCatalog();
const stylePacksCatalog = loadStylePacks(
  personalitiesCatalog.array.map(p => p.slug)
);
const shotGrammarCatalog = loadShotGrammar();

// ── Constants ────────────────────────────────────────────────────────────────

export const ENERGY_NUMERIC = { static: 0, subtle: 1, moderate: 2, high: 3 };
export const DIMENSION_WEIGHTS = { pacing: 0.25, variety: 0.25, flow: 0.25, adherence: 0.25 };

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get a loaded style pack by name. Throws if not found.
 */
function getStylePack(style) {
  const pack = stylePacksCatalog.byName.get(style);
  if (!pack) throw new Error(`Unknown style: ${style}`);
  return pack;
}

/**
 * Resolve the effective style pack for a scene.
 * Graceful fallback: if style_override is unknown, fall back to default.
 * Evaluator should never throw on bad overrides — just score against default.
 */
function resolveScenePack(scene, defaultStyle) {
  const override = scene?.metadata?.style_override;
  if (override) {
    const pack = stylePacksCatalog.byName.get(override);
    if (pack) return pack;
    // Unknown override — fall back to default
  }
  return getStylePack(defaultStyle);
}

/**
 * Parse a personality loop_time string like "12-16s" into { min, max }.
 */
export function parseLoopTimeRange(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/^(\d+)-(\d+)s?$/);
  if (!match) return null;
  return { min: parseInt(match[1], 10), max: parseInt(match[2], 10) };
}

/**
 * Get the expected duration for a given motion_energy from a style pack.
 */
export function getExpectedDuration(energy, pack) {
  let duration = pack.hold_durations[energy] ?? pack.hold_durations.moderate;
  if (pack.max_hold_duration != null) {
    duration = Math.min(duration, pack.max_hold_duration);
  }
  return duration;
}

/**
 * Re-derive the expected transition for a scene pair using style pack rules.
 * Mirrors the planner's priority order:
 *   1. pattern — positional (every-Nth)
 *   2. on_same_weight — consecutive same visual_weight
 *   3. on_weight_change — visual_weight differs
 *   4. on_intent — intent tag match on incoming scene
 *   5. default — fallback
 */
export function getExpectedTransition(rules, prevScene, currScene, sceneIndex) {
  const prevWeight = prevScene.metadata?.visual_weight;
  const currWeight = currScene.metadata?.visual_weight;
  const currTags = currScene.metadata?.intent_tags || [];

  // 1. Pattern rule (positional)
  if (rules.pattern) {
    const { every_n, cycle, duration_ms } = rules.pattern;
    if (sceneIndex % every_n === 0) {
      const cycleIdx = Math.floor(sceneIndex / every_n) - 1;
      const type = cycle[cycleIdx % cycle.length];
      return { type, duration_ms };
    }
  }

  // 2. on_same_weight
  if (rules.on_same_weight) {
    if (prevWeight && currWeight && prevWeight === currWeight) {
      return { ...rules.on_same_weight };
    }
  }

  // 3. on_weight_change
  if (rules.on_weight_change) {
    if (prevWeight && currWeight && prevWeight !== currWeight) {
      return { ...rules.on_weight_change };
    }
  }

  // 4. on_intent
  if (rules.on_intent) {
    const { tags, transition } = rules.on_intent;
    if (tags.some(tag => currTags.includes(tag))) {
      return { ...transition };
    }
  }

  // 5. default
  return { ...rules.default };
}

/**
 * Re-derive the expected camera override for a scene using style pack rules.
 * Mirrors the planner's priority order:
 *   1. force_static — all scenes get { move: 'static' }
 *   2. by_content_type — content_type → camera move
 *   3. by_intent — intent tag → camera move
 */
export function getExpectedCamera(rules, scene, personalitySlug) {
  // 1. force_static
  if (rules.force_static) {
    return { move: 'static' };
  }

  // 2. by_content_type
  if (rules.by_content_type) {
    const contentType = scene.metadata?.content_type;
    if (contentType && rules.by_content_type[contentType]) {
      return { ...rules.by_content_type[contentType] };
    }
  }

  // 3. by_intent
  if (rules.by_intent) {
    const tags = scene.metadata?.intent_tags || [];
    for (const tag of tags) {
      if (rules.by_intent[tag]) {
        return { ...rules.by_intent[tag] };
      }
    }
  }

  return null;
}

// ── Pacing scorer ────────────────────────────────────────────────────────────

/**
 * Score pacing: how well scene durations match the style pack's hold_durations.
 *
 * Per-scene: deviation from expected penalizes proportionally.
 *   Within ±0.5s = full marks; >1s off = warning finding.
 * Total duration: compare against personality's loop_time range.
 * Max hold cap: violations generate warnings.
 * Confidence weighting: low-confidence motion_energy = less penalty.
 */
export function scorePacing(manifestScenes, sceneMap, style) {
  const defaultPack = getStylePack(style);
  const findings = [];

  if (manifestScenes.length === 0) {
    return { score: 100, findings };
  }

  // Single scene is trivially correct
  if (manifestScenes.length === 1) {
    return { score: 100, findings };
  }

  let totalPenalty = 0;
  const maxPenaltyPerScene = 100;

  for (let i = 0; i < manifestScenes.length; i++) {
    const ms = manifestScenes[i];
    const scene = sceneMap.get(ms.scene);
    if (!scene) continue;

    const pack = resolveScenePack(scene, style);
    const energy = scene.metadata?.motion_energy || 'moderate';
    const expected = getExpectedDuration(energy, pack);
    const actual = ms.duration_s;
    const deviation = Math.abs(actual - expected);

    // Confidence weighting: reduce penalty for low-confidence classifications
    const confidence = scene.metadata?._confidence?.motion_energy ?? 1;

    let scenePenalty = 0;
    if (deviation > 0.5) {
      // Scale: 0.5s → 0 penalty, 2s → full penalty
      scenePenalty = Math.min(maxPenaltyPerScene, (deviation - 0.5) * (maxPenaltyPerScene / 1.5));
      scenePenalty *= confidence;
    }

    if (deviation > 1.0) {
      findings.push({
        severity: 'warning',
        dimension: 'pacing',
        message: `Scene ${i + 1} duration (${actual}s) deviates from expected (${expected}s) for ${energy} energy`,
        scene_index: i,
      });
    }

    // Max hold cap violations
    if (pack.max_hold_duration != null && actual > pack.max_hold_duration) {
      findings.push({
        severity: 'warning',
        dimension: 'pacing',
        message: `Scene ${i + 1} duration (${actual}s) exceeds max hold (${pack.max_hold_duration}s)`,
        scene_index: i,
      });
      scenePenalty += 15;
    }

    totalPenalty += scenePenalty;
  }

  let score = Math.max(0, 100 - (totalPenalty / manifestScenes.length));

  // Total duration vs personality loop_time range (uses sequence-level pack)
  const personality = personalitiesCatalog.bySlug.get(defaultPack.personality);
  if (personality) {
    const loopRange = parseLoopTimeRange(personality.characteristics?.loop_time);
    if (loopRange) {
      const totalDuration = manifestScenes.reduce((sum, s) => sum + s.duration_s, 0);
      if (totalDuration >= loopRange.min && totalDuration <= loopRange.max) {
        score = Math.min(100, score + 5);
      } else {
        const outside = totalDuration < loopRange.min
          ? loopRange.min - totalDuration
          : totalDuration - loopRange.max;
        findings.push({
          severity: 'info',
          dimension: 'pacing',
          message: `Total duration (${totalDuration.toFixed(1)}s) outside personality loop_time range (${loopRange.min}-${loopRange.max}s)`,
        });
        // Small penalty for being outside range, but don't double-penalize
        if (outside > 5) {
          score = Math.max(0, score - 5);
        }
      }
    }
  }

  return { score: Math.round(Math.max(0, Math.min(100, score))), findings };
}

// ── Variety scorer ───────────────────────────────────────────────────────────

/**
 * Score variety: style-agnostic cinematography quality.
 * Four equally-weighted sub-scores (25% each):
 *   - Shot size variety
 *   - Content type variety
 *   - Visual weight balance
 *   - Motion energy distribution
 *
 * Short sequences (1-2 scenes) score 100.
 */
export function scoreVariety(manifestScenes, sceneMap) {
  const findings = [];

  if (manifestScenes.length <= 2) {
    return { score: 100, findings };
  }

  const scenes = manifestScenes.map(ms => sceneMap.get(ms.scene)).filter(Boolean);
  if (scenes.length <= 2) {
    return { score: 100, findings };
  }

  // Sub-score 1: Shot size variety (penalize runs of consecutive same shot_size)
  let shotSizeScore = 100;
  for (let i = 0; i < scenes.length - 1; i++) {
    const curr = scenes[i].metadata?.shot_grammar?.shot_size;
    const next = scenes[i + 1].metadata?.shot_grammar?.shot_size;
    if (curr && next && curr === next) {
      // Check for 3+ run
      if (i + 2 < scenes.length && scenes[i + 2].metadata?.shot_grammar?.shot_size === curr) {
        shotSizeScore -= 25;
        findings.push({
          severity: 'warning',
          dimension: 'variety',
          message: `3+ consecutive "${curr}" shot size starting at scene ${i + 1}`,
          scene_index: i,
        });
      } else {
        shotSizeScore -= 10;
      }
    }
  }
  shotSizeScore = Math.max(0, shotSizeScore);

  // Sub-score 2: Content type variety (penalize adjacent same content_type)
  let contentTypeScore = 100;
  for (let i = 0; i < scenes.length - 1; i++) {
    const curr = scenes[i].metadata?.content_type;
    const next = scenes[i + 1].metadata?.content_type;
    if (curr && next && curr === next) {
      contentTypeScore -= 20;
      findings.push({
        severity: 'info',
        dimension: 'variety',
        message: `Adjacent scenes ${i + 1}-${i + 2} share content_type "${curr}"`,
        scene_index: i,
      });
    }
  }
  contentTypeScore = Math.max(0, contentTypeScore);

  // Sub-score 3: Visual weight balance (penalize if one weight dominates >80%)
  let weightScore = 100;
  const weightCounts = {};
  for (const scene of scenes) {
    const w = scene.metadata?.visual_weight;
    if (w) weightCounts[w] = (weightCounts[w] || 0) + 1;
  }
  const totalWeighted = Object.values(weightCounts).reduce((a, b) => a + b, 0);
  if (totalWeighted > 0) {
    for (const [weight, count] of Object.entries(weightCounts)) {
      if (count / totalWeighted > 0.8) {
        weightScore -= 30;
        findings.push({
          severity: 'info',
          dimension: 'variety',
          message: `Visual weight "${weight}" dominates (${Math.round(count / totalWeighted * 100)}% of scenes)`,
        });
      }
    }
  }
  weightScore = Math.max(0, weightScore);

  // Sub-score 4: Motion energy distribution
  let energyScore = 100;
  const energyCounts = {};
  for (const scene of scenes) {
    const e = scene.metadata?.motion_energy;
    if (e) energyCounts[e] = (energyCounts[e] || 0) + 1;
  }
  const uniqueEnergies = Object.keys(energyCounts).length;
  if (uniqueEnergies === 1 && scenes.length >= 3) {
    energyScore -= 40;
    findings.push({
      severity: 'warning',
      dimension: 'variety',
      message: `All scenes have same motion_energy "${Object.keys(energyCounts)[0]}"`,
    });
  }
  if (uniqueEnergies >= 3) {
    energyScore = Math.min(100, energyScore + 10);
  }

  const score = Math.round((shotSizeScore + contentTypeScore + weightScore + energyScore) / 4);
  return { score: Math.max(0, Math.min(100, score)), findings };
}

// ── Flow scorer ──────────────────────────────────────────────────────────────

/**
 * Score flow: energy arc, intent progression, and transition coherence.
 * Three sub-scores:
 *   - Energy arc (40%): peak in middle 30-70% range = good
 *   - Intent progression (30%): opening at start, closing at end, hero in first half
 *   - Transition coherence (30%): transitions match style pack rules
 */
export function scoreFlow(manifestScenes, sceneMap, style) {
  const findings = [];

  if (manifestScenes.length <= 1) {
    return { score: 100, findings };
  }

  const scenes = manifestScenes.map(ms => sceneMap.get(ms.scene)).filter(Boolean);

  // Sub-score 1: Energy arc (40%)
  let energyArcScore = 60; // neutral baseline
  const energyValues = scenes.map(s => ENERGY_NUMERIC[s.metadata?.motion_energy] ?? 1);

  if (energyValues.length >= 3) {
    const maxEnergy = Math.max(...energyValues);
    const peakIndex = energyValues.indexOf(maxEnergy);
    const peakPosition = peakIndex / (energyValues.length - 1);

    // Peak in middle 30-70% = good
    if (peakPosition >= 0.3 && peakPosition <= 0.7) {
      energyArcScore = 100;
    } else if (peakPosition < 0.15) {
      // Peak at very start (unless hero)
      const firstTags = scenes[0].metadata?.intent_tags || [];
      if (firstTags.includes('hero') || firstTags.includes('opening')) {
        energyArcScore = 80; // acceptable
      } else {
        energyArcScore = 40;
        findings.push({
          severity: 'warning',
          dimension: 'flow',
          message: 'Energy peaks at the very start without hero/opening tag',
          scene_index: 0,
        });
      }
    } else {
      energyArcScore = 70; // peak near end, acceptable
    }

    // Flat energy = bad
    const allSame = energyValues.every(v => v === energyValues[0]);
    if (allSame) {
      energyArcScore = 40;
      findings.push({
        severity: 'info',
        dimension: 'flow',
        message: 'Flat energy arc — all scenes have same motion_energy',
      });
    }
  }

  // Sub-score 2: Intent progression (30%)
  let intentScore = 60; // neutral baseline (no tags at all)
  const sceneTags = scenes.map(s => s.metadata?.intent_tags || []);
  const hasAnyTags = sceneTags.some(t => t.length > 0);

  if (hasAnyTags) {
    intentScore = 0;
    const total = scenes.length;
    const quarter = Math.max(1, Math.floor(total * 0.25));
    const half = Math.max(1, Math.floor(total * 0.5));

    // Opening in first 25%?
    const hasOpening = sceneTags.slice(0, quarter).some(t => t.includes('opening'));
    if (hasOpening) {
      intentScore += 33;
    }

    // Check if opening is misplaced (at end)
    const openingAtEnd = sceneTags.slice(-quarter).some(t => t.includes('opening'))
      && !sceneTags.slice(0, quarter).some(t => t.includes('opening'));
    if (openingAtEnd) {
      findings.push({
        severity: 'warning',
        dimension: 'flow',
        message: 'Opening scene placed near the end of sequence',
        scene_index: scenes.length - 1,
      });
    }

    // Closing in last 25%?
    const hasClosing = sceneTags.slice(-quarter).some(t => t.includes('closing'));
    if (hasClosing) {
      intentScore += 33;
    }

    // Hero in first 50%?
    const hasHero = sceneTags.slice(0, half).some(t => t.includes('hero'));
    if (hasHero) {
      intentScore += 34;
    }

    // No relevant tags found at all → neutral
    const hasOpenCloseHero = sceneTags.some(t =>
      t.includes('opening') || t.includes('closing') || t.includes('hero')
    );
    if (!hasOpenCloseHero) {
      intentScore = 60;
    }
  }

  // Sub-score 3: Transition coherence (30%)
  let transitionScore = 100;
  if (manifestScenes.length >= 2) {
    let matching = 0;
    let total = 0;

    for (let i = 1; i < manifestScenes.length; i++) {
      const prev = sceneMap.get(manifestScenes[i - 1].scene);
      const curr = sceneMap.get(manifestScenes[i].scene);
      if (!prev || !curr) continue;

      total++;
      const scenePack = resolveScenePack(curr, style);
      const expected = getExpectedTransition(scenePack.transitions, prev, curr, i);
      const actual = manifestScenes[i].transition_in;

      if (actual && expected && actual.type === expected.type) {
        matching++;
      } else if (!actual && expected.type === 'hard_cut') {
        // No transition_in = hard_cut effectively
        matching++;
      } else {
        findings.push({
          severity: 'info',
          dimension: 'flow',
          message: `Scene ${i + 1} transition "${actual?.type || 'none'}" differs from expected "${expected.type}"`,
          scene_index: i,
        });
      }
    }

    transitionScore = total > 0 ? Math.round((matching / total) * 100) : 100;
  }

  const score = Math.round(energyArcScore * 0.4 + intentScore * 0.3 + transitionScore * 0.3);
  return { score: Math.max(0, Math.min(100, score)), findings };
}

// ── Adherence scorer ─────────────────────────────────────────────────────────

/**
 * Score style adherence: how closely the manifest follows style pack rules.
 * Four equally-weighted sub-scores (25% each):
 *   - Camera override match
 *   - Transition type match
 *   - Shot grammar personality compliance
 *   - Duration match (same metric as pacing, scored as adherence)
 */
export function scoreAdherence(manifestScenes, sceneMap, style) {
  const findings = [];

  if (manifestScenes.length === 0) {
    return { score: 100, findings };
  }

  // Sub-score 1: Camera override match (25%)
  let cameraMatching = 0;
  let cameraTotal = 0;
  for (let i = 0; i < manifestScenes.length; i++) {
    const ms = manifestScenes[i];
    const scene = sceneMap.get(ms.scene);
    if (!scene) continue;

    const pack = resolveScenePack(scene, style);
    const personalitySlug = pack.personality;
    cameraTotal++;
    const expected = getExpectedCamera(pack.camera_overrides, scene, personalitySlug);
    const actual = ms.camera_override;

    if (expected === null && actual == null) {
      cameraMatching++;
    } else if (expected && actual && expected.move === actual.move) {
      cameraMatching++;
    } else {
      findings.push({
        severity: 'warning',
        dimension: 'adherence',
        message: `Scene ${i + 1} camera "${actual?.move || 'none'}" differs from expected "${expected?.move || 'none'}"`,
        scene_index: i,
      });
    }
  }
  const cameraScore = cameraTotal > 0 ? Math.round((cameraMatching / cameraTotal) * 100) : 100;

  // Sub-score 2: Transition type match (25%)
  let transMatching = 0;
  let transTotal = 0;
  for (let i = 1; i < manifestScenes.length; i++) {
    const prev = sceneMap.get(manifestScenes[i - 1].scene);
    const curr = sceneMap.get(manifestScenes[i].scene);
    if (!prev || !curr) continue;

    const pack = resolveScenePack(curr, style);
    transTotal++;
    const expected = getExpectedTransition(pack.transitions, prev, curr, i);
    const actual = manifestScenes[i].transition_in;

    if (actual && expected && actual.type === expected.type) {
      transMatching++;
    } else if (!actual && expected.type === 'hard_cut') {
      transMatching++;
    } else {
      findings.push({
        severity: 'warning',
        dimension: 'adherence',
        message: `Scene ${i + 1} transition "${actual?.type || 'none'}" differs from expected "${expected.type}"`,
        scene_index: i,
      });
    }
  }
  const transScore = transTotal > 0 ? Math.round((transMatching / transTotal) * 100) : 100;

  // Sub-score 3: Shot grammar personality compliance (25%)
  let grammarCompliant = 0;
  let grammarTotal = 0;
  for (let i = 0; i < manifestScenes.length; i++) {
    const ms = manifestScenes[i];
    const scene = sceneMap.get(ms.scene);
    const sg = ms.shot_grammar;
    const pack = resolveScenePack(scene, style);
    const personalitySlug = pack.personality;
    const restrictions = shotGrammarCatalog.personality_restrictions[personalitySlug];
    if (!sg || !restrictions) {
      // No grammar to check — skip
      continue;
    }

    grammarTotal++;
    let valid = true;

    if (sg.shot_size && !restrictions.allowed_sizes.includes(sg.shot_size)) {
      valid = false;
      findings.push({
        severity: 'warning',
        dimension: 'adherence',
        message: `Scene ${i + 1} shot_size "${sg.shot_size}" not allowed for ${personalitySlug}`,
        scene_index: i,
      });
    }
    if (sg.angle && !restrictions.allowed_angles.includes(sg.angle)) {
      valid = false;
      findings.push({
        severity: 'warning',
        dimension: 'adherence',
        message: `Scene ${i + 1} angle "${sg.angle}" not allowed for ${personalitySlug}`,
        scene_index: i,
      });
    }
    if (sg.framing && !restrictions.allowed_framings.includes(sg.framing)) {
      valid = false;
      findings.push({
        severity: 'warning',
        dimension: 'adherence',
        message: `Scene ${i + 1} framing "${sg.framing}" not allowed for ${personalitySlug}`,
        scene_index: i,
      });
    }

    if (valid) grammarCompliant++;
  }
  const grammarScore = grammarTotal > 0 ? Math.round((grammarCompliant / grammarTotal) * 100) : 100;

  // Sub-score 4: Duration match (25%)
  let durationDeviation = 0;
  for (let i = 0; i < manifestScenes.length; i++) {
    const ms = manifestScenes[i];
    const scene = sceneMap.get(ms.scene);
    if (!scene) continue;

    const pack = resolveScenePack(scene, style);
    const energy = scene.metadata?.motion_energy || 'moderate';
    const expected = getExpectedDuration(energy, pack);
    durationDeviation += Math.abs(ms.duration_s - expected);
  }
  // 0 deviation = 100, 1s average deviation = ~67, 3s = 0
  const avgDeviation = manifestScenes.length > 0 ? durationDeviation / manifestScenes.length : 0;
  const durationScore = Math.round(Math.max(0, 100 - (avgDeviation / 3) * 100));

  const score = Math.round((cameraScore + transScore + grammarScore + durationScore) / 4);
  return { score: Math.max(0, Math.min(100, score)), findings };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Evaluate a planned sequence manifest.
 *
 * @param {{ manifest: object, scenes: object[], style: string }} params
 *   - manifest: Sequence manifest from planSequence (with .scenes array)
 *   - scenes: Analyzed scene objects with metadata
 *   - style: Style pack name ('prestige', 'energy', 'dramatic')
 * @returns {{ score: number, dimensions: object, findings: object[] }}
 */
export function evaluateSequence({ manifest, scenes, style }) {
  if (!manifest || !manifest.scenes) {
    throw new Error('evaluateSequence requires a manifest with a scenes array');
  }
  if (!scenes || !Array.isArray(scenes)) {
    throw new Error('evaluateSequence requires a scenes array');
  }
  if (!style) {
    throw new Error('evaluateSequence requires a style');
  }

  // Build scene lookup map: scene_id → scene object
  const sceneMap = new Map();
  for (const scene of scenes) {
    const id = scene.scene_id || scene.id;
    if (id) sceneMap.set(id, scene);
  }

  const manifestScenes = manifest.scenes;

  const pacing = scorePacing(manifestScenes, sceneMap, style);
  const variety = scoreVariety(manifestScenes, sceneMap);
  const flow = scoreFlow(manifestScenes, sceneMap, style);
  const adherence = scoreAdherence(manifestScenes, sceneMap, style);

  const overall = Math.round(
    pacing.score * DIMENSION_WEIGHTS.pacing +
    variety.score * DIMENSION_WEIGHTS.variety +
    flow.score * DIMENSION_WEIGHTS.flow +
    adherence.score * DIMENSION_WEIGHTS.adherence
  );

  // Merge all findings
  const allFindings = [
    ...pacing.findings,
    ...variety.findings,
    ...flow.findings,
    ...adherence.findings,
  ];

  return {
    score: overall,
    dimensions: {
      pacing: { score: pacing.score, findings: pacing.findings },
      variety: { score: variety.score, findings: variety.findings },
      flow: { score: flow.score, findings: flow.findings },
      adherence: { score: adherence.score, findings: adherence.findings },
    },
    findings: allFindings,
  };
}
