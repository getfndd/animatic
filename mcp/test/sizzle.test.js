/**
 * Tests for Sizzle CLI pipeline (ANI-25).
 *
 * Covers: loadScenes, analyzeAll, assembleProps, pipeline integration,
 * and CLI validation edge cases.
 *
 * Uses existing ground truth data from test-kinetic-type.json and
 * test-layouts.json — extracts sceneDefs, writes to temp directories,
 * runs the pipeline.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { loadScenes, analyzeAll, assembleProps, evaluateManifest, validateManifestGuardrails } from '../../scripts/sizzle.mjs';
import { planSequence, STYLE_PACKS, STYLE_TO_PERSONALITY } from '../lib/planner.js';
import { validateManifest } from '../../src/remotion/lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Load ground truth scenes ────────────────────────────────────────────────

const kineticTypeManifest = JSON.parse(
  readFileSync(resolve(ROOT, 'src/remotion/manifests/test-kinetic-type.json'), 'utf-8')
);
const layoutManifest = JSON.parse(
  readFileSync(resolve(ROOT, 'src/remotion/manifests/test-layouts.json'), 'utf-8')
);

const kineticScenes = Object.values(kineticTypeManifest.sceneDefs);
const layoutScenes = Object.values(layoutManifest.sceneDefs);

// ── Test helpers ────────────────────────────────────────────────────────────

/** Write scenes to a temp directory as individual JSON files. */
function writeScenesDir(scenes) {
  const dir = mkdtempSync(join(tmpdir(), 'sizzle-test-'));
  for (let i = 0; i < scenes.length; i++) {
    const filename = `${String(i).padStart(2, '0')}-${scenes[i].scene_id}.json`;
    writeFileSync(join(dir, filename), JSON.stringify(scenes[i], null, 2));
  }
  return dir;
}

// ── loadScenes ──────────────────────────────────────────────────────────────

describe('loadScenes', () => {
  let kineticDir;
  let layoutDir;

  before(() => {
    kineticDir = writeScenesDir(kineticScenes);
    layoutDir = writeScenesDir(layoutScenes);
  });

  after(() => {
    rmSync(kineticDir, { recursive: true, force: true });
    rmSync(layoutDir, { recursive: true, force: true });
  });

  it('loads all JSON files from a directory', () => {
    const scenes = loadScenes(kineticDir);
    assert.equal(scenes.length, kineticScenes.length);
  });

  it('preserves scene_id from file contents', () => {
    const scenes = loadScenes(kineticDir);
    const ids = scenes.map(s => s.scene_id);
    for (const original of kineticScenes) {
      assert.ok(ids.includes(original.scene_id),
        `Missing scene_id: ${original.scene_id}`);
    }
  });

  it('derives scene_id from filename when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sizzle-noid-'));
    const scene = {
      duration_s: 3,
      layers: [
        { id: 'l1', type: 'text', content: 'hello', depth_class: 'foreground' }
      ],
    };
    writeFileSync(join(dir, 'my-test-scene.json'), JSON.stringify(scene));
    const scenes = loadScenes(dir);
    assert.equal(scenes.length, 1);
    assert.equal(scenes[0].scene_id, 'sc_my_test_scene');
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws on empty directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sizzle-empty-'));
    assert.throws(() => loadScenes(dir), /No .json files/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws on invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sizzle-bad-'));
    writeFileSync(join(dir, 'bad.json'), '{not valid json');
    assert.throws(() => loadScenes(dir), /Invalid JSON/);
    rmSync(dir, { recursive: true, force: true });
  });
});

// ── analyzeAll ──────────────────────────────────────────────────────────────

describe('analyzeAll', () => {
  it('adds metadata to each scene', () => {
    const analyzed = analyzeAll(kineticScenes);
    for (const scene of analyzed) {
      assert.ok(scene.metadata, `Missing metadata on ${scene.scene_id}`);
      assert.ok(scene.metadata.content_type);
      assert.ok(scene.metadata.visual_weight);
      assert.ok(scene.metadata.motion_energy);
      assert.ok(Array.isArray(scene.metadata.intent_tags));
    }
  });

  it('preserves original scene properties', () => {
    const analyzed = analyzeAll(kineticScenes);
    for (let i = 0; i < analyzed.length; i++) {
      assert.equal(analyzed[i].scene_id, kineticScenes[i].scene_id);
      assert.equal(analyzed[i].duration_s, kineticScenes[i].duration_s);
      assert.ok(analyzed[i].layers);
    }
  });
});

// ── assembleProps ───────────────────────────────────────────────────────────

describe('assembleProps', () => {
  const analyzed = analyzeAll(kineticScenes);
  const { manifest } = planSequence({
    scenes: analyzed,
    style: 'prestige',
    sequence_id: 'seq_test_assemble',
  });

  it('builds sceneDefs keyed by scene_id', () => {
    const props = assembleProps(manifest, analyzed);
    assert.ok(props.sceneDefs);
    for (const scene of analyzed) {
      assert.ok(props.sceneDefs[scene.scene_id],
        `Missing sceneDef for ${scene.scene_id}`);
    }
  });

  it('includes all scene IDs referenced in manifest', () => {
    const props = assembleProps(manifest, analyzed);
    for (const entry of manifest.scenes) {
      assert.ok(props.sceneDefs[entry.scene],
        `Manifest references ${entry.scene} but not in sceneDefs`);
    }
  });

  it('preserves full scene objects in sceneDefs', () => {
    const props = assembleProps(manifest, analyzed);
    for (const scene of analyzed) {
      const def = props.sceneDefs[scene.scene_id];
      assert.equal(def.duration_s, scene.duration_s);
      assert.ok(def.layers);
      assert.ok(def.metadata);
    }
  });
});

