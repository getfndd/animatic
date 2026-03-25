/**
 * Product Archetype Resolver — reusable product scene templates
 * and camera intent presets for product experience videos.
 *
 * Exports:
 *   getProductArchetype(slug)
 *   listProductArchetypes(options)
 *   recommendProductArchetype(description)
 *   getCameraIntent(slug)
 *   listCameraIntents()
 *   scoreProductDemoClarity(manifest, scenes)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARCHETYPES_PATH = resolve(__dirname, '..', '..', 'catalog', 'product-archetypes.json');
const INTENTS_PATH = resolve(__dirname, '..', '..', 'catalog', 'camera-intents.json');

// ── Load catalogs ────────────────────────────────────────────────────────────

const archetypes = JSON.parse(readFileSync(ARCHETYPES_PATH, 'utf-8'));
const archetypesBySlug = new Map(archetypes.map(a => [a.slug, a]));

const cameraIntents = JSON.parse(readFileSync(INTENTS_PATH, 'utf-8'));
const intentsBySlug = new Map(cameraIntents.map(i => [i.slug, i]));

/** All available archetype slugs. */
export const PRODUCT_ARCHETYPE_SLUGS = archetypes.map(a => a.slug);

/** All available camera intent slugs. */
export const CAMERA_INTENT_SLUGS = cameraIntents.map(i => i.slug);

// ── getProductArchetype ──────────────────────────────────────────────────────

/**
 * Returns full product archetype definition by slug, or null if not found.
 */
export function getProductArchetype(slug) {
  return archetypesBySlug.get(slug) || null;
}

// ── listProductArchetypes ────────────────────────────────────────────────────

/**
 * List all product archetypes, optionally filtered by personality.
 * @param {{ personality?: string }} options
 */
export function listProductArchetypes(options = {}) {
  let results = [...archetypes];

  if (options.personality) {
    results = results.filter(a =>
      a.personalities.includes(options.personality)
    );
  }

  return results;
}

// ── recommendProductArchetype ────────────────────────────────────────────────

/**
 * Match a freeform description to the best-fitting product archetype.
 * Uses keyword scoring against archetype name, description, when_to_use,
 * and recommended_interactions.
 *
 * @param {string} description — freeform text describing the scene
 * @returns {{ archetype: object, score: number, reason: string }[]}
 */
