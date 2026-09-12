# ANI-212 - Stage map design draft (core)

Design draft only, no product code. Written against `origin/main` at `863478d`, worktree
`~/.claude-worktrees/animatic/ani-212-stage-map`, branch `james/ani-212-stage-map-design`.
Clean-room: OpenMontage source was not opened.

**Round 3 (this revision, the review cap).** Codex rejected round 2 (`7e39267`) at P1 on
a read-only review. Round 2's findings spread across five designs bundled into one
issue. James split it 2026-09-12: **this doc now covers only the core** (stage map,
persistence gate, admission at durable producers, override shape, grandfather warning).
Four other areas became their own issues, each with its own review, not designed here:

| Issue | Owns | Interface the core consumes |
|---|---|---|
| ANI-227 | Stable project identity (not slug; `getProject` today returns the first date-prefixed folder `readdir` happens to list for an ambiguous slug) | A stable id, not derived from caller input, that the legacy ledger keys on instead of slug |
| ANI-228 | Cross-process-safe `project.json` writes: lockfile lifecycle, atomic rename, canonical `realpath` key, every mutation under both lock layers | Nothing new required to ship the core; the core's own writes already go through ANI-220's landed in-process `withFileLock` |
| ANI-229 | Server context passed to tool handlers; `approve_stage` over MCP elicitation with an attested fallback | `approval_channel: 'elicitation' \| 'attested'` on the stage record (core defines the field; ANI-229 is what ever writes `'elicitation'`) |
| ANI-230 | `/direct` resume: run checkpoint, `story_brief` include + legacy JSON-brief fallback, storyboard digest rechecked by the shared checker | `approved_digest` stored on the stage record at approval time (core writes it once; ANI-230 is what re-verifies it on every gated path) |

