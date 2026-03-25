/**
 * Tests for scene semantic annotations.
 *
 * Covers: scene product role, primary subject, interaction truth,
 * layer annotations, explicit override preservation, fintech integration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  annotateScene,
  annotateScenes,
  inferSceneProductRole,
  inferPrimarySubject,
  inferInteractionTruth,
  inferLayerProductRole,
  inferLayerContentClass,
  inferLayerClarityWeight,
  inferSceneOutcome,
  SCENE_PRODUCT_ROLES,
  LAYER_PRODUCT_ROLES,
  LAYER_CONTENT_CLASSES,
} from '../lib/scene-annotations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── inferSceneProductRole ───────────────────────────────────────────────────

describe('inferSceneProductRole', () => {
  it('returns atmosphere for opening typography scene', () => {
    const scene = { scene_id: 'sc_01_tagline', layers: [] };
    const meta = { intent_tags: ['opening'], content_type: 'typography' };
    assert.equal(inferSceneProductRole(scene, meta), 'atmosphere');
  });

  it('returns atmosphere for closing brand_mark scene', () => {
    const scene = { scene_id: 'sc_09_logo', layers: [] };
    const meta = { intent_tags: ['closing'], content_type: 'brand_mark' };
    assert.equal(inferSceneProductRole(scene, meta), 'atmosphere');
  });

  it('returns transition for transition-tagged scene', () => {
    const scene = { scene_id: 'sc_mid', layers: [] };
    assert.equal(inferSceneProductRole(scene, { intent_tags: ['transition'] }), 'transition');
  });

  it('returns result for chart/data scenes', () => {
    const scene = { scene_id: 'sc_04_chart_drilldown', layers: [] };
    assert.equal(inferSceneProductRole(scene, {}), 'result');
  });

  it('returns dashboard for dashboard scenes', () => {
    const scene = { scene_id: 'sc_dashboard_overview', layers: [] };
    assert.equal(inferSceneProductRole(scene, { content_type: 'ui_screenshot' }), 'dashboard');
  });

  it('returns input for scenes with prompt content', () => {
    const scene = {
      scene_id: 'sc_03_prompt',
      layers: [
        { id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' },
        { id: 'prompt', type: 'html', depth_class: 'foreground', content: '<input placeholder="Ask a question">' },
      ],
    };
    assert.equal(inferSceneProductRole(scene, {}), 'input');
  });

  it('returns cta for logo scenes', () => {
    const scene = { scene_id: 'sc_09_logo', layers: [] };
    assert.equal(inferSceneProductRole(scene, { content_type: 'brand_mark' }), 'cta');
  });

  it('returns result as fallback for hero/detail scenes', () => {
    const scene = { scene_id: 'sc_misc', layers: [] };
    assert.equal(inferSceneProductRole(scene, { intent_tags: ['hero'] }), 'result');
  });

  it('all returned values are valid SCENE_PRODUCT_ROLES', () => {
    const cases = [
      [{ scene_id: 'sc_open', layers: [] }, { intent_tags: ['opening'], content_type: 'typography' }],
      [{ scene_id: 'sc_chart', layers: [] }, {}],
      [{ scene_id: 'sc_dash', layers: [] }, { content_type: 'ui_screenshot' }],
    ];
    for (const [scene, meta] of cases) {
      const role = inferSceneProductRole(scene, meta);
      assert.ok(SCENE_PRODUCT_ROLES.includes(role), `${role} not in SCENE_PRODUCT_ROLES`);
    }
  });
});

// ── inferPrimarySubject ─────────────────────────────────────────────────────

describe('inferPrimarySubject', () => {
  it('returns first foreground layer id', () => {
    const scene = {
      layers: [
        { id: 'bg', depth_class: 'background' },
        { id: 'hero', depth_class: 'foreground' },
        { id: 'caption', depth_class: 'foreground' },
      ],
    };
    assert.equal(inferPrimarySubject(scene), 'hero');
  });

  it('prefers motion-targeted layer', () => {
    const scene = {
      layers: [
        { id: 'bg', depth_class: 'background' },
        { id: 'a', depth_class: 'foreground' },
        { id: 'b', depth_class: 'foreground' },
      ],
      motion: { groups: [{ targets: ['b'], primitive: 'as-fadeIn' }] },
    };
    assert.equal(inferPrimarySubject(scene), 'b');
  });

  it('returns null for empty layers', () => {
    assert.equal(inferPrimarySubject({ layers: [] }), null);
  });

  it('falls back to first layer when no foreground', () => {
    const scene = { layers: [{ id: 'only', depth_class: 'background' }] };
    assert.equal(inferPrimarySubject(scene), 'only');
  });
});

// ── inferInteractionTruth ───────────────────────────────────────────────────

describe('inferInteractionTruth', () => {
  it('detects typing from typewriter animation', () => {
    const scene = {
      duration_s: 4,
      layers: [{ id: 'text', animation: 'typewriter' }],
      motion: { groups: [] },
    };
    const truth = inferInteractionTruth(scene);
    assert.equal(truth.has_typing, true);
  });

  it('detects cursor from layer type', () => {
    const scene = {
      duration_s: 3,
      layers: [{ id: 'cur', type: 'cursor' }],
      motion: { groups: [] },
    };
    assert.equal(inferInteractionTruth(scene).has_cursor, true);
  });

  it('detects state change from multiple motion groups', () => {
    const scene = {
      duration_s: 5,
      layers: [{ id: 'a' }, { id: 'b' }],
      motion: {
        groups: [
          { targets: ['a'], primitive: 'as-fadeIn' },
          { targets: ['b'], primitive: 'as-fadeIn', delay_ms: 500 },
        ],
      },
    };
    const truth = inferInteractionTruth(scene);
    assert.equal(truth.has_state_change, true);
    assert.equal(truth.timing_realistic, true);
  });

  it('timing_realistic false for short scenes without delays', () => {
    const scene = {
      duration_s: 1.5,
      layers: [{ id: 'a' }],
      motion: { groups: [{ targets: ['a'], primitive: 'as-fadeIn' }] },
    };
    assert.equal(inferInteractionTruth(scene).timing_realistic, false);
  });

  it('returns all-false for minimal scene', () => {
    const truth = inferInteractionTruth({ layers: [] });
    assert.equal(truth.has_cursor, false);
    assert.equal(truth.has_typing, false);
    assert.equal(truth.has_state_change, false);
    assert.equal(truth.timing_realistic, false);
  });
});

// ── inferLayerProductRole ───────────────────────────────────────────────────

describe('inferLayerProductRole', () => {
  it('returns decorative for background', () => {
    assert.equal(inferLayerProductRole({ depth_class: 'background' }, false), 'decorative');
  });

  it('returns hero for first foreground', () => {
    assert.equal(inferLayerProductRole({ depth_class: 'foreground' }, true), 'hero');
  });

  it('returns supporting for additional foreground', () => {
    assert.equal(inferLayerProductRole({ depth_class: 'foreground' }, false), 'supporting');
  });

  it('returns functional for caption text', () => {
    assert.equal(inferLayerProductRole({ type: 'text', block_role: 'caption' }, false), 'functional');
  });
});

// ── inferLayerContentClass ──────────────────────────────────────────────────

describe('inferLayerContentClass', () => {
  it('returns typography for text layers', () => {
    assert.equal(inferLayerContentClass({ type: 'text' }, {}), 'typography');
  });

  it('returns atmosphere for background HTML', () => {
    assert.equal(inferLayerContentClass({ type: 'html', depth_class: 'background' }, {}), 'atmosphere');
  });

  it('returns ui_control for foreground HTML', () => {
    assert.equal(inferLayerContentClass({ type: 'html', depth_class: 'foreground', id: 'panel', content: '<div>Details</div>' }, {}), 'ui_control');
  });

  it('returns data_viz for chart content', () => {
    assert.equal(inferLayerContentClass({ type: 'html', id: 'chart_area', content: '<div class="chart">bar</div>' }, {}), 'data_viz');
  });

  it('returns data_viz for compound card types', () => {
    assert.equal(inferLayerContentClass({ type: 'card_conveyor' }, {}), 'data_viz');
    assert.equal(inferLayerContentClass({ type: 'result_grid' }, {}), 'data_viz');
  });

  it('returns interaction for cursor layer', () => {
    assert.equal(inferLayerContentClass({ type: 'cursor', id: 'cursor' }, {}), 'interaction');
  });

  it('returns branding for image in logo scene', () => {
    assert.equal(inferLayerContentClass({ type: 'image', id: 'logo_img' }, { scene_id: 'sc_09_logo' }), 'branding');
  });
});

// ── inferLayerClarityWeight ─────────────────────────────────────────────────

describe('inferLayerClarityWeight', () => {
  it('returns 5 for hero', () => assert.equal(inferLayerClarityWeight('hero'), 5));
  it('returns 3 for supporting', () => assert.equal(inferLayerClarityWeight('supporting'), 3));
  it('returns 2 for functional', () => assert.equal(inferLayerClarityWeight('functional'), 2));
  it('returns 1 for decorative', () => assert.equal(inferLayerClarityWeight('decorative'), 1));
});

// ── annotateScene ───────────────────────────────────────────────────────────

describe('annotateScene', () => {
  it('adds all inferred fields', () => {
    const scene = {
      scene_id: 'sc_03_prompt_input',
      duration_s: 4,
      layers: [
        { id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' },
        { id: 'prompt', type: 'html', depth_class: 'foreground', content: '<input placeholder="Ask">' },
      ],
      motion: { groups: [{ targets: ['prompt'], primitive: 'cd-panel-drilldown' }] },
      metadata: { intent_tags: ['detail'] },
    };

    const annotated = annotateScene(scene);
    assert.equal(annotated.product_role, 'input');
    assert.equal(annotated.primary_subject, 'prompt');
    assert.ok(annotated.interaction_truth);
    assert.ok(annotated.outcome);

    // Layer annotations
    assert.equal(annotated.layers[0].product_role, 'decorative');
    assert.equal(annotated.layers[0].clarity_weight, 1);
    assert.equal(annotated.layers[1].product_role, 'hero');
    assert.equal(annotated.layers[1].clarity_weight, 5);
  });

  it('preserves explicit annotations', () => {
    const scene = {
      scene_id: 'sc_custom',
      product_role: 'proof',
      primary_subject: 'custom_layer',
      layers: [
        { id: 'custom_layer', type: 'html', product_role: 'supporting', content_class: 'branding', clarity_weight: 4 },
      ],
    };

    const annotated = annotateScene(scene);
    assert.equal(annotated.product_role, 'proof');
    assert.equal(annotated.primary_subject, 'custom_layer');
    assert.equal(annotated.layers[0].product_role, 'supporting');
    assert.equal(annotated.layers[0].content_class, 'branding');
    assert.equal(annotated.layers[0].clarity_weight, 4);
  });

  it('does not mutate input', () => {
    const scene = { scene_id: 'sc_test', layers: [{ id: 'a', type: 'text' }] };
    const original = JSON.stringify(scene);
    annotateScene(scene);
    assert.equal(JSON.stringify(scene), original);
  });
});

// ── Fintech-sizzle integration ──────────────────────────────────────────────

describe('fintech-sizzle integration', () => {
  const scenesDir = resolve(ROOT, 'examples/fintech-sizzle/scenes');
  let scenes;

  try {
    scenes = readdirSync(scenesDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => JSON.parse(readFileSync(resolve(scenesDir, f), 'utf-8')));
  } catch {
    scenes = [];
  }

  it('annotates all 9 fintech scenes', () => {
    if (scenes.length === 0) return; // skip if example not present
    const annotated = annotateScenes(scenes);
    assert.equal(annotated.length, 9);

    for (const s of annotated) {
      assert.ok(SCENE_PRODUCT_ROLES.includes(s.product_role), `${s.scene_id}: invalid product_role ${s.product_role}`);
      assert.ok(s.primary_subject, `${s.scene_id}: missing primary_subject`);
      assert.ok(s.outcome, `${s.scene_id}: missing outcome`);
      assert.ok(s.interaction_truth, `${s.scene_id}: missing interaction_truth`);
    }
  });

  it('sc_01_tagline_open is atmosphere', () => {
    if (scenes.length === 0) return;
    const s = annotateScene(scenes.find(s => s.scene_id === 'sc_01_tagline_open'));
    assert.equal(s.product_role, 'atmosphere');
  });

  it('sc_03_prompt_input is input', () => {
    if (scenes.length === 0) return;
    const s = annotateScene(scenes.find(s => s.scene_id === 'sc_03_prompt_input'));
    assert.equal(s.product_role, 'input');
  });

  it('sc_04_chart_drilldown is result', () => {
    if (scenes.length === 0) return;
    const s = annotateScene(scenes.find(s => s.scene_id === 'sc_04_chart_drilldown'));
    assert.equal(s.product_role, 'result');
  });

  it('sc_06_dashboard is dashboard', () => {
    if (scenes.length === 0) return;
    const s = annotateScene(scenes.find(s => s.scene_id === 'sc_06_dashboard'));
    assert.equal(s.product_role, 'dashboard');
  });

  it('sc_09_logo is cta', () => {
    if (scenes.length === 0) return;
    const s = annotateScene(scenes.find(s => s.scene_id === 'sc_09_logo'));
    assert.equal(s.product_role, 'cta');
  });

  it('hero layers get clarity_weight 5', () => {
    if (scenes.length === 0) return;
    const annotated = annotateScenes(scenes);
    for (const s of annotated) {
      const hero = s.layers.find(l => l.product_role === 'hero');
      if (hero) {
        assert.equal(hero.clarity_weight, 5, `${s.scene_id} hero should have clarity_weight 5`);
      }
    }
  });
});
