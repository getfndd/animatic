/**
 * Motion density audit tests.
 *
 * Run: node --test mcp/test/motion-density.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { auditMotionDensity, suggestSimplification } from '../lib/motion-density.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTimeline(layers, durationFrames = 60) {
  return {
    fps: 60,
    duration_frames: durationFrames,
    layers,
  };
}

function makeScene(durationS = 1, fps = 60) {
  return { duration_s: durationS, fps };
}

// ── auditMotionDensity ──────────────────────────────────────────────────────

describe('auditMotionDensity', () => {
  it('returns ideal score for empty timeline', () => {
    const result = auditMotionDensity({ layers: [] }, makeScene());
    assert.equal(result.score, 50);
    assert.deepEqual(result.density_curve, []);
    assert.deepEqual(result.hold_windows, []);
    assert.equal(result.dominant_subject, null);
    assert.equal(result.hot_spots.length, 0);
  });

  it('detects a single animated layer', () => {
    const timeline = makeTimeline([
      { id: 'hero', keyframes: [{ start_frame: 0, end_frame: 30 }] },
    ], 60);

    const result = auditMotionDensity(timeline, makeScene());

    assert.ok(result.score > 0, 'Score should be positive');
    assert.ok(result.density_curve.length > 0, 'Should have density curve');
    assert.equal(result.dominant_subject.id, 'hero');
  });

  it('detects hold windows (no motion)', () => {
    const timeline = makeTimeline([
      { id: 'hero', keyframes: [{ start_frame: 0, end_frame: 10 }] },
    ], 60);

    const result = auditMotionDensity(timeline, makeScene());

    // Frames 10-60 have no motion — should produce hold windows
    assert.ok(result.hold_windows.length > 0, 'Should detect hold windows');
    // First hold should start at frame 10
    assert.ok(
      result.hold_windows.some(h => h.start_frame >= 10),
      'Hold should start after animation ends',
    );
  });

  it('detects hot spots with many simultaneous movers', () => {
    // 5 layers all animating at the same time
    const layers = [];
    for (let i = 0; i < 5; i++) {
      layers.push({
        id: `layer_${i}`,
        keyframes: [{ start_frame: 0, end_frame: 10 }],
      });
    }

    const timeline = makeTimeline(layers, 10);
    const result = auditMotionDensity(timeline, { duration_s: 0.167, fps: 60 });

    assert.ok(result.score >= 70, `Score ${result.score} should indicate busy (>=70)`);
  });

  it('identifies dominant subject correctly', () => {
    const timeline = makeTimeline([
      { id: 'hero', keyframes: [{ start_frame: 0, end_frame: 50 }] },
      { id: 'bg', keyframes: [{ start_frame: 0, end_frame: 10 }] },
    ], 60);

    const result = auditMotionDensity(timeline, makeScene());

    assert.equal(result.dominant_subject.id, 'hero');
    assert.ok(result.dominant_subject.pct > 50, 'Hero should dominate');
  });

  it('handles keyframes with frame property (single keyframe format)', () => {
    const timeline = makeTimeline([
      {
        id: 'text',
        keyframes: [
          { frame: 0, opacity: 0 },
          { frame: 15, opacity: 1 },
          { frame: 30, opacity: 1 },
        ],
      },
    ], 60);

    const result = auditMotionDensity(timeline, makeScene());
    assert.ok(result.score > 0);
    assert.ok(result.density_curve.length > 0);
  });

  it('handles start/end shorthand keyframe format', () => {
    const timeline = makeTimeline([
      { id: 'card', keyframes: [{ start: 5, end: 25 }] },
    ], 60);

    const result = auditMotionDensity(timeline, makeScene());
    assert.ok(result.score > 0);
  });

  it('respects custom window size', () => {
    const timeline = makeTimeline([
      { id: 'hero', keyframes: [{ start_frame: 0, end_frame: 30 }] },
    ], 60);

    const smallWindow = auditMotionDensity(timeline, makeScene(), { window_size: 5 });
    const bigWindow = auditMotionDensity(timeline, makeScene(), { window_size: 30 });

    assert.ok(
      smallWindow.density_curve.length > bigWindow.density_curve.length,
      'Smaller windows should produce more data points',
    );
  });

  it('suggests staggering when layers start at the same frame', () => {
    const layers = [];
    for (let i = 0; i < 4; i++) {
      layers.push({
        id: `card_${i}`,
        keyframes: [{ start_frame: 0, end_frame: 20 }],
      });
    }

    const timeline = makeTimeline(layers, 60);
    const result = auditMotionDensity(timeline, makeScene());

    const staggerSuggestion = result.suggestions.find(s => s.includes('Stagger'));
    assert.ok(staggerSuggestion, 'Should suggest staggering co-starting layers');
  });

  it('falls back to scene layers when timeline has none', () => {
    const scene = {
      duration_s: 1,
      fps: 60,
      layers: [
        { id: 'bg', keyframes: [{ start_frame: 0, end_frame: 30 }] },
      ],
    };

    const result = auditMotionDensity({}, scene);
    assert.ok(result.score > 0);
    assert.equal(result.dominant_subject.id, 'bg');
  });
});

// ── suggestSimplification ───────────────────────────────────────────────────

describe('suggestSimplification', () => {
  it('returns empty array for null input', () => {
    assert.deepEqual(suggestSimplification(null), []);
  });

  it('flags over-animated scenes', () => {
    const report = {
      score: 85,
      density_curve: [80, 90, 85],
      hold_windows: [],
      dominant_subject: null,
      hot_spots: [],
    };

    const suggestions = suggestSimplification(report);
    assert.ok(suggestions.some(s => s.includes('density is 85')));
  });

  it('flags under-animated scenes', () => {
    const report = {
      score: 15,
      density_curve: [10, 20, 15],
      hold_windows: [],
      dominant_subject: null,
      hot_spots: [],
    };

    const suggestions = suggestSimplification(report);
    assert.ok(suggestions.some(s => s.includes('feels static')));
  });

  it('suggests simplification for hot spots with many movers', () => {
    const report = {
      score: 60,
      density_curve: [80],
      hold_windows: [],
      dominant_subject: null,
      hot_spots: [{
        window_index: 0,
        start_frame: 0,
        end_frame: 10,
        density: 80,
        simultaneous_movers: 4,
        movers: ['hero', 'card_1', 'card_2', 'bg'],
      }],
    };

    const suggestions = suggestSimplification(report);
    assert.ok(suggestions.some(s => s.includes('Stagger')));
  });

  it('flags long hold windows', () => {
    const report = {
      score: 40,
      density_curve: [50, 0, 0, 50],
      hold_windows: [{
        window_index: 1,
        start_frame: 10,
        end_frame: 40,
        duration_frames: 30,
      }],
      dominant_subject: null,
      hot_spots: [],
    };

    const suggestions = suggestSimplification(report);
    assert.ok(suggestions.some(s => s.includes('30-frame hold')));
  });

  it('warns when dominant subject takes too much motion weight', () => {
    const report = {
      score: 50,
      density_curve: [50],
      hold_windows: [],
      dominant_subject: { id: 'hero', frames: 100, pct: 85 },
      hot_spots: [],
    };

    const suggestions = suggestSimplification(report);
    assert.ok(suggestions.some(s => s.includes('hero') && s.includes('85%')));
  });

  it('detects consecutive high-density windows', () => {
    const report = {
      score: 65,
      density_curve: [75, 80, 85, 78, 30],
      hold_windows: [],
      dominant_subject: null,
      hot_spots: [],
    };

    const suggestions = suggestSimplification(report);
    assert.ok(
      suggestions.some(s => s.includes('sustained high density')),
      'Should warn about consecutive busy windows',
    );
  });
});
