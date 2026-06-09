/**
 * render_master one-button encode (ANI-185) — durable persistence + the
 * assemble→encode chain, gated fail-closed.
 *
 * Reuses the render-master fixtures (position-marker capture/vision clients) so
 * the suite needs no Remotion toolchain or ANTHROPIC_API_KEY. The Remotion spawn
 * is exercised only through an injected renderer; real encodes use dry_run_encode.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderMaster } from '../lib/render-master.js';
import { persistMaster, encodeMaster } from '../lib/master-persist.js';
import { getMasterProfile } from '../lib/master-profiles.js';
import { resolveRenderTargets } from '../lib/render-routing.js';

// ── fixtures (mirror render-master.test.js) ──────────────────────────────────────

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
const markerCapture = async (s) => {
  const card = (s.layers || []).find(l => l.id === 'card');
  const recomposed = card?.position && card.position.x !== 960;
  return { media_type: 'image/png', data: recomposed ? 'RECOMPOSED' : 'PRIMARY' };
};
const strongClient = {
  messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({ score: 0.9, dimensions: STRONG, reasoning: [], rationale: '' }) }] }) },
};

/** A passing T3 master, composed + gated + compiled (renderable). */
async function emittedT3() {
  const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: markerCapture, client: strongClient });
  assert.equal(r.emitted, true, 'fixture precondition: T3 master emits');
  return r.master;
}

/** A passing T4 master — includes the ProRes `master` delivery profile. */
async function emittedT4() {
  const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T4', capture: markerCapture, client: strongClient });
  assert.equal(r.emitted, true, 'fixture precondition: T4 master emits');
  return r.master;
}

/** A passing T4 master whose scene carries authored captions (so the audio pass
 *  writes a VTT sidecar the burn-in profiles can consume). */
async function emittedT4Captioned() {
  const captioned = { ...scene('sc_a'), captions: [{ text: 'Hello world', start_ms: 0, end_ms: 1500 }] };
  const r = await renderMaster({ manifest: manifest(), scenes: [captioned], tier: 'T4', capture: markerCapture, client: strongClient });
  assert.equal(r.emitted, true, 'fixture precondition: captioned T4 master emits');
  return r.master;
}

function tmpProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'ani185-'));
}

// ── persistMaster ────────────────────────────────────────────────────────────────

