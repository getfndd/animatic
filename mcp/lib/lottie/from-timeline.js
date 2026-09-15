/**
 * Compiled camera track → Lottie (scene_to_lottie, ANI-200).
 *
 * v0 export: a single still poster image animated ONLY by the scene's camera
 * track (push-in/pull-out → scale, pan/drift → position). Internal per-layer
 * motion is intentionally discarded — it is baked into the poster, not
 * re-animated (that's v1, behind a layer-isolation renderer). Camera carries no
 * opacity, so the image layer's opacity stays static.
 *
 * Pure module — the rasterisation (poster capture) lives in the handler; this
 * file only turns a frame-addressed camera track into Lottie keyframes, which
 * makes it fully unit-testable without a renderer.
 */

import { resolveEasing } from '../../../src/remotion/lib.js';

/** cubic-bezier points [x1,y1,x2,y2] (or null=linear) → Lottie out/in tangents.
 *  Lottie stores the easing of segment i→i+1 on keyframe i as `o` (out) + `i`
 *  (in); linear is cubic-bezier(0,0,1,1). */
function tangents(points) {
  const p = points || [0, 0, 1, 1];
  return { o: { x: [p[0]], y: [p[1]] }, i: { x: [p[2]], y: [p[3]] } };
}

/** Animatic tracks put a segment's easing on its DESTINATION keyframe
 *  (`to.easing`); Lottie wants it on the source. So keyframe i's tangents come
 *  from track[i+1].easing. */
function keyframes(track, mapValue) {
  return track.map((e, i) => {
    const kf = { t: e.frame, s: mapValue(e.value) };
    if (i < track.length - 1) {
      const { o, i: inT } = tangents(resolveEasing(track[i + 1].easing));
      kf.o = o; kf.i = inT;
    }
    return kf;
  });
}

/** A 1-D track (e.g. scale) → a Lottie animated/static property. */
function scalarProp(track, mapValue, staticDefault) {
  if (!track || track.length === 0) return { a: 0, k: staticDefault };
  if (track.length === 1) return { a: 0, k: mapValue(track[0].value) };
  return { a: 1, k: keyframes(track, mapValue) };
}

/** Linear sample of a track at frame f (no easing — used only to fill a frame a
 *  sibling axis lacks; exact at real keyframe frames). */
function sample(track, f) {
  if (!track || track.length === 0) return 0;
  if (f <= track[0].frame) return track[0].value;
  const last = track[track.length - 1];
  if (f >= last.frame) return last.value;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i], b = track[i + 1];
    if (f >= a.frame && f <= b.frame) {
      if (b.frame === a.frame) return b.value;
      return a.value + (b.value - a.value) * ((f - a.frame) / (b.frame - a.frame));
    }
  }
  return last.value;
}

/** translateX + translateY → Lottie position `p` (anchored at comp centre). */
function positionProp(tx, ty, cx, cy) {
  const hasX = tx && tx.length > 0;
  const hasY = ty && ty.length > 0;
  if (!hasX && !hasY) return { a: 0, k: [cx, cy] };

  const frames = [...new Set([...(tx || []), ...(ty || [])].map(e => e.frame))].sort((a, b) => a - b);
  if (frames.length === 1) {
    return { a: 0, k: [cx + sample(tx, frames[0]), cy + sample(ty, frames[0])] };
  }
  const easingAt = (f) =>
    ((tx || []).find(e => e.frame === f) || (ty || []).find(e => e.frame === f) || {}).easing;

  const k = frames.map((f, idx) => {
    const kf = { t: f, s: [cx + sample(tx, f), cy + sample(ty, f)] };
    if (idx < frames.length - 1) {
      const { o, i } = tangents(resolveEasing(easingAt(frames[idx + 1])));
      kf.o = o; kf.i = i;
    }
    return kf;
  });
  return { a: 1, k };
}

/** Range one axis of a Lottie property reaches as Lottie plays it. Each segment is
 *  a cubic bezier in progress space whose y-controls are the source keyframe's
 *  out/in tangents, and a bezier never leaves the convex hull of its control
 *  points, so segment a→b stays within a + [min(0,oy,iy), max(1,oy,iy)]·(b−a).
 *  That bounds easing overshoot, not just the keyframe values. */
function axisRange(prop, axis) {
  if (!prop.a) return [prop.k[axis], prop.k[axis]];
  let lo = Infinity, hi = -Infinity;
  prop.k.forEach((kf, j) => {
    const b = kf.s[axis];
    lo = Math.min(lo, b); hi = Math.max(hi, b);
    if (j === 0) return;
    const prev = prop.k[j - 1];
    const a = prev.s[axis];
    for (const y of [prev.o?.y?.[0] ?? 0, prev.i?.y?.[0] ?? 1]) {
      lo = Math.min(lo, a + y * (b - a)); hi = Math.max(hi, a + y * (b - a));
    }
  });
  return [lo, hi];
}

/**
 * How much to enlarge the poster so the camera move never uncovers the
 * transparent canvas (ANI-200 review P2). The poster is comp-sized, so any
 * pan/drift, or a scale below 100%, would expose a strip at the edge. Lottie
 * scales about the anchor (the poster centre), so the poster covers the comp iff
 * k·s·pw/2 ≥ w/2 + |x| on each axis, with s the camera scale and x the offset
 * from centre. Taking the smallest reachable scale and the largest reachable
 * offset is conservative; 1 means no overscan. The cost is framing: a pan crops
 * into the poster instead of revealing content beyond it, which a single still
 * does not have.
 */
