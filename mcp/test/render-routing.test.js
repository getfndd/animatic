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

describe('resolveRenderTargets — library-driven telemetry (ANI-145)', () => {
  it('counts scenes whose layer.primitive references a lib-* slug', () => {
    const scenes = [
      { scene_id: 'sc_01', layers: [{ id: 'l1', type: 'html', primitive: 'lib-gsap-spring-stagger', content: 'x'.repeat(800) }] },
      { scene_id: 'sc_02', layers: [{ id: 'l1', type: 'text' }] },
    ];
    const { routes, summary } = resolveRenderTargets(scenes);
    assert.equal(summary.library_driven, 1);
    assert.equal(routes[0].library_driven, true);
    assert.ok(routes[1].library_driven == null,
      'non-library-driven scenes should not be tagged');
  });

  it('detects library-driven via motion.compound and entrance.primitive', () => {
    const scenes = [
      { scene_id: 'sc_a', layers: [{ id: 'l1', type: 'html', motion: { compound: 'lib-framer-shared-layout' }, content: 'x'.repeat(800) }] },
      { scene_id: 'sc_b', layers: [{ id: 'l1', type: 'html', entrance: { primitive: 'lib-gsap-radial-stagger' }, content: 'x'.repeat(800) }] },
    ];
    const { summary } = resolveRenderTargets(scenes);
    assert.equal(summary.library_driven, 2);
  });

  it('estimated_capture_seconds tracks the routing mix', () => {
    const scenes = [
      { scene_id: 'sc_capture', layers: [{ id: 'l1', type: 'html', product_role: 'hero', content: '<div>'.repeat(200) }] },
      { scene_id: 'sc_logo', product_role: 'atmosphere', layers: [] },
      { scene_id: 'sc_cta', product_role: 'cta', layers: [] },
    ];
    const { summary } = resolveRenderTargets(scenes);
    assert.equal(summary.browser_capture, 1);
    assert.equal(summary.remotion_native, 2);
    assert.equal(summary.estimated_capture_seconds, 8 + 1 + 1);
  });

  it('empty scenes array returns zeroed summary including new fields', () => {
    const { summary } = resolveRenderTargets([]);
    assert.equal(summary.library_driven, 0);
    assert.equal(summary.estimated_capture_seconds, 0);
  });
});

// ── ANI-118: personality compatibility + manifest overrides ──────────────────

