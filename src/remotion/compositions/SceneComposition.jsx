import {
  AbsoluteFill,
  OffthreadVideo,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  staticFile,
} from 'remotion';
import { getParallaxFactor, resolveLayoutSlots } from '../lib.js';
import { CameraRig } from './CameraRig.jsx';
import { TextLayer } from './TextLayer.jsx';

/**
 * SceneComposition — Renders a single scene definition to video.
 *
 * Implements the scene format spec (docs/cinematography/specs/scene-format.md):
 * - Camera rig with push_in, pull_out, pan_left, pan_right, drift, static
 * - Layer stack with depth_class-based parallax
 * - Entrance animations via delay
 * - Asset resolution: video and image layers via Remotion <Video> and <Img>
 *
 * @param {object} props
 * @param {object} props.scene - Scene definition (scene format JSON)
 */
export const SceneComposition = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rawLayers = scene.layers || [];

  // Build asset lookup map from scene.assets[]
  const assets = buildAssetMap(scene.assets);

  // Resolve layout slots to pixel positions
  const canvasW = scene.canvas?.w ?? 1920;
  const canvasH = scene.canvas?.h ?? 1080;
  const slotMap = scene.layout ? resolveLayoutSlots(scene.layout, canvasW, canvasH) : null;
  const layers = rawLayers.map(layer =>
    layer.slot && slotMap?.[layer.slot] ? { ...layer, position: slotMap[layer.slot] } : layer
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <CameraRig camera={scene.camera}>
        {layers.map((layer) => (
          <SceneLayer
            key={layer.id}
            layer={layer}
            assets={assets}
            frame={frame}
            fps={fps}
          />
        ))}
      </CameraRig>
    </AbsoluteFill>
  );
};

/**
 * Build a lookup map from the scene's assets[] array.
 * Keyed by asset.id for O(1) lookup from layers.
 */
function buildAssetMap(assetList) {
  const map = {};
  if (!assetList) return map;
  for (const asset of assetList) {
    map[asset.id] = asset;
  }
  return map;
}

/**
 * Resolve an asset source path.
 * - Absolute URLs (http/https) pass through
 * - Relative paths are resolved via staticFile() (Remotion's public/ directory)
 * - Direct src on layer (no asset reference) passes through
 */
function resolveAssetSrc(src) {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('/')) return src;
  // Relative paths: try staticFile() for Remotion's public/ directory
  try {
    return staticFile(src);
  } catch {
    // staticFile throws if file not in public/ — fall back to raw path
    return src;
  }
}

/**
 * SceneLayer — Renders a single layer within the scene.
 *
 * Supports three layer types:
 * - html: Inline HTML content (via sandboxed iframe) or external HTML file
 * - video: Video asset via Remotion <Video> (frame-accurate playback)
 * - image: Image asset via Remotion <Img>
 */
const SceneLayer = ({ layer, assets, frame, fps }) => {
  const delayMs = layer.entrance?.delay_ms || 0;
  const delayFrames = Math.round((delayMs / 1000) * fps);
  const entranceDurationFrames = fps * 0.5; // 500ms entrance
  const entranceProgress = Math.min(1, Math.max(0, (frame - delayFrames) / entranceDurationFrames));

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
    overflow: 'hidden',
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

  // Resolve asset if layer references one
  const asset = layer.asset ? assets[layer.asset] : null;

  switch (layer.type) {
    case 'video':
      return (
        <VideoLayer
          style={layerStyle}
          asset={asset}
          src={layer.src}
          fit={layer.fit || 'cover'}
          fps={fps}
        />
      );

    case 'image':
      return (
        <ImageLayer
          style={layerStyle}
          asset={asset}
          src={layer.src}
          fit={layer.fit || 'cover'}
        />
      );

    case 'text':
      return <TextLayer layer={layer} style={layerStyle} />;

    case 'html':
      if (layer.content) {
        return <HtmlLayer style={layerStyle} html={layer.content} />;
      }
      if (layer.src) {
        return <HtmlFileLayer style={layerStyle} src={layer.src} />;
      }
      return <PlaceholderLayer style={layerStyle} label={`html: ${layer.id}`} />;

    default:
      return <PlaceholderLayer style={layerStyle} label={`${layer.type}: ${layer.id}`} />;
  }
};

/**
 * VideoLayer — Renders a video asset using Remotion's <Video> component.
 *
 * Features:
 * - Frame-accurate playback synced to Remotion's render clock
 * - Trim support (start_s / end_s from asset definition)
 * - Loop support
 * - Muted by default (per scene format spec)
 * - Object-fit modes (cover, contain, fill, none)
 */
const VideoLayer = ({ style, asset, src, fit, fps }) => {
  const resolvedSrc = resolveAssetSrc(asset?.src || src);

  if (!resolvedSrc) {
    return <PlaceholderLayer style={style} label="video: missing src" />;
  }

  // Trim: convert start_s/end_s to frame numbers
  const trimBefore = asset?.trim?.start_s ? Math.round(asset.trim.start_s * fps) : 0;
  const trimAfter = asset?.trim?.end_s ? Math.round(asset.trim.end_s * fps) : undefined;

  const videoStyle = {
    width: '100%',
    height: '100%',
    objectFit: fit,
  };

  return (
    <div style={style}>
      <OffthreadVideo
        src={resolvedSrc}
        style={videoStyle}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        muted={asset?.muted !== false}
        playbackRate={1}
      />
    </div>
  );
};

/**
 * ImageLayer — Renders an image asset using Remotion's <Img> component.
 *
 * Images render at full resolution with CSS object-fit applied.
 * Combined with the camera rig, this enables Ken Burns effects
 * (push-in on a still image creates the classic documentary pan).
 */
const ImageLayer = ({ style, asset, src, fit }) => {
  const resolvedSrc = resolveAssetSrc(asset?.src || src);

  if (!resolvedSrc) {
    return <PlaceholderLayer style={style} label="image: missing src" />;
  }

  return (
    <div style={style}>
      <Img
        src={resolvedSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
        }}
      />
    </div>
  );
};

/**
 * HtmlLayer — Renders trusted internal HTML content within a scene layer.
 *
 * SECURITY: Only used for scene definitions authored by the development team.
 * Scene HTML content is NOT user-generated.
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
 * HtmlFileLayer — Renders an external HTML file as a scene layer.
 * Uses iframe with src attribute pointing to the HTML file.
 */
const HtmlFileLayer = ({ style, src }) => {
  const resolvedSrc = resolveAssetSrc(src);

  return (
    <div style={style}>
      <iframe
        src={resolvedSrc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          overflow: 'hidden',
        }}
        sandbox="allow-same-origin allow-scripts"
        title="Scene layer"
      />
    </div>
  );
};

/**
 * PlaceholderLayer — Fallback for unresolved or unknown layer types.
 */
const PlaceholderLayer = ({ style, label }) => {
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 14,
        fontFamily: 'sans-serif',
      }}
    >
      [{label}]
    </div>
  );
};

