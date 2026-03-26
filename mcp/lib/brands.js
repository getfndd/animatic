/**
 * Brand Package Manager
 *
 * Loads, creates, resolves, and validates brand packages against
 * the Animatic video pipeline. Brand packages define per-client
 * visual identity: colors, typography, motion rules, logo behavior,
 * and compliance guidelines.
 *
 * Works with catalog/brands/*.json files via the data loader.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const BRANDS_DIR = resolve(ROOT, 'catalog/brands');

// Valid camera moves that can appear in forbidden_moves
const CAMERA_MOVES = ['push_in', 'pull_out', 'pan_left', 'pan_right', 'drift', 'static'];

// Valid personality slugs
const PERSONALITY_SLUGS = ['cinematic-dark', 'editorial', 'neutral-light', 'montage'];

// Valid intro/outro styles
const INTRO_STYLES = ['fade', 'resolve', 'slide', 'none'];
const OUTRO_STYLES = ['fade', 'resolve', 'hold'];

// ── Load / List ──────────────────────────────────────────────────────────────

/**
 * Load a brand package by brand_id (slug).
 * @param {string} slug - Brand identifier (matches filename without .json)
 * @returns {object|null} Brand package or null if not found
 */
export function loadBrand(slug) {
  const safeName = slug.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = resolve(BRANDS_DIR, `${safeName}.json`);
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * List all available brand packages.
 * @returns {Array<{ brand_id: string, name: string, personality: string, style: string|undefined }>}
 */
export function listBrands() {
  try {
    const files = readdirSync(BRANDS_DIR)
      .filter(f => f.endsWith('.json') && !f.startsWith('_schema'));
    return files.map(f => {
      const brand = JSON.parse(readFileSync(resolve(BRANDS_DIR, f), 'utf-8'));
      return {
        brand_id: brand.brand_id,
        name: brand.name,
        description: brand.description || null,
        personality: brand.personality,
        style: brand.style || null,
      };
    });
  } catch {
    return [];
  }
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a new brand package and write it to catalog/brands/.
 * @param {object} spec - Brand specification
 * @returns {{ brand: object, path: string }} Created brand and file path
 */
export function createBrandPackage(spec) {
  if (!spec.brand_id || typeof spec.brand_id !== 'string') {
    throw new Error('brand_id is required and must be a string');
  }
  if (!spec.name || typeof spec.name !== 'string') {
    throw new Error('name is required and must be a string');
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(spec.brand_id)) {
    throw new Error('brand_id must be lowercase kebab-case (e.g., "acme-corp")');
  }
  if (spec.brand_id.startsWith('_')) {
    throw new Error('brand_id cannot start with underscore (reserved for system brands)');
  }

  // Build the brand object with defaults
  const brand = {
    brand_id: spec.brand_id,
    name: spec.name,
    description: spec.description || null,
    personality: spec.personality || 'cinematic-dark',
    style: spec.style || 'prestige',
  };

  // Validate personality
  if (!PERSONALITY_SLUGS.includes(brand.personality)) {
    throw new Error(`Invalid personality "${brand.personality}". Valid: ${PERSONALITY_SLUGS.join(', ')}`);
  }

  // Logo
  if (spec.logo) {
    brand.logo = {
      primary: spec.logo.primary || null,
      monochrome: spec.logo.monochrome || null,
      icon_only: spec.logo.icon_only || null,
      safe_zone_pct: spec.logo.safe_zone_pct ?? 15,
      min_size_px: spec.logo.min_size_px ?? 48,
    };
  }

  // Intro/outro
  if (spec.intro_outro) {
    const io = spec.intro_outro;
    if (io.intro_style && !INTRO_STYLES.includes(io.intro_style)) {
      throw new Error(`Invalid intro_style "${io.intro_style}". Valid: ${INTRO_STYLES.join(', ')}`);
    }
    if (io.outro_style && !OUTRO_STYLES.includes(io.outro_style)) {
      throw new Error(`Invalid outro_style "${io.outro_style}". Valid: ${OUTRO_STYLES.join(', ')}`);
    }
    brand.intro_outro = {
      intro_style: io.intro_style || 'fade',
      intro_duration_ms: io.intro_duration_ms ?? 800,
      outro_style: io.outro_style || 'fade',
      outro_duration_ms: io.outro_duration_ms ?? 600,
      outro_hold_ms: io.outro_hold_ms ?? 1500,
    };
  }

  // Colors (required)
  if (spec.colors && typeof spec.colors === 'object') {
    brand.colors = { ...spec.colors };
  } else {
    // Provide minimal defaults
    brand.colors = {
      bg_primary: '#0a0a0a',
      text_primary: '#ffffff',
      accent: '#6366f1',
    };
  }

  // Typography
  if (spec.typography) {
    brand.typography = { ...spec.typography };
  }

  // Surfaces
  if (spec.surfaces) {
    brand.surfaces = { ...spec.surfaces };
  }

  // Chart
  if (spec.chart) {
    brand.chart = { ...spec.chart };
  }

  // Motion
  if (spec.motion) {
    const m = spec.motion;
    if (m.forbidden_moves) {
      const invalid = m.forbidden_moves.filter(mv => !CAMERA_MOVES.includes(mv));
      if (invalid.length > 0) {
        throw new Error(`Invalid forbidden_moves: ${invalid.join(', ')}. Valid: ${CAMERA_MOVES.join(', ')}`);
      }
    }
    if (m.max_intensity !== undefined && (m.max_intensity < 0 || m.max_intensity > 1)) {
      throw new Error('max_intensity must be between 0 and 1');
    }
    brand.motion = {
      preferred_personality: m.preferred_personality || brand.personality,
      preferred_style_pack: m.preferred_style_pack || brand.style,
      preferred_easing: m.preferred_easing || null,
      forbidden_moves: m.forbidden_moves || [],
      max_intensity: m.max_intensity ?? 1.0,
    };
  }

  // Textures
  if (spec.textures) {
    brand.textures = {
      overlays: spec.textures.overlays || [],
      grain: {
        enabled: spec.textures.grain?.enabled ?? false,
        opacity: spec.textures.grain?.opacity ?? 0.03,
      },
    };
  }

  // Audio
  if (spec.audio) {
    brand.audio = {
      sonic_cues: spec.audio.sonic_cues || {},
      music_guidelines: spec.audio.music_guidelines || null,
    };
  }

  // Guidelines
  if (spec.guidelines) {
    brand.guidelines = {
      dos: spec.guidelines.dos || [],
      donts: spec.guidelines.donts || [],
    };
  }

  // Write to disk
  const filePath = resolve(BRANDS_DIR, `${brand.brand_id}.json`);
  writeFileSync(filePath, JSON.stringify(brand, null, 2) + '\n', 'utf-8');

  return { brand, path: filePath };
}

// ── Resolve Defaults ─────────────────────────────────────────────────────────

/**
 * Apply brand defaults to a manifest. Returns a new manifest object
 * with brand-derived personality, style, and other defaults filled in
 * where the manifest does not already specify them.
 *
 * @param {object} brand - Loaded brand package
 * @param {object} manifest - Sequence manifest
 * @returns {object} New manifest with brand defaults applied
 */
export function resolveBrandDefaults(brand, manifest) {
  const resolved = { ...manifest };

  // Personality: brand.motion.preferred_personality > brand.personality > manifest default
  if (!resolved.personality) {
    resolved.personality = brand.motion?.preferred_personality || brand.personality;
  }

  // Style pack: brand.motion.preferred_style_pack > brand.style
  if (!resolved.style) {
    resolved.style = brand.motion?.preferred_style_pack || brand.style;
  }

  // Brand ID reference
  if (!resolved.brand_id) {
    resolved.brand_id = brand.brand_id;
  }

  // Apply logo intro/outro to sequence if not already specified
  if (brand.intro_outro && !resolved.intro_outro) {
    resolved.intro_outro = { ...brand.intro_outro };
  }

  return resolved;
}

// ── Validate Compliance ──────────────────────────────────────────────────────

/**
 * Check a manifest and its scenes against brand guidelines.
 * Returns an array of violation objects. Empty array = compliant.
 *
 * @param {object} brand - Loaded brand package
 * @param {object} manifest - Sequence manifest
 * @param {Array<object>} scenes - Scene objects from the manifest
 * @returns {Array<{ severity: 'error'|'warning', rule: string, message: string, scene_id?: string }>}
 */
export function validateBrandCompliance(brand, manifest, scenes = []) {
  const violations = [];

  // ── Personality check ──────────────────────────────────────────────────
  const expectedPersonality = brand.motion?.preferred_personality || brand.personality;
  if (manifest.personality && manifest.personality !== expectedPersonality) {
    violations.push({
      severity: 'warning',
      rule: 'personality_mismatch',
      message: `Manifest uses personality "${manifest.personality}" but brand prefers "${expectedPersonality}"`,
    });
  }

  // ── Forbidden camera moves ─────────────────────────────────────────────
  const forbidden = brand.motion?.forbidden_moves || [];
  if (forbidden.length > 0 && scenes.length > 0) {
    for (const scene of scenes) {
      const sceneId = scene.scene_id || scene.id || 'unknown';
      const cameraMove = scene.camera?.move || scene.camera_move;
      if (cameraMove && forbidden.includes(cameraMove)) {
        violations.push({
          severity: 'error',
          rule: 'forbidden_move',
          message: `Scene "${sceneId}" uses forbidden camera move "${cameraMove}"`,
          scene_id: sceneId,
        });
      }
    }
  }

  // ── Camera intensity check ─────────────────────────────────────────────
  const maxIntensity = brand.motion?.max_intensity;
  if (maxIntensity !== undefined && maxIntensity < 1.0 && scenes.length > 0) {
    for (const scene of scenes) {
      const sceneId = scene.scene_id || scene.id || 'unknown';
      const intensity = scene.camera?.intensity;
      if (intensity !== undefined && intensity > maxIntensity) {
        violations.push({
          severity: 'error',
          rule: 'intensity_exceeded',
          message: `Scene "${sceneId}" camera intensity ${intensity} exceeds brand max ${maxIntensity}`,
          scene_id: sceneId,
        });
      }
    }
  }

  // ── Transition type check against guidelines ───────────────────────────
  if (brand.guidelines?.donts && scenes.length > 0) {
    const dontPatterns = brand.guidelines.donts.map(d => d.toLowerCase());
    for (const scene of scenes) {
      const sceneId = scene.scene_id || scene.id || 'unknown';
      const transition = scene.transition_in?.type;
      if (transition) {
        // Check if any "dont" mentions this transition type
        const transitionReadable = transition.replace(/_/g, ' ').replace(/-/g, ' ');
        for (const dont of dontPatterns) {
          if (dont.includes(transitionReadable) || dont.includes(transition)) {
            violations.push({
              severity: 'warning',
              rule: 'guideline_violation',
              message: `Scene "${sceneId}" uses transition "${transition}" which may violate guideline: "${dont}"`,
              scene_id: sceneId,
            });
          }
        }
      }
    }
  }

  // ── Color compliance (approved colors list) ────────────────────────────
  const approved = brand.colors?.approved_colors;
  if (approved && approved.length > 0 && scenes.length > 0) {
    const approvedSet = new Set(approved.map(c => c.toLowerCase()));
    for (const scene of scenes) {
      const sceneId = scene.scene_id || scene.id || 'unknown';
      const bg = scene.background_color || scene.bg_color;
      if (bg && !approvedSet.has(bg.toLowerCase()) && !bg.startsWith('rgba') && !bg.startsWith('linear-gradient')) {
        violations.push({
          severity: 'warning',
          rule: 'unapproved_color',
          message: `Scene "${sceneId}" uses color "${bg}" not in approved brand colors`,
          scene_id: sceneId,
        });
      }
    }
  }

  return violations;
}
