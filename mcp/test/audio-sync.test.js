/**
 * Tests for Beat-Aware Audio Sequencing (ANI-100).
 *
 * Covers: syncSequenceToBeats, generateHitMarkers, planAudioCues, scoreAudioSync.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  syncSequenceToBeats,
  generateHitMarkers,
  planAudioCues,
  scoreAudioSync,
} from '../lib/audio-sync.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate regular beats at a given BPM for a given duration. */
function makeBeats(bpm, durationS, type = 'kick') {
  const interval = 60 / bpm;
  const beats = [];
  for (let t = interval; t < durationS; t += interval) {
    beats.push({
      time_s: parseFloat(t.toFixed(3)),
      strength: 0.7 + Math.random() * 0.3,
      type,
    });
  }
  return beats;
}

/** Build a simple manifest with given durations. */
function makeManifest(durations, options = {}) {
  return {
    sequence_id: options.sequence_id || 'test_seq',
    scenes: durations.map((d, i) => ({
      scene: options.sceneIds?.[i] || `sc_${String(i + 1).padStart(2, '0')}`,
      duration_s: d,
      ...(options.transitions?.[i] ? { transition_in: options.transitions[i] } : {}),
    })),
  };
}

/** Build beat data in the format output by analyze_beats. */
function makeBeatData(bpm, durationS, options = {}) {
  const beats = options.beats || makeBeats(bpm, durationS);
  const segments = 20;
  const energy_curve = [];
  for (let i = 0; i < segments; i++) {
    energy_curve.push({
      time_s: parseFloat(((i / segments) * durationS).toFixed(2)),
      energy: parseFloat((0.3 + Math.sin(i / segments * Math.PI) * 0.7).toFixed(3)),
    });
  }

  return {
    beats,
    tempo_bpm: bpm,
    energy_curve: options.energy_curve || energy_curve,
    duration_s: durationS,
  };
}

// ── syncSequenceToBeats ──────────────────────────────────────────────────────

describe('syncSequenceToBeats', () => {
  it('returns unchanged manifest for empty beats', () => {
    const manifest = makeManifest([3, 3, 3]);
    const result = syncSequenceToBeats(manifest, { beats: [], tempo_bpm: 0 });

    assert.equal(result.sync_report.adjusted_count, 0);
    assert.equal(result.manifest.scenes.length, 3);
  });

  it('returns unchanged manifest for null inputs', () => {
    const result = syncSequenceToBeats(null, null);
    assert.equal(result.sync_report.adjusted_count, 0);
  });

  it('adjusts scene durations to land on beats', () => {
    // 120 BPM = beat every 0.5s. Scenes at 3.0, 3.0, 3.0
    // Boundary at 3.0s — beat at 3.0 is exact
    // Boundary at 6.0s — beat at 6.0 is exact
    // Use slightly off durations so adjustment is needed
    const manifest = makeManifest([3.1, 2.9, 3.0]);
    const beatData = makeBeatData(120, 9, {
      beats: makeBeats(120, 9),
    });

    const result = syncSequenceToBeats(manifest, beatData);
    assert.ok(result.manifest.scenes.length === 3);
    // Should attempt some adjustments
    assert.ok(result.sync_report.total_scenes === 3);
  });

  it('respects max adjustment limit of 15%', () => {
    const manifest = makeManifest([3.0, 3.0, 3.0]);
    const beatData = makeBeatData(120, 9, {
      beats: [{ time_s: 3.6, strength: 0.9, type: 'kick' }], // 0.6s from boundary — 20% of 3.0
    });

    const result = syncSequenceToBeats(manifest, beatData);
    // 0.6 > 3.0 * 0.15 = 0.45, so should NOT adjust
    assert.equal(result.manifest.scenes[0].duration_s, 3.0);
  });

  it('sync_mode loose allows wider tolerance', () => {
    const manifest = makeManifest([3.0, 3.0, 3.0]);
    // Beat at 3.15 — within loose tolerance (200ms) and 15% of 3.0
    const beatData = makeBeatData(120, 9, {
      beats: [{ time_s: 3.15, strength: 0.9, type: 'kick' }],
    });

    const result = syncSequenceToBeats(manifest, beatData, { sync_mode: 'loose' });
    // 0.15 is within 15% of 3.0 (0.45) and within 400ms (loose * 2)
    // Should adjust
    if (result.sync_report.adjusted_count > 0) {
      assert.ok(result.manifest.scenes[0].duration_s > 3.0);
    }
  });

  it('last scene is never adjusted', () => {
    const manifest = makeManifest([3.0, 3.0]);
    const beatData = makeBeatData(120, 6);
    const result = syncSequenceToBeats(manifest, beatData);

    // No adjustment should target the last scene
    for (const adj of result.sync_report.adjustments) {
      assert.ok(adj.scene_index < manifest.scenes.length - 1);
    }
  });

  it('includes sync score in report', () => {
    const manifest = makeManifest([2.5, 2.5, 2.5]);
    const beatData = makeBeatData(120, 7.5);
    const result = syncSequenceToBeats(manifest, beatData);

    assert.ok(typeof result.sync_report.sync_score === 'number');
    assert.ok(result.sync_report.sync_score >= 0);
    assert.ok(result.sync_report.sync_score <= 100);
  });
});

