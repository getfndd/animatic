/**
 * Tests for the Remotion video pipeline: duration calculation, layout,
 * transition defaults, and manifest/scene schema validation.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test src/remotion/test/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  calculateDuration,
  calculateLayout,
  getDefaultTransitionDuration,
  validateManifest,
  validateScene,
  CAMERA_CONSTANTS,
  getParallaxFactor,
  getCameraTransformValues,
  calculateOverscanDimensions,
  TEXT_ANIMATION_DEFAULTS,
  getWordRevealState,
  getScaleCascadePosition,
  getWeightMorphValue,
} from '../lib.js';

// ── Load test manifests ─────────────────────────────────────────────────────

const manifestDir = new URL('../manifests/', import.meta.url);
const test3Scene = JSON.parse(readFileSync(new URL('test-3-scene.json', manifestDir), 'utf-8'));
const testTransitions = JSON.parse(readFileSync(new URL('test-transitions.json', manifestDir), 'utf-8'));
const testAssets = JSON.parse(readFileSync(new URL('test-assets.json', manifestDir), 'utf-8'));
const testKineticType = JSON.parse(readFileSync(new URL('test-kinetic-type.json', manifestDir), 'utf-8'));

// ── getDefaultTransitionDuration ────────────────────────────────────────────

describe('getDefaultTransitionDuration', () => {
  it('hard_cut returns 0ms', () => {
    assert.equal(getDefaultTransitionDuration('hard_cut'), 0);
  });

  it('crossfade returns 400ms', () => {
    assert.equal(getDefaultTransitionDuration('crossfade'), 400);
  });

  it('whip directions return 250ms', () => {
    for (const dir of ['whip_left', 'whip_right', 'whip_up', 'whip_down']) {
      assert.equal(getDefaultTransitionDuration(dir), 250, `${dir} should be 250ms`);
    }
  });

  it('unknown type returns 0ms', () => {
    assert.equal(getDefaultTransitionDuration('slide'), 0);
    assert.equal(getDefaultTransitionDuration(undefined), 0);
  });
});

// ── calculateDuration ───────────────────────────────────────────────────────

describe('calculateDuration', () => {
  it('3 scenes at 3s each with no transitions = 540 frames at 60fps', () => {
    const result = calculateDuration(test3Scene.manifest);
    assert.equal(result, 540); // 3 * 3s * 60fps = 540
  });

  it('accounts for transition overlap', () => {
    // test-transitions: 5 scenes (3 + 3 + 2.5 + 2.5 + 3 = 14s)
    // Overlaps: crossfade 600ms + whip 250ms + whip 250ms + crossfade 400ms = 1500ms = 1.5s
    // Total: (14 - 1.5) * 60 = 750 frames
    const result = calculateDuration(testTransitions.manifest);
    assert.equal(result, 750);
  });

  it('single scene has no transition overlap', () => {
    const manifest = { fps: 60, scenes: [{ scene: 'sc_test', duration_s: 5 }] };
    assert.equal(calculateDuration(manifest), 300);
  });

  it('defaults to 3s per scene when duration_s is missing', () => {
    const manifest = { fps: 60, scenes: [{ scene: 'sc_a' }, { scene: 'sc_b' }] };
    assert.equal(calculateDuration(manifest), 360); // 2 * 3s * 60fps
  });

  it('defaults to 60fps when fps is missing', () => {
    const manifest = { scenes: [{ scene: 'sc_test', duration_s: 2 }] };
    assert.equal(calculateDuration(manifest), 120);
  });

  it('hard_cut transitions contribute 0 overlap', () => {
    const manifest = {
      fps: 60,
      scenes: [
        { scene: 'sc_a', duration_s: 3 },
        { scene: 'sc_b', duration_s: 3, transition_in: { type: 'hard_cut', duration_ms: 0 } },
      ],
    };
    assert.equal(calculateDuration(manifest), 360);
  });

  it('works at 24fps', () => {
    const manifest = { fps: 24, scenes: [{ scene: 'sc_a', duration_s: 5 }] };
    assert.equal(calculateDuration(manifest), 120);
  });

  it('works at 30fps', () => {
    const manifest = { fps: 30, scenes: [{ scene: 'sc_a', duration_s: 4 }] };
    assert.equal(calculateDuration(manifest), 120);
  });

  it('empty scenes array returns 0', () => {
    const manifest = { fps: 60, scenes: [] };
    assert.equal(calculateDuration(manifest), 0);
  });

  it('handles assets manifest with mixed transitions', () => {
    // test-assets: 3 scenes (3 + 3 + 3 = 9s)
    // Overlaps: crossfade 400ms + whip_left 250ms = 650ms = 0.65s
    // Total: (9 - 0.65) * 60 = 501 frames → ceil = 501
    const result = calculateDuration(testAssets.manifest);
    assert.equal(result, 501);
  });
});

// ── calculateLayout ─────────────────────────────────────────────────────────

describe('calculateLayout', () => {
  it('3 scenes with no transitions start sequentially', () => {
    const scenes = test3Scene.manifest.scenes;
    const layout = calculateLayout(scenes, 60);

    assert.equal(layout.length, 3);
    assert.equal(layout[0].startFrame, 0);
    assert.equal(layout[0].durationFrames, 180);
    assert.equal(layout[1].startFrame, 180);
    assert.equal(layout[1].durationFrames, 180);
    assert.equal(layout[2].startFrame, 360);
    assert.equal(layout[2].durationFrames, 180);
  });

  it('transitions create overlap between scenes', () => {
    const scenes = testTransitions.manifest.scenes;
    const layout = calculateLayout(scenes, 60);

    // Scene 1: starts at 0, 3s = 180 frames
    assert.equal(layout[0].startFrame, 0);
    assert.equal(layout[0].durationFrames, 180);

    // Scene 2 has crossfade 600ms → overlap is 36 frames (0.6s * 60fps)
    // Scene 1 ends at 180, but next scene's transition creates overlap
    // Scene 2 starts at 180 - 36 = 144
    assert.equal(layout[1].startFrame, 144);

    // Scene 2: 3s = 180 frames
    assert.equal(layout[1].durationFrames, 180);
  });

  it('last scene has no nextTransitionFrames', () => {
    const scenes = test3Scene.manifest.scenes;
    const layout = calculateLayout(scenes, 60);
    const last = layout[layout.length - 1];
    assert.equal(last.nextTransitionFrames, 0);
    assert.deepEqual(last.nextTransition, { type: 'hard_cut' });
  });

  it('preserves entry references', () => {
    const scenes = test3Scene.manifest.scenes;
    const layout = calculateLayout(scenes, 60);
    assert.equal(layout[0].entry.scene, 'sc_brand_mark');
    assert.equal(layout[1].entry.scene, 'sc_ui_card');
    assert.equal(layout[2].entry.scene, 'sc_typography');
  });

  it('single scene layout', () => {
    const layout = calculateLayout([{ scene: 'sc_only', duration_s: 5 }], 60);
    assert.equal(layout.length, 1);
    assert.equal(layout[0].startFrame, 0);
    assert.equal(layout[0].durationFrames, 300);
    assert.equal(layout[0].nextTransitionFrames, 0);
  });

  it('defaults duration to 3s when missing', () => {
    const layout = calculateLayout([{ scene: 'sc_no_dur' }], 60);
    assert.equal(layout[0].durationFrames, 180);
  });
});

// ── validateManifest ────────────────────────────────────────────────────────

describe('validateManifest', () => {
  it('validates test-3-scene manifest', () => {
    const result = validateManifest(test3Scene.manifest);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('validates test-transitions manifest', () => {
    const result = validateManifest(testTransitions.manifest);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('validates test-assets manifest', () => {
    const result = validateManifest(testAssets.manifest);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('rejects missing sequence_id', () => {
    const result = validateManifest({ scenes: [{ scene: 'sc_a', duration_s: 3 }] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('sequence_id')));
  });

  it('rejects invalid sequence_id format', () => {
    const result = validateManifest({ sequence_id: 'bad-id', scenes: [{ scene: 'sc_a', duration_s: 3 }] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('seq_')));
  });

  it('rejects invalid fps values', () => {
    const result = validateManifest({ sequence_id: 'seq_test', fps: 25, scenes: [{ scene: 'sc_a', duration_s: 3 }] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('fps')));
  });

  it('accepts valid fps values', () => {
    for (const fps of [24, 30, 60]) {
      const result = validateManifest({ sequence_id: 'seq_test', fps, scenes: [{ scene: 'sc_a', duration_s: 3 }] });
      assert.equal(result.valid, true, `fps=${fps} should be valid: ${result.errors.join(', ')}`);
    }
  });

  it('rejects empty scenes array', () => {
    const result = validateManifest({ sequence_id: 'seq_test', scenes: [] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('scenes')));
  });

  it('rejects duration_s out of range', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_a', duration_s: 0.4 }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('duration_s')));
  });

  it('rejects duration_s above 30', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_a', duration_s: 31 }],
    });
    assert.equal(result.valid, false);
  });

  it('accepts boundary duration values', () => {
    const result05 = validateManifest({ sequence_id: 'seq_test', scenes: [{ scene: 'sc_a', duration_s: 0.5 }] });
    assert.equal(result05.valid, true);
    const result30 = validateManifest({ sequence_id: 'seq_test', scenes: [{ scene: 'sc_a', duration_s: 30 }] });
    assert.equal(result30.valid, true);
  });

  it('rejects invalid transition type', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_a', duration_s: 3, transition_in: { type: 'slide' } }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('transition_in.type')));
  });

  it('rejects transition duration_ms out of range', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_a', duration_s: 3, transition_in: { type: 'crossfade', duration_ms: 3000 } }],
    });
    assert.equal(result.valid, false);
  });

  it('rejects invalid camera move', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_a', duration_s: 3, camera_override: { move: 'zoom' } }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('camera_override.move')));
  });

  it('rejects camera intensity out of range', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_a', duration_s: 3, camera_override: { move: 'push_in', intensity: 1.5 } }],
    });
    assert.equal(result.valid, false);
  });

  it('rejects invalid camera easing', () => {
    const result = validateManifest({
      sequence_id: 'seq_test',
      scenes: [{ scene: 'sc_a', duration_s: 3, camera_override: { easing: 'bounce' } }],
    });
    assert.equal(result.valid, false);
  });
});

// ── validateScene ───────────────────────────────────────────────────────────

describe('validateScene', () => {
  it('validates all scene definitions in test-assets', () => {
    for (const [id, scene] of Object.entries(testAssets.sceneDefs)) {
      const result = validateScene(scene);
      assert.equal(result.valid, true, `${id} errors: ${result.errors.join(', ')}`);
    }
  });

  it('rejects missing scene_id', () => {
    const result = validateScene({ duration_s: 3 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('scene_id')));
  });

  it('rejects invalid scene_id format', () => {
    const result = validateScene({ scene_id: 'bad-scene' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('sc_')));
  });

  it('rejects duration_s out of range', () => {
    const r1 = validateScene({ scene_id: 'sc_test', duration_s: 0.3 });
    assert.equal(r1.valid, false);
    const r2 = validateScene({ scene_id: 'sc_test', duration_s: 35 });
    assert.equal(r2.valid, false);
  });

  it('detects duplicate asset IDs', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [
        { id: 'bg', src: 'a.mp4' },
        { id: 'bg', src: 'b.mp4' },
      ],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('duplicate asset.id')));
  });

  it('detects duplicate layer IDs', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [],
      layers: [
        { id: 'layer1', type: 'html' },
        { id: 'layer1', type: 'html' },
      ],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('duplicate layer.id')));
  });

  it('detects broken asset references', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [{ id: 'real_asset', src: 'file.mp4' }],
      layers: [{ id: 'layer1', type: 'video', asset: 'nonexistent' }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('unknown asset')));
  });

  it('validates valid asset references', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [{ id: 'bg_video', src: 'test.mp4' }],
      layers: [{ id: 'layer1', type: 'video', asset: 'bg_video' }],
    });
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('rejects invalid layer type', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [],
      layers: [{ id: 'layer1', type: 'svg' }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('type')));
  });

  it('rejects invalid depth_class', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [],
      layers: [{ id: 'layer1', type: 'html', depth_class: 'front' }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('depth_class')));
  });

  it('rejects invalid blend_mode', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [],
      layers: [{ id: 'layer1', type: 'html', blend_mode: 'add' }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('blend_mode')));
  });

  it('rejects opacity out of range', () => {
    const result = validateScene({
      scene_id: 'sc_test',
      assets: [],
      layers: [{ id: 'layer1', type: 'html', opacity: 1.5 }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('opacity')));
  });

  it('accepts opacity at boundaries', () => {
    const r0 = validateScene({
      scene_id: 'sc_test',
      assets: [],
      layers: [{ id: 'layer1', type: 'html', opacity: 0 }],
    });
    assert.equal(r0.valid, true);
    const r1 = validateScene({
      scene_id: 'sc_test',
      assets: [],
      layers: [{ id: 'layer1', type: 'html', opacity: 1 }],
    });
    assert.equal(r1.valid, true);
  });

  it('rejects invalid camera move', () => {
    const result = validateScene({ scene_id: 'sc_test', camera: { move: 'zoom' } });
    assert.equal(result.valid, false);
  });

  it('accepts all valid camera moves', () => {
    for (const move of ['static', 'push_in', 'pull_out', 'pan_left', 'pan_right', 'drift']) {
      const result = validateScene({ scene_id: 'sc_test', camera: { move } });
      assert.equal(result.valid, true, `${move} should be valid`);
    }
  });
});

// ── Camera Math ──────────────────────────────────────────────────────────────

// Linear identity easing — avoids Remotion dependency in tests
const linear = (t) => t;

describe('CAMERA_CONSTANTS', () => {
  it('exports all expected keys as numbers', () => {
    const keys = ['SCALE_FACTOR', 'PAN_MAX_PX', 'DRIFT_AMPLITUDE', 'DRIFT_Y_RATIO', 'DEFAULT_INTENSITY', 'MIN_OVERSCAN'];
    for (const key of keys) {
      assert.equal(typeof CAMERA_CONSTANTS[key], 'number', `${key} should be a number`);
    }
  });

  it('has correct spec values', () => {
    assert.equal(CAMERA_CONSTANTS.SCALE_FACTOR, 0.08);
    assert.equal(CAMERA_CONSTANTS.PAN_MAX_PX, 80);
    assert.equal(CAMERA_CONSTANTS.DRIFT_AMPLITUDE, 3);
  });
});

describe('getParallaxFactor', () => {
  it('foreground returns 1.0', () => {
    assert.equal(getParallaxFactor('foreground'), 1.0);
  });

  it('midground returns 0.6', () => {
    assert.equal(getParallaxFactor('midground'), 0.6);
  });

  it('background returns 0.3', () => {
    assert.equal(getParallaxFactor('background'), 0.3);
  });

  it('defaults to 0.6 for unknown depth class', () => {
    assert.equal(getParallaxFactor(undefined), 0.6);
    assert.equal(getParallaxFactor('other'), 0.6);
  });
});

describe('getCameraTransformValues', () => {
  it('returns none for null camera', () => {
    assert.deepEqual(getCameraTransformValues(null, 0.5, linear), { transform: 'none' });
  });

  it('returns none for undefined camera', () => {
    assert.deepEqual(getCameraTransformValues(undefined, 0.5, linear), { transform: 'none' });
  });

  it('returns none for static move', () => {
    assert.deepEqual(getCameraTransformValues({ move: 'static' }, 0.5, linear), { transform: 'none' });
  });

  it('returns none for unknown move', () => {
    assert.deepEqual(getCameraTransformValues({ move: 'zoom' }, 0.5, linear), { transform: 'none' });
  });

  it('uses DEFAULT_INTENSITY when intensity not specified', () => {
    const result = getCameraTransformValues({ move: 'push_in' }, 1, linear);
    const expectedScale = 1 + 1 * 0.5 * 0.08; // progress=1, default intensity=0.5
    assert.equal(result.transform, `scale(${expectedScale})`);
  });

  // push_in
  it('push_in at progress=0 is scale(1)', () => {
    const result = getCameraTransformValues({ move: 'push_in', intensity: 0.3 }, 0, linear);
    assert.equal(result.transform, 'scale(1)');
  });

  it('push_in at progress=0.5 scales partially', () => {
    const result = getCameraTransformValues({ move: 'push_in', intensity: 0.5 }, 0.5, linear);
    const expected = 1 + 0.5 * 0.5 * 0.08;
    assert.equal(result.transform, `scale(${expected})`);
  });

  it('push_in at progress=1 reaches max scale', () => {
    const result = getCameraTransformValues({ move: 'push_in', intensity: 1.0 }, 1, linear);
    const expected = 1 + 1 * 1.0 * 0.08;
    assert.equal(result.transform, `scale(${expected})`);
  });

  // pull_out
  it('pull_out at progress=0 starts at max scale', () => {
    const result = getCameraTransformValues({ move: 'pull_out', intensity: 0.5 }, 0, linear);
    const expected = 1 + 0.5 * 0.08;
    assert.equal(result.transform, `scale(${expected})`);
  });

  it('pull_out at progress=1 returns to scale(1)', () => {
    const result = getCameraTransformValues({ move: 'pull_out', intensity: 0.5 }, 1, linear);
    const startScale = 1 + 0.5 * 0.08;
    const expected = startScale - 1 * 0.5 * 0.08;
    assert.equal(result.transform, `scale(${expected})`);
  });

  // pan_left
  it('pan_left at progress=0 has no translation', () => {
    const result = getCameraTransformValues({ move: 'pan_left', intensity: 0.4 }, 0, linear);
    assert.equal(result.transform, 'translateX(0px)');
  });

  it('pan_left at progress=1 translates full distance', () => {
    const result = getCameraTransformValues({ move: 'pan_left', intensity: 0.4 }, 1, linear);
    const expected = -1 * 0.4 * 80;
    assert.equal(result.transform, `translateX(${expected}px)`);
  });

  // pan_right
  it('pan_right at progress=1 translates positive', () => {
    const result = getCameraTransformValues({ move: 'pan_right', intensity: 0.5 }, 1, linear);
    const expected = 1 * 0.5 * 80;
    assert.equal(result.transform, `translateX(${expected}px)`);
  });

  // drift
  it('drift at progress=0 starts at translate(0px, ...)', () => {
    const result = getCameraTransformValues({ move: 'drift', intensity: 0.5 }, 0, linear);
    // sin(0) = 0, cos(0) = 1
    const amplitude = 0.5 * 3;
    const ty = 1 * amplitude * 0.6;
    assert.equal(result.transform, `translate(0px, ${ty}px)`);
  });

  it('drift uses raw progress, not eased', () => {
    // Pass a doubling easing — drift should ignore it and use raw progress
    const doubleEasing = (t) => t * 2;
    const result = getCameraTransformValues({ move: 'drift', intensity: 1.0 }, 0.25, doubleEasing);
    const amplitude = 1.0 * 3;
    const tx = Math.sin(0.25 * Math.PI * 2) * amplitude;
    const ty = Math.cos(0.25 * Math.PI * 1.5) * amplitude * 0.6;
    assert.equal(result.transform, `translate(${tx}px, ${ty}px)`);
  });

  it('works without easing function (falls back to raw progress)', () => {
    const result = getCameraTransformValues({ move: 'push_in', intensity: 0.5 }, 1, null);
    const expected = 1 + 1 * 0.5 * 0.08;
    assert.equal(result.transform, `scale(${expected})`);
  });
});

describe('calculateOverscanDimensions', () => {
  const W = 1920;
  const H = 1080;

  it('static returns viewport dims with no offset', () => {
    const result = calculateOverscanDimensions(W, H, { move: 'static' });
    assert.equal(result.canvasW, W);
    assert.equal(result.canvasH, H);
    assert.equal(result.offsetX, 0);
    assert.equal(result.offsetY, 0);
  });

  it('null camera returns viewport dims', () => {
    const result = calculateOverscanDimensions(W, H, null);
    assert.equal(result.canvasW, W);
    assert.equal(result.canvasH, H);
  });

  it('pan_right adds horizontal overscan', () => {
    const result = calculateOverscanDimensions(W, H, { move: 'pan_right', intensity: 0.5 });
    assert.ok(result.canvasW > W, 'canvas should be wider than viewport');
    assert.ok(result.canvasH > H, 'canvas should be taller than viewport');
  });

  it('pan_left uses same overscan as pan_right', () => {
    const left = calculateOverscanDimensions(W, H, { move: 'pan_left', intensity: 0.4 });
    const right = calculateOverscanDimensions(W, H, { move: 'pan_right', intensity: 0.4 });
    assert.equal(left.canvasW, right.canvasW);
    assert.equal(left.canvasH, right.canvasH);
  });

  it('push_in adds scale-based overscan', () => {
    const result = calculateOverscanDimensions(W, H, { move: 'push_in', intensity: 0.5 });
    assert.ok(result.canvasW > W);
    assert.ok(result.canvasH > H);
  });

  it('pull_out uses same overscan as push_in', () => {
    const pushIn = calculateOverscanDimensions(W, H, { move: 'push_in', intensity: 0.6 });
    const pullOut = calculateOverscanDimensions(W, H, { move: 'pull_out', intensity: 0.6 });
    assert.equal(pushIn.canvasW, pullOut.canvasW);
    assert.equal(pushIn.canvasH, pullOut.canvasH);
  });

  it('drift has minimal overscan (near MIN_OVERSCAN floor)', () => {
    const result = calculateOverscanDimensions(W, H, { move: 'drift', intensity: 0.5 });
    assert.ok(result.canvasW > W);
    // Drift overscan should be smaller than pan overscan
    const pan = calculateOverscanDimensions(W, H, { move: 'pan_right', intensity: 0.5 });
    assert.ok(result.canvasW <= pan.canvasW, 'drift overscan should be <= pan overscan');
  });

  it('offsets center the canvas within the viewport', () => {
    const result = calculateOverscanDimensions(W, H, { move: 'pan_right', intensity: 0.5 });
    assert.equal(result.offsetX, (result.canvasW - W) / 2);
    assert.equal(result.offsetY, (result.canvasH - H) / 2);
  });

  it('higher intensity produces larger overscan', () => {
    const low = calculateOverscanDimensions(W, H, { move: 'pan_right', intensity: 0.2 });
    const high = calculateOverscanDimensions(W, H, { move: 'pan_right', intensity: 0.8 });
    assert.ok(high.canvasW > low.canvasW, 'higher intensity should produce wider canvas');
  });

  it('defaults to DEFAULT_INTENSITY when intensity not specified', () => {
    const result = calculateOverscanDimensions(W, H, { move: 'push_in' });
    const explicit = calculateOverscanDimensions(W, H, { move: 'push_in', intensity: 0.5 });
    assert.equal(result.canvasW, explicit.canvasW);
    assert.equal(result.canvasH, explicit.canvasH);
  });

  it('unknown move gets MIN_OVERSCAN floor', () => {
    const result = calculateOverscanDimensions(W, H, { move: 'zoom' });
    // Unknown move hits default (0,0) then floors at MIN_OVERSCAN
    const expectedW = Math.ceil(W * (1 + 2 * CAMERA_CONSTANTS.MIN_OVERSCAN));
    const expectedH = Math.ceil(H * (1 + 2 * CAMERA_CONSTANTS.MIN_OVERSCAN));
    assert.equal(result.canvasW, expectedW);
    assert.equal(result.canvasH, expectedH);
  });
});

// ── Text Animation Math ─────────────────────────────────────────────────────

describe('TEXT_ANIMATION_DEFAULTS', () => {
  it('exports all expected keys', () => {
    const keys = [
      'WORD_REVEAL_STAGGER', 'WORD_REVEAL_TRANSLATE_Y',
      'SCALE_CASCADE_SCALES', 'SCALE_CASCADE_SPEEDS',
      'WEIGHT_MORPH_MIN', 'WEIGHT_MORPH_MAX', 'WEIGHT_MORPH_CHAR_STAGGER',
    ];
    for (const key of keys) {
      assert.ok(key in TEXT_ANIMATION_DEFAULTS, `${key} should exist`);
    }
  });

  it('scales descend (large to small)', () => {
    const scales = TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SCALES;
    for (let i = 1; i < scales.length; i++) {
      assert.ok(scales[i] < scales[i - 1], `scale[${i}] should be less than scale[${i - 1}]`);
    }
  });

  it('speeds ascend (slow to fast)', () => {
    const speeds = TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SPEEDS;
    for (let i = 1; i < speeds.length; i++) {
      assert.ok(speeds[i] > speeds[i - 1], `speed[${i}] should be greater than speed[${i - 1}]`);
    }
  });

  it('scales and speeds arrays have same length', () => {
    assert.equal(
      TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SCALES.length,
      TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SPEEDS.length,
    );
  });

  it('weight morph min is less than max', () => {
    assert.ok(TEXT_ANIMATION_DEFAULTS.WEIGHT_MORPH_MIN < TEXT_ANIMATION_DEFAULTS.WEIGHT_MORPH_MAX);
  });
});

describe('getWordRevealState', () => {
  it('at progress=0 first word is invisible', () => {
    const state = getWordRevealState(0, 4, 0);
    assert.equal(state.opacity, 0);
    assert.equal(state.translateY, TEXT_ANIMATION_DEFAULTS.WORD_REVEAL_TRANSLATE_Y);
  });

  it('at progress=1 last word is fully visible', () => {
    const state = getWordRevealState(3, 4, 1);
    assert.equal(state.opacity, 1);
    assert.equal(state.translateY, 0);
  });

  it('first word appears before last word', () => {
    // At a mid-progress, the first word should be more visible than the last
    const first = getWordRevealState(0, 4, 0.3);
    const last = getWordRevealState(3, 4, 0.3);
    assert.ok(first.opacity > last.opacity, 'first word should be more opaque than last at early progress');
  });

  it('single word goes from 0 to 1 across full progress', () => {
    const atZero = getWordRevealState(0, 1, 0);
    assert.equal(atZero.opacity, 0);
    const atOne = getWordRevealState(0, 1, 1);
    assert.equal(atOne.opacity, 1);
    assert.equal(atOne.translateY, 0);
  });

  it('zero words returns invisible state', () => {
    const state = getWordRevealState(0, 0, 0.5);
    assert.equal(state.opacity, 0);
    assert.equal(state.translateY, TEXT_ANIMATION_DEFAULTS.WORD_REVEAL_TRANSLATE_Y);
  });

  it('opacity is clamped between 0 and 1', () => {
    // Progress way beyond the word's window
    const state = getWordRevealState(0, 4, 2);
    assert.ok(state.opacity >= 0 && state.opacity <= 1, 'opacity should be clamped');
  });

  it('opacity is 0 for negative progress', () => {
    const state = getWordRevealState(0, 4, -1);
    assert.equal(state.opacity, 0);
  });

  it('all words visible at progress=1', () => {
    for (let i = 0; i < 4; i++) {
      const state = getWordRevealState(i, 4, 1);
      assert.equal(state.opacity, 1, `word ${i} should be fully visible at progress=1`);
      assert.equal(state.translateY, 0, `word ${i} should have 0 translateY at progress=1`);
    }
  });
});

describe('getScaleCascadePosition', () => {
  const H = 1080;

  it('all layers start below viewport at progress=0', () => {
    for (let i = 0; i < 3; i++) {
      const { y } = getScaleCascadePosition(i, 0, H);
      assert.ok(y >= H, `layer ${i} should start at or below viewport (y=${y})`);
    }
  });

  it('each layer has a different scale', () => {
    const scales = [0, 1, 2].map(i => getScaleCascadePosition(i, 0.5, H).scale);
    assert.notEqual(scales[0], scales[1]);
    assert.notEqual(scales[1], scales[2]);
  });

  it('faster layer moves farther than slower layer at same progress', () => {
    const slow = getScaleCascadePosition(0, 0.5, H);
    const fast = getScaleCascadePosition(2, 0.5, H);
    // Fast layer should have moved farther from start (lower y value)
    assert.ok(fast.y < slow.y, `fast layer (y=${fast.y}) should be higher than slow (y=${slow.y})`);
  });

  it('scales match SCALE_CASCADE_SCALES constant', () => {
    for (let i = 0; i < 3; i++) {
      const { scale } = getScaleCascadePosition(i, 0.5, H);
      assert.equal(scale, TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SCALES[i]);
    }
  });
});

describe('getWeightMorphValue', () => {
  it('returns start weight at progress=0', () => {
    assert.equal(getWeightMorphValue(0, 300, 900), 300);
  });

  it('returns end weight at progress=1', () => {
    assert.equal(getWeightMorphValue(1, 300, 900), 900);
  });

  it('returns midpoint at progress=0.5', () => {
    assert.equal(getWeightMorphValue(0.5, 300, 900), 600);
  });

  it('returns integer value', () => {
    const result = getWeightMorphValue(0.33, 300, 900);
    assert.equal(result, Math.round(result), 'result should be an integer');
  });

  it('per-character stagger offsets the progress', () => {
    // Character 0 should be ahead of character 5
    const char0 = getWeightMorphValue(0.5, 300, 900, 0, 10);
    const char5 = getWeightMorphValue(0.5, 300, 900, 5, 10);
    assert.ok(char0 > char5, `char 0 (${char0}) should be heavier than char 5 (${char5}) at same progress`);
  });

  it('clamps below 0 progress to start weight', () => {
    assert.equal(getWeightMorphValue(-0.5, 300, 900), 300);
  });

  it('clamps above 1 progress to end weight', () => {
    assert.equal(getWeightMorphValue(1.5, 300, 900), 900);
  });

  it('works with reversed weight range', () => {
    // 900 → 300 (getting lighter)
    assert.equal(getWeightMorphValue(0, 900, 300), 900);
    assert.equal(getWeightMorphValue(1, 900, 300), 300);
  });
});

// ── validateScene: text layers ──────────────────────────────────────────────

describe('validateScene text layers', () => {
  it('accepts valid text layer', () => {
    const result = validateScene({
      scene_id: 'sc_test_text',
      layers: [
        { id: 'title', type: 'text', content: 'Hello World', animation: 'word-reveal' },
      ],
      assets: [],
    });
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('rejects text layer with missing content', () => {
    const result = validateScene({
      scene_id: 'sc_test_text',
      layers: [
        { id: 'title', type: 'text', animation: 'word-reveal' },
      ],
      assets: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('content')));
  });

  it('rejects text layer with empty string content', () => {
    const result = validateScene({
      scene_id: 'sc_test_text',
      layers: [
        { id: 'title', type: 'text', content: '', animation: 'word-reveal' },
      ],
      assets: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('content')));
  });

  it('rejects invalid animation name', () => {
    const result = validateScene({
      scene_id: 'sc_test_text',
      layers: [
        { id: 'title', type: 'text', content: 'Hello', animation: 'bounce' },
      ],
      assets: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('animation')));
  });

  it('accepts all valid animation names', () => {
    for (const animation of ['word-reveal', 'scale-cascade', 'weight-morph']) {
      const result = validateScene({
        scene_id: 'sc_test_text',
        layers: [
          { id: 'title', type: 'text', content: 'Hello', animation },
        ],
        assets: [],
      });
      assert.equal(result.valid, true, `animation "${animation}" should be valid: ${result.errors.join(', ')}`);
    }
  });

  it('accepts text layer without animation (static text)', () => {
    const result = validateScene({
      scene_id: 'sc_test_text',
      layers: [
        { id: 'title', type: 'text', content: 'Static Text' },
      ],
      assets: [],
    });
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('validates all scene definitions in test-kinetic-type', () => {
    for (const [id, scene] of Object.entries(testKineticType.sceneDefs)) {
      const result = validateScene(scene);
      assert.equal(result.valid, true, `${id} errors: ${result.errors.join(', ')}`);
    }
  });

  it('validates test-kinetic-type manifest', () => {
    const result = validateManifest(testKineticType.manifest);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });
});
