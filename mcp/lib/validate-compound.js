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

// Known GSAP plugin import signals. If a prototype imports any of these and
// the entry's library.plugins[] doesn't list it, the validator rejects.
// Plugins are out of scope per the ANI-143 spec — adding a new plugin
// requires its own determinism spike.
const GSAP_PLUGIN_NAMES = [
  'ScrollTrigger', 'ScrollSmoother', 'ScrollToPlugin', 'MotionPathPlugin',
  'MotionPathHelper', 'Draggable', 'Flip', 'TextPlugin', 'PixiPlugin',
  'EaselPlugin', 'Observer', 'CustomEase', 'CustomBounce', 'CustomWiggle',
  'DrawSVGPlugin', 'MorphSVGPlugin', 'Physics2DPlugin', 'PhysicsPropsPlugin',
  'GSDevTools', 'InertiaPlugin', 'SplitText',
];

const PLUGIN_PATH_PATTERN = /gsap\/(?:dist\/)?([A-Z][A-Za-z0-9]+)/g;
const PLUGIN_REGISTER_PATTERN = /gsap\.registerPlugin\s*\(\s*([^)]+)\)/g;

/**
 * Detect GSAP plugin imports in a prototype HTML string. Returns the unique
 * set of plugin names referenced. The check is conservative — it errs on the
 * side of flagging things, and the caller compares against an explicit
 * allowlist on the entry.
 */
function detectGsapPlugins(html) {
  const found = new Set();
  for (const match of html.matchAll(PLUGIN_PATH_PATTERN)) {
    const name = match[1];
    if (GSAP_PLUGIN_NAMES.includes(name)) found.add(name);
  }
  for (const match of html.matchAll(PLUGIN_REGISTER_PATTERN)) {
    for (const ident of match[1].split(',').map(s => s.trim())) {
      if (GSAP_PLUGIN_NAMES.includes(ident)) found.add(ident);
    }
  }
  return [...found];
}

/**
 * Validate one compound primitive entry against the schema and cross-file
 * invariants. Returns { ok: boolean, errors: string[], warnings: string[] }.
 * Errors block; warnings are advisory.
 */
export function validateCompoundEntry(entry) {
  const errors = [];
  const warnings = [];
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

    // Affinity over-claim lint: a library-driven primitive that lists all
    // four personalities is almost certainly mis-tagged. The library can
    // technically render in any register, but registers carry tone (montage
    // wants hard cuts; tutorial wants restraint) — declaring all four is
    // either a copy-paste mistake or a primitive too generic to be useful.
    if (Array.isArray(entry.personality_affinity) && entry.personality_affinity.length === 4) {
      warnings.push(
        `personality_affinity declares all four personalities — likely an ` +
        `over-claim. Library-driven primitives carry tonal weight (overshoot, ` +
        `spring physics, layout morph) that rarely fits every register. ` +
        `Narrow to the registers where this entry actually belongs.`
      );
    }

    // Plugin allowlist enforcement. The schema currently rejects any
    // library.plugins[] entry (empty enum), so the only way a prototype can
    // smuggle a plugin in is by importing it directly. Read the template and
    // confirm no plugin imports appear unless library.plugins[] would allow
    // them (currently always empty — explicit enum opens this in the future).
    if (entry.library.name === 'gsap' && entry.prototype_template) {
      try {
        const html = readFileSync(resolve(REPO_ROOT, entry.prototype_template), 'utf-8');
        const found = detectGsapPlugins(html);
        const allowed = new Set(entry.library.plugins || []);
        const unauthorized = found.filter(p => !allowed.has(p));
        if (unauthorized.length > 0) {
          errors.push(
            `prototype_template imports GSAP plugin(s) not declared in ` +
            `library.plugins: [${unauthorized.join(', ')}]. Plugins are out ` +
            `of scope per ANI-143 — adding one requires its own determinism ` +
            `spike before the schema enum can be widened.`
          );
        }
      } catch {
        // Missing template is caught by a separate test; silent here.
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validate every single-object compound primitive file in catalog/compound/.
 * Skips array-form files (hero-moments.json, collage-boards.json) which are
 * loaded separately and follow a different shape.
 *
 * Returns { ok, results: [{ file, ok, errors, warnings }] }. ok is true when
 * no entry has hard errors; warnings do not block.
 */
export function validateAllCompoundEntries() {
  const files = readdirSync(COMPOUND_DIR).filter(f => f.endsWith('.json'));
  const results = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(resolve(COMPOUND_DIR, f), 'utf-8'));
    if (Array.isArray(data)) continue;
    const { ok, errors, warnings } = validateCompoundEntry(data);
    results.push({ file: f, ok, errors, warnings });
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
