/**
 * ANI-152 — gaps surfaced during marketing-site UI-storyboard design.
 *
 * Covers the 7 fixes:
 *   P1  get_primitive crash (loader array-spread; phantom undefined key)
 *   P2  recommend_ui_storyboard_layout (product-UI surface patterns)
 *   P3  better recommend_choreography rejection tip
 *   P3  feature-walkthrough intent
 *   P3  ui-walkthrough brief template
 *   P3  recommend_personality_for_context
 *   P3  editorial-layout video-vs-UI scope (tool registration + keywords)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadPrimitivesCatalog, loadIntentMappings, loadBriefTemplates } from '../data/loader.js';
import { recommendCompanionEntrances } from '../lib/choreography.js';
import {
  recommendUiStoryboardLayout,
  recommendPersonalityForContext,
  UI_SURFACE_KEYWORDS,
} from '../lib/recommend-layout.js';
import { buildTools } from '../tools.js';

describe('ANI-152 P1 — primitives catalog loads array-shaped compound files', () => {
  const cat = loadPrimitivesCatalog();

  it('has no slug-less `undefined` entry (the get_primitive crash source)', () => {
    assert.equal(cat.bySlug.has(undefined), false);
  });

  it('registers primitives from array-shaped compound files (hero-moments, collage-boards)', () => {
    // Before the fix these arrays were pushed whole and never registered by slug.
    assert.ok(cat.bySlug.has('mo-text-hero'), 'hero-moments primitives should be registered');
    assert.ok(cat.bySlug.has('bd-moodboard'), 'collage-boards primitives should be registered');
  });

  it('every catalog entry carries a slug', () => {
    for (const [slug, entry] of cat.bySlug) {
      assert.equal(typeof slug, 'string');
      assert.equal(entry.slug, slug);
    }
  });
});

describe('ANI-152 P3 — feature-walkthrough intent', () => {
  const intents = loadIntentMappings();

  it('exists and supports the two light-register personalities', () => {
    const fw = intents.byIntent.get('feature-walkthrough');
    assert.ok(fw, 'feature-walkthrough intent should exist');
    assert.deepEqual([...fw.personality_support].sort(), ['editorial', 'neutral-light']);
  });

  it('surfaces companion primitives through the choreography layer for editorial', () => {
    const prims = recommendCompanionEntrances('feature-walkthrough', 'editorial');
    assert.ok(prims.length > 0, 'should return editorial-affine companions');
    assert.ok(prims.includes('ed-phase-transition'), 'state-cycling companion present');
    assert.ok(!prims.includes('nl-slide-stagger'), 'neutral-light-only primitive filtered out for editorial');
  });
});

describe('ANI-152 P3 — ui-walkthrough brief template', () => {
  const templates = loadBriefTemplates();

  it('exists with a marketing (non-teaching) shape and a short default duration', () => {
    const t = templates.byId.get('ui-walkthrough');
    assert.ok(t, 'ui-walkthrough template should exist');
    assert.deepEqual(t.sections.map(s => s.label), ['Hook', 'State', 'Close']);
    assert.ok(t.defaults.duration_target_s <= 20, 'short marketing-explainer duration');
    const stateSection = t.sections.find(s => s.label === 'State');
    assert.ok(stateSection.repeat, 'State section repeats per product surface');
  });
});

describe('ANI-152 P2 — recommend_ui_storyboard_layout', () => {
  it('matches a split-pane app description to split-pane-app', () => {
    const r = recommendUiStoryboardLayout({
      content_description: 'Window chrome with a left source tree rail and a main scan-progress panel and a bottom status bar',
      personality: 'editorial',
    });
    assert.equal(r.recommended_pattern, 'split-pane-app');
    assert.match(r.scope, /not video canvas/i);
    assert.ok(r.all_patterns.length === 5);
  });

  it('matches a table/records description to table-with-detail-rail', () => {
    const r = recommendUiStoryboardLayout({ content_description: 'A table of results rows with a selected-row detail' });
    assert.equal(r.recommended_pattern, 'table-with-detail-rail');
  });

  it('falls back to split-pane-app when nothing matches', () => {
    const r = recommendUiStoryboardLayout({ content_description: 'a sunset over the ocean' });
    assert.equal(r.recommended_pattern, 'split-pane-app');
  });

  it('does not score "row" inside "browser" (word-boundary matching)', () => {
    const r = recommendUiStoryboardLayout({ content_description: 'a plain web browser window' });
    const tableScore = r.all_patterns.find(p => p.name === 'table-with-detail-rail').match_score;
    assert.equal(tableScore, 0, '"browser" must not trigger table-with-detail-rail via the "row" substring');
    assert.equal(r.recommended_pattern, 'split-pane-app');
  });
});

describe('ANI-152 P3 — recommend_personality_for_context', () => {
  it('recommends editorial for a marketing UI explainer', () => {
    const r = recommendPersonalityForContext({
      context: 'marketing-site feature explainer cycling product-ui states, editorial museum register',
    });
    assert.equal(r.recommended_personality, 'editorial');
    assert.equal(r.ranked.length, 4);
    assert.equal(r.comparison.length, 4);
  });

  it('recommends neutral-light for a step-by-step tutorial', () => {
    const r = recommendPersonalityForContext({ context: 'onboarding tutorial that teaches each step with a guide' });
    assert.equal(r.recommended_personality, 'neutral-light');
  });

  it('recommends cinematic-dark for a dramatic launch film', () => {
    const r = recommendPersonalityForContext({ context: 'dramatic premium product launch hero reveal, cinematic and bold' });
    assert.equal(r.recommended_personality, 'cinematic-dark');
  });

  it('errors when no context is given', () => {
    assert.ok(recommendPersonalityForContext({}).error);
  });

  it('does not match "light" inside "highlights" (word-boundary matching)', () => {
    const r = recommendPersonalityForContext({ context: 'fast-paced highlights sizzle reel' });
    assert.equal(r.recommended_personality, 'montage');
    const editorial = r.ranked.find(x => x.personality === 'editorial');
    assert.ok(!editorial.matched_signals.includes('light'),
      '"light" must not match inside "highlights"');
  });
});

describe('ANI-152 — UI-surface keyword set + tool registration', () => {
  it('UI_SURFACE_KEYWORDS covers the canonical app-surface terms', () => {
    for (const kw of ['rail', 'panel', 'toolbar', 'status bar', 'window']) {
      assert.ok(UI_SURFACE_KEYWORDS.includes(kw), `expected keyword: ${kw}`);
    }
  });

  it('both new tools are registered in the MCP tool list', () => {
    const tools = buildTools({
      STYLE_PACKS: [],
      intentMappings: { array: [] },
      briefTemplatesCatalog: { array: [] },
      getAllPersonalitySlugs: () => [],
      ART_DIRECTION_SLUGS: [],
      COMPOSITING_PASS_SLUGS: [],
      listReferenceDocs: () => [],
    });
    const names = new Set(tools.map(t => t.name));
    assert.ok(names.has('recommend_ui_storyboard_layout'));
    assert.ok(names.has('recommend_personality_for_context'));
    // editorial-layout description now declares its video-canvas scope
    const editorial = tools.find(t => t.name === 'recommend_editorial_layout');
    assert.match(editorial.description, /video canvas only/i);
  });
});
