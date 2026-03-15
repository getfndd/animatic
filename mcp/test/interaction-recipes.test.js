/**
 * Tests for Interaction Recipes (ANI-69).
 *
 * Covers: registry, 5 recipes, expandRecipe, lookupRecipe.
 * Run: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECIPES,
  COMPONENT_INTENT_TO_RECIPE,
  expandRecipe,
  lookupRecipe,
} from '../lib/interaction-recipes.js';

const ID_PATTERN = /^int_[a-z0-9_]+$/;

// ── Registry ─────────────────────────────────────────────────────────────────

describe('interaction recipe registry', () => {
  it('throws on unknown recipe', () => {
    assert.throws(() => expandRecipe('nonexistent', 'cmp_0'), /Unknown interaction recipe/);
  });

  it('returns an array from every recipe', () => {
    for (const [id] of RECIPES) {
      const result = expandRecipe(id, 'cmp_0', { text: 'test', items: ['a'] });
      assert.ok(Array.isArray(result), `${id} should return array`);
      assert.ok(result.length > 0, `${id} should return non-empty array`);
    }
  });

  it('all IDs match ^int_[a-z0-9_]+$', () => {
    for (const [id] of RECIPES) {
      const result = expandRecipe(id, 'cmp_0', { text: 'test', items: ['a'] });
      for (const int of result) {
        assert.match(int.id, ID_PATTERN, `${id} produced invalid ID: ${int.id}`);
      }
    }
  });

  it('all interactions have required fields (target, kind, timing)', () => {
    for (const [id] of RECIPES) {
      const result = expandRecipe(id, 'cmp_0', { text: 'test', items: ['a'] });
      for (const int of result) {
        assert.ok(int.target, `${id}: missing target`);
        assert.ok(int.kind, `${id}: missing kind`);
        assert.ok(int.timing, `${id}: missing timing`);
      }
    }
  });

  it('cue chain integrity: each step after the first waits on previous emit', () => {
    for (const [id] of RECIPES) {
      const result = expandRecipe(id, 'cmp_0', { text: 'test', items: ['a'] });
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1];
        const curr = result[i];
        assert.ok(prev.on_complete?.emit, `${id} step ${i - 1} should emit a cue`);
        assert.equal(
          curr.timing?.delay?.after,
          prev.on_complete.emit,
          `${id} step ${i} should wait on step ${i - 1}'s cue`,
        );
      }
    }
  });
});

// ── type-and-complete ────────────────────────────────────────────────────────

describe('type-and-complete recipe', () => {
  it('produces 3 steps: focus → type_text → settle', () => {
    const result = expandRecipe('type-and-complete', 'cmp_0', { text: 'Hello' });
    assert.equal(result.length, 3);
    assert.equal(result[0].kind, 'focus');
    assert.equal(result[1].kind, 'type_text');
    assert.equal(result[2].kind, 'settle');
  });

  it('cue chain links all steps', () => {
    const result = expandRecipe('type-and-complete', 'cmp_0', { text: 'Hello' });
    assert.equal(result[1].timing.delay.after, result[0].on_complete.emit);
    assert.equal(result[2].timing.delay.after, result[1].on_complete.emit);
  });

  it('forwards speed param', () => {
    const result = expandRecipe('type-and-complete', 'cmp_0', { text: 'Hi', speed: 60 });
    assert.equal(result[1].params.speed, 60);
  });

  it('forwards text to type_text', () => {
    const result = expandRecipe('type-and-complete', 'cmp_0', { text: 'Welcome' });
    assert.equal(result[1].params.text, 'Welcome');
  });
});

// ── reveal-results-stack ─────────────────────────────────────────────────────

describe('reveal-results-stack recipe', () => {
  it('produces 3 steps: insert_items → fan_stack → settle', () => {
    const result = expandRecipe('reveal-results-stack', 'cmp_0', { items: ['a', 'b'] });
    assert.equal(result.length, 3);
    assert.equal(result[0].kind, 'insert_items');
    assert.equal(result[1].kind, 'fan_stack');
    assert.equal(result[2].kind, 'settle');
  });

  it('forwards items param', () => {
    const items = ['result1', 'result2'];
    const result = expandRecipe('reveal-results-stack', 'cmp_0', { items });
    assert.deepEqual(result[0].params.items, items);
  });

  it('forwards stagger_ms param', () => {
    const result = expandRecipe('reveal-results-stack', 'cmp_0', { items: ['a'], stagger_ms: 120 });
    assert.equal(result[0].params.stagger_ms, 120);
  });
});

// ── open-and-select-dropdown ─────────────────────────────────────────────────

describe('open-and-select-dropdown recipe', () => {
  it('produces 4 steps: open_menu → pulse_focus → select_item → settle', () => {
    const result = expandRecipe('open-and-select-dropdown', 'cmp_0', {});
    assert.equal(result.length, 4);
    assert.equal(result[0].kind, 'open_menu');
    assert.equal(result[1].kind, 'pulse_focus');
    assert.equal(result[2].kind, 'select_item');
    assert.equal(result[3].kind, 'settle');
  });

  it('forwards selected_index param', () => {
    const result = expandRecipe('open-and-select-dropdown', 'cmp_0', { selected_index: 2 });
    assert.equal(result[2].params.index, 2);
  });

  it('full cue chain links all 4 steps', () => {
    const result = expandRecipe('open-and-select-dropdown', 'cmp_0', {});
    for (let i = 1; i < result.length; i++) {
      assert.equal(result[i].timing.delay.after, result[i - 1].on_complete.emit);
    }
  });
});

// ── fan-and-settle-cards ─────────────────────────────────────────────────────

describe('fan-and-settle-cards recipe', () => {
  it('produces 2 steps: fan_stack → settle', () => {
    const result = expandRecipe('fan-and-settle-cards', 'cmp_0', {});
    assert.equal(result.length, 2);
    assert.equal(result[0].kind, 'fan_stack');
    assert.equal(result[1].kind, 'settle');
  });

  it('forwards spread param', () => {
    const result = expandRecipe('fan-and-settle-cards', 'cmp_0', { spread: 1.5 });
    assert.equal(result[0].params.spread, 1.5);
  });
});

// ── fade-and-swap-prompt ─────────────────────────────────────────────────────

describe('fade-and-swap-prompt recipe', () => {
  it('produces 2 steps: replace_text → settle', () => {
    const result = expandRecipe('fade-and-swap-prompt', 'cmp_0', { text: 'New text' });
    assert.equal(result.length, 2);
    assert.equal(result[0].kind, 'replace_text');
    assert.equal(result[1].kind, 'settle');
  });

  it('forwards text and fade_duration_ms params', () => {
    const result = expandRecipe('fade-and-swap-prompt', 'cmp_0', { text: 'Swapped', fade_duration_ms: 300 });
    assert.equal(result[0].params.text, 'Swapped');
    assert.equal(result[0].params.fade_duration_ms, 300);
  });
});

// ── lookupRecipe ─────────────────────────────────────────────────────────────

describe('lookupRecipe', () => {
  it('prompt_card + hero → type-and-complete', () => {
    assert.equal(lookupRecipe('prompt_card', ['hero']), 'type-and-complete');
  });

  it('prompt_card + opening → type-and-complete', () => {
    assert.equal(lookupRecipe('prompt_card', ['opening']), 'type-and-complete');
  });

  it('prompt_card + closing → fade-and-swap-prompt', () => {
    assert.equal(lookupRecipe('prompt_card', ['closing']), 'fade-and-swap-prompt');
  });

  it('stacked_cards + any intent → fan-and-settle-cards (wildcard)', () => {
    assert.equal(lookupRecipe('stacked_cards', ['detail']), 'fan-and-settle-cards');
    assert.equal(lookupRecipe('stacked_cards', ['hero']), 'fan-and-settle-cards');
  });

  it('prompt_card + detail → null (no recipe)', () => {
    assert.equal(lookupRecipe('prompt_card', ['detail']), null);
  });

  it('icon_label_row + any → null (no recipe)', () => {
    assert.equal(lookupRecipe('icon_label_row', ['closing']), null);
  });

  it('unknown component → null', () => {
    assert.equal(lookupRecipe('unknown_type', ['hero']), null);
  });
});
