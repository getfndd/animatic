import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadPrimitivesCatalog } from '../data/loader.js';
import { compileMotion } from '../lib/compiler.js';

// ── ANI-98: Compound primitive tier ─────────────────────────────

describe('compound primitive tier (ANI-98)', () => {
  it('loadPrimitivesCatalog includes compound primitives', () => {
    const catalog = loadPrimitivesCatalog();
    const compound = catalog.array.filter(p => p.source === 'compound');
    assert.ok(compound.length > 0, 'should have at least one compound primitive');

    const conveyor = catalog.bySlug.get('bd-card-conveyor');
    assert.ok(conveyor, 'bd-card-conveyor should be in catalog');
    assert.equal(conveyor.source, 'compound');
    assert.equal(conveyor.requires_js, true);
  });

  it('compound primitive has config_schema', () => {
    const catalog = loadPrimitivesCatalog();
    const conveyor = catalog.bySlug.get('bd-card-conveyor');
    assert.ok(conveyor.config_schema, 'should have config_schema');
    assert.ok(conveyor.config_schema.farZ, 'should have farZ config');
    assert.equal(conveyor.config_schema.farZ.default, -1500);
    assert.equal(conveyor.config_schema.speed.default, 470);
  });

  it('compound primitive has content_schema', () => {
    const catalog = loadPrimitivesCatalog();
    const conveyor = catalog.bySlug.get('bd-card-conveyor');
    assert.ok(conveyor.content_schema, 'should have content_schema');
    assert.ok(conveyor.content_schema.stories, 'should have stories schema');
  });

  it('compound primitive has sub_primitives', () => {
    const catalog = loadPrimitivesCatalog();
    const conveyor = catalog.bySlug.get('bd-card-conveyor');
    assert.ok(conveyor.sub_primitives?.length >= 3, 'should have at least 3 sub-primitives');

    const pickPop = conveyor.sub_primitives.find(s => s.id === 'bd-pick-pop');
    assert.ok(pickPop, 'should have bd-pick-pop sub-primitive');
    assert.equal(pickPop.extractable_as_css, true);
    assert.ok(pickPop.css, 'bd-pick-pop should have CSS');
  });

  it('compound primitive has entry_point and remotion_component', () => {
    const catalog = loadPrimitivesCatalog();
    const conveyor = catalog.bySlug.get('bd-card-conveyor');
    assert.ok(conveyor.entry_point, 'should have entry_point');
    assert.ok(conveyor.remotion_component, 'should have remotion_component');
  });

  it('search by source "compound" returns only compound primitives', () => {
    const catalog = loadPrimitivesCatalog();
    const compound = catalog.array.filter(p => p.source === 'compound');
    for (const p of compound) {
      assert.equal(p.source, 'compound');
      assert.equal(p.requires_js, true);
    }
  });
});

// ── ANI-99: Reactive compiler mode ──────────────────────────────

describe('reactive compiler mode (ANI-99)', () => {
  const catalogs = {
    primitives: loadPrimitivesCatalog(),
    recipes: { array: [], byId: new Map() },
  };

  it('compileMotion with mode=reactive returns reactive output', () => {
    const scene = {
      scene_id: 'test_reactive',
      fps: 60,
      duration_s: 5,
      motion: {
        compound: 'bd-card-conveyor',
        compound_config: { speed: 500 },
        content_count: 6,
      },
    };

    const result = compileMotion(scene, catalogs, { mode: 'reactive' });
    assert.ok(result, 'should return a result');
    assert.equal(result.mode, 'reactive');
    assert.equal(result.compound, 'bd-card-conveyor');
    assert.equal(result.fps, 60);
    assert.equal(result.durationFrames, 300);
    assert.equal(result.contentCount, 6);
  });

  it('reactive mode merges catalog defaults with overrides', () => {
    const scene = {
      scene_id: 'test_merge',
      fps: 60,
      duration_s: 3,
      motion: {
        compound: 'bd-card-conveyor',
        compound_config: { speed: 600, loopDurationMs: 1000 },
        content_count: 8,
      },
    };

    const result = compileMotion(scene, catalogs, { mode: 'reactive' });
    assert.equal(result.config.speed, 600, 'override should win');
    assert.equal(result.config.loopDurationMs, 1000, 'override should win');
    assert.equal(result.config.farZ, -1500, 'default should fill in');
    assert.equal(result.config.exitZ, 260, 'default should fill in');
  });

  it('reactive mode without compound falls through to static', () => {
    const scene = {
      scene_id: 'test_static',
      fps: 60,
      duration_s: 3,
      layers: [{ id: 'hero', type: 'text' }],
      motion: {
        groups: [{
          targets: ['hero'],
          primitive: 'cd-focus-stagger',
        }],
        camera: { moves: [{ move: 'static' }] },
      },
    };

    const result = compileMotion(scene, catalogs, { mode: 'reactive' });
    // Without motion.compound, should go through the static pipeline
    assert.ok(result, 'should return a result');
    assert.ok(!result.mode || result.mode !== 'reactive',
      'should NOT be reactive — no compound field');
    assert.ok(result.tracks, 'should have tracks (static timeline)');
  });

  it('reactive output config is serializable', () => {
    const scene = {
      scene_id: 'test_serial',
      fps: 60,
      duration_s: 3,
      motion: {
        compound: 'bd-card-conveyor',
        content_count: 4,
      },
    };

    const result = compileMotion(scene, catalogs, { mode: 'reactive' });
    const serialized = JSON.stringify(result);
    const deserialized = JSON.parse(serialized);
    assert.deepStrictEqual(deserialized.config, result.config);
    assert.equal(deserialized.compound, result.compound);
  });

  it('benchmark: reactive compile is fast', () => {
    const scene = {
      scene_id: 'test_bench',
      fps: 60,
      duration_s: 5,
      motion: {
        compound: 'bd-card-conveyor',
        compound_config: { speed: 470 },
        content_count: 8,
      },
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      compileMotion(scene, catalogs, { mode: 'reactive' });
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 500, `1000 reactive compiles should be < 500ms, got ${elapsed.toFixed(1)}ms`);
  });
});
