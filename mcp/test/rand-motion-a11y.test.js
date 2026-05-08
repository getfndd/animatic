/**
 * Tests for the motion/requires-reduced-motion-fallback Rand rule (ANI-138).
 *
 * Covers all three validation levels (recipe, composition, CSS), the
 * per-file disable mechanism, and the project orchestrator. The actual
 * animatic repo scan is exercised in the final block to confirm the
 * working tree passes its own rule.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RULE_ID,
  checkRecipes,
  checkComponentFile,
  checkCssFile,
  checkProject,
  formatReport,
} from '../lib/rand-motion-a11y.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

// ── Recipe-level ────────────────────────────────────────────────────────────

describe('checkRecipes (level 1)', () => {
  it('passes a recipe with full reduced_motion fallback', () => {
    const recipes = [{
      id: 'enter.fade-up',
      accessibility_fallback: {
        reduced_motion: {
          from: { opacity: 0 },
          to: { opacity: 1 },
          differentiation: 'opacity-only fade',
        },
      },
    }];
    assert.deepEqual(checkRecipes(recipes), []);
  });

  it('flags a recipe missing accessibility_fallback', () => {
    const recipes = [{ id: 'enter.fade-up' }];
    const violations = checkRecipes(recipes);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].rule, RULE_ID);
    assert.equal(violations[0].severity, 'error');
    assert.equal(violations[0].level, 'recipe');
    assert.match(violations[0].message, /enter\.fade-up/);
    assert.ok(violations[0].suggestion);
  });

  it('flags a recipe with accessibility_fallback but missing reduced_motion', () => {
    const recipes = [{
      id: 'enter.fade-up',
      accessibility_fallback: {},
    }];
    const violations = checkRecipes(recipes);
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /missing accessibility_fallback\.reduced_motion/);
  });

  it('flags reduced_motion missing differentiation', () => {
    const recipes = [{
      id: 'enter.fade-up',
      accessibility_fallback: {
        reduced_motion: {
          from: { opacity: 0 },
          to: { opacity: 1 },
          // no differentiation
        },
      },
    }];
    const violations = checkRecipes(recipes);
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /missing required field "differentiation"/);
  });

  it('rejects non-array catalog input', () => {
    const violations = checkRecipes({ id: 'wrong-shape' });
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /must be a JSON array/);
  });
});

// ── Composition-level ───────────────────────────────────────────────────────

describe('checkComponentFile (level 2)', () => {
  it('passes a file with no framer-motion import', () => {
    const src = `import { useState } from 'react';\nexport function X() { return <div />; }`;
    assert.deepEqual(checkComponentFile('src/X.tsx', src), []);
  });

  it('passes a file using useReducedMotion', () => {
    const src = `
      import { motion, useReducedMotion } from 'framer-motion';
      export function X() {
        const reduced = useReducedMotion();
        return <motion.div animate={{ y: reduced ? 0 : -20 }} />;
      }
    `;
    assert.deepEqual(checkComponentFile('src/X.tsx', src), []);
  });

  it('passes a file using useMotionRecipe', () => {
    const src = `
      import { motion } from 'framer-motion';
      import { useMotionRecipe } from '@preset/motion';
      export function X() {
        const variants = useMotionRecipe('enter.fade-up');
        return <motion.div variants={variants} />;
      }
    `;
    assert.deepEqual(checkComponentFile('src/X.tsx', src), []);
  });

  it('flags inline spring variants without awareness', () => {
    const src = `
      import { motion } from 'framer-motion';
      export function X() {
        return <motion.div animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 400 }} />;
      }
    `;
    const violations = checkComponentFile('src/X.tsx', src);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].severity, 'error');
    assert.equal(violations[0].level, 'composition');
  });

  it('flags motion/react usage (Framer Motion v11+ name)', () => {
    const src = `
      import { motion } from 'motion/react';
      export function X() { return <motion.div animate={{ x: 100 }} />; }
    `;
    const violations = checkComponentFile('src/X.tsx', src);
    assert.equal(violations.length, 1);
  });

  it('respects per-file disable comment with reason', () => {
    const src = `
      // rand-disable motion/requires-reduced-motion-fallback: decorative loading spinner
      import { motion } from 'framer-motion';
      export function Spinner() { return <motion.div animate={{ rotate: 360 }} />; }
    `;
    assert.deepEqual(checkComponentFile('src/Spinner.tsx', src), []);
  });

  it('passes a file that imports framer-motion but never uses motion components', () => {
    const src = `
      import { AnimatePresence } from 'framer-motion';
      export function X({ children }) { return <AnimatePresence>{children}</AnimatePresence>; }
    `;
    // AnimatePresence on its own isn't motion content — children carry the
    // animation; the rule defers to whoever wraps motion.* inside.
    assert.deepEqual(checkComponentFile('src/X.tsx', src), []);
  });
});

// ── CSS-level ───────────────────────────────────────────────────────────────

describe('checkCssFile (level 3)', () => {
  it('passes a CSS file with no animation', () => {
    const src = `.btn { color: red; }`;
    assert.deepEqual(checkCssFile('src/styles.css', src), []);
  });

  it('passes a CSS file with animation + prefers-reduced-motion query', () => {
    const src = `
      @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      .icon { animation: spin 1s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .icon { animation: none; }
      }
    `;
    assert.deepEqual(checkCssFile('src/styles.css', src), []);
  });

  it('warns on @keyframes without prefers-reduced-motion', () => {
    const src = `@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`;
    const violations = checkCssFile('src/styles.css', src);
    assert.equal(violations.length, 1);
    assert.equal(violations[0].severity, 'warning');
    assert.equal(violations[0].level, 'css');
    assert.match(violations[0].message, /@keyframes/);
  });

  it('warns on animation: declaration without prefers-reduced-motion', () => {
    const src = `.icon { animation: spin 1s linear; }`;
    const violations = checkCssFile('src/styles.css', src);
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /animation: declaration/);
  });

  it('respects /* rand-disable */ comment on CSS files', () => {
    const src = `
      /* rand-disable motion/requires-reduced-motion-fallback: keyframe library consumed elsewhere */
      @keyframes float { 0% { transform: translateY(0); } 100% { transform: translateY(-10px); } }
    `;
    assert.deepEqual(checkCssFile('src/lib.css', src), []);
  });
});

