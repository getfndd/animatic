/**
 * Tests for Shot Grammar Engine (ANI-26).
 *
 * Covers: classifyShotSize, classifyAngle, classifyFraming,
 * validateShotGrammar, resolveShotGrammarCSS, classifyShotGrammar,
 * and ground truth scenes.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyShotSize,
  classifyAngle,
  classifyFraming,
  validateShotGrammar,
  resolveShotGrammarCSS,
  classifyShotGrammar,
  SHOT_SIZES,
  ANGLES,
  FRAMINGS,
} from '../lib/shot-grammar.js';

import { analyzeScene } from '../lib/analyze.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Load ground truth scenes ────────────────────────────────────────────────

const kineticTypeManifest = JSON.parse(
  readFileSync(resolve(ROOT, 'src/remotion/manifests/test-kinetic-type.json'), 'utf-8')
);
const layoutManifest = JSON.parse(
  readFileSync(resolve(ROOT, 'src/remotion/manifests/test-layouts.json'), 'utf-8')
);

const kineticScenes = kineticTypeManifest.sceneDefs;
const layoutScenes = layoutManifest.sceneDefs;

// ── Test helper ──────────────────────────────────────────────────────────────

function makeScene(overrides = {}) {
  return {
    scene_id: 'sc_test',
    layers: [{ id: 'l1', type: 'text', depth_class: 'foreground' }],
    metadata: {
      content_type: 'typography',
      visual_weight: 'dark',
      motion_energy: 'moderate',
      intent_tags: [],
    },
    ...overrides,
  };
}

// ── classifyShotSize ─────────────────────────────────────────────────────────

describe('classifyShotSize', () => {
  it('masonry-grid → wide', () => {
    const scene = makeScene({ layout: { template: 'masonry-grid' } });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'wide');
    assert.ok(result.confidence >= 0.90);
  });

  it('split-panel → wide', () => {
    const scene = makeScene({ layout: { template: 'split-panel' } });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'wide');
    assert.ok(result.confidence >= 0.90);
  });

  it('device-mockup → medium', () => {
    const scene = makeScene({ layout: { template: 'device-mockup' } });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'medium');
    assert.ok(result.confidence >= 0.90);
  });

  it('hero-center with single text → close_up', () => {
    const scene = makeScene({
      layout: { template: 'hero-center' },
      layers: [{ id: 'l1', type: 'text', depth_class: 'foreground' }],
    });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'close_up');
    assert.ok(result.confidence >= 0.85);
  });

  it('hero-center with multiple layers → medium', () => {
    const scene = makeScene({
      layout: { template: 'hero-center' },
      layers: [
        { id: 'l1', type: 'text', depth_class: 'foreground' },
        { id: 'l2', type: 'html', depth_class: 'foreground' },
      ],
    });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'medium');
  });

  it('content type affinity: collage → wide', () => {
    const scene = makeScene({ metadata: { content_type: 'collage', intent_tags: [] } });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'wide');
    assert.ok(result.confidence >= 0.70);
  });

  it('content type affinity: notification → extreme_close_up', () => {
    const scene = makeScene({ metadata: { content_type: 'notification', intent_tags: [] } });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'extreme_close_up');
  });

  it('content type affinity: typography → close_up', () => {
    const scene = makeScene({ metadata: { content_type: 'typography', intent_tags: [] } });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'close_up');
  });

  it('content type affinity: ui_screenshot → medium', () => {
    const scene = makeScene({ metadata: { content_type: 'ui_screenshot', intent_tags: [] } });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'medium');
  });

  it('layer count fallback: 4+ fg → wide', () => {
    const scene = makeScene({
      metadata: { content_type: 'unknown_type', intent_tags: [] },
      layers: [
        { id: 'l1', type: 'html', depth_class: 'foreground' },
        { id: 'l2', type: 'html', depth_class: 'foreground' },
        { id: 'l3', type: 'html', depth_class: 'foreground' },
        { id: 'l4', type: 'html', depth_class: 'foreground' },
      ],
    });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'wide');
  });

  it('layer count fallback: 1 fg → close_up', () => {
    const scene = makeScene({
      metadata: { content_type: 'unknown_type', intent_tags: [] },
      layers: [
        { id: 'bg', type: 'html', depth_class: 'background' },
        { id: 'l1', type: 'html', depth_class: 'foreground' },
      ],
    });
    const result = classifyShotSize(scene);
    assert.equal(result.value, 'close_up');
  });
});

// ── classifyAngle ────────────────────────────────────────────────────────────

describe('classifyAngle', () => {
  it('hero intent → low', () => {
    const scene = makeScene({ metadata: { intent_tags: ['hero'], content_type: 'brand_mark' } });
    const result = classifyAngle(scene);
    assert.equal(result.value, 'low');
  });

  it('opening intent → low', () => {
    const scene = makeScene({ metadata: { intent_tags: ['opening'], content_type: 'typography' } });
    const result = classifyAngle(scene);
    assert.equal(result.value, 'low');
  });

  it('informational intent → high', () => {
    const scene = makeScene({ metadata: { intent_tags: ['informational'], content_type: 'collage' } });
    const result = classifyAngle(scene);
    assert.equal(result.value, 'high');
  });

  it('portrait content type → eye_level', () => {
    const scene = makeScene({ metadata: { intent_tags: [], content_type: 'portrait' } });
    const result = classifyAngle(scene);
    assert.equal(result.value, 'eye_level');
    assert.ok(result.confidence >= 0.85);
  });

  it('data_visualization → high', () => {
    const scene = makeScene({ metadata: { intent_tags: [], content_type: 'data_visualization' } });
    const result = classifyAngle(scene);
    assert.equal(result.value, 'high');
  });

  it('default → eye_level', () => {
    const scene = makeScene({ metadata: { intent_tags: [], content_type: 'ui_screenshot' } });
    const result = classifyAngle(scene);
    assert.equal(result.value, 'eye_level');
  });
});

// ── classifyFraming ──────────────────────────────────────────────────────────

describe('classifyFraming', () => {
  it('split-panel → rule_of_thirds_left', () => {
    const scene = makeScene({ layout: { template: 'split-panel' } });
    const result = classifyFraming(scene);
    assert.equal(result.value, 'rule_of_thirds_left');
    assert.ok(result.confidence >= 0.85);
  });

  it('device-mockup (right) → rule_of_thirds_right', () => {
    const scene = makeScene({ layout: { template: 'device-mockup' } });
    const result = classifyFraming(scene);
    assert.equal(result.value, 'rule_of_thirds_right');
  });

  it('device-mockup (left) → rule_of_thirds_left', () => {
    const scene = makeScene({ layout: { template: 'device-mockup', config: { deviceSide: 'left' } } });
    const result = classifyFraming(scene);
    assert.equal(result.value, 'rule_of_thirds_left');
  });

  it('hero intent → center', () => {
    const scene = makeScene({ metadata: { intent_tags: ['hero'], content_type: 'brand_mark' } });
    const result = classifyFraming(scene);
    assert.equal(result.value, 'center');
  });

  it('default → center', () => {
    const scene = makeScene({ metadata: { intent_tags: [], content_type: 'ui_screenshot' } });
    const result = classifyFraming(scene);
    assert.equal(result.value, 'center');
  });
});

// ── validateShotGrammar ──────────────────────────────────────────────────────

describe('validateShotGrammar', () => {
  it('cinematic-dark allows all axes', () => {
    const sg = { shot_size: 'extreme_close_up', angle: 'dutch', framing: 'dynamic_offset' };
    const result = validateShotGrammar(sg, 'cinematic-dark');
    assert.equal(result.valid, true);
    assert.equal(result.corrections.length, 0);
    assert.deepEqual(result.result, sg);
  });

  it('editorial restricts extreme_close_up and dutch angle', () => {
    const sg = { shot_size: 'extreme_close_up', angle: 'dutch', framing: 'center' };
    const result = validateShotGrammar(sg, 'editorial');
    assert.equal(result.valid, false);
    assert.equal(result.corrections.length, 2);
    assert.equal(result.result.shot_size, 'medium');
    assert.equal(result.result.angle, 'eye_level');
  });

  it('neutral-light restricts to wide/medium, eye_level, center', () => {
    const sg = { shot_size: 'close_up', angle: 'high', framing: 'rule_of_thirds_left' };
    const result = validateShotGrammar(sg, 'neutral-light');
    assert.equal(result.valid, false);
    assert.equal(result.corrections.length, 3);
    assert.equal(result.result.shot_size, 'medium');
    assert.equal(result.result.angle, 'eye_level');
    assert.equal(result.result.framing, 'center');
  });

  it('montage allows all sizes but restricts angles/framings', () => {
    const sg = { shot_size: 'extreme_close_up', angle: 'high', framing: 'rule_of_thirds_left' };
    const result = validateShotGrammar(sg, 'montage');
    assert.equal(result.valid, false);
    assert.equal(result.result.shot_size, 'extreme_close_up'); // allowed
    assert.equal(result.result.angle, 'eye_level'); // corrected
    assert.equal(result.result.framing, 'center'); // corrected
  });
});

// ── resolveShotGrammarCSS ────────────────────────────────────────────────────

describe('resolveShotGrammarCSS', () => {
  it('close_up + low + center → correct CSS values', () => {
    const css = resolveShotGrammarCSS(
      { shot_size: 'close_up', angle: 'low', framing: 'center' },
      'cinematic-dark'
    );
    assert.equal(css.scale, 1.2);
    assert.equal(css.perspectiveOrigin, '50% 70%');
    assert.equal(css.rotateX, -2);
    assert.equal(css.rotateZ, 0);
    assert.equal(css.transformOrigin, '50% 50%');
  });

  it('extreme_close_up + dutch + dynamic_offset', () => {
    const css = resolveShotGrammarCSS(
      { shot_size: 'extreme_close_up', angle: 'dutch', framing: 'dynamic_offset' },
      'cinematic-dark'
    );
    assert.equal(css.scale, 1.4);
    assert.equal(css.rotateZ, 3);
    assert.equal(css.transformOrigin, '30% 40%');
  });

  it('wide + eye_level + rule_of_thirds_left', () => {
    const css = resolveShotGrammarCSS(
      { shot_size: 'wide', angle: 'eye_level', framing: 'rule_of_thirds_left' },
      'editorial'
    );
    assert.equal(css.scale, 1.0);
    assert.equal(css.perspectiveOrigin, '50% 50%'); // 3D suppressed
    assert.equal(css.rotateX, 0);
    assert.equal(css.transformOrigin, '33% 50%');
  });

  it('editorial suppresses 3D rotation and caps scale', () => {
    const css = resolveShotGrammarCSS(
      { shot_size: 'close_up', angle: 'high', framing: 'center' },
      'editorial'
    );
    assert.equal(css.scale, 1.2); // close_up scale exactly at max
    assert.equal(css.rotateX, 0); // 3D suppressed
    assert.equal(css.perspectiveOrigin, '50% 50%'); // reset
  });

  it('neutral-light caps scale at 1.08', () => {
    const css = resolveShotGrammarCSS(
      { shot_size: 'medium', angle: 'eye_level', framing: 'center' },
      'neutral-light'
    );
    assert.ok(css.scale <= 1.08);
  });
});

// ── classifyShotGrammar (convenience) ────────────────────────────────────────

describe('classifyShotGrammar', () => {
  it('returns grammar and confidence objects', () => {
    const scene = makeScene({
      layout: { template: 'split-panel' },
      metadata: { content_type: 'split_panel', intent_tags: ['informational'] },
    });
    const result = classifyShotGrammar(scene);
    assert.ok(SHOT_SIZES.includes(result.grammar.shot_size));
    assert.ok(ANGLES.includes(result.grammar.angle));
    assert.ok(FRAMINGS.includes(result.grammar.framing));
    assert.ok(result.confidence.shot_size > 0);
    assert.ok(result.confidence.angle > 0);
    assert.ok(result.confidence.framing > 0);
  });
});

// ── Ground truth: kinetic type scenes ───────────────────────────────────────

describe('shot grammar — kinetic type ground truth', () => {
  it('kinetic type scenes produce valid shot grammar', () => {
    for (const [id, scene] of Object.entries(kineticScenes)) {
      const analyzed = analyzeScene(scene);
      const sceneWithMeta = { ...scene, metadata: analyzed.metadata };
      const result = classifyShotGrammar(sceneWithMeta);

      assert.ok(SHOT_SIZES.includes(result.grammar.shot_size), `${id}: invalid shot_size`);
      assert.ok(ANGLES.includes(result.grammar.angle), `${id}: invalid angle`);
      assert.ok(FRAMINGS.includes(result.grammar.framing), `${id}: invalid framing`);
    }
  });
});

// ── Ground truth: layout template scenes ────────────────────────────────────

describe('shot grammar — layout template ground truth', () => {
  it('layout scenes produce valid and expected shot grammar', () => {
    for (const [id, scene] of Object.entries(layoutScenes)) {
      const analyzed = analyzeScene(scene);
      const sceneWithMeta = { ...scene, metadata: analyzed.metadata };
      const result = classifyShotGrammar(sceneWithMeta);

      assert.ok(SHOT_SIZES.includes(result.grammar.shot_size), `${id}: invalid shot_size`);
      assert.ok(ANGLES.includes(result.grammar.angle), `${id}: invalid angle`);
      assert.ok(FRAMINGS.includes(result.grammar.framing), `${id}: invalid framing`);
    }
  });

  it('split-panel scene → wide + rule_of_thirds_left', () => {
    const scene = layoutScenes.sc_split_panel;
    const analyzed = analyzeScene(scene);
    const sceneWithMeta = { ...scene, metadata: analyzed.metadata };
    const result = classifyShotGrammar(sceneWithMeta);

    assert.equal(result.grammar.shot_size, 'wide');
    assert.equal(result.grammar.framing, 'rule_of_thirds_left');
  });

  it('device-mockup scene → medium + rule_of_thirds_right', () => {
    const scene = layoutScenes.sc_device_mockup;
    const analyzed = analyzeScene(scene);
    const sceneWithMeta = { ...scene, metadata: analyzed.metadata };
    const result = classifyShotGrammar(sceneWithMeta);

    assert.equal(result.grammar.shot_size, 'medium');
    assert.equal(result.grammar.framing, 'rule_of_thirds_right');
  });
});

// ── Enum exports ─────────────────────────────────────────────────────────────

describe('enum exports', () => {
  it('SHOT_SIZES has 4 entries', () => {
    assert.equal(SHOT_SIZES.length, 4);
    assert.ok(SHOT_SIZES.includes('wide'));
    assert.ok(SHOT_SIZES.includes('medium'));
    assert.ok(SHOT_SIZES.includes('close_up'));
    assert.ok(SHOT_SIZES.includes('extreme_close_up'));
  });

  it('ANGLES has 4 entries', () => {
    assert.equal(ANGLES.length, 4);
    assert.ok(ANGLES.includes('eye_level'));
    assert.ok(ANGLES.includes('high'));
    assert.ok(ANGLES.includes('low'));
    assert.ok(ANGLES.includes('dutch'));
  });

  it('FRAMINGS has 4 entries', () => {
    assert.equal(FRAMINGS.length, 4);
    assert.ok(FRAMINGS.includes('center'));
    assert.ok(FRAMINGS.includes('rule_of_thirds_left'));
    assert.ok(FRAMINGS.includes('rule_of_thirds_right'));
    assert.ok(FRAMINGS.includes('dynamic_offset'));
  });
});
