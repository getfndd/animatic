/**
 * Hero Frame Contract tests (ANI-178)
 *
 * Covers the scorer, the tier gate, and — most importantly — the four ways this
 * gate could quietly become a beautiful-looking pass over the wrong thing:
 *   (a) vacuous-pass  — metadata-only run must not PASS where pixels are required
 *   (b) placeholder   — a missing scene def must be no-evidence, never a render
 *   (c) fake-vision   — rendered pixels + a non-vision/garbage judge stays UNVERIFIED
 *   (d) broken-subject— a declared subject that doesn't exist WARNs, then BLOCKs at T3/T4
 *
 * The vision client and the frame capture are both injected, so the suite needs
 * no Remotion toolchain and no ANTHROPIC_API_KEY.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  resolveHeroFrame,
  scoreHeroFrame,
  verdictForScore,
  auditHeroFrames,
  HERO_FRAME_TIER_THRESHOLDS,
  COMPOSITION_AXES,
  AESTHETIC_AXES,
} from '../lib/hero-frame.js';
import { heroFrameIndex } from '../lib/hero-frame-capture.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeScene(id, opts = {}) {
  return {
    scene_id: id,
    duration_s: opts.duration_s ?? 4,
    primary_subject: 'primary_subject' in opts ? opts.primary_subject : 'hero_card',
    ...(opts.brand ? { brand: opts.brand } : {}),
    layers: opts.layers ?? [
      { id: 'bg', type: 'html', depth_class: 'background', product_role: 'decorative', content_class: 'atmosphere', clarity_weight: 1 },
      { id: 'hero_card', type: 'html', depth_class: 'foreground', product_role: 'hero', content_class: 'interaction', clarity_weight: 5 },
      { id: 'label', type: 'text', depth_class: 'foreground', product_role: 'functional', content_class: 'typography', clarity_weight: 3, block_role: 'headline' },
    ],
    motion: opts.motion ?? { groups: [{ targets: ['hero_card'], primitive: 'as-fadeIn' }] },
    ...(opts.hero_frame ? { hero_frame: opts.hero_frame } : {}),
  };
}

const STRONG_DIMS = { visual_center: 0.9, subject_scale: 0.86, contrast: 0.9, whitespace_air: 0.88, brand_presence: 0.9, emotional_semantic_clarity: 0.87 };
const WEAK_DIMS = { visual_center: 0.4, subject_scale: 0.4, contrast: 0.4, whitespace_air: 0.4, brand_presence: 0.4, emotional_semantic_clarity: 0.4 };

/** A mock vision client returning well-formed judge JSON. */
function visionClient(dims) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ score: 0.88, dimensions: dims, reasoning: ['ok'], rationale: 'good' }) }],
      }),
    },
  };
}

/** A mock client that replies with un-parseable garbage (no JSON judge). */
const junkClient = {
  messages: { create: async () => ({ content: [{ type: 'text', text: 'I am not able to judge this image.' }] }) },
};

const FAKE_STILL = { media_type: 'image/png', data: 'AAECAwQ=' };

// ── resolveHeroFrame ─────────────────────────────────────────────────────────

describe('resolveHeroFrame', () => {
  it('defaults to at=0.6 and primary_subject when no block is declared', () => {
    const r = resolveHeroFrame(makeScene('sc_a'));
    assert.equal(r.at, 0.6);
    assert.equal(r.subject, 'hero_card');
    assert.equal(r.subject_valid, true);
    assert.equal(r.declared, false);
  });

  it('honors a declared at + subject that resolves to a layer', () => {
    const r = resolveHeroFrame(makeScene('sc_a', { hero_frame: { at: 0.3, subject: 'label', intent: 'read the headline' } }));
    assert.equal(r.at, 0.3);
    assert.equal(r.subject, 'label');
    assert.equal(r.subject_valid, true);
    assert.equal(r.intent, 'read the headline');
  });

  it('flags a declared-but-unresolvable subject as a high-tier block finding', () => {
    const r = resolveHeroFrame(makeScene('sc_a', { hero_frame: { subject: 'ghost' } }));
    assert.equal(r.subject_valid, false);
    assert.equal(r.declared, true);
    assert.equal(r.finding.severity, 'block_high_tier');
  });

  it('falls back to the hero layer when primary_subject is absent', () => {
    const r = resolveHeroFrame(makeScene('sc_a', { primary_subject: undefined }));
    assert.equal(r.subject, 'hero_card');
    assert.equal(r.subject_valid, true);
  });
});

// ── heroFrameIndex (pure frame math) ─────────────────────────────────────────

describe('heroFrameIndex', () => {
  it('maps a normalized position to an in-range frame at 60fps', () => {
    assert.equal(heroFrameIndex({ duration_s: 5 }, 0.6), 180); // 0.6 * 300
    assert.equal(heroFrameIndex({ duration_s: 5 }, 0), 0);
  });
  it('clamps to the last frame and to [0,1]', () => {
    assert.equal(heroFrameIndex({ duration_s: 2 }, 1), 119); // 120 frames → last index 119
    assert.equal(heroFrameIndex({ duration_s: 2 }, 5), 119);
    assert.equal(heroFrameIndex({ duration_s: 2 }, -1), 0);
  });
});

