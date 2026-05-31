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

// Scan every code root the package ships (package.json "files"): the server
// under mcp/, the bundled remotion lib under src/, and the bin/ entrypoint.
const files = [
  ...walk(join(pkgDir, 'mcp')),
  ...walk(join(pkgDir, 'src')),
  ...walk(join(pkgDir, 'bin')),
];

// Match relative specifiers in all three import forms:
//   static:  from './x.js'        bare: import './x.js'
//   dynamic: import('./x.js')   (with optional whitespace/parens)
// Computed dynamic imports (import(someVar)) have no literal to resolve and are
// inherently unverifiable here — e.g. bin/animatic-mcp.js resolves its target
// at runtime; the wholesale mcp/*.js copy in prepack.sh is what guards it.
const SPEC_RE = /(?:\bfrom\b|\bimport\b)\s*\(?\s*['"](\.[^'"]+)['"]/g;

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
