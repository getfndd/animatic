/**
 * Social Formats — aspect ratio presets and manifest adaptation for
 * square, portrait, vertical, and landscape output.
 *
 * Exports:
 *   getSocialFormat(slug)
 *   listSocialFormats()
 *   adaptManifestAspectRatio(manifest, targetRatio, options)
 *   createSocialCutdown(manifest, scenesToKeep, targetRatio, maxDuration)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, '..', '..', 'catalog', 'social-formats.json');

// ── Load catalog ────────────────────────────────────────────────────────────

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
const bySlug = new Map(catalog.map(f => [f.slug, f]));
const byRatio = new Map(catalog.map(f => [f.aspect_ratio, f]));

/** All available social format slugs. */
export const SOCIAL_FORMAT_SLUGS = catalog.map(f => f.slug);

/** All valid aspect ratios. */
export const VALID_ASPECT_RATIOS = ['16:9', '1:1', '4:5', '9:16'];

// ── getSocialFormat ─────────────────────────────────────────────────────────

/**
 * Returns full social format definition by slug, or null if not found.
 */
export function getSocialFormat(slug) {
  return bySlug.get(slug) || null;
}

// ── listSocialFormats ───────────────────────────────────────────────────────

/**
 * List all social formats, optionally filtered.
 *
 * @param {object} [options]
 * @param {string} [options.personality] - Filter by personality affinity
 * @returns {object[]} Matching format entries
 */
export function listSocialFormats(options = {}) {
  let results = [...catalog];
  if (options.personality) {
    results = results.filter(f =>
      f.personality_affinities.includes(options.personality)
    );
  }
  return results;
}

// ── Aspect ratio helpers ────────────────────────────────────────────────────

/**
 * Parse an aspect ratio string like "16:9" into a numeric value.
 */
function parseRatio(ratio) {
  const [w, h] = ratio.split(':').map(Number);
  return w / h;
}

/**
 * Get the format definition for a given aspect ratio string.
 */
function getFormatByRatio(ratio) {
  return byRatio.get(ratio) || null;
}

// ── adaptManifestAspectRatio ────────────────────────────────────────────────

/**
 * Adapt a manifest to a different aspect ratio.
 *
 * @param {object} manifest - Source manifest
 * @param {string} targetRatio - Target aspect ratio (e.g. "1:1", "9:16")
 * @param {object} [options]
 * @param {boolean} [options.recompose=false] - If true, recalculate layer positions; if false, crop
 * @returns {object} Adapted manifest (deep clone, original untouched)
 */
export function adaptManifestAspectRatio(manifest, targetRatio, options = {}) {
  if (!VALID_ASPECT_RATIOS.includes(targetRatio)) {
    throw new Error(`Invalid aspect ratio "${targetRatio}". Must be one of: ${VALID_ASPECT_RATIOS.join(', ')}`);
  }

  const format = getFormatByRatio(targetRatio);
  if (!format) {
    throw new Error(`No format definition found for aspect ratio "${targetRatio}"`);
  }

  // Deep clone the manifest
  const adapted = JSON.parse(JSON.stringify(manifest));

  // Update resolution
  adapted.resolution = { ...format.resolution };

  // Set format metadata
  adapted.format = {
    ...(adapted.format || {}),
    aspect_ratio: targetRatio,
    safe_areas: { ...format.safe_areas },
  };

  // Adapt scenes
  if (adapted.scenes && Array.isArray(adapted.scenes)) {
    const sourceRatio = parseRatio(
      manifest.format?.aspect_ratio || '16:9'
    );
    const targetRatioNum = parseRatio(targetRatio);

    for (const scene of adapted.scenes) {
      // Clamp scene duration to format max
      if (scene.duration_s != null && format.max_scene_duration_s < 30) {
        scene.duration_s = Math.min(scene.duration_s, format.max_scene_duration_s);
      }

      // Adapt camera overrides for non-landscape formats
      if (scene.camera_override && targetRatioNum < sourceRatio) {
        const cam = scene.camera_override;
        // Reduce horizontal pan intensity for narrower formats
        if (cam.move === 'pan_left' || cam.move === 'pan_right') {
          cam.intensity = Math.min(cam.intensity || 0.5, 0.3);
        }
      }
    }
  }

  // If recompose mode, recalculate layer positions
  if (options.recompose && adapted.scenes) {
    for (const scene of adapted.scenes) {
      if (scene.layers && Array.isArray(scene.layers)) {
        _recomposeLayersForRatio(scene.layers, format, manifest.resolution || { w: 1920, h: 1080 });
      }
    }
  }

  return adapted;
}

/**
 * Recompose layer positions for the target format.
 * Centers content and adjusts horizontal spread.
 * @private
 */
