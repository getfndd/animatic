/**
 * Captions (ANI-112) — tests for validation, manifest roll-up, serialization.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCaptions,
  computeSceneTimeline,
  collectManifestCaptions,
  toSrt,
  toVtt,
  buildCaptionsSidecar,
  activeCaptionAt,
} from '../lib/captions.js';

// ── Validation ──────────────────────────────────────────────────────────────

describe('validateCaptions', () => {
  it('accepts null / undefined without error', () => {
    assert.deepEqual(validateCaptions(null), []);
    assert.deepEqual(validateCaptions(undefined), []);
  });

  it('rejects non-array values', () => {
    assert.ok(validateCaptions('nope').length > 0);
    assert.ok(validateCaptions({}).length > 0);
  });

  it('accepts a well-formed cue list', () => {
    const errs = validateCaptions([
      { text: 'Hello', start_ms: 0, end_ms: 1000 },
      { text: 'World', start_ms: 1200, end_ms: 2400 },
    ], 3000);
    assert.deepEqual(errs, []);
  });

  it('flags missing text', () => {
    const errs = validateCaptions([{ text: '', start_ms: 0, end_ms: 1000 }]);
    assert.ok(errs.some(e => e.includes('text')));
  });

  it('flags start > end', () => {
    const errs = validateCaptions([{ text: 'x', start_ms: 1000, end_ms: 500 }]);
    assert.ok(errs.some(e => e.includes('end_ms')));
  });

  it('flags overlapping cues', () => {
    const errs = validateCaptions([
      { text: 'a', start_ms: 0, end_ms: 1500 },
      { text: 'b', start_ms: 1000, end_ms: 2000 },
    ]);
    assert.ok(errs.some(e => e.includes('overlaps')));
  });

  it('flags cues past scene duration', () => {
    const errs = validateCaptions(
      [{ text: 'x', start_ms: 0, end_ms: 5000 }],
      3000,
    );
    assert.ok(errs.some(e => e.includes('exceeds scene duration')));
  });
});

// ── Scene timeline ──────────────────────────────────────────────────────────

describe('computeSceneTimeline', () => {
  it('back-to-back scenes with no transitions', () => {
    const timeline = computeSceneTimeline({
      scenes: [
        { scene: 'sc_01', duration_s: 2 },
        { scene: 'sc_02', duration_s: 3 },
      ],
    });
    assert.deepEqual(timeline, [
      { scene_id: 'sc_01', start_ms: 0, duration_ms: 2000 },
      { scene_id: 'sc_02', start_ms: 2000, duration_ms: 3000 },
    ]);
  });

  it('accounts for transition_in overlap', () => {
    const timeline = computeSceneTimeline({
      scenes: [
        { scene: 'sc_01', duration_s: 2 },
        { scene: 'sc_02', duration_s: 3, transition_in: { duration_ms: 400 } },
      ],
    });
    assert.equal(timeline[1].start_ms, 1600); // 2000 - 400
  });

  it('ignores transition_in on the first scene', () => {
    const timeline = computeSceneTimeline({
      scenes: [
        { scene: 'sc_01', duration_s: 2, transition_in: { duration_ms: 400 } },
      ],
    });
    assert.equal(timeline[0].start_ms, 0);
  });
});

// ── Roll-up ─────────────────────────────────────────────────────────────────

describe('collectManifestCaptions', () => {
  it('offsets scene-local times by the scene start', () => {
    const manifest = {
      scenes: [
        { scene: 'sc_01', duration_s: 2 },
        { scene: 'sc_02', duration_s: 3 },
      ],
    };
    const sceneDefs = {
      sc_01: {
        captions: [{ text: 'Opening', start_ms: 0, end_ms: 1500 }],
      },
      sc_02: {
        captions: [{ text: 'Close', start_ms: 500, end_ms: 2000 }],
      },
    };
    const cues = collectManifestCaptions(manifest, sceneDefs);
    assert.equal(cues.length, 2);
    assert.equal(cues[0].start_ms, 0);
    assert.equal(cues[0].end_ms, 1500);
    assert.equal(cues[1].start_ms, 2500); // 2000 + 500
    assert.equal(cues[1].end_ms, 4000);   // 2000 + 2000
  });

  it('returns empty array when no scene has captions', () => {
    const cues = collectManifestCaptions(
      { scenes: [{ scene: 'sc_01', duration_s: 2 }] },
      { sc_01: {} },
    );
    assert.deepEqual(cues, []);
  });
});

// ── Serialization ───────────────────────────────────────────────────────────

describe('toSrt', () => {
  it('emits numbered cues with 00:00:00,000 timestamps', () => {
    const out = toSrt([
      { text: 'Line one', start_ms: 0, end_ms: 1500 },
      { text: 'Line two', start_ms: 2000, end_ms: 4500 },
    ]);
    assert.match(out, /^1\n00:00:00,000 --> 00:00:01,500\nLine one\n\n2\n00:00:02,000 --> 00:00:04,500\nLine two\n/);
  });

  it('formats hours correctly', () => {
    const out = toSrt([{ text: 'late', start_ms: 3_725_123, end_ms: 3_727_000 }]);
    assert.match(out, /01:02:05,123/);
  });
});

describe('toVtt', () => {
  it('emits a WEBVTT header and dot-separated millisecond timestamps', () => {
    const out = toVtt([{ text: 'hi', start_ms: 1234, end_ms: 5678 }]);
    assert.match(out, /^WEBVTT\n/);
    assert.match(out, /00:00:01\.234 --> 00:00:05\.678/);
  });
});

// ── buildCaptionsSidecar ────────────────────────────────────────────────────

describe('buildCaptionsSidecar', () => {
  const manifest = { scenes: [{ scene: 'sc_01', duration_s: 2 }] };
  const sceneDefs = {
    sc_01: { captions: [{ text: 'hello', start_ms: 0, end_ms: 1000 }] },
  };

  it('returns SRT by default', () => {
    const sidecar = buildCaptionsSidecar(manifest, sceneDefs);
    assert.equal(sidecar.extension, 'srt');
    assert.equal(sidecar.cue_count, 1);
    assert.match(sidecar.text, /00:00:00,000/);
  });

  it('returns VTT when requested', () => {
    const sidecar = buildCaptionsSidecar(manifest, sceneDefs, 'vtt');
    assert.equal(sidecar.extension, 'vtt');
    assert.match(sidecar.text, /^WEBVTT/);
  });

  it('returns empty text + cue_count 0 when no captions exist', () => {
    const sidecar = buildCaptionsSidecar(
      { scenes: [{ scene: 'sc_01', duration_s: 2 }] },
      { sc_01: {} },
    );
    assert.equal(sidecar.cue_count, 0);
    assert.equal(sidecar.text, '');
  });
});

// ── activeCaptionAt ─────────────────────────────────────────────────────────

describe('activeCaptionAt', () => {
  const cues = [
    { text: 'a', start_ms: 0, end_ms: 1000 },
    { text: 'b', start_ms: 1500, end_ms: 3000 },
  ];

  it('returns the cue active at time', () => {
    assert.equal(activeCaptionAt(cues, 500).text, 'a');
    assert.equal(activeCaptionAt(cues, 2000).text, 'b');
  });

  it('returns null during gaps', () => {
    assert.equal(activeCaptionAt(cues, 1200), null);
    assert.equal(activeCaptionAt(cues, 5000), null);
  });

  it('is exclusive at end boundary', () => {
    assert.equal(activeCaptionAt(cues, 1000), null);
  });
});
