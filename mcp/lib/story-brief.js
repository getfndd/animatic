/**
 * Story Brief Extraction
 *
 * Extracts a structured story brief from project context — brief markdown,
 * scene definitions, brand package, and storyboard. The output is the
 * canonical input for plan_story_beats and the autonomous direction loop.
 *
 * Pure function. JSON in, JSON out.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Catalog loaders (read once, cache) ──────────────────────────────────────

let _archetypes = null;
function loadArchetypes() {
  if (!_archetypes) {
    _archetypes = JSON.parse(readFileSync(resolve(ROOT, 'catalog/sequence-archetypes.json'), 'utf-8'));
  }
  return _archetypes;
}

let _briefTemplates = null;
function loadBriefTemplates() {
  if (!_briefTemplates) {
    _briefTemplates = JSON.parse(readFileSync(resolve(ROOT, 'catalog/brief-templates.json'), 'utf-8'));
  }
  return _briefTemplates;
}

// ── Emotional tone inference ────────────────────────────────────────────────

const PERSONALITY_TONE_MAP = {
  'cinematic-dark': 'aspirational',
  'editorial': 'measured',
  'neutral-light': 'clear',
  'montage': 'bold',
};

const STYLE_TONE_MAP = {
  prestige: 'aspirational',
  energy: 'bold',
  dramatic: 'urgent',
  minimal: 'clear',
  intimate: 'warm',
  corporate: 'measured',
  kinetic: 'bold',
  fade: 'contemplative',
};

// ── Closing beat inference ──────────────────────────────────────────────────

const CLOSING_ROLES = ['logo_lockup', 'cta_close', 'tagline_close', 'next_steps', 'attribution'];

function inferClosingBeat(scenes, archetype) {
  // Check last scene's intent tags
  if (scenes?.length > 0) {
    const last = scenes[scenes.length - 1];
    const tags = last.metadata?.intent_tags || [];
    if (tags.includes('closing')) return 'logo_lockup';
    if (tags.includes('cta')) return 'cta_close';
  }

  // Fall back to archetype's last scene role
  if (archetype?.scenes?.length > 0) {
    const lastRole = archetype.scenes[archetype.scenes.length - 1].role;
    if (CLOSING_ROLES.includes(lastRole)) return lastRole;
  }

  return 'logo_lockup';
}

// ── Brief markdown parsing ──────────────────────────────────────────────────

/**
 * Extract structured fields from brief markdown text.
 * Looks for heading-based sections: ## Audience, ## Promise, ## Features, etc.
 */
function parseBriefMarkdown(text) {
  if (!text || typeof text !== 'string') return {};

  const result = {};
  const sections = text.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (heading.includes('audience') || heading.includes('target')) {
      result.audience = body.split('\n')[0].trim();
    } else if (heading.includes('promise') || heading.includes('value prop')) {
      result.promise = body.split('\n')[0].trim();
    } else if (heading.includes('tone') || heading.includes('mood')) {
      result.emotional_tone = body.split('\n')[0].trim().toLowerCase();
    } else if (heading.includes('feature') || heading.includes('must show') || heading.includes('key point')) {
      result.must_show_features = body
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
    } else if (heading.includes('proof') || heading.includes('evidence') || heading.includes('social')) {
      result.proof_points = body
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
    }
  }

  return result;
}

// ── Scene-based inference ───────────────────────────────────────────────────

/**
 * Infer features from scene layers (asset filenames, content text, labels).
 */
function inferFeaturesFromScenes(scenes) {
  const features = new Set();

  for (const scene of scenes) {
    const layers = scene.layers || scene.data?.layers || [];
    for (const layer of layers) {
      // Text content
      if (layer.content && typeof layer.content === 'string' && layer.content.length < 100) {
        features.add(layer.content.trim());
      }
      if (layer.content?.text && layer.content.text.length < 100) {
        features.add(layer.content.text.trim());
      }
      // Labels
      if (layer.label) features.add(layer.label);
    }
    // Intent tags as feature hints
    const tags = scene.metadata?.intent_tags || [];
    if (tags.includes('hero')) {
      const heroLayer = layers.find(l => l.depth_class === 'hero' || l.role === 'hero');
      if (heroLayer?.label) features.add(heroLayer.label);
    }
  }

  return [...features].slice(0, 10); // Cap at 10
}

