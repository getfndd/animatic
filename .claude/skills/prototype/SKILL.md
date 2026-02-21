---
name: prototype
memory: project
description: Generate design-system-aware HTML prototypes with consistent fidelity and chrome options. Invoke with /prototype "what to build" to create cataloged prototypes that respect the ITO design system.
---

# /prototype - Design-System-Aware Prototyping

Generate HTML prototypes that automatically use ITO design system tokens, presets, and patterns.

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

### 2. Load Fidelity Rules

Read the appropriate rules file:
- `sketch`: Load `.claude/skills/prototype/fidelity/sketch-rules.md`
- `concept`: Load `.claude/skills/prototype/fidelity/concept-rules.md`
- `spec`: Load `.claude/skills/prototype/fidelity/spec-rules.md`

**Critical:** Follow the rules exactly. They define what colors, typography, components, and interactivity are allowed.

### 3. Load Chrome Template

Read the appropriate template:
- `none`: `.claude/skills/prototype/templates/chrome-none.html`
- `minimal`: `.claude/skills/prototype/templates/chrome-minimal.html`
- `sidebar`: `.claude/skills/prototype/templates/chrome-sidebar.html`
- `full`: `.claude/skills/prototype/templates/chrome-full.html`

### 4. Query Design System Context (spec fidelity only)

For `spec` fidelity, you MUST query the ITO Design System MCP:

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

### 5. Generate Prototype(s)

Generate HTML that:
1. Uses the chrome template structure
2. Follows fidelity rules exactly
3. Replaces `{{TITLE}}` with prototype name
4. Replaces `{{CONTENT}}` with the generated UI
5. If options > 1, create variations exploring different approaches

### 6. Save to Catalog

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

### 7. Return Summary

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

Creates validated production-ready HTML using exact ITO design system presets.

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
- Query ITO MCP for spec fidelity
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
- At `spec` level, verify ITO MCP queries are being made

### "Chrome looks wrong"
- Verify the chrome template file exists
- Check that `{{TITLE}}` and `{{CONTENT}}` are being replaced

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
