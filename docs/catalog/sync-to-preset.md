# sync-to-preset.mjs

One-way sync from local Animatic catalog files to the Preset Supabase database.

## What it does

Reads `catalog/primitives.json` and `catalog/personalities.json` from the project root, compares each entry against existing rows in Supabase, then inserts new rows or updates changed rows. Unchanged rows are skipped.

**Source of truth:** The local catalog JSON files. The script never writes back to them.

**Target tables:**

| Catalog file | Supabase table |
|---|---|
| `catalog/primitives.json` | `animation_primitives` |
| `catalog/personalities.json` | `motion_personalities` |

All rows are scoped to a single design system via `PRESET_DESIGN_SYSTEM_ID` and target the base layer (`layer_id = null`).

### Change detection

The script fetches all existing rows for the design system, then compares each catalog entry field-by-field using deep equality. Auto-managed database fields (`id`, `design_system_id`, `layer_id`, `embedding`, `created_at`, `updated_at`) are ignored during comparison. Catalog-only fields (`personality_affinity`, `source` on primitives) are stripped before upserting.

## Prerequisites

1. **Node.js** (ES module support required)
2. **Dependencies installed** -- `@supabase/supabase-js` and `dotenv` must be available. Run `npm install` if needed.
3. **Environment variables** -- Copy `.env.example` to `.env` at the project root and fill in:

| Variable | Description |
|---|---|
| `PRESET_SUPABASE_URL` | Supabase project URL (already set in `.env.example`) |
| `PRESET_SUPABASE_SERVICE_KEY` | Service-role key with write access to the target tables |
| `PRESET_DESIGN_SYSTEM_ID` | UUID of the design system to sync into |

The script exits with a clear error message if any variable is missing.

## Usage

```bash
# Preview what would change (no writes)
node scripts/sync-to-preset.mjs --dry-run

# Sync for real
node scripts/sync-to-preset.mjs
```

Always run `--dry-run` first to verify the change set before writing to production.

## Output

The script logs each action per entry:

| Prefix | Meaning |
|---|---|
| `+ CREATED` / `+ INSERT` (dry run) | New entry inserted |
| `~ UPDATED` / `~ UPDATE` (dry run) | Existing entry updated |
| `! ERROR` | Insert/update failed (with error message) |

Unchanged entries are counted silently.

A summary is printed at the end:

```
── Summary ──
Primitives:    2 created, 1 updated, 30 unchanged
Personalities: 0 created, 0 updated, 4 unchanged
```

## When to run

- **After editing catalog JSON files** -- to push local changes to the shared Supabase database.
- **After adding new primitives or personalities** -- new entries will be inserted automatically.
- **Never as part of CI** -- this is a manual, intentional operation that requires service-role credentials.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All operations succeeded (or dry run completed) |
| `1` | Missing env vars, catalog read failure, or any Supabase errors during sync |
