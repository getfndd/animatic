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
  --chrome none|minimal|sidebar|full (default: minimal)
  --options 1|2|3 (default: 1)
  --name string (auto-generated from description)
```

### Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `description` | string | required | What to prototype |
| `--fidelity` | `sketch`, `concept`, `spec` | `concept` | Design system adherence level |
| `--chrome` | `none`, `minimal`, `sidebar`, `full` | `minimal` | App shell to include |
| `--options` | `1`, `2`, `3` | `1` | Number of variations |
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

### 4. Load Chrome Template

Read the appropriate template:
- `none`: `${CLAUDE_SKILL_DIR}/templates/chrome-none.html`
- `minimal`: `${CLAUDE_SKILL_DIR}/templates/chrome-minimal.html`
- `sidebar`: `${CLAUDE_SKILL_DIR}/templates/chrome-sidebar.html`
- `full`: `${CLAUDE_SKILL_DIR}/templates/chrome-full.html`

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
6. If options > 1, create variations exploring different approaches

### 7. Save to Catalog

Save files to `prototypes/`:

```
prototypes/
├── manifest.json                    # Update with new entry
└── {date}-{name}/
    ├── {fidelity}-v1.html           # First variation
    ├── {fidelity}-v2.html           # Second (if options >= 2)
    ├── {fidelity}-v3.html           # Third (if options == 3)
    └── meta.json                    # Metadata
```

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
- Check that `{{TITLE}}`, `{{CONTENT}}`, and `{{PROJECT}}` are being replaced

### "Can't find prototype"
- Check `prototypes/manifest.json` for the entry
- Verify the date-based folder was created

---

## Related Files

- `fidelity/sketch-rules.md` - Wireframe constraints
- `fidelity/concept-rules.md` - Design token usage rules
- `fidelity/spec-rules.md` - Production component rules
- `templates/chrome-*.html` - App shell templates

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
| Marketing demo (cinematic) | `/animate <path> --theme cinematic-dark` |
| Onboarding tutorial (gentle) | `/animate <path> --theme neutral-light` |
| Internal review (fast) | `/animate <path>` |
| Full distribution kit | `/animate <path> --mode capture --kit` |
| Quality evaluation | `@maya animate review <path>` |

See `docs/process/prototype-animation-pipeline.md` for the full end-to-end workflow.
