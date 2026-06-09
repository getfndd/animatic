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

## Auto-revise preflight (opt-in, ANI-186)

By default a marginal master only *reports* a WARN/below-threshold gate. With **`auto_revise: true`** (off by
default — cost-gated), a marginal master that has **rendered evidence** runs a bounded
`auto_revise_loop({ frame_evidence: true, frame_tier, allowed_ops: RETIME_OPS })` on its source, then
**re-gates**:

- **Honesty contract.** The pass is constrained to `RETIME_OPS` (`trim`/`extend_hold`/`compress`) — re-time +
  re-finish only. Structural ops the loop would otherwise apply (`boost_hierarchy`, `adjust_density`,
  `reorder`, …) are filtered out, and the re-authored-scene-set guard (`assertNoReauthor`) backstops it. A
  cutdown stays `create_social_cutdown`.
- **Adopt on improvement only.** The revised source replaces the original only if the re-gate verdict
  *improves*; an equal verdict keeps the original (no churn). The report carries
  `before_verdict → after_verdict`, `adopted`, `ops_filtered`, `frame_passes`, and `estimated_render_seconds`
  (cost is logged).
- **Skipped** on a PASS (nothing to fix) or a *missing-evidence* BLOCK (no frames to revise on). Default
  (`auto_revise` off) is unchanged.

Note: a retime flips the gate via real **settling** (a longer hold → a more-settled hero frame at the same
fraction); metadata-only legibility axes are structural and don't move on a retime.

## Durable persistence + one-button encode (opt-in, ANI-185)

`render_master` emits in-memory artifacts; two opt-in flags (both requiring a `project` to write under)
close the loop to a one-call master:

- **`persist: true`** — writes each emitted artifact to disk under
  `masters/<tier>/<id>/{manifest.json, scenes/*.json, timelines.json}` (`id` is `primary` or the
  ratio token, e.g. `9x16`), plus a `masters/<tier>/master.json` index (profile, verdict, retime,
  render routes, delivery slugs, gate roll-up, artifact path table). The master is then registered in
  `project.json` (`masters[]` + `entrypoints.latest_master`). The persisted manifest carries the
  master's **constrained** render routes, so reloading it from disk and re-resolving reproduces the
  same routes — the artifact is a faithful, self-contained encode source.

- **`encode: true`** (implies persist) — **after** the fail-closed gate passes, chains each emitted
  artifact through `assemble_video_sequence` → Remotion to produce **one master MP4 per aspect** (the
  literal "master = source of truth for all encodes"). The encode reads the **persisted**
  `render-props.json` so the on-disk artifact and the MP4 it reproduces can't drift. A **BLOCK** is
  persisted for inspection but **never encoded** (fail-closed). `dry_run_encode: true` assembles the
  props + resolves the plan without spawning Remotion (CI/preview).

  **Delivery-profile transcodes (ANI-190).** Each `delivery_profile` is mapped to its matching-aspect
  master and transcoded down to the profile's target via `buildTranscodeArgs` (mp4→mp4: scale + fps +
  codec/CRF, audio re-encoded to the profile's bitrate/rate/channels) — "render once, deliver many" off
  the one per-aspect master, not four identical re-renders. The container is **codec-aware**: ProRes (the
  T4 `master` profile) writes `.mov` (ffmpeg rejects `prores_ks` in mp4); h264 writes `.mp4`. **Fail-soft
  per profile** (one bad transcode is recorded, never aborts the rest). `max_size_mb` is **enforced + auto-
  corrected** — the output is stat'd, and an over-cap **h264** deliverable re-encodes through a bounded
  CRF-bump loop (ANI-196, +4/step, ≤3 attempts) until it fits; if it still can't fit it's flagged `oversize`
  + deferred (never a clean `encoded`). GIF/ProRes (no CRF lever / uncapped) keep the plain gate.
  **Caption burn-in (ANI-193)** — `burn_in` profiles (social-feed/story-reel) burn the
  ANI-188 VTT sidecar into the picture via ffmpeg's `subtitles` filter (after scale, so captions sit at
  delivery resolution); a profile with no sidecar (no authored `scene.captions`) stays deferred. Requires
  an ffmpeg built with **libass** — a one-shot capability probe (ANI-195) **cleanly defers** burn-in when
  the `subtitles` filter is absent (rather than a doomed transcode). **GIF (ANI-194)** — `email-gif` runs
  the canonical 2-pass palettegen path (`buildGifPaletteArgs` → `buildGifEncodeArgs`, no audio), so every
  delivery codec is now real. (No master tier *emits* `email-gif` in its delivery set yet — the capability
  is ready for a tier or caller to opt in.) Dry-run resolves each per-profile command (both GIF passes)
  without spawning ffmpeg. Remaining follow-up: 2-pass `max_size_mb` auto-correction (over-cap is gated, not
  yet auto-shrunk).

## Audio realization (ANI-188)

The profile's `audio_policy` is **realized at encode**, not just declared. The Remotion-embedded music bed
(`manifest.audio`, ANI-106) is already in each aspect's `master.mp4`; `realizeAudioPolicy` runs the
post-encode pass on top, composing the audio surfaces we already ship (`voiceover-mix.js` +
`audio-mix.js`) — never a new ffmpeg graph:

| policy | tier | realized at encode |
| -- | -- | -- |
| `muted` | T1 | no audio track |
| `muted-autoplay` | T2 | the embedded bed stays, plays muted on autoplay; no post-mux |
| `mix` | T3 | voiceover ducked under the bed (aac) + a **VTT captions sidecar**, at the 48 kHz master rate |
| `full-mix` | T4 | same as T3 + **sonic cues** |

- **Voiceover** is `planVoiceoverClips` → `prepareVoiceoverTrack` → `muxVoiceoverIntoRender` (ANI-129
  ducking). The master mix is **48 kHz** (the archival rate); per-delivery-profile resampling rides the
  deferred transcodes above.
- **Captions on** = a VTT sidecar emitted from **authored `scene.captions`** (the existing `render_project`
  path). A narrated master with no authored captions reports `captions: { written:false, reason }` so it
  doesn't silently fail the a11y surface — narration-derived captions are a separate follow-up.
- **Dry-run seam:** `dry_run_encode` resolves the full audio plan (sources, mux mode, sample rate, caption
  cue count) with **no TTS and no ffmpeg**; synthesis + mux run only on a real encode. Plans/realizes only
  for an **emitted** master.
- **Sonic cues (T4, ANI-189).** `resolveSonicCues` reads `brand.audio.sonic_cues` and places each cue on
  the timeline at a deterministic anchor — `logo_sting` at the logo/resolve scene start (last closing-
  signalled scene, else the final scene), `transition_whoosh` at each transition boundary, `ui_click` at
  each `interaction_truth.has_state_change` scene (labeled `scene_start_state_change` — scene-level, not
  click-event timing). `buildSonicCueMixArgs` mixes them onto the master on top of the ducked bed+VO; the
  base is padded to the **full picture duration** so a late cue (e.g. a logo sting in the final scene) is
  never dropped when narration-only audio ends early. Unset cues are `not_configured` (the normal brand
  state — most brands ship no `sonic_cues`), distinct from a configured-but-`missing_file` asset; both fail
  soft. Per-event placement tied to motion timing is a future refinement.

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
