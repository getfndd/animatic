/**
 * Motion-recipe MCP tools (ANI-137) — lookup, search, validation, coverage.
 *
 * Pure functions over catalog/motion-recipes.json (ANI-134). The index.js
 * handlers are thin wrappers. Motion recipes are register-neutral DS motion
 * (enter.fade-up, attention.pulse, …), distinct from cinematography primitives.
 *
 * `validate_motion_token`'s rule vocabulary (raw_duration / raw_easing /
 * recipe_match) is the canonical set — the future ANI-135 source scanner is
 * meant to reuse these rule names. `audit_motion_coverage` ships a minimal
 * in-repo scanner here; ANI-135 will supersede it with the full Preset-side
 * scanner. Both are honest about that boundary in their output.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

import { loadMotionRecipes, loadCameraGuardrails } from '../data/loader.js';
import { matchesKeyword } from './recommend-layout.js';

// Fold transform-family animated properties (Framer x/y/scale/rotate, CSS
// translate*) to a single `transform` key so recipe_match compares like with
// like regardless of which notation the caller used (ANI-137 review).
const TRANSFORM_PROPS = new Set([
  'x', 'y', 'z', 'scale', 'scalex', 'scaley', 'rotate', 'rotatex', 'rotatey',
  'rotatez', 'skew', 'skewx', 'skewy', 'translate', 'translatex', 'translatey', 'translatez',
]);
function normalizeMotionProp(key) {
  const k = String(key).toLowerCase();
  return TRANSFORM_PROPS.has(k) ? 'transform' : k;
}

let _recipes = null;
let _guardrails = null;
function recipes() {
  if (!_recipes) _recipes = loadMotionRecipes();
  return _recipes;
}
function guardrails() {
  if (!_guardrails) _guardrails = loadCameraGuardrails();
  return _guardrails;
}

// Canonical token families used by the catalog (catalog/motion-recipes.json).
export const DURATION_TOKENS = ['var(--duration-quick)', 'var(--duration-moderate)', 'var(--duration-slow)'];
export const EASING_TOKENS = ['var(--ease-out-quart)', 'var(--ease-in-quart)', 'var(--ease-in-out-quart)'];

// Canonical motion-lint rule vocabulary. ANI-135's scanner reuses these names.
export const MOTION_RULES = {
  raw_duration: 'A literal duration (e.g. 0.3s) instead of a duration token.',
  raw_easing: 'A literal easing (e.g. ease-out, cubic-bezier(...)) instead of an easing token.',
  recipe_match: 'The usage matches a catalogued recipe that should be used instead.',
};

// ── get_motion_recipe ─────────────────────────────────────────────────────────

export function getMotionRecipe({ recipe_id } = {}) {
  if (!recipe_id || typeof recipe_id !== 'string') {
    return { error: 'A string `recipe_id` is required (e.g., "enter.fade-up"). Use search_motion_recipes to discover IDs.' };
  }
  const recipe = recipes().byId.get(recipe_id);
  if (!recipe) {
    return { error: `Motion recipe "${recipe_id}" not found. Available: ${recipes().array.map(r => r.id).join(', ')}` };
  }
  return { recipe };
}

// ── search_motion_recipes ─────────────────────────────────────────────────────

function isFramerOnly(recipe) {
  // A spring/framer-only recipe has no CSS-portable subset.
  return Array.isArray(recipe.runtime_scope) && !recipe.runtime_scope.includes('css-subset');
}

function personalityForbidsSpring(personality) {
  if (!personality) return false;
  const fb = guardrails().personality_boundaries?.[personality]?.forbidden_features || [];
  return fb.includes('spring_physics');
}

function tokenize(text) {
  return (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
}

/**
 * @param {{ intent?: string, personality?: string, context?: string }} args
 * @returns {{ matches: Array<{recipe_id, score, reason}>, excluded?: Array }}
 */
