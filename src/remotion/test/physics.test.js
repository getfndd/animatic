import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp, mix, easeOutCubic, easeInOutCubic, easeOutBack,
  springStep, springSettled, smoothStep,
  pickPopScale, pickPopOffsetY,
} from '../physics/spring.js';

import {
  DEFAULTS,
  worldYForZ, opacityForZ, tiltForZ, speedMultiplierForZ,
  computeCardVisuals, createInit, createStep,
} from '../physics/card-conveyor.js';

// ── Spring primitives ───────────────────────────────────────────

describe('spring primitives', () => {
  it('clamp constrains values', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(15, 0, 10), 10);
  });

  it('mix interpolates linearly', () => {
    assert.equal(mix(0, 10, 0), 0);
    assert.equal(mix(0, 10, 0.5), 5);
    assert.equal(mix(0, 10, 1), 10);
  });

  it('easing functions return 0 at t=0 and 1 at t=1', () => {
    for (const fn of [easeOutCubic, easeInOutCubic]) {
      assert.ok(Math.abs(fn(0)) < 0.001, `${fn.name}(0) should be ~0`);
      assert.ok(Math.abs(fn(1) - 1) < 0.001, `${fn.name}(1) should be ~1`);
    }
  });

  it('easeOutBack overshoots past 1.0 mid-animation', () => {
    const mid = easeOutBack(0.7);
    assert.ok(mid > 1.0, `easeOutBack(0.7) = ${mid} should overshoot`);
    assert.ok(Math.abs(easeOutBack(1) - 1) < 0.001);
  });

  it('damped spring converges to target', () => {
    let pos = 0, vel = 0;
    const target = 100;
    for (let i = 0; i < 300; i++) {
      ({ position: pos, velocity: vel } = springStep(pos, vel, target, 300, 30, 1 / 60));
    }
    assert.ok(springSettled(pos, vel, target, 0.1), `spring should settle: pos=${pos}, vel=${vel}`);
  });

  it('smoothStep converges to target', () => {
    let val = 0;
    for (let i = 0; i < 100; i++) {
      val = smoothStep(val, 10, 10, 1 / 60);
    }
    assert.ok(Math.abs(val - 10) < 0.01, `smoothStep should converge: ${val}`);
  });

  it('pickPopScale follows squeeze → overshoot → settle', () => {
    const start = pickPopScale(0);
    const squeeze = pickPopScale(0.16);
    const overshoot = pickPopScale(0.5);
    const end = pickPopScale(1);

    assert.ok(Math.abs(start - 1) < 0.001, 'starts at 1');
    assert.ok(squeeze < 1, `squeeze phase: ${squeeze} < 1`);
    assert.ok(overshoot > 1, `overshoot phase: ${overshoot} > 1`);
    assert.ok(Math.abs(end - 1) < 0.001, `settles to 1: ${end}`);
  });
});

// ── Card conveyor world functions ───────────────────────────────

describe('card conveyor world functions', () => {
  it('worldYForZ maps far → backY, front → frontY', () => {
    const backY = worldYForZ(DEFAULTS.farZ);
    const frontY = worldYForZ(DEFAULTS.frontZ);
    assert.ok(Math.abs(backY - DEFAULTS.backY) < 1, `backY: ${backY}`);
    assert.ok(Math.abs(frontY - DEFAULTS.frontY) < 1, `frontY: ${frontY}`);
  });

  it('opacityForZ is 1 at front, 0 at exit', () => {
    assert.equal(opacityForZ(DEFAULTS.frontZ), 1);
    assert.equal(opacityForZ(DEFAULTS.exitZ), 0);
    assert.equal(opacityForZ(DEFAULTS.farZ), 1);
  });

  it('tiltForZ is 0 at front, negative at exit', () => {
    assert.equal(tiltForZ(DEFAULTS.frontZ), 0);
    assert.ok(tiltForZ(DEFAULTS.exitZ) < 0, `tilt at exit: ${tiltForZ(DEFAULTS.exitZ)}`);
    assert.equal(tiltForZ(DEFAULTS.farZ), 0);
  });

  it('speedMultiplierForZ is continuous (no discontinuities)', () => {
    const points = [-1500, -900, -420, -120, 0, 260];
    for (let i = 0; i < points.length - 1; i++) {
      const a = speedMultiplierForZ(points[i]);
      const b = speedMultiplierForZ(points[i] + 0.01);
      const diff = Math.abs(b - a);
      assert.ok(diff < 0.1, `discontinuity at z=${points[i]}: ${a} → ${b}`);
    }
  });

  it('speedMultiplierForZ increases from back to front', () => {
    const back = speedMultiplierForZ(-1500);
    const mid = speedMultiplierForZ(-300);
    const front = speedMultiplierForZ(0);
    assert.ok(back < mid, `back ${back} < mid ${mid}`);
    assert.ok(mid < front, `mid ${mid} < front ${front}`);
  });
});

