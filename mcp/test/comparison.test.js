/**
 * Tests for candidate video comparison.
 *
 * Covers: ranking, per-dimension winners, recommendation generation,
 * tie-breaking, edge cases.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compareCandidateVideos, SCORE_DIMENSIONS } from '../lib/comparison.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeScoreCard(overall, subscores = {}) {
  const card = { overall, subscores: {} };
  for (const dim of SCORE_DIMENSIONS) {
    card.subscores[dim] = { score: subscores[dim] ?? overall, findings: [] };
  }
  return card;
}

const candA = {
  candidate_id: 'cand_a',
  strategy: 'prestige',
  score_card: makeScoreCard(0.82, {
    hook: 0.88,
    narrative_arc: 0.80,
    clarity: 0.78,
    visual_hierarchy: 0.82,
    motion_quality: 0.84,
    brand_finish: 0.80,
  }),
};

const candB = {
  candidate_id: 'cand_b',
  strategy: 'energy',
  score_card: makeScoreCard(0.86, {
    hook: 0.84,
    narrative_arc: 0.90,
    clarity: 0.91,
    visual_hierarchy: 0.80,
    motion_quality: 0.82,
    brand_finish: 0.85,
  }),
};

const candC = {
  candidate_id: 'cand_c',
  strategy: 'dramatic',
  score_card: makeScoreCard(0.74, {
    hook: 0.90,
    narrative_arc: 0.72,
    clarity: 0.68,
    visual_hierarchy: 0.76,
    motion_quality: 0.78,
    brand_finish: 0.60,
  }),
};

// ── Rankings ─────────────────────────────────────────────────────────────────

describe('compareCandidateVideos — rankings', () => {
  it('sorts candidates by overall score descending', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB, candC] });
    assert.equal(result.rankings.length, 3);
    assert.equal(result.rankings[0].candidate_id, 'cand_b');
    assert.equal(result.rankings[1].candidate_id, 'cand_a');
    assert.equal(result.rankings[2].candidate_id, 'cand_c');
  });

  it('assigns rank numbers starting at 1', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB] });
    assert.equal(result.rankings[0].rank, 1);
    assert.equal(result.rankings[1].rank, 2);
  });

  it('includes strategy in rankings', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB] });
    assert.equal(result.rankings[0].strategy, 'energy');
    assert.equal(result.rankings[1].strategy, 'prestige');
  });
});

// ── Per-dimension winners ───────────────────────────────────────────────────

describe('compareCandidateVideos — per_dimension_winner', () => {
  it('identifies correct winner for each dimension', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB, candC] });

    // cand_c has highest hook (0.90)
    assert.equal(result.per_dimension_winner.hook.winner, 'cand_c');
    // cand_b has highest narrative_arc (0.90)
    assert.equal(result.per_dimension_winner.narrative_arc.winner, 'cand_b');
    // cand_b has highest clarity (0.91)
    assert.equal(result.per_dimension_winner.clarity.winner, 'cand_b');
  });

  it('covers all 6 dimensions', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB] });
    for (const dim of SCORE_DIMENSIONS) {
      assert.ok(result.per_dimension_winner[dim], `Missing dimension: ${dim}`);
      assert.ok(result.per_dimension_winner[dim].winner);
      assert.ok(typeof result.per_dimension_winner[dim].score === 'number');
    }
  });
});

// ── Recommendation ──────────────────────────────────────────────────────────

describe('compareCandidateVideos — recommendation', () => {
  it('recommends the highest overall scorer', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB, candC] });
    assert.equal(result.recommendation.winner, 'cand_b');
  });

  it('computes margin as gap to runner-up', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB] });
    assert.ok(result.recommendation.margin > 0);
    const expected = Math.round((0.86 - 0.82) * 1000) / 1000;
    assert.equal(result.recommendation.margin, expected);
  });

  it('generates non-empty rationale string', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB] });
    assert.ok(result.recommendation.rationale.length > 10);
    assert.ok(result.recommendation.rationale.includes('energy'));
  });

  it('lists trade-offs where winner is not dimension leader', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB, candC] });
    // cand_b (winner) should have trade-offs for dimensions where cand_c leads (hook)
    assert.ok(result.recommendation.trade_offs.length > 0);
    assert.ok(result.recommendation.trade_offs.some(t => t.includes('hook')));
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('compareCandidateVideos — edge cases', () => {
  it('handles exactly 2 candidates', () => {
    const result = compareCandidateVideos({ candidates: [candA, candB] });
    assert.equal(result.rankings.length, 2);
    assert.ok(result.recommendation.winner);
  });

  it('throws for less than 2 candidates', () => {
    assert.throws(
      () => compareCandidateVideos({ candidates: [candA] }),
      { message: /At least 2/ }
    );
  });

  it('throws for null candidates', () => {
    assert.throws(
      () => compareCandidateVideos({ candidates: null }),
      { message: /At least 2/ }
    );
  });

  it('handles tied overall scores deterministically', () => {
    const tied1 = { candidate_id: 'tied_a', strategy: 'a', score_card: makeScoreCard(0.80) };
    const tied2 = { candidate_id: 'tied_b', strategy: 'b', score_card: makeScoreCard(0.80) };
    const result = compareCandidateVideos({ candidates: [tied1, tied2] });
    assert.equal(result.rankings.length, 2);
    assert.equal(result.recommendation.margin, 0);
    // Winner is deterministic (first in stable sort)
    assert.ok(result.recommendation.winner);
  });
});
