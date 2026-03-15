/**
 * Sequence Planner — ANI-23 / ANI-24
 *
 * Pure planning functions that consume scene analysis metadata and produce
 * a sequence manifest. Decides shot order, hold durations, transitions,
 * and camera overrides based on style pack rules.
 *
 * Rule-based v1 — deterministic, testable, no LLM calls.
 * ANI-24: Style pack definitions loaded from catalog/style-packs.json.
 * Camera overrides validated against personality catalog.
 */

import { validateManifest } from '../../src/remotion/lib.js';
import { loadStylePacks, loadPersonalitiesCatalog, loadShotGrammar } from '../data/loader.js';
import { validateShotGrammar } from './shot-grammar.js';
import { syncToBeats, matchEnergyToScenes } from './beats.js';

// ── Load catalog data at module level ────────────────────────────────────────

const personalitiesCatalog = loadPersonalitiesCatalog();
const stylePacksCatalog = loadStylePacks(
  personalitiesCatalog.array.map(p => p.slug)
);
const shotGrammarCatalog = loadShotGrammar();

// ── Derived constants (backward-compatible exports) ──────────────────────────

export const STYLE_PACKS = stylePacksCatalog.array.map(p => p.name);

export const STYLE_TO_PERSONALITY = Object.fromEntries(
  stylePacksCatalog.array.map(p => [p.name, p.personality])
);

/**
 * Intent tag priority for bucketing (highest first).
 */
const INTENT_PRIORITY = [
  'closing', 'opening', 'hero', 'emotional',
  'detail', 'informational', 'transition',
];

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
 * If the scene has metadata.style_override, use that pack instead.
 * Falls back to the sequence-level default style.
 */
function resolveScenePack(scene, defaultStyle) {
  const override = scene.metadata?.style_override;
  if (override) {
    const pack = stylePacksCatalog.byName.get(override);
    if (!pack) throw new Error(`Unknown style_override "${override}". Valid: ${STYLE_PACKS.join(', ')}`);
    return pack;
  }
  return getStylePack(defaultStyle);
}

/**
 * Normalize snake_case camera move to kebab-case for personality lookup.
 * e.g., "push_in" → "push-in"
 */
function toKebab(move) {
  return move.replace(/_/g, '-');
}

/**
 * Validate a camera move against the personality's allowed_movements.
 * Returns the override as-is if valid, or null if the move isn't allowed.
 * Skips validation for 'static' (no-op) and 'drift' (ambient motion, not a
 * camera rig movement — all personalities support it via ambient_motion config).
 */
function validateCameraMove(override, personalitySlug) {
  if (!override || !override.move || override.move === 'static' || override.move === 'drift') return override;

  const personality = personalitiesCatalog.bySlug.get(personalitySlug);
  if (!personality) return override;

  const allowed = personality.camera_behavior?.allowed_movements || [];
  if (allowed.length === 0) return override;

  const kebab = toKebab(override.move);
  if (allowed.includes(kebab)) return override;

  // Move not allowed by personality — downgrade to null
  return null;
}

// ── Shot order ──────────────────────────────────────────────────────────────

/**
 * Get the highest-priority intent tag from a scene's metadata.
 * Returns the tag string or null if none match.
 */
function getHighestIntent(scene) {
  const tags = scene.metadata?.intent_tags || [];
  if (tags.length === 0) return null;

  for (const intent of INTENT_PRIORITY) {
    if (tags.includes(intent)) return intent;
  }
  return null;
}

/**
 * Order scenes using intent-bucket approach with variety post-processing.
 *
 * Step 1: Bucket by highest-priority intent tag.
 * Step 2: Assemble — opening → hero → middle (interleaved) → closing.
 * Step 3: Post-process for variety (content_type, visual_weight, energy arc).
 *
 * @param {object[]} scenes — Array of scene objects with metadata.
 * @returns {object[]} — Ordered copy of scenes.
 */
