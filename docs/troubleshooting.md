# Troubleshooting Failed or Low-Quality Renders

The ten failure modes users actually hit, in the order they tend to hit them.
Each entry: the symptom as you'll see it, why it happens, and the fix.

Most of these are caught by the **preflight doctor** before render compute is
spent — `render_project` runs it automatically, or run it standalone:

```bash
npm run preflight -- <manifest.json> [--scenes <dir>]
```

A `fail`-level check aborts the render with `Preflight failed: <summary>`.
Fix the blocker rather than reaching for `skip_preflight: true` — the
override exists for environments you've already verified by hand.

---

## 1. ffmpeg missing or missing encoders

**Symptom:** preflight `encoders` check fails — `ffmpeg not available on
PATH` or `ffmpeg is missing required encoder(s): libx264`.

**Why:** every pipeline stage beyond Remotion leans on ffmpeg: delivery
encodes, voiceover track assembly, audio ducking, even the golden test
harness. Some package-manager builds omit libx264.

**Fix:**
```bash
brew install ffmpeg          # macOS
ffmpeg -encoders | grep 264  # verify libx264 is present
```
Missing *recommended* encoders (vp9, prores) only warn — h264 output still
works.

## 2. Vendored fonts missing

**Symptom:** preflight `fonts` check fails; or renders come out with fallback
system typography that doesn't match the design.

**Why:** the Remotion compositions load Satoshi from
`public/fonts/satoshi/` (vendored, all required weights). A fresh clone that
skipped LFS/asset steps, or an install script interrupted midway, leaves the
directory empty — Chrome silently substitutes a fallback font, so without
the preflight this fails *quietly* as a quality bug.

**Fix:** restore `public/fonts/satoshi/` (re-clone or re-run the install
script). The preflight lists exactly which weights are missing.

## 3. Manifest references scenes that don't exist

**Symptom:** `Manifest references scene(s) not found in project: sc_xyz` from
`render_project`, or the preflight `manifest_refs` check fails.

**Why:** the manifest's `scenes[].scene` ids must each resolve to a scene
definition in the project's `scenes/` directory (keyed by the scene file's
`scene_id`, falling back to the manifest entry id). Renames and deletions
drift out of sync.

**Fix:** `get_project` lists the scenes the project actually loaded —
reconcile ids against the manifest. Watch for the date-prefix: scene files
are keyed by their *content's* `scene_id`, not their filename.

## 4. Missing plate assets for captured scenes

**Symptom:** preflight `plates` check fails; or `browser_capture` scenes
render as black/empty regions.

**Why:** scenes with capture plates reference video files (e.g.
`prototypes/captures/*.mp4`) that must exist at render time. Captures are
generated artifacts — they don't survive a fresh clone and aren't committed.

**Fix:** re-run the capture (`scripts/capture-prototype.mjs` or the
`/animate` flow) so the plate exists at the referenced path.

## 5. Render hangs at "bundling" or never starts

**Symptom:** `npx remotion render` (or `render_project`) hangs indefinitely,
or fails with `listen EPERM` in sandboxed environments.

**Why:** two distinct causes —
- **IPv6 localhost:** Node 20 resolves `localhost` to `::1`, which hangs
  Remotion's dev server. The repo pins IPv4 (`remotion.config.mjs` and
  `NODE_OPTIONS=--dns-result-order=ipv4first` in the npm scripts) — bypassing
  those scripts loses the pin.
- **Sandboxed environments:** CI/sandboxes that deny port listening or
  Chrome's process launch can't render at all. The golden frame tests detect
  this and skip; a direct render just fails.

**Fix:** use the `npm run remotion:*` scripts rather than raw `npx remotion`.
In restricted environments, set `ANIMATIC_SKIP_REMOTION_RENDER=1` for test
runs and render on an unrestricted machine.

## 6. Voiceover overruns the scene (preflight `voiceover` fail)

**Symptom:** `Voiceover overruns scene hold time for N scene(s) by more than
10%` — or, if forced through, narration that's cut off or spills into the
next scene.

