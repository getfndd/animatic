---
name: spec-rules
fidelity: spec
scope: portable
---

# Spec Fidelity Rules

**Purpose:** production-accurate prototypes. A spec prototype claims that what
it shows is what will ship, so every token, utility, and pattern in it must be
one the project actually has.

## Spec fidelity requires a design system

This level is only available when a design-system MCP is reachable — Preset AI
by default, or whatever the project adapter names in `design_system_mcp`.

**If none is reachable, stop and offer `concept` instead.** Do not infer presets
from the codebase and do not invent them. An invented preset presented as
validated is worse than an honest concept prototype: it is wrong in exactly the
direction this fidelity level exists to prevent, and the label is the thing
someone will trust when they build from it.

Query before generating, not after:

```
suggest_preset({ intent: "submit form button" })
get_color_guidance({ context: "error message" })
get_preset_code({ presetName: "primary-action" })
validate_component_props({ component: "button", props: {...} })
```

Every component in the output should trace back to one of those answers. If a
component has no preset, that is a finding worth reporting — not a gap to fill
with a plausible guess.

## Colours — resolved tokens only

Use the semantic tokens the project's palette defines:

- Surfaces: `--surface`, `--surface-2`, `--surface-raised`
- Ink: `--ink`, `--ink-soft`, `--ink-quiet`, `--ink-faint`, `--ink-ghost`
- Rules: `--rule`, `--rule-strong`
- Status: `--success-600`, `--error-600`, `--warning-600`

No arbitrary colours. No raw hex. No opacity hacks on ink values — if a lighter
ink is needed, the scale already has one.

## Typography — the project's utilities

Reference the type stack through variables, never by family name:

- `.mono` — `--font-mono`, weight 400, tabular numerals
- `.mono-uc` — `--font-mono`, 10px, weight 500, uppercase, tracking 0.08em
- `.mono-num` — `--font-mono`, weight 300, tracking -0.01em, tabular + ss01

Naming a typeface here would reintroduce the prescription the token contract
exists to remove, and would be wrong for every project that licenses a
different one.

## Spacing and motion — the defined scale

- `--pad`, `--pad-sm`, `--pad-xs`
- Content widths: `--max-w-content`, `--max-w-wide`
- Motion: `--dur-tier1` for micro interactions, `--dur-tier2-*` for UI state
  changes, `--dur-tier3-*` for page transitions, easing via `--ease-out`

Never arbitrary pixel values. If a value is missing from the scale, that is a
design-system gap to report, not to work around.

## All interactive states required

Every interactive element must show default, hover, focus (visible ring or
outline), disabled where applicable, and loading where applicable. A spec
prototype missing its focus state is not production-accurate — it is a
production accessibility bug rendered convincingly.

## Accessibility

- WCAG AA minimum contrast — 4.5:1 body text, 3:1 large text and UI boundaries
- Every interactive element reachable and operable by keyboard
- ARIA labels where the visual label is insufficient
- Form inputs programmatically linked to their labels

`@steve` owns this in depth; `reference/wcag-checklist.md` in that skill is the
graded source. At spec fidelity these are not suggestions.

## Border rules

- Full-perimeter borders only: `border: 1px solid var(--rule)`
- No one-sided borders as decoration
- No border-left/right accent lines
- No box-shadows on inputs or search fields

## DO

- Query the design-system MCP first and build from its answers
- Include every interactive state
- Verify contrast rather than assuming it
- Use semantic HTML
- Report design-system gaps you hit

## DO NOT

- Generate at this fidelity with no design-system MCP reachable
- Use a colour, spacing value, or typeface the project has not defined
- Skip interactive states
- Invent a preset and present it as validated
