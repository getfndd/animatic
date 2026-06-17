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

import { mkdtempSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import zlib from 'node:zlib';

import {
  extractFileKey,
  figmaColorToHex,
  fetchNode,
  fetchImageFills,
  downloadBinary,
  sniffImage,
  getFigmaToken,
  normalizeNodeId,
  redactToken,
} from '../lib/figma/client.js';
import {
  autoLayoutToCss,
  frameToScene,
  nearestAnchor,
  collectImageFills,
  cropFillCss,
} from '../lib/figma/frame-to-scene.js';
import { handleFigmaFrameToScene } from '../handlers.js';
import { openHeroCaptureSession } from '../lib/hero-frame-capture.js';
import { decodeImage } from '../lib/pixel-diff.js';
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

  it('sizes layer roots and filled leaves so fill-only nodes paint (PR #89 findings)', () => {
    // The full-frame background rectangle is a childless filled node — as a
    // bare div it collapsed to 0 height and never painted. The root must be
    // absolute/inset:0 (not width/height:100%): the renderer's HtmlLayer
    // embeds fragments in an iframe srcDoc where a percentage height chain
    // doesn't exist, but absolute positioning anchors to the viewport.
    const bgLayer = scene.layers.find(l => l.product_role === 'atmosphere');
    assert.match(bgLayer.content, /^<div [^>]*style="position:absolute;inset:0;margin:0;box-sizing:border-box/);

    // Nested childless filled node (the image card) holds explicit px dims.
    const cards = scene.layers.find(l => l.id.includes('feature_card_row'));
    assert.match(cards.content, /data-image-fill="true"[^>]*style="[^"]*width:384px;height:260px/);

    // Every layer root fills its embedding, filled or not, text or not.
    for (const layer of scene.layers) {
      assert.match(layer.content, /position:absolute;inset:0/, `${layer.id} root must fill its embedding`);
    }
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

// ── Image-fill export (ANI-175) ──────────────────────────────────────────────

/** Minimal RGB PNG encoder (no deps) — real, decodable bytes for sniff/render. */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makePng(width, height, rgbAt) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, color type 2 (RGB)
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgbAt(x, y);
      const o = y * (stride + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
const jsonRes = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const binRes = (buf, type) => ({
  ok: true, status: 200,
  arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  headers: { get: (k) => (k.toLowerCase() === 'content-type' ? type : null) },
});

describe('sniffImage', () => {
  it('detects PNG with intrinsic dims', () => {
    const png = makePng(12, 8, () => [255, 0, 0]);
    assert.deepEqual(sniffImage(png), { ok: true, ext: 'png', mime: 'image/png', width: 12, height: 8 });
  });

  it('detects JPEG with SOF dims and picks the .jpg extension', () => {
    // SOI, then SOF0 (FF C0) len=17, precision 8, H=30, W=40.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e, 0x00, 0x28, 0x03, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(sniffImage(jpeg), { ok: true, ext: 'jpg', mime: 'image/jpeg', width: 40, height: 30 });
  });

  it('recognizes GIF; rejects non-image bytes with a reason', () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x0a, 0x00, 0x14, 0x00, 0x00, 0x00]);
    assert.deepEqual(sniffImage(gif), { ok: true, ext: 'gif', mime: 'image/gif', width: 10, height: 20 });

    const junk = Buffer.from('this is plainly not an image payload', 'utf-8');
    const r = sniffImage(junk);
    assert.equal(r.ok, false);
    assert.match(r.reason, /unrecognized image format/);
  });
});

describe('figma image-fill client (ANI-175)', () => {
  it('fetchImageFills hits /images with the token header and returns the ref→url map', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, headers: init.headers });
      return jsonRes({ meta: { images: { 'img-abc123': 'https://s3.example/a.png' } } });
    };
    const { images } = await fetchImageFills('FIXTUREKEY123', { fetchImpl, env: ENV });
    assert.match(calls[0].url, /api\.figma\.com\/v1\/files\/FIXTUREKEY123\/images$/);
    assert.equal(calls[0].headers['X-Figma-Token'], 'figd_test_not_real');
    assert.equal(images['img-abc123'], 'https://s3.example/a.png');
  });

  it('downloadBinary returns bytes, sends NO Figma token to the S3 URL, and retries 5xx', async () => {
    const png = makePng(4, 4, () => [10, 20, 30]);
    let n = 0;
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      n += 1;
      if (n < 2) return { ok: false, status: 503, text: async () => 'unavailable' };
      return binRes(png, 'image/png');
    };
    const out = await downloadBinary('https://s3.example/a.png', { fetchImpl });
    assert.equal(n, 2); // retried once
    assert.equal(out.bytes, png.length);
    assert.equal(out.contentType, 'image/png');
    // The presigned S3 request must not carry Figma auth.
    for (const c of calls) assert.ok(!c.init?.headers?.['X-Figma-Token'], 'no token to S3');
  });
});