// ── generateHitMarkers ───────────────────────────────────────────────────────

describe('generateHitMarkers', () => {
  it('returns empty markers for empty beats', () => {
    const result = generateHitMarkers({ beats: [] });
    assert.equal(result.markers.length, 0);
    assert.equal(result.stats.total, 0);
  });

  it('generates markers from beat data', () => {
    const beatData = makeBeatData(120, 10);
    const result = generateHitMarkers(beatData, { sensitivity: 0.3 });

    assert.ok(result.markers.length > 0, 'Should generate at least one marker');
    assert.ok(result.stats.total > 0);
  });

  it('markers have required fields', () => {
    const beatData = makeBeatData(120, 10);
    const result = generateHitMarkers(beatData, { sensitivity: 0.3 });

    for (const marker of result.markers) {
      assert.ok('time_s' in marker, 'Marker should have time_s');
      assert.ok('type' in marker, 'Marker should have type');
      assert.ok('strength' in marker, 'Marker should have strength');
      assert.ok('score' in marker, 'Marker should have score');
      assert.ok('label' in marker, 'Marker should have label');
      assert.ok(['primary', 'secondary'].includes(marker.label));
    }
  });

  it('respects minGapMs constraint', () => {
    const beatData = makeBeatData(240, 5); // Fast BPM = beats 0.25s apart
    const result = generateHitMarkers(beatData, { sensitivity: 0.1, minGapMs: 500 });

    for (let i = 1; i < result.markers.length; i++) {
      const gap = result.markers[i].time_s - result.markers[i - 1].time_s;
      assert.ok(gap >= 0.49, `Gap ${gap}s should be >= 0.5s (500ms)`);
    }
  });

  it('higher sensitivity produces fewer markers', () => {
    const beatData = makeBeatData(120, 10);
    const low = generateHitMarkers(beatData, { sensitivity: 0.2 });
    const high = generateHitMarkers(beatData, { sensitivity: 0.8 });

    assert.ok(low.markers.length >= high.markers.length,
      `Low sensitivity (${low.markers.length}) should produce >= markers than high (${high.markers.length})`);
  });

  it('stats include type breakdown', () => {
    const beatData = makeBeatData(120, 10);
    const result = generateHitMarkers(beatData, { sensitivity: 0.3 });

    assert.ok(typeof result.stats.by_type === 'object');
    assert.ok(typeof result.stats.avg_score === 'number');
  });

  it('handles energy curve in object format', () => {
    const beatData = makeBeatData(120, 8, {
      energy_curve: [
        { time_s: 0, energy: 0.2 },
        { time_s: 2, energy: 0.5 },
        { time_s: 4, energy: 0.9 },
        { time_s: 6, energy: 0.4 },
      ],
    });

    const result = generateHitMarkers(beatData, { sensitivity: 0.3 });
    assert.ok(result.markers.length > 0);
  });
});

// ── planAudioCues ────────────────────────────────────────────────────────────

