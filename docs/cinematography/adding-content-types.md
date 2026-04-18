# Adding a Semantic v3 Content Type

How to extend the v3 component catalog end-to-end. The v3 spec
([`semantic-scene-format.md`](specs/semantic-scene-format.md)) describes
*what* a component is; this guide describes *how* to add a new one.

This walkthrough uses a running example — `progress_bar` — a numeric-progress
hero component that would slot next to `result_stack` and `input_field` in the
existing catalog.

---

## When to add a new type

Before adding anything, check whether an existing type fits. The 8 current
types (see `docs/cinematography/specs/semantic-scene-format.md:46-58`) cover
most authoring needs:

| If you need… | Use |
|---|---|
| Single-line text input with a cursor | `input_field` |
| Multi-line prompt with type-and-complete | `prompt_card` |
| A list that inserts / reorders items | `result_stack` |
| A fanning stack of cards | `stacked_cards` |
| A dropdown with open + select | `dropdown_menu` |
| A drop target with focus highlight | `upload_zone` |
| A horizontal chip selector | `chip_row` |
| A compact status/metric row | `icon_label_row` |

Add a new type only when none of these models the interaction you need.
Adding a type costs code, tests, and inference heuristics — reuse is cheaper.

---

## Architecture map

A v3 type touches these files. Most additions only modify the first three.

| Layer | File | Required? |
|---|---|---|
| Spec `type` enum | `docs/cinematography/specs/semantic-scene-format.md` | **Yes** |
| Layout size defaults | `mcp/lib/layout-constraints.js` (`COMPONENT_SIZE_DEFAULTS`) | **Yes** |
| Visual state machine | `mcp/lib/state-machines.js` (`STATE_MACHINES`) | **Yes** |
| Interaction handler | `mcp/lib/compiler.js` (`interactionToGroup` switch) | Only for novel interaction kinds |
| Timeline-driven renderer | `src/remotion/compositions/SemanticRenderers.jsx` | Only for novel animated visuals |
| Planner classification | `mcp/lib/semantic-planner.js` (`INTERACTION_TO_COMPONENTS`, `DENSITY_OVERRIDES`) | Only if the type should be auto-recommended |
| Named recipe | `mcp/lib/interaction-recipes.js` (`RECIPES`, `COMPONENT_INTENT_TO_RECIPE`) | Only if the type has a canonical interaction chain |
| Readability classifier | `mcp/lib/semantic-critic.js` (`TEXT_COMPONENT_TYPES`) | Only for text-hosting types |
| Tests | `mcp/test/state-machines.test.js`, `mcp/test/compiler.test.js` | **Yes** |
| Example scene | `docs/cinematography/specs/semantic-scene-format.md` (Examples section) | **Yes** |

The `mcp/test/docs-drift.test.js` drift guard (added in ANI-107) fails the
build if the spec enum drifts from either `STATE_MACHINES` or
`COMPONENT_SIZE_DEFAULTS`, so missing either of the required registrations is
caught automatically.

---

## Step 1 — Extend the spec enum

Edit `docs/cinematography/specs/semantic-scene-format.md`. Find the `type`
enum inside the **Component Definition** section:

```json
"type": {
  "type": "string",
  "enum": [
    "input_field",
    "prompt_card",
    "dropdown_menu",
    "result_stack",
    "upload_zone",
    "chip_row",
    "icon_label_row",
    "stacked_cards",
    "progress_bar"
  ],
  "description": "Semantic component type."
}
```

The drift guard parses exactly this enum, so keep the shape intact.

---

## Step 2 — Add a layout hint

Edit `mcp/lib/layout-constraints.js` and add an entry to
`COMPONENT_SIZE_DEFAULTS`:

```js
const COMPONENT_SIZE_DEFAULTS = {
  // …existing entries…
  progress_bar: { w: 0.4, h: 0.06 },
};
```

Sizes are expressed as a fraction of canvas width/height. Match the visual
intent: a drop zone is tall, a chip row is shallow, a progress bar is wide
and short.

---

## Step 3 — Add the state machine

Edit `mcp/lib/state-machines.js` and append an entry to `STATE_MACHINES`.
Every entry has:

- `type` — the enum value, must match the map key
- `states` — named visual snapshots with numeric properties (opacity, scale, translateY, rotate)
- `overrides` — interaction kind → override config (`effects`, `duration_ms`, optional `sibling_dim_opacity` or `fan_spread`)

