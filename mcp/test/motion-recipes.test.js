/**
 * Tests for motion recipes catalog (ANI-134).
 *
 * Two layers of validation:
 *   1. Full JSON Schema validation via Ajv — catches required fields, enum
 *      violations, additionalProperties, pattern mismatches, uniqueItems, etc.
 *   2. Hand-rolled invariant checks — for conditional rules JSON Schema can't
 *      express (css-subset key restrictions, silent-fallback detection,
 *      state.* communication requirements).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Ajv from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(__dirname, '../../catalog');

const recipes = JSON.parse(readFileSync(resolve(CATALOG, 'motion-recipes.json'), 'utf8'));
const schema = JSON.parse(readFileSync(resolve(CATALOG, 'motion-recipes.schema.json'), 'utf8'));

const CSS_PORTABLE_KEYS = new Set(['opacity', 'x', 'y', 'scale', 'rotate']);

const ajv = new Ajv({ allErrors: true, strict: false });
const validateCatalog = ajv.compile(schema);
const validateRecipe = ajv.compile({ ...schema.definitions.recipe, definitions: schema.definitions });

describe('motion-recipes.json — JSON Schema validation', () => {
  it('the full catalog validates against motion-recipes.schema.json', () => {
    const valid = validateCatalog(recipes);
    assert.ok(
      valid,
      `schema validation failed:\n${JSON.stringify(validateCatalog.errors, null, 2)}`,
    );
  });

  it('each recipe validates individually (sharper error messages)', () => {
    for (const recipe of recipes) {
      const valid = validateRecipe(recipe);
      assert.ok(
        valid,
        `${recipe.id} failed schema:\n${JSON.stringify(validateRecipe.errors, null, 2)}`,
      );
    }
  });

  it('v0 ships the six acceptance-criteria recipes', () => {
    const ids = new Set(recipes.map(r => r.id));
    const required = ['enter.fade-up', 'enter.fade-in', 'exit.fade-down', 'enter.slide-right', 'attention.pulse', 'state.error'];
    for (const id of required) {
      assert.ok(ids.has(id), `v0 recipe missing: ${id}`);
    }
  });

  it('has unique IDs', () => {
    const ids = recipes.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate recipe ID found: ${ids}`);
  });
});

// Hand-rolled invariants — JSON Schema cannot express conditional constraints
// (if runtime_scope includes 'css-subset' then keyframe keys ⊂ {opacity, transform}),
// nor cross-field checks (reduced_motion.from !== reduced_motion.to).

describe('motion-recipes.json — css-subset runtime restriction', () => {
  it('css-subset recipes use only opacity + transform keys in tokens.from/to', () => {
    for (const recipe of recipes) {
      if (!recipe.runtime_scope.includes('css-subset')) continue;
      for (const frame of [recipe.tokens.from, recipe.tokens.to]) {
        for (const key of Object.keys(frame)) {
          assert.ok(
            CSS_PORTABLE_KEYS.has(key),
            `${recipe.id} declares css-subset but tokens uses non-portable key "${key}"`,
          );
        }
      }
    }
  });

  it('css-subset recipes use only opacity + transform keys in reduced_motion.from/to', () => {
    for (const recipe of recipes) {
      if (!recipe.runtime_scope.includes('css-subset')) continue;
      const reduced = recipe.accessibility_fallback.reduced_motion;
      for (const frame of [reduced.from, reduced.to]) {
        for (const key of Object.keys(frame)) {
          assert.ok(
            CSS_PORTABLE_KEYS.has(key),
            `${recipe.id} declares css-subset but reduced_motion uses non-portable key "${key}" — CSS consumers honoring reduced-motion would violate the declared contract`,
          );
        }
      }
    }
  });

  it('spring easing excludes css-subset (springs are framer-only)', () => {
    for (const recipe of recipes) {
      if (!recipe.tokens.easing.toLowerCase().includes('spring')) continue;
      assert.ok(
        !recipe.runtime_scope.includes('css-subset'),
        `${recipe.id} uses spring easing but declares css-subset`,
      );
    }
  });
});

describe('motion-recipes.json — accessibility invariants', () => {
  it('reduced-motion variant is not silent — from and to differ', () => {
    for (const recipe of recipes) {
      const { from, to } = recipe.accessibility_fallback.reduced_motion;
      assert.notDeepEqual(
        from,
        to,
        `${recipe.id} reduced_motion.from === to — silent fallback hides the intent`,
      );
    }
  });

  it('state.* recipes still communicate state in reduced-motion (no translation-only fallbacks)', () => {
    for (const recipe of recipes) {
      if (!recipe.id.startsWith('state.')) continue;
      const reduced = recipe.accessibility_fallback.reduced_motion;
      const keys = new Set([...Object.keys(reduced.from), ...Object.keys(reduced.to)]);
      const communicatesNonMotion = keys.has('border_color') || keys.has('opacity');
      assert.ok(
        communicatesNonMotion,
        `${recipe.id} reduced_motion must communicate state via border_color or opacity, not translation alone`,
      );
    }
  });
});
