/**
 * Lottie → scene import (ANI-199).
 *
 * Parser tests run against a checked-in fixture (a null controller, a shape
 * layer with a red fill, a text layer). Acceptance is asserted the way ANI-198
 * established: the produced v3 scene must compile to REAL layer tracks, not
 * merely be non-null. `validateScene` IS required (the earlier "it's a lint
 * nothing enforces" note was the bug: an unvalidated output that quietly
 * emitted `headline`/`ui_card` component types and a display-name
 * `primary_subject` — neither of which `validateScene` has ever accepted —
 * see the Codex P1 fixes below). The sibling figma importer's own gap is
 * tracked separately and out of scope here.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseLottie } from '../lib/lottie/parse.js';
import { lottieToScene } from '../lib/lottie/to-scene.js';
import { handleLottieToScene } from '../handlers.js';
import { compileMotion } from '../lib/compiler.js';
import { validateScene } from '../../src/remotion/lib.js';
import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadRecipes,
  loadShotGrammar,
} from '../data/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, 'fixtures/lottie-sample.json'), 'utf-8');
const PRECOMP_FIXTURE = readFileSync(join(__dirname, 'fixtures/lottie-precomp-sample.json'), 'utf-8');

const catalogs = () => ({
  primitives: loadPrimitivesCatalog(),
  personalities: loadPersonalitiesCatalog(),
  recipes: loadRecipes(),
  shotGrammar: loadShotGrammar(),
});

/** Minimal valid Lottie envelope around a given `layers`/`assets`. */
function lottieDoc({ layers, assets = [], w = 100, h = 100, fr = 30, ip = 0, op = 30 }) {
  return JSON.stringify({ v: '5.7.4', fr, ip, op, w, h, nm: 'Doc', assets, layers });
}

