/**
 * Story Beat Planning
 *
 * Maps a story brief onto a sequence archetype to produce a concrete beat plan
 * with durations, camera intents, transitions, and continuity opportunities.
 * Optionally snaps to audio beats.
 *
 * Pure function. JSON in, JSON out.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { recommendFromClassification } from './semantic-planner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Catalog loaders ─────────────────────────────────────────────────────────

let _archetypes = null;
function loadArchetypes() {
  if (!_archetypes) {
    _archetypes = JSON.parse(readFileSync(resolve(ROOT, 'catalog/sequence-archetypes.json'), 'utf-8'));
  }
  return _archetypes;
}

let _cameraIntents = null;
function loadCameraIntents() {
  if (!_cameraIntents) {
    _cameraIntents = JSON.parse(readFileSync(resolve(ROOT, 'catalog/camera-intents.json'), 'utf-8'));
  }
  return _cameraIntents;
}

// ── Camera intent resolution ────────────────────────────────────────────────

const ENERGY_TO_INTENT = {
  still: 'inspect',
  low: 'inspect',
  medium: 'spotlight',
  high: 'reveal',
  impact: 'reveal',
};

/**
 * Resolve a camera intent slug from an archetype scene's camera move and energy.
 */
function resolveIntent(archetypeScene, cameraIntents) {
  const move = archetypeScene.camera?.move;
  const energy = archetypeScene.energy;

  // Try to match by camera move
  const moveMatch = cameraIntents.find(ci => ci.camera?.move === move);
  if (moveMatch) return moveMatch.slug;

  // Fall back to energy mapping
  return ENERGY_TO_INTENT[energy] || 'inspect';
}

// ── Semantic classification inference (ANI-116) ─────────────────────────────

const ENERGY_TO_PACING = {
  still: 'contemplative',
  low: 'deliberate',
  medium: 'moderate',
  high: 'rapid',
  impact: 'rapid',
};

const CAMERA_INTENT_TO_BEHAVIOR = {
  reveal: 'push_in',
  spotlight: 'push_in',
  inspect: 'static',
  impact: 'drift',
};

// Explicit allowlist of beat roles whose default scene content is plausibly
// a real v3 interactive component. Branding, logo, atmosphere, closing, and
// narrative-framing roles are intentionally *not* listed — they should fall
// through to default scene generation rather than get a prompt-card seed
// (ANI-116 review follow-up: previously these roles were mapped to
// `transition`, which semantic-planner resolves to `prompt_card`, producing
// nonsense recommendations for logo / tagline / atmosphere beats).
const ROLE_TO_INTERACTION_TYPE = {
  // Reveal — content being unveiled
  feature_demo: 'reveal',
  feature_montage: 'reveal',
  hero_product: 'reveal',
  detail_zoom: 'reveal',
  key_metric: 'reveal',
  success_state: 'reveal',
  social_proof: 'reveal',
  benefit_proof: 'reveal',
  product_glimpse: 'reveal',
  // Typing — user typing into an input. Deliberately narrow: `context_setup`
  // is the only role that implies a setup-style interactive input. Tutorial
  // step roles (step_1/2/3) could mean click, select, or type; leaving them
  // out avoids biasing toward a specific interaction kind.
  context_setup: 'typing',
};

/**
 * Infer a semantic classification for a beat from its energy, camera intent,
 * and role. Used to drive semantic-planner recommendations during beat
 * materialization (ANI-116).
 *
 * Returns a classification object compatible with semantic-planner's
 * `classifyReference` input. Values are only set when the mapping is
 * confident — callers should treat missing dimensions as "no opinion."
 *
 * @param {{ role?: string, energy?: string, camera_intent?: string }} beat
 * @returns {object} Classification with zero or more dimensions set
 */
export function inferBeatClassification(beat) {
  if (!beat) return {};
  const classification = {};

  if (beat.energy && ENERGY_TO_PACING[beat.energy]) {
    classification.pacing = ENERGY_TO_PACING[beat.energy];
  }

  if (beat.camera_intent && CAMERA_INTENT_TO_BEHAVIOR[beat.camera_intent]) {
    classification.camera_behavior = CAMERA_INTENT_TO_BEHAVIOR[beat.camera_intent];
  }

  if (beat.role && ROLE_TO_INTERACTION_TYPE[beat.role]) {
    const interactionType = ROLE_TO_INTERACTION_TYPE[beat.role];
    classification.interaction_type = interactionType;
    if (interactionType === 'typing') {
      classification.text_behavior = 'typing';
    }
  }

  return classification;
}

