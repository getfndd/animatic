/**
 * Edge safety for the shared registration path (ANI-200 review P1).
 *
 * The hosted edge bundle is built from mcp/tools-registry.js, which imports every
 * handler before exclusions apply — so `edgeReady: false` hides a tool but does
 * NOT keep its modules out of the bundle. Node-only render/capture code must
 * therefore only ever be reached through a dynamic `import()` inside the handler
 * that needs it.
 *
 * hero-frame.test.js already guarded this, but only for lib/hero-frame.js, and
 * scene_to_lottie added a static import of the capture module to handlers.js
 * without tripping it. This walks EVERY module statically reachable from the
 * registry instead of checking one importer.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MCP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(MCP_DIR, '..');
const ENTRY = resolve(MCP_DIR, 'tools-registry.js');

/** Modules that must never be statically reachable from the registry. */
const NODE_ONLY = [
  resolve(MCP_DIR, 'lib/hero-frame-capture.js'), // node:fs/os/dns + DNS mutation at load, Remotion/Chromium
];

// Line-anchored so JSDoc (` * import …`) and dynamic `import(` never match; the
// non-quote span lets a multi-line `import {\n a,\n} from './x.js'` match.
const STATIC_IMPORT = /^[ \t]*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/gm;

function resolveSpec(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}.jsx`]) {
    if (existsSync(candidate) && /\.(m?js|jsx)$/.test(candidate)) return candidate;
  }
  return null;
}

/** BFS over relative static imports. Returns { visited, parent, unresolved }. */
function walk(entry) {
  const visited = new Set([entry]);
  const parent = new Map();
  const unresolved = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    for (const m of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const target = resolveSpec(file, m[1]);
      if (!target) { unresolved.push(`${relative(REPO_ROOT, file)} -> ${m[1]}`); continue; }
      if (visited.has(target)) continue;
      visited.add(target);
      parent.set(target, file);
      queue.push(target);
    }
  }
  return { visited, parent, unresolved };
}

function chain(parent, file) {
  const path = [file];
  while (parent.has(path[0])) path.unshift(parent.get(path[0]));
  return path.map(p => relative(REPO_ROOT, p)).join(' -> ');
}

describe('edge bundle — static import graph from tools-registry.js', () => {
  const { visited, parent, unresolved } = walk(ENTRY);

  it('the walk is not vacuous', () => {
    for (const f of NODE_ONLY) assert.ok(existsSync(f), `guarded module moved or renamed: ${relative(REPO_ROOT, f)}`);
    assert.ok(visited.has(resolve(MCP_DIR, 'handlers.js')), 'registry must reach handlers.js');
    assert.ok(visited.has(resolve(MCP_DIR, 'lib/compiler.js')), 'handlers.js must reach the compiler');
    assert.ok(visited.size > 20, `expected a real module graph, walked ${visited.size} files`);
    assert.deepEqual(unresolved, [], 'every relative static import must resolve, or the walk silently stops there');
  });

  it('reaches no Node-only capture module statically', () => {
    const leaks = NODE_ONLY.filter(f => visited.has(f)).map(f => chain(parent, f));
    assert.deepEqual(leaks, [], `Node-only module is statically reachable from the edge registry:\n${leaks.join('\n')}\nLoad it with a dynamic import() inside the handler instead.`);
  });
});