// ── Simulation determinism ──────────────────────────────────────

describe('card conveyor simulation', () => {
  const CONTENT_COUNT = 8;
  const FPS = 60;
  const FRAMES = 300; // 5 seconds

  function runSimulation() {
    const init = createInit(CONTENT_COUNT);
    const step = createStep();
    const dt = 1 / FPS;

    let state = init(FPS);
    const snapshots = [JSON.parse(JSON.stringify(state))];

    for (let f = 1; f <= FRAMES; f++) {
      state = step(state, dt, f);
      snapshots.push(JSON.parse(JSON.stringify(state)));
    }

    return snapshots;
  }

  it('produces identical output on repeated runs (determinism)', () => {
    const run1 = runSimulation();
    const run2 = runSimulation();

    assert.equal(run1.length, run2.length);

    for (let f = 0; f < run1.length; f++) {
      assert.deepStrictEqual(
        run1[f].cards.length,
        run2[f].cards.length,
        `frame ${f}: card count mismatch`
      );
      assert.equal(run1[f].phase, run2[f].phase, `frame ${f}: phase mismatch`);

      for (let c = 0; c < run1[f].cards.length; c++) {
        const c1 = run1[f].cards[c];
        const c2 = run2[f].cards[c];
        assert.ok(
          Math.abs(c1.z - c2.z) < 0.001,
          `frame ${f}, card ${c}: z mismatch ${c1.z} vs ${c2.z}`
        );
      }
    }
  });

  it('transitions through all phases: intro → loop → outro → hold', () => {
    const snapshots = runSimulation();
    const phases = snapshots.map((s) => s.phase);

    assert.ok(phases.includes('intro'), 'should have intro phase');
    assert.ok(phases.includes('loop'), 'should have loop phase');
    assert.ok(phases.includes('outro'), 'should have outro phase');
    assert.ok(phases.includes('hold'), 'should have hold phase');

    // Phases should occur in order
    const firstLoop = phases.indexOf('loop');
    const firstOutro = phases.indexOf('outro');
    const firstHold = phases.indexOf('hold');
    assert.ok(firstLoop > 0, 'loop after intro');
    assert.ok(firstOutro > firstLoop, 'outro after loop');
    assert.ok(firstHold > firstOutro, 'hold after outro');
  });

  it('reaches steady card count during intro', () => {
    const snapshots = runSimulation();
    const introEnd = snapshots.findIndex((s) => s.phase === 'loop');
    assert.ok(introEnd > 0);
    assert.equal(
      snapshots[introEnd].cards.length,
      DEFAULTS.steadyCardCount,
      `should have ${DEFAULTS.steadyCardCount} cards at loop start`
    );
  });

  it('drains to selectRemainingCount during outro', () => {
    const snapshots = runSimulation();
    const holdStart = snapshots.findIndex((s) => s.phase === 'hold');
    assert.ok(holdStart > 0);
    assert.ok(
      snapshots[holdStart].cards.length <= DEFAULTS.selectRemainingCount,
      `should have <= ${DEFAULTS.selectRemainingCount} cards at hold`
    );
  });

  it('selects a target card during hold', () => {
    const snapshots = runSimulation();
    const holdState = snapshots.find((s) => s.phase === 'hold');
    assert.ok(holdState, 'should reach hold phase');
    assert.ok(holdState.targetCardId !== null, 'should have a target card');
  });

  it('content indices stay within bounds', () => {
    const snapshots = runSimulation();
    for (const snap of snapshots) {
      for (const card of snap.cards) {
        assert.ok(
          card.contentIndex >= 0 && card.contentIndex < CONTENT_COUNT,
          `contentIndex ${card.contentIndex} out of bounds`
        );
      }
    }
  });

  it('computeCardVisuals returns valid properties', () => {
    const snapshots = runSimulation();
    // Check a frame during hold
    const holdState = snapshots.find((s) => s.phase === 'hold');
    if (holdState) {
      for (const card of holdState.cards) {
        const vis = computeCardVisuals(card, holdState);
        assert.ok(typeof vis.y === 'number', 'y is number');
        assert.ok(typeof vis.z === 'number', 'z is number');
        assert.ok(vis.opacity >= 0 && vis.opacity <= 1, `opacity in range: ${vis.opacity}`);
        assert.ok(typeof vis.shellScale === 'number', 'shellScale is number');
        assert.ok(typeof vis.isPicked === 'boolean', 'isPicked is boolean');
      }
    }
  });
});
