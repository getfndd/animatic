/**
 * `enter` interaction kind — validation/spec drift regression (ANI-198).
 *
 * `figma_frame_to_scene` emits `semantic.interactions` of kind `enter`
 * (frame-to-scene.js). The kind has no `interactionToGroup` case, so it falls
 * to `default: return [baseGroup]` — but that group still expands through the
 * default `as-fadeInUp` entrance primitive (resolveEntrancePrimitive(undefined)),
 * so the compiled timeline already carries real opacity/translateY tracks.
 *
 * The defect this locks down is NOT motion: it was validation drift. `enter`
 * was emitted but absent from the hardcoded valid-kind lists, so an imported
 * scene *compiled* yet *failed* validation. This asserts both halves stay true:
 *   (a) `enter` is accepted by every validation site, and
 *   (b) it compiles to non-empty layer tracks (assert tracks, not `!== null`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateScene } from '../../src/remotion/lib.js';
import { VALID_KINDS } from '../lib/state-machines.js';
import { compileMotion } from '../lib/compiler.js';
import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadRecipes,
  loadShotGrammar,
} from '../data/loader.js';

/** Minimal v3 semantic scene with a single component driven by an `enter`. */
function enterScene() {
  return {
    scene_id: 'sc_enter_regression',
    format_version: 3,
    duration_s: 3,
    fps: 60,
    layers: [
      { id: 'hero_headline', type: 'html', content: '<div>Headline</div>' },
    ],
    semantic: {
      components: [
        {
          id: 'cmp_hero_headline',
          type: 'input_field',
          role: 'hero',
          layer_ref: 'hero_headline',
        },
      ],
      interactions: [
        {
          id: 'int_enter_hero',
          target: 'cmp_hero_headline',
          kind: 'enter',
          timing: { at_ms: 0 },
        },
      ],
      camera_behavior: { mode: 'reactive' },
    },
  };
}

describe('enter interaction kind (ANI-198)', () => {
  it('is registered at every hardcoded validation site', () => {
    // src/remotion/lib.js validateScene — the schema validator
    const v = validateScene(enterScene());
    assert.equal(
      v.valid, true,
      `enter must pass validateScene: ${v.errors.join('; ')}`,
    );
    // mcp/lib/state-machines.js VALID_KINDS — the state-machine validator
    assert.ok(
      VALID_KINDS.has('enter'),
      'state-machines VALID_KINDS must include enter',
    );
  });

  it('compiles to non-empty layer tracks via the default entrance primitive', () => {
    const catalogs = {
      primitives: loadPrimitivesCatalog(),
      personalities: loadPersonalitiesCatalog(),
      recipes: loadRecipes(),
      shotGrammar: loadShotGrammar(),
    };
    // compileSemantic mutates the scene in place — pass a deep copy.
    const timeline = compileMotion(structuredClone(enterScene()), catalogs);
    assert.ok(timeline, 'enter scene must compile to a static timeline');

    // The interaction targets the component's layer_ref.
    const track = timeline.tracks?.layers?.hero_headline;
    assert.ok(track, 'expected a layer track for hero_headline');
    assert.ok(
      Array.isArray(track.opacity) && track.opacity.length > 0,
      'enter must produce non-empty opacity keyframes (as-fadeInUp default)',
    );
  });
});
