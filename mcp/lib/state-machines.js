/**
 * Component-Local State Machines (ANI-76)
 *
 * Per-component-type visual overrides for shared interaction kinds.
 * Each machine defines named states (visual snapshots) and kind overrides
 * (effect replacements). The resolver returns override data or null,
 * letting interactionToGroup() fall through to defaults.
 */

// ── Machine Definitions ──────────────────────────────────────────────────────

const STATE_MACHINES = new Map([
  ['prompt_card', {
    type: 'prompt_card',
    states: {
      idle:       { opacity: 1, scale: 1 },
      focused:    { opacity: 1, scale: 1.02 },
      active:     { opacity: 1, scale: 1.02 },
      responding: { opacity: 0.9, scale: 1.01 },
      settled:    { opacity: 1, scale: 1 },
    },
    overrides: {
      focus: {
        effects: [
          { type: 'opacity', from: 1, to: 0.7, duration_ms: 150, easing: null },
          { type: 'opacity', from: 0.7, to: 1, duration_ms: 150, delay_ms: 150, easing: null },
          { type: 'scale', from: 1, to: 1.02, duration_ms: 150, easing: null },
          { type: 'scale', from: 1.02, to: 1, duration_ms: 150, delay_ms: 150, easing: null },
        ],
        sibling_dim_opacity: 0.3,
        duration_ms: 300,
      },
      settle: {
        effects: [
          { type: 'scale', from: 1.02, to: 1, duration_ms: 300, easing: null },
        ],
        duration_ms: 300,
      },
    },
  }],

  ['dropdown_menu', {
    type: 'dropdown_menu',
    states: {
      idle:      { opacity: 0, translateY: -30 },
      focused:   { opacity: 1, translateY: -30 },
      open:      { opacity: 1, translateY: 0 },
      selecting: { opacity: 1, translateY: 0 },
      settled:   { opacity: 1, translateY: 0, scale: 1 },
    },
    overrides: {
      open_menu: {
        effects: [
          { type: 'translateY', from: -30, to: 0, duration_ms: 300, easing: null },
          { type: 'opacity', from: 0, to: 1, duration_ms: 300, easing: null },
        ],
        duration_ms: 300,
      },
      select_item: {
        effects: [
          { type: 'opacity', from: 0.5, to: 1, duration_ms: 150, easing: null },
        ],
        duration_ms: 150,
      },
    },
  }],

  ['result_stack', {
    type: 'result_stack',
    states: {
      idle:      { opacity: 0, translateY: 30, scale: 0.95 },
      inserting: { opacity: 0.5, translateY: 15, scale: 0.97 },
      fanned:    { opacity: 1, translateY: 0, scale: 1 },
      settled:   { opacity: 1, translateY: 0, scale: 1 },
    },
    overrides: {
      insert_items: {
        effects: [
          { type: 'translateY', from: 30, to: 0, duration_ms: 300, easing: null },
          { type: 'opacity', from: 0, to: 1, duration_ms: 300, easing: null },
          { type: 'scale', from: 0.95, to: 1, duration_ms: 300, easing: null },
        ],
        duration_ms: 300,
      },
      settle: {
        effects: [
          { type: 'scale', from: 1.05, to: 1, duration_ms: 500, easing: null },
        ],
        duration_ms: 500,
      },
    },
  }],

  ['stacked_cards', {
    type: 'stacked_cards',
    states: {
      idle:    { opacity: 1, scale: 1, rotate: 0 },
      fanned:  { opacity: 1, scale: 1 },
      settled: { opacity: 1, scale: 1, rotate: 0 },
    },
    overrides: {
      fan_stack: {
        fan_spread: 20,
        fan_easing: 'spring',
      },
      settle: {
        effects: [
          { type: 'scale', from: 1.08, to: 1, duration_ms: 450, easing: null },
        ],
        duration_ms: 450,
      },
    },
  }],

  ['input_field', {
    type: 'input_field',
    states: {
      idle:    { opacity: 1, scale: 1 },
      focused: { opacity: 1, scale: 1.01 },
      typing:  { opacity: 1, scale: 1.01 },
      settled: { opacity: 1, scale: 1 },
    },
    overrides: {
      // Subtle, fast focus pulse — typing usually follows and we don't want
      // the input jumping around underneath the typewriter effect.
      focus: {
        effects: [
          { type: 'scale', from: 1, to: 1.01, duration_ms: 100, easing: null },
          { type: 'scale', from: 1.01, to: 1, duration_ms: 100, delay_ms: 100, easing: null },
        ],
        sibling_dim_opacity: 0.5,
        duration_ms: 200,
      },
      settle: {
        effects: [
          { type: 'scale', from: 1.01, to: 1, duration_ms: 250, easing: null },
        ],
        duration_ms: 250,
      },
    },
  }],

  ['icon_label_row', {
    type: 'icon_label_row',
    states: {
      idle:    { opacity: 1, scale: 1 },
      pulsing: { opacity: 1, scale: 1.03 },
      settled: { opacity: 1, scale: 1 },
    },
    overrides: {
      // Single soft pulse — these are supporting/background status rows.
      // Replaces the generic count-based pulse with a tasteful ping.
      pulse_focus: {
        effects: [
          { type: 'opacity', from: 1, to: 0.6, duration_ms: 180, easing: null },
          { type: 'opacity', from: 0.6, to: 1, duration_ms: 180, delay_ms: 180, easing: null },
          { type: 'scale', from: 1, to: 1.03, duration_ms: 180, easing: null },
          { type: 'scale', from: 1.03, to: 1, duration_ms: 180, delay_ms: 180, easing: null },
        ],
        duration_ms: 360,
      },
      settle: {
        effects: [
          { type: 'scale', from: 1.03, to: 1, duration_ms: 220, easing: null },
        ],
        duration_ms: 220,
      },
    },
  }],

  ['upload_zone', {
    type: 'upload_zone',
    states: {
      idle:      { opacity: 1, scale: 1 },
      focused:   { opacity: 1, scale: 1.03 },
      receiving: { opacity: 1, scale: 1.02 },
      settled:   { opacity: 1, scale: 1 },
    },
    overrides: {
      // Deliberate focus — drop zones read as "attention is landing here."
      focus: {
        effects: [
          { type: 'scale', from: 1, to: 1.03, duration_ms: 200, easing: null },
          { type: 'scale', from: 1.03, to: 1, duration_ms: 200, delay_ms: 200, easing: null },
        ],
        sibling_dim_opacity: 0.25,
        duration_ms: 400,
      },
      settle: {
        effects: [
          { type: 'scale', from: 1.03, to: 1, duration_ms: 450, easing: null },
        ],
        duration_ms: 450,
      },
    },
  }],

  ['chip_row', {
    type: 'chip_row',
    states: {
      idle:     { opacity: 1, scale: 1 },
      selected: { opacity: 1, scale: 1.02 },
      settled:  { opacity: 1, scale: 1 },
    },
    overrides: {
      // Gentler than generic select_item (0.5→1 opacity): chips start mostly
      // visible and just brighten + nudge in place when picked.
      select_item: {
        effects: [
          { type: 'opacity', from: 0.75, to: 1, duration_ms: 180, easing: null },
          { type: 'scale', from: 1, to: 1.02, duration_ms: 180, easing: null },
          { type: 'scale', from: 1.02, to: 1, duration_ms: 180, delay_ms: 180, easing: null },
        ],
        duration_ms: 360,
      },
      settle: {
        effects: [
          { type: 'scale', from: 1.02, to: 1, duration_ms: 260, easing: null },
        ],
        duration_ms: 260,
      },
    },
  }],
]);

