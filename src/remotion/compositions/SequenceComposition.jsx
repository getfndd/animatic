import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { SceneComposition } from './SceneComposition.jsx';

/**
 * SequenceComposition — Renders a sequence manifest (multi-scene video).
 *
 * Implements the sequence manifest spec (docs/cinematography/specs/sequence-manifest.md):
 * - Ordered scene playback via Remotion <Series>
 * - Hard cuts (instant scene swap)
 * - Duration per scene (converted from seconds to frames)
 *
 * Transitions (crossfade, whip) are placeholders — implemented in ANI-17.
 *
 * @param {object} props
 * @param {object} props.manifest - Sequence manifest JSON
 * @param {object} props.sceneDefs - Scene definitions keyed by scene_id
 */
export const SequenceComposition = ({ manifest, sceneDefs = {} }) => {
  const { fps } = useVideoConfig();
  const scenes = manifest.scenes || [];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <Series>
        {scenes.map((entry, index) => {
          const durationS = entry.duration_s || 3;
          const durationFrames = Math.round(durationS * fps);

          // Look up scene definition, or create a placeholder
          const sceneDef = sceneDefs[entry.scene] || createPlaceholderScene(entry, index);

          // Apply camera override from manifest if present
          const sceneWithOverrides = {
            ...sceneDef,
            ...(entry.camera_override
              ? { camera: { ...sceneDef.camera, ...entry.camera_override } }
              : {}),
          };

          return (
            <Series.Sequence key={entry.scene + '-' + index} durationInFrames={durationFrames}>
              <SceneComposition scene={sceneWithOverrides} />
              {/* Scene label overlay (development only) */}
              <SceneLabel
                sceneId={entry.scene}
                index={index}
                total={scenes.length}
                durationS={durationS}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

/**
 * Creates a placeholder scene when no scene definition file is provided.
 * Shows the scene_id and index for development/testing.
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
 * Development overlay showing scene ID and position in sequence.
 * Will be removed or made togglable in production.
 */
const SceneLabel = ({ sceneId, index, total, durationS }) => {
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
      {index + 1}/{total} &middot; {sceneId} &middot; {durationS}s
    </div>
  );
};
