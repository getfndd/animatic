/**
 * Tests for Storyboard Tools — Contact Sheet & Version Comparison.
 *
 * Covers: generateContactSheet, generateKeyMomentStrip,
 * compareProjectVersions, formatContactSheetMarkdown, formatComparisonMarkdown.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateContactSheet,
  generateKeyMomentStrip,
  compareProjectVersions,
  formatContactSheetMarkdown,
  formatComparisonMarkdown,
  describeThumbnail,
} from '../lib/storyboard-tools.js';

// ── Fixture helpers ─────────────────────────────────────────────────────────

function makeScene(id, overrides = {}) {
  return {
    scene_id: id,
    duration_s: overrides.duration_s || 3,
    layers: overrides.layers || [
      { id: 'l1', type: 'text', content: { text: `Scene ${id}` }, depth_class: 'foreground' },
    ],
    camera: overrides.camera || { move: 'static' },
    metadata: {
      content_type: 'typography',
      visual_weight: 'dark',
      motion_energy: 'moderate',
      intent_tags: [],
      ...(overrides.metadata || {}),
    },
  };
}

function makeManifest(sceneIds, overrides = {}) {
  return {
    scene_order: sceneIds,
    transitions: overrides.transitions || [],
    scenes: overrides.scenes || sceneIds.map(id => ({
      scene_id: id,
      duration_s: 3,
    })),
    ...overrides,
  };
}

// ── describeThumbnail ───────────────────────────────────────────────────────

describe('describeThumbnail', () => {
  it('describes text layers', () => {
    const scene = makeScene('sc_01', {
      layers: [{ id: 'l1', type: 'text', content: { text: 'Hello World' } }],
    });
    const desc = describeThumbnail(scene);
    assert.ok(desc.includes('Hello World'));
  });

  it('describes image layers', () => {
    const scene = makeScene('sc_01', {
      layers: [{ id: 'l1', type: 'image', src: 'assets/hero-product.png' }],
    });
    const desc = describeThumbnail(scene);
    assert.ok(desc.includes('hero-product.png'));
  });

  it('handles empty layers', () => {
    const scene = { scene_id: 'sc_empty', layers: [] };
    assert.equal(describeThumbnail(scene), 'Empty scene');
  });

  it('handles multiple layers', () => {
    const scene = makeScene('sc_01', {
      layers: [
        { id: 'l1', type: 'text', content: { text: 'Title' } },
        { id: 'l2', type: 'image', src: 'assets/bg.png' },
      ],
    });
    const desc = describeThumbnail(scene);
    assert.ok(desc.includes('Title'));
    assert.ok(desc.includes('bg.png'));
    assert.ok(desc.includes('|'));
  });

  it('truncates long text', () => {
    const longText = 'A'.repeat(60);
    const scene = makeScene('sc_01', {
      layers: [{ id: 'l1', type: 'text', content: { text: longText } }],
    });
    const desc = describeThumbnail(scene);
    assert.ok(desc.includes('...'));
    assert.ok(desc.length < 80);
  });
});

// ── generateContactSheet ────────────────────────────────────────────────────

describe('generateContactSheet', () => {
  it('produces correct sheet entries for a multi-scene manifest', () => {
    const scenes = [
      makeScene('sc_01', { duration_s: 2 }),
      makeScene('sc_02', { duration_s: 4 }),
      makeScene('sc_03', { duration_s: 3 }),
    ];
    const manifest = makeManifest(['sc_01', 'sc_02', 'sc_03'], {
      transitions: [
        { after: 'sc_01', type: 'crossfade', duration_ms: 400 },
      ],
      scenes: [
        { scene_id: 'sc_01', duration_s: 2 },
        { scene_id: 'sc_02', duration_s: 4 },
        { scene_id: 'sc_03', duration_s: 3 },
      ],
    });

    const result = generateContactSheet(manifest, scenes);

    assert.equal(result.scene_count, 3);
    assert.equal(result.sheets.length, 3);

    // Check scene IDs in order
    assert.equal(result.sheets[0].scene_id, 'sc_01');
    assert.equal(result.sheets[1].scene_id, 'sc_02');
    assert.equal(result.sheets[2].scene_id, 'sc_03');

    // Durations
    assert.equal(result.sheets[0].duration_s, 2);
    assert.equal(result.sheets[1].duration_s, 4);

    // Timecodes present
    assert.equal(result.sheets[0].timecode_start_s, 0);

    // Transition
    assert.equal(result.sheets[0].transition_in, 'crossfade');
    assert.equal(result.sheets[0].transition_duration_ms, 400);
  });

  it('respects includeTimecodes=false', () => {
    const scenes = [makeScene('sc_01')];
    const manifest = makeManifest(['sc_01']);
    const result = generateContactSheet(manifest, scenes, { includeTimecodes: false });

    assert.equal(result.sheets[0].timecode_start_s, undefined);
    assert.equal(result.sheets[0].timecode_end_s, undefined);
  });

  it('respects includeTechnical=false', () => {
    const scenes = [makeScene('sc_01')];
    const manifest = makeManifest(['sc_01']);
    const result = generateContactSheet(manifest, scenes, { includeTechnical: false });

    assert.equal(result.sheets[0].camera_move, undefined);
    assert.equal(result.sheets[0].energy, undefined);
  });

  it('works with scene map (object) input', () => {
    const sceneMap = {
      sc_01: makeScene('sc_01'),
      sc_02: makeScene('sc_02'),
    };
    const manifest = makeManifest(['sc_01', 'sc_02']);
    const result = generateContactSheet(manifest, sceneMap);

    assert.equal(result.scene_count, 2);
  });

  it('calculates total duration accounting for transitions', () => {
    const scenes = [
      makeScene('sc_01', { duration_s: 3 }),
      makeScene('sc_02', { duration_s: 3 }),
    ];
    const manifest = makeManifest(['sc_01', 'sc_02'], {
      transitions: [
        { after: 'sc_01', type: 'crossfade', duration_ms: 500 },
      ],
    });

    const result = generateContactSheet(manifest, scenes);
    // 3 + 3 - 0.5 overlap = 5.5
    assert.equal(result.total_duration_s, 5.5);
  });

  it('includes content_type and intent_tags when available', () => {
    const scenes = [
      makeScene('sc_01', {
        metadata: { content_type: 'product_shot', intent_tags: ['hero', 'opening'] },
      }),
    ];
    const manifest = makeManifest(['sc_01']);
    const result = generateContactSheet(manifest, scenes);

    assert.equal(result.sheets[0].content_type, 'product_shot');
    assert.deepEqual(result.sheets[0].intent_tags, ['hero', 'opening']);
  });
});

// ── generateKeyMomentStrip ──────────────────────────────────────────────────

describe('generateKeyMomentStrip', () => {
  it('identifies first and last frames', () => {
    const scenes = [
      makeScene('sc_01', { duration_s: 3 }),
      makeScene('sc_02', { duration_s: 3 }),
    ];
    const manifest = makeManifest(['sc_01', 'sc_02']);

    const result = generateKeyMomentStrip(manifest, scenes);

    const types = result.moments.map(m => m.type);
    assert.ok(types.includes('first_frame'));
    assert.ok(types.includes('final_frame'));

    const first = result.moments.find(m => m.type === 'first_frame');
    assert.equal(first.frame, 0);
    assert.equal(first.scene_id, 'sc_01');

    const last = result.moments.find(m => m.type === 'final_frame');
    assert.equal(last.scene_id, 'sc_02');
  });

  it('identifies hero entrances', () => {
    const scenes = [
      makeScene('sc_01', { duration_s: 2, metadata: { intent_tags: ['opening'] } }),
      makeScene('sc_02', { duration_s: 3, metadata: { intent_tags: ['hero'] } }),
      makeScene('sc_03', { duration_s: 2 }),
    ];
    const manifest = makeManifest(['sc_01', 'sc_02', 'sc_03']);

    const result = generateKeyMomentStrip(manifest, scenes);

    const heroes = result.moments.filter(m => m.type === 'hero_entrance');
    assert.equal(heroes.length, 1);
    assert.equal(heroes[0].scene_id, 'sc_02');
    assert.equal(heroes[0].frame, 2 * 60); // 2s at 60fps
  });

  it('identifies transition midpoints', () => {
    const scenes = [
      makeScene('sc_01', { duration_s: 3 }),
      makeScene('sc_02', { duration_s: 3 }),
    ];
    const manifest = makeManifest(['sc_01', 'sc_02'], {
      transitions: [
        { after: 'sc_01', type: 'crossfade', duration_ms: 400 },
      ],
    });

    const result = generateKeyMomentStrip(manifest, scenes);

    const transitions = result.moments.filter(m => m.type === 'transition_midpoint');
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].transition_type, 'crossfade');
  });

  it('respects maxMoments cap', () => {
    const scenes = [];
    const ids = [];
    for (let i = 0; i < 10; i++) {
      const id = `sc_${String(i + 1).padStart(2, '0')}`;
      ids.push(id);
      scenes.push(makeScene(id, {
        duration_s: 2,
        metadata: { intent_tags: i === 3 ? ['hero'] : [] },
      }));
    }
    const manifest = makeManifest(ids, {
      transitions: ids.slice(0, -1).map(id => ({
        after: id, type: 'crossfade', duration_ms: 300,
      })),
    });

    const result = generateKeyMomentStrip(manifest, scenes, { maxMoments: 4 });
    assert.ok(result.moments.length <= 4);

    // First and last should always be present
    assert.equal(result.moments[0].type, 'first_frame');
    assert.equal(result.moments[result.moments.length - 1].type, 'final_frame');
  });

  it('uses specified fps', () => {
    const scenes = [
      makeScene('sc_01', { duration_s: 2 }),
      makeScene('sc_02', { duration_s: 2, metadata: { intent_tags: ['hero'] } }),
    ];
    const manifest = makeManifest(['sc_01', 'sc_02']);

    const result = generateKeyMomentStrip(manifest, scenes, { fps: 30 });

    assert.equal(result.fps, 30);
    const hero = result.moments.find(m => m.type === 'hero_entrance');
    assert.equal(hero.frame, 2 * 30); // 2s at 30fps
  });
});

// ── compareProjectVersions ──────────────────────────────────────────────────

describe('compareProjectVersions', () => {
  it('detects added scenes', () => {
    const vA = makeManifest(['sc_01', 'sc_02']);
    const vB = makeManifest(['sc_01', 'sc_02', 'sc_03'], {
      scenes: [
        { scene_id: 'sc_01', duration_s: 3 },
        { scene_id: 'sc_02', duration_s: 3 },
        { scene_id: 'sc_03', duration_s: 3 },
      ],
    });

    const result = compareProjectVersions(vA, vB);
    assert.deepEqual(result.scenes_added, ['sc_03']);
    assert.deepEqual(result.scenes_removed, []);
  });

  it('detects removed scenes', () => {
    const vA = makeManifest(['sc_01', 'sc_02', 'sc_03']);
    const vB = makeManifest(['sc_01', 'sc_03'], {
      scenes: [
        { scene_id: 'sc_01', duration_s: 3 },
        { scene_id: 'sc_03', duration_s: 3 },
      ],
    });

    const result = compareProjectVersions(vA, vB);
    assert.deepEqual(result.scenes_added, []);
    assert.deepEqual(result.scenes_removed, ['sc_02']);
  });

  it('detects reordered scenes', () => {
    const vA = makeManifest(['sc_01', 'sc_02', 'sc_03']);
    const vB = makeManifest(['sc_02', 'sc_01', 'sc_03']);

    const result = compareProjectVersions(vA, vB);
    assert.equal(result.scenes_reordered, true);
  });

  it('reports no reorder when order is preserved', () => {
    const vA = makeManifest(['sc_01', 'sc_02']);
    const vB = makeManifest(['sc_01', 'sc_02']);

    const result = compareProjectVersions(vA, vB);
    assert.equal(result.scenes_reordered, false);
  });

  it('detects duration changes per-scene', () => {
    const vA = makeManifest(['sc_01', 'sc_02'], {
      scenes: [
        { scene_id: 'sc_01', duration_s: 3 },
        { scene_id: 'sc_02', duration_s: 4 },
      ],
    });
    const vB = makeManifest(['sc_01', 'sc_02'], {
      scenes: [
        { scene_id: 'sc_01', duration_s: 3 },
        { scene_id: 'sc_02', duration_s: 6 },
      ],
    });

    const result = compareProjectVersions(vA, vB);
    assert.equal(result.duration_change.total_a_s, 7);
    assert.equal(result.duration_change.total_b_s, 9);
    assert.equal(result.duration_change.delta_s, 2);
    assert.equal(result.duration_changes.length, 1);
    assert.equal(result.duration_changes[0].scene_id, 'sc_02');
    assert.equal(result.duration_changes[0].delta_s, 2);
  });

  it('detects transition changes', () => {
    const vA = makeManifest(['sc_01', 'sc_02'], {
      transitions: [{ after: 'sc_01', type: 'crossfade', duration_ms: 400 }],
    });
    const vB = makeManifest(['sc_01', 'sc_02'], {
      transitions: [{ after: 'sc_01', type: 'whip_left', duration_ms: 250 }],
    });

    const result = compareProjectVersions(vA, vB);
    assert.equal(result.transition_changes.length, 1);
    assert.equal(result.transition_changes[0].change, 'modified');
    assert.equal(result.transition_changes[0].from.type, 'crossfade');
    assert.equal(result.transition_changes[0].to.type, 'whip_left');
  });

  it('detects camera changes', () => {
    const vA = makeManifest(['sc_01'], {
      scenes: [{ scene_id: 'sc_01', duration_s: 3, camera: { move: 'push_in' } }],
    });
    const vB = makeManifest(['sc_01'], {
      scenes: [{ scene_id: 'sc_01', duration_s: 3, camera: { move: 'pull_out' } }],
    });

    const result = compareProjectVersions(vA, vB);
    assert.equal(result.camera_changes.length, 1);
    assert.equal(result.camera_changes[0].from, 'push_in');
    assert.equal(result.camera_changes[0].to, 'pull_out');
  });

  it('calculates timing_delta_ms correctly', () => {
    const vA = makeManifest(['sc_01'], {
      scenes: [{ scene_id: 'sc_01', duration_s: 3 }],
    });
    const vB = makeManifest(['sc_01'], {
      scenes: [{ scene_id: 'sc_01', duration_s: 5 }],
    });

    const result = compareProjectVersions(vA, vB);
    assert.equal(result.timing_delta_ms, 2000);
  });
});

// ── Markdown formatters ─────────────────────────────────────────────────────

describe('formatContactSheetMarkdown', () => {
  it('produces valid markdown table', () => {
    const scenes = [
      makeScene('sc_01', { duration_s: 3 }),
      makeScene('sc_02', { duration_s: 4 }),
    ];
    const manifest = makeManifest(['sc_01', 'sc_02']);
    const sheet = generateContactSheet(manifest, scenes);
    const md = formatContactSheetMarkdown(sheet);

    assert.ok(md.includes('# Contact Sheet'));
    assert.ok(md.includes('sc_01'));
    assert.ok(md.includes('sc_02'));
    assert.ok(md.includes('|'));
    assert.ok(md.includes('Duration'));
    // Should have table separator
    assert.ok(md.includes('|---'));
  });

  it('handles empty contact sheet', () => {
    const md = formatContactSheetMarkdown({ sheets: [], total_duration_s: 0, scene_count: 0 });
    assert.ok(md.includes('No scenes'));
  });
});

describe('formatComparisonMarkdown', () => {
  it('produces valid markdown with all sections', () => {
    const vA = makeManifest(['sc_01', 'sc_02'], {
      scenes: [
        { scene_id: 'sc_01', duration_s: 3 },
        { scene_id: 'sc_02', duration_s: 4 },
      ],
      transitions: [{ after: 'sc_01', type: 'crossfade', duration_ms: 400 }],
    });
    const vB = makeManifest(['sc_01', 'sc_03'], {
      scenes: [
        { scene_id: 'sc_01', duration_s: 5, camera: { move: 'push_in' } },
        { scene_id: 'sc_03', duration_s: 3 },
      ],
      transitions: [{ after: 'sc_01', type: 'whip_left', duration_ms: 250 }],
    });

    const comparison = compareProjectVersions(vA, vB);
    const md = formatComparisonMarkdown(comparison);

    assert.ok(md.includes('# Version Comparison'));
    assert.ok(md.includes('## Summary'));
    assert.ok(md.includes('sc_03'), 'should mention added scene');
    assert.ok(md.includes('sc_02'), 'should mention removed scene');
    assert.ok(md.includes('Duration'));
    assert.ok(md.includes('|---'));
  });

  it('omits empty sections', () => {
    const vA = makeManifest(['sc_01']);
    const vB = makeManifest(['sc_01']);
    const comparison = compareProjectVersions(vA, vB);
    const md = formatComparisonMarkdown(comparison);

    assert.ok(md.includes('## Summary'));
    // No scene changes section since nothing changed
    assert.ok(!md.includes('## Scene Changes'));
    assert.ok(!md.includes('## Transition Changes'));
    assert.ok(!md.includes('## Camera Changes'));
  });
});
