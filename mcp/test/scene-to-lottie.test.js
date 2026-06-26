/**
 * Scene → Lottie export (ANI-200).
 *
 * The camera-track → Lottie mapping, camera neutralisation, and reactive
 * fallback are pure and fully tested here. The poster RASTERISATION
 * (Remotion/Chromium) is TIER.RENDER and not exercised in unit tests — only the
 * handler's input-validation paths are, so the suite never launches a browser
 * (the render path is CI/manual, like the figma render proofs).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCameraLottie,
  cameraTrackFromTimeline,
  neutralizeCameraForPoster,
} from '../lib/lottie/from-timeline.js';
import { handleSceneToLottie } from '../handlers.js';
import { compileMotion } from '../lib/compiler.js';
import { loadPrimitivesCatalog, loadRecipes } from '../data/loader.js';

const POSTER = { dataUri: 'data:image/png;base64,AAAA', width: 1920, height: 1080 };
const base = (cameraTrack) => buildCameraLottie({
  cameraTrack, poster: POSTER, width: 1920, height: 1080, fps: 60, durationFrames: 180, name: 'sc_test',
});

describe('buildCameraLottie — structure', () => {
  it('emits a self-contained image-layer Lottie', () => {
    const l = base(null);
    assert.equal(l.w, 1920);
    assert.equal(l.h, 1080);
    assert.equal(l.fr, 60);
    assert.equal(l.op, 180);
    assert.equal(l.assets.length, 1);
    assert.equal(l.assets[0].e, 1); // embedded
    assert.equal(l.assets[0].p, POSTER.dataUri);
    assert.equal(l.layers.length, 1);
    assert.equal(l.layers[0].ty, 2); // image
    assert.equal(l.layers[0].refId, 'poster_0');
    // anchor at image centre so scale/rotate pivot on centre
    assert.deepEqual(l.layers[0].ks.a.k, [960, 540, 0]);
  });

  it('never animates opacity (camera carries none)', () => {
    const l = base({ scale: [{ frame: 0, value: 1 }, { frame: 90, value: 1.2, easing: 'expo_out' }] });
    assert.equal(l.layers[0].ks.o.a, 0);
    assert.equal(l.layers[0].ks.o.k, 100);
  });

  it('poster-only (null camera) → all transforms static', () => {
    const l = base(null);
    assert.equal(l.layers[0].ks.s.a, 0);
    assert.deepEqual(l.layers[0].ks.s.k, [100, 100]);
    assert.equal(l.layers[0].ks.p.a, 0);
    assert.deepEqual(l.layers[0].ks.p.k, [960, 540]);
  });
});

describe('buildCameraLottie — camera mapping', () => {
  it('push-in scale track → animated Lottie scale (percent) with bezier tangents', () => {
    const l = base({ scale: [
      { frame: 0, value: 1 },
      { frame: 90, value: 1.1, easing: 'cubic-bezier(0.33,0,0.2,1)' },
    ] });
    const s = l.layers[0].ks.s;
    assert.equal(s.a, 1);
    assert.equal(s.k.length, 2);
    assert.deepEqual(s.k[0].s, [100, 100]);
    assert.ok(Math.abs(s.k[1].s[0] - 110) < 1e-6, `expected ~110, got ${s.k[1].s[0]}`);
    // easing from the DESTINATION keyframe lands on the SOURCE keyframe's tangents
    assert.deepEqual(s.k[0].o, { x: [0.33], y: [0] });
    assert.deepEqual(s.k[0].i, { x: [0.2], y: [1] });
    assert.ok(!('o' in s.k[1]), 'last keyframe carries no out tangent');
  });

  it('pan translateX → animated position, y held at comp centre', () => {
    const l = base({ translateX: [
      { frame: 0, value: 0 },
      { frame: 60, value: -100, easing: 'ease_out' },
    ] });
    const p = l.layers[0].ks.p;
    assert.equal(p.a, 1);
    assert.deepEqual(p.k[0].s, [960, 540]);
    assert.deepEqual(p.k[1].s, [860, 540]);
  });

  it('drift translateX+translateY (shared frames) → 2-D animated position', () => {
    const l = base({
      translateX: [{ frame: 0, value: 0 }, { frame: 30, value: 20, easing: 'ease_out' }],
      translateY: [{ frame: 0, value: 0 }, { frame: 30, value: 10, easing: 'ease_out' }],
    });
    const p = l.layers[0].ks.p;
    assert.equal(p.a, 1);
    assert.deepEqual(p.k[0].s, [960, 540]);
    assert.deepEqual(p.k[1].s, [980, 550]);
  });

  it('linear (no easing) → cubic-bezier(0,0,1,1) tangents', () => {
    const l = base({ scale: [{ frame: 0, value: 1 }, { frame: 10, value: 2 }] });
    const s = l.layers[0].ks.s;
    assert.deepEqual(s.k[0].o, { x: [0], y: [0] });
    assert.deepEqual(s.k[0].i, { x: [1], y: [1] });
  });
});

describe('cameraTrackFromTimeline', () => {
  it('returns the camera track for a static timeline', () => {
    const cam = { scale: [{ frame: 0, value: 1 }] };
    assert.equal(cameraTrackFromTimeline({ tracks: { camera: cam, layers: {} } }), cam);
  });
  it('returns null for a reactive descriptor (poster-only fallback)', () => {
    assert.equal(cameraTrackFromTimeline({ mode: 'reactive', durationFrames: 120 }), null);
  });
  it('returns null when there is no camera move', () => {
    assert.equal(cameraTrackFromTimeline({ tracks: { camera: {}, layers: {} } }), null);
    assert.equal(cameraTrackFromTimeline(null), null);
  });
});

describe('neutralizeCameraForPoster — no double-camera', () => {
  it('blanks scene.camera AND strips the timeline camera track, keeping layers + shot_grammar', () => {
    const scene = {
      scene_id: 'sc_x', layers: [{ id: 'l1', type: 'html', content: 'x' }],
      camera: { move: 'push_in', intensity: 0.5 },
      shot_grammar: { shot_size: 'wide' },
    };
    const timeline = { tracks: { camera: { scale: [{ frame: 0, value: 1 }] }, layers: { l1: { opacity: [{ frame: 0, value: 1 }] } } } };
    const out = neutralizeCameraForPoster(scene, timeline);

    assert.equal(out.scene.camera.move, 'static');
    assert.deepEqual(out.scene.shot_grammar, { shot_size: 'wide' }); // framing preserved
    assert.equal(out.timeline.tracks.camera, undefined);             // camera stripped
    assert.ok(out.timeline.tracks.layers.l1, 'layer tracks preserved → poster shows settled content');
    // original untouched
    assert.equal(scene.camera.move, 'push_in');
    assert.ok(timeline.tracks.camera);
  });

  it('reactive/v1 timeline (no tracks) → no static timeline handed to capture', () => {
    const scene = { scene_id: 'sc_r', layers: [{ id: 'l1', type: 'html', content: 'x' }] };
    assert.equal(neutralizeCameraForPoster(scene, { mode: 'reactive' }).timeline, undefined);
    assert.equal(neutralizeCameraForPoster(scene, null).timeline, undefined);
  });
});

describe('integration — real compiler camera output → Lottie', () => {
  it('a push_in scene compiles to a scale track that maps to animated Lottie scale', () => {
    const scene = {
      scene_id: 'sc_pushin', duration_s: 3, fps: 60,
      layers: [{ id: 'l1', type: 'html', content: '<div>x</div>' }],
      motion: { camera: { move: 'push_in', intensity: 0.6 } },
    };
    const timeline = compileMotion(structuredClone(scene), { recipes: loadRecipes(), primitives: loadPrimitivesCatalog() });
    const cam = cameraTrackFromTimeline(timeline);
    assert.ok(cam && cam.scale, 'push_in must produce a camera scale track');
    const l = buildCameraLottie({ cameraTrack: cam, poster: POSTER, width: 1920, height: 1080, fps: 60, durationFrames: timeline.duration_frames });
    assert.equal(l.layers[0].ks.s.a, 1);
    assert.ok(l.layers[0].ks.s.k[l.layers[0].ks.s.k.length - 1].s[0] > 100, 'scales up past 100%');
  });
});

describe('regressions — review findings', () => {
  it('P1: poster scene must include compiler-generated layers (capture the COMPILED scene)', () => {
    // A component with no layer_ref → compileSemantic auto-generates a layer.
    const scene = {
      scene_id: 'sc_mixed', duration_s: 3, fps: 60,
      layers: [{ id: 'existing', type: 'html', content: 'x' }],
      semantic: {
        components: [
          { id: 'cmp_existing', type: 'ui_card', role: 'supporting', layer_ref: 'existing' },
          { id: 'cmp_gen', type: 'ui_card', role: 'supporting' }, // no layer_ref
        ],
        interactions: [
          { id: 'int_enter_existing', target: 'cmp_existing', kind: 'enter', timing: { at_ms: 0 } },
          { id: 'int_enter_gen', target: 'cmp_gen', kind: 'enter', timing: { at_ms: 0 } },
        ],
        camera_behavior: { mode: 'reactive' },
      },
    };
    const compiled = structuredClone(scene);
    const timeline = compileMotion(compiled, { recipes: loadRecipes(), primitives: loadPrimitivesCatalog() });

    // The compiler generated a layer for cmp_gen; the ORIGINAL scene never had it.
    assert.ok(compiled.layers.some(l => l.id === 'cmp_gen'), 'compiler generated a layer');
    assert.ok(!scene.layers.some(l => l.id === 'cmp_gen'), 'original scene lacks it (the bug)');

    // Neutralising the COMPILED scene preserves the generated layer → poster shows it.
    const { scene: posterScene } = neutralizeCameraForPoster(compiled, timeline);
    assert.ok(posterScene.layers.some(l => l.id === 'cmp_gen'), 'poster scene must include the generated layer');
    assert.ok(timeline.tracks.layers.cmp_gen, 'and the timeline tracks it');
  });

  it('P2: exports at the scene fps, not a hardcoded 60', () => {
    const scene = {
      scene_id: 'sc_30', duration_s: 3, fps: 30,
      layers: [{ id: 'l1', type: 'html', content: 'x' }],
      motion: { camera: { move: 'push_in' } },
    };
    const timeline = compileMotion(structuredClone(scene), { recipes: loadRecipes(), primitives: loadPrimitivesCatalog() });
    assert.equal(timeline.fps, 30);
    assert.equal(timeline.duration_frames, 90); // 3s × 30fps

    const fps = timeline?.fps || scene.fps || 60;
    const l = buildCameraLottie({
      cameraTrack: cameraTrackFromTimeline(timeline), poster: POSTER,
      width: 1920, height: 1080, fps, durationFrames: timeline.duration_frames,
    });
    // Under the bug (fr:60, op:90) this 3s clip would play in 1.5s at 2× speed.
    assert.equal(l.fr, 30);
    assert.equal(l.op, 90);
  });
});

describe('handleSceneToLottie — input validation (no render)', () => {
  it('errors when scene is missing', async () => {
    const res = await handleSceneToLottie({});
    assert.ok(res.isError);
    assert.match(res.content[0].text, /`scene` is required/);
  });
  it('errors when scene has no layers', async () => {
    const res = await handleSceneToLottie({ scene: { scene_id: 'sc_e', layers: [] } });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /at least one layer/);
  });
});
