/**
 * Multi-pass compositing system tests.
 *
 * Run: node --test mcp/test/compositing-passes.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCompositingPass,
  listCompositingPasses,
  resolvePassCSS,
  planCompositingStack,
  scoreFinish,
  scoreBrandFinish,
  COMPOSITING_PASS_SLUGS,
} from '../lib/compositing.js';

// ── Catalog loading ─────────────────────────────────────────────────────────

describe('COMPOSITING_PASS_SLUGS', () => {
  it('has 7 compositing passes', () => {
    assert.equal(COMPOSITING_PASS_SLUGS.length, 7);
  });

  it('includes expected slugs', () => {
    const expected = ['bloom', 'vignette', 'film-grain', 'chromatic-softness',
      'light-sweep', 'masked-highlight', 'shallow-dof'];
    for (const slug of expected) {
      assert.ok(COMPOSITING_PASS_SLUGS.includes(slug), `Missing: ${slug}`);
    }
  });
});

// ── getCompositingPass ──────────────────────────────────────────────────────

describe('getCompositingPass', () => {
  it('returns pass by slug', () => {
    const pass = getCompositingPass('bloom');
    assert.ok(pass);
    assert.equal(pass.name, 'Bloom');
    assert.equal(pass.category, 'lens');
    assert.deepEqual(pass.personality_affinity, ['cinematic-dark']);
  });

  it('returns null for unknown slug', () => {
    assert.equal(getCompositingPass('fake-pass'), null);
  });

  it('returns pass with correct defaults', () => {
    const v = getCompositingPass('vignette');
    assert.equal(v.defaults.spread, 0.7);
    assert.equal(v.defaults.opacity, 0.35);
    assert.equal(v.defaults.color, '#000000');
  });
});

// ── listCompositingPasses ───────────────────────────────────────────────────

describe('listCompositingPasses', () => {
  it('returns all passes with no filters', () => {
    const all = listCompositingPasses();
    assert.equal(all.length, 7);
  });

  it('filters by category', () => {
    const lens = listCompositingPasses({ category: 'lens' });
    assert.ok(lens.length >= 3);
    for (const p of lens) {
      assert.equal(p.category, 'lens');
    }
  });

  it('filters by personality', () => {
    const editorial = listCompositingPasses({ personality: 'editorial' });
    for (const p of editorial) {
      assert.ok(p.personality_affinity.includes('editorial'));
    }
  });

  it('filters by both category and personality', () => {
    const results = listCompositingPasses({ category: 'lens', personality: 'editorial' });
    for (const p of results) {
      assert.equal(p.category, 'lens');
      assert.ok(p.personality_affinity.includes('editorial'));
    }
  });

  it('returns empty array for non-matching filter', () => {
    const results = listCompositingPasses({ category: 'nonexistent' });
    assert.equal(results.length, 0);
  });
});

// ── resolvePassCSS ──────────────────────────────────────────────────────────

describe('resolvePassCSS', () => {
  it('returns empty object for null pass', () => {
    const css = resolvePassCSS(null);
    assert.deepEqual(css, {});
  });

  it('resolves bloom with defaults', () => {
    const pass = getCompositingPass('bloom');
    const css = resolvePassCSS(pass);
    assert.ok(css.filter);
    assert.ok(css.filter.includes('brightness'));
    assert.ok(css.filter.includes('blur'));
    assert.equal(css.mixBlendMode, 'screen');
    assert.equal(css.position, 'absolute');
  });

  it('resolves bloom with overrides', () => {
    const pass = getCompositingPass('bloom');
    const css = resolvePassCSS(pass, { intensity: 0.5, radius: 30 });
    assert.ok(css.filter.includes('1.5'));   // 1 + 0.5
    assert.ok(css.filter.includes('30px'));
  });

  it('resolves vignette', () => {
    const pass = getCompositingPass('vignette');
    const css = resolvePassCSS(pass);
    assert.ok(css.background);
    assert.ok(css.background.includes('radial-gradient'));
    assert.equal(css.opacity, 0.35);
  });

  it('resolves film-grain', () => {
    const pass = getCompositingPass('film-grain');
    const css = resolvePassCSS(pass);
    assert.equal(css.opacity, 0.04);
    assert.equal(css.mixBlendMode, 'overlay');
    assert.ok(css.backgroundImage);
  });

  it('resolves chromatic-softness', () => {
    const pass = getCompositingPass('chromatic-softness');
    const css = resolvePassCSS(pass);
    assert.ok(css.boxShadow);
    assert.ok(css.boxShadow.includes('rgba(255,0,0'));
    assert.ok(css.boxShadow.includes('rgba(0,0,255'));
  });

  it('resolves light-sweep', () => {
    const pass = getCompositingPass('light-sweep');
    const css = resolvePassCSS(pass);
    assert.ok(css.background);
    assert.ok(css.background.includes('linear-gradient'));
    assert.equal(css.animationDuration, '3s');
  });

  it('resolves masked-highlight', () => {
    const pass = getCompositingPass('masked-highlight');
    const css = resolvePassCSS(pass, { x_pct: 30, y_pct: 70 });
    assert.ok(css.background);
    assert.ok(css.background.includes('30%'));
    assert.ok(css.background.includes('70%'));
  });

  it('resolves shallow-dof', () => {
    const pass = getCompositingPass('shallow-dof');
    const css = resolvePassCSS(pass);
    assert.ok(css.backdropFilter);
    assert.ok(css.maskImage);
    assert.ok(css.WebkitMaskImage);
  });

  it('all resolved passes have position absolute', () => {
    for (const slug of COMPOSITING_PASS_SLUGS) {
      const pass = getCompositingPass(slug);
      const css = resolvePassCSS(pass);
      assert.equal(css.position, 'absolute', `${slug} missing position:absolute`);
      assert.equal(css.pointerEvents, 'none', `${slug} missing pointerEvents:none`);
    }
  });
});

// ── planCompositingStack ────────────────────────────────────────────────────

describe('planCompositingStack', () => {
  it('returns passes for cinematic-dark', () => {
    const { passes } = planCompositingStack('cinematic-dark');
    assert.ok(passes.length >= 3);
    const slugs = passes.map(p => p.slug);
    assert.ok(slugs.includes('vignette'));
    assert.ok(slugs.includes('film-grain'));
    assert.ok(slugs.includes('bloom'));
  });

  it('returns passes for editorial', () => {
    const { passes } = planCompositingStack('editorial');
    assert.ok(passes.length >= 1);
    const slugs = passes.map(p => p.slug);
    assert.ok(slugs.includes('vignette'));
  });

  it('returns minimal stack for neutral-light', () => {
    const { passes } = planCompositingStack('neutral-light');
    assert.ok(passes.length <= 2);
  });

  it('applies style pack adjustments', () => {
    const { passes } = planCompositingStack('cinematic-dark', 'dramatic');
    const vignette = passes.find(p => p.slug === 'vignette');
    assert.ok(vignette);
    // dramatic style pack adjusts vignette opacity to 0.45
    assert.equal(vignette.overrides.opacity, 0.45);
  });

  it('minimal style pack strips most effects', () => {
    const { passes } = planCompositingStack('cinematic-dark', 'minimal');
    const slugs = passes.map(p => p.slug);
    assert.ok(!slugs.includes('bloom'));
    assert.ok(!slugs.includes('film-grain'));
    assert.ok(!slugs.includes('shallow-dof'));
  });

  it('returns notes for unknown personality', () => {
    const { passes, notes } = planCompositingStack('unknown');
    assert.equal(passes.length, 0);
    assert.ok(notes.some(n => n.includes('No default compositing stack')));
  });

  it('each resolved pass has css property', () => {
    const { passes } = planCompositingStack('cinematic-dark');
    for (const p of passes) {
      assert.ok(p.css, `${p.slug} missing css`);
      assert.ok(p.pass, `${p.slug} missing pass definition`);
    }
  });

  it('notes art direction for future integration', () => {
    const { notes } = planCompositingStack('editorial', null, 'warm-golden');
    assert.ok(notes.some(n => n.includes('Art direction')));
  });
});

// ── scoreFinish ─────────────────────────────────────────────────────────────

describe('scoreFinish', () => {
  it('scores cinematic-dark full stack highly', () => {
    const passes = [
      { slug: 'vignette' },
      { slug: 'film-grain' },
      { slug: 'bloom' },
      { slug: 'shallow-dof' },
    ];
    const result = scoreFinish(passes, 'cinematic-dark');
    assert.ok(result.score >= 70, `Expected >=70, got ${result.score}`);
    assert.equal(result.max, 100);
  });

  it('scores empty passes poorly', () => {
    const result = scoreFinish([], 'cinematic-dark');
    assert.ok(result.score < 50, `Expected <50, got ${result.score}`);
    assert.ok(result.notes.some(n => n.includes('unfinished')));
  });

  it('penalizes bloom on editorial', () => {
    const passes = [{ slug: 'bloom' }, { slug: 'vignette' }];
    const result = scoreFinish(passes, 'editorial');
    assert.ok(result.breakdown.bloom < 0);
    assert.ok(result.notes.some(n => n.includes('not appropriate')));
  });

  it('penalizes shallow-dof on neutral-light', () => {
    const passes = [{ slug: 'shallow-dof' }];
    const result = scoreFinish(passes, 'neutral-light');
    assert.ok(result.breakdown.dof < 0);
    assert.ok(result.notes.some(n => n.includes('clarity rules')));
  });

  it('penalizes incompatible personality passes', () => {
    const passes = [{ slug: 'bloom' }]; // bloom is cinematic-dark only
    const result = scoreFinish(passes, 'montage');
    assert.ok(result.breakdown.compatibility < 30);
  });

  it('penalizes over-processing', () => {
    const passes = Array(6).fill(null).map((_, i) => ({ slug: COMPOSITING_PASS_SLUGS[i % COMPOSITING_PASS_SLUGS.length] }));
    const result = scoreFinish(passes, 'editorial');
    assert.ok(result.notes.some(n => n.includes('Over-processed')));
  });

  it('returns breakdown with all scoring categories', () => {
    const passes = [{ slug: 'vignette' }];
    const result = scoreFinish(passes, 'editorial');
    assert.ok('vignette' in result.breakdown);
    assert.ok('grain' in result.breakdown);
    assert.ok('bloom' in result.breakdown);
    assert.ok('dof' in result.breakdown);
    assert.ok('compatibility' in result.breakdown);
    assert.ok('balance' in result.breakdown);
    assert.ok('personality_match' in result.breakdown);
  });

  it('score is clamped between 0 and max', () => {
    // Extreme negative case
    const passes = [{ slug: 'bloom' }, { slug: 'shallow-dof' }];
    const result = scoreFinish(passes, 'neutral-light');
    assert.ok(result.score >= 0);
    assert.ok(result.score <= result.max);
  });
});

// ── scoreBrandFinish (MCP tool integration) ─────────────────────────────────

describe('scoreBrandFinish', () => {
  it('returns recommended stack and quality score', () => {
    const result = scoreBrandFinish({ personality: 'cinematic-dark' });
    assert.ok(result.recommended_stack);
    assert.ok(result.quality_score);
    assert.ok(Array.isArray(result.recommended_stack));
    assert.ok(result.quality_score.score >= 0);
    assert.ok(Array.isArray(result.notes));
  });

  it('recommended stack entries have name, category, css', () => {
    const result = scoreBrandFinish({ personality: 'cinematic-dark' });
    for (const entry of result.recommended_stack) {
      assert.ok(entry.slug, 'Missing slug');
      assert.ok(entry.name, 'Missing name');
      assert.ok(entry.category, 'Missing category');
      assert.ok(entry.css, 'Missing css');
    }
  });

  it('accepts style pack parameter', () => {
    const result = scoreBrandFinish({ personality: 'cinematic-dark', style_pack: 'dramatic' });
    assert.ok(result.recommended_stack.length >= 1);
  });

  it('scores custom passes when provided', () => {
    const result = scoreBrandFinish({
      personality: 'editorial',
      passes: [{ slug: 'vignette' }, { slug: 'chromatic-softness' }],
    });
    assert.ok(result.quality_score.score > 0);
  });

  it('handles unknown personality gracefully', () => {
    const result = scoreBrandFinish({ personality: 'unknown' });
    assert.equal(result.recommended_stack.length, 0);
    assert.ok(result.notes.some(n => n.includes('No default compositing stack')));
  });
});
