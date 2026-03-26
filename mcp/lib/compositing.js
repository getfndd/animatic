/**
 * Multi-pass compositing system — manifest-level post-processing.
 *
 * Compositing passes are lens effects, textures, and lighting overlays
 * applied on top of the rendered sequence. They are personality-aware
 * and scored for finishing quality.
 *
 * Exports:
 *   getCompositingPass(slug)
 *   listCompositingPasses(options)
 *   resolvePassCSS(pass, overrides)
 *   planCompositingStack(personality, stylePack, artDirection)
 *   scoreFinish(passes, personality)
 *   COMPOSITING_PASS_SLUGS
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, '..', '..', 'catalog', 'compositing-passes.json');

// ── Load catalog ────────────────────────────────────────────────────────────

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
const bySlug = new Map(catalog.map(p => [p.slug, p]));

/** All available compositing pass slugs. */
export const COMPOSITING_PASS_SLUGS = catalog.map(p => p.slug);

// ── getCompositingPass ──────────────────────────────────────────────────────

/**
 * Get a single compositing pass definition by slug.
 * @param {string} slug
 * @returns {object|null}
 */
export function getCompositingPass(slug) {
  return bySlug.get(slug) ?? null;
}

// ── listCompositingPasses ───────────────────────────────────────────────────

/**
 * List/filter compositing passes.
 * @param {object} [options]
 * @param {string} [options.category] - Filter by category (lens, texture, lighting)
 * @param {string} [options.personality] - Filter by personality affinity
 * @returns {object[]}
 */
export function listCompositingPasses(options = {}) {
  let results = [...catalog];

  if (options.category) {
    const cat = options.category.toLowerCase();
    results = results.filter(p => p.category === cat);
  }

  if (options.personality) {
    const pers = options.personality.toLowerCase();
    results = results.filter(p =>
      p.personality_affinity.includes(pers)
    );
  }

  return results;
}

// ── resolvePassCSS ──────────────────────────────────────────────────────────

/**
 * Resolve a compositing pass + parameter overrides into CSS properties
 * suitable for a Remotion overlay div.
 *
 * @param {object} pass - Pass definition (from catalog or getCompositingPass)
 * @param {object} [overrides] - Parameter overrides (merged with defaults)
 * @returns {object} CSS properties object
 */
