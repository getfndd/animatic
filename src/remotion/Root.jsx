import { Composition } from 'remotion';
import { SceneComposition } from './compositions/SceneComposition.jsx';
import { SequenceComposition } from './compositions/SequenceComposition.jsx';

/**
 * Calculate total duration in frames from a sequence manifest.
 * Accounts for transition overlaps per the sequence manifest spec.
 */
function calculateDuration(manifest) {
  const fps = manifest.fps || 60;
  const scenes = manifest.scenes || [];

  const totalSeconds = scenes.reduce((sum, entry) => sum + (entry.duration_s || 3), 0);
  const transitionOverlap = scenes.reduce((sum, entry) => {
    const t = entry.transition_in;
    if (t && t.type !== 'hard_cut' && t.duration_ms) {
      return sum + t.duration_ms / 1000;
    }
    return sum;
  }, 0);

  return Math.ceil((totalSeconds - transitionOverlap) * fps);
}

/**
 * Remotion Root — registers all video compositions.
 *
 * Compositions are video templates that can be rendered via:
 *   npx remotion render <composition-id> output.mp4
 *   npx remotion render Sequence --props src/remotion/manifests/test-3-scene.json output.mp4
 *
 * Or previewed in the Remotion Studio:
 *   npx remotion studio
 */
export const RemotionRoot = () => {
  return (
    <>
      {/* Single scene — renders one scene definition to video */}
      <Composition
        id="Scene"
        component={SceneComposition}
        durationInFrames={180}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={{
          scene: {
            scene_id: 'sc_test',
            duration_s: 3,
            camera: { move: 'push_in', intensity: 0.3, easing: 'cinematic_scurve' },
            layers: [
              {
                id: 'bg',
                type: 'html',
                depth_class: 'background',
                content: '<div style="width:100%;height:100%;background:#0a0a0a"></div>',
              },
              {
                id: 'text',
                type: 'html',
                depth_class: 'foreground',
                content: '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:sans-serif;color:white;font-size:64px;font-weight:700">Scene Test</div>',
              },
            ],
          },
        }}
      />

      {/* Multi-scene sequence — renders a sequence manifest to video.
       *
       * Pass a manifest via --props:
       *   npx remotion render Sequence --props src/remotion/manifests/test-3-scene.json out.mp4
       *
       * The calculateMetadata callback dynamically computes duration, fps,
       * and resolution from the manifest props.
       */}
      <Composition
        id="Sequence"
        component={SequenceComposition}
        calculateMetadata={({ props }) => {
          const manifest = props.manifest;
          const fps = manifest.fps || 60;
          const resolution = manifest.resolution || { w: 1920, h: 1080 };
          return {
            durationInFrames: calculateDuration(manifest),
            fps,
            width: resolution.w,
            height: resolution.h,
          };
        }}
        durationInFrames={600}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={{
          manifest: {
            sequence_id: 'seq_test',
            fps: 60,
            resolution: { w: 1920, h: 1080 },
            scenes: [
              { scene: 'sc_test_a', duration_s: 3 },
              { scene: 'sc_test_b', duration_s: 3 },
              { scene: 'sc_test_c', duration_s: 4 },
            ],
          },
          sceneDefs: {},
        }}
      />
    </>
  );
};
