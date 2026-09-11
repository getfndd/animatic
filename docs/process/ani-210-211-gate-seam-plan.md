# ANI-210 / ANI-211 gate seam plan (round 3, narrowed)

Status: plan only, no product code. Round 2 (`42bd260`) was rejected by a
read-only Codex review. James's scope decision (2026-09-11): most round-2
findings landed in machinery built to answer round 1 (a normalizer, override
recording spread across three artifact types), or in prerequisites this
issue doesn't own (panel-identity threading). Round 3 narrows the claim
instead of hardening more machinery. This is the review cap; no round 4.
Worktree: `~/.claude-worktrees/animatic/ani-210-gate-plan`, branch
`james/ani-210-gate-seam-plan`. Clean-room note unchanged: OpenMontage
source was never opened.

## 0. The narrowed claim

**Old claim (rounds 1-2): "the render honors the brief."** Too broad to
verify: it implied panel-level promise checking that has no code-level
binding to rely on, and a normalizer whose output could drift from what
Remotion actually encodes.

**New claim: encoded-props feature presence, with disclosed unverifiable
panels.** The gate inspects the exact render-props object/file that is
about to be handed to `npx remotion render`, checks whether each
`story_brief.must_show_features[]` entry's text appears inside a layer type
`SceneComposition` actually renders, anywhere in that props payload, and
reports `PASS`/`BLOCK` on that narrow question only. Storyboard-panel-level
promises (a specific panel promised N items) are reported `WARN` +
`unverifiable`, never `PASS`, because no code path binds a panel to the
scene meant to satisfy it. Every contract, test, and function name below
says this, not the broader claim.

## 1. What round 2 built that this round deletes

- **Deleted: `normalizeGateInput`/"always compile."** It wasn't idempotent
  (`compileAllScenes` re-running `compileSemantic` on an already-compiled
  scene prepends a second copy of the generated motion groups,
  `compiler.js:1108`-adjacent) and it inspected content `render_project`
  never actually renders (raw `sceneDefs` with no timelines,
  `projects.js:695-799`), not the compiled shape the normalizer produced. §2
  replaces it: no compilation step, ever, inside the gate.
- **Deleted: panel-to-scene binding as a PASS-capable mechanism.** Round 2
  still let a `panel_id` match win a confident `PASS`. §5 replaces this with
  disclosure-only: no binding this plan can build makes a panel promise
  verifiable, so none may ever resolve to `PASS`.
- **Deleted: the `.meta.json`-vs-`project.json.overrides[]` split.** §7
  keeps one visibility target, widened to include the encoded artifact
  itself, not two.
- **Kept, adjusted:** per-artifact evaluation (unchanged, already correct);
  the override record shape (unchanged fields, tightened sequencing); the
  compound-layer inventory (narrowed to what actually renders, §4); the
  residual-bypass list (widened, §8); the motion-density defect (now a
  committed, runnable repro, §10, and corrected for the reactive case).

## 2. Gate input: the exact encoded props, no normalizer

Two, and only two, functions ever produce the file `npx remotion render`
reads via `--props`:

- **`render_project`:** `renderRemotionSequence(props, outputPath, opts)`
  (`mcp/lib/video.js`, the `renderRemotionSequence` section). When
  `opts.propsPath` is absent, it `JSON.stringify`s its own `props` parameter
  into a fresh temp file and points Remotion at that file. `props` IS what
  gets encoded; there is no transform in between. `render_project` builds
  `props = { manifest, sceneDefs }` from raw, uncompiled data
  (`projects.js:696-725`), so the gate reads exactly that: raw `layers` for
  a v2 scene, raw `semantic.components` for a v3 scene with `layers: []`.
  Nothing is recompiled to "fix" this; it's what's actually rendered.
- **`render_master`'s `encode` path:** `encodeMaster` (`master-persist.js`)
  calls `assembleVideoSequence` (`video-assembly.js:121-126`) to write
  `render-props.json` to disk (the ANI-185 persisted source of truth), then
  calls `render(renderProps, outputAbs, { propsPath: propsAbs })`. When
  `opts.propsPath` is given, `renderRemotionSequence` reads Remotion's
  `--props` from **that file on disk**, not the in-memory `renderProps`
  object, even though today's `render()` call receives both. The gate must
  do the same: prefer `opts.propsPath`'s file contents when present, and
  only fall back to the in-memory `props` parameter when absent. This
  content already contains compiled `sceneDefs`/`timelines`, because
  `render_master`'s own pipeline compiled them once, upstream, before
  persisting; the gate doesn't recompile, it reads what's already there.

