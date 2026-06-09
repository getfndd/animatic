/**
 * render_master auto_revise preflight (ANI-186).
 *
 * A marginal master WITH rendered evidence runs a bounded frame-evidence revise
 * pass constrained to RETIME_OPS, then re-gates; the revision is adopted only if
 * the verdict doesn't regress. Off by default.
 *
 * Settling model (faithful to the real mechanism): auditHeroFrames applies the
 * manifest entry's duration_s onto the scene it hands to `capture`, so a longer
 * hold yields a more-settled still at the same hero-frame fraction. The injected
 * `capture` returns a weak still below a duration threshold and a strong one at
 * or above it — so a duration-only retime genuinely flips the gate, exactly as a
 * real hold extension would. The loop's RETIME_OPS constraint itself is proven
 * in auto-revise-allowed-ops.test.js; here we test render_master's WIRING.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderMaster } from '../lib/render-master.js';
import { RETIME_OPS } from '../lib/master-profiles.js';

// ── fixtures ─────────────────────────────────────────────────────────────────

function scene(id) {
  return {
    scene_id: id, duration_s: 2, primary_subject: 'card', product_role: 'result',
    canvas: { w: 1920, h: 1080 },
    layers: [
      { id: 'bg', type: 'html', depth_class: 'background', product_role: 'decorative', clarity_weight: 1, content: '<div></div>' },
      { id: 'card', type: 'html', depth_class: 'foreground', product_role: 'hero', clarity_weight: 5, content: '<div>Card</div>', position: { x: 960, y: 540 }, size: { w: 800, h: 400 } },
    ],
    motion: { groups: [{ targets: ['card'], primitive: 'as-fadeIn' }] },
  };
}
function manifest(durationS = 2) {
  return {
    sequence_id: 'seq_t', fps: 60, resolution: { w: 1920, h: 1080 }, format: { aspect_ratio: '16:9' },
    scenes: [{ scene: 'sc_a', duration_s: durationS }],
  };
}

const STRONG = { visual_center: 0.9, subject_scale: 0.9, contrast: 0.9, whitespace_air: 0.9, brand_presence: 0.9, emotional_semantic_clarity: 0.9 };
const WEAK = { visual_center: 0.3, subject_scale: 0.3, contrast: 0.3, whitespace_air: 0.3, brand_presence: 0.3, emotional_semantic_clarity: 0.3 };

const SETTLE_AT_S = 4;
// A still is "settled" once the hold is long enough. duration_s rides on the
// scene via applyEntryOverrides, so the retime is what flips this. Markers are
// non-overlapping (a substring collision like 'UNSETTLED'.includes('SETTLED')
// would defeat the keyword check).
const settlingCapture = async (s) => ({ media_type: 'image/png', data: (s.duration_s ?? 0) >= SETTLE_AT_S ? 'FRAME_SETTLED' : 'FRAME_RAW' });
const settlingClient = {
  messages: { create: async ({ messages }) => {
    const settled = JSON.stringify(messages).includes('FRAME_SETTLED');
    return { content: [{ type: 'text', text: JSON.stringify({ score: settled ? 0.9 : 0.3, dimensions: settled ? STRONG : WEAK, reasoning: [], rationale: '' }) }] };
  } },
};
const strongClient = {
  messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ score: 0.9, dimensions: STRONG, reasoning: [], rationale: '' }) }] }) },
};

// A revise loop that lands a duration-only extend (what a real bounded RETIME
// pass would produce): bump every entry's hold past the settling threshold.
function fakeRetimeLoop({ extendTo = SETTLE_AT_S } = {}) {
  return async ({ manifest: m, scenes }) => {
    const revised = JSON.parse(JSON.stringify(m));
    for (const e of revised.scenes) e.duration_s = extendTo;
    return {
      manifest: revised, scenes,
      score_before: 0.4, score_after: 0.7, improvement: 0.3,
      rounds: [], total_revisions: 1, frame_passes: 1,
      estimated_render_seconds: 1, ops_allowed: RETIME_OPS, ops_filtered: 1,
    };
  };
}
const sceneIds = (m) => m.scenes.map(s => s.scene || s.scene_id);

// ── default off ──────────────────────────────────────────────────────────────

describe('render_master auto_revise (ANI-186)', () => {
  it('default (auto_revise off) is unchanged — no auto_revise report', async () => {
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: settlingCapture, client: settlingClient });
    assert.equal(r.auto_revise, null);
    assert.equal(r.verdict, 'BLOCK'); // short hold → unsettled → below threshold
  });

  // ── adoption (injected loop = a real bounded retime) ──
  it('a marginal master self-heals: BLOCK → PASS via a RETIME-only pass, adopted', async () => {
    const r = await renderMaster({
      manifest: manifest(2), scenes: [scene('sc_a')], tier: 'T3',
      capture: settlingCapture, client: settlingClient,
      auto_revise: true, reviseLoop: fakeRetimeLoop(),
    });
    assert.ok(r.auto_revise?.ran, 'the pass ran');
    assert.equal(r.auto_revise.before_verdict, 'BLOCK');
    assert.equal(r.auto_revise.after_verdict, 'PASS');
    assert.equal(r.auto_revise.adopted, true);
    assert.equal(r.verdict, 'PASS', 'the adopted (revised) verdict is the master verdict');
    assert.equal(r.emitted, true);
    // cost is logged
    assert.equal(typeof r.auto_revise.estimated_render_seconds, 'number');
    assert.deepEqual(r.auto_revise.ops_allowed, RETIME_OPS);
    // honesty: the emitted master keeps the source scene set/order
    assert.deepEqual(sceneIds(r.master.primary.manifest), ['sc_a']);
    // the adopted hold is the extended one
    assert.equal(r.master.primary.manifest.scenes[0].duration_s, SETTLE_AT_S);
  });

  it('honesty: a loop that re-authors the scene set is rejected (throws)', async () => {
    const reauthorLoop = async ({ manifest: m, scenes }) => {
      const revised = JSON.parse(JSON.stringify(m));
      revised.scenes.push({ scene: 'sc_injected', duration_s: 3 }); // adds a scene → re-author
      return { manifest: revised, scenes, rounds: [], total_revisions: 1, frame_passes: 1, estimated_render_seconds: 1 };
    };
    await assert.rejects(
      () => renderMaster({ manifest: manifest(2), scenes: [scene('sc_a')], tier: 'T3', capture: settlingCapture, client: settlingClient, auto_revise: true, reviseLoop: reauthorLoop }),
      /honesty violation|re-authored/,
    );
  });

  it('keeps the original when the pass does not improve the verdict (no regression)', async () => {
    // The loop returns a still-short manifest → re-gate stays BLOCK → not adopted.
    const noopLoop = async ({ manifest: m, scenes }) => ({ manifest: JSON.parse(JSON.stringify(m)), scenes, rounds: [], total_revisions: 0, frame_passes: 1, estimated_render_seconds: 1, ops_filtered: 2 });
    const r = await renderMaster({ manifest: manifest(2), scenes: [scene('sc_a')], tier: 'T3', capture: settlingCapture, client: settlingClient, auto_revise: true, reviseLoop: noopLoop });
    assert.equal(r.auto_revise.ran, true);
    assert.equal(r.auto_revise.adopted, false);
    assert.equal(r.verdict, 'BLOCK', 'kept the original verdict');
    assert.equal(r.auto_revise.ops_filtered, 2, 'structural ops filtered count is surfaced (cost/transparency)');
  });

  // ── skip conditions ──
  it('skips on a PASS master (nothing to revise)', async () => {
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: settlingCapture, client: strongClient, auto_revise: true, reviseLoop: fakeRetimeLoop() });
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.auto_revise.ran, false);
    assert.match(r.auto_revise.reason, /PASS/);
  });

  it('skips on a missing-evidence BLOCK (no frames to revise on)', async () => {
    // capture → null ⇒ metadata-only ⇒ missing-evidence BLOCK at T3.
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: async () => null, auto_revise: true, reviseLoop: fakeRetimeLoop() });
    assert.equal(r.verdict, 'BLOCK');
    assert.equal(r.auto_revise.ran, false);
    assert.match(r.auto_revise.reason, /evidence|frames/);
  });

  // ── real loop end-to-end (no injection) — runs, stays honest, logs cost ──
  it('the REAL loop path runs, stays within the honesty contract, and logs cost', async () => {
    const r = await renderMaster({
      manifest: manifest(2), scenes: [scene('sc_a')], tier: 'T3',
      capture: settlingCapture, client: settlingClient, auto_revise: true,
    });
    assert.equal(r.auto_revise.ran, true);
    assert.equal(r.auto_revise.before_verdict, 'BLOCK');
    assert.deepEqual(r.auto_revise.ops_allowed, RETIME_OPS);
    assert.equal(typeof r.auto_revise.estimated_render_seconds, 'number');
    // honesty: whatever the loop did, the emitted/inspection master keeps the scene set/order
    assert.deepEqual(sceneIds(r.master.primary.manifest), ['sc_a']);
    // never regresses below the original verdict
    assert.ok(['BLOCK', 'WARN', 'PASS'].includes(r.verdict));
  });
});
