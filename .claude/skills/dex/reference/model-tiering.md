# Subagent Model Tiering Reference

Guide for selecting the right model **and effort** when spawning subagents (Task
tool / Workflow `agent()`) and when picking a session model.

---

## Governing principle

Three shifts changed how this decision is made (as of CC v2.1.197, June 2026):

1. **The cheap-strong tier is the default.** Sonnet 5 is the Claude Code default and,
   on intro pricing, is *cheaper than the Sonnet 4.6 it replaced* and near-Opus on
   coding. The question is no longer "when do I pay up for Opus" — it is **"when do I
   escalate up from a strong default."**
2. **Route by the cost of an _undetected_ error, not by task label.** Our safety net —
   typecheck, CI, the Codex review loop — catches execution errors cheaply, so the
   cheap tier is safe there. It does **not** reliably catch RLS / SECURITY DEFINER /
   auth / migration correctness (our documented "green and wrong" scar tissue — the
   Iron Law). That class escalates to Opus **regardless of label**.
3. **It is two axes: (model × effort).** Every persona already pins `effort:` in
   frontmatter (design personas `high`, `dex`/`fix-ci` `medium`) — well-calibrated to
   Opus 4.8's "start at high, don't reflexively max" guidance. The **model** axis rides
   the session default unless you pin it; `CLAUDE_CODE_SUBAGENT_MODEL` sets the fan-out
   **default** — a per-task `model=` still overrides it (e.g. Haiku for exploration).
   Pick both deliberately.

---

## Model Options

| Model | ID | Strengths | Cost Tier |
|-------|-----|-----------|-----------|
| **Fable 5** | `claude-fable-5` | Hardest *novel* reasoning / long-horizon design. Always-on thinking (minute-long turns); refusal classifier; 30-day-retention gate | Highest |
| **Opus 4.8** | `claude-opus-4-8` | Architecture, nuanced tradeoffs, security-critical correctness, novel problems | High |
| **Sonnet 5** | `claude-sonnet-5` | Strong general-purpose + near-Opus coding/agentic; the CC **default** | Medium |
| **Haiku 4.5** | `claude-haiku-4-5` | Fast search, file reading, simple analysis | Low |

> **Opus 4.8:** defaults to **high** effort; `xhigh` for the hardest coding/agentic
> tasks (don't reflexively use `max`). Fast mode available (`/fast`, 2× rate / 2.5×
> speed). 1M-context variant `claude-opus-4-8[1m]`.
> **Sonnet 5:** native 1M context; intro pricing through 2026-08-31.
> **Fable 5:** never a default or a subagent tier — a manual, per-session escalation
> only (see below). Prior docs referenced Opus 4.6 / Sonnet 4.6 — superseded.

---

## Task-to-Model Mapping

### Use Haiku (Low Cost, Fast)
- Codebase exploration (Glob, Grep, Read), file search/discovery, grep/count
- Reading and summarizing single files, quick fact lookups

```
Task(subagent_type="Explore", model="haiku", prompt="Find all files importing useTransitionPattern")
```

### Use Sonnet 5 — the default (Medium Cost, Capable)
- Code review (pattern/checklist-driven), documentation, test writing
- Refactoring within clear constraints
- **Security _scanning_** (known patterns — missing grant, raw `text-[Npx]`, forbidden primitive)
- Linear issue management
- The bulk of implementation fan-out

```
Task(subagent_type="general-purpose", model="sonnet", prompt="Review this component for a11y issues")
```

### Use Opus (High Cost, Maximum Quality)
- Architecture decisions, complex multi-file refactoring, AI prompt design
- Novel problem solving, ambiguous requirements, cross-cutting analysis
- **Security-critical _correctness_** — authoring or reviewing auth, RLS, SECURITY
  DEFINER, migrations, or billing (see carve-out)

```
Task(subagent_type="general-purpose", model="opus", prompt="Design the theme compilation pipeline")
```

### Escalate to Fable 5 (Highest Cost) — rare, manual
- **Only** open-ended, *novel*, **non-security** design where the shape isn't known yet
  (e.g. a new governance-object or subatomic-substance design pass).
- Reach for it with `/model claude-fable-5` for that session, then drop back to Opus to
  build. **Not** a subagent tier, **not** a default.
- Its safety classifier false-positives on security/cyber-adjacent content, so **never**
  point it at our auth/RLS/migration surface, and keep `fallbackModel` armed so an
  overload or decline falls back to Opus.

