/**
 * Custom Personality Definitions — ANI-43
 *
 * Validates, derives guardrails/shot-grammar restrictions, and registers
 * custom personalities at runtime. Custom personalities use the same
 * schema as built-in ones and pass through the same validation pipeline.
 *
 * Users provide a simplified definition; the system infers guardrail
 * boundaries and shot grammar restrictions from the characteristics.
 */

import { loadPersonalitiesCatalog, loadCameraGuardrails, loadShotGrammar } from '../data/loader.js';

// ── Registry ─────────────────────────────────────────────────────────────────

const builtinCatalog = loadPersonalitiesCatalog();
const guardrailsCatalog = loadCameraGuardrails();
const shotGrammarCatalog = loadShotGrammar();

/** Runtime registry of custom personalities (slug → personality object). */
const customPersonalities = new Map();

/** Runtime registry of derived guardrail boundaries for custom personalities. */
const customGuardrails = new Map();

/** Runtime registry of derived shot grammar restrictions for custom personalities. */
const customShotGrammarRestrictions = new Map();

/**
 * Get a personality by slug (built-in or custom).
 */
export function getPersonality(slug) {
  if (customPersonalities.has(slug)) return customPersonalities.get(slug);
  return builtinCatalog.bySlug.get(slug) || null;
}

/**
 * Get all personality slugs (built-in + custom).
 */
export function getAllPersonalitySlugs() {
  const builtins = builtinCatalog.array.map(p => p.slug);
  const custom = [...customPersonalities.keys()];
  return [...builtins, ...custom];
}

/**
 * Check if a personality slug exists (built-in or custom).
 */
export function isValidPersonality(slug) {
  return builtinCatalog.bySlug.has(slug) || customPersonalities.has(slug);
}

/**
 * Get guardrail boundaries for a personality (built-in or custom).
 */
export function getGuardrailBoundaries(slug) {
  if (customGuardrails.has(slug)) return customGuardrails.get(slug);
  return guardrailsCatalog.personality_boundaries?.[slug] || null;
}

/**
 * Get shot grammar restrictions for a personality (built-in or custom).
 */
export function getShotGrammarRestrictions(slug) {
  if (customShotGrammarRestrictions.has(slug)) return customShotGrammarRestrictions.get(slug);
  return shotGrammarCatalog.personality_restrictions?.[slug] || null;
}

/**
 * List all custom personalities.
 */
export function listCustomPersonalities() {
  return [...customPersonalities.values()];
}

// ── Validation ───────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['name', 'slug'];
const VALID_CONTRASTS = ['high', 'medium', 'low'];
const VALID_COLOR_MODES = ['dark', 'light'];
const VALID_CAMERA_MODES = ['full-3d', '2d-only', 'attention-direction', 'none'];
const VALID_MOTION_INTENSITIES = ['dramatic', 'rapid', 'restrained', 'gentle'];

/**
 * Validate a custom personality definition.
 *
 * @param {object} definition — personality JSON
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validatePersonalityDefinition(definition) {
  const errors = [];
  const warnings = [];

  if (!definition || typeof definition !== 'object') {
    return { valid: false, errors: ['Definition must be a JSON object'], warnings };
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!definition[field] || typeof definition[field] !== 'string') {
      errors.push(`Missing or invalid required field: "${field}"`);
    }
  }

  // Slug format
  if (definition.slug) {
    if (!/^[a-z][a-z0-9-]*$/.test(definition.slug)) {
      errors.push('Slug must be lowercase kebab-case (e.g., "my-custom-style")');
    }
    if (builtinCatalog.bySlug.has(definition.slug)) {
      errors.push(`Slug "${definition.slug}" conflicts with a built-in personality`);
    }
  }

  // Characteristics
  const chars = definition.characteristics;
  if (chars) {
    if (chars.contrast && !VALID_CONTRASTS.includes(chars.contrast)) {
      errors.push(`characteristics.contrast must be one of: ${VALID_CONTRASTS.join(', ')}`);
    }
    if (chars.color_mode && !VALID_COLOR_MODES.includes(chars.color_mode)) {
      errors.push(`characteristics.color_mode must be one of: ${VALID_COLOR_MODES.join(', ')}`);
    }
    if (chars.motion_intensity && !VALID_MOTION_INTENSITIES.includes(chars.motion_intensity)) {
      errors.push(`characteristics.motion_intensity must be one of: ${VALID_MOTION_INTENSITIES.join(', ')}`);
    }
  } else {
    warnings.push('No characteristics provided — defaults will be inferred (medium contrast, light color, restrained motion)');
  }

  // Camera behavior
  const cam = definition.camera_behavior;
  if (cam) {
    if (cam.mode && !VALID_CAMERA_MODES.includes(cam.mode)) {
      errors.push(`camera_behavior.mode must be one of: ${VALID_CAMERA_MODES.join(', ')}`);
    }
  }

  // Duration overrides
  if (definition.duration_overrides) {
    for (const [key, val] of Object.entries(definition.duration_overrides)) {
      if (typeof val !== 'string') {
        errors.push(`duration_overrides.${key} must be a CSS time string (e.g., "400ms")`);
      }
    }
  }

  // Easing overrides
  if (definition.easing_overrides) {
    for (const [key, val] of Object.entries(definition.easing_overrides)) {
      if (typeof val !== 'string') {
        errors.push(`easing_overrides.${key} must be a CSS easing string`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Derivation ───────────────────────────────────────────────────────────────

/**
 * Derive guardrail boundaries from personality characteristics.
 * Maps characteristics → forbidden features and limits.
 */
