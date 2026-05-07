/**
 * Compound primitive validator tests (ANI-143).
 *
 * Covers:
 *   1. Schema validates every existing entry (regression guard).
 *   2. Library-driven entries fail without their required fields.
 *   3. Version-pin check catches drift between an entry's library.version
 *      and the range declared in package.json.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateCompoundEntry,
  validateAllCompoundEntries,
  versionRangesOverlap,
} from '../lib/validate-compound.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const COMPOUND_DIR = resolve(REPO_ROOT, 'catalog/compound');

const baseLibraryDriven = () => ({
  name: 'Test Spring Stagger',
  slug: 'lib-test-spring',
  source: 'compound',
  flavor: 'library-driven',
  category: 'compound-entrance',
  description: 'A library-driven test entry used only by the validator suite.',
  personality_affinity: ['cinematic-dark'],
  when_to_use: ['Testing the schema'],
  when_to_avoid: ['Production use'],
  ai_guidance: 'This entry exists only to exercise the compound primitive validator.',
  library: { name: 'gsap', version: '^3.12.0', import: 'gsap' },
  capture_contract: { needs_adapter: true, boot_ms: 600, real_time_dependencies: [] },
  prototype_template: 'catalog/compound/templates/lib-gsap-spring-stagger.html',
});

describe('compound primitive validator — every shipped entry validates', () => {
  it('all single-object entries in catalog/compound/ pass schema + invariants', () => {
    const result = validateAllCompoundEntries();
    if (!result.ok) {
      const failures = result.results.filter(r => !r.ok)
        .map(r => `${r.file}:\n  - ${r.errors.join('\n  - ')}`)
        .join('\n');
      assert.fail(`compound validation failed:\n${failures}`);
    }
  });

  it('the two library-driven sample entries are present', () => {
    const files = readdirSync(COMPOUND_DIR);
    assert.ok(files.includes('lib-gsap-spring-stagger.json'),
      'sample GSAP entry missing — required by the spec to demonstrate the schema');
    assert.ok(files.includes('lib-framer-spring-stagger.json'),
      'sample Framer Motion entry missing — required by the spec to demonstrate the schema');
  });
});

describe('compound primitive validator — schema branching', () => {
  it('library-driven entry without library field fails', () => {
    const entry = baseLibraryDriven();
    delete entry.library;
    const { ok, errors } = validateCompoundEntry(entry);
    assert.equal(ok, false);
    assert.ok(errors.some(e => /library/i.test(e)),
      `expected an error mentioning library; got: ${errors.join(' | ')}`);
  });

  it('library-driven entry without capture_contract fails', () => {
    const entry = baseLibraryDriven();
    delete entry.capture_contract;
    const { ok, errors } = validateCompoundEntry(entry);
    assert.equal(ok, false);
    assert.ok(errors.some(e => /capture_contract/i.test(e)),
      `expected an error mentioning capture_contract; got: ${errors.join(' | ')}`);
  });

  it('library-driven entry without prototype_template fails', () => {
    const entry = baseLibraryDriven();
    delete entry.prototype_template;
    const { ok, errors } = validateCompoundEntry(entry);
    assert.equal(ok, false);
    assert.ok(errors.some(e => /prototype_template/i.test(e)),
      `expected an error mentioning prototype_template; got: ${errors.join(' | ')}`);
  });

  it('remotion-native entry (default flavor) does not need library fields', () => {
    const entry = baseLibraryDriven();
    delete entry.flavor;
    delete entry.library;
    delete entry.capture_contract;
    delete entry.prototype_template;
    const { ok } = validateCompoundEntry(entry);
    assert.equal(ok, true);
  });

  it('library.name must be in the approved enum', () => {
    const entry = baseLibraryDriven();
    entry.library.name = 'anime.js';
    const { ok, errors } = validateCompoundEntry(entry);
    assert.equal(ok, false);
    assert.ok(errors.some(e => /library\/name|enum/i.test(e)),
      `expected error mentioning enum/library.name; got: ${errors.join(' | ')}`);
  });
});

describe('compound primitive validator — version pin', () => {
  it('catches version major-version drift', () => {
    const entry = baseLibraryDriven();
    entry.library.version = '^2.0.0';
    const { ok, errors } = validateCompoundEntry(entry);
    assert.equal(ok, false);
    assert.ok(errors.some(e => /does not match the range/.test(e)),
      `expected version-mismatch error; got: ${errors.join(' | ')}`);
  });

  it('versionRangesOverlap accepts same-major ranges', () => {
    assert.equal(versionRangesOverlap('^3.12.0', '^3.15.0'), true);
    assert.equal(versionRangesOverlap('~3.12.5', '^3.15.0'), true);
    assert.equal(versionRangesOverlap('3.12.0', '^3.0.0'), true);
  });

  it('versionRangesOverlap rejects cross-major ranges', () => {
    assert.equal(versionRangesOverlap('^2.0.0', '^3.0.0'), false);
    assert.equal(versionRangesOverlap('^12.38.0', '^11.0.0'), false);
  });
});

describe('compound primitive validator — required base fields', () => {
  it('entry without slug fails', () => {
    const entry = baseLibraryDriven();
    delete entry.slug;
    const { ok, errors } = validateCompoundEntry(entry);
    assert.equal(ok, false);
    assert.ok(errors.some(e => /slug/i.test(e)));
  });

  it('slug must match the prefix-name pattern', () => {
    const entry = baseLibraryDriven();
    entry.slug = 'NotAValidSlug';
    const { ok, errors } = validateCompoundEntry(entry);
    assert.equal(ok, false);
    assert.ok(errors.some(e => /pattern|slug/i.test(e)));
  });

  it('source must be "compound"', () => {
    const entry = baseLibraryDriven();
    entry.source = 'engine';
    const { ok } = validateCompoundEntry(entry);
    assert.equal(ok, false);
  });
});

describe('compound primitive validator — prototype_template references resolve', () => {
  it('every library-driven entry points at a real file', () => {
    const files = readdirSync(COMPOUND_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(readFileSync(resolve(COMPOUND_DIR, f), 'utf-8'));
      if (Array.isArray(data) || data.flavor !== 'library-driven') continue;
      const tmplPath = resolve(REPO_ROOT, data.prototype_template);
      try {
        readFileSync(tmplPath, 'utf-8');
      } catch {
        assert.fail(`${f}: prototype_template "${data.prototype_template}" does not exist`);
      }
    }
  });
});