// ── Project orchestrator ────────────────────────────────────────────────────

describe('checkProject', () => {
  function makeTmpProject() {
    const root = mkdtempSync(join(tmpdir(), 'rand-a11y-'));
    return root;
  }

  it('returns ok=true for a project with no relevant files', () => {
    const root = makeTmpProject();
    try {
      const report = checkProject({ root, componentDirs: ['src'], cssDirs: ['src'] });
      assert.equal(report.ok, true);
      assert.equal(report.violations.length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('catches a recipe-level violation in catalog/motion-recipes.json', () => {
    const root = makeTmpProject();
    try {
      mkdirSync(join(root, 'catalog'));
      writeFileSync(join(root, 'catalog/motion-recipes.json'), JSON.stringify([
        { id: 'enter.fade-up' }, // missing accessibility_fallback
      ]));
      const report = checkProject({ root, componentDirs: [], cssDirs: [] });
      assert.equal(report.ok, false);
      assert.equal(report.violations.length, 1);
      assert.equal(report.violations[0].level, 'recipe');
      assert.equal(report.summary.errors, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('catches a composition-level violation', () => {
    const root = makeTmpProject();
    try {
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'src/Card.tsx'), `
        import { motion } from 'framer-motion';
        export function Card() { return <motion.div animate={{ y: 0 }} />; }
      `);
      const report = checkProject({ root, componentDirs: ['src'], cssDirs: [] });
      assert.equal(report.ok, false);
      const composition = report.violations.find(v => v.level === 'composition');
      assert.ok(composition);
      assert.equal(composition.severity, 'error');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('warns on CSS-level violation but stays ok=true (warnings do not block)', () => {
    const root = makeTmpProject();
    try {
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'src/styles.css'), `@keyframes pulse { 0% { opacity: 1; } 100% { opacity: 0.5; } }`);
      const report = checkProject({ root, componentDirs: [], cssDirs: ['src'] });
      assert.equal(report.ok, true);
      assert.equal(report.summary.warnings, 1);
      assert.equal(report.summary.errors, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records disabled files with their reason', () => {
    const root = makeTmpProject();
    try {
      mkdirSync(join(root, 'src'));
      writeFileSync(join(root, 'src/Spinner.tsx'), `
        // rand-disable motion/requires-reduced-motion-fallback: decorative spinner
        import { motion } from 'framer-motion';
        export function Spinner() { return <motion.div animate={{ rotate: 360 }} />; }
      `);
      const report = checkProject({ root, componentDirs: ['src'], cssDirs: [] });
      assert.equal(report.ok, true);
      assert.equal(report.disabled.length, 1);
      assert.match(report.disabled[0].reason, /decorative spinner/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('formatReport produces a readable string', () => {
    const root = makeTmpProject();
    try {
      mkdirSync(join(root, 'catalog'));
      writeFileSync(join(root, 'catalog/motion-recipes.json'), JSON.stringify([
        { id: 'enter.fade-up' },
      ]));
      const report = checkProject({ root, componentDirs: [], cssDirs: [] });
      const text = formatReport(report);
      assert.match(text, /Status: FAIL/);
      assert.match(text, /enter\.fade-up/);
      assert.match(text, /Fix:/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ── Self-check: the animatic repo passes its own rule ────────────────────

describe('animatic repo passes the rule', () => {
  it('checkProject(REPO_ROOT) returns ok=true', () => {
    const report = checkProject({ root: REPO_ROOT });
    if (!report.ok) {
      console.error(formatReport(report));
    }
    assert.equal(report.ok, true,
      `${report.summary.errors} blocking violation(s) — see stdout for the formatted report`);
  });
});
