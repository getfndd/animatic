/**
 * Art Direction Layer — resolves visual treatment definitions.
 *
 * Art direction is separate from personality: personality tells you how
 * things move, art direction tells you why they feel premium.
 *
 * Exports:
 *   getArtDirection(slug)
 *   listArtDirections(options)
 *   resolveArtDirectionCSS(artDirection)
 *   recommendArtDirection(personality, stylePack, brand)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, '..', '..', 'catalog', 'art-directions.json');

// ── Load catalog ────────────────────────────────────────────────────────────

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
const bySlug = new Map(catalog.map(ad => [ad.slug, ad]));

/** All available art direction slugs. */
export const ART_DIRECTION_SLUGS = catalog.map(ad => ad.slug);

// ── getArtDirection ─────────────────────────────────────────────────────────

/**
 * Returns full art direction definition by slug, or null if not found.
 */
export function getArtDirection(slug) {
  return bySlug.get(slug) || null;
}

// ── listArtDirections ───────────────────────────────────────────────────────

/**
 * List/filter art directions.
 *
 * @param {object} [options]
 * @param {string} [options.personality] - Filter by compatible personality slug
 * @param {string} [options.style_pack]  - Filter by compatible style pack name
 * @returns {object[]} Matching art direction entries
 */
export function listArtDirections(options = {}) {
  let results = [...catalog];

  if (options.personality) {
    results = results.filter(ad =>
      ad.compatible_personalities.includes(options.personality)
    );
  }

  if (options.style_pack) {
    results = results.filter(ad =>
      ad.compatible_style_packs.includes(options.style_pack)
    );
  }

  return results;
}

// ── resolveArtDirectionCSS ──────────────────────────────────────────────────

/**
 * Converts an art direction definition to CSS custom properties.
 *
 * Returns an object where keys are CSS custom property names (e.g.
 * `--ad-bg`) and values are CSS values. Suitable for injecting into
 * :root or a scoped container.
 *
 * @param {object} artDirection - Full art direction object
 * @returns {Record<string, string>} CSS custom properties map
 */
export function resolveArtDirectionCSS(artDirection) {
  const ad = artDirection;
  const props = {};

  // Palette
  props['--ad-bg'] = ad.palette.background;
  props['--ad-surface'] = ad.palette.surface;
  props['--ad-text-primary'] = ad.palette.text_primary;
  props['--ad-text-secondary'] = ad.palette.text_secondary;
  props['--ad-accent'] = ad.palette.accent;
  props['--ad-accent-secondary'] = ad.palette.accent_secondary;

  // Typography — headline
  props['--ad-font-headline'] = ad.typography.headline.family;
  props['--ad-font-headline-weight'] = String(ad.typography.headline.weight);
  props['--ad-font-headline-tracking'] = ad.typography.headline.tracking;

  // Typography — body
  props['--ad-font-body'] = ad.typography.body.family;
  props['--ad-font-body-weight'] = String(ad.typography.body.weight);
  props['--ad-font-body-tracking'] = ad.typography.body.tracking;

  // Typography — caption
  props['--ad-font-caption'] = ad.typography.caption.family;
  props['--ad-font-caption-weight'] = String(ad.typography.caption.weight);
  props['--ad-font-caption-tracking'] = ad.typography.caption.tracking;

  // Lighting
  props['--ad-lighting-style'] = ad.lighting.style;
  props['--ad-ambient-intensity'] = String(ad.lighting.ambient_intensity);
  props['--ad-highlight-color'] = ad.lighting.highlight_color;
  props['--ad-shadow-depth'] = ad.lighting.shadow_depth;

  // Textures — grain
  if (ad.textures.grain.enabled) {
    props['--ad-grain-opacity'] = String(ad.textures.grain.opacity);
    props['--ad-grain-blend'] = ad.textures.grain.blend;
  } else {
    props['--ad-grain-opacity'] = '0';
    props['--ad-grain-blend'] = 'normal';
  }

  // Textures — vignette
  if (ad.textures.vignette.enabled) {
    props['--ad-vignette-spread'] = String(ad.textures.vignette.spread);
    props['--ad-vignette-opacity'] = String(ad.textures.vignette.opacity);
  } else {
    props['--ad-vignette-spread'] = '0';
    props['--ad-vignette-opacity'] = '0';
  }

  // Textures — scan lines
  if (ad.textures.scan_lines && ad.textures.scan_lines.enabled) {
    props['--ad-scanline-opacity'] = String(ad.textures.scan_lines.opacity);
    props['--ad-scanline-spacing'] = `${ad.textures.scan_lines.spacing_px}px`;
  } else {
    props['--ad-scanline-opacity'] = '0';
    props['--ad-scanline-spacing'] = '0';
  }

  // Background treatment
  props['--ad-bg-style'] = ad.background_treatment.style;
  props['--ad-bg-blur'] = `${ad.background_treatment.blur_radius}px`;
  if (ad.background_treatment.overlay_gradient) {
    props['--ad-bg-gradient'] = ad.background_treatment.overlay_gradient;
  } else {
    props['--ad-bg-gradient'] = 'none';
  }

  // Logo
  props['--ad-logo-treatment'] = ad.logo_behavior.treatment;
  props['--ad-logo-safe-zone'] = String(ad.logo_behavior.safe_zone_pct);

  return props;
}

// ── recommendArtDirection ───────────────────────────────────────────────────

/**
 * Recommends the best art direction for a given combination of
 * personality, style pack, and optional brand hint.
 *
 * Scoring: +3 for personality match, +2 for style pack match,
 * +1 for brand keyword appearing in when_to_use or description.
 *
 * @param {string} personality   - Personality slug
 * @param {string} [stylePack]   - Style pack name
 * @param {string} [brand]       - Brand hint (free text, matched against when_to_use)
 * @returns {{ recommendation: object, score: number, alternatives: object[] }}
 */
export function recommendArtDirection(personality, stylePack, brand) {
  const scored = catalog.map(ad => {
    let score = 0;

    if (ad.compatible_personalities.includes(personality)) {
      score += 3;
    }

    if (stylePack && ad.compatible_style_packs.includes(stylePack)) {
      score += 2;
    }

    if (brand) {
      const brandLower = brand.toLowerCase();
      const searchText = [
        ad.description,
        ...ad.when_to_use,
      ].join(' ').toLowerCase();

      if (searchText.includes(brandLower)) {
        score += 1;
      }
    }

    return { artDirection: ad, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const alternatives = scored
    .slice(1)
    .filter(s => s.score > 0)
    .map(s => ({ slug: s.artDirection.slug, name: s.artDirection.name, score: s.score }));

  return {
    recommendation: top.artDirection,
    score: top.score,
    alternatives,
  };
}
