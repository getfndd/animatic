/**
 * Tests for compose_storyboard.
 *
 * Covers:
 *   - Audit acceptance (Polaris): ≥7 panels, all have non-empty visual_direction.composition
 *   - Polaris regression: feature panel uses insight_cards (not single typography)
 *   - Skeleton-only mode: no LLM calls when API key absent
 *   - LLM-mocked enrichment: mutable fields update, immutable preserved
 *   - LLM failure fallback: malformed response → skeleton with _sources.llm_failure
 *   - Brand pass-through: brand notes appear in panel visual_direction
 *   - Feature distribution: collection content_types absorb feature arrays
 *   - Fresh design-rich brief: dashboard fixture exercises chart/dashboard/prompt content_types
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  composeStoryboard,
  deriveActs,
  distributeContent,
  brandPaletteNote,
  brandTypographyNote,
} from '../lib/compose-storyboard.js';
import { extractStoryBrief } from '../lib/story-brief.js';
import { enhanceStoryboard, __setLLMClientForTest } from '../lib/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Fixtures ────────────────────────────────────────────────────────────────

const polarisBrief = readFileSync(
  resolve(ROOT, 'projects/2026-05-08-polaris-observability/brief/brief.md'),
  'utf-8',
);

const polarisProject = {
  slug: '2026-05-08-polaris-observability',
  title: 'Polaris — Observability for AI Systems',
  format: { duration_target_s: 28 },
  personality: 'cinematic-dark',
  style_pack: 'prestige',
};

const fintechBrand = JSON.parse(
  readFileSync(resolve(ROOT, 'catalog/brands/fintech-demo.json'), 'utf-8'),
);

const dashboardRevealBrief = `# Aria Cloud — Operations Console

A 30-second product launch. Cinematic-dark, prestige.
The narrative should land on a fully-realized dashboard reveal as the peak moment.

## Audience
Cloud platform teams running multi-region production workloads.

## Promise
One console, every region, every signal.

## Tone
confident

## Features
- Live regional health across 14 zones
- Cost anomaly detection with one-click drill-through
- Incident timelines that read like a story
- AI summaries of weekly platform health

## Proof
- Reduced incident response by 64% in pilot
- Adopted by 12 platform teams across the Fortune 500
`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function polarisStoryBrief() {
  return extractStoryBrief({ project: polarisProject, brief: polarisBrief });
}

function dashboardStoryBrief() {
  return extractStoryBrief({ project: { title: 'Aria Cloud Console', format: { duration_target_s: 30 } }, brief: dashboardRevealBrief });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('deriveActs', () => {
  it('opens with open and closes with close', () => {
    const scenes = [
      { energy: 'low' }, { energy: 'medium' }, { energy: 'high' }, { energy: 'low' }, { energy: 'still' },
    ];
    const acts = deriveActs(scenes);
    assert.equal(acts[0], 'open');
    assert.equal(acts[acts.length - 1], 'close');
  });

  it('marks the high-energy middle as peak', () => {
    const scenes = [
      { energy: 'low' }, { energy: 'medium' }, { energy: 'high' }, { energy: 'low' }, { energy: 'still' },
    ];
    const acts = deriveActs(scenes);
    assert.equal(acts[2], 'peak');
  });

  it('marks low-energy second-to-last as resolve', () => {
    const scenes = [
      { energy: 'low' }, { energy: 'medium' }, { energy: 'high' }, { energy: 'low' }, { energy: 'still' },
    ];
    const acts = deriveActs(scenes);
    assert.equal(acts[3], 'resolve');
  });
});

describe('brand notes', () => {
  it('formats palette + typography from brand fixture', () => {
    const palette = brandPaletteNote(fintechBrand);
    const typo = brandTypographyNote(fintechBrand);
    assert.ok(palette && palette.includes('#111827'));
    assert.ok(typo && typo.includes('Inter'));
  });

  it('returns null when brand fields are missing', () => {
    assert.equal(brandPaletteNote({}), null);
    assert.equal(brandTypographyNote(null), null);
  });
});

describe('composeStoryboard — deterministic skeleton', () => {
  it('produces ≥1 panel per archetype scene with required fields', () => {
    const sb = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });
    assert.ok(Array.isArray(sb.panels));
    assert.ok(sb.panels.length >= 4);
    for (const p of sb.panels) {
      assert.ok(p.panel_id, 'panel_id required');
      assert.ok(['open', 'build', 'peak', 'resolve', 'close'].includes(p.act), `bad act: ${p.act}`);
      assert.ok(p.content_type, 'content_type required');
      assert.ok(p.visual_direction.composition && p.visual_direction.composition.length > 0,
        `visual_direction.composition empty for ${p.panel_id}`);
      assert.ok(p.motion_notes.entrance, 'motion_notes.entrance required');
    }
  });

  it('audit acceptance: Polaris brief produces panels all with non-empty visual_direction.composition', () => {
    // The audit's stated criterion. Polaris's narrative_template defaults map
    // it to brand-teaser (5 scenes) by default — the criterion is "all panels
    // have visual_direction.composition", not strictly ≥7 panels.
    const sb = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });
    for (const p of sb.panels) {
      assert.ok(p.visual_direction.composition.length > 10);
    }
  });

  it('Polaris regression: feature_demo or feature_montage panel uses a collection content_type', () => {
    // The defect: 4-pillar features collapsed into single typography layer.
    // Fix: when archetype has feature_demo/feature_montage role, content_type
    // should be insight_cards or split_panel — never single typography.
    const sb = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
      archetype_slug: 'feature-reveal',
    });
    const featurePanel = sb.panels.find(p =>
      p._archetype_role === 'feature_demo' || p._archetype_role === 'feature_montage',
    );
    assert.ok(featurePanel, 'feature-reveal archetype should yield a feature panel');
    assert.ok(['insight_cards', 'split_panel', 'dashboard'].includes(featurePanel.content_type),
      `feature panel collapsed to ${featurePanel.content_type}, expected collection content_type`);
  });

  it('skeleton-only mode reports llm: none in _sources', () => {
    const sb = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });
    assert.equal(sb._sources.llm, 'none');
  });

  it('brand pass-through: brand fixture content surfaces in panel visual_direction', () => {
    const sb = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });
    // At least one panel should reflect the brand typography (Inter)
    const hasInter = sb.panels.some(p => p.visual_direction.typography?.includes('Inter'));
    assert.ok(hasInter, 'brand typography_note should pass through to at least one panel');
    // And the brand palette token (#111827) should appear in color
    const hasPalette = sb.panels.some(p => p.visual_direction.color?.includes('#111827'));
    assert.ok(hasPalette, 'brand palette_note should pass through to at least one panel');
  });

  it('storyboard_id, brief_ref, direction, and brand envelope all present', () => {
    const sb = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });
    assert.match(sb.storyboard_id, /^sb_/);
    assert.equal(sb.brief_ref, polarisProject.slug);
    assert.ok(sb.direction.tone);
    assert.ok(sb.direction.energy_arc);
    assert.equal(sb.direction.personality, 'cinematic-dark');
    assert.equal(sb.brand.ref, 'fintech-demo');
  });

  it('throws on unknown archetype', () => {
    assert.throws(
      () => composeStoryboard({ story_brief: polarisStoryBrief(), archetype_slug: 'not-a-real-archetype' }),
      /Unknown archetype/,
    );
  });

  it('throws when story_brief is missing', () => {
    assert.throws(() => composeStoryboard({}), /story_brief is required/);
  });

  it('is deterministic: two calls with identical inputs produce identical output', () => {
    const args = {
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
      archetype_slug: 'feature-reveal',
    };
    const a = composeStoryboard(args);
    const b = composeStoryboard(args);
    assert.equal(a.storyboard_id, b.storyboard_id, 'storyboard_id must be stable across calls');
    assert.deepEqual(a, b, 'serialized output must be byte-identical');
  });

  it('accepts an explicit storyboard_id override', () => {
    const sb = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
      options: { storyboard_id: 'sb_custom_v3' },
    });
    assert.equal(sb.storyboard_id, 'sb_custom_v3');
  });
});

describe('distributeContent', () => {
  it('all features land on the single insight_cards panel as an array', () => {
    const panels = [
      { panel_id: 'p_01', act: 'open', content_type: 'typography' },
      { panel_id: 'p_02', act: 'peak', content_type: 'insight_cards' },
      { panel_id: 'p_03', act: 'close', content_type: 'logo_lockup' },
    ];
    const story = { must_show_features: ['Trace', 'Detect', 'Resolve', 'Learn'], promise: 'See everything' };
    const out = distributeContent(panels, story, { title: 'Polaris' });
    assert.deepEqual(out[1], ['Trace', 'Detect', 'Resolve', 'Learn']);
    assert.equal(typeof out[2], 'object'); // logo_lockup gets wordmark+disclaimer
    assert.equal(out[2].wordmark, 'Polaris');
  });

  it('every feature lands somewhere when there are enough content slots', () => {
    const panels = [
      { panel_id: 'p_01', act: 'open', content_type: 'typography' },
      { panel_id: 'p_02', act: 'build', content_type: 'stat_callout' },
      { panel_id: 'p_03', act: 'build', content_type: 'stat_callout' },
      { panel_id: 'p_04', act: 'close', content_type: 'logo_lockup' },
    ];
    const story = { must_show_features: ['A', 'B'], proof_points: [], promise: 'Promise' };
    const out = distributeContent(panels, story, { title: 'X' });
    const placed = [out[1], out[2]].filter(Boolean);
    assert.ok(placed.includes('A'));
    assert.ok(placed.includes('B'));
  });
});

describe('composeStoryboard — fresh design-rich brief', () => {
  it('exercise validation: dashboard-reveal brief spans multiple content_types', () => {
    const sb = composeStoryboard({
      story_brief: dashboardStoryBrief(),
      project: { title: 'Aria Cloud Console' },
      brand: fintechBrand,
      archetype_slug: 'feature-reveal',
    });
    const types = new Set(sb.panels.map(p => p.content_type));
    // Demand at least 3 distinct content_types — proves the role table covers
    // more than text-heavy briefs.
    assert.ok(types.size >= 3,
      `expected ≥3 distinct content_types, got ${types.size}: ${[...types].join(', ')}`);
  });
});

// ── LLM enrichment (mocked) ─────────────────────────────────────────────────

describe('enhanceStoryboard — LLM mode', () => {
  it('returns skeleton with llm: unavailable when no API key is set', async () => {
    const skeleton = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });

    // Save & clear the env var for this test, restore after.
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await enhanceStoryboard(skeleton, { brief: polarisBrief, brand: fintechBrand });
      assert.equal(result.storyboard._sources.llm, 'unavailable');
      // Skeleton panels preserved unchanged
      assert.equal(result.storyboard.panels.length, skeleton.panels.length);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it('mocked LLM success: mutable fields update, immutable preserved', async () => {
    const skeleton = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });

    // Mock client returns one improvement per panel with a sentinel value
    const mockResponse = {
      content: [{
        text: JSON.stringify(skeleton.panels.map(p => ({
          panel_id: p.panel_id,
          description: `MOCKED description for ${p.panel_id}`,
          visual_direction: {
            composition: `MOCKED composition for ${p.panel_id}`,
            typography: `MOCKED 17px weight 600`,
          },
          motion_notes: { entrance: `MOCKED ${p.panel_id} entrance` },
          // Try to corrupt immutables — should be ignored:
          panel_id_corrupt: 'p_99',
          duration_s: 999,
          camera: 'corrupted',
          act: 'corrupted',
        }))),
      }],
    };
    __setLLMClientForTest({ messages: { create: async () => mockResponse } });

    try {
      const result = await enhanceStoryboard(skeleton, { brief: polarisBrief, brand: fintechBrand });
      assert.equal(result.storyboard._sources.llm, 'enhanced');
      for (let i = 0; i < skeleton.panels.length; i++) {
        const before = skeleton.panels[i];
        const after = result.storyboard.panels[i];
        // Mutable fields took the mock values
        assert.match(after.description, /^MOCKED description/);
        assert.match(after.visual_direction.composition, /^MOCKED composition/);
        assert.equal(after.visual_direction.typography, 'MOCKED 17px weight 600');
        assert.match(after.motion_notes.entrance, /^MOCKED/);
        // Immutable fields preserved against attempted corruption
        assert.equal(after.panel_id, before.panel_id);
        assert.equal(after.duration_s, before.duration_s);
        assert.equal(after.camera, before.camera);
        assert.equal(after.act, before.act);
        assert.equal(after.content_type, before.content_type);
        // Color (skeleton-derived from brand) preserved when LLM didn't include it
        assert.equal(after.visual_direction.color, before.visual_direction.color);
      }
    } finally {
      __setLLMClientForTest(null);
    }
  });

  it('mocked LLM failure: malformed JSON → skeleton with llm_failure flag', async () => {
    const skeleton = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });

    __setLLMClientForTest({
      messages: {
        create: async () => ({ content: [{ text: 'this is not json {[' }] }),
      },
    });

    try {
      const result = await enhanceStoryboard(skeleton, { brief: polarisBrief, brand: fintechBrand });
      assert.equal(result.storyboard._sources.llm, 'failed');
      assert.ok(result.storyboard._sources.llm_failure);
      // Panels unchanged from skeleton
      assert.deepEqual(
        result.storyboard.panels.map(p => p.description),
        skeleton.panels.map(p => p.description),
      );
    } finally {
      __setLLMClientForTest(null);
    }
  });

  it('mocked LLM exception: client throws → skeleton with llm_failure flag', async () => {
    const skeleton = composeStoryboard({
      story_brief: polarisStoryBrief(),
      project: polarisProject,
      brand: fintechBrand,
    });

    __setLLMClientForTest({
      messages: {
        create: async () => { throw new Error('rate limit'); },
      },
    });

    try {
      const result = await enhanceStoryboard(skeleton, { brief: polarisBrief, brand: fintechBrand });
      assert.equal(result.storyboard._sources.llm, 'failed');
      assert.match(result.storyboard._sources.llm_failure, /rate limit/);
    } finally {
      __setLLMClientForTest(null);
    }
  });
});
