# Polaris Loop Run — Integration Gaps Surfaced (2026-05-08)

## Test goal
Validate yesterday's lib-* hardening (PRs #52–#56) end-to-end through the
autonomous direction loop. Did a lib-* primitive surface naturally?
**No.** The discovery layer knows about lib-*, but the loop's planning and
scoring layers don't pull through to it.

## What was tested
- Fresh project: `polaris-observability`, cinematic-dark, prestige
- Brief biased toward a 4-pillar dramatic reveal (Trace, Detect, Resolve, Learn)
- Standard /direct steps 1–5 (extract → plan beats × 3 → plan_sequence × 3 → score)
- After observing no lib-* in beat plans, hand-injected a lib-gsap-spring-stagger
  scene (`sc_02_features`) to test downstream wiring on prestige candidate.
- Direct critic + render-routing checks on the lib-* scene in isolation.

## Findings

### What worked (confirmation of yesterday's PRs at the leaves)
1. **`recommend_choreography` surfaces lib-***: cinematic-dark + dramatic-reveal
   + subject_count=4 returns `lib-gsap-spring-stagger` and `lib-gsap-radial-stagger`
   under "Companion Entrances". Discovery layer wired correctly.
2. **`resolve_render_targets` handles lib-* scenes**: sc_02_features routed to
   `remotion_native` (0.50, source: default). No personality_compat warning.
   ANI-118's manifest-override path didn't need to fire here, but the routing
   itself didn't crash on `motion.compound`.
3. **`plan_sequence` preserves `motion.compound`**: the manifest references
   scenes by id; the lib-* metadata stays on the scene definition. Downstream
   consumers see it.

### Integration gaps (yesterday's work doesn't reach the loop)

**Gap 1 — Beat planner doesn't consult choreography recommender.**
All three beat plans (brand-teaser, launch-reel, feature-reveal) returned
recommended_primitives lists with zero lib-* entries. Pool is hardcoded per
role/personality. The beat planner has its own primitive lookup separate
from `recommend_choreography`.
→ Investigation target: `mcp/lib/story-beats.js`

**Gap 2 — `compile_motion` MCP tool isn't reactive-aware.**
The benchmark runner at `mcp/lib/benchmark.js:77-82` detects `motion.compound`
and passes `{ mode: 'reactive' }` + `catalogs` to `compileMotion`. The MCP
tool's schema has neither `mode` nor `catalogs` parameters. Calling
`compile_motion` on a lib-* scene returns an empty static timeline (zero
tracks, zero camera). Reactive descriptor never produced.

**Gap 3 — `score_candidate_video` → per-scene critic runs statically on lib-*.**
Direct consequence of Gap 2. Score card on the prestige candidate flagged all
5 layers of `sc_02_features` as `orphan_layer` ("defined in scene but has no
animation tracks"), even though `motion.compound` covers them. PR #53's
reactive-aware orphan_layer suppression never fires outside the benchmark
runner. Scene still scored 0.88 ("Good") — best per-scene score in the
candidate — but the warnings are noise that revision loops would chase.

### Other findings (not lib-*-specific, but surfaced by the run)

**Finding 4 — `generate_scenes` collapses multi-subject sections.**
Brief had a Features section with 4 explicit `subjects` (the 4 pillars).
generate_scenes produced a single text layer reading "Four pillars, one
platform: Trace, Detect, Resolve, Learn." `subjects` was ignored. Reproduces
the design-gap memory: brief → scene JSON loses semantic structure.

**Finding 5 — `plan_sequence` reorders scenes incorrectly.**
Input order: 0,1,2,3,4 (hero, product, features, social_proof, cta).
Output order across all 3 strategies: 0,1,3,2,4 — features after social proof.
That's narratively wrong; features should precede social proof.
Likely from a "weight balancing" rule overriding source order.

**Finding 6 — `plan_sequence` ignores `duration_target_s`.**
Brief target: 28s. Plans returned: prestige 12.9s, energy 8.1s, dramatic 14.1s.
Style-pack hold presets dominate; the brief's duration target is dropped on
the floor.

## Recommended tickets

- **ANI-?? (P0):** Thread `mode: 'reactive'` + `catalogs` through the autonomous
  loop's compile/critique path. Closes Gaps 2 + 3 together. Scope: probably
  `score_candidate_video` and either `compile_motion`'s MCP schema or its
  internal auto-detection of `motion.compound`.
- **ANI-?? (P1):** Have `plan_story_beats` consult `recommend_choreography`
  (or merge its companion-entrance pool into recommendations). Closes Gap 1
  and gives the autonomous loop a path to select lib-* without manual injection.
- **ANI-?? (P2):** `plan_sequence` should honor `duration_target_s` (or stretch
  hold durations proportionally) and shouldn't reorder scenes against source
  order without a documented continuity reason. Findings 5 + 6.
- **ANI-?? (P2):** `generate_scenes` should respect a multi-subject `subjects:
  []` field on a section (or document that the field is unused). Finding 4.

## Verdict on yesterday's work

PRs #52–#56 are **internally correct**. They pass their own tests. The bench-
mark at `catalog/benchmarks/cinematic-dark-lib-stagger.json` exercises every
layer of the lib-* tier and passes.

But the autonomous loop has **three integration gaps** between yesterday's
hardening and the loop's surface. Without a manual lib-* injection, the loop
cannot pull through to the new code. This is the integration validation Saul
predicted — done its job, found something real.

Pre-condition for next /direct run on a real brief: close Gaps 1–3, otherwise
the loop will continue to silently route around lib-* and accrete noisy
orphan_layer warnings on any compound scene it does encounter.