export function orderScenes(scenes) {
  if (!scenes) return [];
  if (scenes.length <= 1) return [...scenes];

  // Step 1: Bucket by highest-priority intent tag
  const buckets = {
    opening: [],
    hero: [],
    emotional: [],
    detail: [],
    informational: [],
    transition: [],
    closing: [],
    untagged: [],
  };

  for (const scene of scenes) {
    const intent = getHighestIntent(scene);
    if (intent && buckets[intent]) {
      buckets[intent].push(scene);
    } else {
      buckets.untagged.push(scene);
    }
  }

  // Sort within buckets by confidence (descending) for deterministic ordering
  const sortByConfidence = (arr) => {
    arr.sort((a, b) => (b.metadata?._confidence?.intent_tags ?? 0) - (a.metadata?._confidence?.intent_tags ?? 0));
  };
  for (const bucket of Object.values(buckets)) {
    sortByConfidence(bucket);
  }

  // Step 2: Assemble sequence
  const result = [];

  // Positions 1–2: opening → hero
  result.push(...buckets.opening);
  result.push(...buckets.hero);

  // Middle: interleave detail, informational, transition, untagged
  // Distribute emotional scenes at even intervals
  const middlePool = [
    ...buckets.detail,
    ...buckets.informational,
    ...buckets.transition,
    ...buckets.untagged,
  ];
  const emotionalPool = [...buckets.emotional];

  if (emotionalPool.length > 0 && middlePool.length > 0) {
    // Calculate even distribution interval for emotional scenes
    const interval = Math.max(1, Math.floor(middlePool.length / (emotionalPool.length + 1)));
    let emotionalIdx = 0;
    const interleaved = [];

    for (let i = 0; i < middlePool.length; i++) {
      interleaved.push(middlePool[i]);
      if (emotionalIdx < emotionalPool.length && (i + 1) % interval === 0) {
        interleaved.push(emotionalPool[emotionalIdx]);
        emotionalIdx++;
      }
    }
    // Append remaining emotional scenes
    while (emotionalIdx < emotionalPool.length) {
      interleaved.push(emotionalPool[emotionalIdx]);
      emotionalIdx++;
    }
    result.push(...interleaved);
  } else {
    result.push(...middlePool);
    result.push(...emotionalPool);
  }

  // Last positions: closing
  result.push(...buckets.closing);

  // Step 3: Post-processing rules (in-place swaps)
  applyVarietyRules(result);

  return result;
}

/**
 * Apply variety post-processing rules to the ordered sequence.
 * Mutates the array in-place.
 */
