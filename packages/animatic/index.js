/**
 * @preset/animatic — AI cinematography engine
 *
 * Compile, critique, and plan animated video from code.
 * Zero-dependency, pure ESM.
 */

// Core Pipeline
export { compileMotion, compileAllScenes, ANIMATABLE_DEFAULTS } from '../../mcp/lib/compiler.js';
export { critiqueScene, critiqueTimeline, computeScore } from '../../mcp/lib/critic.js';

// Scene Authoring
export { analyzeScene } from '../../mcp/lib/analyze.js';

// Sequence Planning
export { planSequence, planVariants } from '../../mcp/lib/planner.js';
export { evaluateSequence, compareVariants } from '../../mcp/lib/evaluate.js';

// Validation
export { validateChoreography } from '../../mcp/lib/choreography.js';
export { CAMERA_CONSTANTS, validateScene, validateManifest } from '../../mcp/lib/scene-utils.js';

// Personalities
export { registerPersonality, getPersonality, getAllPersonalitySlugs } from '../../mcp/lib/personality.js';

// Audio
export { detectBeats } from '../../mcp/lib/beats.js';

// Layout + Compositing
export { resolveComponentLayout } from '../../mcp/lib/layout-constraints.js';
export { COMPOSITING_PRESETS, getCompositingPreset, resolvePresetEffects } from '../../mcp/lib/compositing-presets.js';

// Data
export { loadCatalogs, searchPrimitives } from './data.js';
