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
 * CameraRig — Full-frame camera wrapper with overscan.
 *
 * Two-div structure prevents content edges from revealing during pan moves:
 *   div.clip  (viewport-sized, overflow: hidden)
 *     div.canvas  (oversized, centered, camera transform applied)
 *       {children}
 *
 * Static moves render a plain AbsoluteFill (no overscan, no extra divs).
 *
 * @param {object} props
 * @param {object} props.camera - { move, intensity, easing }
 * @param {React.ReactNode} props.children
 */
export const CameraRig = ({ camera, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // Static or missing camera — no rig needed
  if (!camera || camera.move === 'static') {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  // Frame-based progress via interpolate (matches transitions.jsx pattern)
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const easingFn = getEasingFunction(camera.easing);
  const { transform } = getCameraTransformValues(camera, progress, easingFn);
  const { canvasW, canvasH, offsetX, offsetY } = calculateOverscanDimensions(
    width,
    height,
    camera,
  );

  return (
    <div
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
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
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
};
