# Animatic

**AI cinematography pipeline for Claude Code.** Turn creative briefs into branded videos with animation personalities, 100+ motion primitives, and a complete MCP tool suite.

## What it does

```
Brief → Personality → Scenes → Choreography → Rendered Video
```

1. **Brief** — Author creative briefs from templates (`/brief`)
2. **Storyboard** — Classify assets and generate scene JSON (`/storyboard`)
3. **Sizzle** — Plan sequences, apply choreography, render video (`/sizzle`)
4. **Animate** — Transform HTML prototypes into self-running demos (`/animate`)
5. **Review** — Evaluate quality and guardrail compliance (`/review`)

## Get Started in 5 Minutes

### Option A: Clone and use directly

```bash
git clone git@github.com:getfndd/animatic.git
cd animatic
npm install

# Start the MCP server
npm run start:mcp

# Generate a prototype and animate it
/prototype "file upload wizard with drag-and-drop"
/animate prototypes/your-prototype/concept-v1.html --personality editorial
```

### Option B: Install into an existing project

```bash
# Add as git submodule
git submodule add git@github.com:getfndd/animatic.git .claude/vendor/animatic

# Install skills, hooks, and scripts
.claude/vendor/animatic/install.sh

# Update later
cd .claude/vendor/animatic && git pull origin main && cd ../../..
.claude/vendor/animatic/install.sh
```

The install script copies skills to `.claude/skills/`, hooks to `.claude/hooks/`, and scripts to `.claude/scripts/`. It never overwrites local `LEARNINGS.md` files and prints a diff summary for review.

### Option C: MCP server only

Add the Animatic MCP server to your Claude Code config for access to all 21 tools without installing skills:

```json
{
  "mcpServers": {
    "animatic": {
      "command": "node",
      "args": ["/path/to/animatic/mcp/index.js"]
    }
  }
}
```

## Animation Personalities

Personalities define *how things move* — animation behavior independent of content.

| Personality | Token Prefix | Visual Style | Best For |
|-------------|-------------|-------------|----------|
| **cinematic-dark** | `--cd-` | 3D perspective, clip-path wipes, focus-pull, spring physics | Landing pages, marketing, presentations |
| **editorial** | `--ed-` | Content-forward, crossfade transitions, slide+fade staggers | Product showcases, content tools |
| **neutral-light** | `--nl-` | Spotlight, cursor simulation, step indicators | Tutorials, onboarding, help docs |
| **montage** | `--mo-` | Hard cuts, whip-wipes, full-screen type, stat callouts | Sizzle reels, brand launches, keynotes |

Custom personalities can be defined at runtime with auto-derived guardrails and shot grammar.

## Style Packs

Style packs layer visual treatment on top of personalities:

| Pack | Personality | Effect |
|------|-------------|--------|
| prestige | editorial | Slower timing, wider spacing |
| corporate | editorial | Conservative motion, formal |
| fade | editorial | Opacity-only transitions |
| dramatic | cinematic-dark | Deeper shadows, longer holds |
| intimate | cinematic-dark | Tighter framing, softer motion |
| energy | montage | Faster cuts, more whip-wipes |
| kinetic | montage | Maximum pace, rapid sequencing |
| minimal | neutral-light | Reduced motion, essential only |

## MCP Tools (21)

### Animation Reference
| Tool | Purpose |
|------|---------|
| `search_primitives` | Find animation primitives by personality, category, or keyword |
| `get_primitive` | Get full CSS implementation for a named primitive |
| `get_personality` | Get personality config (timing, easing, camera rules) |
| `search_breakdowns` | Search animation reference breakdowns |
| `get_breakdown` | Get detailed breakdown analysis |
| `get_reference_doc` | Read animation principles, spring physics, or other reference docs |
| `get_style_pack` | Get style pack configuration |

### Choreography
| Tool | Purpose |
|------|---------|
| `recommend_choreography` | Get a camera choreography plan for a given intent |
| `validate_choreography` | Check primitives against personality guardrails |

### Scene Pipeline
| Tool | Purpose |
|------|---------|
| `analyze_scene` | Analyze a scene JSON for quality and issues |
| `generate_scenes` | Generate scene JSON from a creative brief (optional LLM enhancement) |
| `plan_sequence` | Plan a multi-scene sequence with transitions and camera (supports beat sync) |
| `evaluate_sequence` | Score a sequence manifest for production quality |
| `validate_manifest` | Validate a sequence manifest against the spec |

### Briefs & Templates
| Tool | Purpose |
|------|---------|
| `list_brief_templates` | List available creative brief templates |
| `get_brief_template` | Get a specific brief template |

