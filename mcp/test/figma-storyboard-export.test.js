/**
 * Storyboard ↔ Figma round-trip (ANI-113).
 *
 * All offline: payload building and the verification/comment-mapping
 * bookends are pure; the panel renderer takes an injectable renderer; the
 * client halves are covered by injectable-fetch tests alongside the
 * ANI-114 client tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildStoryboardExportPayload,
  renderStoryboardPanels,
  STORYBOARD_FRAME_PREFIX,
} from '../lib/figma/storyboard-export.js';
import {
  mapCommentsToScenes,
  verifyExportAgainstTree,
} from '../lib/figma/figma-roundtrip.js';
import { fetchComments, fetchFileTree } from '../lib/figma/client.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const MANIFEST = {
  sequence_id: 'seq_demo',
  scenes: [
    { scene: 'sc_open', duration_s: 4 },
    { scene: 'sc_feature', duration_s: 6, transition_in: { kind: 'whip_wipe', duration_ms: 500 }, camera_override: { move: 'push_in' } },
    { scene: 'sc_close', duration_s: 3, transition_in: { duration_ms: 300 } },
  ],
};

const SCENE_DEFS = {
  sc_open: {
    scene_id: 'sc_open', duration_s: 4, primary_subject: 'Brand opener',
    layers: [{ type: 'text', content: { text: 'Welcome to the product' } }],
    voiceover: { text: 'Meet the product.' },
  },
  sc_feature: {
    scene_id: 'sc_feature', duration_s: 6, primary_subject: 'Dashboard',
    semantic: { camera_behavior: { mode: 'reactive' }, components: [], interactions: [] },
    layers: [],
  },
  sc_close: { scene_id: 'sc_close', duration_s: 3, layers: [] },
};

/** A Figma file tree as the agent should have created it — frames carry
 *  the panel image + caption children designers actually pin comments to. */
function goodTree() {
  const frame = (name, id) => ({
    id, name, type: 'FRAME',
    children: [
      { id: `${id}0`, name: 'panel image', type: 'RECTANGLE' },
      { id: `${id}1`, name: 'caption', type: 'TEXT' },
    ],
  });
  return {
    file_key: 'SBKEY',
    document: {
      id: '0:0', type: 'DOCUMENT',
      children: [{
        id: '0:1', type: 'CANVAS', name: 'Storyboard — seq_demo',
        children: [
          frame('sb_sc_open', '1:1'),
          frame('sb_sc_feature', '1:2'),
          frame('sb_sc_close', '1:3'),
        ],
      }],
    },
  };
}

// ── Payload ─────────────────────────────────────────────────────────────────

describe('buildStoryboardExportPayload', () => {
  const payload = buildStoryboardExportPayload(MANIFEST, SCENE_DEFS, { project_title: 'Demo' });

  it('emits one panel per manifest scene with the naming contract', () => {
    assert.equal(payload.panels.length, 3);
    assert.deepEqual(payload.naming_contract.expected_frames,
      ['sb_sc_open', 'sb_sc_feature', 'sb_sc_close']);
    assert.equal(payload.panels[0].frame_name, `${STORYBOARD_FRAME_PREFIX}sc_open`);
    assert.equal(payload.panels[0].panel_png, 'storyboards/figma-export/sc_open.png');
  });

  it('carries scene metadata: camera, transitions, voiceover, timeline offsets', () => {
    const [open, feature, close] = payload.panels;
    assert.equal(open.title, 'Brand opener');
    assert.equal(open.transition_in, 'cut (open)');
    assert.equal(open.voiceover, 'Meet the product.');
    assert.equal(feature.camera, 'push_in'); // camera_override wins
    assert.equal(feature.transition_in, 'whip_wipe (500ms)'); // .kind fallback
    assert.equal(close.camera, 'static');
    // transition overlap honored (captions timeline convention)
    assert.equal(feature.starts_at_ms, 3500);
  });

  it('plans a deterministic grid and instructs the naming contract', () => {
    assert.equal(payload.layout_plan.grid.columns, 3);
    assert.equal(payload.layout_plan.positions.length, 3);
    assert.equal(payload.layout_plan.positions[1].x, 960 + 80);
    assert.match(payload.figma_instructions, /sb_<scene_id>/);
    assert.match(payload.figma_instructions, /verify_figma_export/);
  });

  it('rejects empty manifests', () => {
    assert.throws(() => buildStoryboardExportPayload({ scenes: [] }, {}), /requires a manifest/);
  });

  it('uses transition_in.type (repo convention) and reports missing scene defs (PR #90 findings)', () => {
    const p = buildStoryboardExportPayload(
      { scenes: [
        { scene: 'sc_a', duration_s: 2 },
        { scene: 'sc_b', duration_s: 2, transition_in: { type: 'crossfade', duration_ms: 400 } },
      ] },
      { sc_a: SCENE_DEFS.sc_open }, // sc_b has no definition
    );
    assert.equal(p.panels[1].transition_in, 'crossfade (400ms)');
    assert.equal(p.panels[0].scene_loaded, true);
    assert.equal(p.panels[1].scene_loaded, false);
    assert.deepEqual(p.missing_scene_defs, ['sc_b']);
  });
});

// ── Panel renderer (injectable) ─────────────────────────────────────────────

