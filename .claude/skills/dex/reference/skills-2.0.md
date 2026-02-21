# Skills 2.0 Reference

Claude Code v2.1+ introduced significant improvements to the Skills system. This documents capabilities relevant to our workflow.

---

## Hot Reload

**SKILL.md files are hot-reloaded.** Changes take effect immediately — no session restart needed.

This means:
- Editing a persona's SKILL.md updates its behavior in the current session
- Iterating on skill definitions is fast
- No need to exit and re-enter Claude Code after tweaking a skill

---

## New Frontmatter Fields

### `disable-model-invocation`

Prevents Claude from auto-invoking a skill. The skill can only be triggered by the user via `@persona` or `/skill` commands.

```yaml
---
name: dex
disable-model-invocation: true
---
```

**We use this for:** Dex — prevents auto-triggering of commit/push/merge commands which have side effects.

### `user-invocable`

When set to `false`, the skill is loaded as background knowledge. Claude can reference it contextually but users don't invoke it directly.

```yaml
---
name: cap-table-logic
user-invocable: false
---
```

**We use this for:** cap-table-logic — it's reference knowledge for equity calculations, not a user command.

### `memory`

Declares persistent memory scope. Already adopted in our skills.

```yaml
---
name: maya
memory: project
---
```

Scopes: `user` (global), `project` (per-repo), `local` (per-directory).

---

## Hooks in Frontmatter

Skills can declare hooks directly in their YAML frontmatter instead of in `settings.json`. This keeps hook logic co-located with the skill that uses it.

```yaml
---
name: rand
hooks:
  PreToolUse:
    - matcher: Edit
      command: ".claude/hooks/rand-design-check.sh"
---
```

**Potential use for us:** Rand could declare a `PreToolUse` hook on `Edit` that automatically validates design system compliance on every file edit. This would make enforcement truly automatic instead of requiring explicit `@rand check`.

**Status:** Not yet adopted. Consider when we formalize Rand's enforcement workflow.

---

## `/` Invocation

Skills can be invoked with `/skillname` slash commands in addition to `@persona` syntax. Both work:

```
@maya review this component
/maya review this component
```

---

## `Task(agent_type)` Restrictions

Skills can restrict which subagent types they can spawn:

```yaml
---
name: dex
tools:
  - Task(general-purpose)
  - Task(Explore)
  - Bash
  - Read
  - Grep
---
```

**Potential use:** Limit which agent types each persona can spawn to prevent unexpected behavior.

**Status:** Not yet adopted. Low priority until we formalize subagent patterns.

---

## Adoption Status

| Feature | Status | Used By |
|---------|--------|---------|
| Hot reload | Active (automatic) | All skills |
| `memory: project` | Adopted | All skills |
| `disable-model-invocation` | Adopted | Dex |
| `user-invocable: false` | Adopted | cap-table-logic |
| Hooks in frontmatter | Not yet adopted | Candidate: Rand |
| `/` invocation | Available | All skills |
| `Task(agent_type)` restrictions | Not yet adopted | Candidate: Dex |
