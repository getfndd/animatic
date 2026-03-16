/**
 * Semantic Planner — ANI-73
 *
 * Reference classification system for mapping visual references
 * to semantic components, interaction recipes, and personality affinities.
 *
 * Six classification dimensions:
 * - interaction_type: typing, selection, reveal, navigation, transition
 * - pacing: rapid, moderate, deliberate, contemplative
 * - composition_density: minimal, moderate, dense
 * - surface_treatment: flat, elevated, layered, dimensional
 * - text_behavior: static, typing, replacing, scrolling, none
 * - camera_behavior: static, push_in, pull_out, drift, follow_focus
 *
 * Pure functions — no side effects.
 */

// ── Dimensions ───────────────────────────────────────────────────────────────

export const DIMENSIONS = {
  interaction_type: ['typing', 'selection', 'reveal', 'navigation', 'transition'],
  pacing: ['rapid', 'moderate', 'deliberate', 'contemplative'],
  composition_density: ['minimal', 'moderate', 'dense'],
  surface_treatment: ['flat', 'elevated', 'layered', 'dimensional'],
  text_behavior: ['static', 'typing', 'replacing', 'scrolling', 'none'],
  camera_behavior: ['static', 'push_in', 'pull_out', 'drift', 'follow_focus'],
};

// ── Classification → Component Mapping ───────────────────────────────────────

const INTERACTION_TO_COMPONENTS = {
  typing: {
    component_types: ['prompt_card', 'input_field'],
    recipes: ['type-and-complete'],
    personality_affinity: ['cinematic-dark', 'editorial'],
  },
  selection: {
    component_types: ['dropdown_menu'],
    recipes: ['open-and-select-dropdown'],
    personality_affinity: ['editorial', 'neutral-light'],
  },
  reveal: {
    component_types: ['result_stack'],
    recipes: ['reveal-results-stack'],
    personality_affinity: ['cinematic-dark'],
  },
  navigation: {
    component_types: ['dropdown_menu', 'input_field'],
    recipes: ['open-and-select-dropdown'],
    personality_affinity: ['neutral-light', 'editorial'],
  },
  transition: {
    component_types: ['prompt_card'],
    recipes: ['fade-and-swap-prompt'],
    personality_affinity: ['cinematic-dark', 'montage'],
  },
};

const TEXT_TO_COMPONENTS = {
  typing: {
    component_types: ['prompt_card'],
    recipes: ['type-and-complete'],
  },
  replacing: {
    component_types: ['prompt_card'],
    recipes: ['fade-and-swap-prompt'],
  },
};

const DENSITY_OVERRIDES = {
  dense: {
    reveal: {
      component_types: ['stacked_cards'],
      recipes: ['fan-and-settle-cards'],
    },
  },
};

// ── Classification ───────────────────────────────────────────────────────────

/**
 * Classify a reference by the six dimensions.
 *
 * @param {object} reference - Reference object with optional dimension hints
 *   { interaction_type, pacing, composition_density, surface_treatment,
 *     text_behavior, camera_behavior }
 * @returns {object} Classification with validated dimension values
 */
export function classifyReference(reference) {
  if (!reference) return {};

  const classification = {};

  for (const [dim, validValues] of Object.entries(DIMENSIONS)) {
    const value = reference[dim];
    if (value && validValues.includes(value)) {
      classification[dim] = value;
    }
  }

  return classification;
}

/**
 * Map a classification to component types, recipes, and personality affinity.
 *
 * @param {object} classification - Output of classifyReference
 * @returns {{ component_types: string[], recipes: string[], personality_affinity: string[] }}
 */
