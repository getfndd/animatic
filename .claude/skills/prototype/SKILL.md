---
name: prototype
memory: project
effort: high
description: Generate design-system-aware HTML prototypes with consistent fidelity and chrome options. Invoke with /prototype "what to build" to create cataloged prototypes that respect the project's design system.
---

# /prototype - Design-System-Aware Prototyping

Generate HTML prototypes grounded in whatever design system the project declares — its tokens, presets, and patterns. The skill supplies discipline, not a design system.

---

## Command Interface

```
/prototype "description of what to build"
  --fidelity sketch|concept|spec (default: concept)
  --chrome none|minimal|sidebar|full|marketing-a|marketing-b|marketing-c (default: minimal)
  --mode single|flow (default: single)
  --options 1|2|3 (default: 1)
  --name string (auto-generated from description)
```

### Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `description` | string | required | What to prototype |
| `--fidelity` | `sketch`, `concept`, `spec` | `concept` | Design system adherence level |
| `--chrome` | `none`, `minimal`, `sidebar`, `full`, `marketing-a`, `marketing-b`, `marketing-c` | `minimal` | App shell to include |
| `--mode` | `single`, `flow` | `single` | `single` = one surface (with `--options` variations); `flow` = an ordered multi-screen storyboard of one journey |
| `--options` | `1`, `2`, `3` | `1` | Number of variations (ignored in flow mode) |
| `--name` | string | auto | Prototype name for cataloging |

---

## Execution Flow

When `/prototype` is invoked:

### 1. Parse Parameters

Extract from the command:
- Description (required)
- Fidelity level (default: concept)
- Chrome type (default: minimal)
- Number of options (default: 1)
- Name (auto-generate from description if not provided)

### 2. Resolve the Palette

**Before generating anything.** This skill enforces conformance to a defined
palette; it does not supply one. Resolve in order and stop at the first hit:

| # | Source | How |
|---|--------|-----|
| 1 | Project adapter | `semantic_tokens` in `.claude/skills/_adapters/{project}.md` |
| 2 | Inferred from the repo | An existing tokens file, Tailwind theme, or `:root` custom properties |
| 3 | Placeholders | The achromatic ramp in `templates/_tokens.css` |

**If you resolved at resolution step 2 or 3, the prototype must say so on the page**, as
the first element inside `<body>`:

```html
<p class="palette-notice">
  Palette inferred from tailwind.config.ts — not declared in the project
  adapter. Verify before review.
</p>
```

Inference is convenient and it is the step that can quietly go wrong: a repo
part-way through a migration has two palettes, and picking the older one looks
identical to picking deliberately. The notice is what makes that reviewable.
Never omit it to make a prototype look finished — looking unfinished is the
correct output when the palette is not defined.

Record the resolution step and source in `meta.json` alongside the tokens used.

### 3. Load Fidelity Rules

Read the appropriate rules file:
- `sketch`: Load `${CLAUDE_SKILL_DIR}/fidelity/sketch-rules.md`
- `concept`: Load `${CLAUDE_SKILL_DIR}/fidelity/concept-rules.md`
- `spec`: Load `${CLAUDE_SKILL_DIR}/fidelity/spec-rules.md`

**Critical:** Follow the rules exactly. They define what colors, typography, components, and interactivity are allowed.

Each fidelity has a worked example in `${CLAUDE_SKILL_DIR}/examples/` —
`sketch-example.html`, `concept-example.html`, `spec-example.html`. They are the
same screen (a login form) at all three levels, which is the fastest way to see
what the level actually changes. Read one when the rules are ambiguous; do not
copy them as a starting template.

### 4. Load Chrome Template

Read the appropriate template:
- `none`: `${CLAUDE_SKILL_DIR}/templates/chrome-none.html`
- `minimal`: `${CLAUDE_SKILL_DIR}/templates/chrome-minimal.html`
- `sidebar`: `${CLAUDE_SKILL_DIR}/templates/chrome-sidebar.html`
- `full`: `${CLAUDE_SKILL_DIR}/templates/chrome-full.html`
- `marketing-a` / `marketing-b` / `marketing-c`: `${CLAUDE_SKILL_DIR}/templates/chrome-marketing-{a,b,c}.html`

