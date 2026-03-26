/**
 * Tests for video assembly pipeline.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { assembleVideoSequence, buildRenderCommand } from '../lib/video-assembly.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const manifest = {
  sequence_id: 'seq_test',
  fps: 60,
  resolution: { w: 1920, h: 1080 },
  scenes: [
    { scene: 'sc_01', duration_s: 3 },
    { scene: 'sc_02', duration_s: 5, transition_in: { type: 'crossfade', duration_ms: 400 } },
    { scene: 'sc_03', duration_s: 4, transition_in: { type: 'crossfade', duration_ms: 400 } },
  ],
};

const sceneDefs = {
  sc_01: {
    scene_id: 'sc_01',
    product_role: 'atmosphere',
    layers: [{ id: 'title', type: 'text', depth_class: 'foreground', product_role: 'hero' }],
  },
  sc_02: {
    scene_id: 'sc_02',
    product_role: 'result',
    layers: [
      { id: 'bg', type: 'html', depth_class: 'background' },
      { id: 'panel', type: 'html', depth_class: 'foreground', product_role: 'hero', content: '<div>' + 'x'.repeat(600) + '</div>' },
    ],
  },
  sc_03: {
    scene_id: 'sc_03',
    product_role: 'cta',
    layers: [{ id: 'logo', type: 'text', depth_class: 'foreground', product_role: 'hero' }],
  },
};

// ── assembleVideoSequence ───────────────────────────────────────────────────

describe('assembleVideoSequence', () => {
  it('returns renderProps with manifest and sceneDefs', () => {
    const result = assembleVideoSequence({ manifest, sceneDefs });
    assert.ok(result.renderProps);
    assert.ok(result.renderProps.manifest);
    assert.ok(result.renderProps.sceneDefs);
    assert.ok(result.renderProps.sceneRoutes);
  });

  it('auto-resolves render targets when routes not provided', () => {
    const result = assembleVideoSequence({ manifest, sceneDefs, scenes: Object.values(sceneDefs) });
    assert.ok(result.sceneRoutes);
    // sc_01 (atmosphere/text) → remotion_native
    assert.equal(result.sceneRoutes.sc_01.render_target, 'remotion_native');
    // sc_03 (cta/text) → remotion_native
    assert.equal(result.sceneRoutes.sc_03.render_target, 'remotion_native');
  });

  it('uses pre-resolved routes when provided', () => {
    const routes = {
      sc_01: { render_target: 'remotion_native' },
      sc_02: { render_target: 'browser_capture' },
      sc_03: { render_target: 'remotion_native' },
    };
    const result = assembleVideoSequence({ manifest, sceneDefs, routes });
    // sc_02 requested browser_capture but no plate → falls back to remotion_native
    assert.equal(result.sceneRoutes.sc_02.render_target, 'remotion_native');
    assert.ok(result.warnings.some(w => w.includes('sc_02')));
  });

  it('uses plate asset when provided and exists', () => {
    const tmpFile = path.join(os.tmpdir(), 'test-plate.mp4');
    fs.writeFileSync(tmpFile, 'fake plate');

    try {
      const routes = { sc_02: { render_target: 'browser_capture' } };
      const plates = { sc_02: { src: tmpFile, format: 'mp4' } };
      const result = assembleVideoSequence({ manifest, sceneDefs, routes, plates });

      assert.equal(result.sceneRoutes.sc_02.render_target, 'browser_capture');
      assert.equal(result.sceneRoutes.sc_02.plate_src, tmpFile);
      assert.equal(result.plateStatus.sc_02.status, 'ready');
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  });

  it('warns when plate is missing', () => {
    const routes = { sc_02: { render_target: 'browser_capture' } };
    const plates = { sc_02: { src: '/nonexistent/plate.mp4' } };
    const result = assembleVideoSequence({ manifest, sceneDefs, routes, plates });

    assert.equal(result.plateStatus.sc_02.status, 'missing');
    assert.ok(result.warnings.length > 0);
    // Falls back to remotion_native
    assert.equal(result.sceneRoutes.sc_02.render_target, 'remotion_native');
  });

  it('reports native status for remotion_native scenes', () => {
    const result = assembleVideoSequence({ manifest, sceneDefs, scenes: Object.values(sceneDefs) });
    assert.equal(result.plateStatus.sc_01.status, 'native');
    assert.equal(result.plateStatus.sc_03.status, 'native');
  });

  it('throws for missing manifest', () => {
    assert.throws(
      () => assembleVideoSequence({ manifest: null }),
      { message: /requires a manifest/ }
    );
  });
});

// ── buildRenderCommand ──────────────────────────────────────────────────────

describe('buildRenderCommand', () => {
  it('builds a valid Remotion CLI command', () => {
    const cmd = buildRenderCommand({
      propsPath: 'out/render-props.json',
      outputPath: 'out/final.mp4',
    });
    assert.ok(cmd.includes('npx remotion render Sequence'));
    assert.ok(cmd.includes('--props'));
    assert.ok(cmd.includes('render-props.json'));
    assert.ok(cmd.includes('final.mp4'));
    assert.ok(cmd.includes('--codec h264'));
  });

  it('accepts custom codec and crf', () => {
    const cmd = buildRenderCommand({
      propsPath: 'props.json',
      outputPath: 'out.webm',
      options: { codec: 'vp8', crf: 20 },
    });
    assert.ok(cmd.includes('--codec vp8'));
    assert.ok(cmd.includes('--crf 20'));
  });
});
