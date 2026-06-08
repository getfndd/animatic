# Cookbook Walkthroughs — Brief → Video

Complete, end-to-end examples: a real brief, the scene JSON it produces, the sequence manifest that orders the scenes, the exact render command, and a rendered contact sheet (one representative still per scene). Where the [pattern cookbook](../INDEX.md) shows a single reusable recipe, a walkthrough shows how those recipes compose into a finished sequence.

Each walkthrough is built on a checked-in project under [`examples/`](../../../examples/), so you can render it yourself and compare against the committed contact sheet.

---

## Walkthroughs

| Walkthrough | Project | Personality | Scenes | Patterns demonstrated |
|-------------|---------|-------------|--------|------------------------|
| [Fintech Sizzle](fintech-sizzle.md) | `examples/fintech-sizzle` | cinematic-dark | 9 | dashboard-data-build, chat-to-result-reveal, chart-drilldown-explain, metric-highlight-pop, logo-resolve-close |
| [AI Prompt → Result](ai-prompt-to-result.md) | `examples/ai-prompt-to-result` | cinematic-dark | 5 | chat-to-result-reveal, progress-resolve |
| [Product Demo](product-demo.md) | `examples/product-demo` | neutral-light | 6 | onboarding-step-flow, tutorial-spotlight, testimonial-crossfade |
| [Brand Teaser](brand-teaser.md) | `examples/brand-teaser` | cinematic-dark | 5 | ambient-brand-loop, kinetic-type-statement, logo-resolve-close |

---

## Rendering a walkthrough yourself

Contact sheets are regenerated with:

```bash
node scripts/render-cookbook-contact-sheets.mjs                # all walkthroughs
node scripts/render-cookbook-contact-sheets.mjs fintech-sizzle # one
```

This bundles the Remotion project once and renders one still per scene (sampled at 60% through each scene, past entrances and before exits), then montages them into `docs/cookbook/walkthroughs/assets/<project>-contact-sheet.png` with ffmpeg.

To render the full **video** (MP4) for a project, see each walkthrough's *Render* section — the command differs depending on whether the project ships a precompiled `render-props.json`.

> Contact sheets are committed under `docs/cookbook/walkthroughs/assets/` because `renders/` is gitignored. They are intentionally low-resolution (480px/frame) — proof of output, not deliverables.
