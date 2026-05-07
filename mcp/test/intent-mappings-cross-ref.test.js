/**
 * Cross-reference test for catalog/intent-mappings.json (ANI-143 follow-up).
 *
 * Every primitive id referenced by an intent (camera, ambient, companion
 * entrance) must resolve to a real REGISTRY.md entry — otherwise
 * recommend_choreography surfaces "(not in registry)" placeholders to the
 * user, which is silent drift.
 *
 * This test caught the gap that motivated the wiring work: the new
 * lib-gsap-spring-stagger and lib-framer-spring-stagger compound primitives
 * weren't reachable via any intent until they were added here.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadIntentMappings,
  parseRegistry,
} from '../data/loader.js';

const CROSS_REF_FIELDS = ['camera_primitives', 'ambient_primitives', 'companion_entrance'];

describe('intent-mappings cross-references', () => {
  const intents = loadIntentMappings();
  const registry = parseRegistry();

  it('every primitive id referenced by an intent resolves to REGISTRY.md', () => {
    const missing = [];
    for (const intent of intents.array) {
      for (const field of CROSS_REF_FIELDS) {
        for (const primId of intent[field] || []) {
          if (!registry.byId.has(primId)) {
            missing.push(`${intent.intent}.${field}: "${primId}"`);
          }
        }
      }
    }
    assert.equal(missing.length, 0,
      `intent-mappings references primitives not in REGISTRY.md:\n  - ${missing.join('\n  - ')}`);
  });

  it('library-driven compound primitives are reachable from at least one intent', () => {
    const libIds = ['lib-gsap-spring-stagger', 'lib-framer-spring-stagger'];
    for (const id of libIds) {
      const reachable = intents.array.some(i =>
        CROSS_REF_FIELDS.some(f => (i[f] || []).includes(id))
      );
      assert.ok(reachable,
        `${id} is in REGISTRY.md but no intent references it — recommend_choreography won't surface it`);
    }
  });

  it('every primitive referenced by an intent has at least one matching personality', () => {
    // If an intent supports only [editorial] but lists a primitive that's
    // only [cinematic-dark], filterByPersonality will drop it and the user
    // sees an empty section — silent guidance failure.
    const orphans = [];
    for (const intent of intents.array) {
      for (const field of CROSS_REF_FIELDS) {
        for (const primId of intent[field] || []) {
          const entry = registry.byId.get(primId);
          if (!entry) continue; // covered by previous test
          const overlap = entry.personality.some(p =>
            intent.personality_support.includes(p) || p === 'universal'
          );
          if (!overlap) {
            orphans.push(
              `${intent.intent} [${intent.personality_support.join(',')}] -> ` +
              `${primId} [${entry.personality.join(',')}]`
            );
          }
        }
      }
    }
    assert.equal(orphans.length, 0,
      `intent/primitive personality mismatch (primitive will be filtered out at runtime):\n  - ${orphans.join('\n  - ')}`);
  });
});
