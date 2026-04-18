/**
 * Golden manifests (ANI-110)
 *
 * Structural snapshots of `planStoryBeats` output across archetypes.
 * Catches regressions in archetype catalogs, duration math, camera-intent
 * resolution, continuity inference, and semantic_recommendation seeding
 * (ANI-116) that unit tests on individual helpers miss.
 */

import { describe, it } from 'node:test';

import { planStoryBeats } from '../../lib/story-beats.js';
import { assertMatchesGolden } from './helpers.js';

// A single fixed brief is reused across archetypes so the snapshot reflects
// differences in the *archetype*, not in the brief. Duration is pinned so
// beat durations are deterministic.
const FIXED_BRIEF = {
  audience: 'Design teams',
  promise: 'Precision + freedom for creative work',
  emotional_tone: 'aspirational',
  must_show_features: ['Real-time collaboration', 'Infinite canvas', 'Smart constraints'],
  proof_points: ['Used by 50,000+ design teams'],
  closing_beat: 'logo_lockup',
  narrative_template: 'brand-teaser',
  inferred_personality: 'cinematic-dark',
  inferred_style_pack: 'prestige',
  duration_target_s: 25,
  scene_count: 5,
};

// Cherry-picked archetypes with distinct shapes:
// - brand-teaser: mostly non-interactive roles (no semantic_recommendation)
// - feature-reveal: reveal + interactive roles (recommendations present)
// - launch-reel: energy-driven montage pacing
const ARCHETYPES = ['brand-teaser', 'feature-reveal', 'launch-reel'];

describe('golden: planStoryBeats manifests', () => {
  for (const slug of ARCHETYPES) {
    it(`${slug} produces the expected beat plan`, () => {
      const plan = planStoryBeats({
        story_brief: FIXED_BRIEF,
        archetype_slug: slug,
        options: { duration_target_s: 25 },
      });
      assertMatchesGolden(`manifests/${slug}.beats`, plan);
    });
  }
});
