# ANI-212 - Stage map design draft (core)

Design draft only, no product code. Written against `origin/main` at `863478d`, worktree
`~/.claude-worktrees/animatic/ani-212-stage-map`, branch `james/ani-212-stage-map-design`.
Clean-room: OpenMontage source was not opened.

**Reviews are closed.** Four Codex rounds (`7e39267`, round 3, `45ae337`, James's one-time
cap override for round 4). Round 4 still came back REJECT with three new P1s; James
closed the loop there -- **no round 5, this revision's findings are binding
implementation requirements**, not proposals to re-litigate. Round 2's findings spread
across five designs bundled into one issue; James split it 2026-09-12 so **this doc
covers only the core** (stage map, persistence gate, admission at durable producers,
override shape, grandfather warning). Four other areas became their own issues, each
with its own review, not designed here:

| Issue | Owns | Interface the core consumes |
|---|---|---|
| ANI-227 | Stable project identity (not slug; `getProject` today returns the first date-prefixed folder `readdir` happens to list for an ambiguous slug) | A stable id, not derived from caller input, that the legacy ledger keys on instead of slug |
| ANI-228 | Cross-process-safe `project.json` writes: lockfile lifecycle, atomic rename, canonical `realpath` key, every mutation under both lock layers | Nothing new required to ship the core; the core's own writes already go through ANI-220's landed in-process `withFileLock` |
| ANI-229 | Server context passed to tool handlers; `approve_stage` over MCP elicitation with an attested fallback | `approval_channel: 'elicitation' \| 'attested'` on the stage record (core defines the field; ANI-229 is what ever writes `'elicitation'`) |
| ANI-230 | `/direct` cold-restart resume: run checkpoint, `story_brief` include + legacy JSON-brief fallback | Nothing for digest checking -- the core re-verifies `approved_digest` itself (1b). ANI-230 only needs the run-checkpoint read/write path. |

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
`approve_stage` requires `complete` first (no `not_started -> approved`); `override_reason`
does not bypass this invariant, only a stage-prerequisite refusal (1h). An approved
`storyboard` stores `approved_digest` (sha256 of the file at approval time) and
`approval_channel` (core always writes `'attested'` until ANI-229 ships the elicitation
path, 2). 1b's checker re-verifies `approved_digest` on every gated call.

### 1b. Prerequisites checked at persistence

`saveProjectArtifact` gains a check before its `switch (kind)` (`projects.js:439`):
refuse a kind whose stage's `requires` aren't satisfied, naming the missing stage and
its status, unless `override_reason` is supplied. **Generic rule, not a render-specific
special case:** a required stage satisfies the check at `complete` unless its own
`approval` is `true`, in which case it must be `approved`. `storyboard` is `approval:
true`, so `beat_plan`/`scenes`/`manifest` all require it `approved`, not merely
`complete` -- round 2 stated this only as a parenthetical about the render stage
(round 3's review caught it). This is the shared `checkStagePrerequisites`
function every 1c call site below reuses, not reimplements. It also re-hashes the
approved storyboard file on every call (below), not only at approval time.

**Digest re-check lives in the core, not ANI-230 (James decided this), and targets the
registered path, not a hard-coded one.** `saveProjectArtifact`'s `storyboard` case
stores whatever path the caller passed as `entrypoints.storyboard`
(`projects.js:444-445`), and the public schema allows any project-relative path
(`tools.js:827`) -- hard-coding `concept/storyboard.json` would hash the wrong file for
any project that registered its storyboard elsewhere, causing false refusal or worse,
approving bytes other than the registered artifact. **Fix:** both `approve_stage`
(hashing at approval time) and `checkStagePrerequisites` (re-hashing on every gated
call) resolve `proj.entrypoints.storyboard` first and hash that file. A mismatch is
refused as not-approved, naming the change, same error shape as a missing predecessor,
not a softer warning. Re-approving with the new digest clears it.

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
- **`assemble_video_sequence`** (the standalone tool; handler at `handlers.js:3847`
  passes `output_dir` straight through, `video-assembly.js:121` creates it and writes
  `render-props.json`; no `project` field on the public schema today). Naming it as an
  unconditional residual left a real bypass: omit `project`, point `output_dir` inside a
  strict project. **Fix, picked over resolving `output_dir` against every project root:**
  `project` becomes required whenever `output_dir` is set, matching how every other 1c
  producer is gated -- an explicit reference, not an inferred one. Checked before the
  write; calls with no `output_dir` stay ungated, unchanged.
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
`existsSync` import anywhere in `projects.js`), and a bare `existsSync` isn't enough: a
directory or a `../README.md` outside the project would still pass. **Fix:** for every
file-backed `kind` (`brief`, `storyboard`, `beat_plan`, `scene`, `manifest`, `render`,
`master`, `review`, `candidate_review`), the check in 1b resolves `artifactPath` with a
new `resolveWithinProject(project_root, artifactPath)` helper (rejecting absolute paths
and anything resolving outside the root through symlinks) and then asserts
`statSync(resolved).isFile()`, throwing `Artifact not found: <path>` if either check
fails. **The core ships this helper** (see the slice plan, 2, for why it isn't blocked on
ANI-222, which audits every *reader* against the same helper afterward rather than
forking its own).

