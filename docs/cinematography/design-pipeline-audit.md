# Design Pipeline Audit — closing the engine/output gap

**Status:** spec / audit, no code yet
**Date:** 2026-05-08
**Origin:** memory `project_design_gap.md`. Confirmed by 2026-05-08 Polaris loop run (see `projects/2026-05-08-polaris-observability/review/findings-2026-05-08-loop-integration-gaps.md`).

The motion engine is production-ready. The visual output is not. The reason: the autonomous loop skips the two professional-pipeline steps that produce visual quality — storyboarding and prototyping — and goes brief → scene JSON with inline HTML strings → render. The skills `/storyboard` and `/prototype` already exist, already specify the right contract, but `/direct` doesn't invoke them.

This document is the audit and migration plan. It does **not** prescribe an implementation; it scopes one.

---

## 1. Current pipeline (what `/direct` actually does today)

Per `.claude/skills/direct/SKILL.md` and verified against the 2026-05-08 Polaris run:

| Step | Tool | Output shape | Design content |
|------|------|--------------|----------------|
| 1 | `get_project_context` | project + brief markdown + scenes (if any) | brief text |
| 2 | `extract_story_brief` | `{ audience, promise, tone, must_show_features, proof_points, ... }` | structured fields, no design |
| 3 | `plan_story_beats` × 3 | beats with role, energy, camera_intent, recommended_primitives | beat-level intent, no visual_direction |
| 4 | `plan_sequence` × 3 | manifest (scene order, transitions, camera overrides) | per-scene camera/transition; no design |
| (between 4 and 5, in practice) | `generate_scenes` | scene JSON with `layers[].content: "<div>...</div>"` | **inline HTML strings, no design system, no typography spec** |
| 5 | `score_candidate_video` | 6-dimension score card | scores motion + structure, can't see design |
| 6 | `compare_candidate_videos` | ranked recommendation | structural |
| 7 | revision loop (`revise_candidate_video`) | revised manifest | manipulates structure, never design |
| 8 | `resolve_render_targets` | routing decisions | routes to native or capture |
| 9 | `assemble_video_sequence` | composited video | renders the inline HTML as-is |

**The design layer enters at step "(between 4 and 5)" — `generate_scenes` — and it enters as a templated stub.** Background HTML is `<div style="width:100%;height:100%;background:#0a0a0a"></div>`. Foreground HTML is `<div class='card'>{label}</div>` (no styles — `.card` resolves to nothing). The 4-pillar Polaris Features section collapsed into a single text layer reading "Four pillars, one platform: Trace, Detect, Resolve, Learn." This is the design gap, observed in vivo.

Source of inline HTML stubs: `mcp/lib/generator.js` (ANI-31). It uses regex patterns to classify assets and template constants to emit HTML. There is **no typography system**, **no color system beyond a single `#0a0a0a` background**, **no composition logic**, **no reference to brand tokens**.

## 2. Target pipeline (per memory + skill specs)

The `/storyboard` SKILL.md and `docs/cinematography/specs/storyboard-format.md` specify the target. The pipeline should be:

| Step | Tool | Output shape | Design content |
|------|------|--------------|----------------|
| 1 | `/brief` (existing) | brief object | the *what* |
| 2 | `/storyboard` (existing skill, currently unused by `/direct`) | storyboard.json with panels: `intent`, `description`, `content`, `visual_direction.{composition, typography, color, surfaces, reference}`, `motion_notes.{entrance, choreography, hold, exit}` | **the design checkpoint — typography sizes, weights, colors, composition, reference frames** |
| 2.5 | human review | approval | gate before any HTML |
| 3 | `/prototype` per panel | designed HTML at `prototypes/{date-slug}/concept-v1.html`, with chrome template + fidelity rules | **the actual visual layer — real typography, real surfaces, real colors** |
| 4 | `/animate` per prototype | motion-enriched HTML | timing, primitives, sync — animation engine layer |
| 5 | scene assembly | scene JSON whose `layers[].content` references the prototype HTML (or embeds it) | scene wraps designed HTML, doesn't generate it |
| 6 | `plan_sequence` (existing) | manifest | unchanged from current |
| 7 | `score_candidate_video` (existing) | score card | unchanged |
| 8 | `assemble_video_sequence` (existing) | rendered video | renders the designed HTML |

