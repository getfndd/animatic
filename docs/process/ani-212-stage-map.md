# ANI-212 - Stage map design draft

Design draft only, no product code. Written against `origin/main` at `863478d` (fetched
2026-09-11, worktree `~/.claude-worktrees/animatic/ani-212-stage-map`, branch
`james/ani-212-stage-map-design`). Clean-room: OpenMontage source was not opened, the
mechanism description in ANI-212/ANI-209 is the only input taken from that project.
Parent: ANI-209. Sibling: ANI-210/211 (`~/.claude-worktrees/animatic/ani-210-gate-plan`,
`docs/process/ani-210-211-gate-seam-plan.md`, read not edited): its round 3 puts
content-gate admission inside `renderRemotionSequence` (`mcp/lib/video.js:293`) and
adopts this draft's override record shape verbatim. Section 4 designs the render-path
stage check to share that exact chokepoint and record, one admission call, not two.

**Round 2 (this revision):** Codex rejected round 1 (`7c1ee49`) at P1. James triaged
every finding; this revision fixes the 10 accepted items and states the rationale for
the 1 rejected item. The 1 on-hold item (approval authenticity) started as a two-option
sketch and was then decided by James (option b, elicitation with an attested fallback,
Section 4a) within this same round; the sketch is replaced by that design, not kept
alongside it. Superseded text is deleted, not annotated. Round cap: 3, this is round 2.

## 1. Inventory on origin/main

### 1a. Every writer of `project.json`

Unchanged from round 1: exactly two write sites, `initProject` (`projects.js:186`) and
`saveProjectArtifact` (`projects.js:529`), both via `writeJSON` (`projects.js:101-103`).
Every durable caller (`renderProject`, `renderMaster`, `recordRenderFeedback`) mutates
project state only through `saveProjectArtifact`, confirmed unchanged. **What round 1
got wrong:** that finding is about who writes `project.json`, not about when. Section 4
below is the fix for the real gap Codex found: several of these callers produce a
durable side effect (an MP4, a persisted master, a feedback log entry) *before* the
`saveProjectArtifact` call that was the only place round 1 proposed to gate.

### 1b. Every tool that produces each stage's artifact

Table unchanged from round 1 (brief/storyboard/beats/scenes/manifest/render/review
producers, all pure TRANSFORM tools except the two render tools). Two real gaps found
this round, both P2:

- **`generate_brief_stub`** (`tools-registry.js:103`, `handlers.js:3966`,
  `mcp/lib/story-brief.js`) is a second, alternate `brief` producer, pure, no write
  (grepped `story-brief.js` for `writeFile`/`writeJSON`: none). `bin/animatic.mjs`'s
  `case 'brief':` (`:186-193`, corrected citation, see 1f) calls the same function from
  the CLI. Neither writes `project.json`; the agent/CLI still has to call
  `save_project_artifact(kind: 'brief', ...)` to persist it.
- **`assemble_video_sequence`** (`tools-registry.js`'s `assemble_video_sequence` entry,
  `mcp/lib/video-assembly.js`) writes `render-props.json` to disk via `outputDir`
  (`video-assembly.js:121-124`, `writeFileSync`), a real durable write outside
  `saveProjectArtifact`. It takes no `project` parameter at all, structurally: it cannot
  be gated against project stage state because it has no reference to a project. This is
  ANI-210's bypass to close (their round-3 plan §8, an admission check on its own
  `{manifest,sceneDefs,timelines}`), not ANI-212's; named here so the inventory states
  the boundary honestly rather than omitting the write. **Stated boundary:** a pure
  transform stays ungated until something persists it under a project; the moment it
  does, that persistence call is what gets checked, never the transform itself.

`score_candidate_video`, `compare_candidate_videos`, `generate_contact_sheet`
(`tools-registry.js`, `handlers.js:3051` for the sheet) are the score-card/comparison/
contact-sheet producers Section 6's Step 8 registers. Confirmed pure (no write) by
reading `handleGenerateContactSheet`; the other two are TRANSFORM/edge-ready per
`tool-groups.js`, same evidentiary bar as round 1's table. Their `kind` is fixed in
Section 2/6 below (round 1 called them `review`, which deadlocked `/direct`; see 1c).

### 1c. The two sequencing deadlocks Codex found (P1, accepted)

Both real, verified against `.claude/skills/direct/SKILL.md` and the round-1 stage map:

