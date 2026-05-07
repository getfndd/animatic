/**
 * Compound primitive validation (ANI-143).
 *
 * Two layers, mirroring motion-recipes:
 *   1. JSON Schema validation via Ajv — structural checks.
 *   2. Cross-file invariants the schema can't express — currently the
 *      library-version-pin check that ensures library-driven entries don't
 *      reference a version range absent from package.json.
 *
 * This module is consumed by `mcp/test/compound-validator.test.js` and is
 * available for future MCP tools that need to validate hand-authored entries.
 */

import Ajv from 'ajv';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const COMPOUND_DIR = resolve(REPO_ROOT, 'catalog/compound');
const SCHEMA_PATH = resolve(REPO_ROOT, 'catalog/compound-primitive.schema.json');
const PACKAGE_JSON = resolve(REPO_ROOT, 'package.json');

let _validator = null;

function getValidator() {
  if (_validator) return _validator;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  _validator = ajv.compile(schema);
  return _validator;
}

let _packageVersions = null;

function getPackageVersions() {
  if (_packageVersions) return _packageVersions;
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
  _packageVersions = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return _packageVersions;
}

/**
 * Validate one compound primitive entry against the schema and cross-file
 * invariants. Returns { ok: boolean, errors: string[] }. Errors are
 * human-readable strings — caller can format them however.
 */
export function validateCompoundEntry(entry) {
  const errors = [];
  const validate = getValidator();
  if (!validate(entry)) {
    for (const err of validate.errors || []) {
      errors.push(`${err.instancePath || '/'} ${err.message}`);
    }
  }

  if (entry.flavor === 'library-driven' && entry.library) {
    const installed = getPackageVersions()[entry.library.name];
    if (!installed) {
      errors.push(
        `library.name "${entry.library.name}" is not in package.json — ` +
        `library-driven primitives must reference an installed dependency`
      );
    } else if (!versionRangesOverlap(entry.library.version, installed)) {
      errors.push(
        `library.version "${entry.library.version}" does not match the range ` +
        `installed in package.json ("${installed}") — pin the entry to a range ` +
        `consistent with the installed library`
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validate every single-object compound primitive file in catalog/compound/.
 * Skips array-form files (hero-moments.json, collage-boards.json) which are
 * loaded separately and follow a different shape.
 *
 * Returns { ok, results: [{ file, ok, errors }] }.
 */
export function validateAllCompoundEntries() {
  const files = readdirSync(COMPOUND_DIR).filter(f => f.endsWith('.json'));
  const results = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(resolve(COMPOUND_DIR, f), 'utf-8'));
    if (Array.isArray(data)) continue;
    const { ok, errors } = validateCompoundEntry(data);
    results.push({ file: f, ok, errors });
  }
  return {
    ok: results.every(r => r.ok),
    results,
  };
}

/**
 * Cheap overlap check between two semver-ish ranges. Treats ^X, ~X, X.Y.Z,
 * etc. by extracting the leading number triplet and asserting major-version
 * equality. This isn't full semver — full semver would pull in a dep just to
 * compare ranges. The check exists to catch "entry pinned to gsap@^2 while
 * package.json has gsap@^3" drift, not to enforce exact ranges.
 */
export function versionRangesOverlap(a, b) {
  const majorA = extractMajor(a);
  const majorB = extractMajor(b);
  if (majorA == null || majorB == null) return false;
  return majorA === majorB;
}

function extractMajor(range) {
  const match = String(range).match(/(\d+)\.\d+/);
  return match ? Number(match[1]) : null;
}