```js
// inside renderRemotionSequence, before execFileAsync
const encodedProps = opts.propsPath
  ? JSON.parse(fs.readFileSync(opts.propsPath, 'utf-8'))
  : props;
const admission = await runOutputGates(encodedProps, { override: opts.override });
if (admission.verdict === 'BLOCK' && !admission.overridden) {
  throw new Error(`Render refused: ${admission.block_reason}`);
}
```

**Required test:** for each call shape, assert the object the gate actually
read is the SAME object (render_project: `encodedProps === props`, deep
equal, and the temp file on disk deep-equals it too) or the same file
contents (encodeMaster: `encodedProps` deep-equals
`JSON.parse(readFileSync(propsAbs))`, read independently, not trusted from
the in-memory `renderProps`). If gate input and encoded input could ever
differ, the design is wrong; this test is what proves they can't.

## 3. Content matching, not counts

**Rule:** a promised feature (`story_brief.must_show_features[i]`, a plain
string) is delivered only if its normalized text appears as a substring
inside a renderable layer's content-bearing field (`content`, `title`,
`label`, `excerpt`, or a compound layer's item text fields, §4) in some
scene of the encoded props. Normalization: lowercase, collapse whitespace,
strip surrounding punctuation. No paraphrase matching, no semantic
similarity, no id lookup beyond exact substring, because inventing either
would be an unverifiable claim of its own. **If scenes ever carry an
explicit `feature_id`/`promise_ref` field, prefer id equality over text
containment.** Grepped `mcp/lib/*.js` and `catalog/*.json`/`projects/**/*.json`
for such a field: none exists today, so text containment is the only signal
available, stated as a limitation, not a design choice.

**Construction-space corpus, built before the rule shipped (per the "cannot
be discovered by counterexample" doctrine):**

| Case | Feature text | Scene content | Expected |
|---|---|---|---|
| Exact match | `"12% revenue growth"` | layer text `"12% revenue growth"` | delivered |
| Case/whitespace variant | `"12% Revenue Growth"` | `"  12% revenue growth  "` | delivered (normalization) |
| Paraphrase | `"revenue grew this quarter"` | `"12% revenue growth"` | **not delivered** (no NLP claimed) |
| Split across two items | `"revenue growth and cost cuts"` | one card says `"revenue growth"`, another says `"cost cuts"` | **not delivered** (no single layer contains the whole promised string; a real per-item match against a decomposed promise is future work, not this rule) |
| Present, wrong layer type | text is inside a `moodboard.items[].alt` | `moodboard` is not renderable (§4) | **not delivered** |
| Present, but capped out | text is `cards[5]` of an 8-card `stack_fan_settle`, cap is 5 | rendered cards are `[0..4]` | **not delivered** |
| Four unrelated cards vs. four features | 4 promised features, 4 `card_conveyor.stories[]` whose text matches none of them | | **BLOCK, naming all 4 missing**, proves the rule judges content, not count |
| Punctuation-only diff | `"AI-powered insights"` | `"AI powered insights"` | delivered (punctuation stripped) |
| Substring collision | feature `"chat"` | scene text `"merchant support"` | **not delivered**, word-boundary check required, or `"chat"` false-matches inside `"merchant"`; this row is why the rule needs boundary-aware matching, not naive `.includes()` |

The last row is load-bearing: naive substring containment (`text.includes(feature)`)
would pass the "four unrelated cards" case wrongly if any feature word is a
short common substring, so the matcher must be boundary-aware (word or
phrase boundaries), not a bare `.includes()`. This corpus is the acceptance
test for `checkDeliveryPromise`'s matcher, run before any real project
fixture.

## 4. Only renderable layers count

**Authority, until ANI-223 ships a registry:** the `layer.type` switch
inside `SceneComposition`'s render function (`src/remotion/compositions/SceneComposition.jsx`,
the case list around `:538-548`, mirrored at `:304-314`). Confirmed by
reading the file: it renders content for `html`, `video`, `image`, `text`,
`svg`, `card_conveyor`, `stack_fan_settle`, `chart_build_explain`,
`spotlight_cursor_reveal`. Everything else falls to
`default: <div>[{layer.type}: {layer.id}]</div>`, a debug placeholder, not
content.

