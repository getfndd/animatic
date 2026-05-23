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

import { loadIntentMappings, parseRegistry } from '../data/loader.js';
import { filterByPersonality } from '../lib.js';

let _intentMappings = null;
let _registry = null;

function getIntentMappings() {
  if (!_intentMappings) _intentMappings = loadIntentMappings();
  return _intentMappings;
}

function getRegistry() {
  if (!_registry) _registry = parseRegistry();
  return _registry;
}

/**
 * Companion-entrance primitives for a choreographic intent under a personality.
 * Returns [] when the intent is unknown or the personality is not in that
 * intent's support list — so callers can merge the result unconditionally.
 *
 * @param {string} intentSlug - e.g. 'dramatic-reveal'
 * @param {string} personalitySlug - e.g. 'cinematic-dark'
 * @returns {string[]} primitive ids, personality-filtered
 */
export function recommendCompanionEntrances(intentSlug, personalitySlug) {
  const mapping = getIntentMappings().byIntent.get(intentSlug);
  if (!mapping || !Array.isArray(mapping.companion_entrance)) return [];
  if (personalitySlug && !mapping.personality_support.includes(personalitySlug)) return [];
  return filterByPersonality(mapping.companion_entrance, personalitySlug, getRegistry());
}