The key inversion: **`/prototype` outputs the design layer, scenes wrap it.** Today the wrapping is reversed — scenes emit HTML, prototypes are unused.

## 3. The gap — concrete

Three things are missing:

1. **No invocation of `/storyboard` from `/direct`.** Step 2.5 in the target table doesn't exist anywhere in the current loop. The `/storyboard` skill is a markdown spec; it has no programmatic counterpart wired into the autonomous loop.

2. **No invocation of `/prototype` from anywhere upstream of scene rendering.** `prototypes/manifest.json` shows ~35 prototypes manually authored over 3 months. Zero of them are produced by the autonomous loop. The directory is a parallel artifact stream, not part of the rendering pipeline.

3. **`generate_scenes` is the load-bearing shortcut that defeats the design step.** It exists because something has to produce scene JSON, and there's no upstream design source feeding it. Replacing it requires building (or invoking) that upstream source.

## 4. Data contract — what would have to flow between steps

A storyboard panel → prototype invocation → scene record needs three transformations, each with a specific shape contract.

### 4a. Panel → prototype call

```js
// Storyboard panel (existing spec, abridged):
{
  panel_id: "p_03",
  content_type: "prompt_input",
  description: "A chat input field appears center-screen...",
  content: "Tell me more about: Increased software spend.",
  visual_direction: {
    composition: "Input field centered horizontally and vertically. 580px max width...",
    typography: "15px weight 400 inside the input...",
    color: "Input bg: 5% white. Border: 8% white. Submit button: indigo (#6366f1)...",
    surfaces: "28px border radius (pill shape). 14px vertical padding, 20px horizontal.",
    reference: "Mercury prompt input — notice the restraint."
  }
}

// Should become:
/prototype "{panel.description}\n\nVisual direction: {panel.visual_direction.composition}. {panel.visual_direction.typography}. {panel.visual_direction.color}. {panel.visual_direction.surfaces}.\n\nReference: {panel.visual_direction.reference}"
  --fidelity concept
  --chrome none
  --content-type {panel.content_type}    // new flag, used to pick a template
  --output-id {storyboard.id}/{panel.panel_id}
```

The `--content-type` flag is the seam. `/prototype` already has fidelity + chrome; it doesn't yet have a content-type-aware template selector. The `/storyboard` SKILL.md table at lines 161–173 already enumerates the content types (typography, insight_cards, prompt_input, chart_panel, dashboard, logo_lockup, device_mockup, split_panel, stat_callout). `/prototype` would need one HTML template per content type, plus a way to interpolate `panel.content` and `panel.visual_direction` into it.

### 4b. Prototype → scene record

```js
// /prototype output (current):
prototypes/{date}-{slug}/concept-v1.html   // self-contained HTML file

// Should become a scene record like:
{
  scene_id: "sc_03_prompt_input",
  duration_s: 4,
  personality: "cinematic-dark",
  layout: { template: "prototype-embed" },     // new template
  layers: [{
    id: "designed_content",
    type: "html_ref",                           // new layer type
    src: "prototypes/{date}-{slug}/concept-v1.html",  // reference, not inline
    depth_class: "foreground",
    product_role: "hero",
    clarity_weight: 5
  }],
  motion: {
    // Derived from panel.motion_notes.entrance + panel.motion_notes.choreography
    groups: [{ id: "hero", targets: ["designed_content"], primitive: "ed-blur-reveal" }],
    camera: { move: "static" }
  },
  metadata: {
    content_type: panel.content_type,
    intent_tags: [panel.act, panel.intent_keywords],
    visual_weight: panel.energy,
    motion_energy: panel.energy
  }
}
```