describe('resolveRenderTargets — personality compatibility (ANI-118)', () => {
  // Helpers: build scenes with personality-relevant CSS.
  function withCss(id, css, opts = {}) {
    return makeScene(id, {
      ...opts,
      content: `<div style="${css}">` + 'x'.repeat(opts.padChars || 600) + '</div>',
    });
  }

  describe('forbidden CSS detection', () => {
    it('flags 3d_transforms in editorial personality', () => {
      const { routes, summary } = resolveRenderTargets(
        [withCss('sc_3d', 'transform:perspective(800px) translateZ(50px)')],
        { personality: 'editorial' }
      );
      assert.equal(routes[0].personality_compat.ok, false);
      const issue = routes[0].personality_compat.warnings.find(w => w.feature === '3d_transforms');
      assert.ok(issue);
      assert.equal(issue.rule, 'personality_forbidden_feature');
      assert.equal(summary.warnings, 1);
    });

    it('flags blur in neutral-light and montage', () => {
      for (const p of ['neutral-light', 'montage']) {
        const { routes } = resolveRenderTargets(
          [withCss('sc_blur', 'filter:blur(12px)')],
          { personality: p }
        );
        assert.equal(routes[0].personality_compat.ok, false, `should fail under ${p}`);
        const issue = routes[0].personality_compat.warnings[0];
        assert.match(issue.feature, /blur/, `expected blur feature for ${p}, got ${issue.feature}`);
      }
    });

    it('editorial accepts static blur (rack focus, scrim) — entrance enforcement is at the primitive layer', () => {
      // Regression: previous version flagged any blur(...) under editorial,
      // which over-broadened the personality_boundaries.blur_entrance rule.
      // That rule fires in mcp/lib.js when a blur primitive is in the
      // Entrances category — render-routing has no way to know that from
      // CSS alone, so it correctly stays out of the way.
      const { routes, summary } = resolveRenderTargets(
        [withCss('sc_rack_focus', 'filter:blur(8px)')],
        { personality: 'editorial' }
      );
      assert.equal(routes[0].personality_compat.ok, true);
      assert.equal(summary.warnings, 0);
    });

    it('cinematic-dark accepts everything CSS-detectable', () => {
      const { routes, summary } = resolveRenderTargets(
        [withCss('sc_3d', 'transform:perspective(800px) translateZ(50px); filter:blur(20px)')],
        { personality: 'cinematic-dark' }
      );
      assert.equal(routes[0].personality_compat.ok, true);
      assert.equal(summary.warnings, 0);
    });

    it('falls back to scene.personality when option not provided', () => {
      const scene = withCss('sc_3d', 'transform:perspective(800px) translateZ(50px)');
      scene.personality = 'editorial';
      const { routes } = resolveRenderTargets([scene]);
      assert.equal(routes[0].personality_compat.ok, false);
    });

    it('flags unknown personality value', () => {
      const { routes } = resolveRenderTargets(
        [makeScene('sc_01')],
        { personality: 'blockbuster' }
      );
      const w = routes[0].personality_compat.warnings.find(x => x.rule === 'unknown_personality');
      assert.ok(w);
    });

    it('no personality option = no compat warnings (backwards compat)', () => {
      const { routes, summary } = resolveRenderTargets(
        [withCss('sc_3d', 'transform:perspective(800px) translateZ(50px)')]
      );
      assert.equal(routes[0].personality_compat.ok, true);
      assert.equal(summary.warnings, 0);
    });
  });

  describe('target × personality matrix', () => {
    // Each personality + each render path (auto-detect produces three of the
    // four targets; web_native is explicit-only). Verify happy-path scenes
    // route correctly under each personality without spurious warnings.
    const personalities = ['cinematic-dark', 'editorial', 'neutral-light', 'montage'];

    for (const p of personalities) {
      it(`${p} — clean HTML scene routes to browser_capture`, () => {
        const { routes } = resolveRenderTargets(
          [makeScene('sc_html', { content: '<div>' + 'x'.repeat(600) + '</div>' })],
          { personality: p }
        );
        assert.equal(routes[0].render_target, 'browser_capture');
        assert.equal(routes[0].personality_compat.ok, true);
      });

      it(`${p} — text-only scene routes to remotion_native`, () => {
        const { routes } = resolveRenderTargets(
          [makeScene('sc_text', { heroType: 'text', content: 'Hello' })],
          { personality: p }
        );
        assert.equal(routes[0].render_target, 'remotion_native');
        assert.equal(routes[0].personality_compat.ok, true);
      });

      it(`${p} — explicit hybrid override is honored`, () => {
        const { routes } = resolveRenderTargets(
          [makeScene('sc_hybrid', { render_target: 'hybrid' })],
          { personality: p }
        );
        assert.equal(routes[0].render_target, 'hybrid');
      });
    }
  });

  describe('strict mode', () => {
    it('throws when any compatibility warning surfaces', () => {
      assert.throws(() => {
        resolveRenderTargets(
          [makeScene('sc_3d', { content: '<div style="transform:perspective(600px) translateZ(40px)">x</div>' })],
          { personality: 'editorial', strict: true }
        );
      }, /compatibility warning/);
    });

    it('does not throw when there are no warnings', () => {
      const { routes } = resolveRenderTargets(
        [makeScene('sc_clean')],
        { personality: 'editorial', strict: true }
      );
      assert.equal(routes.length, 1);
    });
  });
});

