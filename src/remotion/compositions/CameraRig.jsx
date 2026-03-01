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
 * @param {object} props
 * @param {object} props.camera - { move, intensity, easing }
 * @param {object} [props.shotGrammar] - { shot_size, angle, framing }
 * @param {React.ReactNode} props.children
 */
export const CameraRig = ({ camera, shotGrammar, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const hasCamera = camera && camera.move !== 'static';
  const hasShotGrammar = shotGrammar && (shotGrammar.shot_size || shotGrammar.angle || shotGrammar.framing);

  // No camera and no shot grammar — no rig needed
  if (!hasCamera && !hasShotGrammar) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  // Frame-based progress via interpolate (matches transitions.jsx pattern)
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const easingFn = getEasingFunction(camera?.easing);

  // Resolve shot grammar to CSS values
  const sgCSS = hasShotGrammar ? getShotGrammarCSS(shotGrammar) : null;

  // Compute transform: compound when shot grammar present, legacy path otherwise
  let transform, transformOrigin, perspectiveOrigin;
  if (hasShotGrammar) {
    ({ transform, transformOrigin, perspectiveOrigin } = composeCameraTransform(
      sgCSS, camera, progress, easingFn, GUARDRAIL_BOUNDS
    ));
  } else {
    ({ transform } = getCameraTransformValues(camera, progress, easingFn, GUARDRAIL_BOUNDS));
    transformOrigin = 'center center';
    perspectiveOrigin = undefined;
  }

  const { canvasW, canvasH, offsetX, offsetY } = calculateOverscanDimensions(
    width,
    height,
    camera,
  );

  // 3D perspective needed when shot grammar applies rotation
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