function _recomposeLayersForRatio(layers, format, sourceResolution) {
  const scaleX = format.resolution.w / sourceResolution.w;
  const scaleY = format.resolution.h / sourceResolution.h;
  const spreadReduction = format.layout_adjustments.reduce_horizontal_spread;

  for (const layer of layers) {
    if (layer.position) {
      // Scale positions proportionally
      if (layer.position.x != null) {
        const centerX = format.resolution.w / 2;
        const offsetFromCenter = (layer.position.x * scaleX) - centerX;
        layer.position.x = Math.round(centerX + offsetFromCenter * (1 - spreadReduction));
      }
      if (layer.position.y != null) {
        layer.position.y = Math.round(layer.position.y * scaleY);
      }
    }
    if (layer.size) {
      if (layer.size.w != null) {
        layer.size.w = Math.round(layer.size.w * scaleX * (1 - spreadReduction * 0.5));
      }
      if (layer.size.h != null) {
        layer.size.h = Math.round(layer.size.h * scaleY);
      }
    }
  }
}

// ── createSocialCutdown ─────────────────────────────────────────────────────

/**
 * Create a shortened social cutdown from a full manifest.
 *
 * Selects specific scenes, tightens transitions, adapts aspect ratio,
 * and enforces maximum duration.
 *
 * @param {object} manifest - Source manifest
 * @param {number[]|null} scenesToKeep - Indices of scenes to keep (null = auto-select)
 * @param {string} targetRatio - Target aspect ratio
 * @param {number} maxDuration - Maximum total duration in seconds
 * @returns {object} New cutdown manifest
 */
export function createSocialCutdown(manifest, scenesToKeep, targetRatio, maxDuration) {
  if (!VALID_ASPECT_RATIOS.includes(targetRatio)) {
    throw new Error(`Invalid aspect ratio "${targetRatio}". Must be one of: ${VALID_ASPECT_RATIOS.join(', ')}`);
  }

  const format = getFormatByRatio(targetRatio);
  if (!format) {
    throw new Error(`No format definition found for aspect ratio "${targetRatio}"`);
  }

  // Deep clone
  const cutdown = JSON.parse(JSON.stringify(manifest));

  // Select scenes
  if (cutdown.scenes && Array.isArray(cutdown.scenes)) {
    if (scenesToKeep && scenesToKeep.length > 0) {
      // Keep only specified scenes
      cutdown.scenes = scenesToKeep
        .filter(i => i >= 0 && i < cutdown.scenes.length)
        .map(i => cutdown.scenes[i]);
    } else {
      // Auto-select: keep first, last, and distribute middle scenes
      cutdown.scenes = _autoSelectScenes(cutdown.scenes, maxDuration, format);
    }

    // Tighten transitions for social pacing
    for (let i = 0; i < cutdown.scenes.length; i++) {
      const scene = cutdown.scenes[i];

      // Clamp scene duration
      if (scene.duration_s != null) {
        scene.duration_s = Math.min(scene.duration_s, format.max_scene_duration_s);
      }

      // Shorten transitions
      if (scene.transition_in && scene.transition_in.duration_ms != null) {
        scene.transition_in.duration_ms = Math.min(scene.transition_in.duration_ms, 300);
      }
    }

    // Enforce max duration by trimming scenes from the end if needed
    let totalDuration = _calculateTotalDuration(cutdown.scenes);
    while (totalDuration > maxDuration && cutdown.scenes.length > 1) {
      cutdown.scenes.pop();
      totalDuration = _calculateTotalDuration(cutdown.scenes);
    }

    // Final clamp on remaining scenes
    if (totalDuration > maxDuration && cutdown.scenes.length === 1) {
      cutdown.scenes[0].duration_s = maxDuration;
    }
  }

  // Update sequence ID to indicate cutdown
  cutdown.sequence_id = cutdown.sequence_id
    ? cutdown.sequence_id.replace(/^seq_/, 'seq_social_')
    : 'seq_social_cutdown';

  // Apply aspect ratio adaptation
  const adapted = adaptManifestAspectRatio(cutdown, targetRatio, { recompose: true });

  // Mark as social cutdown
  adapted.sequence_intent = adapted.sequence_intent || 'brand_social';

  return adapted;
}

/**
 * Auto-select scenes to fit within a duration budget.
 * Keeps first and last, distributes evenly from middle.
 * @private
 */
function _autoSelectScenes(scenes, maxDuration, format) {
  if (scenes.length <= 3) return [...scenes];

  const maxSceneDuration = format.max_scene_duration_s;
  const maxScenes = Math.max(2, Math.floor(maxDuration / (maxSceneDuration * 0.6)));

  if (scenes.length <= maxScenes) return [...scenes];

  // Always keep first and last
  const selected = [scenes[0]];
  const middleCount = Math.max(1, maxScenes - 2);
  const step = (scenes.length - 2) / (middleCount + 1);

  for (let i = 1; i <= middleCount; i++) {
    const idx = Math.round(step * i);
    if (idx > 0 && idx < scenes.length - 1) {
      selected.push(scenes[idx]);
    }
  }

  selected.push(scenes[scenes.length - 1]);
  return selected;
}

/**
 * Calculate total duration of a scenes array.
 * @private
 */
function _calculateTotalDuration(scenes) {
  let total = 0;
  for (const scene of scenes) {
    total += scene.duration_s || 3; // default 3s if unspecified
    if (scene.transition_in && scene.transition_in.duration_ms) {
      total -= scene.transition_in.duration_ms / 1000;
    }
  }
  return total;
}
