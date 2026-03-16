/**
 * Interaction Recipes — ANI-69
 *
 * Named, parameterized interaction recipes that compose cue-chained
 * interaction sequences. Pure functions returning interaction arrays
 * ready for semantic.interactions[].
 *
 * Recipe = (targetId, params, context) → interaction[]
 */

// ── Recipe abbreviations (used in IDs and cue names) ────────────────────────

const ABBREV = {
  'type-and-complete': 'tac',
  'reveal-results-stack': 'rrs',
  'open-and-select-dropdown': 'oasd',
  'fan-and-settle-cards': 'fasc',
  'fade-and-swap-prompt': 'fasp',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeId(abbrev, step, targetId) {
  return `int_${abbrev}_${step}_${targetId}`;
}

function makeCue(abbrev, step) {
  return `${abbrev}_${step}_done`;
}

// ── Recipe functions ─────────────────────────────────────────────────────────

function typeAndComplete(targetId, params) {
  const abbrev = ABBREV['type-and-complete'];
  return [
    {
      id: makeId(abbrev, 'focus', targetId),
      target: targetId,
      kind: 'focus',
      timing: { at_ms: 0 },
      on_complete: { emit: makeCue(abbrev, 'focus') },
    },
    {
      id: makeId(abbrev, 'type', targetId),
      target: targetId,
      kind: 'type_text',
      params: { text: params.text || '', speed: params.speed ?? 45 },
      timing: { delay: { after: makeCue(abbrev, 'focus'), offset_ms: 200 } },
      on_complete: { emit: makeCue(abbrev, 'type') },
    },
    {
      id: makeId(abbrev, 'settle', targetId),
      target: targetId,
      kind: 'settle',
      timing: { delay: { after: makeCue(abbrev, 'type'), offset_ms: 200 } },
    },
  ];
}

function revealResultsStack(targetId, params) {
  const abbrev = ABBREV['reveal-results-stack'];
  return [
    {
      id: makeId(abbrev, 'insert', targetId),
      target: targetId,
      kind: 'insert_items',
      params: { items: params.items || [], stagger_ms: params.stagger_ms ?? 80 },
      timing: { at_ms: 0 },
      on_complete: { emit: makeCue(abbrev, 'insert') },
    },
    {
      id: makeId(abbrev, 'fan', targetId),
      target: targetId,
      kind: 'fan_stack',
      timing: { delay: { after: makeCue(abbrev, 'insert'), offset_ms: 200 } },
      on_complete: { emit: makeCue(abbrev, 'fan') },
    },
    {
      id: makeId(abbrev, 'settle', targetId),
      target: targetId,
      kind: 'settle',
      timing: { delay: { after: makeCue(abbrev, 'fan'), offset_ms: 200 } },
    },
  ];
}

function openAndSelectDropdown(targetId, params) {
  const abbrev = ABBREV['open-and-select-dropdown'];
  return [
    {
      id: makeId(abbrev, 'open', targetId),
      target: targetId,
      kind: 'open_menu',
      timing: { at_ms: 0 },
      on_complete: { emit: makeCue(abbrev, 'open') },
    },
    {
      id: makeId(abbrev, 'pulse', targetId),
      target: targetId,
      kind: 'pulse_focus',
      params: { count: 1 },
      timing: { delay: { after: makeCue(abbrev, 'open'), offset_ms: 200 } },
      on_complete: { emit: makeCue(abbrev, 'pulse') },
    },
    {
      id: makeId(abbrev, 'select', targetId),
      target: targetId,
      kind: 'select_item',
      params: { index: params.selected_index ?? 0 },
      timing: { delay: { after: makeCue(abbrev, 'pulse'), offset_ms: 200 } },
      on_complete: { emit: makeCue(abbrev, 'select') },
    },
    {
      id: makeId(abbrev, 'settle', targetId),
      target: targetId,
      kind: 'settle',
      timing: { delay: { after: makeCue(abbrev, 'select'), offset_ms: 200 } },
    },
  ];
}

function fanAndSettleCards(targetId, params) {
  const abbrev = ABBREV['fan-and-settle-cards'];
  return [
    {
      id: makeId(abbrev, 'fan', targetId),
      target: targetId,
      kind: 'fan_stack',
      params: params.spread != null ? { spread: params.spread } : undefined,
      timing: { at_ms: 0 },
      on_complete: { emit: makeCue(abbrev, 'fan') },
    },
    {
      id: makeId(abbrev, 'settle', targetId),
      target: targetId,
      kind: 'settle',
      timing: { delay: { after: makeCue(abbrev, 'fan'), offset_ms: 200 } },
    },
  ];
}

function fadeAndSwapPrompt(targetId, params) {
  const abbrev = ABBREV['fade-and-swap-prompt'];
  return [
    {
      id: makeId(abbrev, 'replace', targetId),
      target: targetId,
      kind: 'replace_text',
      params: {
        text: params.text || '',
        ...(params.fade_duration_ms != null ? { fade_duration_ms: params.fade_duration_ms } : {}),
      },
      timing: { at_ms: 0 },
      on_complete: { emit: makeCue(abbrev, 'replace') },
    },
    {
      id: makeId(abbrev, 'settle', targetId),
      target: targetId,
      kind: 'settle',
      timing: { delay: { after: makeCue(abbrev, 'replace'), offset_ms: 200 } },
    },
  ];
}

// ── Recipe registry ──────────────────────────────────────────────────────────

export const RECIPES = new Map([
  ['type-and-complete', { id: 'type-and-complete', name: 'Type and Complete', fn: typeAndComplete }],
  ['reveal-results-stack', { id: 'reveal-results-stack', name: 'Reveal Results Stack', fn: revealResultsStack }],
  ['open-and-select-dropdown', { id: 'open-and-select-dropdown', name: 'Open and Select Dropdown', fn: openAndSelectDropdown }],
  ['fan-and-settle-cards', { id: 'fan-and-settle-cards', name: 'Fan and Settle Cards', fn: fanAndSettleCards }],
  ['fade-and-swap-prompt', { id: 'fade-and-swap-prompt', name: 'Fade and Swap Prompt', fn: fadeAndSwapPrompt }],
]);

// ── Component + intent → recipe mapping ──────────────────────────────────────

export const COMPONENT_INTENT_TO_RECIPE = new Map([
  ['prompt_card:hero', 'type-and-complete'],
  ['prompt_card:opening', 'type-and-complete'],
  ['prompt_card:closing', 'fade-and-swap-prompt'],
  ['stacked_cards:*', 'fan-and-settle-cards'],
]);

/**
 * Look up a recipe ID for a component type + intent tags combination.
 * Returns null if no recipe applies (caller should use inline fallback).
 */
export function lookupRecipe(componentType, intentTags) {
  // Try specific intent matches first
  for (const tag of intentTags) {
    const key = `${componentType}:${tag}`;
    if (COMPONENT_INTENT_TO_RECIPE.has(key)) {
      return COMPONENT_INTENT_TO_RECIPE.get(key);
    }
  }
  // Try wildcard
  const wildcardKey = `${componentType}:*`;
  if (COMPONENT_INTENT_TO_RECIPE.has(wildcardKey)) {
    return COMPONENT_INTENT_TO_RECIPE.get(wildcardKey);
  }
  return null;
}

/**
 * Expand a recipe into an interaction array.
 * Validates that all returned IDs match ^int_[a-z0-9_]+$.
 *
 * @param {string} recipeId - Recipe identifier
 * @param {string} targetId - Component target ID (e.g., 'cmp_0')
 * @param {object} params - Recipe-specific parameters
 * @param {object} [context] - Optional context (personality, scene info)
 * @returns {object[]} Array of interaction objects
 */
export function expandRecipe(recipeId, targetId, params = {}, context = {}) {
  const recipe = RECIPES.get(recipeId);
  if (!recipe) {
    throw new Error(`Unknown interaction recipe: "${recipeId}"`);
  }

  const interactions = recipe.fn(targetId, params, context);

  // Validate output IDs
  const idPattern = /^int_[a-z0-9_]+$/;
  for (const int of interactions) {
    if (!idPattern.test(int.id)) {
      throw new Error(`Recipe "${recipeId}" produced invalid interaction ID: "${int.id}"`);
    }
  }

  return interactions;
}
