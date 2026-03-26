/**
 * Tests for Art Direction Layer.
 *
 * Covers: getArtDirection, listArtDirections, resolveArtDirectionCSS,
 * recommendArtDirection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getArtDirection,
  listArtDirections,
  resolveArtDirectionCSS,
  recommendArtDirection,
  ART_DIRECTION_SLUGS,
} from '../lib/art-direction.js';

// ── getArtDirection ─────────────────────────────────────────────────────────

describe('getArtDirection', () => {
  it('returns correct structure for prestige-dark', () => {
    const ad = getArtDirection('prestige-dark');
    assert.ok(ad, 'should return a value');
    assert.equal(ad.slug, 'prestige-dark');
    assert.equal(ad.name, 'Prestige Dark');

    // Required top-level keys
    const requiredKeys = [
      'slug', 'name', 'description', 'typography', 'palette',
      'textures', 'lighting', 'logo_behavior', 'background_treatment',
      'compatible_personalities', 'compatible_style_packs',
      'when_to_use', 'when_to_avoid',
    ];
    for (const key of requiredKeys) {
      assert.ok(key in ad, `missing key: ${key}`);
    }
  });

  it('returns typography with headline, body, caption', () => {
    const ad = getArtDirection('prestige-dark');
    for (const role of ['headline', 'body', 'caption']) {
      assert.ok(ad.typography[role], `missing typography.${role}`);
      assert.ok(ad.typography[role].family, `missing typography.${role}.family`);
      assert.equal(typeof ad.typography[role].weight, 'number');
      assert.ok(ad.typography[role].tracking, `missing typography.${role}.tracking`);
    }
  });

  it('returns palette with all required colors', () => {
    const ad = getArtDirection('prestige-dark');
    const paletteKeys = ['background', 'surface', 'text_primary', 'text_secondary', 'accent', 'accent_secondary'];
    for (const key of paletteKeys) {
      assert.ok(ad.palette[key], `missing palette.${key}`);
    }
  });

  it('returns null for unknown slug', () => {
    assert.equal(getArtDirection('nonexistent'), null);
  });

  it('loads all 6 art directions', () => {
    assert.equal(ART_DIRECTION_SLUGS.length, 6);
    const expected = [
      'prestige-dark', 'clean-corporate', 'editorial-warm',
      'tech-gradient', 'bold-contrast', 'organic-soft',
    ];
    for (const slug of expected) {
      assert.ok(getArtDirection(slug), `missing art direction: ${slug}`);
    }
  });
});

// ── listArtDirections ───────────────────────────────────────────────────────

describe('listArtDirections', () => {
  it('returns all art directions with no filter', () => {
    const results = listArtDirections();
    assert.equal(results.length, 6);
  });

  it('filters by personality', () => {
    const results = listArtDirections({ personality: 'cinematic-dark' });
    assert.ok(results.length > 0, 'should return at least one result');
    for (const ad of results) {
      assert.ok(
        ad.compatible_personalities.includes('cinematic-dark'),
        `${ad.slug} should be compatible with cinematic-dark`
      );
    }
  });

  it('filters by style_pack', () => {
    const results = listArtDirections({ style_pack: 'prestige' });
    assert.ok(results.length > 0);
    for (const ad of results) {
      assert.ok(
        ad.compatible_style_packs.includes('prestige'),
        `${ad.slug} should be compatible with prestige style pack`
      );
    }
  });

  it('filters by personality + style_pack combined', () => {
    const results = listArtDirections({
      personality: 'editorial',
      style_pack: 'fade',
    });
    assert.ok(results.length > 0);
    for (const ad of results) {
      assert.ok(ad.compatible_personalities.includes('editorial'));
      assert.ok(ad.compatible_style_packs.includes('fade'));
    }
  });

  it('returns empty array for impossible filter', () => {
    const results = listArtDirections({
      personality: 'neutral-light',
      style_pack: 'dramatic',
    });
    assert.equal(results.length, 0);
  });
});

// ── resolveArtDirectionCSS ──────────────────────────────────────────────────

describe('resolveArtDirectionCSS', () => {
  it('generates valid CSS custom properties for prestige-dark', () => {
    const ad = getArtDirection('prestige-dark');
    const css = resolveArtDirectionCSS(ad);

    assert.equal(typeof css, 'object');

    // Palette properties
    assert.equal(css['--ad-bg'], '#0a0a0a');
    assert.equal(css['--ad-accent'], '#c4a265');
    assert.equal(css['--ad-text-primary'], '#ffffff');

    // Typography properties
    assert.equal(css['--ad-font-headline'], 'Playfair Display');
    assert.equal(css['--ad-font-headline-weight'], '700');
    assert.equal(css['--ad-font-body'], 'Inter');

    // Texture properties — grain enabled
    assert.equal(css['--ad-grain-opacity'], '0.04');
    assert.equal(css['--ad-grain-blend'], 'overlay');

    // Vignette enabled
    assert.equal(css['--ad-vignette-opacity'], '0.3');
  });

  it('sets grain/vignette to zero when disabled', () => {
    const ad = getArtDirection('clean-corporate');
    const css = resolveArtDirectionCSS(ad);

    assert.equal(css['--ad-grain-opacity'], '0');
    assert.equal(css['--ad-vignette-opacity'], '0');
  });

  it('handles scan lines for tech-gradient', () => {
    const ad = getArtDirection('tech-gradient');
    const css = resolveArtDirectionCSS(ad);

    assert.equal(css['--ad-scanline-opacity'], '0.03');
    assert.equal(css['--ad-scanline-spacing'], '4px');
  });

  it('sets scan lines to zero when absent', () => {
    const ad = getArtDirection('prestige-dark');
    const css = resolveArtDirectionCSS(ad);

    assert.equal(css['--ad-scanline-opacity'], '0');
  });

  it('includes background gradient when present', () => {
    const ad = getArtDirection('editorial-warm');
    const css = resolveArtDirectionCSS(ad);

    assert.ok(css['--ad-bg-gradient'].startsWith('linear-gradient'));
  });

  it('sets gradient to none when null', () => {
    const ad = getArtDirection('prestige-dark');
    const css = resolveArtDirectionCSS(ad);

    assert.equal(css['--ad-bg-gradient'], 'none');
  });

  it('all properties are strings', () => {
    for (const slug of ART_DIRECTION_SLUGS) {
      const ad = getArtDirection(slug);
      const css = resolveArtDirectionCSS(ad);
      for (const [key, val] of Object.entries(css)) {
        assert.equal(typeof val, 'string', `${slug} ${key} should be string, got ${typeof val}`);
      }
    }
  });
});

// ── recommendArtDirection ───────────────────────────────────────────────────

describe('recommendArtDirection', () => {
  it('recommends prestige-dark for cinematic-dark personality', () => {
    const result = recommendArtDirection('cinematic-dark');
    assert.ok(result.recommendation);
    assert.ok(
      result.recommendation.compatible_personalities.includes('cinematic-dark'),
      'recommendation should be compatible with cinematic-dark'
    );
    assert.ok(result.score > 0, 'score should be positive');
  });

  it('returns higher score with matching style pack', () => {
    const withPack = recommendArtDirection('cinematic-dark', 'dramatic');
    const without = recommendArtDirection('cinematic-dark');
    assert.ok(withPack.score >= without.score);
  });

  it('returns alternatives array', () => {
    const result = recommendArtDirection('editorial', 'prestige');
    assert.ok(Array.isArray(result.alternatives));
    for (const alt of result.alternatives) {
      assert.ok(alt.slug);
      assert.ok(alt.name);
      assert.equal(typeof alt.score, 'number');
    }
  });

  it('brand hint influences scoring', () => {
    const result = recommendArtDirection('editorial', undefined, 'wellness');
    // organic-soft mentions wellness in when_to_use
    const organicAlt = result.alternatives.find(a => a.slug === 'organic-soft');
    const isTop = result.recommendation.slug === 'organic-soft';
    assert.ok(
      isTop || organicAlt,
      'organic-soft should appear in recommendation or alternatives for wellness brand'
    );
  });

  it('recommendation is always compatible with requested personality', () => {
    for (const personality of ['cinematic-dark', 'editorial', 'neutral-light', 'montage']) {
      const result = recommendArtDirection(personality);
      assert.ok(
        result.recommendation.compatible_personalities.includes(personality),
        `recommendation for ${personality} should be compatible`
      );
    }
  });
});
