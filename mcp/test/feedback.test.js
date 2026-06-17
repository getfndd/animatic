/**
 * Render feedback loop + scoring-weight recalibration (ANI-120).
 *
 * recordRenderFeedback writes against a real temp project (absolute-path
 * resolution); loadAllFeedback scans a temp projects tree; recalibration runs
 * over seeded feedback so the explainability + fail-closed + no-mutation
 * guarantees are asserted without touching the real projects/ dir.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { recordRenderFeedback, loadAllFeedback, recalibrateScoringWeights } from '../lib/feedback.js';
import { handleRecordRenderFeedback, handleRecalibrateScoringWeights } from '../handlers.js';
import { DEFAULT_WEIGHTS } from '../lib/scoring.js';
import { SCORE_DIMENSIONS } from '../lib/comparison.js';

process.env.ANIMATIC_TELEMETRY = 'off'; // keep the #28 piggyback from writing during tests

/** Create a temp project dir with a manifest + render entrypoint. */
function makeProject({ render = true, manifest = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ani-120-'));
  mkdirSync(join(dir, 'motion'), { recursive: true });
  const entrypoints = { root_manifest: manifest ? 'motion/manifest.json' : null };
  if (render) entrypoints.latest_render = 'renders/draft/out.mp4';
  writeFileSync(join(dir, 'project.json'), JSON.stringify({
    slug: 'tmp', scenes: [], versions: [], masters: [],
    review: { evaluation: null, critic: null, notes: null, feedback: null },
    entrypoints,
  }));
  if (manifest) {
    writeFileSync(join(dir, 'motion/manifest.json'), JSON.stringify({
      sequence_id: 'seq_tmp', scenes: [{ scene: 'sc_a' }, { scene: 'sc_b' }],
    }));
  }
  return dir;
}

describe('recordRenderFeedback (ANI-120)', () => {
  it('appends an entry with manifest snapshot, render_ref, and scene_ids', async () => {
    const dir = makeProject();
    try {
      const r = await recordRenderFeedback({
        project: dir, verdict: 'down',
        dimension_notes: { clarity: { verdict: 'down', note: 'product is confusing' }, hook: 'weak open' },
      });
      assert.equal(r.total, 1);
      const log = JSON.parse(readFileSync(join(dir, 'review/feedback.json'), 'utf-8'));
      assert.equal(log.length, 1);
      const e = log[0];
      assert.equal(e.verdict, 'down');
      assert.deepEqual(e.render_ref, { path: 'renders/draft/out.mp4', role: 'latest' });
      assert.deepEqual(e.scene_ids, ['sc_a', 'sc_b']);
      assert.equal(e.manifest_snapshot.sequence_id, 'seq_tmp');
      assert.equal(e.dimension_notes.clarity.verdict, 'down');
      assert.equal(e.dimension_notes.hook.note, 'weak open'); // bare-string note normalized
      assert.equal(e.dimension_notes.hook.verdict, 'down');   // bare note inherits overall verdict (P1)
      // pointer registered in project.json
      const proj = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf-8'));
      assert.equal(proj.review.feedback, 'review/feedback.json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('appends (does not overwrite) across multiple records', async () => {
    const dir = makeProject();
    try {
      await recordRenderFeedback({ project: dir, verdict: 'up' });
      await recordRenderFeedback({ project: dir, verdict: 'down' });
      const log = JSON.parse(readFileSync(join(dir, 'review/feedback.json'), 'utf-8'));
      assert.equal(log.length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects an unknown verdict and unknown dimension keys (fail-closed)', async () => {
    const dir = makeProject();
    try {
      await assert.rejects(() => recordRenderFeedback({ project: dir, verdict: 'meh' }), /verdict must be/);
      await assert.rejects(
        () => recordRenderFeedback({ project: dir, verdict: 'up', dimension_notes: { not_a_dim: 'x' } }),
        /Unknown scoring dimension/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('errors when no manifest or no render resolves', async () => {
    const noManifest = makeProject({ manifest: false });
    const noRender = makeProject({ render: false });
    try {
      await assert.rejects(() => recordRenderFeedback({ project: noManifest, verdict: 'up' }), /No manifest to attach/);
      await assert.rejects(() => recordRenderFeedback({ project: noRender, verdict: 'up' }), /No render to give feedback/);
    } finally {
      rmSync(noManifest, { recursive: true, force: true });
      rmSync(noRender, { recursive: true, force: true });
    }
  });
});

describe('loadAllFeedback (ANI-120)', () => {
  it('aggregates across projects with per-project provenance', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ani-120-root-'));
    try {
      for (const name of ['proj-a', 'proj-b']) {
        mkdirSync(join(root, name, 'review'), { recursive: true });
        writeFileSync(join(root, name, 'review/feedback.json'), JSON.stringify([{ verdict: 'down', dimension_notes: {} }]));
      }
      mkdirSync(join(root, 'no-feedback'), { recursive: true }); // skipped, no feedback.json
      const all = await loadAllFeedback({ root });
      assert.equal(all.length, 2);
      assert.deepEqual(all.map(e => e.project).sort(), ['proj-a', 'proj-b']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('recalibrateScoringWeights (ANI-120)', () => {
  const fb = (project, dim, note) => ({ project, verdict: 'down', render_ref: { path: `${project}.mp4`, role: 'latest' }, recorded_at: '2026-06-17T00:00:00Z', dimension_notes: { [dim]: { verdict: 'down', note } } });

  it('proposes bounded weights that sum to 1.0 and cites the driving entries', async () => {
    const feedback = [
      fb('p1', 'clarity', 'confusing'),
      fb('p2', 'clarity', 'still confusing'),
      fb('p3', 'clarity', 'unclear'),
      fb('p4', 'hook', 'slow open'),
    ];
    const { proposal, summary } = await recalibrateScoringWeights({ feedback });
    assert.ok(proposal, 'expected a proposal');

    // sums to 1.0
    const sum = Object.values(proposal.proposed_weights).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `weights must sum to 1, got ${sum}`);

    // clarity (3 downs) went up the most and cites exactly its 3 entries
    const clarity = proposal.adjustments.find(a => a.dimension === 'clarity');
    assert.ok(clarity.delta > 0, 'clarity should be up-weighted');
    assert.equal(clarity.down_notes, 3);
    assert.equal(clarity.evidence.length, 3);
    assert.deepEqual(clarity.evidence.map(e => e.project).sort(), ['p1', 'p2', 'p3']);
    assert.equal(clarity.evidence[0].note, 'confusing');

    // adjustments cite evidence by construction; renormalized reductions are separate (P2)
    assert.ok(proposal.adjustments.every(a => a.evidence.length > 0), 'every adjustment must cite evidence');
    const brand = proposal.renormalized.find(r => r.dimension === 'brand_finish');
    assert.ok(brand && brand.delta < 0, 'unflagged dimension reduced via renormalization list');

    // clamp respected: clarity factor ≤ 1.4 → to ≤ from*1.4 before renorm; sanity upper bound
    assert.ok(clarity.to <= 0.2 * 1.4 + 1e-9);
    assert.equal(summary.down_notes_by_dimension.clarity, 3);
  });

  it('counts dimension notes that omit a verdict by inheriting the entry verdict (P1)', async () => {
    const bare = (project) => ({ project, verdict: 'down', render_ref: { path: `${project}.mp4`, role: 'latest' }, recorded_at: '2026-06-17T00:00:00Z', dimension_notes: { clarity: { note: 'confusing' } } });
    const { proposal, summary } = await recalibrateScoringWeights({ feedback: [bare('p1'), bare('p2'), bare('p3')] });
    assert.ok(proposal, 'verdict-less notes on a down render should count');
    assert.equal(summary.down_notes_by_dimension.clarity, 3);
    assert.equal(proposal.adjustments.find(a => a.dimension === 'clarity').down_notes, 3);
  });

  it('fails closed with no proposal when evidence is thin (the {}-input repro)', async () => {
    const empty = await recalibrateScoringWeights({ feedback: [] });
    assert.equal(empty.proposal, null);
    assert.match(empty.reason, /insufficient evidence/);

    const thin = await recalibrateScoringWeights({ feedback: [fb('p1', 'clarity', 'x')], minEvidence: 3 });
    assert.equal(thin.proposal, null);
  });

  it('never mutates DEFAULT_WEIGHTS (pure proposal)', async () => {
    const before = JSON.stringify(DEFAULT_WEIGHTS);
    await recalibrateScoringWeights({ feedback: SCORE_DIMENSIONS.map((_, i) => fb(`p${i}`, 'clarity', 'x')) });
    assert.equal(JSON.stringify(DEFAULT_WEIGHTS), before, 'DEFAULT_WEIGHTS must be unchanged');
    assert.equal(DEFAULT_WEIGHTS.clarity, 0.20);
  });
});

describe('feedback handlers (ANI-120)', () => {
  it('record handler writes + recalibrate handler renders an explainable proposal', async () => {
    const dir = makeProject();
    try {
      const rec = await handleRecordRenderFeedback({
        project: dir, verdict: 'down',
        dimension_notes: { clarity: { verdict: 'down', note: 'confusing' } },
      });
      assert.ok(!rec.isError, rec.content?.[0]?.text);
      assert.ok(existsSyncSafe(join(dir, 'review/feedback.json')));

      // recalibrate handler over a seeded feedback set → readable text + cited evidence.
      const out = await handleRecalibrateScoringWeights({ minEvidence: 1 });
      assert.ok(!out.isError);
      assert.equal(typeof out.content[0].text, 'string');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('record handler returns a structured error (not a throw) on bad input', async () => {
    const out = await handleRecordRenderFeedback({ project: '/nonexistent/path', verdict: 'up' });
    assert.equal(out.isError, true);
    assert.match(out.content[0].text, /record_render_feedback failed/);
  });
});

function existsSyncSafe(p) {
  try { readFileSync(p); return true; } catch { return false; }
}
