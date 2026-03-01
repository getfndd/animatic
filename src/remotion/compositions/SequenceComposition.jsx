import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
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
export const SequenceComposition = ({ manifest, sceneDefs = {} }) => {
  const { fps } = useVideoConfig();
  const scenes = manifest.scenes || [];

  // Calculate frame layout — each scene's start frame and duration,
  // accounting for transition overlap with the next scene.
  const layout = calculateLayout(scenes, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {layout.map(({ entry, index, startFrame, durationFrames, nextTransition, nextTransitionFrames }) => {
        const sceneDef = sceneDefs[entry.scene] || createPlaceholderScene(entry, index);
        const sceneWithOverrides = {
          ...sceneDef,
          ...(entry.camera_override
            ? { camera: { ...sceneDef.camera, ...entry.camera_override } }
            : {}),
        };

        const transition = entry.transition_in || { type: 'hard_cut' };
        const transitionDurationMs = transition.duration_ms ?? getDefaultTransitionDuration(transition.type);
        const transitionFrames = Math.round((transitionDurationMs / 1000) * fps);

        return (
          <Sequence key={entry.scene + '-' + index} from={startFrame} durationInFrames={durationFrames}>
            {/* Outgoing transition wrapper (handles exit during overlap with next scene) */}
            <TransitionOutWrapper
              transition={nextTransition}
              transitionFrames={nextTransitionFrames}
              sceneFrames={durationFrames}
            >
              {/* Incoming transition wrapper (handles entrance from previous scene) */}
              <TransitionWrapper transition={transition} transitionFrames={transitionFrames}>
                <SceneComposition scene={sceneWithOverrides} />
              </TransitionWrapper>
            </TransitionOutWrapper>

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
