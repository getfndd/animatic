/**
 * Shared helpers for Animatic MCP tools.
 * Extracted for testability — used by both index.js and test suite.
 */

/** Filter primitive IDs to those compatible with the given personality (or universal). */
export function filterByPersonality(primitiveIds, personalitySlug, registry) {
  return primitiveIds.filter(primId => {
    const entry = registry.byId.get(primId);
    if (!entry) return true; // keep unknowns visible
    return entry.personality.some(p => p === personalitySlug || p === 'universal');
  });
}

/** Parse duration string like "1400ms", "6000ms loop", "800ms" → numeric ms */
export function parseDurationMs(str) {
  if (!str) return null;
  const match = str.match(/(\d+)\s*ms/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Whether a primitive violates a personality's forbidden-feature guardrails.
 * Mirrors handleValidateChoreography's Tier-3 boundary checks (3D transforms,
 * blur/blur-entrance, camera movement, camera shake) as a single boolean.
 *
 * Used to post-filter the primitive candidates a custom personality borrows
 * from an inherited/derived built-in matrix (ANI-166), so a borrowed plan never
 * surfaces a primitive the custom personality's own guardrails forbid.
 */
export function primitiveViolatesForbidden(id, entry, forbiddenFeatures, cameraGuardrails) {
  if (!entry || !forbiddenFeatures || forbiddenFeatures.length === 0) return false;
  const amplitude = cameraGuardrails.primitive_amplitudes[id];

  if (
    forbiddenFeatures.includes('3d_transforms') && amplitude &&
    ['translateZ', 'rotateX', 'rotateY'].includes(amplitude.property)
  ) return true;

  if (checkBlurViolations(id, entry, cameraGuardrails, forbiddenFeatures).length > 0) return true;

  if (
    forbiddenFeatures.includes('camera_movement') && amplitude &&
    ['translateX', 'translateY', 'translateZ', 'rotateX', 'rotateY'].includes(amplitude.property)
  ) return true;

  if (forbiddenFeatures.includes('camera_shake') && id === 'ct-camera-shake') return true;

  return false;
}

/** Drop primitive IDs whose properties violate the given forbidden-feature set. */
export function filterByGuardrails(primitiveIds, forbiddenFeatures, cameraGuardrails, registry) {
  if (!forbiddenFeatures || forbiddenFeatures.length === 0) return primitiveIds;
  return primitiveIds.filter(id => {
    const entry = registry.byId.get(id);
    if (!entry) return true; // keep unknowns visible
    return !primitiveViolatesForbidden(id, entry, forbiddenFeatures, cameraGuardrails);
  });
}

/**
 * Check if a primitive violates blur guardrails for a given personality.
 * Returns an array of violation objects (empty = no violations).
 */
export function checkBlurViolations(id, entry, cameraGuardrails, forbiddenFeatures) {
  const violations = [];
  const amplitude = cameraGuardrails.primitive_amplitudes[id];
  const isBlurPrimitive = cameraGuardrails.blur_primitives?.includes(id);

  if (forbiddenFeatures.includes('blur') && (isBlurPrimitive || (amplitude && amplitude.property === 'blur'))) {
    violations.push({ type: 'blur', id });
  }
  if (forbiddenFeatures.includes('blur_entrance') && isBlurPrimitive) {
    if (entry.category === 'Entrances') {
      violations.push({ type: 'blur_entrance', id });
    }
  }

  return violations;
}
