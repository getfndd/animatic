/**
 * Tests for Guardrails Enforcement Engine (ANI-29).
 *
 * Covers: EASING_DECEL_PHASE constants, speed limits, acceleration,
 * jerk/settling, lens bounds, personality boundaries, manifest scene
 * validation, and full manifest validation.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/guardrails.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EASING_DECEL_PHASE,
  validateCameraMove,
  validateManifestScene,
  validateFullManifest,
} from '../lib/guardrails.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCamera(move, intensity = 0.5, easing = 'cinematic_scurve') {
  return { move, intensity, easing };
}

function makeManifestScene(sceneId, duration_s, opts = {}) {
  return {
    scene: sceneId,
    duration_s,
    ...(opts.camera_override ? { camera_override: opts.camera_override } : {}),
    ...(opts.shot_grammar ? { shot_grammar: opts.shot_grammar } : {}),
    ...(opts.transition_in ? { transition_in: opts.transition_in } : {}),
  };
}

function makeManifest(scenes) {
  return {
    sequence_id: 'seq_test',
    fps: 60,
    scenes,
  };
}

// ── EASING_DECEL_PHASE constants ────────────────────────────────────────────

describe('EASING_DECEL_PHASE', () => {
  it('linear has 0% deceleration', () => {
    assert.equal(EASING_DECEL_PHASE.linear, 0.0);
  });

  it('ease_out has 60% deceleration', () => {
    assert.equal(EASING_DECEL_PHASE.ease_out, 0.60);
  });

  it('cinematic_scurve has 50% deceleration', () => {
    assert.equal(EASING_DECEL_PHASE.cinematic_scurve, 0.50);
  });
});

// ── Check 1: Speed limits ───────────────────────────────────────────────────

describe('validateCameraMove — speed limits', () => {
  it('static camera passes all checks', () => {
    const result = validateCameraMove({ move: 'static' }, null, 3, 'cinematic-dark');
    assert.equal(result.verdict, 'PASS');
    assert.equal(result.blocks.length, 0);
    assert.equal(result.warnings.length, 0);
  });

  it('null camera passes all checks', () => {
    const result = validateCameraMove(null, null, 3, 'cinematic-dark');
    assert.equal(result.verdict, 'PASS');
  });

  it('pan at moderate intensity/duration passes speed limit', () => {
    // intensity=0.5, PAN_MAX_PX=80, duration=3s → velocity = 40/3 ≈ 13.3 px/s (limit 400)
    const result = validateCameraMove(makeCamera('pan_left', 0.5), null, 3, 'cinematic-dark');
    const speedWarnings = result.warnings.filter(w => w.check === 'speed_limit');
    assert.equal(speedWarnings.length, 0);
  });

  it('pan at high intensity/short duration warns on speed', () => {
    // intensity=1.0, PAN_MAX_PX=80, duration=0.1s → velocity = 80/0.1 = 800 px/s (limit 400)
    const result = validateCameraMove(makeCamera('pan_right', 1.0), null, 0.1, 'cinematic-dark');
    const speedWarnings = result.warnings.filter(w => w.check === 'speed_limit');
    assert.equal(speedWarnings.length, 1);
    assert.ok(speedWarnings[0].value > 400);
  });

  it('push_in at moderate intensity/duration passes speed limit', () => {
    // intensity=0.5, SCALE_FACTOR=0.08, duration=3s → 4%/3s ≈ 1.33 %/s (limit 0.5)
    // Wait: 0.5 * 0.08 * 100 = 4, / 3 = 1.33 — that exceeds 0.5!
    // Actually let's use a longer duration. intensity=0.3, duration=5s → 0.3*0.08*100/5 = 0.48
    const result = validateCameraMove(makeCamera('push_in', 0.3), null, 5, 'cinematic-dark');
    const speedWarnings = result.warnings.filter(w => w.check === 'speed_limit');
    assert.equal(speedWarnings.length, 0);
  });

  it('push_in at high intensity/short duration warns on speed', () => {
    // intensity=1.0, SCALE_FACTOR=0.08, duration=0.5s → 8%/0.5s = 16 %/s (limit 0.5)
    const result = validateCameraMove(makeCamera('push_in', 1.0), null, 0.5, 'cinematic-dark');
    const speedWarnings = result.warnings.filter(w => w.check === 'speed_limit');
    assert.equal(speedWarnings.length, 1);
    assert.ok(speedWarnings[0].value > 0.5);
  });

  it('drift at long duration passes speed limit', () => {
    // intensity=0.5, DRIFT_AMPLITUDE=3, duration=3s → peak = 3*0.5*2π/3 ≈ 3.14 px/s (limit 400)
    const result = validateCameraMove(makeCamera('drift', 0.5), null, 3, 'cinematic-dark');
    const speedWarnings = result.warnings.filter(w => w.check === 'speed_limit');
    assert.equal(speedWarnings.length, 0);
  });

  it('drift at very short duration warns on speed', () => {
    // intensity=1.0, DRIFT_AMPLITUDE=3, duration=0.01s → peak = 3*2π/0.01 ≈ 1885 px/s
    const result = validateCameraMove(makeCamera('drift', 1.0), null, 0.01, 'cinematic-dark');
    const speedWarnings = result.warnings.filter(w => w.check === 'speed_limit');
    assert.equal(speedWarnings.length, 1);
  });
});

// ── Check 2: Acceleration — easing deceleration ─────────────────────────────

describe('validateCameraMove — acceleration', () => {
  it('linear easing warns on deceleration phase', () => {
    const result = validateCameraMove(makeCamera('pan_left', 0.5, 'linear'), null, 3, 'cinematic-dark');
    const accelWarnings = result.warnings.filter(w => w.check === 'acceleration');
    assert.equal(accelWarnings.length, 1);
    assert.ok(accelWarnings[0].message.includes('linear'));
  });

  it('ease_out passes deceleration check', () => {
    const result = validateCameraMove(makeCamera('pan_left', 0.3, 'ease_out'), null, 5, 'cinematic-dark');
    const accelWarnings = result.warnings.filter(w => w.check === 'acceleration');
    assert.equal(accelWarnings.length, 0);
  });

  it('cinematic_scurve passes deceleration check', () => {
    const result = validateCameraMove(makeCamera('pan_left', 0.3, 'cinematic_scurve'), null, 5, 'cinematic-dark');
    const accelWarnings = result.warnings.filter(w => w.check === 'acceleration');
    assert.equal(accelWarnings.length, 0);
  });
});

// ── Check 3: Jerk / settling ────────────────────────────────────────────────

describe('validateCameraMove — jerk/settling', () => {
  it('drift at 3s duration passes settling check (1500ms reversal > 200ms)', () => {
    const result = validateCameraMove(makeCamera('drift', 0.5), null, 3, 'cinematic-dark');
    const jerkWarnings = result.warnings.filter(w => w.check === 'jerk');
    assert.equal(jerkWarnings.length, 0);
  });

  it('drift at 0.3s duration warns on settling (150ms reversal < 200ms)', () => {
    const result = validateCameraMove(makeCamera('drift', 0.5), null, 0.3, 'cinematic-dark');
    const jerkWarnings = result.warnings.filter(w => w.check === 'jerk');
    assert.equal(jerkWarnings.length, 1);
    assert.ok(jerkWarnings[0].value < 200);
  });

  it('non-drift moves skip jerk check', () => {
    const result = validateCameraMove(makeCamera('pan_left', 0.3), null, 0.3, 'cinematic-dark');
    const jerkWarnings = result.warnings.filter(w => w.check === 'jerk');
    assert.equal(jerkWarnings.length, 0);
  });
});

// ── Check 4: Lens bounds ────────────────────────────────────────────────────

describe('validateCameraMove — lens bounds', () => {
  it('push_in at intensity 0.5 passes lens bounds (scale 1.04)', () => {
    // 1 + 0.5 * 0.08 = 1.04, within [0.95, 1.05]
    const result = validateCameraMove(makeCamera('push_in', 0.5), null, 3, 'cinematic-dark');
    const lensWarnings = result.warnings.filter(w => w.check === 'lens_bounds');
    assert.equal(lensWarnings.length, 0);
  });

  it('push_in at intensity 1.0 warns on lens bounds (scale 1.08)', () => {
    // 1 + 1.0 * 0.08 = 1.08, exceeds max 1.05
    const result = validateCameraMove(makeCamera('push_in', 1.0), null, 3, 'cinematic-dark');
    const lensWarnings = result.warnings.filter(w => w.check === 'lens_bounds');
    assert.equal(lensWarnings.length, 1);
    assert.ok(lensWarnings[0].value > 1.05);
  });

  it('shot grammar rotation within bounds passes', () => {
    // Dutch angle = 3deg rotateZ, well within [-20, 20]
    const result = validateCameraMove(
      makeCamera('pan_left', 0.3), { angle: 'dutch' }, 5, 'cinematic-dark'
    );
    const lensWarnings = result.warnings.filter(w => w.check === 'lens_bounds');
    assert.equal(lensWarnings.length, 0);
  });

  it('standard angles stay within rotation bounds', () => {
    // high angle = 3deg rotateX, low = -2deg rotateX — both in [-20, 20]
    for (const angle of ['high', 'low', 'dutch', 'eye_level']) {
      const result = validateCameraMove(
        makeCamera('pan_left', 0.3), { angle }, 5, 'cinematic-dark'
      );
      const lensWarnings = result.warnings.filter(w => w.check === 'lens_bounds');
      assert.equal(lensWarnings.length, 0, `${angle} should pass`);
    }
  });
});

// ── Check 5: Personality boundaries ─────────────────────────────────────────

describe('validateCameraMove — personality boundaries', () => {
  it('editorial: warns on translation exceeding max_translateXY', () => {
    // editorial max_translateXY = 30. pan intensity 0.5 → 40px → exceeds
    const result = validateCameraMove(makeCamera('pan_left', 0.5), null, 5, 'editorial');
    const persWarnings = result.warnings.filter(w => w.check === 'personality' && w.message.includes('Translation'));
    assert.equal(persWarnings.length, 1);
  });

  it('editorial: warns on scale change exceeding max_scale_change_percent', () => {
    // editorial max_scale_change_percent = 1. push_in intensity 0.5 → 0.5*0.08*100 = 4% → exceeds
    const result = validateCameraMove(makeCamera('push_in', 0.5), null, 5, 'editorial');
    const persWarnings = result.warnings.filter(w => w.check === 'personality' && w.message.includes('Scale'));
    assert.equal(persWarnings.length, 1);
  });

  it('neutral-light: blocks camera movement', () => {
    const result = validateCameraMove(makeCamera('pan_left', 0.3), null, 5, 'neutral-light');
    assert.equal(result.verdict, 'BLOCK');
    const cameraBlocks = result.blocks.filter(b => b.feature === 'camera_movement');
    assert.equal(cameraBlocks.length, 1);
  });

  it('neutral-light: ambient drift allowed for scenes >10s', () => {
    // neutral-light forbids camera_movement but also checks ambient condition
    // Drift will still be BLOCKED by camera_movement forbidden feature
    // But ambient condition check is separate
    const result = validateCameraMove(makeCamera('drift', 0.01), null, 15, 'neutral-light');
    // camera_movement is forbidden, so drift gets blocked
    assert.equal(result.verdict, 'BLOCK');
  });

  it('neutral-light: ambient drift warns for scenes ≤10s', () => {
    const result = validateCameraMove(makeCamera('drift', 0.01), null, 5, 'neutral-light');
    // Both BLOCK (camera_movement) and WARN (ambient_condition) should fire
    assert.equal(result.verdict, 'BLOCK');
    const ambientWarnings = result.warnings.filter(w => w.message.includes('only allowed'));
    assert.equal(ambientWarnings.length, 1);
  });

  it('montage: blocks drift (ambient_motion forbidden)', () => {
    const result = validateCameraMove(makeCamera('drift', 0.3), null, 3, 'montage');
    assert.equal(result.verdict, 'BLOCK');
    const driftBlocks = result.blocks.filter(b => b.feature === 'ambient_motion' || b.feature === 'ambient_condition');
    assert.ok(driftBlocks.length >= 1);
  });

  it('montage: blocks 3D transforms in shot grammar', () => {
    const result = validateCameraMove(
      null, { angle: 'high' }, 3, 'montage'
    );
    // high angle = 3deg rotateX → blocked by 3d_transforms
    // But camera is null/static, so only personality check 3d fires
    const blocks3d = result.blocks.filter(b => b.feature === '3d_transforms');
    assert.equal(blocks3d.length, 1);
  });

  it('cinematic-dark: allows all camera moves', () => {
    // cinematic-dark has no personality_boundaries entry, so nothing is forbidden
    const result = validateCameraMove(
      makeCamera('pan_left', 0.3),
      { shot_size: 'close_up', angle: 'dutch' },
      5,
      'cinematic-dark'
    );
    const persBlocks = result.blocks.filter(b => b.check === 'personality');
    assert.equal(persBlocks.length, 0);
  });
});

// ── validateManifestScene ───────────────────────────────────────────────────

describe('validateManifestScene', () => {
  it('valid static scene passes', () => {
    const entry = makeManifestScene('sc_hero', 3);
    const result = validateManifestScene(entry, 'cinematic-dark', 0);
    assert.equal(result.verdict, 'PASS');
    assert.equal(result.sceneIndex, 0);
  });

  it('aggressive camera warns', () => {
    const entry = makeManifestScene('sc_hero', 0.5, {
      camera_override: { move: 'push_in', intensity: 1.0, easing: 'linear' },
    });
    const result = validateManifestScene(entry, 'cinematic-dark', 1);
    assert.equal(result.verdict, 'WARN');
    assert.ok(result.warnings.length > 0);
    assert.equal(result.sceneIndex, 1);
  });

  it('missing camera defaults to static (passes)', () => {
    const entry = makeManifestScene('sc_hero', 3);
    const result = validateManifestScene(entry, 'editorial', 0);
    assert.equal(result.verdict, 'PASS');
  });
});

// ── validateFullManifest ────────────────────────────────────────────────────

describe('validateFullManifest', () => {
  it('all-static manifest passes', () => {
    const manifest = makeManifest([
      makeManifestScene('sc_a', 3),
      makeManifestScene('sc_b', 3),
      makeManifestScene('sc_c', 3),
    ]);
    const result = validateFullManifest(manifest, 'cinematic-dark');
    assert.equal(result.verdict, 'PASS');
    assert.equal(result.sceneResults.length, 3);
  });

  it('mixed manifest with one violation returns WARN', () => {
    const manifest = makeManifest([
      makeManifestScene('sc_a', 3),
      makeManifestScene('sc_b', 0.5, {
        camera_override: { move: 'push_in', intensity: 1.0, easing: 'linear' },
      }),
      makeManifestScene('sc_c', 3),
    ]);
    const result = validateFullManifest(manifest, 'cinematic-dark');
    assert.equal(result.verdict, 'WARN');
    assert.equal(result.sceneResults[1].verdict, 'WARN');
  });

  it('manifest with blocked scene returns BLOCK', () => {
    const manifest = makeManifest([
      makeManifestScene('sc_a', 3, {
        camera_override: { move: 'pan_left', intensity: 0.3 },
      }),
    ]);
    const result = validateFullManifest(manifest, 'neutral-light');
    assert.equal(result.verdict, 'BLOCK');
  });

  it('warns on >2 consecutive linear easings', () => {
    const manifest = makeManifest([
      makeManifestScene('sc_a', 3, { camera_override: { move: 'pan_left', intensity: 0.1, easing: 'linear' } }),
      makeManifestScene('sc_b', 3, { camera_override: { move: 'pan_right', intensity: 0.1, easing: 'linear' } }),
      makeManifestScene('sc_c', 3, { camera_override: { move: 'pan_left', intensity: 0.1, easing: 'linear' } }),
    ]);
    const result = validateFullManifest(manifest, 'cinematic-dark');
    assert.ok(result.cumulativeFindings.length > 0);
    const linearFindings = result.cumulativeFindings.filter(f => f.check === 'consecutive_linear');
    assert.ok(linearFindings.length > 0);
  });

  it('2 consecutive linear easings does not trigger cumulative warning', () => {
    const manifest = makeManifest([
      makeManifestScene('sc_a', 3, { camera_override: { move: 'pan_left', intensity: 0.1, easing: 'linear' } }),
      makeManifestScene('sc_b', 3, { camera_override: { move: 'pan_right', intensity: 0.1, easing: 'linear' } }),
      makeManifestScene('sc_c', 3, { camera_override: { move: 'pan_left', intensity: 0.1, easing: 'ease_out' } }),
    ]);
    const result = validateFullManifest(manifest, 'cinematic-dark');
    const linearFindings = result.cumulativeFindings.filter(f => f.check === 'consecutive_linear');
    assert.equal(linearFindings.length, 0);
  });
});