**Why:** spoken English averages ~165 wpm; the fit check estimates each
`voiceover.text` against its scene's `duration_s`. Estimates use the
**provider-clamped** speed — `speed: 9` on the `openai` provider really
synthesizes at its 4.0 cap, so cranking `speed` past a provider's range
doesn't buy time (ANI-128).

**Fix:** shorten the line, extend `duration_s`, or raise `speed` *within*
the provider's honored range. The preflight detail lists estimated vs.
available milliseconds per scene.

## 7. TTS synthesis fails (`openai` provider)

**Symptom:** `Voiceover synthesis failed: ...` before the render starts.
Three distinct messages:

| Message | Meaning | Fix |
|---|---|---|
| `OPENAI_API_KEY is not set` | No key in the MCP server's environment | Export it, or add it to the `env` block of the animatic entry in your MCP config |
| `OpenAI TTS HTTP 401/4xx` | Bad key, or invalid voice id | Check the key and `voiceover.voice` value — 4xx is not retried |
| `OpenAI TTS failed after 3 attempts` | Persistent 429/5xx/network trouble | Transient errors are retried with backoff; if it still fails, check OpenAI status / your rate limits |

**Note on spend:** synthesis is content-address cached
(`audio/voiceover/cache/`) — re-renders with unchanged narration make zero
billed calls, and a `dry_run` reports the estimated cost before any spend.

## 8. Output has wrong, missing, or truncated audio

**Symptom:** silent MP4, music missing, or audio that cuts off mid-video.

**Why & fix, by case:**
- **Music silent:** `manifest.audio.src` resolves via Remotion's
  `staticFile()` — the file must live under `public/`, not in the project
  directory. Move/copy the asset and reference it relative to `public/`.
- **`email-gif` has no audio:** by design — that profile sets `audio: null`
  and encodes with `-an`.
- **Audio cut off at the last narration clip:** fixed in ANI-127 (the
  sidechain ducking graph truncated at the key input's end). Update past
  commit `51953bf` / PR #85 if you're seeing this on an old checkout.
- **Voiceover louder/quieter between renders:** verify both renders used the
  same provider — `mock` is silent by design; `macos_say` and `openai`
  differ in loudness and pacing.

## 9. Disk space (preflight `disk_space`)

**Symptom:** preflight warns or fails on disk headroom; or renders die
mid-encode with ENOSPC.

**Why:** intermediate frames + draft renders are large; the check measures
headroom at the output directory before compute is spent.

**Fix:** clear `renders/draft/` of stale outputs and `renders/frames/` of old
frame dumps. Project directories accumulate every draft render by default.

## 10. Render succeeds but looks wrong (low-quality, not failed)

**Symptom:** no errors, but motion feels off — wrong personality, jarring
transitions, low evaluation scores from `review_project` / `/review`.

**Why:** quality regressions are usually guardrail violations rather than
bugs: primitives mixed across personalities, camera moves outside the
personality's allowed set, or timing that ignores the personality's speed
tiers.

**Fix, in order:**
1. `validate_choreography` — checks the primitive set against personality
   guardrails before you render again.
2. `review_project` — stores evaluation + critique scores under `review/`;
   scores below 70 list the specific issues.
3. Never mix personality-specific primitives across personalities — the
   four built-ins (`cinematic-dark`, `editorial`, `neutral-light`,
   `montage`) have intentionally disjoint vocabularies.
4. Use the personality's timing tokens rather than raw durations — arbitrary
   values defeat the speed hierarchy that makes motion feel coherent.

---

## Still stuck?

- `render_project` with `dry_run: true` assembles props + runs preflight
  without spending render time — fastest way to iterate on manifest issues.
- The golden harness (`npm run test:golden`) verifies your *environment*
  (ffmpeg graphs, Remotion render path, delivery encodes) independent of
  your project — if goldens pass, the problem is in the project; if they
  skip, the report says exactly which dependency is missing.
- File issues at [getfndd/animatic](https://github.com/getfndd/animatic/issues).
