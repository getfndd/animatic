/**
 * Storyboard Composition
 *
 * Wedges the design checkpoint between extract_story_brief and plan_story_beats.
 * Takes a structured story brief + archetype + brand and produces a storyboard
 * shaped per docs/cinematography/specs/storyboard-format.md.
 *
 * Two-stage:
 *   1. Deterministic skeleton (this module)
 *   2. Optional LLM enrichment (mcp/lib/llm.js → enhanceStoryboard)
 *
 * Pure function. JSON in, JSON out. No fs writes; the MCP handler owns persistence.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ── Catalog loaders ─────────────────────────────────────────────────────────

let _archetypes = null;
function loadArchetypes() {
  if (!_archetypes) {
    _archetypes = JSON.parse(readFileSync(resolve(ROOT, 'catalog/sequence-archetypes.json'), 'utf-8'));
  }
  return _archetypes;
}

let _roleMap = null;
function loadRoleMap() {
  if (!_roleMap) {
    _roleMap = JSON.parse(readFileSync(resolve(ROOT, 'catalog/role-to-content-type.json'), 'utf-8'));
  }
  return _roleMap;
}

// ── Brand → prose notes ─────────────────────────────────────────────────────

function brandPaletteNote(brand) {
  if (!brand?.colors) return null;
  const c = brand.colors;
  const parts = [];
  if (c.bg_primary) parts.push(`Bg ${c.bg_primary}`);
  if (c.bg_surface) parts.push(`surface ${c.bg_surface}`);
  if (c.text_primary) parts.push(`text ${c.text_primary}`);
  if (c.accent) parts.push(`accent ${c.accent}`);
  return parts.length ? `${parts.join('. ')}. No pure white, no pure black.` : null;
}

function brandTypographyNote(brand) {
  if (!brand?.typography) return null;
  const t = brand.typography;
  const parts = [];
  if (t.font_family) parts.push(t.font_family.split(',')[0].replace(/['"]/g, '').trim());
  if (t.hero) parts.push(`Hero ${t.hero.size} weight ${t.hero.weight}`);
  if (t.body) parts.push(`body ${t.body.size} weight ${t.body.weight}`);
  if (t.label) parts.push(`label ${t.label.size}`);
  return parts.length ? parts.join('. ') + '.' : null;
}

function brandSurfaceNote(brand) {
  if (!brand?.surfaces) return null;
  const s = brand.surfaces;
  const parts = [];
  if (s.card) parts.push(`Card ${s.card.border_radius} radius`);
  if (s.panel) parts.push(`panel ${s.panel.border_radius} radius`);
  if (s.input) parts.push(`input ${s.input.border_radius} radius`);
  return parts.length ? parts.join(', ') + '.' : null;
}

// ── Panel-act derivation ────────────────────────────────────────────────────

const LOW_ENERGIES = new Set(['still', 'low']);
const HIGH_ENERGIES = new Set(['high', 'impact']);

/**
 * Derive panel.act from scene position + energy curve.
 * open → first; close → last; peak → max-energy middle; resolve → low-energy
 * second-to-last; build → everything else in the middle.
 */
function deriveActs(scenes) {
  const n = scenes.length;
  if (n === 0) return [];
  if (n === 1) return ['open'];

  const acts = new Array(n);
  acts[0] = 'open';
  acts[n - 1] = 'close';

  // Find peak: highest-energy scene in the middle range
  let peakIdx = -1;
  for (let i = 1; i < n - 1; i++) {
    if (HIGH_ENERGIES.has(scenes[i].energy)) {
      peakIdx = i;
      break;
    }
  }
  if (peakIdx >= 0) acts[peakIdx] = 'peak';

  // Resolve: low-energy second-to-last (when not already 'peak')
  if (n >= 3 && !acts[n - 2] && LOW_ENERGIES.has(scenes[n - 2].energy)) {
    acts[n - 2] = 'resolve';
  }

  // Fill the rest with 'build'
  for (let i = 0; i < n; i++) {
    if (!acts[i]) acts[i] = 'build';
  }
  return acts;
}

// ── Feature distribution ────────────────────────────────────────────────────

const PRIMARY_COLLECTION_TYPES = new Set(['insight_cards', 'dashboard']);
const SECONDARY_COLLECTION_TYPES = new Set(['split_panel']);
const STAT_TYPES = new Set(['stat_callout', 'chart_panel']);

/**
 * Distribute must_show_features and proof_points across panels.
 *
 * Priority:
 *   1. Primary collection panels (insight_cards, dashboard) absorb ALL features
 *      as a single array. The 4-pillar Polaris case lands here.
 *   2. Secondary collection panels (split_panel) only receive features if no
 *      primary collection exists in the storyboard.
 *   3. Stat / chart panels take one feature or proof point each.
 *   4. Typography panels take strings (promise, taglines).
 *
 * Returns a map { panel_index → content_value }.
 */