1. **Storyboard before brief.** The map requires `brief` complete before `storyboard`
   (Section 2). Round 1's Step 2.5 saved the storyboard; round 1's Step 8 saved the
   brief. Every `/direct` run on a strict project would refuse its own first storyboard
   save. **Fix (Section 6):** move the brief save to Step 2, immediately after
   `extract_story_brief` returns, not deferred to Step 8.
2. **Review requiring a render `/direct` never produces.** Round 1 gated `review` on
   `render`, then had Step 8 register score cards, comparisons, and contact sheets as
   `kind: 'review'` -- but `/direct`'s 9 steps never call `render_project`/`render_master`
   at all; rendering is a separate, later action. Every one of those saves would refuse.
   **Fix (Section 2/6):** these are pre-render candidate-evaluation artifacts, not
   post-render human review, and conflating them was the actual bug -- the same shape as
   the storyboard/beat-plan `kind` collision ANI-220 is fixing (1b's round-1 finding).
   Same fix: give them their own stage and `kind` (`candidate_review`), requiring only
   `manifest`, not `render`. `review` stays strictly post-render, unchanged meaning,
   now with nothing wrongly routed through it.

### 1d. Grandfather-warning surfaces, complete this time

Round 1 hand-picked four surfaces. Enumerated instead, every call site of `getProject`/
`getProjectContext`/`listProjects` outside `projects.js` itself
(`git grep -n "getProject(\|getProjectContext(\|listProjects(" mcp/handlers.js mcp/lib/*.js`,
excluding `projects.js`):

| Call site | Tool | Round-1 gap |
|---|---|---|
| `handlers.js:2630` (`handleListProjects`) | `list_projects` | Missed entirely. |
| `handlers.js:2635` (`handleGetProject`) | `get_project` | Had it. |
| `handlers.js:2640` (`handleGetProjectContext`) | `get_project_context` | Had it. |
| `handlers.js:1038` (`handleExportStoryboardToFigma`) | `export_storyboard_to_figma` | Missed; returns at `:1104` with no warning field. |
| `handlers.js:1196` (`exportFigmaImageFills`, a helper inside the Figma frame-to-scene flow) | `figma_frame_to_scene` | Missed. |
| `feedback.js:78` (`recordRenderFeedback`) | `record_render_feedback` | Missed; its return at `:132` discards `proj` entirely. |
| `render-master.js:337` (`renderMaster`, persist/encode path) | `render_master` | Had it, via `renderMaster`'s own return. |

`renderProject` (`projects.js:679`) and `reviewProject` (`projects.js:546`) call
`getProject` internally too; both already carried the warning in round 1 and still do.
**Fix:** `getStageWarning(proj)` (Section 3b) is attached by every handler in the left
column above before it returns, not by `getProject` itself (see 1e for why).

### 1e. `stage_warning` would get persisted (P2, accepted)

Real bug in round 1's own design: `getProject`'s return object was the proposed carrier
for `stage_warning`, but `saveProjectArtifact` builds `projectData` by calling
`getProject` internally and spreading everything off it except `project_root`
(`projects.js:433-434`, `const { project_root: _root, ...projectData } = proj`). A
`stage_warning` field on `getProject`'s return would ride along into the next write and
land in `project.json` as a stale, derived fact. **Fix:** `getStageWarning` is never
attached inside `getProject`/`getProjectContext` itself. It is computed and attached
only at the outer handler boundary (the table in 1d), which never feeds its result back
into a write. `saveProjectArtifact` additionally destructures a `DERIVED_FIELDS` list
(`['project_root', 'stage_warning']`, extensible) instead of just `project_root`, so even
a future derived field added the same careless way is caught by the same line, not a new
one. Test in Section 5.

### 1f. Citation corrections (P3, accepted)

- `bin/animatic.mjs:190` is inside `case 'brief':` (the CLI's brief subcommand, calling
  `generateBriefStub`), not a "CLI status display." Corrected in 1b above.
- `tool-groups.js:15-16` describes Tier 2 storage-backing, not process topology. The
  actual citation for "one process per stdio session" is `mcp/index.js:212`
  (`await server.connect(transport)` inside `main()`), corrected in Section 4.
- `mcp/test/projects.test.js:272-410` does not create a fresh project per test or seed one
  in `beforeEach`. It reuses one project (`TEST_SLUG`, created in an earlier `describe`
  block, `:38`) across the whole `saveProjectArtifact` suite in sequence -- "updates
  existing scene entry" depends on the previous test's "adds scene to scenes array"
  having already run. Corrected in Section 5's test-impact note.

## 2. Stage map draft

```jsonc
// catalog/stage-map.json (shape - static, versioned)
{
  "stage_map_version": 1,
  "grandfathered_project_ids": ["fintech-sizzle", "polaris-observability", "aria-cloud-console"],
  "stages": [
    { "key": "brief", "requires": [], "produces_kind": "brief", "approval": false },
    { "key": "storyboard", "requires": ["brief"], "produces_kind": "storyboard", "approval": true },
    { "key": "beats", "requires": ["storyboard"], "produces_kind": "beats", "approval": false, "note": "assumes ANI-220 lands first, see 1b/1c" },
    { "key": "scenes", "requires": ["storyboard"], "produces_kind": "scene", "approval": false },
    { "key": "manifest", "requires": ["storyboard"], "produces_kind": "manifest", "approval": false },
    { "key": "candidate_review", "requires": ["manifest"], "produces_kind": "candidate_review", "approval": false, "note": "pre-render evaluation: score card, comparison, contact sheet (1c fix 2)" },
    { "key": "render", "requires": ["manifest"], "produces_kind": ["render", "master"], "approval": true, "approval_role": "approved" },
    { "key": "review", "requires": ["render"], "produces_kind": "review", "approval": false }
  ]
}
```

`grandfathered_project_ids` is new this round (Section 3a); it is captured once, at
rollout, from the 3 real projects inventoried in 1e of round 1, and is not grown for new
projects afterward. Per-project state (`project.json.stages`) is unchanged in shape from
round 1: `not_started` -> `complete` -> `approved`, keyed by the stages above. An
approved gated stage's record now also carries `approval_channel: 'elicitation' |
'attested'` (Section 4a) and, for `storyboard` specifically, `approved_digest` (4b).

## 3. Decision (recorded 2026-09-11): strict for new, grandfathered for existing

James decided Option A. Round 1's classifier (`stage_map_version` present = strict,
absent = grandfathered) is replaced this round per 3a; the reasoning for A over the
rejected B/C options is unchanged from round 1 and not repeated here.

### 3a. Legacy ledger, not a mutable field inside the document it governs (P1, accepted)

Codex's finding: a field living inside `project.json` cannot be the sole legacy
credential, because deleting it, hand-authoring a project without it, or a test fixture
that never sets it (1f, `render-master-encode.test.js:508`'s `tmpProject()`) all
silently downgrade a project to ungated. **Fix:** the classifier is now two-part, and
the ledger lives in `catalog/stage-map.json` (Section 2), committed, outside every
per-project document:

```
isGrandfathered(proj) = proj.stage_map_version == null AND proj.slug is in grandfathered_project_ids
```

A project with no `stage_map_version` that is **not** in the ledger is strict and fails
closed -- exactly the versionless `render-master-encode.test.js` fixture, which was never
one of the 3 real projects and was never meant to be exempt. The ledger is frozen at
rollout (never appended to); a project can only move off it by migrating forward
(gaining `stage_map_version`), never by an existing project acquiring grandfathered
status later. `initProject` stamps `stage_map_version: 1` on every project from here on,
so the ledger's membership is fixed the day this ships and shrinks only.

### 3b. Grandfather warning, corrected surfacing (see 1d, 1e)

Shape unchanged from round 1 (`type: 'stage_map_grandfathered'`, per-stage
`inferred_complete`/`inferred_missing`/`unknown`, `detected_at`). `isGrandfathered`
above is `getStageWarning`'s entry condition, replacing round 1's `stage_map_version`-only
check. Surfacing is now the complete table in 1d, and it is attached at the handler
boundary only (1e), never inside `getProject`/`getProjectContext`.

## 4. Tool contracts

### `approve_stage({ project, stage, note?, actor?, policy? })`

**Fix (P1, accepted): the target stage must already be `complete`.** Round 1's error
list checked only the stage's *predecessors*, never the stage's own current status, so
`not_started -> approved` was reachable. New error, checked first:

```
"Cannot approve \"<stage>\": current status is \"<status>\", must be \"complete\" first"
```

**Decided 2026-09-11 (James, option b): elicitation primary, attested fallback.** MCP
dispatch passes caller-supplied arguments straight to handlers (`tools-registry.js:187`);
nothing authenticates a plain `actor` string, and nothing distinguishes a human from an
agent calling this tool with one. Round 1/2's `actor` argument proved only that *some*
caller typed a name, never that a human approved. **Fix, verified against the installed
SDK** (`@modelcontextprotocol/sdk@1.30.0`, resolved from `package.json`'s `^1.27.1`
range; fetched and inspected the published `1.30.0` tarball directly, since this repo has
no committed lockfile to read a resolved version from). Citations below are into the SDK
package itself (`node_modules/@modelcontextprotocol/sdk/dist/cjs/...` once installed),
not animatic's own source, unlike every other citation in this document: the `Server`
class exposes `elicitInput(params, options?): Promise<ElicitResult>`
(`server/index.d.ts:158`) and `getClientCapabilities(): ClientCapabilities | undefined`
(`server/index.d.ts:121`), whose `elicitation` field (`types.js`'s
`ClientCapabilitiesSchema`, `:449-471`) is present only if the connected client declared
it at `initialize` -- the real check, not a guess. Animatic doesn't call either today
(grepped `mcp/`: no hits).

```jsonc
// input: no actor/note when elicitation is used (rejected if supplied, see errors);
// required (as round 2) only on the attested fallback
{ "project": "string", "stage": "string",
  "note": "string, required on attested fallback, rejected if elicitation runs",
  "actor": "string, required on attested fallback, rejected if elicitation runs",
  "policy": "string, optional, default 'human'" }

// return (not thrown -- a human decision, not an error):
{ "approved": true, "approval_channel": "elicitation" | "attested", ...stage record }
{ "approved": false, "approval_channel": "elicitation", "outcome": "declined" | "cancelled" | "timeout" }

// errors (still thrown -- programming/validation failures, not human decisions)
"Project not found: <id>"
"Unknown stage: <stage>. Valid stages: brief, storyboard, ..."
"Stage \"<stage>\" is not gated (approval: false) - nothing to approve"
"Cannot approve \"<stage>\": current status is \"<status>\", must be \"complete\" first"
"Cannot approve \"<stage>\": predecessor \"<dep>\" is not complete"
"actor/note are not accepted when elicitation is available; the response is collected via the client"
"actor is required for approve_stage" // attested fallback only, no anonymous, no default
"note is required for approve_stage" // attested fallback only
"Unknown approval_policy \"<policy>\": only \"human\" is implemented"
```

**Mechanism.** `approve_stage` checks `getClientCapabilities()?.elicitation` first.
**Present:** if the call also carried `actor`/`note`, reject outright (picked over
silently ignoring them -- an honest caller has no reason to pre-supply the human's
answer, so a rejected call is the safer failure than a discarded one). Otherwise call
`elicitInput` with a form requesting exactly what the record needs, never accepting it
from the agent:

```jsonc
{ message: "Approve the storyboard for <project>? <panel-coverage summary>",
  requestedSchema: { type: 'object',
    properties: {
      decision: { type: 'string', enum: ['approve', 'decline'], title: 'Decision' },
      approver_name: { type: 'string', title: 'Your name' },
      note: { type: 'string', title: 'Note (optional)' } },
    required: ['decision', 'approver_name'] },
  options: { timeout: 900000 } } // 15 min -- generous, a human may be mid-review
```

`actor`/the approval decision/`note` come only from `content.approver_name`/
`content.decision`/`content.note` on `action === 'accept'`. **Absent:** falls back to the
round 1/2 attested contract unchanged (`actor`/`note` required, `/direct` ends its turn
and waits, Section 6).

### 4a. Approval authenticity: what the elicitation channel guarantees, and what it doesn't

**Every elicitation outcome means not-approved, with no fallback to attested inside the
same call (P1, accepted):** `ElicitResult.action` is `'accept' | 'decline' | 'cancel'`
(SDK's `types.js:1848-1863`); a request exceeding `options.timeout` rejects with
`McpError` `RequestTimeout` (SDK's `shared/protocol.d.ts:73-77`) rather than resolving.
All three non-accept outcomes, plus the timeout, return `{ approved: false, outcome }` and stop --
they do not retry as attested. Falling back only on missing *capability*, never on a
human's actual decline, is the whole point: a decline that silently became an attested
"approval" would make the channel worse than useless.

**What this proves:** the decision and the name attached to it came through the MCP
client's own protocol round-trip, not through the calling agent's tool-call arguments --
the agent that wants to fabricate an approval cannot put the words in its own request and
have them accepted.

**What this does not prove, stated plainly (P1, known residual):** it does not prove a
human looked at a screen. Claude Code's own `Elicitation` hook can intercept the request
before any dialog is shown and answer it with `hookSpecificOutput: { hookEventName:
'Elicitation', elicitationResponse: '<value>' }` (corrected field name -- not `provide`/
`response` as first described; verified against Claude Code's hooks reference and hooks
guide). Hooks are configured in `.claude/settings.json` / `~/.claude/settings.json` /
`.claude/settings.local.json`, not in a tool call's arguments, so forging an approval
this way requires editing a settings file rather than typing a string into one request --
a materially higher bar than the attested channel's, but not an unreachable one for an
agent that can already edit files in the repo it's working in. The elicitation channel's
honest guarantee is **"a client-side actor answered through the protocol,"** not
**"a human answered."** `approval_channel: 'elicitation'` in the record reflects exactly
that distinction, and nothing reading it (Section 2's per-stage record, any warning or
render admission that surfaces approval state) may present it as stronger.

### 4b. Cold-restart determinism (P1, accepted)

Round 1's pause persisted only `stages.storyboard.status`. Codex's finding: that alone
can't reproduce a paused run, because the structured `story_brief` (produced at Step 2)
was never saved, the run's own parameters (`--strategies`, `--max-revisions`,
`approval_policy`) were never saved, and nothing bound the approval to the exact
storyboard content it was given for -- an out-of-band edit to `concept/storyboard.json`
after approval would leave a stale `'approved'` status pointing at different content.
Three fixes:

1. **Persist the structured brief, not just the markdown.** Step 2 (Section 6) now
   saves `story_brief` itself via `save_project_artifact(kind: 'brief', role:
   'structured', path: 'brief/story-brief.json')`, alongside the existing markdown
   entrypoint. A cold restart's Step 1 load has something to resume Step 3 from without
   re-running `extract_story_brief`.
2. **Persist run parameters.** `initProject`/the first `save_project_artifact` call of a
   `/direct` run stamps a `project.json.active_run` object: `{ strategies,
   max_revisions, approval_policy, started_at }`. Step 1 reads this back on a cold
   restart instead of re-deriving it from CLI args that may differ between the original
   invocation and the resuming one.
3. **Bind approval to a digest, invalidate on change.** `approve_stage(stage:
   'storyboard', ...)` computes `sha256` of `concept/storyboard.json`'s current bytes
   and stores it as `stages.storyboard.approved_digest`. `saveProjectArtifact`'s
   `storyboard` case, when the stage is already `'approved'`, recomputes the digest of
   the content being saved: an identical digest is a no-op re-save (approval survives);
   any other digest downgrades `stages.storyboard.status` back to `'complete'` in the
   same write, so a changed storyboard can never coast on a stale approval. Cold-restart
   resume (Step 1) re-verifies the on-disk file's digest against `approved_digest` before
   trusting `'approved'` and skipping to Step 3, closing the residual gap where a direct
   filesystem edit bypasses `saveProjectArtifact` entirely and the invalidation above
   never runs.

### Render-path admission: one call, shared with ANI-210 (P1, accepted)

Round 1's mistake: it only checked inside `saveProjectArtifact`, but three durable
producers do their side effect *before* that call, or can skip it entirely:

- `render_project` writes the MP4 via `renderRemotionSequence` (`projects.js:799`) before
  the registration at `:837-839`, which only runs `if (mark_as_latest)` -- passing
  `mark_as_latest: false` writes the file with no check ever reached.
- `render_master`'s persist path writes the manifest/timelines/index via `persistMaster`
  (`render-master.js:341`) before `saveProjectArtifact` at `:342`; supplying inline
  `manifest`/`scenes` alongside `project` doesn't skip this, because the persist branch
  re-resolves the project independently at `:337` regardless of how the source content
  was obtained (verified by reading `render-master.js:239-343` in full: inline data only
  skips `loadProjectSource`, not the persist branch's own `getProject` call).
- `record_render_feedback` appends its log (`feedback.js:127`) before the registration at
  `:130`.
- `reviewProject` writes `review/evaluation.json` directly (`projects.js:636`) and never
  called `saveProjectArtifact` at all in round 1, so `stages.review` never reached
  `complete`.

**Fix, one admission point per durable side effect, before it, not after:**

1. **`renderRemotionSequence`** (`mcp/lib/video.js:293`) gains the check both
   `render_project` and `render_master`'s encode path already funnel through -- the same
   chokepoint ANI-210's round 3 puts its content gate in. `renderProject`/`encodeMaster`
   pass `{ project, kind: 'render'|'master', override: { reason, actor }, toolName }`
   through as `opts`; `renderRemotionSequence` runs `checkStagePrerequisites` (this
   issue's gate) ahead of ANI-210's `runOutputGates` (their gate), in the same function,
   sharing one `recordOverride()` call and one error path. This closes the
   `mark_as_latest:false` gap completely: the check no longer depends on whether
   registration happens afterward, because it runs before the render, not after it.
2. **`render_master`'s persist branch** (`render-master.js:337-338`, right where `proj`
   is resolved for persistence) gets its own check before `persistMaster` at `:341` --
   this is the one admission point that covers both the from-project case and the
   inline-manifest-with-a-project case, because both reach this same `getProject` call
   regardless of where the rendered content came from. When `encode` also runs
   afterward, item 1's check re-runs against the same `'master'` stage; harmless, not a
   second rule, just the render step's own defense.
3. **`recordRenderFeedback`** gets a check right after `getProject` (`feedback.js:79`),
   before the log append at `:127`.
4. **`reviewProject`** gets a check before its write at `:636`, and, new this round, a
   `saveProjectArtifact({ project, kind: 'review', role: 'evaluation', path })` call
   after the write succeeds, so `stages.review` actually reaches `complete` -- round 1
   never wrote this call at all.

`assemble_video_sequence` is explicitly out of this list (1b): it has no `project`
parameter, so there is nothing for `checkStagePrerequisites` to check against. That is
ANI-210's bypass to close, not this issue's.

### Override record, unchanged shape, one write (P1, accepted fix)

The shape (`{ type, at, actor, tool, reason, gate, detail }`) is unchanged from round 1
and, per ANI-210's round 3, adopted verbatim by their content gates too. **What changes
this round:** round 1's pseudocode recorded the override as a step separate from the
gated mutation, which a crash between the two could separate or erase. Fixed: inside
`saveProjectArtifact`, the override entry (if any) is appended to `projectData.overrides`
in memory, in the same pass as the stage/entrypoint mutation the gate was checking, and
`writeJSONAtomic` writes both in the one call that ends the function -- never two writes
for one gate event. `render_project`/`render_master`'s render-path override (above) is a
different event (permission to render, not a stage mutation) and is its own single
atomic write, per ANI-210's own requirement that recording happen "inside the same
function, immediately before `execFileAsync`" -- same rule, independently satisfied at
each of the two distinct write events, never combined into one at the cost of atomicity
at either.

### Concurrency: cross-process lock, ANI-220's serializer is the inner layer (P1, accepted)

Round 1 proposed an in-process `Map<project_root, Promise>` mutex and called it done.
Codex's correction: every stdio session is its own OS process
(`mcp/index.js:212`, corrected citation, 1f), so a process-local mutex does nothing for
two sessions racing the same project -- exactly the case that matters, since nothing
stops a human from having two `claude` sessions open on the same repo. ANI-220 is
separately adding a small in-process per-project serializer to `saveProjectArtifact`;
that is the **inner** layer (this design doesn't rebuild it) and does not by itself
solve the cross-process case.

**Fix, cross-process layer: a directory lockfile, not a revision-counter CAS.**
`withProjectLock(projectRoot, fn)` calls `fs.mkdirSync(join(projectRoot, '.lock'))`
(POSIX `mkdir` is atomic w.r.t. `EEXIST` across processes, no new dependency), retries
with backoff on `EEXIST` up to a bounded wait, and breaks a stale lock (holder's PID no
longer running, or the lock's own timestamp older than a threshold) rather than
deadlocking on a crashed holder; releases via `rmSync` in a `finally`. Every writer
(`saveProjectArtifact`, `approveStage`, the render-path admission's override write)
wraps its read-modify-write in this. **Why a lock over CAS-with-retry:** a revision
counter would need every write site to re-derive its intended delta on conflict (re-check
the gate, re-append the override, re-apply the stage mutation, then retry the whole
thing), multiplying the "one write" logic above across N call sites instead of writing
it once inside the lock body. A lock centralizes the critical section once; ANI-220's
in-process serializer then sits inside a single process to stop that process's own
concurrent callers from thrashing the cross-process lock against each other, composing
cleanly rather than duplicating.

## 5. Test cases

| Case | Setup | Expected |
|---|---|---|
| Sequencing fix 1 | `/direct` strict project, brief saved at Step 2 per the fix. | Step 2.5's storyboard save succeeds; brief's `stages.brief.status === 'complete'` before it runs. |
| Sequencing fix 2 | `/direct` Step 8 saves a score card as `kind: 'candidate_review'` with only `manifest` complete, no render. | Succeeds; a `kind: 'review'` save with the same state still refuses. |
| Legacy ledger, strict-by-default | Project with no `stage_map_version`, slug not in `grandfathered_project_ids` (e.g. `render-master-encode.test.js`'s `tmpProject()`, `ani185-tmp`). | Strict: a gated save with no satisfied prerequisite refuses, does not silently pass as grandfathered. |
| Legacy ledger, real project | `fintech-sizzle` (in the ledger, no `stage_map_version`). | Grandfathered: gated saves succeed unchanged. |
| `stage_warning` never persists | `get_project`, then `save_project_artifact` on the same project. | The written `project.json` has no `stage_warning` key at any point. |
| Warning on every enumerated surface | Call each tool in 1d's table against a grandfathered project. | Every one carries `stage_warning`; none silently omit it. |
| Approve `not_started` rejected | `approve_stage` on a stage with no artifact saved yet. | Throws "must be complete first," not "predecessor not complete." |
| No default actor | `approve_stage`/override call with no `actor`. | Throws; `'human (unspecified)'` does not appear anywhere in the codebase or the record. |
| Elicitation accept | Mock client declares `elicitation`, form response `{ decision: 'approve', approver_name: 'James', note: '...' }`. | `{ approved: true, approval_channel: 'elicitation' }`; `stages.storyboard.approved_by === 'James'`, sourced from `content`, not from any call argument. |
| Elicitation decline | Same mock client, `action: 'decline'` (or `content.decision: 'decline'`). | `{ approved: false, outcome: 'declined' }`; stage stays `'complete'`; no attested fallback attempted in the same call. |
| Elicitation cancel | Mock client returns `action: 'cancel'`. | `{ approved: false, outcome: 'cancelled' }`; same no-fallback guarantee. |
| Elicitation timeout | Mock client never responds; `options.timeout` elapses. | `elicitInput` rejects `McpError RequestTimeout`; `approve_stage` returns `{ approved: false, outcome: 'timeout' }`, not a thrown error to the caller, and not attested. |
| Capability absent, fallback | Mock client with no `elicitation` in its declared capabilities. | Falls back to the attested contract; `actor`/`note` required as call arguments; `approval_channel: 'attested'` recorded. |
| Argument-supplied approval ignored/rejected | `approve_stage({ project, stage, actor: 'James', note: '...' })` against a client that DID declare elicitation. | Throws "actor/note are not accepted when elicitation is available," before any `elicitInput` call is made -- the supplied values are never used for anything, not even logged as an attempt. |
| Storyboard re-save invalidates approval | Approve `storyboard`, then `save_project_artifact(kind: 'storyboard', ...)` with different content. | `stages.storyboard.status` downgrades to `'complete'` in that same write; an identical re-save leaves it `'approved'`. |
| Cold-restart digest mismatch | Approve `storyboard`, edit `concept/storyboard.json` directly on disk (bypassing `saveProjectArtifact`), then reload via Step 1. | Digest check fails; treated as `'complete'`, not `'approved'` -- `/direct` re-pauses at Step 2.5 rather than trusting stale approval. |
| Admission before side effect, render_project | `render_project(..., mark_as_latest: false)` on an ungated project. | Refused before any MP4 is written to disk (assert the file never exists), not merely unregistered. |
| Admission before side effect, render_master inline | `render_master({ project, manifest, scenes, persist: true })` (inline content, real project, ungated). | Refused before `persistMaster` runs (assert no files under `masters/`). |
| Admission before side effect, feedback | `record_render_feedback` on an ungated project. | Refused before `review/feedback.json` is touched. |
| `reviewProject` marks its own stage | `review_project` on a satisfied project. | `stages.review.status === 'complete'` afterward; round 1 never set this at all. |
| Cross-process concurrency | Two separate processes call `saveProjectArtifact` against the same project near-simultaneously. | No lost update: both mutations land (e.g. two different `scene_id`s both present), verified without relying on the in-process serializer being present. |
| One write per gate event | Force a write failure mid-override (mock `writeJSONAtomic` to throw). | The override entry and the stage mutation are both absent afterward, never one without the other. |
| Test-suite migration note | `mcp/test/render-master-encode.test.js`'s `tmpProject()` fixture and `projects.test.js`'s shared `TEST_SLUG` (1f). | Both need `stage_map_version` + satisfied prerequisites (or an `override_reason`) once gating ships, or they fail closed under the new strict-by-default rule; call out in the PR, don't silently patch test helpers without saying why. |

## 6. Skill changes

`.claude/skills/direct/SKILL.md` is the only SKILL.md referencing these tools, unchanged
finding from round 1.

- **Step 1 (Load Project Context):** on a cold-restart resume, also loads
  `project.json.active_run` and re-verifies `stages.storyboard.approved_digest` against
  the on-disk file before trusting `'approved'` (4b). A mismatch means the storyboard
  changed out of band; treat it as `'complete'`, not `'approved'`, and re-pause at Step
  2.5.
- **Step 2 (Extract Story Brief):** gains two saves immediately after
  `extract_story_brief` returns, not deferred to Step 8 (1c fix 1, 4b): the markdown
  entrypoint (`kind: 'brief'`) and the structured `story_brief` itself
  (`kind: 'brief', role: 'structured'`), plus stamping `project.json.active_run` with
  this run's parameters (4b).
- **Step 2.5 (Storyboard):** compose, save, then call
  `approve_stage({ project, stage: 'storyboard' })` with no `actor`/`note` (4a). If the
  client declared the elicitation capability, this call blocks the tool call itself
  (the client shows its own dialog; the turn does not need to end) until the human
  answers, declines, cancels, or 15 minutes pass. A `declined`/`cancelled`/`timeout`
  result means not approved: report it to the user and offer the existing revision path,
  never retry as attested inside the same step. If the capability is absent, fall back
  to round 1/2's mechanism unchanged: surface the summary, **end the turn**, and on the
  human's next message call `approve_stage({ ..., actor, note, policy: 'human' })`
  (`actor`/`note` required here, never defaulted). A fresh invocation that finds
  `stages.storyboard.status` already `'approved'` with a matching digest (4b) skips this
  step entirely, regardless of which channel produced that approval.
- **Step 3 (Plan Beats):** each of the three beat plans is saved as `kind: 'beats'` (once
  ANI-220 lands, 1b) right after this step, not deferred to Step 8 -- same principle as
  the brief fix, save where it's produced.
- **Step 8 (Save Artifacts):** now only the winning manifest (`kind: 'manifest'`, saved
  first) and the three candidate-evaluation artifacts (`kind: 'candidate_review'`, roles
  `score_card`/`comparison`/`contact_sheet`, not `kind: 'review'`, 1c fix 2). Brief and
  beat plans are gone from this step, moved to where they're produced above.

## 7. Open questions

Resolved this round and removed: human-vs-agent approval default (4a, decided by James,
implemented honestly), `beats` `produces_kind` (assumed solved by ANI-220), the
render-path admission point (Section 4, no longer open), concurrency mechanism (Section
4, lock chosen and justified), cold-restart determinism (4b).

1. **Should `manifest` also require `scenes`?** Unchanged from round 1: not proposed,
   `plan_sequence` runs before all scenes necessarily exist per-file in a `/direct` run.
2. **`review` requiring `render` to be `approved`, not just `complete`.** Unchanged from
   round 1: `reviewProject` only reads manifest + scenes today, never the rendered
   output, so this is a new constraint the issue would introduce, not one implied by
   existing behavior.
3. **The unattended `policy` value.** Rejected as a P1 finding, kept as designed-later:
   James decided human attestation is the default and unattended execution is for later,
   as an explicit invocation policy with recorded provenance (4a's shape already covers
   it: `policy` plus `actor` plus timestamp plus reason). Deferring the *policy itself*
   is deliberate, not an oversight; the record shape it would use is already designed,
   the trigger conditions are not, on purpose, until someone actually needs it.
4. **`stage_map_version` bump semantics.** Unchanged from round 1: if the map shape
   changes later, what happens to projects mid-flight under the old version is not
   designed here.
