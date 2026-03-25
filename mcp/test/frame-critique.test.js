/**
 * Tests for frame strip critique — render-aware scoring.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreFrameStrip, FRAME_DIMENSIONS } from '../lib/frame-critique.js';
import { annotateScenes } from '../lib/scene-annotations.js';
import { generateContactSheet } from '../lib/storyboard-tools.js';
import { loadBrand } from '../lib/brands.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeSheet(id, opts = {}) {
  return {
    scene_id: id,
    duration_s: opts.duration_s || 3,
    energy: opts.energy || 'moderate',
    camera_move: opts.camera || 'static',
    transition_in: opts.transition || 'crossfade',
    layer_count: opts.layers || 2,
  };
}

function makeScene(id, opts = {}) {
  return {
    scene_id: id,
    duration_s: opts.duration_s || 3,
    product_role: opts.role || 'result',
    primary_subject: opts.hero || 'main',
    brand: opts.brand || null,
    camera: { move: opts.camera || 'static', intensity: opts.intensity || 0 },
    layers: opts.layers || [
      { id: 'bg', type: 'html', depth_class: 'background', product_role: 'decorative', content_class: 'atmosphere', clarity_weight: 1 },
      { id: 'main', type: 'html', depth_class: 'foreground', product_role: 'hero', content_class: 'ui_control', clarity_weight: 5 },
    ],
    motion: opts.motion || { groups: [{ targets: ['main'], primitive: 'as-fadeIn' }] },
    metadata: opts.metadata || {},
  };
}

// ── Output structure ────────────────────────────────────────────────────────

describe('scoreFrameStrip — structure', () => {
  it('returns all expected fields', () => {
    const sheets = [makeSheet('sc_01'), makeSheet('sc_02')];
    const scenes = [makeScene('sc_01'), makeScene('sc_02')];
    const cs = { sheets, total_duration_s: 6, scene_count: 2 };

    const result = scoreFrameStrip({ contactSheet: cs, scenes });
    assert.ok(typeof result.overall === 'number');
    assert.ok(result.dimensions);
    for (const dim of FRAME_DIMENSIONS) {
      assert.ok(result.dimensions[dim], `Missing dimension: ${dim}`);
      assert.ok(typeof result.dimensions[dim].score === 'number');
      assert.ok(Array.isArray(result.dimensions[dim].findings));
    }
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.per_scene));
  });

  it('overall is between 0 and 1', () => {
    const cs = { sheets: [makeSheet('sc_01')], total_duration_s: 3 };
    const scenes = [makeScene('sc_01')];
    const result = scoreFrameStrip({ contactSheet: cs, scenes });
    assert.ok(result.overall >= 0 && result.overall <= 1);
  });

  it('handles empty input', () => {
    const result = scoreFrameStrip({});
    assert.equal(result.overall, 0);
    assert.ok(result.findings.length > 0);
  });
});

// ── Contrast ────────────────────────────────────────────────────────────────

describe('scoreFrameStrip — contrast', () => {
  it('scores higher with varied energy', () => {
    const varied = {
      sheets: [
        makeSheet('sc_01', { energy: 'high' }),
        makeSheet('sc_02', { energy: 'low' }),
        makeSheet('sc_03', { energy: 'moderate' }),
      ],
      total_duration_s: 9,
    };
    const flat = {
      sheets: [
        makeSheet('sc_01', { energy: 'moderate' }),
        makeSheet('sc_02', { energy: 'moderate' }),
        makeSheet('sc_03', { energy: 'moderate' }),
      ],
      total_duration_s: 9,
    };
    const scenes = [makeScene('sc_01'), makeScene('sc_02'), makeScene('sc_03')];

    const variedResult = scoreFrameStrip({ contactSheet: varied, scenes });
    const flatResult = scoreFrameStrip({ contactSheet: flat, scenes });

    assert.ok(variedResult.dimensions.contrast.score > flatResult.dimensions.contrast.score,
      `Varied ${variedResult.dimensions.contrast.score} should > flat ${flatResult.dimensions.contrast.score}`);
  });
});

// ── Readability ─────────────────────────────────────────────────────────────

describe('scoreFrameStrip — readability', () => {
  it('warns when text scene is too short', () => {
    const cs = { sheets: [makeSheet('sc_01', { duration_s: 1 })], total_duration_s: 1 };
    const scenes = [makeScene('sc_01', {
      layers: [
        { id: 'text', type: 'text', depth_class: 'foreground', product_role: 'hero', content_class: 'typography', clarity_weight: 5, content: 'Hello' },
      ],
    })];

    const result = scoreFrameStrip({ contactSheet: cs, scenes });
    assert.ok(result.dimensions.readability.findings.some(f => f.message.includes('not be readable')));
  });
});

// ── Visual Hierarchy ────────────────────────────────────────────────────────

describe('scoreFrameStrip — visual hierarchy', () => {
  it('scores higher when all scenes have hero layers', () => {
    const withHero = [
      makeScene('sc_01', { role: 'atmosphere' }),
      makeScene('sc_02'),
    ];
    const noHero = [
      { scene_id: 'sc_01', layers: [{ id: 'a', type: 'html', depth_class: 'foreground' }] },
      { scene_id: 'sc_02', layers: [{ id: 'b', type: 'html', depth_class: 'foreground' }] },
    ];
    const cs = { sheets: [makeSheet('sc_01'), makeSheet('sc_02')], total_duration_s: 6 };

    const heroResult = scoreFrameStrip({ contactSheet: cs, scenes: withHero });
    const noHeroResult = scoreFrameStrip({ contactSheet: cs, scenes: noHero });

    assert.ok(heroResult.dimensions.visual_hierarchy.score > noHeroResult.dimensions.visual_hierarchy.score);
  });
});

// ── Brand Consistency ───────────────────────────────────────────────────────

describe('scoreFrameStrip — brand consistency', () => {
  it('scores higher with brand package and CTA scene', () => {
    const brand = { brand_id: 'test', motion: { max_intensity: 0.7 } };
    const scenes = [
      makeScene('sc_01', { role: 'atmosphere', brand: 'test' }),
      makeScene('sc_02', { role: 'result', brand: 'test' }),
      makeScene('sc_03', { role: 'cta', brand: 'test' }),
    ];
    const cs = { sheets: [makeSheet('sc_01'), makeSheet('sc_02'), makeSheet('sc_03')], total_duration_s: 9 };

    const withBrand = scoreFrameStrip({ contactSheet: cs, scenes, brand });
    const noBrand = scoreFrameStrip({ contactSheet: cs, scenes });

    assert.ok(withBrand.dimensions.brand_consistency.score >= noBrand.dimensions.brand_consistency.score);
  });
});

// ── Fintech integration ─────────────────────────────────────────────────────

describe('scoreFrameStrip — fintech integration', () => {
  let manifest, scenes, brand;

  try {
    const dir = resolve(ROOT, 'examples/fintech-sizzle');
    manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf-8'));
    scenes = annotateScenes(
      readdirSync(resolve(dir, 'scenes')).filter(f => f.endsWith('.json')).sort()
        .map(f => JSON.parse(readFileSync(resolve(dir, 'scenes', f), 'utf-8')))
    );
    brand = loadBrand('fintech-demo');
  } catch { scenes = []; }

  it('produces meaningful scores for fintech-sizzle', () => {
    if (!scenes.length) return;
    const wrapper = { ...manifest, scene_order: manifest.scenes.map(s => s.scene) };
    const cs = generateContactSheet(wrapper, scenes);
    const result = scoreFrameStrip({ contactSheet: cs, scenes, brand, manifest });

    assert.ok(result.overall > 0.4, `Overall ${result.overall} too low`);
    assert.equal(result.per_scene.length, scenes.length);

    for (const dim of FRAME_DIMENSIONS) {
      assert.ok(result.dimensions[dim].score >= 0 && result.dimensions[dim].score <= 1);
    }
  });
});