Every chrome, marketing included, links `_tokens.css` alone and resolves its
palette from the project. None of them carries a brand.

This used to be untrue: the marketing chromes shipped linked to the studio's own
palette, with a licensed font and real contact addresses in the footer, and the
instruction here was to remember not to use them on client work. An instruction
is not a control — `team sync` copies every file in this skill into every
project regardless of what the docs advise, so the assets travelled anyway. A
project's brand now reaches a prototype the same way it reaches everything else:
through `adapters/{project}.md`.

### 5. Query Design System Context (spec fidelity only)

At `spec` fidelity a prototype claims to be production-accurate, so it must be
grounded in the project's real design system rather than in inference.

**The default platform is Preset AI** — the agentic design-system platform, and
the source of the tool surface below. Query it unless the project's adapter
declares a different `design_system_mcp`.

The distinction that matters, because getting it backwards is what caused the
last defect here:

| | Portable? | |
|---|---|---|
| **Preset AI** | yes | The *platform*. A tool, like naming Figma or Linear — it serves whatever design system a project has. |
| A design system | **no** | A *project fact*. One client's system is not another's, and an earlier version of this file named one as *the* system. |

So: name the platform, never the system. Preset AI answers for whichever design
system the project has registered with it.

**If Preset AI is not connected and the adapter declares no alternative, `spec`
fidelity is unavailable.** Say so and offer `concept` instead. Do not improvise
presets and call the result production-accurate — an invented preset presented
as validated is worse than an honest concept prototype, because it is wrong in
the one direction the fidelity level exists to prevent.

```
# Get appropriate presets for components
suggest_preset({ intent: "submit form button" })
suggest_preset({ intent: "cancel action" })

# Get color guidance
get_color_guidance({ context: "error message" })

# Get preset code
get_preset_code({ presetName: "primary-action" })

# Validate props
validate_component_props({ component: "button", props: {...} })
```

### 6. Generate Prototype(s)

Generate HTML that:
1. Uses the chrome template structure
2. Follows fidelity rules exactly
3. Replaces `{{TITLE}}` with prototype name
4. Replaces `{{CONTENT}}` with the generated UI
5. Replaces `{{PROJECT}}` with the project's own name — the wordmark slot in
   the generic chromes. Take it from the adapter; if there is no adapter, use
   the repository name rather than inventing one, and never fill it with the
   name of whoever authored the skill.
6. Replaces `{{DESCRIPTION}}` with a one-line summary of what the prototype
   shows. It fills the `<meta name="description">` every chrome carries, so
   an unsubstituted one ships the literal `{{DESCRIPTION}}` string in the
   page head. Reuse the prototype description already captured for
   `meta.json` rather than writing a second one.
7. Replaces `{{TAGLINE}}`, `{{CTA}}` and `{{CTA_HREF}}` in the marketing
   chromes — the footer strapline, the header call-to-action, and where that
   action goes. These are slots rather than defaults on purpose: a tagline and
   a primary action are the two lines that say most about whose product this
   is. The chromes shipped the studio's own ("For ideas in progress.", "Enter
   studio →") until a review caught it, which left every project's marketing
   prototype reading like a design studio's.

   `{{CTA_HREF}}` is a separate slot because the first fix replaced only the
   label and left `href="/studio"` — the button then read correctly and still
   pointed at the studio's route. A destination is as much a project fact as
   the words on the button.

   Take all three from the adapter or the brief. If you have none, leave the
   placeholders visible rather than inventing a positioning claim; for the
   destination specifically, `#` is the honest stand-in for "not decided yet",
   never a guessed route.
8. If options > 1, create variations exploring different approaches

### 6.5 Doctrine check

A design system is more than tokens. Where one declares **principles and
anti-patterns**, the prototype is checked against them before it is reported
as finished — token conformance alone will pass a page that is over-boxed,
mis-weighted, or rendered outside the shell it belongs in.

Resolve the doctrine in order and stop at the first hit:

