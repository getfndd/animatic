# ANI-210 / ANI-211 gate seam plan

Status: plan only, no product code. Written against `origin/main` at `863478d`
(fix(mcp): formalize `enter` interaction kind across validation sites (ANI-198),
#113). Worktree: `~/.claude-worktrees/animatic/ani-210-gate-plan`, branch
`james/ani-210-gate-seam-plan`.

Parent: ANI-209. Clean-room note: everything below is written from the Linear
issue text; OpenMontage source was never opened.

## 0. Why one seam

ANI-210 (delivery-promise) and ANI-211 (slideshow-risk) both produce a pure,
deterministic, no-LLM verdict over the same rough inputs, and both must BLOCK
at the same two sites: `render_master`'s gate rollup and `runPreflight`. If
each issue wires itself in separately, the second PR to land either conflicts
with or silently drops the first gate's contribution to `block_reason`, the
"one predicate, two sites" failure this repo has hit before (STU-212). Slice 1
(ANI-210) builds a small named-gate registry; slice 2 (ANI-211) adds one
registration line to it. Neither issue's own scoring logic lives in the seam.

## 1. Seam contract

New file `mcp/lib/output-gates.js`. Named distinctly from `hero-frame.js`
(the pixel-quality gate, unaffected), these are content-honesty gates.

**Gate function shape:**
```js
// input:  { manifest, scenes, story_brief?, storyboard?, timelines?, tier? }
// output: { id, verdict: 'PASS'|'WARN'|'BLOCK', findings: [{severity, message, scene_id?, panel_id?}], evidence }
```
This mirrors what `auditHeroFrames` already returns
(`{ verdict, findings, evidence_summary, scenes }`, `hero-frame.js:481-489`);
`id` and `evidence` are the only additions, needed because a registry holds
more than one gate where hero-frame only ever had one caller.

**Registry** (`output-gates.js`): `registerGate(id, fn)` + `runOutputGates(input)`
runs every registered gate and rolls up BLOCK > WARN > PASS, joining
`block_reason` from whichever gate(s) blocked. Slice 1 registers
`delivery_promise`; slice 2 adds one line, `registerGate('slideshow_risk', scoreSlideshowRisk)`,
at the bottom of `output-gates.js` (an explicit, grep-able list rather than
import-time side effects scattered across files).

**Composing with the hero-frame verdict at `render_master`:** output gates are
sequence-level (a promise or a slideshow score doesn't change per aspect
ratio), so they run once per `composeCompileGate` call
(`render-master.js:169-222`), not once per emitted artifact. Their verdict
joins the same `VERDICT_RANK` max as the existing `gate_by_artifact` loop
(`:193-202`); `block_reason` (`:208-212`) becomes free text naming whichever
gate(s) blocked, hero-frame's existing `missing_evidence`/`below_threshold`
reasons, plus the new gates' own. The result object gains `output_gates:` next
to `gate_by_artifact:`; nothing about the existing per-artifact reporting in
`handleRenderMaster` (`handlers.js:3653`) needs to change.

**Composing at `runPreflight`:** the five existing checks
(`preflight.js:290-297`) use `pass/warn/fail`, not `PASS/WARN/BLOCK`. Rather
than rewrite them, add one more check, `checkOutputGates`, that calls
`runOutputGates` and translates BLOCK→fail, WARN→warn, PASS→pass. A `fail`
already aborts `render_project` under the existing
`if (!preflight.ok && !dry_run)` guard (`projects.js:740`), no new abort
logic. `runPreflight`'s `ctx` gains optional `scenes`, `storyBrief`,
`storyboard`, `tier` (the sceneDefs map is already built in `renderProject`
before the preflight call, `projects.js:696-707`, just not currently passed
through).

**Overrides:** preflight keeps the existing whole-preflight `skip_preflight`
boolean (`projects.js:675,733`), no new per-check flag. `render_master` has
no bypass for the hero-frame gate today: a BLOCK unconditionally sets
`emitted:false` and skips encode (`render-master.js:204`, `:356-364`, "fail-
closed, no encode"), while still returning the master "for inspection only."
Recommendation: give the new gates the same treatment, no bypass. Whether
that symmetry should ever get a break-glass path is an open question (§7).

**Why `composeMaster` itself is untouched:** it's a pure retime/finish/aspect
transform (`render-master.js:81-160`) that only asserts scene set/order is
unchanged (`assertNoReauthor`). It never inspects scene *content*, which is
what both gates judge. Gates belong in `composeCompileGate`, beside
`auditHeroFrames`, exactly where the issue text places them.

## 2. Every render entry point on `origin/main`

| Tool | Registry / handler / fn | Edge? | Reaches the seam? |
|---|---|---|---|
| `render_project` | `tools-registry.js:57` → `handleRenderProject` (`handlers.js:2649`) → `renderProject` (`projects.js:668`) | No (`tool-groups.js:155`) | **Yes**, via `runPreflight` (§1). Only tool that spawns `npx remotion render` directly. |
| `render_master` | `:96` → `handleRenderMaster` (`:3653`) → `renderMaster`/`composeCompileGate` (`render-master.js:254,169`) | No (`:132`) | **Yes**, via the rollup (§1). |
| `assemble_video_sequence` | `:106` → `handleAssembleVideoSequence` (`:3847`) → `assembleVideoSequence` (`video-assembly.js:35`) | **Yes** (`:140`) | **No, by design.** Pure manifest→command-string; never spawns Remotion itself. Downstream of `render_master` (`master-persist.js:193`), so its input already passed the gate. Gating it too would gate the same render twice. |
| `generate_video` | `:50` → `handleGenerateVideo` (`:2439`) → `generateVideo` (`video.js:162`) | No (`:159`) | **No, does not render.** Verified by running it (§5): its own comment calls it "a plan-and-critique pipeline, it does not render" (`video.js:203-206`); returns JSON, never touches disk/Remotion. This is the "rule-based generator" ANI-211's acceptance criterion means: run it, score its *output* with `scoreSlideshowRisk` as a standalone check (§5); no need to gate the tool itself. |
| `create_social_cutdown` | `:86` → `handleCreateSocialCutdown` (`:3298`) → `createSocialCutdown` (`social-formats.js:225`) | No (`:163`, "VERIFY") | **No, by design.** It's the explicit re-author fork (`render-master.js:14`: "anything else is a fork (create_social_cutdown)"), a 15s cutdown of a 60s video necessarily drops promised features on purpose. Gating it would BLOCK almost every cutdown for doing its job. |
| `preview_video` | `:107` → `handlePreviewVideo` (`:3801`) | No (`:156`) | **No.** Opens a local Remotion Studio server; produces no artifact to judge. |
| `auto_revise_loop` | `:100` → `handleAutoReviseLoop` (`:3748`) → `autoReviseLoop` (`scoring.js:717`) | No (`:162`, "VERIFY") | **Indirectly, via `render_master`.** `render_master`'s own `auto_revise` option calls this internally then re-runs the full gate via `composeCompileGate` (`render-master.js:264-300`), so it's covered when driven from there. As its own standalone tool it only re-runs hero-frame/evaluate scoring today; teaching it to react to the new gates' findings is ANI-211's own "optional follow-up" bullet, out of scope here (§7). |

Every entry point that ends in bytes on disk is covered. The three excluded
either don't render, or would contradict their own documented contract if
gated; both count as "why not" per the acceptance criterion.

## 3. Input availability at each site

### 3.1 What a project actually persists today

`initProject` seeds `entrypoints: { brief: 'brief/brief.md', storyboard:
'concept/storyboard.json', root_manifest: null, ... }` (`projects.js:127-165`).
`saveProjectArtifact`'s `kind` switch (`:439-460`) updates those entries,
**only when a caller explicitly calls `save_project_artifact`**. Verified by
reading the code, not assumed:

1. `entrypoints.brief` is markdown text, read via `readText`
   (`getProjectContext`, `:341-345`), **not** the structured `story_brief`
   object (`must_show_features`, `promise`, `proof_points`,
   `story-brief.js:270`). That structured object has **no persisted
   entrypoint at all** on `main`; it only exists as the in-memory value an
   agent passes from `extract_story_brief`'s return into `compose_storyboard`'s
   `story_brief` arg (`handlers.js:3498`) in the same turn.
2. `storyboard.json` IS persistable (`kind: 'storyboard'` exists), but only
   if the agent remembers to call `save_project_artifact` afterward.
3. **No code path turns `storyboard.panels[]` into `scene.layers`.** Grep
   confirms zero references to `storyboard` in `generator.js`/`planner.js`.
   The Polaris-style collapse happens because a human/agent hand-authors
   scenes *following* the storyboard as a spec, not because a function
   drops panel content. This is exactly why only a downstream gate can catch
   it; there is no upstream seam to fix instead.

### 3.2 `generate_video`'s brief is an unrelated shape

`video.js`'s `parsePrompt` (`:66-140`) builds its own ad hoc `brief` from
keyword matching, no `must_show_features`, no link to `story-brief.js`.
`generateScenes(brief, ...)` never touches `storyboard`. Confirmed by grep:
no hits in `video.js`/`generator.js`. So the rule-based generator's output
can be scored for slideshow-risk but never checked for delivery-promise:
it never had a promise to check against.

### 3.3 Decision to record on ANI-210: WARN vs BLOCK on missing inputs

| Site | `story_brief`? | `storyboard`? | `manifest`/`scenes`? |
|---|---|---|---|
| `render_project({project})` / `render_master({project})` | No, never persisted today, no read path | Only if saved AND the render path is taught to read `entrypoints.storyboard` (it isn't today) | Yes |
| `render_master({manifest,scenes})` inline | Only if caller passes new params | Same | Given directly |

**Recommendation:**
1. Add `story_brief` as a first-class persisted entrypoint: a `'story_brief'`
   `kind` in `saveProjectArtifact` writing `concept/story-brief.json`
   (mirrors `storyboard`'s location), plus the seed key in `initProject`.
2. Teach `renderProject`/`loadProjectSource`/`renderMaster` to
   opportunistically `readJSON` both (tolerating `null`, same pattern as
   `getProjectContext`, `:341-356`).
3. **Both absent → WARN, not BLOCK.** Every pre-existing project, and every
   project whose author simply didn't persist the planning artifacts (the
   default today, nothing forces it, §3.1), would otherwise BLOCK on every
   render for a reason unrelated to output quality.
   `checkDeliveryPromise` returns `WARN` + `evidence.checked === false` +
   a finding saying coverage wasn't checked. Mirrors hero-frame's
   `missingEvidence` pattern (an "I didn't look" finding), but at WARN
   because unlike pixel evidence (which the render step always controls),
   a missing brief is an upstream authoring choice this tool can't
   manufacture.
4. **Present and failing → BLOCK.** Unambiguous: the promise existed on disk
   and the scenes don't honor it.
5. Rejected alternative: BLOCK-on-missing, forcing every project to carry a
   brief before it can render. That's a much bigger product decision
   (should every render require a brief?) that would break every existing
   project and every brief-less quick-prototype flow; flagged for James
   rather than decided here.

This WARN/BLOCK split and the new persistence are the decisions ANI-210's
acceptance criteria ask to have recorded, they should go on the Linear issue
as a comment before slice 1 starts.

### 3.4 Matching a storyboard panel to a scene

Panels are built as `archetype.scenes.map((scene, i) => ...)`
(`compose-storyboard.js:113`), positional, 1:1 with the archetype's scene
list at composition time, with no guarantee the final `manifest.scenes[]`
preserves that order/count. `checkDeliveryPromise` checks two things:
(a) structural drift, does `manifest.scenes.length` still equal
`storyboard.panels.length`? A mismatch is its own WARN, since positional
matching becomes unreliable, not proof content was dropped; (b) feature
coverage, for each collection-type panel (`insight_cards`/`dashboard`/
`split_panel`, the constants already in `compose-storyboard.js:117-118`)
with `content` of length N, count "distinct content-bearing layers" in the
scene at that position; BLOCK naming missing features if under N.

**Caveat:** there is no `insight_cards` rendering primitive anywhere in
`generator.js` or the catalogs (grep confirms zero hits outside
`compose-storyboard.js`'s own vocabulary). So the count is necessarily a
generic layer-count heuristic, not a domain-aware "count the cards", no
code concept of a card exists yet to count. Flagged as an open question (§7).

## 4. Slice list

### Slice 1, ANI-210: seam + delivery-promise

**Files:** `mcp/lib/output-gates.js` (new, registry); `mcp/lib/delivery-promise.js`
(new, `checkDeliveryPromise`, pure); `mcp/lib/render-master.js`
(`composeCompileGate` gains the `runOutputGates` call, ~10-line diff at
`:193-215`; `renderMaster` gains optional `story_brief`/`storyboard` params);
`mcp/lib/preflight.js` (`checkOutputGates` added to `runPreflight`'s
`Promise.all`); `mcp/lib/projects.js` (`renderProject` passes `sceneDefs` +
opportunistic entrypoint reads into preflight `ctx`; `saveProjectArtifact`
gains `'story_brief'` kind; `initProject`'s seed gains the entrypoint key);
optionally `mcp/handlers.js`/`tools.js`/`tools-registry.js`/`tool-groups.js`
for a standalone `check_delivery_promise` tool (edge-ready, §6).

**Interface it depends on:** none upstream, it creates the `GateResult`
shape and registry that slice 2 depends on.

**Mergeability:** must land before slice 2; slice 2's `registerGate(...)`
call has nothing to register into otherwise. Not reorderable.

**Test plan:**
- Polaris-shaped fixture: `insight_cards` panel with `content:[f1..f4]`,
  matching scene collapsed to one `html` background div + one `text` layer
  (mirrors `generator.js:1115-1150`'s fallback shape) → `BLOCK` naming all
  four features.
- Same storyboard, faithful scene (4 distinguishable layers) → `PASS`.
- No `story_brief`/`storyboard` given → `WARN`, `evidence.checked === false`,
  never `BLOCK`.
- `runOutputGates` rollup unit test: one BLOCK + one PASS gate → `BLOCK`,
  `block_reason` names the blocking gate's `id`.
- `render_master` integration: inline Polaris-collapse fixture →
  `verdict:'BLOCK'`, `emitted:false`, `block_reason` contains `delivery_promise`.
- `preflight`/`render_project` integration: on-disk project fixture with
  persisted `story_brief.json`+`storyboard.json` and a collapsed scene →
  `error: 'Preflight failed...'` (no `skip_preflight`), `preflight.checks`
  has an `output_gates` entry with `status:'fail'`.

### Slice 2, ANI-211: slideshow-risk

**Files:** `mcp/lib/slideshow-risk.js` (new, `scoreSlideshowRisk`, composes
`evaluateSequence` (`evaluate.js:937`), `auditMotionDensity` per scene
(`motion-density.js:29`), `critiqueSemanticScene` per v3 scene
(`semantic-critic.js:50`), plus the four new sub-scores from the issue);
`mcp/lib/output-gates.js` (one `registerGate('slideshow_risk', ...)` line,
no other seam file touched, which is the point of slice 1 existing first);
optionally a standalone `score_slideshow_risk` tool (same treatment as
slice 1). **Prerequisite repair bundled into this slice, not a separate
ticket** (see §5.1): `motion-density.js`'s `normalizeLayers` (`:198-217`)
must add a `timeline.tracks.layers` branch, additive, doesn't touch the
existing array-shape branch or its tests, before calibration means anything.

**Interface it depends on:** slice 1's registry and `GateResult` shape.

**Mergeability:** must land after slice 1. `slideshow-risk.js` itself can be
developed and unit-tested independently, but the `registerGate` call and the
`render_master`/`preflight` wiring can't merge until slice 1 is on `main`.

**Test plan:**
- All 14 `catalog/benchmarks/*.json` (`loadBenchmarks()`,
  `mcp/data/loader.js:222`), each wrapped as a synthetic one-scene manifest
  → all score `strong`/`acceptable` (issue's acceptance criterion). Assert
  the per-scene sub-scores specifically, not just the band, since single-
  scene fixtures trivially pass the sequence-level sub-scores (§5.3).
- `generateVideo(..., {enhance:false})`'s real 6-scene output (§5.2), frozen
  as a checked-in fixture rather than calling the live pipeline from a test
  → scores `revise`/`fail`.
- Unit test per new sub-score against small hand-built manifests.
- `render_master`/`preflight` integration mirroring slice 1's, using a
  manifest that trips `slideshow_risk` but not `delivery_promise` (proves
  independence, not a merged predicate).

## 5. Calibration, run against real code

Run for real in this worktree (`npm install`, 422 packages, no code changes);
numbers below are copied from actual output, not simulated.

### 5.1 Finding: `motion-density.js` can't see `compileMotion`'s real shape

Compiling `catalog/benchmarks/cinematic-dark-hero.json` with `compileMotion`
returns `{ tracks: { camera, layers: { bg: {opacity:[...]}, headline: {...}, ... } } }`,
that is, `timeline.tracks.layers`, an object keyed by id (`compiler.js:108,160`).
`normalizeLayers` (`motion-density.js:198-217`) only reads `timeline.layers`
as an **array**; that key doesn't exist on a real compiled timeline, so every
call falls through to the `scene.layers` fallback, whose entries have no
`.keyframes`/`.animations` field. Result: `auditMotionDensity` scored
**0 for all 14 benchmarks**, including scenes with five staggered animated
layers. `mcp/test/motion-density.test.js`'s `makeTimeline()` (`:15-19`)
hand-builds `{layers:[...]}` directly and has never exercised the real
`compileMotion` shape, unit tests pass while the integration path is
silently dead. `scoring.js:663-667`'s comment shows the *reactive*-mode gap
was known ("Reactive descriptors carry no tracks...") but the ordinary
tracks-based case, the majority shape, wasn't. This is a pre-existing
defect in the exact signal ANI-211 must reuse; calibrating on a
100%-degraded signal would bake nonsense into the bands, so it's a slice-2
prerequisite (§4), not deferred.

### 5.2 Real distributions

14 gold benchmarks, static-layer ratio recomputed against `tracks.layers`:
13/14 score **0.0** (fully animated, as a gold set should); the 14th
(`bench_cinematic_dark_lib_stagger`) is a reactive/compound scene where
`compileMotion` returns `{mode:'reactive', contentCount}` with no per-layer
breakdown at all, so a naive diff misreads it as 100% static, a shape gap
the new sub-score must special-case (treat reactive scenes as
verified-animated, matching `scoring.js:663-667`'s existing carve-out) rather
than a real finding. Text-only-scene ratio: 10/14 (71%), **not a usable
discriminator alone**, since it's common even in gold scenes
(editorial/tagline personalities are legitimately typography-forward).
Background+single-text-layer: 1/14 (7%, `bench_ed_tagline`, a deliberate
single-card moment).

`generateVideo('...60s product launch, six scenes, prestige style...', {enhance:false})`,
run for real: 6/6 scenes text-only, 4/6 background+single-text-layer, 2/6 have
**zero text or motion** (a bare background div, exactly the
"solid html background div" collapse in `generator.js:1115-1135`), mean
static-layer ratio **0.67** (vs 0.0 gold), `hero-center` template reused 3/6
times (50% repetition), `evaluateSequence`'s own score 62 with two scenes
flagged "no motion block (v1 scene)".

**Threshold direction from this data:** weight `static_layer_ratio` and
`bg_plus_single_text_ratio` heavily (0.0/0.07 gold vs 0.67/0.67 generated-bad,
a wide separation); weight raw `text_only_ratio` lightly or not at all as its
own dimension (71% gold vs 100% bad, narrow, would false-positive on
typography-forward personalities). Text-only alone doesn't discriminate;
text-only **combined with** static/bg-only does. Not final, see 5.3.

### 5.3 What couldn't be calibrated, and why

The 14 benchmarks are individual gold **scenes**, built for the motion-
compiler/critic benchmark suite (`benchmark.js`'s own docstring), not full
sequence **manifests**. Two of the six sub-scores are structurally
sequence-level, `layout_template_repetition` (needs ≥2 scenes) and a
meaningful `text_only_scene_ratio` (a ratio needs a denominator > 1;
`evaluateSequence`'s own `scoreVariety` short-circuits to 100 at ≤2 scenes
for the same reason, `evaluate.js:378-383`), and can't be calibrated against
14 independent single-scene fixtures. The one full-manifest sample (the
`generateVideo` run above) is one data point, not a distribution.
Recommend, before locking numeric band edges: run `generateVideo` several
more times (varied prompts/styles, `enhance:true` and `false`) to get 4-6
more manifests spanning good-to-bad. This plan reports the real per-scene
distribution and one real bad-manifest sample; it does not manufacture a
false multi-manifest distribution out of single-scene data.

## 6. Edge / hosted surface

`render_master` (`edgeReady:false`, `:132`) and `render_project`
(`:155`) stay local for reasons unrelated to these gates (project-disk
access, Remotion spawn), wiring two more pure checks into them changes
neither's edge status. `assemble_video_sequence` (`:140`, edge-ready) isn't a
gate site (§2). Composed signals are already edge-ready:
`evaluate_sequence` (`:93`), `audit_motion_density` (`:114`); semantic-critic
has no standalone tool on `main` (no hit in `tools-registry.js`/
`tool-groups.js`, reached only via `critic.js` → `evaluate_sequence`'s
motion dimension), so nothing new to classify there. `score_hero_frame`
(`:130`, edge-ready) and `audit_hero_frames` (`:131`, local) are a separate
gate, untouched.

The two **optional standalone tools** proposed (§4) are different: inline
`manifest`/`scenes`/`story_brief`/`storyboard` args only, no `project` slug
(mirroring `evaluate_sequence`'s existing inline-only contract), never touch
disk, call only already-edge-ready functions plus new pure arithmetic.
Recommend `edgeReady:true`, matching `evaluate_sequence`/`audit_motion_density`'s
precedent, so `/direct` can call them mid-loop from the hosted surface (the
issue's stated motivation). If either implementation later grows a
disk-reading convenience param (resolve `story_brief` from a `project`
slug), that param must go in `stripParams` per the registration contract
(`tool-groups.js:26-33`), flagged for review, not decided here.

## 7. Risks and open questions for James

1. The `story_brief` persistence gap (§3.1, §3.3) predates this plan and is
   only partly closed by adding a `kind`. Should `compose_storyboard`'s
   handler auto-persist both artifacts when a `project` param is given,
   instead of relying on a second explicit `save_project_artifact` call?
   Bigger behavior change than this plan assumes.
2. WARN-on-missing (§3.3) is a recommendation, not settled, it's a
   loophole an author can use forever by never persisting a brief. Suggest
   logging how often `output_gates` fires WARN-for-missing vs
   BLOCK-for-violation once shipped, before deciding whether to tighten it.
3. The `motion-density.js` shape fix (§5.1) is scoped into slice 2 rather
   than filed separately, it's small, but it's a pre-existing defect
   outside either issue's stated scope. Say so if it should be its own
   tracked ticket instead.
4. The layer-count heuristic for feature coverage (§3.4) has no domain
   concept to anchor to (no `insight_cards` primitive exists). Acceptable
   for v1, with a follow-up to add an explicit `items`/`count` field to
   collection-type layers? Or should that formalization block ANI-210?
5. `render_master` has no bypass for any gate today (§1); this plan keeps
   that symmetry for the new gates. Confirm a BLOCK should stay
   unconditionally fail-closed as more gates accumulate, or whether a
   break-glass path is needed eventually.
6. Band edges in §5.2/5.3 are provisional, real signal, small sample.
   Run more `generateVideo` calls before locking numbers into the PR.
7. Not verified in this plan: whether `auto_revise_loop` should react to
   these gates' findings as revision targets (ANI-211's own "optional
   follow-up," left open); and no end-to-end `npx remotion render` was run
   against a BLOCK-ing project this session (requires the local toolchain
   and produces real render artifacts, out of scope for a plan-only task).
