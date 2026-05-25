#!/usr/bin/env node

/**
 * Animatic MCP Server
 *
 * Exposes the animation reference system (100+ primitives, 3 personalities,
 * 15 breakdowns, spring physics, animation principles) as structured MCP
 * tools and resources for any Claude Code project.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tool handlers and the per-call dispatch now live in handlers.js +
// tools-registry.js (PRE-1439). index.js only needs what builds the tool list,
// serves resources, and starts the stdio transport.
import { listReferenceDocs } from './data/loader.js';
import { STYLE_PACKS } from './lib/planner.js';
import { getAllPersonalitySlugs } from './lib/personality.js';
import { ART_DIRECTION_SLUGS } from './lib/art-direction.js';
import { COMPOSITING_PASS_SLUGS } from './lib/compositing.js';
import { trackBoot, trackTool } from './lib/telemetry.js';
import { buildTools } from './tools.js';
import { registerTools } from './tools-registry.js';
import {
  primitivesCatalog,
  personalitiesCatalog,
  intentMappings,
  cameraGuardrails,
  stylePacksCatalog,
  briefTemplatesCatalog,
  registry,
  breakdownIndex,
  reloadCatalogsIfStale,
} from './runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Startup data + hot reload ───────────────────────────────────────────────
//
// Catalog/registry state and the live hot-reload machinery now live in
// runtime.js so index.js (stdio) and handlers.js share the same data through
// ESM live bindings (PRE-1439). reloadCatalogsIfStale() is invoked per stdio
// CallTool via the registerTools `beforeCall` hook.

console.error(`Animatic MCP: loaded ${primitivesCatalog.array.length} engine primitives, ${registry.entries.length} registry entries, ${intentMappings.array.length} intent mappings, ${Object.keys(cameraGuardrails.primitive_amplitudes).length} guardrail amplitudes, ${breakdownIndex.length} breakdowns, ${stylePacksCatalog.array.length} style packs, ${briefTemplatesCatalog.array.length} brief templates`);

// ── Server setup ────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'animatic',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
    instructions: `This MCP server provides access to Animatic's animation reference system — 100+ named primitives, 4 animation personalities, 20 reference breakdowns, spring physics, and animation principles.

WORKFLOW FOR CHOOSING ANIMATIONS:
1. Start with the personality: cinematic-dark (dramatic demos), editorial (content-forward), neutral-light (tutorials/onboarding), or montage (sizzle reels/brand launches)
2. Use search_primitives to find candidates filtered by personality and category
3. Use get_primitive for full CSS implementation details
4. Use get_personality for timing tiers, easing curves, and recommended primitives
5. Use recommend_choreography to get a complete camera choreography plan for a given intent
6. Use validate_choreography to check a set of primitives against personality guardrails before implementing
7. Consult breakdowns (search_breakdowns → get_breakdown) for real-world choreography examples
8. Reference animation-principles or spring-physics docs for foundational guidance

PRIMITIVE SOURCES:
- "engine" = Built into the Animatic animation engine (15 primitives with full JSON catalog data)
- "research" = Extracted from cinematic techniques research (~20, CSS in registry)
- "animate.style" = Curated from Animate.css library (18, reference only)
- "breakdown" = Extracted from reference breakdown analyses (~42, CSS in registry)

PERSONALITY RULES:
- cinematic-dark: 3D perspective, blur effects, clip-path wipes, spring physics, dark palette
- editorial: No 3D, no blur entrances, opacity crossfades, content cycling, light palette
- neutral-light: No blur, no 3D, spotlight/cursor/step-indicators, tutorial-focused, light palette
- montage: No 3D, no blur, no ambient motion, hard cuts + whip-wipes, per-phase transitions, dark palette
- Never mix personality-specific primitives across personalities

TIMING HIERARCHY:
Each personality defines speed tiers (fast/medium/slow/spring). Always use the personality's timing tokens rather than arbitrary durations.`,
  }
);

// ── Resources ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'animatic://catalog/primitives',
      name: 'Engine Primitives Catalog',
      description: `Full catalog of ${primitivesCatalog.array.length} engine-built animation primitives with keyframes, CSS properties, and AI guidance`,
      mimeType: 'application/json',
    },
    {
      uri: 'animatic://catalog/personalities',
      name: 'Animation Personalities',
      description: 'All 4 animation personalities (cinematic-dark, editorial, neutral-light, montage) with timing tiers, easing curves, and characteristics',
      mimeType: 'application/json',
    },
    {
      uri: 'animatic://registry/index',
      name: 'Primitives Registry',
      description: `Master registry of ${registry.entries.length}+ named animation primitives from all sources with CSS implementations`,
      mimeType: 'text/markdown',
    },
    {
      uri: 'animatic://breakdowns/index',
      name: 'Breakdowns Index',
      description: `Index of ${breakdownIndex.length} reference animation breakdowns with personality, quality tier, and tags`,
      mimeType: 'text/markdown',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'animatic://catalog/primitives':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(primitivesCatalog.array, null, 2),
        }],
      };

    case 'animatic://catalog/personalities':
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(personalitiesCatalog.array, null, 2),
        }],
      };

    case 'animatic://registry/index':
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: readFileSync(
            resolve(ROOT, '.claude/skills/animate/reference/primitives/REGISTRY.md'),
            'utf-8'
          ),
        }],
      };

    case 'animatic://breakdowns/index':
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: readFileSync(
            resolve(ROOT, '.claude/skills/animate/reference/breakdowns/INDEX.md'),
            'utf-8'
          ),
        }],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ── Tools ───────────────────────────────────────────────────────────────────

const tools = buildTools({
  STYLE_PACKS,
  intentMappings,
  briefTemplatesCatalog,
  getAllPersonalitySlugs,
  ART_DIRECTION_SLUGS,
  COMPOSITING_PASS_SLUGS,
  listReferenceDocs,
});

// ── Tool registration ───────────────────────────────────────────────────────
//
// One registration path for stdio and (later) the Supabase edge function. Stdio
// exposes the full surface with unmodified schemas (stripParams:false); the
// per-call hook carries the stdio-only telemetry + hot-reload. The edge gateway
// (Preset repo) calls the same registerTools with { exclude: EDGE_EXCLUDE }.
registerTools(server, {
  tools,
  exclude: [],
  stripParams: false,
  beforeCall: (name) => {
    trackTool(name);
    reloadCatalogsIfStale();
  },
});

// ── Start server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  trackBoot(71);
  console.error('Animatic MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