describe('persistMaster (ANI-185)', () => {
  it('writes { manifest, scenes/, timelines } per artifact + a master.json index', async () => {
    const master = await emittedT3();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', gateByArtifact: [], projectRoot: root, tier: 'T3' });

      assert.equal(persisted.index, join('masters', 'T3', 'master.json'));
      assert.ok(existsSync(join(root, persisted.index)), 'master.json index written');

      // primary + the two T3 recompositions (1:1, 9:16).
      assert.equal(persisted.artifacts.length, 3);
      for (const a of persisted.artifacts) {
        assert.ok(existsSync(join(root, a.manifest)), `${a.id} manifest.json`);
        assert.ok(existsSync(join(root, a.timelines)), `${a.id} timelines.json`);
        assert.ok(a.scenes.length > 0 && existsSync(join(root, a.scenes[0].path)), `${a.id} scene def`);
      }

      const index = JSON.parse(readFileSync(join(root, persisted.index), 'utf-8'));
      assert.equal(index.tier, 'T3');
      assert.equal(index.artifacts.length, 3);
      assert.deepEqual(index.delivery_profiles, master.delivery_profiles.map(d => d.slug));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('round-trip: the persisted primary re-resolves to the tier route policy (acceptance #3)', async () => {
    const master = await emittedT3();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T3' });
      const primary = persisted.artifacts.find(a => a.id === 'primary');

      // Reload manifest + scene defs from DISK (not the in-memory master).
      const diskManifest = JSON.parse(readFileSync(join(root, primary.manifest), 'utf-8'));
      const diskScenes = primary.scenes.map(s => JSON.parse(readFileSync(join(root, s.path), 'utf-8')));

      const allowed = new Set(getMasterProfile('video').render_target_policy.allowed);
      const reResolved = resolveRenderTargets(diskScenes, { manifest: diskManifest });
      assert.ok(
        reResolved.routes.every(r => allowed.has(r.render_target)),
        `disk re-resolve must stay within ${[...allowed].join(',')}, got ${reResolved.routes.map(r => r.render_target).join(',')}`,
      );
      // And it reproduces the master's own constrained routes exactly.
      const byScene = Object.fromEntries(master.render_routes.map(r => [r.scene_id, r.render_target]));
      for (const r of reResolved.routes) {
        assert.equal(r.render_target, byScene[r.scene_id], `${r.scene_id} route drifted from the persisted master`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ── encodeMaster ───────────────────────────────────────────────────────────────

describe('encodeMaster (ANI-185)', () => {
  it('[P1] passes render_routes as a scene_id→route MAP, not the array (route survives)', async () => {
    // Hand-built master whose one scene is pinned to `hybrid`. assemble keeps
    // hybrid in sceneRoutes; if encodeMaster passed the raw ARRAY, every
    // routes[sceneId] lookup would miss and silently fall to remotion_native.
    const master = {
      profile: 'video', tier: 'T3', delivery_profiles: [],
      retime: { applied: false }, finish_preset: null, audio_policy: 'mix',
      render_routes: [{ scene_id: 'sc_a', render_target: 'hybrid' }],
      primary: { ratio: '16:9', manifest: manifest(), sceneDefs: { sc_a: scene('sc_a') }, timelines: {} },
      aspect_variants: [],
    };
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T3' });
      const enc = await encodeMaster({ master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T3', dryRun: true });

      assert.equal(enc.masters[0].render_targets.sc_a.render_target, 'hybrid',
        'route must come from the constrained map, not a remotion_native fallback');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dry encode writes render-props.json per aspect and defers delivery transcodes', async () => {
    const master = await emittedT3();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T3' });
      const enc = await encodeMaster({ master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T3', dryRun: true });

      assert.equal(enc.masters.length, 3, 'one master MP4 plan per aspect');
      for (const m of enc.masters) {
        assert.equal(m.encoded, false, 'dry run does not spawn Remotion');
        assert.ok(existsSync(join(root, m.props)), `${m.artifact} render-props.json written`);
        assert.match(m.output, /master\.mp4$/);
      }

      // Every delivery profile resolves to a deferred transcode mapped to its aspect.
      assert.equal(enc.transcodes.length, master.delivery_profiles.length);
      assert.ok(enc.transcodes.every(t => t.deferred === true), 'transcodes deferred');
      const byProfile = Object.fromEntries(enc.transcodes.map(t => [t.profile, t]));
      assert.equal(byProfile['social-feed']?.aspect, '1:1');
      assert.equal(byProfile['story-reel']?.aspect, '9:16');
      assert.equal(byProfile['web-hero']?.aspect, '16:9');

      // ANI-188: each encode record carries the realized audio plan for the tier.
      assert.ok(enc.masters.every(m => m.audio?.policy === 'mix'), 'T3 masters carry the mix audio plan');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('[P2b] encodes from the PERSISTED render-props.json (source of truth, no drift)', async () => {
    const master = await emittedT3();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T3' });

      const calls = [];
      const fakeRender = async (props, outputPath, opts) => {
        // The renderer must be handed the persisted file path, and that file
        // must equal the props object it would otherwise have written.
        assert.ok(opts?.propsPath, 'encode must pass propsPath (persisted source of truth)');
        assert.match(opts.propsPath, /render-props\.json$/);
        // The persisted file must BE the JSON projection of the encoded props —
        // i.e. the encoder reads the on-disk artifact, not a divergent re-serialize.
        const onDisk = JSON.parse(readFileSync(opts.propsPath, 'utf-8'));
        assert.deepEqual(onDisk, JSON.parse(JSON.stringify(props)), 'persisted props must equal the encoded props');
        calls.push({ outputPath, propsPath: opts.propsPath });
      };

      const enc = await encodeMaster({ master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T3', dryRun: false, render: fakeRender });
      assert.equal(calls.length, 3, 'rendered each aspect master');
      assert.ok(enc.masters.every(m => m.encoded === true));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('[ANI-190] transcodes each delivery profile off its matching-aspect master, fail-soft', async () => {
    const master = await emittedT3();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T3' });
      const transcodeCalls = [];
      // Fail the FIRST transcode to prove fail-soft (one bad profile ≠ dead encode).
      let n = 0;
      const transcodeExec = async (args) => { transcodeCalls.push(args); if (++n === 1) throw new Error('boom'); };

      const enc = await encodeMaster({
        master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T3',
        dryRun: false, render: async () => {}, transcodeExec,
      });

      const byP = Object.fromEntries(enc.transcodes.map(t => [t.profile, t]));
      // T3: web-hero + social-landscape are sidecar-caption h264 → transcoded;
      // social-feed + story-reel are burn_in but this fixture has no authored
      // captions → no sidecar → deferred (ANI-193).
      assert.equal(byP['social-feed'].deferred, true);
      assert.match(byP['social-feed'].reason, /no captions sidecar/);
      assert.equal(byP['story-reel'].deferred, true);
      // Two h264 transcodes attempted; the first failed soft (recorded, not thrown).
      assert.equal(transcodeCalls.length, 2, 'only the two non-burn-in profiles transcode');
      const failed = enc.transcodes.filter(t => t.error);
      const ok = enc.transcodes.filter(t => t.encoded === true);
      assert.equal(failed.length, 1, 'the failing profile is recorded, not fatal');
      assert.equal(ok.length, 1, 'the other profile still transcoded');
      assert.match(failed[0].error, /boom/);
      assert.ok(transcodeCalls[0].includes('libx264'), 'real transcode args (scale + h264)');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('[ANI-190] T4 ProRes master writes a .mov container (not .mp4)', async () => {
    const master = await emittedT4();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T4' });
      const calls = [];
      const enc = await encodeMaster({
        master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T4',
        dryRun: false, render: async () => {}, transcodeExec: async (args) => calls.push(args),
      });
      const byP = Object.fromEntries(enc.transcodes.map(t => [t.profile, t]));
      // ProRes must land in .mov — ffmpeg rejects prores_ks in an mp4 container.
      assert.match(byP['master'].output, /\.mov$/, 'prores master is .mov, not .mp4');
      assert.equal(byP['master'].deferred, false);
      assert.equal(byP['master'].encoded, true);
      const proresCall = calls.find(c => c.join(' ').includes('prores_ks'));
      assert.ok(proresCall, 'a prores transcode ran');
      assert.match(proresCall[proresCall.length - 1], /\.mov$/, 'prores output path is the .mov file');
      // h264 deliverables still land in .mp4
      assert.match(byP['web-hero'].output, /\.mp4$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('[ANI-190] enforces max_size_mb: an over-cap transcode is flagged oversize, not a clean encode', async () => {
    const master = await emittedT3();
    // Swap in a tiny-cap profile so a 2 KB output blows the budget deterministically.
    master.delivery_profiles = [{ slug: 'tiny', resolution: { w: 1920, h: 1080 }, fps: 30, codec: 'h264', crf: 20, preset: 'medium', pixel_format: 'yuv420p', max_size_mb: 0.001, audio: null, captions: { mode: 'sidecar' } }];
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T3' });
      // The injected runner writes a 0.5 MB file at the output path (last arg) —
      // comfortably over the 0.001 MB cap.
      const transcodeExec = async (args) => { writeFileSync(args[args.length - 1], Buffer.alloc(512 * 1024)); };
      const enc = await encodeMaster({
        master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T3',
        dryRun: false, render: async () => {}, transcodeExec,
      });
      const tiny = enc.transcodes.find(t => t.profile === 'tiny');
      assert.equal(tiny.oversize, true, 'over-cap output is flagged oversize');
      assert.equal(tiny.deferred, true, 'an over-cap file is NOT a clean deliverable');
      assert.ok(!tiny.encoded, 'not marked a clean encode');
      assert.equal(tiny.max_size_mb, 0.001);
      assert.equal(tiny.size_mb, 0.5, 'reports the measured size');
      assert.match(tiny.reason, /max_size_mb|2-pass/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('[ANI-193] burns the captions sidecar into burn_in profiles (social-feed / story-reel)', async () => {
    const master = await emittedT4Captioned();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T4' });
      const calls = [];
      const enc = await encodeMaster({
        master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T4',
        dryRun: false, render: async () => {}, transcodeExec: async (args) => calls.push(args),
      });
      const byP = Object.fromEntries(enc.transcodes.map(t => [t.profile, t]));
      // burn_in profiles now transcode WITH captions burned in (no longer deferred).
      for (const slug of ['social-feed', 'story-reel']) {
        assert.equal(byP[slug].deferred, false, `${slug} transcoded`);
        assert.equal(byP[slug].captions_burned, true, `${slug} burned captions`);
        const call = calls.find(c => c[c.length - 1].includes(`${slug}.mp4`));
        assert.match(call[call.indexOf('-vf') + 1], /subtitles=/, `${slug} ffmpeg has the subtitles filter`);
      }
      // sidecar-caption profiles (web-hero) do NOT burn captions.
      const webHero = calls.find(c => c[c.length - 1].includes('web-hero.mp4'));
      assert.doesNotMatch(webHero[webHero.indexOf('-vf') + 1], /subtitles=/, 'web-hero keeps a sidecar, no burn-in');
      assert.ok(!byP['web-hero'].captions_burned);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('[ANI-193] burn_in stays deferred when there is no captions sidecar', async () => {
    const master = await emittedT4(); // scene has no authored captions → no sidecar
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T4' });
      const enc = await encodeMaster({
        master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T4',
        dryRun: false, render: async () => {}, transcodeExec: async () => {},
      });
      const sf = enc.transcodes.find(t => t.profile === 'social-feed');
      assert.equal(sf.deferred, true);
      assert.match(sf.reason, /no captions sidecar/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('[ANI-190] dry-run plans each transcode (command) without spawning ffmpeg', async () => {
    const master = await emittedT3();
    const root = tmpProjectRoot();
    try {
      const persisted = await persistMaster({ master, verdict: 'PASS', projectRoot: root, tier: 'T3' });
      let spawned = false;
      const enc = await encodeMaster({
        master, persistedArtifacts: persisted.artifacts, projectRoot: root, tier: 'T3',
        dryRun: true, transcodeExec: async () => { spawned = true; },
      });
      assert.equal(spawned, false, 'dry-run never spawns a transcode');
      const planned = enc.transcodes.filter(t => Array.isArray(t.command));
      assert.ok(planned.length >= 1, 'non-burn-in profiles carry the planned transcode command');
      assert.ok(planned.every(t => t.deferred === true), 'dry-run leaves everything deferred');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ── renderMaster integration (persist/encode flags, fail-closed) ─────────────────

describe('render_master persist/encode flags (ANI-185)', () => {
  /** A minimal on-disk project so getProject/saveProjectArtifact resolve by absolute path. */
  function tmpProject() {
    const root = tmpProjectRoot();
    writeFileSync(join(root, 'project.json'), JSON.stringify({
      slug: 'ani185-tmp', title: 'tmp', entrypoints: {}, scenes: [], versions: [], masters: [], review: {},
    }, null, 2));
    return root;
  }

  it('fail-closed: a BLOCKed master persists for inspection but is NOT encoded', async () => {
    const root = tmpProject();
    try {
      // No vision evidence (capture → null) BLOCKs at T3.
      const r = await renderMaster({
        project: root, manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3',
        capture: async () => null, encode: true, dry_run_encode: true,
      });
      assert.equal(r.verdict, 'BLOCK');
      assert.equal(r.emitted, false);
      assert.ok(r.persisted, 'BLOCKed master still persisted for inspection');
      assert.match(r.encode.skipped, /BLOCK/);
      assert.ok(!existsSync(join(root, 'masters', 'T3', 'primary', 'encode')), 'no encode dir for a BLOCKed master');

      // The master is registered in project.json.
      const proj = JSON.parse(readFileSync(join(root, 'project.json'), 'utf-8'));
      assert.equal(proj.entrypoints.latest_master, join('masters', 'T3', 'master.json'));
      assert.equal(proj.masters.length, 1);
      assert.equal(proj.masters[0].tier, 'T3');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emitted master with dry_run_encode persists, registers, and plans the encode', async () => {
    const root = tmpProject();
    try {
      const r = await renderMaster({
        project: root, manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3',
        capture: markerCapture, client: strongClient, encode: true, dry_run_encode: true,
      });
      assert.equal(r.emitted, true);
      assert.ok(r.persisted && r.encode);
      assert.equal(r.encode.masters.length, 3);
      assert.ok(existsSync(join(root, 'masters', 'T3', 'primary', 'encode', 'render-props.json')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('default (no flags) leaves render_master output unchanged — nothing persisted', async () => {
    const r = await renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: markerCapture, client: strongClient });
    assert.equal(r.persisted, null);
    assert.equal(r.encode, null);
  });

  it('persist/encode without a project throws', async () => {
    await assert.rejects(
      () => renderMaster({ manifest: manifest(), scenes: [scene('sc_a')], tier: 'T3', capture: markerCapture, client: strongClient, persist: true }),
      /requires a `project`/,
    );
  });
});
