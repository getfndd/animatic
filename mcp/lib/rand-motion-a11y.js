/**
 * Rand rule: motion/requires-reduced-motion-fallback (ANI-138)
 *
 * Three validation levels for `prefers-reduced-motion` accessibility coverage.
 * The rule blocks commits that introduce motion without an accessible
 * fallback — vestibular users get no escape hatch when teams forget.
 *
 * | Level | Severity | What it catches |
 * |-------|----------|-----------------|
 * | Recipe-level (catalog/motion-recipes.json) | error | Recipe missing `accessibility_fallback.reduced_motion` |
 * | Composition-level (.tsx / .jsx) | error | Framer Motion usage with no awareness signal |
 * | CSS-level (.css) | warning | `@keyframes` or `animation:` without a `prefers-reduced-motion` query |
 *
 * The schema for motion-recipes already requires `accessibility_fallback`, so
 * recipe-level violations would also fail JSON-schema validation. This module
 * surfaces them at the same gate as the other two levels for a unified Rand
 * report — and runs fast enough to land in CI / pre-commit without ceremony.
 *
 * Disable mechanism: `// rand-disable motion/requires-reduced-motion-fallback: <reason>`
 * anywhere in a file silences all violations of this rule for that file. The
 * reason is required and logged in the report.
 *
 * Pure functions. No I/O — callers provide file contents.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

export const RULE_ID = 'motion/requires-reduced-motion-fallback';
// Matches the disable token in either JS-style `// rand-disable …` or
// CSS-style `/* rand-disable … */` comments. Captures the optional reason
// text after the colon for reporting.
const DISABLE_PATTERN = new RegExp(
  String.raw`(?:\/\/|\/\*)\s*rand-disable\s+`
  + RULE_ID.replace(/\//g, String.raw`\/`)
  + String.raw`(?::\s*([^\n*]+?))?(?:\s*\*\/|\s*$|\n)`,
  'm'
);

const ERROR = 'error';
const WARNING = 'warning';

const FRAMER_IMPORT_PATTERN = /from\s+['"](framer-motion|motion\/react)['"]/;
const MOTION_USAGE_PATTERN = /<motion\.[a-zA-Z][\w-]*[\s>]|useAnimate\s*\(|useAnimationControls\s*\(/;
const VARIANT_TRANSITION_PATTERN = /transition\s*:\s*\{[^}]*type\s*:\s*['"]spring['"]/;
const AWARENESS_PATTERNS = [
  /useReducedMotion\s*\(/,
  /useMotionRecipe\s*\(/,
  /reduced\s*:/, // explicit `reduced` variant key
  /prefers-reduced-motion/, // string in JSX/TS — somebody is reading the media query
];

const KEYFRAMES_PATTERN = /@keyframes\s+\w/;
const ANIMATION_PROP_PATTERN = /\banimation\s*:\s*[^;{}]+;/;
const REDUCED_MOTION_QUERY_PATTERN = /@media[^{]*prefers-reduced-motion/;

// ── Recipe-level ────────────────────────────────────────────────────────────

/**
 * Validate every recipe in `recipes` (parsed JSON array) for an
 * `accessibility_fallback.reduced_motion` block. Returns an array of
 * violation objects.
 */
export function checkRecipes(recipes, filePath = 'catalog/motion-recipes.json') {
  if (!Array.isArray(recipes)) {
    return [{
      rule: RULE_ID,
      severity: ERROR,
      level: 'recipe',
      file: filePath,
      message: 'Recipe catalog must be a JSON array',
    }];
  }

  const violations = [];
  for (const recipe of recipes) {
    const id = recipe?.id || '<unknown>';
    const fallback = recipe?.accessibility_fallback?.reduced_motion;
    if (!fallback) {
      violations.push({
        rule: RULE_ID,
        severity: ERROR,
        level: 'recipe',
        file: filePath,
        recipe: id,
        message: `Recipe "${id}" is missing accessibility_fallback.reduced_motion`,
        suggestion: 'For opacity+transform recipes, an opacity-only fallback is usually correct: { "from": { "opacity": 0 }, "to": { "opacity": 1 }, "differentiation": "..." }',
      });
      continue;
    }
    // Schema requires from/to/differentiation already; surface anything missing
    // at this same gate so a malformed catalog gets the same error path.
    for (const key of ['from', 'to', 'differentiation']) {
      if (fallback[key] === undefined || fallback[key] === null) {
        violations.push({
          rule: RULE_ID,
          severity: ERROR,
          level: 'recipe',
          file: filePath,
          recipe: id,
          message: `Recipe "${id}" reduced_motion fallback is missing required field "${key}"`,
        });
      }
    }
  }
  return violations;
}

// ── Composition-level (TSX / JSX / TS / JS) ─────────────────────────────────

/**
 * Inspect a component file's text for Framer Motion usage that lacks any
 * reduced-motion awareness signal. Heuristic, not AST — false positives are
 * silenced via the `// rand-disable` comment.
 */