function distributeContent(panels, storyBrief, project) {
  const features = [...(storyBrief.must_show_features || [])];
  const proofs = [...(storyBrief.proof_points || [])];
  const promise = storyBrief.promise || project?.title || '';
  const out = {};

  // Pass 1: primary collection panels swallow all features
  const primaryIdxs = panels
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => PRIMARY_COLLECTION_TYPES.has(p.content_type))
    .map(({ i }) => i);

  if (primaryIdxs.length === 1 && features.length > 0) {
    out[primaryIdxs[0]] = [...features];
    features.length = 0;
  } else if (primaryIdxs.length > 1) {
    const per = Math.ceil(features.length / primaryIdxs.length);
    for (let k = 0; k < primaryIdxs.length && features.length; k++) {
      out[primaryIdxs[k]] = features.splice(0, per);
    }
  }

  // Pass 1b: secondary collection panels (split_panel) — only when no primary
  // existed and there are still features to place. Treats secondaries the same
  // way primaries are treated, just lower priority.
  if (primaryIdxs.length === 0 && features.length > 0) {
    const secondaryIdxs = panels
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => SECONDARY_COLLECTION_TYPES.has(p.content_type))
      .map(({ i }) => i);
    if (secondaryIdxs.length === 1) {
      out[secondaryIdxs[0]] = [...features];
      features.length = 0;
    } else if (secondaryIdxs.length > 1) {
      const per = Math.ceil(features.length / secondaryIdxs.length);
      for (let k = 0; k < secondaryIdxs.length && features.length; k++) {
        out[secondaryIdxs[k]] = features.splice(0, per);
      }
    }
  }

  // Pass 2: stat/chart panels take remaining features or proofs
  for (let i = 0; i < panels.length; i++) {
    if (out[i] !== undefined) continue;
    const ct = panels[i].content_type;
    if (STAT_TYPES.has(ct)) {
      const pick = features.shift() || proofs.shift();
      if (pick) out[i] = pick;
    }
  }

  // Pass 3: typography panels by act
  for (let i = 0; i < panels.length; i++) {
    if (out[i] !== undefined) continue;
    const ct = panels[i].content_type;
    if (ct !== 'typography') continue;
    const act = panels[i].act;
    if (act === 'open' || act === 'build') {
      out[i] = features.shift() || promise;
    } else if (act === 'resolve') {
      out[i] = promise;
    } else if (act === 'close') {
      out[i] = project?.tagline || promise;
    } else {
      out[i] = features.shift() || promise;
    }
  }

  // Pass 4: logo_lockup
  for (let i = 0; i < panels.length; i++) {
    if (out[i] !== undefined) continue;
    if (panels[i].content_type === 'logo_lockup') {
      out[i] = {
        wordmark: project?.title || 'Brand',
        disclaimer: project?.disclaimer || '',
      };
    }
  }

  // Pass 5: anything else
  for (let i = 0; i < panels.length; i++) {
    if (out[i] === undefined) out[i] = '';
  }

  return out;
}

// ── Visual direction synthesis ──────────────────────────────────────────────

function visualDirectionFor(contentType, brand, defaults) {
  const d = defaults.content_type_defaults[contentType] || defaults.content_type_defaults.typography;

  // Override with brand-derived specifics where we have them
  const typography = brandTypographyNote(brand) || d.typography;
  const colorBase = brandPaletteNote(brand);
  const color = colorBase ? `${colorBase} ${d.color}` : d.color;
  const surfaces = brandSurfaceNote(brand) || d.surfaces;

  return {
    composition: d.composition,
    typography,
    color,
    surfaces,
    reference: d.reference,
  };
}

// ── Motion notes synthesis ──────────────────────────────────────────────────

function motionNotesFor(scene, energy, isLast) {
  const primitives = scene.recommended_primitives || [];
  const primary = primitives[0] || 'as-fadeIn';
  const choreographyHint = primitives.length > 1
    ? `Optional layered: ${primitives.slice(1).join(', ')}.`
    : 'Single-element entrance — no stagger.';

  const entranceTiming = LOW_ENERGIES.has(energy) ? '600ms ease-out' : '400ms ease-out';

  return {
    entrance: `${primary} entrance, ${entranceTiming}.`,
    choreography: choreographyHint,
    hold: 'Hold steady through the duration. Camera continues per move plan.',
    exit: isLast ? 'No exit — final panel.' : 'Crossfade to next panel.',
  };
}

// ── Main: compose deterministic skeleton ────────────────────────────────────

/**
 * Compose a storyboard from a structured story brief.
 *
 * @param {object} params
 * @param {object} params.story_brief - Output of extractStoryBrief.
 * @param {object} [params.brand] - Brand package.
 * @param {object} [params.project] - Project metadata for title/tagline.
 * @param {string} [params.archetype_slug] - Override archetype.
 * @param {object} [params.options]
 * @param {number} [params.options.duration_target_s] - Override total duration.
 * @returns {object} Storyboard skeleton (no LLM).
 */
