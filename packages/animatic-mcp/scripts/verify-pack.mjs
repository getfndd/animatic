#!/usr/bin/env node
/**
 * Packed-import smoke check (ANI-159).
 *
 * Statically resolves every relative import in the packed MCP server and fails
 * the pack if any target is missing — catching the ERR_MODULE_NOT_FOUND class
 * of bug (ANI-154, ANI-159) at pack time instead of on the user's first boot.
 *
 * Static on purpose: importing index.js would start the stdio server and block,
 * so we resolve the module graph by reading files, never executing them.
 *
 * Usage: node scripts/verify-pack.mjs <PKG_DIR>
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const pkgDir = process.argv[2];
if (!pkgDir) {
  console.error('verify-pack: missing PKG_DIR argument');
  process.exit(2);
}

// Collect every .js file under the packed code roots.
function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // root not present (e.g. no src/) — nothing to check
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = [...walk(join(pkgDir, 'mcp')), ...walk(join(pkgDir, 'src'))];

// Match `from '<spec>'` and bare `import '<spec>'` for relative specifiers.
const SPEC_RE = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;

const missing = [];
for (const file of files) {
  const src = readFileSync(file, 'utf-8');
  for (const m of src.matchAll(SPEC_RE)) {
    const spec = m[1];
    const target = resolve(dirname(file), spec);
    try {
      statSync(target);
    } catch {
      missing.push({ file: file.slice(pkgDir.length + 1), spec });
    }
  }
}

if (missing.length) {
  console.error('verify-pack: packed server has unresolved relative imports:');
  for (const { file, spec } of missing) console.error(`  ${file} → ${spec}`);
  console.error('Fix scripts/prepack.sh to copy the missing module(s).');
  process.exit(1);
}

console.log(`verify-pack: OK (${files.length} packed module(s), all relative imports resolve)`);
