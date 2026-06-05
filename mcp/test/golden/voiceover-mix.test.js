/**
 * Golden voiceover mix (ANI-129)
 *
 * Locks the full render-time voiceover plan for a fixture manifest: which
 * clips get synthesized (mock provider — deterministic word-count
 * durations), the exact ffmpeg command that assembles the timeline track,
 * and the exact ducked-mux command that attaches it to the render. Catches
 * drift in scene-offset math, the adelay/amix graph, and the sidechain
 * ducking parameters that unit tests on individual builders miss.
 *
 * Paths are normalized (temp project root → `<project>`) so the snapshot
 * is machine-independent.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  muxVoiceoverIntoRender,
  planVoiceoverClips,
  prepareVoiceoverTrack,
  renderHasEmbeddedAudio,
} from '../../lib/voiceover-mix.js';
import { assertMatchesGolden } from './helpers.js';

// Fixture mirrors the ANI-111 acceptance shape: narrated scenes around a
// silent one, a transition overlap that shifts downstream offsets, and a
// manifest-level music bed (ANI-106) that must duck under the narration.
const MANIFEST = {
  sequence_id: 'ani-129-voiceover-fixture',
  audio: { src: 'music/bed.mp3', volume: 0.8 },
  scenes: [
    { scene: 'sc_intro', duration_s: 4 },
    { scene: 'sc_feature', duration_s: 6, transition_in: { duration_ms: 600 } },
    { scene: 'sc_quiet', duration_s: 3 },
    { scene: 'sc_close', duration_s: 5, transition_in: { duration_ms: 400 } },
  ],
};

const SCENE_DEFS = {
  sc_intro: {
    scene_id: 'sc_intro',
    voiceover: { text: 'Meet the fastest way to ship animated product stories.' },
  },
  sc_feature: {
    scene_id: 'sc_feature',
    voiceover: { text: 'Every scene is choreographed from a single manifest, with timing the engine guarantees.', speed: 1.1 },
  },
  sc_quiet: { scene_id: 'sc_quiet' },
  sc_close: {
    scene_id: 'sc_close',
    voiceover: { text: 'Render once. Deliver everywhere.' },
  },
};

/** Replace the machine-specific project root in any string with a token. */
function normalize(value, projectRoot) {
  return JSON.parse(
    JSON.stringify(value).replaceAll(projectRoot, '<project>'),
  );
}

describe('golden: voiceover mix plan', () => {
  it('fixture manifest produces the expected clips + ffmpeg commands', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ani-129-golden-'));
    try {
      const commands = [];
      const exec = async (args) => { commands.push(args); };

      const clips = planVoiceoverClips(MANIFEST, SCENE_DEFS);
      const track = await prepareVoiceoverTrack({ clips, projectRoot, provider: 'mock', exec });
      assert.equal(track.error, undefined);

      const mux = await muxVoiceoverIntoRender({
        videoPath: join(projectRoot, 'renders/draft/fixture-render.mp4'),
        trackPath: track.track,
        hasEmbeddedAudio: renderHasEmbeddedAudio(MANIFEST),
        exec,
        rename: async () => {},
      });

      assertMatchesGolden('voiceover/ani-129-fixture.mix', normalize({
        clips: track.clips,
        track: track.track_relative,
        ducked: mux.ducked,
        commands,
      }, projectRoot));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