// ── Valid kinds (for validation) ─────────────────────────────────────────────

const VALID_KINDS = new Set([
  'focus', 'type_text', 'replace_text', 'open_menu', 'select_item',
  'insert_items', 'fan_stack', 'settle', 'pulse_focus',
]);

// ── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolve per-component-type overrides for an interaction kind.
 *
 * @param {string} componentType - Component type (e.g. 'prompt_card')
 * @param {string} kind - Interaction kind (e.g. 'focus')
 * @param {object} [params={}] - Interaction params (currently unused, reserved)
 * @returns {{ effects?: object[], sibling_dim_opacity?: number, duration_ms?: number, fan_spread?: number, fan_easing?: string } | null}
 */
function resolveStateOverrides(componentType, kind, params = {}) {
  if (!componentType || !kind) return null;

  const machine = STATE_MACHINES.get(componentType);
  if (!machine) return null;

  const override = machine.overrides[kind];
  if (!override) return null;

  // Deep-clone effects to prevent mutation of the registry
  const result = { ...override };
  if (result.effects) {
    result.effects = result.effects.map(e => ({ ...e }));
  }
  return result;
}

/**
 * Get state definitions for a component type.
 *
 * @param {string} componentType
 * @returns {object|null} States object or null
 */
function getComponentStates(componentType) {
  const machine = STATE_MACHINES.get(componentType);
  return machine ? machine.states : null;
}

export { STATE_MACHINES, VALID_KINDS, resolveStateOverrides, getComponentStates };