function applyVarietyRules(scenes) {
  if (scenes.length <= 2) return;

  // Rule 1: No consecutive same content_type — swap with next different type
  for (let i = 0; i < scenes.length - 1; i++) {
    const currType = scenes[i].metadata?.content_type;
    const nextType = scenes[i + 1].metadata?.content_type;

    if (currType && currType === nextType) {
      // Look ahead up to 3 positions for a different type
      for (let j = i + 2; j < Math.min(i + 5, scenes.length); j++) {
        if (scenes[j].metadata?.content_type !== currType) {
          // Swap
          [scenes[i + 1], scenes[j]] = [scenes[j], scenes[i + 1]];
          break;
        }
      }
    }
  }

  // Rule 2: No 3+ consecutive same visual_weight — swap to break run
  for (let i = 0; i < scenes.length - 2; i++) {
    const w0 = scenes[i].metadata?.visual_weight;
    const w1 = scenes[i + 1].metadata?.visual_weight;
    const w2 = scenes[i + 2].metadata?.visual_weight;

    if (w0 && w0 === w1 && w1 === w2) {
      // Look ahead for different weight
      for (let j = i + 3; j < Math.min(i + 6, scenes.length); j++) {
        if (scenes[j].metadata?.visual_weight !== w0) {
          [scenes[i + 2], scenes[j]] = [scenes[j], scenes[i + 2]];
          break;
        }
      }
    }
  }

  // Rule 4: No 3+ consecutive same shot_size — swap to break run (ANI-26)
  const maxConsecutive = shotGrammarCatalog.variety_rules.max_consecutive_same_size;
  for (let i = 0; i < scenes.length - maxConsecutive; i++) {
    const sizes = [];
    let allSame = true;
    for (let k = 0; k <= maxConsecutive; k++) {
      sizes.push(scenes[i + k].metadata?.shot_grammar?.shot_size);
    }
    for (let k = 1; k < sizes.length; k++) {
      if (sizes[k] !== sizes[0]) { allSame = false; break; }
    }

    if (sizes[0] && allSame) {
      for (let j = i + maxConsecutive + 1; j < Math.min(i + maxConsecutive + 4, scenes.length); j++) {
        if (scenes[j].metadata?.shot_grammar?.shot_size !== sizes[0]) {
          [scenes[i + maxConsecutive], scenes[j]] = [scenes[j], scenes[i + maxConsecutive]];
          break;
        }
      }
    }
  }

  // Rule 3: Energy arc — don't start at peak energy unless tagged hero
  if (scenes.length >= 2) {
    const firstEnergy = scenes[0].metadata?.motion_energy;
    const firstIntent = getHighestIntent(scenes[0]);

    if (firstEnergy === 'high' && firstIntent !== 'hero' && firstIntent !== 'opening') {
      // Find first moderate/subtle scene to swap with
      for (let j = 1; j < Math.min(4, scenes.length); j++) {
        const e = scenes[j].metadata?.motion_energy;
        if (e === 'moderate' || e === 'subtle' || e === 'static') {
          [scenes[0], scenes[j]] = [scenes[j], scenes[0]];
          break;
        }
      }
    }
  }
}

// ── Durations ───────────────────────────────────────────────────────────────

/**
 * Assign hold durations to ordered scenes based on style pack rules.
 *
 * @param {object[]} orderedScenes — Scenes with metadata.
 * @param {string} style — Style pack name.
 * @returns {number[]} — Array of duration_s values.
 */
export function assignDurations(orderedScenes, style) {
  const durations = orderedScenes.map(scene => {
    const pack = resolveScenePack(scene, style);
    const table = pack.hold_durations;
    const energy = scene.metadata?.motion_energy || 'moderate';
    let duration = table[energy] ?? table.moderate;

    if (pack.max_hold_duration != null) {
      duration = Math.min(duration, pack.max_hold_duration);
    }

    return duration;
  });

  // Rest beat insertion: for contrast-profile styles (energy/kinetic),
  // after 3+ consecutive short holds (all same base duration), extend
  // one duration by 1.5x to create a breathing point.
  const contrastStyles = ['energy', 'kinetic'];
  if (contrastStyles.includes(style) && durations.length >= 4) {
    // Only trigger when there are runs of identical short durations
    const minDuration = Math.min(...durations);
    let consecutiveSame = 0;

    for (let i = 0; i < durations.length; i++) {
      if (durations[i] === minDuration) {
        consecutiveSame++;
        if (consecutiveSame >= 3) {
          // Insert rest beat at this position
          durations[i] = Math.round(durations[i] * 1.5 * 10) / 10;
          consecutiveSame = 0;
        }
      } else {
        consecutiveSame = 0;
      }
    }
  }

  return durations;
}

// ── Transitions ─────────────────────────────────────────────────────────────

/**
 * Select transitions for each scene based on style pack rules.
 * First scene always gets null (no transition_in per spec).
 *
 * @param {object[]} orderedScenes — Scenes with metadata.
 * @param {string} style — Style pack name.
 * @returns {(object|null)[]} — Array of transition_in objects (or null for first).
 */
export function selectTransitions(orderedScenes, style) {
  const transitions = [null]; // First scene: no transition

  for (let i = 1; i < orderedScenes.length; i++) {
    const pack = resolveScenePack(orderedScenes[i], style);
    const prevScene = orderedScenes[i - 1];
    const currScene = orderedScenes[i];
    transitions.push(interpretTransitionRules(pack.transitions, prevScene, currScene, i));
  }

  return transitions;
}