/**
 * Recommend a v3 semantic block for a beat. Returns null when the inferred
 * classification doesn't produce any components — callers should treat null
 * as "no recommendation, use default scene generation."
 */
export function recommendSemanticForBeat(beat) {
  const classification = inferBeatClassification(beat);
  if (Object.keys(classification).length === 0) return null;

  const rec = recommendFromClassification(classification);
  if (!rec.components || rec.components.length === 0) return null;

  return { classification, ...rec };
}

// ── Brief section matching ──────────────────────────────────────────────────

/**
 * Match story brief features/sections to archetype scene roles.
 * Returns a map of role → brief_section label.
 */
function matchBriefSections(storyBrief, archetypeScenes) {
  const features = storyBrief.must_show_features || [];
  const sections = {};

  // Simple heuristic: distribute features across content-focused roles
  const contentRoles = archetypeScenes.filter(s =>
    !['atmosphere_open', 'logo_lockup', 'tagline_close', 'attribution'].includes(s.role)
  );

  let featureIdx = 0;
  for (const scene of contentRoles) {
    if (featureIdx < features.length) {
      sections[scene.role] = features[featureIdx];
      featureIdx++;
    }
  }

  // Map closing roles
  const closing = storyBrief.closing_beat;
  if (closing) {
    const closingScene = archetypeScenes.find(s => s.role === closing || s.role.includes('close') || s.role.includes('logo'));
    if (closingScene) sections[closingScene.role] = closing;
  }

  return sections;
}

// ── Continuity opportunity detection ────────────────────────────────────────

/**
 * Identify continuity opportunities between adjacent beats.
 * Returns array of { from_beat, strategy } for each beat.
 */
function detectContinuityOpportunities(archetypeScenes) {
  const opportunities = archetypeScenes.map(() => []);

  for (let i = 0; i < archetypeScenes.length - 1; i++) {
    const curr = archetypeScenes[i];
    const next = archetypeScenes[i + 1];

    // Same layer type across scenes → potential match cut
    const currLayers = new Set(curr.recommended_layers || []);
    const nextLayers = new Set(next.recommended_layers || []);
    const shared = [...currLayers].filter(l => nextLayers.has(l));

    if (shared.length > 0) {
      // Suggest strategy based on energy transition
      let strategy = 'position';
      if (curr.energy === 'high' && next.energy !== 'high') strategy = 'scale';
      if (curr.role?.includes('card') || next.role?.includes('card')) strategy = 'card_to_panel';
      if (shared.includes('text_hero') || shared.includes('text_overlay')) strategy = 'content_morph';

      opportunities[i + 1].push({ from_beat: i, strategy });
    }
  }

  return opportunities;
}

// ── Audio beat snapping ─────────────────────────────────────────────────────

/**
 * Snap beat durations to audio beat boundaries.
 * Adjusts durations by at most ±15%.
 *
 * @returns {{ durations: number[], adjustments: { beat_index, adjustment_ms }[], aligned_count: number }}
 */
