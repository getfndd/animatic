/**
 * Tests for Scene Generator (ANI-31).
 *
 * Covers: validateBrief, classifyAssets, resolveTemplate, resolveStyle,
 * allocateDurations, buildScenePlan, generateScene, and generateScenes integration.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateBrief,
  classifyAssets,
  resolveTemplate,
  resolveStyle,
  allocateDurations,
  allocateDurationsWeighted,
  buildScenePlan,
  generateScene,
  generateScenes,
  attachSemanticBlock,
  ASSET_FILENAME_PATTERNS,
  HINT_TO_CONTENT_TYPE,
  CONTENT_TYPE_TO_LAYOUT,
  CONTENT_TYPE_TO_COMPONENT,
  LABEL_TO_INTENT,
  MOOD_TO_STYLES,
} from '../lib/generator.js';

import { validateScene } from '../../src/remotion/lib.js';
import { analyzeScene } from '../lib/analyze.js';

// ── Fixture helper ───────────────────────────────────────────────────────────

function makeBrief(overrides = {}) {
  return {
    project: {
      title: 'Test Product',
      duration_target_s: 15,
      ...(overrides.project || {}),
    },
    template: overrides.template ?? 'product-launch',
    style: overrides.style,
    tone: overrides.tone,
    brand: overrides.brand,
    content: {
      headline: 'Test Headline',
      sections: overrides.sections ?? [
        { label: 'Hero', text: 'Introducing Test Product' },
        { label: 'Product', text: 'Built for teams', assets: ['product-hero'] },
        { label: 'CTA', text: 'Try it free', assets: ['logo'] },
      ],
    },
    assets: overrides.assets ?? [
      { id: 'product-hero', src: 'assets/hero-product.png', hint: 'product' },
      { id: 'logo', src: 'assets/logo.svg', hint: 'logo' },
    ],
    constraints: overrides.constraints,
  };
}

// ── validateBrief ────────────────────────────────────────────────────────────

describe('validateBrief', () => {
  it('accepts a valid brief', () => {
    const result = validateBrief(makeBrief());
    assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join('; ')}`);
  });

  it('rejects null', () => {
    const result = validateBrief(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('non-null object'));
  });

  it('rejects non-object', () => {
    const result = validateBrief('not an object');
    assert.equal(result.valid, false);
  });

  it('requires project', () => {
    const brief = makeBrief();
    delete brief.project;
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('project is required')));
  });

  it('requires project.title', () => {
    const brief = makeBrief({ project: { title: '' } });
    // Empty string is falsy
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('project.title')));
  });

  it('validates template ID', () => {
    const brief = makeBrief({ template: 'nonexistent' });
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('template')));
  });

  it('accepts "custom" template', () => {
    const brief = makeBrief({ template: 'custom' });
    const result = validateBrief(brief);
    assert.ok(result.valid);
  });

  it('requires content', () => {
    const brief = makeBrief();
    delete brief.content;
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('content is required')));
  });

  it('requires non-empty content.sections', () => {
    const brief = makeBrief({ sections: [] });
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('content.sections')));
  });

  it('requires section labels', () => {
    const brief = makeBrief({ sections: [{ text: 'no label' }] });
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('label')));
  });

  it('detects duplicate asset IDs', () => {
    const brief = makeBrief({
      assets: [
        { id: 'dup', src: 'a.png' },
        { id: 'dup', src: 'b.png' },
      ],
      sections: [{ label: 'Hero', text: 'test' }],
    });
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('duplicate')));
  });

  it('detects missing asset src', () => {
    const brief = makeBrief({
      assets: [{ id: 'test' }],
      sections: [{ label: 'Hero', text: 'test' }],
    });
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('src')));
  });

  it('checks section asset references', () => {
    const brief = makeBrief({
      sections: [{ label: 'Hero', text: 'test', assets: ['nonexistent'] }],
      assets: [{ id: 'other', src: 'a.png' }],
    });
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('nonexistent')));
  });

  it('checks constraints.must_include references', () => {
    const brief = makeBrief({
      constraints: { must_include: ['missing-asset'] },
    });
    const result = validateBrief(brief);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('must_include')));
  });
});

// ── classifyAssets ───────────────────────────────────────────────────────────

describe('classifyAssets', () => {
  it('classifies by explicit hint (confidence 1.0)', () => {
    const brief = { assets: [{ id: 'a', src: 'x.png', hint: 'product' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'product_shot');
    assert.equal(result[0].confidence, 1.0);
    assert.equal(result[0].classification_source, 'hint');
  });

  it('classifies by filename convention (confidence 0.8)', () => {
    const brief = { assets: [{ id: 'a', src: 'assets/hero-dashboard.png' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'product_shot');
    assert.equal(result[0].confidence, 0.8);
    assert.equal(result[0].classification_source, 'filename');
  });

  it('classifies team-* filenames as portrait', () => {
    const brief = { assets: [{ id: 'a', src: 'team-photo.jpg' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'portrait');
  });

  it('classifies ui-* filenames as ui_screenshot', () => {
    const brief = { assets: [{ id: 'a', src: 'ui-dashboard.png' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'ui_screenshot');
  });

  it('classifies logo-* filenames as brand_mark', () => {
    const brief = { assets: [{ id: 'a', src: 'logo-dark.svg' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'brand_mark');
  });

  it('classifies bg-* filenames as moodboard', () => {
    const brief = { assets: [{ id: 'a', src: 'bg-gradient.png' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'moodboard');
  });

  it('classifies chart-* filenames as data_visualization', () => {
    const brief = { assets: [{ id: 'a', src: 'chart-revenue.png' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'data_visualization');
  });

  it('falls back to extension for SVG (confidence 0.3)', () => {
    const brief = { assets: [{ id: 'a', src: 'custom-name.svg' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'brand_mark');
    assert.equal(result[0].confidence, 0.3);
    assert.equal(result[0].classification_source, 'extension');
  });

  it('falls back to extension for MP4', () => {
    const brief = { assets: [{ id: 'a', src: 'demo.mp4' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'product_shot');
    assert.equal(result[0].confidence, 0.3);
  });

  it('returns default for unrecognized files (confidence 0.1)', () => {
    const brief = { assets: [{ id: 'a', src: 'unknown-file.png' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'product_shot');
    assert.equal(result[0].confidence, 0.1);
    assert.equal(result[0].classification_source, 'default');
  });

  it('assigns role "hero" for product shots', () => {
    const brief = { assets: [{ id: 'a', src: 'x.png', hint: 'product' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].role, 'hero');
  });

  it('assigns role "closing" for brand marks', () => {
    const brief = { assets: [{ id: 'a', src: 'x.svg', hint: 'logo' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].role, 'closing');
  });

  it('handles empty assets array', () => {
    const result = classifyAssets({ assets: [] });
    assert.equal(result.length, 0);
  });

  it('handles missing assets property', () => {
    const result = classifyAssets({});
    assert.equal(result.length, 0);
  });

  it('hint takes priority over filename pattern', () => {
    const brief = { assets: [{ id: 'a', src: 'hero-product.png', hint: 'logo' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'brand_mark');
    assert.equal(result[0].confidence, 1.0);
  });

  it('classifies photo-* filenames as portrait', () => {
    const brief = { assets: [{ id: 'a', src: 'photo-studio.jpg' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'portrait');
  });

  // ── Audio classification ────────────────────────────────────────────────

  it('classifies .mp3 extension as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'track.mp3' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
    assert.equal(result[0].confidence, 0.3);
    assert.equal(result[0].classification_source, 'extension');
  });

  it('classifies .wav extension as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'recording.wav' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
  });

  it('classifies .m4a extension as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'podcast.m4a' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
  });

  it('classifies .aac extension as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'clip.aac' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
  });

  it('classifies .ogg extension as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'sound.ogg' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
  });

  it('classifies music-* filename as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'music-background.mp3' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
    assert.equal(result[0].confidence, 0.8);
    assert.equal(result[0].classification_source, 'filename');
  });

  it('classifies narration-* filename as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'narration-intro.wav' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
    assert.equal(result[0].role, 'supporting');
  });

  it('classifies voiceover-* filename as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'voiceover-scene1.mp3' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
  });

  it('classifies sfx-* filename as audio', () => {
    const brief = { assets: [{ id: 'a', src: 'sfx-whoosh.wav' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
  });

  it('classifies audio by hint', () => {
    const brief = { assets: [{ id: 'a', src: 'file.mp3', hint: 'music' }] };
    const result = classifyAssets(brief);
    assert.equal(result[0].content_type, 'audio');
    assert.equal(result[0].confidence, 1.0);
  });
});

// ── resolveTemplate ──────────────────────────────────────────────────────────

describe('resolveTemplate', () => {
  it('loads product-launch template', () => {
    const result = resolveTemplate({ template: 'product-launch' });
    assert.ok(result.sections.length > 0);
    assert.ok(result.defaults.style);
    assert.ok(result.suggested_scene_count.min > 0);
  });

  it('loads brand-story template', () => {
    const result = resolveTemplate({ template: 'brand-story' });
    assert.ok(result.sections.some(s => s.label === 'Opening'));
    assert.equal(result.defaults.style, 'intimate');
  });

  it('loads investor-pitch template', () => {
    const result = resolveTemplate({ template: 'investor-pitch' });
    assert.ok(result.sections.some(s => s.label === 'Hook'));
    assert.equal(result.defaults.style, 'corporate');
  });

  it('loads photo-essay template', () => {
    const result = resolveTemplate({ template: 'photo-essay' });
    assert.ok(result.sections.some(s => s.label === 'Visual'));
    assert.equal(result.defaults.style, 'fade');
  });

  it('loads tutorial template', () => {
    const result = resolveTemplate({ template: 'tutorial' });
    assert.ok(result.sections.some(s => s.label === 'Step'));
    assert.equal(result.defaults.style, 'minimal');
  });

  it('infers virtual sections for custom template', () => {
    const brief = {
      template: 'custom',
      content: {
        sections: [
          { label: 'Opening', text: 'Hello' },
          { label: 'Custom Section', text: 'Body' },
          { label: 'Closing', text: 'Bye' },
        ],
      },
    };
    const result = resolveTemplate(brief);
    assert.equal(result.sections.length, 3);
    assert.deepEqual(result.sections[0].intent_tags, ['opening']);
    assert.deepEqual(result.sections[2].intent_tags, ['closing']);
  });

  it('falls back to product-launch for empty custom sections', () => {
    const result = resolveTemplate({ template: 'custom', content: { sections: [] } });
    assert.ok(result.sections.length > 0);
  });

  it('defaults to custom when no template specified', () => {
    const brief = {
      content: {
        sections: [{ label: 'Intro', text: 'Test' }],
      },
    };
    const result = resolveTemplate(brief);
    assert.ok(result.sections.length > 0);
  });
});

// ── resolveStyle ─────────────────────────────────────────────────────────────

describe('resolveStyle', () => {
  it('uses explicit brief style', () => {
    const brief = makeBrief({ style: 'dramatic' });
    const template = resolveTemplate(brief);
    const style = resolveStyle(brief, template);
    assert.equal(style, 'dramatic');
  });

  it('falls back to template default style', () => {
    const brief = makeBrief({ style: undefined });
    const template = resolveTemplate(brief);
    const style = resolveStyle(brief, template);
    assert.equal(style, 'prestige'); // product-launch default
  });

  it('infers style from tone mood', () => {
    const brief = makeBrief({ style: undefined, template: 'custom' });
    brief.tone = { mood: 'energetic', energy: 'high' };
    brief.content.sections = [{ label: 'Test', text: 'test' }];
    const template = resolveTemplate(brief);
    // Override template defaults to have no style
    template.defaults.style = 'nonexistent-style';
    const style = resolveStyle(brief, template);
    assert.equal(style, 'energy');
  });

  it('falls back to prestige when nothing matches', () => {
    const brief = makeBrief({ style: 'nonexistent' });
    brief.tone = { mood: 'alien-mood' };
    const template = { defaults: { style: 'also-nonexistent', tone: { mood: 'nope' } } };
    const style = resolveStyle(brief, template);
    assert.equal(style, 'prestige');
  });

  it('resolves warm mood to intimate', () => {
    const brief = { tone: { mood: 'warm' } };
    const template = { defaults: { style: 'nonexistent' } };
    const style = resolveStyle(brief, template);
    assert.equal(style, 'intimate');
  });

  it('resolves confident mood to prestige', () => {
    const brief = { tone: { mood: 'confident' } };
    const template = { defaults: { style: 'nonexistent' } };
    const style = resolveStyle(brief, template);
    assert.equal(style, 'prestige');
  });

  it('resolves contemplative mood to fade', () => {
    const brief = { tone: { mood: 'contemplative' } };
    const template = { defaults: { style: 'nonexistent' } };
    const style = resolveStyle(brief, template);
    assert.equal(style, 'fade');
  });

  it('resolves clear mood to minimal', () => {
    const brief = { tone: { mood: 'clear' } };
    const template = { defaults: { style: 'nonexistent' } };
    const style = resolveStyle(brief, template);
    assert.equal(style, 'minimal');
  });
});

// ── allocateDurations ────────────────────────────────────────────────────────

describe('allocateDurations', () => {
  it('divides equally for simple case', () => {
    const brief = { project: { duration_target_s: 12 } };
    const template = { defaults: {} };
    const durations = allocateDurations(brief, template, 4);
    assert.equal(durations.length, 4);
    assert.equal(durations[0], 3);
    assert.equal(durations.reduce((a, b) => a + b), 12);
  });

  it('uses template default when brief has no target', () => {
    const brief = { project: {} };
    const template = { defaults: { duration_target_s: 20 } };
    const durations = allocateDurations(brief, template, 4);
    assert.equal(durations[0], 5);
  });

  it('falls back to count * 3 when nothing specified', () => {
    const brief = { project: {} };
    const template = { defaults: {} };
    const durations = allocateDurations(brief, template, 5);
    assert.equal(durations[0], 3);
  });

  it('clamps minimum to 0.5', () => {
    const brief = { project: { duration_target_s: 1 } };
    const template = { defaults: {} };
    const durations = allocateDurations(brief, template, 10);
    assert.ok(durations.every(d => d >= 0.5));
  });

  it('clamps maximum to 30', () => {
    const brief = { project: { duration_target_s: 300 } };
    const template = { defaults: {} };
    const durations = allocateDurations(brief, template, 1);
    assert.ok(durations[0] <= 30);
  });

  it('returns empty array for 0 scenes', () => {
    const durations = allocateDurations({ project: {} }, { defaults: {} }, 0);
    assert.equal(durations.length, 0);
  });
});

describe('allocateDurationsWeighted', () => {
  it('gives strong scenes 1.5x weight', () => {
    const durations = allocateDurationsWeighted(10, ['strong', 'normal']);
    assert.ok(durations[0] > durations[1]);
    assert.ok(Math.abs(durations[0] / durations[1] - 1.5) < 0.1);
  });

  it('total approximates target', () => {
    const durations = allocateDurationsWeighted(15, ['normal', 'strong', 'normal']);
    const total = durations.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 15) < 1);
  });

  it('clamps to minimum 0.5', () => {
    const durations = allocateDurationsWeighted(1, ['normal', 'normal', 'normal', 'normal', 'normal']);
    assert.ok(durations.every(d => d >= 0.5));
  });

  it('returns empty for empty emphases', () => {
    const durations = allocateDurationsWeighted(10, []);
    assert.equal(durations.length, 0);
  });

  it('handles all strong emphases equally', () => {
    const durations = allocateDurationsWeighted(12, ['strong', 'strong', 'strong']);
    // All equal weights
    assert.ok(Math.abs(durations[0] - durations[1]) < 0.2);
    assert.ok(Math.abs(durations[1] - durations[2]) < 0.2);
  });
});

// ── buildScenePlan ───────────────────────────────────────────────────────────

describe('buildScenePlan', () => {
  it('expands product-launch template into scene plan', () => {
    const brief = makeBrief();
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    assert.ok(plan.length >= 3);
    assert.ok(plan.some(p => p.intent_tags.includes('opening')));
    assert.ok(plan.some(p => p.intent_tags.includes('closing')));
  });

  it('honors explicit section asset references', () => {
    const brief = makeBrief();
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    const productScene = plan.find(p => p.label === 'Product');
    assert.ok(productScene);
    assert.ok(productScene.assets.some(a => a.id === 'product-hero'));
  });

  it('skips optional sections with no matching content', () => {
    const brief = makeBrief({
      sections: [
        { label: 'Hero', text: 'Opening' },
        { label: 'CTA', text: 'Close' },
      ],
    });
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    // Social Proof is optional in product-launch, should be skipped
    assert.ok(!plan.some(p => p.label === 'Social Proof'));
  });

  it('respects repeat.max for repeating sections', () => {
    const brief = makeBrief({
      template: 'product-launch',
      sections: [
        { label: 'Hero', text: 'Opening' },
        { label: 'Product', text: 'Product', assets: ['product-hero'] },
        { label: 'Features', text: 'Feature 1' },
        { label: 'Features', text: 'Feature 2' },
        { label: 'Features', text: 'Feature 3' },
        { label: 'Features', text: 'Feature 4' },
        { label: 'CTA', text: 'Close', assets: ['logo'] },
      ],
    });
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    const featureScenes = plan.filter(p => p.label === 'Features');
    // product-launch Features repeat.max is 3
    assert.ok(featureScenes.length <= 3);
  });

  it('includes unmatched content sections', () => {
    const brief = makeBrief({
      sections: [
        { label: 'Hero', text: 'Opening' },
        { label: 'Bonus', text: 'Extra section' },
        { label: 'CTA', text: 'Close' },
      ],
    });
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    assert.ok(plan.some(p => p.label === 'Bonus'));
  });

  it('forces must_include assets into scenes', () => {
    const brief = makeBrief({
      constraints: { must_include: ['product-hero', 'logo'] },
    });
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    const allAssetIds = plan.flatMap(p => p.assets.map(a => a.id));
    assert.ok(allAssetIds.includes('product-hero'));
    assert.ok(allAssetIds.includes('logo'));
  });

  it('classifies multi-asset section as collage', () => {
    const brief = makeBrief({
      sections: [
        { label: 'Hero', text: 'Opening' },
        {
          label: 'Grid',
          assets: ['a', 'b', 'c', 'd'],
        },
        { label: 'CTA', text: 'Close' },
      ],
      assets: [
        { id: 'a', src: 'photo-1.jpg' },
        { id: 'b', src: 'photo-2.jpg' },
        { id: 'c', src: 'photo-3.jpg' },
        { id: 'd', src: 'photo-4.jpg' },
      ],
    });
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    const gridScene = plan.find(p => p.label === 'Grid');
    assert.ok(gridScene);
    assert.equal(gridScene.content_type, 'collage');
    assert.equal(gridScene.layout, 'masonry-grid');
  });

  it('assigns emphasis from template section', () => {
    const brief = makeBrief();
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    const heroScene = plan.find(p => p.label === 'Hero');
    assert.equal(heroScene.emphasis, 'strong'); // product-launch Hero is strong
  });

  it('uses content type from primary asset', () => {
    const brief = makeBrief({
      sections: [
        { label: 'Hero', text: 'Opening' },
        { label: 'Product', text: 'Product', assets: ['ui-shot'] },
        { label: 'CTA', text: 'Close' },
      ],
      assets: [
        { id: 'ui-shot', src: 'ui-dashboard.png' },
      ],
    });
    const classified = classifyAssets(brief);
    const template = resolveTemplate(brief);
    const plan = buildScenePlan(brief, classified, template);
    const productScene = plan.find(p => p.label === 'Product');
    assert.equal(productScene.content_type, 'ui_screenshot');
  });
});

// ── generateScene ────────────────────────────────────────────────────────────

describe('generateScene', () => {
  function makePlan(overrides = {}) {
    return {
      label: 'Test',
      text: 'Test content',
      emphasis: 'normal',
      content_type: 'typography',
      layout: 'hero-center',
      intent_tags: ['detail'],
      assets: [],
      repeat_index: 0,
      ...overrides,
    };
  }

  const baseBrief = { brand: { colors: { primary: '#0066ff', text: '#ffffff', background: '#0a0a0a' } } };

  it('generates valid scene_id pattern', () => {
    const scene = generateScene(makePlan({ label: 'Hero Shot' }), 0, baseBrief);
    assert.match(scene.scene_id, /^sc_[a-z0-9_]+$/);
  });

  it('generates typography scene with text layer', () => {
    const scene = generateScene(makePlan(), 0, baseBrief);
    assert.equal(scene.layout.template, 'hero-center');
    const textLayer = scene.layers.find(l => l.type === 'text');
    assert.ok(textLayer);
    assert.equal(textLayer.content, 'Test content');
    assert.equal(textLayer.animation, 'word-reveal');
  });

  it('uses scale-cascade for strong emphasis typography', () => {
    const scene = generateScene(makePlan({ emphasis: 'strong' }), 0, baseBrief);
    const textLayer = scene.layers.find(l => l.type === 'text');
    assert.equal(textLayer.animation, 'scale-cascade');
  });

  it('generates device-mockup scene with asset', () => {
    const plan = makePlan({
      content_type: 'ui_screenshot',
      layout: 'device-mockup',
      assets: [{ id: 'ui-1', src: 'ui.png', content_type: 'ui_screenshot' }],
    });
    const scene = generateScene(plan, 1, baseBrief);
    assert.equal(scene.layout.template, 'device-mockup');
    assert.ok(scene.assets.some(a => a.id === 'ui-1'));
    assert.ok(scene.layers.some(l => l.slot === 'device'));
  });

  it('generates product shot scene', () => {
    const plan = makePlan({
      content_type: 'product_shot',
      layout: 'device-mockup',
      text: 'Product intro',
      assets: [{ id: 'hero', src: 'hero.png', content_type: 'product_shot' }],
    });
    const scene = generateScene(plan, 2, baseBrief);
    assert.ok(scene.assets.some(a => a.id === 'hero'));
    assert.ok(scene.layers.some(l => l.type === 'text'));
  });

  it('generates portrait scene with split-panel', () => {
    const plan = makePlan({
      content_type: 'portrait',
      layout: 'split-panel',
      text: 'Team member',
      assets: [{ id: 'photo', src: 'team.jpg', content_type: 'portrait' }],
    });
    const scene = generateScene(plan, 3, baseBrief);
    assert.equal(scene.layout.template, 'split-panel');
    assert.ok(scene.layers.some(l => l.slot === 'left'));
    assert.ok(scene.layers.some(l => l.slot === 'right'));
  });

  it('generates brand mark scene', () => {
    const plan = makePlan({
      content_type: 'brand_mark',
      layout: 'hero-center',
      text: 'Company Name',
      assets: [{ id: 'logo', src: 'logo.svg', content_type: 'brand_mark' }],
    });
    const scene = generateScene(plan, 4, baseBrief);
    assert.equal(scene.layout.template, 'hero-center');
    assert.ok(scene.assets.some(a => a.id === 'logo'));
  });

  it('generates collage scene with masonry-grid', () => {
    const plan = makePlan({
      content_type: 'collage',
      layout: 'masonry-grid',
      assets: [
        { id: 'p1', src: '1.jpg' },
        { id: 'p2', src: '2.jpg' },
        { id: 'p3', src: '3.jpg' },
        { id: 'p4', src: '4.jpg' },
      ],
    });
    const scene = generateScene(plan, 5, baseBrief);
    assert.equal(scene.layout.template, 'masonry-grid');
    assert.equal(scene.assets.length, 4);
    assert.ok(scene.layers.some(l => l.slot === 'cell-0'));
    assert.ok(scene.layers.some(l => l.slot === 'cell-3'));
  });

  it('generates data viz scene', () => {
    const plan = makePlan({
      content_type: 'data_visualization',
      layout: 'hero-center',
      text: 'Revenue Growth',
      assets: [{ id: 'chart', src: 'chart.png', content_type: 'data_visualization' }],
    });
    const scene = generateScene(plan, 6, baseBrief);
    assert.ok(scene.assets.some(a => a.id === 'chart'));
    assert.ok(scene.layers.some(l => l.type === 'text'));
  });

  it('always sets camera to static', () => {
    const scene = generateScene(makePlan(), 0, baseBrief);
    assert.deepEqual(scene.camera, { move: 'static' });
  });

  it('applies brand colors', () => {
    const scene = generateScene(makePlan(), 0, baseBrief);
    const textLayer = scene.layers.find(l => l.type === 'text');
    assert.equal(textLayer.style.color, '#ffffff');
  });

  it('applies brand font', () => {
    const brief = { brand: { font: 'Inter', colors: {} } };
    const scene = generateScene(makePlan(), 0, brief);
    const textLayer = scene.layers.find(l => l.type === 'text');
    assert.equal(textLayer.style.fontFamily, 'Inter');
  });

  it('populates metadata with content_type and intent_tags', () => {
    const scene = generateScene(makePlan({ intent_tags: ['opening', 'hero'] }), 0, baseBrief);
    assert.equal(scene.metadata.content_type, 'typography');
    assert.deepEqual(scene.metadata.intent_tags, ['opening', 'hero']);
  });

  it('produces scenes that pass validateScene', () => {
    const plan = makePlan({
      content_type: 'portrait',
      layout: 'split-panel',
      text: 'Team photo',
      assets: [{ id: 'photo-team', src: 'team.jpg' }],
    });
    const scene = generateScene(plan, 0, baseBrief);
    scene.duration_s = 3;
    const result = validateScene(scene);
    assert.ok(result.valid, `Scene validation failed: ${result.errors.join('; ')}`);
  });
});

// ── generateScenes (integration) ─────────────────────────────────────────────

describe('generateScenes integration', () => {
  it('generates scenes from product-launch brief', async () => {
    const brief = makeBrief();
    const { scenes, notes } = await generateScenes(brief);
    assert.ok(scenes.length >= 3);
    assert.ok(notes.scene_count >= 3);
    assert.ok(notes.style);
    assert.ok(notes.total_duration_s > 0);
  });

  it('generates scenes from brand-story brief', async () => {
    const brief = makeBrief({
      template: 'brand-story',
      sections: [
        { label: 'Opening', text: 'Every day...' },
        { label: 'Problem', text: 'Messages get lost.' },
        { label: 'People', text: 'We\'ve been there.', assets: ['product-hero'] },
        { label: 'Vision', text: 'A better way', assets: ['product-hero'] },
        { label: 'Closing', text: 'Built remote-first.', assets: ['logo'] },
      ],
    });
    const { scenes, notes } = await generateScenes(brief);
    assert.ok(scenes.length >= 4);
    assert.equal(notes.template, 'brand-story');
  });

  it('generates scenes from investor-pitch brief', async () => {
    const brief = makeBrief({
      template: 'investor-pitch',
      sections: [
        { label: 'Hook', text: 'Teams waste 5 hours.' },
        { label: 'Product', text: 'We fix that.', assets: ['product-hero'] },
        { label: 'Traction', text: '500 teams. 3x revenue.' },
        { label: 'Ask', text: 'Raising $8M.', assets: ['logo'] },
      ],
    });
    const { scenes, notes } = await generateScenes(brief);
    assert.ok(scenes.length >= 3);
    assert.equal(notes.template, 'investor-pitch');
  });

  it('generates scenes from tutorial brief', async () => {
    const brief = makeBrief({
      template: 'tutorial',
      sections: [
        { label: 'Title', text: 'How to Build a Dashboard' },
        { label: 'Step', text: 'Step 1: Click New', assets: ['product-hero'] },
        { label: 'Step', text: 'Step 2: Drag metrics' },
        { label: 'Step', text: 'Step 3: Share' },
        { label: 'Next Steps', text: 'Learn more', assets: ['logo'] },
      ],
    });
    const { scenes, notes } = await generateScenes(brief);
    assert.ok(scenes.length >= 4);
    assert.equal(notes.template, 'tutorial');
  });

  it('generates scenes from custom brief', async () => {
    const brief = makeBrief({
      template: 'custom',
      sections: [
        { label: 'Intro', text: 'Welcome' },
        { label: 'Body', text: 'Content here' },
        { label: 'End', text: 'Goodbye' },
      ],
      assets: [],
    });
    const { scenes } = await generateScenes(brief);
    assert.ok(scenes.length >= 3);
  });

  it('all generated scenes pass validateScene', async () => {
    const brief = makeBrief();
    const { scenes } = await generateScenes(brief);
    for (const scene of scenes) {
      const result = validateScene(scene);
      assert.ok(result.valid, `${scene.scene_id} failed: ${result.errors.join('; ')}`);
    }
  });

  it('all generated scenes produce valid analysis', async () => {
    const brief = makeBrief();
    const { scenes } = await generateScenes(brief);
    for (const scene of scenes) {
      const analysis = analyzeScene(scene);
      assert.ok(analysis.metadata);
      assert.ok(analysis.metadata.content_type);
      assert.ok(analysis.metadata.visual_weight);
      assert.ok(analysis.metadata.motion_energy);
    }
  });

  it('throws on invalid brief', async () => {
    await assert.rejects(() => generateScenes(null), /Brief validation failed/);
    await assert.rejects(() => generateScenes({}), /Brief validation failed/);
  });

  it('includes asset classification in notes', async () => {
    const brief = makeBrief();
    const { notes } = await generateScenes(brief);
    assert.ok(Array.isArray(notes.asset_classification));
    assert.ok(notes.asset_classification.length > 0);
    assert.ok(notes.asset_classification[0].content_type);
    assert.ok(notes.asset_classification[0].confidence);
  });

  it('includes plan summary in notes', async () => {
    const brief = makeBrief();
    const { notes } = await generateScenes(brief);
    assert.ok(Array.isArray(notes.plan_summary));
    assert.ok(notes.plan_summary.length > 0);
    assert.ok(notes.plan_summary[0].label);
    assert.ok(notes.plan_summary[0].content_type);
  });
});

// ── Constants verification ───────────────────────────────────────────────────

describe('constants', () => {
  it('ASSET_FILENAME_PATTERNS all have required fields', () => {
    for (const p of ASSET_FILENAME_PATTERNS) {
      assert.ok(p.pattern instanceof RegExp);
      assert.ok(typeof p.content_type === 'string');
      assert.ok(typeof p.role === 'string');
    }
  });

  it('HINT_TO_CONTENT_TYPE maps to valid content types', () => {
    const validTypes = Object.keys(CONTENT_TYPE_TO_LAYOUT);
    for (const [hint, type] of Object.entries(HINT_TO_CONTENT_TYPE)) {
      assert.ok(validTypes.includes(type) || type === 'collage' || type === 'data_visualization' || type === 'audio',
        `Hint "${hint}" maps to unknown type "${type}"`);
    }
  });

  it('LABEL_TO_INTENT uses valid intent tags', () => {
    const validTags = ['opening', 'hero', 'detail', 'closing', 'emotional', 'informational', 'transition'];
    for (const [label, tags] of Object.entries(LABEL_TO_INTENT)) {
      for (const tag of tags) {
        assert.ok(validTags.includes(tag), `Label "${label}" has invalid intent "${tag}"`);
      }
    }
  });

  it('MOOD_TO_STYLES maps to arrays', () => {
    for (const [mood, styles] of Object.entries(MOOD_TO_STYLES)) {
      assert.ok(Array.isArray(styles), `Mood "${mood}" should map to array`);
      assert.ok(styles.length > 0);
    }
  });
});

// ── LLM enhancement fallback (ANI-36) ────────────────────────────────────────

describe('LLM enhancement (ANI-36)', () => {
  it('enhance=false produces no llm_enhancement notes', async () => {
    const brief = makeBrief();
    const { notes } = await generateScenes(brief, { enhance: false });
    assert.equal(notes.llm_enhancement, undefined);
  });

  it('enhance=true without API key falls back gracefully', async () => {
    // ANTHROPIC_API_KEY is not set in test env
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const brief = makeBrief();
      const { scenes, notes } = await generateScenes(brief, { enhance: true });
      // Should still produce valid scenes (rule-based fallback)
      assert.ok(scenes.length >= 3);
      assert.ok(notes.scene_count >= 3);
      // No LLM notes because key is not set — LLM calls are skipped entirely
      assert.equal(notes.llm_enhancement, undefined);
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('default options produce same output as enhance=false', async () => {
    const brief = makeBrief();
    const { scenes: s1 } = await generateScenes(brief);
    const { scenes: s2 } = await generateScenes(brief, { enhance: false });
    assert.equal(s1.length, s2.length);
    for (let i = 0; i < s1.length; i++) {
      assert.equal(s1[i].scene_id, s2[i].scene_id);
    }
  });
});

// ── attachSemanticBlock (ANI-68) ─────────────────────────────────────────────

describe('attachSemanticBlock', () => {
  const baseBrief = { brand: { colors: { primary: '#0066ff', text: '#ffffff', background: '#0a0a0a' } } };

  function makeSceneWithPlan(contentType, intentTags = ['detail'], text = 'Test content') {
    const planEntry = {
      label: 'Test',
      text,
      emphasis: 'normal',
      content_type: contentType,
      layout: CONTENT_TYPE_TO_LAYOUT[contentType] || 'hero-center',
      intent_tags: intentTags,
      assets: [],
      repeat_index: 0,
    };
    const scene = generateScene(planEntry, 0, baseBrief);
    scene.duration_s = 3;
    return { scene, planEntry };
  }

  it('typography → prompt_card component + focus + type_text + settle for hero intent (recipe)', () => {
    const { scene, planEntry } = makeSceneWithPlan('typography', ['opening', 'hero']);
    const result = attachSemanticBlock(scene, 'cinematic-dark', planEntry);
    assert.equal(result, true);
    assert.equal(scene.format_version, 3);
    assert.ok(scene.semantic);
    const cmp = scene.semantic.components.find(c => c.type === 'prompt_card');
    assert.ok(cmp, 'should have prompt_card component');
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'focus'));
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'type_text'));
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'settle'));
    assert.equal(scene.semantic.interactions.length, 3);
    const typeText = scene.semantic.interactions.find(i => i.kind === 'type_text');
    assert.equal(typeText.params.speed, 45);
  });

  it('typography detail → prompt_card + focus only (no type_text)', () => {
    const { scene, planEntry } = makeSceneWithPlan('typography', ['detail']);
    attachSemanticBlock(scene, 'editorial', planEntry);
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'focus'));
    assert.ok(!scene.semantic.interactions.some(i => i.kind === 'type_text'));
    assert.ok(!scene.semantic.interactions.some(i => i.kind === 'pulse_focus'));
  });

  it('typography closing → prompt_card + replace_text + settle (fade-and-swap recipe)', () => {
    const { scene, planEntry } = makeSceneWithPlan('typography', ['closing']);
    attachSemanticBlock(scene, 'editorial', planEntry);
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'replace_text'));
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'settle'));
    assert.equal(scene.semantic.interactions.length, 2);
  });

  it('brand_mark → icon_label_row + focus + pulse_focus', () => {
    const planEntry = {
      label: 'Logo', text: 'Brand Name', emphasis: 'normal',
      content_type: 'brand_mark', layout: 'hero-center',
      intent_tags: ['closing'],
      assets: [{ id: 'logo', src: 'logo.svg', content_type: 'brand_mark' }],
      repeat_index: 0,
    };
    const scene = generateScene(planEntry, 0, baseBrief);
    scene.duration_s = 3;
    const result = attachSemanticBlock(scene, 'editorial', planEntry);
    assert.equal(result, true);
    const cmp = scene.semantic.components.find(c => c.type === 'icon_label_row');
    assert.ok(cmp);
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'focus'));
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'pulse_focus'));
  });

  it('data_visualization → icon_label_row + focus', () => {
    const { scene, planEntry } = makeSceneWithPlan('data_visualization', ['detail'], 'Revenue Growth');
    const result = attachSemanticBlock(scene, 'editorial', planEntry);
    assert.equal(result, true);
    const cmp = scene.semantic.components.find(c => c.type === 'icon_label_row');
    assert.ok(cmp);
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'focus'));
  });

  it('collage → stacked_cards + fan_stack + settle (fan-and-settle recipe)', () => {
    const planEntry = {
      label: 'Grid', text: '', emphasis: 'normal',
      content_type: 'collage', layout: 'masonry-grid',
      intent_tags: ['detail'],
      assets: [
        { id: 'p1', src: '1.jpg' }, { id: 'p2', src: '2.jpg' },
        { id: 'p3', src: '3.jpg' }, { id: 'p4', src: '4.jpg' },
      ],
      repeat_index: 0,
    };
    const scene = generateScene(planEntry, 0, baseBrief);
    scene.duration_s = 3;
    const result = attachSemanticBlock(scene, 'cinematic-dark', planEntry);
    assert.equal(result, true);
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'fan_stack'));
    assert.ok(scene.semantic.interactions.some(i => i.kind === 'settle'));
  });

  it('returns false for product_shot (no semantic mapping)', () => {
    const planEntry = {
      label: 'Product', text: 'Shot', emphasis: 'normal',
      content_type: 'product_shot', layout: 'device-mockup',
      intent_tags: ['hero'],
      assets: [{ id: 'hero', src: 'hero.png', content_type: 'product_shot' }],
      repeat_index: 0,
    };
    const scene = generateScene(planEntry, 0, baseBrief);
    const result = attachSemanticBlock(scene, 'editorial', planEntry);
    assert.equal(result, false);
    assert.equal(scene.semantic, undefined);
  });

  it('returns false for portrait', () => {
    const planEntry = {
      label: 'Team', text: 'Photo', emphasis: 'normal',
      content_type: 'portrait', layout: 'split-panel',
      intent_tags: ['detail'],
      assets: [{ id: 'photo', src: 'team.jpg' }],
      repeat_index: 0,
    };
    const scene = generateScene(planEntry, 0, baseBrief);
    const result = attachSemanticBlock(scene, 'editorial', planEntry);
    assert.equal(result, false);
  });

  it('hero intent → reactive camera_behavior', () => {
    const { scene, planEntry } = makeSceneWithPlan('typography', ['opening', 'hero']);
    attachSemanticBlock(scene, 'cinematic-dark', planEntry);
    assert.equal(scene.semantic.camera_behavior.mode, 'reactive');
  });

  it('non-hero intent → ambient camera_behavior with drift', () => {
    const { scene, planEntry } = makeSceneWithPlan('typography', ['detail']);
    attachSemanticBlock(scene, 'editorial', planEntry);
    assert.equal(scene.semantic.camera_behavior.mode, 'ambient');
    assert.equal(scene.semantic.camera_behavior.ambient.drift, 0.15);
  });

  it('sets format_version = 3', () => {
    const { scene, planEntry } = makeSceneWithPlan('typography', ['detail']);
    attachSemanticBlock(scene, 'editorial', planEntry);
    assert.equal(scene.format_version, 3);
  });

  it('component gets correct anchor from layout slot', () => {
    const { scene, planEntry } = makeSceneWithPlan('typography', ['detail']);
    attachSemanticBlock(scene, 'editorial', planEntry);
    const cmp = scene.semantic.components[0];
    assert.ok(cmp.anchor, 'component should have an anchor');
  });
});

// ── v3 format integration (ANI-68) ──────────────────────────────────────────

describe('generateScenes v3 format', () => {
  it('format v3 produces semantic blocks for typography scenes', async () => {
    const brief = makeBrief({
      template: 'custom',
      sections: [
        { label: 'Hero', text: 'Welcome to the future' },
        { label: 'Features', text: 'Built for speed' },
        { label: 'CTA', text: 'Try it now' },
      ],
      assets: [],
    });
    const { scenes, notes } = await generateScenes(brief, { format: 'v3' });
    assert.equal(notes.format, 'v3');
    // Typography scenes should have semantic blocks
    const v3Scenes = scenes.filter(s => s.format_version === 3);
    assert.ok(v3Scenes.length > 0, 'should have at least one v3 scene');
    for (const s of v3Scenes) {
      assert.ok(s.semantic, 'v3 scene should have semantic block');
      assert.ok(s.semantic.components.length > 0);
      assert.ok(s.semantic.interactions.length > 0);
      assert.ok(s.semantic.camera_behavior);
    }
  });

  it('mixed: typography v3, product_shot v2 in same generation', async () => {
    const brief = makeBrief({
      template: 'custom',
      sections: [
        { label: 'Hero', text: 'Welcome' },
        { label: 'Product', text: 'Our product', assets: ['product-hero'] },
        { label: 'CTA', text: 'Get started' },
      ],
      assets: [
        { id: 'product-hero', src: 'assets/hero-product.png', hint: 'product' },
      ],
    });
    const { scenes } = await generateScenes(brief, { format: 'v3' });
    const v3Scenes = scenes.filter(s => s.format_version === 3);
    const v2Scenes = scenes.filter(s => s.format_version === 2);
    assert.ok(v3Scenes.length > 0, 'should have v3 scenes (typography)');
    assert.ok(v2Scenes.length > 0, 'should have v2 scenes (product_shot)');
  });

  it('default format is v2 (backward compat)', async () => {
    const brief = makeBrief();
    const { scenes, notes } = await generateScenes(brief);
    assert.equal(notes.format, 'v2');
    for (const s of scenes) {
      // format_version is 2 if motion block was attached, undefined otherwise
      assert.ok(s.format_version === 2 || s.format_version === undefined,
        `Expected v2 or undefined, got ${s.format_version}`);
      assert.equal(s.semantic, undefined);
    }
  });

  it('all v3 generated scenes pass validateScene', async () => {
    const brief = makeBrief({
      template: 'custom',
      sections: [
        { label: 'Hero', text: 'Big headline' },
        { label: 'Detail', text: 'Supporting copy' },
        { label: 'Closing', text: 'Final word' },
      ],
      assets: [],
    });
    const { scenes } = await generateScenes(brief, { format: 'v3' });
    for (const scene of scenes) {
      const result = validateScene(scene);
      assert.ok(result.valid, `${scene.scene_id} failed: ${result.errors.join('; ')}`);
    }
  });
});