function coverFactor(scaleProp, posProp, w, h, pw, ph) {
  const minS = Math.min(axisRange(scaleProp, 0)[0], axisRange(scaleProp, 1)[0]) / 100;
  if (!(minS > 0)) throw new Error(`camera scale must stay above 0 (reaches ${minS})`);
  const [xLo, xHi] = axisRange(posProp, 0);
  const [yLo, yHi] = axisRange(posProp, 1);
  const dx = Math.max(Math.abs(xLo - w / 2), Math.abs(xHi - w / 2));
  const dy = Math.max(Math.abs(yLo - h / 2), Math.abs(yHi - h / 2));
  return Math.max(1, (w / 2 + dx) / (minS * pw / 2), (h / 2 + dy) / (minS * ph / 2));
}

function scaleBy(prop, f) {
  if (f === 1) return prop;
  if (!prop.a) return { a: 0, k: prop.k.map(v => v * f) };
  return { a: 1, k: prop.k.map(kf => ({ ...kf, s: kf.s.map(v => v * f) })) };
}

/** Camera track → the poster layer's Lottie scale + position, overscanned to cover. */
function cameraProps(cameraTrack, w, h, pw, ph) {
  const cam = cameraTrack || {};
  const scaleProp = scalarProp(cam.scale, v => [v * 100, v * 100], [100, 100]);
  const posProp = positionProp(cam.translateX, cam.translateY, w / 2, h / 2);
  const overscan = coverFactor(scaleProp, posProp, w, h, pw, ph);
  return { scaleProp: scaleBy(scaleProp, overscan), posProp, overscan };
}

/**
 * The factor buildCameraLottie enlarges the poster by (1 = none), for reporting.
 * @param {object} p
 * @param {object|null} p.cameraTrack
 * @param {number} p.width @param {number} p.height - Lottie comp size.
 * @param {number} [p.posterWidth] @param {number} [p.posterHeight] - default to the comp size.
 */
export function posterOverscan({ cameraTrack, width, height, posterWidth, posterHeight }) {
  return cameraProps(cameraTrack, width, height, posterWidth || width, posterHeight || height).overscan;
}

/**
 * Pull the camera track out of a compiled timeline, or null when there's none
 * to export. A reactive descriptor (compound scene, no `tracks`) → null, which
 * the caller renders as a poster-only fallback.
 */
export function cameraTrackFromTimeline(timeline) {
  if (!timeline || timeline.mode === 'reactive') return null;
  const cam = timeline.tracks?.camera;
  if (!cam || Object.keys(cam).length === 0) return null;
  return cam;
}

/**
 * Clone a scene + timeline with the camera NEUTRALISED for poster capture.
 * Both `scene.camera` and `timeline.tracks.camera` reach CameraRig, so we must
 * blank both or the camera double-applies (baked into the poster AND re-applied
 * in Lottie). `shot_grammar` is static framing, not motion — it stays.
 */
export function neutralizeCameraForPoster(scene, timeline) {
  const s = structuredClone(scene);
  s.camera = { move: 'static' }; // drops any move/segments; shot_grammar untouched
  // Static timeline: keep layer tracks (so the poster shows settled content),
  // drop only the camera. Reactive descriptor / v1 (no tracks): don't hand a
  // non-static timeline to the renderer — capture the scene's own state.
  let t;
  if (timeline && timeline.tracks) {
    t = structuredClone(timeline);
    delete t.tracks.camera;
  }
  return { scene: s, timeline: t };
}

/**
 * Build a self-contained Lottie animation: one embedded poster image layer
 * driven by the camera track.
 *
 * @param {object} p
 * @param {object|null} p.cameraTrack - { scale?, translateX?, translateY? } frame-addressed tracks, or null.
 * @param {{dataUri:string,width?:number,height?:number}} p.poster - embedded PNG.
 * @param {number} p.width @param {number} p.height - Lottie comp size.
 * @param {number} p.fps @param {number} p.durationFrames
 * @param {string} [p.name]
 */
export function buildCameraLottie({ cameraTrack, poster, width, height, fps, durationFrames, name }) {
  const w = width, h = height;
  const cam = cameraTrack || {};
  const pw = poster?.width || w;
  const ph = poster?.height || h;

  // Overscanned so the camera move never uncovers the canvas (see coverFactor).
  const { scaleProp, posProp } = cameraProps(cam, w, h, pw, ph);
  // Animatic's compiled camera never rotates; keep rotation static for v0.

  return {
    v: '5.7.4',
    fr: fps || 60,
    ip: 0,
    op: durationFrames || (fps || 60),
    w,
    h,
    nm: name || 'animatic_export',
    assets: [{ id: 'poster_0', w: pw, h: ph, u: '', p: poster?.dataUri || '', e: 1 }],
    layers: [{
      ddd: 0,
      ind: 1,
      ty: 2, // image
      nm: 'poster',
      refId: 'poster_0',
      ks: {
        o: { a: 0, k: 100 },          // camera carries no opacity
        r: { a: 0, k: 0 },
        p: posProp,
        a: { a: 0, k: [pw / 2, ph / 2, 0] }, // anchor at image centre → scale/rotate about centre
        s: scaleProp,
      },
      ao: 0,
      ip: 0,
      op: durationFrames || (fps || 60),
      st: 0,
      bm: 0,
    }],
    markers: [],
    meta: { g: 'animatic scene_to_lottie (ANI-200)' },
  };
}
