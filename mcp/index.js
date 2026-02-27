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
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  parseRegistry,
  parseBreakdownIndex,
  readBreakdown,
  readReferenceDoc,
  listReferenceDocs,
} from './data/loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load data at startup ────────────────────────────────────────────────────

const primitivesCatalog = loadPrimitivesCatalog();
const personalitiesCatalog = loadPersonalitiesCatalog();
const registry = parseRegistry();
const breakdownIndex = parseBreakdownIndex();

console.error(`Animatic MCP: loaded ${primitivesCatalog.array.length} engine primitives, ${registry.entries.length} registry entries, ${breakdownIndex.length} breakdowns`);

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
    instructions: `This MCP server provides access to Animatic's animation reference system — 100+ named primitives, 3 animation personalities, 15 reference breakdowns, spring physics, and animation principles.

WORKFLOW FOR CHOOSING ANIMATIONS:
1. Start with the personality: cinematic-dark (dramatic demos), editorial (content-forward), or neutral-light (tutorials/onboarding)
2. Use search_primitives to find candidates filtered by personality and category
3. Use get_primitive for full CSS implementation details
4. Use get_personality for timing tiers, easing curves, and recommended primitives
5. Consult breakdowns (search_breakdowns → get_breakdown) for real-world choreography examples
6. Reference animation-principles or spring-physics docs for foundational guidance

PRIMITIVE SOURCES:
- "engine" = Built into the Animatic animation engine (15 primitives with full JSON catalog data)
- "research" = Extracted from cinematic techniques research (~20, CSS in registry)
- "animate.style" = Curated from Animate.css library (18, reference only)
- "breakdown" = Extracted from reference breakdown analyses (~42, CSS in registry)

PERSONALITY RULES:
- cinematic-dark: 3D perspective, blur effects, clip-path wipes, spring physics, dark palette
- editorial: No 3D, no blur entrances, opacity crossfades, content cycling, light palette
- neutral-light: No blur, no 3D, spotlight/cursor/step-indicators, tutorial-focused, light palette
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
      description: 'All 3 animation personalities (cinematic-dark, editorial, neutral-light) with timing tiers, easing curves, and characteristics',
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

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_primitives',
      description:
        'Search animation primitives across all sources (engine, research, animate.style, breakdowns). Filter by name, personality, category, or source. Returns matching primitives with ID, name, duration, personality affinity, source, and category.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term to match against primitive name or ID (case-insensitive)',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'universal'],
            description: 'Filter by personality affinity',
          },
          category: {
            type: 'string',
            description: 'Filter by category (e.g., Entrances, Exits, Reveals / Staggers, Continuous / Ambient, Content Effects, Interactions, Transitions, Typography, Attention Seekers)',
          },
          source: {
            type: 'string',
            enum: ['engine', 'research', 'animate.style', 'breakdown'],
            description: 'Filter by primitive source',
          },
        },
      },
    },
    {
      name: 'get_primitive',
      description:
        'Get full details for a single animation primitive by ID. Returns catalog data (if engine primitive) plus CSS implementation from the registry. Use search_primitives first to find the ID.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Primitive ID (e.g., cd-focus-stagger, ct-iris-open, bk-sparse-breathe)',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'get_personality',
      description:
        'Get full personality definition including timing tiers, easing curves, characteristics, default primitives, and recommended primitives by category from the registry.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light'],
            description: 'Personality slug',
          },
        },
        required: ['slug'],
      },
    },
    {
      name: 'search_breakdowns',
      description:
        'Search animation reference breakdowns. Filter by personality, quality tier, type, or tags. Returns matching breakdowns with metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'universal'],
            description: 'Filter by personality',
          },
          quality: {
            type: 'string',
            enum: ['exemplary', 'strong', 'interesting'],
            description: 'Filter by quality tier',
          },
          type: {
            type: 'string',
            description: 'Filter by type (gif, video, website, motion-study)',
          },
          tag: {
            type: 'string',
            description: 'Filter by tag (e.g., stagger, grid, onboarding, spring)',
          },
        },
      },
    },
    {
      name: 'get_breakdown',
      description:
        'Get full content of an animation reference breakdown by slug. Returns the complete markdown analysis including signature moments, timing map, and extracted primitives.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Breakdown slug (e.g., linear-homepage, dot-grid-ripple, nume-ai-chat-dashboard)',
          },
        },
        required: ['slug'],
      },
    },
    {
      name: 'get_reference_doc',
      description:
        `Get a reference document by name. Available docs: ${listReferenceDocs().join(', ')}`,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: listReferenceDocs(),
            description: 'Reference document name',
          },
        },
        required: ['name'],
      },
    },
  ],
}));

// ── Tool handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'search_primitives':
      return handleSearchPrimitives(args);
    case 'get_primitive':
      return handleGetPrimitive(args);
    case 'get_personality':
      return handleGetPersonality(args);
    case 'search_breakdowns':
      return handleSearchBreakdowns(args);
    case 'get_breakdown':
      return handleGetBreakdown(args);
    case 'get_reference_doc':
      return handleGetReferenceDoc(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ── search_primitives ───────────────────────────────────────────────────────

function handleSearchPrimitives(args) {
  let results = [...registry.entries];

  if (args.query) {
    const q = args.query.toLowerCase();
    results = results.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q)
    );
  }

  if (args.personality) {
    results = results.filter((e) =>
      e.personality.some(
        (p) => p === args.personality || p === 'universal'
      )
    );
  }

  if (args.category) {
    const cat = args.category.toLowerCase();
    results = results.filter(
      (e) => e.category.toLowerCase().includes(cat)
    );
  }

  if (args.source) {
    results = results.filter((e) => e.source === args.source);
  }

  const text = results.length === 0
    ? 'No primitives found matching the given filters.'
    : formatPrimitivesTable(results);

  return { content: [{ type: 'text', text }] };
}

function formatPrimitivesTable(entries) {
  let out = `Found ${entries.length} primitive(s):\n\n`;
  out += '| ID | Name | Duration | Personality | Source | Category |\n';
  out += '|----|------|----------|-------------|--------|----------|\n';
  for (const e of entries) {
    out += `| ${e.id} | ${e.name} | ${e.duration} | ${e.personality.join(', ')} | ${e.source} | ${e.category} |\n`;
  }
  return out;
}

// ── get_primitive ───────────────────────────────────────────────────────────

function handleGetPrimitive(args) {
  const { id } = args;

  const registryEntry = registry.byId.get(id);
  const catalogEntry = primitivesCatalog.bySlug.get(id);
  const css = registry.cssBlocks.get(id);

  if (!registryEntry && !catalogEntry) {
    return {
      content: [{
        type: 'text',
        text: `Primitive "${id}" not found. Use search_primitives to find valid IDs.`,
      }],
      isError: true,
    };
  }

  let out = `# ${(registryEntry?.name || catalogEntry?.name)} (${id})\n\n`;

  // Registry metadata
  if (registryEntry) {
    out += `**Category:** ${registryEntry.category}\n`;
    out += `**Duration:** ${registryEntry.duration}\n`;
    out += `**Personality:** ${registryEntry.personality.join(', ')}\n`;
    out += `**Source:** ${registryEntry.source}\n\n`;
  }

  // Full catalog data (engine primitives only)
  if (catalogEntry) {
    out += '## Engine Catalog Data\n\n';
    out += `**Description:** ${catalogEntry.description}\n\n`;
    out += `**Default Duration:** ${catalogEntry.default_duration}\n`;
    out += `**Default Easing:** ${catalogEntry.default_easing}\n`;
    out += `**Composable:** ${catalogEntry.composable}\n`;
    out += `**Stagger Compatible:** ${catalogEntry.stagger_compatible}\n`;
    if (catalogEntry.stagger_offset) {
      out += `**Stagger Offset:** ${catalogEntry.stagger_offset}\n`;
    }
    out += `**CSS Class:** ${catalogEntry.css_class}\n\n`;

    if (catalogEntry.keyframes) {
      out += '### Keyframes\n\n```json\n';
      out += JSON.stringify(catalogEntry.keyframes, null, 2);
      out += '\n```\n\n';
    }

    if (catalogEntry.css_properties) {
      out += '### CSS Properties\n\n```json\n';
      out += JSON.stringify(catalogEntry.css_properties, null, 2);
      out += '\n```\n\n';
    }

    out += `**When to Use:** ${catalogEntry.when_to_use.join(', ')}\n`;
    out += `**When to Avoid:** ${catalogEntry.when_to_avoid.join(', ')}\n\n`;
    out += `**AI Guidance:** ${catalogEntry.ai_guidance}\n\n`;
  }

  // CSS implementation from registry
  if (css) {
    out += '## CSS Implementation\n\n```css\n';
    out += css;
    out += '\n```\n';
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── get_personality ─────────────────────────────────────────────────────────

function handleGetPersonality(args) {
  const { slug } = args;
  const personality = personalitiesCatalog.bySlug.get(slug);

  if (!personality) {
    return {
      content: [{
        type: 'text',
        text: `Personality "${slug}" not found. Valid: cinematic-dark, editorial, neutral-light`,
      }],
      isError: true,
    };
  }

  let out = `# ${personality.name} (${personality.slug})\n\n`;
  out += `**CSS Prefix:** ${personality.css_prefix}\n`;
  out += `**Active:** ${personality.is_active}\n\n`;
  out += `**AI Guidance:** ${personality.ai_guidance}\n\n`;

  // Timing tiers
  out += '## Duration Tiers\n\n';
  out += '| Tier | Duration |\n|------|----------|\n';
  for (const [tier, dur] of Object.entries(personality.duration_overrides)) {
    out += `| ${tier} | ${dur} |\n`;
  }

  // Easing curves
  out += '\n## Easing Curves\n\n';
  out += '| Purpose | Curve |\n|---------|-------|\n';
  for (const [purpose, curve] of Object.entries(personality.easing_overrides)) {
    out += `| ${purpose} | \`${curve}\` |\n`;
  }

  // Characteristics
  out += '\n## Characteristics\n\n';
  for (const [key, val] of Object.entries(personality.characteristics)) {
    out += `- **${key.replace(/_/g, ' ')}:** ${val}\n`;
  }

  // Defaults
  out += `\n## Defaults\n\n`;
  out += `- **Speed Hierarchy:** ${personality.speed_hierarchy.join(' → ')}\n`;
  out += `- **Default Stagger:** ${personality.default_stagger}\n`;
  out += `- **Default Entrance:** ${personality.default_entrance}\n`;
  out += `- **Default Exit:** ${personality.default_exit}\n`;

  // Recommended primitives from registry quick filters
  const recs = registry.personalityRecommendations.get(slug);
  if (recs) {
    out += '\n## Recommended Primitives\n\n';
    for (const [category, ids] of Object.entries(recs)) {
      out += `**Best ${category}:** ${ids.map(id => `\`${id}\``).join(', ')}\n`;
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── search_breakdowns ───────────────────────────────────────────────────────

function handleSearchBreakdowns(args) {
  let results = [...breakdownIndex];

  if (args.personality) {
    results = results.filter(
      (b) =>
        b.personality === args.personality ||
        b.personality === 'universal'
    );
  }

  if (args.quality) {
    results = results.filter((b) => b.quality === args.quality);
  }

  if (args.type) {
    results = results.filter((b) => b.type === args.type);
  }

  if (args.tag) {
    const tag = args.tag.toLowerCase();
    results = results.filter((b) =>
      b.tags.some((t) => t.toLowerCase().includes(tag))
    );
  }

  if (results.length === 0) {
    return {
      content: [{ type: 'text', text: 'No breakdowns found matching the given filters.' }],
    };
  }

  let out = `Found ${results.length} breakdown(s):\n\n`;
  out += '| Slug | Title | Type | Personality | Quality | Tags |\n';
  out += '|------|-------|------|-------------|---------|------|\n';
  for (const b of results) {
    out += `| ${b.slug} | ${b.title} | ${b.type} | ${b.personality} | ${b.quality} | ${b.tags.join(', ')} |\n`;
  }
  out += '\nUse get_breakdown with the slug to read the full analysis.';

  return { content: [{ type: 'text', text: out }] };
}

// ── get_breakdown ───────────────────────────────────────────────────────────

function handleGetBreakdown(args) {
  const { slug } = args;

  // Verify it exists in the index
  const entry = breakdownIndex.find((b) => b.slug === slug);
  if (!entry) {
    const available = breakdownIndex.map((b) => b.slug).join(', ');
    return {
      content: [{
        type: 'text',
        text: `Breakdown "${slug}" not found. Available: ${available}`,
      }],
      isError: true,
    };
  }

  try {
    const content = readBreakdown(slug);
    return { content: [{ type: 'text', text: content }] };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Error reading breakdown "${slug}": ${err.message}`,
      }],
      isError: true,
    };
  }
}

// ── get_reference_doc ───────────────────────────────────────────────────────

function handleGetReferenceDoc(args) {
  const { name } = args;
  const available = listReferenceDocs();

  if (!available.includes(name)) {
    return {
      content: [{
        type: 'text',
        text: `Reference doc "${name}" not found. Available: ${available.join(', ')}`,
      }],
      isError: true,
    };
  }

  try {
    const content = readReferenceDoc(name);
    return { content: [{ type: 'text', text: content }] };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Error reading reference doc "${name}": ${err.message}`,
      }],
      isError: true,
    };
  }
}

// ── Start server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Animatic MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
