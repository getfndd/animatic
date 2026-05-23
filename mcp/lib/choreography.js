/**
 * Choreography recommendations — shared core.
 *
 * Given a choreographic intent (from catalog/intent-mappings.json) and a
 * personality, return the companion-entrance primitives that fit. This is the
 * reusable heart of the recommend_choreography MCP tool, factored out so the
 * story-beat planner can consult the same discovery layer instead of relying
 * only on each archetype's hand-listed primitive pool (ANI-149). That's the
 * path by which lib-* compound primitives surface in the autonomous loop.
 *
 * Catalogs are loaded once and cached at module scope, matching story-beats.js.
 */

import { loadIntentMappings, parseRegistry, loadCameraGuardrails } from '../data/loader.js';
import { filterByPersonality } from '../lib.js';

let _intentMappings = null;
let _registry = null;
let _guardrails = null;

function getIntentMappings() {
  if (!_intentMappings) _intentMappings = loadIntentMappings();
  return _intentMappings;
}

function getRegistry() {
  if (!_registry) _registry = parseRegistry();
  return _registry;
}

function getGuardrails() {
  if (!_guardrails) _guardrails = loadCameraGuardrails();
  return _guardrails;
}

/**
 * Drop companions that violate the personality's entrance guardrails. Companion
 * entrances are entrance animations, so the relevant boundary is blur: editorial
 * (blur_entrance), neutral-light, and montage (blur) forbid blur, yet some
 * personality-affine primitives (e.g. ed-blur-reveal) are blur primitives. Left
 * unfiltered they'd feed a blocked primitive back into the loop (ANI-149 review).
 *
 * @param {string[]} primitiveIds
 * @param {string} personalitySlug
 * @returns {string[]}
 */
function filterByEntranceGuardrails(primitiveIds, personalitySlug) {
  const g = getGuardrails();
  const forbidden = g.personality_boundaries?.[personalitySlug]?.forbidden_features || [];
  if (!forbidden.includes('blur') && !forbidden.includes('blur_entrance')) return primitiveIds;
  const blurPrimitives = new Set(g.blur_primitives || []);
  return primitiveIds.filter(id => !blurPrimitives.has(id));
}

/**
 * Companion-entrance primitives for a choreographic intent under a personality.
 * Returns [] when the intent is unknown or the personality is not in that
 * intent's support list — so callers can merge the result unconditionally.
 * Personality affinity and entrance guardrails are both applied, so the result
 * is safe to feed into a beat plan without re-checking guardrails downstream.
 *
 * @param {string} intentSlug - e.g. 'dramatic-reveal'
 * @param {string} personalitySlug - e.g. 'cinematic-dark'
 * @returns {string[]} primitive ids, personality- and guardrail-filtered
 */
export function recommendCompanionEntrances(intentSlug, personalitySlug) {
  const mapping = getIntentMappings().byIntent.get(intentSlug);
  if (!mapping || !Array.isArray(mapping.companion_entrance)) return [];
  if (personalitySlug && !mapping.personality_support.includes(personalitySlug)) return [];
  const byPersonality = filterByPersonality(mapping.companion_entrance, personalitySlug, getRegistry());
  return filterByEntranceGuardrails(byPersonality, personalitySlug);
}