export function searchMotionRecipes({ intent, personality, context } = {}) {
  // Recipes are register-neutral; the only hard personality constraint we can
  // honor is the camera-guardrails spring_physics ban (montage) — spring
  // recipes are the framer-only ones. Excluded recipes are reported, not hidden.
  const dropSpring = personalityForbidsSpring(personality);
  const intentWords = tokenize(intent);
  const ctx = (context || '').toLowerCase().trim();

  const matches = [];
  const excluded = [];

  for (const r of recipes().array) {
    if (dropSpring && isFramerOnly(r)) {
      excluded.push({ recipe_id: r.id, reason: `excluded: spring/framer-only recipe, but "${personality}" forbids spring_physics` });
      continue;
    }

    const reasons = [];
    let score = 0;

    // Context: word-boundary membership in appropriate_contexts. Substring
    // matching mis-fired — "cardiac" hit "card", "buttonish" hit "button"
    // (ANI-137 review). matchesKeyword treats hyphens as boundaries, so "modal"
    // still matches "modal-body" and "card-grid" still matches "card".
    if (ctx) {
      const ctxHit = (r.appropriate_contexts || []).some(c => matchesKeyword(c, ctx) || matchesKeyword(ctx, c));
      if (ctxHit) { score += 0.5; reasons.push(`context "${ctx}" fits`); }
    }

    // Intent: keyword overlap against semantic_intent + tags + id.
    if (intentWords.length) {
      const hay = tokenize(`${r.semantic_intent} ${(r.tags || []).join(' ')} ${r.id}`);
      const hayset = new Set(hay);
      const hits = intentWords.filter(w => hayset.has(w));
      if (hits.length) {
        score += 0.5 * (hits.length / intentWords.length);
        reasons.push(`intent overlap: ${hits.join(', ')}`);
      }
    }

    // No query at all → list everything at a neutral score.
    if (!ctx && !intentWords.length) { score = 0.1; reasons.push('no query — listed for discovery'); }

    if (score > 0) {
      matches.push({ recipe_id: r.id, score: Math.round(score * 100) / 100, reason: reasons.join('; ') });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return { matches, ...(excluded.length ? { excluded } : {}) };
}

// ── validate_motion_token ─────────────────────────────────────────────────────

const RAW_DURATION_RE = /^\s*\d*\.?\d+\s*m?s\s*$/i;            // 0.3s, 300ms
const RAW_EASING_RE = /^\s*(ease|ease-in|ease-out|ease-in-out|linear|step-\w+|cubic-bezier\(.*\))\s*$/i;
const isToken = (v) => typeof v === 'string' && /^var\(--[\w-]+\)$/.test(v.trim());

/**
 * @param {{ usage?: { duration?, easing?, properties? } }} args
 * @returns {{ valid: boolean, issues: Array<{severity, rule, message}> }}
 */
export function validateMotionToken({ usage } = {}) {
  if (!usage || typeof usage !== 'object') {
    return { error: 'A `usage` object is required, e.g. { duration: "0.3s", easing: "ease-out", properties: ["opacity"] }.' };
  }

  const issues = [];
  const { duration, easing, properties } = usage;

  if (duration != null && !isToken(duration) && RAW_DURATION_RE.test(String(duration))) {
    issues.push({ severity: 'warning', rule: 'raw_duration', message: `Raw duration "${duration}" — use a token: ${DURATION_TOKENS.join(' | ')}.` });
  }
  if (easing != null && !isToken(easing) && RAW_EASING_RE.test(String(easing))) {
    issues.push({ severity: 'warning', rule: 'raw_easing', message: `Raw easing "${easing}" — use a token: ${EASING_TOKENS.join(' | ')}.` });
  }

  // recipe_match: if the animated properties line up with a recipe's token
  // keys, suggest the recipe (advisory — never invalidates).
  // Normalize incoming properties the SAME way as recipe token keys, so
  // Framer-style x/y/scale usages match transform-based recipes (ANI-137 review).
  const props = Array.isArray(properties) ? properties.map(normalizeMotionProp) : [];
  if (props.length) {
    const propSet = new Set(props);
    let best = null;
    for (const r of recipes().array) {
      const keys = new Set([
        ...Object.keys(r.tokens?.from || {}),
        ...Object.keys(r.tokens?.to || {}),
      ].map(normalizeMotionProp));
      const overlap = [...keys].filter(k => propSet.has(k)).length;
      const coverage = keys.size ? overlap / keys.size : 0;
      if (coverage === 1 && (!best || keys.size > best.size)) best = { id: r.id, size: keys.size };
    }
    if (best) {
      issues.push({ severity: 'suggestion', rule: 'recipe_match', message: `Properties match the catalogued recipe "${best.id}" — prefer it over a hand-rolled token.` });
    }
  }

  const valid = !issues.some(i => i.severity === 'warning' || i.severity === 'error');
  return { valid, issues };
}

// ── audit_motion_coverage ─────────────────────────────────────────────────────
//
// Minimal in-repo scanner. ANI-135 will supersede this with the full Preset
// scanner; the output flags that it's the minimal version.

const SCAN_EXTS = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'out']);
const MAX_FILE_BYTES = 512 * 1024;

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(resolve(dir, e.name), acc);
    } else if (e.isFile() && SCAN_EXTS.has(extname(e.name))) {
      acc.push(resolve(dir, e.name));
    }
  }
  return acc;
}

