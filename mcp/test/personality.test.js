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
  resolveChoreographyPersonality,
} from '../lib/personality.js';
import { loadCustomPersonalityDefinitions } from '../data/loader.js';
import { handleCreatePersonality, handleGetPersonality, handleRecommendChoreography, handleValidateChoreography } from '../handlers.js';

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

// ── Persistence across calls/restarts (ANI-164) ──────────────────────────────

describe('custom personality persistence (ANI-164)', () => {
  const onDisk = (slug) => loadCustomPersonalityDefinitions().some(d => d?.slug === slug);

  it('persists the definition to disk on register (default)', () => {
    const def = makeDefinition({ slug: 'test-persist-on' });
    const res = registerPersonality(def);
    try {
      assert.equal(res.persisted, true);
      assert.ok(onDisk('test-persist-on'), 'definition should be written to catalog/custom-personalities/');
    } finally {
      unregisterPersonality('test-persist-on');
    }
  });

  it('does not write to disk when persist:false', () => {
    const def = makeDefinition({ slug: 'test-persist-off' });
    const res = registerPersonality(def, { persist: false });
    try {
      assert.equal(res.persisted, false);
      assert.equal(onDisk('test-persist-off'), false);
    } finally {
      unregisterPersonality('test-persist-off');
    }
  });

  it('unregister removes the persisted file', () => {
    registerPersonality(makeDefinition({ slug: 'test-persist-remove' }));
    assert.ok(onDisk('test-persist-remove'));
    unregisterPersonality('test-persist-remove');
    assert.equal(onDisk('test-persist-remove'), false);
  });

  it('a persisted definition reloads from disk and resolves by slug (restart path)', () => {
    registerPersonality(makeDefinition({ slug: 'test-persist-reload' }));
    try {
      // Emulate a fresh process: read the def back off disk and re-register it
      // exactly as module init does (persist:false — already on disk).
      const persisted = loadCustomPersonalityDefinitions().find(d => d.slug === 'test-persist-reload');
      assert.ok(persisted, 'definition should be on disk');
      const res = registerPersonality(persisted, { persist: false });
      assert.ok(res.success);
      assert.ok(getPersonality('test-persist-reload'), 'slug must resolve after reload');
    } finally {
      unregisterPersonality('test-persist-reload');
    }
  });

  // Regression: get_personality read the built-in catalog directly, so a
  // created+persisted custom slug 404'd on inspect even though list/planning
  // saw it. get_personality must route through the registry helper.
  it('create_personality → get_personality round-trips by slug', () => {
    const slug = 'test-get-custom';
    const created = handleCreatePersonality({ definition: makeDefinition({ slug }) });
    try {
      assert.ok(!created.isError, 'create_personality should succeed');
      const got = handleGetPersonality({ slug });
      assert.ok(!got.isError, 'get_personality must resolve the custom slug, not 404');
      assert.ok(got.content[0].text.includes(slug));
    } finally {
      unregisterPersonality(slug);
    }
  });
});

// ── Choreography inheritance (ANI-166) ───────────────────────────────────────

describe('inherits_choreography_from validation (ANI-166)', () => {
  it('accepts a built-in slug', () => {
    const result = validatePersonalityDefinition(
      makeDefinition({ inherits_choreography_from: 'cinematic-dark' })
    );
    assert.ok(result.valid, `Errors: ${result.errors.join('; ')}`);
  });

  it('rejects a non-built-in slug', () => {
    const result = validatePersonalityDefinition(
      makeDefinition({ inherits_choreography_from: 'not-a-real-personality' })
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('inherits_choreography_from')));
  });

  it('omitting the field is valid', () => {
    const result = validatePersonalityDefinition(makeDefinition());
    assert.ok(result.valid);
  });

  it('round-trips onto the built personality object', () => {
    const def = makeDefinition({ slug: 'test-inherit-build', inherits_choreography_from: 'editorial' });
    const { personality } = registerPersonality(def, { persist: false });
    try {
      assert.equal(personality.inherits_choreography_from, 'editorial');
    } finally {
      unregisterPersonality('test-inherit-build');
    }
  });
});

