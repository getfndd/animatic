import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';

/**
 * Transition engine for the cinematography pipeline.
 *
 * Implements transitions from the sequence manifest spec:
 * - hard_cut: instant swap (0ms)
 * - crossfade: opacity interpolation (200-800ms)
 * - whip_left/right/up/down: clip-path inset() wipe (250ms)
 *
 * During crossfade and whip transitions, both scenes render simultaneously.
 * The TransitionWrapper wraps the incoming scene and applies the transition effect.
 */

/**
 * Wraps a scene with its transition_in effect.
 *
 * @param {object} props
 * @param {object} props.transition - Transition definition { type, duration_ms }
 * @param {number} props.transitionFrames - Transition duration in frames
 * @param {React.ReactNode} props.children - The scene content
 */
export const TransitionWrapper = ({ transition, transitionFrames, children }) => {
  const frame = useCurrentFrame();
  const type = transition?.type || 'hard_cut';

  if (type === 'hard_cut' || transitionFrames === 0) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  // Progress through the transition (0 = start, 1 = complete)
  const progress = interpolate(frame, [0, transitionFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  switch (type) {
    case 'crossfade':
      return <CrossfadeIn progress={progress}>{children}</CrossfadeIn>;
    case 'whip_left':
      return <WhipWipe direction="left" progress={progress}>{children}</WhipWipe>;
    case 'whip_right':
      return <WhipWipe direction="right" progress={progress}>{children}</WhipWipe>;
    case 'whip_up':
      return <WhipWipe direction="up" progress={progress}>{children}</WhipWipe>;
    case 'whip_down':
      return <WhipWipe direction="down" progress={progress}>{children}</WhipWipe>;
    default:
      return <AbsoluteFill>{children}</AbsoluteFill>;
  }
};

/**
 * Wraps the outgoing scene during a transition.
 * Applies the exit effect (fade out for crossfade, clip-path for whip).
 */
export const TransitionOutWrapper = ({ transition, transitionFrames, sceneFrames, children }) => {
  const frame = useCurrentFrame();
  const type = transition?.type || 'hard_cut';

  if (type === 'hard_cut' || transitionFrames === 0) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  // The outgoing scene's exit starts at (sceneFrames - transitionFrames)
  const exitStart = sceneFrames - transitionFrames;
  const exitProgress = interpolate(frame, [exitStart, sceneFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  switch (type) {
    case 'crossfade':
      return <CrossfadeOut progress={exitProgress}>{children}</CrossfadeOut>;
    case 'whip_left':
    case 'whip_right':
    case 'whip_up':
    case 'whip_down':
      // Whip wipes: outgoing scene stays fully visible, incoming wipes over it
      return <AbsoluteFill>{children}</AbsoluteFill>;
    default:
      return <AbsoluteFill>{children}</AbsoluteFill>;
  }
};

/**
 * Crossfade in — incoming scene fades from 0 to 1 opacity.
 */
const CrossfadeIn = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * Crossfade out — outgoing scene fades from 1 to 0 opacity.
 */
const CrossfadeOut = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 1], [1, 0], {
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * Whip wipe — clip-path inset() reveals the incoming scene.
 *
 * Directions (from the sequence manifest spec):
 * - whip_left:  wipe from right to left (inset right edge moves left)
 * - whip_right: wipe from left to right (inset left edge moves right)
 * - whip_up:    wipe from bottom to top (inset bottom edge moves up)
 * - whip_down:  wipe from top to bottom (inset top edge moves down)
 */
const WhipWipe = ({ direction, progress, children }) => {
  // Easing: fast start, decelerate (matches montage mo-whip-wipe feel)
  const easedProgress = interpolate(progress, [0, 1], [0, 1], {
    easing: Easing.out(Easing.cubic),
  });

  const pct = (1 - easedProgress) * 100;

  // clip-path: inset(top right bottom left)
  let clipPath;
  switch (direction) {
    case 'left':
      // Reveal from right to left: right edge starts at 100% and moves to 0%
      clipPath = `inset(0 0 0 ${pct}%)`;
      break;
    case 'right':
      // Reveal from left to right: left edge starts at 100% and moves to 0%
      clipPath = `inset(0 ${pct}% 0 0)`;
      break;
    case 'up':
      // Reveal from bottom to top: bottom edge starts at 100% and moves to 0%
      clipPath = `inset(0 0 ${pct}% 0)`;
      break;
    case 'down':
      // Reveal from top to bottom: top edge starts at 100% and moves to 0%
      clipPath = `inset(${pct}% 0 0 0)`;
      break;
    default:
      clipPath = 'none';
  }

  return (
    <AbsoluteFill style={{ clipPath }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * Get default transition duration for a type (in ms).
 */
export function getDefaultTransitionDuration(type) {
  switch (type) {
    case 'hard_cut': return 0;
    case 'crossfade': return 400;
    case 'whip_left':
    case 'whip_right':
    case 'whip_up':
    case 'whip_down':
      return 250;
    default:
      return 0;
  }
}