function scanFile(text) {
  // Raw durations: time literals NOT already wrapped in a token.
  const rawDurations = (text.match(/(?<!var\(--[\w-]*)\b\d*\.?\d+m?s\b/g) || [])
    .filter(m => /\d/.test(m)).length;
  // Raw easings: cubic-bezier or bare easing keywords in a transition/animation context.
  const rawEasings = (text.match(/cubic-bezier\([^)]*\)/g) || []).length
    + (text.match(/\b(?:transition|animation)(?:-timing-function)?\s*:[^;]*\b(?:ease|ease-in|ease-out|ease-in-out|linear)\b/g) || []).length;
  // Recipe adoption: token usage + useMotionRecipe() calls + .motion-* utility classes.
  const usingRecipes = (text.match(/var\(--(?:duration|ease)[\w-]*\)/g) || []).length
    + (text.match(/useMotionRecipe\s*\(/g) || []).length
    + (text.match(/\bmotion-(?:enter|exit|attention|state|route)-[\w-]+\b/g) || []).length;
  return { rawDurations, rawEasings, usingRecipes };
}

/**
 * @param {{ path?: string }} args
 * @returns {object} coverage report
 */
export function auditMotionCoverage({ path } = {}) {
  if (!path || typeof path !== 'string') {
    return { error: 'A `path` (directory or file) is required.' };
  }
  const root = resolve(path);
  let stat;
  try { stat = statSync(root); } catch { return { error: `Path not found: ${path}` }; }

  const files = stat.isDirectory() ? walk(root) : (SCAN_EXTS.has(extname(root)) ? [root] : []);

  let rawDurations = 0, rawEasings = 0, usingRecipes = 0;
  const byFile = [];
  for (const f of files) {
    let text;
    try {
      if (statSync(f).size > MAX_FILE_BYTES) continue;
      text = readFileSync(f, 'utf-8');
    } catch { continue; }
    const s = scanFile(text);
    const fileTotal = s.rawDurations + s.rawEasings + s.usingRecipes;
    if (fileTotal === 0) continue;
    rawDurations += s.rawDurations;
    rawEasings += s.rawEasings;
    usingRecipes += s.usingRecipes;
    byFile.push({ file: relative(root, f) || f, raw_durations: s.rawDurations, raw_easings: s.rawEasings, using_recipes: s.usingRecipes });
  }

  const total = rawDurations + rawEasings + usingRecipes;
  const coverage = total > 0 ? Math.round((usingRecipes / total) * 100) : 100;
  byFile.sort((a, b) => (b.raw_durations + b.raw_easings) - (a.raw_durations + a.raw_easings));

  return {
    scope: 'Minimal in-repo motion scan (ANI-137). The full source scanner is ANI-135 (Preset repo); this is a heuristic stopgap.',
    path,
    files_scanned: files.length,
    total_motion_usages: total,
    using_recipes: usingRecipes,
    raw_durations: rawDurations,
    raw_easings: rawEasings,
    coverage_percent: coverage,
    by_file: byFile.slice(0, 50),
  };
}
