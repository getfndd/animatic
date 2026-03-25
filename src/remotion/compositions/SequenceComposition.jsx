import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig, interpolate, staticFile } from 'remotion';
import { SceneComposition } from './SceneComposition.jsx';
import { TransitionWrapper, TransitionOutWrapper } from './transitions.jsx';
import { getDefaultTransitionDuration, calculateLayout } from '../lib.js';

/**
 * SequenceComposition — Renders a sequence manifest (multi-scene video).
 *
 * Implements the sequence manifest spec (docs/cinematography/specs/sequence-manifest.md):
 * - Ordered scene playback via absolute Remotion <Sequence> components
 * - Hard cuts, crossfade, and whip-wipe transitions
 * - Scene overlap during transitions (both scenes render simultaneously)
 * - Duration calculation accounting for transition overlaps
 *
 * @param {object} props
 * @param {object} props.manifest - Sequence manifest JSON
 * @param {object} props.sceneDefs - Scene definitions keyed by scene_id
 */
export const SequenceComposition = ({ manifest, sceneDefs = {}, timelines = {} }) => {
  const { fps } = useVideoConfig();
  const scenes = manifest.scenes || [];

  // Calculate frame layout — each scene's start frame and duration,
  // accounting for transition overlap with the next scene.
  const layout = calculateLayout(scenes, fps);

  // Calculate total frames for global audio fade-out
  const totalFrames = layout.length > 0
    ? layout[layout.length - 1].startFrame + layout[layout.length - 1].durationFrames
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: manifest.background || '#0a0a0a' }}>
      {/* Global background audio track */}
      {manifest.audio?.src && (
        <Audio
          src={staticFile(manifest.audio.src)}
          volume={(f) => {
            const vol = manifest.audio.volume ?? 1;
            const fadeInMs = manifest.audio.fade_in_ms ?? 0;
            const fadeOutMs = manifest.audio.fade_out_ms ?? 0;
            const fadeInFrames = Math.round((fadeInMs / 1000) * fps);
            const fadeOutFrames = Math.round((fadeOutMs / 1000) * fps);

            let v = vol;
            if (fadeInFrames > 0 && f < fadeInFrames) {
              v = interpolate(f, [0, fadeInFrames], [0, vol], { extrapolateRight: 'clamp' });
            }
            if (fadeOutFrames > 0 && f > totalFrames - fadeOutFrames) {
              v = interpolate(f, [totalFrames - fadeOutFrames, totalFrames], [vol, 0], { extrapolateLeft: 'clamp' });
            }
            return v;
          }}
          startFrom={Math.round((manifest.audio.offset_s || 0) * fps)}
        />
      )}

      {layout.map(({ entry, index, startFrame, durationFrames, nextTransition, nextTransitionFrames }) => {
        const sceneDef = sceneDefs[entry.scene] || createPlaceholderScene(entry, index);
        const sceneWithOverrides = {
          ...sceneDef,
          ...(entry.camera_override
            ? { camera: { ...sceneDef.camera, ...entry.camera_override } }
            : {}),
          ...(entry.shot_grammar
            ? { shot_grammar: entry.shot_grammar }
            : {}),
        };

        const transition = entry.transition_in || { type: 'hard_cut' };
        const transitionDurationMs = transition.duration_ms ?? getDefaultTransitionDuration(transition.type);
        const transitionFrames = Math.round((transitionDurationMs / 1000) * fps);

        // Resolve continuity match geometry for match-cut transitions
        const matchGeometry = resolveMatchGeometry(transition, index, scenes, sceneDefs);

        return (
          <Sequence key={entry.scene + '-' + index} from={startFrame} durationInFrames={durationFrames}>
            {/* Outgoing transition wrapper (handles exit during overlap with next scene) */}
            <TransitionOutWrapper
              transition={nextTransition}
              transitionFrames={nextTransitionFrames}
              sceneFrames={durationFrames}
            >
              {/* Incoming transition wrapper (handles entrance from previous scene) */}
              <TransitionWrapper transition={transition} transitionFrames={transitionFrames} matchGeometry={matchGeometry}>
                <SceneComposition scene={sceneWithOverrides} timeline={timelines[entry.scene] || null} />
              </TransitionWrapper>
            </TransitionOutWrapper>

            {/* Per-scene audio clip */}
            {entry.audio?.src && (
              <Audio
                src={staticFile(entry.audio.src)}
                volume={entry.audio.volume ?? 1}
                startFrom={Math.round((entry.audio.offset_s || 0) * fps)}
              />
            )}

            <SceneLabel
              sceneId={entry.scene}
              index={index}
              total={scenes.length}
              durationS={entry.duration_s || 3}
              transitionType={transition.type}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Creates a placeholder scene when no scene definition file is provided.
 */
function createPlaceholderScene(entry, index) {
  const colors = [
    '#1a1a2e', '#16213e', '#0f3460', '#1a0a2e',
    '#2e1a1a', '#1a2e1a', '#2e2e1a', '#1a2e2e',
  ];
  const bg = colors[index % colors.length];

  return {
    scene_id: entry.scene,
    duration_s: entry.duration_s || 3,
    camera: entry.camera_override || { move: 'static' },
    layers: [
      {
        id: 'placeholder-bg',
        type: 'html',
        depth_class: 'background',
        content: `<div style="width:100%;height:100%;background:${bg}"></div>`,
      },
      {
        id: 'placeholder-label',
        type: 'html',
        depth_class: 'foreground',
        content: `
          <div style="
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            width:100%;height:100%;font-family:sans-serif;color:white;
          ">
            <div style="font-size:48px;font-weight:700;margin-bottom:8px">${entry.scene}</div>
            <div style="font-size:18px;opacity:0.5">Shot ${index + 1} &middot; ${entry.duration_s || 3}s</div>
          </div>
        `,
      },
    ],
  };
}

/**
 * Resolve continuity match geometry from transition_in.match config.
 *
 * Looks up the source layer (in previous scene) and target layer (in current scene)
 * by continuity_id, extracts their position data, and returns geometry that
 * TransitionWrapper can use for match-cut transitions.
 *
 * @returns {{ strategy: string, sourcePosition?: object, targetPosition?: object, originX?: string, originY?: string } | null}
 */
function resolveMatchGeometry(transition, sceneIndex, scenes, sceneDefs) {
  const match = transition?.match;
  if (!match || sceneIndex === 0) return null;

  const prevEntry = scenes[sceneIndex - 1];
  const prevDef = sceneDefs[prevEntry?.scene];
  const currEntry = scenes[sceneIndex];
  const currDef = sceneDefs[currEntry?.scene];
  if (!prevDef?.layers || !currDef?.layers) return null;

  const sourceCid = match.source_continuity_id;
  const targetCid = match.target_continuity_id || sourceCid;

  const sourceLayer = prevDef.layers.find(l => l.continuity_id === sourceCid);
  const targetLayer = currDef.layers.find(l => l.continuity_id === targetCid);
  if (!sourceLayer && !targetLayer) return null;

  const geo = { strategy: match.strategy || 'scale' };

  // Extract position/size from layers if available
  if (sourceLayer?.position) geo.sourcePosition = sourceLayer.position;
  if (targetLayer?.position) geo.targetPosition = targetLayer.position;

  // Compute transform-origin from source layer center (for scale transitions)
  if (sourceLayer?.position) {
    const sp = sourceLayer.position;
    const cx = (sp.x || 0) + (sp.w || 1920) / 2;
    const cy = (sp.y || 0) + (sp.h || 1080) / 2;
    geo.originX = `${cx}px`;
    geo.originY = `${cy}px`;
  }

  return geo;
}

/**
 * Development overlay showing scene metadata.
 */
const SceneLabel = ({ sceneId, index, total, durationS, transitionType }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        background: 'rgba(0,0,0,0.6)',
        color: 'rgba(255,255,255,0.7)',
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: 'monospace',
        opacity: fadeIn,
        pointerEvents: 'none',
      }}
    >
      {index + 1}/{total} {'\u00b7'} {sceneId} {'\u00b7'} {durationS}s
      {transitionType !== 'hard_cut' && ` {'\u00b7'} ${transitionType}`}
    </div>
  );
};
