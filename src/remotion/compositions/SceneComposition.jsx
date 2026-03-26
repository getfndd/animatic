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
import { CardConveyorLayer } from './CardConveyorLayer.jsx';
import {
  CounterRenderer,
  ListRenderer,
  SelectionOverlay,
  MenuRenderer,
  FocusPulseOverlay,
} from './SemanticRenderers.jsx';
import { StackFanSettleLayer } from './StackFanSettleLayer.jsx';
import { ChartBuildExplainLayer } from './ChartBuildExplainLayer.jsx';
import { SpotlightCursorRevealLayer } from './SpotlightCursorRevealLayer.jsx';

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

  // Editorial canvas path — flat art-directed space with anchor-based positioning.
  // Checked BEFORE v2 so editorial_canvas scenes with compiled timelines use the
  // canvas layout (timeline tracks are still honored per-layer within).
  if (scene.mode === 'editorial_canvas') {
    const editorialLayers = resolveEditorialLayout(scene, layers);
    const editorialBg = resolveEditorialBackground(scene.canvas, background);
    return (
      <AbsoluteFill style={{ background: editorialBg }}>
        <CameraRig
          camera={scene.camera}
          shotGrammar={scene.shot_grammar}
          timelineTracks={timeline?.tracks?.camera}
        >
          <div style={getEditorialSafeZoneStyle(scene.canvas)}>
            {editorialLayers.map(({ layer, style: editorialStyle }) => {
              const layerTracks = timeline?.tracks?.layers?.[layer.id];
              if (layerTracks) {
                return (
                  <TimelineLayer key={layer.id} layer={layer} tracks={layerTracks}>
                    <EditorialCanvasLayer
                      layer={layer}
                      editorialStyle={editorialStyle}
                      assets={assets}
                      frame={frame}
                      fps={fps}
                    />
                  </TimelineLayer>
                );
              }
              return (
                <EditorialCanvasLayer
                  key={layer.id}
                  layer={layer}
                  editorialStyle={editorialStyle}
                  assets={assets}
                  frame={frame}
                  fps={fps}
                />
              );
            })}
          </div>
        </CameraRig>
        {scene.metadata?.visual_treatment === 'analog' && <AnalogOverlay />}
      </AbsoluteFill>
    );
  }

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
            // Skip layers used only as mask sources — they render inside MaskedLayer.
            // Without this, the mask-source layer appears visibly as a normal layer
            // in addition to being used as a mask.
            const isMaskOnly = layers.some(l => l.mask_layer === layer.id);
            if (isMaskOnly && !layer.mask_layer) {
              return null;
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

    case 'card_conveyor':
      return <CardConveyorLayer layer={layer} />;

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
    case 'text': {
      // Counter value renderer
      if (semanticValues?.counter_value != null) {
        const wrapped = <CounterRenderer counterValue={semanticValues.counter_value} layer={layer} style={fillStyle} />;
        if (semanticValues?.focus_pulse_progress != null) {
          return <FocusPulseOverlay layer={layer} pulseProgress={semanticValues.focus_pulse_progress}>{wrapped}</FocusPulseOverlay>;
        }
        return wrapped;
      }
      // Selection overlay
      if (semanticValues?.selection_start != null && semanticValues?.selection_end != null) {
        return <SelectionOverlay content={layer.content || ''} selectionStart={semanticValues.selection_start} selectionEnd={semanticValues.selection_end} layer={layer} style={fillStyle} />;
      }
      // Timeline-driven typewriter
      if (semanticValues?.text_chars != null) {
        const totalChars = (layer.content || '').length;
        return <TextLayer layer={layer} style={fillStyle} entrance={{ mode: 'typewriter', progress: totalChars > 0 ? semanticValues.text_chars / totalChars : 1 }} semanticValues={semanticValues} />;
      }
      if (textChars != null) {
        const totalChars = (layer.content || '').length;
        return <TextLayer layer={layer} style={fillStyle} entrance={{ mode: 'typewriter', progress: totalChars > 0 ? textChars / totalChars : 1 }} />;
      }
      let textResult = <TextLayer layer={layer} style={fillStyle} entrance={{ mode: 'style', opacity: 1, filter: 'none', transform: 'none' }} semanticValues={semanticValues} />;
      if (semanticValues?.focus_pulse_progress != null) {
        textResult = <FocusPulseOverlay layer={layer} pulseProgress={semanticValues.focus_pulse_progress}>{textResult}</FocusPulseOverlay>;
      }
      return textResult;
    }
    case 'html': {
      // List renderer: driven by list_*_progress semantic values
      if (layer.list_items && semanticValues && (semanticValues.list_insert_progress != null || semanticValues.list_remove_progress != null || semanticValues.list_reorder_progress != null)) {
        const listResult = <ListRenderer layer={layer} semanticValues={semanticValues} style={fillStyle} />;
        if (semanticValues.focus_pulse_progress != null) {
          return <FocusPulseOverlay layer={layer} pulseProgress={semanticValues.focus_pulse_progress}>{listResult}</FocusPulseOverlay>;
        }
        return listResult;
      }
      // Menu renderer: driven by menu_open_progress semantic values
      if (layer.menu_items && semanticValues && semanticValues.menu_open_progress != null) {
        return <MenuRenderer layer={layer} semanticValues={semanticValues} style={fillStyle} />;
      }
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
    }
    case 'svg':
      return renderSvgContent(layer, fillStyle);
    case 'card_conveyor':
      return <CardConveyorLayer layer={layer} />;
    case 'stack_fan_settle':
      return <StackFanSettleLayer layer={layer} />;
    case 'chart_build_explain':
      return <ChartBuildExplainLayer layer={layer} />;
    case 'spotlight_cursor_reveal':
      return <SpotlightCursorRevealLayer layer={layer} />;
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

// ── Editorial Canvas helpers ──────────────────────────────────────────────────

/**
 * Resolve anchor string to CSS positioning properties.
 * Maps named anchors (e.g., "center", "top-left") to absolute positioning.
 */
const ANCHOR_CSS = {
  'center':        { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  'top-left':      { top: '0', left: '0', transform: 'none' },
  'top-center':    { top: '0', left: '50%', transform: 'translateX(-50%)' },
  'top-right':     { top: '0', right: '0', transform: 'none' },
  'center-left':   { top: '50%', left: '0', transform: 'translateY(-50%)' },
  'center-right':  { top: '50%', right: '0', transform: 'translateY(-50%)' },
  'bottom-left':   { bottom: '0', left: '0', transform: 'none' },
  'bottom-center': { bottom: '0', left: '50%', transform: 'translateX(-50%)' },
  'bottom-right':  { bottom: '0', right: '0', transform: 'none' },
};

/**
 * resolveEditorialLayout — Computes positioned layer styles for editorial canvas mode.
 *
 * Each layer gets absolute positioning based on its anchor, max_w, and z_bias.
 * Returns array of { layer, style } objects ready for rendering.
 *
 * @param {object} scene - Scene definition with canvas and layers
 * @param {object[]} layers - Resolved layer array
 * @returns {{ layer: object, style: object }[]}
 */
export function resolveEditorialLayout(scene, layers) {
  const baseZIndex = 10;

  return layers.map((layer, index) => {
    const anchor = layer.anchor || 'center';
    const anchorCSS = ANCHOR_CSS[anchor] || ANCHOR_CSS['center'];

    // Resolve max_w: number → pixels, string → percentage
    let maxWidth = undefined;
    if (layer.max_w != null) {
      maxWidth = typeof layer.max_w === 'number' ? `${layer.max_w}px` : layer.max_w;
    }

    // z_bias adds to visual stacking without affecting depth_class parallax
    const zBias = layer.z_bias || 0;
    const zIndex = baseZIndex + index + zBias;

    const style = {
      position: 'absolute',
      ...anchorCSS,
      zIndex,
      ...(maxWidth ? { maxWidth } : {}),
    };

    return { layer, style };
  });
}

/**
 * Get safe zone inset style from canvas config.
 * safe_zone is a percentage (0-30) applied as padding.
 */
function getEditorialSafeZoneStyle(canvas) {
  const safeZone = canvas?.safe_zone || 0;
  return {
    position: 'absolute',
    inset: 0,
    padding: safeZone > 0 ? `${safeZone}%` : undefined,
  };
}

/**
 * Resolve canvas.background_treatment to CSS background value.
 * Works alongside resolveSceneBackground for editorial canvases.
 */
function resolveEditorialBackground(canvas, existingBackground) {
  const treatment = canvas?.background_treatment;
  if (!treatment || treatment === 'solid') return existingBackground;

  const bg = canvas.background_color || '#0a0a0a';
  const bgAlt = canvas.background_color_alt || '#1a1a1a';

  switch (treatment) {
    case 'gradient':
      return `linear-gradient(180deg, ${bg} 0%, ${bgAlt} 100%)`;
    case 'radial':
      return `radial-gradient(ellipse at center, ${bgAlt} 0%, ${bg} 70%)`;
    case 'mesh':
      // Approximation of mesh gradient using multiple radial layers
      return `radial-gradient(ellipse at 20% 30%, ${bgAlt} 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, ${bgAlt} 0%, transparent 50%), ${bg}`;
    case 'blur_plate':
      return existingBackground;
    default:
      return existingBackground;
  }
}

/**
 * EditorialCanvasLayer — Renders a single layer within editorial canvas mode.
 *
 * Applies editorial-specific anchor positioning and constraints, then delegates
 * to LayerContent for the actual media rendering. This ensures ALL layer types
 * (video, image, text, html, svg, compound) honor editorial canvas layout.
 */
const EditorialCanvasLayer = ({ layer, editorialStyle, assets, frame, fps }) => {
  const parallaxFactor = getParallaxFactor(layer.depth_class);
  const entrance = resolveEntranceAnimation(layer, frame, fps, { parallaxFactor });

  const combinedStyle = {
    ...editorialStyle,
    opacity: entrance.opacity,
    filter: entrance.filter,
    // Compose editorial anchor transform with entrance transform
    transform: editorialStyle.transform !== 'none'
      ? `${editorialStyle.transform} ${entrance.transform}`
      : entrance.transform,
    mixBlendMode: layer.blend_mode || 'normal',
    overflow: 'hidden',
  };

  // Text layers use their own component for typography features
  if (layer.type === 'text') {
    return <TextLayer layer={layer} style={combinedStyle} entrance={entrance} />;
  }

  // All other layer types render through LayerContent inside the editorial wrapper
  return (
    <div style={combinedStyle}>
      <LayerContent layer={layer} assets={assets} frame={frame} fps={fps} />
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
