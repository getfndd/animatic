/**
 * Compiler tests — Level 1 Motion Intent → Level 2 Motion Timeline.
 *
 * Tests the 7-step compilation pipeline: recipe resolution, cue graph,
 * primitive expansion, stagger math, camera sync, and timeline emission.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/compiler.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  compileMotion,
  resolveRecipes,
  buildCueGraph,
  expandGroups,
  compileCamera,
  compileEffects,
  effectTypeToProperty,
  applyStaggerOrder,
  computeAmplitude,
  primitiveToTracks,
  resolveCameraConstantsForPersonality,
  compileSemantic,
  compileCameraBehavior,
  interactionToGroup,
  applySemanticConstraints,
  ANIMATABLE_DEFAULTS,
  PERSONALITY_CAMERA,
} from '../lib/compiler.js';

import { loadRecipes } from '../data/loader.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeScene(overrides = {}) {
  return {
    scene_id: 'sc_test',
    duration_s: 4,
    fps: 60,
    format_version: 2,
    layers: [
      { id: 'title', type: 'text', content: 'Hello' },
      { id: 'card-0', type: 'html', content: '<div>A</div>' },
      { id: 'card-1', type: 'html', content: '<div>B</div>' },
      { id: 'card-2', type: 'html', content: '<div>C</div>' },
    ],
    ...overrides,
  };
}

function makeCatalogs() {
  const recipes = loadRecipes();
  return { recipes };
}

// ── compileMotion — null for v1 scenes ───────────────────────────────────────

describe('compileMotion', () => {
  it('returns null for v1 scenes without motion block', () => {
    const scene = makeScene({ motion: undefined });
    const result = compileMotion(scene);
    assert.equal(result, null);
  });

  it('compiles a basic motion block into a timeline', () => {
    const scene = makeScene({
      motion: {
        groups: [
          {
            id: 'headline',
            targets: ['title'],
            primitive: 'ed-blur-reveal',
            on_complete: { emit: 'headline_done' },
          },
          {
            id: 'cards',
            targets: ['card-0', 'card-1', 'card-2'],
            primitive: 'ed-slide-stagger',
            stagger: { interval_ms: 120 },
            delay: { after: 'headline_done', offset_ms: 200 },
          },
        ],
        camera: {
          move: 'push_in',
          intensity: 0.3,
          sync: { peak_at: 0.6, cue: 'headline_done' },
        },
      },
    });

    const result = compileMotion(scene, makeCatalogs());

    assert.equal(result.scene_id, 'sc_test');
    assert.equal(result.duration_frames, 240); // 4s * 60fps
    assert.equal(result.fps, 60);

    // Should have layer tracks for all 4 targets
    assert.ok(result.tracks.layers.title, 'title should have tracks');
    assert.ok(result.tracks.layers['card-0'], 'card-0 should have tracks');
    assert.ok(result.tracks.layers['card-1'], 'card-1 should have tracks');
    assert.ok(result.tracks.layers['card-2'], 'card-2 should have tracks');

    // Should have camera tracks
    assert.ok(result.tracks.camera.scale, 'camera should have scale track');
  });

  it('compiles a recipe reference into groups', () => {
    const scene = makeScene({
      motion: {
        recipe: 'ed-feature-reveal',
        target_map: {
          hero: ['title'],
          supporting: ['card-0', 'card-1'],
        },
      },
    });

    const catalogs = makeCatalogs();
    const result = compileMotion(scene, catalogs);

    assert.ok(result.tracks.layers.title, 'hero target should have tracks');
    assert.ok(result.tracks.layers['card-0'], 'supporting target should have tracks');
  });
});

// ── applyStaggerOrder ────────────────────────────────────────────────────────

describe('applyStaggerOrder', () => {
  const targets = ['a', 'b', 'c', 'd', 'e'];

  it('sequential returns original order', () => {
    assert.deepEqual(applyStaggerOrder(targets, 'sequential'), targets);
  });

  it('reverse returns reversed', () => {
    assert.deepEqual(applyStaggerOrder(targets, 'reverse'), ['e', 'd', 'c', 'b', 'a']);
  });

  it('center_out starts from middle', () => {
    const result = applyStaggerOrder(targets, 'center_out');
    assert.equal(result[0], 'c'); // middle element first
    assert.equal(result.length, 5);
    // All elements present
    assert.deepEqual([...result].sort(), [...targets].sort());
  });

  it('random returns all elements', () => {
    const result = applyStaggerOrder(targets, 'random');
    assert.equal(result.length, 5);
    assert.deepEqual([...result].sort(), [...targets].sort());
  });
});

// ── computeAmplitude ─────────────────────────────────────────────────────────

describe('computeAmplitude', () => {
  it('returns 1.0 with no config', () => {
    assert.equal(computeAmplitude(0, 3, null), 1.0);
  });

  it('uniform returns start value', () => {
    assert.equal(computeAmplitude(0, 3, { curve: 'uniform', start: 0.8, end: 0.5 }), 0.8);
    assert.equal(computeAmplitude(2, 3, { curve: 'uniform', start: 0.8, end: 0.5 }), 0.8);
  });

  it('descending produces decreasing values', () => {
    const config = { curve: 'descending', start: 1.0, end: 0.6 };
    const v0 = computeAmplitude(0, 5, config);
    const v2 = computeAmplitude(2, 5, config);
    const v4 = computeAmplitude(4, 5, config);
    assert.equal(v0, 1.0);
    assert.ok(v2 < v0, 'middle should be less than start');
    assert.ok(Math.abs(v4 - 0.6) < 0.01, 'end should be ~0.6');
  });

  it('ascending produces increasing values', () => {
    const config = { curve: 'ascending', start: 0.5, end: 1.0 };
    const v0 = computeAmplitude(0, 3, config);
    const v2 = computeAmplitude(2, 3, config);
    assert.equal(v0, 0.5);
    assert.ok(Math.abs(v2 - 1.0) < 0.01);
  });

  it('returns start for single element', () => {
    assert.equal(computeAmplitude(0, 1, { curve: 'descending', start: 1.0, end: 0.5 }), 1.0);
  });
});

// ── primitiveToTracks ────────────────────────────────────────────────────────

describe('primitiveToTracks', () => {
  it('generates opacity track from fade-in primitive', () => {
    const primitive = {
      durationMs: 400,
      easing: 'ease_out',
      keyframes: [
        { at: 0, opacity: 0 },
        { at: 1, opacity: 1 },
      ],
    };

    const tracks = primitiveToTracks(primitive, 0, 60, 1.0);
    assert.ok(tracks.opacity, 'should have opacity track');
    assert.equal(tracks.opacity.length, 2);
    assert.equal(tracks.opacity[0].frame, 0);
    assert.equal(tracks.opacity[0].value, 0);
    assert.equal(tracks.opacity[1].frame, 24); // 400ms at 60fps
    assert.equal(tracks.opacity[1].value, 1);
  });

  it('generates translateY track with amplitude scaling', () => {
    const primitive = {
      durationMs: 400,
      easing: 'ease_out',
      keyframes: [
        { at: 0, opacity: 0, translateY: 10 },
        { at: 1, opacity: 1, translateY: 0 },
      ],
    };

    const tracks = primitiveToTracks(primitive, 0, 60, 0.6);
    assert.ok(tracks.translateY, 'should have translateY track');
    assert.equal(tracks.translateY[0].value, 6); // 10 * 0.6
    assert.equal(tracks.translateY[1].value, 0);
  });

  it('generates blur track from focus-stagger primitive', () => {
    const primitive = {
      durationMs: 540,
      easing: 'expo_out',
      keyframes: [
        { at: 0, opacity: 0, scale: 0.97, blur: 8 },
        { at: 1, opacity: 1, scale: 1, blur: 0 },
      ],
    };

    const tracks = primitiveToTracks(primitive, 12, 60, 1.0);
    assert.ok(tracks.filter_blur, 'should have filter_blur track');
    assert.equal(tracks.filter_blur[0].frame, 12); // starts at frame 12
    assert.equal(tracks.filter_blur[0].value, 8);
    assert.equal(tracks.filter_blur[1].value, 0);
    assert.ok(tracks.scale, 'should have scale track');
  });

  it('offsets frames by startFrame', () => {
    const primitive = {
      durationMs: 400,
      easing: 'ease_out',
      keyframes: [
        { at: 0, opacity: 0 },
        { at: 1, opacity: 1 },
      ],
    };

    const tracks = primitiveToTracks(primitive, 48, 60, 1.0);
    assert.equal(tracks.opacity[0].frame, 48);
    assert.equal(tracks.opacity[1].frame, 72); // 48 + 24
  });
});

// ── compileCamera ────────────────────────────────────────────────────────────

describe('compileCamera', () => {
  it('returns empty for null camera', () => {
    const result = compileCamera(null, {}, 240, 60);
    assert.deepEqual(result, {});
  });

  it('returns empty for static camera', () => {
    const result = compileCamera({ move: 'static' }, {}, 240, 60);
    assert.deepEqual(result, {});
  });

  it('compiles push_in to scale track', () => {
    const result = compileCamera(
      { move: 'push_in', intensity: 0.5 },
      { scene_start: 0, scene_end: 240 },
      240, 60
    );
    assert.ok(result.scale);
    assert.equal(result.scale[0].value, 1);
    assert.ok(result.scale[1].value > 1, 'end scale should be > 1');
  });

  it('syncs camera peak to cue frame', () => {
    const cues = { scene_start: 0, scene_end: 240, headline_done: 100 };
    const result = compileCamera(
      {
        move: 'push_in',
        intensity: 0.3,
        sync: { peak_at: 0.5, cue: 'headline_done' },
      },
      cues, 240, 60
    );

    // Peak should be at headline_done (frame 100), not at 0.5 * 240 = 120
    assert.equal(result.scale[1].frame, 100);
  });

  it('compiles multi-move camera', () => {
    const result = compileCamera(
      {
        moves: [
          { move: 'push_in', intensity: 0.4, from: 0, to: 0.6 },
          { move: 'drift', intensity: 0.15, from: 0.6, to: 1.0 },
        ],
      },
      { scene_start: 0, scene_end: 240 },
      240, 60
    );

    assert.ok(result.scale || result.translateX, 'should have at least one track');
  });
});

// ── buildCueGraph ────────────────────────────────────────────────────────────

describe('buildCueGraph', () => {
  it('always includes scene_start and scene_end', () => {
    const cues = buildCueGraph([], { camera: {} }, 240, 60);
    assert.equal(cues.scene_start, 0);
    assert.equal(cues.scene_end, 240);
  });

  it('resolves on_complete cues from group timing', () => {
    const groups = [
      {
        id: 'headline',
        targets: ['title'],
        primitive: 'ed-blur-reveal', // 600ms
        on_complete: { emit: 'headline_done' },
      },
    ];

    const cues = buildCueGraph(groups, { camera: {} }, 240, 60);
    assert.ok(cues.headline_done != null, 'should have headline_done cue');
    assert.ok(cues.headline_done > 0, 'cue should be > 0');
    assert.ok(cues.headline_done <= 240, 'cue should be <= duration');
  });

  it('resolves camera peak_at', () => {
    const cues = buildCueGraph([], {
      camera: { sync: { peak_at: 0.6 } },
    }, 240, 60);
    assert.equal(cues.__camera_peak, 144); // 0.6 * 240
  });
});

// ── Full round-trip ──────────────────────────────────────────────────────────

describe('full round-trip compilation', () => {
  it('produces valid timeline structure from editorial scene', () => {
    const scene = makeScene({
      personality: 'editorial',
      motion: {
        camera: { move: 'push_in', intensity: 0.3 },
        groups: [
          {
            id: 'headline',
            targets: ['title'],
            primitive: 'ed-blur-reveal',
            on_complete: { emit: 'headline_done' },
          },
          {
            id: 'cards',
            targets: ['card-0', 'card-1', 'card-2'],
            primitive: 'ed-slide-stagger',
            stagger: {
              interval_ms: 120,
              amplitude: { curve: 'descending', start: 1.0, end: 0.6 },
            },
            delay: { after: 'headline_done', offset_ms: 200 },
          },
        ],
      },
    });

    const result = compileMotion(scene, makeCatalogs());

    // Structure checks
    assert.equal(typeof result.scene_id, 'string');
    assert.equal(typeof result.duration_frames, 'number');
    assert.equal(typeof result.fps, 'number');
    assert.ok(result.tracks.camera);
    assert.ok(result.tracks.layers);

    // Every layer track entry should be an array of keyframes
    for (const [layerId, tracks] of Object.entries(result.tracks.layers)) {
      for (const [prop, keyframes] of Object.entries(tracks)) {
        assert.ok(Array.isArray(keyframes), `${layerId}.${prop} should be an array`);
        for (const kf of keyframes) {
          assert.equal(typeof kf.frame, 'number', `${layerId}.${prop} keyframe needs frame`);
          assert.ok(kf.value != null, `${layerId}.${prop} keyframe needs value`);
        }
      }
    }

    // Stagger: card-1 should start later than card-0
    const card0Start = result.tracks.layers['card-0'].opacity[0].frame;
    const card1Start = result.tracks.layers['card-1'].opacity[0].frame;
    const card2Start = result.tracks.layers['card-2'].opacity[0].frame;
    assert.ok(card1Start > card0Start, 'card-1 should start after card-0');
    assert.ok(card2Start > card1Start, 'card-2 should start after card-1');
  });

  it('stagger with descending amplitude produces decreasing translateY', () => {
    const scene = makeScene({
      motion: {
        groups: [{
          id: 'items',
          targets: ['card-0', 'card-1', 'card-2'],
          primitive: 'ed-slide-stagger',
          stagger: {
            interval_ms: 120,
            amplitude: { curve: 'descending', start: 1.0, end: 0.6 },
          },
        }],
      },
    });

    const result = compileMotion(scene, makeCatalogs());

    // ed-slide-stagger starts with translateY: 10
    // With descending amplitude: card-0 gets 10*1.0=10, card-2 gets 10*0.6=6
    const ty0 = result.tracks.layers['card-0'].translateY?.[0]?.value;
    const ty2 = result.tracks.layers['card-2'].translateY?.[0]?.value;
    assert.ok(ty0 != null, 'card-0 should have translateY');
    assert.ok(ty2 != null, 'card-2 should have translateY');
    assert.ok(Math.abs(ty0) > Math.abs(ty2), `card-0 translateY (${ty0}) should be larger than card-2 (${ty2})`);
  });
});

// ── Effects compilation ──────────────────────────────────────────────────────

describe('compileEffects', () => {
  it('compiles blur effect into filter_blur track', () => {
    const groups = [{
      id: 'hero',
      targets: ['title'],
      effects: [
        { type: 'blur', from: 8, to: 0, duration_ms: 600, easing: 'ease_out' },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.title, 'should have title tracks');
    assert.ok(layerTracks.title.filter_blur, 'should have filter_blur track');
    assert.equal(layerTracks.title.filter_blur.length, 2);
    assert.equal(layerTracks.title.filter_blur[0].value, 8);
    assert.equal(layerTracks.title.filter_blur[1].value, 0);
  });

  it('compiles brightness effect into filter_brightness track', () => {
    const groups = [{
      id: 'hero',
      targets: ['title'],
      effects: [
        { type: 'brightness', from: 0.3, to: 1.0, duration_ms: 800 },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.title.filter_brightness);
    assert.equal(layerTracks.title.filter_brightness[0].value, 0.3);
    assert.equal(layerTracks.title.filter_brightness[1].value, 1.0);
  });

  it('applies effects to all targets in group', () => {
    const groups = [{
      id: 'cards',
      targets: ['card-0', 'card-1', 'card-2'],
      effects: [
        { type: 'blur', from: 4, to: 0, duration_ms: 400 },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks['card-0'].filter_blur);
    assert.ok(layerTracks['card-1'].filter_blur);
    assert.ok(layerTracks['card-2'].filter_blur);
  });

  it('merges effects with existing entrance tracks', () => {
    const groups = [{
      id: 'hero',
      targets: ['title'],
      effects: [
        { type: 'blur', from: 8, to: 0, duration_ms: 600 },
      ],
    }];
    // Pre-existing opacity track from entrance primitive
    const layerTracks = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 25, value: 1, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
      },
    };
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.title.opacity, 'opacity track preserved');
    assert.ok(layerTracks.title.filter_blur, 'blur track added');
  });

  it('respects effect delay_ms', () => {
    const groups = [{
      id: 'hero',
      targets: ['title'],
      effects: [
        { type: 'blur', from: 8, to: 0, duration_ms: 600, delay_ms: 200 },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    const startFrame = layerTracks.title.filter_blur[0].frame;
    assert.equal(startFrame, 12, 'should start at 200ms = 12 frames at 60fps');
  });

  it('compiles clip_top effect', () => {
    const groups = [{
      id: 'reveal',
      targets: ['panel'],
      effects: [
        { type: 'clip_top', from: 100, to: 0, duration_ms: 500 },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.panel.clip_inset_top);
    assert.equal(layerTracks.panel.clip_inset_top[0].value, 100);
    assert.equal(layerTracks.panel.clip_inset_top[1].value, 0);
  });
});

// ── Personality camera constants ─────────────────────────────────────────────

describe('resolveCameraConstantsForPersonality', () => {
  it('returns base constants for null personality', () => {
    const cc = resolveCameraConstantsForPersonality(null);
    assert.equal(cc.SCALE_FACTOR, 0.14);
    assert.equal(cc.PAN_MAX_PX, 160);
  });

  it('returns cinematic-dark overrides', () => {
    const cc = resolveCameraConstantsForPersonality('cinematic-dark');
    assert.equal(cc.SCALE_FACTOR, 0.18, 'deeper zoom');
    assert.equal(cc.PAN_MAX_PX, 200, 'wider pans');
    assert.equal(cc.DRIFT_AMPLITUDE, 12);
    // Inherited from base
    assert.equal(cc.DEFAULT_INTENSITY, 0.5);
  });

  it('returns editorial overrides (restrained)', () => {
    const cc = resolveCameraConstantsForPersonality('editorial');
    assert.equal(cc.SCALE_FACTOR, 0.10);
    assert.equal(cc.PAN_MAX_PX, 120);
  });

  it('returns neutral-light overrides (minimal)', () => {
    const cc = resolveCameraConstantsForPersonality('neutral-light');
    assert.equal(cc.SCALE_FACTOR, 0.08);
    assert.equal(cc.PAN_MAX_PX, 80);
  });

  it('returns montage overrides (punchy)', () => {
    const cc = resolveCameraConstantsForPersonality('montage');
    assert.equal(cc.SCALE_FACTOR, 0.16);
    assert.equal(cc.PAN_MAX_PX, 240);
  });

  it('falls back to base for unknown personality', () => {
    const cc = resolveCameraConstantsForPersonality('unknown-personality');
    assert.equal(cc.SCALE_FACTOR, 0.14);
  });
});

// ── compileMotion with personality ───────────────────────────────────────────

describe('compileMotion with personality', () => {
  it('uses personality-specific camera constants', () => {
    const scene = makeScene({
      motion: {
        camera: { move: 'push_in', intensity: 0.5 },
        groups: [{
          id: 'hero',
          targets: ['title'],
          primitive: 'as-fadeInUp',
        }],
      },
    });

    const resultBase = compileMotion(scene, makeCatalogs());
    const resultCinematic = compileMotion(scene, makeCatalogs(), { personality: 'cinematic-dark' });
    const resultEditorial = compileMotion(scene, makeCatalogs(), { personality: 'editorial' });

    // cinematic-dark has deeper zoom (0.18) than base (0.14)
    const baseScale = resultBase.tracks.camera.scale[1].value;
    const cinematicScale = resultCinematic.tracks.camera.scale[1].value;
    const editorialScale = resultEditorial.tracks.camera.scale[1].value;

    assert.ok(cinematicScale > baseScale, 'cinematic should zoom deeper than base');
    assert.ok(editorialScale < baseScale, 'editorial should zoom less than base');
  });

  it('compiles effects alongside motion groups', () => {
    const scene = makeScene({
      motion: {
        groups: [{
          id: 'hero',
          targets: ['title'],
          primitive: 'as-fadeInUp',
          effects: [
            { type: 'blur', from: 8, to: 0, duration_ms: 600 },
            { type: 'brightness', from: 0.3, to: 1.0, duration_ms: 800 },
          ],
        }],
      },
    });

    const result = compileMotion(scene, makeCatalogs());

    // Should have entrance tracks (opacity, translateY from fadeInUp)
    assert.ok(result.tracks.layers.title.opacity, 'has entrance opacity');

    // Should also have effect tracks
    assert.ok(result.tracks.layers.title.filter_blur, 'has blur effect');
    assert.ok(result.tracks.layers.title.filter_brightness, 'has brightness effect');
  });
});

// ── effectTypeToProperty — SVG + clip-path effect types ──────────────────────

describe('effectTypeToProperty', () => {
  it('maps stroke_dashoffset to stroke_dashoffset', () => {
    assert.equal(effectTypeToProperty('stroke_dashoffset'), 'stroke_dashoffset');
  });

  it('maps fill_opacity to fill_opacity', () => {
    assert.equal(effectTypeToProperty('fill_opacity'), 'fill_opacity');
  });

  it('maps stroke_opacity to stroke_opacity', () => {
    assert.equal(effectTypeToProperty('stroke_opacity'), 'stroke_opacity');
  });

  it('maps clip_circle to clip_circle property', () => {
    assert.equal(effectTypeToProperty('clip_circle'), 'clip_circle');
  });

  it('maps clip_ellipse to clip_ellipse property', () => {
    assert.equal(effectTypeToProperty('clip_ellipse'), 'clip_ellipse');
  });

  it('maps existing effect types correctly', () => {
    assert.equal(effectTypeToProperty('blur'), 'filter_blur');
    assert.equal(effectTypeToProperty('brightness'), 'filter_brightness');
    assert.equal(effectTypeToProperty('scale'), 'scale');
    assert.equal(effectTypeToProperty('clip_top'), 'clip_inset_top');
    assert.equal(effectTypeToProperty('clip_right'), 'clip_inset_right');
    assert.equal(effectTypeToProperty('clip_bottom'), 'clip_inset_bottom');
    assert.equal(effectTypeToProperty('clip_left'), 'clip_inset_left');
  });

  it('returns null for unknown effect types', () => {
    assert.equal(effectTypeToProperty('unknown'), null);
  });
});

// ── ANIMATABLE_DEFAULTS — includes SVG properties ───────────────────────────

describe('ANIMATABLE_DEFAULTS SVG properties', () => {
  it('includes stroke_dashoffset default', () => {
    assert.equal(ANIMATABLE_DEFAULTS.stroke_dashoffset, 0);
  });

  it('includes fill_opacity default', () => {
    assert.equal(ANIMATABLE_DEFAULTS.fill_opacity, 1);
  });

  it('includes stroke_opacity default', () => {
    assert.equal(ANIMATABLE_DEFAULTS.stroke_opacity, 1);
  });

  it('includes stroke_dasharray default', () => {
    assert.equal(ANIMATABLE_DEFAULTS.stroke_dasharray, 0);
  });

  it('includes path_length default', () => {
    assert.equal(ANIMATABLE_DEFAULTS.path_length, 0);
  });
});

// ── compileEffects — SVG effect types ────────────────────────────────────────

describe('compileEffects with SVG effects', () => {
  it('compiles stroke_dashoffset effect', () => {
    const groups = [{
      id: 'icon',
      targets: ['svg_icon'],
      effects: [
        { type: 'stroke_dashoffset', from: 300, to: 0, duration_ms: 1000, easing: 'ease_out' },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.svg_icon, 'should have svg_icon tracks');
    assert.ok(layerTracks.svg_icon.stroke_dashoffset, 'should have stroke_dashoffset track');
    assert.equal(layerTracks.svg_icon.stroke_dashoffset.length, 2);
    assert.equal(layerTracks.svg_icon.stroke_dashoffset[0].value, 300);
    assert.equal(layerTracks.svg_icon.stroke_dashoffset[1].value, 0);
  });

  it('compiles fill_opacity effect', () => {
    const groups = [{
      id: 'shape',
      targets: ['svg_shape'],
      effects: [
        { type: 'fill_opacity', from: 0, to: 1, duration_ms: 600 },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.svg_shape.fill_opacity, 'should have fill_opacity track');
    assert.equal(layerTracks.svg_shape.fill_opacity[0].value, 0);
    assert.equal(layerTracks.svg_shape.fill_opacity[1].value, 1);
  });
});

// ── compileEffects — clip-path shapes ────────────────────────────────────────

describe('compileEffects — clip-path shapes', () => {
  it('compiles clip_circle effect into clip_circle track', () => {
    const groups = [{
      id: 'reveal',
      targets: ['panel'],
      effects: [
        { type: 'clip_circle', from: 0, to: 100, duration_ms: 800 },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.panel.clip_circle);
    assert.equal(layerTracks.panel.clip_circle[0].value, 0);
    assert.equal(layerTracks.panel.clip_circle[1].value, 100);
  });

  it('compiles clip_ellipse effect into clip_ellipse track', () => {
    const groups = [{
      id: 'reveal',
      targets: ['panel'],
      effects: [
        { type: 'clip_ellipse', from: 0, to: 100, duration_ms: 600 },
      ],
    }];
    const layerTracks = {};
    compileEffects(groups, layerTracks, {}, 60);

    assert.ok(layerTracks.panel.clip_ellipse);
    assert.equal(layerTracks.panel.clip_ellipse[0].value, 0);
    assert.equal(layerTracks.panel.clip_ellipse[1].value, 100);
  });
});

// ── compileSemantic — v3 semantic pre-processing ─────────────────────────────

function makeV3Scene(overrides = {}) {
  return {
    scene_id: 'sc_v3_test',
    format_version: 3,
    duration_s: 4,
    fps: 60,
    layers: [],
    ...overrides,
  };
}

function makeComponentMap(components) {
  const map = new Map();
  for (const cmp of components) {
    map.set(cmp.id, cmp);
  }
  return map;
}

describe('compileSemantic', () => {
  it('returns without modifying scene when no semantic block', () => {
    const scene = makeV3Scene({ semantic: undefined });
    compileSemantic(scene);
    assert.equal(scene.motion, undefined);
  });

  it('generates layers for components without layer_ref', () => {
    const scene = makeV3Scene({
      semantic: {
        components: [
          { id: 'cmp_search', type: 'input_field', role: 'hero' },
          { id: 'cmp_menu', type: 'dropdown_menu', role: 'supporting' },
        ],
        interactions: [],
      },
    });

    compileSemantic(scene);

    assert.equal(scene.layers.length, 2);
    assert.equal(scene.layers[0].id, 'cmp_search');
    assert.equal(scene.layers[1].id, 'cmp_menu');
    assert.equal(scene.layers[0].type, 'html');
  });

  it('preserves existing layers when layer_ref is used', () => {
    const scene = makeV3Scene({
      layers: [
        { id: 'existing_layer', type: 'html', content: '<div>existing</div>' },
      ],
      semantic: {
        components: [
          { id: 'cmp_search', type: 'input_field', role: 'hero', layer_ref: 'existing_layer' },
        ],
        interactions: [],
      },
    });

    compileSemantic(scene);

    // Should not add a new layer — uses existing one
    assert.equal(scene.layers.length, 1);
    assert.equal(scene.layers[0].id, 'existing_layer');
  });

  it('throws when layer_ref references non-existent layer', () => {
    const scene = makeV3Scene({
      semantic: {
        components: [
          { id: 'cmp_search', type: 'input_field', layer_ref: 'nonexistent' },
        ],
        interactions: [],
      },
    });

    assert.throws(() => compileSemantic(scene), /non-existent layer/);
  });

  it('merges semantic groups before explicit groups', () => {
    const scene = makeV3Scene({
      motion: {
        groups: [
          { id: 'explicit_group', targets: ['logo'], primitive: 'as-fadeIn' },
        ],
      },
      semantic: {
        components: [
          { id: 'cmp_search', type: 'input_field', role: 'hero' },
        ],
        interactions: [
          { id: 'int_type', target: 'cmp_search', kind: 'type_text', params: { text: 'hello' } },
        ],
      },
    });

    compileSemantic(scene);

    // Semantic group should come first, explicit group second
    assert.equal(scene.motion.groups[0].id, 'int_type');
    assert.equal(scene.motion.groups[scene.motion.groups.length - 1].id, 'explicit_group');
  });
});

// ── interactionToGroup — kind mapping ────────────────────────────────────────

describe('interactionToGroup', () => {
  const components = [
    { id: 'cmp_search', type: 'input_field', role: 'hero' },
    { id: 'cmp_menu', type: 'dropdown_menu', role: 'supporting' },
    { id: 'cmp_results', type: 'result_stack', role: 'hero' },
    { id: 'cmp_cards', type: 'stacked_cards', role: 'supporting', props: { items: ['A', 'B', 'C'] } },
    { id: 'cmp_badge', type: 'icon_label_row', role: 'background' },
  ];
  const cmpMap = makeComponentMap(components);

  it('type_text → text_chars effect with correct duration', () => {
    const groups = interactionToGroup({
      id: 'int_type', target: 'cmp_search', kind: 'type_text',
      params: { text: 'hello world', speed: 50 },
    }, cmpMap, null);

    assert.equal(groups.length, 1);
    const g = groups[0];
    assert.equal(g.targets[0], 'cmp_search');
    const tw = g.effects.find(e => e.type === 'typewriter');
    assert.ok(tw, 'should have typewriter effect');
    assert.equal(tw.from, 0);
    assert.equal(tw.to, 11); // 'hello world'.length
    assert.equal(tw.duration_ms, 550); // 11 * 50
  });

  it('focus → opacity/scale pulse + sibling dim group', () => {
    const groups = interactionToGroup({
      id: 'int_focus', target: 'cmp_search', kind: 'focus',
    }, cmpMap, null);

    assert.ok(groups.length >= 2, 'should emit target group + sibling dim');

    const targetGroup = groups[0];
    assert.ok(targetGroup.effects.some(e => e.type === 'opacity'), 'has opacity effect');
    assert.ok(targetGroup.effects.some(e => e.type === 'scale'), 'has scale effect');

    const dimGroup = groups[1];
    assert.equal(dimGroup.id, 'int_focus_sibling_dim');
    // Should target all other components
    assert.ok(dimGroup.targets.length === components.length - 1);
    const dimEffect = dimGroup.effects.find(e => e.type === 'opacity');
    assert.equal(dimEffect.to, 0.2, 'default dim is 0.2');
  });

  it('replace_text → opacity crossfade', () => {
    const groups = interactionToGroup({
      id: 'int_replace', target: 'cmp_search', kind: 'replace_text',
      params: { text: 'new text' },
    }, cmpMap, null);

    assert.equal(groups.length, 1);
    const opEffects = groups[0].effects.filter(e => e.type === 'opacity');
    assert.equal(opEffects.length, 2);
    assert.equal(opEffects[0].to, 0); // fade out
    assert.equal(opEffects[1].to, 1); // fade in
  });

  it('open_menu → translateY + opacity', () => {
    const groups = interactionToGroup({
      id: 'int_open', target: 'cmp_menu', kind: 'open_menu',
    }, cmpMap, null);

    assert.equal(groups.length, 1);
    assert.ok(groups[0].effects.some(e => e.type === 'translateY'));
    assert.ok(groups[0].effects.some(e => e.type === 'opacity'));
    const ty = groups[0].effects.find(e => e.type === 'translateY');
    assert.equal(ty.from, -20);
    assert.equal(ty.to, 0);
  });

  it('select_item → opacity highlight', () => {
    const groups = interactionToGroup({
      id: 'int_select', target: 'cmp_menu', kind: 'select_item',
      params: { index: 0 },
    }, cmpMap, null);

    assert.equal(groups.length, 1);
    assert.ok(groups[0].effects.some(e => e.type === 'opacity'));
    assert.equal(groups[0].effects[0].duration_ms, 200);
  });

  it('insert_items → stagger group with correct interval', () => {
    const groups = interactionToGroup({
      id: 'int_insert', target: 'cmp_results', kind: 'insert_items',
      params: { items: ['A', 'B', 'C'], stagger_ms: 100 },
    }, cmpMap, null);

    assert.equal(groups.length, 1);
    assert.ok(groups[0].stagger, 'should have stagger');
    assert.equal(groups[0].stagger.interval_ms, 100);
    assert.equal(groups[0].targets.length, 3);
    assert.ok(groups[0].effects.some(e => e.type === 'translateY'));
    assert.ok(groups[0].effects.some(e => e.type === 'opacity'));
  });

  it('fan_stack → rotate + translateX per card', () => {
    const groups = interactionToGroup({
      id: 'int_fan', target: 'cmp_cards', kind: 'fan_stack',
      params: { spread: 15 },
    }, cmpMap, null);

    // Should have one group per card (3 items)
    assert.equal(groups.length, 3);
    for (const g of groups) {
      assert.ok(g.effects.some(e => e.type === 'rotate'), 'has rotate');
      assert.ok(g.effects.some(e => e.type === 'translateX'), 'has translateX');
    }
  });

  it('settle → scale with spring easing for cinematic-dark', () => {
    const groups = interactionToGroup({
      id: 'int_settle', target: 'cmp_cards', kind: 'settle',
    }, cmpMap, 'cinematic-dark');

    assert.equal(groups.length, 1);
    const scaleEffect = groups[0].effects.find(e => e.type === 'scale');
    assert.ok(scaleEffect);
    assert.equal(scaleEffect.from, 1.05);
    assert.equal(scaleEffect.to, 1);
    assert.equal(scaleEffect.easing, 'spring');
  });

  it('settle → ease_out easing for editorial', () => {
    const groups = interactionToGroup({
      id: 'int_settle', target: 'cmp_cards', kind: 'settle',
    }, cmpMap, 'editorial');

    const scaleEffect = groups[0].effects.find(e => e.type === 'scale');
    assert.equal(scaleEffect.easing, 'ease_out');
  });

  it('pulse_focus → scale oscillation × count', () => {
    const groups = interactionToGroup({
      id: 'int_pulse', target: 'cmp_badge', kind: 'pulse_focus',
      params: { count: 3, intensity: 1.08 },
    }, cmpMap, null);

    assert.equal(groups.length, 1);
    const scaleEffects = groups[0].effects.filter(e => e.type === 'scale');
    // 3 pulses × 2 effects (up + down) = 6 scale effects
    assert.equal(scaleEffects.length, 6);
    assert.equal(scaleEffects[0].to, 1.08);
  });

  it('timing: at_ms resolves to delay_after_hero_ms', () => {
    const groups = interactionToGroup({
      id: 'int_type', target: 'cmp_search', kind: 'type_text',
      params: { text: 'hi' },
      timing: { at_ms: 500 },
    }, cmpMap, null);

    assert.equal(groups[0].delay_after_hero_ms, 500);
  });

  it('timing: delay.after passes through to group', () => {
    const groups = interactionToGroup({
      id: 'int_type', target: 'cmp_search', kind: 'type_text',
      params: { text: 'hi' },
      timing: { delay: { after: 'typed', offset_ms: 200 } },
    }, cmpMap, null);

    assert.deepEqual(groups[0].delay, { after: 'typed', offset_ms: 200 });
  });

  it('timing: on_complete.emit passes through', () => {
    const groups = interactionToGroup({
      id: 'int_type', target: 'cmp_search', kind: 'type_text',
      params: { text: 'hi' },
      on_complete: { emit: 'typed' },
    }, cmpMap, null);

    assert.deepEqual(groups[0].on_complete, { emit: 'typed' });
  });
});

// ── compileCameraBehavior ────────────────────────────────────────────────────

describe('compileCameraBehavior', () => {
  it('reactive → push_in', () => {
    const result = compileCameraBehavior(
      { mode: 'reactive' }, 240, 60, null, []
    );
    assert.equal(result.move, 'push_in');
    assert.equal(result.intensity, 0.2);
  });

  it('ambient → drift with custom intensity', () => {
    const result = compileCameraBehavior(
      { mode: 'ambient', ambient: { drift: 0.3 } }, 240, 60, null
    );
    assert.equal(result.move, 'drift');
    assert.equal(result.intensity, 0.3);
  });

  it('static → empty object', () => {
    const result = compileCameraBehavior(
      { mode: 'static' }, 240, 60, null
    );
    assert.deepEqual(result, {});
  });

  it('montage personality forces ambient → static', () => {
    const result = compileCameraBehavior(
      { mode: 'ambient', ambient: { drift: 0.2 } }, 240, 60, 'montage'
    );
    assert.deepEqual(result, {});
  });
});

// ── applySemanticConstraints ─────────────────────────────────────────────────

describe('applySemanticConstraints', () => {
  it('editorial: settle easing → ease_out (not spring)', () => {
    const groups = [{
      id: 'int_settle',
      effects: [{ type: 'scale', from: 1.05, to: 1, duration_ms: 400, easing: 'spring' }],
    }];
    applySemanticConstraints(groups, 'editorial');
    assert.equal(groups[0].effects[0].easing, 'ease_out');
  });

  it('editorial: fan_stack rotate capped at 10°', () => {
    const groups = [{
      id: 'int_fan_card_0',
      effects: [{ type: 'rotate', from: 0, to: 15, duration_ms: 600, easing: 'spring' }],
    }];
    applySemanticConstraints(groups, 'editorial');
    assert.equal(groups[0].effects[0].to, 10);
    assert.equal(groups[0].effects[0].easing, 'ease_out');
  });

  it('montage: insert_items stagger → 0ms', () => {
    const groups = [{
      id: 'int_insert',
      stagger: { interval_ms: 120, order: 'sequential' },
      effects: [{ type: 'translateY', from: 20, to: 0 }],
    }];
    applySemanticConstraints(groups, 'montage');
    assert.equal(groups[0].stagger.interval_ms, 0);
  });

  it('neutral-light: fan_stack rotate → translateX fallback', () => {
    const groups = [{
      id: 'int_fan_card_0',
      effects: [{ type: 'rotate', from: 0, to: 5, duration_ms: 600, easing: 'spring' }],
    }];
    applySemanticConstraints(groups, 'neutral-light');
    assert.equal(groups[0].effects[0].type, 'translateX');
    assert.equal(groups[0].effects[0].easing, 'ease_out');
  });

  it('neutral-light: pulse_focus limited to 1 count (2 scale effects)', () => {
    const groups = [{
      id: 'int_pulse',
      effects: [
        { type: 'scale', from: 1, to: 1.05, duration_ms: 100 },
        { type: 'scale', from: 1.05, to: 1, duration_ms: 100 },
        { type: 'scale', from: 1, to: 1.05, duration_ms: 100 },
        { type: 'scale', from: 1.05, to: 1, duration_ms: 100 },
      ],
    }];
    applySemanticConstraints(groups, 'neutral-light');
    const scaleEffects = groups[0].effects.filter(e => e.type === 'scale');
    assert.equal(scaleEffects.length, 2, 'should only have 1 pulse (2 scale effects)');
  });
});

// ── Full v3 → Level 2 integration ───────────────────────────────────────────

describe('v3 semantic → compileMotion integration', () => {
  it('full v3 scene produces valid Level 2 timeline', () => {
    const scene = makeV3Scene({
      semantic: {
        components: [
          { id: 'cmp_search', type: 'input_field', role: 'hero' },
          { id: 'cmp_results', type: 'result_stack', role: 'supporting' },
        ],
        interactions: [
          {
            id: 'int_type',
            target: 'cmp_search',
            kind: 'type_text',
            params: { text: 'hello', speed: 50 },
            timing: { at_ms: 300 },
            on_complete: { emit: 'typed' },
          },
          {
            id: 'int_insert',
            target: 'cmp_results',
            kind: 'insert_items',
            params: { items: ['A', 'B'], stagger_ms: 100 },
            timing: { delay: { after: 'typed', offset_ms: 200 } },
          },
        ],
        camera_behavior: { mode: 'ambient', ambient: { drift: 0.15 } },
      },
    });

    const result = compileMotion(scene, makeCatalogs());

    // Should produce a valid timeline
    assert.ok(result, 'should return a timeline');
    assert.equal(result.scene_id, 'sc_v3_test');
    assert.equal(result.duration_frames, 240); // 4s * 60fps
    assert.ok(result.tracks.layers, 'should have layer tracks');

    // Should have camera tracks from ambient drift
    assert.ok(result.tracks.camera, 'should have camera tracks');

    // Layer tracks should have keyframes
    const layerIds = Object.keys(result.tracks.layers);
    assert.ok(layerIds.length > 0, 'should have at least one layer with tracks');

    // Verify keyframe structure
    for (const [layerId, tracks] of Object.entries(result.tracks.layers)) {
      for (const [prop, keyframes] of Object.entries(tracks)) {
        assert.ok(Array.isArray(keyframes), `${layerId}.${prop} should be array`);
        for (const kf of keyframes) {
          assert.equal(typeof kf.frame, 'number', `${layerId}.${prop} keyframe needs frame`);
          assert.ok(kf.value != null, `${layerId}.${prop} keyframe needs value`);
        }
      }
    }
  });

  it('v1/v2 scenes still compile correctly (regression)', () => {
    // v1 scene — no motion, no semantic
    const v1Scene = makeScene({ motion: undefined, semantic: undefined });
    assert.equal(compileMotion(v1Scene), null);

    // v2 scene — motion block, no semantic
    const v2Scene = makeScene({
      motion: {
        groups: [{
          id: 'hero',
          targets: ['title'],
          primitive: 'as-fadeInUp',
        }],
      },
    });
    const v2Result = compileMotion(v2Scene, makeCatalogs());
    assert.ok(v2Result);
    assert.ok(v2Result.tracks.layers.title);
  });

  it('mixed v2+v3 scene compiles with both explicit and semantic groups', () => {
    const scene = makeV3Scene({
      layers: [
        { id: 'logo', type: 'image', content: 'logo.png' },
      ],
      motion: {
        groups: [{
          id: 'logo_entrance',
          targets: ['logo'],
          primitive: 'as-fadeIn',
        }],
      },
      semantic: {
        components: [
          { id: 'cmp_search', type: 'input_field', role: 'hero' },
        ],
        interactions: [
          {
            id: 'int_type',
            target: 'cmp_search',
            kind: 'type_text',
            params: { text: 'test' },
            timing: { at_ms: 500 },
          },
        ],
      },
    });

    const result = compileMotion(scene, makeCatalogs());

    assert.ok(result, 'should compile');
    // Should have tracks for both logo (v2) and semantic targets
    assert.ok(result.tracks.layers.logo, 'logo should have tracks from v2 group');
  });
});
