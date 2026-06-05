/**
 * Registration parity tests (PRE-1439).
 *
 * Guards the dual-surface registration seam:
 *   A. The stdio tool surface is byte-for-byte identical to the pre-refactor
 *      snapshot (checked-in golden) — no tool name or schema moved.
 *   B. The edge surface (exclude: EDGE_EXCLUDE) exposes exactly 60 tools and
 *      strips each tool's edgeStripParams() from its advertised input schema.
 *   C. The handler map covers the tool-groups universe exactly (no drift) and
 *      the CallTool dispatch routes every tool to the same handler the old
 *      switch did (sampled fixture calls, incl. the stripParams tools).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerTools, HANDLERS } from '../tools-registry.js';
import { TOOL_GROUPS, EDGE_EXCLUDE, edgeStripParams } from '../tool-groups.js';

import { loadIntentMappings, loadBriefTemplates, listReferenceDocs } from '../data/loader.js';
import { STYLE_PACKS } from '../lib/planner.js';
import { ART_DIRECTION_SLUGS } from '../lib/art-direction.js';
import { COMPOSITING_PASS_SLUGS } from '../lib/compositing.js';
import { buildTools } from '../tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Build the tool list exactly as index.js does.
function buildAllTools() {
  return buildTools({
    STYLE_PACKS,
    intentMappings: loadIntentMappings(),
    briefTemplatesCatalog: loadBriefTemplates(),
    ART_DIRECTION_SLUGS,
    COMPOSITING_PASS_SLUGS,
    listReferenceDocs,
  });
}

// Minimal mock server that captures the two registered handlers.
function mockServer() {
  const captured = {};
  return {
    setRequestHandler(_schema, fn) {
      // First registration is ListTools, second is CallTool (registerTools order).
      if (!captured.list) captured.list = fn;
      else captured.call = fn;
    },
    captured,
  };
}

// ── A. stdio surface byte-for-byte ────────────────────────────────────────────

describe('PRE-1439 acceptance A — stdio surface unchanged', () => {
  it('registered stdio tools/list equals the checked-in golden snapshot', async () => {
    const golden = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/tools-list.golden.json'), 'utf-8'));
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: [], stripParams: false });
    const { tools } = await srv.captured.list();
    assert.equal(tools.length, 78);
    assert.deepEqual(tools, golden, 'stdio tool surface drifted from the pre-refactor golden snapshot');
  });
});

// ── B. edge surface correctness ───────────────────────────────────────────────

describe('PRE-1439 acceptance B — edge surface', () => {
  it('exposes exactly 60 tools and excludes EDGE_EXCLUDE', async () => {
    const srv = mockServer();
    const { names } = registerTools(srv, { tools: buildAllTools(), exclude: EDGE_EXCLUDE });
    assert.equal(names.length, 60);
    for (const n of EDGE_EXCLUDE) assert.ok(!names.includes(n), `edge surface must not expose ${n}`);
  });

  it('analyze_beats is edge-excluded — it reads a local audio_path (ANI-160)', async () => {
    assert.ok(EDGE_EXCLUDE.includes('analyze_beats'), 'analyze_beats must be in EDGE_EXCLUDE');
    const srv = mockServer();
    const { names } = registerTools(srv, { tools: buildAllTools(), exclude: EDGE_EXCLUDE });
    assert.ok(!names.includes('analyze_beats'), 'analyze_beats must not be exposed on the edge surface');
  });

  it('strips edgeStripParams() from exposed tool schemas', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: EDGE_EXCLUDE });
    const { tools } = await srv.captured.list();
    const byName = Object.fromEntries(tools.map(t => [t.name, t]));

    for (const tool of ['generate_contact_sheet', 'compare_project_versions', 'assemble_video_sequence']) {
      const strip = edgeStripParams(tool);
      assert.ok(strip.length > 0, `${tool} should declare stripParams`);
      const props = byName[tool].inputSchema.properties;
      for (const p of strip) {
        assert.ok(!(p in props), `${tool}: edge schema must not contain stripped param ${p}`);
        assert.ok(!(byName[tool].inputSchema.required || []).includes(p), `${tool}: ${p} must not remain required`);
      }
    }
  });

  it('stdio (stripParams:false) keeps those params', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: [], stripParams: false });
    const { tools } = await srv.captured.list();
    const cs = tools.find(t => t.name === 'generate_contact_sheet');
    assert.ok('project' in cs.inputSchema.properties, 'stdio must retain the project param');
  });

  it('edge DISPATCH strips hidden params from call args, not just the schema', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: EDGE_EXCLUDE }); // stripParams defaults true
    const orig = HANDLERS.assemble_video_sequence;
    let received;
    HANDLERS.assemble_video_sequence = (args) => { received = args; return { content: [] }; };
    try {
      await srv.captured.call({ params: { name: 'assemble_video_sequence', arguments: { manifest: { scenes: [] }, output_dir: '/tmp/should-not-reach-handler' } } });
      assert.ok(!('output_dir' in received), 'edge dispatch must strip output_dir from the actual args');
      assert.ok('manifest' in received, 'non-stripped args must still pass through');
    } finally {
      HANDLERS.assemble_video_sequence = orig;
    }
  });

  it('stdio dispatch passes stripParams-tool args through unchanged', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: [], stripParams: false });
    const orig = HANDLERS.assemble_video_sequence;
    let received;
    HANDLERS.assemble_video_sequence = (args) => { received = args; return { content: [] }; };
    try {
      await srv.captured.call({ params: { name: 'assemble_video_sequence', arguments: { manifest: { scenes: [] }, output_dir: '/tmp/ok-on-local' } } });
      assert.equal(received.output_dir, '/tmp/ok-on-local', 'stdio must honor output_dir (local disk is fine)');
    } finally {
      HANDLERS.assemble_video_sequence = orig;
    }
  });
});

// ── C. handler map / dispatch parity ──────────────────────────────────────────

describe('PRE-1439 acceptance C — handler map covers the universe, no drift', () => {
  it('HANDLERS keys equal the tool-groups universe exactly', () => {
    const handlerNames = Object.keys(HANDLERS).sort();
    const groupNames = Object.keys(TOOL_GROUPS).sort();
    assert.deepEqual(handlerNames, groupNames);
    assert.equal(handlerNames.length, 78);
  });

  it('every handler is a function', () => {
    for (const [name, fn] of Object.entries(HANDLERS)) {
      assert.equal(typeof fn, 'function', `${name} handler is not a function`);
    }
  });

  it('advertised stdio tools all have a handler', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: [], stripParams: false });
    const { tools } = await srv.captured.list();
    for (const t of tools) assert.ok(HANDLERS[t.name], `no handler for advertised tool ${t.name}`);
  });

  it('throws when the advertised tools array is missing a manifest tool (fail-closed)', () => {
    const srv = mockServer();
    const short = buildAllTools().filter(t => t.name !== 'search_primitives'); // 77, not 78
    assert.equal(short.length, 77);
    assert.throws(
      () => registerTools(srv, { tools: short, exclude: [], stripParams: false }),
      /search_primitives is in the manifest but missing from the advertised tools/,
    );
  });

  it('throws on a duplicate advertised tool name (canonical surface, fail-closed)', () => {
    const srv = mockServer();
    const all = buildAllTools();
    const dup = [...all, { ...all.find(t => t.name === 'search_primitives') }]; // 79: one name twice
    assert.throws(
      () => registerTools(srv, { tools: dup, exclude: [], stripParams: false }),
      /duplicate advertised tool search_primitives/,
    );
  });

  it('beforeCall hook fires per dispatch (stdio telemetry + hot-reload seam)', async () => {
    const srv = mockServer();
    const seen = [];
    registerTools(srv, { tools: buildAllTools(), exclude: [], stripParams: false, beforeCall: (n) => seen.push(n) });
    await srv.captured.call({ params: { name: 'search_primitives', arguments: {} } });
    assert.deepEqual(seen, ['search_primitives']);
  });

  it('unknown tool throws (matches the old switch default)', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: [], stripParams: false });
    await assert.rejects(
      () => srv.captured.call({ params: { name: 'no_such_tool', arguments: {} } }),
      /Unknown tool: no_such_tool/,
    );
  });

  it('excluded tools are unreachable on the edge dispatch', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: EDGE_EXCLUDE });
    // render_project is Tier-3 excluded
    await assert.rejects(
      () => srv.captured.call({ params: { name: 'render_project', arguments: {} } }),
      /Unknown tool: render_project/,
    );
  });

  it('dispatch routes to the same handler as a direct call (sampled fixtures)', async () => {
    const srv = mockServer();
    registerTools(srv, { tools: buildAllTools(), exclude: [], stripParams: false });

    const samples = {
      search_primitives: { personality: 'editorial' },
      get_personality: { slug: 'editorial' },
      generate_contact_sheet: { manifest: { scene_order: [] }, scenes: [] },
      compare_project_versions: { manifest_a: { scene_order: [] }, manifest_b: { scene_order: [] } },
      assemble_video_sequence: { manifest: { scenes: [] } },
      analyze_scene_comprehension: { frame_strip: { sheets: [] }, annotations: [] },
    };

    for (const [name, args] of Object.entries(samples)) {
      const viaDispatch = await srv.captured.call({ params: { name, arguments: args } });
      const direct = await HANDLERS[name](args);
      assert.deepEqual(viaDispatch, direct, `${name}: dispatch result differs from direct handler call`);
      assert.ok(viaDispatch && Array.isArray(viaDispatch.content), `${name}: handler did not return MCP content`);
    }
  });
});