describe('resolveChoreographyPersonality (ANI-166)', () => {
  it('built-in resolves to itself', () => {
    const r = resolveChoreographyPersonality('cinematic-dark');
    assert.deepEqual(r, { slug: 'cinematic-dark', source: 'builtin' });
  });

  it('returns null for an unknown slug', () => {
    assert.equal(resolveChoreographyPersonality('nope-not-here'), null);
  });

  it('derives the analog from camera mode', () => {
    const cases = [
      ['full-3d', 'cinematic-dark'],
      ['2d-only', 'editorial'],
      ['attention-direction', 'neutral-light'],
      ['none', 'editorial'],
    ];
    for (const [mode, expected] of cases) {
      const slug = `test-derive-${mode}`;
      registerPersonality(makeDefinition({ slug, camera_behavior: { mode } }), { persist: false });
      try {
        const r = resolveChoreographyPersonality(slug);
        assert.equal(r.source, 'derived');
        assert.equal(r.mode, mode);
        assert.equal(r.slug, expected, `mode ${mode} should map to ${expected}`);
      } finally {
        unregisterPersonality(slug);
      }
    }
  });

  it('explicit inheritance overrides the mode-derived analog', () => {
    // 2d-only would derive editorial, but inheritance pins cinematic-dark.
    const slug = 'test-inherit-override';
    registerPersonality(
      makeDefinition({ slug, camera_behavior: { mode: '2d-only' }, inherits_choreography_from: 'cinematic-dark' }),
      { persist: false }
    );
    try {
      const r = resolveChoreographyPersonality(slug);
      assert.equal(r.source, 'inherited');
      assert.equal(r.slug, 'cinematic-dark');
    } finally {
      unregisterPersonality(slug);
    }
  });
});

