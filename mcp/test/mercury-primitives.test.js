/**
 * Tests for Mercury-inspired primitives and recipes.
 * Verifies cd-bar-grow, cd-card-cascade, cd-panel-drilldown compile correctly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compileMotion } from '../lib/compiler.js';
import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadRecipes,
} from '../data/loader.js';
import { resolveEntrancePrimitive } from '../../src/remotion/lib.js';

const catalogs = {
  primitives: loadPrimitivesCatalog(),
  personalities: loadPersonalitiesCatalog(),
  recipes: loadRecipes(),
};

// ── Primitive resolution ────────────────────────────────────────────────────

describe('Mercury primitives — resolution', () => {
  it('cd-bar-grow resolves to a valid primitive', () => {
    const p = resolveEntrancePrimitive('cd-bar-grow');
    assert.ok(p, 'primitive resolved');
    assert.equal(p.durationMs, 500);
    assert.equal(p.easing, 'expo_out');
    assert.ok(p.keyframes.length >= 2, 'has keyframes');
    // Starts at scale 0 (bar invisible)
    assert.equal(p.keyframes[0].scale, 0);
    // Ends at scale 1 (bar full height)
    assert.equal(p.keyframes[p.keyframes.length - 1].scale, 1);
  });

  it('cd-card-cascade resolves to a valid primitive', () => {
    const p = resolveEntrancePrimitive('cd-card-cascade');
    assert.ok(p, 'primitive resolved');
    assert.equal(p.durationMs, 400);
    assert.ok(p.keyframes.length >= 2, 'has keyframes');
    // Starts with translateY offset
    assert.equal(p.keyframes[0].translateY, 16);
    assert.equal(p.keyframes[0].opacity, 0);
  });

  it('cd-panel-drilldown resolves to a valid primitive', () => {
    const p = resolveEntrancePrimitive('cd-panel-drilldown');
    assert.ok(p, 'primitive resolved');
    assert.equal(p.durationMs, 500);
    // Starts with translateY + scale offset
    assert.equal(p.keyframes[0].translateY, 20);
    assert.equal(p.keyframes[0].scale, 0.97);
    assert.equal(p.keyframes[0].opacity, 0);
  });
});

// ── Compilation ─────────────────────────────────────────────────────────────

describe('Mercury primitives — compilation', () => {
  it('cd-bar-grow compiles a scene with staggered bars', () => {
    const scene = {
      scene_id: 'sc_bar_chart',
      format_version: 2,
      duration_s: 3,
      camera: { move: 'static' },
      layers: [
        { id: 'bar1', type: 'html', depth_class: 'foreground' },
        { id: 'bar2', type: 'html', depth_class: 'foreground' },
        { id: 'bar3', type: 'html', depth_class: 'foreground' },
        { id: 'bar4', type: 'html', depth_class: 'foreground' },
      ],
      motion: {
        groups: [
          {
            targets: ['bar1', 'bar2', 'bar3', 'bar4'],
            primitive: 'cd-bar-grow',
            stagger: { interval_ms: 120, order: 'sequential' },
          },
        ],
      },
    };

    const timeline = compileMotion(scene, catalogs);
    assert.ok(timeline, 'timeline produced');
    assert.ok(timeline.tracks.layers.bar1, 'bar1 has tracks');
    assert.ok(timeline.tracks.layers.bar4, 'bar4 has tracks');

    // bar4 should start later than bar1 (stagger)
    const bar1Start = timeline.tracks.layers.bar1.scale[0].frame;
    const bar4Start = timeline.tracks.layers.bar4.scale[0].frame;
    assert.ok(bar4Start > bar1Start, `bar4 (frame ${bar4Start}) starts after bar1 (frame ${bar1Start})`);
  });

  it('cd-card-cascade compiles with hero + supporting', () => {
    const scene = {
      scene_id: 'sc_cards',
      format_version: 2,
      duration_s: 4,
      camera: { move: 'push_in', intensity: 0.15, easing: 'ease_out' },
      layers: [
        { id: 'card_hero', type: 'html', depth_class: 'foreground' },
        { id: 'card_1', type: 'html', depth_class: 'foreground' },
        { id: 'card_2', type: 'html', depth_class: 'foreground' },
        { id: 'card_3', type: 'html', depth_class: 'foreground' },
      ],
      motion: {
        recipe: 'cd-insight-card-cascade',
        target_map: {
          hero: ['card_hero'],
          supporting: ['card_1', 'card_2', 'card_3'],
        },
      },
    };

    const timeline = compileMotion(scene, catalogs);
    assert.ok(timeline, 'timeline produced');
    assert.ok(timeline.tracks.layers.card_hero, 'hero has tracks');
    assert.ok(timeline.tracks.layers.card_3, 'last supporting has tracks');

    // Hero starts at frame 0
    const heroStart = timeline.tracks.layers.card_hero.opacity[0].frame;
    assert.equal(heroStart, 0, 'hero starts at frame 0');

    // Supporting starts after hero (delay_after_hero_ms: 180)
    const supportStart = timeline.tracks.layers.card_1.opacity[0].frame;
    assert.ok(supportStart > 0, `supporting starts after hero (frame ${supportStart})`);
  });

  it('cd-panel-drilldown compiles with content stagger inside', () => {
    const scene = {
      scene_id: 'sc_panel',
      format_version: 2,
      duration_s: 3,
      camera: { move: 'push_in', intensity: 0.2, easing: 'ease_out' },
      layers: [
        { id: 'panel', type: 'html', depth_class: 'foreground' },
        { id: 'chart', type: 'html', depth_class: 'foreground' },
        { id: 'label', type: 'html', depth_class: 'foreground' },
      ],
      motion: {
        recipe: 'cd-panel-drilldown',
        target_map: {
          hero: ['panel'],
          supporting: ['chart', 'label'],
        },
      },
    };

    const timeline = compileMotion(scene, catalogs);
    assert.ok(timeline, 'timeline produced');
    assert.ok(timeline.tracks.layers.panel, 'panel has tracks');
    assert.ok(timeline.tracks.layers.panel.scale, 'panel has scale track');

    // Panel scale starts at 0.97
    assert.equal(timeline.tracks.layers.panel.scale[0].value, 0.97);
  });

  it('cd-bar-chart-reveal recipe compiles', () => {
    const scene = {
      scene_id: 'sc_chart_recipe',
      format_version: 2,
      duration_s: 4,
      camera: { move: 'static' },
      layers: [
        { id: 'title', type: 'text', content: 'Revenue', depth_class: 'foreground' },
        { id: 'b1', type: 'html', depth_class: 'foreground' },
        { id: 'b2', type: 'html', depth_class: 'foreground' },
        { id: 'b3', type: 'html', depth_class: 'foreground' },
      ],
      motion: {
        recipe: 'cd-bar-chart-reveal',
        target_map: {
          hero: ['title'],
          supporting: ['b1', 'b2', 'b3'],
        },
      },
    };

    const timeline = compileMotion(scene, catalogs);
    assert.ok(timeline, 'timeline produced');
    // Supporting bars use cd-bar-grow (scale track)
    assert.ok(timeline.tracks.layers.b1.scale, 'bar has scale track');
    // Hero title uses fade-in (delayed)
    assert.ok(timeline.tracks.layers.title.opacity, 'title has opacity track');
  });

  it('cd-tagline-sequence recipe compiles', () => {
    const scene = {
      scene_id: 'sc_tagline',
      format_version: 2,
      duration_s: 3,
      camera: { move: 'static' },
      layers: [
        { id: 'tagline', type: 'text', content: 'Radically different.', depth_class: 'foreground' },
      ],
      motion: {
        recipe: 'cd-tagline-sequence',
        target_map: {
          hero: ['tagline'],
        },
      },
    };

    const timeline = compileMotion(scene, catalogs);
    assert.ok(timeline, 'timeline produced');
    assert.ok(timeline.tracks.layers.tagline.opacity, 'tagline has opacity track');
  });
});