The new pieces: `layer.type: "html_ref"` (or similar) so Remotion knows to load the prototype as an iframe / inlined HTML, and `layout.template: "prototype-embed"` so the layout system knows to defer to the prototype's internal layout. Both are additive — they don't break existing scene shapes.

### 4c. Motion notes → motion block

`panel.motion_notes` is prose. Today's `motion.groups` is structured. The translation needs a small parser/recommender:
- "entrance: cd-card-cascade" → `motion.groups[0].primitive = "cd-card-cascade"` (named-primitive references already work)
- "stagger: 180ms" → `motion.groups[0].stagger_ms = 180`
- "fade in 400ms ease-out" + no named primitive → fall back to `as-fadeIn` or similar

This translation is also where ANI-149 (beat planner ↔ recommend_choreography) plugs in: when the panel has a `dramatic-reveal` intent and 4 subjects, `recommend_choreography` should be consulted and lib-* primitives surfaced.

## 5. Three integration options for first implementation slice

**Option A — Storyboard-first wedge (smallest).**
Add a new MCP tool `compose_storyboard(brief, options)` that takes the structured brief and produces a `storyboard.json` per the existing format spec. No design execution; just structured intent + visual_direction. Insert into `/direct` between step 2 and step 3. Beat planner stays as-is. `generate_scenes` stays as-is, but is now informed by storyboard content rather than brief defaults. *Closes ~30% of the gap; everything still uses inline HTML.*

**Option B — Prototype-aware scene assembly (medium).**
Option A + a content-type-aware template generator inside `/prototype` (one template per content_type). Add a new MCP tool `materialize_panel_to_prototype(panel)` that emits a designed HTML file. Add `html_ref` layer type to scene format. Replace `generate_scenes` with `materialize_storyboard_to_scenes` that wraps prototype outputs in scene records. *Closes ~80% of the gap. Polaris-style runs would render real designs.*

**Option C — Full pipeline replacement (largest).**
Option B + replace `generate_scenes` entirely (deprecate it as a shim that calls the new path). Migrate the existing benchmark `cinematic-dark-lib-stagger.json` to the new format. Update the existing `examples/` benchmark fixtures. Update `/direct` SKILL.md. Probably 2 sessions of follow-up work. *Closes 100% of the gap and removes the load-bearing shortcut.*

## 6. Recommended first slice (next session)

**Option A — the storyboard-first wedge.** Reasoning:

- Smallest change, smallest blast radius. Doesn't touch `/prototype`, doesn't touch scene format, doesn't break the benchmark.
- Produces an immediately reviewable artifact (`storyboard.json` per project) — even before any visual output improves, the loop gains a design checkpoint humans can review.
- De-risks Option B: writing the storyboard generator first reveals what visual_direction information is actually inferable from a brief vs. needs LLM enhancement vs. needs human input. That intelligence informs the prototype templates.
- Proves out the data contract in section 4a before we commit to building templates for 9 content types.

Concrete first-session scope:
1. New MCP tool `compose_storyboard(brief, story_brief, options) → storyboard.json`. Pure function, deterministic, follows existing storyboard-format.md spec.
2. Wire `/direct` to call it between step 2 (extract_story_brief) and step 3 (plan_story_beats).
3. Save the storyboard to `projects/{slug}/concept/storyboard.json`.
4. Pass storyboard panel intent + visual_direction *down* into `plan_story_beats` so beat selection is design-aware (rather than archetype-only).
5. Add a unit test that running on the Polaris brief produces a storyboard with at least 7 panels, all with non-empty `visual_direction.composition`.
6. **No changes to `generate_scenes`, `/prototype`, or scene format.** Those are Option B.

Acceptance: re-running `/direct` on `polaris-observability` produces a `concept/storyboard.json` whose Features panel has explicit visual_direction for the 4-pillar reveal. We can read it and see the design intent, even if the rendered output still looks like the current run.

## 7. Migration path