---

## ⚠️ Security carve-out (the "green and wrong" guard)

Split "security" by task shape — this is the one place the cheap tier is unsafe:

| Task | Model | Why |
|------|-------|-----|
| **Scan** for known-bad patterns (missing RLS grant, raw px, forbidden primitive, secret in code) | **Sonnet 5** | Pattern-matching; the safety net catches misses cheaply |
| **Author or review the _correctness_** of auth, RLS, SECURITY DEFINER, a migration, or billing | **Opus 4.8** @ high/xhigh | Adversarial correctness reasoning; CI is green-and-wrong here (cross-tenant holes, NULL with_check fallbacks, anon-RLS leaks) |

Never fan this class out on Sonnet just because it's "a review." A tenant-isolation
bug that passes CI is the most expensive kind of miss.

---

## Effort pairing (the second axis)

| Effort | Use for |
|--------|---------|
| `low` | Mechanical fan-out subagents, simple scans, latency-sensitive lookups |
| `medium` | Operational personas (`dex`, `fix-ci`), cost-sensitive routine work |
| `high` | Default for design personas and most intelligence-sensitive work |
| `xhigh` | Hardest coding/agentic tasks; adversarial verify passes |
| `max` | Rare — correctness worth any cost; prone to overthinking |

Personas set `effort:` in their own frontmatter; validate it fits the task before
overriding. Effort tunes *within* a model — raise effort before jumping a model tier.

---

## Dex Command Mapping

| Command | Model | Rationale |
|---------|-------|-----------|
| `@dex review` | Sonnet 5 routine; **Opus** for security-critical correctness | Checklist-driven; escalate auth/RLS/SECDEF/migration/billing review per carve-out |
| `@dex security check` | Sonnet 5 to **scan**; **Opus** to review a security-critical *fix* | See carve-out |
| `@dex docs check` | Haiku | File existence checks |
| `@dex repo check` | Haiku | Git commands, file checks |
| `@dex changelog check` | Sonnet 5 routine; **Opus** for a large multi-version catch-up | Big catch-ups are reasoning-dense synthesis |
| `@dex impact analysis` | Opus | Nuanced tradeoff reasoning |

---

## Enforcement (tier → knob)

The mapping above is advisory; these are the levers that make it real:

| Lever | Where | Effect |
|-------|-------|--------|
| Session model | `/model`, org default | The orchestrator seat — keep it strong (Opus) |
| `CLAUDE_CODE_SUBAGENT_MODEL` | `.claude/settings.json` → `env` | Fan-out **default** — set to `claude-sonnet-5`; a per-task `model=` still overrides (e.g. Haiku) |
| `fallbackModel` | `.claude/settings.json` | Overload/availability catch (set to `claude-opus-4-8`) |
| `Agent(model:opus)` deny | `permissions.deny` | Hard-lock: *no* Opus subagents (only if you do all security work in the main session — breaks the carve-out) |
| Per-persona `model:` / `effort:` | skill frontmatter | Pin a specific persona when spawned as a subagent |

Recommended `settings.json` additions (the file guards itself against agent edits —
apply by hand / via review):

```json
{
  "env": { "CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-5" },
  "fallbackModel": ["claude-opus-4-8"]
}
```

Do **not** add a blanket `Agent(model:opus)` deny — it would block the security
carve-out. Use the env-var default + explicit per-task Opus opt-in instead.

---

## Measurement (route on evidence, not vibes)

Illustrative tier gaps are ~100× (Haiku) → ~15× (Sonnet) → 1× (Opus) on a typical
review, but **measure the real distribution rather than guessing**:

- `/usage` — per-category breakdown (subagents, skills, plugins, per-MCP-server) over
  24h / 7d (CC v2.1.149+).
- OTEL `claude_code.tool` spans carry `model` + `agent_id`/`parent_agent_id`
  attributes (v2.1.145 / v2.1.172) — slice spend by model and by dispatching agent.

Review monthly: the biggest line is almost always execution fan-out — if it's on Opus,
that's the first thing to move to Sonnet 5.

---

## When to Override

**Always Opus (or Fable for novel non-security design) when:**
- The task is architecture, a judgment call, or novel (no established pattern)
- The output directly influences product decisions
- It touches the security-critical correctness surface (carve-out)

**Never Haiku when:**
- The task writes or edits code, requires multi-step reasoning, or needs a
  comprehensive (not just search-result) output