function snapToAudioBeats(durations, audioBeats) {
  if (!audioBeats?.beats?.length) return { durations, adjustments: [], aligned_count: 0 };

  const beatTimes = audioBeats.beats.map(b => b.time_s);
  const adjusted = [...durations];
  const adjustments = [];
  let alignedCount = 0;

  let cumulativeTime = 0;
  for (let i = 0; i < adjusted.length; i++) {
    const targetEnd = cumulativeTime + adjusted[i];

    // Find nearest beat to this scene boundary
    let nearestBeat = null;
    let nearestDist = Infinity;
    for (const bt of beatTimes) {
      const dist = Math.abs(bt - targetEnd);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBeat = bt;
      }
    }

    if (nearestBeat !== null && nearestDist < adjusted[i] * 0.15) {
      const newDuration = nearestBeat - cumulativeTime;
      if (newDuration >= 1) { // minimum 1s
        const adjustmentMs = Math.round((newDuration - adjusted[i]) * 1000);
        if (adjustmentMs !== 0) {
          adjustments.push({ beat_index: i, adjustment_ms: adjustmentMs });
        }
        adjusted[i] = newDuration;
        alignedCount++;
      }
    }

    cumulativeTime += adjusted[i];
  }

  return { durations: adjusted, adjustments, aligned_count: alignedCount };
}

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Plan story beats from a brief and sequence archetype.
 *
 * @param {object} params
 * @param {object} params.story_brief - Output of extractStoryBrief
 * @param {string} params.archetype_slug - Sequence archetype slug
 * @param {object} [params.audio_beats] - Beat data { beats[], tempo_bpm }
 * @param {object} [params.options] - { duration_target_s, strategy }
 * @returns {object} Beat plan
 */
export function planStoryBeats({ story_brief, archetype_slug, audio_beats, options } = {}) {
  const archetypes = loadArchetypes();
  const cameraIntents = loadCameraIntents();

  const archetype = archetypes.find(a => a.slug === archetype_slug);
  if (!archetype) {
    throw new Error(`Unknown archetype: ${archetype_slug}. Available: ${archetypes.map(a => a.slug).join(', ')}`);
  }

  const totalDuration = options?.duration_target_s
    || story_brief?.duration_target_s
    || archetype.duration_range?.max_s
    || 30;

  // Compute absolute durations from archetype percentages
  let durations = archetype.scenes.map(s => {
    const pct = s.duration_pct || (1 / archetype.scenes.length);
    return Math.round(pct * totalDuration * 10) / 10;
  });

  // Ensure durations sum to target (fix rounding)
  const sum = durations.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - totalDuration) > 0.1) {
    const diff = totalDuration - sum;
    // Add the difference to the longest scene
    const longestIdx = durations.indexOf(Math.max(...durations));
    durations[longestIdx] = Math.round((durations[longestIdx] + diff) * 10) / 10;
  }

  // Audio beat snapping
  let audioSync = null;
  if (audio_beats?.beats?.length) {
    const snapResult = snapToAudioBeats(durations, audio_beats);
    durations = snapResult.durations;
    audioSync = {
      beat_aligned_count: snapResult.aligned_count,
      adjustments: snapResult.adjustments,
    };
  }

  // Brief section matching
  const sectionMap = matchBriefSections(story_brief || {}, archetype.scenes);

  // Continuity detection
  const continuityOps = detectContinuityOpportunities(archetype.scenes);

  // Build beats
  const beats = archetype.scenes.map((scene, i) => {
    const beat = {
      index: i,
      role: scene.role,
      brief_section: sectionMap[scene.role] || null,
      duration_s: durations[i],
      duration_pct: Math.round((durations[i] / totalDuration) * 1000) / 1000,
      energy: scene.energy || 'medium',
      camera_intent: resolveIntent(scene, cameraIntents),
      transition_in: scene.transition_in || (i === 0 ? null : { type: 'crossfade', duration_ms: 400 }),
      continuity_opportunities: continuityOps[i] || [],
      recommended_layers: scene.recommended_layers || [],
      recommended_primitives: scene.recommended_primitives || [],
    };
    // Attach semantic-planner recommendation when classification yields
    // components. Downstream scene generation can use this as a v3 seed
    // (ANI-116). Omit the key entirely when no recommendation applies so
    // the beat shape stays unchanged for non-v3-friendly roles.
    const semanticRec = recommendSemanticForBeat(beat);
    if (semanticRec) beat.semantic_recommendation = semanticRec;
    return beat;
  });

  return {
    archetype: archetype_slug,
    total_duration_s: Math.round(durations.reduce((a, b) => a + b, 0) * 10) / 10,
    beats,
    energy_curve: archetype.pacing_profile?.energy_curve || beats.map(b => b.energy),
    pacing_profile: archetype.pacing_profile || { pattern: 'linear', contrast_rule: 'none' },
    audio_sync: audioSync,
  };
}

// Expose for testing
export { resolveIntent, matchBriefSections, detectContinuityOpportunities, snapToAudioBeats };
