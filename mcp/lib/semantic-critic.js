/**
 * Semantic Motion Critic — ANI-73
 *
 * Analyzes v3 semantic scenes (scene.semantic.components + interactions)
 * for quality issues that timeline-only analysis cannot catch.
 *
 * Six detection rules:
 * - Density overload: too many components interacting simultaneously
 * - Missing focal: no hero role when multiple components exist
 * - Simultaneous interactions: too many interaction starts clustered
 * - Weak spacing: components too close together
 * - Bad typing cadence: type_text speed unrealistic
 * - Unreadable hold: text hold too short before next interaction
 *
 * Only runs when scene.semantic exists — v2 scenes short-circuit.
 * Pure deterministic analysis — no LLM calls, no side effects.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const DENSITY_LIMIT = 4;               // max simultaneous interacting components
const DENSITY_WINDOW_MS = 500;         // window for density check
const MIN_READABLE_HOLD_MS = 800;      // minimum text hold for readability
const TYPING_SPEED_MIN_MS = 20;        // per-char, below = too fast
const TYPING_SPEED_MAX_MS = 120;       // per-char, above = too slow
const SPACING_THRESHOLD_PX = 40;       // min distance between components
const SIMULTANEITY_CLUSTER_MS = 200;   // window for clustering interaction starts
const SIMULTANEITY_LIMIT = 3;          // max interaction starts in cluster window

// Severity levels
const ERROR = 'error';
const WARNING = 'warning';
const INFO = 'info';

// Text-modifying interaction kinds
const TEXT_MODIFYING_KINDS = new Set(['type_text', 'replace_text']);

// Text component types (need readable hold)
const TEXT_COMPONENT_TYPES = new Set(['prompt_card', 'input_field']);

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Critique a v3 semantic scene for quality issues.
 *
 * @param {object} scene - Scene definition with semantic block
 * @param {object} timeline - Compiled Level 2 timeline (for fps/duration reference)
 * @returns {{ issues: Array }}
 */
export function critiqueSemanticScene(scene, timeline) {
  if (!scene?.semantic) {
    return { issues: [] };
  }

  const components = scene.semantic.components || [];
  const interactions = scene.semantic.interactions || [];
  const fps = timeline?.fps || scene.fps || 60;
  const durationS = scene.duration_s || 3;
  const durationFrames = timeline?.duration_frames || Math.round(durationS * fps);

  const issues = [];

  issues.push(...detectDensityOverload(components, interactions, durationFrames, fps));
  issues.push(...detectMissingFocal(components));
  issues.push(...detectSimultaneousInteractions(interactions, durationFrames, fps));
  issues.push(...detectWeakSpacing(components, scene));
  issues.push(...detectBadTypingCadence(interactions, components));
  issues.push(...detectUnreadableHold(interactions, components, durationFrames, fps));

  return { issues };
}

// ── Detection Rules ──────────────────────────────────────────────────────────

/**
 * Density overload: >4 components interacting in the same 500ms window.
 */
export function detectDensityOverload(components, interactions, durationFrames, fps) {
  const issues = [];
  if (interactions.length === 0) return issues;

  const durationMs = (durationFrames / fps) * 1000;

  // Walk through time in 500ms windows, count distinct targets
  for (let windowStart = 0; windowStart < durationMs; windowStart += DENSITY_WINDOW_MS / 2) {
    const windowEnd = windowStart + DENSITY_WINDOW_MS;
    const targets = new Set();

    for (const interaction of interactions) {
      const startMs = resolveInteractionStartMs(interaction);
      if (startMs >= windowStart && startMs < windowEnd) {
        targets.add(interaction.target);
      }
    }

    if (targets.size > DENSITY_LIMIT) {
      issues.push({
        rule: 'semantic_density_overload',
        severity: WARNING,
        layer: null,
        message: `${targets.size} components interacting in ${DENSITY_WINDOW_MS}ms window at ${Math.round(windowStart)}ms — exceeds limit of ${DENSITY_LIMIT}`,
        suggestion: 'Stagger interactions across time or reduce simultaneous component activity',
      });
      break; // Only report once
    }
  }

  return issues;
}