function deriveGuardrails(definition) {
  const chars = definition.characteristics || {};
  const cam = definition.camera_behavior || {};
  const forbidden = [];

  // Perspective
  const is3D = cam.mode === 'full-3d';
  // 2D mode detected but not used directly — forbidden features cover it
  const noCamera = cam.mode === 'none' || cam.enabled === false;

  if (!is3D) forbidden.push('3d_transforms');
  if (noCamera) {
    forbidden.push('camera_movement', 'parallax', 'camera_shake');
  }

  // Blur
  const noDOF = !cam.depth_of_field?.enabled;
  if (noDOF) forbidden.push('blur_entrance', 'blur');

  // Ambient motion
  if (cam.ambient_motion === false || noCamera) {
    forbidden.push('ambient_motion');
  }

  // Spring physics
  if (chars.motion_intensity === 'gentle' || chars.motion_intensity === 'restrained') {
    if (!definition.speed_hierarchy?.includes('spring')) {
      forbidden.push('spring_physics');
    }
  }

  // Shake
  if (!cam.shake?.enabled) forbidden.push('camera_shake');

  // Limits based on motion intensity
  const limits = {};
  switch (chars.motion_intensity) {
    case 'dramatic':
      // No extra limits
      break;
    case 'rapid':
      limits.max_scale_change_percent = 3;
      break;
    case 'restrained':
      limits.max_translateXY = 30;
      limits.max_scale_change_percent = 1;
      break;
    case 'gentle':
      limits.max_translateXY = 15;
      limits.max_scale_change_percent = 0.5;
      limits.max_ambient_scale_percent = 0.2;
      break;
    default:
      limits.max_translateXY = 30;
      limits.max_scale_change_percent = 1;
  }

  return {
    forbidden_features: [...new Set(forbidden)],
    ...limits,
  };
}

/**
 * Derive shot grammar restrictions from personality characteristics.
 */
function deriveShotGrammarRestrictions(definition) {
  const chars = definition.characteristics || {};
  const cam = definition.camera_behavior || {};
  const is3D = cam.mode === 'full-3d';

  // Base — all sizes, angles, framings allowed
  const restrictions = {
    allowed_sizes: ['wide', 'medium', 'close_up', 'extreme_close_up'],
    allowed_angles: ['eye_level', 'high', 'low'],
    allowed_framings: ['center', 'rule_of_thirds_left', 'rule_of_thirds_right', 'dynamic_offset'],
    use_3d_rotation: is3D,
  };

  // Restrict based on motion intensity
  if (chars.motion_intensity === 'gentle') {
    restrictions.allowed_angles = ['eye_level'];
    restrictions.allowed_sizes = ['wide', 'medium'];
    restrictions.max_scale = 1.08;
  } else if (chars.motion_intensity === 'restrained') {
    restrictions.allowed_angles = ['eye_level', 'high'];
    restrictions.max_scale = 1.2;
  }

  // Dutch angle only for dramatic/3D
  if (is3D && (chars.motion_intensity === 'dramatic' || chars.contrast === 'high')) {
    restrictions.allowed_angles.push('dutch');
  }

  return restrictions;
}

/**
 * Build a full personality object from a user definition, filling defaults.
 */
function buildFullPersonality(definition) {
  const chars = definition.characteristics || {};

  return {
    name: definition.name,
    slug: definition.slug,
    css_prefix: definition.css_prefix || definition.slug.slice(0, 2),
    is_active: true,

    duration_overrides: definition.duration_overrides || {
      fast: '200ms',
      medium: '400ms',
      slow: '700ms',
      feedback: '120ms',
      structural: '350ms',
      spatial: '500ms',
      emphasis: '600ms',
    },

    easing_overrides: definition.easing_overrides || {
      enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
      exit: 'cubic-bezier(0.55, 0, 1, 0.45)',
      smooth: 'cubic-bezier(0.37, 0, 0.63, 1)',
    },

    speed_hierarchy: definition.speed_hierarchy || ['fast', 'medium', 'slow'],

    characteristics: {
      contrast: chars.contrast || 'medium',
      motion_intensity: chars.motion_intensity || 'restrained',
      entrance_style: chars.entrance_style || 'Fade and slide',
      transition_style: chars.transition_style || 'Crossfade',
      perspective: chars.perspective || 'flat (no 3D)',
      color_mode: chars.color_mode || 'light',
      loop_time: chars.loop_time || '10-14s',
      ...(chars.signature_effect ? { signature_effect: chars.signature_effect } : {}),
    },

    default_stagger: definition.default_stagger || '120ms',
    default_entrance: definition.default_entrance || 'ed-fade-up',
    default_exit: definition.default_exit || 'ed-fade-out',

    camera_behavior: buildCameraBehavior(definition),

    ai_guidance: definition.ai_guidance || `Custom personality: ${definition.name}. ${chars.entrance_style || 'Standard'} entrances, ${chars.transition_style || 'crossfade'} transitions.`,
  };
}