export function mapClassificationToComponents(classification) {
  const result = {
    component_types: [],
    recipes: [],
    personality_affinity: [],
  };

  if (!classification || Object.keys(classification).length === 0) {
    return result;
  }

  const { interaction_type, text_behavior, composition_density } = classification;

  // Check density overrides first
  if (composition_density && interaction_type && DENSITY_OVERRIDES[composition_density]?.[interaction_type]) {
    const override = DENSITY_OVERRIDES[composition_density][interaction_type];
    result.component_types.push(...override.component_types);
    result.recipes.push(...override.recipes);
  }

  // Map interaction type
  if (interaction_type && INTERACTION_TO_COMPONENTS[interaction_type]) {
    const mapping = INTERACTION_TO_COMPONENTS[interaction_type];
    for (const ct of mapping.component_types) {
      if (!result.component_types.includes(ct)) result.component_types.push(ct);
    }
    for (const r of mapping.recipes) {
      if (!result.recipes.includes(r)) result.recipes.push(r);
    }
    result.personality_affinity.push(...mapping.personality_affinity);
  }

  // Map text behavior
  if (text_behavior && TEXT_TO_COMPONENTS[text_behavior]) {
    const mapping = TEXT_TO_COMPONENTS[text_behavior];
    for (const ct of mapping.component_types) {
      if (!result.component_types.includes(ct)) result.component_types.push(ct);
    }
    for (const r of mapping.recipes) {
      if (!result.recipes.includes(r)) result.recipes.push(r);
    }
  }

  // Deduplicate personality affinity
  result.personality_affinity = [...new Set(result.personality_affinity)];

  return result;
}

/**
 * Generate a recommendation from a classification — a valid v3 semantic block structure.
 *
 * @param {object} classification - Output of classifyReference
 * @returns {{ components: object[], interactions: object[], camera_behavior: object }}
 */
export function recommendFromClassification(classification) {
  const mapped = mapClassificationToComponents(classification);

  const components = mapped.component_types.map((type, i) => ({
    id: `cmp_${i}`,
    type,
    role: i === 0 ? 'hero' : 'supporting',
  }));

  // Generate interactions from recipes
  const interactions = [];
  if (mapped.recipes.length > 0 && components.length > 0) {
    const heroId = components[0].id;
    const recipeId = mapped.recipes[0];

    // Generate a basic interaction chain for the primary recipe
    interactions.push({
      id: `int_focus_${heroId}`,
      target: heroId,
      kind: 'focus',
      timing: { at_ms: 0 },
      on_complete: { emit: 'focus_done' },
    });

    // Add recipe-specific follow-up
    const followUp = recipeToInteraction(recipeId, heroId);
    if (followUp) {
      interactions.push(followUp);
    }

    interactions.push({
      id: `int_settle_${heroId}`,
      target: heroId,
      kind: 'settle',
      timing: { delay: { after: followUp?.on_complete?.emit || 'focus_done', offset_ms: 200 } },
    });
  }

  // Map camera behavior
  const cameraBehavior = {
    mode: classification.camera_behavior === 'static' ? 'static'
      : classification.camera_behavior === 'push_in' ? 'reactive'
      : 'ambient',
  };

  return { components, interactions, camera_behavior: cameraBehavior };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function recipeToInteraction(recipeId, targetId) {
  switch (recipeId) {
    case 'type-and-complete':
      return {
        id: `int_type_${targetId}`,
        target: targetId,
        kind: 'type_text',
        params: { text: 'Example prompt', speed: 45 },
        timing: { delay: { after: 'focus_done', offset_ms: 200 } },
        on_complete: { emit: 'type_done' },
      };
    case 'reveal-results-stack':
      return {
        id: `int_insert_${targetId}`,
        target: targetId,
        kind: 'insert_items',
        params: { items: ['Result 1', 'Result 2', 'Result 3'], stagger_ms: 80 },
        timing: { delay: { after: 'focus_done', offset_ms: 200 } },
        on_complete: { emit: 'insert_done' },
      };
    case 'open-and-select-dropdown':
      return {
        id: `int_open_${targetId}`,
        target: targetId,
        kind: 'open_menu',
        timing: { delay: { after: 'focus_done', offset_ms: 200 } },
        on_complete: { emit: 'open_done' },
      };
    case 'fan-and-settle-cards':
      return {
        id: `int_fan_${targetId}`,
        target: targetId,
        kind: 'fan_stack',
        timing: { delay: { after: 'focus_done', offset_ms: 200 } },
        on_complete: { emit: 'fan_done' },
      };
    case 'fade-and-swap-prompt':
      return {
        id: `int_replace_${targetId}`,
        target: targetId,
        kind: 'replace_text',
        params: { text: 'New prompt' },
        timing: { delay: { after: 'focus_done', offset_ms: 200 } },
        on_complete: { emit: 'replace_done' },
      };
    default:
      return null;
  }
}
