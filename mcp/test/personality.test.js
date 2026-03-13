/**
 * Tests for Custom Personality Definitions (ANI-43).
 *
 * Covers: validatePersonalityDefinition, registerPersonality,
 * getPersonality, getAllPersonalitySlugs, derived guardrails/shot grammar.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePersonalityDefinition,
  registerPersonality,
  getPersonality,
  getAllPersonalitySlugs,
  isValidPersonality,
  listCustomPersonalities,
  unregisterPersonality,
  getGuardrailBoundaries,
  getShotGrammarRestrictions,
} from '../lib/personality.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDefinition(overrides = {}) {
  return {
    name: 'Test Personality',
    slug: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    characteristics: {
      contrast: 'medium',
      motion_intensity: 'restrained',
      color_mode: 'light',
      entrance_style: 'Fade and slide',
      transition_style: 'Crossfade',
    },
    camera_behavior: {
      mode: '2d-only',
    },
    ...overrides,
  };
}

// ── validatePersonalityDefinition ────────────────────────────────────────────

describe('validatePersonalityDefinition', () => {
  it('accepts valid definition', () => {
    const result = validatePersonalityDefinition(makeDefinition());
    assert.ok(result.valid, `Errors: ${result.errors.join('; ')}`);
  });

  it('rejects null definition', () => {
    const result = validatePersonalityDefinition(null);
    assert.equal(result.valid, false);
  });

  it('rejects missing name', () => {
    const def = makeDefinition();
    delete def.name;
    const result = validatePersonalityDefinition(def);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('name')));
  });

  it('rejects missing slug', () => {
    const def = makeDefinition();
    delete def.slug;
    const result = validatePersonalityDefinition(def);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('slug')));
  });

  it('rejects uppercase slug', () => {
    const result = validatePersonalityDefinition(makeDefinition({ slug: 'MyStyle' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('kebab-case')));
  });

  it('rejects built-in slug conflict', () => {
    const result = validatePersonalityDefinition(makeDefinition({ slug: 'cinematic-dark' }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('conflicts')));
  });

  it('rejects invalid contrast', () => {
    const result = validatePersonalityDefinition(makeDefinition({
      characteristics: { contrast: 'extreme' },
    }));
    assert.equal(result.valid, false);
  });

  it('rejects invalid camera mode', () => {
    const result = validatePersonalityDefinition(makeDefinition({
      camera_behavior: { mode: 'invalid' },
    }));
    assert.equal(result.valid, false);
  });

  it('warns when no characteristics provided', () => {
    const def = makeDefinition();
    delete def.characteristics;
    const result = validatePersonalityDefinition(def);
    assert.ok(result.valid);
    assert.ok(result.warnings.length > 0);
  });
});

// ── registerPersonality ──────────────────────────────────────────────────────

describe('registerPersonality', () => {
  it('registers a valid personality', () => {
    const def = makeDefinition();
    const result = registerPersonality(def);
    assert.ok(result.success, `Errors: ${result.errors.join('; ')}`);
    assert.ok(result.personality);
    assert.ok(result.guardrails);
    assert.ok(result.shot_grammar);

    // Cleanup
    unregisterPersonality(def.slug);
  });

  it('registered personality is findable', () => {
    const def = makeDefinition({ slug: 'test-findable' });
    registerPersonality(def);

    assert.ok(getPersonality('test-findable'));
    assert.ok(isValidPersonality('test-findable'));
    assert.ok(getAllPersonalitySlugs().includes('test-findable'));

    unregisterPersonality('test-findable');
  });

  it('fails on invalid definition', () => {
    const result = registerPersonality({ name: 'No Slug' });
    assert.equal(result.success, false);
    assert.ok(result.errors.length > 0);
  });

  it('allows re-registration (update)', () => {
    const def = makeDefinition({ slug: 'test-reregister' });
    registerPersonality(def);

    const updated = makeDefinition({ slug: 'test-reregister', name: 'Updated Name' });
    const result = registerPersonality(updated);
    assert.ok(result.success);
    assert.equal(getPersonality('test-reregister').name, 'Updated Name');

    unregisterPersonality('test-reregister');
  });
});

// ── Derived guardrails ───────────────────────────────────────────────────────

describe('derived guardrails', () => {
  it('2d-only mode forbids 3d_transforms', () => {
    const def = makeDefinition({ camera_behavior: { mode: '2d-only' } });
    const result = registerPersonality(def);
    assert.ok(result.guardrails.forbidden_features.includes('3d_transforms'));
    unregisterPersonality(def.slug);
  });

  it('none mode forbids camera_movement and parallax', () => {
    const def = makeDefinition({ camera_behavior: { mode: 'none' } });
    const result = registerPersonality(def);
    assert.ok(result.guardrails.forbidden_features.includes('camera_movement'));
    assert.ok(result.guardrails.forbidden_features.includes('parallax'));
    unregisterPersonality(def.slug);
  });

  it('gentle motion has strict limits', () => {
    const def = makeDefinition({
      characteristics: { motion_intensity: 'gentle', contrast: 'low', color_mode: 'light' },
    });
    const result = registerPersonality(def);
    assert.ok(result.guardrails.max_translateXY <= 15);
    assert.ok(result.guardrails.max_scale_change_percent <= 0.5);
    unregisterPersonality(def.slug);
  });

  it('full-3d mode allows 3d_transforms', () => {
    const def = makeDefinition({ camera_behavior: { mode: 'full-3d' } });
    const result = registerPersonality(def);
    assert.ok(!result.guardrails.forbidden_features.includes('3d_transforms'));
    unregisterPersonality(def.slug);
  });

  it('guardrail boundaries are retrievable', () => {
    const def = makeDefinition({ slug: 'test-guardrails-lookup' });
    registerPersonality(def);
    const boundaries = getGuardrailBoundaries('test-guardrails-lookup');
    assert.ok(boundaries);
    assert.ok(Array.isArray(boundaries.forbidden_features));
    unregisterPersonality('test-guardrails-lookup');
  });
});

// ── Derived shot grammar restrictions ────────────────────────────────────────

describe('derived shot grammar restrictions', () => {
  it('gentle motion restricts to wide/medium sizes', () => {
    const def = makeDefinition({
      characteristics: { motion_intensity: 'gentle', contrast: 'low', color_mode: 'light' },
    });
    const result = registerPersonality(def);
    assert.ok(result.shot_grammar.allowed_sizes.includes('wide'));
    assert.ok(result.shot_grammar.allowed_sizes.includes('medium'));
    assert.ok(!result.shot_grammar.allowed_sizes.includes('extreme_close_up'));
    unregisterPersonality(def.slug);
  });

  it('full-3d enables 3d rotation', () => {
    const def = makeDefinition({ camera_behavior: { mode: 'full-3d' } });
    const result = registerPersonality(def);
    assert.ok(result.shot_grammar.use_3d_rotation);
    unregisterPersonality(def.slug);
  });

  it('2d-only disables 3d rotation', () => {
    const def = makeDefinition({ camera_behavior: { mode: '2d-only' } });
    const result = registerPersonality(def);
    assert.equal(result.shot_grammar.use_3d_rotation, false);
    unregisterPersonality(def.slug);
  });

  it('shot grammar restrictions are retrievable', () => {
    const def = makeDefinition({ slug: 'test-sg-lookup' });
    registerPersonality(def);
    const restrictions = getShotGrammarRestrictions('test-sg-lookup');
    assert.ok(restrictions);
    assert.ok(Array.isArray(restrictions.allowed_sizes));
    unregisterPersonality('test-sg-lookup');
  });
});

// ── Built-in personalities ───────────────────────────────────────────────────

describe('built-in personality access', () => {
  it('can retrieve cinematic-dark', () => {
    assert.ok(getPersonality('cinematic-dark'));
    assert.ok(isValidPersonality('cinematic-dark'));
  });

  it('can retrieve editorial', () => {
    assert.ok(getPersonality('editorial'));
  });

  it('getAllPersonalitySlugs includes all 4 built-ins', () => {
    const slugs = getAllPersonalitySlugs();
    assert.ok(slugs.includes('cinematic-dark'));
    assert.ok(slugs.includes('editorial'));
    assert.ok(slugs.includes('neutral-light'));
    assert.ok(slugs.includes('montage'));
  });

  it('returns null for unknown slug', () => {
    assert.equal(getPersonality('nonexistent'), null);
    assert.equal(isValidPersonality('nonexistent'), false);
  });
});

// ── unregisterPersonality ────────────────────────────────────────────────────

describe('unregisterPersonality', () => {
  it('removes a registered personality', () => {
    const def = makeDefinition({ slug: 'test-unregister' });
    registerPersonality(def);
    assert.ok(isValidPersonality('test-unregister'));

    const removed = unregisterPersonality('test-unregister');
    assert.ok(removed);
    assert.equal(isValidPersonality('test-unregister'), false);
  });

  it('returns false for unknown slug', () => {
    assert.equal(unregisterPersonality('nonexistent'), false);
  });
});

// ── Full personality object ──────────────────────────────────────────────────

describe('full personality object', () => {
  it('has all required fields', () => {
    const def = makeDefinition();
    const { personality } = registerPersonality(def);

    assert.ok(personality.name);
    assert.ok(personality.slug);
    assert.ok(personality.css_prefix);
    assert.ok(personality.duration_overrides);
    assert.ok(personality.easing_overrides);
    assert.ok(personality.speed_hierarchy);
    assert.ok(personality.characteristics);
    assert.ok(personality.camera_behavior);
    assert.ok(personality.ai_guidance);
    assert.equal(personality.is_active, true);

    unregisterPersonality(def.slug);
  });

  it('fills defaults when fields are omitted', () => {
    const def = { name: 'Minimal', slug: 'test-minimal' };
    const { personality } = registerPersonality(def);

    assert.ok(personality.duration_overrides.fast);
    assert.ok(personality.easing_overrides.enter);
    assert.equal(personality.characteristics.contrast, 'medium');
    assert.equal(personality.camera_behavior.mode, 'none');

    unregisterPersonality('test-minimal');
  });
});
