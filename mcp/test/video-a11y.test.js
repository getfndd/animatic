/**
 * Accessibility audit for rendered videos (ANI-122).
 *
 * Pure-math and static checks run offline (synthesized luminance series,
 * fixture scenes/manifests, injectable exec). The frame layer is exercised
 * end-to-end against real ffmpeg in the skip-gated integration block at
 * the bottom: a known-bad lavfi strobe video must fail, a calm video must
 * pass.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  analyzeFlashes,
  auditVideoAccessibility,
  checkCaptionsAndAutoplay,
  checkMotionIntensity,
  checkTextContrast,
  contrastRatio,
  decodeVideoFrames,
  frameMeanLuminance,
  parseHexColor,
  relativeLuminance,
  FLASH_SAMPLE_FPS,
} from '../lib/video-a11y.js';

const execFileAsync = promisify(execFile);

// ── Color math ──────────────────────────────────────────────────────────────

describe('contrast math', () => {
  it('computes canonical WCAG values', () => {
    assert.equal(relativeLuminance(255, 255, 255).toFixed(2), '1.00');
    assert.equal(relativeLuminance(0, 0, 0), 0);
    // Black on white is the canonical 21:1.
    assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21);
    assert.equal(contrastRatio([128, 128, 128], [128, 128, 128]), 1);
  });

  it('parses hex colors including shorthand and alpha forms', () => {
    assert.deepEqual(parseHexColor('#fff'), [255, 255, 255]);
    assert.deepEqual(parseHexColor('#0a0a14'), [10, 10, 20]);
    assert.deepEqual(parseHexColor('#0a0a14cc'), [10, 10, 20]);
    assert.equal(parseHexColor('rebeccapurple'), null);
  });
});

// ── Flash analysis (pure) ───────────────────────────────────────────────────

describe('analyzeFlashes', () => {
  const calm = Array.from({ length: 50 }, (_, i) => 0.4 + 0.02 * Math.sin(i / 5));

  it('passes calm content', () => {
    const result = analyzeFlashes(calm, FLASH_SAMPLE_FPS);
    assert.equal(result.violates, false);
    assert.equal(result.flash_times_s.length, 0);
  });

  it('fails a 5Hz strobe (10 luminance swings/s)', () => {
    // Alternating bright/dark every sampled frame at 10fps = 5 flashes/s.
    const strobe = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 0.9 : 0.1));
    const result = analyzeFlashes(strobe, FLASH_SAMPLE_FPS);
    assert.equal(result.violates, true);
    assert.ok(result.worst_window.flashes > 3, `worst window ${result.worst_window.flashes} > 3`);
  });

  it('tolerates exactly three flashes per second', () => {
    // Three opposing-transition pairs spread over a second, then calm.
    const series = [0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, ...Array(13).fill(0.1)];
    const result = analyzeFlashes(series, FLASH_SAMPLE_FPS);
    assert.equal(result.violates, false);
    assert.ok(result.worst_window.flashes <= 3);
  });

  it('ignores sub-threshold flicker', () => {
    const flicker = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 0.5 : 0.55));
    assert.equal(analyzeFlashes(flicker, FLASH_SAMPLE_FPS).flash_times_s.length, 0);
  });

  it('frameMeanLuminance averages an RGBA buffer', () => {
    const white = Buffer.alloc(16, 255);
    const black = Buffer.alloc(16, 0);
    assert.equal(frameMeanLuminance(white).toFixed(2), '1.00');
    assert.equal(frameMeanLuminance(black), 0);
  });
});

// ── Static checks ───────────────────────────────────────────────────────────

const MANIFEST = {
  scenes: [
    { scene: 'sc_hero', duration_s: 4, camera_override: { move: 'push_in', intensity: 0.8 } },
    { scene: 'sc_body', duration_s: 5 },
    { scene: 'sc_close', duration_s: 3 },
  ],
};

const SCENE_DEFS = {
  sc_hero: {
    scene_id: 'sc_hero',
    background: '#0a0a14',
    voiceover: { text: 'Welcome.' },
    layers: [
      { id: 'headline', type: 'html', content: '<div style="color:#ffffff;font-size:64px">Bright headline</div>' },
      { id: 'mystery', type: 'html', content: '<div>Unstyled text</div>' },
    ],
  },
  sc_body: {
    scene_id: 'sc_body',
    voiceover: { text: 'Features.' },
    captions: [{ text: 'Features.', start_ms: 0, end_ms: 1500 }],
    layers: [
      { id: 'low_contrast', type: 'html', content: '<div style="background:#888888"><div style="color:#777777">Muddy text</div></div>' },
    ],
  },
  sc_close: { scene_id: 'sc_close', layers: [] },
};

describe('checkTextContrast', () => {
  const result = checkTextContrast(MANIFEST, SCENE_DEFS);

  it('fails low-contrast pairs with scene/layer references and a fix', () => {
    assert.equal(result.issues.length, 1);
    const issue = result.issues[0];
    assert.equal(issue.scene_id, 'sc_body');
    assert.equal(issue.layer_id, 'low_contrast');
    assert.equal(issue.wcag, '1.4.3');
    assert.match(issue.message, /below 4\.5:1/);
    assert.match(issue.suggestion, /low_contrast.*sc_body/);
  });

  it('passes high-contrast pairs (white on scene background)', () => {
    // headline: #ffffff on scene bg #0a0a14 ≈ 20:1 → checked, no issue.
    assert.ok(result.checked >= 2);
  });

  it('reports underivable pairs as unknown instead of passing them', () => {
    assert.ok(result.unknown.some(u => u.layer_id === 'mystery'));
  });
});

describe('checkCaptionsAndAutoplay', () => {
  it('fails narrated scenes without captions, listing them', () => {
    const { issues } = checkCaptionsAndAutoplay(MANIFEST, SCENE_DEFS, { audio_streams: null });
    const cap = issues.find(i => i.check === 'captions');
    assert.ok(cap);
    assert.deepEqual(cap.scene_ids, ['sc_hero']); // sc_body has captions
    assert.equal(cap.wcag, '1.2.2');
  });

  it('fails autoplay-muted when audio exists and zero cues anywhere', () => {
    const defs = structuredClone(SCENE_DEFS);
    delete defs.sc_body.captions;
    const { issues } = checkCaptionsAndAutoplay(MANIFEST, defs, { audio_streams: 1 });
    assert.ok(issues.some(i => i.check === 'autoplay_muted'));
  });

  it('passes when narration is fully captioned', () => {
    const defs = structuredClone(SCENE_DEFS);
    defs.sc_hero.captions = [{ text: 'Welcome.', start_ms: 0, end_ms: 1000 }];
    const { issues } = checkCaptionsAndAutoplay(MANIFEST, defs, { audio_streams: 1 });
    assert.equal(issues.length, 0);
  });
});

describe('checkMotionIntensity', () => {
  it('flags sustained intense camera scenes as advisory', () => {
    const { issues, intense_scenes } = checkMotionIntensity(MANIFEST, SCENE_DEFS);
    assert.deepEqual(intense_scenes, ['sc_hero']);
    const issue = issues.find(i => i.check === 'motion_intensity');
    assert.equal(issue.severity, 'warn');
    assert.match(issue.suggestion, /intensity/);
  });

  it('flags rapid cut cadence', () => {
    const choppy = { scenes: Array.from({ length: 12 }, (_, i) => ({ scene: `s${i}`, duration_s: 0.8 })) };
    const { issues } = checkMotionIntensity(choppy, {});
    assert.ok(issues.some(i => /cadence/i.test(i.message)));
  });
});

// ── The audit (offline, injectable exec) ────────────────────────────────────

describe('auditVideoAccessibility (static mode)', () => {
  it('aggregates static issues with ok=false and an actionable summary', async () => {
    const result = await auditVideoAccessibility({ manifest: MANIFEST, sceneDefs: SCENE_DEFS });
    assert.equal(result.ok, false); // contrast fail + captions fail
    assert.ok(result.issues.length >= 2);
    assert.match(result.checks.flashes.skipped, /video_path/);
    assert.match(result.summary, /failure/);
  });

  it('passes a clean sequence', async () => {
    const cleanDefs = {
      sc_a: {
        scene_id: 'sc_a',
        background: '#0a0a14',
        layers: [{ id: 't', type: 'html', content: '<div style="color:#ffffff">Hi</div>' }],
      },
    };
    const result = await auditVideoAccessibility({
      manifest: { scenes: [{ scene: 'sc_a', duration_s: 4 }] },
      sceneDefs: cleanDefs,
    });
    assert.equal(result.ok, true);
    assert.match(result.summary, /static checks only/);
  });

  it('rejects empty manifests', async () => {
    await assert.rejects(() => auditVideoAccessibility({ manifest: { scenes: [] } }), /requires a manifest/);
  });
});

// ── Frame layer against real ffmpeg (skip-gated) ────────────────────────────

describe('frame layer (real ffmpeg)', () => {
  let ffmpegOk = null;
  async function probe() {
    if (ffmpegOk == null) {
      try { await execFileAsync('ffmpeg', ['-version'], { timeout: 8_000 }); ffmpegOk = true; }
      catch { ffmpegOk = false; }
    }
    return ffmpegOk;
  }

  it('catches a known-bad 5Hz strobe video and passes a calm one', { timeout: 120_000 }, async (t) => {
    if (!(await probe())) return t.skip('ffmpeg not available');
    const dir = mkdtempSync(join(tmpdir(), 'ani-122-'));
    try {
      // Known-bad: full-frame luminance strobe at 5Hz for 3s.
      await execFileAsync('ffmpeg', ['-v', 'error', '-y',
        '-f', 'lavfi', '-i', 'nullsrc=s=160x90:d=3:r=10',
        '-vf', "geq=lum='if(mod(floor(T*10),2),235,16)':cb=128:cr=128",
        '-pix_fmt', 'yuv420p', join(dir, 'strobe.mp4')], { timeout: 60_000 });
      // Known-good: static dark frame.
      await execFileAsync('ffmpeg', ['-v', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=0x0a0a14:s=160x90:d=3:r=10',
        '-pix_fmt', 'yuv420p', join(dir, 'calm.mp4')], { timeout: 60_000 });

      const manifest = { scenes: [{ scene: 'sc_only', duration_s: 3 }] };
      const sceneDefs = { sc_only: { scene_id: 'sc_only', layers: [] } };

      const bad = await auditVideoAccessibility({ manifest, sceneDefs, video_path: join(dir, 'strobe.mp4') });
      assert.equal(bad.ok, false);
      const flash = bad.issues.find(i => i.check === 'flashes');
      assert.ok(flash, 'strobe video must produce a flash issue');
      assert.equal(flash.wcag, '2.3.1');
      assert.equal(flash.scene_id, 'sc_only');

      const good = await auditVideoAccessibility({ manifest, sceneDefs, video_path: join(dir, 'calm.mp4') });
      assert.equal(good.issues.some(i => i.check === 'flashes'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('decodeVideoFrames yields the expected frame count', { timeout: 60_000 }, async (t) => {
    if (!(await probe())) return t.skip('ffmpeg not available');
    const dir = mkdtempSync(join(tmpdir(), 'ani-122-'));
    try {
      await execFileAsync('ffmpeg', ['-v', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=black:s=160x90:d=2:r=10',
        '-pix_fmt', 'yuv420p', join(dir, 'two.mp4')], { timeout: 60_000 });
      const { frames, width, height } = await decodeVideoFrames(join(dir, 'two.mp4'));
      assert.ok(frames.length >= 18 && frames.length <= 22, `expected ~20 frames, got ${frames.length}`);
      assert.equal(frames[0].length, width * height * 4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
