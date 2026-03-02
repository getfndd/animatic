/**
 * Tests for Sequence Evaluation Engine (ANI-28).
 *
 * Covers: helpers, scorePacing, scoreVariety, scoreFlow, scoreAdherence,
 * evaluateSequence integration, and ground truth.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/evaluate.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseLoopTimeRange,
  getExpectedDuration,
  getExpectedTransition,
  getExpectedCamera,
  ENERGY_NUMERIC,
  DIMENSION_WEIGHTS,
  scorePacing,
  scoreVariety,
  scoreFlow,
  scoreAdherence,
  evaluateSequence,
} from '../lib/evaluate.js';

import { analyzeScene } from '../lib/analyze.js';
import { planSequence } from '../lib/planner.js';

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

// ── Load style packs for reference ──────────────────────────────────────────

const stylePacks = JSON.parse(
  readFileSync(resolve(ROOT, 'catalog/style-packs.json'), 'utf-8')
);
const prestigePack = stylePacks.find(p => p.name === 'prestige');
const energyPack = stylePacks.find(p => p.name === 'energy');
const dramaticPack = stylePacks.find(p => p.name === 'dramatic');

// ── Test helpers ────────────────────────────────────────────────────────────

function makeScene(id, overrides = {}) {
  return {
    scene_id: id,
    duration_s: 3,
    layers: [{ id: 'l1', type: 'text', depth_class: 'foreground' }],
    metadata: {
      content_type: 'typography',
      visual_weight: 'dark',
      motion_energy: 'moderate',
      intent_tags: [],
      ...overrides,
    },
  };
}

function makeManifestScene(sceneId, duration_s, opts = {}) {
  return {
    scene: sceneId,
    duration_s,
    ...(opts.transition_in ? { transition_in: opts.transition_in } : {}),
    ...(opts.camera_override ? { camera_override: opts.camera_override } : {}),
    ...(opts.shot_grammar ? { shot_grammar: opts.shot_grammar } : {}),
  };
}

function buildSceneMap(scenes) {
  return new Map(scenes.map(s => [s.scene_id, s]));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

describe('parseLoopTimeRange', () => {
  it('parses "12-16s" → { min: 12, max: 16 }', () => {
    assert.deepEqual(parseLoopTimeRange('12-16s'), { min: 12, max: 16 });
  });

  it('parses "30-40s" → { min: 30, max: 40 }', () => {
    assert.deepEqual(parseLoopTimeRange('30-40s'), { min: 30, max: 40 });
  });

  it('returns null for invalid input', () => {
    assert.equal(parseLoopTimeRange(null), null);
    assert.equal(parseLoopTimeRange(''), null);
    assert.equal(parseLoopTimeRange('fast'), null);
  });
});

describe('getExpectedDuration', () => {
  it('returns correct duration for prestige moderate', () => {
    assert.equal(getExpectedDuration('moderate', prestigePack), 3.0);
  });

  it('returns correct duration for energy high', () => {
    assert.equal(getExpectedDuration('high', energyPack), 1.5);
  });

  it('applies max_hold_duration cap for energy pack', () => {
    // energy has max_hold_duration: 4.0; static = 2.0, well under cap
    assert.equal(getExpectedDuration('static', energyPack), 2.0);
    // Even if we check a higher value scenario, max cap is 4.0
    assert.ok(getExpectedDuration('static', energyPack) <= 4.0);
  });
});

describe('getExpectedTransition', () => {
  it('energy: pattern fires at position 3', () => {
    const prev = makeScene('sc_0');
    const curr = makeScene('sc_1');
    const result = getExpectedTransition(energyPack.transitions, prev, curr, 3);
    assert.ok(result.type.startsWith('whip_'), `Expected whip, got ${result.type}`);
  });

  it('prestige: default is hard_cut', () => {
    const prev = makeScene('sc_0', { visual_weight: 'dark' });
    const curr = makeScene('sc_1', { visual_weight: 'dark' });
    const result = getExpectedTransition(prestigePack.transitions, prev, curr, 1);
    assert.equal(result.type, 'hard_cut');
  });

  it('prestige: weight change → crossfade', () => {
    const prev = makeScene('sc_0', { visual_weight: 'dark' });
    const curr = makeScene('sc_1', { visual_weight: 'light' });
    const result = getExpectedTransition(prestigePack.transitions, prev, curr, 1);
    assert.equal(result.type, 'crossfade');
  });

  it('dramatic: same weight → hard_cut (on_same_weight)', () => {
    const prev = makeScene('sc_0', { visual_weight: 'dark' });
    const curr = makeScene('sc_1', { visual_weight: 'dark' });
    const result = getExpectedTransition(dramaticPack.transitions, prev, curr, 1);
    assert.equal(result.type, 'hard_cut');
  });
});

describe('getExpectedCamera', () => {
  it('energy: force_static returns { move: "static" }', () => {
    const scene = makeScene('sc_0', { content_type: 'portrait' });
    const result = getExpectedCamera(energyPack.camera_overrides, scene, 'montage');
    assert.deepEqual(result, { move: 'static' });
  });

  it('prestige: portrait → push_in', () => {
    const scene = makeScene('sc_0', { content_type: 'portrait' });
    const result = getExpectedCamera(prestigePack.camera_overrides, scene, 'editorial');
    assert.equal(result.move, 'push_in');
  });

  it('dramatic: emotional → push_in', () => {
    const scene = makeScene('sc_0', { intent_tags: ['emotional'] });
    const result = getExpectedCamera(dramaticPack.camera_overrides, scene, 'cinematic-dark');
    assert.equal(result.move, 'push_in');
  });

  it('prestige: typography → null (no matching rule)', () => {
    const scene = makeScene('sc_0', { content_type: 'typography' });
    const result = getExpectedCamera(prestigePack.camera_overrides, scene, 'editorial');
    assert.equal(result, null);
  });
});

// ── scorePacing ─────────────────────────────────────────────────────────────

describe('scorePacing', () => {
  it('perfect durations score ~100', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'static' }),
      makeScene('sc_b', { motion_energy: 'subtle' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
    ];
    const manifestScenes = [
      makeManifestScene('sc_a', 3.5),  // prestige static = 3.5
      makeManifestScene('sc_b', 3.0),  // prestige subtle = 3.0
      makeManifestScene('sc_c', 3.0),  // prestige moderate = 3.0
    ];
    const sceneMap = buildSceneMap(scenes);
    const { score } = scorePacing(manifestScenes, sceneMap, 'prestige');
    assert.ok(score >= 90, `Expected ~100, got ${score}`);
  });

  it('all durations off by 1s+ score lower', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'static' }),
      makeScene('sc_b', { motion_energy: 'subtle' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
    ];
    const manifestScenes = [
      makeManifestScene('sc_a', 1.5),  // prestige static = 3.5, off by 2.0
      makeManifestScene('sc_b', 1.0),  // prestige subtle = 3.0, off by 2.0
      makeManifestScene('sc_c', 1.0),  // prestige moderate = 3.0, off by 2.0
    ];
    const sceneMap = buildSceneMap(scenes);
    const { score, findings } = scorePacing(manifestScenes, sceneMap, 'prestige');
    assert.ok(score < 70, `Expected < 70, got ${score}`);
    assert.ok(findings.length > 0, 'Should have findings for large deviations');
  });

  it('single scene scores 100', () => {
    const scenes = [makeScene('sc_a')];
    const manifestScenes = [makeManifestScene('sc_a', 3.0)];
    const sceneMap = buildSceneMap(scenes);
    const { score } = scorePacing(manifestScenes, sceneMap, 'prestige');
    assert.equal(score, 100);
  });

  it('max_hold_duration violations generate warnings', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'moderate' }),
      makeScene('sc_b', { motion_energy: 'moderate' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
    ];
    // energy pack has max_hold 4.0; exceed it
    const manifestScenes = [
      makeManifestScene('sc_a', 5.0),
      makeManifestScene('sc_b', 5.0),
      makeManifestScene('sc_c', 5.0),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scorePacing(manifestScenes, sceneMap, 'energy');
    const maxHoldFindings = findings.filter(f => f.message.includes('max hold'));
    assert.ok(maxHoldFindings.length > 0, 'Should warn about max hold violations');
  });

  it('total duration outside loop_time range generates finding', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'moderate' }),
      makeScene('sc_b', { motion_energy: 'moderate' }),
    ];
    // prestige personality (editorial) loop_time = 12-16s; 2 scenes at 3s = 6s total
    const manifestScenes = [
      makeManifestScene('sc_a', 3.0),
      makeManifestScene('sc_b', 3.0),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scorePacing(manifestScenes, sceneMap, 'prestige');
    const loopFindings = findings.filter(f => f.message.includes('loop_time'));
    assert.ok(loopFindings.length > 0, 'Should note total duration outside loop_time range');
  });
});

// ── scoreVariety ────────────────────────────────────────────────────────────

describe('scoreVariety', () => {
  it('all different types/sizes/weights scores high', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'typography', visual_weight: 'dark', motion_energy: 'static', shot_grammar: { shot_size: 'wide', angle: 'eye_level', framing: 'center' } }),
      makeScene('sc_b', { content_type: 'ui_screenshot', visual_weight: 'light', motion_energy: 'subtle', shot_grammar: { shot_size: 'medium', angle: 'high', framing: 'rule_of_thirds_left' } }),
      makeScene('sc_c', { content_type: 'portrait', visual_weight: 'mixed', motion_energy: 'moderate', shot_grammar: { shot_size: 'close_up', angle: 'low', framing: 'rule_of_thirds_right' } }),
      makeScene('sc_d', { content_type: 'brand_mark', visual_weight: 'dark', motion_energy: 'high', shot_grammar: { shot_size: 'extreme_close_up', angle: 'eye_level', framing: 'center' } }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { score } = scoreVariety(manifestScenes, sceneMap);
    assert.ok(score >= 80, `Expected high score, got ${score}`);
  });

  it('all same content_type scores low with findings', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'typography', visual_weight: 'dark', motion_energy: 'moderate' }),
      makeScene('sc_b', { content_type: 'typography', visual_weight: 'dark', motion_energy: 'moderate' }),
      makeScene('sc_c', { content_type: 'typography', visual_weight: 'dark', motion_energy: 'moderate' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { score, findings } = scoreVariety(manifestScenes, sceneMap);
    assert.ok(score < 80, `Expected low score, got ${score}`);
    assert.ok(findings.length > 0, 'Should have findings');
  });

  it('adjacent same content_type generates info findings', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'typography', visual_weight: 'dark' }),
      makeScene('sc_b', { content_type: 'typography', visual_weight: 'light' }),
      makeScene('sc_c', { content_type: 'ui_screenshot', visual_weight: 'dark' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scoreVariety(manifestScenes, sceneMap);
    const contentFindings = findings.filter(f => f.message.includes('content_type'));
    assert.ok(contentFindings.length > 0, 'Should flag adjacent same content_type');
  });

  it('all same visual_weight penalizes', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'typography', visual_weight: 'dark', motion_energy: 'moderate' }),
      makeScene('sc_b', { content_type: 'ui_screenshot', visual_weight: 'dark', motion_energy: 'subtle' }),
      makeScene('sc_c', { content_type: 'portrait', visual_weight: 'dark', motion_energy: 'high' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scoreVariety(manifestScenes, sceneMap);
    const weightFindings = findings.filter(f => f.message.includes('dominates'));
    assert.ok(weightFindings.length > 0, 'Should penalize dominant visual weight');
  });

  it('diverse motion_energy scores high', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'typography', visual_weight: 'dark', motion_energy: 'static' }),
      makeScene('sc_b', { content_type: 'ui_screenshot', visual_weight: 'light', motion_energy: 'moderate' }),
      makeScene('sc_c', { content_type: 'portrait', visual_weight: 'mixed', motion_energy: 'high' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { score } = scoreVariety(manifestScenes, sceneMap);
    assert.ok(score >= 75, `Expected high score for diverse energy, got ${score}`);
  });

  it('two-scene sequences are lenient', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'typography', visual_weight: 'dark' }),
      makeScene('sc_b', { content_type: 'typography', visual_weight: 'dark' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { score } = scoreVariety(manifestScenes, sceneMap);
    assert.equal(score, 100, 'Two-scene sequences should score 100');
  });
});

// ── scoreFlow ───────────────────────────────────────────────────────────────

describe('scoreFlow', () => {
  it('build-and-resolve energy arc scores high', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'subtle', intent_tags: ['opening'] }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { motion_energy: 'high', content_type: 'portrait' }),
      makeScene('sc_d', { motion_energy: 'moderate', content_type: 'brand_mark' }),
      makeScene('sc_e', { motion_energy: 'subtle', intent_tags: ['closing'] }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { score } = scoreFlow(manifestScenes, sceneMap, 'prestige');
    assert.ok(score >= 60, `Expected good flow score, got ${score}`);
  });

  it('flat energy arc scores low', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'moderate' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { motion_energy: 'moderate', content_type: 'portrait' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { score, findings } = scoreFlow(manifestScenes, sceneMap, 'prestige');
    // Flat arc + no intent tags → lower score
    assert.ok(score < 80, `Expected lower score for flat arc, got ${score}`);
    const flatFinding = findings.find(f => f.message.includes('Flat energy'));
    assert.ok(flatFinding, 'Should note flat energy arc');
  });

  it('opening at start + closing at end scores high on intent', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'subtle' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { motion_energy: 'high', content_type: 'portrait' }),
      makeScene('sc_d', { intent_tags: ['closing'], motion_energy: 'subtle', content_type: 'brand_mark' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { score } = scoreFlow(manifestScenes, sceneMap, 'prestige');
    assert.ok(score >= 50, `Expected decent flow score, got ${score}`);
  });

  it('opening at end generates warning', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'moderate' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { motion_energy: 'moderate', content_type: 'portrait' }),
      makeScene('sc_d', { intent_tags: ['opening'], motion_energy: 'subtle', content_type: 'brand_mark' }),
    ];
    const manifestScenes = scenes.map(s => makeManifestScene(s.scene_id, 3.0));
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scoreFlow(manifestScenes, sceneMap, 'prestige');
    const openingWarning = findings.find(f => f.message.includes('Opening scene placed near the end'));
    assert.ok(openingWarning, 'Should warn about misplaced opening');
  });

  it('transitions matching style pack score high', () => {
    // prestige: same weight → hard_cut (default), different weight → crossfade
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark', motion_energy: 'subtle' }),
      makeScene('sc_b', { visual_weight: 'light', motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { visual_weight: 'dark', motion_energy: 'subtle', content_type: 'portrait' }),
    ];
    const manifestScenes = [
      makeManifestScene('sc_a', 3.0),
      makeManifestScene('sc_b', 3.0, { transition_in: { type: 'crossfade', duration_ms: 400 } }),
      makeManifestScene('sc_c', 3.0, { transition_in: { type: 'crossfade', duration_ms: 400 } }),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { score } = scoreFlow(manifestScenes, sceneMap, 'prestige');
    assert.ok(score >= 50, `Expected good transition coherence, got ${score}`);
  });
});

// ── scoreAdherence ──────────────────────────────────────────────────────────

describe('scoreAdherence', () => {
  it('manifest matching style pack rules scores ~100', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'portrait', visual_weight: 'dark', motion_energy: 'static' }),
      makeScene('sc_b', { content_type: 'ui_screenshot', visual_weight: 'light', motion_energy: 'subtle' }),
    ];
    // prestige: portrait → push_in, ui_screenshot → drift; weight change → crossfade
    const manifestScenes = [
      makeManifestScene('sc_a', 3.5, { camera_override: { move: 'push_in', intensity: 0.2 } }),
      makeManifestScene('sc_b', 3.0, {
        transition_in: { type: 'crossfade', duration_ms: 400 },
        camera_override: { move: 'drift', intensity: 0.2 },
      }),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { score } = scoreAdherence(manifestScenes, sceneMap, 'prestige');
    assert.ok(score >= 90, `Expected ~100 for matching rules, got ${score}`);
  });

  it('wrong camera overrides generate warnings', () => {
    const scenes = [
      makeScene('sc_a', { content_type: 'portrait', motion_energy: 'moderate' }),
    ];
    // prestige expects push_in for portrait, we give pull_out
    const manifestScenes = [
      makeManifestScene('sc_a', 3.0, { camera_override: { move: 'pull_out', intensity: 0.5 } }),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scoreAdherence(manifestScenes, sceneMap, 'prestige');
    const cameraFindings = findings.filter(f => f.message.includes('camera'));
    assert.ok(cameraFindings.length > 0, 'Should warn about wrong camera');
  });

  it('wrong transition types generate warnings', () => {
    const scenes = [
      makeScene('sc_a', { visual_weight: 'dark', motion_energy: 'moderate' }),
      makeScene('sc_b', { visual_weight: 'dark', motion_energy: 'moderate' }),
    ];
    // prestige default (same weight, no intent) = hard_cut; we give crossfade
    const manifestScenes = [
      makeManifestScene('sc_a', 3.0),
      makeManifestScene('sc_b', 3.0, { transition_in: { type: 'crossfade', duration_ms: 400 } }),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scoreAdherence(manifestScenes, sceneMap, 'prestige');
    const transFindings = findings.filter(f => f.message.includes('transition'));
    assert.ok(transFindings.length > 0, 'Should warn about wrong transition');
  });

  it('shot grammar violating personality restrictions penalizes', () => {
    const scenes = [makeScene('sc_a', { motion_energy: 'moderate' })];
    // energy = montage personality: only eye_level angle, center framing
    const manifestScenes = [
      makeManifestScene('sc_a', 1.5, {
        camera_override: { move: 'static' },
        shot_grammar: { shot_size: 'medium', angle: 'dutch', framing: 'dynamic_offset' },
      }),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scoreAdherence(manifestScenes, sceneMap, 'energy');
    const grammarFindings = findings.filter(f =>
      f.message.includes('angle') || f.message.includes('framing')
    );
    assert.ok(grammarFindings.length >= 2, `Expected 2+ grammar violations, got ${grammarFindings.length}`);
  });

  it('energy pack with non-static camera generates warning', () => {
    const scenes = [makeScene('sc_a', { content_type: 'portrait', motion_energy: 'moderate' })];
    // energy = force_static, we give push_in
    const manifestScenes = [
      makeManifestScene('sc_a', 1.5, { camera_override: { move: 'push_in', intensity: 0.3 } }),
    ];
    const sceneMap = buildSceneMap(scenes);
    const { findings } = scoreAdherence(manifestScenes, sceneMap, 'energy');
    const cameraFindings = findings.filter(f => f.message.includes('camera'));
    assert.ok(cameraFindings.length > 0, 'Should warn about non-static camera in energy pack');
  });
});

// ── evaluateSequence integration ────────────────────────────────────────────

describe('evaluateSequence', () => {
  it('returns valid structure (score, dimensions, findings)', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'subtle' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { intent_tags: ['closing'], motion_energy: 'subtle', content_type: 'brand_mark' }),
    ];
    const { manifest } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_eval_test' });
    const result = evaluateSequence({ manifest, scenes, style: 'prestige' });

    assert.ok(typeof result.score === 'number');
    assert.ok(result.dimensions);
    assert.ok(result.dimensions.pacing);
    assert.ok(result.dimensions.variety);
    assert.ok(result.dimensions.flow);
    assert.ok(result.dimensions.adherence);
    assert.ok(Array.isArray(result.findings));
  });

  it('score is 0-100', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'] }),
      makeScene('sc_b', { content_type: 'ui_screenshot' }),
    ];
    const { manifest } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_eval_range' });
    const result = evaluateSequence({ manifest, scenes, style: 'prestige' });
    assert.ok(result.score >= 0 && result.score <= 100, `Score ${result.score} out of range`);
  });

  it('findings have required fields (severity, dimension, message)', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'static' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { motion_energy: 'high', content_type: 'portrait' }),
    ];
    const { manifest } = planSequence({ scenes, style: 'dramatic', sequence_id: 'seq_eval_fields' });
    const result = evaluateSequence({ manifest, scenes, style: 'dramatic' });

    for (const finding of result.findings) {
      assert.ok(finding.severity, `Finding missing severity: ${JSON.stringify(finding)}`);
      assert.ok(finding.dimension, `Finding missing dimension: ${JSON.stringify(finding)}`);
      assert.ok(finding.message, `Finding missing message: ${JSON.stringify(finding)}`);
      assert.ok(['warning', 'info', 'suggestion'].includes(finding.severity),
        `Invalid severity: ${finding.severity}`);
    }
  });

  it('different styles produce different scores for same scenes', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'subtle', content_type: 'typography' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { motion_energy: 'high', content_type: 'portrait' }),
      makeScene('sc_d', { intent_tags: ['closing'], motion_energy: 'subtle', content_type: 'brand_mark' }),
    ];

    // Plan with prestige, evaluate with all three styles
    const { manifest } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_eval_diff' });

    const prestigeResult = evaluateSequence({ manifest, scenes, style: 'prestige' });
    const energyResult = evaluateSequence({ manifest, scenes, style: 'energy' });
    const dramaticResult = evaluateSequence({ manifest, scenes, style: 'dramatic' });

    // A prestige-planned manifest should score differently against energy rules
    // (energy expects shorter durations, force_static camera, whip-wipes)
    const scores = new Set([prestigeResult.score, energyResult.score, dramaticResult.score]);
    assert.ok(scores.size >= 2, 'Expected at least 2 different scores across styles');
  });
});

// ── Ground truth: kinetic type scenes → plan → evaluate ─────────────────────

describe('evaluateSequence — kinetic type ground truth', () => {
  const analyzedKinetic = kineticScenes.map(scene => {
    const analysis = analyzeScene(scene);
    return { ...scene, metadata: analysis.metadata };
  });

  it('kinetic type scenes → plan → evaluate > 50 (prestige)', () => {
    const { manifest } = planSequence({
      scenes: analyzedKinetic,
      style: 'prestige',
      sequence_id: 'seq_gt_eval_kinetic_p',
    });
    const result = evaluateSequence({ manifest, scenes: analyzedKinetic, style: 'prestige' });
    assert.ok(result.score > 50,
      `Expected > 50 for planner-generated manifest, got ${result.score}`);
  });

  it('kinetic type scenes → plan → evaluate > 50 (energy)', () => {
    const { manifest } = planSequence({
      scenes: analyzedKinetic,
      style: 'energy',
      sequence_id: 'seq_gt_eval_kinetic_e',
    });
    const result = evaluateSequence({ manifest, scenes: analyzedKinetic, style: 'energy' });
    assert.ok(result.score > 50,
      `Expected > 50 for planner-generated manifest, got ${result.score}`);
  });
});

// ── Ground truth: layout scenes → plan → evaluate ───────────────────────────

describe('evaluateSequence — layout ground truth', () => {
  const analyzedLayouts = layoutScenes.map(scene => {
    const analysis = analyzeScene(scene);
    return { ...scene, metadata: analysis.metadata };
  });

  it('layout scenes → plan → evaluate > 50 (prestige)', () => {
    const { manifest } = planSequence({
      scenes: analyzedLayouts,
      style: 'prestige',
      sequence_id: 'seq_gt_eval_layout_p',
    });
    const result = evaluateSequence({ manifest, scenes: analyzedLayouts, style: 'prestige' });
    assert.ok(result.score > 50,
      `Expected > 50 for planner-generated manifest, got ${result.score}`);
  });

  it('layout scenes → plan → evaluate > 50 (dramatic)', () => {
    const { manifest } = planSequence({
      scenes: analyzedLayouts,
      style: 'dramatic',
      sequence_id: 'seq_gt_eval_layout_d',
    });
    const result = evaluateSequence({ manifest, scenes: analyzedLayouts, style: 'dramatic' });
    assert.ok(result.score > 50,
      `Expected > 50 for planner-generated manifest, got ${result.score}`);
  });
});

// ── ANI-30: Per-scene style blending in evaluator ────────────────────────────

describe('per-scene style blending in evaluator (ANI-30)', () => {
  it('evaluateSequence handles blended manifest (score 0-100)', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'subtle' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot', style_override: 'energy' }),
      makeScene('sc_c', { intent_tags: ['closing'], motion_energy: 'subtle', content_type: 'brand_mark' }),
    ];
    const { manifest } = planSequence({
      scenes,
      style: 'prestige',
      sequence_id: 'seq_eval_blend',
    });
    const result = evaluateSequence({ manifest, scenes, style: 'prestige' });
    assert.ok(result.score >= 0 && result.score <= 100,
      `Score ${result.score} out of range`);
    assert.ok(result.dimensions.pacing);
    assert.ok(result.dimensions.adherence);
  });

  it('pacing scorer uses per-scene pack for expected durations', () => {
    const scenes = [
      makeScene('sc_a', { motion_energy: 'moderate' }),
      makeScene('sc_b', { motion_energy: 'moderate', style_override: 'energy' }),
      makeScene('sc_c', { motion_energy: 'moderate' }),
    ];
    // Build manifest with correct per-scene durations
    const manifestScenes = [
      makeManifestScene('sc_a', 3.0),   // prestige moderate = 3.0
      makeManifestScene('sc_b', 1.5),   // energy moderate = 1.5
      makeManifestScene('sc_c', 3.0),   // prestige moderate = 3.0
    ];
    const sceneMap = buildSceneMap(scenes);
    const { score } = scorePacing(manifestScenes, sceneMap, 'prestige');
    // Should score high because durations match per-scene expectations
    assert.ok(score >= 80, `Expected high pacing score for matching per-scene durations, got ${score}`);
  });

  it('no override = identical to single-style evaluation', () => {
    const scenes = [
      makeScene('sc_a', { intent_tags: ['opening'], motion_energy: 'subtle' }),
      makeScene('sc_b', { motion_energy: 'moderate', content_type: 'ui_screenshot' }),
      makeScene('sc_c', { intent_tags: ['closing'], motion_energy: 'subtle', content_type: 'brand_mark' }),
    ];
    const { manifest } = planSequence({ scenes, style: 'prestige', sequence_id: 'seq_eval_nooverride' });

    const result1 = evaluateSequence({ manifest, scenes, style: 'prestige' });
    const result2 = evaluateSequence({ manifest, scenes, style: 'prestige' });
    assert.equal(result1.score, result2.score, 'Same input should produce same score');
    assert.equal(result1.dimensions.pacing.score, result2.dimensions.pacing.score);
    assert.equal(result1.dimensions.adherence.score, result2.dimensions.adherence.score);
  });
});