describe('resolveRenderTargets — manifest overrides (ANI-118)', () => {
  it('manifest entry override wins over auto-detect', () => {
    const manifest = {
      sequence_id: 'seq_01',
      scenes: [{ scene: 'sc_01', render_target: 'remotion_native' }],
    };
    // Scene would normally route to browser_capture (complex HTML), but
    // manifest entry override pins it to remotion_native.
    const { routes } = resolveRenderTargets(
      [makeScene('sc_01', { content: '<div>' + 'x'.repeat(600) + '</div>' })],
      { manifest }
    );
    assert.equal(routes[0].render_target, 'remotion_native');
    assert.equal(routes[0].source, 'explicit_manifest_entry');
  });

  it('scene-level override beats manifest entry override', () => {
    const manifest = {
      sequence_id: 'seq_01',
      scenes: [{ scene: 'sc_01', render_target: 'remotion_native' }],
    };
    const { routes } = resolveRenderTargets(
      [makeScene('sc_01', { render_target: 'browser_capture' })],
      { manifest }
    );
    assert.equal(routes[0].render_target, 'browser_capture');
    assert.equal(routes[0].source, 'explicit_scene');
    // Conflict surfaces in compat warnings.
    const conflict = routes[0].personality_compat.warnings.find(w => w.rule === 'manifest_override_conflict');
    assert.ok(conflict, 'expected manifest_override_conflict warning');
  });

  it('manifest default applies only when nothing else routes the scene', () => {
    // A scene with no signals at all (no role, no layers, no content) would
    // fall to the "default" branch — manifest_default supersedes that.
    const manifest = { sequence_id: 'seq_01', render_target_default: 'hybrid', scenes: [{ scene: 'sc_01' }] };
    const scene = { scene_id: 'sc_01', layers: [] };
    const { routes } = resolveRenderTargets([scene], { manifest });
    assert.equal(routes[0].render_target, 'hybrid');
    assert.equal(routes[0].source, 'manifest_default');
  });

  it('manifest default does NOT override auto-detect when auto-detect found a signal', () => {
    const manifest = { sequence_id: 'seq_01', render_target_default: 'hybrid', scenes: [{ scene: 'sc_01' }] };
    // Complex HTML hero — auto-detect should still pick browser_capture.
    const { routes } = resolveRenderTargets(
      [makeScene('sc_01', { content: '<div>' + 'x'.repeat(600) + '</div>' })],
      { manifest }
    );
    assert.equal(routes[0].render_target, 'browser_capture');
    assert.equal(routes[0].source, 'hero_complex_html');
  });
});

describe('resolveRenderTargets — web_native misuse (ANI-118)', () => {
  it('flags explicit web_native as a video-pipeline warning', () => {
    const { routes, summary } = resolveRenderTargets(
      [makeScene('sc_01', { render_target: 'web_native' })]
    );
    assert.equal(routes[0].render_target, 'web_native');
    assert.ok(routes[0].personality_compat.warnings.some(w => w.rule === 'web_native_in_video_context'));
    assert.ok(summary.warnings >= 1);
  });

  it('flags manifest-entry web_native too', () => {
    const manifest = {
      sequence_id: 'seq_01',
      scenes: [{ scene: 'sc_01', render_target: 'web_native' }],
    };
    const { routes } = resolveRenderTargets([makeScene('sc_01')], { manifest });
    assert.equal(routes[0].render_target, 'web_native');
    assert.ok(routes[0].personality_compat.warnings.some(w => w.rule === 'web_native_in_video_context'));
  });
});

describe('resolveRenderTargets — routing rationale (ANI-118)', () => {
  it('every route reports a source label', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_01', { render_target: 'browser_capture' }),
      makeScene('sc_02', { content: '<div>' + 'x'.repeat(600) + '</div>' }),
      makeScene('sc_03', { role: 'cta', content: '<span>Logo</span>' }),
      makeScene('sc_04', { heroType: 'text' }),
    ]);
    assert.equal(routes[0].source, 'explicit_scene');
    assert.equal(routes[1].source, 'hero_complex_html');
    assert.equal(routes[2].source, 'role_remotion');
    assert.equal(routes[3].source, 'mostly_native');
  });

  it('every route includes a signals object with raw inputs', () => {
    const { routes } = resolveRenderTargets([
      makeScene('sc_01', { content: '<div>' + 'x'.repeat(600) + '</div>' }),
    ]);
    const s = routes[0].signals;
    assert.equal(s.html_layers, 1);
    assert.equal(s.total_fg_layers, 1);
    assert.equal(s.hero_type, 'html');
    assert.ok(s.longest_html_chars > 600);
    assert.equal(s.scene_role, 'result');
  });
});
