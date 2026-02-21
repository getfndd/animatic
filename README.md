# Animatic

**Turn static HTML into polished animated demos.**

Animatic is a free animation pipeline that transforms interactive HTML prototypes into cinematic, self-running product walkthroughs. It applies Disney's 12 animation principles and spring physics to create demos that look handcrafted — not screen-recorded.

## What it does

1. **Prototype** — Generate design-system-aware HTML prototypes with `/prototype`
2. **Animate** — Transform prototypes into self-running demos with `/animate`
3. **Capture** — Record to WebM, MP4, GIF, ProRes, or full distribution kits

## Animation Personalities

| Personality | Visual Style | Best For |
|-------------|-------------|----------|
| **Cinematic Dark** | Inky palette, 3D perspective, clip-path wipes, focus-pull entrances | Landing pages, marketing demos, presentations |
| **Editorial** | Content-forward, crossfade transitions, slide+fade staggers, content cycling | Product showcases, content tools, visual search |
| **Neutral Light** | Light UI, fade+translate transitions | Internal reviews, quick iteration |

## Quick Start

```bash
# Clone
git clone git@github.com:getfndd/animatic.git
cd animatic

# Generate a prototype
/prototype "file upload wizard with drag-and-drop"

# Animate it
/animate prototypes/2026-02-21-file-upload/concept-v1.html --theme cinematic-dark

# Capture video
/animate prototypes/2026-02-21-file-upload/autoplay-v1.html --mode capture --format all
```

## Using in Another Project

Animatic can be installed as a git submodule to bring the full animation pipeline, team personas, and development infrastructure into any project.

```bash
# Add as submodule
git submodule add git@github.com:getfndd/animatic.git .claude/vendor/animatic

# Install skills, hooks, and scripts
.claude/vendor/animatic/install.sh

# Update later
cd .claude/vendor/animatic && git pull origin main && cd ../../..
.claude/vendor/animatic/install.sh
```

The install script:
- Copies skills to `.claude/skills/`
- Copies hooks to `.claude/hooks/`
- Copies scripts to `.claude/scripts/`
- Never overwrites local `LEARNINGS.md` files
- Prints a diff summary for review

## Team Personas

Animatic ships with a full creative team for Claude Code:

| Persona | Role | Invocation |
|---------|------|-----------|
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
├── CLAUDE.md                # Team personas, workflows, collaboration model
├── .claude/
│   ├── settings.json        # Hook wiring
│   ├── hooks/               # 7 git workflow hooks
│   ├── scripts/             # Skill registry updater
│   └── skills/
│       ├── maya/            # UI Design Lead skill
│       ├── rams/            # UX Strategist skill
│       ├── dex/             # DevOps skill
│       ├── animate/         # Animation pipeline (the product)
│       └── prototype/       # Prototyping framework
├── prototypes/              # 30 example prototypes
└── docs/                    # Motion design system, pipeline docs
```

## License

MIT
