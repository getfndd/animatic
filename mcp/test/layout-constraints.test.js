/**
 * Layout constraints tests (ANI-74).
 *
 * Run: node --test mcp/test/layout-constraints.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NAMED_ANCHORS,
  COMPONENT_SIZE_DEFAULTS,
  resolveNamedAnchor,
  computeComponentSize,
  enforceGaps,
  resolveComponentLayout,
} from '../lib/layout-constraints.js';

// ── Named anchor resolution ─────────────────────────────────────────────────

describe('resolveNamedAnchor', () => {
  it('resolves all 9 named anchors', () => {
    const names = Object.keys(NAMED_ANCHORS);
    assert.equal(names.length, 9);
    for (const name of names) {
      const anchor = resolveNamedAnchor(name);
      assert.ok(anchor.x >= 0 && anchor.x <= 1, `${name}.x out of range`);
      assert.ok(anchor.y >= 0 && anchor.y <= 1, `${name}.y out of range`);
    }
  });

  it('center is at 0.5, 0.5', () => {
    const a = resolveNamedAnchor('center');
    assert.equal(a.x, 0.5);
    assert.equal(a.y, 0.5);
  });

  it('top-left is at 0.15, 0.15', () => {
    const a = resolveNamedAnchor('top-left');
    assert.equal(a.x, 0.15);
    assert.equal(a.y, 0.15);
  });

  it('falls back to center for unknown anchor', () => {
    const a = resolveNamedAnchor('nowhere');
    assert.equal(a.x, 0.5);
    assert.equal(a.y, 0.5);
  });
});

// ── Component sizing ────────────────────────────────────────────────────────

describe('computeComponentSize', () => {
  it('uses type defaults for known components', () => {
    const size = computeComponentSize({ type: 'prompt_card' }, 1920, 1080);
    assert.equal(size.w, Math.round(0.5 * 1920));
    assert.equal(size.h, Math.round(0.15 * 1080));
  });

  it('uses fallback size for unknown types', () => {
    const size = computeComponentSize({ type: 'custom_widget' }, 1920, 1080);
    assert.equal(size.w, Math.round(0.3 * 1920));
    assert.equal(size.h, Math.round(0.2 * 1080));
  });

  it('caps width with max_width', () => {
    const size = computeComponentSize({ type: 'prompt_card', max_width: 400 }, 1920, 1080);
    assert.equal(size.w, 400);
  });

  it('caps height with max_height', () => {
    const size = computeComponentSize({ type: 'result_stack', max_height: 100 }, 1920, 1080);
    assert.equal(size.h, 100);
  });
});

// ── Gap enforcement ─────────────────────────────────────────────────────────

describe('enforceGaps', () => {
  it('pushes overlapping rects apart', () => {
    const positions = new Map([
      ['a', { x: 100, y: 100, w: 200, h: 100 }],
      ['b', { x: 150, y: 100, w: 200, h: 100 }], // overlaps a
    ]);
    enforceGaps(positions, [], 20);
    const a = positions.get('a');
    const b = positions.get('b');
    // After enforcement, rects should not overlap (including gap)
    const separated = (a.x + a.w + 20 <= b.x) || (b.x + b.w + 20 <= a.x) ||
                      (a.y + a.h + 20 <= b.y) || (b.y + b.h + 20 <= a.y);
    assert.ok(separated, `Rects still overlap: a=${JSON.stringify(a)}, b=${JSON.stringify(b)}`);
  });

  it('does not move already separated rects', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0, w: 100, h: 100 }],
      ['b', { x: 500, y: 500, w: 100, h: 100 }],
    ]);
    enforceGaps(positions, [], 20);
    assert.deepEqual(positions.get('a'), { x: 0, y: 0, w: 100, h: 100 });
    assert.deepEqual(positions.get('b'), { x: 500, y: 500, w: 100, h: 100 });
  });
});

// ── Full layout resolution ──────────────────────────────────────────────────

describe('resolveComponentLayout', () => {
  it('positions a single center component', () => {
    const components = [{ id: 'hero', type: 'prompt_card', anchor: 'center' }];
    const map = resolveComponentLayout(components, 1920, 1080);
    assert.ok(map.has('hero'));
    const pos = map.get('hero');
    // Center of 1920x1080 minus half size
    const expectedW = Math.round(0.5 * 1920);
    const expectedH = Math.round(0.15 * 1080);
    assert.equal(pos.w, expectedW);
    assert.equal(pos.h, expectedH);
    assert.equal(pos.x, 960 - Math.round(expectedW / 2));
    assert.equal(pos.y, 540 - Math.round(expectedH / 2));
  });

  it('positions components at different anchors without overlap', () => {
    const components = [
      { id: 'hero', type: 'prompt_card', anchor: 'center' },
      { id: 'support', type: 'result_stack', anchor: 'bottom-center' },
    ];
    const map = resolveComponentLayout(components, 1920, 1080);
    const hero = map.get('hero');
    const support = map.get('support');
    // Both should have valid positions
    assert.ok(hero.w > 0 && hero.h > 0);
    assert.ok(support.w > 0 && support.h > 0);
    // Should not overlap (y-separated since center vs bottom-center)
    const yOverlap = hero.y < support.y + support.h && support.y < hero.y + hero.h;
    const xOverlap = hero.x < support.x + support.w && support.x < hero.x + hero.w;
    if (xOverlap && yOverlap) {
      assert.fail('Components should not overlap');
    }
  });

  it('defaults to center when no anchor specified', () => {
    const components = [{ id: 'widget', type: 'input_field' }];
    const map = resolveComponentLayout(components, 1920, 1080);
    const pos = map.get('widget');
    // Should be centered
    const expectedW = Math.round(0.45 * 1920);
    const expectedH = Math.round(0.08 * 1080);
    assert.equal(pos.x, 960 - Math.round(expectedW / 2));
    assert.equal(pos.y, 540 - Math.round(expectedH / 2));
  });

  it('returns empty map for empty components', () => {
    const map = resolveComponentLayout([], 1920, 1080);
    assert.equal(map.size, 0);
  });
});

// ── Integration: compileSemantic produces layers with positions ──────────────

describe('compileSemantic layout wiring', () => {
  it('compileSemantic adds position to generated layers', async () => {
    const { compileMotion } = await import('../lib/compiler.js');
    const scene = {
      scene_id: 'layout-test',
      duration_s: 3,
      fps: 60,
      semantic: {
        components: [
          { id: 'hero', type: 'prompt_card', anchor: 'center' },
          { id: 'results', type: 'result_stack', anchor: 'bottom-center' },
        ],
        interactions: [
          { id: 'fade-hero', target: 'hero', kind: 'appear', timing: { start_ms: 0 }, duration_ms: 500 },
        ],
      },
    };
    compileMotion(scene, {});
    // Layers should have position data
    const heroLayer = scene.layers.find(l => l.id === 'hero');
    const resultsLayer = scene.layers.find(l => l.id === 'results');
    assert.ok(heroLayer, 'hero layer should exist');
    assert.ok(resultsLayer, 'results layer should exist');
    assert.ok(heroLayer.position, 'hero should have position');
    assert.ok(resultsLayer.position, 'results should have position');
    assert.ok(heroLayer.position.w > 0, 'hero width should be > 0');
    assert.ok(resultsLayer.position.h > 0, 'results height should be > 0');
  });
});