describe('create_personality → recommend_choreography (ANI-166)', () => {
  it('a custom full-3d personality returns a usable plan via its derived analog', () => {
    const slug = 'test-choreo-full3d';
    const created = handleCreatePersonality({
      definition: makeDefinition({ slug, camera_behavior: { mode: 'full-3d' } }),
    });
    try {
      assert.ok(!created.isError, 'create_personality should succeed');
      // full-3d derives cinematic-dark, which supports dramatic-reveal.
      const plan = handleRecommendChoreography({ intent: 'dramatic-reveal', personality: slug });
      assert.ok(!plan.isError, 'choreography must not flat-reject a custom slug');
      const text = plan.content[0].text;
      assert.ok(text.includes('Choreography: Dramatic Reveal'));
      // Plan is a clearly-explained fallback, not a silent substitution.
      assert.ok(text.includes(slug) && text.includes('cinematic-dark'),
        'plan should name the custom slug and the matrix it borrowed');
      // Primitives keyed off cinematic-dark's matrix surface, not an empty table.
      assert.ok(text.includes('ct-camera-dolly'), 'cinematic-dark camera primitives should appear');
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('explicit inherits_choreography_from drives the matrix', () => {
    const slug = 'test-choreo-inherit';
    handleCreatePersonality({
      definition: makeDefinition({
        slug,
        camera_behavior: { mode: '2d-only' },
        inherits_choreography_from: 'cinematic-dark',
      }),
    });
    try {
      const plan = handleRecommendChoreography({ intent: 'dramatic-reveal', personality: slug });
      assert.ok(!plan.isError, 'inherited matrix should make dramatic-reveal available');
      assert.ok(plan.content[0].text.includes('inherits'), 'plan should note inheritance');
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('borrowed primitives are filtered to the custom personality\'s own guardrails', () => {
    // Reviewer repro: a no-camera personality that inherits cinematic-dark must
    // NOT surface the inherited camera primitives — its guardrails forbid them.
    const slug = 'test-choreo-none-inherit';
    handleCreatePersonality({
      definition: makeDefinition({
        slug,
        camera_behavior: { mode: 'none' },
        inherits_choreography_from: 'cinematic-dark',
      }),
    });
    try {
      const plan = handleRecommendChoreography({ intent: 'dramatic-reveal', personality: slug });
      assert.ok(!plan.isError, 'still a usable plan, just camera-free');
      const text = plan.content[0].text;
      // None of cinematic-dark's camera moves leak through.
      for (const prim of ['ct-camera-dolly', 'ct-camera-crane', 'ct-dolly-zoom']) {
        assert.ok(!text.includes(prim), `forbidden camera primitive ${prim} must be filtered out`);
      }
      assert.ok(text.includes('No camera movement'), 'camera section should reflect the none mode');
      assert.ok(text.includes('guardrails'), 'note should explain candidates are guardrail-filtered');
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('an unsupported intent yields a deterministic, analog-aware rejection (not a flat one)', () => {
    const slug = 'test-choreo-2d';
    handleCreatePersonality({ definition: makeDefinition({ slug, camera_behavior: { mode: '2d-only' } }) });
    try {
      // 2d-only derives editorial; dramatic-reveal supports only cinematic-dark.
      const plan = handleRecommendChoreography({ intent: 'dramatic-reveal', personality: slug });
      assert.ok(plan.isError, 'editorial does not support dramatic-reveal');
      const text = plan.content[0].text;
      assert.ok(text.includes('editorial'), 'rejection should name the resolved analog');
      // Recoverable: it names intents editorial DOES support, not "no intents support <slug>".
      assert.ok(text.includes('content-focus'), 'tip should list analog-compatible intents');
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('validate_choreography accepts borrowed primitives via the resolved affinity (no false BLOCK)', () => {
    // Reviewer repro: recommend_choreography emits an inherited built-in's
    // primitive, then validate_choreography on the same custom slug must not
    // BLOCK it for "Personality mismatch".
    const slug = 'test-validate-affinity';
    handleCreatePersonality({
      definition: makeDefinition({ slug, camera_behavior: { mode: '2d-only' }, inherits_choreography_from: 'cinematic-dark' }),
    });
    try {
      const res = handleValidateChoreography({ primitive_ids: ['lib-gsap-spring-stagger'], personality: slug });
      const text = res.content[0].text;
      assert.ok(!text.includes('Personality mismatch'), 'borrowed cinematic-dark primitive must pass affinity');
      assert.ok(!res.isError);
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('validate_choreography still enforces the custom personality\'s own guardrails', () => {
    // A 2d-only personality forbids 3D; the borrowed cinematic-dark dolly
    // (translateZ) must still BLOCK — on the guardrail, not on affinity.
    const slug = 'test-validate-guardrail';
    handleCreatePersonality({
      definition: makeDefinition({ slug, camera_behavior: { mode: '2d-only' }, inherits_choreography_from: 'cinematic-dark' }),
    });
    try {
      const res = handleValidateChoreography({ primitive_ids: ['ct-camera-dolly'], personality: slug });
      const text = res.content[0].text;
      assert.ok(text.includes('BLOCK'), '3D primitive must block for a 2d-only personality');
      assert.ok(text.includes('(3D)'), 'block reason is the 3D guardrail');
      assert.ok(!text.includes('Personality mismatch'), 'block must come from guardrails, not affinity');
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('validate_choreography blocks scale-based camera moves for a no-camera personality (ANI-168)', () => {
    // recommend_choreography drops ALL camera moves for a none-mode personality;
    // validate must agree. ct-dolly-zoom's amplitude is `scale`, which the old
    // translate/rotate property list missed → false PASS.
    const slug = 'test-validate-dolly-zoom';
    handleCreatePersonality({
      definition: makeDefinition({ slug, camera_behavior: { mode: 'none' }, inherits_choreography_from: 'cinematic-dark' }),
    });
    try {
      const res = handleValidateChoreography({ primitive_ids: ['ct-dolly-zoom'], personality: slug });
      const text = res.content[0].text;
      assert.ok(text.includes('BLOCK'), 'scale-based camera move must block for a none-camera personality');
      assert.ok(text.includes('camera movement'), 'block reason is the camera_movement guardrail');
      assert.ok(!text.includes('Personality mismatch'), 'affinity passes (inherited cinematic-dark); guardrail blocks');
    } finally {
      unregisterPersonality(slug);
    }
  });

  it('an unknown personality slug is reported as not found', () => {
    const plan = handleRecommendChoreography({ intent: 'dramatic-reveal', personality: 'ghost-slug' });
    assert.ok(plan.isError);
    assert.ok(plan.content[0].text.includes('not found'));
  });

  it('inherits_choreography_from survives a reload (persistence round-trip)', () => {
    const slug = 'test-choreo-reload';
    registerPersonality(
      makeDefinition({ slug, camera_behavior: { mode: '2d-only' }, inherits_choreography_from: 'cinematic-dark' })
    );
    try {
      const persisted = loadCustomPersonalityDefinitions().find(d => d.slug === slug);
      assert.ok(persisted, 'definition should be on disk');
      assert.equal(persisted.inherits_choreography_from, 'cinematic-dark', 'field persists raw');
      // Re-register as a fresh process would, then confirm the matrix still resolves.
      registerPersonality(persisted, { persist: false });
      const r = resolveChoreographyPersonality(slug);
      assert.equal(r.source, 'inherited');
      assert.equal(r.slug, 'cinematic-dark');
    } finally {
      unregisterPersonality(slug);
    }
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
