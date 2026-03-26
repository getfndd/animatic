/**
 * Tests for story brief extraction.
 *
 * Covers: markdown parsing, archetype matching, brand defaults,
 * override precedence, missing data graceful degradation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractStoryBrief,
  parseBriefMarkdown,
  matchArchetype,
  inferFeaturesFromScenes,
  inferClosingBeat,
} from '../lib/story-brief.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const sampleBrief = `# Product Brief

## Audience
Enterprise finance teams managing multi-entity treasury operations

## Promise
AI-powered insights that surface hidden patterns in your financial data

## Features
- Natural language query interface
- Real-time dashboard drilldowns
- Automated anomaly detection
- Custom report generation

## Proof
- 3x faster insight delivery
- Used by 200+ finance teams
`;

const sampleBrand = {
  brand_id: 'fintech-demo',
  name: 'Mercury Insights',
  personality: 'cinematic-dark',
  style: 'prestige',
  motion: {
    preferred_personality: 'cinematic-dark',
    preferred_style_pack: 'prestige',
    max_intensity: 0.7,
  },
  guidelines: {
    target_audience: 'CFOs and finance leaders',
  },
};

const sampleScenes = [
  {
    scene_id: 'sc_01',
    layers: [
      { id: 'ly_title', type: 'text', content: 'Mercury Insights', depth_class: 'hero', label: 'Title' },
    ],
    metadata: { intent_tags: ['opening'], content_type: 'typography' },
  },
  {
    scene_id: 'sc_02',
    layers: [
      { id: 'ly_cards', type: 'html', label: 'Insight Cards' },
    ],
    metadata: { intent_tags: ['hero'], content_type: 'ui_screenshot' },
  },
  {
    scene_id: 'sc_03',
    layers: [
      { id: 'ly_logo', type: 'image', label: 'Logo' },
    ],
    metadata: { intent_tags: ['closing'], content_type: 'brand_mark' },
  },
];

const sampleProject = {
  title: 'Mercury Insights Sizzle',
  personality: 'cinematic-dark',
  style_pack: 'prestige',
  format: {
    duration_target_s: 30,
    resolution: { w: 1920, h: 1080 },
  },
};

// ── parseBriefMarkdown ──────────────────────────────────────────────────────

describe('parseBriefMarkdown', () => {
  it('extracts audience from ## Audience heading', () => {
    const result = parseBriefMarkdown(sampleBrief);
    assert.ok(result.audience.includes('Enterprise finance'));
  });

  it('extracts promise from ## Promise heading', () => {
    const result = parseBriefMarkdown(sampleBrief);
    assert.ok(result.promise.includes('AI-powered'));
  });

  it('extracts features as array from ## Features heading', () => {
    const result = parseBriefMarkdown(sampleBrief);
    assert.ok(Array.isArray(result.must_show_features));
    assert.equal(result.must_show_features.length, 4);
    assert.ok(result.must_show_features[0].includes('Natural language'));
  });

  it('extracts proof points from ## Proof heading', () => {
    const result = parseBriefMarkdown(sampleBrief);
    assert.ok(Array.isArray(result.proof_points));
    assert.equal(result.proof_points.length, 2);
  });

  it('returns empty object for null/undefined input', () => {
    assert.deepStrictEqual(parseBriefMarkdown(null), {});
    assert.deepStrictEqual(parseBriefMarkdown(undefined), {});
    assert.deepStrictEqual(parseBriefMarkdown(''), {});
  });
});

// ── matchArchetype ──────────────────────────────────────────────────────────

describe('matchArchetype', () => {
  it('returns null for empty scenes', () => {
    assert.equal(matchArchetype([], []), null);
    assert.equal(matchArchetype(null, []), null);
  });

  it('returns a valid archetype slug for scenes with intent tags', () => {
    const archetypes = [
      { slug: 'brand-teaser', scenes: [{ role: 'atmosphere_open', energy: 'low' }, { role: 'brand_statement', energy: 'medium' }, { role: 'logo_lockup', energy: 'still' }] },
      { slug: 'feature-reveal', scenes: [{ role: 'context_setup', energy: 'low' }, { role: 'feature_demo', energy: 'high' }, { role: 'cta_close', energy: 'medium' }] },
    ];
    const result = matchArchetype(sampleScenes, archetypes);
    assert.ok(typeof result === 'string');
    assert.ok(archetypes.some(a => a.slug === result));
  });
});

// ── inferFeaturesFromScenes ─────────────────────────────────────────────────

describe('inferFeaturesFromScenes', () => {
  it('extracts labels and short content from layers', () => {
    const result = inferFeaturesFromScenes(sampleScenes);
    assert.ok(Array.isArray(result));
    assert.ok(result.includes('Mercury Insights'));
    assert.ok(result.includes('Title'));
  });

  it('caps at 10 features', () => {
    const manyScenes = Array.from({ length: 20 }, (_, i) => ({
      layers: [{ id: `ly_${i}`, label: `Feature ${i}` }],
    }));
    const result = inferFeaturesFromScenes(manyScenes);
    assert.ok(result.length <= 10);
  });

  it('handles empty scenes array', () => {
    assert.deepStrictEqual(inferFeaturesFromScenes([]), []);
  });
});

// ── inferClosingBeat ────────────────────────────────────────────────────────

describe('inferClosingBeat', () => {
  it('returns logo_lockup for scenes ending with closing tag', () => {
    const result = inferClosingBeat(sampleScenes, null);
    assert.equal(result, 'logo_lockup');
  });

  it('falls back to archetype last role', () => {
    const arch = { scenes: [{ role: 'setup' }, { role: 'cta_close' }] };
    const result = inferClosingBeat([], arch);
    assert.equal(result, 'cta_close');
  });

  it('returns logo_lockup as default', () => {
    assert.equal(inferClosingBeat([], null), 'logo_lockup');
  });
});

// ── extractStoryBrief ───────────────────────────────────────────────────────

describe('extractStoryBrief', () => {
  it('produces a complete brief from all inputs', () => {
    const result = extractStoryBrief({
      project: sampleProject,
      brief: sampleBrief,
      scenes: sampleScenes,
      brand: sampleBrand,
    });

    assert.ok(result.audience.includes('Enterprise finance'));
    assert.ok(result.promise.includes('AI-powered'));
    assert.equal(result.emotional_tone, 'aspirational');
    assert.equal(result.must_show_features.length, 4);
    assert.equal(result.proof_points.length, 2);
    assert.equal(result.closing_beat, 'logo_lockup');
    assert.equal(result.inferred_personality, 'cinematic-dark');
    assert.equal(result.inferred_style_pack, 'prestige');
    assert.equal(result.duration_target_s, 30);
    assert.ok(typeof result.narrative_template === 'string');
    assert.equal(result.scene_count, 3);
    // Brief quality = 1.0 when all 4 core fields come from brief text
    assert.equal(result.brief_quality, 1);
    assert.equal(result.warnings.length, 0);
  });

  it('brief_quality is 0 when no brief text provided', () => {
    const result = extractStoryBrief({ scenes: sampleScenes });
    assert.equal(result.brief_quality, 0);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings.some(w => w.includes('audience')));
    assert.ok(result.warnings.some(w => w.includes('promise')));
  });

  it('brief_quality is partial with some fields from brief', () => {
    const partial = '## Audience\nFinance teams\n\n## Features\n- Dashboard\n';
    const result = extractStoryBrief({ brief: partial });
    assert.ok(result.brief_quality > 0);
    assert.ok(result.brief_quality < 1);
    assert.equal(result._sources.audience, 'brief');
    assert.equal(result._sources.must_show_features, 'brief');
  });

  it('pulls defaults from brand when brief text is missing', () => {
    const result = extractStoryBrief({
      brand: sampleBrand,
    });

    assert.equal(result.audience, 'CFOs and finance leaders');
    assert.equal(result.inferred_personality, 'cinematic-dark');
    assert.equal(result.inferred_style_pack, 'prestige');
  });

  it('applies overrides over everything else', () => {
    const result = extractStoryBrief({
      brief: sampleBrief,
      brand: sampleBrand,
      overrides: {
        audience: 'Custom audience',
        duration_target_s: 60,
        narrative_template: 'social-loop',
      },
    });

    assert.equal(result.audience, 'Custom audience');
    assert.equal(result.duration_target_s, 60);
    assert.equal(result.narrative_template, 'social-loop');
  });

  it('handles completely empty input gracefully with defaults + warnings', () => {
    const result = extractStoryBrief({});
    assert.ok(result.audience);
    assert.ok(result.promise);
    assert.ok(result.emotional_tone);
    assert.ok(typeof result.narrative_template === 'string');
    assert.ok(result.duration_target_s > 0);
    assert.ok(result.scene_count > 0);
    assert.equal(result.brief_quality, 0);
    assert.ok(result.warnings.length >= 3, 'should warn about missing core fields');
  });

  it('infers features from scenes when brief has none', () => {
    const result = extractStoryBrief({
      scenes: sampleScenes,
    });
    assert.ok(result.must_show_features.length > 0);
    assert.ok(result.must_show_features.includes('Mercury Insights'));
  });
});
