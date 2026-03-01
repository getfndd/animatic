import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * SceneComposition — Renders a single scene definition to video.
 *
 * Implements the scene format spec (docs/cinematography/specs/scene-format.md):
 * - Camera rig with push_in, pull_out, pan_left, pan_right, drift, static
 * - Layer stack with depth_class-based parallax
 * - Entrance animations via delay
 *
 * @param {object} props
 * @param {object} props.scene - Scene definition (scene format JSON)
 */
export const SceneComposition = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;

  // Camera transform based on scene.camera directive
  const cameraTransform = getCameraTransform(scene.camera, progress);
  const layers = scene.layers || [];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Camera Rig — wraps all layers */}
      <AbsoluteFill
        style={{
          transform: cameraTransform,
          transformOrigin: 'center center',
        }}
      >
        {layers.map((layer) => (
          <SceneLayer key={layer.id} layer={layer} frame={frame} fps={fps} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * SceneLayer — Renders a single layer within the scene.
 *
 * Currently supports inline HTML content for testing.
 * Production layers will use:
 * - iframe embedding for HTML scene files (ANI-18)
 * - Remotion <Video> for video layers (ANI-18)
 * - Remotion <Img> for image layers (ANI-18)
 */
const SceneLayer = ({ layer, frame, fps }) => {
  const delayMs = layer.entrance?.delay_ms || 0;
  const delayFrames = Math.round((delayMs / 1000) * fps);
  const entranceProgress = Math.min(1, Math.max(0, (frame - delayFrames) / (fps * 0.5)));

  // Parallax based on depth class
  const parallaxFactor = getParallaxFactor(layer.depth_class);

  const layerStyle = {
    position: 'absolute',
    inset: 0,
    opacity: interpolate(entranceProgress, [0, 1], [0, layer.opacity ?? 1], {
      extrapolateRight: 'clamp',
    }),
    transform: `translateY(${interpolate(entranceProgress, [0, 1], [20 * parallaxFactor, 0], {
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    })}px)`,
    mixBlendMode: layer.blend_mode || 'normal',
    ...(layer.position
      ? {
          inset: 'auto',
          left: layer.position.x,
          top: layer.position.y,
          width: layer.position.w,
          height: layer.position.h,
        }
      : {}),
  };

  if (layer.type === 'html' && layer.content) {
    // Render trusted HTML content from scene definitions.
    // Scene definitions are authored internally — not user-generated input.
    // Production will migrate to React component layers (ANI-18+).
    return <HtmlLayer style={layerStyle} html={layer.content} />;
  }

  // Placeholder for video/image layers (implemented in ANI-18)
  return (
    <div
      style={{
        ...layerStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
        fontFamily: 'sans-serif',
      }}
    >
      [{layer.type}: {layer.id}]
    </div>
  );
};

/**
 * HtmlLayer — Renders trusted internal HTML content within a scene layer.
 *
 * SECURITY: Only used for scene definitions authored by the development team.
 * Scene HTML content is NOT user-generated. In production, HTML layers will be
 * replaced with React component layers or sandboxed iframes (ANI-18+).
 */
const HtmlLayer = ({ style, html }) => {
  return (
    <div style={style}>
      <iframe
        srcDoc={html}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          overflow: 'hidden',
        }}
        sandbox="allow-same-origin"
        title="Scene layer"
      />
    </div>
  );
};

/**
 * Camera transform calculations.
 * Maps scene camera directives to CSS transforms using Remotion's interpolate().
 *
 * Intensity mapping (from scene-format.md):
 *   push_in:   scale 1.0 → 1.0 + intensity * 0.08
 *   pull_out:  scale (1.0 + intensity * 0.08) → 1.0
 *   pan_left:  translateX 0 → -(intensity * 80)px
 *   pan_right: translateX 0 → (intensity * 80)px
 *   drift:     ±(intensity * 3)px sinusoidal
 *   static:    no transform
 */
function getCameraTransform(camera, progress) {
  if (!camera || camera.move === 'static') return 'none';

  const intensity = camera.intensity ?? 0.5;
  const easing = getEasingFunction(camera.easing);
  const easedProgress = easing(progress);

  switch (camera.move) {
    case 'push_in': {
      const scale = 1 + easedProgress * intensity * 0.08;
      return `scale(${scale})`;
    }
    case 'pull_out': {
      const startScale = 1 + intensity * 0.08;
      const scale = startScale - easedProgress * intensity * 0.08;
      return `scale(${scale})`;
    }
    case 'pan_left': {
      const tx = -easedProgress * intensity * 80;
      return `translateX(${tx}px)`;
    }
    case 'pan_right': {
      const tx = easedProgress * intensity * 80;
      return `translateX(${tx}px)`;
    }
    case 'drift': {
      const amplitude = intensity * 3;
      const tx = Math.sin(progress * Math.PI * 2) * amplitude;
      const ty = Math.cos(progress * Math.PI * 1.5) * amplitude * 0.6;
      return `translate(${tx}px, ${ty}px)`;
    }
    default:
      return 'none';
  }
}

/**
 * Maps easing names from the scene format to interpolation functions.
 */
function getEasingFunction(easingName) {
  switch (easingName) {
    case 'linear':
      return (t) => t;
    case 'ease_out':
      return Easing.out(Easing.cubic);
    case 'cinematic_scurve':
      // S-curve: slow start, accelerate, slow end
      return Easing.bezier(0.33, 0, 0.2, 1);
    default:
      return Easing.bezier(0.33, 0, 0.2, 1);
  }
}

/**
 * Parallax factor based on depth class.
 * Foreground moves more, background moves less.
 */
function getParallaxFactor(depthClass) {
  switch (depthClass) {
    case 'foreground':
      return 1.0;
    case 'midground':
      return 0.6;
    case 'background':
      return 0.3;
    default:
      return 0.6;
  }
}
