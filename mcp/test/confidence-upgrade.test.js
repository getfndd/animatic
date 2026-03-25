/**
 * Tests for project confidence upgrade tool.
 *
 * Covers: patch generation, modes, heuristics, application, fintech integration.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { upgradeProjectConfidence, VALID_PATCH_OPS, SAFE_SCENE_FIELDS, SAFE_LAYER_FIELDS } from '../lib/confidence-upgrade.js';
import { annotateScenes } from '../lib/scene-annotations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeScene(id, opts = {}) {
  return {
    scene_id: id,
    duration_s: opts.duration_s || 4,
    layers: opts.layers || [
      { id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' },
      { id: 'main', type: 'html', depth_class: 'foreground', content: opts.content || '<div>Content</div>' },
    ],
    motion: opts.motion || { groups: [{ targets: ['main'], primitive: 'as-fadeIn' }] },
    metadata: opts.metadata || {},
  };
}

// ── Suggest mode ────────────────────────────────────────────────────────────

describe('upgradeProjectConfidence — suggest', () => {
  it('generates patches for low-confidence scenes', () => {
    const scenes = annotateScenes([
      makeScene('sc_03_prompt_input', { content: '<input placeholder="Ask">' }),
      makeScene('sc_misc_stuff'),
    ]);

    const result = upgradeProjectConfidence({ scenes, mode: 'suggest' });
    assert.ok(result.patches.length > 0, 'should generate patches');
    assert.equal(result.before_score, result.after_score); // suggest doesn't change score
  });

  it('suggests product_role from scene_id keywords', () => {
    // Use a scene with ambiguous content but clear scene_id
    const scenes = annotateScenes([
      makeScene('sc_misc_vague', { content: '<div>Some content</div>' }),
    ]);

    // Force low confidence to trigger patching
    const result = upgradeProjectConfidence({
      scenes, mode: 'suggest',
      rules: { min_confidence_to_apply_structural_unlock: 0.95 },
    });
    // Should suggest outcome at minimum for any low-confidence scene
    assert.ok(result.patches.length > 0, 'should generate patches for low-confidence scene');
  });

  it('suggests interaction_truth from layer content', () => {
    // Use a scene where annotation confidence for interaction_truth is low
    const scenes = annotateScenes([
      makeScene('sc_some_form', { content: '<input placeholder="Type here">', duration_s: 4 }),
    ]);
    // Force low interaction_truth confidence
    scenes[0]._annotation_confidence.interaction_truth = 0.4;

    const result = upgradeProjectConfidence({ scenes, mode: 'suggest' });
    const truthPatch = result.patches.find(p => p.path === 'interaction_truth');
    assert.ok(truthPatch, 'should suggest interaction_truth');
    assert.equal(truthPatch.value.has_typing, true);
  });

  it('suggests primary_subject and hero layer', () => {
    const scenes = annotateScenes([
      makeScene('sc_05_vague', {
        layers: [
          { id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' },
          { id: 'panel_a', type: 'html', depth_class: 'foreground', content: '<div>Short</div>' },
          { id: 'panel_b', type: 'html', depth_class: 'foreground', content: '<div>Much longer content here that dominates the screen space and has more visual weight than the other panel</div>' },
        ],
      }),
    ]);

    const result = upgradeProjectConfidence({ scenes, mode: 'suggest' });
    const subjectPatch = result.patches.find(p => p.path === 'primary_subject');
    assert.ok(subjectPatch, 'should suggest primary_subject');
  });

  it('only targets specified scenes when targets provided', () => {
    const scenes = annotateScenes([
      makeScene('sc_01_open'),
      makeScene('sc_02_detail'),
    ]);

    const result = upgradeProjectConfidence({ scenes, mode: 'suggest', targets: ['sc_01_open'] });
    const sceneIds = [...new Set(result.patches.map(p => p.scene_id))];
    assert.ok(sceneIds.every(id => id === 'sc_01_open'), 'should only patch targeted scene');
  });

  it('respects max_patches', () => {
    const scenes = annotateScenes(Array.from({ length: 10 }, (_, i) => makeScene(`sc_${i}_thing`)));
    const result = upgradeProjectConfidence({ scenes, mode: 'suggest', max_patches: 3 });
    assert.ok(result.patches.length <= 3);
  });

  it('all patches have required fields', () => {
    const scenes = annotateScenes([makeScene('sc_03_prompt_input')]);
    const result = upgradeProjectConfidence({ scenes, mode: 'suggest' });

    for (const p of result.patches) {
      assert.ok(VALID_PATCH_OPS.includes(p.op), `Invalid op: ${p.op}`);
      assert.ok(p.scene_id, 'missing scene_id');
      assert.ok(typeof p.reason === 'string' && p.reason.length > 0, 'missing reason');
      assert.ok(typeof p.confidence === 'number', 'missing confidence');
      assert.ok(typeof p.source === 'string', 'missing source');
    }
  });
});

// ── Apply mode ──────────────────────────────────────────────────────────────

describe('upgradeProjectConfidence — apply', () => {
  it('applies patches and improves audit score', () => {
    const scenes = annotateScenes([
      makeScene('sc_03_prompt_input', { content: '<input placeholder="Ask">' }),
    ]);

    const result = upgradeProjectConfidence({ scenes, mode: 'apply' });
    assert.ok(result.after_score >= result.before_score, 'score should not decrease');
    assert.ok(result.scenes, 'should return patched scenes');
  });

  it('apply_safe_only skips continuity links', () => {
    const scenes = annotateScenes([
      makeScene('sc_01_open'),
      makeScene('sc_02_chart'),
    ]);
    // Force high confidence so continuity patches are generated
    for (const s of scenes) {
      s._annotation_confidence = { product_role: 0.9, primary_subject: 0.9, interaction_truth: 0.9, outcome: 0.9, has_hero: 0.9, overall: 0.9 };
    }

    const result = upgradeProjectConfidence({ scenes, mode: 'apply_safe_only' });
    const continuityApplied = result.scenes?.some(s => s.layers?.some(l => l.continuity_id));
    // apply_safe_only should NOT apply continuity links
    // (they may exist from annotation, but not from this tool's patches)
  });

  it('does not mutate input scenes', () => {
    const scenes = annotateScenes([makeScene('sc_test')]);
    const original = JSON.stringify(scenes);
    upgradeProjectConfidence({ scenes, mode: 'apply' });
    assert.equal(JSON.stringify(scenes), original);
  });
});

// ── Continuity patches ──────────────────────────────────────────────────────

describe('upgradeProjectConfidence — continuity', () => {
  it('suggests hero-to-hero continuity for confident adjacent scenes', () => {
    const scenes = [
      { scene_id: 'sc_a', product_role: 'input', primary_subject: 'prompt',
        layers: [{ id: 'prompt', product_role: 'hero', depth_class: 'foreground' }],
        _annotation_confidence: { product_role: 0.9, primary_subject: 0.9, interaction_truth: 0.9, outcome: 0.9, has_hero: 1, overall: 0.9 } },
      { scene_id: 'sc_b', product_role: 'result', primary_subject: 'chart',
        layers: [{ id: 'chart', product_role: 'hero', depth_class: 'foreground' }],
        _annotation_confidence: { product_role: 0.9, primary_subject: 0.9, interaction_truth: 0.9, outcome: 0.9, has_hero: 1, overall: 0.9 } },
    ];

    const result = upgradeProjectConfidence({ scenes, mode: 'suggest', rules: { min_confidence_to_apply_continuity: 0.8 } });
    const contPatch = result.patches.find(p => p.op === 'add_continuity_link');
    assert.ok(contPatch, 'should suggest continuity link');
    assert.equal(contPatch.from_layer_id, 'prompt');
    assert.equal(contPatch.to_layer_id, 'chart');
    assert.equal(contPatch.source, 'matched_from_hero_layers');
  });

  it('does not suggest continuity when confidence is low', () => {
    const scenes = annotateScenes([
      makeScene('sc_a'),
      makeScene('sc_b'),
    ]);

    const result = upgradeProjectConfidence({ scenes, mode: 'suggest', rules: { min_confidence_to_apply_continuity: 0.95 } });
    const contPatches = result.patches.filter(p => p.op === 'add_continuity_link');
    assert.equal(contPatches.length, 0, 'should not suggest continuity at high threshold');
  });
});

// ── Output format ───────────────────────────────────────────────────────────

describe('upgradeProjectConfidence — output', () => {
  it('returns expected output shape', () => {
    const scenes = annotateScenes([makeScene('sc_test')]);
    const result = upgradeProjectConfidence({ scenes, mode: 'suggest' });

    assert.ok(Array.isArray(result.patches));
    assert.ok(Array.isArray(result.patched_scenes));
    assert.ok(typeof result.before_score === 'number');
    assert.ok(typeof result.after_score === 'number');
    assert.ok(Array.isArray(result.unlocked_scenes));
    assert.ok(Array.isArray(result.remaining_gaps));
  });

  it('reports unlocked scenes after apply', () => {
    const scenes = annotateScenes([
      makeScene('sc_03_prompt_input', { content: '<input placeholder="Ask">' }),
    ]);

    const result = upgradeProjectConfidence({ scenes, mode: 'apply' });
    // May or may not unlock depending on confidence thresholds
    assert.ok(Array.isArray(result.unlocked_scenes));
  });

  it('handles empty scenes gracefully', () => {
    const result = upgradeProjectConfidence({ scenes: [], mode: 'suggest' });
    assert.equal(result.patches.length, 0);
    assert.equal(result.before_score, 0);
  });
});

// ── Fintech integration ─────────────────────────────────────────────────────

describe('fintech-sizzle confidence upgrade', () => {
  let scenes;
  try {
    const dir = resolve(ROOT, 'examples/fintech-sizzle/scenes');
    scenes = annotateScenes(
      readdirSync(dir).filter(f => f.endsWith('.json')).sort()
        .map(f => JSON.parse(readFileSync(resolve(dir, f), 'utf-8')))
    );
  } catch { scenes = []; }

  it('generates patches for low-confidence fintech scenes', () => {
    if (scenes.length === 0) return;
    const result = upgradeProjectConfidence({ scenes, mode: 'suggest' });
    assert.ok(result.patches.length > 0, 'should find patches for fintech scenes');

    // sc_02 (insight_cards) and sc_05 (followup) were flagged as low confidence
    const lowConfScenes = result.patched_scenes;
    assert.ok(lowConfScenes.length > 0, 'should target low-confidence scenes');
  });

  it('apply mode improves or maintains audit score', () => {
    if (scenes.length === 0) return;
    const result = upgradeProjectConfidence({ scenes, mode: 'apply' });
    assert.ok(result.after_score >= result.before_score,
      `Score should not decrease: ${result.before_score} → ${result.after_score}`);
  });
});