/**
 * Build camera_behavior from definition, filling defaults based on mode.
 */
function buildCameraBehavior(definition) {
  const cam = definition.camera_behavior || {};
  const mode = cam.mode || 'none';

  const base = {
    enabled: mode !== 'none',
    mode,
    perspective: mode === 'full-3d' ? (cam.perspective || '1200px') : 'none',
  };

  switch (mode) {
    case 'full-3d':
      return {
        ...base,
        allowed_movements: cam.allowed_movements || ['dolly', 'truck', 'pan', 'tilt', 'orbit', 'crane'],
        parallax: cam.parallax || { enabled: true, mode: '3d-translateZ', max_layers: 4, intensity: 'full' },
        depth_of_field: cam.depth_of_field || { enabled: true, max_blur: '8px', entrance_blur: true },
        ambient_motion: cam.ambient_motion || {
          scene_breathe: { scale: '0.3%', duration: '12s' },
          drift: { amplitude: '1px', duration: '14s' },
        },
        shake: cam.shake || { enabled: false },
        camera_easing: cam.camera_easing || 'cubic-bezier(0.22, 1, 0.36, 1)',
        constraints: cam.constraints || 'Full 3D camera with all movements allowed.',
      };
    case '2d-only':
      return {
        ...base,
        allowed_movements: cam.allowed_movements || ['push-in', 'drift'],
        parallax: cam.parallax || { enabled: true, mode: '2d-speed-differential', max_layers: 3, intensity: 'subtle' },
        depth_of_field: cam.depth_of_field || { enabled: false },
        ambient_motion: cam.ambient_motion || {
          scene_breathe: { scale: '0.2%', duration: '14s' },
          drift: { amplitude: '0.5px', duration: '16s' },
        },
        shake: { enabled: false },
        camera_easing: cam.camera_easing || 'cubic-bezier(0.37, 0, 0.63, 1)',
        constraints: cam.constraints || '2D translate and scale only.',
      };
    case 'attention-direction':
      return {
        ...base,
        allowed_movements: [],
        parallax: { enabled: false },
        depth_of_field: { enabled: false },
        ambient_motion: cam.ambient_motion || {
          scene_breathe: { scale: '0.1%', duration: '16s' },
          drift: { enabled: false },
        },
        shake: { enabled: false },
        camera_easing: 'linear',
        constraints: cam.constraints || 'No camera movement. Attention direction only.',
      };
    default: // 'none'
      return {
        ...base,
        allowed_movements: [],
        parallax: { enabled: false },
        depth_of_field: { enabled: false },
        ambient_motion: false,
        shake: { enabled: false },
        camera_easing: 'linear',
        constraints: 'No camera. No ambient motion.',
      };
  }
}

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Validate and register a custom personality definition.
 *
 * Validates the definition, derives guardrail boundaries and shot grammar
 * restrictions, builds a full personality object with defaults, and registers
 * it in the runtime registry.
 *
 * @param {object} definition — user-provided personality definition
 * @returns {{ success: boolean, personality: object|null, guardrails: object|null, shot_grammar: object|null, errors: string[], warnings: string[] }}
 */
export function registerPersonality(definition) {
  const validation = validatePersonalityDefinition(definition);
  if (!validation.valid) {
    return {
      success: false,
      personality: null,
      guardrails: null,
      shot_grammar: null,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Check for duplicate custom slug
  if (customPersonalities.has(definition.slug)) {
    // Allow re-registration (update)
    customPersonalities.delete(definition.slug);
    customGuardrails.delete(definition.slug);
    customShotGrammarRestrictions.delete(definition.slug);
  }

  // Build full personality
  const personality = buildFullPersonality(definition);

  // Derive guardrails and shot grammar
  const guardrails = deriveGuardrails(definition);
  const shotGrammar = deriveShotGrammarRestrictions(definition);

  // Register
  customPersonalities.set(definition.slug, personality);
  customGuardrails.set(definition.slug, guardrails);
  customShotGrammarRestrictions.set(definition.slug, shotGrammar);

  return {
    success: true,
    personality,
    guardrails,
    shot_grammar: shotGrammar,
    errors: [],
    warnings: validation.warnings,
  };
}

/**
 * Remove a custom personality from the registry.
 */
export function unregisterPersonality(slug) {
  if (!customPersonalities.has(slug)) return false;
  customPersonalities.delete(slug);
  customGuardrails.delete(slug);
  customShotGrammarRestrictions.delete(slug);
  return true;
}
