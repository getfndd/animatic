/**
 * State machine tests — component-local visual overrides (ANI-76).
 *
 * Run: node --test mcp/test/state-machines.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATE_MACHINES,
  VALID_KINDS,
  resolveStateOverrides,
  getComponentStates,
} from '../lib/state-machines.js';

// ── Registry tests ───────────────────────────────────────────────────────────

describe('STATE_MACHINES registry', () => {
  it('has 4 component machines', () => {
    assert.equal(STATE_MACHINES.size, 4);
    assert.ok(STATE_MACHINES.has('prompt_card'));
    assert.ok(STATE_MACHINES.has('dropdown_menu'));
    assert.ok(STATE_MACHINES.has('result_stack'));
    assert.ok(STATE_MACHINES.has('stacked_cards'));
  });

  it('all machine types match their map key', () => {
    for (const [key, machine] of STATE_MACHINES) {
      assert.equal(machine.type, key, `type mismatch for ${key}`);
    }
  });

  it('all override kinds are valid interaction kinds', () => {
    for (const [key, machine] of STATE_MACHINES) {
      for (const kind of Object.keys(machine.overrides)) {
        assert.ok(VALID_KINDS.has(kind), `${key} has invalid override kind: ${kind}`);
      }
    }
  });

  it('override effects have required fields', () => {
    for (const [key, machine] of STATE_MACHINES) {
      for (const [kind, override] of Object.entries(machine.overrides)) {
        if (!override.effects) continue; // fan_stack may not have effects
        for (const effect of override.effects) {
          assert.ok('type' in effect, `${key}/${kind}: effect missing type`);
          assert.ok('from' in effect, `${key}/${kind}: effect missing from`);
          assert.ok('to' in effect, `${key}/${kind}: effect missing to`);
          assert.ok('duration_ms' in effect, `${key}/${kind}: effect missing duration_ms`);
          assert.ok('easing' in effect, `${key}/${kind}: effect missing easing`);
        }
      }
    }
  });

  it('states have numeric values', () => {
    for (const [key, machine] of STATE_MACHINES) {
      for (const [name, state] of Object.entries(machine.states)) {
        for (const [prop, val] of Object.entries(state)) {
          assert.equal(typeof val, 'number', `${key}.states.${name}.${prop} should be numeric`);
        }
      }
    }
  });
});

// ── Resolver tests ───────────────────────────────────────────────────────────

describe('resolveStateOverrides', () => {
  it('returns null for component type without a machine', () => {
    assert.equal(resolveStateOverrides('input_field', 'focus'), null);
  });

  it('returns null for null/undefined component type', () => {
    assert.equal(resolveStateOverrides(null, 'focus'), null);
    assert.equal(resolveStateOverrides(undefined, 'focus'), null);
  });

  it('returns null for kind without override', () => {
    // prompt_card has no type_text override
    assert.equal(resolveStateOverrides('prompt_card', 'type_text'), null);
  });

  it('returns effects for prompt_card + focus', () => {
    const result = resolveStateOverrides('prompt_card', 'focus');
    assert.ok(result);
    assert.ok(Array.isArray(result.effects));
    assert.ok(result.effects.length > 0);
  });

  it('returns cloned effects (mutation safety)', () => {
    const a = resolveStateOverrides('prompt_card', 'focus');
    const b = resolveStateOverrides('prompt_card', 'focus');
    assert.notEqual(a.effects, b.effects, 'should be different arrays');
    assert.notEqual(a.effects[0], b.effects[0], 'should be different objects');
    // Mutate one, verify other is unaffected
    a.effects[0].duration_ms = 9999;
    const c = resolveStateOverrides('prompt_card', 'focus');
    assert.notEqual(c.effects[0].duration_ms, 9999);
  });
});

// ── getComponentStates ───────────────────────────────────────────────────────

describe('getComponentStates', () => {
  it('returns states for known type', () => {
    const states = getComponentStates('prompt_card');
    assert.ok(states);
    assert.ok('idle' in states);
    assert.ok('focused' in states);
  });

  it('returns null for unknown type', () => {
    assert.equal(getComponentStates('input_field'), null);
  });
});

// ── prompt_card overrides ────────────────────────────────────────────────────

describe('prompt_card overrides', () => {
  it('focus scale peak is 1.02 (not default 1.05)', () => {
    const result = resolveStateOverrides('prompt_card', 'focus');
    const scaleTo = result.effects.find(e => e.type === 'scale' && e.from === 1);
    assert.equal(scaleTo.to, 1.02);
  });

  it('focus sibling_dim_opacity is 0.3', () => {
    const result = resolveStateOverrides('prompt_card', 'focus');
    assert.equal(result.sibling_dim_opacity, 0.3);
  });

  it('settle animates from scale 1.02', () => {
    const result = resolveStateOverrides('prompt_card', 'settle');
    const scale = result.effects.find(e => e.type === 'scale');
    assert.equal(scale.from, 1.02);
    assert.equal(scale.duration_ms, 300);
  });
});

// ── dropdown_menu overrides ──────────────────────────────────────────────────

describe('dropdown_menu overrides', () => {
  it('open_menu translateY starts at -30 (not default -20)', () => {
    const result = resolveStateOverrides('dropdown_menu', 'open_menu');
    const ty = result.effects.find(e => e.type === 'translateY');
    assert.equal(ty.from, -30);
  });

  it('select_item duration is 150ms (not default 200)', () => {
    const result = resolveStateOverrides('dropdown_menu', 'select_item');
    assert.equal(result.duration_ms, 150);
  });
});

// ── result_stack overrides ───────────────────────────────────────────────────

describe('result_stack overrides', () => {
  it('insert_items translateY starts at 30 and adds scale effect', () => {
    const result = resolveStateOverrides('result_stack', 'insert_items');
    const ty = result.effects.find(e => e.type === 'translateY');
    assert.equal(ty.from, 30);
    const scale = result.effects.find(e => e.type === 'scale');
    assert.ok(scale, 'should have scale effect');
    assert.equal(scale.from, 0.95);
    assert.equal(scale.to, 1);
  });

  it('settle duration is 500ms', () => {
    const result = resolveStateOverrides('result_stack', 'settle');
    assert.equal(result.duration_ms, 500);
  });
});

// ── stacked_cards overrides ──────────────────────────────────────────────────

describe('stacked_cards overrides', () => {
  it('fan_stack spread is 20 (not default 15)', () => {
    const result = resolveStateOverrides('stacked_cards', 'fan_stack');
    assert.equal(result.fan_spread, 20);
  });

  it('settle scale animates from 1.08 (not default 1.05)', () => {
    const result = resolveStateOverrides('stacked_cards', 'settle');
    const scale = result.effects.find(e => e.type === 'scale');
    assert.equal(scale.from, 1.08);
    assert.equal(scale.duration_ms, 450);
  });
});