describe('renderStoryboardPanels', () => {
  it('bundles once and renders a mid-frame still per loaded scene', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani-113-'));
    try {
      const calls = { bundle: 0, select: [], still: [] };
      const renderer = {
        bundle: async () => { calls.bundle += 1; return 'serve://x'; },
        selectComposition: async ({ inputProps }) => {
          calls.select.push(inputProps.scene.scene_id);
          return { durationInFrames: Math.round((inputProps.scene.duration_s || 3) * 60) };
        },
        renderStill: async ({ frame, output }) => { calls.still.push({ frame, output }); },
      };
      const results = await renderStoryboardPanels(MANIFEST, SCENE_DEFS, { outputDir: dir, renderer });
      assert.equal(calls.bundle, 1);
      assert.deepEqual(calls.select, ['sc_open', 'sc_feature', 'sc_close']);
      assert.equal(calls.still[0].frame, 120); // mid of 240
      assert.equal(results.length, 3);
      assert.ok(results[0].path.endsWith('sc_open.png'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── Verification bookend ────────────────────────────────────────────────────

describe('verifyExportAgainstTree', () => {
  const payload = buildStoryboardExportPayload(MANIFEST, SCENE_DEFS);

  it('passes a file matching the contract and returns frame ids', () => {
    const result = verifyExportAgainstTree(payload, goodTree());
    assert.equal(result.ok, true);
    assert.equal(result.frame_ids['sb_sc_open'], '1:1');
  });

  it('fail-closes on missing, renamed, duplicated, and unexpected frames', () => {
    const missing = goodTree();
    missing.document.children[0].children.pop(); // drop sb_sc_close
    const r1 = verifyExportAgainstTree(payload, missing);
    assert.equal(r1.ok, false);
    assert.deepEqual(r1.missing_frames, ['sb_sc_close']);

    const renamed = goodTree();
    renamed.document.children[0].children[1].name = 'sb_sc_featurette';
    const r2 = verifyExportAgainstTree(payload, renamed);
    assert.equal(r2.ok, false);
    assert.deepEqual(r2.missing_frames, ['sb_sc_feature']);
    assert.deepEqual(r2.extra_frames, ['sb_sc_featurette']);

    const dup = goodTree();
    dup.document.children[0].children.push({ id: '1:9', name: 'sb_sc_open', type: 'FRAME', children: [] });
    const r3 = verifyExportAgainstTree(payload, dup);
    assert.equal(r3.ok, false);
    assert.deepEqual(r3.duplicate_frames, ['sb_sc_open']);
  });
});

// ── Comment round-trip ──────────────────────────────────────────────────────

describe('mapCommentsToScenes', () => {
  const tree = goodTree();
  const user = { handle: 'designer' };

  it('attributes via pinned frame, thread inheritance, and sb_ mention — and surfaces unmapped', () => {
    const comments = [
      { id: 'c1', message: 'Tighten this headline', user, client_meta: { node_id: '1:1' }, created_at: '2026-06-07T10:00:00Z' },
      { id: 'c2', message: 'Agree, and bump contrast', user, parent_id: 'c1' },
      { id: 'c3', message: 'sb_sc_feature feels too slow on entry', user },
      { id: 'c4', message: 'Love it overall!', user },
      { id: 'c5', message: 'sb_sc_missing does not exist', user },
    ];
    const result = mapCommentsToScenes(comments, tree);
    assert.deepEqual(Object.keys(result.scenes).sort(), ['sc_feature', 'sc_open']);
    assert.equal(result.scenes.sc_open.length, 2); // pin + reply inheritance
    assert.equal(result.scenes.sc_open[1].id, 'c2');
    assert.equal(result.scenes.sc_feature[0].id, 'c3');
    assert.equal(result.unmapped.length, 2); // c4 + mention of nonexistent frame
    assert.equal(result.total, 5);
  });

  it('attributes pins on frame CHILDREN — panel image / caption (PR #90 finding)', () => {
    const comments = [
      { id: 'c1', message: 'Crop this tighter', user, client_meta: { node_id: '1:10' } },  // panel image inside sb_sc_open
      { id: 'c2', message: 'Caption typo', user, client_meta: { node_id: '1:21' } },        // caption inside sb_sc_feature
    ];
    const result = mapCommentsToScenes(comments, tree);
    assert.equal(result.scenes.sc_open[0].id, 'c1');
    assert.equal(result.scenes.sc_feature[0].id, 'c2');
    assert.equal(result.unmapped.length, 0);
  });

  it('marks resolved comments', () => {
    const result = mapCommentsToScenes(
      [{ id: 'c1', message: 'done', user, client_meta: { node_id: '1:2' }, resolved_at: '2026-06-07T11:00:00Z' }],
      tree,
    );
    assert.equal(result.scenes.sc_feature[0].resolved, true);
  });
});

// ── Client additions (injectable fetch) ─────────────────────────────────────

describe('figma client — file tree + comments', () => {
  const ENV = { FIGMA_TOKEN: 'figd_test_not_real' };

  it('fetchFileTree hits /files/:key?depth=N', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ name: 'SB', document: goodTree().document }) };
    };
    const tree = await fetchFileTree('SBKEY', { depth: 3, fetchImpl, env: ENV });
    assert.match(calls[0], /\/files\/SBKEY\?depth=3$/);
    assert.equal(tree.document.children[0].children.length, 3);
  });

  it('fetchComments hits /files/:key/comments and defaults to []', async () => {
    const fetchImpl = async () =>
      ({ ok: true, status: 200, json: async () => ({}) });
    const { comments } = await fetchComments('https://www.figma.com/design/SBKEY/x', { fetchImpl, env: ENV });
    assert.deepEqual(comments, []);
  });
});
