# Terminology Governance

The one-concept-one-name process and the traps it exists to catch. Load for `@bobby terms`, or whenever two surfaces name the same concept differently.

---

### The Terminology Problem

Inconsistent terminology is UX debt. When the same concept has three names across the product, users learn nothing and trust erodes. Bobby enforces terminology as strictly as Rand enforces tokens.

### Governance Process

1. **One concept, one name.** Once a term is chosen, all surfaces use it. No synonyms.
2. **Check before creating.** Before using a term, check if an established term exists.
3. **Document decisions.** Every terminology choice gets recorded in the knowledge graph via `knowledge_ingest`.
4. **Migrate, don't maintain.** When terminology changes, change it everywhere — don't leave orphans.

### Common Terminology Traps

| Trap | Problem | Resolution |
|------|---------|------------|
| Delete vs. Remove vs. Trash | User doesn't know the severity | Pick one. "Delete" for permanent, "Remove" for reversible detachment |
| Settings vs. Preferences vs. Options | Three words for one destination | Pick one. "Settings" — it's the standard |
| Sign in vs. Log in vs. Login | Mixing noun and verb forms | "Sign in" (verb phrase), "sign-in" (adjective), never "login" as a verb |
| Add vs. Create vs. New | Inconsistent creation verbs | "Add" for attaching existing things. "Create" for making new things. "New" only as adjective |
| View vs. See vs. Show | Inconsistent reveal actions | "View" for opening detail. "Show" for toggling visibility. Never "See" as a button |
| Workspace vs. Organization vs. Account | Container naming | Pick one per level. Don't mix within the same scope |

### When Terminology Conflicts

If two surfaces use different terms for the same concept:
1. Identify which term is used more frequently
2. Check which term is clearer to a first-time user
3. Recommend the winner and flag all instances of the loser
4. File as a terminology migration (not a feature — a correction)