**The trap this plan corrects:** `src/remotion/lib.js:342`'s schema
validator and `mcp/lib/render-routing.js:31`'s `REMOTION_NATIVE_TYPES` BOTH
list `moodboard`, `result_grid`, `stacked_thumbs`, `media_strip` as valid,
native types. They validate and route successfully. Grepping
`SceneComposition.jsx` for any of those four type strings or their
`*Layer.jsx` component names returns **zero hits**, real React components
exist for them (`MoodboardLayer.jsx`, `ResultGridLayer.jsx`,
`StackedThumbsLayer.jsx`, `MediaStripLayer.jsx`) but `SceneComposition`
never dispatches to any of them. A gate that trusted the validator's or
router's "valid type" list would count content Remotion silently drops to a
placeholder. `checkDeliveryPromise`'s renderable-type list is deliberately
narrower than either, and must be revisited (not blindly widened) if
`SceneComposition`'s switch grows.

**Respect visible caps, not raw array length.** Confirmed per component:
`stack_fan_settle` renders `Math.min(cards.length, config.cardCount)`
(`StackFanSettleLayer.jsx`, defaulting `cardCount: 5`,
`stack-fan-settle.js:15`), an 8-card array with `cardCount` unset still
only shows 5. `card_conveyor`, `chart_build_explain`,
`spotlight_cursor_reveal` have no such cap (checked their source directly:
no `.slice()`/`Math.min()` on their item arrays). The item-counting helper
must apply each component's real cap, not assume every array element is
visible; `stack_fan_settle` is the one case that needs it today.

## 5. Panel-level promises are unverifiable, never PASS

Confirmed again this round: `story-beats.js:434` writes
`beat.panel_ref = { panel_id, ... }`, and nothing downstream reads it.
`generateScenes` (`generator.js:1389`) takes no beats/storyboard input at
all; `planSequence`'s manifest entries carry only `scene_id`, duration,
transition, camera, shot grammar (`planner.js:785`). There is no code path,
anywhere, that copies a panel's identity onto the scene meant to fulfill it.

**Verdict rule, made executable:** a storyboard panel promise
(`content_type` in `insight_cards`/`dashboard`/`split_panel` with an array
`content`) with no bound scene resolves to `WARN`, a finding with
`unverifiable: true`, and is **never counted toward `PASS`, and never
silently dropped from findings** even when nothing else blocks. Nothing in
`checkDeliveryPromise` may promote this to a confident verdict. Required
tests, each proving a tempting shortcut fails:
- Equal-length manifest and storyboard panels, no `panel_id` on any scene →
  still `WARN unverifiable`, not `PASS` (equal counts prove nothing).
- Scenes in storyboard order, no `panel_id` → still `WARN unverifiable`
  (position proves nothing once anything can reorder).
