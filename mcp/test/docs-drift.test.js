/**
 * Tests that catch doc/spec/code drift before it compounds.
 *
 * Keeps three things in sync automatically:
 *  1. Tool count in README.md vs docs/cinematography/mcp-tools.md vs mcp/index.js
 *  2. Transition types in sequence-manifest.md spec vs validator in src/remotion/lib.js
 *
 * When these fall out of alignment, this test fails with a clear message
 * telling the author which source to update.
 *
 * Related: ANI-109.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function countToolsInServer() {
  const src = readFileSync(resolve(ROOT, 'mcp/index.js'), 'utf-8');
  // Tool registrations look like: { name: 'tool_name', description: '...', ... }
  // Only count entries where the name is followed by description on the next line,
  // which excludes the server name ('animatic') and resource entries.
  const matches = [...src.matchAll(/name:\s*'([a-z_]+)',\s*\n\s*description:/g)];
  return matches.length;
}

function extractToolCountFromText(text) {
  const match = text.match(/(\d+)\s+tools/);
  return match ? parseInt(match[1], 10) : null;
}

function extractTransitionEnumFromSpec() {
  const spec = readFileSync(resolve(ROOT, 'docs/cinematography/specs/sequence-manifest.md'), 'utf-8');
  // The enum is declared inside a JSON code block in the transition $def.
  // Find the first `"enum":` that sits inside a block describing `transition`.
  const transitionSection = spec.split(/^###?\s/m).find(section =>
    section.includes('Transition Definition') || section.includes('"transition":')
  );
  if (!transitionSection) return null;
  const enumMatch = transitionSection.match(/"enum":\s*\[([^\]]+)\]/);
  if (!enumMatch) return null;
  return enumMatch[1]
    .split(',')
    .map(s => s.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function extractTransitionEnumFromValidator() {
  const lib = readFileSync(resolve(ROOT, 'src/remotion/lib.js'), 'utf-8');
  // The validator has: const validTypes = ['hard_cut', ...];
  const match = lib.match(/const\s+validTypes\s*=\s*\[([^\]]+)\]/);
  if (!match) return null;
  return match[1]
    .split(',')
    .map(s => s.trim().replace(/^'|'$/g, '').replace(/^"|"$/g, ''))
    .filter(Boolean);
}

describe('docs/spec/code drift guards (ANI-109)', () => {
  describe('tool count', () => {
    it('mcp/index.js has the expected number of registered tools', () => {
      const count = countToolsInServer();
      // If this changes intentionally, update README.md and docs/cinematography/mcp-tools.md
      // to match, then update this assertion.
      assert.equal(count, 70,
        `Expected 70 tools in mcp/index.js, got ${count}. ` +
        `Update README.md "N tools" and docs/cinematography/mcp-tools.md "N tools" to match, ` +
        `then bump this assertion.`);
    });

    it('README.md tool count matches mcp/index.js', () => {
      const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf-8');
      const readmeCount = extractToolCountFromText(readme);
      const serverCount = countToolsInServer();
      assert.equal(readmeCount, serverCount,
        `README.md says "${readmeCount} tools" but mcp/index.js has ${serverCount}. ` +
        `Update README.md to match the server.`);
    });

    it('docs/cinematography/mcp-tools.md tool count matches mcp/index.js', () => {
      const docs = readFileSync(resolve(ROOT, 'docs/cinematography/mcp-tools.md'), 'utf-8');
      const docsCount = extractToolCountFromText(docs);
      const serverCount = countToolsInServer();
      assert.equal(docsCount, serverCount,
        `docs/cinematography/mcp-tools.md says "${docsCount} tools" but mcp/index.js has ${serverCount}. ` +
        `Update the doc to match the server.`);
    });
  });

  describe('transition types', () => {
    it('sequence-manifest spec enum matches validator accepted types', () => {
      const specTypes = extractTransitionEnumFromSpec();
      const validatorTypes = extractTransitionEnumFromValidator();
      assert.ok(specTypes, 'Could not parse transition enum from spec');
      assert.ok(validatorTypes, 'Could not parse validTypes from validator');

      const specSet = new Set(specTypes);
      const validatorSet = new Set(validatorTypes);

      const inValidatorNotSpec = validatorTypes.filter(t => !specSet.has(t));
      const inSpecNotValidator = specTypes.filter(t => !validatorSet.has(t));

      assert.deepEqual(inValidatorNotSpec, [],
        `Validator accepts transition types not listed in sequence-manifest spec: ${inValidatorNotSpec.join(', ')}. ` +
        `Either add them to the spec enum or remove them from the validator.`);
      assert.deepEqual(inSpecNotValidator, [],
        `Spec declares transition types not accepted by validator: ${inSpecNotValidator.join(', ')}. ` +
        `Either add them to the validator or remove from the spec.`);
    });
  });
});
