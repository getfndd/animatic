/**
 * Candidate Video Comparison
 *
 * Ranks 2-3 scored candidates by weighted overall score, identifies
 * per-dimension winners, and generates a human-readable recommendation
 * with trade-off analysis.
 *
 * Pure arithmetic. No external dependencies.
 */

export const SCORE_DIMENSIONS = [
  'hook', 'narrative_arc', 'clarity',
  'visual_hierarchy', 'motion_quality', 'brand_finish',
];

/**
 * Compare and rank 2-3 scored candidates.
 *
 * @param {object} params
 * @param {object[]} params.candidates - Array of { candidate_id, strategy, score_card, manifest }
 *   where score_card is the output of scoreCandidateVideo
 * @returns {{ rankings, per_dimension_winner, recommendation }}
 */
export function compareCandidateVideos({ candidates }) {
  if (!candidates || candidates.length < 2) {
    throw new Error('At least 2 candidates required for comparison');
  }
  if (candidates.length > 5) {
    throw new Error('Maximum 5 candidates supported');
  }

  // ── Rankings (sorted by overall descending) ───────────────────────────────

  const ranked = candidates
    .map(c => ({
      candidate_id: c.candidate_id,
      strategy: c.strategy || c.candidate_id,
      overall: c.score_card?.overall ?? 0,
      subscores: extractSubscores(c.score_card),
    }))
    .sort((a, b) => b.overall - a.overall);

  const rankings = ranked.map((r, i) => ({
    rank: i + 1,
    candidate_id: r.candidate_id,
    strategy: r.strategy,
    overall: round(r.overall),
    subscores: r.subscores,
  }));

  // ── Per-dimension winners ─────────────────────────────────────────────────

  const per_dimension_winner = {};
  for (const dim of SCORE_DIMENSIONS) {
    let best = null;
    let bestScore = -1;
    for (const r of ranked) {
      const dimScore = r.subscores[dim] ?? 0;
      if (dimScore > bestScore) {
        bestScore = dimScore;
        best = r.candidate_id;
      }
    }
    per_dimension_winner[dim] = {
      winner: best,
      score: round(bestScore),
    };
  }

  // ── Recommendation ────────────────────────────────────────────────────────

  const winner = ranked[0];
  const runnerUp = ranked[1];
  const margin = round(winner.overall - runnerUp.overall);

  // Find dimensions where winner is NOT the per-dimension leader
  const trade_offs = [];
  for (const dim of SCORE_DIMENSIONS) {
    const dimWinner = per_dimension_winner[dim].winner;
    if (dimWinner !== winner.candidate_id) {
      const gap = round(per_dimension_winner[dim].score - (winner.subscores[dim] ?? 0));
      trade_offs.push(`${dim} weaker than ${dimWinner} by ${gap.toFixed(2)}`);
    }
  }

  // Find strongest dimensions for winner
  const winnerDims = SCORE_DIMENSIONS
    .filter(dim => per_dimension_winner[dim].winner === winner.candidate_id)
    .sort((a, b) => (winner.subscores[b] ?? 0) - (winner.subscores[a] ?? 0));

  const strongestStr = winnerDims.length > 0
    ? `strongest in ${winnerDims.slice(0, 2).join(' and ')}`
    : 'no per-dimension leads';

  const tradeStr = trade_offs.length > 0
    ? ` Trade-off: ${trade_offs[0]}.`
    : '';

  const rationale = `${winner.strategy} leads overall by ${margin.toFixed(2)}, ${strongestStr}.${tradeStr}`;

  return {
    rankings,
    per_dimension_winner,
    recommendation: {
      winner: winner.candidate_id,
      rationale,
      margin,
      trade_offs,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractSubscores(scoreCard) {
  const result = {};
  if (!scoreCard?.subscores) return result;
  for (const dim of SCORE_DIMENSIONS) {
    const sub = scoreCard.subscores[dim];
    result[dim] = typeof sub === 'number' ? sub : (sub?.score ?? 0);
  }
  return result;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
