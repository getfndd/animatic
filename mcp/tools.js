/**
 * MCP tool definitions.
 *
 * Extracted from index.js so the docs codegen (ANI-142) can import
 * the canonical tool list without booting the MCP server. A factory
 * function is used because several enum values are derived from
 * runtime-loaded catalogs — callers inject those deps.
 */

export function buildTools({
  STYLE_PACKS,
  intentMappings,
  briefTemplatesCatalog,
  getAllPersonalitySlugs,
  ART_DIRECTION_SLUGS,
  COMPOSITING_PASS_SLUGS,
  listReferenceDocs,
}) {
  return [
    {
      name: 'search_primitives',
      description:
        'Search animation primitives across all sources (engine, research, animate.style, breakdowns). Filter by name, personality, category, or source. Returns matching primitives with ID, name, duration, personality affinity, source, and category.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term to match against primitive name or ID (case-insensitive).',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage', 'universal'],
            description: 'Filter by personality affinity: `cinematic-dark`, `editorial`, `neutral-light`, `montage`, or `universal`.',
          },
          category: {
            type: 'string',
            description: 'Filter by category — e.g., `Entrances`, `Exits`, `Reveals / Staggers`, `Continuous / Ambient`, `Content Effects`, `Interactions`, `Transitions`, `Typography`, `Attention Seekers`.',
          },
          source: {
            type: 'string',
            enum: ['engine', 'research', 'animate.style', 'breakdown'],
            description: 'Filter by source: `engine`, `research`, `animate.style`, or `breakdown`.',
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
            description: 'Primitive ID (e.g., `cd-focus-stagger`, `ct-iris-open`, `bk-sparse-breathe`).',
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
            description: 'Personality slug — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
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
            description: 'Filter by personality: `cinematic-dark`, `editorial`, `neutral-light`, `montage`, or `universal`.',
          },
          quality: {
            type: 'string',
            enum: ['exemplary', 'strong', 'interesting'],
            description: 'Filter by quality tier: `exemplary`, `strong`, or `interesting`.',
          },
          type: {
            type: 'string',
            description: 'Filter by type: `gif`, `video`, `website`, or `motion-study`.',
          },
          tag: {
            type: 'string',
            description: 'Filter by tag (e.g., `stagger`, `grid`, `onboarding`, `spring`).',
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
            description: 'Breakdown slug (e.g., `linear-homepage`, `dot-grid-ripple`, `nume-ai-chat-dashboard`).',
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
            description: 'Reference document name (e.g., `animation-principles`, `spring-physics`).',
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
            description: 'The choreographic intent — one of the catalog\'s intent slugs (e.g., `dramatic-reveal`, `build-tension`, `content-focus`).',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Target personality — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`. If omitted, returns plans for all personalities.',
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
            description: 'Array of primitive IDs in the choreography plan.',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Target personality — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
          },
          intent: {
            type: 'string',
            enum: intentMappings.array.map(i => i.intent),
            description: 'Optional choreographic intent for cross-reference validation.',
          },
          overrides: {
            type: 'object',
            properties: {
              perspective: { type: 'number', description: 'Custom perspective value in px' },
              max_blur: { type: 'number', description: 'Custom max blur value in px' },
              duration_multiplier: { type: 'number', description: 'Multiplier applied to default durations (e.g., 0.5 for half speed)' },
            },
            description: 'Optional overrides for lens bounds and timing — `perspective` (px), `max_blur` (px), `duration_multiplier` (e.g., 0.5 for half speed).',
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
            description: 'The scene object to analyze.',
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
            description: 'Array of scene objects with metadata (`content_type`, `visual_weight`, `motion_energy`, `intent_tags`). Set `metadata.style_override` on individual scenes to blend style packs per scene.',
          },
          style: {
            type: 'string',
            enum: STYLE_PACKS,
            description: 'Default style pack for the sequence — `prestige`, `energy`, `dramatic`, `minimal`, `intimate`, `corporate`, `kinetic`, or `fade`. Per-scene overrides take precedence.',
          },
          beats: {
            type: 'object',
            description: 'Beat analysis data from `analyze_beats`. When supplied, scene durations snap to beat boundaries and camera intensities match audio energy.',
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
            description: 'The style pack name to retrieve.',
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
            description: 'Sequence manifest from `plan_sequence` (must have a `scenes` array).',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'The same analyzed scene objects used for `plan_sequence`.',
          },
          style: {
            type: 'string',
            enum: STYLE_PACKS,
            description: 'Default style pack to evaluate against. Per-scene `metadata.style_override` values take precedence.',
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
            description: 'Sequence manifest from `plan_sequence` (must have a `scenes` array).',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Personality to validate against — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
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
            description: 'Brief template ID (e.g., `product-launch`, `brand-story`, `tutorial`).',
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
            description: 'A creative brief object with `project` (title required), `template` (template_id or "custom"), `content` (sections array with label + text + optional assets), `assets` (array with id + src + optional hint), and optional `brand`, `tone`, `style`, `constraints` fields.',
          },
          enhance: {
            type: 'boolean',
            description: 'Enable LLM enhancement. When `true` and `ANTHROPIC_API_KEY` is set, Claude improves scene plan text and suggests camera moves. Falls back to rule-based output on any failure. Default: `false`.',
          },
          format: {
            type: 'string',
            enum: ['v2', 'v3'],
            description: 'Output format: `v2` (default) emits motion blocks; `v3` emits semantic components + interactions for content types that support it (typography, brand_mark, data_visualization, collage), with other types falling back to v2.',
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
            description: 'Array of analyzed scene objects with metadata (run `analyze_scene` first).',
          },
          styles: {
            type: 'array',
            items: { type: 'string', enum: STYLE_PACKS },
            minItems: 2,
            description: 'Array of style pack names to generate variants for. Minimum 2 styles.',
          },
          sequence_id: {
            type: 'string',
            description: 'Base sequence ID. Each variant receives a suffixed ID (e.g., `seq_hero__prestige`).',
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
            description: 'Array of variant objects from `plan_variants` output — each shaped as `{ variant_id, style, manifest }`.',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'The same analyzed scene objects used for `plan_variants`.',
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
            description: 'Detection options: `windowSize` (default 1024), `hopSize` (default 512), `threshold` (default 1.3), `minBeatInterval` (default 0.2s).',
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
            description: 'Sequence manifest with a `scenes` array and `duration_s` per scene.',
          },
          beats: {
            type: 'object',
            description: 'Beat analysis data from `analyze_beats`.',
          },
          options: {
            type: 'object',
            description: 'Sync options. `sync_mode` (`tight` or `loose`, default `tight`) sets tolerance; `max_adjust_pct` (default 0.15) caps duration changes; `include_hit_markers` / `include_audio_cues` toggle optional outputs; `archetype_slug` enables audio-cue planning; `hit_sensitivity` (0-1, default 0.5) tunes hit marker detection.',
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
            description: 'A v2 or v3 scene definition. v2 scenes carry a `motion` block with groups, recipes, stagger, cues, and camera sync; v3 scenes carry a `semantic` block with components, interactions, and camera_behavior.',
          },
          personality: {
            type: 'string',
            enum: getAllPersonalitySlugs(),
            description: 'Personality slug used for guardrail validation. Optional — falls back to `scene.personality` when omitted.',
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
            description: 'A compiled Level 2 motion timeline (output of `compile_motion`) with `scene_id`, `duration_frames`, `fps`, and tracks.',
          },
          scene: {
            type: 'object',
            description: 'The original scene definition with its `layers` array. Used to detect orphan layers and hierarchy issues.',
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
            description: 'What kind of video — `brand-teaser`, `feature-reveal`, `onboarding-explainer`, `launch-reel`, `testimonial-cutdown`, `social-loop`, or a freeform description.',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Filter archetypes by personality compatibility — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
          },
          duration_s: {
            type: 'number',
            description: 'Target duration in seconds. Helps narrow archetype selection.',
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
          title: { type: 'string', description: 'Human-readable project title.' },
          slug: { type: 'string', description: 'URL-safe project slug (e.g., `fintech-sizzle`).' },
          brand: { type: 'string', description: 'Brand identifier to associate with the project.' },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Animation personality — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
          },
          style_pack: {
            type: 'string',
            enum: ['prestige', 'energy', 'dramatic', 'minimal', 'intimate', 'corporate', 'kinetic', 'fade'],
            description: 'Style pack — `prestige`, `energy`, `dramatic`, `minimal`, `intimate`, `corporate`, `kinetic`, or `fade`.',
          },
          date_prefix: { type: 'boolean', description: 'Prepend `YYYY-MM-DD` to the folder name. Default: `true`.' },
          resolution: {
            type: 'object',
            properties: { w: { type: 'number' }, h: { type: 'number' } },
            description: 'Output resolution as `{ w, h }`. Default: 1920x1080.',
          },
          fps: { type: 'number', description: 'Frame rate. Default: 60.' },
          duration_target_s: { type: 'number', description: 'Target duration in seconds.' },
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
          project: { type: 'string', description: 'Project slug or path.' },
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
          project: { type: 'string', description: 'Project slug or path.' },
          include: {
            type: 'array',
            items: { type: 'string', enum: ['brief', 'storyboard', 'scenes', 'manifest', 'review'] },
            description: 'Which context sections to include — any of `brief`, `storyboard`, `scenes`, `manifest`, `review`. Defaults to all.',
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
          project: { type: 'string', description: 'Project slug.' },
          kind: { type: 'string', enum: ['brief', 'storyboard', 'manifest', 'render', 'scene', 'version', 'review'], description: 'Artifact type — `brief`, `storyboard`, `manifest`, `render`, `scene`, `version`, or `review`.' },
          path: { type: 'string', description: 'Relative path within the project.' },
          role: { type: 'string', description: 'Entrypoint role to update (e.g., `latest_render`, `approved_render`).' },
          scene_id: { type: 'string', description: 'Scene ID (for `scene` artifacts).' },
          version_id: { type: 'string', description: 'Version ID (for `version` artifacts).' },
          metadata: { type: 'object', description: 'Additional metadata to store on the artifact.' },
        },
        required: ['project', 'kind', 'path'],
      },
    },
    {
      name: 'render_project',
      description:
        'Render a project manifest to video. Writes output to renders/ within the project. Runs the preflight doctor (ANI-115) by default — encoder / font / plate / manifest / disk checks — and aborts on any fail-level check unless skip_preflight is true.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project slug.' },
          manifest: { type: 'string', description: 'Relative path to the manifest within the project. Defaults to `root_manifest` from `project.json`.' },
          output: { type: 'string', description: 'Relative output path within the project. Default: `renders/draft/`.' },
          mark_as_latest: { type: 'boolean', description: 'Update `entrypoints.latest_render` after a successful render. Default: `true`.' },
          skip_preflight: { type: 'boolean', description: 'Skip the preflight doctor. Default: `false`. Use when you know the environment is ready and want to bypass checks.' },
          dry_run: { type: 'boolean', description: 'Assemble render props and run preflight without spawning the render. Default: `false`.' },
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
          project: { type: 'string', description: 'Project slug.' },
          manifest: { type: 'string', description: 'Relative path to the manifest within the project. Defaults to `root_manifest`.' },
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
            description: 'Art direction slug.',
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
            description: 'Personality slug — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
          },
          style_pack: {
            type: 'string',
            description: 'Style pack name (e.g., `dramatic`, `intimate`, `prestige`, `energy`).',
          },
          art_direction: {
            type: 'string',
            description: 'Art direction slug. Optional — reserved for future integration.',
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
            description: 'Optional custom passes to score in place of the recommended stack. Each entry is `{ slug, overrides? }`.',
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
            description: 'URL-safe identifier in kebab-case (e.g., `acme-corp`).',
          },
          name: {
            type: 'string',
            description: 'Display name for the brand.',
          },
          description: {
            type: 'string',
            description: 'Short description of brand positioning.',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Default animation personality — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
          },
          style: {
            type: 'string',
            description: 'Default style pack name (e.g., `prestige`, `dramatic`, `energy`).',
          },
          colors: {
            type: 'object',
            description: 'Brand color tokens: `bg_primary`, `text_primary`, `accent`, etc.',
          },
          typography: {
            type: 'object',
            description: 'Typography tokens: `font_family`, `hero`, `tagline`, `heading`, `body`, `label`.',
          },
          logo: {
            type: 'object',
            description: 'Logo configuration: `primary`, `monochrome`, `icon_only`, `safe_zone_pct`, `min_size_px`.',
          },
          intro_outro: {
            type: 'object',
            description: 'Logo intro/outro animation: `intro_style`, `intro_duration_ms`, `outro_style`, `outro_duration_ms`, `outro_hold_ms`.',
          },
          motion: {
            type: 'object',
            description: 'Motion rules: `preferred_personality`, `preferred_style_pack`, `preferred_easing`, `forbidden_moves[]`, `max_intensity` (0-1).',
          },
          guidelines: {
            type: 'object',
            description: 'Brand guidelines: `dos[]` and `donts[]`.',
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
            description: 'Brand identifier (e.g., `fintech-demo`, `mercury`, `_default`).',
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
            description: 'Brand identifier to validate against.',
          },
          manifest: {
            type: 'object',
            description: 'Sequence manifest to check.',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Scene objects to check for camera/color compliance.',
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
            description: 'Sequence manifest with a `scenes` array.',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Scene definitions to evaluate.',
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
          archetype_slug: { type: 'string', description: 'Archetype slug (e.g., `prompt_to_answer`, `brief_to_board`).' },
          personality: { type: 'string', enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'], description: 'Personality — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.' },
          duration_s: { type: 'number', description: 'Target total duration in seconds.' },
          content_hints: { type: 'object', description: 'Optional content hints keyed by scene role.' },
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
          preset_slug: { type: 'string', description: 'Finish preset slug (e.g., `cinematic-film`, `clean-digital`, `editorial-subtle`, `social-punchy`, `premium-brand`).' },
          manifest: { type: 'object', description: 'Manifest to apply the finish to.' },
          overrides: { type: 'object', description: 'Optional per-pass parameter overrides.' },
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
          timeline: { type: 'object', description: 'Compiled timeline object (output of `compile_motion`).' },
          scene: { type: 'object', description: 'The matching scene definition.' },
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
            description: 'Project slug to load manifest/scenes from (alternative to passing inline data).',
          },
          manifest: {
            type: 'object',
            description: 'Inline sequence manifest (if not loading from a project).',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Inline scene definitions (if not loading from a project).',
          },
          includeTimecodes: {
            type: 'boolean',
            description: 'Include start/end timecodes per scene. Default: `true`.',
          },
          includeTechnical: {
            type: 'boolean',
            description: 'Include camera move and energy level per scene. Default: `true`.',
          },
          format: {
            type: 'string',
            enum: ['json', 'markdown'],
            description: 'Output format: `json` (default) or `markdown`.',
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
            description: 'Project slug (reserved for future version history support).',
          },
          version_a: {
            type: 'string',
            description: 'Version A identifier (reserved for future version history support).',
          },
          version_b: {
            type: 'string',
            description: 'Version B identifier (reserved for future version history support).',
          },
          manifest_a: {
            type: 'object',
            description: 'First manifest to compare (inline).',
          },
          manifest_b: {
            type: 'object',
            description: 'Second manifest to compare (inline).',
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
            description: 'Scene ID (must match `^sc_[a-z0-9_]+$`).',
          },
          duration_s: {
            type: 'number',
            description: 'Scene duration in seconds (0.5–30).',
          },
          layers: {
            type: 'array',
            description: 'Array of layer objects — `{ id, type, content, anchor, max_w, z_bias, depth_class, src, fit }`. Anchors: `center`, `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`. Depth classes: `background`, `midground`, `foreground`.',
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
          background: {
            type: 'object',
            description: 'Background config: `{ color, color_alt, treatment }`. Treatment: `solid`, `gradient`, `radial`, `mesh`, or `blur_plate`.',
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
            description: 'Camera config: `{ move, intensity, easing }`. Optional.',
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
            description: 'What this editorial scene needs to communicate (e.g., "headline with floating prompt card and result").',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Animation personality for style-appropriate defaults — `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
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
            description: 'The source sequence manifest to adapt.',
          },
          target_aspect_ratio: {
            type: 'string',
            enum: ['16:9', '1:1', '4:5', '9:16'],
            description: 'Target aspect ratio — `16:9`, `1:1`, `4:5`, or `9:16`.',
          },
          recompose: {
            type: 'boolean',
            description: 'If `true`, recalculate layer positions for the new ratio. If `false`, simple crop. Default: `false`.',
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
            description: 'The source sequence manifest.',
          },
          target_aspect_ratio: {
            type: 'string',
            enum: ['16:9', '1:1', '4:5', '9:16'],
            description: 'Target aspect ratio for the cutdown — `16:9`, `1:1`, `4:5`, or `9:16`.',
          },
          max_duration_s: {
            type: 'number',
            description: 'Maximum total duration in seconds.',
          },
          scenes_to_keep: {
            type: 'array',
            items: { type: 'number' },
            description: 'Indices of scenes to keep (0-based). If omitted, the cutdown auto-selects key scenes.',
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
            description: 'The semantic role of the text block: `headline`, `caption`, `label`, or `quote`.',
          },
          content: {
            type: 'string',
            description: 'The text content to be animated.',
          },
          personality: {
            type: 'string',
            enum: ['cinematic-dark', 'editorial', 'neutral-light', 'montage'],
            description: 'Animation personality context: `cinematic-dark`, `editorial`, `neutral-light`, or `montage`.',
          },
          scene_energy: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Energy level of the scene — `low`, `medium`, or `high`. Affects animation intensity.',
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
            description: 'Sequence manifest with a `scenes` array.',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Scene definitions in the same order as `manifest.scenes`.',
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
            description: 'Sequence manifest with a `scenes` array.',
          },
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Scene definitions in the same order as `manifest.scenes`.',
          },
          auto_assign_ids: {
            type: 'boolean',
            description: 'Automatically assign `continuity_ids` to layers that match across scenes. Default: `true`.',
          },
        },
        required: ['manifest', 'scenes'],
      },
    },
    // ── Autonomous direction loop ───────────────────────────────────────
    {
      name: 'extract_story_brief',
      description:
        'Extract a structured story brief from project context. Parses brief markdown, matches sequence archetypes, infers personality/style from brand. Returns audience, promise, tone, features, proof points, closing beat, and narrative template.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'object', description: 'Contents of `project.json` for the target project.' },
          brief: { type: 'string', description: 'Brief markdown text.' },
          storyboard: { type: 'object', description: 'Storyboard JSON. Optional.' },
          scenes: { type: 'array', items: { type: 'object' }, description: 'Scene definitions. Optional — improves inference when supplied.' },
          brand: { type: 'object', description: 'Brand package. Optional.' },
          overrides: { type: 'object', description: 'Explicit field overrides that take precedence over inference.' },
        },
      },
    },
    {
      name: 'plan_story_beats',
      description:
        'Map a story brief onto a sequence archetype to produce a concrete beat plan with durations, camera intents, transitions, and continuity opportunities. Optionally snaps to audio beats.',
      inputSchema: {
        type: 'object',
        properties: {
          story_brief: { type: 'object', description: 'Output of `extract_story_brief`.' },
          archetype_slug: { type: 'string', description: 'Sequence archetype slug (e.g., `brand-teaser`, `feature-reveal`, `onboarding-explainer`).' },
          audio_beats: { type: 'object', description: 'Beat data from `analyze_beats`. When provided, beat durations snap to audio beats.' },
          options: {
            type: 'object',
            description: 'Planning options. `duration_target_s` (number) sets total target duration; `strategy` picks pacing bias — `tight`, `loose`, or `cinematic`.',
            properties: {
              duration_target_s: { type: 'number' },
              strategy: { type: 'string', enum: ['tight', 'loose', 'cinematic'] },
            },
          },
        },
        required: ['story_brief', 'archetype_slug'],
      },
    },
    {
      name: 'score_candidate_video',
      description:
        'Score a candidate video manifest across 6 dimensions: hook, narrative_arc, clarity, visual_hierarchy, motion_quality, brand_finish. Runs all existing evaluators (sequence eval, per-scene critic, motion density, brand compliance, product clarity, audio sync) and returns a unified 0-1 score card with findings and revision recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: { type: 'object', description: 'Sequence manifest to score.' },
          scenes: { type: 'array', items: { type: 'object' }, description: 'Scene definitions matching the manifest.' },
          style: { type: 'string', description: 'Style pack name. Used by the sequence evaluator.' },
          brand: { type: 'object', description: 'Brand package. Enables brand-finish scoring.' },
          audio_beats: { type: 'object', description: 'Beat data from `analyze_beats`. Enables audio-sync scoring.' },
          weights: { type: 'object', description: 'Custom per-dimension weights to override the default scorecard balance.' },
        },
        required: ['manifest', 'scenes'],
      },
    },
    {
      name: 'revise_candidate_video',
      description:
        'Apply bounded revision operations to a manifest. Operations: trim, extend_hold, swap_transition, reorder, boost_hierarchy, compress, add_continuity, adjust_density. Returns revised manifest, scenes, and a diff log.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: { type: 'object', description: 'Sequence manifest to revise.' },
          scenes: { type: 'array', items: { type: 'object' }, description: 'Scene definitions that accompany the manifest.' },
          revisions: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of revision ops shaped as `{ op, target, ...params }`.',
          },
        },
        required: ['manifest', 'revisions'],
      },
    },
    {
      name: 'compare_candidate_videos',
      description:
        'Rank 2-3 scored video candidates. Returns overall rankings, per-dimension winners, and a recommendation with rationale and trade-off analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          candidates: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of candidate objects, each shaped as `{ candidate_id, strategy, score_card, manifest }`.',
          },
        },
        required: ['candidates'],
      },
    },
    {
      name: 'annotate_scenes',
      description:
        'Bulk-annotate scene arrays with inferred semantic product fields: product_role (input/result/dashboard/cta/atmosphere/etc.), primary_subject, interaction_truth, layer roles, content classes, and clarity weights. Returns annotated scenes ready for scoring and critique.',
      inputSchema: {
        type: 'object',
        properties: {
          scenes: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of scene objects',
          },
        },
        required: ['scenes'],
      },
    },
    {
      name: 'auto_revise_loop',
      description:
        'Autonomous revision loop: scores per-scene, picks worst scenes, applies targeted revisions, re-scores, repeats until convergence or max rounds. Returns the best manifest with full revision history.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: { type: 'object', description: 'Starting sequence manifest.' },
          scenes: { type: 'array', items: { type: 'object' }, description: 'Scene definitions matching the manifest.' },
          style: { type: 'string', description: 'Style pack name. Used by the internal scorer.' },
          brand: { type: 'object', description: 'Brand package. Enables brand-finish scoring during each round.' },
          audio_beats: { type: 'object', description: 'Beat data from `analyze_beats`. Enables audio-sync scoring.' },
          max_rounds: { type: 'number', description: 'Maximum revision rounds. Default: `3`.' },
          min_improvement: { type: 'number', description: 'Convergence threshold — stop when round-over-round score gain drops below this. Default: `0.01`.' },
        },
        required: ['manifest', 'scenes'],
      },
    },
    {
      name: 'audit_annotation_quality',
      description:
        'Audit annotation quality across scenes. Checks for hero layers, low-confidence inferences, missing outcomes. Returns quality score (0-1) and pass/fail. Modes: "advisory" (warnings) or "strict" (errors block autonomous revisions).',
      inputSchema: {
        type: 'object',
        properties: {
          scenes: { type: 'array', items: { type: 'object' }, description: 'Annotated scene array' },
          mode: { type: 'string', enum: ['advisory', 'strict'], description: 'advisory (default) or strict' },
          confidence_threshold: { type: 'number', description: 'Min confidence threshold (default: 0.6)' },
        },
        required: ['scenes'],
      },
    },
    {
      name: 'upgrade_project_confidence',
      description:
        'Safe metadata repair tool. Reads annotation audit, generates targeted patches for low-confidence scenes (product_role, primary_subject, interaction_truth, hero layers). Modes: "suggest" (return patches), "apply" (write patches), "apply_safe_only" (skip continuity links). Never changes authored content.',
      inputSchema: {
        type: 'object',
        properties: {
          scenes: { type: 'array', items: { type: 'object' }, description: 'Scene definitions (annotated or raw)' },
          mode: { type: 'string', enum: ['suggest', 'apply', 'apply_safe_only'], description: 'suggest (default), apply, or apply_safe_only' },
          targets: { type: 'array', items: { type: 'string' }, description: 'Specific scene IDs to target (optional)' },
          max_patches: { type: 'number', description: 'Max patches to generate (default: 20)' },
          rules: {
            type: 'object',
            properties: {
              only_safe_metadata: { type: 'boolean' },
              min_confidence_to_apply_continuity: { type: 'number' },
              min_confidence_to_apply_structural_unlock: { type: 'number' },
            },
          },
        },
        required: ['scenes'],
      },
    },
    {
      name: 'generate_brief_stub',
      description:
        'Generate a brief markdown stub from project context. Pre-fills audience, promise, tone, features, and proof sections with inferred content so the author starts from a structured template instead of a blank page.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'object', description: 'Contents of `project.json` for the target project.' },
          scenes: { type: 'array', items: { type: 'object' }, description: 'Scene definitions. Optional — improves inference when supplied.' },
          brand: { type: 'object', description: 'Brand package. Optional.' },
        },
      },
    },
    {
      name: 'score_frame_strip',
      description:
        'Score a frame strip (contact sheet + annotated scenes) for visual quality: contrast, readability, visual hierarchy, brand consistency, and pacing rhythm. Returns per-scene and aggregate scores with findings. Operates on metadata — does not require pixel data.',
      inputSchema: {
        type: 'object',
        properties: {
          contact_sheet: { type: 'object', description: 'Output of `generate_contact_sheet`.' },
          scenes: { type: 'array', items: { type: 'object' }, description: 'Annotated scene definitions.' },
          brand: { type: 'object', description: 'Brand package. Optional — enables brand-consistency scoring.' },
          manifest: { type: 'object', description: 'Sequence manifest. Optional — enables pacing-rhythm scoring.' },
        },
        required: ['contact_sheet', 'scenes'],
      },
    },
    {
      name: 'resolve_render_targets',
      description:
        'Route scenes to optimal render targets: web_native (real DOM), browser_capture (Puppeteer→plate), remotion_native (direct Remotion), or hybrid. Pure routing — deterministic, no side effects. Returns target + reason + capture config per scene.',
      inputSchema: {
        type: 'object',
        properties: {
          scenes: { type: 'array', items: { type: 'object' }, description: 'Annotated scene definitions.' },
        },
        required: ['scenes'],
      },
    },
    {
      name: 'assemble_video_sequence',
      description:
        'Assemble a video from mixed render sources: browser-captured plate assets + native Remotion scenes. Resolves render targets, verifies plates, builds Remotion render-props, and returns a CLI render command. Handles graceful fallback when plates are missing.',
      inputSchema: {
        type: 'object',
        properties: {
          manifest: { type: 'object', description: 'Sequence manifest.' },
          scene_defs: { type: 'object', description: 'Scene definitions keyed by `scene_id`.' },
          scenes: { type: 'array', items: { type: 'object' }, description: 'Scene array (alternative to `scene_defs`).' },
          plates: { type: 'object', description: 'Plate assets keyed by `scene_id` — each entry is `{ src, format }`.' },
          timelines: { type: 'object', description: 'Compiled timelines keyed by `scene_id`.' },
          output_dir: { type: 'string', description: 'Directory to write `render-props.json`.' },
          output_path: { type: 'string', description: 'Final video output path.' },
        },
        required: ['manifest'],
      },
    },
    {
      name: 'preview_video',
      description:
        'Launch a live video preview in Remotion Studio. Pass a render-props.json path, manifest.json, or project directory. Opens the browser with the Sequence composition loaded with your scenes.',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Path to render-props.json, manifest.json, or project directory' },
        },
        required: ['input'],
      },
    },
    {
      name: 'get_delivery_profile',
      description:
        'Get encoding settings for a delivery channel. Maps channels (youtube, instagram-feed, email, tiktok, etc.) to optimal resolution, fps, codec, CRF, and max file size. Use slug for exact profile or channel name for auto-matching.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Profile slug — `web-hero`, `social-feed`, `story-reel`, `email-gif`, `presentation`, `master`, etc.' },
          channel: { type: 'string', description: 'Channel name — `youtube`, `instagram-feed`, `email`, `tiktok`, etc. Auto-matches to the best profile when `slug` is omitted.' },
        },
      },
    },
  ];
}
