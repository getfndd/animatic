# ANI-212 - Stage map design draft

Design draft only, no product code. Written against `origin/main` at `863478d` (fetched
2026-09-11, worktree `~/.claude-worktrees/animatic/ani-212-stage-map`, branch
`james/ani-212-stage-map-design`). Clean-room: OpenMontage source was not opened, the
mechanism description in ANI-212/ANI-209 is the only input taken from that project.
Parent: ANI-209 (clean-room reimplementation of OpenMontage's stage-gate mechanism, MIT
license preserved). Sibling: ANI-210 (shared gate hook for `render_master` + preflight,
not designed here, only where this stage check sits relative to it, and its own override
plan is being revised in parallel against the same rule as Section 4's generic override
shape). Prior art: ANI-151 (`compose_storyboard`, shipped, the storyboard producer this
issue gates) and `docs/cinematography/design-pipeline-audit.md`, whose target-pipeline
table already lists `2.5 human review, approval, gate before any HTML`, the strongest
existing precedent for where an approval belongs.

**Update 2026-09-11:** James made the three open decisions below (strict/grandfathered,
approval default, override shape). Sections 3, 4, 6, and 7 are revised accordingly.
Sequencing note: ANI-220 (beat plans saved under `kind: storyboard`, clobbering the
pointer, see 1b) is being fixed first as a data-integrity bug, landing before ANI-212.
This draft assumes ANI-220 has already given beat plans their own `kind`/entrypoint by
the time this work starts, and designs the `beats` stage accordingly.

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
Section 2 tracks completion in a separate `stages` block for this reason. This exact
collision is ANI-220's data-integrity fix (beat plans get their own `kind`), which is
being landed first, as a prerequisite to this issue rather than something this issue
also has to fix. Section 2's `beats` stage assumes that kind already exists. It stays a
worked example here regardless: `fintech-sizzle` is also this doc's canonical case for
the grandfather warning in Section 3a, since its `entrypoints.storyboard` is present but
unreliable, exactly the "unknown, not missing" case that warning has to distinguish.

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
 { "key": "beats", "requires": ["storyboard"], "produces_kind": "beats", "approval": false, "note": "produces_kind assumes ANI-220 lands first (beat plans get a dedicated kind, no longer collide with storyboard's entrypoint, see 1b)" },
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
 "storyboard": { "status": "approved", "completed_at": "...", "approved_at": "...",
 "approved_note": "panels cover all 4 features", "approved_by": "James Schuyler", "approval_policy": "human" },
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

## 3. Decision (recorded 2026-09-11): strict for new, grandfathered for existing

James decided **Option A**, with one addition: grandfathering must not be silent (3a).
Options B/C are kept below as the record of what was considered and rejected, unchanged
from the original draft.

**Option A - Strict for new, grandfathered for existing (decided).**
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