| # | Source | How |
|---|--------|-----|
| 1 | The design-system platform | Ask it for the project's declared principles and anti-patterns |
| 2 | Project checklist | `fidelity/<design-system>-checklist.md`, where the project has written one |
| 3 | Generic | The fidelity rules alone — no declared doctrine to check against |

Report the result in the summary, always, in this shape:

```
## Doctrine check

Fires (N):
- <anti-pattern>: <element + matching signal> (violates: <principle>, <principle>)
  Suggested fix: <how to avoid>

Concerns (M):
- <anti-pattern>: <signal that might apply> on <element>; <why it is not a definitive fire>

Clean (K of K checked, no signal matched):
- <names>
```

**When the check cannot run, say so — never omit the section.**

```
## Doctrine check
Not run: the design-system platform is not connected and no project
checklist exists. Token conformance was checked; declared principles
were not.
```

This is the failure mode worth being deliberate about. The check was
originally written to load anti-patterns from the design-system platform,
and when that call returned nothing it was **silently skipped** — so a
surface shipped with zero doctrine enforcement, looking exactly like one
that had passed. An over-boxed prototype with a filled dark button on every
row went out that way. A check that cannot run is a finding, not a pass.

### 6.7 Sign-off and open questions

Concept and spec prototypes exist to be decided on, and the decisions get
lost between the prototype and the conversation about it. Capture them with
the artifact.

Record in `meta.json`:

```json
"signoff": "draft",
"openQuestions": [
  {
    "question": "Does the empty state offer import, or only create?",
    "status": "open",
    "recommended": "Both, with create primary",
    "reason": "Import is the larger job but the rarer one"
  }
]
```

`signoff` is one of `draft`, `in-review`, `signed-off`. Each question is
`open` or `decided`.

When there is at least one question and fidelity is `concept` or `spec`,
render `templates/signoff-footer.html` into the page (into the flow index in
flow mode, once for the journey). Skip it entirely when there are none — an
empty "Open questions" heading reads as an oversight rather than a clean
result.

The footer is a **snapshot**; `meta.json` is authoritative. It says so on the
page, because a stale HTML footer that looks current is worse than no footer.

### 6.8 Flow mode (`--mode flow`)

A single screen is rarely the question. Flow mode prototypes a journey.

1. **Decompose** the description into N ordered screen specs — states of one
   journey — each with a stable kebab-case `id` (`connect-source`,
   `review-results`). Stable because the id ends up in filenames, the catalog,
   and any comment anyone leaves about a screen.
2. **Generate each screen** through this same flow, including the doctrine
   check, at the chosen `--fidelity` and `--chrome`, writing
   `prototypes/<id>/{fidelity}-flow-{NN}-{screenId}.html` with `NN`
   zero-padded from `01`. Every screen is independently openable and
   independently checked.
   **`--options` is ignored here** — a flow is already multi-screen. If it was
   passed, say so in the summary rather than silently dropping it.
3. **Build the index** from `templates/flow-index.html`:
   - `{{TITLE}}`, `{{DESCRIPTION}}` as usual.
   - `{{DS_TOKEN_STYLE}}`: the `<style>`, `<link>` and `<script>` blocks from
     the chosen chrome's `<head>` — *not* its `<meta charset>`, `<meta
     viewport>` or `<title>`. This makes the storyboard adopt the project's
     palette, dark mode, radius and type. Never substitute hardcoded hex.
   - `{{FLOW_STRIP}}`: one screen block per screen in order, with a transition
     block between adjacent screens, using the patterns in the template's
     authoring comment.
   - `{{SIGNOFF_FOOTER}}`: the Step 6.7 footer for the journey, or empty.

   **Strip the authoring comment** before writing. It is scaffolding for
   whoever fills the template, and it must not appear in the output.

   Write it as `prototypes/<id>/index.html`, and run the index through the
   same doctrine check the screens got — it is a page in the product's design
   system, not a tooling artifact exempt from its rules.
4. **Sign off on the journey**, not screen by screen: one `signoff`, and
   `openQuestions[]` for forks that span the flow.

### 7. Save to Catalog

Save files to `prototypes/`:

```
prototypes/
├── manifest.json                    # Update with new entry
└── {date}-{name}/
    ├── {fidelity}-v1.html           # First variation      (single mode)
    ├── {fidelity}-v2.html           # Second (if options >= 2)
    ├── {fidelity}-v3.html           # Third (if options == 3)
    ├── _tokens.css                  # REQUIRED — copied from templates/
    └── meta.json                    # Metadata