- Every scene's `content_type`-equivalent metadata matches its
  positionally-corresponding panel's `content_type` → still `WARN
  unverifiable` (a type match is not an identity match).

`must_show_features` coverage (§3) is unaffected by this section: it is a
flat, brief-level list, not scoped to any panel, and is checked across the
WHOLE encoded props regardless of panel binding. That is the one promise
class this gate can confidently `PASS`/`BLOCK` on. A prerequisite issue
(threading panel identity from beats through scenes into the manifest) is
being filed separately; this plan does not build that threading and does
not assume it exists.

## 6. Reactive scenes: no assumption

`compileMotion(scene, catalogs, {mode:'reactive'})` returns `{ mode:
'reactive', compound, config, contentCount, ... }` with **no `tracks` key
at all** (`compiler.js`'s own JSDoc return-type union, confirmed by reading
it this round). There is no per-layer breakdown to inspect for these scenes
under §2's "no separate compile" rule; the gate literally cannot observe
their motion. Round 2's language ("treat every reactive descriptor as
verified-animated") is retracted outright, not merely softened: it was an
unearned assumption, exactly the shortcut this round exists to stop taking.
Any density/static-layer sub-score for a reactive scene reports
`unverifiable`, not a number, and slideshow-risk's rollup must not silently
average an `unverifiable` into a PASS-leaning score.

## 7. Overrides: James's rule, tightened

Shared record shape unchanged from round 2, adopted from ANI-212's
stage-map draft verbatim: `{ type, at, actor, tool, reason, gate, detail }`,
persisted via a shared `recordOverride()` helper. Three new requirements
this round closes real gaps in:

1. **Record before Remotion starts, inside the same function.** Round 2 had
   admission and recording as separate steps a caller could get out of
   order; round 2's `renderRemotionSequence` does admission-and-spawn in
   one call, so recording must be sequenced INSIDE that same function,
   immediately before `execFileAsync`, never left to the caller to remember
   to do first:
   ```js
   if (admission.verdict === 'BLOCK') {
     if (!opts.override) throw new Error(`Render refused: ${admission.block_reason}`);
     await recordOverride(opts.project, { type: 'content_gate', gate: admission.block_reason, tool: opts.toolName, reason: opts.override.reason, actor: opts.override.actor, detail: admission.findings });
     // only reaches execFileAsync after the write above succeeds
   }
   ```
2. **Fail closed on a recording failure.** If `recordOverride` throws (disk
   full, `project.json` unwritable), that error propagates and
   `execFileAsync` is never reached. No bytes get produced with no record.
3. **Visible in the encoded artifact, not only `project.json`.** The
   override record is stamped into `encodedProps` itself (a new top-level
   `_admission: { verdict, override }` key) before it is written to the
   temp file or already sits in the persisted `render-props.json`, so it
   travels with the bytes into whatever consumes that props file (a person
   reading `render-props.json` later sees the override right there, not
   only in a separate `project.json`).

**`render_master` inline (no project):** the choke point
(`renderRemotionSequence`) is reached only via `encodeMaster`, which
already refuses to run without a `project` (`persist || encode` requires
`project`, `render-master.js`'s existing guard). There is no
inline-without-a-project case that reaches the choke point at all, so
"require a project to override" is already true by construction; nothing
new to build here, just stated plainly instead of left implicit.

## 8. Residual bypasses, re-verified this round

| Path | Reaches the choke point? | Disposition |
|---|---|---|
| `render_project`, `render_master` (`encode`) | Yes | Enforced (§2, §7). |
| `assemble_video_sequence` | No today; **fixed this round.** | It writes `render-props.json` and returns a runnable command for ANY input, blocked or not (`video-assembly.js:121-140`), the exact mechanism a persisted-then-reassembled BLOCKed master used to escape enforcement in rounds 1-2. **Decision: `assembleVideoSequence` runs the same admission check on its own `{manifest,sceneDefs,timelines}` before writing anything.** On an unoverridden `BLOCK`, it still returns routing/plate information (useful for inspection) but `buildRenderCommand` refuses to emit a runnable command, and no `render-props.json` is written. This closes the bypass at its only remaining door rather than declaring it accepted. |
| `scripts/sizzle.mjs` | No | Own renderer, independent of `renderRemotionSequence` (`sizzle.mjs:150,157`). Out of scope, named. |
| `scripts/compile-and-render-sequence.js`, `scripts/compile-and-render.js` | No | Own direct `npx remotion render` calls. Out of scope, named. |
| `scripts/render-showcase.sh` | No | **Re-verified this round, confirmed real:** `git grep -n remotion origin/main -- scripts/render-showcase.sh` shows `npx remotion render src/remotion/Root.jsx Sequence --props=public/showcase/showcase-props.json ...` at `:65`. Round 2 missed this file entirely. Out of scope, named. |
| `package.json`'s `remotion:render*`, `render-mercury.sh` | No | Raw shell invocations, outside Node. Out of scope, fundamentally ungateable in-process. |
| `hero-frame-capture.js:75`, `mcp/lib/figma/storyboard-export.js:129`, `scripts/render-cookbook-contact-sheets.mjs` | No | Confirmed non-delivery: these call `renderStill` for scoring/preview/contact-sheet stills, never a final deliverable video. Not bypasses of a delivery gate; unaffected. |

Five real, independent render paths (`sizzle.mjs`, two `compile-and-render*.js`,
`render-showcase.sh`, plus raw package/shell scripts) sit entirely outside
Node's `renderRemotionSequence`/`assembleVideoSequence` machinery. Closing
them means either rewriting each to call the shared function (a real,
separate follow-up, not this plan) or accepting they are developer-only
paths outside the MCP tool surface. Stated as a limit, not swept into
"covered."

## 9. Carried forward from round 2, adjusted for the narrower claim

- **Lossless preflight `details`**, if preflight stays as an advisory layer
  at all: the full per-gate result (`verdict`, `findings`, `evidence`,
  `block_reason`) goes into `details.output_gates`, not summarized into
  `pass`/`warn`/`fail` alone. Preflight remains advisory only; enforcement
  is §2's choke point, unaffected by `skip_preflight`.
- **`persistMaster` and handler visibility, made concrete:** `persistMaster`'s
  index currently reduces each artifact's gate to `{artifact, ratio,
  verdict}` (`master-persist.js`, the `gate_by_artifact` map inside
  `persistMaster`). It must carry the full `findings`/`evidence` for the
  new gates too, and `handleRenderMaster`'s printed summary
  (`handlers.js`'s `render_master` handler) must print them, not only
  hero-frame evidence.
- **Per-artifact evaluation.** Unchanged; already correct per round 1's
  fix, confirmed again this round (`render-master.js`'s artifact loop gates
  each emitted aspect separately).
- **`auto_revise`, refined, not just skipped wholesale.** A block caused
  only by `delivery_promise` never triggers `auto_revise` (retiming cannot
  add missing content, unchanged from round 2). For `slideshow_risk`, this
  round narrows further: `auto_revise` should skip ONLY when the blocking
  sub-score is a content-shape measure (static-layer ratio, text-only
  ratio, template repetition), because retiming cannot change layer
  composition. It should NOT skip when the blocking sub-score is purely
  motion-density-derived, because duration changes genuinely can move
  density (`motion-density.js`'s own remediation suggestions recommend
  shortening/extending holds). This requires `scoreSlideshowRisk`'s rollup
  to expose which sub-score(s) triggered the block, so `auto_revise`'s skip
  condition can check that, not just "any slideshow_risk block."
- **ANI-211 hangs off the same exact-encoded-props input as §2.** No
  separate normalizer for slideshow-risk either; it reads the identical
  `encodedProps` the delivery-promise gate reads, with §4's renderable-type
  filter and §6's reactive-scene disclosure applied identically.
- **Calibration corpus remains a slice-2 prerequisite,** unchanged from
  round 2's retraction of fixed band-edge numbers.

## 10. Motion-density defect: committed, runnable repro

`docs/process/repro-motion-density.mjs` (committed alongside this plan, run
with `node docs/process/repro-motion-density.mjs` from the repo root, no
arguments). It loads catalogs exactly as `mcp/lib/scoring.js` does
(`loadPrimitivesCatalog` + `loadPersonalitiesCatalog` + `loadRecipes`), runs
`compileMotion` then `auditMotionDensity` over all 14
`catalog/benchmarks/*.json` scenes, and asserts three things printed to the
console: every scene scores density `0` regardless of real motion; no scene
ever produces the `timeline.layers`-as-array shape `normalizeLayers` reads;
every non-reactive scene DOES have the `timeline.tracks.layers` shape
`normalizeLayers` never reads. Ran it this round: all three assertions hold.
**Correction from round 2:** the reactive-scene case (1 of the 14
benchmarks) is not fixed by adding a `tracks.layers` branch to
`normalizeLayers`, because reactive timelines have no per-layer breakdown
at all (§6), that scene needs the `unverifiable` disclosure path, not a
new read branch. The `tracks.layers` branch fix is real and sufficient only
for the 13 non-reactive benchmarks. This is a prerequisite bug for
ANI-211, filed against `motion-density.js`, not built by this plan.

## 11. Slice list

**Slice 1 (ANI-210):** `mcp/lib/output-gates.js` (registry, rollup, no
normalizer); `mcp/lib/delivery-promise.js` (§3's matcher against the
corpus, §4's renderable-type filter, §5's disclosure rule); `mcp/lib/video.js`
(`renderRemotionSequence` gains §2's admission read + §7's
record-then-spawn); `mcp/lib/video-assembly.js` (`assembleVideoSequence`
gains §8's admission check); `mcp/lib/gate-overrides.js` (shared with
ANI-212, `recordOverride`, unchanged shape); `mcp/lib/master-persist.js`,
`mcp/handlers.js` (§9's visibility). Tests: §2's three-way equality, §3's
full corpus table, §4's cap/unrenderable-type cases, §5's three
tempting-shortcut cases, §7's fail-closed-on-write-failure case, §8's
`assemble_video_sequence`-refuses-a-BLOCK case.

**Slice 2 (ANI-211):** `mcp/lib/slideshow-risk.js`, reading the identical
`encodedProps` slice 1 defines; §6's reactive disclosure; §9's
sub-score-attribution for `auto_revise`. Depends on slice 1's registry.
Calibration corpus stays a named prerequisite, not built here.

## 12. Open questions for James

1. `assembleVideoSequence` refusing a `BLOCK` (§8) changes the behavior of
   an edge-ready tool (`tool-groups.js` marks it `edgeReady:true`). Confirm
   that's acceptable, versus returning an advisory warning while still
   emitting the command.
2. If `encodeMaster`'s override-write fails partway through a multi-artifact
   loop (artifact 1 recorded, artifact 2's write throws), does the whole
   encode abort, or only the unrecorded artifact? Not designed here.
3. `story_brief` persistence (writing the structured brief to disk so
   `checkDeliveryPromise` has `must_show_features` to check) still needs a
   real write path and an unambiguous project identifier, both flagged in
   round 2 and not rebuilt this round since neither is part of the
   narrowed claim's enforcement machinery. Still needed before slice 1 has
   anything to check features against.
4. ANI-223's registry, once it ships, replaces §4's hardcoded
   `SceneComposition`-switch citation. Whoever ships it should grep this
   plan's file:line citations and update them, not assume they're still
   current.
