/**
 * Choreography validation engine.
 *
 * Extracted from mcp/index.js for use in the @preset/animatic package.
 * Pure function — no MCP dependencies, no module-level state.
 */

import { filterByPersonality, parseDurationMs, checkBlurViolations } from '../lib.js';

/**
 * Validate a set of primitive IDs against personality guardrails.
 *
 * @param {string[]} primitiveIds - Primitive IDs to validate
 * @param {string} personality - Target personality slug
 * @param {{ registry: object, cameraGuardrails: object, intentMappings?: object, overrides?: object, intent?: string }} ctx
 * @returns {{ verdict: 'PASS'|'WARN'|'BLOCK', blocks: string[], warnings: string[], notes: string[] }}
 */
export function validateChoreography(primitiveIds, personality, ctx) {
  const { registry, cameraGuardrails, intentMappings, overrides, intent: intentSlug } = ctx;

  if (!primitiveIds || primitiveIds.length === 0) {
    return { verdict: 'BLOCK', blocks: ['No primitive IDs provided.'], warnings: [], notes: [] };
  }

  const blocks = [];
  const warnings = [];
  const notes = [];

  const boundaries = cameraGuardrails.personality_boundaries[personality];
  const forbiddenFeatures = boundaries?.forbidden_features || [];

  // ── Tier 1: BLOCK — Primitive existence ──────────────────────────────────
  for (const id of primitiveIds) {
    if (!registry.byId.has(id)) {
      blocks.push(`**Unknown primitive:** \`${id}\` is not in the registry.`);
    }
  }

  // ── Tier 2: BLOCK — Personality compatibility ────────────────────────────
  for (const id of primitiveIds) {
    const entry = registry.byId.get(id);
    if (!entry) continue;
    const compatible = entry.personality.some(
      p => p === personality || p === 'universal'
    );
    if (!compatible) {
      blocks.push(`**Personality mismatch:** \`${id}\` supports [${entry.personality.join(', ')}], not ${personality}.`);
    }
  }

  // ── Tier 3: BLOCK — Personality boundary enforcement ─────────────────────
  for (const id of primitiveIds) {
    const entry = registry.byId.get(id);
    if (!entry) continue;
    const amplitude = cameraGuardrails.primitive_amplitudes[id];

    // 3D transforms check
    if (forbiddenFeatures.includes('3d_transforms') && amplitude) {
      if (amplitude.property === 'translateZ' || amplitude.property === 'rotateX' || amplitude.property === 'rotateY') {
        blocks.push(`**Forbidden feature (3D):** \`${id}\` uses ${amplitude.property}, which is forbidden in ${personality}.`);
      }
    }

    // Blur check
    for (const v of checkBlurViolations(id, entry, cameraGuardrails, forbiddenFeatures)) {
      if (v.type === 'blur') {
        blocks.push(`**Forbidden feature (blur):** \`${id}\` uses blur, forbidden in ${personality}.`);
      } else if (v.type === 'blur_entrance') {
        blocks.push(`**Forbidden feature (blur entrance):** \`${id}\` uses blur entrance, forbidden in ${personality}.`);
      }
    }

    // Camera movement check
    if (forbiddenFeatures.includes('camera_movement') && amplitude) {
      if (['translateX', 'translateY', 'translateZ', 'rotateX', 'rotateY'].includes(amplitude.property)) {
        blocks.push(`**Forbidden feature (camera movement):** \`${id}\` uses ${amplitude.property}, which is forbidden in ${personality}.`);
      }
    }

    // Camera shake check
    if (forbiddenFeatures.includes('camera_shake') && id === 'ct-camera-shake') {
      blocks.push(`**Forbidden feature (camera shake):** \`${id}\` is forbidden in ${personality}.`);
    }
  }

  // ── Tier 4: WARN — Speed limits ──────────────────────────────────────────
  const durationMultiplier = overrides?.duration_multiplier || 1;
  for (const id of primitiveIds) {
    const entry = registry.byId.get(id);
    if (!entry) continue;
    const amplitude = cameraGuardrails.primitive_amplitudes[id];
    if (!amplitude) continue;

    const durationMs = parseDurationMs(entry.duration);
    if (!durationMs) continue;

    const effectiveDurationMs = durationMs * durationMultiplier;
    const effectiveDurationS = effectiveDurationMs / 1000;
    const velocity = amplitude.max_displacement / effectiveDurationS;

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
  if (intentSlug && intentMappings) {
    const mapping = intentMappings.byIntent.get(intentSlug);
    if (mapping) {
      if (!mapping.personality_support.includes(personality)) {
        notes.push(`Intent \`${intentSlug}\` does not support ${personality}. Supported: ${mapping.personality_support.join(', ')}.`);
      }
      const expectedPrimitives = filterByPersonality(mapping.camera_primitives, personality, registry);
      const missing = expectedPrimitives.filter(id => !primitiveIds.includes(id));
      if (missing.length > 0) {
        notes.push(`Intent \`${intentSlug}\` expects these camera primitives not in your plan: ${missing.map(id => `\`${id}\``).join(', ')}.`);
      }
    } else {
      notes.push(`Intent \`${intentSlug}\` not found in intent mappings.`);
    }
  }

  const verdict = blocks.length > 0 ? 'BLOCK' : warnings.length > 0 ? 'WARN' : 'PASS';
  return { verdict, blocks, warnings, notes };
}
