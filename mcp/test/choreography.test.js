/**
 * Tests for MCP choreography tools: personality filtering, blur validation,
 * and intent cross-reference logic.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { filterByPersonality, parseDurationMs, checkBlurViolations } from '../lib.js';
import {
  loadIntentMappings,
  loadCameraGuardrails,
  parseRegistry,
} from '../data/loader.js';

// ── Load real data once ──────────────────────────────────────────────────────

const registry = parseRegistry();
const intentMappings = loadIntentMappings();
const cameraGuardrails = loadCameraGuardrails();

// ── filterByPersonality ──────────────────────────────────────────────────────

describe('filterByPersonality', () => {
  it('keeps primitives matching the target personality', () => {
    const result = filterByPersonality(['ed-scene-breathe'], 'editorial', registry);
    assert.deepEqual(result, ['ed-scene-breathe']);
  });

  it('keeps universal primitives for any personality', () => {
    // Find a universal primitive if one exists, otherwise skip
    const universal = registry.entries.find(e => e.personality.includes('universal'));
    if (universal) {
      const result = filterByPersonality([universal.id], 'cinematic-dark', registry);
      assert.deepEqual(result, [universal.id]);
    }
  });

  it('removes primitives incompatible with target personality', () => {
    // ct-ambient-drift is cinematic-dark + editorial, NOT neutral-light
    const result = filterByPersonality(['ct-ambient-drift'], 'neutral-light', registry);
    assert.deepEqual(result, []);
  });

  it('keeps unknown primitive IDs (not in registry)', () => {
    const result = filterByPersonality(['nonexistent-prim'], 'editorial', registry);
    assert.deepEqual(result, ['nonexistent-prim']);
  });

  it('handles empty input array', () => {
    const result = filterByPersonality([], 'cinematic-dark', registry);
    assert.deepEqual(result, []);
  });

  it('filters mixed arrays correctly', () => {
    // ct-ambient-drift = cinematic-dark + editorial
    // ed-scene-breathe = editorial only
    const result = filterByPersonality(
      ['ct-ambient-drift', 'ed-scene-breathe'],
      'cinematic-dark',
      registry
    );
    assert.deepEqual(result, ['ct-ambient-drift']);
  });
});

// ── recommend_choreography: personality filtering ────────────────────────────

describe('recommend_choreography personality filtering', () => {
  const calmOverview = intentMappings.byIntent.get('calm-overview');

  it('calm-overview camera primitives should be empty for neutral-light', () => {
    // ct-ambient-drift is cinematic-dark + editorial, not neutral-light
    const filtered = filterByPersonality(calmOverview.camera_primitives, 'neutral-light', registry);
    assert.equal(filtered.length, 0, 'neutral-light should have no camera primitives for calm-overview');
  });

  it('calm-overview ambient should include only ed-scene-breathe for editorial', () => {
    const filtered = filterByPersonality(calmOverview.ambient_primitives, 'editorial', registry);
    // ct-scene-breathe is cinematic-dark + editorial → should pass
    // ed-scene-breathe is editorial → should pass
    assert.ok(filtered.includes('ed-scene-breathe'), 'should include ed-scene-breathe');
    assert.ok(filtered.includes('ct-scene-breathe'), 'should include ct-scene-breathe (cinematic-dark + editorial)');
  });

  it('calm-overview ambient should exclude ed-scene-breathe for cinematic-dark', () => {
    const filtered = filterByPersonality(calmOverview.ambient_primitives, 'cinematic-dark', registry);
    assert.ok(!filtered.includes('ed-scene-breathe'), 'should exclude ed-scene-breathe from cinematic-dark');
    assert.ok(filtered.includes('ct-scene-breathe'), 'should keep ct-scene-breathe');
  });

  it('calm-overview companion entrance filters by personality', () => {
    // cd-focus-stagger = cinematic-dark, ed-slide-stagger = editorial
    const forEditorial = filterByPersonality(calmOverview.companion_entrance, 'editorial', registry);
    assert.ok(!forEditorial.includes('cd-focus-stagger'), 'should exclude cd-focus-stagger from editorial');
    assert.ok(forEditorial.includes('ed-slide-stagger'), 'should include ed-slide-stagger for editorial');

    const forCinematic = filterByPersonality(calmOverview.companion_entrance, 'cinematic-dark', registry);
    assert.ok(forCinematic.includes('cd-focus-stagger'), 'should include cd-focus-stagger for cinematic-dark');
    assert.ok(!forCinematic.includes('ed-slide-stagger'), 'should exclude ed-slide-stagger from cinematic-dark');
  });
});

// ── validate_choreography: blur enforcement ──────────────────────────────────

describe('blur enforcement', () => {
  const editorialForbidden = cameraGuardrails.personality_boundaries.editorial.forbidden_features;
  const neutralForbidden = cameraGuardrails.personality_boundaries['neutral-light'].forbidden_features;

  it('ed-blur-reveal should BLOCK against editorial (blur_entrance)', () => {
    const entry = registry.byId.get('ed-blur-reveal');
    assert.ok(entry, 'ed-blur-reveal should exist in registry');
    assert.equal(entry.category, 'Entrances', 'ed-blur-reveal should be in Entrances category');

    const violations = checkBlurViolations('ed-blur-reveal', entry, cameraGuardrails, editorialForbidden);
    assert.ok(violations.length > 0, 'should have at least one violation');
    assert.ok(
      violations.some(v => v.type === 'blur_entrance'),
      'should have blur_entrance violation'
    );
  });

  it('ct-camera-rack-focus should NOT block against editorial (camera blur, not entrance)', () => {
    const entry = registry.byId.get('ct-camera-rack-focus');
    assert.ok(entry, 'ct-camera-rack-focus should exist in registry');
    assert.notEqual(entry.category, 'Entrances', 'rack-focus should not be in Entrances category');

    const violations = checkBlurViolations('ct-camera-rack-focus', entry, cameraGuardrails, editorialForbidden);
    const blurEntranceViolations = violations.filter(v => v.type === 'blur_entrance');
    assert.equal(blurEntranceViolations.length, 0, 'should NOT have blur_entrance violation for rack-focus');
  });

  it('all blur_primitives should block against neutral-light (full blur ban)', () => {
    for (const id of cameraGuardrails.blur_primitives) {
      const entry = registry.byId.get(id);
      if (!entry) continue; // skip if not in registry
      const violations = checkBlurViolations(id, entry, cameraGuardrails, neutralForbidden);
      assert.ok(
        violations.some(v => v.type === 'blur'),
        `${id} should trigger blur violation for neutral-light`
      );
    }
  });

  it('cd-focus-stagger (blur entrance primitive) should block against editorial', () => {
    const entry = registry.byId.get('cd-focus-stagger');
    assert.ok(entry, 'cd-focus-stagger should exist');
    assert.equal(entry.category, 'Entrances');

    const violations = checkBlurViolations('cd-focus-stagger', entry, cameraGuardrails, editorialForbidden);
    assert.ok(
      violations.some(v => v.type === 'blur_entrance'),
      'cd-focus-stagger should trigger blur_entrance violation for editorial'
    );
  });
});

// ── blur_primitives data integrity ───────────────────────────────────────────

describe('blur_primitives data integrity', () => {
  it('all blur_primitives IDs should exist in the registry', () => {
    const missing = cameraGuardrails.blur_primitives.filter(id => !registry.byId.has(id));
    assert.deepEqual(missing, [], `blur_primitives references unknown IDs: ${missing.join(', ')}`);
  });

  it('ct-camera-rack-focus should be in blur_primitives (amplitude-based blur)', () => {
    assert.ok(
      cameraGuardrails.blur_primitives.includes('ct-camera-rack-focus'),
      'rack-focus uses blur and should be in the list'
    );
  });
});

// ── Tier 6: intent cross-reference ───────────────────────────────────────────

describe('Tier 6 intent cross-reference', () => {
  it('calm-overview expected primitives for neutral-light should be empty', () => {
    const mapping = intentMappings.byIntent.get('calm-overview');
    const expected = filterByPersonality(mapping.camera_primitives, 'neutral-light', registry);
    assert.equal(expected.length, 0, 'no camera primitives should be expected for neutral-light calm-overview');
  });

  it('should not flag missing primitives that are invalid for the personality', () => {
    const mapping = intentMappings.byIntent.get('calm-overview');
    const userPrimitives = []; // empty plan for neutral-light
    const expected = filterByPersonality(mapping.camera_primitives, 'neutral-light', registry);
    const missing = expected.filter(id => !userPrimitives.includes(id));
    assert.equal(missing.length, 0, 'no false-positive missing primitives for neutral-light');
  });
});

// ── parseDurationMs ──────────────────────────────────────────────────────────

describe('parseDurationMs', () => {
  it('parses simple ms values', () => {
    assert.equal(parseDurationMs('1400ms'), 1400);
    assert.equal(parseDurationMs('800ms'), 800);
  });

  it('parses ms values with loop suffix', () => {
    assert.equal(parseDurationMs('6000ms loop'), 6000);
  });

  it('returns null for empty/undefined', () => {
    assert.equal(parseDurationMs(null), null);
    assert.equal(parseDurationMs(undefined), null);
    assert.equal(parseDurationMs(''), null);
  });

  it('returns null for non-ms strings', () => {
    assert.equal(parseDurationMs('fast'), null);
  });
});
