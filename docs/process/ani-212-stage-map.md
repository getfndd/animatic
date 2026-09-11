# ANI-212 - Stage map design draft

Design draft only, no product code. Written against `origin/main` at `863478d` (fetched
2026-09-11, worktree `~/.claude-worktrees/animatic/ani-212-stage-map`, branch
`james/ani-212-stage-map-design`). Clean-room: OpenMontage source was not opened, the
mechanism description in ANI-212/ANI-209 is the only input taken from that project.
Parent: ANI-209 (clean-room reimplementation of OpenMontage's stage-gate mechanism, MIT
license preserved). Sibling: ANI-210 (shared gate hook for `render_master` + preflight,
not designed here, only where this stage check sits relative to it). Prior art: ANI-151
(`compose_storyboard`, shipped, the storyboard producer this issue gates) and
`docs/cinematography/design-pipeline-audit.md`, whose target-pipeline table already
lists `2.5 human review, approval, gate before any HTML`, the strongest existing
precedent for where an approval belongs.

## 1. Inventory on origin/main

### 1a. Every writer of `project.json`

```
git grep -n "project\.json" -- . ':!*.test.js' ':!docs/**' ':!*.md'
```

turns up exactly two write sites, both in `mcp/lib/projects.js`, both going through the
same `writeJSON` helper (`projects.js:101-103`, plain `writeFile`, not atomic):

| Writer | File:line | Trigger |
|---|---|---|
| `initProject` | `mcp/lib/projects.js:186` | `init_project` tool - creates the file |
| `saveProjectArtifact` | `mcp/lib/projects.js:529` | `save_project_artifact` tool - read-modify-write on every call |

**No other writer exists, on or off the `save_project_artifact` door.** Every caller that
mutates project state goes through `saveProjectArtifact`, not around it:

| Caller | File:line | Kind |
|---|---|---|
| `renderProject` (`render_project`, marks latest render) | `mcp/lib/projects.js:838` | `render` |
| `renderMaster` (`render_master`, persist/encode path) | `mcp/lib/render-master.js:342` | `master` |
| `recordRenderFeedback` (`record_render_feedback`) | `mcp/lib/feedback.js:130` | `review` (role `feedback`) |

`bin/animatic.mjs:190` reads `project.json` (CLI status display) but never writes it.
`mcp/lib/master-persist.js:114-147` writes `manifest.json`/`timelines.json`/a masters
index under the project tree, real disk writes, but never `project.json` itself; the
pointer back is registered through `saveProjectArtifact` at `render-master.js:342` above.
**Conclusion: there is one door, not several.** The "don't gate one door and leave
another" risk the issue calls out doesn't apply to writers, it applies to *tools that
produce stage content without saving it*, below.

### 1b. Every tool that produces each stage's artifact

