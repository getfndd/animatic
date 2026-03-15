/**
 * Motion Critic tests — ANI-65
 *
 * Comprehensive tests for each detection rule in the critic system.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/critic.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  critiqueTimeline,
  detectDeadHolds,
  detectFlatMotion,
  detectMissingHierarchy,
  detectRepetitiveEasing,
  detectOrphanLayers,
  detectCameraMotionMismatch,
  detectExcessiveSimultaneity,
} from '../lib/critic.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeScene(layers = []) {
  return {
    scene_id: 'sc_test',
    duration_s: 4,
    fps: 60,
    layers: layers.length > 0 ? layers : [
      { id: 'title', type: 'text', content: 'Hello', depth_class: 'foreground' },
      { id: 'card-0', type: 'html', content: '<div>A</div>', depth_class: 'midground' },
      { id: 'card-1', type: 'html', content: '<div>B</div>', depth_class: 'midground' },
    ],
  };
}

function makeTimeline(layerTracks = {}, cameraTracks = {}, durationFrames = 240) {
  return {
    scene_id: 'sc_test',
    duration_frames: durationFrames,
    fps: 60,
    tracks: {
      camera: cameraTracks,
      layers: layerTracks,
    },
  };
}

// ── critiqueTimeline — integration ───────────────────────────────────────────

describe('critiqueTimeline', () => {
  it('returns perfect score for null timeline', () => {
    const result = critiqueTimeline(null, makeScene());
    assert.equal(result.score, 100);
    assert.equal(result.issues.length, 0);
  });

  it('returns perfect score for timeline with no tracks', () => {
    const result = critiqueTimeline({ tracks: { layers: {}, camera: {} }, duration_frames: 0 }, makeScene());
    assert.equal(result.score, 100);
  });

  it('returns issues and a summary for a problematic timeline', () => {
    // All layers start at frame 0, same easing — should trigger flat_motion
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
      },
      'card-0': {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
      },
      'card-1': {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
      },
    };

    const timeline = makeTimeline(layers, {}, 240);
    const result = critiqueTimeline(timeline, makeScene());

    assert.ok(result.score < 100, 'should have deductions');
    assert.ok(result.issues.length > 0, 'should have issues');
    assert.ok(result.summary.length > 0, 'should have summary');
    assert.ok(result.issues.some(i => i.rule === 'flat_motion'), 'should detect flat motion');
  });
});

// ── Dead hold detection ──────────────────────────────────────────────────────

describe('detectDeadHolds', () => {
  it('detects layer with no variation over >30% of scene', () => {
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 1 },
          { frame: 200, value: 1 },   // holds at 1 for 200/240 = 83%
          { frame: 240, value: 0 },
        ],
      },
    };

    const issues = detectDeadHolds(layers, 240);
    assert.ok(issues.length > 0, 'should find dead hold');
    assert.equal(issues[0].rule, 'dead_hold');
    assert.equal(issues[0].layer, 'title');
    assert.equal(issues[0].severity, 'warning');
  });

  it('does not flag short holds', () => {
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1 },   // holds for 24/240 = 10%
          { frame: 48, value: 1 },
        ],
      },
    };

    const issues = detectDeadHolds(layers, 240);
    assert.equal(issues.length, 0);
  });

  it('does not flag if other properties animate during hold', () => {
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 1 },
          { frame: 200, value: 1 },   // long hold
        ],
        scale: [
          { frame: 0, value: 0.95 },
          { frame: 100, value: 1.0 },  // animating during the hold
        ],
      },
    };

    const issues = detectDeadHolds(layers, 240);
    assert.equal(issues.length, 0, 'should not flag when other props animate');
  });
});

// ── Flat motion detection ────────────────────────────────────────────────────

describe('detectFlatMotion', () => {
  it('detects all layers starting at the same frame', () => {
    const layers = {
      title: {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
      'card-0': {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
      'card-1': {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
    };

    const issues = detectFlatMotion(layers);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, 'flat_motion');
    assert.equal(issues[0].severity, 'warning');
  });

  it('does not flag staggered layers', () => {
    const layers = {
      title: {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
      'card-0': {
        opacity: [{ frame: 12, value: 0 }, { frame: 36, value: 1 }],
      },
      'card-1': {
        opacity: [{ frame: 24, value: 0 }, { frame: 48, value: 1 }],
      },
    };

    const issues = detectFlatMotion(layers);
    assert.equal(issues.length, 0);
  });

  it('does not flag single-layer timelines', () => {
    const layers = {
      title: {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
    };

    const issues = detectFlatMotion(layers);
    assert.equal(issues.length, 0);
  });
});

// ── Missing hierarchy detection ──────────────────────────────────────────────

describe('detectMissingHierarchy', () => {
  it('detects when hero has less complexity than supporting layer', () => {
    const layers = {
      title: {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
      'card-0': {
        opacity: [{ frame: 12, value: 0 }, { frame: 36, value: 1 }],
        translateY: [{ frame: 12, value: 20 }, { frame: 36, value: 0 }],
        scale: [{ frame: 12, value: 0.9 }, { frame: 36, value: 1 }],
        filter_blur: [{ frame: 12, value: 8 }, { frame: 36, value: 0 }],
      },
    };

    const scene = makeScene([
      { id: 'title', type: 'text', depth_class: 'foreground' },
      { id: 'card-0', type: 'html', depth_class: 'midground' },
    ]);

    const issues = detectMissingHierarchy(layers, scene);
    assert.ok(issues.length > 0, 'should detect missing hierarchy');
    assert.equal(issues[0].rule, 'missing_hierarchy');
    assert.equal(issues[0].layer, 'title');
  });

  it('does not flag when hero has more complexity', () => {
    const layers = {
      title: {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
        translateY: [{ frame: 0, value: 20 }, { frame: 24, value: 0 }],
        scale: [{ frame: 0, value: 0.9 }, { frame: 24, value: 1 }],
      },
      'card-0': {
        opacity: [{ frame: 12, value: 0 }, { frame: 36, value: 1 }],
      },
    };

    const scene = makeScene([
      { id: 'title', type: 'text', depth_class: 'foreground' },
      { id: 'card-0', type: 'html', depth_class: 'midground' },
    ]);

    const issues = detectMissingHierarchy(layers, scene);
    assert.equal(issues.length, 0);
  });

  it('handles scenes with no layers gracefully', () => {
    const issues = detectMissingHierarchy({}, { layers: [] });
    assert.equal(issues.length, 0);
  });
});

// ── Repetitive easing detection ──────────────────────────────────────────────

describe('detectRepetitiveEasing', () => {
  it('detects >80% same easing curve', () => {
    const ease = 'cubic-bezier(0.25,0.46,0.45,0.94)';
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1, easing: ease },
        ],
        translateY: [
          { frame: 0, value: 20 },
          { frame: 24, value: 0, easing: ease },
        ],
      },
      'card-0': {
        opacity: [
          { frame: 12, value: 0 },
          { frame: 36, value: 1, easing: ease },
        ],
        translateY: [
          { frame: 12, value: 20 },
          { frame: 36, value: 0, easing: ease },
        ],
      },
      'card-1': {
        opacity: [
          { frame: 24, value: 0 },
          { frame: 48, value: 1, easing: ease },
        ],
      },
    };

    const issues = detectRepetitiveEasing(layers);
    assert.ok(issues.length > 0, 'should detect repetitive easing');
    assert.equal(issues[0].rule, 'repetitive_easing');
  });

  it('does not flag diverse easing curves', () => {
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1, easing: 'cubic-bezier(0.16,1,0.3,1)' },
        ],
      },
      'card-0': {
        opacity: [
          { frame: 12, value: 0 },
          { frame: 36, value: 1, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
      },
      'card-1': {
        opacity: [
          { frame: 24, value: 0 },
          { frame: 48, value: 1, easing: 'linear' },
        ],
      },
      'card-2': {
        opacity: [
          { frame: 36, value: 0 },
          { frame: 60, value: 1, easing: 'cubic-bezier(0.22,1,0.36,1)' },
        ],
      },
    };

    const issues = detectRepetitiveEasing(layers);
    assert.equal(issues.length, 0);
  });

  it('skips when too few keyframes with easing', () => {
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1, easing: 'linear' },
        ],
      },
    };

    const issues = detectRepetitiveEasing(layers);
    assert.equal(issues.length, 0, 'too few keyframes to judge');
  });
});

// ── Orphan layer detection ───────────────────────────────────────────────────

describe('detectOrphanLayers', () => {
  it('detects layers defined in scene but absent from timeline', () => {
    const layers = {
      title: {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
      // card-0 and card-1 are missing from timeline
    };

    const scene = makeScene(); // has title, card-0, card-1

    const issues = detectOrphanLayers(layers, scene);
    assert.equal(issues.length, 2, 'card-0 and card-1 are orphans');
    assert.ok(issues.every(i => i.rule === 'orphan_layer'));
    assert.ok(issues.some(i => i.layer === 'card-0'));
    assert.ok(issues.some(i => i.layer === 'card-1'));
  });

  it('does not flag when all layers have tracks', () => {
    const layers = {
      title: { opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }] },
      'card-0': { opacity: [{ frame: 12, value: 0 }, { frame: 36, value: 1 }] },
      'card-1': { opacity: [{ frame: 24, value: 0 }, { frame: 48, value: 1 }] },
    };

    const issues = detectOrphanLayers(layers, makeScene());
    assert.equal(issues.length, 0);
  });

  it('handles null scene gracefully', () => {
    const issues = detectOrphanLayers({}, null);
    assert.equal(issues.length, 0);
  });
});

// ── Camera-motion mismatch ───────────────────────────────────────────────────

describe('detectCameraMotionMismatch', () => {
  it('detects camera peak with no nearby layer animation', () => {
    const camera = {
      scale: [
        { frame: 0, value: 1 },
        { frame: 200, value: 1.05 },  // peak at frame 200
      ],
    };
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 24, value: 1 },  // all layer motion ends at frame 24
        ],
      },
    };

    const issues = detectCameraMotionMismatch(camera, layers, 240);
    assert.ok(issues.length > 0, 'should detect mismatch');
    assert.equal(issues[0].rule, 'camera_motion_mismatch');
  });

  it('does not flag when layers animate near camera peak', () => {
    const camera = {
      scale: [
        { frame: 0, value: 1 },
        { frame: 100, value: 1.05 },
      ],
    };
    const layers = {
      title: {
        opacity: [
          { frame: 90, value: 0 },
          { frame: 110, value: 1 },  // animating right around camera peak
        ],
      },
    };

    const issues = detectCameraMotionMismatch(camera, layers, 240);
    assert.equal(issues.length, 0);
  });

  it('handles empty camera tracks', () => {
    const issues = detectCameraMotionMismatch({}, { title: {} }, 240);
    assert.equal(issues.length, 0);
  });
});

// ── Excessive simultaneity ───────────────────────────────────────────────────

describe('detectExcessiveSimultaneity', () => {
  it('detects >3 layers animating in same 10-frame window', () => {
    const layers = {
      'layer-0': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
      'layer-1': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
      'layer-2': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
      'layer-3': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
    };

    const issues = detectExcessiveSimultaneity(layers, 240);
    assert.ok(issues.length > 0, 'should detect excessive simultaneity');
    assert.equal(issues[0].rule, 'excessive_simultaneity');
  });

  it('does not flag <=3 layers', () => {
    const layers = {
      'layer-0': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
      'layer-1': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
      'layer-2': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
    };

    const issues = detectExcessiveSimultaneity(layers, 240);
    assert.equal(issues.length, 0);
  });

  it('does not flag staggered layers in different windows', () => {
    const layers = {
      'layer-0': { opacity: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] },
      'layer-1': { opacity: [{ frame: 20, value: 0 }, { frame: 28, value: 1 }] },
      'layer-2': { opacity: [{ frame: 40, value: 0 }, { frame: 48, value: 1 }] },
      'layer-3': { opacity: [{ frame: 60, value: 0 }, { frame: 68, value: 1 }] },
    };

    const issues = detectExcessiveSimultaneity(layers, 240);
    assert.equal(issues.length, 0);
  });
});

// ── Clean timeline gets high score ───────────────────────────────────────────

describe('clean timeline scoring', () => {
  it('well-choreographed timeline gets high score', () => {
    const layers = {
      title: {
        opacity: [
          { frame: 0, value: 0 },
          { frame: 36, value: 1, easing: 'cubic-bezier(0.16,1,0.3,1)' },
        ],
        translateY: [
          { frame: 0, value: 20 },
          { frame: 36, value: 0, easing: 'cubic-bezier(0.16,1,0.3,1)' },
        ],
        filter_blur: [
          { frame: 0, value: 8 },
          { frame: 36, value: 0, easing: 'cubic-bezier(0.16,1,0.3,1)' },
        ],
      },
      'card-0': {
        opacity: [
          { frame: 48, value: 0 },
          { frame: 72, value: 1, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
        translateY: [
          { frame: 48, value: 10 },
          { frame: 72, value: 0, easing: 'cubic-bezier(0.25,0.46,0.45,0.94)' },
        ],
      },
      'card-1': {
        opacity: [
          { frame: 60, value: 0 },
          { frame: 84, value: 1, easing: 'cubic-bezier(0.22,1,0.36,1)' },
        ],
        translateY: [
          { frame: 60, value: 10 },
          { frame: 84, value: 0, easing: 'cubic-bezier(0.22,1,0.36,1)' },
        ],
      },
    };

    const camera = {
      scale: [
        { frame: 0, value: 1 },
        { frame: 60, value: 1.04, easing: 'cubic-bezier(0.33,0,0.2,1)' },
      ],
    };

    const timeline = makeTimeline(layers, camera, 240);
    const scene = makeScene();
    const result = critiqueTimeline(timeline, scene);

    assert.ok(result.score >= 80, `expected score >= 80, got ${result.score}`);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty timeline (no layers)', () => {
    const timeline = makeTimeline({}, {}, 240);
    const result = critiqueTimeline(timeline, makeScene());
    // Only orphan layer issues (all scene layers missing from timeline)
    assert.ok(result.issues.every(i => i.rule === 'orphan_layer'));
  });

  it('single-layer scene', () => {
    const layers = {
      title: {
        opacity: [{ frame: 0, value: 0 }, { frame: 24, value: 1 }],
      },
    };
    const scene = makeScene([
      { id: 'title', type: 'text', depth_class: 'foreground' },
    ]);
    const timeline = makeTimeline(layers, {}, 240);
    const result = critiqueTimeline(timeline, scene);

    // Single layer: no flat motion, no hierarchy, no simultaneity
    assert.ok(!result.issues.some(i => i.rule === 'flat_motion'));
    assert.ok(!result.issues.some(i => i.rule === 'missing_hierarchy'));
    assert.ok(!result.issues.some(i => i.rule === 'excessive_simultaneity'));
  });

  it('timeline with zero duration_frames', () => {
    const timeline = makeTimeline({}, {}, 0);
    const result = critiqueTimeline(timeline, makeScene());
    assert.equal(result.score, 100);
  });
});