// ── scoreHeroFrame: shape + evidence model ───────────────────────────────────

describe('scoreHeroFrame — structure', () => {
  it('scores legibility from metadata and leaves pixel axes UNVERIFIED with no frame', async () => {
    const s = await scoreHeroFrame({ scene: makeScene('sc_a'), tier: 'T3' });
    assert.equal(s.evidence, 'metadata-only');
    assert.equal(s.vision_source, null);
    for (const axis of [...COMPOSITION_AXES, ...AESTHETIC_AXES]) {
      assert.equal(s.subscores[axis].score, null, `${axis} must be UNVERIFIED without a rendered frame`);
    }
    assert.ok(s.subscores.subject_clarity.score > 0, 'legibility axes score from metadata');
  });

  it('verifies pixel axes only when the judge returns source=llm-vision', async () => {
    const s = await scoreHeroFrame({ scene: makeScene('sc_a'), frame: FAKE_STILL, tier: 'T3', client: visionClient(STRONG_DIMS) });
    assert.equal(s.evidence, 'rendered');
    assert.equal(s.vision_source, 'llm-vision');
    assert.equal(s.subscores.visual_center.score, 0.9);
    assert.equal(s.unverified.length, 0);
  });
});

// ── Tier gating: PASS legitimately, then the four adversarial traps ───────────

describe('hero-frame gate — tiering', () => {
  it('T1 PASSES a strong scene on metadata alone (legibility-only tier)', async () => {
    const s = await scoreHeroFrame({ scene: makeScene('sc_a'), tier: 'T1' });
    const v = verdictForScore(s);
    assert.equal(s.unverified.length, 0, 'T1 requires only subject_clarity, derivable from metadata');
    assert.equal(v.verdict, 'PASS');
    assert.ok(s.overall >= HERO_FRAME_TIER_THRESHOLDS.T1);
  });

  it('(a) vacuous-pass: T3 metadata-only BLOCKs — composition axes are UNVERIFIED', async () => {
    const s = await scoreHeroFrame({ scene: makeScene('sc_a'), tier: 'T3' });
    const v = verdictForScore(s);
    assert.ok(s.unverified.length > 0, 'pixel axes required at T3 must be unverified without a frame');
    assert.equal(v.verdict, 'BLOCK');
    assert.match(v.reasons.join(' '), /unverified/i);
  });

  it('T3 PASSES with a real rendered frame + strong vision judge', async () => {
    const s = await scoreHeroFrame({ scene: makeScene('sc_a'), frame: FAKE_STILL, tier: 'T3', client: visionClient(STRONG_DIMS) });
    const v = verdictForScore(s);
    assert.equal(s.evidence, 'rendered');
    assert.equal(v.verdict, 'PASS');
  });

  it('(c) fake-vision: rendered pixels + a non-vision/garbage judge stays UNVERIFIED → BLOCK', async () => {
    const s = await scoreHeroFrame({ scene: makeScene('sc_a'), frame: FAKE_STILL, tier: 'T3', client: junkClient });
    const v = verdictForScore(s);
    assert.equal(s.vision_source, null, 'an unparseable judge response must not count as vision evidence');
    assert.equal(s.evidence, 'metadata-only');
    assert.ok(s.unverified.length > 0);
    assert.equal(v.verdict, 'BLOCK');
  });

  it('BLOCKs a scene whose composition scores below threshold (weak frame)', async () => {
    const s = await scoreHeroFrame({ scene: makeScene('sc_a'), frame: FAKE_STILL, tier: 'T3', client: visionClient(WEAK_DIMS) });
    const v = verdictForScore(s);
    assert.equal(v.verdict, 'BLOCK');
    assert.ok(s.overall < s.threshold);
  });

  it('(d) broken-subject: WARNs at T2, BLOCKs at T3/T4', async () => {
    const scene = makeScene('sc_broken', { hero_frame: { subject: 'ghost' } });
    const t2 = verdictForScore(await scoreHeroFrame({ scene, tier: 'T2' }));
    assert.notEqual(t2.verdict, 'BLOCK', 'a broken subject is advisory at the legibility tiers');

    // Even with a strong frame, T3 must block on the broken subject.
    const t3 = verdictForScore(await scoreHeroFrame({ scene, frame: FAKE_STILL, tier: 'T3', client: visionClient(STRONG_DIMS) }));
    assert.equal(t3.verdict, 'BLOCK');
    assert.match(t3.reasons.join(' '), /subject/i);
  });
});

// ── auditHeroFrames: fail-closed gate + (b) placeholder repro ─────────────────