**Why A over B/C:** matches the issue's own acceptance criterion verbatim, costs nothing
against the 3 real projects and 5 fixtures inventoried above, and skips a migration
script whose correctness (Option B's "does the file exist on disk" backfill logic) would
itself need review, the exact kind of informal inference this issue exists to stop.
Tradeoff, addressed by 3a rather than accepted silently: `fintech-sizzle` keeps its
clobbered entrypoint until someone touches it by hand, which is fine only as long as
that state stays visible.

### 3a. Grandfather warning - the debt stays visible, never blocking

A grandfathered project (no `stage_map_version`) must never be gated, but every read
surface that already loads the project state surfaces a structured, non-blocking warning
naming it grandfathered and listing what's missing or unverifiable. New helper,
`getStageWarning(proj)` (proposed `mcp/lib/stage-map.js`, alongside
`checkStagePrerequisites`):

```jsonc
// returned by getStageWarning; null for any project with stage_map_version set
{
 "type": "stage_map_grandfathered",
 "project": "fintech-sizzle",
 "message": "Project predates the stage map (no stage_map_version) - prerequisites are not enforced.",
 "stages": {
 "brief": "inferred_complete", "storyboard": "unknown", "beats": "unknown",
 "scenes": "inferred_complete", "manifest": "inferred_complete",
 "render": "inferred_complete", "review": "inferred_missing"
 },
 "detected_at": "2026-09-11T12:00:00Z"
}
```

Per-stage values are best-effort, explicitly labeled as inference, never authoritative:
`inferred_complete` / `inferred_missing` come from existing signals (`entrypoints.*` set
+ file exists on disk; `scenes.length > 0`; `masters.length > 0`). `unknown` is used when
the signal itself is untrustworthy, not merely absent, which is exactly
`fintech-sizzle`'s case: `entrypoints.storyboard` is set but points at a beat-plan file
(1b), so the checker cannot call it complete OR missing, it has to say so. This is the
worked example the test in Section 5 uses.

**Where it surfaces** (never a return-value change that could break an existing caller,
always an added field):
- `getProject` (`projects.js:253`) - adds `stage_warning` to the returned object.
- `getProjectContext` (`projects.js:331`) - adds `result.stage_warning` alongside
 `result.project`, so `/direct` Step 1 sees it on every run without a new call.
- `reviewProject` (`projects.js:545`) - adds `stage_warning` into the `evaluationOutput`
 object that's already written to `review/evaluation.json` (`:636`), so the warning is
 durably logged as part of the review record, not just returned once.
- `renderProject` (`projects.js:668`) / `renderMaster` (`render-master.js:239`) - adds
 `stage_warning` to the return payload, surfaced to whoever is watching the render
 (human or agent), never written into the render artifact itself.

**Guarantee:** `getStageWarning` never throws and never affects control flow, it's a pure
read appended to an existing successful result. `checkStagePrerequisites` (Section 4)
short-circuits to "no gate" for a grandfathered project *before* `getStageWarning` would
even be relevant to that call, so the warning and the enforcement skip are two separate
codepaths that can't contradict each other by construction.

## 4. Tool contracts

### `approve_stage({ project, stage, note, actor, policy? })`

**Decided 2026-09-11: human approval is the default, not self-approval.** `policy`
defaults to `'human'`; any other value is rejected for now ("policy not implemented" -
see Section 6 for how `/direct` actually stops and waits rather than calling this tool
itself). `actor` is now required, not optional, matching "attributable" for every
approval, not only overrides (Section 4's override shape below applies the same rule).

```jsonc
// input
{ "project": "string (slug or path)", "stage": "string (one of catalog/stage-map.json stages[].key)",
 "note": "string, required", "actor": "string, required - who/what approved, e.g. a human name, or 'auto:/direct' once an unattended policy ships",
 "policy": "string, optional, default 'human' - the approval_policy that authorized this call" }

// output (mirrors saveProjectArtifact's return shape: updated project.json)
{ "...projectData": "...", "stages": { "storyboard": {
 "status": "approved", "approved_at": "...", "approved_note": "...",
 "approved_by": "...", "approval_policy": "human" } } }

// errors (thrown Error, uncaught by the handler, same convention as
// handleSaveProjectArtifact at handlers.js:2644-2647, not handleRecordRenderFeedback's
// try/catch at :2659-2668)
"Project not found: <id>"
"Unknown stage: <stage>. Valid stages: brief, storyboard, ..." // forged/unknown key
"Stage \"<stage>\" is not gated (approval: false) - nothing to approve"
"Cannot approve \"<stage>\": predecessor \"<dep>\" is not complete"
"note is required for approve_stage" // no silent approval
"actor is required for approve_stage" // no anonymous approval either
"Unknown approval_policy \"<policy>\": only \"human\" is implemented" // fail closed, not silently accepted
```

The provenance record (`approved_by`, `approval_policy`, `approved_at`, `approved_note`)
is the "policy name, who/what invoked it, when, and the reason" James asked to design
now even though only `'human'` ships first: it's already a complete record shape, an
unattended policy added later is a new accepted `policy` value plus its own invocation
path, not a schema change. `actor`'s source is deliberately left to the caller (there's
no auth-identity concept in this stdio-only surface, Tier 2, `tool-groups.js:143-150`):
the `/direct` agent should pass whatever name/handle the human gave in conversation, or
a fixed literal like `'human (unspecified)'` if none was given, rather than leaving the
field empty. See Section 6 for the exact pause/resume mechanics.

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
 `Pass override_reason (and actor) to bypass and record why.`
 );
}
if (options.override_reason) {
 if (!options.actor) throw new Error('actor is required when passing override_reason');
 await recordOverride(proj, { type: 'stage_prerequisite', gate: gate.missing_stage,
 tool: 'save_project_artifact', reason: options.override_reason, actor: options.actor,
 detail: { kind, missing_stage: gate.missing_stage } });
}
```

Error names the specific missing prerequisite and its current status, not a generic
"blocked," matching the acceptance criterion ("fails and names the missing
prerequisite"). `review`'s direct `writeJSON` to `review/evaluation.json`
(`projects.js:636`) is unaffected by this check by construction (1b), so
`reviewProject` must call the same `checkStagePrerequisites` helper before writing, or
the gate is silently absent on that one path: a second call site for the same
predicate, which needs to be one shared function, not logic inlined twice.

### Override record - generic shape, shared with ANI-210

**Decided 2026-09-11:** overrides must be explicit, attributable, and visible, for
ANI-212's stage gates and ANI-210's content gates alike ("never overridable" was
rejected - it breeds shadow bypasses). This is a shared contract, not a stage-map-only
one, so the shape below is designed generic enough for ANI-210 to reuse without ANI-212
designing ANI-210's actual gates.

- **Explicit:** `override_reason` is its own dedicated parameter on every gated call
 (`save_project_artifact`, `approve_stage`, and whatever ANI-210's `render_master`/
 preflight hook ends up naming its equivalent). It is never inferred from another flag
 (e.g. `skip_preflight` does not imply an override, and an override does not imply
 `skip_preflight`) - two different bypasses, two different named parameters, always.
- **Attributable:** `actor` (required, same rule as `approve_stage` above), `at`
 (timestamp), `tool` (which call), and `reason` (the `override_reason` text, non-empty).
- **Visible:** recorded in `project.json.overrides[]` (persisted, never overwritten,
 array-appended so history survives multiple bypasses) *and* echoed into the calling
 tool's own return payload/log, not only written to disk silently - the caller sees the
 override record in the same response that tells them the artifact saved.

```jsonc
// generic override record - one entry per bypass, project.json.overrides[]
{
 "type": "stage_prerequisite", // discriminator; ANI-210 content gates would use e.g. "content_gate"
 "at": "2026-09-11T12:30:00Z",
 "actor": "James Schuyler", // required, same source rule as approve_stage's actor
 "tool": "save_project_artifact",
 "reason": "storyboard skipped intentionally for a 5-second logo-only bumper, no scenes to design",
 "gate": "storyboard", // the specific prerequisite/check bypassed, generic name
 "detail": { "kind": "manifest", "missing_stage": "storyboard" } // type-specific context
}
```

`checkStagePrerequisites` still runs and still computes what was missing even when
`override_reason` is present, the override doesn't suppress the computation, only the
throw, so `gate`/`detail` are always populated from a real check, never guessed. A
shared `recordOverride(project, { type, gate, tool, reason, actor, detail })` helper
(proposed alongside `checkStagePrerequisites` in `mcp/lib/stage-map.js`) is what both
ANI-212 and ANI-210 should call, so the two efforts don't independently invent slightly
different override shapes that then need reconciling later.

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
| Unknown/forged stage key | `approve_stage({ project, stage: 'storyboad', note: '...', actor: '...' })` (typo) or a stage key not in `catalog/stage-map.json`. | Throws `Unknown stage`, does not silently no-op, does not fall through to approving something else. |
| Override recorded, generic shape | `save_project_artifact(kind: 'manifest', override_reason: '...', actor: 'James Schuyler')` on a project with no storyboard. | Succeeds, `project.json.overrides` gains a `{ type: 'stage_prerequisite', gate: 'storyboard', actor, reason, at, tool, detail }` entry, and that same record is echoed in the call's return payload, not only written to disk. |
| Override missing actor | `save_project_artifact(kind: 'manifest', override_reason: '...')` with no `actor`. | Throws `actor is required when passing override_reason` - explicit never means anonymous. |
| Legacy project behavior | Project with no `stage_map_version` key (all 3 current `projects/*`). Call `save_project_artifact(kind: 'manifest', ...)` with no storyboard. | Succeeds unchanged (Option A grandfathering) - this is the regression test that protects `fintech-sizzle`/`polaris-observability`/`aria-cloud-console` from breaking. |
| Grandfather warning surfaces, never blocks | `get_project({ project: 'fintech-sizzle' })` against its real `origin/main` state (storyboard entrypoint pointing at a beat-plan file, 1b). | Succeeds; `stage_warning.type === 'stage_map_grandfathered'`, `stage_warning.stages.storyboard === 'unknown'` (not `'missing'`); a follow-up `save_project_artifact(kind: 'manifest', ...)` on the same project still succeeds with no override needed. |
| Grandfather warning absent for enforced projects | `get_project` on a project with `stage_map_version` set. | `stage_warning === null`. |
| Concurrent write | Two near-simultaneous `saveProjectArtifact` calls against the same `project_root` (e.g. `kind: 'scene'` twice for different `scene_id`s) without the in-process mutex. | Demonstrates the lost-update race (one scene entry missing) - this test should exist to justify shipping the mutex, then re-run green once it's added. |
| Approval required, not given | `render` stage has `approval: true`. Save a `render` artifact, then try to save a `review` artifact (which `requires: ["render"]`) before calling `approve_stage('render', ...)`. | Throws - `complete` is not `approved`; `review` needs the approved status, not just artifact-saved. |
| Approval provenance recorded | `approve_stage({ project, stage: 'storyboard', note: '...', actor: 'James Schuyler' })` (default `policy: 'human'`). | `stages.storyboard` gains `approved_by: 'James Schuyler'`, `approval_policy: 'human'`, `approved_at`, `approved_note` - all four present, none inferred. |
| Non-human policy rejected | `approve_stage({ ..., policy: 'auto' })` (no such policy shipped yet). | Throws `Unknown approval_policy "auto": only "human" is implemented` - the parameter surface exists without silently permitting an unbuilt bypass. |
| `checkStagePrerequisites` shared between call sites | Unit test importing the helper directly, called once from `saveProjectArtifact`'s switch and once from `reviewProject`'s direct-write path. | Same predicate, same result, for the same project/kind pair - regression guard against the two-call-sites drifting apart (1b-style bug, prevented this time). |

## 6. Skill changes

`.claude/skills/direct/SKILL.md` is the only SKILL.md referencing these tools
(`compose_storyboard`, `save_project_artifact`, `plan_story_beats`, `render_project`,
`render_master` - confirmed by grepping every `SKILL.md` under `.claude/skills/`).

**Decided 2026-09-11: `/direct` stops for human storyboard approval by default.**
Self-approval collapses the pipeline's one real design checkpoint (the audit doc's row
2.5, "human review, approval, gate before any HTML"), so it is not what ships. New
`/direct` parameter: `--approval-policy` (default `human`; any other value errors for
now, per Section 4's `approve_stage` contract - the surface exists, nothing unattended
ships yet).

- **Step 2.5 (`:54-67`)** currently ends: *"The loop continues either way - this is the
 design checkpoint, not a hard gate."* Replaced with an explicit pause:
 1. Compose + save the storyboard as today (`compose_storyboard` then
 `save_project_artifact(kind: 'storyboard', ...)`), plus a `beats` kind for each of
 the three per-strategy beat plans once Section 2's assumption (ANI-220 landed) holds
 - `Storyboard`/`Beat plans` are no longer the same `kind`, so this step stops
 overwriting the storyboard entrypoint.
 2. **If `approval_policy === 'human'` (default):** surface the panel-count/
 content-type/empty-composition summary this step already computes, the path to
 `concept/storyboard.json`, and an explicit question - "Approve this storyboard to
 continue, or revise?" - then **end the turn**. Step 3 (`plan_story_beats`) is not
 called in this response. This is the pause; the storyboard sits at `stages.storyboard.status: 'complete'`,
 not yet `'approved'`, so a `manifest`/`scene` save attempted from here would still be
 refused (Section 4).
 3. **Resume:** when the user approves (same conversation, next message, or a fresh
 `/direct <project>` invocation later), the agent calls
 `approve_stage({ project, stage: 'storyboard', note: <the user's stated reason, or
 the panel-coverage summary if they gave none>, actor: <the human's name/handle from
 context, or 'human (unspecified)'>, policy: 'human' })`, then continues at Step 3 in
 that same response. **Cold-restart resume:** a fresh `/direct <project>` invocation's
 Step 1 (`get_project_context`) already loads `stages.storyboard.status` - if it's
 already `'approved'`, Step 2.5 skips straight to Step 3 instead of recomposing a
 storyboard that's already signed off.
 4. **Revision path:** if the user asks for changes instead, the agent revises
 (re-runs `compose_storyboard`/`save_project_artifact`, which resets
 `stages.storyboard.status` back to `'complete'`, requiring approval again) and
 returns to point 2.
 5. **If `approval_policy` is anything else:** `approve_stage` rejects it today
 (Section 4), so Step 2.5 surfaces that error rather than silently falling back to
 either behavior - no policy value is treated as an implicit "skip the human."
- **Step 8 (`:124-138`)** currently saves `brief`, `storyboard`, beat plans, `manifest`,
 and `review` all in one undifferentiated batch at the end of the run. By the time Step
 8 runs, storyboard approval already happened at Step 2.5 (the pipeline cannot reach
 Step 3 otherwise), so Step 8 only needs the `kind` split from point 1 above; it no
 longer needs to also carry the approval call.
- No other `SKILL.md` (`storyboard`, `sizzle`, `brief`, `animate`, etc.) calls
 `save_project_artifact` or any gated tool directly, so none need a matching change -
 worth a second grep pass once the real implementation lands, since a new skill could be
 added between now and then.

## 7. Open questions

Resolved by James's 2026-09-11 decisions (Sections 3a, 4, 6) and removed from this list:
human-vs-agent approval default, and the `beats` `produces_kind` question (now assumed
solved upstream by ANI-220, see the intro's sequencing note and 1b).

1. **Should `manifest` also require `scenes`?** Not proposed here - `plan_sequence` runs
 before all scenes necessarily exist per-file in a `/direct` run, and gating it would
 likely break the existing candidate-generation flow. Flagging so the decision is
 explicit rather than assumed, same reasoning as before, just renumbered.
2. **`review` requiring `render` to be `approved`, not just `complete`.** Section 2 wires
 it that way by extension of `render`'s `approval: true`, but `reviewProject` only ever
 reads the manifest + scenes, never the rendered output - nothing in current code needs
 a completed render to run a review. That's a new constraint this issue would introduce,
 not one implied by existing behavior; confirm it's intended and not scope creep.
3. **Where the ANI-210 gate hook and this stage check compose.** `render_master`'s
 insertion point is `render-master.js:249-255`, right after `loadProjectSource(project)`
 resolves and before any compose/compile/gate work runs (`:260` onward) - cheapest
 possible failure. `render_project`'s equivalent point is `projects.js:679-682`, after
 `getProject` resolves, before preflight (`:733`). If ANI-210's shared gate hook wants
 the same early checkpoint in these two functions, it should run first (a stage-prereq
 failure is cheaper and more fundamental than a quality verdict), and the two checks
 should stay separate functions - "is project state consistent" vs. "does this render
 pass quality gates" are different questions. ANI-210 itself is out of scope here; the
 override record shape in Section 4 is designed to be shared, the gate logic is not.
4. **`stage_map_version` bump semantics.** If `catalog/stage-map.json` changes later (a
 stage added/removed/reordered), what happens to projects mid-flight under the old
 version? Not designed here; Section 2's versioning field only solves "detect legacy
 projects with no map at all," not "detect projects on map v1 once v2 ships."
5. **`actor` provenance beyond a free-text name.** Section 4 requires `actor` on every
 approval and override but has no identity system to draw it from (stdio-only, no auth).
 Good enough for a first cut, but a free-text field can't be verified later ("did James
 actually say this, or did the agent guess a name"); worth deciding whether that's
 acceptable long-term or needs a real identity source once one exists in this surface.
6. **`unattended` policy design.** Section 4/6 reserve the `policy` parameter and reject
 every value but `'human'`, deliberately not designing an unattended path now. When one
 is needed, it should specify at minimum: what triggers it (an explicit
 `--approval-policy` on the `/direct` invocation, never a default), what `actor` records
 for a fully autonomous run, and whether it's scoped per-project or per-invocation.
