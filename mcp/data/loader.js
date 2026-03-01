/**
 * Animatic MCP Data Loader
 *
 * Loads catalog JSONs, parses REGISTRY.md tables + CSS detail blocks,
 * and parses breakdown INDEX.md into queryable in-memory data.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Path helpers ────────────────────────────────────────────────────────────

const CATALOG_DIR = resolve(ROOT, 'catalog');
const REFERENCE_DIR = resolve(ROOT, '.claude/skills/animate/reference');
const PRIMITIVES_DIR = resolve(REFERENCE_DIR, 'primitives');
const BREAKDOWNS_DIR = resolve(REFERENCE_DIR, 'breakdowns');

// ── JSON catalog loaders ────────────────────────────────────────────────────

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/** Load catalog/primitives.json → array + slug map */
export function loadPrimitivesCatalog() {
  const arr = loadJSON(resolve(CATALOG_DIR, 'primitives.json'));
  const bySlug = new Map(arr.map(p => [p.slug, p]));
  return { array: arr, bySlug };
}

/** Load catalog/personalities.json → array + slug map */
export function loadPersonalitiesCatalog() {
  const arr = loadJSON(resolve(CATALOG_DIR, 'personalities.json'));
  const bySlug = new Map(arr.map(p => [p.slug, p]));
  return { array: arr, bySlug };
}

/** Load catalog/intent-mappings.json → array + intent map */
export function loadIntentMappings() {
  const arr = loadJSON(resolve(CATALOG_DIR, 'intent-mappings.json'));
  const byIntent = new Map(arr.map(i => [i.intent, i]));
  return { array: arr, byIntent };
}

/** Load catalog/camera-guardrails.json */
export function loadCameraGuardrails() {
  return loadJSON(resolve(CATALOG_DIR, 'camera-guardrails.json'));
}

/** Load catalog/shot-grammar.json → structured grammar data with lookup maps */
export function loadShotGrammar() {
  const data = loadJSON(resolve(CATALOG_DIR, 'shot-grammar.json'));
  const sizeBySlug = new Map(data.shot_sizes.map(s => [s.slug, s]));
  const angleBySlug = new Map(data.angles.map(a => [a.slug, a]));
  const framingBySlug = new Map(data.framings.map(f => [f.slug, f]));
  const affinityMap = new Map();
  for (const size of data.shot_sizes) {
    for (const ct of size.content_type_affinity) {
      affinityMap.set(ct, size.slug);
    }
  }
  return {
    ...data,
    sizeBySlug,
    angleBySlug,
    framingBySlug,
    affinityMap,
  };
}

/** Load catalog/style-packs.json → array + name map, validates personality refs */
export function loadStylePacks(personalitySlugs) {
  const arr = loadJSON(resolve(CATALOG_DIR, 'style-packs.json'));
  const byName = new Map();

  for (const pack of arr) {
    if (personalitySlugs && !personalitySlugs.includes(pack.personality)) {
      throw new Error(
        `Style pack "${pack.name}" references unknown personality "${pack.personality}"`
      );
    }
    byName.set(pack.name, pack);
  }

  return { array: arr, byName };
}

// ── REGISTRY.md parser ──────────────────────────────────────────────────────

/**
 * Parse the REGISTRY.md file into:
 *   - entries: array of { id, name, duration, personality[], source, category }
 *   - byId: Map<id, entry>
 *   - cssBlocks: Map<id, css_string>
 *   - personalityRecommendations: Map<personality_slug, { category: id[] }>
 */
