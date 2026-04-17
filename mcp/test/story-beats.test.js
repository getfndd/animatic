/**
 * Tests for story beat planning.
 *
 * Covers: archetype loading, duration computation, camera intent resolution,
 * brief section matching, continuity detection, audio beat snapping.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  planStoryBeats,
  resolveIntent,
  matchBriefSections,
  detectContinuityOpportunities,
  snapToAudioBeats,
  inferBeatClassification,
  recommendSemanticForBeat,
} from '../lib/story-beats.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const sampleBrief = {
  audience: 'Finance teams',
  promise: 'AI-powered insights',
  emotional_tone: 'aspirational',
  must_show_features: ['Natural language query', 'Real-time dashboards', 'Anomaly detection'],
  proof_points: ['3x faster insights'],
  closing_beat: 'logo_lockup',
  narrative_template: 'brand-teaser',
  inferred_personality: 'cinematic-dark',
  inferred_style_pack: 'prestige',
  duration_target_s: 25,
  scene_count: 5,
};

const sampleAudioBeats = {
  beats: [
    { time_s: 2.5, type: 'downbeat', strength: 0.9 },
    { time_s: 5.0, type: 'kick', strength: 0.7 },
    { time_s: 8.0, type: 'downbeat', strength: 0.8 },
    { time_s: 12.5, type: 'kick', strength: 0.6 },
    { time_s: 18.0, type: 'downbeat', strength: 0.9 },
    { time_s: 22.0, type: 'kick', strength: 0.7 },
    { time_s: 25.0, type: 'downbeat', strength: 1.0 },
  ],
  tempo_bpm: 120,
};

// ── planStoryBeats ──────────────────────────────────────────────────────────

describe('planStoryBeats', () => {
  it('produces a beat plan for brand-teaser archetype', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
    });

    assert.equal(result.archetype, 'brand-teaser');
    assert.ok(result.beats.length > 0);
    assert.ok(result.total_duration_s > 0);
    assert.ok(Array.isArray(result.energy_curve));
    assert.ok(result.pacing_profile);
  });

  it('duration_pcts sum to approximately 1.0', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
    });

    const pctSum = result.beats.reduce((sum, b) => sum + b.duration_pct, 0);
    assert.ok(Math.abs(pctSum - 1.0) < 0.02, `duration_pcts sum to ${pctSum}, expected ~1.0`);
  });

  it('total duration matches target', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
      options: { duration_target_s: 20 },
    });

    assert.ok(Math.abs(result.total_duration_s - 20) < 0.5, `total ${result.total_duration_s}s, expected ~20s`);
  });

  it('each beat has required fields', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
    });

    for (const beat of result.beats) {
      assert.ok(typeof beat.index === 'number');
      assert.ok(typeof beat.role === 'string');
      assert.ok(typeof beat.duration_s === 'number');
      assert.ok(typeof beat.duration_pct === 'number');
      assert.ok(typeof beat.energy === 'string');
      assert.ok(typeof beat.camera_intent === 'string');
      assert.ok(Array.isArray(beat.continuity_opportunities));
      assert.ok(Array.isArray(beat.recommended_layers));
    }
  });

  it('first beat has no transition_in', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
    });
    assert.equal(result.beats[0].transition_in, null);
  });

  it('throws for unknown archetype', () => {
    assert.throws(
      () => planStoryBeats({ story_brief: sampleBrief, archetype_slug: 'nonexistent' }),
      { message: /Unknown archetype/ }
    );
  });

  it('works with all available archetypes', () => {
    const slugs = ['brand-teaser', 'feature-reveal', 'onboarding-explainer', 'launch-reel', 'testimonial-cutdown', 'social-loop'];
    for (const slug of slugs) {
      const result = planStoryBeats({
        story_brief: sampleBrief,
        archetype_slug: slug,
      });
      assert.ok(result.beats.length > 0, `${slug}: no beats`);
      assert.ok(result.total_duration_s > 0, `${slug}: no duration`);
    }
  });
});

// ── Audio sync ──────────────────────────────────────────────────────────────

describe('planStoryBeats — audio sync', () => {
  it('snaps durations to audio beats when provided', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
      audio_beats: sampleAudioBeats,
    });

    assert.ok(result.audio_sync, 'should produce audio_sync');
    assert.ok(typeof result.audio_sync.beat_aligned_count === 'number');
    assert.ok(Array.isArray(result.audio_sync.adjustments));
  });

  it('audio_sync is null when no beats provided', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
    });
    assert.equal(result.audio_sync, null);
  });
});

// ── snapToAudioBeats ────────────────────────────────────────────────────────

describe('snapToAudioBeats', () => {
  it('adjusts durations within 15% to align with beats', () => {
    const durations = [5.0, 5.0, 5.0];
    const beats = { beats: [{ time_s: 5.2 }, { time_s: 10.1 }, { time_s: 15.0 }] };
    const result = snapToAudioBeats(durations, beats);

    // First boundary was 5.0 → 5.2 is within 15% (0.75), so should snap
    assert.ok(result.aligned_count > 0);
  });

  it('does not adjust beyond 15%', () => {
    const durations = [5.0, 5.0];
    const beats = { beats: [{ time_s: 8.0 }] }; // 3s off from 5.0 boundary = 60% adjustment
    const result = snapToAudioBeats(durations, beats);
    assert.equal(result.durations[0], 5.0, 'Should not snap to distant beat');
  });

  it('returns unchanged durations when no beats', () => {
    const durations = [3, 4, 5];
    const result = snapToAudioBeats(durations, null);
    assert.deepStrictEqual(result.durations, [3, 4, 5]);
    assert.equal(result.aligned_count, 0);
  });
});

// ── resolveIntent ───────────────────────────────────────────────────────────

describe('resolveIntent', () => {
  const intents = [
    { slug: 'inspect', camera: { move: 'static' } },
    { slug: 'spotlight', camera: { move: 'push_in' } },
    { slug: 'reveal', camera: { move: 'pull_out' } },
    { slug: 'compare', camera: { move: 'drift' } },
  ];

  it('resolves by camera move match', () => {
    assert.equal(resolveIntent({ camera: { move: 'push_in' }, energy: 'medium' }, intents), 'spotlight');
    assert.equal(resolveIntent({ camera: { move: 'pull_out' }, energy: 'high' }, intents), 'reveal');
  });

  it('falls back to energy when no move match', () => {
    assert.equal(resolveIntent({ camera: { move: 'breathe' }, energy: 'low' }, intents), 'inspect');
    assert.equal(resolveIntent({ camera: { move: 'breathe' }, energy: 'high' }, intents), 'reveal');
  });
});

// ── detectContinuityOpportunities ───────────────────────────────────────────

describe('detectContinuityOpportunities', () => {
  it('detects opportunities for shared layer types', () => {
    const scenes = [
      { role: 'open', recommended_layers: ['text_hero', 'background_video'] },
      { role: 'middle', recommended_layers: ['text_hero', 'product_screenshot'], energy: 'high' },
      { role: 'close', recommended_layers: ['logo'] },
    ];

    const ops = detectContinuityOpportunities(scenes);
    // Beat 1 should have opportunity from beat 0 (shared text_hero)
    assert.ok(ops[1].length > 0);
    assert.equal(ops[1][0].from_beat, 0);
    assert.ok(typeof ops[1][0].strategy === 'string');
    // Beat 2 should have no opportunity (no shared layers with beat 1)
    assert.equal(ops[2].length, 0);
  });

  it('returns empty arrays when no shared layers', () => {
    const scenes = [
      { role: 'a', recommended_layers: ['video'] },
      { role: 'b', recommended_layers: ['text'] },
    ];
    const ops = detectContinuityOpportunities(scenes);
    assert.equal(ops[0].length, 0);
    assert.equal(ops[1].length, 0);
  });
});

// ── Semantic-planner integration (ANI-116) ──────────────────────────────────

describe('inferBeatClassification', () => {
  it('maps energy → pacing', () => {
    assert.equal(inferBeatClassification({ energy: 'still' }).pacing, 'contemplative');
    assert.equal(inferBeatClassification({ energy: 'low' }).pacing, 'deliberate');
    assert.equal(inferBeatClassification({ energy: 'medium' }).pacing, 'moderate');
    assert.equal(inferBeatClassification({ energy: 'high' }).pacing, 'rapid');
    assert.equal(inferBeatClassification({ energy: 'impact' }).pacing, 'rapid');
  });

  it('maps camera_intent → camera_behavior', () => {
    assert.equal(inferBeatClassification({ camera_intent: 'reveal' }).camera_behavior, 'push_in');
    assert.equal(inferBeatClassification({ camera_intent: 'inspect' }).camera_behavior, 'static');
    assert.equal(inferBeatClassification({ camera_intent: 'impact' }).camera_behavior, 'drift');
  });

  it('maps allowlisted roles → interaction_type', () => {
    assert.equal(inferBeatClassification({ role: 'feature_demo' }).interaction_type, 'reveal');
    assert.equal(inferBeatClassification({ role: 'hero_product' }).interaction_type, 'reveal');
    assert.equal(inferBeatClassification({ role: 'context_setup' }).interaction_type, 'typing');
  });

  it('does not classify branding / logo / closing / atmosphere roles', () => {
    // Review finding: these roles should fall through to default scene
    // generation, not get a prompt_card seed via `transition`.
    for (const role of ['logo_lockup', 'cta_close', 'tagline_close', 'brand_statement',
      'atmosphere_open', 'brand_flash', 'welcome', 'hook_frame', 'problem_frame',
      'next_steps', 'launch_cta', 'quote_close', 'logo_resolve']) {
      const c = inferBeatClassification({ role });
      assert.equal(c.interaction_type, undefined, `${role} should not receive interaction_type`);
    }
  });

  it('adds text_behavior: typing when interaction_type is typing', () => {
    assert.equal(inferBeatClassification({ role: 'context_setup' }).text_behavior, 'typing');
    assert.equal(inferBeatClassification({ role: 'hero_product' }).text_behavior, undefined);
    // step_N no longer biased toward typing — could mean click or view
    assert.equal(inferBeatClassification({ role: 'step_1' }).text_behavior, undefined);
    assert.equal(inferBeatClassification({ role: 'step_1' }).interaction_type, undefined);
  });

  it('returns empty object for unknown / empty inputs', () => {
    assert.deepEqual(inferBeatClassification({}), {});
    assert.deepEqual(inferBeatClassification(null), {});
    assert.deepEqual(inferBeatClassification({ role: 'unknown_weird_role' }), {});
  });
});

describe('recommendSemanticForBeat', () => {
  it('produces a v3 semantic block for typing roles', () => {
    const rec = recommendSemanticForBeat({
      role: 'context_setup',
      energy: 'medium',
      camera_intent: 'reveal',
    });
    assert.ok(rec, 'typing role should produce a recommendation');
    assert.ok(Array.isArray(rec.components));
    assert.ok(rec.components.length > 0);
    assert.equal(rec.components[0].role, 'hero');
    assert.ok(rec.components.some(c => c.type === 'prompt_card'), 'typing → prompt_card');
    assert.ok(Array.isArray(rec.interactions));
    assert.ok(rec.camera_behavior);
    assert.ok(rec.classification, 'should include the classification used');
  });

  it('produces a reveal recommendation for hero/product roles', () => {
    const rec = recommendSemanticForBeat({
      role: 'hero_product',
      energy: 'high',
      camera_intent: 'reveal',
    });
    assert.ok(rec);
    assert.ok(rec.components.some(c => c.type === 'result_stack'), 'reveal → result_stack');
  });

  it('returns null when classification produces no components', () => {
    // A beat with only pacing + camera (no interaction_type) yields no components
    assert.equal(recommendSemanticForBeat({ energy: 'medium', camera_intent: 'reveal' }), null);
  });

  it('returns null for beats with unknown role and no other hints', () => {
    assert.equal(recommendSemanticForBeat({ role: 'something_weird' }), null);
  });
});

describe('planStoryBeats — semantic recommendations', () => {
  it('attaches semantic_recommendation to beats with inferable classification', () => {
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'feature-reveal',
    });

    const withRecs = result.beats.filter(b => b.semantic_recommendation);
    assert.ok(withRecs.length > 0, 'at least one beat should carry a recommendation');

    for (const beat of withRecs) {
      const rec = beat.semantic_recommendation;
      assert.ok(rec.classification, 'rec includes classification');
      assert.ok(Array.isArray(rec.components), 'rec has components');
      assert.ok(rec.components.length > 0);
      assert.ok(rec.camera_behavior, 'rec has camera_behavior');
    }
  });

  it('does not attach recommendations to branding / logo / atmosphere / closing beats', () => {
    // Regression guard for the ANI-116 review finding: the brand-teaser
    // archetype is made almost entirely of branding roles (atmosphere_open,
    // brand_statement, tagline_close, logo_lockup). Only `product_glimpse`
    // should receive a recommendation.
    const result = planStoryBeats({
      story_brief: sampleBrief,
      archetype_slug: 'brand-teaser',
    });

    for (const beat of result.beats) {
      if (['atmosphere_open', 'brand_statement', 'tagline_close', 'logo_lockup',
           'cta_close', 'hook_frame', 'problem_frame', 'next_steps', 'launch_cta',
           'welcome', 'logo_resolve', 'quote_close'].includes(beat.role)) {
        assert.equal(beat.semantic_recommendation, undefined,
          `${beat.role} must not receive a semantic_recommendation`);
      }
    }

    // At least product_glimpse should still get one
    const glimpse = result.beats.find(b => b.role === 'product_glimpse');
    if (glimpse) {
      assert.ok(glimpse.semantic_recommendation,
        'product_glimpse should still carry a recommendation');
    }
  });
});