describe('collectImageFills (ANI-175)', () => {
  it('finds the nested image fill per direct child (depth origin = 0)', () => {
    const children = FIXTURE.document.children.filter(c => c.visible !== false);
    const fills = children.flatMap(c => collectImageFills(c, 0));
    assert.deepEqual(fills, [{ nodeId: '10:6', imageRef: 'img-abc123' }]);
  });
});

describe('cropFillCss (ANI-175)', () => {
  it('identity → full-frame pan/zoom', () => {
    assert.deepEqual(cropFillCss([[1, 0, 0], [0, 1, 0]]), { mode: 'panzoom', widthPct: 100, heightPct: 100, leftPct: 0, topPct: 0 });
  });
  it('2× center zoom → 200% sized, -50% offset', () => {
    assert.deepEqual(cropFillCss([[0.5, 0, 0.25], [0, 0.5, 0.25]]), { mode: 'panzoom', widthPct: 200, heightPct: 200, leftPct: -50, topPct: -50 });
  });
  it('right-half crop → 200% wide, full height, -100% left', () => {
    assert.deepEqual(cropFillCss([[0.5, 0, 0.5], [0, 1, 0]]), { mode: 'panzoom', widthPct: 200, heightPct: 100, leftPct: -100, topPct: 0 });
  });
  it('90° rotation (anti-diagonal) → matrix mode', () => {
    const r = cropFillCss([[0, 1, 0], [-1, 0, 1]], 800, 600);
    assert.equal(r.mode, 'matrix');
    assert.match(r.css, /^matrix\(/);
  });
  it('genuine shear → null even with a known box (not a fill DOF — degrade honestly)', () => {
    assert.equal(cropFillCss([[1, 0.3, 0], [0.2, 1, 0]], 100, 100), null);
    assert.equal(cropFillCss([[1, 0.3, 0], [0.2, 1, 0]], null, null), null);
  });
  it('non-90° rotation (diagonal + anti-diagonal both present) → null', () => {
    const t = Math.SQRT1_2; // 45°: [[c,-s],[s,c]]
    assert.equal(cropFillCss([[t, -t, 0], [t, t, 0]], 100, 100), null);
  });
  it('non-invertible transform → null', () => {
    assert.equal(cropFillCss([[0, 0, 0], [0, 0, 0]]), null);
  });
});

describe('frameToScene image-fill embedding (ANI-175)', () => {
  const asset = { dataUri: 'data:image/png;base64,AAAA', assetPath: 'assets/figma_img-abc123.png', width: 384, height: 260 };

  it('embeds an <img> data-URI behind children when imageAssets is provided', () => {
    const { scene, report } = frameToScene(FIXTURE, { imageAssets: { '10:6': asset } });
    const cards = scene.layers.find(l => l.id.includes('feature_card_row'));
    assert.match(cards.content, /<img data-image-fill-asset alt="" src="data:image\/png;base64,AAAA"/);
    assert.match(cards.content, /object-fit:cover/);                 // FILL default
    assert.match(cards.content, /data-asset-path="assets\/figma_img-abc123\.png"/);
    assert.equal(cards.content.includes('background:#222'), false); // placeholder replaced
    assert.ok(report.exported_assets === undefined); // handler attaches that, not the pure converter
    assert.equal(report.rendered_image_fills, 1);
  });

  it('keeps the dark placeholder when no asset is supplied', () => {
    const { scene } = frameToScene(FIXTURE);
    const cards = scene.layers.find(l => l.id.includes('feature_card_row'));
    assert.match(cards.content, /background:#222/);
    assert.equal(cards.content.includes('data-image-fill-asset'), false);
  });

  it('CROP pan/zoom emits percentage sizing; shear w/o dims degrades to cover + advisory', () => {
    const cropNode = (transform, box) => ({
      document: {
        id: 'f', type: 'FRAME', name: 'Crop', absoluteBoundingBox: { width: 800, height: 600 },
        children: [{
          id: 'n1', name: 'Photo', type: 'FRAME', ...(box ? { absoluteBoundingBox: box } : {}),
          fills: [{ type: 'IMAGE', visible: true, imageRef: 'r1', scaleMode: 'CROP', imageTransform: transform }],
          children: [{ id: 'n2', name: 'Caption', type: 'TEXT', characters: 'hi', style: { fontSize: 20 } }],
        }],
      },
    });
    // pan/zoom → 200% width, no transform:matrix; caption still rendered on top.
    const pz = frameToScene(cropNode([[0.5, 0, 0.25], [0, 0.5, 0.25]], { width: 400, height: 300 }), { imageAssets: { n1: asset } });
    const pzLayer = pz.scene.layers[0];
    assert.match(pzLayer.content, /width:200%/);
    assert.equal(pzLayer.content.includes('transform:matrix'), false);
    assert.match(pzLayer.content, /z-index:1">.*hi/); // caption above the fill
    assert.ok(!(pz.report.advisory || []).some(a => /unsupported/.test(a)));

    // shear → degrade to cover + advisory (even with dims + box known).
    const sh = frameToScene(cropNode([[1, 0.3, 0], [0.2, 1, 0]], { width: 400, height: 300 }), { imageAssets: { n1: asset } });
    assert.match(sh.scene.layers[0].content, /object-fit:cover/);
    assert.ok(sh.report.advisory.some(a => /CROP fell back to cover — unsupported transform/.test(a)));

    // unknown source dimensions (e.g. unparsed WebP/GIF) → degrade + a distinct advisory.
    const noDims = frameToScene(cropNode([[0.5, 0, 0.25], [0, 0.5, 0.25]], { width: 400, height: 300 }), { imageAssets: { n1: { dataUri: asset.dataUri, width: null, height: null } } });
    assert.match(noDims.scene.layers[0].content, /object-fit:cover/);
    assert.ok(noDims.report.advisory.some(a => /CROP fell back to cover — unknown source dimensions/.test(a)));
  });
});

describe('handleFigmaFrameToScene export_images (ANI-175)', () => {
  const frame = {
    id: '1:1', type: 'FRAME', name: 'Promo', absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 600 },
    children: [{
      id: '1:2', name: 'Photo', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
      fills: [{ type: 'IMAGE', visible: true, imageRef: 'abc:123' }], children: [],
    }],
  };
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e, 0x00, 0x28, 0x03, 0, 0, 0, 0, 0, 0, 0]);

  function withMockFigma(run) {
    const origFetch = globalThis.fetch;
    const origToken = process.env.FIGMA_TOKEN;
    process.env.FIGMA_TOKEN = 'figd_test_not_real';
    const seen = [];
    globalThis.fetch = async (url, init = {}) => {
      seen.push({ url, headers: init.headers });
      if (url.includes('/nodes?')) return jsonRes({ name: 'Promo', nodes: { '1:1': { document: frame } } });
      if (url.endsWith('/images')) return jsonRes({ meta: { images: { 'abc:123': 'https://s3.example/fill.jpg' } } });
      if (url.startsWith('https://s3.example/')) return binRes(jpeg, 'image/jpeg');
      return { ok: false, status: 404, text: async () => 'no route', json: async () => ({}) };
    };
    return Promise.resolve(run(seen)).finally(() => {
      globalThis.fetch = origFetch;
      if (origToken === undefined) delete process.env.FIGMA_TOKEN; else process.env.FIGMA_TOKEN = origToken;
    });
  }

  it('embeds a JPEG fill as a data-URI and reports it (no project → no disk write)', async () => {
    await withMockFigma(async () => {
      const res = await handleFigmaFrameToScene({ file_key: 'KEY', node_id: '1:1', export_images: true });
      assert.ok(!res.isError, res.content?.[0]?.text);
      const { scene, report } = JSON.parse(res.content[0].text);
      assert.equal(report.exported_assets.length, 1);
      assert.deepEqual(
        { mime: report.exported_assets[0].mime, width: report.exported_assets[0].width, height: report.exported_assets[0].height, path: report.exported_assets[0].path },
        { mime: 'image/jpeg', width: 40, height: 30, path: null },
      );
      assert.match(JSON.stringify(scene.layers), /data:image\/jpeg;base64,/);
    });
  });

  it('persists the fill in its native format (.jpg, sanitized ref) when a project is given', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ani-175-proj-'));
    writeFileSync(join(dir, 'project.json'), JSON.stringify({ slug: 'tmp', scenes: [], versions: [], masters: [], review: {}, entrypoints: {} }));
    try {
      await withMockFigma(async () => {
        const res = await handleFigmaFrameToScene({ file_key: 'KEY', node_id: '1:1', export_images: true, project: dir });
        assert.ok(!res.isError, res.content?.[0]?.text);
        const { report } = JSON.parse(res.content[0].text);
        const assetsDir = join(dir, 'brief/references/assets');
        const files = readdirSync(assetsDir);
        assert.deepEqual(files, ['figma_abc-123.jpg']); // colon sanitized, native ext
        assert.equal(report.exported_assets[0].path, 'assets/figma_abc-123.jpg');
        assert.ok(existsSync(join(assetsDir, 'figma_abc-123.jpg')));
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Rendered-pixel proof (PR #89 standard): the data-URI must actually PAINT
// through the real iframe srcDoc path, and a CROP transform must select the
// right region. Skips gracefully when the render toolchain is unavailable.
describe('image-fill render proof (ANI-175)', () => {
  it('CROP right-half fill paints blue through the iframe, not the #222 placeholder', { timeout: 180_000 }, async (t) => {
    const session = await openHeroCaptureSession({ scale: 1 });
    if (!session || session.unavailable) {
      t.skip(`render toolchain unavailable${session?.reason ? `: ${session.reason}` : ''}`);
      return;
    }
    try {
      // 64×64 image: left half red, right half blue.
      const png = makePng(64, 64, (x) => (x < 32 ? [255, 0, 0] : [0, 0, 255]));
      const dataUri = `data:image/png;base64,${png.toString('base64')}`;
      // CROP showing the right half → the container fills with blue.
      const frame = {
        document: {
          id: 'f', type: 'FRAME', name: 'Proof', absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
          children: [{
            id: 'n1', name: 'Photo', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
            fills: [{ type: 'IMAGE', visible: true, imageRef: 'r1', scaleMode: 'CROP', imageTransform: [[0.5, 0, 0.5], [0, 1, 0]] }],
            children: [{ id: 'n2', name: 'Caption', type: 'TEXT', characters: 'X', style: { fontSize: 20 } }],
          }],
        },
      };
      const { scene } = frameToScene(frame, { imageAssets: { n1: { dataUri, width: 64, height: 64 } } });

      const shot = await session.capture(scene, 0.6);
      if (!shot || shot.error) { t.skip(`capture unavailable${shot?.error ? `: ${shot.error}` : ''}`); return; }

      const tmp = mkdtempSync(join(tmpdir(), 'ani-175-px-'));
      try {
        const pngPath = join(tmp, 'frame.png');
        writeFileSync(pngPath, Buffer.from(shot.data, 'base64'));
        const { width, height, rgba } = await decodeImage(pngPath);
        const sample = (x, y) => { const i = (y * width + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
        const [r, g, b] = sample(Math.round(width * 0.85), Math.round(height * 0.85)); // away from the caption
        assert.ok(b > 150 && r < 90, `fill region should be blue (cropped right half), got rgb(${r},${g},${b})`);
        assert.ok(!(Math.abs(r - 34) < 12 && Math.abs(g - 34) < 12 && Math.abs(b - 34) < 12), `must not be the #222 placeholder, got rgb(${r},${g},${b})`);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    } finally {
      await session.close();
    }
  });
});
