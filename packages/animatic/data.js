/**
 * Catalog data access for @preset/animatic.
 *
 * Loads all catalog JSON files and provides search over the primitives registry.
 */

import { createLoader } from '../../mcp/data/loader.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const loader = createLoader(ROOT);

/**
 * Load all catalog data.
 *
 * @returns {{ primitives, personalities, intentMappings, cameraGuardrails, stylePacks, briefTemplates, recipes, shotGrammar }}
 */
export function loadCatalogs() {
  const personalities = loader.loadPersonalitiesCatalog();
  return {
    primitives: loader.loadPrimitivesCatalog(),
    personalities,
    intentMappings: loader.loadIntentMappings(),
    cameraGuardrails: loader.loadCameraGuardrails(),
    stylePacks: loader.loadStylePacks(personalities.array.map(p => p.slug)),
    briefTemplates: loader.loadBriefTemplates(),
    recipes: loader.loadRecipes(),
    shotGrammar: loader.loadShotGrammar(),
  };
}

/**
 * Search primitives by query, personality, category, or source.
 *
 * Requires registry entries (from parseRegistry() — not included in loadCatalogs).
 * Pass entries from the MCP registry or your own primitive list.
 *
 * @param {Array} entries - Array of primitive entries with { id, name, personality, category, source }
 * @param {{ query?: string, personality?: string, category?: string, source?: string }} filters
 * @returns {Array} - Filtered entries
 */
export function searchPrimitives(entries, filters = {}) {
  let results = [...entries];

  if (filters.query) {
    const q = filters.query.toLowerCase();
    results = results.filter(
      e => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    );
  }

  if (filters.personality) {
    results = results.filter(e =>
      e.personality.some(p => p === filters.personality || p === 'universal')
    );
  }

  if (filters.category) {
    const cat = filters.category.toLowerCase();
    results = results.filter(e => e.category.toLowerCase().includes(cat));
  }

  if (filters.source) {
    results = results.filter(e => e.source === filters.source);
  }

  return results;
}
