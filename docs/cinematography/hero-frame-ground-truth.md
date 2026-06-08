# Hero Frame Contract — Ground Truth (ANI-178)

Baseline scores from running `audit_hero_frames` against the four cookbook
walkthroughs ([ANI-123](https://linear.app/fnddtech/issue/ANI-123)). This is the
reference the gate's thresholds were calibrated against and the regression anchor
for future scorer changes.

## Method & environment

Each walkthrough's `examples/<name>/manifest.json` + `scenes/*.json` was audited at
tiers T1–T3. The hero-frame scorer has two halves:

- **Legibility** (`subject_clarity`, `readable_text`, `hierarchy`) — derived from
  scene structure; no pixels needed. Gated at T1–T2.
- **Composition + aesthetic** (`visual_center`, `subject_scale`, `contrast`,
  `whitespace_air`, `brand_presence`, `emotional_semantic_clarity`) — judged by a
  vision model on a **real rendered frame**. Gated from T3 up.

**This run had no `ANTHROPIC_API_KEY` and no render toolchain**, so the
composition/aesthetic axes are UNVERIFIED and every walkthrough **fails closed at
T3** — which is the contract working as designed (the anti-vacuous-pass rule: "I
didn't look" is a finding, not a pass). The numbers below are therefore the
**legibility baseline** (T1/T2) plus a demonstration of the fail-closed gate. To
capture the full T3/T4 composition scores, re-run with a key + the Remotion
toolchain (see *Reproduce* below).

Thresholds (from the [master-profile spike](../process/master-profile-spike.md)):
T1 ≥ 0.55 · T2 ≥ 0.65 · T3 ≥ 0.75 · T4 ≥ 0.85.

## Results

### product-demo  (6 scenes) — T1 **PASS** · T2 **PASS** · T3 **BLOCK** (composition UNVERIFIED)

| scene | subject_clarity | readable_text | hierarchy | T1 overall | T2 verdict |
| -- | -- | -- | -- | -- | -- |
| sc_01_context_setup | 1.0 | 0.5 | 0.9 | 1.0 | PASS |
| sc_02_feature_demo | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_03_detail_zoom | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_04_benefit_proof | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_05_social_proof | 1.0 | 0.5 | 0.9 | 1.0 | PASS |
| sc_06_cta_close | 1.0 | 0.5 | 0.9 | 1.0 | PASS |

### ai-prompt-to-result  (5 scenes) — T1 **PASS** · T2 **PASS** · T3 **BLOCK** (composition UNVERIFIED)

| scene | subject_clarity | readable_text | hierarchy | T1 overall | T2 verdict |
| -- | -- | -- | -- | -- | -- |
| sc_01_context | 1.0 | 0.5 | 0.9 | 1.0 | PASS |
| sc_02_prompt_input | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_03_processing | 1.0 | 0.5 | 0.9 | 1.0 | PASS |
| sc_04_result_reveal | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_05_cta | 1.0 | 0.5 | 0.9 | 1.0 | PASS |

### brand-teaser  (5 scenes) — T1 **PASS** · T2 **PASS** · T3 **BLOCK** (composition UNVERIFIED)

| scene | subject_clarity | readable_text | hierarchy | T1 overall | T2 verdict |
| -- | -- | -- | -- | -- | -- |
| sc_01_atmosphere_open | 1.0 | 0.5 | 0.9 | 1.0 | PASS |
| sc_02_product_glimpse | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_03_brand_statement | 1.0 | 0.5 | 0.9 | 1.0 | PASS |
| sc_04_tagline_close | 1.0 | 0.5 | 0.9 | 1.0 | PASS |
| sc_05_logo | 1.0 | 0.7 | 0.9 | 1.0 | PASS |

### fintech-sizzle  (9 scenes) — T1 **PASS** · T2 **PASS** · T3 **BLOCK** (composition UNVERIFIED)

Re-baselined after [ANI-184](https://linear.app/fnddtech/issue/ANI-184): each scene now
declares a `product_role: hero` layer + `primary_subject`. (Was all-BLOCK before annotation.)

| scene | subject_clarity | readable_text | hierarchy | T1 overall | T2 verdict |
| -- | -- | -- | -- | -- | -- |
| sc_01_tagline_open | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_02_insight_cards | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_03_prompt_input | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_04_chart_drilldown | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_05_followup | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_06_dashboard | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_07_tagline_intro | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_08_tagline_close | 1.0 | 0.7 | 0.9 | 1.0 | PASS |
| sc_09_logo | 1.0 | 0.7 | 0.9 | 1.0 | PASS |

## What the baseline tells us

- **All four walkthroughs now declare their poster subjects** — every scene has a
  `product_role: hero` layer and a `primary_subject`, so the contract resolves
  cleanly and legibility passes T1/T2. They are correctly **pending** at T3: the
  gate withholds a composition verdict until a frame is actually rendered and
  judged, rather than rubber-stamping a manifest it never looked at.

- **fintech-sizzle was the gate doing its job.** Its scenes (authored 2026-03-25,
  before hero-subject annotation discipline) originally declared **no
  `primary_subject` and no hero layer**, so the contract's forcing question —
  *what is this scene's poster frame about?* — had no answer and every scene floored
  at 0.3 and blocked. [ANI-184](https://linear.app/fnddtech/issue/ANI-184) supplied
  the annotation pass (each scene's foreground subject → `product_role: hero` +
  `primary_subject`), and the walkthrough now passes T1/T2 — exactly the behaviour
  ANI-178 is meant to force, then resolve.

- **The legibility-vs-composition split holds.** `readable_text` already varies by
  scene (0.5 text-light vs 0.7 with a `block_role` headline) independent of the
  composition axes — the rubric separates "comprehensible" from "well-composed" as
  the issue requires.

## Reproduce (full T3/T4 with rendered frames)

With `ANTHROPIC_API_KEY` set and the Remotion toolchain available (headless Chrome
+ ffmpeg), call `audit_hero_frames` with no `capture` override — it renders each
scene's hero still and judges the composition/aesthetic axes on real pixels:

```jsonc
// audit_hero_frames
{ "manifest": <examples/product-demo/manifest.json>,
  "scenes":   <examples/product-demo/scenes/*.json>,
  "tier": "T3" }
```

The legibility columns above are deterministic and will reproduce exactly with
`ANIMATIC_SKIP_REMOTION_RENDER=1`; the composition/aesthetic columns require the
render + vision pass.
