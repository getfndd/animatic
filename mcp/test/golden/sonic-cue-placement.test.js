/**
 * Sonic-cue placement, rendered (ANI-191, deepens ANI-189).
 *
 * ANI-189 proves cue placement via deterministic `adelay` offsets on the ffmpeg
 * args (no ffmpeg). This renders the real mix through `buildSonicCueMixArgs` and
 * fingerprints it (ANI-127 harness) to prove the cues actually LAND at their
 * offsets — energy AND the cue's frequency band rise at the placed second, and
 * the between-cue second stays bed-only.
 *
 * Deterministic lavfi inputs (no audio binaries in the repo). Skips gracefully
 * when ffmpeg is unavailable — same pattern as the audio-fingerprint goldens.
 * Needs only audio mixing (adelay/amix/apad), so a libass-less ffmpeg is fine.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { buildSonicCueMixArgs } from '../../lib/audio-mix.js';
import { fingerprintAudioFile } from '../../lib/audio-fingerprint.js';

const execFileAsync = promisify(execFile);
const ffmpeg = (args, cwd) => execFileAsync('ffmpeg', args, { cwd, timeout: 120_000 });

async function probeFfmpeg() {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-encoders'], { timeout: 8_000 });
    if (!stdout.includes('libx264')) return { ok: false, reason: 'ffmpeg missing libx264 encoder' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'ffmpeg not available' };
  }
}

// Fingerprint bands (8 kHz harness): [0-250] [250-1000] [1000-2500] [2500-4000].
const BED_BAND = 0;    // 220 Hz bed
const LOGO_BAND = 2;   // 1200 Hz logo sting → 1000-2500
const CLICK_BAND = 3;  // 3500 Hz ui click  → 2500-4000

const CUE1_S = 1;  // logo sting at 1.0 s
const CUE2_S = 4;  // ui click  at 4.0 s
const BED_S = 2;   // between the cues — bed only

describe('golden: sonic-cue placement (rendered)', () => {
  let probe = { ok: false, reason: 'probe not run' };
  let dir;

  before(async () => {
    probe = await probeFfmpeg();
    if (!probe.ok) return;
    dir = mkdtempSync(join(tmpdir(), 'ani-191-'));

    // A 6 s base video carrying a quiet 220 Hz bed as embedded audio (so the
    // master has base audio to mix the cues onto).
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc=duration=6:size=160x120:rate=12',
      '-f', 'lavfi', '-i', 'sine=frequency=220:duration=6',
      '-af', 'volume=-22dB', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'base.mp4'], dir);
    // Two short, distinct, full-level cues.
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=1200:duration=0.5', '-ar', '22050', '-ac', '1', 'logo.wav'], dir);
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=3500:duration=0.5', '-ar', '22050', '-ac', '1', 'click.wav'], dir);

    // Mix via the REAL ANI-189 builder, placing each cue at its offset.
    await ffmpeg(buildSonicCueMixArgs({
      videoPath: 'base.mp4',
      cues: [{ path: 'logo.wav', offset_ms: CUE1_S * 1000 }, { path: 'click.wav', offset_ms: CUE2_S * 1000 }],
      outputPath: 'mixed.mp4',
      hasBaseAudio: true,
      videoDurationMs: 6000,
    }), dir);
  });

  after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('each cue lands at its placed second — energy + its frequency band rise; the gap stays bed-only', { timeout: 120_000 }, async (t) => {
    if (!probe.ok) return t.skip(probe.reason);

    const fp = await fingerprintAudioFile(join(dir, 'mixed.mp4'));
    const at = (sec) => fp.seconds.find(s => s.t === sec);
    const cue1 = at(CUE1_S), cue2 = at(CUE2_S), bed = at(BED_S);
    assert.ok(cue1 && cue2 && bed, 'fingerprint covers the cue + bed seconds');

    // 1) Energy rises at each placed second versus the bed-only gap.
    assert.ok(cue1.rms_db > bed.rms_db + 3, `logo second louder than the gap (${cue1.rms_db.toFixed(1)} vs ${bed.rms_db.toFixed(1)} dB)`);
    assert.ok(cue2.rms_db > bed.rms_db + 3, `click second louder than the gap (${cue2.rms_db.toFixed(1)} vs ${bed.rms_db.toFixed(1)} dB)`);

    // 2) The RIGHT cue lands at the RIGHT second — its frequency band dominates
    //    there but is quiet in the bed-only gap.
    assert.ok(cue1.bands[LOGO_BAND] > 0.25, `logo (1.2 kHz) band present at ${CUE1_S}s (${cue1.bands[LOGO_BAND].toFixed(2)})`);
    assert.ok(cue1.bands[LOGO_BAND] > bed.bands[LOGO_BAND] + 0.15, 'logo band rises at its second vs the gap');
    assert.ok(cue2.bands[CLICK_BAND] > 0.25, `click (3.5 kHz) band present at ${CUE2_S}s (${cue2.bands[CLICK_BAND].toFixed(2)})`);
    assert.ok(cue2.bands[CLICK_BAND] > bed.bands[CLICK_BAND] + 0.15, 'click band rises at its second vs the gap');

    // 3) The gap second is the quiet 220 Hz bed (low band dominates, cue bands quiet)
    //    — proves the cues are LOCALIZED at their offsets, not smeared across.
    assert.ok(bed.bands[BED_BAND] > bed.bands[LOGO_BAND] && bed.bands[BED_BAND] > bed.bands[CLICK_BAND], 'gap second is bed-dominated');
    assert.ok(bed.bands[CLICK_BAND] < 0.2, 'no click energy in the gap second');
  });
});
