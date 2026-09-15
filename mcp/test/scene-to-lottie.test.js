/**
 * Scene → Lottie export (ANI-200).
 *
 * The camera-track → Lottie mapping, overscan, camera neutralisation and reactive
 * fallback are pure and tested directly. The handler path (validate → compile →
 * capture → build) is tested through exportSceneToLottie / sceneToLottieResult with
 * an injected capture session, so the real orchestration runs without launching a
 * browser. Actual poster rasterisation (Remotion/Chromium) stays CI/manual.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCameraLottie,
  cameraTrackFromTimeline,
  neutralizeCameraForPoster,
  posterOverscan,
} from '../lib/lottie/from-timeline.js';
import { exportSceneToLottie, sceneToLottieResult, MAX_POSTER_BASE64_BYTES } from '../lib/lottie/scene-export.js';
import { handleSceneToLottie } from '../handlers.js';
import { compileMotion } from '../lib/compiler.js';
import { loadPrimitivesCatalog, loadRecipes } from '../data/loader.js';

const CATALOGS = { recipes: loadRecipes(), primitives: loadPrimitivesCatalog() };
const W = 1920;
const H = 1080;
const POSTER = { dataUri: 'data:image/png;base64,AAAA', width: W, height: H };
const base = (cameraTrack) => buildCameraLottie({
  cameraTrack, poster: POSTER, width: W, height: H, fps: 60, durationFrames: 180, name: 'sc_test',
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

  it('single-keyframe and empty tracks stay static', () => {
    const l = base({ scale: [{ frame: 12, value: 1.05 }], translateX: [] });
    assert.equal(l.layers[0].ks.s.a, 0);
    assert.ok(Math.abs(l.layers[0].ks.s.k[0] - 105) < 1e-9);
    assert.equal(l.layers[0].ks.p.a, 0);
    assert.deepEqual(l.layers[0].ks.p.k, [960, 540]);
  });
});

describe('buildCameraLottie — overscan keeps the canvas covered', () => {
  // The poster's half-extent at camera scale s and overscan k must reach the comp edge plus the offset.
  const covers = (k, s, x, y) => k * s * W / 2 >= W / 2 + Math.abs(x) - 1e-9 && k * s * H / 2 >= H / 2 + Math.abs(y) - 1e-9;

  it('no camera move → no overscan, poster at 100%', () => {
    assert.equal(posterOverscan({ cameraTrack: null, width: W, height: H }), 1);
    assert.deepEqual(base(null).layers[0].ks.s.k, [100, 100]);
  });

  it('a push-in that never drops below 100% needs no overscan', () => {
    const cam = { scale: [{ frame: 0, value: 1 }, { frame: 90, value: 1.2, easing: 'cubic-bezier(0.33,0,0.2,1)' }] };
    assert.equal(posterOverscan({ cameraTrack: cam, width: W, height: H }), 1);
  });

  it('a pan is covered at its largest offset', () => {
    const cam = { translateX: [{ frame: 0, value: 0 }, { frame: 60, value: -100 }] };
    const k = posterOverscan({ cameraTrack: cam, width: W, height: H });
    assert.ok(Math.abs(k - (960 + 100) / 960) < 1e-9, `got ${k}`);
    const s = base(cam).layers[0].ks.s;
    assert.equal(s.a, 0);
    assert.ok(Math.abs(s.k[0] - 100 * k) < 1e-9);
    assert.ok(covers(k, 1, -100, 0));
  });

  it('a pull-out below 100% is covered at its smallest scale', () => {
    const cam = { scale: [{ frame: 0, value: 1 }, { frame: 90, value: 0.8 }] };
    const k = posterOverscan({ cameraTrack: cam, width: W, height: H });
    assert.ok(Math.abs(k - 1.25) < 1e-9, `got ${k}`);
    const s = base(cam).layers[0].ks.s;
    assert.ok(Math.abs(s.k[0].s[0] - 125) < 1e-9);
    assert.ok(Math.abs(s.k[1].s[0] - 100) < 1e-9);
    assert.ok(covers(k, 0.8, 0, 0));
  });

  it('easing overshoot counts: a back-style curve is covered past its end value', () => {
    // y1 = 1.5 → the segment can travel 50% past its destination before settling.
    const cam = { translateX: [{ frame: 0, value: 0 }, { frame: 30, value: 100, easing: 'cubic-bezier(0.3,1.5,0.7,1)' }] };
    const k = posterOverscan({ cameraTrack: cam, width: W, height: H });
    assert.ok(Math.abs(k - (960 + 150) / 960) < 1e-9, `got ${k}`);
  });

  it('a real compiled drift scene gets a translate track and enough overscan', () => {
    const scene = {
      scene_id: 'sc_drift', duration_s: 3, fps: 60,
      layers: [{ id: 'l1', type: 'html', content: '<div>x</div>' }],
      motion: { camera: { move: 'drift', intensity: 0.6 } },
    };
    const cam = cameraTrackFromTimeline(compileMotion(structuredClone(scene), CATALOGS));
    assert.ok(cam && (cam.translateX || cam.translateY), `drift must produce a translate track, got ${JSON.stringify(cam && Object.keys(cam))}`);
    assert.ok(posterOverscan({ cameraTrack: cam, width: W, height: H }) > 1, 'drift must overscan');
    // Check the overscan the Lottie ACTUALLY applies, not just the computed factor.
    const sMin = cam.scale ? Math.min(...cam.scale.map(e => e.value)) : 1;
    const { s, p } = base(cam).layers[0].ks;
    const lottieMinPct = s.a ? Math.min(...s.k.map(kf => kf.s[0])) : s.k[0];
    const applied = lottieMinPct / (100 * sMin);
    assert.ok(applied > 1, `Lottie scale must carry the overscan, got ${applied}`);
    const points = p.a ? p.k.map(kf => kf.s) : [p.k];
    for (const [x, y] of points) assert.ok(covers(applied, sMin, x - W / 2, y - H / 2), `uncovered at ${x},${y}`);
  });

  it('a camera scale that reaches 0 is refused', () => {
    const cam = { scale: [{ frame: 0, value: 1 }, { frame: 30, value: 0 }] };
    assert.throws(() => posterOverscan({ cameraTrack: cam, width: W, height: H }), /camera scale must stay above 0/);
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
    const timeline = compileMotion(structuredClone(scene), CATALOGS);
    const cam = cameraTrackFromTimeline(timeline);
    assert.ok(cam && cam.scale, 'push_in must produce a camera scale track');
    const l = buildCameraLottie({ cameraTrack: cam, poster: POSTER, width: W, height: H, fps: 60, durationFrames: timeline.duration_frames });
    assert.equal(l.layers[0].ks.s.a, 1);
    assert.ok(l.layers[0].ks.s.k[l.layers[0].ks.s.k.length - 1].s[0] > 100, 'scales up past 100%');
  });
});

// ── Handler path, with an injected capture session ───────────────────────────

const tick = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const FRAME = { media_type: 'image/png', data: 'AAAA', frame: 108, scale: 1 };

function fakeSession({ shot = FRAME, openDelayMs = 0, captureDelayMs = 0, unavailable = false } = {}) {
  const calls = { opened: 0, captures: [], closed: 0 };
  const openSession = async (opts) => {
    calls.opened++;
    calls.openOpts = opts;
    if (openDelayMs) await tick(openDelayMs);
    const close = async () => { calls.closed++; };
    if (unavailable) return { unavailable: true, reason: 'no headless chrome', capture: async () => null, close };
    return {
      capture: async (scene, at, captureOpts) => {
        calls.captures.push({ scene, at, opts: captureOpts });
        if (captureDelayMs) await tick(captureDelayMs);
        return shot;
      },
      close,
    };
  };
  return { openSession, calls };
}

const pushIn = (extra = {}) => ({
  scene_id: 'sc_export', duration_s: 3,
  layers: [{ id: 'l1', type: 'html', content: '<div>x</div>' }],
  motion: { camera: { move: 'push_in', intensity: 0.6 } },
  ...extra,
});

describe('exportSceneToLottie — the handler path with an injected capture session', () => {
  it('captures one camera-neutral poster, closes the session, and embeds the frame', async () => {
    const { openSession, calls } = fakeSession();
    const { lottie, report } = await exportSceneToLottie({ scene: pushIn(), at: 0.5 }, { catalogs: CATALOGS, openSession });
    assert.equal(calls.opened, 1);
    assert.equal(calls.captures.length, 1);
    assert.equal(calls.closed, 1);
    const { scene, at, opts } = calls.captures[0];
    assert.equal(at, 0.5);
    assert.equal(scene.camera.move, 'static', 'camera neutralised in the captured scene');
    assert.ok(opts.timeline?.tracks, 'compiled timeline handed to the renderer');
    assert.equal(opts.timeline.tracks.camera, undefined, 'camera track stripped from the poster timeline');
    assert.equal(lottie.assets[0].p, 'data:image/png;base64,AAAA');
    assert.equal(lottie.layers[0].ks.s.a, 1, 'push-in animates Lottie scale');
    assert.match(report.camera_mode, /^animated/);
    assert.equal(report.overscan, 1);
  });

  it('captures the COMPILED scene: generated layers reach the poster, the caller\'s scene is untouched', async () => {
    const scene = {
      scene_id: 'sc_semantic', duration_s: 3,
      semantic: {
        components: [
          { id: 'cmp_a', type: 'ui_card', role: 'hero' },
          { id: 'cmp_b', type: 'ui_card', role: 'supporting' },
        ],
        interactions: [
          { id: 'int_enter_a', target: 'cmp_a', kind: 'enter', timing: { at_ms: 0 } },
          { id: 'int_enter_b', target: 'cmp_b', kind: 'enter', timing: { at_ms: 200 } },
        ],
        camera_behavior: { mode: 'reactive' },
      },
    };
    const before = structuredClone(scene);
    const { openSession, calls } = fakeSession();
    await exportSceneToLottie({ scene }, { catalogs: CATALOGS, openSession });
    const ids = calls.captures[0].scene.layers.map(l => l.id);
    assert.ok(ids.includes('cmp_a') && ids.includes('cmp_b'), `generated layers missing from the poster scene: ${ids}`);
    assert.equal(calls.captures[0].at, 0.6, 'default capture position');
    assert.deepEqual(scene, before, 'the caller\'s scene is not mutated');
  });

  it('non-60fps scene: the Lottie keeps the scene fps; the poster timeline is compiled at the 60fps capture rate', async () => {
    const { openSession, calls } = fakeSession();
    const { lottie, report } = await exportSceneToLottie({ scene: pushIn({ fps: 30 }) }, { catalogs: CATALOGS, openSession });
    assert.equal(lottie.fr, 30);
    assert.equal(lottie.op, 90);
    assert.equal(report.fps, 30);
    const { scene, opts } = calls.captures[0];
    assert.equal(scene.fps, 60, 'captured scene runs at the Scene composition rate');
    assert.equal(opts.timeline.fps, 60, 'the Scene composition samples timeline frames at 60fps');
    assert.equal(opts.timeline.duration_frames, 180);
  });

  it('reports validateScene findings as warnings without rejecting the export', async () => {
    const { openSession } = fakeSession();
    const { report } = await exportSceneToLottie({ scene: pushIn({ scene_id: 'Not-A-Valid-Id' }) }, { catalogs: CATALOGS, openSession });
    assert.ok(report.scene_warnings.some(w => /scene_id/.test(w)), JSON.stringify(report.scene_warnings));
  });
});

describe('sceneToLottieResult — failures return isError and release the session', () => {
  it('toolchain unavailable → isError with the reason, nothing captured', async () => {
    const { openSession, calls } = fakeSession({ unavailable: true });
    const res = await sceneToLottieResult({ scene: pushIn() }, { catalogs: CATALOGS, openSession });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /render toolchain unavailable \(no headless chrome\)/);
    assert.equal(calls.captures.length, 0);
  });

  it('capture error → isError, and the session is still closed', async () => {
    const { openSession, calls } = fakeSession({ shot: { error: 'boom' } });
    const res = await sceneToLottieResult({ scene: pushIn() }, { catalogs: CATALOGS, openSession });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /poster capture failed: boom/);
    assert.equal(calls.closed, 1);
  });

  it('a capture that never finishes times out, and the session is closed', async () => {
    const { openSession, calls } = fakeSession({ captureDelayMs: 300 });
    const res = await sceneToLottieResult({ scene: pushIn() }, { catalogs: CATALOGS, openSession, timeouts: { captureMs: 20 } });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /capturing the poster timed out after 20ms/);
    assert.equal(calls.closed, 1);
  });

  it('a session that finishes opening after the open timeout is still closed', async () => {
    const { openSession, calls } = fakeSession({ openDelayMs: 60 });
    const res = await sceneToLottieResult({ scene: pushIn() }, { catalogs: CATALOGS, openSession, timeouts: { openMs: 10 } });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /opening the render session timed out after 10ms/);
    assert.equal(calls.closed, 0, 'not open yet when the timeout fired');
    await tick(150);
    assert.equal(calls.closed, 1, 'closed once it finished opening');
    assert.equal(calls.captures.length, 0);
  });

  it('an oversized poster is refused, not embedded or echoed', async () => {
    const { openSession, calls } = fakeSession({ shot: { ...FRAME, data: 'A'.repeat(MAX_POSTER_BASE64_BYTES + 1) } });
    const res = await sceneToLottieResult({ scene: pushIn() }, { catalogs: CATALOGS, openSession });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /over the \d+-byte cap/);
    assert.ok(res.content[0].text.length < 1000, 'the refused poster is not echoed back');
    assert.equal(calls.closed, 1);
  });
});

describe('handleSceneToLottie — input validation happens before any render', () => {
  const rejects = async (args, pattern) => {
    const res = await handleSceneToLottie(args);
    assert.ok(res.isError, `expected isError for ${JSON.stringify(args)}`);
    assert.match(res.content[0].text, pattern);
  };

  it('scene missing or not an object', async () => {
    await rejects({}, /`scene` is required/);
    await rejects({ scene: [] }, /`scene` is required/);
  });

  it('nothing to capture: no layers and no semantic components', async () => {
    await rejects({ scene: { scene_id: 'sc_e', layers: [] } }, /at least one layer or semantic component/);
  });

  it('`at` outside 0..1 or not a number', async () => {
    for (const at of [-0.1, 1.5, Number.NaN, '0.5', null]) {
      await rejects({ scene: pushIn(), at }, /`at` must be a number from 0 to 1/);
    }
  });

  it('duration_s and fps out of bounds', async () => {
    await rejects({ scene: pushIn({ duration_s: 100 }) }, /duration_s must be between/);
    await rejects({ scene: pushIn({ fps: 0 }) }, /fps must be between/);
  });
});

describe('review round 2 — compiled-output check, cleanup limits, production wiring', () => {
  it('a camera input the compiler turns into NaN is refused before any render', async () => {
    const { openSession, calls } = fakeSession();
    const res = await sceneToLottieResult(
      { scene: pushIn({ motion: { camera: { move: 'push_in', intensity: 'bad' } } }) },
      { catalogs: CATALOGS, openSession },
    );
    assert.ok(res.isError, `expected isError, got: ${res.content[0].text.slice(0, 200)}`);
    assert.match(res.content[0].text, /non-finite keyframe/);
    assert.equal(calls.opened, 0, 'refused before opening a render session');
  });

  it('a close that hangs still returns the Lottie, with a visible warning that the browser may still be running', async () => {
    let closed = false;
    const openSession = async () => ({
      capture: async () => FRAME,
      close: async () => { await tick(300); closed = true; },
    });
    const { lottie, report } = await exportSceneToLottie(
      { scene: pushIn() },
      { catalogs: CATALOGS, openSession, timeouts: { closeMs: 20 } },
    );
    assert.equal(lottie.assets[0].p, 'data:image/png;base64,AAAA');
    assert.equal(closed, false, 'returned before the hung close finished');
    assert.match(report.render_warnings?.[0] ?? '', /closing the render session timed out after 20ms; the browser may still be running/);
  });

  it('the production handler supplies catalogs, compiles, and resolves the lazily imported capture module', async () => {
    const prev = process.env.ANIMATIC_SKIP_REMOTION_RENDER;
    process.env.ANIMATIC_SKIP_REMOTION_RENDER = '1';
    try {
      const res = await handleSceneToLottie({ scene: pushIn() });
      assert.ok(res.isError);
      // Reachable only after the real handler passed catalogs, compiled, and resolved
      // import('../hero-frame-capture.js'), whose session reports rendering as skipped.
      assert.match(res.content[0].text, /render toolchain unavailable; cannot capture the poster image/);
    } finally {
      if (prev === undefined) delete process.env.ANIMATIC_SKIP_REMOTION_RENDER;
      else process.env.ANIMATIC_SKIP_REMOTION_RENDER = prev;
    }
  });
});
