/**
 * render_master (ANI-183) — resolve + gate + compose the four masters.
 *
 * Gate/capture/client are injected so the suite needs no Remotion toolchain or
 * ANTHROPIC_API_KEY. The position-marker trick (a hero layer with a position that
 * recompose shifts) lets a recomposed aspect variant genuinely fail the gate while
 * the 16:9 primary passes — proving the gate evaluates the EMITTED artifacts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderMaster, composeMaster } from '../lib/render-master.js';
import { getMasterProfile } from '../lib/master-profiles.js';

// ── fixtures ───────────────────────────────────────────────────────────────────

function scene(id) {
  return {
    scene_id: id, duration_s: 4, primary_subject: 'card', product_role: 'result',
    canvas: { w: 1920, h: 1080 },
    layers: [
      { id: 'bg', type: 'html', depth_class: 'background', product_role: 'decorative', clarity_weight: 1, content: '<div></div>' },
      { id: 'card', type: 'html', depth_class: 'foreground', product_role: 'hero', clarity_weight: 5, content: '<div>Card</div>', position: { x: 960, y: 540 }, size: { w: 800, h: 400 } },
    ],
    motion: { groups: [{ targets: ['card'], primitive: 'as-fadeIn' }] },
  };
}
function manifest(ids = ['sc_a']) {
  return {
    sequence_id: 'seq_t', fps: 60, resolution: { w: 1920, h: 1080 }, format: { aspect_ratio: '16:9' },
    scenes: ids.map((id, i) => (i === 0 ? { scene: id, duration_s: 4 } : { scene: id, duration_s: 4, transition_in: { type: 'crossfade', duration_ms: 400 } })),
  };
}

const STRONG = { visual_center: 0.9, subject_scale: 0.9, contrast: 0.9, whitespace_air: 0.9, brand_presence: 0.9, emotional_semantic_clarity: 0.9 };
const WEAK = { visual_center: 0.3, subject_scale: 0.3, contrast: 0.3, whitespace_air: 0.3, brand_presence: 0.3, emotional_semantic_clarity: 0.3 };

// Capture marks the still by whether the hero layer was recomposed (x moved off 960).
const markerCapture = async (s) => {
  const card = (s.layers || []).find(l => l.id === 'card');
  const recomposed = card?.position && card.position.x !== 960;
  return { media_type: 'image/png', data: recomposed ? 'RECOMPOSED' : 'PRIMARY' };
};
// Vision client scores recomposed stills weak, primary stills strong.
const markerClient = {
  messages: { create: async ({ messages }) => {
    const weak = JSON.stringify(messages).includes('RECOMPOSED');
    return { content: [{ type: 'text', text: JSON.stringify({ score: 0.5, dimensions: weak ? WEAK : STRONG, reasoning: [], rationale: '' }) }] };
  } },
};
const strongClient = {
  messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ score: 0.9, dimensions: STRONG, reasoning: [], rationale: '' }) }] }) },
};
const FAKE_STILL = async () => ({ media_type: 'image/png', data: 'AAEC' });

// ── compose (pure) ─────────────────────────────────────────────────────────────

describe('composeMaster', () => {
  it('(d) recompose actually changes the variant scene defs (sceneDefs path, not just resolution)', () => {
    const composed = composeMaster({ manifest: manifest(), scenes: [scene('sc_a')], profile: getMasterProfile('video') });
    const v916 = composed.aspect_variants.find(v => v.ratio === '9:16');
    assert.ok(v916, '9:16 variant present');
    const card = v916.sceneDefs.sc_a.layers.find(l => l.id === 'card');
    assert.notEqual(card.position.x, 960, 'hero layer recomposed for 9:16 (x moved off source center)');
  });

  it('(e) honesty: every emitted artifact keeps the source scene set + order', () => {
    const composed = composeMaster({ manifest: manifest(['sc_a', 'sc_b']), scenes: [scene('sc_a'), scene('sc_b')], profile: getMasterProfile('video') });
    const ids = (m) => m.scenes.map(s => s.scene);
    assert.deepEqual(ids(composed.primary.manifest), ['sc_a', 'sc_b']);
    for (const v of composed.aspect_variants) assert.deepEqual(ids(v.manifest), ['sc_a', 'sc_b'], `${v.ratio} keeps scene set`);
  });

  it('constrains render routes to the profile policy (pin web_native for prototype)', () => {
    const composed = composeMaster({ manifest: manifest(), scenes: [scene('sc_a')], profile: getMasterProfile('prototype') });
    assert.ok(composed.render_routes.every(r => r.render_target === 'web_native'), 'all routes pinned to web_native');
  });

  it('retime applies only with beats + an allowing tier, and never re-authors', () => {
    const beats = { beats: [{ time: 1.0 }, { time: 2.0 }, { time: 3.5 }] };
    const composed = composeMaster({ manifest: manifest(['sc_a', 'sc_b']), scenes: [scene('sc_a'), scene('sc_b')], profile: getMasterProfile('video'), beats });
    assert.equal(composed.retime.applied, true);
    assert.deepEqual(composed.primary.manifest.scenes.map(s => s.scene), ['sc_a', 'sc_b'], 'retime is duration-only');
    // prototype never retimes even with beats
    const proto = composeMaster({ manifest: manifest(), scenes: [scene('sc_a')], profile: getMasterProfile('prototype'), beats });
    assert.equal(proto.retime.applied, false);
  });
});

// ── orchestrator (gate) ────────────────────────────────────────────────────────

describe('renderMaster', () => {
  it('(a) T1 prototype PASSes on legibility, web_native, no finish, 16:9 only', async () => {
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T1', capture: FAKE_STILL });
    assert.equal(r.verdict, 'PASS');
    assert.equal(r.emitted, true);
    assert.equal(r.master.finish_preset, null);
    assert.equal(r.master.primary.ratio, '16:9');
    assert.equal(r.master.aspect_variants.length, 0);
    assert.ok(r.master.render_routes.every(rt => rt.render_target === 'web_native'));
  });

  it('(b) T3 metadata-only fails closed with an explicit missing-evidence reason', async () => {
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: async () => null });
    assert.equal(r.verdict, 'BLOCK');
    assert.equal(r.emitted, false);
    assert.match(r.block_reason, /unverified|rendered frames|evidence/i);
    assert.doesNotMatch(r.block_reason, /quality failed/i);
  });

  it('(c) gate evaluates EACH emitted artifact: a bad 9:16 recompose BLOCKs while the 16:9 primary passes', async () => {
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: markerCapture, client: markerClient });
    const ratios = new Set(r.gate_by_artifact.map(g => g.ratio));
    assert.deepEqual(ratios, new Set(['16:9', '1:1', '9:16']), 'gate ran on the primary + every aspect variant');
    assert.equal(r.gate_by_artifact.find(g => g.ratio === '16:9').verdict, 'PASS', 'primary passes');
    assert.equal(r.gate_by_artifact.find(g => g.ratio === '9:16').verdict, 'BLOCK', 'recomposed 9:16 fails');
    assert.equal(r.verdict, 'BLOCK');
    assert.equal(r.emitted, false);
  });

  it('(f) emitted artifacts are renderable: { manifest, sceneDefs, timelines } with timelines compiled', async () => {
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: markerCapture, client: strongClient });
    assert.equal(r.verdict, 'PASS');
    const p = r.master.primary;
    assert.ok(p.manifest && p.sceneDefs && p.timelines, 'primary carries manifest + sceneDefs + timelines');
    assert.ok(Object.keys(p.timelines).length > 0, 'timelines were compiled for the primary');
    for (const v of r.master.aspect_variants) {
      assert.ok(v.manifest && v.sceneDefs && v.timelines, `${v.ratio} variant is renderable`);
    }
    assert.match(r.notes.join(' '), /assemble_video_sequence/);
  });

  it('throws on an unknown tier', async () => {
    await assert.rejects(() => renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T9' }), /Unknown master tier/);
  });
});
