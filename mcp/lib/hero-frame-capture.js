/**
 * Hero Frame Capture (ANI-178)
 *
 * Renders the single still that a scene declares as its poster frame, so the
 * hero-frame scorer judges *real pixels* — not a metadata guess. This is the
 * evidence half of the contract: without a rendered frame, the composition and
 * aesthetic axes stay UNVERIFIED and the gate fails closed at higher tiers.
 *
 * Why the `Scene` composition (not `Sequence`):
 *   A poster frame is a property of the scene's own composition, not of the
 *   transition blending into it. Root.jsx exposes a dedicated `Scene`
 *   composition that renders one scene definition in isolation and derives its
 *   duration from `scene.duration_s` (fps 60). Rendering that at `at·duration`
 *   gives the exact frame the contract names, with no global-timeline offset
 *   math and — critically — no placeholder path: `SequenceComposition` silently
 *   substitutes a grey placeholder for an unresolved scene id (line 65), but the
 *   `Scene` composition takes the scene object directly, so a missing/empty
 *   scene simply isn't rendered (we return no-evidence instead of scoring junk).
 *
 * Capture reuses the proven golden-frames approach (mcp/test/golden/frames.test.js):
 * bundle once via @remotion/bundler, then renderStill per frame. Remotion is
 * dynamically imported inside the async functions so this module stays load-safe
 * for the rest of the MCP server (no Remotion/React at import time).
 *
 * Honors ANIMATIC_SKIP_REMOTION_RENDER=1 and degrades to null (→ metadata-only)
 * whenever the toolchain (headless Chrome, ffmpeg) can't launch — same
 * graceful-skip philosophy as the golden suite.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const SCENE_FPS = 60; // The `Scene` composition is pinned to 60fps in Root.jsx.

// Remotion's dev server hangs on IPv6 localhost under Node 20 — match
// remotion.config.mjs (the config file doesn't apply to the node API).
dns.setDefaultResultOrder('ipv4first');

/**
 * Map a normalized hero-frame position to an absolute frame index within a
 * single scene's isolated timeline. Pure — exported for testing without a render.
 *
 * @param {object} scene - Scene definition (uses `duration_s`).
 * @param {number} at - Normalized position 0..1.
 * @returns {number} Frame index, clamped to [0, durationInFrames - 1].
 */
export function heroFrameIndex(scene, at) {
  const durationS = scene?.duration_s || 3;
  const durationInFrames = Math.max(1, Math.round(durationS * SCENE_FPS));
  const pos = Number.isFinite(at) ? Math.min(1, Math.max(0, at)) : 0.6;
  return Math.min(durationInFrames - 1, Math.max(0, Math.round(pos * durationInFrames)));
}

/**
 * Whether real rendering is even possible in this environment. Cheap check
 * callers can use to decide between the rendered and metadata-only paths.
 */
export function isCaptureAvailable() {
  return process.env.ANIMATIC_SKIP_REMOTION_RENDER !== '1';
}

/**
 * Open a capture session: bundle the Remotion project once and open one browser,
 * then capture many stills against it (an audit renders one frame per scene).
 * Always close() — it tears down the shared browser and temp dir.
 *
 * @returns {Promise<{ capture: (function), close: (function) } | null>} null when
 *   the toolchain is unavailable (caller should fall back to metadata-only).
 */
export async function openHeroCaptureSession({ scale = 0.5 } = {}) {
  if (!isCaptureAvailable()) return null;

  let bundler, renderer, serveUrl, browser, dir;
  try {
    bundler = await import('@remotion/bundler');
    renderer = await import('@remotion/renderer');
    serveUrl = await bundler.bundle({
      entryPoint: join(REPO_ROOT, 'src/remotion/index.js'),
      publicDir: join(REPO_ROOT, 'public'),
    });
    dir = mkdtempSync(join(tmpdir(), 'ani-178-hero-'));
    browser = await renderer.openBrowser('chrome');
  } catch (err) {
    // Toolchain can't launch (no headless shell, sandbox denies listen, …) —
    // degrade to no-evidence rather than throwing into the gate.
    if (browser) { try { await browser.close(); } catch { /* noop */ } }
    if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ } }
    return { unavailable: true, reason: err.message, capture: async () => null, close: async () => {} };
  }

  let counter = 0;
  const capture = async (scene, at = 0.6) => {
    // Hard guard: never render a scene with no layers — there's nothing to
    // compose, and a blank frame must not be scored as if it were the scene.
    if (!scene?.layers?.length) return null;
    const frame = heroFrameIndex(scene, at);
    const output = join(dir, `hero-${counter++}.png`);
    try {
      const composition = await renderer.selectComposition({
        serveUrl, id: 'Scene', inputProps: { scene }, puppeteerInstance: browser,
      });
      await renderer.renderStill({
        serveUrl,
        composition,
        inputProps: { scene },
        frame,
        output,
        scale,
        chromiumOptions: { gl: 'swangle' },
        puppeteerInstance: browser,
      });
      const data = readFileSync(output).toString('base64');
      return { media_type: 'image/png', data, frame, scale };
    } catch (err) {
      return { error: err.message };
    }
  };

  const close = async () => {
    if (browser) { try { await browser.close(); } catch { /* noop */ } }
    if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ } }
  };

  return { capture, close };
}

/**
 * Capture one scene's hero still. Convenience wrapper that opens a session,
 * renders a single frame, and tears down. For multi-scene audits prefer
 * openHeroCaptureSession() so the bundle/browser are reused.
 *
 * @param {object} params
 * @param {object} params.scene - Scene definition (must have layers).
 * @param {number} [params.at=0.6] - Normalized hero position.
 * @param {number} [params.scale=0.5] - Render scale.
 * @returns {Promise<{ media_type, data, frame, scale } | null>} null/no-evidence
 *   when the toolchain is unavailable or the scene has no layers.
 */
export async function captureHeroStill({ scene, at = 0.6, scale = 0.5 } = {}) {
  const session = await openHeroCaptureSession({ scale });
  if (!session || session.unavailable) return null;
  try {
    const result = await session.capture(scene, at);
    return result && !result.error ? result : null;
  } finally {
    await session.close();
  }
}
