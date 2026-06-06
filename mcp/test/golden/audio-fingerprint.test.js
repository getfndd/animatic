/**
 * Golden audio fingerprints (ANI-127)
 *
 * Runs deterministic sine-tone inputs through the real audio pipeline and
 * compares compact waveform fingerprints against checked-in references
 * under `fixtures/audio/`. Coverage:
 *
 *   1. Voiceover timeline track  — adelay/amix graph (ANI-111/129)
 *   2. Ducked post-render mux    — sidechain compression actually
 *                                  attenuates the bed under narration (ANI-129)
 *   3. Delivery profile encodes  — web-hero (aac/48k) and master
 *                                  (pcm_s24le in MOV): the ANI-106
 *                                  codec-per-profile path
 *   4. email-gif `-an`           — silent container (no audio stream)
 *
 * Inputs are generated on the fly via lavfi (inputs-only: no audio
 * binaries in the repo; mock TTS WAVs are silent, so tones are the
 * fingerprintable stand-in). Skips gracefully when ffmpeg is unavailable
 * — same pattern as plate-round-trip.test.js. Comparison uses
 * `assertMatchesGoldenApprox`: lossy codecs are not bit-stable across
 * encoder versions, so numeric leaves drift within keyed tolerances.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { buildDuckedMuxArgs, buildVoiceoverTrackArgs } from '../../lib/audio-mix.js';
import { buildFfmpegArgs, getDeliveryProfile } from '../../lib/delivery-profiles.js';
import { countAudioStreams, fingerprintAudioFile } from '../../lib/audio-fingerprint.js';
import { assertMatchesGoldenApprox } from './helpers.js';

const execFileAsync = promisify(execFile);

// Tolerances absorb codec / encoder-version variance without masking real
// regressions: a broken filter graph or codec swap moves RMS by far more
// than 1.5 dB and band ratios by far more than 0.08.
const TOLERANCES = {
  rms_db: 1.5,
  centroid_hz: 100,
  bands: 0.08,
  duration_s: 0.2,
};

async function ffmpeg(args, cwd) {
  await execFileAsync('ffmpeg', args, { cwd, timeout: 120_000 });
}

async function probeFfmpeg() {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-encoders'], { timeout: 8_000 });
    if (!stdout.includes('libx264')) return { ok: false, reason: 'ffmpeg missing libx264 encoder' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'ffmpeg not available' };
  }
}

describe('golden: audio waveform fingerprints', () => {
  let probe = { ok: false, reason: 'probe not run' };
  let dir;

  before(async () => {
    probe = await probeFfmpeg();
    if (!probe.ok) return;

    dir = mkdtempSync(join(tmpdir(), 'ani-127-golden-'));

    // Deterministic inputs. Two narration tones (distinct bands) + a low
    // "music bed" tone + a tiny test video carrying the bed as embedded audio.
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2',
      '-ar', '22050', '-ac', '1', 'vo_a.wav'], dir);
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=1760:duration=1.5',
      '-ar', '22050', '-ac', '1', 'vo_b.wav'], dir);
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=8',
      '-af', 'volume=-6dB', '-ar', '22050', '-ac', '1', 'music.wav'], dir);
    await ffmpeg(['-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=8:size=160x120:rate=12',
      '-i', 'music.wav',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'render.mp4'], dir);

    // Frames for the delivery-profile encodes (buildFfmpegArgs takes a
    // frame pattern, mirroring the real frames → profile pipeline).
    await ffmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc=duration=6:size=160x120:rate=2',
      'frame_%06d.png'], dir);
  });

  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('voiceover timeline track (adelay/amix)', { timeout: 120_000 }, async (t) => {
    if (!probe.ok) return t.skip(probe.reason);

    // Clip A at 0s, clip B at 4s — the gap second must fingerprint as silence.
    await ffmpeg(buildVoiceoverTrackArgs({
      clips: [
        { path: 'vo_a.wav', offset_ms: 0 },
        { path: 'vo_b.wav', offset_ms: 4000 },
      ],
      outputPath: 'track.wav',
    }), dir);

    const fp = await fingerprintAudioFile(join(dir, 'track.wav'));
    assertMatchesGoldenApprox('audio/voiceover-track.fingerprint', fp, TOLERANCES);
  });

  it('ducked post-render mux attenuates the bed under narration', { timeout: 120_000 }, async (t) => {
    if (!probe.ok) return t.skip(probe.reason);

    await ffmpeg(buildDuckedMuxArgs({
      videoPath: 'render.mp4',
      voiceoverPath: 'track.wav',
      outputPath: 'ducked.mp4',
    }), dir);

    const fp = await fingerprintAudioFile(join(dir, 'ducked.mp4'));
    assertMatchesGoldenApprox('audio/ducked-mux.fingerprint', fp, TOLERANCES);

    // Behavioral check independent of the golden: the bed-only stretch
    // (t=6, after both narration clips end) must sit measurably below a
    // narrated second (t=0). Catches a sidechain graph that silently
    // stopped compressing even if fixtures are regenerated blindly.
    const voiced = fp.seconds.find(s => s.t === 0);
    const bedOnly = fp.seconds.find(s => s.t === 6);
    assert.ok(voiced && bedOnly, 'fingerprint must cover t=0 and t=6');
    assert.ok(voiced.rms_db > bedOnly.rms_db + 3,
      `narrated second (${voiced.rms_db} dB) should sit well above bed-only (${bedOnly.rms_db} dB)`);
  });

  it('web-hero delivery encode (aac 48k) preserves the mix', { timeout: 120_000 }, async (t) => {
    if (!probe.ok) return t.skip(probe.reason);

    const profile = getDeliveryProfile('web-hero');
    await ffmpeg(buildFfmpegArgs(profile, 'frame_%06d.png', 'web-hero.mp4', {
      audioInput: 'track.wav',
    }), dir);

    const fp = await fingerprintAudioFile(join(dir, 'web-hero.mp4'));
    assertMatchesGoldenApprox('audio/web-hero.fingerprint', fp, TOLERANCES);
  });

  it('master delivery encode (pcm_s24le / prores) preserves the mix', { timeout: 120_000 }, async (t) => {
    if (!probe.ok) return t.skip(probe.reason);

    const profile = getDeliveryProfile('master');
    await ffmpeg(buildFfmpegArgs(profile, 'frame_%06d.png', 'master.mov', {
      audioInput: 'track.wav',
    }), dir);

    const fp = await fingerprintAudioFile(join(dir, 'master.mov'));
    assertMatchesGoldenApprox('audio/master.fingerprint', fp, TOLERANCES);
  });

  it('profiles without audio produce a silent container (-an)', { timeout: 120_000 }, async (t) => {
    if (!probe.ok) return t.skip(probe.reason);

    // email-gif's own encode goes through gifski externally, so exercise the
    // -an decision through a video profile with no audioInput — the same
    // code path that guards email-gif (audio: null) in buildFfmpegArgs.
    const profile = getDeliveryProfile('web-embed');
    await ffmpeg(buildFfmpegArgs(profile, 'frame_%06d.png', 'silent.mp4'), dir);
    assert.equal(await countAudioStreams(join(dir, 'silent.mp4')), 0);

    // And the with-audio variant of the same profile must carry exactly one.
    await ffmpeg(buildFfmpegArgs(profile, 'frame_%06d.png', 'with-audio.mp4', {
      audioInput: 'track.wav',
    }), dir);
    assert.equal(await countAudioStreams(join(dir, 'with-audio.mp4')), 1);
  });
});
