# ANI-210 / ANI-211 gate seam plan (round 2)

Status: plan only, no product code. Round 1 (commit `95e90f0`) was rejected by
a read-only Codex review at high effort. Every finding was re-verified against
`origin/main` at `863478d` before being accepted, corrected, or (nowhere, in
the end) rejected. Round 1's architecture assumed `render_master` and
`runPreflight` were the two places bytes get produced; that assumption was
wrong, and this round replaces it. Worktree:
`~/.claude-worktrees/animatic/ani-210-gate-plan`, branch
`james/ani-210-gate-seam-plan`. Clean-room note unchanged: OpenMontage source
was never opened.

## 0. What round 1 got wrong, verified

Every one of these was checked against real code, not taken on Codex's word:

- **The seam was bypassable.** `skip_preflight` skips ALL of `runPreflight`,
  and its own tool description says so: "Use when you know the environment is
  ready and want to bypass checks" (`tools.js:848`). A BLOCKed `render_master`
  result is still persisted in full: `persistMaster` writes every artifact's
  `manifest.json`, `timelines.json`, and every scene def regardless of
  `verdict` (`master-persist.js:104-146`, the `verdict` param is only copied
  into the index, never checked). Those files, or an inline
  `manifest`/`sceneDefs`, can then reach `assemble_video_sequence`
  (`video-assembly.js:35`), which performs no verdict check at all. Confirmed
  real, not hypothetical: `render_project`'s own `manifest` param
  (`projects.js:668-682`) can point straight at a persisted master's
  `manifest.json` and re-render it through `runPreflight` again with
  `skip_preflight: true`.
- **`/sizzle` and the `compile-and-render*.js` scripts render directly.**
  Verified: `scripts/sizzle.mjs` runs its own `evaluateManifest`/
  `validateManifestGuardrails`, then `renderVideo(props, outputPath)`
  (`sizzle.mjs:355-415`), never calling `runPreflight` or `render_master`.
  `scripts/compile-and-render-sequence.js:113,134` and
  `scripts/compile-and-render.js:102` do the same. These are real,
  independent entry points, not covered by anything in round 1.
- **The delivery-promise layer-count predicate was wrong.** A real project
  fixture, `examples/fintech-sizzle/scenes/sc_02_insight_cards.json`, carries
  one `type: 'card_conveyor'` layer whose `stories` array holds 8 items
  (`:18-24`), rendered by a real, wired composition
  (`CardConveyorLayer.jsx:32`, `SceneComposition.jsx:313,540`). Round 1's
  claim "no code concept of a card exists" was false, it existed, I hadn't
  looked past `generator.js`/`catalog/*.json`. Counting top-level layers
  would have reported 1 item where there are 8.
- **Positional panel-to-scene matching is unsafe.** Storyboard panels carry a
  generated `panel_id` (`compose-storyboard.js:334,343`) but nothing in
  `generator.js`/`planner.js` binds a scene to it, confirmed again this
  round. An equal-length reorder would silently mismatch every promise to the
  wrong scene.
- **Slice 1 and slice 2 don't see the same input.** `render_master` gates
  COMPILED scene defs, `composeCompileGate` overwrites
  `a.sceneDefs = compiled.sceneDefs` after `compileAllScenes`
  (`render-master.js:183-186`), while `render_project`'s preflight receives
  RAW scene defs read straight off disk (`projects.js:696-708`), never
  compiled. For a v3 semantic scene, raw `scene.layers` can be `[]` with all
  content in `scene.semantic.components` (real example:
  `catalog/benchmarks/dropdown-open-select.json:7`, `layers: []` with a
  `dropdown_menu` + `input_field` in `semantic.components`). A layer-counting
  gate run against the two sites' inputs literally counts different objects.
- **Aspect variants weren't gated per artifact.** `adaptManifestAspectRatio`
  clamps scene duration to the target format's max and reduces camera pan
  intensity for narrower ratios (`social-formats.js:117-123`), a 9:16 cut
  can be a genuinely different pacing/motion object than the 16:9 primary.
  The existing hero-frame gate already audits every emitted artifact
  separately (`render-master.js:189-199`); round 1's output gates ran once on
  the source and would miss an aspect-specific failure.