### 1e. `candidate_review`: a strict role whitelist, bound to a path convention

`review`'s existing `case` accepts any `role` string verbatim (`projects.js:490-498`),
proven exploitable: without a whitelist, a caller could label arbitrary post-render data
`candidate_review` and skip the `review -> render` prerequisite the same way. **Fix:**
`candidate_review`'s case accepts only `role in ['score_card', 'comparison',
'contact_sheet']`, throwing `Unknown candidate_review role: <role>` otherwise. A
whitelist alone still lets any existing file be registered under an allowed role, so it
additionally requires `artifactPath` to equal a fixed path per role (mirroring how
`review`'s own paths are fixed at `initProject`), rejecting a mismatch rather than
trusting the caller's label:

```
score_card    -> review/candidates/score_card.json
comparison    -> review/candidates/comparison.json
contact_sheet -> review/candidates/contact_sheet.md
```

Not a single `<role>.json` template: `contact_sheet` is markdown prose today (the live
Step 8 table already writes `review/contact-sheet.md`), and forcing it into a JSON
string would be an unforced format change. `review/candidates` is a new `PROJECT_DIRS`
entry (`projects.js:~37`). Scoped to the new kind only; `review`'s permissive role is
unchanged.

### 1f. Grandfather warning, every project-returning surface

Unchanged list from round 2 (`list_projects`, `get_project`, `get_project_context`,
`export_storyboard_to_figma`, `figma_frame_to_scene` (the public tool; its handler at
`handlers.js:1147` calls the private `exportFigmaImageFills` helper), `record_render_feedback`,
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

### 1i. `/direct`: the minimal sequencing fix belongs to the core

The live `.claude/skills/direct/SKILL.md` saves the storyboard at Step 2.5 and continues
straight past it (`:54`), brief unsaved until Step 8 (`:124`) -- contradicting 1a's
`storyboard.requires = ["brief"]` and the decided human stop. `extract_story_brief`/
`compose_storyboard` only return objects (`handlers.js:3482`, `:3497`); `save_project_artifact`
only registers a path that already resolves to a real file (1d). Full resumability
(a cold restart resuming a paused run) is ANI-230's scope; the write-then-register steps
below are not:

- **Step 2 (Extract Story Brief):** call `extract_story_brief`, write its returned
  object as JSON to `brief/story-brief.json`, then
  `save_project_artifact(kind: 'brief', role: 'structured', path: 'brief/story-brief.json')`
  -- immediately, not deferred to Step 8.
- **Step 2.5 (Storyboard):** call `compose_storyboard`, write its returned object as
  JSON to `concept/storyboard.json`, then
  `save_project_artifact(kind: 'storyboard', path: 'concept/storyboard.json')`, then
  **end the turn** -- no `approve_stage` call yet, per the decided human stop.
- **Resume, same conversation:** on the human's next message, the agent calls
  `approve_stage({ project, stage: 'storyboard', actor, note })`, attested (ANI-229 not
  landed yet, 2), then continues to Step 3.
- **Step 8 (Save Artifacts):** the live table saves the score card, comparison, and
  contact sheet as `kind: 'review'` at `review/score-card.json`, `review/comparison.json`,
  `review/contact-sheet.md` (`SKILL.md:124-136`) -- incompatible with 1e's fixed paths,
  and wrong regardless: `review` requires a render `/direct` never produces. Corrected:

  | Artifact | Kind | Role | Path |
  |---|---|---|---|
  | Score card | `candidate_review` | `score_card` | `review/candidates/score_card.json` |
  | Comparison | `candidate_review` | `comparison` | `review/candidates/comparison.json` |
  | Contact sheet | `candidate_review` | `contact_sheet` | `review/candidates/contact_sheet.md` |

  Each is written to its path first, exactly as Step 2/2.5 above, then registered.
- **Cold restart** stays entirely in ANI-230's scope, unchanged from today -- not
  designed here.

## 2. Slice plan

| Slice | Provides | Consumes | Depends on | Mergeability |
|---|---|---|---|---|
| ANI-227 | Stable project id, ambiguity-safe resolution | Nothing from the others | None | Merges first; nothing here depends on it landing in a particular shape beyond "an id exists" |
| **Core (ANI-212)** | Stage map, `checkStagePrerequisites`, 1c's admission call sites, existence checks, role whitelist, warning surfaces, override shape, attested-only `approve_stage` | ANI-227's stable id (1g); ANI-220's `withFileLock` (landed) | **ANI-227 (blocking)** | Cannot merge before ANI-227: 1g's ledger has no safe key without it. No safe interim -- a slug-keyed ledger is the exact bug ANI-227 exists to fix, so shipping one anyway just re-imports it. Independent of ANI-228/229/230 otherwise. |
| ANI-228 | Cross-process lock (lockfile lifecycle, atomic rename, canonical key), wrapping 1b/1c's call sites | Core's write call sites to wrap | Core merged first (wraps shapes core creates) | Merges any time after core; does not block core shipping (1b states the interim honestly) |
| ANI-229 | Server context in handlers; elicitation-based `approve_stage` | Core's `approve_stage` (extends it) | Core merged first | Merges any time after core; does not block core shipping (approve_stage ships attested-only, 1a) |
| ANI-230 | `story_brief`/run-checkpoint persistence; cold-restart resume | Nothing from the checker -- digest re-checking is core's own (1b) | Core merged first | Merges any time after core; does not block core shipping (1i's minimal sequencing ships without cold-restart resume) |
| ANI-222 | Containment for every project-state reader, not only writes | Core's `resolveWithinProject` (1d), adopted not forked | Core merged first | **Picked: core ships `resolveWithinProject`, ANI-222 adopts it.** 1d needs containment now; ANI-222 is a broader, Low-priority audit with no reason to block the core -- the reverse order would repeat ANI-227's mistake on a dependency that isn't actually blocking. |

**What the core does before each dependency lands, stated plainly:**

- **Before ANI-227:** nothing -- the one blocking dependency. No PR without its id.
- **Before ANI-228:** ships with ANI-220's in-process lock only (1b); a second concurrent
  MCP session can still lose an update, stated not hidden.
- **Before ANI-229:** ships attested-only; `approve_stage` never attempts elicitation,
  `approval_channel: 'attested'` always, no placeholder.
- **Before ANI-230:** ships without cold-restart resume. Digest re-verification is
  already in the core (1b); only same-conversation resume works without it (1i).
- **Before ANI-222:** nothing missing -- the core ships its own `resolveWithinProject`.

## 3. Test matrix (core only)

| Case | Setup | Expected |
|---|---|---|
| Dry-run encode admission | `render_master({ persist: true, encode: true, dry_run_encode: true })` on an ungated project. | Refused before `assembleVideoSequence` writes `render-props.json`, not only before the (skipped) render call. |
| Direct `assemble_video_sequence`, with project | Call with `project` set and `output_dir` set, ungated project. | Refused before the `output_dir` write. |
| Direct `assemble_video_sequence`, `output_dir` no project | Call with `output_dir` set and no `project`. | Throws `project is required when output_dir is set` before any write; no bypass via omission. |
| `assemble_video_sequence`, no `output_dir` | Call with neither `output_dir` nor `project`. | Succeeds ungated -- nothing durable happens, correctly unchanged. |
| Voiceover pre-write | `render_project` on an ungated project with `voiceover.text` scenes. | Refused before `prepareVoiceoverTrack` runs; no TTS cache file written. |
| Nonexistent artifact path | `save_project_artifact(kind: 'manifest', path: 'motion/manifests/does-not-exist.json')`. | Throws `Artifact not found`, stage stays `not_started`. |
| Existing directory, not a file | `save_project_artifact(kind: 'manifest', path: 'motion/manifests')` (a real directory). | Refused: `resolveWithinProject` resolves it, but `isFile()` is false. |
| Path escapes, three shapes | `save_project_artifact` with an absolute path, a `../`-traversal path, and a path through a symlink pointing outside the project root. | All three refused by `resolveWithinProject` before `isFile()` is even checked. |
| `candidate_review` role whitelist | `save_project_artifact(kind: 'candidate_review', role: 'sneaky_full_review', ...)`. | Throws `Unknown candidate_review role`; the three real roles at their real paths still succeed. |
| `candidate_review`, allowed role wrong path | `save_project_artifact(kind: 'candidate_review', role: 'score_card', path: 'review/wherever.json')`. | Refused: the role is valid, the path doesn't match `score_card`'s fixed convention. |
| `/direct`-shaped compatibility | Run 1i's corrected flow end to end: write + register brief, write + register storyboard, attest approval, write + register all three `candidate_review` artifacts at their fixed paths. | Every save succeeds with no `override_reason`, the exact case round 4 found broken. |
| Warning on `save_project_artifact` | Call it against a grandfathered project. | Result carries `stage_warning`, closing round 2's gap. |
| Override provenance, every gated tool | For each of `save_project_artifact`, `approve_stage`, `render_project`, `render_master`, `encodeMaster`, `assemble_video_sequence` (with project), `record_render_feedback`, `review_project`: call with `override_reason` and no `actor`. | Every one throws the same "actor required" error; none silently accepts an anonymous override. |
| Legacy ledger blocked on ANI-227 | Attempt to implement 1g's ledger against slug alone. | Not a runtime test -- a review/merge-order check: this PR does not merge without ANI-227's id already available. |
| Complete-but-not-approved storyboard | `save_project_artifact(kind: 'beat_plan' \| 'scene' \| 'manifest', ...)` against a storyboard that is `complete` but not `approved`. | Refused for all three kinds, naming `storyboard` as not `approved`; each succeeds once `approve_stage` runs. |
| Digest mismatch after approval | Approve `storyboard`, edit `concept/storyboard.json` on disk, then `save_project_artifact(kind: 'manifest', ...)`, `render_project`, and `render_master`. | All three refuse, naming the storyboard as changed since approval; re-running `approve_stage` (new digest) clears it for all three. |
| Refusal before any write, persist-only paths | `render_master({ persist: true })`, `record_render_feedback`, `review_project`, each on an ungated project. | Each refuses before its first durable write (`persistMaster`, the feedback log append, `review/evaluation.json`), not merely before registration. |
| `approve_stage` complete-first and digest storage | Approve a stage that just reached `complete`. | Succeeds; `stages.storyboard.approved_digest` is present and matches the file's current hash. |
| `override_reason` can't bypass complete-first | `approve_stage` on a `not_started` stage with `override_reason` supplied. | Still throws "must be complete first" -- overrides bypass prerequisite refusals, never the state-machine invariant. |
| Warning on every enumerated surface | Call each tool in 1f's list against a grandfathered project. | Every one carries `stage_warning`; none silently omit it. |
| Strict-new vs ledger-grandfathered | A project with `stage_map_version` set vs. one on the ledger with none. | The first is gated normally; the second's gated calls succeed with no override needed. |
| Override record, full and exactly once | Trigger one override on `save_project_artifact`. | `project.json.overrides` gains exactly one entry with every field (1h's shape) populated; the same record is present in the call's own return payload, not only on disk. |
| Schema coverage, every gated tool | Inspect the public `inputSchema` for `save_project_artifact`, `approve_stage`, `render_project`, `render_master`, `assemble_video_sequence`, `record_render_feedback`, `review_project`. | Every one declares `override_reason` and `actor`; none rely on an internal-only param a real MCP client could never send. |

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