export function checkComponentFile(filePath, content) {
  if (!content) return [];

  const disableMatch = content.match(DISABLE_PATTERN);
  if (disableMatch) {
    return []; // file disables this rule — reason captured at report time
  }

  if (!FRAMER_IMPORT_PATTERN.test(content)) return [];

  const usesMotion = MOTION_USAGE_PATTERN.test(content)
    || VARIANT_TRANSITION_PATTERN.test(content);
  if (!usesMotion) return [];

  const hasAwareness = AWARENESS_PATTERNS.some(p => p.test(content));
  if (hasAwareness) return [];

  return [{
    rule: RULE_ID,
    severity: ERROR,
    level: 'composition',
    file: filePath,
    message: `${filePath} imports framer-motion and uses motion components/variants but shows no reduced-motion awareness (no useReducedMotion, no useMotionRecipe, no "reduced" variant key)`,
    suggestion: 'Either route through `useMotionRecipe(...)` (recipe handles fallback) or import `useReducedMotion` from framer-motion and provide a `reduced` variant in your animation config.',
  }];
}

// ── CSS-level ───────────────────────────────────────────────────────────────

/**
 * Inspect a CSS file for animation declarations lacking a sibling
 * `prefers-reduced-motion` query. Warning-severity since some files
 * legitimately only define keyframes consumed elsewhere.
 */
export function checkCssFile(filePath, content) {
  if (!content) return [];

  if (DISABLE_PATTERN.test(content)) return [];

  const hasKeyframes = KEYFRAMES_PATTERN.test(content);
  const hasAnimationProp = ANIMATION_PROP_PATTERN.test(content);
  if (!hasKeyframes && !hasAnimationProp) return [];

  if (REDUCED_MOTION_QUERY_PATTERN.test(content)) return [];

  const culprit = hasAnimationProp ? 'animation: declaration' : '@keyframes';
  return [{
    rule: RULE_ID,
    severity: WARNING,
    level: 'css',
    file: filePath,
    message: `${filePath} contains ${culprit} but no @media (prefers-reduced-motion) query`,
    suggestion: 'Add a `@media (prefers-reduced-motion: reduce) { .animated { animation: none; transition: none; } }` block. If the file is a keyframe library consumed elsewhere, silence with: /* rand-disable motion/requires-reduced-motion-fallback: keyframe library */',
  }];
}

// ── Project-level orchestration ─────────────────────────────────────────────

const SKIP_DIR_NAMES = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'renders',
  'coverage', '.next', '.cache', 'public',
  // Remotion compositions render to video, not live web — prefers-reduced-motion
  // doesn't apply to baked MP4s. Keep them out of the composition scan.
  'remotion',
]);

// Files that define this rule itself. Scanning them turns up false-positive
// "disable" matches because the disable token appears in regex source and
// docstring examples. Exclude them by relative-path suffix.
const RULE_DEFINING_SUFFIXES = [
  'mcp/lib/rand-motion-a11y.js',
  'mcp/test/rand-motion-a11y.test.js',
  'scripts/rand-motion-a11y.mjs',
];

function walk(root, predicate, hits = []) {
  let entries;
  try { entries = readdirSync(root); } catch { return hits; }
  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) continue;
    const full = resolve(root, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      walk(full, predicate, hits);
    } else if (predicate(full, name)) {
      hits.push(full);
    }
  }
  return hits;
}

const COMPONENT_EXT = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.mts']);
const TEST_FILE_PATTERN = /(?:\.test\.|\.spec\.)/;

function isComponentFile(full, name) {
  if (TEST_FILE_PATTERN.test(name)) return false;
  if (full.includes('/test/') || full.includes('/__tests__/')) return false;
  if (RULE_DEFINING_SUFFIXES.some(suffix => full.endsWith(suffix))) return false;
  return COMPONENT_EXT.has(extname(name));
}

