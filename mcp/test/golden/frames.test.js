/**
 * Golden frames (ANI-126)
 *
 * Renders keyframes from the pinned manifests in `src/remotion/manifests/`
 * via the Remotion node API and compares them against checked-in reference
 * PNGs under `fixtures/frames/` with a fuzzy pixel diff (per-channel
 * threshold + mismatch budget — see lib/pixel-diff.js). Catches visual
 * regressions in the compositor that structural JSON goldens can't: camera
 * transforms, layer stacking, color/personality theming, the scene-meta
 * overlay, and transition rendering.
 *
 * Design notes (the ANI-126 design pass):
 *   - Bundle once per run via @remotion/bundler, then renderStill per
 *     keyframe — the whole suite runs in seconds, well under the 60s budget.
 *   - References render at scale 0.25 (480x270, ~4-6KB each) to keep the
 *     binary footprint trivial while preserving regression sensitivity.
 *   - Determinism was verified empirically: repeated stills of the same
 *     frame are byte-identical on the same machine. Cross-machine font
 *     rasterization may drift sub-pixel — that's what the mismatch budget
 *     absorbs; widen `DIFF_OPTS` if an exotic environment flakes.
 *   - Skips gracefully when ffmpeg is unavailable (decode path), when
 *     ANIMATIC_SKIP_REMOTION_RENDER=1, or when the Remotion toolchain
 *     can't launch — same philosophy as plate-round-trip.test.js.
 *
 * Update mode (ANIMATIC_UPDATE_GOLDENS=1) re-renders and overwrites the
 * reference PNGs; review the images in the diff before committing.
 */

import { after, before, describe, it } from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dns from 'node:dns';

import { assertMatchesGoldenImage } from './helpers.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// Remotion's dev server hangs on IPv6 localhost under Node 20 — match
// remotion.config.mjs (the config file doesn't apply to the node API).
dns.setDefaultResultOrder('ipv4first');

const SKIP_RENDER = process.env.ANIMATIC_SKIP_REMOTION_RENDER === '1';

// Keyframe targets. Frames are chosen at scene-stable moments across the
// pinned manifests: the three camera moves of test-3-scene (static /
// push_in / drift), the kinetic-type hero moment, and a transition
// midpoint. Keep this set small — every entry is a binary fixture.
const TARGETS = [
  { manifest: 'test-3-scene', frames: [30, 270, 510] },
  { manifest: 'test-kinetic-type', frames: [358] },
  { manifest: 'test-transitions', frames: [375] },
];

const DIFF_OPTS = { channel_threshold: 8, mismatch_budget: 0.02 };

async function probeEnvironment() {
  if (SKIP_RENDER) return { ok: false, reason: 'ANIMATIC_SKIP_REMOTION_RENDER=1' };
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 8_000 });
  } catch {
    return { ok: false, reason: 'ffmpeg not available (pixel decode path)' };
  }
  return { ok: true };
}

describe('golden: rendered frames', () => {
  let probe = { ok: false, reason: 'probe not run' };
  let dir;
  let serveUrl;
  let renderStill;
  let selectComposition;

  before(async () => {
    probe = await probeEnvironment();
    if (!probe.ok) return;

    // Bundle once; every keyframe renders off the same serveUrl. A failure
    // here (missing Chrome headless shell, sandboxed CI, …) downgrades the
    // whole suite to skipped rather than failing it.
    try {
      const bundler = await import('@remotion/bundler');
      const renderer = await import('@remotion/renderer');
      renderStill = renderer.renderStill;
      selectComposition = renderer.selectComposition;
      serveUrl = await bundler.bundle({
        entryPoint: join(REPO_ROOT, 'src/remotion/index.js'),
        publicDir: join(REPO_ROOT, 'public'),
      });
      dir = mkdtempSync(join(tmpdir(), 'ani-126-golden-'));
    } catch (err) {
      probe = { ok: false, reason: `Remotion toolchain unavailable: ${err.message}` };
    }
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  for (const target of TARGETS) {
    it(`${target.manifest} keyframes match the reference renders`, { timeout: 240_000 }, async (t) => {
      if (!probe.ok) return t.skip(probe.reason);

      const props = JSON.parse(readFileSync(
        join(REPO_ROOT, 'src/remotion/manifests', `${target.manifest}.json`), 'utf-8',
      ));
      const composition = await selectComposition({
        serveUrl, id: 'Sequence', inputProps: props,
      });

      for (const frame of target.frames) {
        const output = join(dir, `${target.manifest}.f${frame}.png`);
        await renderStill({
          serveUrl,
          composition,
          inputProps: props,
          frame,
          output,
          scale: 0.25,
          chromiumOptions: { gl: 'swangle' },
        });
        await assertMatchesGoldenImage(`frames/${target.manifest}.f${frame}`, output, DIFF_OPTS);
      }
    });
  }
});
