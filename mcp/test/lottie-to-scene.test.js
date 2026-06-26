/**
 * Lottie → scene import (ANI-199).
 *
 * Parser tests run against a checked-in fixture (a null controller, a shape
 * layer with a red fill, a text layer). Acceptance is asserted the way ANI-198
 * established: the produced v3 scene must compile to REAL layer tracks, not
 * merely be non-null. `validateScene` is deliberately NOT required — it is a
 * lint nothing on the import/compile/render path enforces, and the sibling
 * figma importer doesn't pass it either (see ANI-199 acceptance note).
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
import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadRecipes,
  loadShotGrammar,
} from '../data/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, 'fixtures/lottie-sample.json'), 'utf-8');

const catalogs = () => ({
  primitives: loadPrimitivesCatalog(),
  personalities: loadPersonalitiesCatalog(),
  recipes: loadRecipes(),
  shotGrammar: loadShotGrammar(),
});

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
    assert.throws(() => parseLottie('PKrest-of-zip'), /\.lottie ZIP/);
  });

  it('rejects non-Lottie JSON', () => {
    assert.throws(() => parseLottie('{"foo":1}'), /missing top-level `layers`/);
  });
});

describe('lottieToScene', () => {
  it('produces a v3 semantic scene tagged lottie_import', () => {
    const { scene } = lottieToScene(FIXTURE);
    assert.equal(scene.format_version, 3);
    assert.ok(scene.tags.includes('lottie_import'));
    assert.equal(scene.source.kind, 'lottie');
    assert.equal(scene.semantic.components.length, 2);
    assert.equal(scene.layers.length, 2);
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
    const res = await handleLottieToScene({ lottie: 'PKzip' });
    assert.ok(res.isError);
    assert.match(res.content[0].text, /lottie_to_scene failed/);
  });

  it('errors when `lottie` is missing', async () => {
    const res = await handleLottieToScene({});
    assert.ok(res.isError);
    assert.match(res.content[0].text, /`lottie` is required/);
  });
});
