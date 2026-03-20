/**
 * Tests for position parameters and enhanced stagger distribution.
 *
 * Position parameters: GSAP-inspired "<", ">", "label+offset" syntax
 * Stagger enhancements: from patterns, amount_ms, stagger ease
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compileMotion } from '../lib/compiler.js';
import { resolveEntrancePrimitive } from '../../src/remotion/lib.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScene(motionGroups, opts = {}) {
  const layers = [];
  const ids = new Set();
  for (const g of motionGroups) {
    for (const t of g.targets || []) {
      if (!ids.has(t)) {
        ids.add(t);
        layers.push({ id: t, type: 'html', depth_class: 'foreground' });
      }
    }
  }
  return {
    scene_id: opts.scene_id || 'test_scene',
    format_version: 2,
    duration_s: opts.duration_s || 5,
    camera: { move: 'static' },
    layers,
    motion: { groups: motionGroups },
  };
}

function firstFrame(timeline, layerId, prop = 'opacity') {
  return timeline.tracks.layers[layerId]?.[prop]?.[0]?.frame;
}

// ── Position Parameters ──────────────────────────────────────────────────────

describe('Position parameters', () => {
  it('">" positions group at previous group end', () => {
    const scene = makeScene([
      {
        targets: ['a'],
        primitive: 'fade-in',
      },
      {
        targets: ['b'],
        primitive: 'fade-in',
        position: '>',
      },
    ]);

    const tl = compileMotion(scene);
    const aStart = firstFrame(tl, 'a');
    const bStart = firstFrame(tl, 'b');

    // fade-in is 400ms at 60fps = 24 frames. "b" should start at frame 24.
    const prim = resolveEntrancePrimitive('fade-in');
    const expectedEnd = Math.round((prim.durationMs / 1000) * 60);

    assert.equal(aStart, 0, 'a starts at 0');
    assert.equal(bStart, expectedEnd, `b starts at previous end (frame ${expectedEnd})`);
  });

  it('"<" positions group at previous group start', () => {
    const scene = makeScene([
      {
        targets: ['a'],
        primitive: 'fade-in',
        delay_after_hero_ms: 500,
      },
      {
        targets: ['b'],
        primitive: 'fade-in',
        position: '<',
      },
    ]);

    const tl = compileMotion(scene);
    const aStart = firstFrame(tl, 'a');
    const bStart = firstFrame(tl, 'b');

    assert.equal(aStart, 30, 'a starts at frame 30 (500ms)');
    assert.equal(bStart, 30, 'b starts at same frame as a');
  });

  it('">200" adds 200ms offset from previous end', () => {
    const scene = makeScene([
      {
        targets: ['a'],
        primitive: 'fade-in',
      },
      {
        targets: ['b'],
        primitive: 'fade-in',
        position: '>200',
      },
    ]);

    const tl = compileMotion(scene);
    const bStart = firstFrame(tl, 'b');

    const prim = resolveEntrancePrimitive('fade-in');
    const prevEnd = Math.round((prim.durationMs / 1000) * 60);
    const offset = Math.round((200 / 1000) * 60); // 12 frames

    assert.equal(bStart, prevEnd + offset, `b starts at prev end + 200ms`);
  });

  it('">-200" creates overlap (starts before previous end)', () => {
    const scene = makeScene([
      {
        targets: ['a'],
        primitive: 'fade-in',
      },
      {
        targets: ['b'],
        primitive: 'fade-in',
        position: '>-200',
      },
    ]);

    const tl = compileMotion(scene);
    const bStart = firstFrame(tl, 'b');

    const prim = resolveEntrancePrimitive('fade-in');
    const prevEnd = Math.round((prim.durationMs / 1000) * 60);
    const offset = Math.round((-200 / 1000) * 60); // -12 frames

    assert.equal(bStart, prevEnd + offset, `b overlaps by 200ms`);
  });

  it('"<200" adds offset from previous start', () => {
    const scene = makeScene([
      {
        targets: ['a'],
        primitive: 'fade-in',
      },
      {
        targets: ['b'],
        primitive: 'fade-in',
        position: '<200',
      },
    ]);

    const tl = compileMotion(scene);
    const bStart = firstFrame(tl, 'b');

    assert.equal(bStart, 12, 'b starts at 200ms from prev start (frame 12)');
  });

  it('named cue position: "panel_open"', () => {
    const scene = makeScene([
      {
        targets: ['panel'],
        primitive: 'fade-in',
        on_complete: { emit: 'panel_open' },
      },
      {
        targets: ['content'],
        primitive: 'fade-in',
        position: 'panel_open',
      },
    ]);

    const tl = compileMotion(scene);
    const panelStart = firstFrame(tl, 'panel');
    const contentStart = firstFrame(tl, 'content');

    assert.equal(panelStart, 0, 'panel starts at 0');
    assert.ok(contentStart > 0, 'content starts after panel completes');
  });

  it('named cue with offset: "panel_open+300"', () => {
    const scene = makeScene([
      {
        targets: ['panel'],
        primitive: 'fade-in',
        on_complete: { emit: 'panel_open' },
      },
      {
        targets: ['content'],
        primitive: 'fade-in',
        position: 'panel_open+300',
      },
    ]);

    const tl = compileMotion(scene);
    const contentStart = firstFrame(tl, 'content');

    const prim = resolveEntrancePrimitive('fade-in');
    const cueFrame = Math.round((prim.durationMs / 1000) * 60);
    const offset = Math.round((300 / 1000) * 60);

    assert.equal(contentStart, cueFrame + offset, 'content starts at cue + 300ms');
  });

  it('three-group chain: a → b(">") → c(">-100")', () => {
    const scene = makeScene([
      { targets: ['a'], primitive: 'fade-in' },
      { targets: ['b'], primitive: 'fade-in', position: '>' },
      { targets: ['c'], primitive: 'fade-in', position: '>-100' },
    ]);

    const tl = compileMotion(scene);
    const aStart = firstFrame(tl, 'a');
    const bStart = firstFrame(tl, 'b');
    const cStart = firstFrame(tl, 'c');

    assert.equal(aStart, 0);
    assert.ok(bStart > aStart, 'b after a');
    // c should overlap b's end by 100ms
    const prim = resolveEntrancePrimitive('fade-in');
    const primFrames = Math.round((prim.durationMs / 1000) * 60);
    const bEnd = bStart + primFrames;
    const overlap = Math.round((100 / 1000) * 60);
    assert.equal(cStart, bEnd - overlap, 'c overlaps b by 100ms');
  });

  it('position clamps to 0 (never negative start frame)', () => {
    const scene = makeScene([
      { targets: ['a'], primitive: 'fade-in' },
      { targets: ['b'], primitive: 'fade-in', position: '<-9999' },
    ]);

    const tl = compileMotion(scene);
    const bStart = firstFrame(tl, 'b');

    assert.equal(bStart, 0, 'negative clamped to 0');
  });

  it('legacy delay.after still works alongside position', () => {
    const scene = makeScene([
      {
        targets: ['a'],
        primitive: 'fade-in',
        on_complete: { emit: 'a_done' },
      },
      {
        targets: ['b'],
        primitive: 'fade-in',
        delay: { after: 'a_done', offset_ms: 100 },
      },
    ]);

    const tl = compileMotion(scene);
    const bStart = firstFrame(tl, 'b');

    assert.ok(bStart > 0, 'legacy delay.after still resolves');
  });
});

// ── Enhanced Stagger Distribution ────────────────────────────────────────────

describe('Stagger distribution — from patterns', () => {
  it('from: "edges" animates outer elements first', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b', 'c', 'd', 'e'],
        primitive: 'fade-in',
        stagger: { interval_ms: 100, from: 'edges' },
      },
    ]);

    const tl = compileMotion(scene);
    const aStart = firstFrame(tl, 'a');
    const cStart = firstFrame(tl, 'c');
    const eStart = firstFrame(tl, 'e');

    // Edges-in: a and e are first pair, c is last (center)
    assert.ok(aStart <= cStart, 'edge element a starts before center c');
    assert.ok(eStart <= cStart, 'edge element e starts before center c');
  });

  it('from: "center" animates middle element first', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b', 'c', 'd', 'e'],
        primitive: 'fade-in',
        stagger: { interval_ms: 100, from: 'center' },
      },
    ]);

    const tl = compileMotion(scene);
    const aStart = firstFrame(tl, 'a');
    const cStart = firstFrame(tl, 'c');

    assert.ok(cStart < aStart, 'center element c starts before edge element a');
  });

  it('from: <number> animates from that index outward', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b', 'c', 'd', 'e'],
        primitive: 'fade-in',
        stagger: { interval_ms: 100, from: 1 },
      },
    ]);

    const tl = compileMotion(scene);
    const aStart = firstFrame(tl, 'a');
    const bStart = firstFrame(tl, 'b');
    const eStart = firstFrame(tl, 'e');

    // b is at index 1, so it's first
    assert.ok(bStart <= aStart, 'from-index element b starts first');
    assert.ok(eStart > bStart, 'far element e starts later');
  });
});

describe('Stagger distribution — amount_ms', () => {
  it('amount_ms distributes total time across all elements', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b', 'c', 'd'],
        primitive: 'fade-in',
        stagger: { amount_ms: 600 },
      },
    ]);

    const tl = compileMotion(scene);
    const aStart = firstFrame(tl, 'a');
    const dStart = firstFrame(tl, 'd');

    // 600ms total at 60fps = 36 frames span
    assert.equal(aStart, 0, 'first element at 0');
    assert.equal(dStart, 36, 'last element at 600ms (36 frames)');
  });

  it('amount_ms with 2 elements = full gap', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b'],
        primitive: 'fade-in',
        stagger: { amount_ms: 300 },
      },
    ]);

    const tl = compileMotion(scene);
    const bStart = firstFrame(tl, 'b');

    assert.equal(bStart, 18, 'b starts at 300ms (18 frames)');
  });
});

describe('Stagger distribution — ease', () => {
  it('power2_in bunches elements at the start', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b', 'c', 'd', 'e'],
        primitive: 'fade-in',
        stagger: { amount_ms: 1000, ease: 'power2_in' },
      },
    ]);

    const tl = compileMotion(scene);
    const starts = ['a', 'b', 'c', 'd', 'e'].map(id => firstFrame(tl, id));

    // With power2_in (t^3), early elements should be closer together
    const gap01 = starts[1] - starts[0]; // small gap
    const gap34 = starts[4] - starts[3]; // large gap

    assert.ok(gap01 < gap34, `early gap (${gap01}) < late gap (${gap34}) with power2_in`);
  });

  it('power2_out spreads elements at the start', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b', 'c', 'd', 'e'],
        primitive: 'fade-in',
        stagger: { amount_ms: 1000, ease: 'power2_out' },
      },
    ]);

    const tl = compileMotion(scene);
    const starts = ['a', 'b', 'c', 'd', 'e'].map(id => firstFrame(tl, id));

    const gap01 = starts[1] - starts[0]; // large gap
    const gap34 = starts[4] - starts[3]; // small gap

    assert.ok(gap01 > gap34, `early gap (${gap01}) > late gap (${gap34}) with power2_out`);
  });

  it('linear ease produces even spacing', () => {
    const scene = makeScene([
      {
        targets: ['a', 'b', 'c', 'd', 'e'],
        primitive: 'fade-in',
        stagger: { amount_ms: 1000, ease: 'linear' },
      },
    ]);

    const tl = compileMotion(scene);
    const starts = ['a', 'b', 'c', 'd', 'e'].map(id => firstFrame(tl, id));

    // All gaps should be equal (within rounding)
    const gap01 = starts[1] - starts[0];
    const gap12 = starts[2] - starts[1];
    const gap23 = starts[3] - starts[2];
    const gap34 = starts[4] - starts[3];

    assert.ok(Math.abs(gap01 - gap12) <= 1, 'gaps are uniform (0→1 vs 1→2)');
    assert.ok(Math.abs(gap23 - gap34) <= 1, 'gaps are uniform (2→3 vs 3→4)');
  });
});

// ── Combined: Position + Stagger ─────────────────────────────────────────────

describe('Position + stagger combined', () => {
  it('stagger group with position ">" chains after previous', () => {
    const scene = makeScene([
      {
        targets: ['title'],
        primitive: 'fade-in',
      },
      {
        targets: ['bar1', 'bar2', 'bar3'],
        primitive: 'fade-in',
        position: '>',
        stagger: { interval_ms: 100, from: 'start' },
      },
    ]);

    const tl = compileMotion(scene);
    const titleStart = firstFrame(tl, 'title');
    const bar1Start = firstFrame(tl, 'bar1');
    const bar3Start = firstFrame(tl, 'bar3');

    const prim = resolveEntrancePrimitive('fade-in');
    const fadeFrames = Math.round((prim.durationMs / 1000) * 60);

    assert.equal(titleStart, 0);
    assert.equal(bar1Start, fadeFrames, 'bar1 starts at title end');
    assert.ok(bar3Start > bar1Start, 'bar3 staggered after bar1');
  });
});
