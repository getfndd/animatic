/**
 * Tests that catch doc/spec/code drift before it compounds.
 *
 * Keeps four things in sync automatically:
 *  1. Tool count in README.md vs docs/cinematography/mcp-tools.md vs mcp/index.js
 *  2. Transition types in sequence-manifest.md spec vs validator in src/remotion/lib.js
 *  3. v3 component type enum in semantic-scene-format.md vs state-machines.js
 *  4. v3 component type enum in semantic-scene-format.md vs layout-constraints.js
 *
 * When these fall out of alignment, this test fails with a clear message
 * telling the author which source to update.
 *
 * Related: ANI-109, ANI-107.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STATE_MACHINES } from '../lib/state-machines.js';
import { COMPONENT_SIZE_DEFAULTS } from '../lib/layout-constraints.js';

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

  describe('v3 component types (ANI-107)', () => {
    // Pulls the `type` enum from the first ```json ... ``` block inside the
    // "Component Definition" section of semantic-scene-format.md.
    function extractV3ComponentTypes() {
      const spec = readFileSync(
        resolve(ROOT, 'docs/cinematography/specs/semantic-scene-format.md'),
        'utf-8',
      );
      const section = spec.split(/^###?\s/m).find(s => s.startsWith('Component Definition'));
      assert.ok(section, 'Could not find "Component Definition" section in spec');
      const enumMatch = section.match(/"enum":\s*\[([^\]]+)\]/);
      assert.ok(enumMatch, 'Could not parse component type enum from spec');
      return enumMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    }

    it('spec enum matches STATE_MACHINES registry', () => {
      const specTypes = extractV3ComponentTypes();
      const machineTypes = [...STATE_MACHINES.keys()];

      const specSet = new Set(specTypes);
      const machineSet = new Set(machineTypes);

      const inMachinesNotSpec = machineTypes.filter(t => !specSet.has(t));
      const inSpecNotMachines = specTypes.filter(t => !machineSet.has(t));

      assert.deepEqual(inMachinesNotSpec, [],
        `state-machines.js registers types missing from semantic-scene-format.md: ${inMachinesNotSpec.join(', ')}. ` +
        `Either add them to the spec enum or remove them from the registry.`);
      assert.deepEqual(inSpecNotMachines, [],
        `semantic-scene-format.md declares types without state machines: ${inSpecNotMachines.join(', ')}. ` +
        `Add entries to mcp/lib/state-machines.js.`);
    });

    it('spec enum matches COMPONENT_SIZE_DEFAULTS layout hints', () => {
      const specTypes = extractV3ComponentTypes();
      const sizeTypes = Object.keys(COMPONENT_SIZE_DEFAULTS);

      const specSet = new Set(specTypes);
      const sizeSet = new Set(sizeTypes);

      const inSizeNotSpec = sizeTypes.filter(t => !specSet.has(t));
      const inSpecNotSize = specTypes.filter(t => !sizeSet.has(t));

      assert.deepEqual(inSizeNotSpec, [],
        `layout-constraints.js has size hints for types not in semantic-scene-format.md: ${inSizeNotSpec.join(', ')}. ` +
        `Either add them to the spec enum or remove them from COMPONENT_SIZE_DEFAULTS.`);
      assert.deepEqual(inSpecNotSize, [],
        `semantic-scene-format.md declares types without layout hints: ${inSpecNotSize.join(', ')}. ` +
        `Add entries to mcp/lib/layout-constraints.js COMPONENT_SIZE_DEFAULTS.`);
    });

    it('spec cross-links to the adding-content-types guide (ANI-117)', () => {
      const guidePath = resolve(ROOT, 'docs/cinematography/adding-content-types.md');
      assert.ok(
        readFileSync(guidePath, 'utf-8').length > 0,
        'docs/cinematography/adding-content-types.md must exist',
      );

      const spec = readFileSync(
        resolve(ROOT, 'docs/cinematography/specs/semantic-scene-format.md'),
        'utf-8',
      );
      assert.ok(
        spec.includes('adding-content-types.md'),
        'semantic-scene-format.md must link to adding-content-types.md',
      );
    });
  });
});
