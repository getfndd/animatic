import { Composition, continueRender, delayRender, staticFile } from 'remotion';
import { SceneComposition } from './compositions/SceneComposition.jsx';
import { SequenceComposition } from './compositions/SequenceComposition.jsx';
import { calculateDuration } from './lib.js';

// ── Vendored Satoshi (ANI-115) ───────────────────────────────────────────────
// Load the vendored font faces before Remotion starts rendering frames. Any
// scene that declares `fontFamily: 'Satoshi'` would otherwise render with a
// system-ui fallback because Remotion's Chromium doesn't hit the network for
// external CSS at render time. `font-display: block` in the vendored CSS
// and this delayRender handshake together ensure the real glyphs ship.
const SATOSHI_WEIGHTS = [
  { weight: '400', file: 'Satoshi-Regular.woff2' },
  { weight: '500', file: 'Satoshi-Medium.woff2' },
  { weight: '700', file: 'Satoshi-Bold.woff2' },
  { weight: '900', file: 'Satoshi-Black.woff2' },
];

if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
  const waitHandle = delayRender('Loading Satoshi (ANI-115)');
  Promise.all(
    SATOSHI_WEIGHTS.map((w) => {
      const face = new FontFace(
        'Satoshi',
        `url(${staticFile(`fonts/satoshi/${w.file}`)}) format('woff2')`,
        { weight: w.weight, style: 'normal', display: 'block' },
      );
      return face.load().then((loaded) => {
        document.fonts.add(loaded);
      });
    }),
  )
    .then(() => continueRender(waitHandle))
    .catch((err) => {
      // Fail loudly rather than silently render with system-ui. The error
      // message is picked up by Remotion's render output so misconfigurations
      // (missing font file, wrong path) are surfaced instead of shipped.
      console.error('Failed to load vendored Satoshi font:', err);
      continueRender(waitHandle);
    });
}

// Preview props — loaded by scripts/preview.mjs for live project preview.
// Falls back to defaults if the file doesn't exist.
let previewProps = null;
try {
  previewProps = require('./preview-props.json');
} catch {
  // No preview props — use defaults
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
      {/* Single scene — renders one scene definition to video.
       *
       * The calculateMetadata callback derives duration from props.scene.duration_s
       * so the composition length matches the scene definition.
       */}
      <Composition
        id="Scene"
        component={SceneComposition}
        calculateMetadata={({ props }) => {
          const fps = 60;
          const durationS = props.scene?.duration_s || 3;
          return {
            durationInFrames: Math.round(durationS * fps),
            fps,
          };
        }}
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
        defaultProps={previewProps ? {
          manifest: previewProps.manifest,
          sceneDefs: previewProps.sceneDefs || {},
          timelines: previewProps.timelines || {},
          sceneRoutes: previewProps.sceneRoutes || {},
        } : {
          manifest: {
            sequence_id: 'seq_test',
            fps: 60,
            resolution: { w: 1920, h: 1080 },
            scenes: [
              { scene: 'sc_test_a', duration_s: 3 },
              { scene: 'sc_test_b', duration_s: 3 },
              { scene: 'sc_test_c', duration_s: 4 },
            ],
            audio: null,
          },
          sceneDefs: {},
          timelines: {},
        }}
      />
    </>
  );
};
