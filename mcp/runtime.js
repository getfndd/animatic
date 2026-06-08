/**
 * Shared runtime state for the Animatic MCP server.
 *
 * Owns the catalog/registry data loaded at startup plus the live hot-reload
 * machinery. Extracted from index.js (PRE-1439) so that BOTH the stdio entry
 * point (index.js) and the handler module (handlers.js) read the same state
 * through ESM live bindings — when `reloadCatalogsIfStale()` reassigns a `let`
 * catalog here, every importer sees the new value without a circular import.
 *
 * The mutable catalogs (primitivesCatalog, personalitiesCatalog, intentMappings,
 * registry) are `let` because the hot-reload path reassigns them; the rest are
 * stable for the life of the process.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadIntentMappings,
  loadCameraGuardrails,
  loadStylePacks,
  loadBriefTemplates,
  loadRecipes,
  parseRegistry,
  parseBreakdownIndex,
} from './data/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');

// ── Load data at startup ────────────────────────────────────────────────────

// Catalogs that may change during a session (catalog/* edits, REGISTRY.md
// edits) are `let` so they can be reassigned by reloadCatalogsIfStale().
// Catalogs that are stable for the life of the server stay `const`.
export let primitivesCatalog = loadPrimitivesCatalog();
export let personalitiesCatalog = loadPersonalitiesCatalog();
export let intentMappings = loadIntentMappings();
export const cameraGuardrails = loadCameraGuardrails();
export const stylePacksCatalog = loadStylePacks(
  personalitiesCatalog.array.map(p => p.slug)
);
export const briefTemplatesCatalog = loadBriefTemplates();
export const recipesCatalog = loadRecipes();
export let registry = parseRegistry();
export const breakdownIndex = parseBreakdownIndex();
export const sequenceArchetypes = JSON.parse(readFileSync(resolve(__dirname, '..', 'catalog', 'sequence-archetypes.json'), 'utf-8'));

let _aiDemoArchetypes = null;
export function getAiDemoArchetypes() {
  if (!_aiDemoArchetypes) _aiDemoArchetypes = JSON.parse(readFileSync(resolve(__dirname, '..', 'catalog', 'ai-demo-archetypes.json'), 'utf-8'));
  return _aiDemoArchetypes;
}
let _finishPresets = null;
export function getFinishPresets() {
  if (!_finishPresets) _finishPresets = JSON.parse(readFileSync(resolve(__dirname, '..', 'catalog', 'finish-presets.json'), 'utf-8'));
  return _finishPresets;
}

// ── Hot reload ──────────────────────────────────────────────────────────────
//
// Catalog and registry files may be edited live during a Claude Code session
// — typically when iterating on intent-mappings, primitive entries, or
// REGISTRY.md. Without hot reload, tools surface stale data and the editor
// has no signal that the change didn't take. We mtime-stat a small set of
// files at the top of every CallTool request; if any has changed since the
// last load, we re-run the loaders. Cost is ~5–10 stat calls per tool
// invocation (sub-millisecond).

const HOT_RELOAD_FILES = [
  'catalog/primitives.json',
  'catalog/personalities.json',
  'catalog/intent-mappings.json',
  '.claude/skills/animate/reference/primitives/REGISTRY.md',
  'docs/cookbook/INDEX.md',
];
const HOT_RELOAD_DIRS = ['catalog/compound'];

function catalogMtimeKey() {
  const parts = [];
  for (const rel of HOT_RELOAD_FILES) {
    try { parts.push(`${rel}:${statSync(resolve(ROOT, rel)).mtimeMs}`); } catch {}
  }
  for (const rel of HOT_RELOAD_DIRS) {
    try {
      const dir = resolve(ROOT, rel);
      const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
      for (const f of files) {
        try { parts.push(`${rel}/${f}:${statSync(resolve(dir, f)).mtimeMs}`); } catch {}
      }
    } catch {}
  }
  return parts.join('|');
}

let _lastCatalogKey = catalogMtimeKey();

export function reloadCatalogsIfStale() {
  const key = catalogMtimeKey();
  if (key === _lastCatalogKey) return false;
  primitivesCatalog = loadPrimitivesCatalog();
  personalitiesCatalog = loadPersonalitiesCatalog();
  intentMappings = loadIntentMappings();
  registry = parseRegistry();
  _lastCatalogKey = key;
  console.error(`Animatic MCP: catalog reload — ${primitivesCatalog.array.length} primitives, ${registry.entries.length} registry entries, ${intentMappings.array.length} intents`);
  return true;
}