```

In flow mode the same folder holds the journey instead:

```
└── {date}-{name}/
    ├── index.html                             # the storyboard
    ├── {fidelity}-flow-01-{screenId}.html     # each screen, independently openable
    ├── {fidelity}-flow-02-{screenId}.html
    ├── _tokens.css
    └── meta.json
```

**Copy the stylesheet the chrome links, into the same directory as the
HTML.** Every chrome opens with `<link rel="stylesheet" href="./_tokens.css">`,
relative to the *output* file, not to `templates/`. Skip this and the page renders
unstyled — every custom property and every `.proto-header` / `.pill-nav`
class resolves to nothing, which looks like a broken prototype rather than
a missing file.

```bash
cp <skill>/templates/_tokens.css prototypes/{date}-{name}/
```

The stylesheets are copied rather than linked back to the skill directory
so a prototype stays self-contained: the folder can be zipped, moved, or
sent to someone who has no copy of the skill, and still renders.

**Verify before reporting success:** open the output and confirm the page
has its type and colour. An unstyled prototype is the single most likely
failure of this skill, and it is silent — the file exists, the browser
renders it, and only the design is missing.

### 8. Return Summary

Report:
- Files created and their paths
- How to preview (open in browser)
- Design system elements used (tokens, presets)
- Any notes on the variations

---

## Fidelity Levels

| Level | Use Case | Design System Usage |
|-------|----------|---------------------|
| **sketch** | Quick layout exploration | None - gray boxes, system fonts |
| **concept** | Visual direction testing | Tokens for colors/spacing, flexible components |
| **spec** | Production handoff | Full preset enforcement, validated |

### When to Use Each

- **sketch**: "I need to explore 3 different layouts for this page"
- **concept**: "Show me how this feature might look with our design tokens"
- **spec**: "This is going to production, I need exact component usage"

---

## Chrome Types

| Chrome | Description |
|--------|-------------|
| **none** | Raw component/page, no shell |
| **minimal** | Simple header with title |
| **sidebar** | Left nav + header (app style) |
| **full** | Complete app shell with breadcrumbs, search, notifications |

### When to Use Each

- **none**: Component exploration, isolated testing
- **minimal**: Simple page concepts, focused views
- **sidebar**: In-app pages, navigation context
- **full**: Complete app experience, realistic context

---

## Output Structure

### manifest.json

```json
{
  "prototypes": [
    {
      "id": "2026-01-22-login-form",
      "name": "Login Form",
      "description": "Login form with email and password",
      "fidelity": "concept",
      "chrome": "minimal",
      "versions": 2,
      "createdAt": "2026-01-22T10:30:00Z",
      "tags": ["auth", "form"]
    }
  ]
}
```

### meta.json

```json
{
  "id": "2026-01-22-login-form",
  "name": "Login Form",
  "description": "Login form with email and password fields",
  "prompt": "/prototype 'login form with email and password' --fidelity concept --options 2",
  "fidelity": "concept",
  "chrome": "minimal",
  "versions": [
    { "file": "concept-v1.html", "notes": "Standard vertical layout" },
    { "file": "concept-v2.html", "notes": "Side-by-side with illustration" }
  ],
  "designSystemUsage": {
    "tokens": ["--surface-primary", "--text-primary", "--border-default"],
    "presets": [],
    "patterns": []
  },
  "createdAt": "2026-01-22T10:30:00Z"
}
```

### meta.json — flow mode

A flow is **one** catalog artifact: one `meta.json`, one `manifest.json`
entry, one id. Cataloguing each screen separately makes a journey
unfindable as a journey, which is the only reason to have prototyped it.

```json
{
  "mode": "flow",
  "versions": 1,
  "screenCount": 2,
  "flow": {
    "screens": [
      { "id": "connect-source", "file": "concept-flow-01-connect-source.html", "title": "Connect source" },
      { "id": "review-results", "file": "concept-flow-02-review-results.html", "title": "Review results" }
    ],
    "transitions": [
      { "from": "connect-source", "to": "review-results", "caption": "Source validated", "trigger": "Connect" }
    ]
  },
  "signoff": "draft",
  "openQuestions": []
}
```

Note `versions` is an integer here — a flow has one index artifact — where
single mode uses a `{file, notes}[]` array. Anything reading the catalog has
to branch on `mode` rather than on the shape of `versions`.

---

## Examples

### Basic Usage

```
/prototype "user profile page with avatar, name, and settings"
```

Creates: `prototypes/2026-01-22-user-profile/concept-v1.html`

### With Options

```
/prototype "dashboard with metrics cards" --options 3 --chrome sidebar
```

Creates:
- `prototypes/2026-01-22-dashboard-metrics/concept-v1.html`
- `prototypes/2026-01-22-dashboard-metrics/concept-v2.html`
- `prototypes/2026-01-22-dashboard-metrics/concept-v3.html`

### Production Spec

```
/prototype "checkout form with payment details" --fidelity spec --chrome minimal
```

Creates validated production-ready HTML using the project's own design-system presets.

### Quick Sketch

```
/prototype "settings page layout" --fidelity sketch --options 2
```

Creates wireframe-style layouts for quick exploration.

---

## Rules

### DO
- Follow fidelity rules exactly
- Use the chrome template structure
- Query Preset AI (or the adapter's `design_system_mcp`) for spec fidelity
- Save to the catalog with metadata
- Include all required files (HTML + meta.json)
- Update manifest.json with new entry

### DO NOT
- Mix fidelity levels (pick one)
- Skip the catalog (always save)
- Use arbitrary colors at concept/spec level
- Create custom component styles at spec level
- Forget to load the fidelity rules

---

## Troubleshooting

### "Prototype doesn't match design system"
- Check fidelity level (maybe you want `spec` instead of `concept`)
- At `spec` level, verify design-system MCP queries are being made, and refuse spec fidelity when no design-system MCP is reachable

### "Chrome looks wrong"
- Verify the chrome template file exists
- Check that `{{TITLE}}`, `{{CONTENT}}`, `{{PROJECT}}`, `{{DESCRIPTION}}` and — for a marketing chrome — `{{TAGLINE}}` and `{{CTA}}` are being replaced
- Check that `_tokens.css` was copied next to the HTML — an unstyled page means the stylesheet 404'd

### "Can't find prototype"
- Check `prototypes/manifest.json` for the entry
- Verify the date-based folder was created

---

## Related Files

- `fidelity/sketch-rules.md` - Wireframe constraints
- `fidelity/concept-rules.md` - Design token usage rules
- `fidelity/spec-rules.md` - Production component rules
- `fidelity/<design-system>-checklist.md` - Project-supplied doctrine fallback, where one exists (Step 6.5)
- `templates/chrome-*.html` - App shell templates
- `templates/_tokens.css` - Token contract; copy next to every output
- `templates/flow-index.html` - Storyboard index for `--mode flow`
- `templates/signoff-footer.html` - Open-questions footer (Step 6.7)

---

## Related Skills

Prototypes are the starting point for the animation pipeline. After building an interactive prototype, use `/animate` to transform it into a self-running animated demo.

### When to Animate

Consider `/animate` when your prototype has:
- 3 or more interactive phases (upload → process → result)
- Simulated user actions (button clicks, drag & drop, form input)
- Content that benefits from guided reveal (stagger, typewriter, progress)

### Quick Reference

| Goal | Command |
|------|---------|
| Marketing demo (cinematic) | `/animate <path> --personality cinematic` |
| Onboarding tutorial (gentle) | `/animate <path> --personality neutral-light` |
| Internal review (fast) | `/animate <path>` |
| Full distribution kit | `/animate <path> --mode capture --kit` |
| Quality evaluation | `@maya animate review <path>` |

See `docs/process/prototype-animation-pipeline.md` for the full end-to-end workflow.
