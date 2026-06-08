# Master Profile Spec (ANI-183)

**Status:** Active · **Epic:** [ANI-181 — One Source, Four Masters](https://linear.app/fnddtech/issue/ANI-181) · **Decided in:** [ANI-182 spike](../../process/master-profile-spike.md)

One immutable source emits **four masters** at increasing finish. A master is a pure function of
`(source, profile)`: it may **re-time** and **re-finish**, never **re-author**. `render_master(project,
tier)` orchestrates the four profiles below by composing tools we already ship — no new rendering infra.

## The four profiles

Defined as code in `mcp/lib/master-profiles.js` (foundational + stable; the thresholds are sourced
from `hero-frame.js` so the gate and the profiles never drift).

| Profile | Tier | `render_target_policy` | `finish_preset` | `delivery_profiles` | `aspect_set` | `audio_policy` | `retime_policy` | hero-frame gate |
| -- | -- | -- | -- | -- | -- | -- | -- | -- |
| **prototype** | T1 | `pin: web_native` | none | — (live surface) | `16:9` | muted | none | **≥ 0.55** |
| **directed-html** | T2 | `pin: web_native` | `clean-digital` | `web-embed` | `16:9`, `1:1` | muted-autoplay | `extend_hold`, `trim` | **≥ 0.65** |
| **video** | T3 | `resolve` ∈ `{browser_capture, remotion_native, hybrid}` | `editorial-subtle` | `web-hero`, `social-feed`, `social-landscape`, `story-reel` | `16:9`, `1:1`, `9:16` | mix | `trim`, `extend_hold`, `compress` | **≥ 0.75** |
| **hero-film** | T4 | `resolve, prefer: remotion_native` | `cinematic-film` | `master`, `web-hero`, `social-feed`, `story-reel` | `16:9`, `1:1`, `9:16` | full-mix | `trim`, `extend_hold`, `compress` | **≥ 0.85** |

`render_target_policy` is a **mode + set**, not a single enum: `pin` forces one target (T1/T2 stay live
HTML); `resolve` delegates per-scene routing to `resolve_render_targets` constrained to `allowed`, biased
toward `prefer`.

## The three fault-line rules (enforced, not advisory)

1. **Social-crop = finish, not fork.** Deterministic aspect recomposition
   (`adaptManifestAspectRatio` + `recomposeSceneForRatio`, recompose true) stays **inside** a master's
   `aspect_set` — it is a pure function of `(source, ratio)`. It becomes a **fork** (`create_social_cutdown`,
   a new declared source) only when scene selection / hand-authored copy enters. `render_master` never
   calls `create_social_cutdown`.
2. **Retime seam = `RETIME_OPS` only.** A master may apply `{trim, extend_hold, compress}` and nothing
   else. `composeMaster` runs `sync_sequence_to_beats` (where the profile allows it) then **asserts the
   scene set + order are unchanged** — any re-authoring throws. No per-master secret scenes.
3. **Per-tier quality gate = one scorer, rising bar.** Every tier uses the same `audit_hero_frames`
   scorer at its threshold (T1 ≥ 0.55 → T4 ≥ 0.85), with a widening required-axis set (legibility at
   T1–T2; composition/beauty binds at T3–T4). The gate runs **fail-closed on the emitted artifacts**
   (the composed primary + every recomposed aspect variant), not the source — finish and especially
   recompose change what ships.

## What `render_master` emits

A **renderable** master: each artifact (primary + each aspect variant) is an inline
`{ manifest, sceneDefs, timelines }`. Hand each to **`assemble_video_sequence`** (which accepts inline
sceneDefs + timelines and emits the render command) for the actual encode — **not** `render_project`,
which loads scene defs from disk and would drop the recomposed sceneDefs. A BLOCK sets `emitted: false`
and the plan is returned for inspection only; the BLOCK reason distinguishes *missing evidence*
("needs rendered frames + a vision judge") from *below threshold* (a weak axis).

## Ground truth — four tiers on `examples/product-demo`

`render_master` run at each tier with a **metadata-only** capture (no Remotion toolchain / no
`ANTHROPIC_API_KEY`):

| Tier | Verdict | Emitted | Aspects | Delivery profiles |
| -- | -- | -- | -- | -- |
| **T1** prototype | PASS | ✅ | `16:9` | — |
| **T2** directed-html | PASS | ✅ | `16:9`, `1:1` | `web-embed` |
| **T3** video | BLOCK | ❌ | `16:9`, `1:1`, `9:16` | `web-hero`, `social-feed`, `social-landscape`, `story-reel` |
| **T4** hero-film | BLOCK | ❌ | `16:9`, `1:1`, `9:16` | `master`, `web-hero`, `social-feed`, `story-reel` |

T1/T2 pass on legibility (metadata-derivable). T3/T4 BLOCK with the explicit **"needs rendered frames +
a vision judge (no toolchain/key)"** reason — a *missing-evidence* block, **not** a quality failure.
With a vision toolchain + key, the composition/aesthetic axes verify on real pixels and T3/T4 produce a
genuine pass/fail per emitted artifact. (Same honest fail-closed behavior as the ANI-178 hero-frame
baseline.)

Reproduce: load `examples/product-demo` manifest + scenes and call `render_master` per tier (inline
`manifest`+`scenes`), or via the MCP tool with `project: "<slug>"`.