export function recommendProductArchetype(description) {
  if (!description || typeof description !== 'string') {
    return [];
  }

  const terms = description.toLowerCase().split(/\W+/).filter(Boolean);
  const scored = [];

  for (const archetype of archetypes) {
    let score = 0;
    const matchedFields = [];

    // Build searchable corpus from archetype fields
    const corpus = [
      archetype.name,
      archetype.description,
      ...archetype.when_to_use,
      ...archetype.recommended_interactions,
      ...archetype.phases.map(p => p.description),
    ].join(' ').toLowerCase();

    for (const term of terms) {
      if (term.length < 3) continue; // skip tiny words
      if (corpus.includes(term)) {
        score += 1;
      }
    }

    // Bonus for slug match
    if (terms.some(t => archetype.slug.includes(t))) {
      score += 3;
      matchedFields.push('slug');
    }

    // Bonus for interaction match
    for (const interaction of archetype.recommended_interactions) {
      if (terms.includes(interaction.replace('_', ''))) {
        score += 2;
        matchedFields.push(`interaction:${interaction}`);
      }
    }

    if (score > 0) {
      scored.push({
        archetype,
        score,
        reason: matchedFields.length
          ? `Matched: ${matchedFields.join(', ')} + ${score - matchedFields.length * 2} keyword hits`
          : `${score} keyword matches in description/when_to_use`,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

// ── getCameraIntent ──────────────────────────────────────────────────────────

/**
 * Returns full camera intent definition by slug, or null if not found.
 */
export function getCameraIntent(slug) {
  return intentsBySlug.get(slug) || null;
}

// ── listCameraIntents ────────────────────────────────────────────────────────

/**
 * Returns all camera intent presets.
 */
export function listCameraIntents() {
  return [...cameraIntents];
}

// ── scoreProductDemoClarity ──────────────────────────────────────────────────

/**
 * Score a product demo manifest + scenes for clarity and quality (0–100).
 *
 * Evaluates:
 *  1. Interaction truthfulness — cursor timing, text rhythm presence
 *  2. Camera intent consistency — phases use appropriate intents
 *  3. Pacing variety — not monotone, has contrast
 *  4. Clear hierarchy — distinct phases with progression
 *
 * @param {object} manifest — sequence manifest with scenes array
 * @param {object[]} scenes — array of scene definitions
 * @returns {{ score: number, max: number, breakdown: object[], warnings: string[] }}
 */
export function scoreProductDemoClarity(manifest, scenes) {
  const warnings = [];
  const breakdown = [];
  let total = 0;
  const max = 100;

  if (!scenes || scenes.length === 0) {
    return { score: 0, max, breakdown: [], warnings: ['No scenes provided'] };
  }

  // ── 1. Interaction truthfulness (0–25) ──────────────────────────────────

  let interactionScore = 0;
  let hasInteractions = false;
  let hasCursorTiming = false;
  let hasTextRhythm = false;

  for (const scene of scenes) {
    const layers = scene.layers || [];
    for (const layer of layers) {
      // Check for cursor or interaction layers
      if (layer.type === 'cursor' || layer.role === 'cursor' ||
          layer.interaction || layer.cursor) {
        hasInteractions = true;
        if (layer.timing || layer.delay_ms || layer.delay) {
          hasCursorTiming = true;
        }
      }
      // Check for text animation layers
      if (layer.type === 'text' || layer.role === 'text' ||
          layer.animation === 'typewriter' || layer.primitive === 'cd-typewriter') {
        hasTextRhythm = true;
      }
    }

    // Also check scene-level interaction metadata
    if (scene.interactions || scene.interaction_sequence) {
      hasInteractions = true;
      hasCursorTiming = true;
    }
  }

  if (hasInteractions) interactionScore += 10;
  else warnings.push('No interaction layers found — product demos should show user actions');

  if (hasCursorTiming) interactionScore += 10;
  else if (hasInteractions) warnings.push('Interactions lack timing data — cursor movements may feel mechanical');

  if (hasTextRhythm) interactionScore += 5;

  breakdown.push({ dimension: 'interaction_truthfulness', score: interactionScore, max: 25 });
  total += interactionScore;

  // ── 2. Camera intent consistency (0–30) ─────────────────────────────────

  let cameraScore = 0;
  const sceneIntents = [];

  for (const scene of scenes) {
    const camera = scene.camera || {};
    const move = camera.move || camera.camera_move || 'static';

    // Resolve what intent this camera move implies
    let inferredIntent = null;
    if (move === 'static') inferredIntent = 'inspect';
    else if (move === 'push_in') inferredIntent = 'spotlight';
    else if (move === 'pull_out') inferredIntent = 'reveal';
    else if (move === 'drift') inferredIntent = 'compare';
    else if (move === 'breathe') inferredIntent = 'confirm';

    sceneIntents.push({
      scene_id: scene.id || scene.slug,
      move,
      inferredIntent,
      declaredIntent: scene.camera_intent || scene.intent || null,
    });
  }

  // Check that declared intents match camera moves
  let intentMatches = 0;
  let intentMismatches = 0;
  for (const si of sceneIntents) {
    if (si.declaredIntent) {
      const intentDef = intentsBySlug.get(si.declaredIntent);
      if (intentDef && intentDef.camera.move === si.move) {
        intentMatches++;
      } else if (intentDef) {
        intentMismatches++;
        warnings.push(
          `Scene "${si.scene_id}": declared intent "${si.declaredIntent}" expects camera move "${intentDef.camera.move}" but got "${si.move}"`
        );
      }
    }
  }

  // Award points for intent consistency
  const totalDeclared = intentMatches + intentMismatches;
  if (totalDeclared > 0) {
    cameraScore += Math.round((intentMatches / totalDeclared) * 20);
  } else {
    // No declared intents — give partial credit if camera moves are varied
    cameraScore += 10;
    warnings.push('No camera intents declared — scenes should specify intent for clarity');
  }

  // Check that not all camera moves are the same
  const uniqueMoves = new Set(sceneIntents.map(s => s.move));
  if (uniqueMoves.size >= 3) cameraScore += 10;
  else if (uniqueMoves.size >= 2) cameraScore += 5;
  else warnings.push('All scenes use the same camera move — vary camera intent for visual interest');

  breakdown.push({ dimension: 'camera_intent_consistency', score: cameraScore, max: 30 });
  total += cameraScore;

  // ── 3. Pacing variety (0–25) ────────────────────────────────────────────

  let pacingScore = 0;
  const durations = scenes.map(s =>
    s.duration_s || s.duration_ms / 1000 || s.duration / 1000 || 4
  );

  // Check for duration variety (not all the same)
  const uniqueDurations = new Set(durations.map(d => Math.round(d)));
  if (uniqueDurations.size >= 3) pacingScore += 10;
  else if (uniqueDurations.size >= 2) pacingScore += 5;
  else warnings.push('All scenes have identical duration — vary pacing for rhythm');

  // Check for reasonable total duration
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  if (totalDuration >= 8 && totalDuration <= 90) pacingScore += 10;
  else if (totalDuration >= 4 && totalDuration <= 120) pacingScore += 5;
  else warnings.push(`Total duration ${totalDuration}s is outside recommended range (8–90s)`);

  // Check for energy curve (if scenes have energy metadata)
  const energies = scenes.map(s => s.energy).filter(Boolean);
  if (energies.length >= 3) {
    const uniqueEnergies = new Set(energies);
    if (uniqueEnergies.size >= 2) pacingScore += 5;
  } else {
    pacingScore += 3; // partial credit when no energy metadata
  }

  breakdown.push({ dimension: 'pacing_variety', score: pacingScore, max: 25 });
  total += pacingScore;

  // ── 4. Clear hierarchy (0–20) ───────────────────────────────────────────

  let hierarchyScore = 0;

  // Check scene count is reasonable for a product demo
  if (scenes.length >= 3 && scenes.length <= 12) hierarchyScore += 5;
  else if (scenes.length >= 2) hierarchyScore += 3;
  else warnings.push('Only 1 scene — product demos need multiple phases for narrative clarity');

  // Check for distinct scene roles
  const roles = scenes.map(s => s.role || s.scene_role).filter(Boolean);
  if (roles.length >= 3) {
    const uniqueRoles = new Set(roles);
    if (uniqueRoles.size === roles.length) hierarchyScore += 10; // all unique
    else if (uniqueRoles.size >= roles.length * 0.7) hierarchyScore += 7;
    else hierarchyScore += 4;
  } else {
    hierarchyScore += 3;
    if (scenes.length > 2) {
      warnings.push('Scenes lack role metadata — assign roles for clear narrative structure');
    }
  }

  // Check for transition variety
  const transitions = scenes
    .map(s => (s.transition_in && s.transition_in.type) || s.transition_type)
    .filter(Boolean);
  if (transitions.length >= 2) {
    const uniqueTransitions = new Set(transitions);
    if (uniqueTransitions.size >= 2) hierarchyScore += 5;
    else hierarchyScore += 3;
  } else {
    hierarchyScore += 2; // partial credit
  }

  breakdown.push({ dimension: 'clear_hierarchy', score: hierarchyScore, max: 20 });
  total += hierarchyScore;

  return { score: total, max, breakdown, warnings };
}