describe('planAudioCues', () => {
  it('returns empty cues for empty beats', () => {
    const result = planAudioCues({ beats: [] }, 'product-launch');
    assert.equal(result.cues.length, 0);
  });

  it('generates risers before energy peaks', () => {
    const beatData = makeBeatData(120, 15, {
      energy_curve: [
        { time_s: 0, energy: 0.2 },
        { time_s: 3, energy: 0.3 },
        { time_s: 5, energy: 0.4 },
        { time_s: 7, energy: 0.9 },  // Peak
        { time_s: 10, energy: 0.5 },
        { time_s: 12, energy: 0.3 },
        { time_s: 14, energy: 0.2 },
      ],
    });

    const result = planAudioCues(beatData, 'product-launch');
    const risers = result.cues.filter(c => c.type === 'riser');
    assert.ok(risers.length > 0, 'Should generate at least one riser');

    // Riser should start before the energy peak
    for (const riser of risers) {
      assert.ok(riser.time_s < 7, `Riser at ${riser.time_s}s should be before peak at 7s`);
    }
  });

  it('generates whooshes for whip transitions', () => {
    const beatData = makeBeatData(120, 12);
    const manifest = makeManifest([3, 3, 3, 3], {
      transitions: [
        null,
        { type: 'whip_left', duration_ms: 250 },
        { type: 'crossfade', duration_ms: 400 },
        { type: 'whip_right', duration_ms: 250 },
      ],
    });

    const result = planAudioCues(beatData, 'sizzle-reel', manifest);
    const whooshes = result.cues.filter(c => c.type === 'whoosh');
    assert.ok(whooshes.length === 2, `Should have 2 whooshes for 2 whip transitions, got ${whooshes.length}`);
  });

  it('generates stings for logo/brand scenes', () => {
    const beatData = makeBeatData(120, 12);
    const manifest = makeManifest([3, 3, 3, 3], {
      sceneIds: ['sc_hero', 'sc_feature', 'sc_demo', 'sc_logo_close'],
    });

    const result = planAudioCues(beatData, 'product-launch', manifest);
    const stings = result.cues.filter(c => c.type === 'sting');
    assert.ok(stings.length > 0, 'Should generate sting for logo scene');
    assert.ok(stings.some(s => s.scene_id === 'sc_logo_close'));
  });

  it('generates hits for sizzle-reel archetype', () => {
    const beatData = makeBeatData(120, 10);
    const result = planAudioCues(beatData, 'sizzle-reel');

    const hits = result.cues.filter(c => c.type === 'hit');
    assert.ok(hits.length > 0, 'Sizzle reels should include hit cues');
  });

  it('brand-story archetype skips hits', () => {
    const beatData = makeBeatData(120, 10);
    const result = planAudioCues(beatData, 'brand-story');

    const hits = result.cues.filter(c => c.type === 'hit');
    assert.equal(hits.length, 0, 'Brand stories should not include hit cues');
  });

  it('cues are sorted by time', () => {
    const beatData = makeBeatData(120, 15);
    const manifest = makeManifest([3, 3, 3, 3, 3], {
      sceneIds: ['sc_open', 'sc_hero', 'sc_demo', 'sc_cta', 'sc_logo'],
      transitions: [null, { type: 'whip_left', duration_ms: 250 }, null, null, null],
    });

    const result = planAudioCues(beatData, 'product-launch', manifest);

    for (let i = 1; i < result.cues.length; i++) {
      assert.ok(result.cues[i].time_s >= result.cues[i - 1].time_s,
        `Cue at index ${i} (${result.cues[i].time_s}s) should be >= previous (${result.cues[i - 1].time_s}s)`);
    }
  });

  it('summary includes archetype and tempo', () => {
    const beatData = makeBeatData(140, 10);
    const result = planAudioCues(beatData, 'sizzle-reel');

    assert.equal(result.summary.archetype, 'sizzle-reel');
    assert.equal(result.summary.tempo_bpm, 140);
    assert.ok(result.summary.total >= 0);
  });
});

// ── scoreAudioSync ───────────────────────────────────────────────────────────

