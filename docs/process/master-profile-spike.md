# Master Profile Contract — Spike Decision Rules

**Spike for [ANI-181 — One Source, Four Masters](https://linear.app/fnddtech/issue/ANI-181). Issue: [ANI-182](https://linear.app/fnddtech/issue/ANI-182).**

This is a **decision document**: a profile table, three fault-line rulings, and worked
examples. The worldview lives in the ANI-181 epic; the `master-profile.md` spec and the
`render_master(project, tier)` build are **follow-ups filed after this is approved** — not
part of this spike.

The honesty contract this table has to keep true (from ANI-181):

> Masters may **re-time** and **re-finish**. They may **not re-author**.
> Anything that re-authors is a **cutdown** — a new, declared source (`create_social_cutdown`).

Every cell below is a real, shipping setting. Sources cited inline so the follow-up spec
can wire `render_master` to existing tools (`resolve_render_targets`, `apply_finish_preset`,
`get_delivery_profile`, `adapt_project_aspect_ratio`, `revise_candidate_video`) with no new
rendering infra.

---

## The four-profile table

| Profile | `render_target_policy` | `finish_preset` | `delivery_profile` | `aspect_set` | `audio_policy` | `retime_policy` | `hero_frame_threshold` |
| -- | -- | -- | -- | -- | -- | -- | -- |
| **prototype** (T1) | `pin: web_native` (live DOM, never captured) | none — reduced-motion required | — (live surface, no encode) | `16:9` authoring only | muted | none — source timing as authored | **T1 ≥ 0.55** |
| **directed-html** (T2) | `pin: web_native`, capture-ready | `clean-digital` (light captions/labels) | `web-embed` | `16:9` (+ `1:1` via deterministic recompose) | muted-autoplay; optional bg | holds only — `extend_hold`, `trim` | **T2 ≥ 0.65** |
| **video** (T3) | `resolve` — allowed `{browser_capture, remotion_native, hybrid}` | `editorial-subtle` or `social-punchy` (grade + crops) | `web-hero` + `social-feed` / `social-landscape` / `story-reel` | `16:9` + `1:1` + `9:16` (deterministic recompose) | bg track + mix, `aac`, captions on | `trim` + `extend_hold` + `compress` | **T3 ≥ 0.75** |
| **hero-film** (T4) | `resolve, prefer: remotion_native` — allowed `{remotion_native, hybrid, browser_capture}` | `cinematic-film` or `premium-brand` (full art direction) | `master` (ProRes) → `web-hero` / social derivatives | `16:9` master + full social set via recompose | full mix — music + sonic cues + VO, 48k | `trim` + `extend_hold` + `compress` | **T4 ≥ 0.85** |

**Vocabulary is real, not invented:**
- `render_target_policy` is a **routing mode + allowed-target set**, not a single enum value.
  The *targets* are the shipping `RENDER_TARGETS` (`web_native`, `browser_capture`,
  `remotion_native`, `hybrid`) at `mcp/lib/render-routing.js:28`; the *mode* is how a master
  picks among them:
    - `pin: <target>` — force one target (T1/T2 pin `web_native`; the source stays a live surface).
    - `resolve` — delegate per-scene routing to `resolve_render_targets`, constrained to the
      master's `allowed` set; `prefer: <target>` biases the resolver but does not force it.
  T4 **prefers** `remotion_native` but keeps `browser_capture`/`hybrid` in its allowed set so a
  browser-dependent HTML source (gradients, backdrop-filter, clip-path — the `BROWSER_SIGNALS`
  at `render-routing.js:36`) can still become a video master. Pinning `remotion_native` would
  break "one source, four masters" for exactly those sources, so the policy is prefer-not-pin.
- `finish_preset` slugs → `catalog/finish-presets.json` (`clean-digital`, `editorial-subtle`,
  `social-punchy`, `cinematic-film`, `premium-brand`).
- `delivery_profile` slugs → `catalog/delivery-profiles.json` (`web-embed`, `web-hero`,
  `social-feed`, `social-landscape`, `story-reel`, `master`).
- `aspect_set` ratios → `adapt_project_aspect_ratio` enum at `mcp/tools.js:1457`
  (`16:9`, `1:1`, `4:5`, `9:16`).
- `audio_policy` fields → manifest/scene `audio` object `{ src, volume, fade_in_ms,
  fade_out_ms, offset_s }` + per-profile encode block in `delivery-profiles.json`.
- `retime_policy` ops → subset of `REVISION_OPS` at `mcp/lib/revision.js:19` (see Fault line 2).

---

## The three fault-line rulings

### 1. Social-crop boundary — *finish, until scene selection enters*

Deterministic recomposition (`adapt_project_aspect_ratio`, `recompose` true **or** false) is
**finish** — it is a pure function of `(source, ratio)`, so it lives **inside** a master as part
of its `aspect_set`; it becomes a **fork** (`create_social_cutdown`, a new declared source) the
moment the output stops being a pure function of the source — i.e. when scene selection
(`scenes_to_keep`) or hand-authored copy/layout enters.

*Confirms the proposed default: deterministic-by-rule = finish; hand-authored = cutdown.*
`recompose:false` is a geometric crop; `recompose:true` re-lays-out layer positions but is
still deterministic, so both stay inside the master. `create_social_cutdown` takes
`scenes_to_keep` + `max_duration_s` (`mcp/tools.js:1469`) — that scene-dropping is exactly the
re-authoring step that makes it a fork, not a finish.

### 2. Retime-vs-reauthor seam — *three ops, no more*

A `retime_policy` may apply **only** the timing ops `trim`, `extend_hold`, and `compress`; it
may **not** apply `reorder`, `boost_hierarchy`, `add_continuity`, or `adjust_density` (those
re-author), and adding/removing scenes is not a revision op at all (that is source authoring) —
**no per-master secret scenes**.

From `REVISION_OPS` (`mcp/lib/revision.js:19`):

| Op | Class | In `retime_policy`? |
| -- | -- | -- |
| `trim` | re-time (duration ↓) | ✅ yes |
| `extend_hold` | re-time (duration ↑) | ✅ yes |
| `compress` | re-time (target duration) | ✅ yes |
| `swap_transition` | re-finish (join treatment) | ❌ no — governed by `finish_preset`, not retime |
| `reorder` | re-author (narrative order) | ❌ no — fork |
| `boost_hierarchy` | re-author (composition) | ❌ no — fork |
| `add_continuity` | re-author (edit relationships) | ❌ no — fork |
| `adjust_density` | re-author (motion authoring) | ❌ no — fork |
| `needs_annotation` | advisory (flags for human review; transforms nothing) | ❌ no — advisory only, not in `retime_policy`, and not a fork by itself |
| add / remove scene | source authoring (not an op) | ❌ no — fork |

`swap_transition` is the one gray case: it is re-*finish*, allowed within a master, but it
belongs to the `finish_preset`/edit layer, not the `retime_policy` knob — keep it out of retime
so the seam stays clean.

### 3. Per-tier quality gate — *same scorer, rising bar, widening axes*

The four masters stay one system because they share **one** hero-frame scorer (ANI-178) and only
the **threshold and the set of enforced axes** change per tier — T1 asks "is the subject clear?",
T4 asks "is the frame beautiful?":

| Tier | Threshold | Axes that gate (cumulative) | The question it answers |
| -- | -- | -- | -- |
| **T1** prototype | ≥ 0.55 | `subject_clarity` | "Can you tell what this is?" |
| **T2** directed-html | ≥ 0.65 | + `readability`, `visual_hierarchy` | "Is the text legible and ordered?" |
| **T3** video | ≥ 0.75 | + `contrast`, `brand_consistency`, whitespace/air | "Is it composed and on-brand?" |
| **T4** hero-film | ≥ 0.85 | + emotional/semantic clarity, composition/beauty (all axes) | "Is the frame beautiful?" |

Axis names map to existing scorers — `subject_clarity` from `scene-comprehension.js:71`;
`readability` / `contrast` / `visual_hierarchy` / `brand_consistency` from `frame-critique.js:15`.
ANI-178's open requirement — separate **legibility** (comprehensible) from **composition**
(well-composed) — is what makes the T3→T4 step real: T1–T2 gate legibility axes only;
composition/beauty axes do not bind until T3 and fully bind at T4. The lower tiers must **fail
closed** on the legibility axes but stay silent on beauty, or every prototype fails for not being
a hero film.

---

## Worked examples

Two cookbook walkthroughs ([ANI-123](https://linear.app/fnddtech/issue/ANI-123)) and one real
project, each resolved at its lowest and highest master.

### A. `product-demo` walkthrough — prototype vs. hero-film

| | prototype (T1) | hero-film (T4) |
| -- | -- | -- |
| render | `web_native`, live, reduced-motion | `remotion_native`, full compose |
| finish | none | `premium-brand` |
| delivery | live surface | `master` (ProRes) → `web-hero` |
| aspect | `16:9` | `16:9` master + `1:1`/`9:16` recompose |
| audio | muted | full mix + sonic cues |
| retime | none | `trim`/`extend_hold`/`compress` |
| gate | T1 ≥ 0.55 (subject clear) | T4 ≥ 0.85 (beautiful, all axes) |

Same scene definitions both times. The T4 social cuts come from **deterministic recompose**
(finish) — *unless* someone trims the demo to a 6-scene highlight for a feed, which is
`create_social_cutdown` (fork).

### B. `fintech-sizzle` / Mercury Insights (real project, `cinematic-dark`) — video vs. hero-film

A sizzle reel is born at T3+. At **video (T3)** it routes `browser_capture`/`remotion_native`,
takes `social-punchy`, ships `web-hero` + `story-reel`, gates at 0.75. Promoting to
**hero-film (T4)** swaps finish to `cinematic-film`, adds the full audio mix and a `master`
ProRes encode, and raises the gate to 0.85 — **no scenes added or reordered**; the only manifest
deltas allowed are holds/trims (`retime_policy`). If the T4 cut "needs one more scene," that is a
source edit, not a master.

### C. `ai-prompt-to-result` walkthrough — directed-html vs. video

At **directed-html (T2)** it is an embeddable small film: `web_native` capture-ready,
`clean-digital`, `web-embed`, `16:9` (+`1:1` recompose for an inline card), holds-only retime,
gate 0.65. At **video (T3)** the same source grades up to `editorial-subtle`, fans out to
`social-feed`/`story-reel` via deterministic recompose, turns captions/audio on, and tightens
the gate to 0.75. The T2→T3 jump is **pure finish + retime** — the honesty contract holds.

---

## Scope guard (spike done-criteria)

- [x] Three fault lines each have a one-line ruling.
- [x] The profile table is filled with concrete, cited tool settings.
- [x] 2–3 worked examples on existing walkthroughs/projects.
- [x] No new code; no spec doc; no philosophy (that lives in ANI-181).

**Follow-ups to file once this is approved:** `master-profile.md` spec · `render_master(project,
tier)` build · ANI-178 wiring its gate to the T1–T4 threshold column above.
