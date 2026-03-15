import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import {
  getCameraTransformValues,
  calculateOverscanDimensions,
  getShotGrammarCSS,
  composeCameraTransform,
  interpolateTrack,
  trackValuesToCSS,
} from '../lib.js';

/**
 * Maps easing names from the scene format to interpolation functions.
 * Lives here (not in lib.js) because it depends on Remotion's Easing module.
 */
function getEasingFunction(easingName) {
  switch (easingName) {
    case 'linear':
      return (t) => t;
    case 'ease_out':
      return Easing.out(Easing.cubic);
    case 'cinematic_scurve':
      return Easing.bezier(0.33, 0, 0.2, 1);
    default:
      return Easing.bezier(0.33, 0, 0.2, 1);
  }
}

/**
 * Guardrail bounds for runtime camera clamping.
 * Derived from catalog/camera-guardrails.json lens_bounds.
 */
const GUARDRAIL_BOUNDS = {
  scaleMin: 0.95,
  scaleMax: 1.05,
  rotationMin: -20,
  rotationMax: 20,
  translateMax: 400,
};

/**
 * CameraRig — Full-frame camera wrapper with overscan.
 *
 * Two-div structure prevents content edges from revealing during pan moves:
 *   div.clip  (viewport-sized, overflow: hidden, optional 3D perspective)
 *     div.canvas  (oversized, centered, camera transform applied)
 *       {children}
 *
 * Static moves with no shot grammar render a plain AbsoluteFill (no extra divs).
 *
 * Shot grammar provides static framing (scale, rotation, transform-origin) that
 * composes with dynamic camera moves via composeCameraTransform().
 *
 * Camera-only deltas are clamped to guardrail bounds before composition,
 * preventing out-of-range values from reaching the render.
 *
 * **v2 Timeline mode:** When `timelineTracks` is provided (from compiled Level 2
 * timeline), camera transform is driven by multi-keyframe interpolation instead
 * of the single-move easing path. Falls back to v1 when timelineTracks is absent.
 *
 * @param {object} props
 * @param {object} props.camera - { move, intensity, easing }
 * @param {object} [props.shotGrammar] - { shot_size, angle, framing }
 * @param {object} [props.timelineTracks] - Level 2 camera tracks { transform: [...], ... }
 * @param {React.ReactNode} props.children
 */
export const CameraRig = ({ camera, shotGrammar, timelineTracks, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const hasTimeline = timelineTracks && Object.keys(timelineTracks).length > 0;
  const hasCamera = camera && camera.move !== 'static';
  const hasShotGrammar = shotGrammar && (shotGrammar.shot_size || shotGrammar.angle || shotGrammar.framing);

  // No camera, no shot grammar, no timeline — no rig needed
  if (!hasCamera && !hasShotGrammar && !hasTimeline) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  let transform, transformOrigin, perspectiveOrigin;

  if (hasTimeline) {
    // ── v2 Timeline path: multi-keyframe camera tracks ───────────────────
    const values = {};
    for (const [prop, track] of Object.entries(timelineTracks)) {
      values[prop] = interpolateTrack(track, frame);
    }

    // If timeline provides a pre-composed transform string, use it directly
    if (timelineTracks.transform) {
      const css = trackValuesToCSS(values);
      transform = css.transform;
    } else {
      // Build transform from individual properties
      const parts = [];
      if (values.scale != null && values.scale !== 1) parts.push(`scale(${values.scale})`);
      if (values.translateX != null || values.translateY != null) {
        parts.push(`translate(${values.translateX ?? 0}px, ${values.translateY ?? 0}px)`);
      }
      if (values.rotate != null && values.rotate !== 0) parts.push(`rotate(${values.rotate}deg)`);
      transform = parts.length > 0 ? parts.join(' ') : 'none';
    }

    transformOrigin = 'center center';
    perspectiveOrigin = undefined;
  } else {
    // ── v1 Legacy path: single-move easing ───────────────────────────────
    const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
      extrapolateRight: 'clamp',
      extrapolateLeft: 'clamp',
    });

    const easingFn = getEasingFunction(camera?.easing);
    const sgCSS = hasShotGrammar ? getShotGrammarCSS(shotGrammar) : null;

    if (hasShotGrammar) {
      ({ transform, transformOrigin, perspectiveOrigin } = composeCameraTransform(
        sgCSS, camera, progress, easingFn, GUARDRAIL_BOUNDS
      ));
    } else {
      ({ transform } = getCameraTransformValues(camera, progress, easingFn, GUARDRAIL_BOUNDS));
      transformOrigin = 'center center';
      perspectiveOrigin = undefined;
    }
  }

  const { canvasW, canvasH, offsetX, offsetY } = calculateOverscanDimensions(
    width,
    height,
    camera,
  );

  // 3D perspective needed when shot grammar applies rotation
  const sgCSS = hasShotGrammar ? getShotGrammarCSS(shotGrammar) : null;
  const needs3D = sgCSS && (sgCSS.rotateX !== 0 || sgCSS.rotateZ !== 0);

  return (
    <div
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
        perspective: needs3D ? 1200 : undefined,
        perspectiveOrigin,
      }}
    >
      <div
        style={{
          width: canvasW,
          height: canvasH,
          position: 'absolute',
          left: -offsetX,
          top: -offsetY,
          transform,
          transformOrigin,
        }}
      >
        {children}
      </div>
    </div>
  );
};