export function parseRegistry() {
  const content = readFileSync(resolve(PRIMITIVES_DIR, 'REGISTRY.md'), 'utf-8');
  const lines = content.split('\n');

  const entries = [];
  const byId = new Map();
  const cssBlocks = new Map();
  const personalityRecommendations = new Map();

  let currentCategory = null;

  // ── Pass 1: Parse tables ──────────────────────────────────────────────

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect category headers (### Entrances, ### Exits, etc.)
    const categoryMatch = line.match(/^### (.+)$/);
    if (categoryMatch) {
      const heading = categoryMatch[1].trim();
      // Skip headings that are detail block IDs (contain backticks)
      if (heading.startsWith('`')) continue;
      // Skip "Camera Motion Primitives" heading (not a table category)
      if (heading === 'Camera Motion Primitives') continue;
      currentCategory = heading;
      continue;
    }

    // Parse table rows: | `id` | Name | Duration | Personality | Source |
    const tableMatch = line.match(
      /^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
    );
    if (tableMatch && currentCategory) {
      const [, id, name, duration, personalityStr, source] = tableMatch;
      // Skip header separator rows
      if (id === '----' || id === 'ID') continue;

      const personality = personalityStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const entry = {
        id,
        name: name.trim(),
        duration: duration.trim(),
        personality,
        source: source.trim(),
        category: currentCategory,
      };

      // Only add first occurrence (some IDs appear in Typography cross-reference)
      if (!byId.has(id)) {
        entries.push(entry);
        byId.set(id, entry);
      }
    }

    // ── Personality Quick Filters ────────────────────────────────────────
    const filterMatch = line.match(/^Best (\w[\w\s]*?):\s*(.+)$/);
    if (filterMatch) {
      const filterCategory = filterMatch[1].trim().toLowerCase();
      const ids = filterMatch[2]
        .split(',')
        .map(s => s.trim().replace(/`/g, ''))
        .filter(Boolean);

      // Determine which personality section we're in
      // Look backwards for the personality heading
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = lines[j];
        const personalityHeading = prevLine.match(
          /^### (.+?) —/
        );
        if (personalityHeading) {
          const personalityName = personalityHeading[1].trim();
          const personalitySlug = personalityName
            .toLowerCase()
            .replace(/\s+/g, '-');

          if (!personalityRecommendations.has(personalitySlug)) {
            personalityRecommendations.set(personalitySlug, {});
          }
          personalityRecommendations.get(personalitySlug)[filterCategory] = ids;
          break;
        }
      }
    }
  }

  // ── Pass 2: Extract CSS detail blocks ─────────────────────────────────

  const cssBlockRegex = /^### `([^`]+)`\s*—\s*.+$/;
  let currentCssId = null;
  let collectingCss = false;
  let cssBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start of a detail block
    const blockMatch = line.match(cssBlockRegex);
    if (blockMatch) {
      // Save previous block if any
      if (currentCssId && cssBuffer.length > 0) {
        cssBlocks.set(currentCssId, cssBuffer.join('\n').trim());
      }
      currentCssId = blockMatch[1];
      cssBuffer = [];
      collectingCss = false;
      continue;
    }

    // Track CSS code fences within a detail block
    if (currentCssId) {
      if (line.startsWith('```css')) {
        collectingCss = true;
        continue;
      }
      if (line.startsWith('```') && collectingCss) {
        collectingCss = false;
        continue;
      }
      if (collectingCss) {
        cssBuffer.push(line);
      }
      // Also capture comments outside code fences
      if (!collectingCss && line.startsWith('/*')) {
        cssBuffer.push(line);
      }
    }

    // Reset on new top-level heading (## or ---)
    if ((line.startsWith('## ') || line === '---') && currentCssId) {
      if (cssBuffer.length > 0) {
        cssBlocks.set(currentCssId, cssBuffer.join('\n').trim());
      }
      currentCssId = null;
      cssBuffer = [];
      collectingCss = false;
    }
  }

  // Save last block
  if (currentCssId && cssBuffer.length > 0) {
    cssBlocks.set(currentCssId, cssBuffer.join('\n').trim());
  }

  return { entries, byId, cssBlocks, personalityRecommendations };
}

// ── INDEX.md parser ─────────────────────────────────────────────────────────

/**
 * Parse breakdowns/INDEX.md into array of:
 *   { ref, slug, title, type, personality, quality, tags[] }
 */
export function parseBreakdownIndex() {
  const content = readFileSync(resolve(BREAKDOWNS_DIR, 'INDEX.md'), 'utf-8');
  const lines = content.split('\n');
  const breakdowns = [];

  for (const line of lines) {
    // Match: | [slug](slug.md) | Title | Type | Personality | Quality | Tags |
    const match = line.match(
      /^\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
    );
    if (match) {
      const [, slug, title, type, personality, quality, tagsStr] = match;
      breakdowns.push({
        ref: slug.trim(),
        slug: slug.trim(),
        title: title.trim(),
        type: type.trim(),
        personality: personality.trim(),
        quality: quality.trim(),
        tags: tagsStr
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      });
    }
  }

  return breakdowns;
}

// ── On-demand file readers ──────────────────────────────────────────────────

/** Read a breakdown .md file by slug */
export function readBreakdown(slug) {
  const safeName = slug.replace(/[^a-z0-9-]/g, '');
  const filePath = resolve(BREAKDOWNS_DIR, `${safeName}.md`);
  return readFileSync(filePath, 'utf-8');
}

/** Read a reference doc by name */
export function readReferenceDoc(name) {
  const safeName = name.replace(/[^a-zA-Z0-9-]/g, '');
  const filePath = resolve(REFERENCE_DIR, `${safeName}.md`);
  return readFileSync(filePath, 'utf-8');
}

/**
 * List available reference docs (for tool descriptions / error messages)
 */
export function listReferenceDocs() {
  return [
    'animation-principles',
    'spring-physics',
    'cinematic-techniques-research',
    'camera-rig',
    'personality-research',
    'SCHEMA',
    'industry-references',
    'figma-mcp-research',
  ];
}

/**
 * Get the project root path (for resource descriptions, etc.)
 */
export function getProjectRoot() {
  return ROOT;
}
