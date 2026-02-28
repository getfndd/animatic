# Development Setup

Local development guide for working with the Animatic animation pipeline.

---

## Prerequisites

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Node.js** | 18+ | Engine scripts, capture pipeline | `brew install node` or [nvm](https://github.com/nvm-sh/nvm) |
| **npm** | 9+ | Package management | Ships with Node.js |
| **Git** | 2.37+ | Version control, submodule support | `brew install git` |
| **ffmpeg** | 6+ | Video encoding (capture mode) | `brew install ffmpeg` |
| **gifski** | 1.10+ | High-quality GIF encoding | `brew install gifski` |
| **Claude Code** | Latest | AI-assisted development | [Install guide](https://docs.anthropic.com/en/docs/claude-code) |

### Optional Tools

| Tool | Purpose | When Needed |
|------|---------|-------------|
| **Puppeteer** | Headless browser for capture | `npm install` handles this |
| **Chrome/Chromium** | Capture rendering target | Puppeteer downloads its own |

---

## Getting Started

### Standalone (developing Animatic itself)

```bash
# Clone the repo
git clone git@github.com:getfndd/animatic.git
cd animatic

# Install dependencies (when package.json exists)
npm install

# Open Claude Code
claude
```

### As a Submodule (using Animatic in another project)

```bash
# Add to your project
git submodule add git@github.com:getfndd/animatic.git .claude/vendor/animatic

# Install skills, hooks, and scripts
.claude/vendor/animatic/install.sh

# Update later
cd .claude/vendor/animatic && git pull origin main && cd ../../..
.claude/vendor/animatic/install.sh
```

The install script copies skills, hooks, and scripts into your project's `.claude/` directory. It never overwrites local `LEARNINGS.md` files.

---

## Project Structure

```
animatic/
├── CLAUDE.md                  # Team personas, workflows, collaboration model
├── README.md                  # Quick start and overview
├── install.sh                 # Submodule installer
├── .claude/
│   ├── settings.json          # Hook wiring configuration
│   ├── hooks/                 # Git workflow hooks (7 scripts)
│   ├── scripts/               # Utility scripts
│   └── skills/                # Claude Code skills
│       ├── animate/           # Animation pipeline (the core product)
│       ├── prototype/         # HTML prototype generation
│       ├── maya/              # UI Design Lead persona
│       ├── rams/              # UX Strategist persona
│       └── dex/               # DevOps persona
├── docs/                      # Architecture and process documentation
│   ├── design-patterns/       # Motion design system
│   └── process/               # Pipeline workflows
└── prototypes/                # Example prototypes (dated directories)
```

---

## Workflow

### Creating a Prototype

```
/prototype "your UI concept description"
```

Generates an HTML file in `prototypes/YYYY-MM-DD-name/`. See `.claude/skills/prototype/SKILL.md` for options.

### Animating a Prototype

```
/animate prototypes/2026-02-21-file-upload/concept-v1.html --theme cinematic-dark
```

Transforms an interactive prototype into a self-running autoplay demo. See `.claude/skills/animate/SKILL.md` for themes and options.

### Capturing Video

```
/animate autoplay-v1.html --mode capture --format all
```

Records an autoplay prototype to video formats. See `docs/process/capture-guide.md` for full details.

---

## Git Workflow

All feature work uses feature branches. Never commit directly to main.

```bash
# Before starting work, check repo health
@dex repo check

# Create a feature branch
@dex branch feature/my-feature

# When ready to commit
@dex commit

# Push and create PR
@dex push
@dex pr
```

See CLAUDE.md for the full git workflow requirements.

---

## Verifying Your Setup

Run these checks to confirm everything is working:

```bash
# Check Node.js
node --version    # Should be 18+

# Check ffmpeg (needed for capture)
ffmpeg -version   # Should be 6+

# Check gifski (needed for GIF capture)
gifski --version  # Should be 1.10+

# Check git
git --version     # Should be 2.37+

# Check repo health (inside Claude Code)
@dex repo check
```

---

## Troubleshooting

### `npm install` reports missing `package.json`

The capture pipeline dependencies haven't been initialized yet. The `/animate` autoplay mode works without npm dependencies — only capture mode requires Puppeteer.

### ffmpeg not found during capture

Install via Homebrew: `brew install ffmpeg`. For full format support (AV1, HEVC), ensure your ffmpeg build includes `libsvtav1` and `videotoolbox`.

### Hooks not running

Run `@dex repo check` to verify hook wiring. Hooks are configured in `.claude/settings.json` and must be executable (`chmod +x`).

### Submodule not updating

```bash
cd .claude/vendor/animatic
git fetch origin
git checkout main
git pull origin main
cd ../../..
.claude/vendor/animatic/install.sh
```
