/**
 * scene_to_lottie orchestration (ANI-200): validate the input, compile the scene,
 * capture a camera-neutral poster, and build the camera-driven Lottie.
 *
 * This lives outside handlers.js for two reasons, both from review round 1:
 *
 * - Edge safety (P1). hero-frame-capture.js is Node-only (node:fs/os/dns plus a
 *   DNS mutation at load), and tools-registry.js imports every handler before
 *   exclusions apply, so `edgeReady: false` does not keep a module out of the
 *   edge bundle. The capture module is therefore loaded here with a dynamic
 *   import(), never statically; edge-static-imports.test.js enforces that across
 *   the whole registry import graph.
 * - Testability (P3). The capture session is injectable, so the real handler path
 *   (success, toolchain unavailable, capture error, timeouts) is tested without
 *   launching a browser.
 */

import { compileMotion, isReactiveScene } from '../compiler.js';
import { SCENE_DURATION_S_BOUNDS, validateScene } from '../../../src/remotion/lib.js';
import {
  buildCameraLottie,
  cameraTrackFromTimeline,
  neutralizeCameraForPoster,
  posterOverscan,
} from './from-timeline.js';

/** Lottie comp size. Scenes don't carry a resolution (the manifest does), so v0 is 16:9. */
export const EXPORT_WIDTH = 1920;
export const EXPORT_HEIGHT = 1080;

/** The Remotion `Scene` composition and heroFrameIndex are pinned to 60fps (Root.jsx),
 *  and SceneComposition reads timeline frames at the composition's fps. */
const CAPTURE_FPS = 60;

/** Scene fps accepted for export. Tracks are compiled per frame, so an unbounded fps
 *  makes compilation, not the export, the cost. */
const FPS_BOUNDS = Object.freeze({ min: 1, max: 240 });

/** The camera tracks buildCameraLottie reads. */
const EXPORTED_CAMERA_TRACKS = ['scale', 'translateX', 'translateY'];

/**
 * How long the tool call waits for each render step. Bundling Remotion dominates
 * opening a session; one still renders much faster.
 *
 * These bound the CALL, not the browser. openHeroCaptureSession exposes no way to
 * cancel a render or force a browser to exit, so a render that hangs keeps running
 * after its timeout, and a close() that hangs can leave Chromium alive. A timed-out
 * close is reported in `report.render_warnings` rather than hidden.
 */
export const DEFAULT_TIMEOUTS = Object.freeze({ openMs: 120_000, captureMs: 60_000, closeMs: 15_000 });

/** Largest base64 poster embedded in the response: 8 MiB, about 6 MiB of PNG. A 1080p
 *  UI frame is typically under 2 MiB; a noise-like frame can reach roughly 8 MiB raw. */
export const MAX_POSTER_BASE64_BYTES = 8 * 1024 * 1024;

async function openCaptureSession(opts) {
  const { openHeroCaptureSession } = await import('../hero-frame-capture.js');
  return openHeroCaptureSession(opts);
}

function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const show = (v) => (typeof v === 'number' ? String(v) : JSON.stringify(v));

/**
 * Reject what the export itself consumes. Everything else validateScene checks is
 * reported as a warning instead: validateScene is a lint (ANI-199), and scenes that
 * fail it (figma imports, for one) still compile and render.
 */
function assertExportable({ scene, at, name }) {
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
    throw new Error('`scene` is required and must be a scene object.');
  }
  if (at !== undefined && !(typeof at === 'number' && at >= 0 && at <= 1)) {
    throw new Error(`\`at\` must be a number from 0 to 1 (got ${show(at)}).`);
  }
  if (name !== undefined && typeof name !== 'string') {
    throw new Error('`name` must be a string.');
  }
  if (scene.duration_s != null) {
    const { min, max } = SCENE_DURATION_S_BOUNDS;
    if (!(typeof scene.duration_s === 'number' && scene.duration_s >= min && scene.duration_s <= max)) {
      throw new Error(`scene.duration_s must be between ${min} and ${max} (got ${show(scene.duration_s)}).`);
    }
  }
  if (scene.fps != null) {
    const { min, max } = FPS_BOUNDS;
    if (!(typeof scene.fps === 'number' && scene.fps >= min && scene.fps <= max)) {
      throw new Error(`scene.fps must be between ${min} and ${max} (got ${show(scene.fps)}).`);
    }
  }
  const hasLayers = Array.isArray(scene.layers) && scene.layers.length > 0;
  const hasComponents = Array.isArray(scene.semantic?.components) && scene.semantic.components.length > 0;
  if (!hasLayers && !hasComponents) {
    throw new Error('`scene` needs at least one layer or semantic component to capture.');
  }
}

/**
 * Refuse a compiled camera track the Lottie can't faithfully carry (review round 2,
 * P2). The compiler does arithmetic on camera inputs it doesn't validate (a string
 * `intensity` compiles to NaN), and JSON would serialise NaN as null inside a
 * "successful" Lottie. This checks the compiler's OUTPUT, the thing the export
 * consumes, instead of re-modelling the compiler's input rules here.
 */
function assertFiniteCameraTrack(cameraTrack) {
  for (const prop of EXPORTED_CAMERA_TRACKS) {
    const track = cameraTrack?.[prop];
    if (track === undefined) continue;
    if (!Array.isArray(track)) throw new Error(`compiled camera track "${prop}" is not a keyframe array.`);
    for (const kf of track) {
      if (!Number.isFinite(kf?.frame) || !Number.isFinite(kf?.value)) {
        throw new Error(`compiled camera track "${prop}" has a non-finite keyframe (frame ${show(kf?.frame)}, value ${show(kf?.value)}); check the scene's camera inputs.`);
      }
    }
  }
}

