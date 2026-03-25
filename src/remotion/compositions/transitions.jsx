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
    case 'zoom_crossfade':
      return <ZoomCrossfadeIn progress={progress}>{children}</ZoomCrossfadeIn>;
    case 'parallax_crossfade':
      return <ParallaxCrossfadeIn progress={progress}>{children}</ParallaxCrossfadeIn>;
    case 'light_wipe':
      return <LightWipe progress={progress}>{children}</LightWipe>;
    case 'focus_dissolve':
      return <FocusDissolveIn progress={progress}>{children}</FocusDissolveIn>;
    case 'match_cut_scale':
      return <MatchCutScaleIn progress={progress}>{children}</MatchCutScaleIn>;
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
    case 'zoom_crossfade':
      return <ZoomCrossfadeOut progress={exitProgress}>{children}</ZoomCrossfadeOut>;
    case 'parallax_crossfade':
      return <ParallaxCrossfadeOut progress={exitProgress}>{children}</ParallaxCrossfadeOut>;
    case 'light_wipe':
      // Light wipe: outgoing scene stays visible, gradient wipes over it
      return <AbsoluteFill>{children}</AbsoluteFill>;
    case 'focus_dissolve':
      return <FocusDissolveOut progress={exitProgress}>{children}</FocusDissolveOut>;
    case 'match_cut_scale':
      return <MatchCutScaleOut progress={exitProgress}>{children}</MatchCutScaleOut>;
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
 * Zoom crossfade in — incoming scene fades in while scaling from 1.08 to 1.0.
 * Creates a gentle "landing" feel, as if the camera settles into the new scene.
 */
const ZoomCrossfadeIn = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
  const scale = interpolate(progress, [0, 1], [1.08, 1], {
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};

const ZoomCrossfadeOut = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 1], [1, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  const scale = interpolate(progress, [0, 1], [1, 0.94], {
    easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * Parallax crossfade — incoming scene fades in while sliding from right.
 * Outgoing scene fades out while sliding left at half the speed (parallax offset).
 */
const ParallaxCrossfadeIn = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 0.6], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const translateX = interpolate(progress, [0, 1], [80, 0], {
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `translateX(${translateX}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

const ParallaxCrossfadeOut = ({ progress, children }) => {
  const opacity = interpolate(progress, [0.4, 1], [1, 0], {
    extrapolateLeft: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const translateX = interpolate(progress, [0, 1], [0, -40], {
    easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `translateX(${translateX}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * Light wipe — a bright gradient band sweeps across, revealing the incoming scene.
 * Uses clip-path for the reveal and a white gradient overlay for the "light" effect.
 */
const LightWipe = ({ progress, children }) => {
  const easedProgress = interpolate(progress, [0, 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });

  // The reveal clip moves from left to right
  const revealPct = easedProgress * 100;
  const clipPath = `inset(0 ${100 - revealPct}% 0 0)`;

  // The light band leads the wipe edge
  const bandCenter = revealPct;
  const bandOpacity = interpolate(progress, [0, 0.15, 0.85, 1], [0, 0.6, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, transparent ${bandCenter - 8}%, rgba(255,255,255,${bandOpacity}) ${bandCenter}%, transparent ${bandCenter + 8}%)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Focus dissolve — incoming scene starts blurred and sharpens as it fades in.
 * Simulates a rack-focus transition between scenes.
 */
const FocusDissolveIn = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
  const blur = interpolate(progress, [0, 1], [12, 0], {
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

const FocusDissolveOut = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 1], [1, 0], {
    easing: Easing.inOut(Easing.cubic),
  });
  const blur = interpolate(progress, [0, 1], [0, 8], {
    easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * Match cut scale — incoming scene scales up from a small focal point.
 * Creates a graphic match-cut effect, as if zooming into a detail that becomes
 * the next scene. Outgoing scene scales down to the same focal point.
 */
const MatchCutScaleIn = ({ progress, children }) => {
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const scale = interpolate(progress, [0, 1], [0.4, 1], {
    easing: Easing.out(Easing.expo),
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
};

const MatchCutScaleOut = ({ progress, children }) => {
  const opacity = interpolate(progress, [0.7, 1], [1, 0], {
    extrapolateLeft: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const scale = interpolate(progress, [0, 1], [1, 2.2], {
    easing: Easing.in(Easing.expo),
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
};

export { getDefaultTransitionDuration } from '../lib.js';
