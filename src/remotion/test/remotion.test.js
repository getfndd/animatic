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
} from '../lib.js';

// ── Load test manifests ─────────────────────────────────────────────────────

const manifestDir = new URL('../manifests/', import.meta.url);
const test3Scene = JSON.parse(readFileSync(new URL('test-3-scene.json', manifestDir), 'utf-8'));
const testTransitions = JSON.parse(readFileSync(new URL('test-transitions.json', manifestDir), 'utf-8'));
const testAssets = JSON.parse(readFileSync(new URL('test-assets.json', manifestDir), 'utf-8'));

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