export function resolvePassCSS(pass, overrides = {}) {
  if (!pass) return {};
  const params = { ...pass.defaults, ...overrides };
  const css = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1000,
  };

  switch (pass.slug) {
    case 'bloom': {
      const intensity = 1 + (params.intensity ?? 0.3);
      const radius = params.radius ?? 20;
      css.filter = `brightness(${intensity}) blur(${radius}px)`;
      css.mixBlendMode = pass.blend_mode || 'screen';
      css.opacity = params.opacity ?? 0.5;
      break;
    }

    case 'vignette': {
      const spread = (params.spread ?? 0.7) * 100;
      const color = params.color ?? '#000000';
      css.background = `radial-gradient(ellipse at center, transparent ${spread}%, ${color} 100%)`;
      css.opacity = params.opacity ?? 0.35;
      break;
    }

    case 'film-grain': {
      css.opacity = params.opacity ?? 0.04;
      css.mixBlendMode = params.blend ?? 'overlay';
      // SVG noise filter for grain simulation
      const size = params.size ?? 1;
      css.backgroundImage = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${0.65 / size}' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
      css.backgroundSize = `${128 * size}px ${128 * size}px`;
      break;
    }

    case 'chromatic-softness': {
      const offset = params.offset_px ?? 1.5;
      css.opacity = params.opacity ?? 0.15;
      css.mixBlendMode = 'screen';
      css.boxShadow = `${offset}px 0 0 rgba(255,0,0,0.3), -${offset}px 0 0 rgba(0,0,255,0.3)`;
      break;
    }

    case 'light-sweep': {
      const angle = params.angle_deg ?? 45;
      const width = params.width_pct ?? 15;
      const color = params.color ?? 'rgba(255,255,255,0.8)';
      css.background = `linear-gradient(${angle}deg, transparent 0%, transparent ${50 - width / 2}%, ${color} 50%, transparent ${50 + width / 2}%, transparent 100%)`;
      css.opacity = params.opacity ?? 0.08;
      css.animationDuration = `${params.speed_s ?? 3}s`;
      css.animationTimingFunction = 'linear';
      css.animationIterationCount = 'infinite';
      break;
    }

    case 'masked-highlight': {
      const x = params.x_pct ?? 50;
      const y = params.y_pct ?? 50;
      const r = params.radius_pct ?? 30;
      css.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,${params.intensity ?? 0.12}) 0%, transparent ${r}%)`;
      break;
    }

    case 'shallow-dof': {
      const focusX = params.focus_x_pct ?? 50;
      const focusY = params.focus_y_pct ?? 50;
      const focusR = params.focus_radius_pct ?? 40;
      const blurMax = params.blur_max ?? 6;
      // Use mask to create focus area, backdrop-filter for blur
      css.backdropFilter = `blur(${blurMax}px)`;
      css.WebkitBackdropFilter = `blur(${blurMax}px)`;
      css.maskImage = `radial-gradient(ellipse at ${focusX}% ${focusY}%, transparent ${focusR}%, black ${focusR + 20}%)`;
      css.WebkitMaskImage = css.maskImage;
      break;
    }

    default:
      break;
  }

  return css;
}

// ── planCompositingStack ────────────────────────────────────────────────────

/**
 * Personality-to-default compositing stacks.
 * These define the "standard finish" for each personality.
 */
const PERSONALITY_STACKS = {
  'cinematic-dark': [
    { slug: 'vignette', overrides: { spread: 0.65, opacity: 0.4 } },
    { slug: 'film-grain', overrides: { opacity: 0.04 } },
    { slug: 'bloom', overrides: { intensity: 0.25, radius: 16, opacity: 0.35 } },
    { slug: 'shallow-dof', overrides: { blur_max: 4 } },
  ],
  'editorial': [
    { slug: 'vignette', overrides: { spread: 0.8, opacity: 0.2, color: '#1a1a1a' } },
    { slug: 'chromatic-softness', overrides: { offset_px: 1, opacity: 0.08 } },
  ],
  'neutral-light': [
    { slug: 'masked-highlight', overrides: { intensity: 0.06, radius_pct: 40 } },
  ],
  'montage': [
    { slug: 'light-sweep', overrides: { opacity: 0.06, speed_s: 2 } },
    { slug: 'vignette', overrides: { spread: 0.75, opacity: 0.25 } },
  ],
};

/**
 * Style-pack adjustments layered on top of personality defaults.
 */
const STYLE_PACK_ADJUSTMENTS = {
  'dramatic': {
    add: [{ slug: 'bloom', overrides: { intensity: 0.35, radius: 24 } }],
    adjust: { vignette: { opacity: 0.45 } },
  },
  'intimate': {
    adjust: {
      'film-grain': { opacity: 0.06 },
      'chromatic-softness': { offset_px: 2, opacity: 0.12 },
    },
    add: [{ slug: 'chromatic-softness', overrides: { offset_px: 2, opacity: 0.12 } }],
  },
  'energy': {
    adjust: { 'light-sweep': { speed_s: 1.5, opacity: 0.1 } },
  },
  'kinetic': {
    adjust: { 'light-sweep': { speed_s: 1, opacity: 0.12 } },
  },
  'prestige': {
    adjust: { vignette: { opacity: 0.3 } },
    add: [{ slug: 'chromatic-softness', overrides: { offset_px: 1, opacity: 0.06 } }],
  },
  'minimal': {
    // Minimal — strip most effects
    remove: ['bloom', 'film-grain', 'chromatic-softness', 'light-sweep', 'shallow-dof'],
  },
  'fade': {
    adjust: { vignette: { opacity: 0.2 } },
  },
  'analog': {
    add: [{ slug: 'film-grain', overrides: { opacity: 0.08, size: 1.5 } }],
    adjust: { vignette: { opacity: 0.35, color: '#2a1a0a' } },
  },
  'documentary': {
    add: [{ slug: 'film-grain', overrides: { opacity: 0.05 } }],
    adjust: { vignette: { spread: 0.85, opacity: 0.15 } },
  },
};

/**
 * Recommend a compositing stack for a given personality + style pack + art direction.
 *
 * @param {string} personality - Personality slug
 * @param {string} [stylePack] - Style pack name
 * @param {string} [artDirection] - Art direction slug (reserved for future use)
 * @returns {{ passes: Array<{slug: string, overrides: object, pass: object, css: object}>, notes: string[] }}
 */
export function planCompositingStack(personality, stylePack, artDirection) {
  const notes = [];
  const pSlug = (personality || '').toLowerCase();

  // Start with personality defaults
  let stack = JSON.parse(JSON.stringify(PERSONALITY_STACKS[pSlug] || []));
  if (stack.length === 0) {
    notes.push(`No default compositing stack for personality "${personality}". Using empty stack.`);
  }

  // Apply style pack adjustments
  if (stylePack) {
    const adj = STYLE_PACK_ADJUSTMENTS[stylePack];
    if (adj) {
      // Remove passes
      if (adj.remove) {
        stack = stack.filter(s => !adj.remove.includes(s.slug));
        notes.push(`Style pack "${stylePack}" removed: ${adj.remove.join(', ')}`);
      }

      // Adjust existing passes
      if (adj.adjust) {
        for (const [slug, overrides] of Object.entries(adj.adjust)) {
          const entry = stack.find(s => s.slug === slug);
          if (entry) {
            entry.overrides = { ...entry.overrides, ...overrides };
          }
        }
      }

      // Add new passes (if not already present)
      if (adj.add) {
        for (const addition of adj.add) {
          if (!stack.find(s => s.slug === addition.slug)) {
            stack.push({ ...addition });
          }
        }
      }
    }
  }

  // Art direction reserved — could add color tinting, specific DOF focus, etc.
  if (artDirection) {
    notes.push(`Art direction "${artDirection}" noted — compositing integration reserved for future.`);
  }

  // Resolve each pass to full definitions + CSS
  const resolved = stack.map(entry => {
    const pass = getCompositingPass(entry.slug);
    if (!pass) {
      notes.push(`Warning: compositing pass "${entry.slug}" not found in catalog.`);
      return null;
    }
    return {
      slug: entry.slug,
      overrides: entry.overrides,
      pass,
      css: resolvePassCSS(pass, entry.overrides),
    };
  }).filter(Boolean);

  return { passes: resolved, notes };
}

// ── scoreFinish ─────────────────────────────────────────────────────────────

/**
 * Score the finishing quality of a compositing stack for a personality.
 *
 * Criteria:
 * - Has vignette? (10pts)
 * - Has grain? (10pts for cinematic-dark, 5pts for others)
 * - Has bloom? (10pts for cinematic-dark, 0 for editorial/neutral-light — they shouldn't)
 * - DOF for cinematic-dark? (10pts)
 * - Not over-processed? (deductions for too many passes or excessive params)
 * - Personality compatibility? (deductions for incompatible passes)
 *
 * @param {Array<{slug: string, overrides?: object}>} passes - Pass entries
 * @param {string} personality - Personality slug
 * @returns {{ score: number, max: number, breakdown: object, notes: string[] }}
 */
export function scoreFinish(passes, personality) {
  const pSlug = (personality || '').toLowerCase();
  const slugs = (passes || []).map(p => p.slug || p);
  const notes = [];
  const breakdown = {};
  let score = 0;
  const max = 100;

  // ── Base presence checks (up to 40pts) ───────────────────────────────

  // Vignette (10pts)
  if (slugs.includes('vignette')) {
    breakdown.vignette = 10;
    score += 10;
  } else {
    breakdown.vignette = 0;
    notes.push('Missing vignette — adds visual focus and polish.');
  }

  // Film grain (up to 10pts)
  if (slugs.includes('film-grain')) {
    if (pSlug === 'cinematic-dark') {
      breakdown.grain = 10;
      score += 10;
    } else if (pSlug === 'editorial') {
      breakdown.grain = 5;
      score += 5;
    } else {
      breakdown.grain = 3;
      score += 3;
      notes.push('Film grain is unusual for this personality — keep opacity very low.');
    }
  } else {
    breakdown.grain = 0;
    if (pSlug === 'cinematic-dark') {
      notes.push('Missing film grain — essential for cinematic-dark finish.');
    }
  }

  // Bloom (up to 10pts)
  if (slugs.includes('bloom')) {
    if (pSlug === 'cinematic-dark') {
      breakdown.bloom = 10;
      score += 10;
    } else if (pSlug === 'editorial' || pSlug === 'neutral-light') {
      breakdown.bloom = -5;
      score -= 5;
      notes.push('Bloom is not appropriate for this personality — remove it.');
    } else {
      breakdown.bloom = 3;
      score += 3;
    }
  } else {
    breakdown.bloom = 0;
    if (pSlug === 'cinematic-dark') {
      notes.push('Consider adding bloom for cinematic-dark — sells the lens quality.');
    }
  }

  // DOF (up to 10pts)
  if (slugs.includes('shallow-dof')) {
    if (pSlug === 'cinematic-dark') {
      breakdown.dof = 10;
      score += 10;
    } else if (pSlug === 'neutral-light') {
      breakdown.dof = -10;
      score -= 10;
      notes.push('Shallow DOF violates neutral-light clarity rules — remove it.');
    } else if (pSlug === 'editorial') {
      breakdown.dof = -5;
      score -= 5;
      notes.push('Editorial forbids blur effects — shallow DOF should be removed.');
    } else {
      breakdown.dof = 0;
    }
  } else {
    breakdown.dof = 0;
  }

  // ── Personality compatibility (up to 30pts) ──────────────────────────

  let compatScore = 30;
  for (const slug of slugs) {
    const pass = getCompositingPass(slug);
    if (pass && !pass.personality_affinity.includes(pSlug)) {
      compatScore -= 8;
      notes.push(`"${pass.name}" is not in ${personality}'s affinity list.`);
    }
  }
  breakdown.compatibility = Math.max(0, compatScore);
  score += breakdown.compatibility;

  // ── Balance checks (up to 20pts) ─────────────────────────────────────

  let balanceScore = 20;

  // Too many passes?
  if (slugs.length > 5) {
    balanceScore -= 10;
    notes.push('Over-processed — more than 5 compositing passes risks muddy output.');
  } else if (slugs.length > 3 && pSlug !== 'cinematic-dark') {
    balanceScore -= 5;
    notes.push('Many compositing passes for a non-cinematic personality — consider trimming.');
  }

  // No passes at all?
  if (slugs.length === 0) {
    balanceScore -= 10;
    notes.push('No compositing passes — output will look unfinished.');
  }

  breakdown.balance = Math.max(0, balanceScore);
  score += breakdown.balance;

  // ── Personality bonus (up to 10pts) ──────────────────────────────────

  // Award bonus for matching the expected stack shape
  const expectedStack = PERSONALITY_STACKS[pSlug] || [];
  const expectedSlugs = expectedStack.map(e => e.slug);
  const matchCount = expectedSlugs.filter(s => slugs.includes(s)).length;
  const matchRatio = expectedSlugs.length > 0 ? matchCount / expectedSlugs.length : 0;
  breakdown.personality_match = Math.round(matchRatio * 10);
  score += breakdown.personality_match;

  return {
    score: Math.max(0, Math.min(max, score)),
    max,
    breakdown,
    notes,
  };
}

