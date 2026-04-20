/**
 * Tests for motion recipes catalog (ANI-134).
 *
 * Validates catalog/motion-recipes.json against catalog/motion-recipes.schema.json.
 * Enforces the invariants that block downstream tickets:
 *   - every recipe has a non-empty reduced-motion variant with differentiation text
 *   - css-subset recipes use only opacity + transform tokens
 *   - spring easings are framer-only
 *   - IDs follow category.intent namespacing
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(__dirname, '../../catalog');

const recipes = JSON.parse(readFileSync(resolve(CATALOG, 'motion-recipes.json'), 'utf8'));
const schema = JSON.parse(readFileSync(resolve(CATALOG, 'motion-recipes.schema.json'), 'utf8'));

const CSS_PORTABLE_KEYS = new Set(['opacity', 'x', 'y', 'scale', 'rotate']);
const ID_PATTERN = /^(enter|exit|attention|state|route)\.[a-z][a-z0-9-]*$/;
const VALID_RUNTIMES = new Set(['framer-motion', 'css-subset']);

describe('motion-recipes.json — shape', () => {
  it('is a non-empty array', () => {
    assert.ok(Array.isArray(recipes));
    assert.ok(recipes.length >= 6, `expected ≥6 recipes, got ${recipes.length}`);
  });

  it('has unique IDs', () => {
    const ids = recipes.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate recipe ID found: ${ids}`);
  });

  it('each recipe has all required fields', () => {
    const required = schema.definitions.recipe.required;
    for (const recipe of recipes) {
      for (const field of required) {
        assert.ok(recipe[field] !== undefined, `${recipe.id} missing required field: ${field}`);
      }
    }
  });
});

describe('motion-recipes.json — IDs', () => {
  it('every ID follows category.intent namespacing', () => {
    for (const recipe of recipes) {
      assert.match(recipe.id, ID_PATTERN, `${recipe.id} does not match ${ID_PATTERN}`);
    }
  });

  it('v0 covers the six acceptance-criteria recipes', () => {
    const ids = new Set(recipes.map(r => r.id));
    const required = ['enter.fade-up', 'enter.fade-in', 'exit.fade-down', 'enter.slide-right', 'attention.pulse', 'state.error'];
    for (const id of required) {
      assert.ok(ids.has(id), `v0 recipe missing: ${id}`);
    }
  });
});

describe('motion-recipes.json — runtime scope', () => {
  it('every recipe declares at least one runtime', () => {
    for (const recipe of recipes) {
      assert.ok(recipe.runtime_scope.length >= 1, `${recipe.id} has empty runtime_scope`);
      for (const runtime of recipe.runtime_scope) {
        assert.ok(VALID_RUNTIMES.has(runtime), `${recipe.id} has unknown runtime: ${runtime}`);
      }
    }
  });

  it('css-subset recipes use only opacity + transform keys in tokens', () => {
    for (const recipe of recipes) {
      if (!recipe.runtime_scope.includes('css-subset')) continue;
      const frames = [recipe.tokens.from, recipe.tokens.to];
      for (const frame of frames) {
        for (const key of Object.keys(frame)) {
          assert.ok(
            CSS_PORTABLE_KEYS.has(key),
            `${recipe.id} declares css-subset but uses non-portable key "${key}" in tokens`,
          );
        }
      }
    }
  });

  it('spring easing is framer-only (excludes css-subset)', () => {
    for (const recipe of recipes) {
      const easing = recipe.tokens.easing.toLowerCase();
      if (!easing.includes('spring')) continue;
      assert.ok(
        !recipe.runtime_scope.includes('css-subset'),
        `${recipe.id} uses spring easing but declares css-subset — springs cannot be expressed in CSS`,
      );
    }
  });
});

describe('motion-recipes.json — accessibility', () => {
  it('every recipe has a reduced-motion fallback with differentiation text', () => {
    for (const recipe of recipes) {
      const reduced = recipe.accessibility_fallback?.reduced_motion;
      assert.ok(reduced, `${recipe.id} missing reduced_motion fallback`);
      assert.ok(reduced.from && Object.keys(reduced.from).length > 0, `${recipe.id} reduced_motion.from is empty`);
      assert.ok(reduced.to && Object.keys(reduced.to).length > 0, `${recipe.id} reduced_motion.to is empty`);
      assert.ok(
        reduced.differentiation && reduced.differentiation.length >= 10,
        `${recipe.id} reduced_motion.differentiation must explain how intent is preserved`,
      );
    }
  });

  it('reduced-motion variant is not silent — from and to differ', () => {
    for (const recipe of recipes) {
      const { from, to } = recipe.accessibility_fallback.reduced_motion;
      assert.notDeepEqual(from, to, `${recipe.id} reduced_motion.from === to — silent fallback hides the intent`);
    }
  });

  it('state.* recipes preserve error/status communication in reduced-motion', () => {
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

describe('motion-recipes.json — interrupt contract', () => {
  it('every recipe declares on_cancel and on_reverse', () => {
    const validCancel = new Set(['snap-to-target', 'hold-current', 'snap-to-origin']);
    const validReverse = new Set(['reverse-time', 'restart-reversed', 'snap-to-origin']);
    for (const recipe of recipes) {
      const ic = recipe.interrupt_contract;
      assert.ok(validCancel.has(ic.on_cancel), `${recipe.id} has invalid on_cancel: ${ic.on_cancel}`);
      assert.ok(validReverse.has(ic.on_reverse), `${recipe.id} has invalid on_reverse: ${ic.on_reverse}`);
    }
  });
});
