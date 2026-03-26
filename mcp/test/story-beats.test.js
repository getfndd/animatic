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
