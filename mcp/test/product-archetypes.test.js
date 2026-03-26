/**
 * Product archetype resolver + camera intent tests.
 *
 * Run: node --test mcp/test/product-archetypes.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getProductArchetype,
  listProductArchetypes,
  recommendProductArchetype,
  getCameraIntent,
  listCameraIntents,
  scoreProductDemoClarity,
  PRODUCT_ARCHETYPE_SLUGS,
  CAMERA_INTENT_SLUGS,
} from '../lib/product-archetypes.js';

// ── Catalog loading ─────────────────────────────────────────────────────────

describe('PRODUCT_ARCHETYPE_SLUGS', () => {
  it('has 6 product archetypes', () => {
    assert.equal(PRODUCT_ARCHETYPE_SLUGS.length, 6);
  });

  it('includes expected slugs', () => {
    const expected = [
      'empty-to-filled',
      'query-to-result',
      'list-to-detail',
      'dashboard-drilldown',
      'upload-process-success',
      'compare-before-after',
    ];
    for (const slug of expected) {
      assert.ok(PRODUCT_ARCHETYPE_SLUGS.includes(slug), `Missing: ${slug}`);
    }
  });
});

describe('CAMERA_INTENT_SLUGS', () => {
  it('has 6 camera intents', () => {
    assert.equal(CAMERA_INTENT_SLUGS.length, 6);
  });

  it('includes expected slugs', () => {
    const expected = ['inspect', 'compare', 'confirm', 'spotlight', 'reveal', 'recap'];
    for (const slug of expected) {
      assert.ok(CAMERA_INTENT_SLUGS.includes(slug), `Missing: ${slug}`);
    }
  });
});

// ── getProductArchetype ─────────────────────────────────────────────────────

describe('getProductArchetype', () => {
  it('returns archetype by slug', () => {
    const a = getProductArchetype('empty-to-filled');
    assert.ok(a);
    assert.equal(a.name, 'Empty to Filled State');
    assert.ok(a.phases.length >= 3);
    assert.ok(a.duration_range.min_s < a.duration_range.max_s);
  });

  it('returns null for unknown slug', () => {
    assert.equal(getProductArchetype('nonexistent'), null);
  });

  it('each archetype has required fields', () => {
    for (const slug of PRODUCT_ARCHETYPE_SLUGS) {
      const a = getProductArchetype(slug);
      assert.ok(a.slug, `${slug} missing slug`);
      assert.ok(a.name, `${slug} missing name`);
      assert.ok(a.description, `${slug} missing description`);
      assert.ok(a.phases.length >= 3, `${slug} needs at least 3 phases`);
      assert.ok(a.recommended_primitives.length > 0, `${slug} needs recommended primitives`);
      assert.ok(a.personalities.length > 0, `${slug} needs personalities`);
      assert.ok(a.when_to_use.length > 0, `${slug} needs when_to_use`);
      assert.ok(a.when_to_avoid.length > 0, `${slug} needs when_to_avoid`);
    }
  });

  it('phase percentages sum to 1.0', () => {
    for (const slug of PRODUCT_ARCHETYPE_SLUGS) {
      const a = getProductArchetype(slug);
      const total = a.phases.reduce((sum, p) => sum + p.pct, 0);
      assert.ok(
        Math.abs(total - 1.0) < 0.01,
        `${slug} phase pcts sum to ${total}, expected 1.0`
      );
    }
  });

  it('phase camera_intents reference valid intents', () => {
    for (const slug of PRODUCT_ARCHETYPE_SLUGS) {
      const a = getProductArchetype(slug);
      for (const phase of a.phases) {
        assert.ok(
          CAMERA_INTENT_SLUGS.includes(phase.camera_intent),
          `${slug} phase "${phase.id}" references unknown intent "${phase.camera_intent}"`
        );
      }
    }
  });
});

// ── listProductArchetypes ───────────────────────────────────────────────────

describe('listProductArchetypes', () => {
  it('returns all archetypes with no filter', () => {
    const all = listProductArchetypes();
    assert.equal(all.length, 6);
  });

  it('filters by personality', () => {
    const editorial = listProductArchetypes({ personality: 'editorial' });
    assert.ok(editorial.length > 0);
    for (const a of editorial) {
      assert.ok(
        a.personalities.includes('editorial'),
        `${a.slug} should include editorial`
      );
    }
  });

  it('returns empty for unknown personality', () => {
    const none = listProductArchetypes({ personality: 'nonexistent' });
    assert.equal(none.length, 0);
  });
});

// ── recommendProductArchetype ───────────────────────────────────────────────

describe('recommendProductArchetype', () => {
  it('matches empty state description to empty-to-filled', () => {
    const results = recommendProductArchetype(
      'Show an empty dashboard being populated with chart data'
    );
    assert.ok(results.length > 0);
    assert.equal(results[0].archetype.slug, 'empty-to-filled');
  });

  it('matches search/query description to query-to-result', () => {
    const results = recommendProductArchetype(
      'User types a search query and results appear'
    );
    assert.ok(results.length > 0);
    const slugs = results.map(r => r.archetype.slug);
    assert.ok(slugs.includes('query-to-result'));
  });

  it('matches upload description to upload-process-success', () => {
    const results = recommendProductArchetype(
      'File upload with progress bar and success confirmation'
    );
    assert.ok(results.length > 0);
    const slugs = results.map(r => r.archetype.slug);
    assert.ok(slugs.includes('upload-process-success'));
  });

  it('returns at most 3 results', () => {
    const results = recommendProductArchetype(
      'data chart dashboard list detail compare upload'
    );
    assert.ok(results.length <= 3);
  });

  it('returns empty array for null/empty input', () => {
    assert.deepEqual(recommendProductArchetype(null), []);
    assert.deepEqual(recommendProductArchetype(''), []);
  });
});

// ── getCameraIntent ─────────────────────────────────────────────────────────

describe('getCameraIntent', () => {
  it('returns intent by slug', () => {
    const intent = getCameraIntent('spotlight');
    assert.ok(intent);
    assert.equal(intent.name, 'Spotlight');
    assert.equal(intent.camera.move, 'push_in');
  });

  it('returns null for unknown slug', () => {
    assert.equal(getCameraIntent('nonexistent'), null);
  });

  it('each intent has required fields', () => {
    for (const slug of CAMERA_INTENT_SLUGS) {
      const i = getCameraIntent(slug);
      assert.ok(i.slug, `${slug} missing slug`);
      assert.ok(i.name, `${slug} missing name`);
      assert.ok(i.description, `${slug} missing description`);
      assert.ok(i.camera, `${slug} missing camera`);
      assert.ok(typeof i.camera.move === 'string', `${slug} camera.move must be string`);
      assert.ok(typeof i.camera.intensity === 'number', `${slug} camera.intensity must be number`);
      assert.ok(i.transition_in, `${slug} missing transition_in`);
      assert.ok(typeof i.transition_duration_ms === 'number', `${slug} missing transition_duration_ms`);
      assert.ok(i.pacing, `${slug} missing pacing`);
      assert.ok(i.when_to_use, `${slug} missing when_to_use`);
    }
  });
});

// ── listCameraIntents ───────────────────────────────────────────────────────

describe('listCameraIntents', () => {
  it('returns all 6 intents', () => {
    const all = listCameraIntents();
    assert.equal(all.length, 6);
  });

  it('returns copies (not references)', () => {
    const a = listCameraIntents();
    const b = listCameraIntents();
    assert.notStrictEqual(a, b);
  });
});

// ── scoreProductDemoClarity ─────────────────────────────────────────────────

describe('scoreProductDemoClarity', () => {
  it('returns 0 for empty scenes', () => {
    const result = scoreProductDemoClarity({}, []);
    assert.equal(result.score, 0);
    assert.equal(result.max, 100);
    assert.ok(result.warnings.length > 0);
  });

  it('scores a well-structured product demo highly', () => {
    const scenes = [
      {
        id: 'sc_01',
        role: 'empty_state',
        duration_s: 3,
        energy: 'low',
        camera: { move: 'static' },
        camera_intent: 'inspect',
        layers: [
          { type: 'cursor', timing: { delay_ms: 500 } },
        ],
        transition_in: { type: 'crossfade' },
      },
      {
        id: 'sc_02',
        role: 'user_action',
        duration_s: 2,
        energy: 'medium',
        camera: { move: 'push_in' },
        camera_intent: 'spotlight',
        layers: [
          { type: 'text', animation: 'typewriter' },
          { type: 'cursor', timing: { delay_ms: 200 } },
        ],
        transition_in: { type: 'crossfade' },
      },
      {
        id: 'sc_03',
        role: 'data_reveal',
        duration_s: 4,
        energy: 'high',
        camera: { move: 'pull_out' },
        camera_intent: 'reveal',
        layers: [
          { type: 'data', role: 'content' },
        ],
        transition_in: { type: 'hard_cut' },
      },
      {
        id: 'sc_04',
        role: 'context',
        duration_s: 3,
        energy: 'low',
        camera: { move: 'breathe' },
        camera_intent: 'confirm',
        layers: [],
        transition_in: { type: 'crossfade' },
      },
    ];

    const result = scoreProductDemoClarity({}, scenes);
    assert.ok(result.score >= 60, `Expected >= 60, got ${result.score}`);
    assert.equal(result.max, 100);
    assert.equal(result.breakdown.length, 4);
  });

  it('penalizes scenes with no interactions', () => {
    const scenes = [
      { id: 'sc_01', duration_s: 4, camera: { move: 'static' }, layers: [] },
      { id: 'sc_02', duration_s: 4, camera: { move: 'static' }, layers: [] },
      { id: 'sc_03', duration_s: 4, camera: { move: 'static' }, layers: [] },
    ];

    const result = scoreProductDemoClarity({}, scenes);
    assert.ok(result.warnings.some(w => w.includes('interaction')));
  });

  it('warns when all camera moves are the same', () => {
    const scenes = [
      { id: 'sc_01', duration_s: 4, camera: { move: 'static' }, layers: [] },
      { id: 'sc_02', duration_s: 4, camera: { move: 'static' }, layers: [] },
      { id: 'sc_03', duration_s: 4, camera: { move: 'static' }, layers: [] },
    ];

    const result = scoreProductDemoClarity({}, scenes);
    assert.ok(result.warnings.some(w => w.includes('same camera move')));
  });

  it('warns when camera intent mismatches camera move', () => {
    const scenes = [
      {
        id: 'sc_01',
        duration_s: 4,
        camera: { move: 'push_in' },
        camera_intent: 'inspect', // inspect expects static, not push_in
        layers: [],
      },
      {
        id: 'sc_02',
        duration_s: 4,
        camera: { move: 'static' },
        camera_intent: 'reveal', // reveal expects pull_out, not static
        layers: [],
      },
    ];

    const result = scoreProductDemoClarity({}, scenes);
    assert.ok(result.warnings.some(w => w.includes('declared intent')));
  });

  it('breakdown has 4 dimensions', () => {
    const scenes = [
      { id: 'sc_01', duration_s: 4, camera: { move: 'static' }, layers: [] },
    ];
    const result = scoreProductDemoClarity({}, scenes);
    const dims = result.breakdown.map(b => b.dimension);
    assert.ok(dims.includes('interaction_truthfulness'));
    assert.ok(dims.includes('camera_intent_consistency'));
    assert.ok(dims.includes('pacing_variety'));
    assert.ok(dims.includes('clear_hierarchy'));
  });

  it('score never exceeds max', () => {
    const scenes = [
      {
        id: 'sc_01', role: 'a', duration_s: 3, energy: 'low',
        camera: { move: 'static' }, camera_intent: 'inspect',
        layers: [{ type: 'cursor', timing: {} }, { type: 'text', animation: 'typewriter' }],
        interaction_sequence: true, transition_in: { type: 'crossfade' },
      },
      {
        id: 'sc_02', role: 'b', duration_s: 5, energy: 'high',
        camera: { move: 'push_in' }, camera_intent: 'spotlight',
        layers: [{ type: 'cursor', timing: {} }],
        transition_in: { type: 'hard_cut' },
      },
      {
        id: 'sc_03', role: 'c', duration_s: 4, energy: 'medium',
        camera: { move: 'pull_out' }, camera_intent: 'reveal',
        layers: [], transition_in: { type: 'crossfade' },
      },
    ];
    const result = scoreProductDemoClarity({}, scenes);
    assert.ok(result.score <= result.max);
  });
});
