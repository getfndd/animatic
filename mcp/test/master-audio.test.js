/**
 * Per-tier audio-mix realization (ANI-188).
 *
 * realizeAudioPolicy turns the master profile's audio_policy into an actual
 * assembled track: muted (T1) → nothing; muted-autoplay (T2) → embedded bed,
 * muted; mix (T3) → VO ducked under the bed + captions sidecar @48k; full-mix
 * (T4) → same + sonic cues RESOLVED-but-DEFERRED. Dry-run plans only — no TTS,
 * no ffmpeg, no writes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { realizeAudioPolicy } from '../lib/master-audio.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

function sceneVO(id) {
  return { scene_id: id, duration_s: 4, layers: [{ id: 'card', type: 'html', content: '<div>x</div>' }], voiceover: { text: 'Hello from the narrator.' } };
}
function sceneCaptioned(id) {
  return { scene_id: id, duration_s: 4, layers: [{ id: 'card', type: 'html', content: '<div>x</div>' }], captions: [{ text: 'A caption', start_ms: 0, end_ms: 1500 }] };
}
function scenePlain(id) {
  return { scene_id: id, duration_s: 4, layers: [{ id: 'card', type: 'html', content: '<div>x</div>' }] };
}
function manifest(ids, { bed = false } = {}) {
  return {
    sequence_id: 'seq_t', fps: 60, format: { aspect_ratio: '16:9' },
    ...(bed ? { audio: { src: 'audio/bed.mp3', volume: 0.6 } } : {}),
    scenes: ids.map((id, i) => i === 0 ? { scene: id, duration_s: 4 } : { scene: id, duration_s: 4 }),
  };
}
const artifact = (ids, opts, sceneFn = sceneVO) => ({ manifest: manifest(ids, opts), sceneDefs: Object.fromEntries(ids.map(id => [id, sceneFn(id)])) });

const REL = join('masters', 'T3', 'primary', 'encode', 'master.mp4');

// ── muted / muted-autoplay (no post-mix) ─────────────────────────────────────────

describe('realizeAudioPolicy — muted tiers', () => {
  it('muted (T1): no audio track, no captions', async () => {
    const a = await realizeAudioPolicy({ artifact: artifact(['sc_a'], {}, scenePlain), masterMp4Rel: REL, projectRoot: '/tmp/x', policy: 'muted', dryRun: true });
    assert.equal(a.policy, 'muted');
    assert.equal(a.track, null);
    assert.equal(a.captions, null);
  });

  it('muted-autoplay (T2): keeps the embedded bed, plays muted, no mux', async () => {
    const a = await realizeAudioPolicy({ artifact: artifact(['sc_a'], { bed: true }, scenePlain), masterMp4Rel: REL, projectRoot: '/tmp/x', policy: 'muted-autoplay', dryRun: true });
    assert.equal(a.muted_default, true);
    assert.equal(a.bed_embedded, true);
    assert.equal(a.track, null);
  });
});

// ── mix / full-mix dry-run plans (no TTS, no ffmpeg) ─────────────────────────────

describe('realizeAudioPolicy — mix/full-mix plans (dry)', () => {
  it('mix (T3) with VO over a bed: plans a DUCKED VO mux @48k, no synthesis', async () => {
    const a = await realizeAudioPolicy({ artifact: artifact(['sc_a'], { bed: true }), masterMp4Rel: REL, projectRoot: '/tmp/x', policy: 'mix', dryRun: true });
    assert.equal(a.voiceover.mux, 'ducked');
    assert.equal(a.voiceover.sample_rate, 48000);
    assert.equal(a.voiceover.muxed, false);
    assert.equal(a.voiceover.will_synthesize, 1);
    assert.equal(a.realized, false);
  });

  it('mix (T3) with VO but no bed: plain mux (nothing to duck under)', async () => {
    const a = await realizeAudioPolicy({ artifact: artifact(['sc_a'], { bed: false }), masterMp4Rel: REL, projectRoot: '/tmp/x', policy: 'mix', dryRun: true });
    assert.equal(a.voiceover.mux, 'plain');
  });

  it('narrated master without authored captions flags the a11y gap (not silently captioned)', async () => {
    const a = await realizeAudioPolicy({ artifact: artifact(['sc_a']), masterMp4Rel: REL, projectRoot: '/tmp/x', policy: 'mix', dryRun: true });
    assert.equal(a.captions.written, false);
    assert.match(a.captions.reason, /no authored scene\.captions/);
  });

  it('full-mix (T4) with an unconfigured brand: cues not_configured, nothing realized (ANI-189)', async () => {
    // No audio.sonic_cues block ⇒ every cue is not_configured (normal brand state,
    // e.g. mercury) — distinct from a configured path whose file is missing.
    const a = await realizeAudioPolicy({ artifact: artifact(['sc_a'], { bed: true }), masterMp4Rel: REL, projectRoot: '/tmp/x', policy: 'full-mix', brand: { brand_id: 'mercury' }, dryRun: true });
    assert.deepEqual(a.sonic_cues.available, []);
    assert.equal(a.sonic_cues.placed.length, 0);
    assert.ok(a.sonic_cues.skipped.every(s => s.reason === 'not_configured'), 'unset cues are not_configured, not missing_file');
    assert.equal(a.sonic_cues.realized, false);
    assert.equal(a.sample_rate, 48000);
  });
});

// ── execute paths (real fs, injected ffmpeg) ─────────────────────────────────────

describe('realizeAudioPolicy — realize (execute)', () => {
  it('writes a VTT captions sidecar from authored scene.captions', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ani188-'));
    try {
      const rel = join('masters', 'T3', 'primary', 'encode', 'master.mp4');
      const a = await realizeAudioPolicy({ artifact: artifact(['sc_a'], {}, sceneCaptioned), masterMp4Rel: rel, projectRoot: root, policy: 'mix', dryRun: false });
      assert.equal(a.captions.written, true);
      assert.equal(a.captions.format, 'vtt');
      assert.ok(a.captions.cue_count >= 1);
      const sidecar = join(root, rel.replace(/\.mp4$/, '.vtt'));
      assert.ok(existsSync(sidecar), 'VTT sidecar written next to the master');
      assert.match(readFileSync(sidecar, 'utf-8'), /WEBVTT/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('synthesizes VO (mock) and ducks it into the master via the injected ffmpeg', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ani188-'));
    try {
      const rel = join('masters', 'T4', 'primary', 'encode', 'master.mp4');
      writeFileSync(join(root, 'placeholder.mp4'), 'x'); // stand-in; mux is injected
      const calls = [];
      const a = await realizeAudioPolicy({
        artifact: artifact(['sc_a'], { bed: true }), masterMp4Rel: rel, projectRoot: root,
        policy: 'full-mix', dryRun: false, ttsProvider: 'mock',
        exec: async (args) => { calls.push(args); }, rename: async () => {},
      });
      assert.equal(a.voiceover.muxed, true);
      assert.equal(a.voiceover.sample_rate, 48000);
      // Two ffmpeg invocations: the VO track build, then the ducked mux.
      assert.equal(calls.length, 2);
      const trackArgs = calls[0];
      assert.ok(trackArgs.includes('-ar') && trackArgs[trackArgs.indexOf('-ar') + 1] === '48000', 'VO track built at 48k');
      const muxArgs = calls[1];
      assert.ok(muxArgs.join(' ').includes('sidechaincompress'), 'bed is ducked under VO');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an unknown audio_policy', async () => {
    await assert.rejects(
      () => realizeAudioPolicy({ artifact: artifact(['sc_a']), masterMp4Rel: REL, projectRoot: '/tmp/x', policy: 'surround', dryRun: true }),
      /Unknown audio_policy/,
    );
  });
});