/**
 * Missing focal: no component with role 'hero' when 2+ components exist.
 */
export function detectMissingFocal(components) {
  const issues = [];
  if (components.length < 2) return issues;

  const hasHero = components.some(c => c.role === 'hero');
  if (!hasHero) {
    issues.push({
      rule: 'semantic_missing_focal',
      severity: WARNING,
      layer: null,
      message: `${components.length} components but none has role "hero" — no clear focal point`,
      suggestion: 'Assign role: "hero" to the primary component for visual hierarchy',
    });
  }

  return issues;
}

/**
 * Simultaneous interactions: >3 interaction starts within 200ms.
 */
export function detectSimultaneousInteractions(interactions, durationFrames, fps) {
  const issues = [];
  if (interactions.length <= SIMULTANEITY_LIMIT) return issues;

  // Get all start times and sort
  const startTimes = interactions
    .map(i => resolveInteractionStartMs(i))
    .filter(t => t != null)
    .sort((a, b) => a - b);

  // Sliding window: check if >3 starts within 200ms
  for (let i = 0; i < startTimes.length; i++) {
    let count = 1;
    for (let j = i + 1; j < startTimes.length; j++) {
      if (startTimes[j] - startTimes[i] <= SIMULTANEITY_CLUSTER_MS) {
        count++;
      } else {
        break;
      }
    }
    if (count > SIMULTANEITY_LIMIT) {
      issues.push({
        rule: 'semantic_simultaneous_interactions',
        severity: INFO,
        layer: null,
        message: `${count} interactions start within ${SIMULTANEITY_CLUSTER_MS}ms at ${Math.round(startTimes[i])}ms`,
        suggestion: 'Spread interaction starts using cue-based delays for better readability',
      });
      break; // Only report once
    }
  }

  return issues;
}

/**
 * Weak spacing: components within 40px of each other.
 */
export function detectWeakSpacing(components, scene) {
  const issues = [];
  if (components.length < 2) return issues;

  // Only check if components have position data
  const positioned = components.filter(c => c.position && c.position.x != null && c.position.y != null);
  if (positioned.length < 2) return issues;

  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      const a = positioned[i].position;
      const b = positioned[j].position;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < SPACING_THRESHOLD_PX) {
        issues.push({
          rule: 'semantic_weak_spacing',
          severity: INFO,
          layer: null,
          message: `Components "${positioned[i].id}" and "${positioned[j].id}" are ${Math.round(distance)}px apart — below ${SPACING_THRESHOLD_PX}px threshold`,
          suggestion: 'Increase spacing between components for visual clarity',
        });
      }
    }
  }

  return issues;
}

/**
 * Bad typing cadence: type_text speed <20ms or >120ms per character.
 */
export function detectBadTypingCadence(interactions, components) {
  const issues = [];

  for (const interaction of interactions) {
    if (interaction.kind !== 'type_text') continue;

    const speed = interaction.params?.speed;
    if (speed == null) continue;

    if (speed < TYPING_SPEED_MIN_MS) {
      issues.push({
        rule: 'semantic_bad_typing_cadence',
        severity: WARNING,
        layer: interaction.target,
        message: `type_text speed ${speed}ms/char on "${interaction.target}" is below ${TYPING_SPEED_MIN_MS}ms — too fast to read`,
        suggestion: `Increase speed to at least ${TYPING_SPEED_MIN_MS}ms per character`,
      });
    } else if (speed > TYPING_SPEED_MAX_MS) {
      issues.push({
        rule: 'semantic_bad_typing_cadence',
        severity: INFO,
        layer: interaction.target,
        message: `type_text speed ${speed}ms/char on "${interaction.target}" exceeds ${TYPING_SPEED_MAX_MS}ms — feels sluggish`,
        suggestion: `Reduce speed to at most ${TYPING_SPEED_MAX_MS}ms per character`,
      });
    }
  }

  return issues;
}