describe('auditHeroFrames — fail-closed gate', () => {
  it('(b) placeholder: a manifest entry with no scene def is no-evidence BLOCK, never rendered', async () => {
    const manifest = { scenes: [{ scene: 'sc_present' }, { scene: 'sc_absent' }] };
    const scenes = [makeScene('sc_present')];
    const captured = [];
    const capture = async (scene) => { captured.push(scene.scene_id); return FAKE_STILL; };

    const result = await auditHeroFrames({ manifest, scenes, tier: 'T1', capture });

    assert.equal(result.verdict, 'BLOCK');
    const absent = result.scenes.find(s => s.scene_id === 'sc_absent');
    assert.equal(absent.missing_definition, true);
    assert.equal(absent.evidence, 'none');
    assert.equal(absent.verdict, 'BLOCK');
    assert.ok(!captured.includes('sc_absent'), 'a missing scene def must never be sent to the renderer');
    assert.equal(result.evidence_summary.missing, 1);
  });

  it('PASSES a sequence at T3 when every hero frame renders and judges strong', async () => {
    const manifest = { scenes: [{ scene: 'sc_a' }, { scene: 'sc_b' }] };
    const scenes = [makeScene('sc_a'), makeScene('sc_b')];
    const capture = async () => FAKE_STILL;
    const result = await auditHeroFrames({ manifest, scenes, tier: 'T3', capture, client: visionClient(STRONG_DIMS) });
    assert.equal(result.verdict, 'PASS');
    assert.equal(result.evidence_summary.rendered, 2);
  });

  it('BLOCKs the whole sequence if any one scene is weak', async () => {
    const manifest = { scenes: [{ scene: 'sc_a' }, { scene: 'sc_weak' }] };
    const scenes = [makeScene('sc_a'), makeScene('sc_weak')];
    // Strong for everyone, weak only for sc_weak.
    const client = {
      messages: {
        create: async ({ messages }) => {
          const txt = JSON.stringify(messages).includes('sc_weak') ? WEAK_DIMS : STRONG_DIMS;
          return { content: [{ type: 'text', text: JSON.stringify({ score: 0.5, dimensions: txt, reasoning: [], rationale: '' }) }] };
        },
      },
    };
    const result = await auditHeroFrames({ manifest, scenes, tier: 'T3', capture: async () => FAKE_STILL, client });
    assert.equal(result.verdict, 'BLOCK');
    const weak = result.scenes.find(s => s.scene_id === 'sc_weak');
    assert.equal(weak.verdict, 'BLOCK');
  });

  it('without a capturer, T3 fails closed (metadata-only) but T1 can still pass', async () => {
    const manifest = { scenes: [{ scene: 'sc_a' }] };
    const scenes = [makeScene('sc_a')];
    const noCapture = async () => null; // simulates unavailable toolchain
    const t3 = await auditHeroFrames({ manifest, scenes, tier: 'T3', capture: noCapture });
    assert.equal(t3.verdict, 'BLOCK');
    const t1 = await auditHeroFrames({ manifest, scenes, tier: 'T1', capture: noCapture });
    assert.equal(t1.verdict, 'PASS');
  });

  it('applies manifest-entry overrides + threads the timeline so it scores what ships', async () => {
    const scene = { ...makeScene('sc_a'), duration_s: 4, camera: { move: 'static', intensity: 0 } };
    const manifest = { scenes: [{ scene: 'sc_a', duration_s: 8, camera_override: { move: 'push_in', intensity: 0.3 }, shot_grammar: { shot: 'cu' } }] };
    let seen;
    const capture = async (s, at, opts) => { seen = { scene: s, at, opts }; return FAKE_STILL; };
    await auditHeroFrames({ manifest, scenes: [scene], tier: 'T3', capture, client: visionClient(STRONG_DIMS), timelines: { sc_a: { tracks: ['x'] } } });
    assert.equal(seen.scene.duration_s, 8, 'entry duration_s overrides the scene def');
    assert.equal(seen.scene.camera.move, 'push_in', 'camera_override merges into the rendered scene');
    assert.equal(seen.scene.camera.intensity, 0.3);
    assert.deepEqual(seen.scene.shot_grammar, { shot: 'cu' }, 'shot_grammar carried from the entry');
    assert.deepEqual(seen.opts.timeline, { tracks: ['x'] }, 'compiled timeline threaded to the renderer');
  });
});

// ── Edge-safety: score_hero_frame must not drag the renderer into the bundle ──

describe('hero-frame module — edge safety', () => {
  it('imports the Node-only capture module lazily, not at top level', () => {
    const src = readFileSync(new URL('../lib/hero-frame.js', import.meta.url), 'utf-8');
    assert.ok(
      !/^\s*import\s+[^;]*from\s+['"]\.\/hero-frame-capture\.js['"]/m.test(src),
      'a static import of hero-frame-capture.js would pull node:fs/os/dns into the edge bundle where score_hero_frame is exposed',
    );
    assert.match(src, /await import\(['"]\.\/hero-frame-capture\.js['"]\)/, 'capture must be loaded via dynamic import inside auditHeroFrames');
  });
});