- **`story_brief` "persistence" didn't write anything.** `saveProjectArtifact`
  takes no content argument at all, it only registers a caller-supplied
  `path` string into `project.json` (`projects.js:414-460`). Adding a
  `'story_brief'` case cannot make a file appear; something has to
  `writeJSON` it first. `handleComposeStoryboard` (`handlers.js:3497-3527`)
  already receives `project` but only uses it for titling, never writes.
- **The "brief is always markdown" claim was wrong.** A real project,
  `projects/2026-03-25-fintech-sizzle/project.json:20`, points
  `entrypoints.brief` at `brief/story-brief.json`, and that file IS the
  structured `story_brief` object (`must_show_features`, `promise`,
  `proof_points`, matches `story-brief.js:270`'s schema exactly). Round 1's
  new `entrypoints.story_brief` key would have silently ignored this
  project's real brief sitting at `entrypoints.brief`.
- **`auto_revise` doesn't know why a gate blocked.** It skips only on
  `verdict === 'PASS'` or `gated.missingEvidence` (`render-master.js:264-274`,
  `missingEvidence` computed at `:204`, purely from hero-frame evidence). A
  delivery-promise or slideshow-risk BLOCK is neither, so `auto_revise` would
  run a retime-only revision loop against a problem retiming cannot fix.
- **`persistMaster` and the handler summary only ever print hero-frame data**
  (`master-persist.js:134,144`; `handlers.js:3672-3676`), round 1 never
  actually wired the new gates' output into either.
- **`save_project_artifact`'s enum and `render_master`'s schema/handler**
  needed real, non-optional changes, `tools.js:827` doesn't have a
  `story_brief` kind; `handleRenderMaster` (`handlers.js:3653,3665`)
  destructures neither `story_brief` nor `storyboard` and forwards neither.
  Round 1 called this optional; it isn't.
- **The GateResult shape claim was overstated.** `auditHeroFrames`'s findings
  use `verdict` per finding, not `severity`, and its result also carries
  `tier`, `threshold`, per-scene `scenes`, and `evidence_summary`
  (`hero-frame.js:470-489`), more than "`id` and `evidence` added."
- **Citation errors:** `composeCompileGate` starts at `render-master.js:174`
  (not 169), `renderMaster` at `:239` (not 254), storyboard panel
  construction at `compose-storyboard.js:334` (not 113). Preflight has six
  checks, not five (`preflight.js:290-297`), and `sceneDefs` was already
  being passed into it (`projects.js:734`), round 1 said it wasn't.
- **Semantic-critic is not reached via `evaluate_sequence`, ever.**
  `scoreMotionRichness(sceneMap, timelineMap)` only calls `critiqueScene` (the
  only path to `critiqueSemanticScene`) when `timelineMap && timelineMap.size
  > 0` (`evaluate.js:896-903`). `evaluateSequence` calls it as
  `scoreMotionRichness(sceneMap)`, no second argument (`:961`), so that
  branch structurally can never run through `evaluate_sequence`. The real
  paths are `critiqueScene` called directly, e.g. `generateVideo`'s Stage 5
  (`video.js:221`) and `scoring.js`'s own critique loop.
- **Calibration's "text-only" heuristic misclassified real content.**
  `catalog/benchmarks/editorial-photo-e2e.json:8` has two `type: 'html'`
  layers rendering a photo and a notification card via external asset
  templates, flagged "text-only" purely because `type === 'html'`, which is
  a generic rich-content escape hatch, not a text signal. And the
  `layers: []` v3 fixtures (`dropdown-open-select.json`) were silently
  measured on MUTATED state: `compileMotion` mutates `scene.layers` in place
  via `compileSemantic` (`compiler.js:1034-1063`, `if (!scene.layers)
  scene.layers = []` then pushes generated layers into the SAME object);
  round 1's probe script called `compileMotion(scene, ...)` before reading
  `scene.layers.length`, so it measured post-mutation state without
  realizing it. The reported 10/14 "text-only" population is not trustworthy.

## 1. Choke point (the architectural fix)

Repo-wide inventory of every place a byte-producing Remotion render actually
starts, via `git grep -n "renderMedia\|renderStill\|npx remotion\|remotion
render" origin/main`:

| Call site | What it does | In scope? |
|---|---|---|
| `mcp/lib/video.js`'s `renderRemotionSequence` (the `// ── renderRemotionSequence ──` section) | `execFileAsync('npx', ['remotion','render','Sequence', ...])`, the ONE function that spawns a final-video Remotion render from Node | **Yes, this is the choke point.** |
| `mcp/lib/master-persist.js`'s `encodeMaster` | Calls `renderRemotionSequence` as its default `render` param (`master-persist.js:172`, imported `:29`), `render_master`'s `encode: true` path | Covered via the choke point. |
| `mcp/lib/projects.js`'s `renderProject` | Calls `renderRemotionSequence(props, outputPath)` directly, `render_project` | Covered via the choke point. |
| `mcp/lib/video-assembly.js`'s `assembleVideoSequence` | Never spawns Remotion, writes `render-props.json` and returns a command STRING (`buildRenderCommand`, `:140-150`) | Not a byte-production site; see residual risk below. |
| `scripts/sizzle.mjs` | Own `renderVideo` implementation, independent of `renderRemotionSequence` | **Out of scope, named explicitly** (see below). |
| `scripts/compile-and-render-sequence.js`, `scripts/compile-and-render.js` | Own direct `npx remotion render` invocations | **Out of scope, named explicitly.** |
| `package.json`'s `remotion:render*` scripts, `render-mercury.sh` | Raw `npx remotion render` from a shell | **Out of scope, outside Node entirely, ungateable in principle.** |
| `hero-frame-capture.js`, `storyboard-export.js`, `render-cookbook-contact-sheets.mjs` | `renderStill` for scoring/preview/contact-sheet stills, not a final deliverable | Not a delivery site; unaffected. |

**Decision: put the admission check inside `renderRemotionSequence` itself,
not only at the two orchestrator sites.** This is the choke point for every
MCP-tool-mediated render (`render_project` and `render_master`'s `encode`),
because both paths funnel through this one function before `npx remotion
render` ever runs. Concretely: `renderRemotionSequence(props, outputPath,
opts)` gains an admission step at its top that re-derives the gate verdict
from the ACTUAL `props.manifest`/`props.sceneDefs` about to be rendered (not
a cached verdict from earlier in the call chain) and refuses to spawn on an
unoverridden BLOCK. This closes every bypass found in §0 within the MCP
surface: `skip_preflight` can no longer mean "skip content admission" because
content admission no longer lives in preflight's `Promise.all` at all; a
persisted-then-reassembled BLOCKed master gets re-checked against its real
content the moment anything tries to actually render it, regardless of which
tool call path got it there.

**`render_master`'s existing gate rollup (`composeCompileGate`) and
`runPreflight` both stay, as an early/advisory layer**, not the enforcement
point: they give a caller a fast BLOCK/WARN before spending compute, exactly
as today. `skip_preflight` still skips the five pre-existing environment
checks (encoders, fonts, plates, manifest refs, voiceover fit, disk space),
none of which are content gates, and now also skips only the ADVISORY
content-gate check, never the enforcement at `renderRemotionSequence`. A test
must assert this split (§8).

**Rejected alternative: "make blocked results unassemblable."** Considered
and rejected for two reasons. First, `persistMaster`'s own docstring already
treats persistence-on-BLOCK as a deliberate feature ("persisted for
inspection"), and inspecting why something blocked is a real, named use case
this plan shouldn't remove. Second, it doesn't actually fix `render_project`'s
direct raw-manifest path, that isn't "assembling a persisted master," it's a
fresh preflight-then-render call with no persisted artifact involved at all,
so unassemblability wouldn't touch it. The choke point covers both mechanisms
with one change.

**Residual risk, stated plainly, not swept under "covered":** `assemble_video_sequence`
prints a runnable `npx remotion render` command as plain text. A human who
copies that command and runs it from a shell is outside the Node process
entirely; no in-process check can stop that, same as `sizzle.mjs` or a raw
`npx remotion render` invocation. This is a fundamental limit of any
in-process gate, not something this plan can close. If James wants that
residual path closed too, it needs a filesystem-level or CI-level control
(e.g., a pre-render hook that refuses to run against a directory containing a
`BLOCKED` marker), which is out of scope for this plan and named as an open
question (§12).

## 2. One normalized gate input

Both gates need `{ manifest, scenes, timelines }` in the SAME shape
regardless of which caller built it. New helper in `mcp/lib/output-gates.js`:

```js
export async function normalizeGateInput({ manifest, scenes, timelines, catalogs, personality }) {
  const sceneDefs = Array.isArray(scenes) ? Object.fromEntries(scenes.map(s => [s.scene_id, s])) : scenes;
  // Always compile, compileAllScenes is idempotent on already-compiled defs
  // (it only fills scene.layers/scene.motion when scene.semantic drives them;
  // a v2 scene with layers already set passes through unchanged, per
  // compiler.js:1034's `if (!scene.layers) scene.layers = []` guard).
  const compiled = compileAllScenes(manifest, sceneDefs, catalogs, { personality });
  return { manifest, scenes: compiled.sceneDefs, timelines: timelines || compiled.timelines };
}
```

Both enforcement paths call this before running gates: `composeCompileGate`
already has compiled defs, so `normalizeGateInput` is a cheap pass-through
there; the choke point (`renderRemotionSequence`) receives whatever raw props
`render_project` assembled and compiles them fresh. This is the "one
normalized post-compile input" both sites must share, built once, in one
file, not duplicated. **Parity test (required, §8):** run
`normalizeGateInput` on (a) a raw v2 scene with authored `layers`, (b) a raw
v3 scene with `layers: []` and `semantic.components`, (c) an already-compiled
scene from `render_master`'s path, and assert all three produce a
`GateResult` with the same finding for the same underlying content
(constructed so (a)/(b) describe the same promised content two different
ways).

## 3. Seam contract

`mcp/lib/output-gates.js`: gate functions take
`{ manifest, scenes, timelines, story_brief?, storyboard?, tier?, override? }`
(already normalized) and return:

```js
{ id, verdict: 'PASS'|'WARN'|'BLOCK', findings: [{ severity, message, scene_id?, panel_id? }], evidence }
```

(Not claimed to mirror `auditHeroFrames` beyond the `verdict`/`findings`
concept, that result additionally carries `tier`, `threshold`,
per-scene `scenes`, `evidence_summary`, and uses `verdict` per-finding, not
`severity`; the two shapes are related, not identical, corrected from round
1.) `registerGate(id, fn)` / `runOutputGates(input)` roll up BLOCK > WARN >
PASS and join `block_reason`, exactly as round 1 designed. Slice 1 registers
`delivery_promise`; slice 2 adds `registerGate('slideshow_risk', ...)`.

## 4. Override policy (decided by James, 2026-09-11)

Content gates can be overridden **only with a recorded reason.** "Never" was
rejected: it produces shadow bypasses once a real exception shows up.
Requirements, all four enforced together:

- **Explicit.** A dedicated `override` parameter on `render_project` and
  `render_master`. No unrelated flag acts as an override:
  `skip_preflight: true` alone never overrides a content gate (tested, §8).
- **Attributable.** `override = { gate: 'delivery_promise'|'slideshow_risk'|'all', reason: string, actor: string }`.
  `reason` and `actor` are both required (non-empty) when `override` is
  present; `overridden_at` is stamped server-side (never caller-supplied, so
  it can't be forged).
- **Visible.** The override record is written into: (a) `persistMaster`'s
  `index.json` (new `output_gates`/`override` fields, alongside the existing
  `gate_by_artifact`); (b) a new small sidecar next to a plain
  `render_project` output, `<output>.meta.json`, written whenever any gate
  ran, carrying `{ verdict, gates, override }`; (c) the existing opt-out
  telemetry, `track('mcp.gate_override', { gate, actor, verdict, project })`
  (`telemetry.js:93`, same mechanism already used for
  `record_render_feedback`, `handlers.js`'s `track('mcp.feedback', ...)`).
  A reviewer looking at either artifact can see a gate was overridden, by
  whom, and why, without cross-referencing a separate log.

**Shared shape for ANI-212.** ANI-212 (stage gates) needs the same
explicit/attributable/visible contract, and `/direct`'s human-storyboard-
approval stop will too. Proposing one shared record type, `GateOverride =
{ gate_id, reason, actor, overridden_at }`, defined once in
`mcp/lib/output-gates.js` and imported by whatever ANI-212 builds, rather
than each issue inventing its own shape. This is the natural shared piece;
the rest of ANI-212's stage-gate machinery is out of scope here.

## 5. Every render entry point, corrected

| Tool / script | Reaches the choke point? |
|---|---|
| `render_project` | **Yes**, directly (`renderRemotionSequence` call in `projects.js`). |
| `render_master` (`encode: true`) | **Yes**, via `encodeMaster` → `renderRemotionSequence`. |
| `render_master` (no encode) | No render happens; the advisory gate rollup still reports `verdict`/`block_reason` so a caller sees the same answer before ever reaching the choke point. |
| `assemble_video_sequence` | No, never renders; prints a command a human could run outside Node (residual risk, §1). |
| `generate_video`, `create_social_cutdown`, `preview_video`, `auto_revise_loop` (standalone) | No, as established in round 1 and unchanged: none of these render, or (cutdown) deliberately re-authors, or (preview) produces no artifact. |
| `scripts/sizzle.mjs`, `scripts/compile-and-render*.js`, `npm run remotion:render*`, `render-mercury.sh` | **No, explicitly out of scope.** These are developer CLI scripts outside the MCP tool surface, each with their own render call independent of `renderRemotionSequence`. Closing them would mean either rewriting them to call the shared function (a real, separate follow-up) or duplicating the gate logic a third time (exactly what this plan exists to avoid). Named here as a gap, not claimed as covered. |

## 6. Delivery-promise matching, corrected

### 6.1 Counting items inside compound layers

Inventoried every compound (multi-item) layer type wired into
`SceneComposition.jsx` by reading each component's source, not guessing:

| `layer.type` | item field | source |
|---|---|---|
| `card_conveyor` | `stories` | `CardConveyorLayer.jsx:32` |
| `chart_build_explain` | `bars` | `ChartBuildExplainLayer.jsx` |
| `media_strip` | `items` | `MediaStripLayer.jsx` |
| `moodboard` | `items` | `MoodboardLayer.jsx` |
| `result_grid` | `items` | `ResultGridLayer.jsx` |
| `stacked_thumbs` | `items` | `StackedThumbsLayer.jsx` |
| `stack_fan_settle` | `cards` | `StackFanSettleLayer.jsx` |

`countPromiseItems(layer)` looks up `layer.type` in this table and counts
`(layer[field] || []).length`; any other layer type counts as 1 item, UNLESS
`layer.product_role === 'decorative'` (a real, established field, 46 of 44+
scene files checked use `product_role`, with `decorative` the single most
common value ahead of `hero`/`supporting`/`result`/etc.), which counts as 0.
This replaces round 1's flat top-level-layer count and is judged on semantic
content (item arrays, role tags) rather than layer count, per the confirmed
requirement. For v3 scenes (`layers: []`, content in
`scene.semantic.components`), the same non-decorative filter applies to
`components[].role !== 'decorative'`, there is no compound-item convention
inside `semantic.components` today (each component is already one discrete
thing), so components count 1 each.

### 6.2 Binding a panel to a scene by stable identity, not position

Confirmed this round: `story-beats.js` DOES create a binding,
`beat.panel_ref = { panel_id, content_type, act, intent, ... }`
(`story-beats.js:434-441`), but grep across the entire `mcp/lib/` tree finds
**zero consumers** of `beat.panel_ref` anywhere else. It is written and never
read. Nothing copies it onto a `scene` def or a `manifest.scenes[]` entry.
This is the concrete gap the binding requirement (now a hard requirement, not
a suggestion) must close:

1. **Slice 1 adds `panel_id` as a recognized field on scene defs**
   (`scene.metadata.panel_id`) and documents the authoring convention: any
   scene authored from a beat/panel plan must copy `beat.panel_ref.panel_id`
   onto `scene.metadata.panel_id`. This can't be enforced by a pure function
   today because, confirmed again this round, no code path generates
   scenes from beats/storyboard; an agent authors them by hand following the
   plan as a spec (same finding as round 1, re-verified).
2. `checkDeliveryPromise` binds by `panel_id` whenever BOTH the storyboard's
   panels and the manifest's scenes (via their scene defs) carry one, an
   unambiguous, order-independent match, immune to reordering.
3. **When any scene is missing `panel_id` while a storyboard is present**,
   that's its own WARN finding (`binding_confidence: 'positional_fallback'`,
   naming which scenes lack the field) and the check falls back to
   positional matching for those scenes only, with every finding derived
   from a positional match explicitly flagged low-confidence, never a
   silent, confident BLOCK or PASS built on a guess.
4. Open question for James (§12): should scene-authoring tooling
   (`create_layer` or whatever writes scene JSON in practice) be changed to
   require `panel_id` when authoring against a plan? That's a larger,
   separate change; this plan only defines the convention and the gate's
   graceful-degradation behavior.

## 7. `story_brief` persistence, corrected

`saveProjectArtifact` cannot write content, confirmed, it only takes a
`path` string and registers it (`projects.js:414-460`). The real fix:

1. `handleExtractStoryBrief` and `handleComposeStoryboard`
   (`handlers.js:3497` region) gain an optional `project` behavior change:
   when `project` is given, the handler itself `writeJSON`s the result to
   `concept/story-brief.json` / the storyboard's existing default
   `concept/storyboard.json` path, THEN calls `saveProjectArtifact({project,
   kind, path})` to register the entrypoint. Two real writes, not a switch
   case pretending to be one.
2. **Legacy compatibility, required, not optional:** a real project already
   uses `entrypoints.brief` for a structured JSON brief
   (`projects/2026-03-25-fintech-sizzle/project.json:20` →
   `brief/story-brief.json`, matching `story-brief.js:270`'s schema). The
   loader tries, in order: (a) a dedicated `entrypoints.story_brief` if set;
   (b) `entrypoints.brief`, attempting `JSON.parse` and checking for a
   `must_show_features` key, if it parses and matches the shape, treat it
   as the structured brief; if it fails to parse or lacks that key, treat it
   as prose (no promise to check, same WARN path as "no brief at all"). This
   is more code than round 1's single-key read, but it's the only version
   that doesn't silently drop a real project's real brief.
3. WARN-vs-BLOCK on missing inputs is unchanged from round 1: absent →
   WARN, `evidence.checked === false`; present and failing → BLOCK. This was
   not disputed and stands.
4. Mandatory (not optional) schema/handler changes, confirmed needed:
   `tools.js:827`'s `save_project_artifact` kind enum gains `'story_brief'`;
   `handleRenderMaster` (`handlers.js:3653,3665`) and its `render_master`
   tool schema both gain `story_brief`, `storyboard`, and `override` params,
   destructured and forwarded to `renderMaster(...)`.

## 8. Slice list

### Slice 1, ANI-210: choke point + seam + delivery-promise + override

**Files:** `mcp/lib/output-gates.js` (new, registry, `normalizeGateInput`,
`GateOverride` shape, rollup); `mcp/lib/delivery-promise.js` (new,
`checkDeliveryPromise`, §6-§7 logic); `mcp/lib/video.js`
(`renderRemotionSequence` gains the admission check plus override handling,
the actual enforcement point, §1); `mcp/lib/render-master.js`
(`composeCompileGate` runs gates early/advisory via `normalizeGateInput`;
`renderMaster` gains `story_brief`, `storyboard`, `override` params, threads
`override` down through `encodeMaster` to `renderRemotionSequence`);
`mcp/lib/master-persist.js` (`persistMaster`'s index gains `output_gates` +
`override`); `mcp/lib/projects.js` (`renderProject` gains `override` param,
threads it to `renderRemotionSequence`, writes the `<output>.meta.json`
sidecar, reads `story_brief`/`storyboard` per §7); `mcp/handlers.js` +
`mcp/tools.js` (schema/handler changes in §7.4, not optional); `mcp/lib/telemetry.js`
consumer call for the override event.

**Test plan (every item the coordinator asked for):**
- Polaris-shaped BLOCK / faithful PASS / missing-input WARN (round 1's
  original three, unchanged).
- `normalizeGateInput` parity: raw v2, raw v3 (`layers:[]`), pre-compiled;
  same finding for equivalent content (§2).
- Compound-layer item count: a `card_conveyor` with `stories.length === 8`
  against a promise of 8 features → `PASS`; against a promise of 10 →
  `BLOCK` naming exactly the 2 missing, not "1 vs 10."
- Equal-length reordered panels: storyboard panels A,B,C with promises
  `[2,0,4]` items; scenes authored in order C,A,B but each carrying the
  right `panel_id` → correct binding, no false BLOCK/PASS. A second test
  with the SAME reorder but no `panel_id` on any scene → positional
  fallback WARN with `binding_confidence: 'positional_fallback'`.
- `skip_preflight: true` with a genuinely BLOCK-worthy manifest → the
  advisory preflight check is skipped, but `render_project` still fails at
  the choke point with a content-gate error, not a successful render.
- Override, recorded: `render_project({..., override: {gate:'delivery_promise', reason:'known gap, ships next week', actor:'james@…'}})`
  on a BLOCK-worthy manifest → render proceeds, and the resulting
  `<output>.meta.json` / `persistMaster` index contains the override
  `{gate, reason, actor, overridden_at}`.
- Aspect variants: a source that passes slideshow-risk at 16:9 but whose 9:16
  variant's clamped duration tips a scene into the static-layer band →
  `gate_by_artifact`-equivalent per-artifact result catches it; a single
  source-level check does not (regression test proving the per-artifact
  requirement, §9).
- Blocked-master persistence + reassembly: persist a BLOCKed master, then
  feed its persisted `manifest.json`/`sceneDefs` into
  `assemble_video_sequence` and separately into `render_project`'s
  `manifest` override param → the latter still blocks at the choke point
  (proves the bypass Codex found is closed); the former is documented as
  the residual, out-of-process risk (§1), not silently passing.
- Handler/schema forwarding: `handleRenderMaster` actually forwards
  `story_brief`/`storyboard`/`override` to `renderMaster` (a destructuring
  regression test, this exact gap was round 1's bug).
- Multiple simultaneous blockers: delivery-promise AND hero-frame both BLOCK
  → `block_reason` names both, ranked verdict is `BLOCK`.
- Gate exceptions: a gate function that throws is caught by
  `runOutputGates` and surfaces as its own `BLOCK` finding
  ("gate crashed: <message>"), never an unhandled rejection that silently
  lets a render proceed.
- `auto_revise` interaction (§10): a delivery-promise-only BLOCK with
  `auto_revise: true` → `auto_revise_report.ran === false`, reason names the
  content gate, no frame-evidence revision spawned.
- `preflight.test.js:149,156`'s `checks.length === 6` assertion updated to 7
  once the advisory `output_gates` check is added.

**Mergeability:** first; slice 2 depends on `output-gates.js`.

### Slice 2, ANI-211: slideshow-risk

**Files:** `mcp/lib/slideshow-risk.js` (new, calls `evaluateSequence`
(`evaluate.js:937`), `auditMotionDensity` per scene, AND `critiqueSemanticScene`
per v3 scene directly, NOT via `evaluate_sequence`, since that path
structurally never reaches it, §0); `mcp/lib/output-gates.js` (one
`registerGate` line); prerequisite repair (§9) to `motion-density.js`'s
`normalizeLayers`; per-artifact evaluation (loop over
`gate_by_artifact`-equivalent artifacts, not once on the source, §0).

**Mergeability:** after slice 1.

**Test plan:** all 14 benchmarks scored (per-artifact sub-scores only, not
band edges, §9); the real 6-scene `generateVideo` sample; per-sub-score unit
tests; compound-layer-aware static-ratio test (a `card_conveyor` with 8
active stories should not read as "1 static layer"); aspect-variant
regression (above); `panel_id`-bound and positional-fallback cases shared
with slice 1's fixtures where relevant.

## 9. Calibration and the motion-density repro

### 9.1 Motion-density bug, reproduced rigorously

Re-ran against the EXACT catalog-loading and call pattern `scoring.js` uses
in production (`scoring.js:58-67,661-667`:
`loadPrimitivesCatalog()+loadPersonalitiesCatalog()+loadRecipes()`, then
`compileMotion(sceneDef, catalogs, isReactiveScene(sceneDef)?{mode:'reactive'}:{})`
→ `auditMotionDensity(timeline, sceneDef)`), not a hand-simplified version.
Result, all 14 benchmarks: `Array.isArray(timeline.layers)` is `false` for
every one; `timeline.tracks.layers` exists (non-reactive scenes, 13/14) or is
absent (the one reactive/compound scene); `auditMotionDensity(...).score` is
exactly `0` for all 14, including scenes with 5 staggered animated layers.
**Confirmed, not retracted.** `normalizeLayers` (`motion-density.js:198-217`)
needs the `timeline.tracks.layers` branch before slice 2 can honestly claim
to reuse this signal.

### 9.2 Calibration is a slice-2 prerequisite corpus task, not a band proposal

Round 1's numeric "weight X heavily" recommendation is retracted along with
the text-only heuristic that produced it (§0). What stands: 13/14 benchmarks
are correctly ~0.0 static once compound layers are handled (§6.1) and the
mutation bug is fixed (§0); the one real 6-scene `generateVideo` sample
remains a legitimate bad-manifest data point. What's needed before ANY band
edge ships: a corpus built with (a) the corrected, non-mutating measurement,
(b) `type: 'html'` layers with real asset content excluded from any
"text-only" signal (distinguish a decorative fill div from an asset-backed
photo/notification layer, needs its own small heuristic, e.g. presence of
an `assets[]` reference or a `src`-bearing HTML template path vs. an inline
`<div style="background:...">`), and (c) several more full-manifest samples
spanning good-to-bad. This is now explicitly slice 2's first deliverable,
before any threshold is proposed, not a post-hoc recommendation.

## 10. `auto_revise` interaction, fixed

`autoReviseLoop` is skipped when `gated.verdict === 'PASS'` OR
`gated.missingEvidence` (`render-master.js:264-274`, `missingEvidence` at
`:204`, purely hero-frame-derived). Slice 1 adds a third skip condition:
non-PASS caused ONLY by an output gate (delivery-promise/slideshow-risk),
never hero-frame, `auto_revise_report = { ran: false, reason: 'content gate blocked (delivery_promise/slideshow_risk), a retime-only revision cannot add missing content or fix static layers' }`.
A mixed BLOCK (both hero-frame missing-evidence AND a content gate) still
skips, since the existing `missingEvidence` branch already covers that case
first.

## 11. Edge / hosted surface

Unchanged from round 1's conclusions on tool edge-readiness
(`render_master`/`render_project` local, `assemble_video_sequence`/
`evaluate_sequence`/`audit_motion_density` edge-ready, `render-master.js:132,155`,
`tool-groups.js:93,114,140`), none of that was disputed. Corrected: slice 2
calls `critiqueSemanticScene` directly rather than assuming
`evaluate_sequence` supplies it (§0), which doesn't change any tool's edge
status since `critiqueSemanticScene` is itself a pure function with no
standalone tool registration.

## 12. Risks and open questions for James

1. The residual out-of-process risk (§1): a human running a printed
   `assemble_video_sequence` command, or `sizzle.mjs`/`compile-and-render*.js`,
   from a shell is unreachable by any in-process gate. Worth a follow-up
   (filesystem marker + pre-render hook), or accepted as out of scope?
2. Should scene-authoring tooling be changed to require `panel_id` when
   authoring against a beat/storyboard plan (§6.2.4), or does the
   graceful-degradation WARN suffice indefinitely?
3. The `product_role: 'decorative'` filter (§6.1) is a real, established
   convention (44+ files) but was never designed as a promise-coverage
   signal, confirm it's an acceptable repurposing before slice 1 ships.
4. Calibration (§9.2) needs real additional sample generation time before
   slice 2's band edges can be trusted, how many more `generateVideo`
   samples is enough, and who reviews the resulting corpus?
5. `.meta.json` sidecars for plain `render_project` output are a new
   artifact type this plan introduces (§4), confirm the naming convention
   and that nothing downstream (cleanup scripts, `.gitignore` patterns)
   needs to be told about it.
