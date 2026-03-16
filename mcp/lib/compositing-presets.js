/**
 * Compositing Presets — Named effect stacks for common compositing patterns (ANI-75).
 *
 * Each preset defines a set of effects with from/to values that can be
 * applied to any layer via the semantic compiler or motion groups.
 */

export const COMPOSITING_PRESETS = {
  'soft-shadow': {
    description: 'Gentle drop shadow fade-in',
    effects: [
      { type: 'shadow_opacity', from: 0, to: 0.15 },
      { type: 'shadow_offset_y', from: 0, to: 8 },
      { type: 'shadow_blur_radius', from: 0, to: 24 },
    ],
  },
  'translucent-surface': {
    description: 'Frosted glass backdrop blur',
    effects: [
      { type: 'surface_blur', from: 0, to: 12 },
    ],
  },
  'edge-highlight': {
    description: 'Inner glow for edge emphasis',
    effects: [
      { type: 'inner_glow_opacity', from: 0, to: 0.3 },
      { type: 'inner_glow_spread', from: 0, to: 4 },
    ],
  },
  'gradient-reveal': {
    description: 'Gradient mask wipe reveal',
    effects: [
      { type: 'mask_gradient_start', from: 0, to: 1 },
    ],
  },
  'focus-pull': {
    description: 'Rack focus from blurred to sharp',
    effects: [
      { type: 'filter_blur', from: 8, to: 0 },
    ],
  },
  'clip-reveal-top': {
    description: 'Reveal by sliding clip from top',
    effects: [
      { type: 'clip_inset_top', from: 100, to: 0 },
    ],
  },
  'clip-reveal-circle': {
    description: 'Circular iris reveal',
    effects: [
      { type: 'clip_circle', from: 0, to: 100 },
    ],
  },
};

/**
 * Get a compositing preset by name.
 * @param {string} name - Preset name
 * @returns {object|null} Preset definition or null
 */
export function getCompositingPreset(name) {
  return COMPOSITING_PRESETS[name] || null;
}

/**
 * Resolve a preset's effects with optional overrides.
 * Overrides are merged by effect type — matching types replace from/to values.
 *
 * @param {string} name - Preset name
 * @param {object} [overrides] - { [effectType]: { from?, to? } }
 * @returns {object[]|null} Resolved effects array or null if preset not found
 */
export function resolvePresetEffects(name, overrides = {}) {
  const preset = COMPOSITING_PRESETS[name];
  if (!preset) return null;

  return preset.effects.map(effect => {
    const override = overrides[effect.type];
    if (override) {
      return {
        ...effect,
        ...(override.from != null ? { from: override.from } : {}),
        ...(override.to != null ? { to: override.to } : {}),
      };
    }
    return { ...effect };
  });
}
