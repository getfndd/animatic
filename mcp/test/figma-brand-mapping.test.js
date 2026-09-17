/**
 * Tests for the Figma → brand color mapping (ANI-119).
 *
 * Pure module: every case feeds a fabricated client fetch shape (no network)
 * and asserts on the resulting brand color slots + advisory report — not on
 * "the mapper ran".
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mapToSemanticToken, mapFigmaToBrand } from '../lib/figma/brand-mapping.js';

const COLLECTIONS = {
  'C:1': { name: 'Brand', modes: [{ modeId: 'light', name: 'Light' }, { modeId: 'dark', name: 'Dark' }], defaultModeId: 'light' },
};

// ── Stage 1: name → semantic ─────────────────────────────────────────────────

describe('mapToSemanticToken', () => {
  it('direct-matches at full confidence', () => {
    assert.deepEqual(mapToSemanticToken('background'), { token: 'background', confidence: 100 });
    assert.deepEqual(mapToSemanticToken('ring'), { token: 'ring', confidence: 100 });
  });

  it('strips a collection prefix at 90', () => {
    assert.deepEqual(mapToSemanticToken('colors/primary'), { token: 'primary', confidence: 90 });
  });

  it('joins the last two parts at 85 when the last segment alone is not a key', () => {
    // "default" is not a key, but "primary/default" is → two-part join @85.
    assert.deepEqual(mapToSemanticToken('colors/primary/default'), { token: 'primary', confidence: 85 });
  });

  it('falls back to fuzzy patterns at lower confidence', () => {
    const r = mapToSemanticToken('brand-surface-base');
    assert.equal(r.token, 'background');
    assert.ok(r.confidence <= 60);
  });

  it('returns null for an unmatched name', () => {
    assert.deepEqual(mapToSemanticToken('palette/gray-300'), { token: null, confidence: 0 });
  });
});

// ── Stage 2 + integration: variables → brand slots ───────────────────────────

describe('mapFigmaToBrand (variables)', () => {
  const variables = {
    'V:1': { id: 'V:1', name: 'background', resolvedType: 'COLOR', variableCollectionId: 'C:1',
      valuesByMode: { light: { r: 1, g: 1, b: 1, a: 1 }, dark: { r: 0, g: 0, b: 0, a: 1 } } },
    'V:2': { id: 'V:2', name: 'colors/primary', resolvedType: 'COLOR', variableCollectionId: 'C:1',
      valuesByMode: { light: { r: 0.2, g: 0.4, b: 0.8, a: 1 } } },
    'V:3': { id: 'V:3', name: 'accent', resolvedType: 'COLOR', variableCollectionId: 'C:1',
      valuesByMode: { light: { r: 0.9, g: 0.9, b: 0.95, a: 1 } } },
    'V:4': { id: 'V:4', name: 'spacing/md', resolvedType: 'FLOAT', variableCollectionId: 'C:1',
      valuesByMode: { light: 8 } }, // non-color → skipped
    'V:5': { id: 'V:5', name: 'secret', resolvedType: 'COLOR', hiddenFromPublishing: true, variableCollectionId: 'C:1',
      valuesByMode: { light: { r: 0, g: 0, b: 0, a: 1 } } }, // hidden → skipped
    'V:6': { id: 'V:6', name: 'border', resolvedType: 'COLOR', variableCollectionId: 'C:1',
      valuesByMode: { light: { type: 'VARIABLE_ALIAS', id: 'V:7' } } }, // alias → V:7
    'V:7': { id: 'V:7', name: 'palette/gray-300', resolvedType: 'COLOR', variableCollectionId: 'C:1',
      valuesByMode: { light: { r: 0.8, g: 0.8, b: 0.8, a: 1 } } },
  };

  const out = mapFigmaToBrand({ enterprise: true, variables, collections: COLLECTIONS });

  it('maps semantics to the right animatic slots with light + dark values', () => {
    assert.equal(out.report.source, 'variables');
    assert.equal(out.colors.bg_primary, '#ffffff');
    assert.equal(out.darkColors.bg_primary, '#000000');
    assert.equal(out.colors.accent, '#3366cc');         // primary → accent
    assert.equal(out.colors.accent_hover, '#e6e6f2');   // accent → accent_hover (no collision)
  });

  it('resolves variable aliases to a concrete color', () => {
    assert.equal(out.colors.border, '#cccccc'); // border → alias → palette/gray-300
  });

  it('skips non-color and hidden variables', () => {
    assert.equal(out.report.mapped.some(m => m.figmaName === 'spacing/md'), false);
    assert.equal(out.report.mapped.some(m => m.figmaName === 'secret'), false);
    assert.equal(out.report.unmapped.some(u => u.figmaName === 'secret'), false);
  });

  it('reports the unmatched primitive as unmapped', () => {
    const u = out.report.unmapped.find(x => x.figmaName === 'palette/gray-300');
    assert.ok(u);
    assert.match(u.reason, /no semantic match/);
  });

  it('emits an advisory for the accent → accent_hover bridge', () => {
    assert.ok(out.report.advisories.some(a => /accent_hover/.test(a)));
  });
});

// ── Alias cycle guard ─────────────────────────────────────────────────────────

describe('mapFigmaToBrand (alias cycle)', () => {
  it('does not loop and reports a cyclic alias as unmapped', () => {
    const variables = {
      'V:1': { id: 'V:1', name: 'border', resolvedType: 'COLOR', variableCollectionId: 'C:1',
        valuesByMode: { light: { type: 'VARIABLE_ALIAS', id: 'V:2' } } },
      'V:2': { id: 'V:2', name: 'edge', resolvedType: 'COLOR', variableCollectionId: 'C:1',
        valuesByMode: { light: { type: 'VARIABLE_ALIAS', id: 'V:1' } } }, // cycle
    };
    const out = mapFigmaToBrand({ enterprise: true, variables, collections: COLLECTIONS });
    assert.equal(out.colors.border, undefined);
    assert.ok(out.report.unmapped.some(u => u.figmaName === 'border' && /alias/.test(u.reason)));
  });
});

// ── Slot conflict resolution ─────────────────────────────────────────────────

describe('mapFigmaToBrand (slot conflict)', () => {
  it('higher name-confidence wins the slot and demotes the loser', () => {
    const variables = {
      // Fuzzy "surface" → background @60 claims bg_primary first...
      'V:1': { id: 'V:1', name: 'brand-surface-base', resolvedType: 'COLOR', variableCollectionId: 'C:1',
        valuesByMode: { light: { r: 0.1, g: 0.1, b: 0.1, a: 1 } } },
      // ...then exact "background" @100 replaces it.
      'V:2': { id: 'V:2', name: 'background', resolvedType: 'COLOR', variableCollectionId: 'C:1',
        valuesByMode: { light: { r: 1, g: 1, b: 1, a: 1 } } },
    };
    const out = mapFigmaToBrand({ enterprise: true, variables, collections: COLLECTIONS });
    assert.equal(out.colors.bg_primary, '#ffffff', 'exact match wins the slot');
    assert.equal(out.report.stats.slotConflicts, 1);
    assert.ok(out.report.unmapped.some(u => u.figmaName === 'brand-surface-base'));
    assert.ok(out.report.advisories.some(a => /replaced .*brand-surface-base/.test(a) || /higher-confidence/.test(a)));
  });
});

// ── Styles fallback path ──────────────────────────────────────────────────────

describe('mapFigmaToBrand (styles fallback)', () => {
  const out = mapFigmaToBrand({
    styles: [
      { key: 'k1', node_id: '1:1', name: 'Brand/Primary', color: '#112233' },
      { key: 'k2', node_id: '1:2', name: 'Background', color: '#ffffff' },
      { key: 'k3', node_id: '1:3', name: 'Random/Thing', color: '#abcdef' },
    ],
  });

  it('maps fill styles by name and flags the source', () => {
    assert.equal(out.report.source, 'styles');
    assert.equal(out.colors.accent, '#112233');     // Brand/Primary → primary → accent
    assert.equal(out.colors.bg_primary, '#ffffff');
  });

  it('reports unmatched style names as unmapped', () => {
    assert.ok(out.report.unmapped.some(u => u.figmaName === 'Random/Thing'));
    assert.equal(out.report.stats.mappedToSlot, 2);
  });
});

// ── Advisory: finance-specific destructive bridge ────────────────────────────

describe('mapFigmaToBrand (destructive advisory)', () => {
  it('bridges destructive → trend_down with an advisory', () => {
    const out = mapFigmaToBrand({ styles: [{ name: 'destructive', color: '#cc0000' }] });
    assert.equal(out.colors.trend_down, '#cc0000');
    assert.ok(out.report.advisories.some(a => /trend_down/.test(a) && /finance/.test(a)));
  });
});
