/**
 * ANI-137 — MCP motion tools (lookup, search, validation, coverage).
 *
 * Tests the four pure functions in mcp/lib/motion-tools.js against the real
 * catalog/motion-recipes.json (ANI-134), plus a temp fixture for the coverage
 * scanner.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  getMotionRecipe,
  searchMotionRecipes,
  validateMotionToken,
  auditMotionCoverage,
  MOTION_RULES,
} from '../lib/motion-tools.js';
import { registerPersonality, unregisterPersonality } from '../lib/personality.js';

describe('get_motion_recipe', () => {
  it('returns the full recipe for a valid id', () => {
    const { recipe } = getMotionRecipe({ recipe_id: 'enter.fade-up' });
    assert.equal(recipe.id, 'enter.fade-up');
    assert.ok(recipe.tokens && recipe.accessibility_fallback, 'full record returned');
  });

  it('errors on a missing or absent id', () => {
    assert.ok(getMotionRecipe({ recipe_id: 'nope.not-real' }).error);
    assert.ok(getMotionRecipe({}).error);
  });
});

describe('search_motion_recipes', () => {
  it('ranks an entrance/card query with enter.fade-up on top', () => {
    const { matches } = searchMotionRecipes({ intent: 'element appearing on scroll', context: 'card' });
    assert.ok(matches.length > 0);
    assert.equal(matches[0].recipe_id, 'enter.fade-up');
    assert.ok(matches[0].score > 0 && matches[0].reason);
  });

  it('respects the spring_physics guardrail: montage excludes spring/framer-only recipes', () => {
    const { matches, excluded } = searchMotionRecipes({ context: 'input', personality: 'montage' });
    // state.error is framer-only (spring) → excluded for montage, and reported.
    assert.ok((excluded || []).some(e => e.recipe_id === 'state.error'),
      'spring recipe excluded + reported, not silently dropped');
    assert.ok(!matches.some(m => m.recipe_id === 'state.error'));
  });

  it('does not exclude spring recipes for personalities that permit them (editorial)', () => {
    const { excluded } = searchMotionRecipes({ context: 'input', personality: 'editorial' });
    assert.ok(!(excluded || []).some(e => e.recipe_id === 'state.error'));
  });

  it('custom personality with derived spring ban excludes spring recipes (ANI-171)', () => {
    // Restrained motion without 'spring' in speed_hierarchy derives a
    // spring_physics ban. The old static-catalog read silently skipped this.
    const slug = 'test-mt-no-spring';
    registerPersonality({
      name: 'No Spring', slug,
      characteristics: { motion_intensity: 'restrained' },
      camera_behavior: { mode: '2d-only' },
    }, { persist: false });
    try {
      const { matches, excluded } = searchMotionRecipes({ context: 'input', personality: slug });
      assert.ok((excluded || []).some(e => e.recipe_id === 'state.error'),
        'custom spring ban must exclude framer-only recipes');
      assert.ok(!matches.some(m => m.recipe_id === 'state.error'));
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('unknown personality slug errors instead of silently returning unfiltered results (ANI-171 review)', () => {
    // With the enum gone, the registry gate is the only validation — a typo
    // must not skip the spring filter and pretend everything matched.
    const result = searchMotionRecipes({ context: 'input', personality: 'never-registered' });
    assert.ok(result.error, 'unknown slug must error');
    assert.match(result.error, /Unknown personality "never-registered"/);
    assert.match(result.error, /cinematic-dark/, 'error lists valid slugs');
    assert.equal(result.matches, undefined, 'no results leak past the gate');
  });

  it('custom personality that allows spring does not exclude (ANI-171)', () => {
    const slug = 'test-mt-spring-ok';
    registerPersonality({
      name: 'Springy', slug,
      characteristics: { motion_intensity: 'dramatic' },
      camera_behavior: { mode: 'full-3d' },
    }, { persist: false });
    try {
      const { excluded } = searchMotionRecipes({ context: 'input', personality: slug });
      assert.ok(!(excluded || []).some(e => e.recipe_id === 'state.error'));
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('lists recipes for an empty query (discovery)', () => {
    const { matches } = searchMotionRecipes({});
    assert.equal(matches.length, 6, 'all catalog recipes listed');
  });

  it('context matching is word-boundary, not substring', () => {
    // "cardiac" must NOT hit the "card" context (the substring false positive).
    const cardiac = searchMotionRecipes({ context: 'cardiac' });
    assert.ok(!cardiac.matches.some(m => m.reason.includes('context')),
      'cardiac should not match card-context recipes');
    // but "modal" still matches "modal-body" (hyphen is a boundary).
    const modal = searchMotionRecipes({ context: 'modal' });
    assert.ok(modal.matches.some(m => m.recipe_id === 'enter.fade-up'),
      'modal should still match the modal-body context');
  });
});

describe('validate_motion_token', () => {
  it('flags raw duration and easing, and is invalid', () => {
    const r = validateMotionToken({ usage: { duration: '0.3s', easing: 'ease-out' } });
    assert.equal(r.valid, false);
    const rules = r.issues.map(i => i.rule);
    assert.ok(rules.includes('raw_duration'));
    assert.ok(rules.includes('raw_easing'));
  });

  it('passes token-based usage', () => {
    const r = validateMotionToken({ usage: { duration: 'var(--duration-quick)', easing: 'var(--ease-out-quart)' } });
    assert.equal(r.valid, true);
    assert.equal(r.issues.filter(i => i.severity !== 'suggestion').length, 0);
  });

  it('suggests a matching recipe (advisory, does not invalidate on its own)', () => {
    const r = validateMotionToken({ usage: { properties: ['opacity', 'transform'] } });
    const match = r.issues.find(i => i.rule === 'recipe_match');
    assert.ok(match, 'recipe_match suggestion present');
    assert.equal(match.severity, 'suggestion');
    assert.equal(r.valid, true, 'a suggestion alone keeps the usage valid');
  });

  it('normalizes Framer-style x/y/scale properties for recipe_match', () => {
    // ["opacity","y"] is the Framer notation for an opacity+transform recipe;
    // it must still surface a recipe_match (the un-normalized bug missed it).
    const r = validateMotionToken({ usage: { properties: ['opacity', 'y'] } });
    assert.ok(r.issues.some(i => i.rule === 'recipe_match'),
      'opacity+y should match a transform-based recipe');
  });

  it('errors when usage is absent', () => {
    assert.ok(validateMotionToken({}).error);
  });

  it('exposes the canonical rule vocabulary for ANI-135 to reuse', () => {
    assert.deepEqual(Object.keys(MOTION_RULES).sort(), ['raw_duration', 'raw_easing', 'recipe_match']);
  });
});

describe('audit_motion_coverage', () => {
  let dir;
  before(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'ani137-'));
    mkdirSync(resolve(dir, 'sub'));
    // raw values only
    writeFileSync(resolve(dir, 'legacy.css'), '.a { transition: 0.3s ease-out; } .b { animation: x 250ms cubic-bezier(0.2,0,0,1); }');
    // token + recipe adoption
    writeFileSync(resolve(dir, 'sub', 'good.tsx'), 'const v = useMotionRecipe("enter.fade-up");\nconst d = "var(--duration-quick)"; const e = "var(--ease-out-quart)";');
    // no motion → skipped
    writeFileSync(resolve(dir, 'noise.ts'), 'export const x = 1;');
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('counts raw durations/easings and recipe usage, with a coverage percent', () => {
    const r = auditMotionCoverage({ path: dir });
    assert.ok(r.raw_durations >= 2, `raw durations counted (${r.raw_durations})`);
    assert.ok(r.raw_easings >= 2, `raw easings counted (${r.raw_easings})`);
    assert.ok(r.using_recipes >= 3, `token/recipe usage counted (${r.using_recipes})`);
    assert.ok(r.coverage_percent > 0 && r.coverage_percent < 100);
    assert.ok(r.by_file.length >= 2, 'per-file breakdown, noise file excluded');
    assert.ok(/minimal/i.test(r.scope), 'output flags it is the minimal scanner');
  });

  it('errors on a missing path', () => {
    assert.ok(auditMotionCoverage({ path: resolve(dir, 'does-not-exist') }).error);
    assert.ok(auditMotionCoverage({}).error);
  });
});
