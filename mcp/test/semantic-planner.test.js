/**
 * Semantic Planner tests — ANI-73
 *
 * Tests for reference classification and component mapping.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/semantic-planner.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIMENSIONS,
  classifyReference,
  mapClassificationToComponents,
  recommendFromClassification,
} from '../lib/semantic-planner.js';

// ── classifyReference ────────────────────────────────────────────────────────

describe('classifyReference', () => {
  it('classifies typing reference', () => {
    const ref = { interaction_type: 'typing', pacing: 'moderate', text_behavior: 'typing' };
    const result = classifyReference(ref);
    assert.equal(result.interaction_type, 'typing');
    assert.equal(result.pacing, 'moderate');
    assert.equal(result.text_behavior, 'typing');
  });

  it('classifies selection reference', () => {
    const ref = { interaction_type: 'selection', composition_density: 'minimal' };
    const result = classifyReference(ref);
    assert.equal(result.interaction_type, 'selection');
    assert.equal(result.composition_density, 'minimal');
  });

  it('strips invalid dimension values', () => {
    const ref = { interaction_type: 'invalid_type', pacing: 'moderate' };
    const result = classifyReference(ref);
    assert.equal(result.interaction_type, undefined);
    assert.equal(result.pacing, 'moderate');
  });

  it('returns empty for null input', () => {
    const result = classifyReference(null);
    assert.deepEqual(result, {});
  });
});

// ── mapClassificationToComponents ────────────────────────────────────────────

describe('mapClassificationToComponents', () => {
  it('maps typing to prompt_card + type-and-complete', () => {
    const classification = { interaction_type: 'typing' };
    const result = mapClassificationToComponents(classification);
    assert.ok(result.component_types.includes('prompt_card'));
    assert.ok(result.recipes.includes('type-and-complete'));
  });

  it('maps selection to dropdown_menu + open-and-select-dropdown', () => {
    const classification = { interaction_type: 'selection' };
    const result = mapClassificationToComponents(classification);
    assert.ok(result.component_types.includes('dropdown_menu'));
    assert.ok(result.recipes.includes('open-and-select-dropdown'));
  });

  it('maps dense + reveal to stacked_cards + fan-and-settle-cards', () => {
    const classification = { interaction_type: 'reveal', composition_density: 'dense' };
    const result = mapClassificationToComponents(classification);
    assert.ok(result.component_types.includes('stacked_cards'));
    assert.ok(result.recipes.includes('fan-and-settle-cards'));
  });

  it('returns empty arrays for empty classification', () => {
    const result = mapClassificationToComponents({});
    assert.equal(result.component_types.length, 0);
    assert.equal(result.recipes.length, 0);
    assert.equal(result.personality_affinity.length, 0);
  });
});

// ── recommendFromClassification ──────────────────────────────────────────────

describe('recommendFromClassification', () => {
  it('returns valid v3 semantic block for typing', () => {
    const classification = { interaction_type: 'typing', camera_behavior: 'push_in' };
    const result = recommendFromClassification(classification);

    assert.ok(Array.isArray(result.components));
    assert.ok(result.components.length > 0);
    assert.equal(result.components[0].role, 'hero');

    assert.ok(Array.isArray(result.interactions));
    assert.ok(result.interactions.length > 0);

    assert.ok(result.camera_behavior);
    assert.equal(result.camera_behavior.mode, 'reactive');
  });

  it('returns ambient camera for drift behavior', () => {
    const classification = { interaction_type: 'selection', camera_behavior: 'drift' };
    const result = recommendFromClassification(classification);
    assert.equal(result.camera_behavior.mode, 'ambient');
  });

  it('returns static camera for static behavior', () => {
    const classification = { interaction_type: 'reveal', camera_behavior: 'static' };
    const result = recommendFromClassification(classification);
    assert.equal(result.camera_behavior.mode, 'static');
  });

  it('interactions have valid IDs and targets', () => {
    const classification = { interaction_type: 'typing' };
    const result = recommendFromClassification(classification);

    for (const int of result.interactions) {
      assert.ok(int.id, 'interaction must have id');
      assert.ok(int.target, 'interaction must have target');
      assert.ok(int.kind, 'interaction must have kind');
    }
  });
});
