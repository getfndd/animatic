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
