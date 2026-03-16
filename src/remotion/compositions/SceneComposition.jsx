import {
  AbsoluteFill,
  OffthreadVideo,
  Img,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from 'remotion';
import {
  getParallaxFactor,
  resolveLayoutSlots,
  resolveEntranceAnimation,
  resolveSceneBackground,
} from '../lib.js';
import { CameraRig } from './CameraRig.jsx';
import { TextLayer } from './TextLayer.jsx';
import { TimelineLayer } from './TimelineLayer.jsx';
import { AnalogOverlay } from './AnalogOverlay.jsx';

/**
 * SceneComposition — Renders a single scene definition to video.
 *
 * Implements the scene format spec (docs/cinematography/specs/scene-format.md):
 * - Camera rig with push_in, pull_out, pan_left, pan_right, drift, static
 * - Layer stack with depth_class-based parallax
 * - Entrance animations via delay
 * - Asset resolution: video and image layers via Remotion <Video> and <Img>
 *
 * **v2 Timeline mode:** When a `timeline` prop is provided (compiled Level 2
 * Motion Timeline), layers and camera are driven by frame-addressed keyframe
 * tracks instead of the v1 entrance/camera path. Detection:
 *   `if (scene.format_version === 2 || timeline) → v2 path`
 *
 * @param {object} props
 * @param {object} props.scene - Scene definition (scene format JSON)
 * @param {object} [props.timeline] - Compiled Level 2 timeline { tracks: { camera, layers } }
 */
export const SceneComposition = ({ scene, timeline }) => {
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
  const background = resolveSceneBackground(scene);

  // v2 detection: compiled timeline present or format_version 2
  const isV2 = timeline?.tracks || scene.format_version === 2;

  if (isV2 && timeline?.tracks) {
    // Build layer ID set for mask resolution
    const layerById = {};
    for (const l of layers) { layerById[l.id] = l; }

    return (
      <AbsoluteFill style={{ background }}>
        <CameraRig
          camera={scene.camera}
          shotGrammar={scene.shot_grammar}
          timelineTracks={timeline.tracks.camera}
        >
          {layers.map((layer) => {
            // Skip layers used only as masks — they render inside MaskedLayer
            const isMaskOnly = layers.some(l => l.mask_layer === layer.id);
            if (isMaskOnly && !layer.mask_layer) {
              // Render hidden so it exists in DOM but doesn't display standalone
              // (only if this layer isn't itself masked)
            }

            const layerTracks = timeline.tracks.layers?.[layer.id];

            // Masking: wrap in MaskedLayer if mask_layer is set
            if (layer.mask_layer) {
              const maskLayerDef = layerById[layer.mask_layer];
              const maskTracks = maskLayerDef ? timeline.tracks.layers?.[maskLayerDef.id] : null;
              return (
                <MaskedLayer
                  key={layer.id}
                  layer={layer}
                  tracks={layerTracks}
                  maskLayer={maskLayerDef}
                  maskTracks={maskTracks}
                  assets={assets}
                  frame={frame}
                  fps={fps}
                />
              );
            }

            if (layerTracks) {
              return (
                <TimelineLayer key={layer.id} layer={layer} tracks={layerTracks}>
                  <LayerContent layer={layer} assets={assets} frame={frame} fps={fps} />
                </TimelineLayer>
              );
            }
            // Layers without timeline tracks fall back to v1 entrance
            return (
              <SceneLayer
                key={layer.id}
                layer={layer}
                assets={assets}
                frame={frame}
                fps={fps}
              />
            );
          })}
        </CameraRig>
        {scene.metadata?.visual_treatment === 'analog' && <AnalogOverlay />}
      </AbsoluteFill>
    );
  }

  // v1 path — unchanged
  return (
    <AbsoluteFill style={{ background }}>
      <CameraRig camera={scene.camera} shotGrammar={scene.shot_grammar}>
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
      {scene.metadata?.visual_treatment === 'analog' && <AnalogOverlay />}
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
  const parallaxFactor = getParallaxFactor(layer.depth_class);
  const entrance = resolveEntranceAnimation(layer, frame, fps, { parallaxFactor });

  const layerStyle = {
    position: 'absolute',
    inset: 0,
    opacity: entrance.opacity,
    filter: entrance.filter,
    transform: entrance.transform,
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
      return <TextLayer layer={layer} style={layerStyle} entrance={entrance} />;

    case 'html':
      if (layer.content) {
        return <HtmlLayer style={layerStyle} html={layer.content} />;
      }
      if (layer.src) {
        return <HtmlFileLayer style={layerStyle} src={layer.src} />;
      }
      return <PlaceholderLayer style={layerStyle} label={`html: ${layer.id}`} />;

    case 'svg':
      if (layer.content) {
        return <SvgInlineLayer style={layerStyle} svg={layer.content} />;
      }
      if (layer.src) {
        return <SvgFileLayer style={layerStyle} src={layer.src} fit={layer.fit || 'contain'} />;
      }
      return <PlaceholderLayer style={layerStyle} label={`svg: ${layer.id}`} />;

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
 * LayerContent — Renders the inner content of a layer without positioning.
 *
 * Used by TimelineLayer in v2 path. TimelineLayer handles positioning,
 * opacity, transform, and effects; LayerContent handles media rendering.
 */
const LayerContent = ({ layer, assets, frame, fps, textChars, semanticValues }) => {
  const asset = layer.asset ? assets[layer.asset] : null;
  const fillStyle = { width: '100%', height: '100%' };

  switch (layer.type) {
    case 'video': {
      const resolvedSrc = resolveAssetSrc(asset?.src || layer.src);
      if (!resolvedSrc) return <div style={fillStyle}>[video: missing src]</div>;
      const trimBefore = asset?.trim?.start_s ? Math.round(asset.trim.start_s * fps) : 0;
      const trimAfter = asset?.trim?.end_s ? Math.round(asset.trim.end_s * fps) : undefined;
      return (
        <OffthreadVideo
          src={resolvedSrc}
          style={{ ...fillStyle, objectFit: layer.fit || 'cover' }}
          trimBefore={trimBefore}
          trimAfter={trimAfter}
          muted={asset?.muted !== false}
          playbackRate={1}
        />
      );
    }
    case 'image': {
      const resolvedSrc = resolveAssetSrc(asset?.src || layer.src);
      if (!resolvedSrc) return <div style={fillStyle}>[image: missing src]</div>;
      return (
        <Img
          src={resolvedSrc}
          style={{ ...fillStyle, objectFit: layer.fit || 'cover' }}
        />
      );
    }
    case 'text':
      if (semanticValues?.text_chars != null) {
        const totalChars = (layer.content || '').length;
        return <TextLayer layer={layer} style={fillStyle} entrance={{ mode: 'typewriter', progress: totalChars > 0 ? semanticValues.text_chars / totalChars : 1 }} semanticValues={semanticValues} />;
      }
      if (textChars != null) {
        const totalChars = (layer.content || '').length;
        return <TextLayer layer={layer} style={fillStyle} entrance={{ mode: 'typewriter', progress: totalChars > 0 ? textChars / totalChars : 1 }} />;
      }
      return <TextLayer layer={layer} style={fillStyle} entrance={{ mode: 'style', opacity: 1, filter: 'none', transform: 'none' }} semanticValues={semanticValues} />;
    case 'html':
      if (layer.content) {
        return (
          <iframe
            srcDoc={layer.content}
            style={{ ...fillStyle, border: 'none', overflow: 'hidden' }}
            sandbox="allow-same-origin"
            title="Scene layer"
          />
        );
      }
      if (layer.src) {
        return (
          <iframe
            src={resolveAssetSrc(layer.src)}
            style={{ ...fillStyle, border: 'none', overflow: 'hidden' }}
            sandbox="allow-same-origin allow-scripts"
            title="Scene layer"
          />
        );
      }
      return <div style={fillStyle}>[html: {layer.id}]</div>;
    case 'svg':
      return renderSvgContent(layer, fillStyle);
    default:
      return <div style={fillStyle}>[{layer.type}: {layer.id}]</div>;
  }
};

/**
 * SvgInlineLayer -- Renders inline SVG content directly in the DOM.
 *
 * SVG is rendered via innerHTML so that elements are in the DOM tree
 * and can be styled/animated via CSS custom properties from the timeline.
 *
 * SECURITY: Only used for scene definitions authored by the development team.
 * Scene SVG content is NOT user-generated.
 */
const SvgInlineLayer = ({ style, svg }) => {
  return (
    <div
      style={style}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/**
 * SvgFileLayer -- Renders an external SVG file as an image.
 * Uses Remotion's Img component for external .svg files.
 */
const SvgFileLayer = ({ style, src, fit }) => {
  const resolvedSrc = resolveAssetSrc(src);

  if (!resolvedSrc) {
    return <PlaceholderLayer style={style} label="svg: missing src" />;
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
 * MaskedLayer -- Renders a layer with another layer as a CSS mask.
 *
 * Uses CSS mask-image to composite the mask layer's rendered content
 * as an alpha or luminance mask over the target layer.
 *
 * @param {object} props
 * @param {object} props.layer - The layer to render (the one being masked)
 * @param {object} [props.tracks] - Timeline tracks for the masked layer
 * @param {object} [props.maskLayer] - The layer definition used as the mask source
 * @param {object} [props.maskTracks] - Timeline tracks for the mask layer
 * @param {object} props.assets - Asset lookup map
 * @param {number} props.frame - Current frame
 * @param {number} props.fps - Frames per second
 */
const MaskedLayer = ({ layer, tracks, maskLayer, maskTracks, assets, frame, fps }) => {
  const maskType = layer.mask_type || 'alpha';
  const maskMode = maskType === 'luminance' ? 'luminance' : 'alpha';

  const containerStyle = {
    position: 'absolute',
    inset: 0,
  };

  const maskStyle = {
    position: 'absolute',
    inset: 0,
    maskMode,
    WebkitMaskMode: maskMode,
  };

  return (
    <div style={containerStyle}>
      {tracks ? (
        <TimelineLayer layer={layer} tracks={tracks} style={maskStyle}>
          <LayerContent layer={layer} assets={assets} frame={frame} fps={fps} />
        </TimelineLayer>
      ) : (
        <SceneLayer layer={layer} assets={assets} frame={frame} fps={fps} />
      )}
      {maskLayer && (
        <div style={{ position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none' }}>
          {maskTracks ? (
            <TimelineLayer layer={maskLayer} tracks={maskTracks}>
              <LayerContent layer={maskLayer} assets={assets} frame={frame} fps={fps} />
            </TimelineLayer>
          ) : (
            <SceneLayer layer={maskLayer} assets={assets} frame={frame} fps={fps} />
          )}
        </div>
      )}
    </div>
  );
};

/**
 * renderSvgContent -- Helper for LayerContent to render SVG without positioning.
 *
 * SECURITY: Only used for scene definitions authored by the development team.
 * Scene SVG content is NOT user-generated.
 */
function renderSvgContent(layer, fillStyle) {
  if (layer.content) {
    return (
      <div
        style={fillStyle}
        dangerouslySetInnerHTML={{ __html: layer.content }}
      />
    );
  }
  if (layer.src) {
    const resolvedSvgSrc = resolveAssetSrc(layer.src);
    return (
      <Img
        src={resolvedSvgSrc}
        style={{ ...fillStyle, objectFit: layer.fit || 'contain' }}
      />
    );
  }
  return <div style={fillStyle}>[svg: {layer.id}]</div>;
}

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
