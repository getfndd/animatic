/**
 * Sonic-cue mix builder + deterministic placement (ANI-189).
 *
 * Synthetic cue files (empty placeholders — resolveSonicCues only checks
 * existence; the ffmpeg runner is injected so contents never matter). Proves:
 * anchor placement + offsets, not_configured vs missing_file, the ffmpeg arg
 * shape (both base-audio branches + the late-cue apad), and the realizeAudioPolicy
 * integration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveSonicCues, muxSonicCuesIntoRender } from '../lib/sonic-cues.js';
import { buildSonicCueMixArgs } from '../lib/audio-mix.js';
import { realizeAudioPolicy } from '../lib/master-audio.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

// timeline: sc_open [0, 3000); sc_mid start 3000-400=2600 dur 4000; sc_close start 6600 dur 3000 → total 9600.
function manifest() {
  return {
    sequence_id: 'seq_t', fps: 60, format: { aspect_ratio: '16:9' },
    audio: { src: 'audio/bed.mp3' },
    scenes: [
      { scene: 'sc_open', duration_s: 3 },
      { scene: 'sc_mid', duration_s: 4, transition_in: { type: 'crossfade', duration_ms: 400 } },
      { scene: 'sc_close', duration_s: 3, transition_in: { type: 'hard_cut', duration_ms: 0 } },
    ],
  };
}
const sceneDefs = {
  sc_open: { scene_id: 'sc_open' },
  sc_mid: { scene_id: 'sc_mid', interaction_truth: { has_state_change: true } },
  sc_close: { scene_id: 'sc_close', product_role: 'cta', metadata: { intent_tags: ['closing'] } },
};

/** A brand with all three cues pointing at existing temp files (absolute paths). */
function brandWithCues(dir) {
  const mk = (name) => { const p = join(dir, name); writeFileSync(p, ''); return p; };
  return { brand_id: 'test-brand', audio: { sonic_cues: { logo_sting: mk('sting.wav'), transition_whoosh: mk('whoosh.wav'), ui_click: mk('click.wav') } } };
}

// ── resolution + placement ───────────────────────────────────────────────────

