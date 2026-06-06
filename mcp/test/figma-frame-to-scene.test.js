/**
 * Figma frame → scene conversion (ANI-114).
 *
 * Client tests run offline via injectable fetch; mapper tests run against
 * the checked-in fixture node tree (nested frames, auto-layout variants,
 * text typography, an image fill, a hidden layer). Acceptance is asserted
 * end-to-end: valid scene JSON → advisory annotation confidence →
 * compiles via compileMotion.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractFileKey,
  figmaColorToHex,
  fetchNode,
  getFigmaToken,
  normalizeNodeId,
  redactToken,
} from '../lib/figma/client.js';
import { autoLayoutToCss, frameToScene, nearestAnchor } from '../lib/figma/frame-to-scene.js';
import { compileMotion } from '../lib/compiler.js';
import { auditAnnotationQuality } from '../lib/scene-annotations.js';
import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadRecipes,
  loadShotGrammar,
} from '../data/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(__dirname, 'fixtures/figma-hero-frame.json'), 'utf-8'));

const ENV = { FIGMA_TOKEN: 'figd_test_not_real' };

// ── Client ──────────────────────────────────────────────────────────────────

describe('figma client', () => {
  it('extracts file keys from URLs and bare keys', () => {
    assert.equal(extractFileKey('ABCdef123'), 'ABCdef123');
    assert.equal(extractFileKey('https://www.figma.com/file/KEY99/My-File?node-id=1-2'), 'KEY99');
    assert.equal(extractFileKey('https://www.figma.com/design/DKEY/My-File'), 'DKEY');
    assert.equal(extractFileKey('not a figma thing'), null);
  });

  it('normalizes URL-style node ids', () => {
    assert.equal(normalizeNodeId('12-34'), '12:34');
    assert.equal(normalizeNodeId('12:34'), '12:34');
  });

  it('converts figma colors to hex (with conditional alpha)', () => {
    assert.equal(figmaColorToHex({ r: 1, g: 1, b: 1, a: 1 }), '#ffffff');
    assert.equal(figmaColorToHex({ r: 0, g: 0, b: 0, a: 0.5 }), '#00000080');
  });

  it('fails with a clear message when FIGMA_TOKEN is unset', () => {
    assert.throws(() => getFigmaToken({}), /FIGMA_TOKEN is not set/);
    assert.equal(redactToken('figd_supersecretvalue'), 'figd...alue');
  });

  it('fetchNode hits the nodes endpoint with the token header', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, headers: init.headers });
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: 'Product Site', nodes: { '10:1': { document: FIXTURE.document } } }),
      };
    };
    const result = await fetchNode('https://www.figma.com/design/FIXTUREKEY123/x?node-id=10-1', '10-1', { fetchImpl, env: ENV });
    assert.match(calls[0].url, /api\.figma\.com\/v1\/files\/FIXTUREKEY123\/nodes\?ids=10%3A1/);
    assert.equal(calls[0].headers['X-Figma-Token'], 'figd_test_not_real');
    assert.equal(result.document.name, 'Hero / Landing');
  });

  it('retries 429/5xx and surfaces mapped errors for 403/404', async () => {
    let n = 0;
    const flaky = async () => {
      n += 1;
      if (n < 3) return { ok: false, status: 429, text: async () => 'slow down' };
      return { ok: true, status: 200, json: async () => ({ nodes: { '1:1': { document: { id: '1:1', type: 'FRAME', name: 'f', children: [{ id: '1:2', name: 'Headline', type: 'TEXT', characters: 'x', style: { fontSize: 30 } }] } } } }) };
    };
    const r = await fetchNode('KEY', '1:1', { fetchImpl: flaky, env: ENV });
    assert.equal(n, 3);
    assert.equal(r.node_id, '1:1');

    const denied = async () => ({ ok: false, status: 403, text: async () => 'nope' });
    await assert.rejects(() => fetchNode('KEY', '1:1', { fetchImpl: denied, env: ENV }), /Figma API 403/);
  });
});

// ── Auto-layout mapping ─────────────────────────────────────────────────────

describe('autoLayoutToCss', () => {
  it('maps vertical auto-layout with padding, gap, and alignment', () => {
    const css = autoLayoutToCss(FIXTURE.document);
    assert.match(css, /display:flex/);
    assert.match(css, /flex-direction:column/);
    assert.match(css, /gap:32px/);
    assert.match(css, /padding:120px 160px 120px 160px/);
    assert.match(css, /justify-content:center/);
    assert.match(css, /align-items:center/);
  });

  it('maps horizontal space-between', () => {
    const row = FIXTURE.document.children.find(c => c.name === 'Feature Card Row');
    const css = autoLayoutToCss(row);
    assert.match(css, /flex-direction:row/);
    assert.match(css, /justify-content:space-between/);
  });

  it('returns null for non-auto-layout nodes', () => {
    assert.equal(autoLayoutToCss({ type: 'RECTANGLE' }), null);
  });
});

// ── frameToScene ────────────────────────────────────────────────────────────

describe('frameToScene', () => {
  const { scene, report } = frameToScene(FIXTURE, { personality: 'cinematic-dark' });

  it('produces a v3 scene with components ref-ing real layers', () => {
    assert.equal(scene.format_version, 3);
    assert.match(scene.scene_id, /^sc_hero_landing/);
    assert.ok(scene.layers.length >= 4);
    assert.equal(scene.semantic.components.length, scene.layers.length);
    for (const cmp of scene.semantic.components) {
      assert.ok(scene.layers.some(l => l.id === cmp.layer_ref), `layer_ref ${cmp.layer_ref} resolves`);
    }
  });

  it('infers roles from names + structure', () => {
    const roles = Object.fromEntries(report.components.map(c => [c.name, c.inferred_role]));
    assert.equal(roles['Headline'], 'hero');
    assert.equal(roles['CTA / Get Started Button'], 'cta');
    assert.equal(roles['Background Gradient'], 'atmosphere');
    assert.equal(roles['Feature Card Row'], 'supporting');
    // primary subject follows the hero
    assert.equal(scene.primary_subject, 'Headline');
  });

  it('preserves typography and nests auto-layout children as HTML', () => {
    const headline = scene.layers.find(l => l.product_role === 'hero');
    assert.match(headline.content, /Ship product stories, not screen recordings/);
    assert.match(headline.content, /font-size:72px/);
    assert.match(headline.content, /font-weight:700/);

    const cards = scene.layers.find(l => l.id.includes('feature_card_row'));
    assert.match(cards.content, /display:flex/);
    assert.match(cards.content, /Spring physics/); // nested frame content survives
    assert.match(cards.content, /data-image-fill="true"/);
    assert.equal(cards.content.includes('Hidden Draft Card'), false); // visible:false dropped
  });

  it('escapes text content', () => {
    const { scene: s } = frameToScene({
      document: {
        id: '1:1', type: 'FRAME', name: 'XSS',
        absoluteBoundingBox: { width: 100, height: 100 },
        children: [{ id: '1:2', name: 'Headline', type: 'TEXT', characters: '<script>alert(1)</script>', style: { fontSize: 30 } }],
      },
    });
    assert.equal(s.layers[0].content.includes('<script>'), false);
    assert.match(s.layers[0].content, /&lt;script&gt;/);
  });

  it('extracts a brand palette and records provenance', () => {
    assert.ok(scene.brand.palette.includes('#0a0a14')); // frame bg
    assert.equal(scene.source.kind, 'figma');
    assert.equal(scene.source.file_key, 'FIXTUREKEY123');
    assert.equal(report.auto_layout_frames >= 2, true);
    assert.equal(report.image_fills, 0); // image fill is nested, not a direct child
  });

  it('emits staggered entrances with the hero last', () => {
    const ints = scene.semantic.interactions;
    assert.equal(ints.length, scene.semantic.components.length);
    const heroInt = ints.find(i => i.target.startsWith('cmp_hero_'));
    assert.equal(heroInt.timing.at_ms, Math.max(...ints.map(i => i.timing.at_ms)));
    assert.equal(scene.semantic.camera_behavior.mode, 'reactive');
  });

  it('derives layout constraints from Figma geometry', () => {
    assert.equal(nearestAnchor(0.5, 0.9), 'bottom-center');
    assert.equal(nearestAnchor(0.1, 0.1), 'top-left');
    assert.equal(nearestAnchor(0.5, 0.5), 'center');

    const byName = Object.fromEntries(
      scene.semantic.components.map(c => [c.props.name, c]));
    // CTA sits at the bottom center of the fixture frame.
    assert.equal(byName['CTA / Get Started Button'].anchor, 'bottom-center');
    assert.equal(byName['CTA / Get Started Button'].max_width, 200);
    // Background covers the whole frame → center, full-canvas caps.
    assert.equal(byName['Background Gradient'].anchor, 'center');
    assert.equal(byName['Background Gradient'].max_width, 1920);
  });

  it('rejects non-frame nodes and empty frames', () => {
    assert.throws(() => frameToScene({ document: { id: '1:1', type: 'TEXT', name: 'loose text' } }), /not a frame/);
    assert.throws(() => frameToScene({ document: { id: '1:1', type: 'FRAME', name: 'empty', children: [] } }), /no visible children/);
  });
});

// ── Acceptance: annotation quality + compile ───────────────────────────────

describe('frameToScene acceptance (ANI-114)', () => {
  const { scene } = frameToScene(FIXTURE, { personality: 'cinematic-dark' });

  it('passes audit_annotation_quality at advisory confidence', () => {
    const audit = auditAnnotationQuality([scene], { mode: 'advisory' });
    const entry = Array.isArray(audit?.scenes) ? audit.scenes[0] : audit;
    // Advisory pass = no hard failures; surface whatever shape the audit returns.
    const failed = JSON.stringify(entry).includes('"severity":"fail"');
    assert.equal(failed, false, `advisory audit must not hard-fail: ${JSON.stringify(entry).slice(0, 400)}`);
  });

  it('compiles via compileMotion into a timeline', () => {
    const catalogs = {
      primitives: loadPrimitivesCatalog(),
      personalities: loadPersonalitiesCatalog(),
      recipes: loadRecipes(),
      shotGrammar: loadShotGrammar(),
    };
    // compileSemantic mutates — pass a deep copy.
    const timeline = compileMotion(structuredClone(scene), catalogs);
    assert.ok(timeline, 'semantic scene must compile');
    assert.ok(timeline.duration_frames > 0);
  });
});