/**
 * Match scene intent_tags against archetype scene roles.
 * Returns the best-matching archetype slug.
 */
function matchArchetype(scenes, archetypes) {
  if (!scenes || scenes.length === 0) return null;

  const sceneIntents = scenes.map(s => {
    const tags = s.metadata?.intent_tags || [];
    const contentType = s.metadata?.content_type;
    return { tags, contentType };
  });

  let bestSlug = null;
  let bestScore = -1;

  for (const arch of archetypes) {
    let score = 0;

    // Score based on scene count proximity
    const countDiff = Math.abs(arch.scenes.length - scenes.length);
    score += Math.max(0, 5 - countDiff);

    // Score based on role/intent overlap
    for (let i = 0; i < Math.min(scenes.length, arch.scenes.length); i++) {
      const archScene = arch.scenes[i];
      const actualTags = sceneIntents[i]?.tags || [];

      // Check if any intent_tags match the archetype role keywords
      const roleWords = archScene.role.split('_');
      for (const tag of actualTags) {
        if (roleWords.includes(tag)) score += 2;
      }

      // Energy alignment
      if (actualTags.includes('hero') && archScene.energy === 'high') score += 1;
      if (actualTags.includes('opening') && i === 0) score += 1;
      if (actualTags.includes('closing') && i === scenes.length - 1) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSlug = arch.slug;
    }
  }

  return bestSlug;
}

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Extract a structured story brief from project context.
 *
 * @param {object} params
 * @param {object} [params.project] - project.json contents
 * @param {string} [params.brief] - Brief markdown text
 * @param {object} [params.storyboard] - storyboard.json
 * @param {object[]} [params.scenes] - Scene definitions
 * @param {object} [params.brand] - Brand package
 * @param {object} [params.overrides] - Explicit overrides for any field
 * @returns {object} Structured story brief
 */
export function extractStoryBrief({ project, brief, storyboard, scenes, brand, overrides } = {}) {
  const archetypes = loadArchetypes();
  const parsed = parseBriefMarkdown(brief);
  const sceneList = scenes || [];

  // Infer personality from brand > project > default
  const personality = brand?.personality
    || brand?.motion?.preferred_personality
    || project?.personality
    || 'cinematic-dark';

  const stylePack = brand?.style
    || brand?.motion?.preferred_style_pack
    || project?.style_pack
    || 'prestige';

  // Match archetype from scenes or project
  const matchedArchetype = matchArchetype(sceneList, archetypes);
  const archetypeSlug = matchedArchetype || 'brand-teaser';
  const archetype = archetypes.find(a => a.slug === archetypeSlug);

  // Duration from project format or archetype range
  const durationTarget = project?.format?.duration_target_s
    || archetype?.duration_range?.max_s
    || 30;

  // Build the brief
  const result = {
    audience: parsed.audience || brand?.guidelines?.target_audience || 'General audience',
    promise: parsed.promise || project?.title || 'Product value proposition',
    emotional_tone: parsed.emotional_tone || PERSONALITY_TONE_MAP[personality] || STYLE_TONE_MAP[stylePack] || 'aspirational',
    must_show_features: parsed.must_show_features || inferFeaturesFromScenes(sceneList),
    proof_points: parsed.proof_points || [],
    closing_beat: inferClosingBeat(sceneList, archetype),
    narrative_template: archetypeSlug,
    inferred_personality: personality,
    inferred_style_pack: stylePack,
    duration_target_s: durationTarget,
    scene_count: sceneList.length || archetype?.scenes?.length || 5,
  };

  // Apply overrides last
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value != null && key in result) {
        result[key] = value;
      }
    }
  }

  return result;
}

// Expose for testing
export { parseBriefMarkdown, matchArchetype, inferFeaturesFromScenes, inferClosingBeat };
