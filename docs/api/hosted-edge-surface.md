# Hosted vs. local: where each tool runs

> **Status:** Draft for the docs site (lives in the Preset marketing app — see ANI-81).
> The tier data below is the source of truth from `mcp/tool-groups.js` in the
> `animatic` repo. Counts were verified against `EDGE_TOOLS.length` /
> `EDGE_EXCLUDE.length` on 2026-06-03. **Do not publish the literal connect
> command until the hosted endpoint (PRE-1439 slice) resolves** — that
> verification is ANI-162.

Animatic ships **78 MCP tools**. They do not all run in the same place. Some are
pure logic that runs on Animatic's hosted cloud edge; others read or write files,
or drive a video renderer, and must run on your own machine. This page explains
which is which, and why.

## The short version

| Surface | Tools | What they do |
|---------|-------|--------------|
| **Hosted (cloud edge)** | **60** | Reference lookups and pure transforms — planning, scoring, validation, recommendation. Account-gated, no install. |
| **Local only** | **18** | Anything that needs durable project state, reads a local file, or runs the video renderer. Requires the local install. |

If a tool isn't on the hosted surface, it's because it physically can't run
there — not because it's withheld. The hosted edge is a stateless cloud isolate:
no writable filesystem, no Chromium, no ffmpeg.

## The three tiers

Every tool is classified into one of three availability tiers (`mcp/tool-groups.js`):

### Tier 1 — reference & transform → **hosted** (60 tools)
Pure logic over catalogs or the arguments you pass inline. No disk, no state, no
external runtime. These run on the hosted edge.

- **Reference (17)** — catalog reads: `search_primitives`, `get_primitive`,
  `get_personality`, `search_breakdowns`, `get_motion_recipe`,
  `recommend_sequence_archetype`, and similar lookups.
- **Transform (43)** — plan / score / validate / audit / recommend over inline
  data: `recommend_choreography`, `plan_sequence`, `evaluate_sequence`,
  `validate_manifest`, `compose_storyboard`, `score_candidate_video`,
  `resolve_render_targets`, `assemble_video_sequence`, and more.

> The proprietary scoring and routing logic (e.g. `score_candidate_video`'s
> rubric, `resolve_render_targets`' routing) stays server-side in Tier 1. The
> hosted surface emits *results and commands*, never your IP-bearing source.

### Tier 2 — project state → **local** (8 tools)
These read or write durable per-user project documents (a `project.json` tree, a
brand package on disk). A stateless edge can't persist them, so they stay local
until backed by cloud storage:

`init_project`, `list_projects`, `get_project`, `get_project_context`,
`save_project_artifact`, `review_project`, `create_brand_package`,
`create_personality`.

### Tier 3 — render / runtime → **local** (2 tools)
These need Chromium + ffmpeg and minutes of compute via Remotion:

`render_project`, `preview_video`.

**Hosted behavior is different, not absent.** On the hosted surface a render tool
doesn't render server-side — it returns **resolved render-props plus a command**
for *your local* Remotion runtime to execute. Nothing proprietary ships:
Remotion is open source; the value (routing/scoring) already ran in Tier 1.

### Held back pending audit → **local** (8 tools)
The surface is **fail-closed**: a tool is excluded from the hosted edge until
it's *proven* free of local file reads/writes and process spawns. These are
excluded today pending a per-handler audit:

`analyze_beats`, `generate_video`, `generate_scenes`, `annotate_scenes`,
`auto_revise_loop`, `create_social_cutdown`, `get_brand_package`,
`list_brand_packages`.

> Example: `analyze_beats` was briefly marked edge-ready, then reclassified
> (ANI-160) because it `readFileSync`s a caller-supplied local `audio_path` —
> meaningless on a stateless edge. It will return to the hosted surface only with
> an inline-audio contract (`audio_base64` / `audio_url`), never by re-flipping
> the flag.

## Params that are silently stripped on the hosted surface

A few hosted tools accept params that imply server-side state or a disk write.
Those params are **removed from the hosted tool's schema** — the tool still works
on your inline data, but the dropped params are ignored. Don't be surprised when
they have no effect on the hosted surface:

| Tool | Stripped on hosted | Why |
|------|--------------------|-----|
| `generate_contact_sheet` | `project` | Operates on the inline manifest/scenes; the `project:` slug is dead on the edge. |
| `compare_project_versions` | `project`, `version_a`, `version_b` | Operates on inline `manifest_a` / `manifest_b`; the version refs need stored project state. |
| `assemble_video_sequence` | `output_dir` | Emits a render *command* string; `output_dir` is the only disk-write param. |

## Getting access to the hosted surface

Access is gated on a **free Preset account** (decided in ANI-157). The mechanism
is a **hosted remote MCP endpoint over HTTP with Preset OAuth** — no local
install, no npm package (the package is private).

```sh
# Endpoint URL is illustrative until the PRE-1439 hosted-edge slice deploys (ANI-162).
claude mcp add --transport http animatic https://mcp.presetai.dev
# → complete Preset OAuth in the browser when prompted
```

Works across MCP clients: Claude Code, Claude Desktop, Cursor, VS Code.

**Need a Tier 2/3 tool** (own a project, render a video)? Install Animatic
locally — the local surface exposes all 78 tools.

---

### Maintainer note: keeping these counts honest
The 60/18 split and per-tier lists are derived from `mcp/tool-groups.js`. Before
publishing any revision, re-derive rather than hand-edit:

```js
import { TOOL_GROUPS, EDGE_TOOLS, EDGE_EXCLUDE } from '../mcp/tool-groups.js';
// EDGE_TOOLS.length === hosted count; EDGE_EXCLUDE.length === local count
```

This is the same stale-count class fixed in ANI-160 (the analyze_beats
reclassification) and the REGISTRY footer correction (commit 03cbf66) — counts
in prose drift; counts derived from the manifest don't.