/**
 * Export a scene as `{ lottie, report }`. Throws on any failure.
 *
 * @param {{ scene: object, at?: number, name?: string }} args
 * @param {object} deps
 * @param {object} deps.catalogs - `{ recipes, primitives }` for compileMotion.
 * @param {function} [deps.openSession] - `(opts) => Promise<session>`; defaults to the
 *   Remotion capture session, loaded lazily.
 * @param {{ openMs?: number, captureMs?: number, closeMs?: number }} [deps.timeouts]
 */
export async function exportSceneToLottie(args = {}, deps = {}) {
  const { scene, at = 0.6, name } = args;
  assertExportable({ scene, at: args.at, name });
  const { catalogs, openSession = openCaptureSession } = deps;
  if (!catalogs) throw new Error('catalogs are required to compile the scene.');
  const timeouts = { ...DEFAULT_TIMEOUTS, ...deps.timeouts };

  const sceneWarnings = validateScene(scene).errors;

  // compileSemantic MUTATES the scene it is given (it generates layers for components
  // without a layer_ref), so each compile gets its own clone and the poster is captured
  // from a compiled clone, never from the caller's scene.
  const reactive = isReactiveScene(scene);
  const compileOpts = { personality: scene.personality, ...(reactive ? { mode: 'reactive' } : {}) };
  const timeline = compileMotion(structuredClone(scene), catalogs, compileOpts);
  const fps = timeline?.fps || scene.fps || 60;
  const durationFrames = timeline?.duration_frames || timeline?.durationFrames || Math.round((scene.duration_s || 3) * fps);
  const cameraTrack = cameraTrackFromTimeline(timeline);
  // Both checks run before rendering, so an unusable camera track fails without a render.
  assertFiniteCameraTrack(cameraTrack);
  const overscan = posterOverscan({ cameraTrack, width: EXPORT_WIDTH, height: EXPORT_HEIGHT });

  // The poster is compiled a second time at the capture rate. The Scene composition
  // samples timeline frames at 60fps, so a 24 or 30fps timeline would run 2-2.5x fast
  // in the still and `at` would land on a later state (review round 1, P2). The Lottie
  // keeps the scene's own fps from the compile above.
  const posterSource = { ...structuredClone(scene), fps: CAPTURE_FPS };
  const posterTimeline = compileMotion(posterSource, catalogs, compileOpts);
  const poster = neutralizeCameraForPoster(posterSource, posterTimeline);
  if (!Array.isArray(poster.scene.layers) || poster.scene.layers.length === 0) {
    throw new Error('compiled scene has no layers to capture.');
  }

  const opening = openSession({ scale: 1 });
  let session;
  try {
    session = await withTimeout(opening, timeouts.openMs, 'opening the render session');
  } catch (err) {
    // A session that finishes opening after we gave up still owns a browser and a temp
    // dir, so close it whenever it arrives. Best effort: see DEFAULT_TIMEOUTS.
    opening.then(s => s?.close?.()).catch(() => {});
    throw err;
  }
  if (!session || session.unavailable) {
    throw new Error(`render toolchain unavailable${session?.reason ? ` (${session.reason})` : ''}; cannot capture the poster image.`);
  }

  let shot;
  const renderWarnings = [];
  try {
    shot = await withTimeout(
      session.capture(poster.scene, at, poster.timeline ? { timeline: poster.timeline } : {}),
      timeouts.captureMs,
      'capturing the poster',
    );
  } finally {
    await withTimeout(Promise.resolve().then(() => session.close()), timeouts.closeMs, 'closing the render session')
      .catch(err => { renderWarnings.push(`${err.message}; the browser may still be running`); });
  }
  if (!shot || shot.error || !shot.data) {
    throw new Error(`poster capture failed: ${shot?.error || 'no frame returned'}`);
  }
  if (shot.data.length > MAX_POSTER_BASE64_BYTES) {
    throw new Error(`poster is ${shot.data.length} bytes as base64, over the ${MAX_POSTER_BASE64_BYTES}-byte cap for an inline Lottie.`);
  }

  const lottie = buildCameraLottie({
    cameraTrack,
    poster: { dataUri: `data:image/png;base64,${shot.data}`, width: EXPORT_WIDTH, height: EXPORT_HEIGHT },
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
    fps,
    durationFrames,
    name: name || scene.scene_id,
  });

  const report = {
    camera_mode: timeline?.mode === 'reactive'
      ? 'poster-only (reactive scene: per-layer motion unavailable)'
      : (cameraTrack ? `animated (${Object.keys(cameraTrack).join(', ')})` : 'poster-only (no camera move)'),
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
    fps,
    duration_frames: durationFrames,
    overscan,
    scene_warnings: sceneWarnings,
    ...(renderWarnings.length ? { render_warnings: renderWarnings } : {}),
    note: 'v0: internal per-layer motion is baked into the poster, not re-animated; camera motion only. overscan > 1 means the poster is enlarged so camera moves never reveal the canvas edge.',
  };
  return { lottie, report };
}

/** MCP tool result for scene_to_lottie: `{ lottie, report }` as JSON text, or `isError`. */
export async function sceneToLottieResult(args = {}, deps = {}) {
  try {
    const out = await exportSceneToLottie(args, deps);
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `scene_to_lottie failed: ${err.message}` }], isError: true };
  }
}