function isCssFile(_full, name) {
  return extname(name) === '.css';
}

/**
 * Run all three checks against a project root. Honors per-file
 * `// rand-disable` comments. Returns a structured report.
 *
 * @param {object} options
 * @param {string} options.root - Project root directory
 * @param {string} [options.recipesPath] - Override recipes catalog path
 * @param {string[]} [options.componentDirs] - Subdirs to scan for components
 *   (default: ['src', 'mcp', 'examples'])
 * @param {string[]} [options.cssDirs] - Subdirs to scan for CSS (default: ['src', 'public'])
 */
export function checkProject(options = {}) {
  const root = options.root || process.cwd();
  const violations = [];
  const checked = { recipes: 0, components: 0, css: 0 };
  const disabled = [];

  // Recipe-level
  const recipesPath = options.recipesPath || resolve(root, 'catalog/motion-recipes.json');
  if (existsSync(recipesPath)) {
    let recipes;
    try { recipes = JSON.parse(readFileSync(recipesPath, 'utf8')); } catch (e) {
      violations.push({
        rule: RULE_ID, severity: ERROR, level: 'recipe',
        file: relative(root, recipesPath),
        message: `Failed to parse: ${e.message}`,
      });
    }
    if (recipes) {
      checked.recipes = Array.isArray(recipes) ? recipes.length : 0;
      violations.push(...checkRecipes(recipes, relative(root, recipesPath)));
    }
  }

  // Composition-level
  const componentDirs = options.componentDirs || ['src', 'mcp'];
  for (const dir of componentDirs) {
    const full = resolve(root, dir);
    if (!existsSync(full)) continue;
    for (const file of walk(full, isComponentFile)) {
      checked.components++;
      const content = readFileSync(file, 'utf8');
      if (DISABLE_PATTERN.test(content)) {
        const m = content.match(DISABLE_PATTERN);
        disabled.push({ file: relative(root, file), reason: m?.[1]?.trim() || '(no reason given)' });
        continue;
      }
      const hits = checkComponentFile(relative(root, file), content);
      violations.push(...hits);
    }
  }

  // CSS-level
  const cssDirs = options.cssDirs || ['src', 'public'];
  for (const dir of cssDirs) {
    const full = resolve(root, dir);
    if (!existsSync(full)) continue;
    for (const file of walk(full, isCssFile)) {
      checked.css++;
      const content = readFileSync(file, 'utf8');
      if (DISABLE_PATTERN.test(content)) {
        const m = content.match(DISABLE_PATTERN);
        disabled.push({ file: relative(root, file), reason: m?.[1]?.trim() || '(no reason given)' });
        continue;
      }
      violations.push(...checkCssFile(relative(root, file), content));
    }
  }

  const errors = violations.filter(v => v.severity === ERROR);
  const warnings = violations.filter(v => v.severity === WARNING);

  return {
    rule: RULE_ID,
    ok: errors.length === 0,
    checked,
    disabled,
    violations,
    summary: {
      total: violations.length,
      errors: errors.length,
      warnings: warnings.length,
    },
  };
}

/**
 * Format a project-check report as a human-readable string. Used by the CLI
 * wrapper and could be invoked from a Rand skill response.
 */
export function formatReport(report) {
  const lines = [];
  lines.push(`Rand rule: ${report.rule}`);
  lines.push(`Status: ${report.ok ? 'PASS' : 'FAIL'}`);
  lines.push(`Checked: ${report.checked.recipes} recipes, ${report.checked.components} components, ${report.checked.css} CSS files`);
  if (report.disabled.length) {
    lines.push(`Disabled in ${report.disabled.length} file(s):`);
    for (const d of report.disabled) {
      lines.push(`  - ${d.file} — ${d.reason}`);
    }
  }
  if (report.violations.length === 0) {
    lines.push('No violations.');
    return lines.join('\n');
  }
  lines.push('');
  lines.push(`Violations (${report.summary.errors} error, ${report.summary.warnings} warning):`);
  for (const v of report.violations) {
    const sev = v.severity === ERROR ? '!!!' : '!!';
    lines.push(`  [${sev}] [${v.level}] ${v.file}${v.recipe ? ` (recipe: ${v.recipe})` : ''}`);
    lines.push(`        ${v.message}`);
    if (v.suggestion) lines.push(`        Fix: ${v.suggestion}`);
  }
  return lines.join('\n');
}