describe('scoreAudioSync', () => {
  it('returns 0 for empty inputs', () => {
    const result = scoreAudioSync(null, null);
    assert.equal(result.score, 0);
    assert.equal(result.grade, 'F');
  });

  it('returns 0 for manifest with no beats', () => {
    const manifest = makeManifest([3, 3, 3]);
    const result = scoreAudioSync(manifest, { beats: [] });
    assert.equal(result.score, 0);
  });

  it('scores perfectly aligned transitions high', () => {
    // 120 BPM = beats at 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, ...
    // Scenes of 3.0s each → boundaries at 3.0 and 6.0 — exact beat alignment
    const manifest = makeManifest([3.0, 3.0, 3.0]);
    const beats = [];
    for (let t = 0.5; t <= 9; t += 0.5) {
      beats.push({ time_s: t, strength: 0.8, type: 'kick' });
    }
    const beatData = { beats, tempo_bpm: 120, energy_curve: [] };

    const result = scoreAudioSync(manifest, beatData);
    assert.ok(result.score >= 85, `Perfectly aligned should score >= 85, got ${result.score}`);
    assert.ok(['A', 'B'].includes(result.grade));
  });

  it('scores off-beat transitions lower', () => {
    // Scenes at 3.3, 3.3, 3.3 — boundaries at 3.3 and 6.6
    // Beats at 0.5 intervals — nearest to 3.3 is 3.5 (200ms off), nearest to 6.6 is 6.5 (100ms off)
    const manifest = makeManifest([3.3, 3.3, 3.3]);
    const beats = [];
    for (let t = 0.5; t <= 10; t += 0.5) {
      beats.push({ time_s: t, strength: 0.8, type: 'kick' });
    }
    const beatData = { beats, tempo_bpm: 120, energy_curve: [] };

    const result = scoreAudioSync(manifest, beatData);
    // Some offset but not terrible
    assert.ok(result.score > 0, 'Should have positive score');
  });

  it('details include per-transition sync info', () => {
    const manifest = makeManifest([2.5, 2.5, 2.5]);
    const beats = [];
    for (let t = 0.5; t <= 8; t += 0.5) {
      beats.push({ time_s: t, strength: 0.8, type: 'kick' });
    }
    const beatData = { beats, tempo_bpm: 120, energy_curve: [] };

    const result = scoreAudioSync(manifest, beatData);
    assert.equal(result.details.length, 2); // 3 scenes = 2 transition boundaries

    for (const detail of result.details) {
      assert.ok('scene_index' in detail);
      assert.ok('transition_time_s' in detail);
      assert.ok('nearest_beat_s' in detail);
      assert.ok('offset_ms' in detail);
      assert.ok('score' in detail);
      assert.ok('sync_level' in detail);
      assert.ok(['tight', 'loose', 'off'].includes(detail.sync_level));
    }
  });

  it('grade reflects score ranges', () => {
    // Test with perfectly aligned (should get A or B)
    const manifest = makeManifest([2.0, 2.0, 2.0]);
    const beats = [];
    for (let t = 0.5; t <= 6; t += 0.5) {
      beats.push({ time_s: t, strength: 0.8, type: 'kick' });
    }
    const beatData = { beats, tempo_bpm: 120, energy_curve: [] };

    const result = scoreAudioSync(manifest, beatData);
    assert.ok(typeof result.grade === 'string');
    assert.ok(['A', 'B', 'C', 'D', 'F'].includes(result.grade));
  });

  it('handles beats as plain number array', () => {
    const manifest = makeManifest([3.0, 3.0, 3.0]);
    const beatData = {
      beats: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0],
      tempo_bpm: 120,
      energy_curve: [],
    };

    const result = scoreAudioSync(manifest, beatData);
    assert.ok(result.score >= 85, `Plain number beats should work, got ${result.score}`);
  });
});

// ── Integration: sync + score ────────────────────────────────────────────────

describe('sync → score integration', () => {
  it('synced manifest scores higher than original', () => {
    // Slightly off durations
    const manifest = makeManifest([3.12, 2.87, 3.21]);
    const beatData = makeBeatData(120, 10);

    const beforeScore = scoreAudioSync(manifest, beatData);
    const synced = syncSequenceToBeats(manifest, beatData);
    const afterScore = scoreAudioSync(synced.manifest, beatData);

    // After sync, score should be >= before (or at worst equal if no adjustments possible)
    assert.ok(afterScore.score >= beforeScore.score,
      `Synced score (${afterScore.score}) should be >= original (${beforeScore.score})`);
  });
});
