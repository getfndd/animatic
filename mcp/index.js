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
  loadIntentMappings,
  loadCameraGuardrails,
  parseRegistry,
  parseBreakdownIndex,
  readBreakdown,
  readReferenceDoc,
  listReferenceDocs,
} from './data/loader.js';

import { filterByPersonality, parseDurationMs, checkBlurViolations } from './lib.js';
import { analyzeScene } from './lib/analyze.js';
import { planSequence, STYLE_PACKS } from './lib/planner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load data at startup ────────────────────────────────────────────────────

const primitivesCatalog = loadPrimitivesCatalog();
const personalitiesCatalog = loadPersonalitiesCatalog();
const intentMappings = loadIntentMappings();
const cameraGuardrails = loadCameraGuardrails();
const registry = parseRegistry();
const breakdownIndex = parseBreakdownIndex();

console.error(`Animatic MCP: loaded ${primitivesCatalog.array.length} engine primitives, ${registry.entries.length} registry entries, ${intentMappings.array.length} intent mappings, ${Object.keys(cameraGuardrails.primitive_amplitudes).length} guardrail amplitudes, ${breakdownIndex.length} breakdowns`);

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
    instructions: `This MCP server provides access to Animatic's animation reference system — 100+ named primitives, 4 animation personalities, 15 reference breakdowns, spring physics, and animation principles.

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
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage', 'universal'],
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
        'Get full personality definition including timing tiers, easing curves, characteristics, camera behavior rules (allowed movements, parallax, DOF, ambient motion), default primitives, and recommended primitives by category from the registry.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
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
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage', 'universal'],
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
    {
      name: 'recommend_choreography',
      description:
        'Get a complete camera choreography plan for a given intent and personality. Returns concrete primitive IDs, timing, parallax/DOF settings, ambient motion, and companion primitives. Use this to automate the emotion-to-camera mapping instead of manually cross-referencing personality rules and primitive registries.',
      inputSchema: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            enum: intentMappings.array.map(i => i.intent),
            description: 'The choreographic intent (e.g., dramatic-reveal, build-tension, content-focus)',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Target personality. If omitted, returns plans for all supported personalities.',
          },
          subject_count: {
            type: 'integer',
            minimum: 1,
            description: 'Number of subjects in the scene. Affects framing and stagger hints.',
          },
        },
        required: ['intent'],
      },
    },
    {
      name: 'validate_choreography',
      description:
        'Validate a set of primitives against personality guardrails. Checks primitive existence, personality compatibility, forbidden features (3D in editorial, camera in neutral-light), speed limits, lens bounds, and intent cross-references. Returns PASS/WARN/BLOCK verdict with detailed diagnostics. Use after recommend_choreography to verify a plan before implementing.',
      inputSchema: {
        type: 'object',
        properties: {
          primitive_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of primitive IDs in the choreography plan',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Target personality to validate against',
          },
          intent: {
            type: 'string',
            enum: intentMappings.array.map(i => i.intent),
            description: 'Optional intent for cross-reference validation',
          },
          overrides: {
            type: 'object',
            properties: {
              perspective: { type: 'number', description: 'Custom perspective value in px' },
              max_blur: { type: 'number', description: 'Custom max blur value in px' },
              duration_multiplier: { type: 'number', description: 'Multiplier applied to default durations (e.g., 0.5 for half speed)' },
            },
            description: 'Optional overrides for lens bounds and timing validation',
          },
        },
        required: ['primitive_ids', 'personality'],
      },
    },
    {
      name: 'analyze_scene',
      description:
        'Analyze a scene JSON to classify content type, visual weight, motion energy, and intent tags. Returns structured metadata with confidence scores. Use this to auto-populate the metadata field for AI-planned sequences.',
      inputSchema: {
        type: 'object',
        properties: {
          scene: {
            type: 'object',
            description: 'A scene object conforming to the scene-format spec (must include scene_id, layers, and optionally camera, layout, assets, duration_s)',
          },
        },
        required: ['scene'],
      },
    },
    {
      name: 'plan_sequence',
      description:
        'Plan a sequence from analyzed scenes and a style pack. Decides shot order, hold durations, transitions, and camera overrides. Returns a valid sequence manifest with editorial notes. Scenes must have metadata (use analyze_scene first).',
      inputSchema: {
        type: 'object',
        properties: {
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of scene objects with metadata (content_type, visual_weight, motion_energy, intent_tags). Use analyze_scene to generate metadata for each scene first.',
          },
          style: {
            type: 'string',
            enum: STYLE_PACKS,
            description: 'Style pack: "prestige" (editorial, longer holds, hard cuts), "energy" (montage, short holds, whip-wipes), or "dramatic" (cinematic-dark, crossfades, push-in camera)',
          },
        },
        required: ['scenes', 'style'],
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
    case 'recommend_choreography':
      return handleRecommendChoreography(args);
    case 'validate_choreography':
      return handleValidateChoreography(args);
    case 'analyze_scene':
      return handleAnalyzeScene(args);
    case 'plan_sequence':
      return handlePlanSequence(args);
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
        text: `Personality "${slug}" not found. Valid: cinematic-dark, editorial, neutral-light, montage`,
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

  // Camera behavior
  if (personality.camera_behavior) {
    const cam = personality.camera_behavior;
    out += '\n## Camera Behavior\n\n';
    out += `- **Enabled:** ${cam.enabled}\n`;
    out += `- **Mode:** ${cam.mode}\n`;
    if (cam.perspective !== 'none') {
      out += `- **Perspective:** ${cam.perspective}\n`;
    }
    if (cam.perspective_origin) {
      out += `- **Perspective Origin:** ${cam.perspective_origin}\n`;
    }
    if (cam.allowed_movements?.length > 0) {
      out += `- **Allowed Movements:** ${cam.allowed_movements.join(', ')}\n`;
    }
    if (cam.forbidden_movements?.length > 0) {
      out += `- **Forbidden Movements:** ${cam.forbidden_movements.join(', ')}\n`;
    }
    if (cam.parallax) {
      out += `\n### Parallax\n`;
      out += `- **Enabled:** ${cam.parallax.enabled}\n`;
      if (cam.parallax.enabled) {
        out += `- **Mode:** ${cam.parallax.mode}\n`;
        out += `- **Max Layers:** ${cam.parallax.max_layers}\n`;
        out += `- **Intensity:** ${cam.parallax.intensity}\n`;
      }
    }
    if (cam.depth_of_field) {
      out += `\n### Depth of Field\n`;
      out += `- **Enabled:** ${cam.depth_of_field.enabled}\n`;
      if (cam.depth_of_field.enabled) {
        out += `- **Max Blur:** ${cam.depth_of_field.max_blur}\n`;
        out += `- **Entrance Blur:** ${cam.depth_of_field.entrance_blur}\n`;
        out += `- **Rack Focus:** ${cam.depth_of_field.rack_focus}\n`;
      }
      if (cam.depth_of_field.alternative) {
        out += `- **Alternative:** ${cam.depth_of_field.alternative}\n`;
      }
    }
    if (cam.ambient_motion) {
      out += `\n### Ambient Motion\n`;
      for (const [key, val] of Object.entries(cam.ambient_motion)) {
        if (typeof val === 'object' && val.enabled === false) {
          out += `- **${key.replace(/_/g, ' ')}:** disabled\n`;
        } else if (typeof val === 'object') {
          const props = Object.entries(val)
            .filter(([k]) => k !== 'condition')
            .map(([k, v]) => `${k}: ${v}`).join(', ');
          out += `- **${key.replace(/_/g, ' ')}:** ${props}\n`;
          if (val.condition) {
            out += `  - *Condition:* ${val.condition}\n`;
          }
        }
      }
    }
    if (cam.shake) {
      out += `\n### Camera Shake\n`;
      out += `- **Enabled:** ${cam.shake.enabled}\n`;
      if (cam.shake.enabled) {
        out += `- **Max Amplitude:** ${cam.shake.max_amplitude}\n`;
        out += `- **Frequency Range:** ${cam.shake.frequency_range}\n`;
        out += `- **Decay:** ${cam.shake.decay}\n`;
      }
    }
    if (cam.camera_speed_tiers) {
      out += `\n### Camera Speed Tiers\n`;
      for (const [tier, dur] of Object.entries(cam.camera_speed_tiers)) {
        out += `- **${tier}:** ${dur}\n`;
      }
    }
    if (cam.camera_easing) {
      out += `\n**Camera Easing:** \`${cam.camera_easing}\`\n`;
    }
    if (cam.recommended_primitives?.length > 0) {
      out += `\n**Recommended Camera Primitives:** ${cam.recommended_primitives.map(id => `\`${id}\``).join(', ')}\n`;
    }
    if (cam.attention_primitives?.length > 0) {
      out += `\n**Attention Direction Primitives:** ${cam.attention_primitives.map(id => `\`${id}\``).join(', ')}\n`;
    }
    if (cam.constraints) {
      out += `\n**Constraints:** ${cam.constraints}\n`;
    }
  }

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

// ── recommend_choreography ───────────────────────────────────────────────────

function handleRecommendChoreography(args) {
  const { intent: intentSlug, personality: requestedPersonality, subject_count } = args;

  const mapping = intentMappings.byIntent.get(intentSlug);
  if (!mapping) {
    const available = intentMappings.array.map(i => i.intent).join(', ');
    return {
      content: [{
        type: 'text',
        text: `Intent "${intentSlug}" not found. Available intents: ${available}`,
      }],
      isError: true,
    };
  }

  // If a specific personality was requested, validate it's supported
  if (requestedPersonality && !mapping.personality_support.includes(requestedPersonality)) {
    const supported = mapping.personality_support.join(', ');
    return {
      content: [{
        type: 'text',
        text: `Intent "${intentSlug}" is not supported by the "${requestedPersonality}" personality.\n\nSupported personalities for this intent: ${supported}\n\nTip: Use a different intent for ${requestedPersonality}, or try one of the supported personalities.`,
      }],
      isError: true,
    };
  }

  // Determine which personalities to generate plans for
  const personalities = requestedPersonality
    ? [requestedPersonality]
    : mapping.personality_support;

  let out = `# Choreography: ${mapping.label}\n\n`;
  out += `> ${mapping.camera_description}\n\n`;

  for (const pSlug of personalities) {
    const personality = personalitiesCatalog.bySlug.get(pSlug);
    if (!personality) continue;

    if (personalities.length > 1) {
      out += `---\n\n## ${personality.name}\n\n`;
    }

    // Camera move — filter by personality
    const cameraPrims = filterByPersonality(mapping.camera_primitives, pSlug, registry);
    out += `### Camera Move\n\n`;
    if (cameraPrims.length === 0) {
      out += `No camera movement — use attention-direction primitives instead.\n\n`;
    } else {
      out += `| Primitive | Name | Duration |\n`;
      out += `|-----------|------|----------|\n`;
      for (const primId of cameraPrims) {
        const entry = registry.byId.get(primId);
        if (entry) {
          out += `| \`${primId}\` | ${entry.name} | ${entry.duration} |\n`;
        } else {
          out += `| \`${primId}\` | *(not in registry)* | — |\n`;
        }
      }
      out += '\n';
    }

    // Speed & easing
    out += `### Speed & Easing\n\n`;
    out += `- **Speed tier:** ${mapping.speed}\n`;
    if (mapping.speed !== 'none' && personality.camera_behavior?.camera_speed_tiers) {
      const speedDuration = personality.camera_behavior.camera_speed_tiers[mapping.speed];
      if (speedDuration) {
        out += `- **Duration (${pSlug}):** ${speedDuration}\n`;
      }
    }
    if (personality.camera_behavior?.camera_easing) {
      out += `- **Camera easing:** \`${personality.camera_behavior.camera_easing}\`\n`;
    } else if (personality.easing_overrides?.smooth) {
      out += `- **Easing:** \`${personality.easing_overrides.smooth}\`\n`;
    }
    out += '\n';

    // Parallax
    out += `### Parallax\n\n`;
    out += `- **Strength:** ${mapping.parallax}\n`;
    out += `- **Layers:** ${mapping.parallax_layers}\n`;
    if (personality.camera_behavior?.parallax) {
      const px = personality.camera_behavior.parallax;
      out += `- **Mode (${pSlug}):** ${px.mode}\n`;
      out += `- **Max layers allowed:** ${px.max_layers}\n`;
      out += `- **Intensity:** ${px.intensity}\n`;
    }
    out += '\n';

    // Depth of field
    out += `### Depth of Field\n\n`;
    out += `- **DOF:** ${mapping.dof}\n`;
    if (personality.camera_behavior?.depth_of_field) {
      const dof = personality.camera_behavior.depth_of_field;
      out += `- **Enabled (${pSlug}):** ${dof.enabled}\n`;
      if (dof.enabled) {
        out += `- **Max blur:** ${dof.max_blur}\n`;
      }
      if (dof.alternative) {
        out += `- **Alternative:** ${dof.alternative}\n`;
      }
    }
    out += '\n';

    // Ambient motion — filter by personality
    const ambientPrims = filterByPersonality(mapping.ambient_primitives, pSlug, registry);
    if (ambientPrims.length > 0) {
      out += `### Ambient Motion\n\n`;
      out += `| Primitive | Name | Duration |\n`;
      out += `|-----------|------|----------|\n`;
      for (const primId of ambientPrims) {
        const entry = registry.byId.get(primId);
        if (entry) {
          out += `| \`${primId}\` | ${entry.name} | ${entry.duration} |\n`;
        }
      }
      out += '\n';
      if (personality.camera_behavior?.ambient_motion) {
        for (const [key, val] of Object.entries(personality.camera_behavior.ambient_motion)) {
          if (typeof val === 'object' && val.condition) {
            out += `> *${key.replace(/_/g, ' ')}:* ${val.condition}\n`;
          }
        }
      }
    }

    // Companion entrance primitives — filter by personality
    if (mapping.companion_entrance.length > 0) {
      const relevantCompanions = filterByPersonality(mapping.companion_entrance, pSlug, registry);

      if (relevantCompanions.length > 0) {
        out += `### Companion Entrances\n\n`;
        out += `| Primitive | Name | Duration |\n`;
        out += `|-----------|------|----------|\n`;
        for (const primId of relevantCompanions) {
          const entry = registry.byId.get(primId);
          if (entry) {
            out += `| \`${primId}\` | ${entry.name} | ${entry.duration} |\n`;
          } else {
            out += `| \`${primId}\` | *(not in registry)* | — |\n`;
          }
        }
        out += '\n';
      }
    }

    // Framing
    out += `### Framing\n\n`;
    out += `- **Composition:** ${mapping.framing}\n`;
    if (mapping.perspective_origin) {
      out += `- **Perspective Origin:** \`${mapping.perspective_origin}\`\n`;
    }
    if (subject_count && subject_count > 1) {
      out += `- **Multi-subject (${subject_count}):** Consider stagger offsets between subjects. `;
      if (personality.default_stagger) {
        out += `Default stagger for ${pSlug}: ${personality.default_stagger}.\n`;
      }
    }
    out += '\n';

    // Personality notes
    if (personality.camera_behavior?.constraints) {
      out += `### Personality Constraints\n\n`;
      out += `${personality.camera_behavior.constraints}\n\n`;
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── validate_choreography ────────────────────────────────────────────────────

function handleValidateChoreography(args) {
  const { primitive_ids, personality: targetPersonality, intent: intentSlug, overrides } = args;

  if (!primitive_ids || primitive_ids.length === 0) {
    return {
      content: [{ type: 'text', text: 'No primitive IDs provided. Supply at least one primitive to validate.' }],
      isError: true,
    };
  }

  const blocks = [];
  const warnings = [];
  const notes = [];

  const boundaries = cameraGuardrails.personality_boundaries[targetPersonality];
  const forbiddenFeatures = boundaries?.forbidden_features || [];

  // ── Tier 1: BLOCK — Primitive existence ──────────────────────────────────
  for (const id of primitive_ids) {
    if (!registry.byId.has(id)) {
      blocks.push(`**Unknown primitive:** \`${id}\` is not in the registry.`);
    }
  }

  // ── Tier 2: BLOCK — Personality compatibility ────────────────────────────
  for (const id of primitive_ids) {
    const entry = registry.byId.get(id);
    if (!entry) continue; // already caught above
    const compatible = entry.personality.some(
      p => p === targetPersonality || p === 'universal'
    );
    if (!compatible) {
      blocks.push(`**Personality mismatch:** \`${id}\` supports [${entry.personality.join(', ')}], not ${targetPersonality}.`);
    }
  }

  // ── Tier 3: BLOCK — Personality boundary enforcement ─────────────────────
  for (const id of primitive_ids) {
    const entry = registry.byId.get(id);
    if (!entry) continue;
    const amplitude = cameraGuardrails.primitive_amplitudes[id];

    // 3D transforms check
    if (forbiddenFeatures.includes('3d_transforms') && amplitude) {
      if (amplitude.property === 'translateZ' || amplitude.property === 'rotateX' || amplitude.property === 'rotateY') {
        blocks.push(`**Forbidden feature (3D):** \`${id}\` uses ${amplitude.property}, which is forbidden in ${targetPersonality}.`);
      }
    }

    // Blur check — use blur_primitives list (covers non-camera blur primitives too)
    for (const v of checkBlurViolations(id, entry, cameraGuardrails, forbiddenFeatures)) {
      if (v.type === 'blur') {
        blocks.push(`**Forbidden feature (blur):** \`${id}\` uses blur, forbidden in ${targetPersonality}.`);
      } else if (v.type === 'blur_entrance') {
        blocks.push(`**Forbidden feature (blur entrance):** \`${id}\` uses blur entrance, forbidden in ${targetPersonality}.`);
      }
    }

    // Camera movement check
    if (forbiddenFeatures.includes('camera_movement') && amplitude) {
      if (['translateX', 'translateY', 'translateZ', 'rotateX', 'rotateY'].includes(amplitude.property)) {
        blocks.push(`**Forbidden feature (camera movement):** \`${id}\` uses ${amplitude.property}, which is forbidden in ${targetPersonality}.`);
      }
    }

    // Camera shake check
    if (forbiddenFeatures.includes('camera_shake') && id === 'ct-camera-shake') {
      blocks.push(`**Forbidden feature (camera shake):** \`${id}\` is forbidden in ${targetPersonality}.`);
    }
  }

  // ── Tier 4: WARN — Speed limits ──────────────────────────────────────────
  const durationMultiplier = overrides?.duration_multiplier || 1;
  for (const id of primitive_ids) {
    const entry = registry.byId.get(id);
    if (!entry) continue;
    const amplitude = cameraGuardrails.primitive_amplitudes[id];
    if (!amplitude) continue;

    const durationMs = parseDurationMs(entry.duration);
    if (!durationMs) continue;

    const effectiveDurationMs = durationMs * durationMultiplier;
    const effectiveDurationS = effectiveDurationMs / 1000;
    const velocity = amplitude.max_displacement / effectiveDurationS;

    // Map property to speed limit category
    let limitKey = amplitude.property;
    if (amplitude.property === 'scale' && amplitude.unit === 'percent') {
      limitKey = 'scale_ambient';
    }
    const limit = cameraGuardrails.speed_limits[limitKey];
    if (limit && velocity > limit.max_velocity) {
      warnings.push(`**Speed exceeded:** \`${id}\` — ${amplitude.property} velocity ${velocity.toFixed(1)} ${amplitude.unit}/s exceeds limit of ${limit.max_velocity} ${limit.unit}.`);
    }
  }

  // ── Tier 5: WARN — Lens bounds ───────────────────────────────────────────
  if (overrides?.perspective != null) {
    const bounds = cameraGuardrails.lens_bounds.perspective;
    if (overrides.perspective < bounds.min || overrides.perspective > bounds.max) {
      warnings.push(`**Perspective out of bounds:** ${overrides.perspective}px is outside [${bounds.min}–${bounds.max}]px range.`);
    }
  }
  if (overrides?.max_blur != null) {
    const bounds = cameraGuardrails.lens_bounds.blur;
    if (overrides.max_blur < bounds.min || overrides.max_blur > bounds.max) {
      warnings.push(`**Blur out of bounds:** ${overrides.max_blur}px is outside [${bounds.min}–${bounds.max}]px range.`);
    }
  }

  // ── Tier 6: INFO — Intent cross-reference ────────────────────────────────
  if (intentSlug) {
    const mapping = intentMappings.byIntent.get(intentSlug);
    if (mapping) {
      if (!mapping.personality_support.includes(targetPersonality)) {
        notes.push(`Intent \`${intentSlug}\` does not support ${targetPersonality}. Supported: ${mapping.personality_support.join(', ')}.`);
      }
      const expectedPrimitives = filterByPersonality(mapping.camera_primitives, targetPersonality, registry);
      const missing = expectedPrimitives.filter(id => !primitive_ids.includes(id));
      if (missing.length > 0) {
        notes.push(`Intent \`${intentSlug}\` expects these camera primitives not in your plan: ${missing.map(id => `\`${id}\``).join(', ')}.`);
      }
    } else {
      notes.push(`Intent \`${intentSlug}\` not found in intent mappings.`);
    }
  }

  // ── Build output ─────────────────────────────────────────────────────────
  const verdict = blocks.length > 0 ? 'BLOCK' : warnings.length > 0 ? 'WARN' : 'PASS';

  let out = `# Choreography Validation: **${verdict}**\n\n`;
  out += `**Personality:** ${targetPersonality}\n`;
  out += `**Primitives:** ${primitive_ids.map(id => `\`${id}\``).join(', ')}\n`;
  if (intentSlug) out += `**Intent:** ${intentSlug}\n`;
  if (overrides) out += `**Overrides:** ${JSON.stringify(overrides)}\n`;
  out += '\n';

  if (blocks.length > 0) {
    out += `## Blocking Violations (${blocks.length})\n\n`;
    for (const b of blocks) out += `- ${b}\n`;
    out += '\n';
  }

  if (warnings.length > 0) {
    out += `## Warnings (${warnings.length})\n\n`;
    for (const w of warnings) out += `- ${w}\n`;
    out += '\n';
  }

  if (notes.length > 0) {
    out += `## Notes (${notes.length})\n\n`;
    for (const n of notes) out += `- ${n}\n`;
    out += '\n';
  }

  if (verdict === 'PASS' && notes.length === 0) {
    out += `All ${primitive_ids.length} primitives are compatible with ${targetPersonality}. No guardrail violations detected.\n`;
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── analyze_scene ────────────────────────────────────────────────────────────

function handleAnalyzeScene(args) {
  const { scene } = args;

  if (!scene || typeof scene !== 'object') {
    return {
      content: [{
        type: 'text',
        text: 'Invalid input: `scene` must be a JSON object conforming to the scene-format spec.',
      }],
      isError: true,
    };
  }

  const result = analyzeScene(scene);
  const { metadata, _confidence } = result;
  const sceneId = scene.scene_id || '(unnamed)';

  let out = `# Scene Analysis: ${sceneId}\n\n`;

  // Classification table
  out += '| Field | Value | Confidence |\n';
  out += '|-------|-------|------------|\n';
  out += `| content_type | \`${metadata.content_type}\` | ${(_confidence.content_type * 100).toFixed(0)}% |\n`;
  out += `| visual_weight | \`${metadata.visual_weight}\` | ${(_confidence.visual_weight * 100).toFixed(0)}% |\n`;
  out += `| motion_energy | \`${metadata.motion_energy}\` | ${(_confidence.motion_energy * 100).toFixed(0)}% |\n`;
  out += `| intent_tags | ${metadata.intent_tags.map(t => `\`${t}\``).join(', ') || '*(none)*'} | ${(_confidence.intent_tags * 100).toFixed(0)}% |\n`;
  out += '\n';

  // Metadata JSON block
  out += '## Metadata\n\n```json\n';
  out += JSON.stringify(metadata, null, 2);
  out += '\n```\n\n';

  // Confidence JSON block
  out += '## Confidence Scores\n\n```json\n';
  out += JSON.stringify(_confidence, null, 2);
  out += '\n```\n\n';

  // Diagnostic notes
  out += '## Diagnostics\n\n';
  const layers = scene.layers || [];
  out += `- **Layers:** ${layers.length} (${layers.map(l => l.type).join(', ') || 'none'})\n`;
  if (scene.layout) out += `- **Layout:** ${scene.layout.template}\n`;
  if (scene.camera) out += `- **Camera:** ${scene.camera.move || 'static'} (intensity: ${scene.camera.intensity ?? 'default'})\n`;
  out += `- **Duration:** ${scene.duration_s ?? 'unset'}s\n`;

  // Low confidence warnings
  const lowConfidence = Object.entries(_confidence).filter(([, v]) => v < 0.50);
  if (lowConfidence.length > 0) {
    out += '\n**Low confidence warnings:**\n';
    for (const [field, conf] of lowConfidence) {
      out += `- \`${field}\` at ${(conf * 100).toFixed(0)}% — consider manual override or LLM-assisted reclassification\n`;
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── plan_sequence ───────────────────────────────────────────────────────────

function handlePlanSequence(args) {
  const { scenes, style } = args;

  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'Invalid input: `scenes` must be a non-empty array of scene objects with metadata.',
      }],
      isError: true,
    };
  }

  if (!STYLE_PACKS.includes(style)) {
    return {
      content: [{
        type: 'text',
        text: `Invalid style "${style}". Valid styles: ${STYLE_PACKS.join(', ')}`,
      }],
      isError: true,
    };
  }

  try {
    const { manifest, notes } = planSequence({ scenes, style });

    let out = `# Sequence Plan: ${manifest.sequence_id}\n\n`;
    out += `**Style:** ${style} (${notes.style_personality})\n`;
    out += `**Scenes:** ${notes.scene_count}\n`;
    out += `**Total Duration:** ${notes.total_duration_s}s\n\n`;

    // Shot list table
    out += '## Shot List\n\n';
    out += '| # | Scene | Duration | Transition | Camera |\n';
    out += '|---|-------|----------|------------|--------|\n';
    for (let i = 0; i < manifest.scenes.length; i++) {
      const s = manifest.scenes[i];
      const transition = s.transition_in
        ? `${s.transition_in.type}${s.transition_in.duration_ms ? ` (${s.transition_in.duration_ms}ms)` : ''}`
        : '—';
      const camera = s.camera_override
        ? `${s.camera_override.move}${s.camera_override.intensity != null ? ` ${s.camera_override.intensity}` : ''}`
        : '—';
      out += `| ${i + 1} | ${s.scene} | ${s.duration_s}s | ${transition} | ${camera} |\n`;
    }

    // Transition summary
    out += '\n## Transitions\n\n';
    for (const [type, count] of Object.entries(notes.transition_summary)) {
      out += `- **${type}:** ${count}\n`;
    }

    // Ordering rationale
    out += `\n## Ordering\n\n${notes.ordering_rationale}\n`;

    // Manifest JSON
    out += '\n## Manifest\n\n```json\n';
    out += JSON.stringify(manifest, null, 2);
    out += '\n```\n';

    return { content: [{ type: 'text', text: out }] };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Error planning sequence: ${err.message}`,
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