Superseded text (the round-2 lock/elicitation/digest-recheck mechanism designs, now
those issues' scope) is deleted below, not annotated.

## 1. Core design

### 1a. Stage map

`beat_plan` (singular, not `beats`) matches what ANI-220 shipped
(`mcp/lib/projects.js`'s `saveProjectArtifact` `case 'beat_plan'`, keyed by `role` = the
strategy, populating a `beat_plans` array; `get_project_context`'s `include` already
supports `'beat_plans'`). Pre-render candidate-evaluation artifacts get their own stage
(`candidate_review`, 1e), not `review` -- the fix for the `/direct` deadlock where
`review` required an unproduced render.

```jsonc
{
  "stage_map_version": 1,
  "stages": [
    { "key": "brief", "requires": [], "produces_kind": "brief", "approval": false },
    { "key": "storyboard", "requires": ["brief"], "produces_kind": "storyboard", "approval": true },
    { "key": "beat_plan", "requires": ["storyboard"], "produces_kind": "beat_plan", "approval": false },
    { "key": "scenes", "requires": ["storyboard"], "produces_kind": "scene", "approval": false },
    { "key": "manifest", "requires": ["storyboard"], "produces_kind": "manifest", "approval": false },
    { "key": "candidate_review", "requires": ["manifest"], "produces_kind": "candidate_review", "approval": false },
    { "key": "render", "requires": ["manifest"], "produces_kind": ["render", "master"], "approval": true, "approval_role": "approved" },
    { "key": "review", "requires": ["render"], "produces_kind": "review", "approval": false }
  ]
}
```

Per-project state (`project.json.stages`): `not_started` -> `complete` -> `approved`.
`approve_stage` requires `complete` first (no `not_started -> approved`). An approved
`storyboard` stores `approved_digest` (sha256 of the file at approval time, computed and
stored by core; re-verifying it on every gated path is ANI-230's addition to 1b's
checker, not built here) and `approval_channel` (core always writes `'attested'` until
ANI-229 ships the elicitation path, 2).

### 1b. Prerequisites checked at persistence

`saveProjectArtifact` gains a check before its `switch (kind)` (`projects.js:439`):
refuse a kind whose stage's `requires` aren't `complete` (or `approved`, for the render
stage), naming the missing stage and its status, unless `override_reason` is supplied.
This is the shared `checkStagePrerequisites` function every 1c call site below reuses,
not reimplements.

**Concurrency, stated honestly:** this write, and every other writer in 1c, goes through
ANI-220's landed `withFileLock` (in-process only). **Until ANI-228 lands, that is what
the core has** -- a second stdio session writing the same project concurrently can still
lose an update. The core ships anyway: single-session use is the common case, the defect
class is understood and already filed (ANI-228), and blocking the whole stage-map
feature on a second, larger piece of lock-lifecycle work would leave the (also real)
storyboard-skipping problem unfixed in the meantime. ANI-228's job is to wrap these same
call sites in a cross-process layer without changing their shape.

### 1c. Checks before side effects, at every durable producer

Each producer gets an admission call (`checkStagePrerequisites` against the relevant
stage/kind, `override_reason`+`actor` accepted) **before** its own side effect, not
relying on a shared downstream chokepoint -- round 2's mistake was assuming one existed
inside `renderRemotionSequence`; several producers write durably before ever reaching
there.

- **`render_project`** (`projects.js:679`, right where `getProject` resolves): checked
  before preflight, and critically before `prepareVoiceoverTrack` (`:783`), which
  synthesizes and caches TTS audio files to disk (`tts.js`) well before the render call
  at `:799`. Gating only at the render call, as round 2 did, leaves voiceover synthesis
  as an ungated durable write.
- **`render_master`'s persist branch** (`render-master.js:337`, where `proj` resolves)
  checked before `persistMaster` (`:341`), which writes the manifest/timelines/index
  regardless of whether `encode` also runs.
- **`encodeMaster`** (`master-persist.js`, inside its per-artifact loop): checked before
  `assembleVideoSequence` (`:193`), not only before the render call at `:205`. **This is
  the real fix for the dry-run gap round 2 missed:** `assembleVideoSequence` writes
  `render-props.json` unconditionally -- `dryRun` only skips the later `render()` call,
  not the props write. Gating solely at the render call means every dry-run write was
  never admitted.
- **`assemble_video_sequence`** (the standalone tool, `tools.js`'s `assemble_video_sequence`
  entry, currently `manifest`/`scene_defs`/`scenes`/`plates`/`timelines`/`output_dir`/
  `output_path`, no `project` field at all): gains an optional `project` param, threaded
  to the underlying `assembleVideoSequence()`. When given, checked before the
  `output_dir` write (`video-assembly.js:121-124`). When omitted, structurally ungated,
  same as today -- a smaller, named residual instead of an unconditional public bypass.
- **`record_render_feedback`** (`feedback.js:78`, `getProject`): checked before the log
  append at `:127`. Its tool schema has no `override_reason`/`actor` today (`tools.js`'s
  `record_render_feedback` entry); both are added.
- **`review_project`** (`projects.js:546`, `getProject`): checked before the
  `review/evaluation.json` write at `:636`, then registers `stages.review` complete via
  `saveProjectArtifact({ kind: 'review', role: 'evaluation' })` afterward -- round 1/2
  never wrote that call. Its tool schema also has no `override_reason`/`actor`
  (`tools.js`'s `review_project` entry, `project`/`manifest` only) and gains both.

### 1d. Artifact paths must exist before a stage completes

`saveProjectArtifact` never checks that `artifactPath` exists on disk (confirmed: no
`existsSync` import anywhere in `projects.js`). **Fix:** for every file-backed `kind`
(`brief`, `storyboard`, `beat_plan`, `scene`, `manifest`, `render`, `master`, `review`,
`candidate_review`), the check in 1b also asserts `existsSync(join(project_root,
artifactPath))`, throwing `Artifact not found: <path>` if not -- a stage cannot reach
`complete` by registering a path nothing wrote.

### 1e. `candidate_review`: a strict role whitelist

`review`'s existing `case` accepts any `role` string verbatim (`projects.js:490-498`),
proven exploitable: without a whitelist, a caller could label arbitrary post-render data
`candidate_review` and skip the `review -> render` prerequisite the same way. **Fix:**
`candidate_review`'s case accepts only `role in ['score_card', 'comparison',
'contact_sheet']`, throwing `Unknown candidate_review role: <role>` otherwise. Scoped to
the new kind only; `review`'s existing permissive role is unchanged, pre-existing
behavior, not touched by this core.

### 1f. Grandfather warning, every project-returning surface

Unchanged list from round 2 (`list_projects`, `get_project`, `get_project_context`,
`export_storyboard_to_figma`, `exportFigmaImageFills`, `record_render_feedback`,
`render_master`, `render_project`, `review_project`), **plus the one round 2 missed:
`save_project_artifact`** (`handlers.js:2644`, `handleSaveProjectArtifact`, currently
serializes `saveProjectArtifact`'s result with no warning attached) -- the principal
persistence tool, and the one a grandfathered project's caller is most likely to be
calling. `stage_warning` is computed only at the handler boundary (never inside
`getProject` itself, so it can't ride a spread back into a write) and is a
`DERIVED_FIELDS` entry `saveProjectArtifact` strips before its own write, alongside
`project_root`.

### 1g. Legacy ledger, keyed by ANI-227's stable identity

The classifier is two-part: `stage_map_version == null AND <stable id> in
grandfathered_project_ids`. **The core does not invent the stable id** -- that is
ANI-227's entire scope, including deciding what happens when two projects share a slug.
The ledger's shape (a committed list in `catalog/stage-map.json`, captured once at
rollout from the projects that exist today, frozen, never grown) is designed here; what
goes *in* each entry is ANI-227's id, not a slug. See the slice plan (2) for why this is
the one hard dependency among the four split issues.

### 1h. Override parameters, every gated tool, one shared record

Every tool with an admission check in 1c, plus `save_project_artifact` and
`approve_stage`, accepts `override_reason` (required to bypass a refusal) and `actor`
(required whenever `override_reason` is given, never defaulted). One record shape,
appended to `project.json.overrides[]` in the same write as the mutation it accompanies,
never a separate write:

```jsonc
{ "type": "stage_prerequisite", "at": "...", "actor": "...", "tool": "...",
  "reason": "...", "gate": "<stage>", "detail": { "kind": "...", "missing_stage": "..." } }
```

`type` stays a generic discriminator on the chance something else reuses the shape;
that's not a claim about any specific other issue adopting it.

## 2. Slice plan

| Slice | Provides | Consumes | Depends on | Mergeability |
|---|---|---|---|---|
| ANI-227 | Stable project id, ambiguity-safe resolution | Nothing from the others | None | Merges first; nothing here depends on it landing in a particular shape beyond "an id exists" |
| **Core (ANI-212)** | Stage map, `checkStagePrerequisites`, 1c's admission call sites, existence checks, role whitelist, warning surfaces, override shape, attested-only `approve_stage` | ANI-227's stable id (1g); ANI-220's `withFileLock` (landed) | **ANI-227 (blocking)** | Cannot merge before ANI-227: 1g's ledger has no safe key without it. No safe interim -- a slug-keyed ledger is the exact bug ANI-227 exists to fix, so shipping one anyway just re-imports it. Independent of ANI-228/229/230 otherwise. |
| ANI-228 | Cross-process lock (lockfile lifecycle, atomic rename, canonical key), wrapping 1b/1c's call sites | Core's write call sites to wrap | Core merged first (wraps shapes core creates) | Merges any time after core; does not block core shipping (1b states the interim honestly) |
| ANI-229 | Server context in handlers; elicitation-based `approve_stage` | Core's `approve_stage` (extends it) | Core merged first | Merges any time after core; does not block core shipping (approve_stage ships attested-only, 1a) |
| ANI-230 | `story_brief`/run-checkpoint persistence; digest re-check added to `checkStagePrerequisites` | Core's shared checker (extends it) | Core merged first | Merges any time after core; does not block core shipping (`approved_digest` is stored but only re-verified where ANI-230 adds that) |

**What the core does before each dependency lands, stated plainly:**

- **Before ANI-227:** nothing -- this is the one blocking dependency. The core's PR
  cannot land until ANI-227's stable id exists for 1g to key on.
- **Before ANI-228:** ships with ANI-220's in-process lock only. Honest limit: a second
  concurrent MCP session can still lose an update against the same project. Stated in
  1b, not hidden.
- **Before ANI-229:** ships attested-only. `approve_stage` never attempts elicitation
  (that code doesn't exist yet); every approval records `approval_channel: 'attested'`,
  which is what the field is for -- no placeholder, no fake "pending" state.
- **Before ANI-230:** ships without cold-restart digest re-verification. `approved_digest`
  is computed and stored (1a) so ANI-230 has something to check against, but the core's
  own `checkStagePrerequisites` doesn't re-read the storyboard file on every gated call --
  only ANI-230 adds that. A direct filesystem edit after approval is not caught by the
  core alone; it needs ANI-230's addition to close.

## 3. Test matrix (core only)

| Case | Setup | Expected |
|---|---|---|
| Dry-run encode admission | `render_master({ persist: true, encode: true, dry_run_encode: true })` on an ungated project. | Refused before `assembleVideoSequence` writes `render-props.json`, not only before the (skipped) render call. |
| Direct `assemble_video_sequence`, with project | Call with `project` set, ungated. | Refused before the `output_dir` write. |
| Direct `assemble_video_sequence`, no project | Call with no `project`. | Succeeds ungated (named residual, not silently "covered"). |
| Voiceover pre-write | `render_project` on an ungated project with `voiceover.text` scenes. | Refused before `prepareVoiceoverTrack` runs; no TTS cache file written. |
| Nonexistent artifact path | `save_project_artifact(kind: 'manifest', path: 'motion/manifests/does-not-exist.json')`. | Throws `Artifact not found`, stage stays `not_started`. |
| `candidate_review` role whitelist | `save_project_artifact(kind: 'candidate_review', role: 'sneaky_full_review', ...)`. | Throws `Unknown candidate_review role`; the three real roles still succeed. |
| Warning on `save_project_artifact` | Call it against a grandfathered project. | Result carries `stage_warning`, closing round 2's gap. |
| Override provenance, every gated tool | For each of `save_project_artifact`, `approve_stage`, `render_project`, `render_master`, `encodeMaster`, `assemble_video_sequence` (with project), `record_render_feedback`, `review_project`: call with `override_reason` and no `actor`. | Every one throws the same "actor required" error; none silently accepts an anonymous override. |
| Legacy ledger blocked on ANI-227 | Attempt to implement 1g's ledger against slug alone. | Not a runtime test -- a review/merge-order check: this PR does not merge without ANI-227's id already available. |

**Alternate scene/manifest producers, verified this round, pure vs. durable:**

| Tool | Verdict | Evidence |
|---|---|---|
| `instantiate_sequence_archetype` | Pure, ungated | `handlers.js:2506`, sync function, no `writeFile`/`writeJSON` in its lib; `tool-groups.js` TRANSFORM/edge-ready |
| `create_editorial_canvas_scene` | Pure, ungated | `handlers.js:3107`, same pattern |
| `adapt_project_aspect_ratio` | Pure, ungated | `handlers.js:3248`; `tool-groups.js` notes "project" in the name is a misnomer -- it transforms an inline manifest |
| `create_social_cutdown` | Pure, ungated | `handlers.js:3298`, sync function over inline `manifest`, no `project` param, no write -- `tool-groups.js`'s `edgeReady:false` caution note ("may write cutdown files") is stale, same pattern round 1 found in `generate_scenes` |
| `revise_candidate_video` | Pure, ungated | `handlers.js:3692`; `tool-groups.js` TRANSFORM/edge-ready |

## 4. Decisions already made (no re-litigation)

- **Strict for new projects, grandfathered for existing**, with a non-blocking warning
  (1f) -- decided, options B/C considered and rejected in round 2.
- **Human approval by default, not self-approval.** Elicitation primary, attested
  fallback, decided; implementation is ANI-229 (2).
- **Every elicitation outcome (decline/cancel/timeout/malformed accept) means
  not-approved, no fallback to attested inside the same call** -- decided, ANI-229 builds
  it.
- **Unattended policy deferred on purpose**, not an oversight -- Codex agreed this is
  honest and should not block. `policy`/`actor`/`approval_channel` are the provenance
  shape a future unattended policy would use; no such policy ships now.
- **Overrides are explicit, attributable, and visible** -- a dedicated parameter, never
  implied by another flag; `actor`+timestamp+reason always recorded; never silent (1h).
