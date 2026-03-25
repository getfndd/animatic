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
  loadStylePacks,
  loadBriefTemplates,
  loadRecipes,
  loadBenchmarks,
  parseRegistry,
  parseBreakdownIndex,
  readBreakdown,
  readReferenceDoc,
  listReferenceDocs,
} from './data/loader.js';

import { filterByPersonality, parseDurationMs, checkBlurViolations } from './lib.js';
import { analyzeScene } from './lib/analyze.js';
import { planSequence, planVariants, STYLE_PACKS } from './lib/planner.js';
import { evaluateSequence, compareVariants } from './lib/evaluate.js';
import { validateFullManifest } from './lib/guardrails.js';
import { generateScenes } from './lib/generator.js';
import { detectBeats, computeEnergyCurve, decodeWav } from './lib/beats.js';
import { syncSequenceToBeats, generateHitMarkers, planAudioCues, scoreAudioSync } from './lib/audio-sync.js';
import { registerPersonality, listCustomPersonalities, getAllPersonalitySlugs, getPersonality } from './lib/personality.js';
import { compileMotion } from './lib/compiler.js';
import { critiqueTimeline } from './lib/critic.js';
import { runBenchmarks, QUALITY_THRESHOLD } from './lib/benchmark.js';
import { generateVideo } from './lib/video.js';
import { initProject, listProjects, getProject, getProjectContext, saveProjectArtifact } from './lib/projects.js';
import { getArtDirection, listArtDirections, ART_DIRECTION_SLUGS } from './lib/art-direction.js';
import { loadBrand, listBrands, createBrandPackage, resolveBrandDefaults, validateBrandCompliance } from './lib/brands.js';
import { scoreBrandFinish, COMPOSITING_PASS_SLUGS } from './lib/compositing.js';
import { getProductArchetype, listProductArchetypes, recommendProductArchetype, getCameraIntent, listCameraIntents, scoreProductDemoClarity, PRODUCT_ARCHETYPE_SLUGS, CAMERA_INTENT_SLUGS } from './lib/product-archetypes.js';
import { generateContactSheet, generateKeyMomentStrip, compareProjectVersions, formatContactSheetMarkdown, formatComparisonMarkdown } from './lib/storyboard-tools.js';
import { getSocialFormat, listSocialFormats, adaptManifestAspectRatio, createSocialCutdown, SOCIAL_FORMAT_SLUGS, VALID_ASPECT_RATIOS } from './lib/social-formats.js';
import { resolveContinuityLinks, suggestMatchCuts, planContinuityLinks, validateContinuityChain } from './lib/continuity.js';
import { auditMotionDensity, suggestSimplification } from './lib/motion-density.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load data at startup ────────────────────────────────────────────────────