// ── Pipeline integration ────────────────────────────────────────────────────

describe('sizzle pipeline integration', () => {
  let kineticDir;
  let layoutDir;

  before(() => {
    kineticDir = writeScenesDir(kineticScenes);
    layoutDir = writeScenesDir(layoutScenes);
  });

  after(() => {
    rmSync(kineticDir, { recursive: true, force: true });
    rmSync(layoutDir, { recursive: true, force: true });
  });

  for (const style of STYLE_PACKS) {
    it(`kinetic type scenes → ${style} → valid manifest`, () => {
      const scenes = loadScenes(kineticDir);
      const analyzed = analyzeAll(scenes);
      const { manifest } = planSequence({
        scenes: analyzed,
        style,
        sequence_id: `seq_sizzle_kt_${style}`,
      });
      const props = assembleProps(manifest, analyzed);

      // Manifest validates
      const validation = validateManifest(manifest);
      assert.ok(validation.valid,
        `${style} manifest invalid: ${validation.errors.join('; ')}`);

      // All manifest scene refs exist in sceneDefs
      for (const entry of manifest.scenes) {
        assert.ok(props.sceneDefs[entry.scene],
          `${style}: missing sceneDef for ${entry.scene}`);
      }
    });
  }

  it('layout scenes → prestige → valid manifest', () => {
    const scenes = loadScenes(layoutDir);
    const analyzed = analyzeAll(scenes);
    const { manifest } = planSequence({
      scenes: analyzed,
      style: 'prestige',
      sequence_id: 'seq_sizzle_layout_prestige',
    });
    const props = assembleProps(manifest, analyzed);

    const validation = validateManifest(manifest);
    assert.ok(validation.valid,
      `Layout manifest invalid: ${validation.errors.join('; ')}`);
    assert.equal(Object.keys(props.sceneDefs).length, layoutScenes.length);
  });
});

// ── Evaluate integration ─────────────────────────────────────────────────────

describe('sizzle pipeline + evaluate integration', () => {
  const analyzed = analyzeAll(kineticScenes);

  for (const style of STYLE_PACKS) {
    it(`${style} → evaluate returns score 0-100 with 4 dimensions`, () => {
      const { manifest } = planSequence({
        scenes: analyzed,
        style,
        sequence_id: `seq_eval_${style}`,
      });

      const result = evaluateManifest(manifest, analyzed, style);

      assert.ok(typeof result.score === 'number', 'score is a number');
      assert.ok(result.score >= 0 && result.score <= 100,
        `score ${result.score} is within 0-100`);

      assert.ok(result.dimensions.pacing, 'has pacing dimension');
      assert.ok(result.dimensions.variety, 'has variety dimension');
      assert.ok(result.dimensions.flow, 'has flow dimension');
      assert.ok(result.dimensions.adherence, 'has adherence dimension');

      for (const dim of ['pacing', 'variety', 'flow', 'adherence']) {
        const d = result.dimensions[dim];
        assert.ok(typeof d.score === 'number', `${dim} score is a number`);
        assert.ok(d.score >= 0 && d.score <= 100,
          `${dim} score ${d.score} is within 0-100`);
      }

      assert.ok(Array.isArray(result.findings), 'findings is an array');
    });
  }
});

// ── Guardrails validation integration ────────────────────────────────────────

describe('sizzle pipeline + guardrails validation', () => {
  const analyzed = analyzeAll(kineticScenes);

  for (const style of STYLE_PACKS) {
    it(`${style} → validate returns valid structure with no camera blocks`, () => {
      const { manifest } = planSequence({
        scenes: analyzed,
        style,
        sequence_id: `seq_guard_${style}`,
      });

      const result = validateManifestGuardrails(manifest, style);

      assert.ok(['PASS', 'WARN', 'BLOCK'].includes(result.verdict),
        `verdict "${result.verdict}" is valid`);
      assert.ok(Array.isArray(result.sceneResults), 'sceneResults is an array');
      assert.ok(Array.isArray(result.cumulativeFindings), 'cumulativeFindings is an array');

      // Planner should never produce camera_movement blocks —
      // shot_grammar 3D transform blocks are a known interaction
      // (planner doesn't yet filter shot grammar by personality)
      const cameraBlocks = result.sceneResults.flatMap(sr =>
        sr.blocks.filter(b => b.feature === 'camera_movement' || b.feature === 'ambient_motion')
      );
      assert.equal(cameraBlocks.length, 0,
        `${style} has camera blocks: ${cameraBlocks.map(b => b.message).join('; ')}`);
    });
  }
});

// ── CLI validation ──────────────────────────────────────────────────────────

describe('CLI validation', () => {
  it('STYLE_PACKS has all 10 entries', () => {
    assert.equal(STYLE_PACKS.length, 10);
    assert.ok(STYLE_PACKS.includes('prestige'));
    assert.ok(STYLE_PACKS.includes('energy'));
    assert.ok(STYLE_PACKS.includes('dramatic'));
    assert.ok(STYLE_PACKS.includes('minimal'));
    assert.ok(STYLE_PACKS.includes('intimate'));
    assert.ok(STYLE_PACKS.includes('corporate'));
    assert.ok(STYLE_PACKS.includes('kinetic'));
    assert.ok(STYLE_PACKS.includes('fade'));
    assert.ok(STYLE_PACKS.includes('analog'));
    assert.ok(STYLE_PACKS.includes('documentary'));
  });

  it('planSequence rejects unknown style', () => {
    const scenes = analyzeAll(kineticScenes);
    assert.throws(
      () => planSequence({ scenes, style: 'nonexistent', sequence_id: 'seq_test' }),
      /Unknown style/
    );
  });
});