For Option A:
- No breaking changes. `compose_storyboard` is additive.
- `/direct` SKILL.md needs a new section between step 2 and 3.
- No changes to: scene format, manifest format, benchmark fixtures, render pipeline, MCP server tool count grows by 1.

For Option B (next-next session):
- New layer type `html_ref` is an additive change to `docs/cinematography/specs/scene-format.md`.
- New layout template `prototype-embed` is additive.
- `generate_scenes` keeps working for legacy callers; new path is opt-in.
- Benchmark migration: `cinematic-dark-lib-stagger.json` doesn't need changes (already a hand-authored scene, not generated). New benchmark for the prototype-driven path may be appropriate.

For Option C: write a separate migration plan when we get there.

## 8. Risks and unknowns

- **Brief → visual_direction inference is the hard part.** A storyboard's value comes from specific typography ("15px weight 600", "Inter -0.025em tracking"). A brief like Polaris's gives intent, not specifics. `compose_storyboard` will need either: brand-package-driven defaults (`brand.typography_note` → applied per panel), LLM enhancement, or both. ANI-31's enhancement path (`enhanceScenePlan`) is a precedent.
- **Prototype iframes vs. inlined HTML.** Remotion can render iframes but it's expensive at 60fps. Inlining is cheaper but requires CSS namespacing (prototype CSS shouldn't leak into the Remotion composition). Decision deferrable to Option B.
- **Backwards compatibility with the existing fintech-sizzle project.** That project has artifacts from a pre-storyboard-aware run. If we change `/direct`'s behavior, re-running it produces different output. Acceptable — it's already in `draft` status.
- **Beat planner's existing recommended_primitives pool overlaps with motion_notes.** Today's beat planner recommends primitives per role. Storyboard panels also specify primitives in `motion_notes.entrance`. Conflict resolution: panel-level wins, beat-level is fallback. Document this in the SKILL.md update.

## 9. Out of scope (for the first slice)

- Replacing `generate_scenes`. Stays for now.
- Building 9 content-type-specific prototype templates.
- Migrating existing benchmark fixtures to a designed pipeline.
- Brand token system updates.
- Storyboard-from-image / storyboard-from-Figma ingestion paths.
- Solving ANI-148/149/150 (the lib-* loop integration gaps). Those are independent and can land in any order relative to this work — they're orthogonal to the design layer.

## 10. Open questions for the user before next session

1. Do we want `compose_storyboard` to be deterministic (rule-based) or LLM-enhanced (like `generate_scenes` already is via `enhanceScenePlan`)? Trade-off: determinism means reproducibility; LLM means richer visual_direction.
2. Do we want the storyboard to be a strict requirement before scoring (i.e., scoring fails without a storyboard) or an additive artifact (scoring works either way)? Strict gives the design checkpoint teeth; additive avoids breaking changes.
3. For the first slice, is the Polaris project the right validation target, or do we want a fresh project with a brief specifically biased toward design-rich content (e.g., a dashboard reveal)?

---

## Appendix — file reference index

- `mcp/lib/generator.js` — current scene generator (`generate_scenes` impl)
- `.claude/skills/storyboard/SKILL.md` — storyboard spec
- `.claude/skills/prototype/SKILL.md` — prototype generator
- `.claude/skills/direct/SKILL.md` — autonomous loop spec
- `docs/cinematography/specs/storyboard-format.md` — full storyboard JSON shape
- `docs/cinematography/specs/scene-format.md` — current scene JSON shape (would gain `html_ref` layer type in Option B)
- `prototypes/manifest.json` — existing prototype catalog (~35 entries, all manually authored)
- `prototypes/2026-03-21-storyboard-template/` — the closest existing prototype that resembles the target
- `projects/2026-05-08-polaris-observability/review/findings-2026-05-08-loop-integration-gaps.md` — concrete in-vivo confirmation that today's pipeline collapses brief content into single-text-layer scenes
- `memory/project_design_gap.md` — origin memory (Mercury recreation, 2026-03-20)
