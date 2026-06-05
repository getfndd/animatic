/**
 * Voiceover render glue (ANI-129).
 *
 * Exercises the plan → synthesize → track → mux flow with the `mock` TTS
 * provider and a captured-args fake ffmpeg runner, so no ffmpeg binary is
 * required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  defaultTtsProvider,
  muxVoiceoverIntoRender,
  planVoiceoverClips,
  prepareVoiceoverTrack,
  renderHasEmbeddedAudio,
  VOICEOVER_DIR,
} from '../lib/voiceover-mix.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const MANIFEST = {
  scenes: [
    { scene: 'sc_01', duration_s: 4 },
    { scene: 'sc_02', duration_s: 5, transition_in: { duration_ms: 500 } },
    { scene: 'sc_03', duration_s: 3 },
  ],
};

const SCENE_DEFS = {
  sc_01: { scene_id: 'sc_01', voiceover: { text: 'Welcome to the product.' } },
  sc_02: { scene_id: 'sc_02' }, // silent scene
  sc_03: { scene_id: 'sc_03', voiceover: { text: 'Get started today.' } },
};

function fakeExec() {
  const commands = [];
  const exec = async (args) => { commands.push(args); };
  return { exec, commands };
}

// ── planVoiceoverClips ──────────────────────────────────────────────────────

describe('planVoiceoverClips', () => {
  it('pairs speaking scenes with transition-aware offsets', () => {
    const clips = planVoiceoverClips(MANIFEST, SCENE_DEFS);
    assert.equal(clips.length, 2);
    assert.equal(clips[0].scene_id, 'sc_01');
    assert.equal(clips[0].offset_ms, 0);
    // sc_03 starts after sc_01 (4000ms) + sc_02 (5000ms starting at 3500ms
    // due to its 500ms transition overlap) → 8500ms.
    assert.equal(clips[1].scene_id, 'sc_03');
    assert.equal(clips[1].offset_ms, 8500);
  });

  it('returns empty when no scene speaks', () => {
    const clips = planVoiceoverClips(MANIFEST, { sc_01: {}, sc_02: {}, sc_03: {} });
    assert.deepEqual(clips, []);
  });

  it('ignores manifest scenes with no loaded definition', () => {
    const clips = planVoiceoverClips(MANIFEST, { sc_01: SCENE_DEFS.sc_01 });
    assert.equal(clips.length, 1);
  });
});

// ── renderHasEmbeddedAudio ──────────────────────────────────────────────────

describe('renderHasEmbeddedAudio', () => {
  it('detects a manifest-level music bed', () => {
    assert.equal(renderHasEmbeddedAudio({ ...MANIFEST, audio: { src: 'music.mp3' } }), true);
  });

  it('detects per-scene audio clips', () => {
    const manifest = {
      scenes: [{ scene: 'sc_01', duration_s: 4, audio: { src: 'whoosh.wav' } }],
    };
    assert.equal(renderHasEmbeddedAudio(manifest), true);
  });

  it('is false for a silent render', () => {
    assert.equal(renderHasEmbeddedAudio(MANIFEST), false);
  });
});

// ── prepareVoiceoverTrack ───────────────────────────────────────────────────

describe('prepareVoiceoverTrack', () => {
  it('synthesizes clips and builds a timeline-aligned track', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ani-129-'));
    try {
      const { exec, commands } = fakeExec();
      const clips = planVoiceoverClips(MANIFEST, SCENE_DEFS);
      const result = await prepareVoiceoverTrack({ clips, projectRoot, provider: 'mock', exec });

      assert.equal(result.error, undefined);
      assert.equal(result.clips.length, 2);
      assert.equal(result.clips[0].path_relative, `${VOICEOVER_DIR}/sc_01.wav`);
      assert.equal(result.clips[1].offset_ms, 8500);
      // Mock provider writes real (silent) WAVs to disk.
      assert.ok(existsSync(result.clips[0].path));
      assert.equal(result.track_relative, `${VOICEOVER_DIR}/voiceover-track.wav`);

      // One ffmpeg invocation: the adelay+amix track build.
      assert.equal(commands.length, 1);
      const graph = commands[0][commands[0].indexOf('-filter_complex') + 1];
      assert.match(graph, /adelay=8500:all=1/);
      assert.match(graph, /amix=inputs=2/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('names clips by the resolved clip id when scene JSON lacks scene_id', async () => {
    // renderProject keys sceneDefs by `sceneData.scene_id || entry.id` — a
    // scene file without its own scene_id is valid. Regression: these clips
    // all collided on `undefined.wav` while the report claimed per-scene
    // paths, duplicating narration in the final mix.
    const projectRoot = mkdtempSync(join(tmpdir(), 'ani-129-'));
    try {
      const { exec, commands } = fakeExec();
      const sceneDefs = {
        sc_01: { voiceover: { text: 'First line.' } },   // no scene_id field
        sc_02: { voiceover: { text: 'Second line.' } },  // no scene_id field
      };
      const manifest = {
        scenes: [
          { scene: 'sc_01', duration_s: 3 },
          { scene: 'sc_02', duration_s: 3 },
        ],
      };
      const clips = planVoiceoverClips(manifest, sceneDefs);
      const result = await prepareVoiceoverTrack({ clips, projectRoot, provider: 'mock', exec });

      assert.equal(result.error, undefined);
      assert.ok(existsSync(join(projectRoot, VOICEOVER_DIR, 'sc_01.wav')));
      assert.ok(existsSync(join(projectRoot, VOICEOVER_DIR, 'sc_02.wav')));
      assert.equal(existsSync(join(projectRoot, VOICEOVER_DIR, 'undefined.wav')), false);
      // The track build references both distinct files.
      const args = commands[0];
      assert.ok(args.includes(join(projectRoot, VOICEOVER_DIR, 'sc_01.wav')));
      assert.ok(args.includes(join(projectRoot, VOICEOVER_DIR, 'sc_02.wav')));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('fails hard when a clip fails to synthesize', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ani-129-'));
    try {
      const { exec, commands } = fakeExec();
      const clips = [{
        scene_id: 'sc_01',
        offset_ms: 0,
        scene: { scene_id: 'sc_01', voiceover: { text: 'hi', provider: 'no_such_provider' } },
      }];
      const result = await prepareVoiceoverTrack({ clips, projectRoot, provider: 'mock', exec });
      assert.match(result.error, /sc_01/);
      assert.equal(commands.length, 0); // no ffmpeg spend on a broken track
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('throws on missing inputs', async () => {
    await assert.rejects(() => prepareVoiceoverTrack({ clips: [] }));
  });
});

// ── muxVoiceoverIntoRender ──────────────────────────────────────────────────

describe('muxVoiceoverIntoRender', () => {
  it('plain-muxes into a silent render and renames over the original', async () => {
    const { exec, commands } = fakeExec();
    const renames = [];
    const result = await muxVoiceoverIntoRender({
      videoPath: '/proj/renders/draft/demo.mp4',
      trackPath: '/proj/audio/voiceover/voiceover-track.wav',
      hasEmbeddedAudio: false,
      exec,
      rename: async (from, to) => { renames.push([from, to]); },
    });

    assert.equal(result.ducked, false);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].includes('-filter_complex'), false); // plain mux
    assert.deepEqual(renames, [[
      '/proj/renders/draft/demo.voiceover-mix.mp4',
      '/proj/renders/draft/demo.mp4',
    ]]);
  });

  it('ducks the embedded audio when the render carries a music bed', async () => {
    const { exec, commands } = fakeExec();
    const result = await muxVoiceoverIntoRender({
      videoPath: '/proj/renders/draft/demo.mp4',
      trackPath: '/proj/audio/voiceover/voiceover-track.wav',
      hasEmbeddedAudio: true,
      exec,
      rename: async () => {},
    });

    assert.equal(result.ducked, true);
    const graph = commands[0][commands[0].indexOf('-filter_complex') + 1];
    assert.match(graph, /sidechaincompress/);
  });

  it('throws on missing inputs', async () => {
    await assert.rejects(() => muxVoiceoverIntoRender({ videoPath: 'x.mp4' }));
  });
});

// ── defaultTtsProvider ──────────────────────────────────────────────────────

describe('defaultTtsProvider', () => {
  it('uses macos_say on darwin, mock elsewhere', () => {
    assert.equal(defaultTtsProvider('darwin'), 'macos_say');
    assert.equal(defaultTtsProvider('linux'), 'mock');
  });
});