/** A bare shape layer with an optional name and a solid-fill shape tree. */
function shapeLayer({ ind, nm = null, parent, p = [0, 0], shapes }) {
  const layer = {
    ty: 4,
    nm,
    ind,
    ks: {
      o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
      p: { a: 0, k: [p[0], p[1], 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
    },
    shapes: shapes ?? [
      { ty: 'gr', it: [
        { ty: 'rc', d: 1, s: { a: 0, k: [10, 10] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 } },
        { ty: 'fl', c: { a: 0, k: [0.5, 0.5, 0.5, 1] }, o: { a: 0, k: 100 } },
        { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
      ] },
    ],
    ip: 0, op: 30, st: 0, sr: 1, ddd: 0, ao: 0, bm: 0,
  };
  if (parent != null) layer.parent = parent;
  return layer;
}

describe('parseLottie', () => {
  it('extracts composition metadata and visual layers (drops the null controller)', () => {
    const p = parseLottie(FIXTURE);
    assert.equal(p.name, 'Fixture Comp');
    assert.equal(p.fps, 30);
    assert.equal(p.width, 400);
    assert.equal(p.height, 300);
    assert.equal(p.durationS, 2); // (60 - 0) / 30
    // 3 layers in, but the ty:3 null controller is non-visual → 2 components.
    assert.equal(p.layers.length, 2);
    assert.ok(p.layers.every(l => l.ty !== 3));
  });

  it('extracts the shape fill colour into the palette', () => {
    const p = parseLottie(FIXTURE);
    // [0.9019, 0.2235, 0.2745] → #e63946
    assert.ok(p.palette.includes('#e63946'), `palette: ${p.palette.join(', ')}`);
  });

  it('extracts the text string', () => {
    const p = parseLottie(FIXTURE);
    const text = p.layers.find(l => l.ty === 5);
    assert.equal(text.text, 'Hello Lottie');
  });

  it('accepts an already-parsed object', () => {
    const p = parseLottie(JSON.parse(FIXTURE));
    assert.equal(p.layers.length, 2);
  });

  it('rejects a .lottie ZIP container with guidance', () => {
    assert.throws(() => parseLottie('PKrest-of-zip'), /\.lottie ZIP/);
  });

  it('rejects non-Lottie JSON', () => {
    assert.throws(() => parseLottie('{"foo":1}'), /missing top-level `layers`/);
  });

  describe('edge-safety — no Node-only `Buffer` (ANI-199 P1)', () => {
    it('parses valid JSON from a string and from a Uint8Array with globalThis.Buffer deleted', () => {
      const hadBuffer = Object.prototype.hasOwnProperty.call(globalThis, 'Buffer');
      const savedBuffer = globalThis.Buffer;
      try {
        delete globalThis.Buffer;

        const fromString = parseLottie(FIXTURE);
        assert.equal(fromString.layers.length, 2);

        const bytes = new TextEncoder().encode(FIXTURE);
        const fromBytes = parseLottie(bytes);
        assert.equal(fromBytes.layers.length, 2);
        assert.equal(fromBytes.name, 'Fixture Comp');
      } finally {
        if (hadBuffer) globalThis.Buffer = savedBuffer;
      }
    });

    it('still rejects a .lottie ZIP given as raw bytes (magic-byte check, no Buffer)', () => {
      const zipBytes = new TextEncoder().encode('PKrest-of-zip');
      assert.throws(() => parseLottie(zipBytes), /\.lottie ZIP/);
    });
  });

  describe('precomp traversal (ANI-199 P1)', () => {
    it('imports a Lottie whose root is a single precomp instead of blank', () => {
      const p = parseLottie(PRECOMP_FIXTURE);
      assert.equal(p.layers.length, 2, `expected the precomp's 2 inner layers, got: ${p.layers.map(l => l.name)}`);
      assert.ok(p.layers.some(l => l.name === 'Inner Shape'));
      const text = p.layers.find(l => l.ty === 5);
      assert.equal(text.text, 'Inside The Precomp');
    });

    it('applies the precomp layer\'s own position as a translation offset to its children', () => {
      const p = parseLottie(PRECOMP_FIXTURE);
      // Precomp layer sits at [50,20]; "Inner Shape" is at [10,15] inside it.
      const shape = p.layers.find(l => l.name === 'Inner Shape');
      assert.equal(shape.position.x, 60);
      assert.equal(shape.position.y, 35);
    });

    it('guards against a cyclic precomp refId instead of recursing forever', () => {
      const doc = lottieDoc({
        assets: [{ id: 'a', nm: 'A', layers: [{ ty: 0, nm: 'Self', ind: 1, refId: 'a', ks: { p: { a: 0, k: [0, 0, 0] } }, ip: 0, op: 30, st: 0, sr: 1 }] }],
        layers: [{ ty: 0, nm: 'Root Precomp', ind: 1, refId: 'a', ks: { p: { a: 0, k: [0, 0, 0] } }, ip: 0, op: 30, st: 0, sr: 1 }],
      });
      assert.throws(() => parseLottie(doc), /[Cc]yclic precomp/);
    });
  });

  describe('hostile-input bounds (ANI-199 P2)', () => {
    it('rejects a deeply nested shape group instead of overflowing the stack', () => {
      // Build a `gr` chain nested well past the safety limit.
      let innermost = { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 } };
      for (let i = 0; i < 200; i++) {
        innermost = { ty: 'gr', it: [innermost] };
      }
      const doc = lottieDoc({ layers: [shapeLayer({ ind: 1, nm: 'Deep', shapes: [innermost] })] });
      assert.throws(() => parseLottie(doc), /max depth/);
    });

    it('rejects a huge layer count instead of hanging/OOMing', () => {
      const layers = [];
      for (let i = 0; i < 4500; i++) {
        layers.push(shapeLayer({ ind: i + 1, nm: `Layer ${i}` }));
      }
      const doc = lottieDoc({ layers });
      assert.throws(() => parseLottie(doc), /layer safety limit/);
    });
  });

  describe('gradient stops (ANI-199 P3)', () => {
    it('stops reading colour stops after g.p, not the trailing opacity stops', () => {
      // 2 colour stops [offset,r,g,b]*2, then 2 opacity stops [offset,alpha]*2.
      // Reading in groups of 4 past g.p misaligns into the opacity pairs and
      // fabricates bogus colours from (offset,alpha) values.
      const gradientShape = {
        ty: 'gr',
        it: [
          {
            ty: 'gf',
            g: {
              p: 2,
              k: { a: 0, k: [0, 0.2, 0.4, 0.6, 1, 0.8, 0.1, 0.3, /* opacity stops → */ 0, 1, 1, 0.5] },
            },
            s: { a: 0, k: [0, 0] },
            e: { a: 0, k: [10, 10] },
          },
        ],
      };
      const doc = lottieDoc({ layers: [shapeLayer({ ind: 1, nm: 'Gradient', shapes: [gradientShape] })] });
      const p = parseLottie(doc);
      const palette = p.layers[0].colors;
      // Expected colours from the 2 real colour stops only:
      // [0.2,0.4,0.6] → #336699 ; [0.8,0.1,0.3] → #cc1a4d
      assert.deepEqual(new Set(palette), new Set(['#336699', '#cc1a4d']));
      assert.equal(palette.length, 2, `must not fabricate extra colours from opacity stops, got: ${palette.join(', ')}`);
    });
  });
});

describe('lottieToScene', () => {
  it('produces a v3 semantic scene tagged lottie_import that VALIDATES', () => {
    const { scene } = lottieToScene(FIXTURE);
    assert.equal(scene.format_version, 3);
    assert.ok(scene.tags.includes('lottie_import'));
    assert.equal(scene.source.kind, 'lottie');
    assert.equal(scene.semantic.components.length, 2);
    assert.equal(scene.layers.length, 2);

    const result = validateScene(scene);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });

  it('sets primary_subject to a real layer id, not a display name', () => {
    const { scene } = lottieToScene(FIXTURE);
    const layerIds = new Set(scene.layers.map(l => l.id));
    assert.ok(scene.primary_subject, 'primary_subject must be set');
    assert.ok(layerIds.has(scene.primary_subject), `primary_subject "${scene.primary_subject}" must reference a real layer id`);
  });

  it('emits one `enter` interaction per component, hero last', () => {
    const { scene } = lottieToScene(FIXTURE);
    const kinds = scene.semantic.interactions.map(i => i.kind);
    assert.ok(kinds.every(k => k === 'enter'));
    assert.equal(scene.semantic.interactions.length, 2);
    // The text layer is the largest text → hero; hero enters last (max at_ms).
    const hero = scene.semantic.components.find(c => c.role === 'hero');
    const heroInt = scene.semantic.interactions.find(i => i.target === hero.id);
    const maxAt = Math.max(...scene.semantic.interactions.map(i => i.timing.at_ms));
    assert.equal(heroInt.timing.at_ms, maxAt);
  });

  it('carries the extracted palette onto scene.brand', () => {
    const { scene } = lottieToScene(FIXTURE);
    assert.ok(scene.brand.palette.includes('#e63946'));
  });

  it('every interaction targets a real component, every component a real layer', () => {
    const { scene } = lottieToScene(FIXTURE);
    const compIds = new Set(scene.semantic.components.map(c => c.id));
    const layerIds = new Set(scene.layers.map(l => l.id));
    for (const i of scene.semantic.interactions) assert.ok(compIds.has(i.target));
    for (const c of scene.semantic.components) assert.ok(layerIds.has(c.layer_ref));
  });

  it('throws when there are no visual layers', () => {
    const onlyNull = JSON.stringify({ v: '5', fr: 30, ip: 0, op: 30, w: 100, h: 100, layers: [{ ty: 3, nm: 'n', ind: 1, ks: {} }] });
    assert.throws(() => lottieToScene(onlyNull), /no visual layers/);
  });

  describe('duplicate layer ids (ANI-199 P1)', () => {
    it('gives two same-named layers distinct, stable ids instead of colliding', () => {
      const doc = lottieDoc({
        w: 200, h: 200,
        layers: [
          shapeLayer({ ind: 1, nm: 'Repeated', p: [20, 20] }),
          shapeLayer({ ind: 2, nm: 'Repeated', p: [80, 80] }),
        ],
      });
      const { scene } = lottieToScene(doc);
      const layerIds = scene.layers.map(l => l.id);
      assert.equal(new Set(layerIds).size, layerIds.length, `layer ids must be unique, got: ${layerIds.join(', ')}`);
      const compIds = scene.semantic.components.map(c => c.id);
      assert.equal(new Set(compIds).size, compIds.length, `component ids must be unique, got: ${compIds.join(', ')}`);
      const intIds = scene.semantic.interactions.map(i => i.id);
      assert.equal(new Set(intIds).size, intIds.length, `interaction ids must be unique, got: ${intIds.join(', ')}`);

      const result = validateScene(scene);
      assert.deepEqual(result.errors, []);

      // Stable: re-running produces the same ids (deterministic on layer order).
      const again = lottieToScene(doc);
      assert.deepEqual(again.scene.layers.map(l => l.id), layerIds);
    });
  });
});

describe('lottie import — ANI-199 acceptance', () => {
  it('compiles to NON-EMPTY layer tracks via the default entrance primitive', () => {
    const { scene } = lottieToScene(FIXTURE);
    const timeline = compileMotion(structuredClone(scene), catalogs());
    assert.ok(timeline, 'imported scene must compile to a static timeline');

    // Every component's layer must have real opacity keyframes — the honest
    // gate (assert tracks, not `!== null`).
    for (const cmp of scene.semantic.components) {
      const track = timeline.tracks?.layers?.[cmp.layer_ref];
      assert.ok(track, `expected a layer track for ${cmp.layer_ref}`);
      assert.ok(
        Array.isArray(track.opacity) && track.opacity.length > 0,
        `${cmp.layer_ref} must have non-empty opacity keyframes`,
      );
    }
  });
});

describe('handleLottieToScene', () => {
  it('returns { scene, report } JSON for valid input', async () => {
    const res = await handleLottieToScene({ lottie: FIXTURE });
    assert.ok(!res.isError);
    const payload = JSON.parse(res.content[0].text);
    assert.equal(payload.scene.format_version, 3);
    assert.ok(payload.report.palette.includes('#e63946'));
  });

  it('returns an error result (not a throw) for a .lottie ZIP', async () => {
    const res = await handleLottieToScene({ lottie: 'PKzip' });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /lottie_to_scene failed/);
  });

  it('errors when `lottie` is missing', async () => {
    const res = await handleLottieToScene({});
    assert.ok(res.isError);
    assert.match(res.content[0].text, /`lottie` is required/);
  });
});
