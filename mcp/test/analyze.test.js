/**
 * Tests for Scene Analysis Engine (ANI-22).
 *
 * Covers: color utilities, visual weight, motion energy, content type,
 * intent tags, and integration against ground truth scenes.
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
  hexToLuminance,
  extractColorsFromHTML,
  classifyVisualWeight,
  classifyMotionEnergy,
  classifyContentType,
  inferIntentTags,
  analyzeScene,
  CONTENT_TYPES,
  VISUAL_WEIGHTS,
  MOTION_ENERGIES,
  INTENT_TAGS,
} from '../lib/analyze.js';

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

// ── hexToLuminance ──────────────────────────────────────────────────────────

describe('hexToLuminance', () => {
  it('returns 1.0 for white (#ffffff)', () => {
    const lum = hexToLuminance('#ffffff');
    assert.ok(Math.abs(lum - 1.0) < 0.001);
  });

  it('returns 0.0 for black (#000000)', () => {
    const lum = hexToLuminance('#000000');
    assert.ok(Math.abs(lum) < 0.001);
  });

  it('returns ~0.2159 for mid-gray (#808080)', () => {
    const lum = hexToLuminance('#808080');
    assert.ok(lum > 0.2 && lum < 0.25, `Expected ~0.2159, got ${lum}`);
  });

  it('handles shorthand hex (#fff)', () => {
    const lum = hexToLuminance('#fff');
    assert.ok(Math.abs(lum - 1.0) < 0.001);
  });

  it('handles hex without # prefix', () => {
    const lum = hexToLuminance('ff0000');
    assert.ok(lum !== null);
    assert.ok(lum > 0.2 && lum < 0.22, `Expected ~0.2126 for pure red, got ${lum}`);
  });

  it('returns null for invalid input', () => {
    assert.equal(hexToLuminance('not-a-color'), null);
    assert.equal(hexToLuminance(''), null);
    assert.equal(hexToLuminance(null), null);
    assert.equal(hexToLuminance(undefined), null);
  });
});

// ── extractColorsFromHTML ───────────────────────────────────────────────────

describe('extractColorsFromHTML', () => {
  it('extracts hex color from simple style attribute', () => {
    const colors = extractColorsFromHTML('<div style="color:#ff0000">text</div>');
    assert.deepEqual(colors, ['#ff0000']);
  });

  it('extracts background-color', () => {
    const colors = extractColorsFromHTML('<div style="background-color:#1a1a2e"></div>');
    assert.deepEqual(colors, ['#1a1a2e']);
  });

  it('extracts multiple colors from gradient', () => {
    const html = '<div style="background:linear-gradient(135deg,#1a1a2e,#16213e)"></div>';
    const colors = extractColorsFromHTML(html);
    assert.deepEqual(colors, ['#1a1a2e', '#16213e']);
  });

  it('extracts multiple colors from different properties', () => {
    const html = '<div style="background:#0f172a;color:#94a3b8;font-size:32px">text</div>';
    const colors = extractColorsFromHTML(html);
    assert.deepEqual(colors, ['#0f172a', '#94a3b8']);
  });

  it('expands shorthand hex', () => {
    const colors = extractColorsFromHTML('<div style="color:#fff"></div>');
    assert.deepEqual(colors, ['#ffffff']);
  });

  it('returns empty array for empty/null input', () => {
    assert.deepEqual(extractColorsFromHTML(''), []);
    assert.deepEqual(extractColorsFromHTML(null), []);
    assert.deepEqual(extractColorsFromHTML(undefined), []);
  });

  it('returns empty array for HTML without colors', () => {
    assert.deepEqual(extractColorsFromHTML('<div>no colors here</div>'), []);
  });
});

// ── classifyVisualWeight ────────────────────────────────────────────────────

describe('classifyVisualWeight', () => {
  it('classifies dark scene (white text on implicit dark bg)', () => {
    const scene = {
      layers: [{
        type: 'text',
        depth_class: 'foreground',
        style: { color: '#ffffff' },
      }],
    };
    const result = classifyVisualWeight(scene);
    assert.equal(result.value, 'dark');
    assert.ok(result.confidence > 0.5);
  });

  it('classifies light scene (dark text)', () => {
    const scene = {
      layers: [{
        type: 'text',
        depth_class: 'foreground',
        style: { color: '#111111' },
      }],
    };
    const result = classifyVisualWeight(scene);
    assert.equal(result.value, 'light');
    assert.ok(result.confidence > 0.5);
  });

  it('classifies dark scene from html background colors', () => {
    const scene = {
      layers: [{
        type: 'html',
        content: '<div style="background:#0a0a0a"></div>',
      }],
    };
    const result = classifyVisualWeight(scene);
    assert.equal(result.value, 'dark');
  });

  it('classifies light scene from html background colors', () => {
    const scene = {
      layers: [{
        type: 'html',
        content: '<div style="background:#f8f8f8"></div>',
      }],
    };
    const result = classifyVisualWeight(scene);
    assert.equal(result.value, 'light');
  });

  it('classifies mixed when colors span range', () => {
    const scene = {
      layers: [
        { type: 'html', content: '<div style="background:#000000;color:#ffffff"></div>' },
      ],
    };
    const result = classifyVisualWeight(scene);
    assert.equal(result.value, 'mixed');
  });

  it('returns mixed with low confidence for no-color scenes', () => {
    const scene = {
      layers: [{ type: 'video', depth_class: 'background' }],
    };
    const result = classifyVisualWeight(scene);
    assert.equal(result.value, 'mixed');
    assert.ok(result.confidence <= 0.30);
  });
});

// ── classifyMotionEnergy ────────────────────────────────────────────────────

describe('classifyMotionEnergy', () => {
  it('classifies static (no camera, no animation)', () => {
    const scene = {
      camera: { move: 'static' },
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = classifyMotionEnergy(scene);
    assert.equal(result.value, 'static');
  });

  it('classifies subtle (low camera intensity only)', () => {
    const scene = {
      camera: { move: 'drift', intensity: 0.1 },
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = classifyMotionEnergy(scene);
    assert.equal(result.value, 'subtle');
  });

  it('classifies moderate (word-reveal only)', () => {
    const scene = {
      camera: { move: 'static' },
      layers: [{
        type: 'text',
        depth_class: 'foreground',
        animation: 'word-reveal',
      }],
    };
    const result = classifyMotionEnergy(scene);
    assert.equal(result.value, 'moderate');
  });

  it('classifies high (scale-cascade)', () => {
    const scene = {
      camera: { move: 'static' },
      layers: [{
        type: 'text',
        depth_class: 'foreground',
        animation: 'scale-cascade',
      }],
    };
    const result = classifyMotionEnergy(scene);
    assert.equal(result.value, 'high');
  });

  it('classifies moderate (camera + weight-morph)', () => {
    const scene = {
      camera: { move: 'drift', intensity: 0.3 },
      layers: [{
        type: 'text',
        depth_class: 'foreground',
        animation: 'weight-morph',
      }],
    };
    const result = classifyMotionEnergy(scene);
    assert.equal(result.value, 'moderate');
  });

  it('adds score for entrance primitives', () => {
    const scene = {
      camera: { move: 'static' },
      layers: [
        { type: 'html', depth_class: 'foreground', entrance: { primitive: 'as-fadeInUp', delay_ms: 0 } },
        { type: 'html', depth_class: 'foreground', entrance: { primitive: 'as-fadeInUp', delay_ms: 100 } },
        { type: 'html', depth_class: 'foreground', entrance: { primitive: 'as-fadeInUp', delay_ms: 200 } },
      ],
    };
    const result = classifyMotionEnergy(scene);
    // 3 entrances (+3) + 3 unique delays (+2) = 5 → moderate
    assert.equal(result.value, 'moderate');
  });

  it('adds score for video layers', () => {
    const scene = {
      camera: { move: 'static' },
      layers: [{ type: 'video', depth_class: 'background' }],
    };
    const result = classifyMotionEnergy(scene);
    assert.equal(result.value, 'subtle');
  });

  it('handles high camera intensity', () => {
    const scene = {
      camera: { move: 'push_in', intensity: 0.8 },
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = classifyMotionEnergy(scene);
    // intensity > 0.5 → +3 → moderate
    assert.equal(result.value, 'moderate');
  });
});

// ── classifyContentType ─────────────────────────────────────────────────────

describe('classifyContentType', () => {
  it('classifies device-mockup layout', () => {
    const scene = {
      layout: { template: 'device-mockup' },
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'device_mockup');
    assert.equal(result.confidence, 0.95);
  });

  it('classifies split-panel layout', () => {
    const scene = {
      layout: { template: 'split-panel' },
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'split_panel');
    assert.equal(result.confidence, 0.95);
  });

  it('classifies masonry-grid with 4+ cells as collage', () => {
    const scene = {
      layout: { template: 'masonry-grid' },
      layers: [
        { type: 'html', slot: 'cell-0' },
        { type: 'html', slot: 'cell-1' },
        { type: 'html', slot: 'cell-2' },
        { type: 'html', slot: 'cell-3' },
      ],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'collage');
    assert.equal(result.confidence, 0.90);
  });

  it('classifies masonry-grid with 2-3 cells as moodboard', () => {
    const scene = {
      layout: { template: 'masonry-grid' },
      layers: [
        { type: 'html', slot: 'cell-0' },
        { type: 'html', slot: 'cell-1' },
      ],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'moodboard');
    assert.equal(result.confidence, 0.85);
  });

  it('classifies full-bleed layout as product_shot', () => {
    const scene = {
      layout: { template: 'full-bleed' },
      layers: [{ type: 'html', depth_class: 'background' }],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'product_shot');
    assert.equal(result.confidence, 0.85);
  });

  it('classifies hero-center layout as brand_mark', () => {
    const scene = {
      layout: { template: 'hero-center' },
      layers: [{ type: 'text', depth_class: 'foreground' }],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'brand_mark');
    assert.equal(result.confidence, 0.80);
  });

  it('classifies all-text fg layers as typography', () => {
    const scene = {
      layers: [{
        type: 'text',
        depth_class: 'foreground',
        content: 'HELLO',
        animation: 'word-reveal',
      }],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'typography');
    assert.equal(result.confidence, 0.90);
  });

  it('classifies typography with video bg', () => {
    const scene = {
      layers: [
        { type: 'video', depth_class: 'background' },
        { type: 'text', depth_class: 'foreground', content: 'HELLO' },
      ],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'typography');
  });

  it('classifies portrait from scene_id keywords', () => {
    const scene = {
      scene_id: 'sc_portrait_closeup',
      layers: [
        { type: 'video', depth_class: 'background' },
        { type: 'html', depth_class: 'foreground' },
      ],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'portrait');
  });

  it('classifies brand_mark from scene_id keywords', () => {
    const scene = {
      scene_id: 'sc_brand_logo',
      layers: [
        { type: 'html', depth_class: 'foreground' },
      ],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'brand_mark');
  });

  it('classifies notification from scene_id keywords', () => {
    const scene = {
      scene_id: 'sc_notification_card',
      layers: [
        { type: 'html', depth_class: 'foreground' },
      ],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'notification');
  });

  it('classifies ui_screenshot from image + ui keywords', () => {
    const scene = {
      scene_id: 'sc_dashboard_view',
      layers: [
        { type: 'image', depth_class: 'foreground' },
      ],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'ui_screenshot');
  });

  it('falls back to ui_screenshot for ambiguous scenes', () => {
    const scene = {
      scene_id: 'sc_unknown',
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = classifyContentType(scene);
    assert.equal(result.value, 'ui_screenshot');
    assert.equal(result.confidence, 0.20);
  });
});

// ── inferIntentTags ─────────────────────────────────────────────────────────

describe('inferIntentTags', () => {
  it('tags brand_mark as hero + opening (single layer)', () => {
    const scene = {
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = inferIntentTags(scene, 'brand_mark', 'subtle');
    assert.deepEqual(result.value, ['hero', 'opening']);
  });

  it('tags typography with word-reveal as opening', () => {
    const scene = {
      layers: [{ type: 'text', depth_class: 'foreground', animation: 'word-reveal' }],
    };
    const result = inferIntentTags(scene, 'typography', 'moderate');
    assert.deepEqual(result.value, ['opening']);
  });

  it('tags typography with high motion as hero', () => {
    const scene = {
      layers: [{ type: 'text', depth_class: 'foreground', animation: 'scale-cascade' }],
    };
    const result = inferIntentTags(scene, 'typography', 'high');
    assert.deepEqual(result.value, ['hero']);
  });

  it('tags ui_screenshot as detail', () => {
    const scene = { layers: [{ type: 'image', depth_class: 'foreground' }] };
    const result = inferIntentTags(scene, 'ui_screenshot', 'static');
    assert.deepEqual(result.value, ['detail']);
  });

  it('tags device_mockup as detail', () => {
    const scene = { layers: [{ type: 'html', depth_class: 'foreground' }] };
    const result = inferIntentTags(scene, 'device_mockup', 'moderate');
    assert.deepEqual(result.value, ['detail']);
  });

  it('tags portrait as emotional', () => {
    const scene = {
      layers: [
        { type: 'video', depth_class: 'background' },
        { type: 'html', depth_class: 'foreground' },
      ],
    };
    const result = inferIntentTags(scene, 'portrait', 'moderate');
    assert.deepEqual(result.value, ['emotional']);
  });

  it('tags collage as informational', () => {
    const scene = { layers: [{ type: 'html', depth_class: 'midground' }] };
    const result = inferIntentTags(scene, 'collage', 'static');
    assert.deepEqual(result.value, ['informational']);
  });

  it('adds emotional for video bg + text fg', () => {
    const scene = {
      layers: [
        { type: 'video', depth_class: 'background' },
        { type: 'text', depth_class: 'foreground', animation: 'word-reveal' },
      ],
    };
    const result = inferIntentTags(scene, 'typography', 'moderate');
    assert.ok(result.value.includes('opening'));
    assert.ok(result.value.includes('emotional'));
  });

  it('tags short scenes as transition', () => {
    const scene = {
      duration_s: 1.0,
      layers: [{ type: 'html', depth_class: 'foreground' }],
    };
    const result = inferIntentTags(scene, 'ui_screenshot', 'static');
    assert.ok(result.value.includes('transition'));
  });

  it('returns empty tags for unknown content type', () => {
    const scene = { layers: [] };
    const result = inferIntentTags(scene, 'unknown_type', 'static');
    assert.deepEqual(result.value, []);
    assert.ok(result.confidence < 0.50);
  });
});

// ── analyzeScene — integration ──────────────────────────────────────────────

describe('analyzeScene', () => {
  it('throws on invalid input', () => {
    assert.throws(() => analyzeScene(null), /requires a scene object/);
    assert.throws(() => analyzeScene('string'), /requires a scene object/);
  });

  it('returns correct structure', () => {
    const result = analyzeScene({
      scene_id: 'sc_test',
      layers: [{ type: 'text', depth_class: 'foreground', style: { color: '#fff' } }],
    });
    assert.ok(result.metadata);
    assert.ok(result._confidence);
    assert.ok(CONTENT_TYPES.includes(result.metadata.content_type));
    assert.ok(VISUAL_WEIGHTS.includes(result.metadata.visual_weight));
    assert.ok(MOTION_ENERGIES.includes(result.metadata.motion_energy));
    assert.ok(Array.isArray(result.metadata.intent_tags));
  });
});

// ── Ground truth: kinetic type scenes ───────────────────────────────────────

describe('analyzeScene — kinetic type ground truth', () => {
  it('sc_word_reveal matches hand-authored metadata', () => {
    const scene = kineticScenes.sc_word_reveal;
    const result = analyzeScene(scene);
    assert.equal(result.metadata.content_type, scene.metadata.content_type);
    assert.equal(result.metadata.visual_weight, scene.metadata.visual_weight);
    assert.equal(result.metadata.motion_energy, scene.metadata.motion_energy);
    assert.deepEqual(result.metadata.intent_tags, scene.metadata.intent_tags);
  });

  it('sc_scale_cascade matches hand-authored metadata', () => {
    const scene = kineticScenes.sc_scale_cascade;
    const result = analyzeScene(scene);
    assert.equal(result.metadata.content_type, scene.metadata.content_type);
    assert.equal(result.metadata.visual_weight, scene.metadata.visual_weight);
    assert.equal(result.metadata.motion_energy, scene.metadata.motion_energy);
    assert.deepEqual(result.metadata.intent_tags, scene.metadata.intent_tags);
  });

  it('sc_weight_morph matches hand-authored metadata', () => {
    const scene = kineticScenes.sc_weight_morph;
    const result = analyzeScene(scene);
    assert.equal(result.metadata.content_type, scene.metadata.content_type);
    assert.equal(result.metadata.visual_weight, scene.metadata.visual_weight);
    assert.equal(result.metadata.motion_energy, scene.metadata.motion_energy);
    assert.deepEqual(result.metadata.intent_tags, scene.metadata.intent_tags);
  });

  it('sc_type_over_media matches hand-authored metadata', () => {
    const scene = kineticScenes.sc_type_over_media;
    const result = analyzeScene(scene);
    assert.equal(result.metadata.content_type, scene.metadata.content_type);
    assert.equal(result.metadata.visual_weight, scene.metadata.visual_weight);
    assert.equal(result.metadata.motion_energy, scene.metadata.motion_energy);
    assert.deepEqual(result.metadata.intent_tags, scene.metadata.intent_tags);
  });
});

// ── Ground truth: layout template scenes ────────────────────────────────────

describe('analyzeScene — layout template scenes', () => {
  it('sc_hero_center → brand_mark', () => {
    const result = analyzeScene(layoutScenes.sc_hero_center);
    assert.equal(result.metadata.content_type, 'brand_mark');
  });

  it('sc_split_panel → split_panel', () => {
    const result = analyzeScene(layoutScenes.sc_split_panel);
    assert.equal(result.metadata.content_type, 'split_panel');
  });

  it('sc_masonry_grid → collage (6 cells)', () => {
    const result = analyzeScene(layoutScenes.sc_masonry_grid);
    assert.equal(result.metadata.content_type, 'collage');
  });

  it('sc_full_bleed → product_shot', () => {
    const result = analyzeScene(layoutScenes.sc_full_bleed);
    assert.equal(result.metadata.content_type, 'product_shot');
  });

  it('sc_device_mockup → device_mockup', () => {
    const result = analyzeScene(layoutScenes.sc_device_mockup);
    assert.equal(result.metadata.content_type, 'device_mockup');
  });

  it('layout scenes have valid metadata fields', () => {
    for (const [id, scene] of Object.entries(layoutScenes)) {
      const result = analyzeScene(scene);
      assert.ok(CONTENT_TYPES.includes(result.metadata.content_type), `${id}: invalid content_type`);
      assert.ok(VISUAL_WEIGHTS.includes(result.metadata.visual_weight), `${id}: invalid visual_weight`);
      assert.ok(MOTION_ENERGIES.includes(result.metadata.motion_energy), `${id}: invalid motion_energy`);
      assert.ok(Array.isArray(result.metadata.intent_tags), `${id}: intent_tags not array`);
      for (const tag of result.metadata.intent_tags) {
        assert.ok(INTENT_TAGS.includes(tag), `${id}: invalid intent_tag "${tag}"`);
      }
    }
  });

  it('confidence scores are between 0 and 1', () => {
    for (const scene of Object.values(layoutScenes)) {
      const result = analyzeScene(scene);
      for (const [field, conf] of Object.entries(result._confidence)) {
        assert.ok(conf >= 0 && conf <= 1, `${field} confidence ${conf} out of range`);
      }
    }
  });
});
