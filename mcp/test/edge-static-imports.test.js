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

// A static import or re-export of a relative module. Line-anchored so JSDoc
// (` * import …`) and `// import …` never match; `\b` keeps `importantPath = …`
// out; `\s*` plus optional block comments admit `import'./x.js'`,
// `import/* c */'./x.js'` and `export{}from'./x.js'`; the non-quote span admits a
// multi-line `import {\n a,\n} from './x.js'`. A dynamic `import('./x.js')` fails
// because `(` is neither a quote nor followed by `from`. Known gap: a quote
// character inside the specifier list (e.g. a comment containing an apostrophe)
// ends the span early. The corpus below pins every form this claims to handle.
const STATIC_IMPORT = /^[ \t]*(?:import|export)\b\s*(?:\/\*[\s\S]*?\*\/\s*)*(?:[^'";]*?\bfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/gm;

const specsIn = (src) => [...src.matchAll(STATIC_IMPORT)].map(m => m[1]);

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
    for (const spec of specsIn(readFileSync(file, 'utf8'))) {
      const target = resolveSpec(file, spec);
      if (!target) { unresolved.push(`${relative(REPO_ROOT, file)} -> ${spec}`); continue; }
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

describe('static import detection — construction corpus', () => {
  const MATCHES = [
    ["import { a } from './a.js';", './a.js'],
    ["import {\n  a,\n  b,\n} from '../b.js';", '../b.js'],
    ['import x, * as y from "./dq.js";', './dq.js'],
    ["export { c } from './c.js';", './c.js'],
    ["export * from './d.js';", './d.js'],
    ["import './side-effect.js';", './side-effect.js'],
    ["  import z from './indented.js';", './indented.js'],
    ["import'./no-space.js';", './no-space.js'],
    ["import/* note */'./comment.js';", './comment.js'],
    ["export{}from'./tight.js';", './tight.js'],
    ["import {a}from'./tight-import.js';", './tight-import.js'],
  ];
  const NON_MATCHES = [
    "const m = await import('./dynamic.js');",
    " * import { a } from './jsdoc.js'",
    "// import { a } from './line-comment.js'",
    "export const from = './not-an-import.js';",
    "importantPath = './not-an-import.js';",
    "import { a } from 'bare-package';",
  ];

  for (const [src, spec] of MATCHES) {
    it(`matches ${JSON.stringify(src)}`, () => assert.deepEqual(specsIn(src), [spec]));
  }
  for (const src of NON_MATCHES) {
    it(`ignores ${JSON.stringify(src)}`, () => assert.deepEqual(specsIn(src), []));
  }
});

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