Registration = the name appearing in `mcp/tools-registry.js` `HANDLERS` (dispatch) and in
`mcp/tool-groups.js` `TOOL_GROUPS` (tier/edge manifest - the two are cross-checked at
startup, `tools-registry.js:158-184`, so a name can't be in one without the other).

| Stage | Producer tool | Registry | Tier manifest | Handler | Writes to disk itself? |
|---|---|---|---|---|---|
| brief | `extract_story_brief` | `tools-registry.js:90` | `tool-groups.js:126` (TRANSFORM, edge-ready) | `handlers.js:3482` | No - pure, returns JSON |
| storyboard | `compose_storyboard` | `tools-registry.js:91` | `tool-groups.js:127` (TRANSFORM, edge-ready) | `handlers.js:3497` | No - pure (+ optional LLM enrichment), returns JSON |
| beats | `plan_story_beats` | `tools-registry.js:92` | `tool-groups.js:128` (TRANSFORM, edge-ready) | `handlers.js:3536` | No - pure, returns JSON; `storyboard` param is optional (see 1c) |
| scenes | `generate_scenes` | `tools-registry.js:40` | `tool-groups.js:160` - marked `edgeReady:false, "VERIFY: may write scene files"` | `handlers.js:1771` | No - confirmed by reading the handler and grepping `generator.js` for `writeFile`/`writeJSON`: none. The manifest's caution note is stale; a follow-up to flip it is out of scope here. |
| manifest | `plan_sequence` | `tools-registry.js:34` | `tool-groups.js:92` (TRANSFORM, edge-ready) | `handlers.js:1397` | No - pure |
| render | `render_project` | `tools-registry.js:57` | `tool-groups.js:155` (RENDER, local-only) | `mcp/lib/projects.js:668` | Yes - spawns Remotion, then registers via `saveProjectArtifact` (`:838`) |
| render (alt track) | `render_master` | `tools-registry.js:96` | `tool-groups.js:132` (TRANSFORM but `edgeReady:false`, local Remotion stills for the hero-frame gate) | `mcp/lib/render-master.js:239` | Yes when `persist`/`encode` - registers via `saveProjectArtifact` kind `master` (`render-master.js:342`) |
| review | `review_project` | `tools-registry.js:58` | `tool-groups.js:148 (PROJECT)` | `mcp/lib/projects.js:545` | Yes - writes `review/evaluation.json` directly (`projects.js:636`), **not** through `saveProjectArtifact`; safe only because `review.evaluation`'s path is a fixed string set once at `initProject` (`projects.js:176`) and never re-pointed |

**Every stage-producing tool except `render_project`/`render_master` is a pure TRANSFORM
tool that returns data and touches no disk.** Persistence is the agent calling
`save_project_artifact` afterward, good news for enforcement: gating the one chokepoint
gates real stage completion for every stage except `review`, which needs its own note
(below) because its write bypasses the chokepoint by construction, not by omission.

**Found while inventorying, not asked for but load-bearing:** `.claude/skills/direct/SKILL.md:124-136`
(Step 8's save table) registers **both** the real storyboard **and** each of the three
per-strategy beat plans under `kind: storyboard`:

```
| Storyboard | `storyboard` | `concept/storyboard.json` |
| Beat plans | `storyboard` | `concept/beat-plan-{strategy}.json` |
```

`saveProjectArtifact`'s `storyboard` case (`projects.js:444-446`) does
`projectData.entrypoints.storyboard = artifactPath`, a scalar overwrite, not an append.
Calling it four times in Step 8 (once for the real storyboard, three times for
`prestige`/`energy`/`dramatic` beat plans) means **whichever save runs last wins the
entrypoint**. Not hypothetical: `projects/2026-03-25-fintech-sizzle/project.json` on
`origin/main` has `entrypoints.storyboard` pointing at `concept/beat-plan-dramatic.json`,
and `concept/storyboard.json` does not exist on disk in that project at all, only the
three beat-plan files do. The real storyboard save was clobbered (or never landed) and
nothing noticed because nothing reads `entrypoints.storyboard` for anything but display
today. **Stage completion cannot be inferred from `entrypoints.storyboard` alone.**
Section 2 tracks completion in a separate `stages` block for this reason, and Section 3
proposes giving beat plans their own `kind` so they stop colliding.

### 1c. Every current read of project status

```
git grep -n "\.status\b|approved_render|STATUS_PROJECT|STATUS_SCENE|STATUS_VERSION|entrypoints\." -- 'mcp/lib/*.js' 'mcp/*.js'
```

| Read | File:line | What it does |
|---|---|---|
| `STATUS_PROJECT` / `STATUS_SCENE` / `STATUS_VERSION` | `mcp/lib/projects.js:33-35` | Declared. **Never read for gating anywhere.** No code transitions a project's `status` past its `initProject`-set `'draft'` (`projects.js:154`); no code reads `STATUS_*` except the test file's enum assertions. |
| `listProjects({ status })` filter | `mcp/lib/projects.js:225` | Optional query filter only, not enforcement. Since nothing ever sets `status` to anything but `draft`, this filter is currently a no-op in practice. |
| `entrypoints.approved_render` | `mcp/lib/feedback.js:138` | The **only** reader in the codebase - feedback-target resolution falls back `approved_render` → `latest_render` → `latest_master`. Matches the issue text exactly. |
| `entrypoints.root_manifest` | `mcp/lib/projects.js:299-300`, `:684-686`, `feedback.js:84-87` | Read as a required precondition (throws/returns error if unset) - this is the one place something resembling "stage prerequisite" enforcement already exists, informally, per call site rather than centrally. |
| scene `status` field (`'draft'` etc., `STATUS_SCENE` vocabulary) | `projects.js:467` sets it, nothing reads it | `saveProjectArtifact`'s `scene` case spreads `...metadata` after `status: 'draft'` (`:468`), so a caller *could* pass `metadata: { status: 'approved' }` to override it - no validation against `STATUS_SCENE`, no enforcement downstream. |

**Confirmed root cause matches the issue:** the approval vocabulary (`STATUS_PROJECT`
`approved`, `STATUS_SCENE` `approved`, `entrypoints.approved_render`) exists in the type
shape but nothing writes to it under real conditions and nothing but `feedback.js:138`
reads it. There is no order enforcement anywhere in `mcp/lib/`.

### 1d. `story-beats.js` optional-storyboard confirmation

`planStoryBeats({ story_brief, archetype_slug, storyboard, audio_beats, options })`
(`mcp/lib/story-beats.js:320`) takes `storyboard` as an unchecked optional destructure,
no default, no throw. Panels are read only if present
(`:376`, `const panels = Array.isArray(storyboard?.panels) ? storyboard.panels : [];`),
and the beat plan reports `storyboard_aware: panels.length > 0` (`:466`). Exactly as the
issue states.

### 1e. Fixture scope - `projects/` and `examples/`

- `projects/` on `origin/main`: **3** projects (`fintech-sizzle`, `polaris-observability`,
 `aria-cloud-console`). All three have a non-null `entrypoints.storyboard`, but per 1b
 that field is not a reliable completion signal for `fintech-sizzle`; the other two do
 have a real `concept/storyboard.json` on disk.
- `examples/` on `origin/main`: **5** entries. None contain a `project.json`
 (`find examples/ -iname project.json` returns nothing). They are golden test fixtures
 read directly by `mcp/test/*.test.js` via raw file paths (e.g.
 `confidence-upgrade.test.js:231`, `shot-grammar-first.test.js:49`), never through
 `getProject`/`saveProjectArtifact`. **They never touch the enforcement path and need
 no grandfathering.**

## 2. Stage map draft

Per-project completion state lives in a new `stages` block inside `project.json` (not
inferred from `entrypoints.*`, precisely because of the overwrite bug in 1b). The map
*shape* (stage order, `requires`, `approval`) is a static catalog document; the map
*state* (which stages this project has completed/approved) is per-project.

```jsonc
// catalog/stage-map.json (shape - static, versioned, NOT a per-project file)
{
 "stage_map_version": 1,
 "stages": [
 { "key": "brief", "requires": [], "produces_kind": "brief", "approval": false },
 { "key": "storyboard", "requires": ["brief"], "produces_kind": "storyboard","approval": true },
 { "key": "beats", "requires": ["storyboard"], "produces_kind": "beats", "approval": false, "persisted": false, "note": "no durable artifact today; see 1b/3. Not gated until produces_kind lands." },
 { "key": "scenes", "requires": ["storyboard"], "produces_kind": "scene", "approval": false },
 { "key": "manifest", "requires": ["storyboard"], "produces_kind": "manifest", "approval": false },
 { "key": "render", "requires": ["manifest"], "produces_kind": ["render", "master"], "approval": true, "approval_role": "approved" },
 { "key": "review", "requires": ["render"], "produces_kind": "review", "approval": false }
 ]
}
```

```jsonc
// project.json addition (per-project state, written by saveProjectArtifact/approveStage)
{
 "...": "existing fields unchanged",
 "stage_map_version": 1, // absent/null == legacy project, see Section 3
 "stages": {
 "brief": { "status": "complete", "completed_at": "2026-09-11T12:00:00Z" },
 "storyboard": { "status": "approved", "completed_at": "...", "approved_at": "...", "approved_note": "panels cover all 4 features" },
 "scenes": { "status": "complete", "completed_at": "..." },
 "manifest": { "status": "not_started" }, "render": { "status": "not_started" }, "review": { "status": "not_started" }
 }
}
```

`status` values: `not_started` → `complete` (artifact saved) → `approved` (only for stages
with `approval: true`, via `approve_stage`). A stage with `approval: false` is usable by
its dependents as soon as it's `complete`.

**Versioning so old projects are detectable:** `project.json.stage_map_version` is the
signal. `initProject` (`projects.js:127-193`) starts stamping it going forward
(`stage_map_version: 1`, `stages: {}` all `not_started`). Any project written before this
change has no `stage_map_version` key at all - `undefined`, not `0` - which is
unambiguous and matches how `entrypoints.latest_master` already rolled out (added later,
absent on old projects, nobody back-filled it). `catalog/stage-map.json`'s own
`stage_map_version` lets the map shape itself evolve later without a second versioning
scheme.

## 3. Decision for James: strict vs. grandfathered

The issue's own proposed decision: *"storyboard is a strict prerequisite for new
projects; projects without a stage map are grandfathered."* Concretely, on 3 real
projects and 5 fixture examples:

**Option A - Strict for new, grandfathered for existing (the issue's proposal).**
`saveProjectArtifact`/`approveStage` check `project.stage_map_version`. Present → enforce.
Absent (all 3 current `projects/`, since none will have the field before this ships) →
skip enforcement entirely, stage checks are a no-op. `initProject` stamps
`stage_map_version` on every project from here on.
- Breaks: nothing today. All 3 existing projects keep working exactly as now, forever,
 unless someone manually adds `stage_map_version` to their `project.json`.
- Cost: the `fintech-sizzle` overwrite bug (1b) stays live for grandfathered projects - 
 acceptable, since strict enforcement wouldn't have caught it retroactively anyway (the
 file really is missing).
- Tests/`/direct`/`/sizzle`: unaffected for existing fixtures; new projects created by
 tests need `stage_map_version` seeded or they're strict by default (see below).

**Option B - Strict for everyone, one-time migration.** Add `stage_map_version: 1` and a
computed `stages` block to the 3 existing `projects/*/project.json` files (a one-off
script, not a runtime migration), backfilling `stages.storyboard.status` from whether
`concept/storyboard.json` exists on disk (true for
`polaris-observability`/`aria-cloud-console`, false for `fintech-sizzle`).
- Breaks: `fintech-sizzle` becomes append-blocked until someone re-runs
 `compose_storyboard` + `save_project_artifact(kind: storyboard)` against it. Its existing
 `root_manifest`/render files aren't touched retroactively, only *new* scene/manifest
 saves against that project.
- `examples/` untouched either way (1e, never calls these tools).
- `mcp/test/projects.test.js` builds fresh temp projects per test
 (`describe('saveProjectArtifact', ...)`, `:272-410`) - each would need
 `stage_map_version` plus a completed `storyboard` stage seeded in `beforeEach`.

**Option C - Opt-in per project (`enforce_stages: true` flag).** Strict only for projects
created via a new `--strict-stages` flag on `init_project`. Weakest: invites "just don't
set the flag" as the workaround to the discipline problem this issue exists to fix, and
adds a third piece of per-project state. Not recommended.

**Recommendation: Option A.** Matches the issue's own acceptance criterion verbatim,
costs nothing against the 3 real projects and 5 fixtures inventoried above, and skips a
migration script whose correctness (Option B's "does the file exist on disk" backfill
logic) would itself need review, the exact kind of informal inference this issue exists
to stop. Tradeoff: `fintech-sizzle` keeps its clobbered entrypoint until someone touches
it by hand, acceptable for one already-shipped demo, not for the steady state going
forward.

## 4. Tool contracts

### `approve_stage({ project, stage, note, actor? })`

```jsonc
// input
{ "project": "string (slug or path)", "stage": "string (one of catalog/stage-map.json stages[].key)",
 "note": "string, required", "actor": "string, optional - who/what approved (human name or 'auto:/direct')" }

// output (mirrors saveProjectArtifact's return shape: updated project.json)
{ "...projectData": "...", "stages": { "storyboard": { "status": "approved", "approved_at": "...", "approved_note": "...", "approved_by": "..." } } }

// errors (thrown Error, uncaught by the handler, same convention as
// handleSaveProjectArtifact at handlers.js:2644-2647, not handleRecordRenderFeedback's
// try/catch at :2659-2668)
"Project not found: <id>"
"Unknown stage: <stage>. Valid stages: brief, storyboard, ..." // forged/unknown key
"Stage \"<stage>\" is not gated (approval: false) - nothing to approve"
"Cannot approve \"<stage>\": predecessor \"<dep>\" is not complete"
"note is required for approve_stage" // no silent approval
```

Approval is explicit and recorded, but **not restricted to a human caller** - there's no
human-authentication concept in this stdio-only tool surface (Tier 2, `tool-groups.js:143-150`),
and `/direct` runs autonomously. `actor: 'auto:/direct'` self-identifies an autonomous
approval; it's still explicit, timestamped, and visible in `project.json`. The discipline
the issue asks for is "never silent," not "always human." See Section 7, item 1.

### `save_project_artifact` refusal shape

Same function, same signature, `projects.js:414-532`. New check inserted before the
existing `switch (kind)` block (`:439`), after `getProject` resolves (`:425-428`) so the
"project not found" error still fires first:

```js
const gate = checkStagePrerequisites(proj, kind, options.override_reason);
if (!gate.ok) {
 throw new Error(
 `save_project_artifact refused: kind "${kind}" requires stage "${gate.missing_stage}" ` +
 `to be ${gate.needs_approval ? 'approved' : 'complete'} first (currently "${gate.actual_status}"). ` +
 `Pass override_reason to bypass and record why.`
 );
}
```

Error names the specific missing prerequisite and its current status, not a generic
"blocked," matching the acceptance criterion ("fails and names the missing
prerequisite"). `review`'s direct `writeJSON` to `review/evaluation.json`
(`projects.js:636`) is unaffected by this check by construction (1b), so
`reviewProject` must call the same `checkStagePrerequisites` helper before writing, or
the gate is silently absent on that one path: a second call site for the same
predicate, which needs to be one shared function, not logic inlined twice.

### `override_reason` schema

```jsonc
// passed alongside existing save_project_artifact / new approve_stage args
{ "override_reason": "string, required when bypassing a gate, min length enforced (non-empty, non-whitespace)" }

// recorded in project.json, never silent, alongside the artifact it unblocked:
"overrides": [
 { "at": "2026-09-11T12:30:00Z", "tool": "save_project_artifact", "kind": "manifest",
 "reason": "storyboard skipped intentionally for a 5-second logo-only bumper, no scenes to design",
 "stage_blocked": "storyboard" }
]
```

Appended to a `project.json.overrides` array (never overwritten, unlike `entrypoints.*`)
so a project's override history survives multiple bypasses. `checkStagePrerequisites`
still runs and still reports what was missing - the override doesn't suppress the
computation, only the throw.

### Atomic `project.json` writes

Current `writeJSON` (`projects.js:101-103`) is a direct `writeFile` - a crash or
concurrent read mid-write can observe a truncated/partial file. Fix: write to a temp
path in the same directory, then `rename()` (POSIX-atomic on the same filesystem, the
Node equivalent of the issue's cited `os.replace`):

```js
export async function writeJSONAtomic(filePath, data) {
 const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
 await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
 await rename(tmp, filePath);
}
```

This fixes torn reads, not lost updates: `saveProjectArtifact`/`approveStage` are still
read-modify-write (`getProject` → mutate → `writeJSONAtomic`), so two concurrent calls
against the same project can still race and clobber each other (see 1b, the entrypoint
overwrite bug is this same shape without the concurrency). Tier 2 tools are stdio-only
(single Node process per session, `tool-groups.js:15-16`), so an in-process
`Map<project_root, Promise>` mutex around the read-modify-write closes the intra-process
race cheaply; it does not close a cross-process race (two sessions writing the same
project at once), out of scope here (no lock utility exists in the repo today, confirmed
by grep).

## 5. Test cases

| Case | Setup | Expected |
|---|---|---|
| Skipped predecessor | New project, `stage_map_version` set, no storyboard saved. Call `save_project_artifact(kind: 'manifest', ...)`. | Throws, names `storyboard` as the missing stage, names its status (`not_started`). |
| Unknown/forged stage key | `approve_stage({ project, stage: 'storyboad', note: '...' })` (typo) or a stage key not in `catalog/stage-map.json`. | Throws `Unknown stage`, does not silently no-op, does not fall through to approving something else. |
| Override recorded | `save_project_artifact(kind: 'manifest', override_reason: '...')` on a project with no storyboard. | Succeeds, `project.json.overrides` gains an entry with `stage_blocked: 'storyboard'`, the artifact saves normally otherwise. |
| Legacy project behavior | Project with no `stage_map_version` key (all 3 current `projects/*`). Call `save_project_artifact(kind: 'manifest', ...)` with no storyboard. | Succeeds unchanged (Option A grandfathering) - this is the regression test that protects `fintech-sizzle`/`polaris-observability`/`aria-cloud-console` from breaking. |
| Concurrent write | Two near-simultaneous `saveProjectArtifact` calls against the same `project_root` (e.g. `kind: 'scene'` twice for different `scene_id`s) without the in-process mutex. | Demonstrates the lost-update race (one scene entry missing) - this test should exist to justify shipping the mutex, then re-run green once it's added. |
| Approval required, not given | `render` stage has `approval: true`. Save a `render` artifact, then try to save a `review` artifact (which `requires: ["render"]`) before calling `approve_stage('render', ...)`. | Throws - `complete` is not `approved`; `review` needs the approved status, not just artifact-saved. |
| `checkStagePrerequisites` shared between call sites | Unit test importing the helper directly, called once from `saveProjectArtifact`'s switch and once from `reviewProject`'s direct-write path. | Same predicate, same result, for the same project/kind pair - regression guard against the two-call-sites drifting apart (1b-style bug, prevented this time). |

## 6. Skill changes

`.claude/skills/direct/SKILL.md` is the only SKILL.md referencing these tools
(`compose_storyboard`, `save_project_artifact`, `plan_story_beats`, `render_project`,
`render_master` - confirmed by grepping every `SKILL.md` under `.claude/skills/`).

- **Step 2.5 (`:54-67`)** currently ends: *"The loop continues either way - this is the
 design checkpoint, not a hard gate."* That sentence becomes false once `storyboard` is
 `approval: true`. Replace with a call to `approve_stage({ project, stage: 'storyboard',
 note: <panel coverage summary already being surfaced to the user per :65>, actor:
 'auto:/direct' })` immediately after the storyboard is saved, using the
 panel-count/content-type/empty-composition summary the step already computes as the
 `note`. This is also where Step 8's save-table bug (1b) gets fixed: split `Storyboard`
 and `Beat plans` onto distinct `kind`s (`storyboard` vs. a new `beats` kind, once
 Section 7 item 2 gives it one) so beat-plan saves stop overwriting the storyboard
 entrypoint.
- **Step 8 (`:124-138`)** currently saves `brief`, `storyboard`, beat plans, `manifest`,
 and `review` all in one undifferentiated batch at the end of the run. Once
 `manifest`/`scene` saves require `storyboard` to be `approved`, the storyboard save +
 approval from Step 2.5 must have already happened by the time Step 8 runs, or Step 8's
 manifest save fails against a storyboard that was only ever composed in-memory.
- No other `SKILL.md` (`storyboard`, `sizzle`, `brief`, `animate`, etc.) calls
 `save_project_artifact` or any gated tool directly, so none need a matching change - 
 worth a second grep pass once the real implementation lands, since a new skill could be
 added between now and then.

## 7. Open questions

1. **Human vs. agent approval.** `approve_stage` as designed accepts any caller,
 including `/direct`'s autonomous loop self-approving its own storyboard. That satisfies
 "never silent" but not "a human looked at it," which is what
 `docs/cinematography/design-pipeline-audit.md`'s target-pipeline row 2.5 ("human review,
 approval, gate before any HTML") actually means. Is a self-approved
 `actor: 'auto:/direct'` acceptable for the MVP, or should autonomous runs stop and
 surface the storyboard for a real human turn first? Product decision, not an inventory
 finding.
2. **Does `beats` get a real `produces_kind`, or stay ungated?** Section 2 marks it
 `persisted: false`. Fixing the storyboard/beat-plan `kind` collision (1b) argues for
 giving it one, but there are x3 beat plans per `/direct` run and "beats is complete" is
 ambiguous with only one of three saved. Recommend: don't gate `beats` in v1 (the
 acceptance criteria never mention it as a gate), fix the `kind` collision as a
 correctness bug independent of gating. Related: should `manifest` also require
 `scenes`? Not proposed here, `plan_sequence` runs before all scenes necessarily exist
 per-file in a `/direct` run, so gating on it would likely break candidate generation.
3. **`review` requiring `render` to be `approved`, not just `complete`.** Section 2 wires
 it that way by extension of `render`'s `approval: true`, but `reviewProject` only ever
 reads the manifest + scenes, never the rendered output - nothing in current code needs
 a completed render to run a review. That's a new constraint this issue would introduce,
 not one implied by existing behavior; confirm it's intended and not scope creep.
4. **Where the ANI-210 gate hook and this stage check compose.** `render_master`'s
 insertion point is `render-master.js:249-255`, right after `loadProjectSource(project)`
 resolves and before any compose/compile/gate work runs (`:260` onward) - cheapest
 possible failure. `render_project`'s equivalent point is `projects.js:679-682`, after
 `getProject` resolves, before preflight (`:733`). If ANI-210's shared gate hook wants
 the same early checkpoint in these two functions, it should run first (a stage-prereq
 failure is cheaper and more fundamental than a quality verdict), and the two checks
 should stay separate functions - "is project state consistent" vs. "does this render
 pass quality gates" are different questions. ANI-210 itself is out of scope here.
5. **`stage_map_version` bump semantics.** If `catalog/stage-map.json` changes later (a
 stage added/removed/reordered), what happens to projects mid-flight under the old
 version? Not designed here; Section 2's versioning field only solves "detect legacy
 projects with no map at all," not "detect projects on map v1 once v2 ships."