export function composeStoryboard({ story_brief, brand, project, archetype_slug, options = {} } = {}) {
  if (!story_brief) {
    throw new Error('story_brief is required');
  }

  const archetypes = loadArchetypes();
  const roleMap = loadRoleMap();

  const slug = archetype_slug || story_brief.narrative_template || 'brand-teaser';
  const archetype = archetypes.find(a => a.slug === slug);
  if (!archetype) {
    throw new Error(`Unknown archetype: ${slug}. Available: ${archetypes.map(a => a.slug).join(', ')}`);
  }

  const totalDuration = options.duration_target_s
    || story_brief.duration_target_s
    || archetype.duration_range?.max_s
    || 30;

  const personality = story_brief.inferred_personality || 'cinematic-dark';
  const stylePack = story_brief.inferred_style_pack || 'prestige';

  // Compute durations from archetype percentages (mirrors planStoryBeats)
  let durations = archetype.scenes.map(s => {
    const pct = s.duration_pct || (1 / archetype.scenes.length);
    return Math.round(pct * totalDuration * 10) / 10;
  });
  const sum = durations.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - totalDuration) > 0.1) {
    const longestIdx = durations.indexOf(Math.max(...durations));
    durations[longestIdx] = Math.round((durations[longestIdx] + totalDuration - sum) * 10) / 10;
  }

  // Pre-derive acts (need to run before content distribution since acts inform it)
  const acts = deriveActs(archetype.scenes);

  // Build panel skeletons (without content yet)
  const panels = archetype.scenes.map((scene, i) => {
    const contentType = roleMap.roles[scene.role] || 'typography';
    const transitionIn = scene.transition_in
      ?? (i === 0 ? null : { type: 'crossfade', duration_ms: 400 });
    const nextScene = archetype.scenes[i + 1];
    const transitionOut = nextScene?.transition_in
      ?? (i === archetype.scenes.length - 1 ? null : { type: 'crossfade', duration_ms: 400 });

    return {
      panel_id: `p_${String(i + 1).padStart(2, '0')}`,
      act: acts[i],
      intent: scene.purpose || `Beat ${i + 1}`,
      description: scene.purpose || '',
      content: null, // populated below
      duration_s: durations[i],
      transition_in: transitionIn,
      transition_out: transitionOut,
      camera: scene.camera?.move
        ? `${scene.camera.move}${scene.camera.intensity ? ` ${scene.camera.intensity}` : ''}`
        : 'static',
      energy: scene.energy || 'medium',
      content_type: contentType,
      visual_direction: visualDirectionFor(contentType, brand, roleMap),
      motion_notes: motionNotesFor(scene, scene.energy, i === archetype.scenes.length - 1),
      _archetype_role: scene.role, // carried forward for downstream beat planning
    };
  });

  // Distribute brief content across panels
  const contentMap = distributeContent(panels, story_brief, project);
  panels.forEach((p, i) => { p.content = contentMap[i]; });

  // Storyboard envelope
  const sources = {
    audience: 'brief',
    archetype: archetype_slug ? 'override' : 'story_brief',
    duration: options.duration_target_s ? 'override' : 'story_brief',
    brand_palette: brandPaletteNote(brand) ? 'brand' : 'default',
    brand_typography: brandTypographyNote(brand) ? 'brand' : 'default',
    brand_surfaces: brandSurfaceNote(brand) ? 'brand' : 'default',
    visual_direction: 'default',
    motion_notes: 'archetype',
    llm: 'none',
  };

  // Deterministic id: derived from archetype + project so identical inputs
  // always produce identical output. Callers that need versioned ids can pass
  // options.storyboard_id explicitly.
  const projectKey = project?.slug || project?.id || 'unknown';
  const storyboardId = options.storyboard_id || `sb_${slug}_${projectKey}`;

  return {
    storyboard_id: storyboardId,
    brief_ref: project?.slug || project?.id || null,
    title: project?.title || `${slug} storyboard`,
    version: 1,
    direction: {
      narrative: archetype.description || `${slug} narrative arc`,
      tone: story_brief.emotional_tone || 'measured',
      energy_arc: (archetype.pacing_profile?.energy_curve || []).join(' → ') || null,
      total_duration_s: Math.round(durations.reduce((a, b) => a + b, 0) * 10) / 10,
      personality,
      style: stylePack,
    },
    brand: {
      ref: brand?.brand_id || brand?.slug || null,
      palette_note: brandPaletteNote(brand) || 'Default palette per personality.',
      typography_note: brandTypographyNote(brand) || 'Default typography per personality.',
      surface_note: brandSurfaceNote(brand) || 'Default surfaces per personality.',
    },
    panels,
    _sources: sources,
  };
}

// Expose for testing
export { deriveActs, distributeContent, brandPaletteNote, brandTypographyNote, brandSurfaceNote };
