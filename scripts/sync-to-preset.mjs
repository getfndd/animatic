#!/usr/bin/env node

/**
 * Sync Animatic catalog → Preset Supabase
 *
 * Reads catalog/primitives.json and catalog/personalities.json,
 * then upserts rows into animation_primitives and motion_personalities
 * tables in the Preset Supabase database.
 *
 * Usage:
 *   node scripts/sync-to-preset.mjs            # sync
 *   node scripts/sync-to-preset.mjs --dry-run   # preview changes
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env from project root
config({ path: resolve(root, '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.PRESET_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRESET_SUPABASE_SERVICE_KEY;
const DESIGN_SYSTEM_ID = process.env.PRESET_DESIGN_SYSTEM_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !DESIGN_SYSTEM_ID) {
  console.error('Missing required environment variables:');
  if (!SUPABASE_URL) console.error('  - PRESET_SUPABASE_URL');
  if (!SUPABASE_KEY) console.error('  - PRESET_SUPABASE_SERVICE_KEY');
  if (!DESIGN_SYSTEM_ID) console.error('  - PRESET_DESIGN_SYSTEM_ID');
  console.error('\nCopy .env.example to .env and fill in the values.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Catalog loaders ─────────────────────────────────────────────────────────

function loadCatalog(filename) {
  const path = resolve(root, 'catalog', filename);
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`Failed to read ${filename}: ${err.message}`);
    process.exit(1);
  }
}

// ── Field stripping ─────────────────────────────────────────────────────────

/** Fields in catalog JSON that don't exist in the DB table */
const PRIMITIVE_EXTRA_FIELDS = ['personality_affinity', 'source'];
const PERSONALITY_EXTRA_FIELDS = [];

function stripFields(obj, fields) {
  const copy = { ...obj };
  for (const f of fields) delete copy[f];
  return copy;
}

// ── Deep comparison ─────────────────────────────────────────────────────────

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, i) => k === keysB[i] && deepEqual(a[k], b[k]));
}

/** Compare catalog entry against existing DB row, ignoring auto-managed fields */
function hasChanges(catalogRow, dbRow, ignoredDbFields) {
  const ignore = new Set([
    'id', 'design_system_id', 'layer_id', 'embedding',
    'created_at', 'updated_at',
    ...ignoredDbFields,
  ]);

  for (const [key, value] of Object.entries(catalogRow)) {
    if (ignore.has(key)) continue;
    if (!deepEqual(value, dbRow[key])) return true;
  }
  return false;
}

// ── Sync logic ──────────────────────────────────────────────────────────────

async function syncPrimitives(catalog) {
  console.log(`\n── Primitives (${catalog.length} in catalog) ──`);

  // Fetch existing rows for this design system (base layer only)
  const { data: existing, error } = await supabase
    .from('animation_primitives')
    .select('*')
    .eq('design_system_id', DESIGN_SYSTEM_ID)
    .is('layer_id', null);

  if (error) {
    console.error('Failed to fetch existing primitives:', error.message);
    return { created: 0, updated: 0, unchanged: 0, errors: 1 };
  }

  const existingBySlug = new Map(
    (existing || []).map((row) => [row.slug, row])
  );

  let created = 0, updated = 0, unchanged = 0, errors = 0;

  for (const entry of catalog) {
    const slug = entry.slug;
    const row = stripFields(entry, PRIMITIVE_EXTRA_FIELDS);
    row.design_system_id = DESIGN_SYSTEM_ID;
    row.layer_id = null;

    const existingRow = existingBySlug.get(slug);

    if (!existingRow) {
      // Insert
      if (DRY_RUN) {
        console.log(`  + INSERT  ${slug}`);
        created++;
        continue;
      }
      const { error: insertErr } = await supabase
        .from('animation_primitives')
        .insert(row);
      if (insertErr) {
        console.error(`  ! ERROR inserting ${slug}: ${insertErr.message}`);
        errors++;
      } else {
        console.log(`  + CREATED ${slug}`);
        created++;
      }
    } else if (hasChanges(row, existingRow, [])) {
      // Update
      if (DRY_RUN) {
        console.log(`  ~ UPDATE  ${slug}`);
        updated++;
        continue;
      }
      const { error: updateErr } = await supabase
        .from('animation_primitives')
        .update(row)
        .eq('id', existingRow.id);
      if (updateErr) {
        console.error(`  ! ERROR updating ${slug}: ${updateErr.message}`);
        errors++;
      } else {
        console.log(`  ~ UPDATED ${slug}`);
        updated++;
      }
    } else {
      unchanged++;
    }
  }

  return { created, updated, unchanged, errors };
}

async function syncPersonalities(catalog) {
  console.log(`\n── Personalities (${catalog.length} in catalog) ──`);

  const { data: existing, error } = await supabase
    .from('motion_personalities')
    .select('*')
    .eq('design_system_id', DESIGN_SYSTEM_ID)
    .is('layer_id', null);

  if (error) {
    console.error('Failed to fetch existing personalities:', error.message);
    return { created: 0, updated: 0, unchanged: 0, errors: 1 };
  }

  const existingBySlug = new Map(
    (existing || []).map((row) => [row.slug, row])
  );

  let created = 0, updated = 0, unchanged = 0, errors = 0;

  for (const entry of catalog) {
    const slug = entry.slug;
    const row = stripFields(entry, PERSONALITY_EXTRA_FIELDS);
    row.design_system_id = DESIGN_SYSTEM_ID;
    row.layer_id = null;

    const existingRow = existingBySlug.get(slug);

    if (!existingRow) {
      if (DRY_RUN) {
        console.log(`  + INSERT  ${slug}`);
        created++;
        continue;
      }
      const { error: insertErr } = await supabase
        .from('motion_personalities')
        .insert(row);
      if (insertErr) {
        console.error(`  ! ERROR inserting ${slug}: ${insertErr.message}`);
        errors++;
      } else {
        console.log(`  + CREATED ${slug}`);
        created++;
      }
    } else if (hasChanges(row, existingRow, [])) {
      if (DRY_RUN) {
        console.log(`  ~ UPDATE  ${slug}`);
        updated++;
        continue;
      }
      const { error: updateErr } = await supabase
        .from('motion_personalities')
        .update(row)
        .eq('id', existingRow.id);
      if (updateErr) {
        console.error(`  ! ERROR updating ${slug}: ${updateErr.message}`);
        errors++;
      } else {
        console.log(`  ~ UPDATED ${slug}`);
        updated++;
      }
    } else {
      unchanged++;
    }
  }

  return { created, updated, unchanged, errors };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== Syncing catalog to Preset ===');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Design System: ${DESIGN_SYSTEM_ID}`);

  const primitives = loadCatalog('primitives.json');
  const personalities = loadCatalog('personalities.json');

  const pResult = await syncPrimitives(primitives);
  const mResult = await syncPersonalities(personalities);

  console.log('\n── Summary ──');
  console.log(`Primitives:    ${pResult.created} created, ${pResult.updated} updated, ${pResult.unchanged} unchanged${pResult.errors ? `, ${pResult.errors} errors` : ''}`);
  console.log(`Personalities: ${mResult.created} created, ${mResult.updated} updated, ${mResult.unchanged} unchanged${mResult.errors ? `, ${mResult.errors} errors` : ''}`);

  if (DRY_RUN) {
    console.log('\n(dry run — no changes written)');
  }

  const totalErrors = pResult.errors + mResult.errors;
  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