/**
 * Interpret transition rules from a style pack definition.
 * Evaluates rules in priority order:
 *   1. pattern — positional (e.g., every-3rd whip-wipe)
 *   2. on_same_weight — consecutive same visual_weight
 *   3. on_weight_change — visual_weight differs
 *   4. on_intent — intent tag match on incoming scene
 *   5. default — fallback
 */
function interpretTransitionRules(rules, prevScene, currScene, sceneIndex) {
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

// ── Camera overrides ────────────────────────────────────────────────────────

/**
 * Assign camera overrides based on style pack rules.
 *
 * @param {object[]} orderedScenes — Scenes with metadata.
 * @param {string} style — Style pack name.
 * @returns {(object|null)[]} — Array of camera_override objects (or null for no override).
 */
export function assignCameraOverrides(orderedScenes, style) {
  return orderedScenes.map(scene => {
    const pack = resolveScenePack(scene, style);
    const override = interpretCameraRules(pack.camera_overrides, scene);
    return validateCameraMove(override, pack.personality);
  });
}

/**
 * Interpret camera override rules from a style pack definition.
 * Evaluates rules in priority order:
 *   1. force_static — all scenes get { move: 'static' }
 *   2. by_content_type — content_type → camera move
 *   3. by_intent — intent tag → camera move
 */
function interpretCameraRules(rules, scene) {
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

// ── Shot grammar pre-filter (ANI-34) ────────────────────────────────────────

/**
 * Pre-filter shot grammar values by personality restrictions.
 * Replaces incompatible values with allowed alternatives before they enter
 * the manifest, and collects correction notes for editorial transparency.
 *
 * @param {object[]} orderedScenes — Scenes with metadata (may include shot_grammar).
 * @param {string} style — Style pack name.
 * @returns {{ filtered: (object|null)[], corrections: string[] }}
 */
export function preFilterShotGrammar(orderedScenes, style) {
  const corrections = [];
  const filtered = orderedScenes.map((scene, i) => {
    const rawGrammar = scene.metadata?.shot_grammar;
    if (!rawGrammar) return null;

    const scenePack = resolveScenePack(scene, style);
    const validation = validateShotGrammar(rawGrammar, scenePack.personality);

    if (!validation.valid) {
      const sceneId = scene.scene_id || scene.id || `scene_${i}`;
      for (const c of validation.corrections) {
        corrections.push(`${sceneId}: ${c}`);
      }
    }

    return validation.result;
  });

  return { filtered, corrections };
}

// ── Top-level orchestrator ──────────────────────────────────────────────────

/**
 * Plan a sequence from analyzed scenes and a style pack.
 *
 * Orchestrates 4 planning stages:
 * 1. Shot order
 * 2. Hold durations
 * 3. Transitions
 * 4. Camera overrides
 *
 * Returns a manifest conforming to the sequence-manifest spec, plus editorial notes.
 *
 * @param {{ scenes: object[], style: string, sequence_id?: string, audio?: object, beats?: object }} params
 * @param {object} [params.beats] — beat analysis from analyzeBeats(). If provided, snaps transitions to beats.
 * @returns {{ manifest: object, notes: object }}
 */
export function planSequence({ scenes, style, sequence_id, audio, beats }) {
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('planSequence requires a non-empty scenes array');
  }
  if (!STYLE_PACKS.includes(style)) {
    throw new Error(`Unknown style "${style}". Valid: ${STYLE_PACKS.join(', ')}`);
  }

  // Stage 1: Order
  const ordered = orderScenes(scenes);

  // Stage 2: Durations
  let durations = assignDurations(ordered, style);

  // Stage 2b: Beat sync — snap durations to beat boundaries (ANI-37)
  let beatSyncNotes = null;
  if (beats && beats.beats && beats.beats.length > 0) {
    const { synced, adjustments } = syncToBeats(durations, beats.beats);
    durations = synced;
    if (adjustments.length > 0) {
      beatSyncNotes = {
        adjustments_count: adjustments.length,
        adjustments,
        bpm: beats.bpm || null,
      };
    }
  }

  // Stage 2c: Energy matching — adjust camera intensity to audio energy (ANI-37)
  let energyIntensities = null;
  if (beats && beats.energy && beats.energy.length > 0) {
    const hopSize = beats.hopSize || 512;
    const sampleRate = beats.sampleRate || 44100;
    energyIntensities = matchEnergyToScenes(durations, beats.energy, sampleRate, hopSize);
  }

  // Stage 3: Transitions
  const transitions = selectTransitions(ordered, style);

  // Stage 4: Camera overrides
  const cameraOverrides = assignCameraOverrides(ordered, style);

  // Stage 5: Pre-filter shot grammar by personality (ANI-34)
  const { filtered: shotGrammars, corrections: shotGrammarCorrections } =
    preFilterShotGrammar(ordered, style);

  // Assemble manifest
  const seqId = sequence_id || `seq_planned_${Date.now()}`;
  const overridesUsed = new Set();
  const sceneReasoning = [];

  const manifestScenes = ordered.map((scene, i) => {
    const entry = {
      scene: scene.scene_id || scene.id || `scene_${i}`,
      duration_s: durations[i],
    };

    if (transitions[i]) {
      entry.transition_in = transitions[i];
    }

    if (cameraOverrides[i]) {
      const cam = { ...cameraOverrides[i] };
      // ANI-37: Blend energy-matched intensity with style pack intensity
      if (energyIntensities && energyIntensities[i] != null) {
        const styleIntensity = cam.intensity ?? 0.3;
        cam.intensity = parseFloat(((styleIntensity + energyIntensities[i]) / 2).toFixed(2));
      }
      entry.camera_override = cam;
    }

    // ANI-26/ANI-34: Add pre-filtered shot grammar
    if (shotGrammars[i]) {
      entry.shot_grammar = shotGrammars[i];
    }

    // Track style overrides
    if (scene.metadata?.style_override) {
      overridesUsed.add(scene.metadata.style_override);
    }

    // Build per-scene reasoning (ANI-45)
    sceneReasoning.push(buildSceneReasoning(scene, i, style, durations[i], transitions[i], cameraOverrides[i], shotGrammars[i], shotGrammarCorrections));

    return entry;
  });

  // Build direction block (v2 sequence-level art direction)
  const direction = buildDirectionBlock(ordered, cameraOverrides, durations, style);

  const manifest = {
    sequence_id: seqId,
    resolution: { w: 1920, h: 1080 },
    fps: 60,
    style,
    scenes: manifestScenes,
    ...(audio ? { audio } : {}),
    ...(direction ? { direction } : {}),
  };

  // Self-validate
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Generated manifest failed validation: ${validation.errors.join('; ')}`);
  }

  // Calculate editorial notes
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const transitionOverlap = transitions.reduce((sum, t) => {
    if (t && t.type !== 'hard_cut' && t.duration_ms) {
      return sum + t.duration_ms / 1000;
    }
    return sum;
  }, 0);

  // Transition summary
  const transitionCounts = {};
  for (const t of transitions) {
    if (!t) continue;
    const key = t.type;
    transitionCounts[key] = (transitionCounts[key] || 0) + 1;
  }

  const notes = {
    total_duration_s: parseFloat((totalDuration - transitionOverlap).toFixed(1)),
    scene_count: ordered.length,
    style_personality: STYLE_TO_PERSONALITY[style],
    ordering_rationale: buildOrderingRationale(ordered),
    transition_summary: transitionCounts,
    reasoning: sceneReasoning,
    ...(overridesUsed.size > 0 ? { style_overrides_used: [...overridesUsed] } : {}),
    ...(shotGrammarCorrections.length > 0 ? { shot_grammar_corrections: shotGrammarCorrections } : {}),
    ...(beatSyncNotes ? { beat_sync: beatSyncNotes } : {}),
  };

  return { manifest, notes };
}

/**
 * Build a v2 direction block for sequence-level art direction.
 *
 * Generates energy_arc (intensity curve across scenes),
 * camera_arc (camera progression), and identifies peak scene.
 */
function buildDirectionBlock(scenes, cameraOverrides, durations, style) {
  if (!scenes || scenes.length < 2) return null;

  const n = scenes.length;

  // Energy arc: derive intensity curve from scene metadata
  const intensityCurve = scenes.map((scene, i) => {
    const energy = scene.metadata?.motion_energy || 'moderate';
    const energyMap = { static: 0.2, subtle: 0.4, moderate: 0.6, high: 0.9 };
    return parseFloat((energyMap[energy] || 0.5).toFixed(1));
  });

  // Find peak scene
  let peakScene = 0;
  let peakValue = 0;
  for (let i = 0; i < intensityCurve.length; i++) {
    if (intensityCurve[i] > peakValue) {
      peakValue = intensityCurve[i];
      peakScene = i;
    }
  }

  // Determine arc shape
  let shape = 'flat';
  if (peakScene <= 1) shape = 'front_loaded';
  else if (peakScene >= n - 2) shape = 'back_loaded';
  else shape = 'build_peak_resolve';

  // Camera arc: progression of camera moves
  const cameraProgression = cameraOverrides.map(cam => cam?.move || 'static');

  return {
    energy_arc: {
      shape,
      peak_scene: peakScene,
      intensity_curve: intensityCurve,
    },
    camera_arc: {
      progression: cameraProgression,
      intensity_follows_energy: true,
    },
  };
}

/**
 * Build per-scene reasoning explaining each planning decision.
 * Traces: intent → style pack → duration/transition/camera rules applied.
 */
function buildSceneReasoning(scene, index, style, duration, transition, cameraOverride, shotGrammar, sgCorrections) {
  const pack = resolveScenePack(scene, style);
  const packName = scene.metadata?.style_override || style;
  const energy = scene.metadata?.motion_energy || 'moderate';
  const sceneId = scene.scene_id || scene.id || `scene_${index}`;
  const reasoning = { scene: sceneId };

  // Duration reasoning
  const baseDuration = pack.hold_durations[energy] ?? pack.hold_durations.moderate;
  let durationExplanation = `${duration}s: ${packName}.hold_durations.${energy} (${baseDuration}s)`;
  if (pack.max_hold_duration != null && baseDuration > pack.max_hold_duration) {
    durationExplanation += ` → clamped to max ${pack.max_hold_duration}s`;
  }
  if (duration !== baseDuration && duration !== pack.max_hold_duration) {
    durationExplanation += ` → adjusted to ${duration}s (rest beat)`;
  }
  reasoning.duration = durationExplanation;

  // Transition reasoning
  if (index === 0) {
    reasoning.transition = 'none: first scene (no transition_in per spec)';
  } else if (transition) {
    const rule = identifyTransitionRule(pack.transitions, transition, index);
    reasoning.transition = `${transition.type}${transition.duration_ms ? ` ${transition.duration_ms}ms` : ''}: ${rule}`;
  } else {
    reasoning.transition = 'none';
  }

  // Camera reasoning
  if (cameraOverride) {
    const contentType = scene.metadata?.content_type;
    const intentTags = scene.metadata?.intent_tags || [];
    if (pack.camera_overrides.force_static) {
      reasoning.camera = `static: ${packName} enforces force_static`;
    } else if (pack.camera_overrides.by_content_type?.[contentType]) {
      reasoning.camera = `${cameraOverride.move} ${cameraOverride.intensity}: by_content_type.${contentType} → validated against ${pack.personality}`;
    } else {
      const matchedIntent = intentTags.find(t => pack.camera_overrides.by_intent?.[t]);
      if (matchedIntent) {
        reasoning.camera = `${cameraOverride.move} ${cameraOverride.intensity}: by_intent.${matchedIntent} → validated against ${pack.personality}`;
      } else {
        reasoning.camera = `${cameraOverride.move} ${cameraOverride.intensity ?? ''}: style pack rule`;
      }
    }
  } else {
    reasoning.camera = 'none: no matching camera rule (scene uses default)';
  }

  // Shot grammar reasoning
  if (shotGrammar) {
    const parts = [];
    if (shotGrammar.shot_size) parts.push(shotGrammar.shot_size);
    if (shotGrammar.angle) parts.push(shotGrammar.angle);
    const corrected = sgCorrections.filter(c => c.startsWith(sceneId));
    reasoning.shot_grammar = parts.join(', ') + (corrected.length > 0 ? ` (corrected: ${corrected.join('; ')})` : '');
  }

  return reasoning;
}

/**
 * Identify which transition rule matched for reasoning output.
 */
function identifyTransitionRule(rules, transition, sceneIndex) {
  if (rules.pattern && sceneIndex % rules.pattern.every_n === 0) {
    return `pattern: every ${rules.pattern.every_n} scenes`;
  }
  if (rules.on_same_weight && transition.type === rules.on_same_weight.type) {
    return 'on_same_weight: consecutive same visual weight';
  }
  if (rules.on_weight_change && transition.type === rules.on_weight_change.type &&
      transition.duration_ms === rules.on_weight_change.duration_ms) {
    return 'on_weight_change: visual weight shift detected';
  }
  if (rules.on_intent) {
    const intentTransition = rules.on_intent.transition;
    if (transition.type === intentTransition.type && transition.duration_ms === intentTransition.duration_ms) {
      return `on_intent: matched tag [${rules.on_intent.tags.join(', ')}]`;
    }
  }
  return 'default: fallback transition rule';
}

/**
 * Build a human-readable ordering rationale.
 */
function buildOrderingRationale(ordered) {
  const parts = [];
  if (ordered.length === 0) return 'Empty sequence';

  const firstIntent = getHighestIntent(ordered[0]);
  if (firstIntent) {
    parts.push(`Opens with ${firstIntent} scene`);
  }

  const lastIntent = getHighestIntent(ordered[ordered.length - 1]);
  if (lastIntent && ordered.length > 1) {
    parts.push(`closes with ${lastIntent} scene`);
  }

  const types = new Set(ordered.map(s => s.metadata?.content_type).filter(Boolean));
  parts.push(`${types.size} content type(s) across ${ordered.length} scenes`);

  return parts.join('; ');
}

// ── Variant planning (ANI-44) ────────────────────────────────────────────────

/**
 * Plan multiple sequence variants from the same scenes with different styles.
 *
 * Each style produces an independent manifest via planSequence(). Variants
 * share the same scene content and ordering but differ in timing, transitions,
 * and camera choreography.
 *
 * @param {{ scenes: object[], styles: string[], sequence_id?: string, audio?: object, beats?: object }} params
 * @returns {{ variants: Array<{ variant_id: string, style: string, manifest: object, notes: object }> }}
 */
export function planVariants({ scenes, styles, sequence_id, audio, beats }) {
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('planVariants requires a non-empty scenes array');
  }
  if (!styles || !Array.isArray(styles) || styles.length < 2) {
    throw new Error('planVariants requires at least 2 styles to compare');
  }

  const variants = styles.map((style, i) => {
    const seqId = sequence_id
      ? `${sequence_id}_v${i + 1}_${style}`
      : `seq_variant_${style}_${Date.now()}`;

    const { manifest, notes } = planSequence({
      scenes,
      style,
      sequence_id: seqId,
      audio,
      beats,
    });

    return {
      variant_id: `v${i + 1}_${style}`,
      style,
      manifest,
      notes,
    };
  });

  return { variants };
}
