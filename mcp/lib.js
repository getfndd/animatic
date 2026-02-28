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
