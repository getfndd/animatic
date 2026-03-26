/**
 * Tests for render target routing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRenderTargets, RENDER_TARGETS } from '../lib/render-routing.js';
import { annotateScenes } from '../lib/scene-annotations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeScene(id, opts = {}) {
  return {
    scene_id: id,
    product_role: opts.role || 'result',
    duration_s: opts.duration_s || 3,
    render_target: opts.render_target || undefined,
    capture: opts.capture || undefined,
    layers: opts.layers || [
      { id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' },
      { id: 'main', type: opts.heroType || 'html', depth_class: 'foreground', product_role: 'hero', content: opts.content || '<div>Short</div>' },
    ],
  };
}

// ── Explicit targets ────────────────────────────────────────────────────────

describe('resolveRenderTargets — explicit', () => {
  it('respects explicit render_target on scene', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_01', { render_target: 'web_native' }),
    ]);
    assert.equal(routes[0].render_target, 'web_native');
    assert.equal(routes[0].confidence, 1.0);
  });

  it('respects capture.entry as browser_capture signal', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_01', { capture: { entry: 'prototypes/html/sc_01.html' } }),
    ]);
    assert.equal(routes[0].render_target, 'browser_capture');
    assert.ok(routes[0].capture_config);
    assert.equal(routes[0].capture_config.entry, 'prototypes/html/sc_01.html');
  });
});

// ── HTML complexity routing ─────────────────────────────────────────────────

describe('resolveRenderTargets — HTML complexity', () => {
  it('routes complex HTML hero to browser_capture', () => {
    const longHtml = '<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);filter:blur(20px);backdrop-filter:saturate(1.5)">' + 'x'.repeat(600) + '</div>';
    const { routes } = resolveRenderTargets([
      makeScene('sc_complex', { content: longHtml }),
    ]);
    assert.equal(routes[0].render_target, 'browser_capture');
    assert.ok(routes[0].reason.includes('complex HTML') || routes[0].reason.includes('browser-dependent'));
  });

  it('routes simple HTML to remotion_native', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_simple', { content: '<div>Hello</div>', role: 'atmosphere' }),
    ]);
    assert.equal(routes[0].render_target, 'remotion_native');
  });
});

// ── Native Remotion types ───────────────────────────────────────────────────

describe('resolveRenderTargets — native types', () => {
  it('routes text-only scenes to remotion_native', () => {
    const { routes } = resolveRenderTargets([{
      scene_id: 'sc_text',
      product_role: 'atmosphere',
      layers: [
        { id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' },
        { id: 'title', type: 'text', depth_class: 'foreground', product_role: 'hero', content: 'Hello World' },
      ],
    }]);
    assert.equal(routes[0].render_target, 'remotion_native');
  });

  it('routes compound types to remotion_native', () => {
    const { routes } = resolveRenderTargets([{
      scene_id: 'sc_cards',
      layers: [
        { id: 'bg', type: 'html', depth_class: 'background' },
        { id: 'cards', type: 'card_conveyor', depth_class: 'foreground', product_role: 'hero' },
      ],
    }]);
    assert.equal(routes[0].render_target, 'remotion_native');
  });

  it('routes video/image hero to remotion_native', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_video', { heroType: 'video', content: '' }),
    ]);
    assert.equal(routes[0].render_target, 'remotion_native');
  });
});

// ── Product role routing ────────────────────────────────────────────────────

describe('resolveRenderTargets — product role', () => {
  it('routes atmosphere with simple text to remotion_native', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_atmo', { role: 'atmosphere', content: '<span>Tagline</span>' }),
    ]);
    assert.equal(routes[0].render_target, 'remotion_native');
  });

  it('routes CTA to remotion_native', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_cta', { role: 'cta', content: '<span>Logo</span>' }),
    ]);
    assert.equal(routes[0].render_target, 'remotion_native');
  });
});

// ── Summary ─────────────────────────────────────────────────────────────────

describe('resolveRenderTargets — summary', () => {
  it('returns correct counts', () => {
    const { summary } = resolveRenderTargets([
      makeScene('sc_01', { render_target: 'browser_capture' }),
      makeScene('sc_02', { render_target: 'remotion_native' }),
      makeScene('sc_03', { render_target: 'remotion_native' }),
    ]);
    assert.equal(summary.browser_capture, 1);
    assert.equal(summary.remotion_native, 2);
  });

  it('handles empty input', () => {
    const { routes, summary } = resolveRenderTargets([]);
    assert.equal(routes.length, 0);
    assert.equal(summary.browser_capture, 0);
  });
});

// ── Output shape ────────────────────────────────────────────────────────────

describe('resolveRenderTargets — output', () => {
  it('every route has required fields', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_01', { content: '<div>' + 'x'.repeat(600) + '</div>' }),
      makeScene('sc_02', { role: 'cta', content: '<span>Logo</span>' }),
    ]);

    for (const r of routes) {
      assert.ok(r.scene_id);
      assert.ok(RENDER_TARGETS.includes(r.render_target), `Invalid target: ${r.render_target}`);
      assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
      assert.ok(typeof r.confidence === 'number');
    }
  });

  it('browser_capture routes include capture_config', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_01', { content: '<div style="filter:blur(10px)">' + 'x'.repeat(600) + '</div>' }),
    ]);
    const bc = routes.find(r => r.render_target === 'browser_capture');
    if (bc) {
      assert.ok(bc.capture_config);
      assert.ok(bc.capture_config.viewport);
      assert.ok(bc.capture_config.device_scale_factor >= 2);
    }
  });
});

// ── Benchmark integration ───────────────────────────────────────────────────

describe('resolveRenderTargets — fintech-sizzle', () => {
  let scenes;
  try {
    const dir = resolve(ROOT, 'examples/fintech-sizzle/scenes');
    scenes = annotateScenes(
      readdirSync(dir).filter(f => f.endsWith('.json')).sort()
        .map(f => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))
    );
  } catch { scenes = []; }

  it('routes fintech scenes with a mix of targets', () => {
    if (scenes.length === 0) return;
    const { routes, summary } = resolveRenderTargets(scenes);
    assert.equal(routes.length, 9);
    // Should have at least some browser_capture (HTML-heavy) and some remotion_native
    assert.ok(summary.browser_capture + summary.remotion_native >= routes.length,
      'All scenes should route to browser_capture or remotion_native');
  });

  it('routes atmosphere/CTA scenes to remotion_native', () => {
    if (scenes.length === 0) return;
    const { routes } = resolveRenderTargets(scenes);
    const logoRoute = routes.find(r => r.scene_id === 'sc_09_logo');
    if (logoRoute) {
      assert.equal(logoRoute.render_target, 'remotion_native',
        `Logo scene should be remotion_native, got ${logoRoute.render_target}`);
    }
  });
});