For `progress_bar`, the interesting interactions are `insert_items` (drive
progress fill) and `settle` (complete):

```js
['progress_bar', {
  type: 'progress_bar',
  states: {
    idle:       { opacity: 1, scale: 1 },
    filling:    { opacity: 1, scale: 1 },
    completing: { opacity: 1, scale: 1.02 },
    settled:    { opacity: 1, scale: 1 },
  },
  overrides: {
    // Progress fills in place — no translate, just opacity lift + settle
    insert_items: {
      effects: [
        { type: 'opacity', from: 0.6, to: 1, duration_ms: 300, easing: null },
        { type: 'scale', from: 0.98, to: 1, duration_ms: 300, easing: null },
      ],
      duration_ms: 300,
    },
    settle: {
      effects: [
        { type: 'scale', from: 1.02, to: 1, duration_ms: 350, easing: null },
      ],
      duration_ms: 350,
    },
  },
}],
```

### How overrides flow through the compiler

`mcp/lib/compiler.js:interactionToGroup` checks for a state-machine override
before falling through to the generic interaction-kind switch. When
`override.effects` is present, those effects replace the generic defaults
for that component type. Leave `easing: null` to let the compiler resolve it
against the active personality (`cinematic-dark` → `spring`, others →
`ease_out`).

---

## Step 4 — Decide whether the compiler needs a new interaction kind

If the interactions on your type are all covered by the existing nine kinds
(`focus`, `type_text`, `replace_text`, `open_menu`, `select_item`,
`insert_items`, `fan_stack`, `settle`, `pulse_focus`), **you don't need to
touch the compiler.** The state machine override path handles the visual
customization.

Only modify `interactionToGroup`'s switch when the type has a genuinely
novel interaction pattern — e.g., `fan_stack` is special-cased because it
expands to one motion group per card. For `progress_bar`, the existing
`insert_items` kind is sufficient.

If you do add a new kind:

1. Add it to `VALID_KINDS` in `mcp/lib/state-machines.js`
2. Add it to the `kind` enum in `semantic-scene-format.md` (Interaction
   Definition section)
3. Add a case to the switch in `compiler.js:interactionToGroup`

---

## Step 5 — Decide whether you need a renderer

`src/remotion/compositions/SemanticRenderers.jsx` hosts visual renderers
that translate semantic timeline properties (`counter_value`,
`list_insert_progress`, `menu_open_progress`, etc.) into animated visuals.

You need to add a renderer **only if** the type renders a new kind of
animated content that existing renderers can't handle. Most new types can
reuse:

- `TextLayer` for static text content
- `ListRenderer` for lists / multi-item reveals
- `CounterRenderer` for numeric counters
- `MenuRenderer` for dropdowns
- Plain layer styles for static decorative elements

For `progress_bar`, reuse `ListRenderer` + a custom layer style — no new
renderer required.

If you do add a renderer:

1. Export it from `SemanticRenderers.jsx` as a React component
2. Register the timeline properties it consumes in
   `mcp/lib/compiler.js:ANIMATABLE_DEFAULTS`
3. Wire it into `SceneComposition.jsx` where the type is detected

---

## Step 6 — Optional: planner and recipe wiring

### Planner (auto-recommendation)

If the type should be *recommended* when a beat has a certain classification,
edit `mcp/lib/semantic-planner.js`. Add entries to
`INTERACTION_TO_COMPONENTS` (for new interaction types) or
`DENSITY_OVERRIDES` (for composition-density branches). This makes
`planStoryBeats` emit `semantic_recommendation` payloads that seed the
new type.

For `progress_bar`, a reasonable wiring would extend the `reveal` interaction
type to include `progress_bar` as a candidate when paired with
`pacing: deliberate`:

```js
// in semantic-planner.js
const INTERACTION_TO_COMPONENTS = {
  // …
  reveal: {
    component_types: ['result_stack', 'progress_bar'], // add progress_bar
    recipes: ['reveal-results-stack'],
    personality_affinity: ['cinematic-dark'],
  },
};
```

### Recipes (canonical interaction chains)

If the type has a go-to multi-step interaction sequence, add it to
`mcp/lib/interaction-recipes.js`:

1. Define a recipe function returning an `interaction[]` array
2. Register it in `RECIPES`
3. Map `<type>:<intent>` entries in `COMPONENT_INTENT_TO_RECIPE`

Recipes are purely optional — only 2 of the 8 existing types have them.

