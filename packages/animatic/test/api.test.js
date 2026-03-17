/**
 * @preset/animatic — Package integration tests
 *
 * Verifies all public exports are importable and functional.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  // Core Pipeline
  compileMotion,
  compileAllScenes,
  ANIMATABLE_DEFAULTS,
  critiqueScene,
  critiqueTimeline,
  computeScore,

  // Scene Authoring
  analyzeScene,

  // Sequence Planning
  planSequence,
  planVariants,
  evaluateSequence,
  compareVariants,

  // Validation
  validateChoreography,
  CAMERA_CONSTANTS,
  validateScene,
  validateManifest,

  // Personalities
  registerPersonality,
  getPersonality,
  getAllPersonalitySlugs,

  // Audio
  detectBeats,

  // Layout + Compositing
  resolveComponentLayout,
  COMPOSITING_PRESETS,
  getCompositingPreset,
  resolvePresetEffects,

  // Data
  loadCatalogs,
  searchPrimitives,
} from '../index.js';

// ── Import verification ─────────────────────────────────────────────────────

describe('@preset/animatic exports', () => {
  it('exports all named functions', () => {
    assert.equal(typeof compileMotion, 'function');
    assert.equal(typeof compileAllScenes, 'function');
    assert.equal(typeof critiqueScene, 'function');
    assert.equal(typeof critiqueTimeline, 'function');
    assert.equal(typeof computeScore, 'function');
    assert.equal(typeof analyzeScene, 'function');
    assert.equal(typeof planSequence, 'function');
    assert.equal(typeof planVariants, 'function');
    assert.equal(typeof evaluateSequence, 'function');
    assert.equal(typeof compareVariants, 'function');
    assert.equal(typeof validateChoreography, 'function');
    assert.equal(typeof validateScene, 'function');
    assert.equal(typeof validateManifest, 'function');
    assert.equal(typeof registerPersonality, 'function');
    assert.equal(typeof getPersonality, 'function');
    assert.equal(typeof getAllPersonalitySlugs, 'function');
    assert.equal(typeof detectBeats, 'function');
    assert.equal(typeof resolveComponentLayout, 'function');
    assert.equal(typeof getCompositingPreset, 'function');
    assert.equal(typeof resolvePresetEffects, 'function');
    assert.equal(typeof loadCatalogs, 'function');
    assert.equal(typeof searchPrimitives, 'function');
  });

  it('exports CAMERA_CONSTANTS with expected keys', () => {
    assert.ok(CAMERA_CONSTANTS);
    assert.equal(typeof CAMERA_CONSTANTS.SCALE_FACTOR, 'number');
    assert.equal(typeof CAMERA_CONSTANTS.PAN_MAX_PX, 'number');
    assert.equal(typeof CAMERA_CONSTANTS.DRIFT_AMPLITUDE, 'number');
    assert.equal(typeof CAMERA_CONSTANTS.DEFAULT_INTENSITY, 'number');
    assert.equal(typeof CAMERA_CONSTANTS.MIN_OVERSCAN, 'number');
  });

  it('exports ANIMATABLE_DEFAULTS with expected keys', () => {
    assert.ok(ANIMATABLE_DEFAULTS);
    assert.ok(typeof ANIMATABLE_DEFAULTS === 'object');
  });

  it('exports COMPOSITING_PRESETS', () => {
    assert.ok(COMPOSITING_PRESETS);
    assert.ok(typeof COMPOSITING_PRESETS === 'object');
  });
});

// ── Catalog loading ─────────────────────────────────────────────────────────

describe('loadCatalogs()', () => {
  it('returns all expected catalogs', () => {
    const catalogs = loadCatalogs();
    assert.ok(catalogs.primitives.array.length > 0, 'primitives loaded');
    assert.ok(catalogs.primitives.bySlug instanceof Map, 'primitives bySlug map');
    assert.ok(catalogs.personalities.array.length > 0, 'personalities loaded');
    assert.ok(catalogs.intentMappings.array.length > 0, 'intent mappings loaded');
    assert.ok(catalogs.cameraGuardrails, 'camera guardrails loaded');
    assert.ok(catalogs.stylePacks.array.length > 0, 'style packs loaded');
    assert.ok(catalogs.briefTemplates.array.length > 0, 'brief templates loaded');
    assert.ok(catalogs.recipes.array.length > 0, 'recipes loaded');
    assert.ok(catalogs.shotGrammar, 'shot grammar loaded');
  });
});

// ── Scene validation ────────────────────────────────────────────────────────

describe('validateScene()', () => {
  it('validates a minimal valid scene', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      duration_s: 3,
      camera: { move: 'static' },
    });
    assert.ok(result.valid, `errors: ${result.errors.join(', ')}`);
  });

  it('rejects invalid scene_id', () => {
    const result = validateScene({ scene_id: 'bad-id' });
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('scene_id')));
  });
});

describe('validateManifest()', () => {
  it('validates a minimal valid manifest', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_test', duration_s: 3 }],
    });
    assert.ok(result.valid, `errors: ${result.errors.join(', ')}`);
  });
});

// ── Compile motion ──────────────────────────────────────────────────────────

describe('compileMotion()', () => {
  it('compiles a minimal v2 scene to timeline', () => {
    const catalogs = loadCatalogs();
    const scene = {
      scene_id: 'sc_test',
      format_version: 2,
      duration_s: 3,
      camera: { move: 'push_in', intensity: 0.5, easing: 'ease_out' },
      layers: [
        { id: 'l1', type: 'html', depth_class: 'foreground' },
      ],
      motion: {
        groups: [
          {
            targets: ['l1'],
            entrance: { primitive: 'as-fadeInUp' },
          },
        ],
      },
    };
    const timeline = compileMotion(scene, catalogs);
    assert.ok(timeline, 'timeline produced');
    assert.ok(timeline.duration_frames > 0, 'has frames');
  });
});

// ── Scene analysis ──────────────────────────────────────────────────────────

describe('analyzeScene()', () => {
  it('analyzes a scene and returns content_type + visual_weight', () => {
    const scene = {
      scene_id: 'sc_test',
      duration_s: 3,
      layers: [
        { id: 'l1', type: 'html', depth_class: 'foreground', content: '<div>Hello</div>' },
      ],
    };
    const result = analyzeScene(scene);
    assert.ok(result.metadata, 'has metadata');
    assert.ok(result.metadata.content_type, 'has content_type');
    assert.ok(result.metadata.visual_weight, 'has visual_weight');
  });
});

// ── Sequence planning ───────────────────────────────────────────────────────

describe('planSequence()', () => {
  it('produces a valid manifest from analyzed scenes', () => {
    const scenes = [
      { scene_id: 'sc_one', duration_s: 3, layers: [{ id: 'l1', type: 'html', depth_class: 'foreground' }] },
      { scene_id: 'sc_two', duration_s: 4, layers: [{ id: 'l2', type: 'html', depth_class: 'foreground' }] },
    ];
    // planSequence expects analyzed scenes with metadata
    const analyzed = scenes.map(s => {
      const analysis = analyzeScene(s);
      return { ...s, ...analysis.metadata };
    });
    const result = planSequence({ scenes: analyzed, style: 'prestige' });
    assert.ok(result.manifest, 'has manifest');
    assert.ok(result.manifest.scenes.length === 2, 'has 2 scenes');
    const validation = validateManifest(result.manifest);
    assert.ok(validation.valid, `manifest invalid: ${validation.errors.join(', ')}`);
  });
});

// ── Critique ────────────────────────────────────────────────────────────────

describe('critiqueScene()', () => {
  it('returns score + issues', () => {
    const catalogs = loadCatalogs();
    const scene = {
      scene_id: 'sc_test',
      format_version: 2,
      duration_s: 3,
      camera: { move: 'push_in', intensity: 0.5, easing: 'ease_out' },
      layers: [
        { id: 'l1', type: 'html', depth_class: 'foreground' },
      ],
      motion: {
        groups: [
          { targets: ['l1'], entrance: { primitive: 'as-fadeInUp' } },
        ],
      },
    };
    const timeline = compileMotion(scene, catalogs);
    const result = critiqueScene(timeline, scene);
    assert.ok(typeof result.score === 'number', 'has score');
    assert.ok(Array.isArray(result.issues), 'has issues array');
  });
});

// ── Choreography validation ─────────────────────────────────────────────────

describe('validateChoreography()', () => {
  it('returns verdict for valid primitives', () => {
    const catalogs = loadCatalogs();

    // We need registry entries — use a minimal mock
    const registry = {
      byId: new Map([
        ['as-fadeInUp', { id: 'as-fadeInUp', personality: ['cinematic-dark', 'editorial'], category: 'Entrances', duration: '420ms' }],
      ]),
    };

    const result = validateChoreography(['as-fadeInUp'], 'cinematic-dark', {
      registry,
      cameraGuardrails: catalogs.cameraGuardrails,
      intentMappings: catalogs.intentMappings,
    });

    assert.ok(result.verdict, 'has verdict');
    assert.ok(['PASS', 'WARN', 'BLOCK'].includes(result.verdict));
    assert.ok(Array.isArray(result.blocks));
    assert.ok(Array.isArray(result.warnings));
    assert.ok(Array.isArray(result.notes));
  });
});

// ── Compositing presets ─────────────────────────────────────────────────────

describe('getCompositingPreset()', () => {
  it('returns preset for soft-shadow', () => {
    const preset = getCompositingPreset('soft-shadow');
    assert.ok(preset, 'preset found');
  });
});

// ── Personalities ───────────────────────────────────────────────────────────

describe('getAllPersonalitySlugs()', () => {
  it('includes built-in personalities', () => {
    const slugs = getAllPersonalitySlugs();
    assert.ok(slugs.includes('cinematic-dark'));
    assert.ok(slugs.includes('editorial'));
  });
});

// ── Search primitives ───────────────────────────────────────────────────────

describe('searchPrimitives()', () => {
  it('filters entries by query', () => {
    const entries = [
      { id: 'as-fadeInUp', name: 'Fade In Up', personality: ['cinematic-dark'], category: 'Entrances', source: 'animate.style' },
      { id: 'cd-focus-stagger', name: 'Focus Stagger', personality: ['cinematic-dark'], category: 'Entrances', source: 'engine' },
    ];
    const results = searchPrimitives(entries, { query: 'fade' });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'as-fadeInUp');
  });

  it('filters by personality', () => {
    const entries = [
      { id: 'a', name: 'A', personality: ['editorial'], category: 'Entrances', source: 'engine' },
      { id: 'b', name: 'B', personality: ['cinematic-dark'], category: 'Entrances', source: 'engine' },
    ];
    const results = searchPrimitives(entries, { personality: 'editorial' });
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'a');
  });
});
