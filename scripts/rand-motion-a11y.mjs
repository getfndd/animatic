#!/usr/bin/env node
/**
 * Rand rule CLI: motion/requires-reduced-motion-fallback (ANI-138)
 *
 * Usage:
 *   node scripts/rand-motion-a11y.mjs               # scan repo from cwd
 *   node scripts/rand-motion-a11y.mjs --root /path  # scan a different root
 *   npm run rand:motion-a11y
 *
 * Exit code 0 on pass, 1 on any error-severity violation.
 * Warnings (CSS-level) do NOT block.
 */

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';

import { checkProject, formatReport } from '../mcp/lib/rand-motion-a11y.js';

const { values } = parseArgs({
  options: {
    root: { type: 'string' },
    help: { type: 'boolean' },
  },
});

if (values.help) {
  console.log(`Usage: node scripts/rand-motion-a11y.mjs [--root <path>]

Validates the motion/requires-reduced-motion-fallback Rand rule across:
  - catalog/motion-recipes.json (recipe-level, blocking)
  - src/ + mcp/ component files (composition-level, blocking)
  - src/ + public/ CSS files (CSS-level, warning)

Per-file silence: add a comment somewhere in the file:
  // rand-disable motion/requires-reduced-motion-fallback: <reason>

Exits 1 if any blocking violation is found; 0 otherwise.`);
  process.exit(0);
}

const root = values.root ? resolve(values.root) : process.cwd();
const report = checkProject({ root });
console.log(formatReport(report));

process.exit(report.ok ? 0 : 1);