const primitivesCatalog = loadPrimitivesCatalog();
const personalitiesCatalog = loadPersonalitiesCatalog();
const intentMappings = loadIntentMappings();
const cameraGuardrails = loadCameraGuardrails();
const stylePacksCatalog = loadStylePacks(
  personalitiesCatalog.array.map(p => p.slug)
);
const briefTemplatesCatalog = loadBriefTemplates();
const recipesCatalog = loadRecipes();
const registry = parseRegistry();
const breakdownIndex = parseBreakdownIndex();
const sequenceArchetypes = JSON.parse(readFileSync(resolve(__dirname, '..', 'catalog', 'sequence-archetypes.json'), 'utf-8'));
let _aiDemoArchetypes = null;
function getAiDemoArchetypes() {
  if (!_aiDemoArchetypes) _aiDemoArchetypes = JSON.parse(readFileSync(resolve(__dirname, '..', 'catalog', 'ai-demo-archetypes.json'), 'utf-8'));
  return _aiDemoArchetypes;
}
let _finishPresets = null;
function getFinishPresets() {
  if (!_finishPresets) _finishPresets = JSON.parse(readFileSync(resolve(__dirname, '..', 'catalog', 'finish-presets.json'), 'utf-8'));
  return _finishPresets;
}

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
        'Plan a sequence from analyzed scenes and a style pack. Decides shot order, hold durations, transitions, and camera overrides. Returns a valid sequence manifest with editorial notes. Scenes must have metadata (use analyze_scene first). Supports per-scene style blending via metadata.style_override. Pass beats from analyze_beats for beat-synced editing.',
      inputSchema: {
        type: 'object',
        properties: {
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of scene objects with metadata (content_type, visual_weight, motion_energy, intent_tags). Use analyze_scene to generate metadata for each scene first. Optional: set metadata.style_override to a style pack name to blend styles per scene.',
          },
          style: {
            type: 'string',
            enum: STYLE_PACKS,
            description: 'Default style pack for the sequence. Individual scenes can override via metadata.style_override.',
          },
          beats: {
            type: 'object',
            description: 'Beat analysis data from analyze_beats. When provided, scene durations are snapped to beat boundaries and camera intensities are matched to audio energy.',
          },
        },
        required: ['scenes', 'style'],
      },
    },
    {
      name: 'get_style_pack',
      description:
        'Get a style pack definition by name. Returns hold durations, transition rules, camera override rules, and the mapped personality. Use this to understand how a style pack drives sequence planning decisions.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: STYLE_PACKS,
            description: 'Style pack name',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'evaluate_sequence',
      description:
        'Score a planned sequence manifest against style rules and cinematography principles. Returns pacing, variety, flow, and adherence scores (0-100) plus findings. Handles per-scene style blending — scenes with metadata.style_override are scored against their override pack.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Sequence manifest from plan_sequence (must have a scenes array)',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Analyzed scene objects with metadata (same scenes used for plan_sequence). Scenes with metadata.style_override are evaluated against their per-scene style pack.',
          },
          style: {
            type: 'string',
            enum: STYLE_PACKS,
            description: 'Default style pack to evaluate against. Individual scenes with metadata.style_override use their override pack instead.',
          },
        },
        required: ['manifest', 'scenes', 'style'],
      },
    },
    {
      name: 'validate_manifest',
      description:
        'Validate a sequence manifest against camera guardrails. Checks speed limits, acceleration easing, jerk/settling, lens bounds, and personality boundaries for each scene. Returns PASS/WARN/BLOCK verdict with per-scene diagnostics. Use after plan_sequence to verify a manifest before rendering.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Sequence manifest from plan_sequence (must have a scenes array)',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Personality to validate against',
          },
        },
        required: ['manifest', 'personality'],
      },
    },
    {
      name: 'list_brief_templates',
      description:
        'List all available creative brief templates. Returns template IDs, names, descriptions, default style packs, and suggested scene counts. Use this to help users choose a template before filling in a brief.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_brief_template',
      description:
        'Get a creative brief template by ID. Returns the full template with section structure, suggested layouts/content types per section, defaults (style pack, tone, duration), and an example brief. Use this to understand what a brief template expects before generating scenes.',
      inputSchema: {
        type: 'object',
        properties: {
          template_id: {
            type: 'string',
            enum: briefTemplatesCatalog.array.map(t => t.template_id),
            description: 'Brief template ID',
          },
        },
        required: ['template_id'],
      },
    },
    {
      name: 'generate_scenes',
      description:
        'Generate scene JSON files from a creative brief. Validates the brief, classifies assets, resolves template and style, builds a scene plan, and produces validated scene definitions. Returns scenes ready for analyze_scene → plan_sequence → render pipeline. This is the bridge between /brief and /sizzle.',
      inputSchema: {
        type: 'object',
        properties: {
          brief: {
            type: 'object',
            description: 'A creative brief object with project (title required), template (template_id or "custom"), content (sections array with label + text + optional assets), assets (array with id + src + optional hint), and optional brand, tone, style, constraints fields.',
          },
          enhance: {
            type: 'boolean',
            description: 'Enable LLM enhancement (ANI-36). When true and ANTHROPIC_API_KEY is set, Claude improves scene plan text and suggests camera moves. Falls back to rule-based output on any failure. Default: false.',
          },
          format: {
            type: 'string',
            enum: ['v2', 'v3'],
            description: 'Output format. "v2" emits motion blocks (default). "v3" emits semantic components + interactions for content types that support it (typography, brand_mark, data_visualization, collage); other content types fall back to v2 motion blocks.',
          },
        },
        required: ['brief'],
      },
    },
    {
      name: 'plan_variants',
      description:
        'Plan multiple sequence variants from the same scenes with different styles. Each style produces an independent manifest. Use this to generate A/B choreography options for comparison. Requires at least 2 styles.',
      inputSchema: {
        type: 'object',
        properties: {
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of analyzed scene objects with metadata (use analyze_scene first).',
          },
          styles: {
            type: 'array',
            items: { type: 'string', enum: STYLE_PACKS },
            minItems: 2,
            description: 'Array of style pack names to generate variants for.',
          },
          sequence_id: {
            type: 'string',
            description: 'Base sequence ID. Each variant gets a suffixed ID.',
          },
        },
        required: ['scenes', 'styles'],
      },
    },
    {
      name: 'compare_variants',
      description:
        'Score and rank multiple sequence variants. Evaluates each variant across pacing, variety, flow, and adherence dimensions. Returns ranked results with per-dimension comparison. Use after plan_variants to pick the best choreography.',
      inputSchema: {
        type: 'object',
        properties: {
          variants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                variant_id: { type: 'string' },
                style: { type: 'string' },
                manifest: { type: 'object' },
              },
            },
            description: 'Array of variant objects from plan_variants output.',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Analyzed scene objects with metadata (same scenes used for plan_variants).',
          },
        },
        required: ['variants', 'scenes'],
      },
    },
    {
      name: 'analyze_beats',
      description:
        'Analyze a WAV audio file to detect beats, tempo (BPM), and energy curve. Returns beat timestamps and energy data that can be passed to plan_sequence for beat-synced editing. Supports 16-bit and 24-bit PCM WAV files.',
      inputSchema: {
        type: 'object',
        properties: {
          audio_path: {
            type: 'string',
            description: 'Absolute path to a WAV audio file.',
          },
          options: {
            type: 'object',
            description: 'Detection options: windowSize (default 1024), hopSize (default 512), threshold (default 1.3), minBeatInterval (default 0.2s).',
            properties: {
              windowSize: { type: 'number' },
              hopSize: { type: 'number' },
              threshold: { type: 'number' },
              minBeatInterval: { type: 'number' },
            },
          },
        },
        required: ['audio_path'],
      },
    },
    {
      name: 'sync_sequence_to_beats',
      description:
        'Align a sequence manifest\'s scene transitions to beat points from analyze_beats. Adjusts scene durations (±15% max) so transitions land on beats. Returns adjusted manifest, sync report with score, hit markers, and optional audio cue suggestions. Use after plan_sequence + analyze_beats to make audio a first-class motion driver.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Sequence manifest (from plan_sequence or inline). Must have a `scenes` array with `duration_s` per scene.',
          },
          beats: {
            type: 'object',
            description: 'Beat analysis data from analyze_beats. Shape: { beats: [{ time_s, strength, type }], tempo_bpm, energy_curve: [{ time_s, energy }], duration_s }.',
          },
          options: {
            type: 'object',
            description: 'Sync options.',
            properties: {
              sync_mode: {
                type: 'string',
                enum: ['tight', 'loose'],
                description: 'Sync tolerance: tight (100ms) or loose (200ms). Default: tight.',
              },
              max_adjust_pct: {
                type: 'number',
                description: 'Max duration adjustment as fraction (default: 0.15 = 15%).',
              },
              include_hit_markers: {
                type: 'boolean',
                description: 'Include hit marker analysis in response (default: true).',
              },
              include_audio_cues: {
                type: 'boolean',
                description: 'Include audio cue suggestions (default: false). Requires archetype_slug.',
              },
              archetype_slug: {
                type: 'string',
                description: 'Sequence archetype for audio cue planning (e.g. product-launch, sizzle-reel).',
              },
              hit_sensitivity: {
                type: 'number',
                description: 'Hit marker sensitivity threshold 0-1 (default: 0.5).',
              },
            },
          },
        },
        required: ['manifest', 'beats'],
      },
    },
    {
      name: 'create_personality',
      description:
        'Create a custom personality definition. Validates the definition, derives guardrail boundaries and shot grammar restrictions from characteristics, and registers it for use in the current session. Custom personalities work with all pipeline tools (plan_sequence, evaluate_sequence, etc.).',
      inputSchema: {
        type: 'object',
        properties: {
          definition: {
            type: 'object',
            description: 'Personality definition. Required: name (string), slug (lowercase kebab-case). Optional: characteristics (contrast, motion_intensity, color_mode, entrance_style, transition_style, perspective, signature_effect), camera_behavior (mode: full-3d|2d-only|attention-direction|none, allowed_movements, depth_of_field, parallax, ambient_motion), duration_overrides, easing_overrides, speed_hierarchy, ai_guidance.',
          },
        },
        required: ['definition'],
      },
    },
    {
      name: 'list_personalities',
      description:
        'List all available personalities (built-in and custom). Shows slug, name, camera mode, motion intensity, and whether it is built-in or custom.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'compile_motion',
      description:
        'Compile a v2 or v3 scene into a frame-addressed Level 2 Motion Timeline. Supports v2 motion blocks (groups, recipes, stagger, cues) and v3 semantic blocks (components, interactions, camera_behavior). v3 scenes are pre-compiled to v2 motion groups before the 7-step pipeline runs. The timeline contains per-layer keyframe tracks and camera tracks consumable by the Remotion renderer.',
      inputSchema: {
        type: 'object',
        properties: {
          scene: {
            type: 'object',
            description: 'A v2 or v3 scene definition. v2: `motion` block with groups, recipes, stagger, cues, camera sync. v3: `semantic` block with components, interactions, camera_behavior.',
          },
          personality: {
            type: 'string',
            enum: getAllPersonalitySlugs(),
            description: 'Personality for guardrail validation (optional, uses scene.personality if not provided)',
          },
        },
        required: ['scene'],
      },
    },
    {
      name: 'critique_motion',
      description:
        'Analyze a compiled Level 2 motion timeline for quality issues: dead holds, flat motion, missing hierarchy, repetitive easing, orphan layers, camera-motion mismatch, and excessive simultaneity. Returns a 0-100 quality score with actionable revision suggestions. Use after compile_motion to validate motion choreography.',
      inputSchema: {
        type: 'object',
        properties: {
          timeline: {
            type: 'object',
            description: 'A compiled Level 2 motion timeline (output of compile_motion) with scene_id, duration_frames, fps, and tracks.',
          },
          scene: {
            type: 'object',
            description: 'The original scene definition with layers array. Used to detect orphan layers and hierarchy.',
          },
        },
        required: ['timeline', 'scene'],
      },
    },
    {
      name: 'run_benchmarks',
      description:
        'Run the benchmark suite of gold-standard scenes. Compiles each benchmark through the motion compiler, runs the critic, and returns per-scene scores and aggregate stats. No parameters required.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'generate_video',
      description:
        'One-shot video pipeline: natural language prompt → scenes + manifest + timelines + quality scores. Runs the full brief → generate → analyze → plan → compile → critique → evaluate pipeline in a single call. Returns everything needed to render with Remotion.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description:
              'Natural language video description, e.g. "30-second promo for an AI finance dashboard, cinematic-dark, prestige style"',
          },
          style: {
            type: 'string',
            description: 'Override auto-detected style pack',
            enum: ['prestige', 'energy', 'dramatic', 'minimal', 'intimate', 'corporate', 'kinetic', 'fade'],
          },
          personality: {
            type: 'string',
            description: 'Override auto-detected personality',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
          },
          enhance: {
            type: 'boolean',
            description: 'Enable LLM enhancement (requires ANTHROPIC_API_KEY). Default: false.',
          },
        },
        required: ['prompt'],
      },
    },
    // ── Sequence Archetype Tools ───────────────────────────────────────────────
    {
      name: 'recommend_sequence_archetype',
      description:
        'Recommend a sequence archetype (multi-scene recipe) for a given output type. Returns scene roles, transitions, camera progression, pacing profile, and recommended primitives.',
      inputSchema: {
        type: 'object',
        properties: {
          output_type: {
            type: 'string',
            description: 'What kind of video: brand-teaser, feature-reveal, onboarding-explainer, launch-reel, testimonial-cutdown, social-loop, or a freeform description',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Filter by personality compatibility',
          },
          duration_s: {
            type: 'number',
            description: 'Target duration in seconds — helps narrow archetype selection',
          },
        },
        required: ['output_type'],
      },
    },
    // ── Project Management Tools ─────────────────────────────────────────────
    {
      name: 'init_project',
      description:
        'Create a new animation project with full folder structure and project.json. Projects represent one end-to-end motion deliverable: brief → storyboard → scenes → motion → renders → review.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Human-readable project title' },
          slug: { type: 'string', description: 'URL-safe project slug (e.g., fintech-sizzle)' },
          date_prefix: { type: 'boolean', description: 'Prepend YYYY-MM-DD to folder name (default: true)' },
          brand: { type: 'string', description: 'Brand identifier' },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Animation personality',
          },
          style_pack: {
            type: 'string',
            enum: ['prestige', 'energy', 'dramatic', 'minimal', 'intimate', 'corporate', 'kinetic', 'fade'],
            description: 'Style pack',
          },
          resolution: {
            type: 'object',
            properties: { w: { type: 'number' }, h: { type: 'number' } },
            description: 'Output resolution (default: 1920x1080)',
          },
          fps: { type: 'number', description: 'Frame rate (default: 60)' },
          duration_target_s: { type: 'number', description: 'Target duration in seconds' },
        },
        required: ['title', 'slug'],
      },
    },
    {
      name: 'list_projects',
      description:
        'List animation projects with status, personality, latest render, and updated date. Filter by status.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'blocked', 'in_review', 'approved', 'archived'],
            description: 'Filter by project status',
          },
          limit: { type: 'number', description: 'Max results (default: 20)' },
        },
      },
    },
    {
      name: 'get_project',
      description:
        'Get full project.json plus resolved paths for an animation project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project slug or path' },
        },
        required: ['project'],
      },
    },
    {
      name: 'get_project_context',
      description:
        'Get the minimum useful working context for a project. Returns brief, storyboard, scenes, manifest, and/or review content.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project slug or path' },
          include: {
            type: 'array',
            items: { type: 'string', enum: ['brief', 'storyboard', 'scenes', 'manifest', 'review'] },
            description: 'Which context sections to include',
          },
        },
        required: ['project'],
      },
    },
    {
      name: 'save_project_artifact',
      description:
        'Register or update an artifact in a project. Updates entrypoints and optionally writes metadata into project.json.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project slug' },
          kind: { type: 'string', enum: ['brief', 'storyboard', 'manifest', 'render', 'scene', 'version', 'review'], description: 'Artifact type' },
          role: { type: 'string', description: 'Entrypoint role to update (e.g., latest_render, approved_render)' },
          path: { type: 'string', description: 'Relative path within project' },
          scene_id: { type: 'string', description: 'Scene ID (for scene artifacts)' },
          version_id: { type: 'string', description: 'Version ID (for version artifacts)' },
          metadata: { type: 'object', description: 'Additional metadata to store' },
        },
        required: ['project', 'kind', 'path'],
      },
    },
    {
      name: 'render_project',
      description:
        'Render a project manifest to video. Writes output to renders/ within the project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project slug' },
          manifest: { type: 'string', description: 'Relative path to manifest within project (default: root_manifest from project.json)' },
          output: { type: 'string', description: 'Relative output path within project (default: renders/draft/)' },
          mark_as_latest: { type: 'boolean', description: 'Update entrypoints.latest_render (default: true)' },
        },
        required: ['project'],
      },
    },
    {
      name: 'review_project',
      description:
        'Run evaluation and critic tools on a project and store outputs in review/.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project slug' },
          manifest: { type: 'string', description: 'Relative path to manifest within project' },
        },
        required: ['project'],
      },
    },
    // ── Art direction ─────────────────────────────────────────────────────
    {
      name: 'get_art_direction',
      description:
        'Get an art direction definition by slug. Returns typography, palette, textures, lighting, logo behavior, background treatment, and compatibility metadata. Art direction is separate from personality: personality tells you how things move, art direction tells you why they feel premium.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            enum: ART_DIRECTION_SLUGS,
            description: 'Art direction slug',
          },
        },
        required: ['slug'],
      },
    },
    {
      name: 'list_art_directions',
      description:
        'List art directions, optionally filtered by compatible personality or style pack. Returns summary entries with slug, name, description, and compatibility lists.',
      inputSchema: {
        type: 'object',
        properties: {
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Filter by compatible personality',
          },
          style_pack: {
            type: 'string',
            description: 'Filter by compatible style pack name',
          },
        },
      },
    },
    // ── Hero moments ──────────────────────────────────────────────────────
    {
      name: 'plan_hero_moments',
      description:
        'Recommend hero moment primitives for a scene based on its role and personality. Hero moments are non-entrance compound primitives designed for climax/peak beats in videos — product freeze frames, metric explosions, logo resolves, etc. Returns filtered and ranked recommendations with usage guidance.',
      inputSchema: {
        type: 'object',
        properties: {
          scene_role: {
            type: 'string',
            description: 'The role this scene plays in the sequence (e.g., "hero_product", "metric_reveal", "logo_close", "comparison", "data_insight", "feature_options", "spatial_transition")',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Animation personality to filter by affinity',
          },
          duration_s: {
            type: 'number',
            description: 'Available duration in seconds — filters out primitives that exceed it (optional)',
          },
          count: {
            type: 'number',
            description: 'Max number of recommendations to return (default: 3)',
          },
        },
        required: ['scene_role', 'personality'],
      },
    },
    // ── Compositing ──────────────────────────────────────────────────────
    {
      name: 'score_brand_finish',
      description:
        'Recommend a multi-pass compositing stack (bloom, grain, vignette, DOF, etc.) for a personality + style pack combination, and score the finishing quality (0-100). Returns ordered compositing passes with resolved CSS properties and quality breakdown.',
      inputSchema: {
        type: 'object',
        properties: {
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Personality slug',
          },
          style_pack: {
            type: 'string',
            description: 'Style pack name (e.g., dramatic, intimate, prestige, energy)',
          },
          art_direction: {
            type: 'string',
            description: 'Art direction slug (optional, reserved for future integration)',
          },
          passes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slug: { type: 'string', enum: COMPOSITING_PASS_SLUGS },
                overrides: { type: 'object' },
              },
              required: ['slug'],
            },
            description: 'Optional custom passes to score instead of the recommended stack',
          },
        },
        required: ['personality'],
      },
    },
    // ── Brand packages ─────────────────────────────────────────────────
    {
      name: 'create_brand_package',
      description:
        'Create a new brand package with per-client visual identity: colors, typography, motion rules, logo behavior, and compliance guidelines. Writes to catalog/brands/{brand_id}.json. Returns the created brand object.',
      inputSchema: {
        type: 'object',
        properties: {
          brand_id: {
            type: 'string',
            description: 'URL-safe identifier in kebab-case (e.g., "acme-corp")',
          },
          name: {
            type: 'string',
            description: 'Display name for the brand',
          },
          description: {
            type: 'string',
            description: 'Short description of brand positioning',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Default animation personality',
          },
          style: {
            type: 'string',
            description: 'Default style pack name (e.g., prestige, dramatic, energy)',
          },
          colors: {
            type: 'object',
            description: 'Brand color tokens: bg_primary, text_primary, accent, etc.',
          },
          typography: {
            type: 'object',
            description: 'Typography tokens: font_family, hero, tagline, heading, body, label',
          },
          logo: {
            type: 'object',
            description: 'Logo configuration: primary, monochrome, icon_only, safe_zone_pct, min_size_px',
          },
          intro_outro: {
            type: 'object',
            description: 'Logo intro/outro animation: intro_style, intro_duration_ms, outro_style, outro_duration_ms, outro_hold_ms',
          },
          motion: {
            type: 'object',
            description: 'Motion rules: preferred_personality, preferred_style_pack, preferred_easing, forbidden_moves[], max_intensity (0-1)',
          },
          guidelines: {
            type: 'object',
            description: 'Brand guidelines: dos[] and donts[]',
          },
        },
        required: ['brand_id', 'name'],
      },
    },
    {
      name: 'get_brand_package',
      description:
        'Load a brand package by brand_id. Returns full brand specification including colors, typography, motion rules, logo config, and guidelines.',
      inputSchema: {
        type: 'object',
        properties: {
          brand_id: {
            type: 'string',
            description: 'Brand identifier (e.g., "fintech-demo", "mercury", "_default")',
          },
        },
        required: ['brand_id'],
      },
    },
    {
      name: 'list_brand_packages',
      description:
        'List all available brand packages. Returns brand_id, name, personality, and style for each.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'validate_brand_compliance',
      description:
        'Check a manifest and its scenes against a brand\'s guidelines. Returns violations (forbidden camera moves, intensity limits, unapproved colors, personality mismatches). Empty violations array means fully compliant.',
      inputSchema: {
        type: 'object',
        properties: {
          brand_id: {
            type: 'string',
            description: 'Brand to validate against',
          },
          manifest: {
            type: 'object',
            description: 'Sequence manifest to check',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Scene objects to check for camera/color compliance',
          },
        },
        required: ['brand_id'],
      },
    },
    // ── Product archetypes ─────────────────────────────────────────────
    {
      name: 'score_product_demo_clarity',
      description:
        'Score a product demo manifest + scenes for clarity and quality (0–100). Evaluates interaction truthfulness (cursor timing, text rhythm), camera intent consistency, pacing variety, and clear hierarchy. Returns score breakdown and actionable warnings.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Sequence manifest with scenes array',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of scene definitions to evaluate',
          },
        },
        required: ['scenes'],
      },
    },
    // ── AI Demo & Finishing Tools ──────────────────────────────────────────
    {
      name: 'instantiate_sequence_archetype',
      description:
        'Generate a manifest skeleton from an AI demo sequence archetype (prompt_to_answer, brief_to_board, query_to_report, upload_to_insight). Returns pre-configured scenes with timing, transitions, and camera intent.',
      inputSchema: {
        type: 'object',
        properties: {
          archetype_slug: { type: 'string', description: 'Archetype slug' },
          personality: { type: 'string', enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'] },
          duration_s: { type: 'number', description: 'Target total duration' },
          content_hints: { type: 'object', description: 'Optional content hints per scene role' },
        },
        required: ['archetype_slug'],
      },
    },
    {
      name: 'apply_finish_preset',
      description:
        'Apply a named finishing preset (cinematic-film, clean-digital, editorial-subtle, social-punchy, premium-brand) to a manifest. Adds compositing passes with tuned parameters.',
      inputSchema: {
        type: 'object',
        properties: {
          preset_slug: { type: 'string', description: 'Finish preset slug' },
          manifest: { type: 'object', description: 'Manifest to apply finish to' },
          overrides: { type: 'object', description: 'Optional per-pass overrides' },
        },
        required: ['preset_slug'],
      },
    },
    {
      name: 'audit_motion_density',
      description:
        'Analyze motion density in a scene timeline. Returns density score (0-100, 50=ideal), hold windows, hot spots, and simplification suggestions.',
      inputSchema: {
        type: 'object',
        properties: {
          timeline: { type: 'object', description: 'Compiled timeline object' },
          scene: { type: 'object', description: 'Scene definition' },
        },
        required: ['timeline', 'scene'],
      },
    },
    // ── Storyboard tools ──────────────────────────────────────────────────
    {
      name: 'generate_contact_sheet',
      description:
        'Generate a contact sheet from a manifest and scenes. Returns a structured overview of each scene: thumbnail description, duration, transition, camera, energy. Useful for reviewing a sequence at a glance before rendering. Optionally formats as markdown.',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project slug to load manifest/scenes from (alternative to inline)',
          },
          manifest: {
            type: 'object',
            description: 'Inline sequence manifest (if not loading from project)',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Inline scene definitions (if not loading from project)',
          },
          includeTimecodes: {
            type: 'boolean',
            description: 'Include start/end timecodes per scene. Default: true.',
          },
          includeTechnical: {
            type: 'boolean',
            description: 'Include camera move and energy level per scene. Default: true.',
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown'],
            description: 'Output format. Default: json.',
          },
        },
      },
    },
    {
      name: 'compare_project_versions',
      description:
        'Compare two manifest versions and return a structured diff: scenes added/removed/reordered, duration changes, transition changes, camera changes, and overall timing delta. Useful for reviewing edits between iterations.',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project slug (for future version history support)',
          },
          version_a: {
            type: 'string',
            description: 'Version A identifier (for future version history support)',
          },
          version_b: {
            type: 'string',
            description: 'Version B identifier (for future version history support)',
          },
          manifest_a: {
            type: 'object',
            description: 'First manifest to compare (inline)',
          },
          manifest_b: {
            type: 'object',
            description: 'Second manifest to compare (inline)',
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown'],
            description: 'Output format. Default: json.',
          },
        },
      },
    },
    // ── Editorial canvas ────────────────────────────────────────────────
    {
      name: 'create_editorial_canvas_scene',
      description:
        'Create an editorial canvas scene — a flat art-directed space with anchor-based positioning, safe zones, and floating UI fragments. Returns a valid editorial canvas scene JSON ready for rendering.',
      inputSchema: {
        type: 'object',
        properties: {
          scene_id: {
            type: 'string',
            description: 'Scene ID (must match ^sc_[a-z0-9_]+$)',
          },
          duration_s: {
            type: 'number',
            description: 'Scene duration in seconds (0.5–30)',
          },
          background: {
            type: 'object',
            description: 'Background config: { color, color_alt, treatment }. Treatment: solid, gradient, radial, mesh, blur_plate.',
            properties: {
              color: { type: 'string' },
              color_alt: { type: 'string' },
              treatment: { type: 'string', enum: ['solid', 'gradient', 'radial', 'mesh', 'blur_plate'] },
            },
          },
          safe_zone: {
            type: 'number',
            description: 'Safe zone inset percentage (0–30). Default: 5.',
          },
          camera: {
            type: 'object',
            description: 'Camera config: { move, intensity, easing }. Optional.',
          },
          layers: {
            type: 'array',
            description: 'Array of layer objects: { id, type, content, anchor, max_w, z_bias, depth_class, src, fit }',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                content: { type: 'string' },
                anchor: { type: 'string', enum: ['center', 'top-left', 'top-center', 'top-right', 'center-left', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'] },
                max_w: {},
                z_bias: { type: 'number' },
                depth_class: { type: 'string', enum: ['background', 'midground', 'foreground'] },
                src: { type: 'string' },
                fit: { type: 'string' },
              },
              required: ['id', 'type'],
            },
          },
        },
        required: ['scene_id', 'duration_s', 'layers'],
      },
    },
    {
      name: 'recommend_editorial_layout',
      description:
        'Recommend anchor positioning and layout strategy for editorial canvas scenes. Given a content description and personality, returns recommended patterns with anchor assignments for common editorial layouts (hero-center, split-editorial, floating-fragments, minimal-type).',
      inputSchema: {
        type: 'object',
        properties: {
          content_description: {
            type: 'string',
            description: 'What this editorial scene needs to communicate (e.g., "headline with floating prompt card and result")',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Animation personality for style-appropriate defaults',
          },
        },
        required: ['content_description'],
      },
    },
    // ── Social formats ──────────────────────────────────────────────────
    {
      name: 'adapt_project_aspect_ratio',
      description:
        'Adapt an existing manifest for a different aspect ratio. Adjusts resolution, layer positions, typography scale, safe areas, and camera moves. Use recompose=true to recalculate layer positions (vs. simple crop).',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'The source sequence manifest to adapt',
          },
          target_aspect_ratio: {
            type: 'string',
            enum: ['16:9', '1:1', '4:5', '9:16'],
            description: 'Target aspect ratio',
          },
          recompose: {
            type: 'boolean',
            description: 'If true, recalculate layer positions for the new ratio. If false, simple crop. Default: false.',
          },
        },
        required: ['manifest', 'target_aspect_ratio'],
      },
    },
    {
      name: 'create_social_cutdown',
      description:
        'Create a shortened social version from a full manifest. Selects key scenes, tightens transitions, adapts aspect ratio, and enforces a maximum duration. Returns a new cutdown manifest ready for rendering.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'The source sequence manifest',
          },
          target_aspect_ratio: {
            type: 'string',
            enum: ['16:9', '1:1', '4:5', '9:16'],
            description: 'Target aspect ratio for the cutdown',
          },
          max_duration_s: {
            type: 'number',
            description: 'Maximum total duration in seconds',
          },
          scenes_to_keep: {
            type: 'array',
            items: { type: 'number' },
            description: 'Indices of scenes to keep (0-based). If omitted, auto-selects key scenes.',
          },
        },
        required: ['manifest', 'target_aspect_ratio', 'max_duration_s'],
      },
    },
    {
      name: 'recommend_type_treatment',
      description:
        'Recommend a text animation treatment and styling based on block role, content, personality, and scene energy. Returns the best text animation primitive plus typography styling guidance for editorial-quality film typography.',
      inputSchema: {
        type: 'object',
        properties: {
          block_role: {
            type: 'string',
            enum: ['headline', 'caption', 'label', 'quote'],
            description: 'The semantic role of the text block',
          },
          content: {
            type: 'string',
            description: 'The text content to be animated',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Animation personality context',
          },
          scene_energy: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Energy level of the scene (affects animation intensity)',
          },
        },
        required: ['block_role', 'content', 'personality'],
      },
    },
    // ── Cross-scene continuity ──────────────────────────────────────────
    {
      name: 'suggest_match_cuts',
      description:
        'Analyze adjacent scenes for potential match-cut opportunities even without explicit continuity_ids. Looks for same layer types at similar positions, similar content, and shared assets. Returns ranked suggestions with similarity scores and recommended strategies.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Sequence manifest with scenes array',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of scene definitions (order matches manifest.scenes)',
          },
        },
        required: ['manifest', 'scenes'],
      },
    },
    {
      name: 'plan_continuity_links',
      description:
        'Automatically annotate layers with continuity_ids and add transition_in.match configs to a manifest. Returns an annotated manifest and scene definitions with cross-scene element identity for seamless transitions.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: {
            type: 'object',
            description: 'Sequence manifest with scenes array',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of scene definitions (order matches manifest.scenes)',
          },
          auto_assign_ids: {
            type: 'boolean',
            description: 'Automatically assign continuity_ids to layers that match across scenes. Default: true.',
          },
        },
        required: ['manifest', 'scenes'],
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
    case 'get_style_pack':
      return handleGetStylePack(args);
    case 'evaluate_sequence':
      return handleEvaluateSequence(args);
    case 'validate_manifest':
      return handleValidateManifest(args);
    case 'list_brief_templates':
      return handleListBriefTemplates(args);
    case 'get_brief_template':
      return handleGetBriefTemplate(args);
    case 'generate_scenes':
      return handleGenerateScenes(args);
    case 'plan_variants':
      return handlePlanVariants(args);
    case 'compare_variants':
      return handleCompareVariants(args);
    case 'analyze_beats':
      return handleAnalyzeBeats(args);
    case 'sync_sequence_to_beats':
      return handleSyncSequenceToBeats(args);
    case 'create_personality':
      return handleCreatePersonality(args);
    case 'list_personalities':
      return handleListPersonalities(args);
    case 'compile_motion':
      return handleCompileMotion(args);
    case 'critique_motion':
      return handleCritiqueMotion(args);
    case 'run_benchmarks':
      return handleRunBenchmarks(args);
    case 'generate_video':
      return handleGenerateVideo(args);
    // ── Sequence archetypes ─────────────────────────────────────────────
    case 'recommend_sequence_archetype':
      return handleRecommendSequenceArchetype(args);
    // ── Project management ────────────────────────────────────────────────
    case 'init_project':
      return handleInitProject(args);
    case 'list_projects':
      return handleListProjects(args);
    case 'get_project':
      return handleGetProject(args);
    case 'get_project_context':
      return handleGetProjectContext(args);
    case 'save_project_artifact':
      return handleSaveProjectArtifact(args);
    case 'render_project':
      return handleRenderProject(args);
    case 'review_project':
      return handleReviewProject(args);
    // ── Art direction ─────────────────────────────────────────────────────
    case 'get_art_direction':
      return handleGetArtDirection(args);
    case 'list_art_directions':
      return handleListArtDirections(args);
    // ── Hero moments ─────────────────────────────────────────────────────
    case 'plan_hero_moments':
      return handlePlanHeroMoments(args);
    // ── Compositing ─────────────────────────────────────────────────────
    case 'score_brand_finish':
      return handleScoreBrandFinish(args);
    // ── Brand packages ──────────────────────────────────────────────────
    case 'create_brand_package':
      return handleCreateBrandPackage(args);
    case 'get_brand_package':
      return handleGetBrandPackage(args);
    case 'list_brand_packages':
      return handleListBrandPackages(args);
    case 'validate_brand_compliance':
      return handleValidateBrandCompliance(args);
    // ── Product archetypes ───────────────────────────────────────────────
    case 'score_product_demo_clarity':
      return handleScoreProductDemoClarity(args);
    // ── Storyboard tools ──────────────────────────────────────────────────
    case 'instantiate_sequence_archetype':
      return handleInstantiateSequenceArchetype(args);
    case 'apply_finish_preset':
      return handleApplyFinishPreset(args);
    case 'audit_motion_density':
      return handleAuditMotionDensity(args);
    case 'generate_contact_sheet':
      return handleGenerateContactSheet(args);
    case 'compare_project_versions':
      return handleCompareProjectVersions(args);
    // ── Editorial canvas ─────────────────────────────────────────────────
    case 'create_editorial_canvas_scene':
      return handleCreateEditorialCanvasScene(args);
    case 'recommend_editorial_layout':
      return handleRecommendEditorialLayout(args);
    // ── Social formats ──────────────────────────────────────────────────
    case 'adapt_project_aspect_ratio':
      return handleAdaptProjectAspectRatio(args);
    case 'create_social_cutdown':
      return handleCreateSocialCutdown(args);
    // ── Typography motion ─────────────────────────────────────────────────
    case 'recommend_type_treatment':
      return handleRecommendTypeTreatment(args);
    // ── Cross-scene continuity ─────────────────────────────────────────
    case 'suggest_match_cuts':
      return handleSuggestMatchCuts(args);
    case 'plan_continuity_links':
      return handlePlanContinuityLinks(args);
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

  // Compound primitive: show config schema + sub-primitives
  if (catalogEntry?.source === 'compound') {
    out += '## Compound JS Primitive\n\n';
    out += `**Requires JS:** ${catalogEntry.requires_js}\n`;
    out += `**Entry Point:** ${catalogEntry.entry_point}\n`;
    if (catalogEntry.remotion_component) {
      out += `**Remotion Component:** ${catalogEntry.remotion_component}\n`;
    }
    out += '\n### Configuration Schema\n\n```json\n';
    out += JSON.stringify(catalogEntry.config_schema, null, 2);
    out += '\n```\n\n';

    if (catalogEntry.content_schema) {
      out += '### Content Schema\n\n```json\n';
      out += JSON.stringify(catalogEntry.content_schema, null, 2);
      out += '\n```\n\n';
    }

    if (catalogEntry.sub_primitives?.length) {
      out += '### Sub-Primitives\n\n';
      for (const sub of catalogEntry.sub_primitives) {
        out += `- **${sub.id}** (${sub.name})`;
        if (sub.extractable_as_css) out += ' [CSS-extractable]';
        out += ` — ${sub.description}\n`;
        if (sub.css) {
          out += '  ```css\n  ' + sub.css + '\n  ```\n';
        }
      }
      out += '\n';
    }
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

  // Reasoning chain (ANI-45)
  if (result.reasoning) {
    out += '## Reasoning\n\n';
    for (const [field, explanation] of Object.entries(result.reasoning)) {
      out += `- **${field}:** ${explanation}\n`;
    }
    out += '\n';
  }

  // Low confidence warnings
  const lowConfidence = Object.entries(_confidence).filter(([, v]) => v < 0.50);
  if (lowConfidence.length > 0) {
    out += '**Low confidence warnings:**\n';
    for (const [field, conf] of lowConfidence) {
      out += `- \`${field}\` at ${(conf * 100).toFixed(0)}% — consider manual override or LLM-assisted reclassification\n`;
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── get_style_pack ──────────────────────────────────────────────────────────

function handleGetStylePack(args) {
  const { name } = args;
  const pack = stylePacksCatalog.byName.get(name);

  if (!pack) {
    return {
      content: [{
        type: 'text',
        text: `Unknown style pack "${name}". Available: ${STYLE_PACKS.join(', ')}`,
      }],
      isError: true,
    };
  }

  const personality = personalitiesCatalog.bySlug.get(pack.personality);

  let out = `# Style Pack: ${pack.name}\n\n`;
  out += `**Personality:** ${pack.personality}${personality ? ` (${personality.name})` : ''}\n`;
  out += `**Description:** ${pack.description}\n\n`;

  // Hold durations
  out += '## Hold Durations\n\n';
  out += '| Motion Energy | Duration |\n';
  out += '|--------------|----------|\n';
  for (const [energy, dur] of Object.entries(pack.hold_durations)) {
    out += `| ${energy} | ${dur}s |\n`;
  }
  if (pack.max_hold_duration != null) {
    out += `\n**Max hold duration:** ${pack.max_hold_duration}s\n`;
  }

  // Transition rules
  out += '\n## Transition Rules\n\n';
  out += 'Evaluated in priority order:\n\n';
  const ruleOrder = ['pattern', 'on_same_weight', 'on_weight_change', 'on_intent', 'default'];
  let ruleNum = 1;
  for (const key of ruleOrder) {
    if (pack.transitions[key]) {
      out += `${ruleNum}. **${key}:** `;
      const rule = pack.transitions[key];
      if (key === 'pattern') {
        out += `Every ${rule.every_n}rd transition → cycle [${rule.cycle.join(', ')}] (${rule.duration_ms}ms)\n`;
      } else if (key === 'on_intent') {
        out += `Tags [${rule.tags.join(', ')}] → ${rule.transition.type}${rule.transition.duration_ms ? ` (${rule.transition.duration_ms}ms)` : ''}\n`;
      } else {
        out += `${rule.type}${rule.duration_ms ? ` (${rule.duration_ms}ms)` : ''}\n`;
      }
      ruleNum++;
    }
  }

  // Camera override rules
  out += '\n## Camera Override Rules\n\n';
  if (pack.camera_overrides.force_static) {
    out += 'All scenes: `{ move: "static" }` (personality forbids camera movement)\n';
  }
  if (pack.camera_overrides.by_content_type) {
    out += '**By content type:**\n\n';
    out += '| Content Type | Move | Intensity |\n';
    out += '|-------------|------|----------|\n';
    for (const [ct, cam] of Object.entries(pack.camera_overrides.by_content_type)) {
      out += `| ${ct} | ${cam.move} | ${cam.intensity} |\n`;
    }
    out += '\nUnmatched content types: no override\n';
  }
  if (pack.camera_overrides.by_intent) {
    out += '**By intent tag:**\n\n';
    out += '| Intent Tag | Move | Intensity |\n';
    out += '|-----------|------|----------|\n';
    for (const [tag, cam] of Object.entries(pack.camera_overrides.by_intent)) {
      out += `| ${tag} | ${cam.move} | ${cam.intensity} |\n`;
    }
    out += '\nUnmatched intents: no override\n';
  }

  // Personality camera constraints
  if (personality?.camera_behavior) {
    out += '\n## Personality Camera Constraints\n\n';
    const cam = personality.camera_behavior;
    out += `**Mode:** ${cam.mode}\n`;
    out += `**Allowed movements:** ${cam.allowed_movements.length > 0 ? cam.allowed_movements.join(', ') : 'none'}\n`;
    if (cam.constraints) {
      out += `**Constraints:** ${cam.constraints}\n`;
    }
  }

  // Raw JSON
  out += '\n## Raw Definition\n\n```json\n';
  out += JSON.stringify(pack, null, 2);
  out += '\n```\n';

  return { content: [{ type: 'text', text: out }] };
}

// ── plan_sequence ───────────────────────────────────────────────────────────

function handlePlanSequence(args) {
  const { scenes, style, beats } = args;

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
    const { manifest, notes } = planSequence({ scenes, style, beats });

    let out = `# Sequence Plan: ${manifest.sequence_id}\n\n`;
    out += `**Style:** ${style} (${notes.style_personality})\n`;
    out += `**Scenes:** ${notes.scene_count}\n`;
    out += `**Total Duration:** ${notes.total_duration_s}s\n`;
    if (notes.beat_sync) {
      out += `**Beat Sync:** ${notes.beat_sync.adjustments_count} scene(s) adjusted to beat grid`;
      if (notes.beat_sync.bpm) out += ` (${notes.beat_sync.bpm} BPM)`;
      out += '\n';
    }
    out += '\n';

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

    // Per-scene reasoning (ANI-45)
    if (notes.reasoning && notes.reasoning.length > 0) {
      out += '\n## Reasoning\n\n';
      for (const r of notes.reasoning) {
        out += `### ${r.scene}\n`;
        out += `- **Duration:** ${r.duration}\n`;
        out += `- **Transition:** ${r.transition}\n`;
        out += `- **Camera:** ${r.camera}\n`;
        if (r.shot_grammar) out += `- **Shot grammar:** ${r.shot_grammar}\n`;
        out += '\n';
      }
    }

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

// ── evaluate_sequence ───────────────────────────────────────────────────────

function handleEvaluateSequence(args) {
  const { manifest, scenes, style } = args;

  if (!manifest || !manifest.scenes || !Array.isArray(manifest.scenes)) {
    return {
      content: [{
        type: 'text',
        text: 'Invalid input: `manifest` must be an object with a `scenes` array.',
      }],
      isError: true,
    };
  }

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
    const result = evaluateSequence({ manifest, scenes, style });

    let out = `# Sequence Evaluation\n\n`;
    out += `**Overall Score:** ${result.score}/100\n\n`;

    // Dimension scores table
    out += '## Dimension Scores\n\n';
    out += '| Dimension | Score |\n';
    out += '|-----------|-------|\n';
    for (const [dim, data] of Object.entries(result.dimensions)) {
      out += `| ${dim} | ${data.score}/100 |\n`;
    }

    // Findings grouped by severity
    if (result.findings.length > 0) {
      out += '\n## Findings\n\n';

      const warnings = result.findings.filter(f => f.severity === 'warning');
      const infos = result.findings.filter(f => f.severity === 'info');
      const suggestions = result.findings.filter(f => f.severity === 'suggestion');

      if (warnings.length > 0) {
        out += '### Warnings\n\n';
        for (const f of warnings) {
          out += `- **[${f.dimension}]** ${f.message}${f.scene_index != null ? ` (scene ${f.scene_index + 1})` : ''}\n`;
        }
        out += '\n';
      }

      if (infos.length > 0) {
        out += '### Info\n\n';
        for (const f of infos) {
          out += `- **[${f.dimension}]** ${f.message}${f.scene_index != null ? ` (scene ${f.scene_index + 1})` : ''}\n`;
        }
        out += '\n';
      }

      if (suggestions.length > 0) {
        out += '### Suggestions\n\n';
        for (const f of suggestions) {
          out += `- **[${f.dimension}]** ${f.message}${f.scene_index != null ? ` (scene ${f.scene_index + 1})` : ''}\n`;
        }
        out += '\n';
      }
    } else {
      out += '\nNo findings — sequence looks good!\n';
    }

    // Raw JSON
    out += '\n## Raw Result\n\n```json\n';
    out += JSON.stringify(result, null, 2);
    out += '\n```\n';

    return { content: [{ type: 'text', text: out }] };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Error evaluating sequence: ${err.message}`,
      }],
      isError: true,
    };
  }
}

// ── validate_manifest ───────────────────────────────────────────────────────

function handleValidateManifest(args) {
  const { manifest, personality } = args;

  if (!manifest || !manifest.scenes || !Array.isArray(manifest.scenes)) {
    return {
      content: [{
        type: 'text',
        text: 'Invalid input: `manifest` must be an object with a `scenes` array.',
      }],
      isError: true,
    };
  }

  const validPersonalities = ['cinematic-dark', 'editorial', 'neutral-light', 'montage'];
  if (!validPersonalities.includes(personality)) {
    return {
      content: [{
        type: 'text',
        text: `Invalid personality "${personality}". Valid: ${validPersonalities.join(', ')}`,
      }],
      isError: true,
    };
  }

  const result = validateFullManifest(manifest, personality);

  let out = `# Manifest Validation: **${result.verdict}**\n\n`;
  out += `**Personality:** ${personality}\n`;
  out += `**Scenes:** ${manifest.scenes.length}\n\n`;

  // Per-scene results table
  out += '## Per-Scene Results\n\n';
  out += '| # | Scene | Verdict | Blocks | Warnings |\n';
  out += '|---|-------|---------|--------|----------|\n';
  for (const sr of result.sceneResults) {
    const scene = manifest.scenes[sr.sceneIndex];
    const sceneId = scene?.scene || `(scene ${sr.sceneIndex + 1})`;
    out += `| ${sr.sceneIndex + 1} | ${sceneId} | ${sr.verdict} | ${sr.blocks.length} | ${sr.warnings.length} |\n`;
  }
  out += '\n';

  // Grouped findings
  const allBlocks = result.sceneResults.flatMap(sr =>
    sr.blocks.map(b => ({ ...b, sceneIndex: sr.sceneIndex }))
  );
  const allWarnings = result.sceneResults.flatMap(sr =>
    sr.warnings.map(w => ({ ...w, sceneIndex: sr.sceneIndex }))
  );

  if (allBlocks.length > 0) {
    out += `## Blocking Violations (${allBlocks.length})\n\n`;
    for (const b of allBlocks) {
      out += `- **Scene ${b.sceneIndex + 1}:** ${b.message}\n`;
    }
    out += '\n';
  }

  if (allWarnings.length > 0) {
    out += `## Warnings (${allWarnings.length})\n\n`;
    for (const w of allWarnings) {
      out += `- **Scene ${w.sceneIndex + 1}:** ${w.message}\n`;
    }
    out += '\n';
  }

  if (result.cumulativeFindings.length > 0) {
    out += `## Cumulative Findings (${result.cumulativeFindings.length})\n\n`;
    for (const f of result.cumulativeFindings) {
      out += `- ${f.message}\n`;
    }
    out += '\n';
  }

  if (result.verdict === 'PASS' && result.cumulativeFindings.length === 0) {
    out += `All ${manifest.scenes.length} scenes pass guardrail validation for ${personality}.\n`;
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── list_brief_templates ─────────────────────────────────────────────────────

function handleListBriefTemplates() {
  const templates = briefTemplatesCatalog.array;

  let out = '# Brief Templates\n\n';
  out += `${templates.length} templates available for scene generation.\n\n`;
  out += '| Template | Name | Style | Scenes | Description |\n';
  out += '|----------|------|-------|--------|-------------|\n';
  for (const t of templates) {
    out += `| \`${t.template_id}\` | ${t.name} | ${t.defaults.style} | ${t.suggested_scene_count.min}-${t.suggested_scene_count.max} | ${t.description} |\n`;
  }
  out += '\nUse `get_brief_template` to see section structure, suggested layouts, and example content.\n';

  return { content: [{ type: 'text', text: out }] };
}

// ── get_brief_template ──────────────────────────────────────────────────────

function handleGetBriefTemplate(args) {
  const { template_id } = args;
  const template = briefTemplatesCatalog.byId.get(template_id);

  if (!template) {
    const valid = briefTemplatesCatalog.array.map(t => t.template_id).join(', ');
    return {
      content: [{
        type: 'text',
        text: `Unknown brief template "${template_id}". Available: ${valid}`,
      }],
      isError: true,
    };
  }

  let out = `# Brief Template: ${template.name}\n\n`;
  out += `**ID:** \`${template.template_id}\`\n`;
  out += `**Description:** ${template.description}\n\n`;

  // Defaults
  out += '## Defaults\n\n';
  out += `| Setting | Value |\n`;
  out += `|---------|-------|\n`;
  out += `| Style pack | ${template.defaults.style} |\n`;
  out += `| Duration target | ${template.defaults.duration_target_s}s |\n`;
  out += `| Tone mood | ${template.defaults.tone.mood} |\n`;
  out += `| Tone energy | ${template.defaults.tone.energy} |\n`;
  out += `| Scene count | ${template.suggested_scene_count.min}-${template.suggested_scene_count.max} |\n`;

  // Sections
  out += '\n## Sections\n\n';
  out += '| # | Label | Layout | Content Type | Intent | Repeat | Optional |\n';
  out += '|---|-------|--------|-------------|--------|--------|----------|\n';
  for (let i = 0; i < template.sections.length; i++) {
    const s = template.sections[i];
    const repeat = s.repeat ? `${s.repeat.min}-${s.repeat.max}` : '1';
    out += `| ${i + 1} | **${s.label}** | ${s.suggested_layout} | ${s.suggested_content_type} | ${s.intent_tags.join(', ')} | ${repeat} | ${s.optional ? 'yes' : 'no'} |\n`;
  }

  out += '\n### Section Details\n\n';
  for (const s of template.sections) {
    out += `**${s.label}:** ${s.description}\n`;
  }

  // Example
  if (template.example) {
    out += '\n## Example Brief\n\n```json\n';
    out += JSON.stringify(template.example, null, 2);
    out += '\n```\n';
  }

  // Raw JSON
  out += '\n## Raw Definition\n\n```json\n';
  out += JSON.stringify(template, null, 2);
  out += '\n```\n';

  return { content: [{ type: 'text', text: out }] };
}

// ── generate_scenes ─────────────────────────────────────────────────────────

async function handleGenerateScenes(args) {
  const { brief, enhance = false, format } = args;

  if (!brief || typeof brief !== 'object') {
    return {
      content: [{
        type: 'text',
        text: 'Invalid input: `brief` must be a JSON object. See `get_brief_template` for the expected structure.',
      }],
      isError: true,
    };
  }

  try {
    const { scenes, notes } = await generateScenes(brief, { enhance, format });

    let out = `# Generated Scenes\n\n`;
    out += `**Template:** ${notes.template}\n`;
    out += `**Format:** ${notes.format}\n`;
    out += `**Style:** ${notes.style}\n`;
    out += `**Scenes:** ${notes.scene_count}\n`;
    out += `**Total Duration:** ${notes.total_duration_s.toFixed(1)}s\n`;
    if (notes.llm_enhancement) {
      out += `**LLM Enhancement:** ${notes.llm_enhancement.join('; ')}\n`;
    }
    out += '\n';

    // Scene list table
    out += '## Scenes\n\n';
    out += '| # | Scene ID | Content Type | Layout | Duration | Intent |\n';
    out += '|---|----------|-------------|--------|----------|--------|\n';
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const m = s.metadata || {};
      out += `| ${i + 1} | \`${s.scene_id}\` | ${m.content_type || '—'} | ${s.layout?.template || '—'} | ${s.duration_s}s | ${(m.intent_tags || []).join(', ') || '—'} |\n`;
    }

    // Asset classification table
    if (notes.asset_classification.length > 0) {
      out += '\n## Asset Classification\n\n';
      out += '| Asset ID | Content Type | Confidence | Role | Source |\n';
      out += '|----------|-------------|------------|------|--------|\n';
      for (const a of notes.asset_classification) {
        out += `| ${a.id} | ${a.content_type} | ${(a.confidence * 100).toFixed(0)}% | ${a.role} | ${a.source} |\n`;
      }
    }

    // Full scenes JSON
    out += '\n## Full Scenes JSON\n\n```json\n';
    out += JSON.stringify(scenes, null, 2);
    out += '\n```\n';

    return { content: [{ type: 'text', text: out }] };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Scene generation failed: ${err.message}`,
      }],
      isError: true,
    };
  }
}

// ── Start server ────────────────────────────────────────────────────────────

// ── plan_variants (ANI-44) ──────────────────────────────────────────────────

function handlePlanVariants(args) {
  const { scenes, styles, sequence_id } = args;

  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return {
      content: [{ type: 'text', text: 'Invalid input: `scenes` must be a non-empty array of scene objects with metadata.' }],
      isError: true,
    };
  }

  if (!styles || !Array.isArray(styles) || styles.length < 2) {
    return {
      content: [{ type: 'text', text: 'Invalid input: `styles` must be an array of at least 2 style pack names.' }],
      isError: true,
    };
  }

  for (const style of styles) {
    if (!STYLE_PACKS.includes(style)) {
      return {
        content: [{ type: 'text', text: `Invalid style "${style}". Valid styles: ${STYLE_PACKS.join(', ')}` }],
        isError: true,
      };
    }
  }

  try {
    const { variants } = planVariants({ scenes, styles, sequence_id });

    let out = `# A/B Variants: ${variants.length} choreographies\n\n`;

    for (const v of variants) {
      out += `## ${v.variant_id} (${v.style})\n\n`;
      out += `**Duration:** ${v.notes.total_duration_s}s | **Scenes:** ${v.notes.scene_count}\n\n`;

      out += '| # | Scene | Duration | Transition | Camera |\n';
      out += '|---|-------|----------|------------|--------|\n';
      for (let i = 0; i < v.manifest.scenes.length; i++) {
        const s = v.manifest.scenes[i];
        const transition = s.transition_in
          ? `${s.transition_in.type}${s.transition_in.duration_ms ? ` (${s.transition_in.duration_ms}ms)` : ''}`
          : '—';
        const camera = s.camera_override
          ? `${s.camera_override.move}${s.camera_override.intensity != null ? ` ${s.camera_override.intensity}` : ''}`
          : '—';
        out += `| ${i + 1} | ${s.scene} | ${s.duration_s}s | ${transition} | ${camera} |\n`;
      }
      out += '\n';
    }

    // Summary comparison
    out += '## Quick Comparison\n\n';
    out += '| Variant | Style | Duration | Transitions |\n';
    out += '|---------|-------|----------|-------------|\n';
    for (const v of variants) {
      const transTypes = Object.entries(v.notes.transition_summary)
        .map(([t, c]) => `${t}×${c}`)
        .join(', ');
      out += `| ${v.variant_id} | ${v.style} | ${v.notes.total_duration_s}s | ${transTypes} |\n`;
    }

    out += '\n*Use `compare_variants` to score and rank these variants.*\n';

    // Append variant data for programmatic use
    out += '\n## Variant Data\n\n```json\n';
    out += JSON.stringify(variants.map(v => ({ variant_id: v.variant_id, style: v.style, manifest: v.manifest })), null, 2);
    out += '\n```\n';

    return { content: [{ type: 'text', text: out }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error planning variants: ${err.message}` }],
      isError: true,
    };
  }
}

// ── compare_variants (ANI-44) ───────────────────────────────────────────────

function handleCompareVariants(args) {
  const { variants, scenes } = args;

  if (!variants || !Array.isArray(variants) || variants.length < 2) {
    return {
      content: [{ type: 'text', text: 'Invalid input: `variants` must be an array of at least 2 variant objects.' }],
      isError: true,
    };
  }

  if (!scenes || !Array.isArray(scenes)) {
    return {
      content: [{ type: 'text', text: 'Invalid input: `scenes` must be an array of analyzed scene objects.' }],
      isError: true,
    };
  }

  try {
    const result = compareVariants({ variants, scenes });

    let out = '# Variant Comparison\n\n';

    // Rankings
    out += '## Rankings\n\n';
    out += '| Rank | Variant | Style | Score | Pacing | Variety | Flow | Adherence |\n';
    out += '|------|---------|-------|-------|--------|---------|------|-----------|\n';
    for (let i = 0; i < result.rankings.length; i++) {
      const r = result.rankings[i];
      out += `| ${i + 1} | ${r.variant_id} | ${r.style} | **${r.score}** | ${r.dimensions.pacing.score} | ${r.dimensions.variety.score} | ${r.dimensions.flow.score} | ${r.dimensions.adherence.score} |\n`;
    }

    // Winner
    const winner = result.rankings[0];
    const margin = result.rankings.length > 1
      ? winner.score - result.rankings[1].score
      : 0;
    out += `\n**Winner:** ${winner.variant_id} (${winner.style}) with score ${winner.score}`;
    if (margin > 0) out += ` (+${margin} over runner-up)`;
    out += '\n';

    // Dimension breakdown
    out += '\n## Per-Dimension Best\n\n';
    for (const [dim, data] of Object.entries(result.comparison)) {
      out += `- **${dim}:** ${data.best_variant} (${data.best_score})\n`;
    }

    out += '\n## Rankings Data\n\n```json\n';
    out += JSON.stringify(result.rankings, null, 2);
    out += '\n```\n';

    return { content: [{ type: 'text', text: out }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error comparing variants: ${err.message}` }],
      isError: true,
    };
  }
}

// ── analyze_beats (ANI-37) ──────────────────────────────────────────────────

function handleAnalyzeBeats(args) {
  const { audio_path, options = {} } = args;

  if (!audio_path || typeof audio_path !== 'string') {
    return {
      content: [{ type: 'text', text: 'Invalid input: `audio_path` must be a path to a WAV file.' }],
      isError: true,
    };
  }

  try {
    const buffer = readFileSync(audio_path);
    const { samples, sampleRate, channels, duration } = decodeWav(buffer);

    const hopSize = options.hopSize || 512;
    const { bpm, beats, energy } = detectBeats(samples, sampleRate, {
      ...options,
      hopSize,
    });

    const energyCurve = computeEnergyCurve(energy);

    let out = `# Beat Analysis\n\n`;
    out += `**File:** ${audio_path}\n`;
    out += `**Duration:** ${duration}s\n`;
    out += `**Sample Rate:** ${sampleRate} Hz\n`;
    out += `**Channels:** ${channels} (mixed to mono)\n`;
    out += `**BPM:** ${bpm}\n`;
    out += `**Beats Detected:** ${beats.length}\n\n`;

    // Beat grid
    if (beats.length > 0) {
      out += '## Beat Grid\n\n';
      out += beats.map((b, i) => `${i + 1}. ${b}s`).join('\n');
      out += '\n\n';
    }

    // Energy curve visualization (text)
    out += '## Energy Curve\n\n';
    out += '```\n';
    for (let i = 0; i < energyCurve.length; i++) {
      const bar = '█'.repeat(Math.round(energyCurve[i] * 30));
      const pct = (energyCurve[i] * 100).toFixed(0).padStart(3);
      out += `${String(i + 1).padStart(2)}. ${pct}% ${bar}\n`;
    }
    out += '```\n\n';

    // Output beat data for plan_sequence
    out += '## Beat Data (for plan_sequence)\n\n```json\n';
    const beatData = { bpm, beats, energy, sampleRate, hopSize };
    out += JSON.stringify(beatData, null, 2);
    out += '\n```\n';

    return { content: [{ type: 'text', text: out }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Beat analysis failed: ${err.message}` }],
      isError: true,
    };
  }
}

// ── sync_sequence_to_beats (ANI-100) ────────────────────────────────────────

function handleSyncSequenceToBeats(args) {
  const { manifest, beats, options = {} } = args;

  if (!manifest || !manifest.scenes || !Array.isArray(manifest.scenes)) {
    return {
      content: [{ type: 'text', text: 'Invalid input: `manifest` must have a `scenes` array.' }],
      isError: true,
    };
  }

  if (!beats || !beats.beats) {
    return {
      content: [{ type: 'text', text: 'Invalid input: `beats` must have a `beats` array (from analyze_beats output).' }],
      isError: true,
    };
  }

  try {
    const {
      include_hit_markers = true,
      include_audio_cues = false,
      archetype_slug,
      hit_sensitivity = 0.5,
      ...syncOptions
    } = options;

    // 1. Sync manifest to beats
    const syncResult = syncSequenceToBeats(manifest, beats, syncOptions);

    // 2. Score the sync quality
    const syncScore = scoreAudioSync(syncResult.manifest, beats);

    let out = `# Beat-Synced Sequence\n\n`;
    out += `**Sync Mode:** ${syncResult.sync_report.sync_mode || 'tight'}\n`;
    out += `**Scenes Adjusted:** ${syncResult.sync_report.adjusted_count} / ${syncResult.sync_report.total_scenes}\n`;
    out += `**Sync Score:** ${syncScore.score}/100 (${syncScore.grade})\n\n`;

    // Adjustments detail
    if (syncResult.sync_report.adjustments.length > 0) {
      out += '## Adjustments\n\n';
      for (const adj of syncResult.sync_report.adjustments) {
        const dir = adj.type === 'stretch' ? '+' : '-';
        out += `- **${adj.scene_id}**: ${adj.original_duration}s → ${adj.adjusted_duration}s (${dir}${Math.abs(adj.delta_s * 1000).toFixed(0)}ms to beat at ${adj.beat_time}s)\n`;
      }
      out += '\n';
    }

    // Per-transition sync details
    if (syncScore.details.length > 0) {
      out += '## Transition Sync Details\n\n';
      out += '| Scene | Time | Nearest Beat | Offset | Score | Level |\n';
      out += '|-------|------|-------------|--------|-------|-------|\n';
      for (const d of syncScore.details) {
        out += `| ${d.scene_id} | ${d.transition_time_s}s | ${d.nearest_beat_s}s | ${d.offset_ms.toFixed(0)}ms | ${d.score} | ${d.sync_level} |\n`;
      }
      out += '\n';
    }

    // 3. Hit markers
    let hitResult = null;
    if (include_hit_markers) {
      hitResult = generateHitMarkers(beats, { sensitivity: hit_sensitivity });
      out += `## Hit Markers (${hitResult.stats.total} found)\n\n`;
      if (hitResult.markers.length > 0) {
        out += '| Time | Type | Strength | Energy | Label |\n';
        out += '|------|------|----------|--------|-------|\n';
        for (const m of hitResult.markers) {
          out += `| ${m.time_s}s | ${m.type} | ${m.strength} | ${m.energy} | ${m.label} |\n`;
        }
        out += '\n';
      }
    }

    // 4. Audio cues
    let cueResult = null;
    if (include_audio_cues && archetype_slug) {
      cueResult = planAudioCues(beats, archetype_slug, syncResult.manifest);
      out += `## Audio Cues (${cueResult.summary.total} suggested)\n\n`;
      if (cueResult.cues.length > 0) {
        for (const c of cueResult.cues) {
          out += `- **${c.type}** at ${c.time_s}s (${c.duration_s}s) — ${c.reason}\n`;
        }
        out += '\n';
      }
    }

    // JSON data block
    out += '## Data (for downstream tools)\n\n```json\n';
    const data = {
      manifest: syncResult.manifest,
      sync_report: syncResult.sync_report,
      sync_score: syncScore,
      ...(hitResult ? { hit_markers: hitResult } : {}),
      ...(cueResult ? { audio_cues: cueResult } : {}),
    };
    out += JSON.stringify(data, null, 2);
    out += '\n```\n';

    return { content: [{ type: 'text', text: out }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Beat sync failed: ${err.message}` }],
      isError: true,
    };
  }
}

// ── create_personality (ANI-43) ─────────────────────────────────────────────

function handleCreatePersonality(args) {
  const { definition } = args;

  if (!definition || typeof definition !== 'object') {
    return {
      content: [{ type: 'text', text: 'Invalid input: `definition` must be a JSON object with at least `name` and `slug`.' }],
      isError: true,
    };
  }

  const result = registerPersonality(definition);

  if (!result.success) {
    let out = '# Personality Validation Failed\n\n';
    out += '**Errors:**\n';
    for (const err of result.errors) {
      out += `- ${err}\n`;
    }
    if (result.warnings.length > 0) {
      out += '\n**Warnings:**\n';
      for (const w of result.warnings) {
        out += `- ${w}\n`;
      }
    }
    return { content: [{ type: 'text', text: out }], isError: true };
  }

  const p = result.personality;
  let out = `# Custom Personality Created: ${p.name}\n\n`;
  out += `**Slug:** \`${p.slug}\`\n`;
  out += `**Camera Mode:** ${p.camera_behavior.mode}\n`;
  out += `**Motion Intensity:** ${p.characteristics.motion_intensity}\n`;
  out += `**Color Mode:** ${p.characteristics.color_mode}\n`;
  out += `**Contrast:** ${p.characteristics.contrast}\n\n`;

  if (result.warnings.length > 0) {
    out += '**Warnings:**\n';
    for (const w of result.warnings) {
      out += `- ${w}\n`;
    }
    out += '\n';
  }

  // Guardrails summary
  out += '## Derived Guardrails\n\n';
  out += `**Forbidden Features:** ${result.guardrails.forbidden_features.join(', ') || 'none'}\n`;
  if (result.guardrails.max_translateXY) out += `**Max TranslateXY:** ${result.guardrails.max_translateXY}px\n`;
  if (result.guardrails.max_scale_change_percent) out += `**Max Scale Change:** ${result.guardrails.max_scale_change_percent}%\n`;

  // Shot grammar summary
  out += '\n## Derived Shot Grammar Restrictions\n\n';
  out += `**Allowed Sizes:** ${result.shot_grammar.allowed_sizes.join(', ')}\n`;
  out += `**Allowed Angles:** ${result.shot_grammar.allowed_angles.join(', ')}\n`;
  out += `**Allowed Framings:** ${result.shot_grammar.allowed_framings.join(', ')}\n`;
  out += `**3D Rotation:** ${result.shot_grammar.use_3d_rotation ? 'yes' : 'no'}\n`;

  // Usage instructions
  out += '\n## Usage\n\n';
  out += `To use this personality, create a style pack that maps to \`${p.slug}\`, or use it directly in scene analysis and planning.\n`;
  out += `\nThis personality is registered for the current session. To make it permanent, save the definition to \`catalog/custom-personalities/\`.\n`;

  // Full definition JSON
  out += '\n## Full Definition\n\n```json\n';
  out += JSON.stringify(p, null, 2);
  out += '\n```\n';

  return { content: [{ type: 'text', text: out }] };
}

// ── list_personalities (ANI-43) ─────────────────────────────────────────────

function handleListPersonalities() {
  const allSlugs = getAllPersonalitySlugs();
  const customs = listCustomPersonalities();
  const customSlugs = new Set(customs.map(c => c.slug));

  let out = `# Personalities (${allSlugs.length})\n\n`;
  out += '| Slug | Name | Camera Mode | Motion | Color | Type |\n';
  out += '|------|------|-------------|--------|-------|------|\n';

  for (const slug of allSlugs) {
    const p = getPersonality(slug);
    if (!p) continue;
    const type = customSlugs.has(slug) ? '**custom**' : 'built-in';
    const cam = p.camera_behavior?.mode || 'none';
    const motion = p.characteristics?.motion_intensity || '—';
    const color = p.characteristics?.color_mode || '—';
    out += `| \`${slug}\` | ${p.name} | ${cam} | ${motion} | ${color} | ${type} |\n`;
  }

  if (customs.length > 0) {
    out += `\n**Custom personalities:** ${customs.length} registered this session.\n`;
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── compile_motion ──────────────────────────────────────────────────────────

function handleCompileMotion(args) {
  const { scene, personality } = args;

  if (!scene) {
    return {
      content: [{ type: 'text', text: '**Error:** scene is required' }],
      isError: true,
    };
  }

  if (!scene.motion && !scene.semantic) {
    return {
      content: [{
        type: 'text',
        text: '**Note:** Scene has no `motion` or `semantic` block — this is a v1 scene. No compilation needed; the renderer uses the existing camera/entrance path.',
      }],
    };
  }

  try {
    const catalogs = { recipes: recipesCatalog };
    const timeline = compileMotion(scene, catalogs, {
      personality: personality || scene.personality,
    });

    const layerCount = Object.keys(timeline.tracks.layers).length;
    const cameraProps = Object.keys(timeline.tracks.camera);
    let trackCount = 0;
    for (const tracks of Object.values(timeline.tracks.layers)) {
      trackCount += Object.keys(tracks).length;
    }

    const isV3 = !!scene.semantic;
    let summary = `## Compiled Motion Timeline${isV3 ? ' (v3 semantic → v2 → Level 2)' : ''}\n\n`;
    summary += `- **Scene:** ${timeline.scene_id}\n`;
    summary += `- **Duration:** ${timeline.duration_frames} frames (${(timeline.duration_frames / timeline.fps).toFixed(1)}s @ ${timeline.fps}fps)\n`;
    summary += `- **Layers:** ${layerCount} with ${trackCount} property tracks\n`;
    summary += `- **Camera:** ${cameraProps.length > 0 ? cameraProps.join(', ') : 'none'}\n`;

    summary += `\n### Layer tracks\n`;
    for (const [layerId, tracks] of Object.entries(timeline.tracks.layers)) {
      const props = Object.keys(tracks);
      const kfCount = props.reduce((sum, p) => sum + tracks[p].length, 0);
      summary += `- **${layerId}:** ${props.join(', ')} (${kfCount} keyframes)\n`;
    }

    summary += `\n### Full timeline JSON\n\n\`\`\`json\n${JSON.stringify(timeline, null, 2)}\n\`\`\``;

    return { content: [{ type: 'text', text: summary }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `**Compilation Error:** ${err.message}` }],
      isError: true,
    };
  }
}

// ── critique_motion ─────────────────────────────────────────────────────────

function handleCritiqueMotion(args) {
  const { timeline, scene } = args;

  if (!timeline) {
    return {
      content: [{ type: 'text', text: '**Error:** timeline is required' }],
      isError: true,
    };
  }

  if (!scene) {
    return {
      content: [{ type: 'text', text: '**Error:** scene is required' }],
      isError: true,
    };
  }

  try {
    const result = critiqueTimeline(timeline, scene);

    let output = `## Motion Critique\n\n`;
    output += `- **Score:** ${result.score}/100\n`;
    output += `- **Summary:** ${result.summary}\n`;

    if (result.issues.length > 0) {
      output += `\n### Issues\n\n`;
      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '!!!' : issue.severity === 'warning' ? '!!' : '!';
        output += `- **[${icon} ${issue.severity.toUpperCase()}]** \`${issue.rule}\``;
        if (issue.layer) output += ` on \`${issue.layer}\``;
        output += `\n  ${issue.message}\n`;
        if (issue.suggestion) {
          output += `  *Suggestion:* ${issue.suggestion}\n`;
        }
      }
    }

    output += `\n### Full critique JSON\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;

    return { content: [{ type: 'text', text: output }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `**Critique Error:** ${err.message}` }],
      isError: true,
    };
  }
}

// ── run_benchmarks ──────────────────────────────────────────────────────────

function handleRunBenchmarks() {
  try {
    const scenes = loadBenchmarks();

    if (scenes.length === 0) {
      return {
        content: [{ type: 'text', text: '**Warning:** No benchmark scenes found in catalog/benchmarks/' }],
      };
    }

    const catalogs = { recipes: recipesCatalog };
    const report = runBenchmarks(scenes, catalogs);

    let output = `## Benchmark Report\n\n`;
    output += `- **Scenes:** ${report.scenes.length}\n`;
    output += `- **Passed:** ${report.aggregate.passCount} / ${report.scenes.length}\n`;
    output += `- **Avg Score:** ${report.aggregate.avgScore}\n`;
    output += `- **Min / Max:** ${report.aggregate.minScore} / ${report.aggregate.maxScore}\n`;
    output += `- **Threshold:** ${QUALITY_THRESHOLD}\n`;

    output += `\n### Per-Scene Results\n\n`;
    for (const scene of report.scenes) {
      const icon = scene.pass ? 'PASS' : 'FAIL';
      output += `#### [${icon}] ${scene.scene_id} (${scene.personality})\n`;
      output += `- **Score:** ${scene.score}/100\n`;

      if (scene.compileError) {
        output += `- **Compile Error:** ${scene.compileError}\n`;
      }

      if (scene.orphanLayers.length > 0) {
        output += `- **Orphan Layers:** ${scene.orphanLayers.join(', ')}\n`;
      }

      if (scene.issues.length > 0) {
        output += `- **Issues:** ${scene.issues.length}\n`;
        for (const issue of scene.issues) {
          output += `  - [${issue.severity}] \`${issue.rule}\`: ${issue.message}\n`;
        }
      }
      output += `\n`;
    }

    output += `\n### Full report JSON\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``;

    return { content: [{ type: 'text', text: output }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `**Benchmark Error:** ${err.message}` }],
      isError: true,
    };
  }
}

// ── generate_video ───────────────────────────────────────────────────────

async function handleGenerateVideo(args) {
  const { prompt, style, personality, enhance } = args;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      content: [{ type: 'text', text: 'A `prompt` string is required. Example: "30-second promo for an AI dashboard, cinematic-dark style"' }],
      isError: true,
    };
  }

  const result = await generateVideo(prompt.trim(), { style, personality, enhance });

  if (result.error) {
    return {
      content: [{ type: 'text', text: `Pipeline failed at **${result.stage}** stage:\n\n${result.error}` }],
      isError: true,
    };
  }

  const { scenes, manifest, scores, evaluation, summary } = result;

  let out = `# Video Generated\n\n`;
  out += `**Prompt:** ${summary.prompt}\n`;
  out += `**Style:** ${summary.style} (${summary.personality})\n`;
  out += `**Scenes:** ${summary.scene_count} | **Compiled:** ${summary.compiled}\n`;
  out += `**Duration:** ${summary.duration_s.toFixed(1)}s\n`;
  out += `**Avg Critique:** ${summary.avg_critique_score}/100\n`;
  if (summary.sequence_score != null) {
    out += `**Sequence Score:** ${summary.sequence_score}/100\n`;
  }
  out += '\n';

  // Scene scores
  if (scores.length > 0) {
    out += `## Scene Scores\n\n`;
    out += `| Scene | Score | Status |\n|-------|-------|--------|\n`;
    for (const s of scores) {
      out += `| ${s.scene_id} | ${s.score}/100 | ${s.pass ? 'PASS' : 'WARN'} |\n`;
    }
    out += '\n';
  }

  // Warnings
  if (summary.warnings.length > 0) {
    out += `## Warnings\n\n`;
    for (const w of summary.warnings) out += `- ${w}\n`;
    out += '\n';
  }

  // Errors
  if (summary.errors.length > 0) {
    out += `## Errors\n\n`;
    for (const e of summary.errors) out += `- ${e}\n`;
    out += '\n';
  }

  // Manifest
  out += `## Sequence Manifest\n\n`;
  out += '```json\n' + JSON.stringify(manifest, null, 2) + '\n```\n\n';

  // Scenes JSON
  out += `## Scenes\n\n`;
  out += '```json\n' + JSON.stringify(scenes, null, 2) + '\n```\n';

  return { content: [{ type: 'text', text: out }] };
}

// ── AI Demo Archetype Handler ────────────────────────────────────────────────

function handleInstantiateSequenceArchetype(args) {
  const archetypes = getAiDemoArchetypes();
  const archetype = archetypes.find(a => a.slug === args.archetype_slug);
  if (!archetype) {
    return { content: [{ type: 'text', text: `Unknown archetype "${args.archetype_slug}". Available: ${archetypes.map(a => a.slug).join(', ')}` }] };
  }

  const personality = args.personality || archetype.personalities[0] || 'editorial';
  const totalDuration = args.duration_s || (archetype.duration_range.min_s + archetype.duration_range.max_s) / 2;
  const contentHints = args.content_hints || {};

  const scenes = archetype.scenes.map((sceneTemplate, i) => {
    const sceneDuration = totalDuration * sceneTemplate.pct;
    const sceneId = `sc_${String(i + 1).padStart(2, '0')}_${sceneTemplate.role}`;
    const entry = {
      scene: sceneId,
      duration_s: Math.round(sceneDuration * 10) / 10,
    };
    if (i > 0) {
      entry.transition_in = { type: 'crossfade', duration_ms: 400 };
    }
    if (contentHints[sceneTemplate.role]) {
      entry._content_hint = contentHints[sceneTemplate.role];
    }
    entry._role = sceneTemplate.role;
    entry._description = sceneTemplate.description;
    return entry;
  });

  const manifest = {
    sequence_id: `seq_${args.archetype_slug}`,
    archetype: args.archetype_slug,
    personality,
    fps: 60,
    scenes,
  };

  return { content: [{ type: 'text', text: JSON.stringify({ archetype: archetype.slug, manifest }, null, 2) }] };
}

// ── Finish Preset Handler ───────────────────────────────────────────────────

function handleApplyFinishPreset(args) {
  const presets = getFinishPresets();
  const preset = presets.find(p => p.slug === args.preset_slug);
  if (!preset) {
    return { content: [{ type: 'text', text: `Unknown preset "${args.preset_slug}". Available: ${presets.map(p => p.slug).join(', ')}` }] };
  }

  const manifest = args.manifest ? JSON.parse(JSON.stringify(args.manifest)) : {};
  const overrides = args.overrides || {};

  // Apply finish block
  manifest.finish = {
    preset: preset.slug,
    passes: preset.passes.map(pass => ({
      ...pass,
      overrides: { ...pass.overrides, ...(overrides[pass.slug] || {}) },
    })),
    color_grade: preset.color_grade || null,
  };

  return { content: [{ type: 'text', text: JSON.stringify({ preset: preset.slug, manifest }, null, 2) }] };
}

// ── Motion Density Handler ──────────────────────────────────────────────────

function handleAuditMotionDensity(args) {
  const { timeline, scene } = args;
  const report = auditMotionDensity(timeline, scene);
  return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
}

// ── Sequence Archetype Handler ───────────────────────────────────────────────

function handleRecommendSequenceArchetype(args) {
  const { output_type, personality, duration_s } = args;

  let candidates = [...sequenceArchetypes];

  // Exact slug match first
  const exact = candidates.find(a => a.slug === output_type);
  if (exact) {
    candidates = [exact];
  } else {
    // Fuzzy match on name/description
    const q = output_type.toLowerCase();
    candidates = candidates.filter(a =>
      a.slug.includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.when_to_use.some(u => u.toLowerCase().includes(q))
    );
  }

  // Filter by personality
  if (personality && candidates.length > 1) {
    const perFiltered = candidates.filter(a => a.personalities.includes(personality));
    if (perFiltered.length > 0) candidates = perFiltered;
  }

  // Filter by duration
  if (duration_s && candidates.length > 1) {
    const durFiltered = candidates.filter(a =>
      duration_s >= a.duration_range.min_s && duration_s <= a.duration_range.max_s
    );
    if (durFiltered.length > 0) candidates = durFiltered;
  }

  if (candidates.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No matching archetype found for "${output_type}". Available: ${sequenceArchetypes.map(a => a.slug).join(', ')}`,
      }],
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(candidates.length === 1 ? candidates[0] : candidates, null, 2),
    }],
  };
}

// ── Project Management Handlers ─────────────────────────────────────────────

async function handleInitProject(args) {
  const result = await initProject(args);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

async function handleListProjects(args) {
  const result = await listProjects(args);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

async function handleGetProject(args) {
  const result = await getProject(args);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

async function handleGetProjectContext(args) {
  const result = await getProjectContext(args);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

async function handleSaveProjectArtifact(args) {
  const result = await saveProjectArtifact(args);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

async function handleRenderProject(args) {
  // Get project context to resolve manifest path
  const project = await getProject({ project: args.project });
  if (!project) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: `Project "${args.project}" not found` }) }] };
  }

  const manifestPath = args.manifest || project.entrypoints?.root_manifest;
  if (!manifestPath) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'No manifest specified and no root_manifest in project.json' }) }] };
  }

  const { join } = await import('node:path');
  const { readFileSync } = await import('node:fs');

  const fullManifestPath = join(project.project_root, manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(fullManifestPath, 'utf-8'));
  } catch {
    return { content: [{ type: 'text', text: JSON.stringify({ error: `Cannot read manifest at ${fullManifestPath}` }) }] };
  }

  const outputName = args.output || `renders/draft/${project.slug}-render.mp4`;
  const outputPath = join(project.project_root, outputName);

  // Use generateVideo with the resolved paths
  const videoResult = await generateVideo({
    prompt: `Render project ${project.title}`,
    manifest,
    outputPath,
  });

  // Update entrypoint if requested
  if (args.mark_as_latest !== false) {
    await saveProjectArtifact({
      project: args.project,
      kind: 'render',
      role: 'latest_render',
      path: outputName,
    });
  }

  return { content: [{ type: 'text', text: JSON.stringify({ ...videoResult, output: outputPath }) }] };
}

async function handleReviewProject(args) {
  const project = await getProject({ project: args.project });
  if (!project) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: `Project "${args.project}" not found` }) }] };
  }

  const { join } = await import('node:path');
  const { readFileSync, writeFileSync } = await import('node:fs');

  const manifestPath = args.manifest || project.entrypoints?.root_manifest;
  if (!manifestPath) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'No manifest to review' }) }] };
  }

  const fullManifestPath = join(project.project_root, manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(fullManifestPath, 'utf-8'));
  } catch {
    return { content: [{ type: 'text', text: JSON.stringify({ error: `Cannot read manifest at ${fullManifestPath}` }) }] };
  }

  // Run validation
  const validationResult = validateFullManifest(manifest, cameraGuardrails);

  // Run evaluation if scene definitions are available
  let evaluationResult = null;
  if (manifest.sceneDefs) {
    const scenes = Object.values(manifest.sceneDefs);
    evaluationResult = evaluateSequence(scenes, {
      personality: project.personality || 'cinematic-dark',
    });
  }

  // Write results to review/
  const reviewDir = join(project.project_root, 'review');
  const evaluationOutput = {
    validation: validationResult,
    evaluation: evaluationResult,
    reviewed_at: new Date().toISOString(),
    manifest: manifestPath,
  };

  writeFileSync(join(reviewDir, 'evaluation.json'), JSON.stringify(evaluationOutput, null, 2));

  return { content: [{ type: 'text', text: JSON.stringify(evaluationOutput, null, 2) }] };
}

// ── get_art_direction ───────────────────────────────────────────────────────

function handleGetArtDirection(args) {
  const { slug } = args;
  const ad = getArtDirection(slug);

  if (!ad) {
    return {
      content: [{
        type: 'text',
        text: `Unknown art direction "${slug}". Available: ${ART_DIRECTION_SLUGS.join(', ')}`,
      }],
    };
  }

  let out = `## Art Direction: ${ad.name}\n\n`;
  out += `${ad.description}\n\n`;

  out += `**Typography:**\n`;
  out += `- Headline: ${ad.typography.headline.family} ${ad.typography.headline.weight} (${ad.typography.headline.tracking})\n`;
  out += `- Body: ${ad.typography.body.family} ${ad.typography.body.weight} (${ad.typography.body.tracking})\n`;
  out += `- Caption: ${ad.typography.caption.family} ${ad.typography.caption.weight} (${ad.typography.caption.tracking})\n\n`;

  out += `**Palette:**\n`;
  for (const [key, val] of Object.entries(ad.palette)) {
    out += `- ${key}: \`${val}\`\n`;
  }
  out += '\n';

  out += `**Lighting:** ${ad.lighting.style} (ambient: ${ad.lighting.ambient_intensity}, shadow: ${ad.lighting.shadow_depth})\n\n`;

  out += `**Textures:** grain=${ad.textures.grain.enabled ? `${ad.textures.grain.opacity} ${ad.textures.grain.blend}` : 'off'}, vignette=${ad.textures.vignette.enabled ? `${ad.textures.vignette.opacity}` : 'off'}, scan_lines=${ad.textures.scan_lines && ad.textures.scan_lines.enabled ? 'on' : 'off'}\n\n`;

  out += `**Compatible personalities:** ${ad.compatible_personalities.join(', ')}\n`;
  out += `**Compatible style packs:** ${ad.compatible_style_packs.join(', ')}\n\n`;

  out += `**When to use:** ${ad.when_to_use.join('; ')}\n`;
  out += `**When to avoid:** ${ad.when_to_avoid.join('; ')}\n\n`;

  out += '```json\n' + JSON.stringify(ad, null, 2) + '\n```';

  return { content: [{ type: 'text', text: out }] };
}

// ── list_art_directions ─────────────────────────────────────────────────────

function handleListArtDirections(args) {
  const results = listArtDirections({
    personality: args.personality,
    style_pack: args.style_pack,
  });

  if (results.length === 0) {
    let msg = 'No art directions match the given filters.';
    if (args.personality) msg += ` personality=${args.personality}`;
    if (args.style_pack) msg += ` style_pack=${args.style_pack}`;
    return { content: [{ type: 'text', text: msg }] };
  }

  let out = `## Art Directions (${results.length} match${results.length === 1 ? '' : 'es'})\n\n`;

  for (const ad of results) {
    out += `### ${ad.name} (\`${ad.slug}\`)\n`;
    out += `${ad.description}\n`;
    out += `- Personalities: ${ad.compatible_personalities.join(', ')}\n`;
    out += `- Style packs: ${ad.compatible_style_packs.join(', ')}\n\n`;
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── plan_hero_moments ────────────────────────────────────────────────────────

const HERO_MOMENT_ROLE_MAP = {
  hero_product:       ['hm-product-freeze-frame', 'hm-zoom-through'],
  metric_reveal:      ['hm-metric-explosion'],
  logo_close:         ['hm-logo-resolve'],
  comparison:         ['hm-before-after-morph', 'hm-card-fan-out'],
  data_insight:       ['hm-chart-to-insight-reveal', 'hm-metric-explosion'],
  feature_options:    ['hm-card-fan-out'],
  spatial_transition: ['hm-zoom-through'],
  brand_reveal:       ['hm-logo-resolve', 'hm-product-freeze-frame'],
  before_after:       ['hm-before-after-morph'],
  options_reveal:     ['hm-card-fan-out', 'hm-before-after-morph'],
};

let _heroMomentsCache = null;

function loadHeroMoments() {
  if (_heroMomentsCache) return _heroMomentsCache;
  _heroMomentsCache = JSON.parse(
    readFileSync(resolve(ROOT, 'catalog', 'compound', 'hero-moments.json'), 'utf-8')
  );
  return _heroMomentsCache;
}

function handlePlanHeroMoments(args) {
  const { scene_role, personality, duration_s, count = 3 } = args;
  const heroMoments = loadHeroMoments();

  // Filter by personality affinity
  let candidates = heroMoments.filter(hm =>
    hm.personality_affinity.includes(personality)
  );

  // Filter by duration if provided
  if (duration_s != null) {
    const maxMs = duration_s * 1000;
    candidates = candidates.filter(hm => {
      const durationMs = parseInt(hm.default_duration, 10);
      return durationMs <= maxMs;
    });
  }

  // Score by role relevance
  const rolePreferred = HERO_MOMENT_ROLE_MAP[scene_role] || [];
  const scored = candidates.map(hm => {
    let score = 1; // base score for personality match
    const roleIdx = rolePreferred.indexOf(hm.slug);
    if (roleIdx !== -1) {
      score += 10 - roleIdx; // higher score for earlier match
    }
    return { ...hm, _score: score };
  });

  // Sort by score descending, take top N
  scored.sort((a, b) => b._score - a._score);
  const results = scored.slice(0, count);

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No hero moment primitives match personality="${personality}"${duration_s ? ` within ${duration_s}s` : ''} for scene_role="${scene_role}". Try a different personality or increase the duration.`,
      }],
    };
  }

  let out = `## Hero Moment Recommendations\n`;
  out += `**Scene role:** ${scene_role} | **Personality:** ${personality}`;
  if (duration_s) out += ` | **Max duration:** ${duration_s}s`;
  out += `\n\n`;

  for (const hm of results) {
    const relevance = rolePreferred.includes(hm.slug) ? 'direct match' : 'compatible';
    out += `### ${hm.name} (\`${hm.slug}\`) — ${relevance}\n`;
    out += `${hm.description}\n\n`;
    out += `- **Duration:** ${hm.default_duration}\n`;
    out += `- **Affinity:** ${hm.personality_affinity.join(', ')}\n`;
    out += `- **Sub-primitives:** ${hm.sub_primitives.map(sp => sp.name).join(', ')}\n`;
    out += `- **When to use:** ${hm.when_to_use[0]}\n`;
    out += `- **AI guidance:** ${hm.ai_guidance}\n\n`;
    out += `<details><summary>Config schema</summary>\n\n\`\`\`json\n${JSON.stringify(hm.config_schema, null, 2)}\n\`\`\`\n</details>\n\n`;
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── score_brand_finish ──────────────────────────────────────────────────────

function handleScoreBrandFinish(args) {
  const result = scoreBrandFinish({
    personality: args.personality,
    style_pack: args.style_pack,
    art_direction: args.art_direction,
    passes: args.passes,
  });

  let out = `## Brand Finish — ${args.personality}\n\n`;
  out += `**Quality Score: ${result.quality_score.score}/${result.quality_score.max}**\n\n`;

  if (result.recommended_stack.length > 0) {
    out += `### Recommended Compositing Stack\n\n`;
    out += `| # | Pass | Category | Key Parameters |\n`;
    out += `|---|------|----------|----------------|\n`;
    for (let i = 0; i < result.recommended_stack.length; i++) {
      const entry = result.recommended_stack[i];
      const paramStr = Object.entries(entry.overrides || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      out += `| ${i + 1} | ${entry.name} | ${entry.category} | ${paramStr} |\n`;
    }
    out += `\n`;
  }

  out += `### Score Breakdown\n\n`;
  for (const [key, value] of Object.entries(result.quality_score.breakdown)) {
    out += `- **${key}**: ${value}\n`;
  }

  if (result.notes.length > 0) {
    out += `\n### Notes\n\n`;
    for (const note of result.notes) {
      out += `- ${note}\n`;
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── create_brand_package ─────────────────────────────────────────────────────

function handleCreateBrandPackage(args) {
  const { brand, path } = createBrandPackage(args);

  let out = `## Brand Package Created\n\n`;
  out += `**${brand.name}** (\`${brand.brand_id}\`)\n\n`;
  out += `- Personality: ${brand.personality}\n`;
  out += `- Style: ${brand.style || 'default'}\n`;
  out += `- File: \`${path}\`\n`;

  if (brand.motion?.forbidden_moves?.length > 0) {
    out += `- Forbidden moves: ${brand.motion.forbidden_moves.join(', ')}\n`;
  }
  if (brand.motion?.max_intensity !== undefined) {
    out += `- Max intensity: ${brand.motion.max_intensity}\n`;
  }
  if (brand.guidelines) {
    if (brand.guidelines.dos?.length > 0) {
      out += `\n### Do's\n${brand.guidelines.dos.map(d => `- ${d}`).join('\n')}\n`;
    }
    if (brand.guidelines.donts?.length > 0) {
      out += `\n### Don'ts\n${brand.guidelines.donts.map(d => `- ${d}`).join('\n')}\n`;
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── get_brand_package ───────────────────────────────────────────────────────

function handleGetBrandPackage(args) {
  const brand = loadBrand(args.brand_id);
  if (!brand) {
    throw new Error(`Brand "${args.brand_id}" not found. Use list_brand_packages to see available brands.`);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(brand, null, 2) }],
  };
}

// ── list_brand_packages ─────────────────────────────────────────────────────

function handleListBrandPackages() {
  const brands = listBrands();

  let out = `## Brand Packages (${brands.length})\n\n`;
  out += `| Brand ID | Name | Personality | Style |\n`;
  out += `|----------|------|-------------|-------|\n`;
  for (const b of brands) {
    out += `| \`${b.brand_id}\` | ${b.name} | ${b.personality} | ${b.style || '—'} |\n`;
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── validate_brand_compliance ───────────────────────────────────────────────

function handleValidateBrandCompliance(args) {
  const brand = loadBrand(args.brand_id);
  if (!brand) {
    throw new Error(`Brand "${args.brand_id}" not found.`);
  }

  const manifest = args.manifest || {};
  const scenes = args.scenes || [];
  const violations = validateBrandCompliance(brand, manifest, scenes);

  let out = `## Brand Compliance: ${brand.name}\n\n`;

  if (violations.length === 0) {
    out += `All checks passed. Manifest is compliant with brand guidelines.\n`;
  } else {
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');

    out += `**${errors.length} errors, ${warnings.length} warnings**\n\n`;

    if (errors.length > 0) {
      out += `### Errors\n`;
      for (const v of errors) {
        out += `- [${v.rule}] ${v.message}\n`;
      }
      out += `\n`;
    }
    if (warnings.length > 0) {
      out += `### Warnings\n`;
      for (const v of warnings) {
        out += `- [${v.rule}] ${v.message}\n`;
      }
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── score_product_demo_clarity ───────────────────────────────────────────────

function handleScoreProductDemoClarity(args) {
  const result = scoreProductDemoClarity(args.manifest || {}, args.scenes || []);

  let out = `## Product Demo Clarity Score: ${result.score}/${result.max}\n\n`;

  if (result.breakdown.length > 0) {
    out += `### Breakdown\n\n`;
    out += `| Dimension | Score | Max |\n`;
    out += `|-----------|-------|-----|\n`;
    for (const dim of result.breakdown) {
      out += `| ${dim.dimension.replace(/_/g, ' ')} | ${dim.score} | ${dim.max} |\n`;
    }
    out += `\n`;
  }

  if (result.warnings.length > 0) {
    out += `### Warnings\n\n`;
    for (const w of result.warnings) {
      out += `- ${w}\n`;
    }
  }

  return { content: [{ type: 'text', text: out }] };
}

// ── generate_contact_sheet ────────────────────────────────────────────────

function handleGenerateContactSheet(args) {
  const { manifest, scenes, includeTimecodes, includeTechnical, format } = args;

  if (!manifest) {
    return {
      content: [{ type: 'text', text: 'A `manifest` object is required. Provide a sequence manifest with scene_order or scenes array.' }],
      isError: true,
    };
  }

  // Derive scenes from manifest.sceneDefs if not provided separately
  const sceneData = scenes || manifest.sceneDefs || [];

  const contactSheet = generateContactSheet(manifest, sceneData, {
    includeTimecodes: includeTimecodes !== false,
    includeTechnical: includeTechnical !== false,
  });

  if (format === 'markdown') {
    const md = formatContactSheetMarkdown(contactSheet);
    return { content: [{ type: 'text', text: md }] };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(contactSheet, null, 2),
    }],
  };
}

// ── compare_project_versions ─────────────────────────────────────────────

function handleCompareProjectVersions(args) {
  const { manifest_a, manifest_b, format } = args;

  if (!manifest_a || !manifest_b) {
    return {
      content: [{ type: 'text', text: 'Both `manifest_a` and `manifest_b` are required. Provide two sequence manifests to compare.' }],
      isError: true,
    };
  }

  const comparison = compareProjectVersions(manifest_a, manifest_b);

  if (format === 'markdown') {
    const md = formatComparisonMarkdown(comparison);
    return { content: [{ type: 'text', text: md }] };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(comparison, null, 2),
    }],
  };
}

// ── create_editorial_canvas_scene ────────────────────────────────────────────

function handleCreateEditorialCanvasScene(args) {
  const { scene_id, duration_s, background = {}, safe_zone = 5, camera, layers = [] } = args;

  const scene = {
    scene_id,
    duration_s,
    mode: 'editorial_canvas',
    canvas: {
      w: 1920,
      h: 1080,
      safe_zone,
      background_treatment: background.treatment || 'solid',
      ...(background.color ? { background_color: background.color } : {}),
      ...(background.color_alt ? { background_color_alt: background.color_alt } : {}),
    },
    background: {
      fill: background.color || '#0a0a0a',
    },
    camera: camera || { move: 'static', intensity: 0 },
    layers: layers.map((l) => ({
      id: l.id,
      type: l.type,
      depth_class: l.depth_class || 'midground',
      ...(l.content ? { content: l.content } : {}),
      ...(l.src ? { src: l.src } : {}),
      ...(l.fit ? { fit: l.fit } : {}),
      ...(l.anchor ? { anchor: l.anchor } : {}),
      ...(l.max_w != null ? { max_w: l.max_w } : {}),
      ...(l.z_bias != null ? { z_bias: l.z_bias } : {}),
    })),
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(scene, null, 2),
    }],
  };
}

// ── recommend_editorial_layout ──────────────────────────────────────────────

const EDITORIAL_PATTERNS = {
  'hero-center': {
    description: 'Single dominant element centered with breathing room. Best for headlines, hero images, or a single product shot.',
    recommended_safe_zone: 8,
    layers: [
      { role: 'headline', anchor: 'center', max_w: '60%', z_bias: 2 },
      { role: 'subtext', anchor: 'bottom-center', max_w: '40%', z_bias: 1 },
    ],
    camera: { move: 'breathe', intensity: 0.2 },
  },
  'split-editorial': {
    description: 'Two-column feel with type on one side and visual on the other. Good for prompt/result, before/after, or feature callouts.',
    recommended_safe_zone: 6,
    layers: [
      { role: 'primary_text', anchor: 'center-left', max_w: '40%', z_bias: 2 },
      { role: 'visual', anchor: 'center-right', max_w: '50%', z_bias: 1 },
      { role: 'caption', anchor: 'bottom-center', max_w: '80%', z_bias: 0 },
    ],
    camera: { move: 'drift', intensity: 0.15 },
  },
  'floating-fragments': {
    description: 'Multiple UI fragments floating in space at different depths. Creates editorial richness through layered composition. Great for showing multiple features or UI states.',
    recommended_safe_zone: 5,
    layers: [
      { role: 'fragment_1', anchor: 'top-left', max_w: '35%', z_bias: -1 },
      { role: 'fragment_2', anchor: 'center', max_w: '45%', z_bias: 3 },
      { role: 'fragment_3', anchor: 'bottom-right', max_w: '30%', z_bias: 1 },
      { role: 'headline', anchor: 'top-center', max_w: '50%', z_bias: 4 },
    ],
    camera: { move: 'drift', intensity: 0.2 },
  },
  'minimal-type': {
    description: 'Typography-dominant layout. Giant type with minimal supporting elements. For taglines, chapter titles, or statement moments.',
    recommended_safe_zone: 10,
    layers: [
      { role: 'headline', anchor: 'center', max_w: '80%', z_bias: 3 },
      { role: 'accent', anchor: 'bottom-right', max_w: '20%', z_bias: 0 },
    ],
    camera: { move: 'static', intensity: 0 },
  },
};

function handleRecommendEditorialLayout(args) {
  const { content_description, personality = 'editorial' } = args;
  const desc = (content_description || '').toLowerCase();

  // Score each pattern against the description
  const scores = {};
  const keywords = {
    'hero-center': ['hero', 'headline', 'title', 'single', 'centered', 'big', 'giant', 'statement', 'logo'],
    'split-editorial': ['split', 'two', 'prompt', 'result', 'before', 'after', 'side', 'column', 'compare'],
    'floating-fragments': ['float', 'fragment', 'multiple', 'cards', 'ui', 'features', 'scattered', 'collage', 'pieces'],
    'minimal-type': ['type', 'typography', 'tagline', 'minimal', 'text', 'chapter', 'word', 'statement'],
  };

  for (const [pattern, kws] of Object.entries(keywords)) {
    scores[pattern] = kws.reduce((score, kw) => score + (desc.includes(kw) ? 1 : 0), 0);
  }

  // Sort by score, fallback to floating-fragments as most versatile
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const bestMatch = scores[ranked[0]] > 0 ? ranked[0] : 'floating-fragments';

  // Personality-specific adjustments
  const personalityNotes = {
    'cinematic-dark': 'Use dark backgrounds (#0a0a0a to #1a1a1a), generous safe zones, and subtle drift camera. Prefer gradient or radial background treatments.',
    'editorial': 'Use light backgrounds (#fafafa to #f0f0f0), clean typography, and static or breathe camera. Prefer solid or gradient treatments.',
    'neutral-light': 'Use clean white backgrounds, clear hierarchy, and static camera. Prefer solid background treatment.',
    'montage': 'Use high-contrast backgrounds, bold type, and consider hard cuts between editorial canvases. Prefer solid or gradient treatments.',
  };

  const result = {
    recommended_pattern: bestMatch,
    all_patterns: Object.entries(EDITORIAL_PATTERNS).map(([name, p]) => ({
      name,
      description: p.description,
      match_score: scores[name],
      recommended_safe_zone: p.recommended_safe_zone,
      layers: p.layers,
      camera: p.camera,
    })),
    personality_notes: personalityNotes[personality] || personalityNotes['editorial'],
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

// ── adapt_project_aspect_ratio ────────────────────────────────────────────

function handleAdaptProjectAspectRatio(args) {
  const { manifest, target_aspect_ratio, recompose } = args;

  if (!manifest) {
    return {
      content: [{ type: 'text', text: 'A `manifest` object is required.' }],
      isError: true,
    };
  }

  if (!target_aspect_ratio) {
    return {
      content: [{ type: 'text', text: 'A `target_aspect_ratio` is required (e.g. "1:1", "4:5", "9:16").' }],
      isError: true,
    };
  }

  try {
    const adapted = adaptManifestAspectRatio(manifest, target_aspect_ratio, {
      recompose: recompose === true,
    });

    const format = getSocialFormat(
      SOCIAL_FORMAT_SLUGS.find(s => getSocialFormat(s)?.aspect_ratio === target_aspect_ratio)
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          adapted_manifest: adapted,
          format_applied: format ? format.slug : null,
          resolution: adapted.resolution,
          safe_areas: adapted.format?.safe_areas,
          notes: [
            `Adapted from ${manifest.format?.aspect_ratio || '16:9'} to ${target_aspect_ratio}`,
            recompose ? 'Layer positions recomposed for new ratio' : 'Layers cropped (use recompose=true for repositioning)',
            format ? `Pacing: ${format.pacing_rules}` : null,
          ].filter(Boolean),
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error adapting manifest: ${err.message}` }],
      isError: true,
    };
  }
}

// ── create_social_cutdown ─────────────────────────────────────────────────

function handleCreateSocialCutdown(args) {
  const { manifest, target_aspect_ratio, max_duration_s, scenes_to_keep } = args;

  if (!manifest) {
    return {
      content: [{ type: 'text', text: 'A `manifest` object is required.' }],
      isError: true,
    };
  }

  if (!target_aspect_ratio) {
    return {
      content: [{ type: 'text', text: 'A `target_aspect_ratio` is required.' }],
      isError: true,
    };
  }

  if (!max_duration_s || max_duration_s <= 0) {
    return {
      content: [{ type: 'text', text: 'A positive `max_duration_s` is required.' }],
      isError: true,
    };
  }

  try {
    const cutdown = createSocialCutdown(
      manifest,
      scenes_to_keep || null,
      target_aspect_ratio,
      max_duration_s,
    );

    const originalSceneCount = manifest.scenes?.length || 0;
    const cutdownSceneCount = cutdown.scenes?.length || 0;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          cutdown_manifest: cutdown,
          summary: {
            original_scenes: originalSceneCount,
            cutdown_scenes: cutdownSceneCount,
            target_aspect_ratio,
            max_duration_s,
            resolution: cutdown.resolution,
            sequence_intent: cutdown.sequence_intent,
          },
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error creating cutdown: ${err.message}` }],
      isError: true,
    };
  }
}

// ── recommend_type_treatment ──────────────────────────────────────────────────

function handleRecommendTypeTreatment(args) {
  const { block_role, content, personality, scene_energy = 'medium' } = args;

  const treatments = {
    headline: {
      'cinematic-dark': { animation: 'line-reveal', style_hints: { fontSize: 96, fontWeight: 800, letterSpacing: '-0.02em', textTransform: 'uppercase' } },
      'editorial': { animation: 'word-reveal', style_hints: { fontSize: 72, fontWeight: 300, letterSpacing: '0.04em', textTransform: 'none' } },
      'neutral-light': { animation: 'lockup-slide', style_hints: { fontSize: 64, fontWeight: 600, letterSpacing: '0', textTransform: 'none' } },
      'montage': { animation: 'lockup-slide', style_hints: { fontSize: 108, fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase' } },
    },
    caption: {
      'cinematic-dark': { animation: 'caption-build', style_hints: { fontSize: 24, fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase' } },
      'editorial': { animation: 'caption-build', style_hints: { fontSize: 20, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase' } },
      'neutral-light': { animation: 'cursor-pulse', style_hints: { fontSize: 18, fontWeight: 400, letterSpacing: '0', textTransform: 'none' } },
      'montage': { animation: 'caption-build', style_hints: { fontSize: 28, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' } },
    },
    label: {
      'cinematic-dark': { animation: null, style_hints: { fontSize: 16, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' } },
      'editorial': { animation: null, style_hints: { fontSize: 14, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase' } },
      'neutral-light': { animation: null, style_hints: { fontSize: 14, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'none' } },
      'montage': { animation: null, style_hints: { fontSize: 18, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' } },
    },
    quote: {
      'cinematic-dark': { animation: 'line-reveal', style_hints: { fontSize: 48, fontWeight: 300, letterSpacing: '0', textTransform: 'none', fontStyle: 'italic' } },
      'editorial': { animation: 'line-reveal', style_hints: { fontSize: 40, fontWeight: 300, letterSpacing: '0.02em', textTransform: 'none', fontStyle: 'italic' } },
      'neutral-light': { animation: 'word-reveal', style_hints: { fontSize: 36, fontWeight: 400, letterSpacing: '0', textTransform: 'none' } },
      'montage': { animation: 'lockup-slide', style_hints: { fontSize: 56, fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase' } },
    },
  };

  const base = treatments[block_role]?.[personality];
  if (!base) {
    return {
      content: [{ type: 'text', text: `Unknown block_role "${block_role}" or personality "${personality}"` }],
      isError: true,
    };
  }

  // Energy adjustments
  const result = { ...base, block_role, personality, scene_energy };
  if (scene_energy === 'high' && block_role === 'headline') {
    if (personality === 'cinematic-dark' || personality === 'montage') {
      result.animation = 'lockup-slide';
      result.style_hints = { ...result.style_hints, slide_direction: 'left' };
    }
  }
  if (scene_energy === 'low' && block_role === 'caption') {
    result.animation = 'cursor-pulse';
  }

  // Word swap suggestion for headlines with short content
  if (block_role === 'headline' && content.split(/\s+/).length <= 3) {
    result.alternative = { animation: 'word-swap', note: 'Consider word-swap for short headlines with multiple variants' };
  }

  // Label always uses simple fade (no text animation)
  if (block_role === 'label') {
    result.animation = null;
    result.entrance_note = 'Use layer entrance (fade_in) instead of text animation for labels';
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

// ── suggest_match_cuts ───────────────────────────────────────────────────────

function handleSuggestMatchCuts(args) {
  const { manifest, scenes } = args;

  if (!manifest || !scenes) {
    return {
      content: [{ type: 'text', text: 'manifest and scenes are required' }],
      isError: true,
    };
  }

  const suggestions = suggestMatchCuts(manifest, scenes);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        match_cut_suggestions: suggestions.map(s => ({
          from_scene: s.from_scene,
          to_scene: s.to_scene,
          from_layer_id: s.from_layer.id,
          to_layer_id: s.to_layer.id,
          similarity: Math.round(s.similarity * 100) / 100,
          suggested_continuity_id: s.suggested_continuity_id,
          suggested_strategy: s.suggested_strategy,
        })),
        count: suggestions.length,
      }, null, 2),
    }],
  };
}

// ── plan_continuity_links ────────────────────────────────────────────────────

function handlePlanContinuityLinks(args) {
  const { manifest, scenes, auto_assign_ids = true } = args;

  if (!manifest || !scenes) {
    return {
      content: [{ type: 'text', text: 'manifest and scenes are required' }],
      isError: true,
    };
  }

  const result = planContinuityLinks(manifest, scenes, { auto_assign_ids });
  const validation = validateContinuityChain(result.manifest, result.scenes);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        annotated_manifest: result.manifest,
        annotated_scenes: result.scenes,
        validation,
      }, null, 2),
    }],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Animatic MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
