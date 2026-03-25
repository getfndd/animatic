/**
 * Tests for cross-scene continuity system.
 *
 * Covers: resolveContinuityLinks, suggestMatchCuts, planContinuityLinks,
 * validateContinuityChain.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveContinuityLinks,
  suggestMatchCuts,
  planContinuityLinks,
  validateContinuityChain,
} from '../lib/continuity.js';

// ── Test fixtures ────────────────────────────────────────────────────────────

const manifest2Scene = {
  sequence_id: 'seq_continuity_test',
  scenes: [
    { scene: 'sc_prompt', duration_s: 3 },
    { scene: 'sc_result', duration_s: 4, transition_in: { type: 'crossfade', duration_ms: 400 } },
  ],
};

const sceneDefs2 = [
  {
    scene_id: 'sc_prompt',
    layers: [
      { id: 'ly_chip', type: 'html', continuity_id: 'prompt_chip', slot: 'hero' },
      { id: 'ly_bg', type: 'image', depth_class: 'background' },
    ],
  },
  {
    scene_id: 'sc_result',
    layers: [
      { id: 'ly_search', type: 'html', continuity_id: 'prompt_chip', slot: 'hero' },
      { id: 'ly_cards', type: 'card_conveyor' },
    ],
  },
];

const manifest3Scene = {
  sequence_id: 'seq_three',
  scenes: [
    { scene: 'sc_a', duration_s: 3 },
    { scene: 'sc_b', duration_s: 3, transition_in: { type: 'crossfade', duration_ms: 400 } },
    { scene: 'sc_c', duration_s: 3, transition_in: { type: 'crossfade', duration_ms: 400 } },
  ],
};

const sceneDefs3 = [
  {
    scene_id: 'sc_a',
    layers: [
      { id: 'ly_title', type: 'text', content: 'Hello world' },
      { id: 'ly_card', type: 'html', slot: 'hero' },
    ],
  },
  {
    scene_id: 'sc_b',
    layers: [
      { id: 'ly_heading', type: 'text', content: 'Hello world updated' },
      { id: 'ly_panel', type: 'html', slot: 'hero' },
    ],
  },
  {
    scene_id: 'sc_c',
    layers: [
      { id: 'ly_outro', type: 'text', content: 'Goodbye' },
    ],
  },
];

// ── resolveContinuityLinks ───────────────────────────────────────────────────

describe('resolveContinuityLinks', () => {
  it('finds matching continuity_ids across adjacent scenes', () => {
    const links = resolveContinuityLinks(manifest2Scene, sceneDefs2);
    assert.equal(links.length, 1);
    assert.equal(links[0].continuity_id, 'prompt_chip');
    assert.equal(links[0].from_scene, 'sc_prompt');
    assert.equal(links[0].to_scene, 'sc_result');
    assert.equal(links[0].from_layer.id, 'ly_chip');
    assert.equal(links[0].to_layer.id, 'ly_search');
  });

  it('suggests card_to_panel for html→html transitions', () => {
    const links = resolveContinuityLinks(manifest2Scene, sceneDefs2);
    assert.equal(links[0].suggested_strategy, 'card_to_panel');
  });

  it('returns empty array for scenes without continuity_ids', () => {
    const links = resolveContinuityLinks(manifest3Scene, sceneDefs3);
    assert.equal(links.length, 0);
  });

  it('handles null/undefined inputs gracefully', () => {
    assert.deepEqual(resolveContinuityLinks(null, null), []);
    assert.deepEqual(resolveContinuityLinks({}, []), []);
  });
});

// ── suggestMatchCuts ─────────────────────────────────────────────────────────

describe('suggestMatchCuts', () => {
  it('identifies potential match cuts between similar layers', () => {
    const suggestions = suggestMatchCuts(manifest3Scene, sceneDefs3);
    assert.ok(suggestions.length > 0, 'should find at least one suggestion');

    // The text layers with similar content and the html layers with same slot should match
    const textMatch = suggestions.find(s =>
      s.from_layer.type === 'text' && s.to_layer.type === 'text'
    );
    assert.ok(textMatch, 'should find text→text match');
    assert.ok(textMatch.similarity >= 0.4, 'similarity should be >= 0.4');
  });

  it('returns suggestions sorted by similarity descending', () => {
    const suggestions = suggestMatchCuts(manifest3Scene, sceneDefs3);
    for (let i = 1; i < suggestions.length; i++) {
      assert.ok(suggestions[i].similarity <= suggestions[i - 1].similarity,
        'should be sorted descending');
    }
  });

  it('skips layers that already have continuity_ids', () => {
    const suggestions = suggestMatchCuts(manifest2Scene, sceneDefs2);
    // Both ly_chip and ly_search have continuity_id, so they should be skipped
    const chipMatch = suggestions.find(s =>
      s.from_layer.id === 'ly_chip' || s.to_layer.id === 'ly_search'
    );
    assert.equal(chipMatch, undefined, 'should skip layers with existing continuity_ids');
  });

  it('returns empty array for null inputs', () => {
    assert.deepEqual(suggestMatchCuts(null, null), []);
  });
});

// ── planContinuityLinks ──────────────────────────────────────────────────────

describe('planContinuityLinks', () => {
  it('auto-assigns continuity_ids to matching layers', () => {
    const result = planContinuityLinks(manifest3Scene, sceneDefs3, { auto_assign_ids: true });

    // Check that at least some layers got continuity_ids
    const allLayers = result.scenes.flatMap(s => s.layers || []);
    const tagged = allLayers.filter(l => l.continuity_id);
    assert.ok(tagged.length > 0, 'should auto-assign at least one continuity_id');
  });

  it('adds transition_in.match configs to manifest', () => {
    const result = planContinuityLinks(manifest3Scene, sceneDefs3, { auto_assign_ids: true });

    // Check that at least one scene got a match config
    const withMatch = result.manifest.scenes.filter(s => s.transition_in?.match);
    assert.ok(withMatch.length > 0, 'should add match config to at least one scene');
  });

  it('does not mutate original inputs', () => {
    const origManifest = JSON.parse(JSON.stringify(manifest3Scene));
    const origScenes = JSON.parse(JSON.stringify(sceneDefs3));

    planContinuityLinks(manifest3Scene, sceneDefs3);

    assert.deepEqual(manifest3Scene, origManifest, 'manifest should not be mutated');
    assert.deepEqual(sceneDefs3, origScenes, 'sceneDefs should not be mutated');
  });

  it('respects preferred_strategies option', () => {
    const result = planContinuityLinks(manifest3Scene, sceneDefs3, {
      auto_assign_ids: true,
      preferred_strategies: ['position'],
    });

    const matchConfigs = result.manifest.scenes
      .filter(s => s.transition_in?.match)
      .map(s => s.transition_in.match);

    for (const m of matchConfigs) {
      assert.equal(m.strategy, 'position', 'should use preferred strategy');
    }
  });

  it('preserves existing continuity_ids', () => {
    const result = planContinuityLinks(manifest2Scene, sceneDefs2, { auto_assign_ids: true });

    const chipLayer = result.scenes[0].layers.find(l => l.id === 'ly_chip');
    assert.equal(chipLayer.continuity_id, 'prompt_chip', 'existing id should be preserved');
  });
});

// ── validateContinuityChain ──────────────────────────────────────────────────

describe('validateContinuityChain', () => {
  it('validates a correct continuity chain', () => {
    const manifest = {
      sequence_id: 'seq_valid',
      scenes: [
        { scene: 'sc_a', duration_s: 3 },
        {
          scene: 'sc_b', duration_s: 3,
          transition_in: {
            type: 'crossfade', duration_ms: 400,
            match: { source_continuity_id: 'prompt_chip', strategy: 'card_to_panel' },
          },
        },
      ],
    };

    const result = validateContinuityChain(manifest, sceneDefs2);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
    assert.equal(result.errors.length, 0);
  });

  it('catches broken source_continuity_id references', () => {
    const manifest = {
      sequence_id: 'seq_broken',
      scenes: [
        { scene: 'sc_a', duration_s: 3 },
        {
          scene: 'sc_b', duration_s: 3,
          transition_in: {
            type: 'crossfade', duration_ms: 400,
            match: { source_continuity_id: 'nonexistent', strategy: 'position' },
          },
        },
      ],
    };

    const result = validateContinuityChain(manifest, sceneDefs2);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('nonexistent')));
  });

  it('errors when match is on first scene', () => {
    const manifest = {
      sequence_id: 'seq_first',
      scenes: [
        {
          scene: 'sc_a', duration_s: 3,
          transition_in: {
            type: 'crossfade', duration_ms: 400,
            match: { source_continuity_id: 'chip', strategy: 'position' },
          },
        },
        { scene: 'sc_b', duration_s: 3 },
      ],
    };

    const result = validateContinuityChain(manifest, sceneDefs2);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('first scene')));
  });

  it('warns about content_morph on non-text layers', () => {
    const manifest = {
      sequence_id: 'seq_warn',
      scenes: [
        { scene: 'sc_a', duration_s: 3 },
        {
          scene: 'sc_b', duration_s: 3,
          transition_in: {
            type: 'crossfade', duration_ms: 400,
            match: { source_continuity_id: 'prompt_chip', strategy: 'content_morph' },
          },
        },
      ],
    };

    const result = validateContinuityChain(manifest, sceneDefs2);
    // Valid but with warnings since html→html is not ideal for content_morph
    assert.equal(result.valid, true);
    assert.ok(result.warnings.length > 0, 'should produce warnings');
    assert.ok(result.warnings.some(w => w.includes('content_morph')));
  });

  it('handles null inputs gracefully', () => {
    const result = validateContinuityChain(null, null);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });
});
