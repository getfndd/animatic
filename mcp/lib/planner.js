/**
 * Sequence Planner — ANI-23
 *
 * Pure planning functions that consume scene analysis metadata and produce
 * a sequence manifest. Decides shot order, hold durations, transitions,
 * and camera overrides based on style pack rules.
 *
 * Rule-based v1 — deterministic, testable, no LLM calls.
 * Style pack definitions are inlined (ANI-24 handles full personality integration).
 */

import { validateManifest } from '../../src/remotion/lib.js';

// ── Style pack constants ────────────────────────────────────────────────────

export const STYLE_PACKS = ['prestige', 'energy', 'dramatic'];

export const STYLE_TO_PERSONALITY = {
  prestige: 'editorial',
  energy: 'montage',
  dramatic: 'cinematic-dark',
};

/**
 * Duration lookup tables: motion_energy × style → seconds.
 */
const DURATION_TABLE = {
  prestige: { static: 3.5, subtle: 3.0, moderate: 3.0, high: 2.5 },
  energy:   { static: 2.0, subtle: 2.0, moderate: 1.5, high: 1.5 },
  dramatic: { static: 3.0, subtle: 2.5, moderate: 3.0, high: 3.5 },
};

const ENERGY_MAX_DURATION = 4.0;

/**
 * Whip-wipe cycle for energy style.
 */
const WHIP_DIRECTIONS = ['whip_left', 'whip_right', 'whip_up', 'whip_down'];

/**
 * Intent tag priority for bucketing (highest first).
 */
const INTENT_PRIORITY = [
  'closing', 'opening', 'hero', 'emotional',
  'detail', 'informational', 'transition',
];

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
  const table = DURATION_TABLE[style];
  if (!table) throw new Error(`Unknown style: ${style}`);

  return orderedScenes.map(scene => {
    const energy = scene.metadata?.motion_energy || 'moderate';
    let duration = table[energy] ?? table.moderate;

    // Energy style enforces a hard cap
    if (style === 'energy') {
      duration = Math.min(duration, ENERGY_MAX_DURATION);
    }

    return duration;
  });
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
    const prevScene = orderedScenes[i - 1];
    const currScene = orderedScenes[i];

    switch (style) {
      case 'prestige':
        transitions.push(selectPrestigeTransition(prevScene, currScene));
        break;
      case 'energy':
        transitions.push(selectEnergyTransition(i));
        break;
      case 'dramatic':
        transitions.push(selectDramaticTransition(prevScene, currScene));
        break;
      default:
        transitions.push({ type: 'hard_cut' });
    }
  }

  return transitions;
}

/**
 * Prestige: Hard cut default. Crossfade when weight changes or incoming is emotional/hero.
 */
function selectPrestigeTransition(prevScene, currScene) {
  const prevWeight = prevScene.metadata?.visual_weight;
  const currWeight = currScene.metadata?.visual_weight;
  const currTags = currScene.metadata?.intent_tags || [];

  const weightChanged = prevWeight && currWeight && prevWeight !== currWeight;
  const isEmotionalOrHero = currTags.includes('emotional') || currTags.includes('hero');

  if (weightChanged || isEmotionalOrHero) {
    return { type: 'crossfade', duration_ms: 400 };
  }
  return { type: 'hard_cut' };
}

/**
 * Energy: Deterministic mix — every 3rd transition is a whip-wipe, rest are hard cuts.
 * Cycles through whip_left/right/up/down.
 */
function selectEnergyTransition(sceneIndex) {
  // sceneIndex is 1-based (first transition is at index 1)
  if (sceneIndex % 3 === 0) {
    const whipIdx = Math.floor(sceneIndex / 3) - 1;
    const direction = WHIP_DIRECTIONS[whipIdx % WHIP_DIRECTIONS.length];
    return { type: direction, duration_ms: 250 };
  }
  return { type: 'hard_cut' };
}

/**
 * Dramatic: Crossfade default. Hard cut between consecutive same-weight.
 * 600ms crossfade for emotional intent.
 */
function selectDramaticTransition(prevScene, currScene) {
  const prevWeight = prevScene.metadata?.visual_weight;
  const currWeight = currScene.metadata?.visual_weight;
  const currTags = currScene.metadata?.intent_tags || [];

  // Hard cut between consecutive same-weight scenes
  if (prevWeight && currWeight && prevWeight === currWeight) {
    return { type: 'hard_cut' };
  }

  // 600ms crossfade for emotional intent
  if (currTags.includes('emotional')) {
    return { type: 'crossfade', duration_ms: 600 };
  }

  // Default crossfade
  return { type: 'crossfade', duration_ms: 400 };
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
    switch (style) {
      case 'prestige':
        return selectPrestigeCameraOverride(scene);
      case 'energy':
        // Montage forbids camera movement — explicitly set static
        return { move: 'static' };
      case 'dramatic':
        return selectDramaticCameraOverride(scene);
      default:
        return null;
    }
  });
}

/**
 * Prestige camera: push_in for visual content, drift for UI, nothing for type.
 */
function selectPrestigeCameraOverride(scene) {
  const contentType = scene.metadata?.content_type;

  switch (contentType) {
    case 'portrait':
    case 'product_shot':
      return { move: 'push_in', intensity: 0.2 };
    case 'ui_screenshot':
    case 'device_mockup':
    case 'data_visualization':
      return { move: 'drift', intensity: 0.2 };
    case 'typography':
    case 'brand_mark':
    default:
      return null;
  }
}

/**
 * Dramatic camera: push_in for emotional/hero, drift for detail.
 */
function selectDramaticCameraOverride(scene) {
  const tags = scene.metadata?.intent_tags || [];
  const contentType = scene.metadata?.content_type;

  if (tags.includes('emotional') || tags.includes('hero')) {
    return { move: 'push_in', intensity: 0.3 };
  }
  if (tags.includes('detail')) {
    return { move: 'drift', intensity: 0.3 };
  }
  if (contentType === 'brand_mark' || contentType === 'typography') {
    return null;
  }
  return null;
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
 * @param {{ scenes: object[], style: string, sequence_id?: string }} params
 * @returns {{ manifest: object, notes: object }}
 */
export function planSequence({ scenes, style, sequence_id }) {
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('planSequence requires a non-empty scenes array');
  }
  if (!STYLE_PACKS.includes(style)) {
    throw new Error(`Unknown style "${style}". Valid: ${STYLE_PACKS.join(', ')}`);
  }

  // Stage 1: Order
  const ordered = orderScenes(scenes);

  // Stage 2: Durations
  const durations = assignDurations(ordered, style);

  // Stage 3: Transitions
  const transitions = selectTransitions(ordered, style);

  // Stage 4: Camera overrides
  const cameraOverrides = assignCameraOverrides(ordered, style);

  // Assemble manifest
  const seqId = sequence_id || `seq_planned_${Date.now()}`;
  const manifestScenes = ordered.map((scene, i) => {
    const entry = {
      scene: scene.scene_id || scene.id || `scene_${i}`,
      duration_s: durations[i],
    };

    if (transitions[i]) {
      entry.transition_in = transitions[i];
    }

    if (cameraOverrides[i]) {
      entry.camera_override = cameraOverrides[i];
    }

    return entry;
  });

  const manifest = {
    sequence_id: seqId,
    resolution: { w: 1920, h: 1080 },
    fps: 60,
    style,
    scenes: manifestScenes,
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
  };

  return { manifest, notes };
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