// ── scoreBrandFinish (MCP tool handler) ─────────────────────────────────────

/**
 * Full brand finish analysis: recommends a compositing stack and scores it.
 *
 * @param {object} args
 * @param {string} args.personality - Personality slug
 * @param {string} [args.style_pack] - Style pack name
 * @param {string} [args.art_direction] - Art direction slug
 * @param {Array} [args.passes] - Optional custom passes to score instead
 * @returns {{ recommended_stack: object[], quality_score: object, notes: string[] }}
 */
export function scoreBrandFinish({ personality, style_pack, art_direction, passes }) {
  const notes = [];

  // Plan the recommended stack
  const planned = planCompositingStack(personality, style_pack, art_direction);
  notes.push(...planned.notes);

  // If custom passes provided, score those; otherwise score the recommended stack
  const passesToScore = passes || planned.passes.map(p => ({ slug: p.slug, overrides: p.overrides }));
  const qualityScore = scoreFinish(passesToScore, personality);
  notes.push(...qualityScore.notes);

  return {
    recommended_stack: planned.passes.map(p => ({
      slug: p.slug,
      name: p.pass.name,
      category: p.pass.category,
      overrides: p.overrides,
      css: p.css,
    })),
    quality_score: {
      score: qualityScore.score,
      max: qualityScore.max,
      breakdown: qualityScore.breakdown,
    },
    notes,
  };
}
