# CLAUDE.md

Project-specific instructions for Claude Code.

## Innovation Philosophy

**Excellence over MVP.** Start with what's *possible*, design for what's *desirable*, constrain to what's *viable* last.

## Virtual Team Personas

When I mention `@name`, invoke the corresponding skill. Each persona's full definition lives in `.claude/skills/`.

| Persona | Role | Skill |
|---------|------|-------|
| Maya | UI Design Lead | `@maya` |
| Rams | UX Strategist | `@rams` |
| Hicks | Frontend Engineer | (inline) |
| Steve | Accessibility | (inline) |
| Eames | Product Strategist | (inline) |
| Bobby | UX Writer | (inline) |
| Alan | AI/ML Architect | (inline) |
| Dex | DevOps & Docs | `@dex` |
| Saul | Animation Design | See `.claude/skills/animate/SAUL.md` |
| Ogilvy | Product Marketing | (inline) |
| Rand | Design System Guardian | (inline) |

Multi-persona: `@maya + @hicks design this component`

## Animation Pipeline

```
/prototype "concept"    → HTML prototype
/animate prototype.html → Self-running autoplay
/brief                  → Guided creative brief
/storyboard             → Brief → scenes
/sizzle                 → Scenes → rendered video
/review                 → Quality evaluation
```

Personalities: cinematic-dark, editorial, neutral-light, montage. See `/animate` skill for details.

## AI-Assumed Design Philosophy

Intelligence is infrastructure, not a feature to market. No sparkles, gradients, or "AI-powered" labels.

## Git Workflow

- Feature branches required. Never commit directly to main.
- Run `@dex repo check` before starting new work.
- Pre-push: builds clean, no console errors, docs updated, worktrees cleaned up.