/**
 * Unreadable hold: text component hold <800ms before next interaction.
 */
export function detectUnreadableHold(interactions, components, durationFrames, fps) {
  const issues = [];
  if (interactions.length === 0 || components.length === 0) return issues;

  // Build set of text component IDs
  const textComponentIds = new Set(
    components
      .filter(c => TEXT_COMPONENT_TYPES.has(c.type))
      .map(c => c.id)
  );

  if (textComponentIds.size === 0) return issues;

  // Find text-modifying interactions sorted by start time
  const textInteractions = interactions
    .filter(i => TEXT_MODIFYING_KINDS.has(i.kind) && textComponentIds.has(i.target))
    .map(i => ({
      ...i,
      startMs: resolveInteractionStartMs(i),
    }))
    .filter(i => i.startMs != null)
    .sort((a, b) => a.startMs - b.startMs);

  // Get all interaction start times for "next interaction" check
  const allStartTimes = interactions
    .map(i => ({ target: i.target, startMs: resolveInteractionStartMs(i) }))
    .filter(i => i.startMs != null)
    .sort((a, b) => a.startMs - b.startMs);

  const durationMs = (durationFrames / fps) * 1000;

  for (const textInt of textInteractions) {
    // Estimate end of text interaction
    const endMs = estimateInteractionEndMs(textInt);
    if (endMs == null) continue;

    // Find next interaction on the same target
    const nextOnTarget = allStartTimes.find(
      i => i.target === textInt.target && i.startMs > endMs
    );

    const holdEnd = nextOnTarget ? nextOnTarget.startMs : durationMs;
    const holdMs = holdEnd - endMs;

    if (holdMs < MIN_READABLE_HOLD_MS && holdMs >= 0) {
      issues.push({
        rule: 'semantic_unreadable_hold',
        severity: WARNING,
        layer: textInt.target,
        message: `Text on "${textInt.target}" holds for ${Math.round(holdMs)}ms after ${textInt.kind} — below ${MIN_READABLE_HOLD_MS}ms minimum for readability`,
        suggestion: `Add at least ${MIN_READABLE_HOLD_MS}ms hold after text changes before the next interaction`,
      });
    }
  }

  return issues;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve an interaction's start time in milliseconds.
 * Returns null if timing cannot be resolved to absolute ms.
 */
function resolveInteractionStartMs(interaction) {
  const timing = interaction.timing;
  if (!timing) return 0;

  if (timing.at_ms != null) return timing.at_ms;

  // Cue-based delays can't be resolved to absolute ms without cue graph
  // Use a rough estimate: treat delay.offset_ms as the start time
  if (timing.delay?.offset_ms != null) return timing.delay.offset_ms;

  return 0;
}

/**
 * Estimate when an interaction finishes in milliseconds.
 */
function estimateInteractionEndMs(interaction) {
  const startMs = resolveInteractionStartMs(interaction);
  if (startMs == null) return null;

  if (interaction.duration_ms) {
    return startMs + interaction.duration_ms;
  }

  // Estimate based on kind
  if (interaction.kind === 'type_text') {
    const text = interaction.params?.text || '';
    const speed = interaction.params?.speed || 50;
    return startMs + text.length * speed;
  }

  if (interaction.kind === 'replace_text') {
    return startMs + (interaction.params?.fade_duration_ms || 400);
  }

  // Default estimate
  return startMs + 300;
}

// ── Exports ──────────────────────────────────────────────────────────────────

export {
  DENSITY_LIMIT,
  DENSITY_WINDOW_MS,
  MIN_READABLE_HOLD_MS,
  TYPING_SPEED_MIN_MS,
  TYPING_SPEED_MAX_MS,
  SPACING_THRESHOLD_PX,
  SIMULTANEITY_CLUSTER_MS,
  SIMULTANEITY_LIMIT,
};
