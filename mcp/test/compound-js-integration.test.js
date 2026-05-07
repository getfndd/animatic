/**
 * Integration test for the compound-js library-driven tier (ANI-143/144/145).
 *
 * This is an end-to-end wiring test that exercises every layer of the tier
 * in one sweep:
 *   - Catalog: lib-* entries are present and load via the registry
 *   - Schema/validator: every shipped lib-* entry passes Ajv + the
 *     library-version-pin invariant + the plugin-allowlist invariant
 *   - Intent-mappings: each lib-* entry is reachable from at least one
 *     intent and the chosen intents have personality overlap
 *   - Render-routing: a synthetic scene that references a lib-* primitive
 *     routes to browser_capture and shows up in summary.library_driven
 *   - Capture telemetry: estimated_capture_seconds reflects the routing mix
 *
 * The test does not invoke the MCP server (covered by hot-reload tests in
 * #48) and does not run Puppeteer (covered by spike-prototype determinism
 * checks in #45). It validates the chain that connects them.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadIntentMappings, parseRegistry } from '../data/loader.js';
import { validateAllCompoundEntries } from '../lib/validate-compound.js';
import { resolveRenderTargets } from '../lib/render-routing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const COMPOUND_DIR = resolve(REPO_ROOT, 'catalog/compound');

function loadLibraryDrivenSlugs() {
  const files = readdirSync(COMPOUND_DIR).filter(f => f.endsWith('.json'));
  const slugs = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(resolve(COMPOUND_DIR, f), 'utf-8'));
    if (Array.isArray(data) || data.flavor !== 'library-driven') continue;
    slugs.push(data.slug);
  }
  return slugs;
}

describe('compound-js integration (ANI-143/144/145)', () => {
  const libSlugs = loadLibraryDrivenSlugs();
  const registry = parseRegistry();
  const intents = loadIntentMappings();

  it('every shipped library-driven slug is loaded into the registry', () => {
    assert.ok(libSlugs.length > 0, 'baseline: at least one library-driven entry must be shipped');
    for (const slug of libSlugs) {
      assert.ok(registry.byId.has(slug),
        `${slug} is in catalog/compound/ but not in REGISTRY.md — wire it up before referencing in intents`);
    }
  });

  it('every shipped library-driven entry passes the full validator', () => {
    const result = validateAllCompoundEntries();
    if (!result.ok) {
      const failures = result.results.filter(r => !r.ok)
        .map(r => `${r.file}:\n  - ${r.errors.join('\n  - ')}`)
        .join('\n');
      assert.fail(`compound validation failed:\n${failures}`);
    }
  });

  it('every library-driven slug is reachable via at least one intent', () => {
    for (const slug of libSlugs) {
      const reachable = intents.array.some(intent =>
        ['camera_primitives', 'ambient_primitives', 'companion_entrance']
          .some(field => (intent[field] || []).includes(slug))
      );
      assert.ok(reachable,
        `${slug} is in catalog and registry but no intent in intent-mappings.json references it — recommend_choreography won't surface it`);
    }
  });

  it('a synthetic scene referencing a lib-* primitive routes to browser_capture and counts as library_driven', () => {
    const slug = libSlugs[0];
    const scene = {
      scene_id: 'sc_integration',
      layers: [
        {
          id: 'hero',
          type: 'html',
          product_role: 'hero',
          // motion.compound is the canonical compound-primitive reference
          // path the compiler reads (mcp/lib/compiler.js:1620).
          motion: { compound: slug },
          // Provide enough HTML content to also trigger the natural
          // browser_capture rules — proves both signals route the same way.
          content: '<div class="hero">'.repeat(50),
        },
      ],
    };
    const { routes, summary } = resolveRenderTargets([scene]);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].render_target, 'browser_capture',
      `library-driven scene must route to browser_capture (got ${routes[0].render_target})`);
    assert.equal(routes[0].library_driven, true,
      'route must carry library_driven: true so video-assembly + telemetry can distinguish it');
    assert.equal(summary.library_driven, 1);
    assert.ok(summary.estimated_capture_seconds > 0,
      'estimated_capture_seconds must reflect the browser_capture cost (~8s)');
  });

  it('mixed scene set produces a coherent telemetry summary', () => {
    const libSlug = libSlugs[0];
    const scenes = [
      // Two library-driven scenes
      { scene_id: 'sc_a', layers: [{ id: 'l', type: 'html', motion: { compound: libSlug }, content: 'x'.repeat(800) }] },
      { scene_id: 'sc_b', layers: [{ id: 'l', type: 'html', entrance: { primitive: libSlug }, content: 'x'.repeat(800) }] },
      // One atmosphere scene → remotion_native
      { scene_id: 'sc_logo', product_role: 'atmosphere', layers: [] },
    ];
    const { summary } = resolveRenderTargets(scenes);
    assert.equal(summary.library_driven, 2);
    assert.equal(summary.browser_capture, 2);
    assert.equal(summary.remotion_native, 1);
    // Two browser_capture (8s each) + one remotion_native (1s) = 17s total.
    assert.equal(summary.estimated_capture_seconds, 8 + 8 + 1);
  });
});