describe('resolveSonicCues — placement (ANI-189)', () => {
  it('places each cue type at its deterministic anchor + offset', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani189-'));
    try {
      const { available, placed, skipped } = resolveSonicCues({ brand: brandWithCues(dir), manifest: manifest(), sceneDefs });
      assert.deepEqual(available.sort(), ['logo_sting', 'transition_whoosh', 'ui_click']);
      assert.equal(skipped.length, 0);

      const byType = (t) => placed.filter(p => p.type === t);
      // logo_sting → the closing scene start (sc_close @ 6600)
      assert.deepEqual(byType('logo_sting').map(p => [p.scene_id, p.offset_ms]), [['sc_close', 6600]]);
      // transition_whoosh → each transition boundary (sc_mid @ 2600, sc_close @ 6600)
      assert.deepEqual(byType('transition_whoosh').map(p => [p.scene_id, p.offset_ms]), [['sc_mid', 2600], ['sc_close', 6600]]);
      // ui_click → the state-change scene (sc_mid @ 2600), labeled honestly
      assert.deepEqual(byType('ui_click').map(p => [p.scene_id, p.offset_ms, p.placement]), [['sc_mid', 2600, 'scene_start_state_change']]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('logo_sting falls back to the LAST scene when no closing signal exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani189-'));
    try {
      const brand = brandWithCues(dir);
      const plain = { sc_open: {}, sc_mid: {}, sc_close: {} }; // no closing signal anywhere
      const { placed } = resolveSonicCues({ brand, manifest: manifest(), sceneDefs: plain });
      const logo = placed.find(p => p.type === 'logo_sting');
      assert.equal(logo.scene_id, 'sc_close', 'falls back to the final scene');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads the closing signal from BOTH top-level and metadata fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani189-'));
    try {
      const brand = brandWithCues(dir);
      // closing signalled via top-level product_role on the MIDDLE scene
      const defs = { sc_open: {}, sc_mid: { product_role: 'cta' }, sc_close: {} };
      const { placed } = resolveSonicCues({ brand, manifest: manifest(), sceneDefs: defs });
      assert.equal(placed.find(p => p.type === 'logo_sting').scene_id, 'sc_mid');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('distinguishes not_configured (null/absent) from missing_file (path set, file absent)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani189-'));
    try {
      const presentLogo = join(dir, 'sting.wav'); writeFileSync(presentLogo, '');
      const brand = {
        brand_id: 'test-brand',
        audio: { sonic_cues: {
          logo_sting: presentLogo,                 // configured + exists → placed
          transition_whoosh: null,                  // null → not_configured (normal)
          ui_click: join(dir, 'does-not-exist.wav'),// configured + missing → missing_file
        } },
      };
      const { available, placed, skipped } = resolveSonicCues({ brand, manifest: manifest(), sceneDefs });
      assert.deepEqual(available, ['logo_sting', 'ui_click'], 'available = configured (non-null) cue types');
      assert.ok(placed.every(p => p.type === 'logo_sting'), 'only the present cue is placed');
      const reasonOf = (t) => skipped.find(s => s.type === t)?.reason;
      assert.equal(reasonOf('transition_whoosh'), 'not_configured');
      assert.equal(reasonOf('ui_click'), 'missing_file');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a brand with no audio block leaves every cue not_configured (normal state)', () => {
    const { available, placed, skipped } = resolveSonicCues({ brand: { brand_id: 'mercury' }, manifest: manifest(), sceneDefs });
    assert.deepEqual(available, []);
    assert.equal(placed.length, 0);
    assert.ok(skipped.every(s => s.reason === 'not_configured'));
  });
});

// ── buildSonicCueMixArgs (pure) ──────────────────────────────────────────────

describe('buildSonicCueMixArgs (ANI-189)', () => {
  const cues = [{ path: 'a.wav', offset_ms: 1000 }, { path: 'b.wav', offset_ms: 9400 }];

  it('with base audio: pads the base to FULL picture duration so a late cue is not dropped', () => {
    const args = buildSonicCueMixArgs({ videoPath: 'in.mp4', cues, outputPath: 'out.mp4', hasBaseAudio: true, videoDurationMs: 9600 });
    const fc = args[args.indexOf('-filter_complex') + 1];
    assert.match(fc, /\[1:a\]adelay=1000:all=1\[c0\]/);
    assert.match(fc, /\[2:a\]adelay=9400:all=1\[c1\]/, 'the late cue (9.4s) is delayed, not dropped');
    assert.match(fc, /\[0:a\]apad=whole_dur=9\.6\[base\]/, 'base padded to the full 9.6s picture (P1)');
    assert.match(fc, /\[base\]\[c0\]\[c1\]amix=inputs=3:duration=longest:normalize=0\[out\]/);
    const j = args.join(' ');
    assert.match(j, /-map 0:v/);
    assert.match(j, /-map \[out\]/);
    assert.match(j, /-c:v copy -c:a aac out\.mp4$/);
    assert.ok(!args.includes('-shortest'), 'never -shortest (must not truncate the picture)');
  });

  it('without base audio: cues-only amix, video mapped through', () => {
    const args = buildSonicCueMixArgs({ videoPath: 'in.mp4', cues, outputPath: 'out.mp4', hasBaseAudio: false });
    const fc = args[args.indexOf('-filter_complex') + 1];
    assert.doesNotMatch(fc, /apad/, 'no base to pad');
    assert.match(fc, /\[c0\]\[c1\]amix=inputs=2:duration=longest:normalize=0\[out\]/);
    assert.ok(args.includes('0:v') && args.includes('[out]'));
  });

  it('requires videoDurationMs when hasBaseAudio (else late cues could be capped)', () => {
    assert.throws(() => buildSonicCueMixArgs({ videoPath: 'in.mp4', cues, outputPath: 'out.mp4', hasBaseAudio: true }), /videoDurationMs/);
  });
});

// ── muxSonicCuesIntoRender + realizeAudioPolicy integration ──────────────────────

describe('sonic cues — realize (execute, injected ffmpeg)', () => {
  it('muxSonicCuesIntoRender builds the cue args and renames the temp over the master', async () => {
    const calls = [];
    const renames = [];
    const { args } = await muxSonicCuesIntoRender({
      videoPath: '/p/master.mp4',
      cues: [{ path: 'x.wav', offset_ms: 500 }],
      videoDurationMs: 4000, hasBaseAudio: true,
      exec: async (a) => calls.push(a), rename: async (from, to) => renames.push([from, to]),
    });
    assert.equal(calls.length, 1);
    assert.match(args.join(' '), /adelay=500/);
    assert.deepEqual(renames, [['/p/master.sonic-cues.mp4', '/p/master.mp4']]);
  });

  it('realizeAudioPolicy full-mix mixes resolved cues onto the master (realized:true)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani189-'));
    try {
      const calls = [];
      const a = await realizeAudioPolicy({
        artifact: { manifest: manifest(), sceneDefs },
        masterMp4Rel: join('masters', 'T4', 'primary', 'encode', 'master.mp4'),
        projectRoot: dir, policy: 'full-mix', brand: brandWithCues(dir), dryRun: false,
        // no voiceover in these scenes → no TTS; only the cue mux runs.
        exec: async (args) => calls.push(args), rename: async () => {},
      });
      assert.equal(a.sonic_cues.realized, true);
      assert.equal(a.sonic_cues.placed.length, 4); // logo×1 + whoosh×2 + click×1
      // the cue mix ran (adelay present); it is NOT the ducking graph
      const cueCall = calls.find(c => c.join(' ').includes('adelay'));
      assert.ok(cueCall, 'a cue-mix ffmpeg call ran');
      assert.ok(!cueCall.join(' ').includes('sidechaincompress'), 'cue mix is its own pass, not the duck');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('realizeAudioPolicy full-mix dry-run plans cues without mixing (realized:false, no exec)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani189-'));
    try {
      let execCalled = false;
      const a = await realizeAudioPolicy({
        artifact: { manifest: manifest(), sceneDefs },
        masterMp4Rel: join('masters', 'T4', 'primary', 'encode', 'master.mp4'),
        projectRoot: dir, policy: 'full-mix', brand: brandWithCues(dir), dryRun: true,
        exec: async () => { execCalled = true; },
      });
      assert.equal(a.sonic_cues.realized, false);
      assert.equal(a.sonic_cues.placed.length, 4, 'placements resolved in the plan');
      assert.equal(execCalled, false, 'dry-run never spawns ffmpeg');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
