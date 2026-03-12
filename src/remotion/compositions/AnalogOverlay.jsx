import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

/**
 * AnalogOverlay — VHS-inspired post-processing layer.
 *
 * Applies retro analog effects via CSS filters and SVG overlays:
 * - Warm color grading (sepia + saturation shift)
 * - Animated film grain via SVG feTurbulence
 * - Horizontal scan lines via repeating gradient
 * - Slight softness via blur
 * - Color bleeding via mix-blend-mode overlay
 *
 * Renders as an overlay on top of scene content.
 * Activate by setting scene.metadata.visual_treatment = "analog"
 * or using the "analog" style pack.
 */
export const AnalogOverlay = () => {
  const frame = useCurrentFrame();

  // Animate grain seed — shift turbulence every few frames for organic feel
  const grainSeed = Math.floor(frame / 3);

  // Subtle flicker: slight brightness variation to simulate VHS instability
  const flicker = interpolate(
    Math.sin(frame * 0.7) + Math.sin(frame * 1.3),
    [-2, 2],
    [0.97, 1.03],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <>
      {/* Color grading layer — warm golden tones */}
      <AbsoluteFill
        style={{
          filter: `contrast(1.1) saturate(0.85) sepia(0.15) brightness(${flicker})`,
          pointerEvents: 'none',
          mixBlendMode: 'color',
          backgroundColor: 'rgba(255, 200, 100, 0.06)',
        }}
      />

      {/* Film grain overlay — animated SVG noise */}
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.12, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id={`grain-${grainSeed}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              seed={grainSeed}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect
            width="100%"
            height="100%"
            filter={`url(#grain-${grainSeed})`}
          />
        </svg>
      </AbsoluteFill>

      {/* Scan lines — horizontal repeating gradient */}
      <AbsoluteFill
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Softness — slight blur for low-res VHS feel */}
      <AbsoluteFill
        style={{
          backdropFilter: 'blur(0.3px)',
          pointerEvents: 'none',
        }}
      />

      {/* Vignette — darkened edges for analog camera look */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