### Audio
| Tool | Purpose |
|------|---------|
| `analyze_beats` | Detect beats and energy curve from a WAV file |

### Custom Personalities
| Tool | Purpose |
|------|---------|
| `create_personality` | Register a custom personality at runtime |
| `list_personalities` | List all personalities (built-in + custom) |

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/animate` | Transform HTML prototypes into self-running animated demos |
| `/brief` | Guided creative brief authoring from templates |
| `/storyboard` | Brief → classified assets → generated scene JSON |
| `/sizzle` | Scenes → evaluated, validated, rendered sizzle reel video |
| `/review` | Evaluate a sequence manifest for quality |
| `/prototype` | Generate design-system-aware HTML prototypes |

## Figma Integration

Connect Figma to the animation pipeline via the Official Figma MCP:

```bash
claude mcp add --transport http figma --scope user https://mcp.figma.com/mcp
```

**Workflow:** Figma frame → `get_design_context` → Claude generates HTML → `/animate` → capture

Designers name frames with `Phase N: Label` convention for automatic phase detection. Figma variables map to personality token overrides. See:
- `.claude/skills/animate/reference/figma-conventions.md` — Naming conventions
- `docs/process/figma-mcp-setup.md` — Full setup guide

## Team Personas

Animatic ships with a full creative team for Claude Code:

| Persona | Role | Invocation |
|---------|------|-----------|
| **Saul** | Animation Design Lead | `@saul` |
| **Maya** | UI Design Lead | `@maya` |
| **Rams** | UX Strategist | `@rams` |
| **Hicks** | Frontend Engineer | `@hicks` |
| **Steve** | Accessibility & Usability | `@steve` |
| **Eames** | Product Strategist | `@eames` |
| **Bobby** | UX Writer | `@bobby` |
| **Alan** | AI/ML Architect | `@alan` |
| **Dex** | DevOps & Documentation | `@dex` |
| **Ogilvy** | Product Marketing | `@ogilvy` |
| **Rand** | Design System Guardian | `@rand` |

## Repo Structure

```
animatic/
├── CLAUDE.md                    # Team personas, workflows, collaboration model
├── catalog/                     # JSON data (primitives, personalities, intent mappings, etc.)
├── mcp/                         # MCP server (21 tools, 4 resources)
│   ├── index.js                 # Server entry point
│   ├── lib/                     # Core engines (analyze, plan, evaluate, generate, beats, personality)
│   ├── data/                    # Data loaders
│   └── test/                    # Tests (node --test)
├── src/remotion/                # Remotion video renderer
│   ├── compositions/            # Scene + Sequence compositions
│   ├── lib.js                   # Manifest validation, layout calculation
│   └── test/                    # Renderer tests
├── .claude/
│   ├── skills/
│   │   ├── animate/             # Animation pipeline skill
│   │   │   ├── personalities/   # 4 personality engines + CSS + rules
│   │   │   └── reference/       # Principles, breakdowns, primitives registry
│   │   ├── brief/               # Creative brief authoring
│   │   ├── sizzle/              # Sizzle reel generation
│   │   ├── storyboard/          # Storyboard creation
│   │   ├── review/              # Quality evaluation
│   │   ├── prototype/           # HTML prototype generation
│   │   ├── maya/                # UI Design Lead
│   │   ├── rams/                # UX Strategist
│   │   └── dex/                 # DevOps & Documentation
│   ├── hooks/                   # Git workflow hooks
│   └── scripts/                 # Skill registry updater
├── scripts/                     # Capture pipeline, sizzle runner
├── prototypes/                  # Example prototypes
├── docs/                        # Architecture, specs, process docs
│   ├── cinematography/specs/    # Scene format + sequence manifest specs
│   └── process/                 # Figma MCP setup, workflows
└── install.sh                   # Submodule installer
```

## Remotion Video Pipeline

The Remotion pipeline renders scene JSON and sequence manifests to video:

```bash
# Start Remotion Studio for preview
npm run remotion:studio

# Render a single scene
npm run remotion:render:scene

# Render a full sequence
npm run remotion:render:sequence

# Full sizzle pipeline (generate → plan → evaluate → render)
npm run sizzle -- --scenes path/to/scenes/ --style cinematic-dark
```

**Specs:**
- Default: 1920×1080, 60fps
- Camera moves: static, push_in, pull_out, pan_left, pan_right, drift
- Transitions: hard_cut (0ms), crossfade (400ms), whip_left/right/up/down (250ms)
- Layouts: single, split, grid, overlap, cascade

## Testing

```bash
npm test
```

Runs all tests via Node's built-in test runner (`node --test`) across `mcp/test/` and `src/remotion/test/`.

## License

MIT