### Critic (readability classifier)

If the type hosts text that needs readability-hold time (like `prompt_card`
and `input_field`), add it to `TEXT_COMPONENT_TYPES` in
`mcp/lib/semantic-critic.js`. This enables the
`semantic_unreadable_hold` rule to flag text that changes before the
viewer can read it.

---

## Step 7 — Write tests

At minimum, add state-machine coverage. Three kinds of assertions:

```js
// mcp/test/state-machines.test.js

describe('progress_bar overrides', () => {
  it('insert_items opacity lift starts at 0.6', () => {
    const result = resolveStateOverrides('progress_bar', 'insert_items');
    const opacity = result.effects.find(e => e.type === 'opacity');
    assert.equal(opacity.from, 0.6);
  });

  it('settle scale animates from 1.02', () => {
    const result = resolveStateOverrides('progress_bar', 'settle');
    const scale = result.effects.find(e => e.type === 'scale');
    assert.equal(scale.from, 1.02);
  });
});
```

Then update the existing "has one machine for each v3 component type" test
to include the new type.

For compiler integration, add an assertion verifying the override path is
hit (pattern at `mcp/test/compiler.test.js:1069-1111`):

```js
it('progress_bar insert_items uses override effects', () => {
  const map = makeComponentMap([
    { id: 'cmp_bar', type: 'progress_bar', role: 'hero' },
  ]);
  const groups = interactionToGroup({
    id: 'int_fill', target: 'cmp_bar', kind: 'insert_items',
    params: { items: ['a', 'b', 'c'] },
  }, map, null);
  const opacity = groups[0].effects.find(e => e.type === 'opacity');
  assert.equal(opacity.from, 0.6); // override, not generic 0
});
```

---

## Step 8 — Verify drift guards

Run the full suite:

```bash
npm test
```

The drift guard in `mcp/test/docs-drift.test.js` will fail with a clear
message if:

- The spec enum has a type without a `STATE_MACHINES` entry
- `STATE_MACHINES` has a type not listed in the spec enum
- The spec enum has a type without a `COMPONENT_SIZE_DEFAULTS` entry
- `COMPONENT_SIZE_DEFAULTS` has a type not in the spec enum

If the drift guard fails, the error message tells you which source to update.

---

## Step 9 — Add an example

Append a numbered example to the **Examples** section in
`semantic-scene-format.md`. Keep it minimal — 1-2 components, 2-3
interactions, no unrelated chrome. Make sure cue timings resolve (every
`delay.after` must reference an `on_complete.emit` that actually fires).

Example scaffold:

```json
{
  "scene_id": "sc_progress_fill",
  "format_version": 3,
  "duration_s": 3,
  "camera": { "move": "static" },
  "layers": [],
  "semantic": {
    "components": [
      {
        "id": "cmp_bar",
        "type": "progress_bar",
        "role": "hero",
        "anchor": { "x": 0.5, "y": 0.5 },
        "props": { "total": 100 }
      }
    ],
    "interactions": [
      {
        "id": "int_fill",
        "target": "cmp_bar",
        "kind": "insert_items",
        "params": { "items": ["25", "50", "75", "100"], "stagger_ms": 300 },
        "timing": { "at_ms": 400 },
        "on_complete": { "emit": "filled" }
      },
      {
        "id": "int_settle",
        "target": "cmp_bar",
        "kind": "settle",
        "timing": { "delay": { "after": "filled", "offset_ms": 200 } }
      }
    ]
  }
}
```

---

## Checklist

Before opening a PR for a new content type:

- [ ] Spec enum includes the new type
- [ ] `COMPONENT_SIZE_DEFAULTS` has an entry
- [ ] `STATE_MACHINES` has an entry with at least one override
- [ ] State-machine tests cover the override
- [ ] Compiler integration test proves the override path is hit
- [ ] `npm test` passes — drift guard confirms alignment
- [ ] Example added to the Examples section of the spec
- [ ] (Optional) Planner / recipes / critic wired if the type warrants auto-recommendation or special classification

---

## Related

- [Semantic Scene Format v3 spec](specs/semantic-scene-format.md)
- [Interaction DSL](specs/interaction-dsl.md)
- ANI-107 — Canonical 4-type parity work (`input_field`, `icon_label_row`, `upload_zone`, `chip_row`)
- ANI-116 — Semantic-critic + semantic-planner wiring into `/direct`
