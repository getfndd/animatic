/**
 * Motion Critic — ANI-65
 *
 * Analyzes compiled Level 2 timelines (frame-addressed keyframe tracks)
 * for common motion quality issues and provides actionable revision
 * suggestions.
 *
 * Detection rules:
 * - Dead holds: layer stuck at same value for >30% of scene
 * - Flat motion: all layers have identical timing (no stagger)
 * - Missing hierarchy: hero layer has <= animation complexity than supporting
 * - Repetitive easing: >80% of keyframes use the same easing curve
 *   (also flags >60% same transition type at sequence level)
 * - Orphan layers: layers in scene but absent from timeline tracks
 * - Camera-motion mismatch: camera peaks while no layer motion happening
 * - Excessive simultaneity: >3 layers animating in the same 10-frame window
 * - Flat pacing: 3+ consecutive scenes at the same energy level
 * - Missing secondary motion: hero animates but midground/background are static
 * - Weak contrast: sequence has no "still" moment (static camera, no entrances)
 * - Simultaneous transitions: >2 layer entrances in the same 5-frame window during transition
 * - Dead audio sync: beat points don't align with transitions/entrances within 200ms
 * - Text on motion: text layers with entrance + camera move simultaneously
 *
 * Pure deterministic analysis — no LLM calls, no side effects.
 */

import { critiqueSemanticScene } from './semantic-critic.js';

// ── Constants ────────────────────────────────────────────────────────────────

const DEAD_HOLD_THRESHOLD = 0.3;       // 30% of scene duration
const REPETITIVE_EASING_THRESHOLD = 0.8; // 80% same easing
const REPETITIVE_TRANSITION_THRESHOLD = 0.6; // 60% same transition type
const SIMULTANEITY_WINDOW = 10;         // frames
const SIMULTANEITY_LIMIT = 3;           // max layers in window
const TRANSITION_SIMULTANEITY_WINDOW = 5;  // frames — tighter window for transition overlaps
const TRANSITION_SIMULTANEITY_LIMIT = 2;   // max layers starting in same 5-frame window
const FLAT_PACING_RUN = 3;             // consecutive same-energy scenes to flag
const AUDIO_SYNC_TOLERANCE_MS = 200;   // beat-to-event alignment tolerance

// Severity levels
const ERROR = 'error';
const WARNING = 'warning';
const INFO = 'info';

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Critique a compiled Level 2 timeline for motion quality issues.
 *
 * @param {object} timeline - Compiled Level 2 timeline from compileMotion()
 *   { scene_id, duration_frames, fps, tracks: { camera, layers } }
 * @param {object} scene - Original scene definition with layers array
 * @param {object} [sequenceContext] - Optional sequence-level context for multi-scene rules
 *   { scenes: Array<{ duration_s, transition_type, energy }>, currentIndex: number }
 * @returns {{ score: number, issues: Array, summary: string }}
 */
export function critiqueTimeline(timeline, scene, sequenceContext) {
  if (!timeline || !timeline.tracks) {
    return {
      score: 100,
      issues: [],
      summary: 'No timeline to critique',
    };
  }

  const issues = [];
  const durationFrames = timeline.duration_frames || 0;
  const fps = timeline.fps || 60;
  const layerTracks = timeline.tracks.layers || {};
  const cameraTracks = timeline.tracks.camera || {};

  if (durationFrames === 0) {
    return {
      score: 100,
      issues: [],
      summary: 'Empty timeline — nothing to critique',
    };
  }

  // Run each detection rule
  issues.push(...detectDeadHolds(layerTracks, durationFrames));
  issues.push(...detectFlatMotion(layerTracks));
  issues.push(...detectMissingHierarchy(layerTracks, scene));
  issues.push(...detectRepetitiveEasing(layerTracks, sequenceContext));
  issues.push(...detectOrphanLayers(layerTracks, scene));
  issues.push(...detectCameraMotionMismatch(cameraTracks, layerTracks, durationFrames));
  issues.push(...detectExcessiveSimultaneity(layerTracks, durationFrames));
  issues.push(...detectMissingSecondaryMotion(layerTracks, scene));
  issues.push(...detectSimultaneousTransitions(layerTracks, scene, durationFrames));
  issues.push(...detectDeadAudioSync(layerTracks, scene, fps));
  issues.push(...detectTextOnMotion(layerTracks, cameraTracks, scene));

  // Sequence-level rules (only when context is provided)
  if (sequenceContext) {
    issues.push(...detectFlatPacing(sequenceContext));
    issues.push(...detectWeakContrast(sequenceContext));
  }

  // Score: start at 100, deduct per issue by severity
  const score = computeScore(issues);
  const summary = buildSummary(score, issues);

  return { score, issues, summary };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const SEVERITY_DEDUCTIONS = {
  [ERROR]: 15,
  [WARNING]: 8,
  [INFO]: 3,
};

/**
 * Max deduction per rule type. Prevents repeated instances of the same
 * rule (e.g., excessive_simultaneity across many frame windows) from
 * creating a scoring cliff.
 */
const MAX_DEDUCTION_PER_RULE = 12;

/**
 * Compute a 0-100 motion quality score from issues.
 * Caps the total deduction from any single rule to MAX_DEDUCTION_PER_RULE.
 */
export function computeScore(issues) {
  const ruleDeductions = {};
  for (const issue of issues) {
    const amount = SEVERITY_DEDUCTIONS[issue.severity] || 3;
    ruleDeductions[issue.rule] = (ruleDeductions[issue.rule] || 0) + amount;
  }

  let deduction = 0;
  for (const amount of Object.values(ruleDeductions)) {
    deduction += Math.min(amount, MAX_DEDUCTION_PER_RULE);
  }
  return Math.max(0, Math.min(100, 100 - deduction));
}

/**
 * Build a one-line summary verdict.
 */
export function buildSummary(score, issues) {
  const errors = issues.filter(i => i.severity === ERROR).length;
  const warnings = issues.filter(i => i.severity === WARNING).length;
  const infos = issues.filter(i => i.severity === INFO).length;

  if (issues.length === 0) {
    return 'Clean timeline — no motion quality issues detected';
  }

  const parts = [];
  if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
  if (infos > 0) parts.push(`${infos} suggestion${infos > 1 ? 's' : ''}`);

  const verdict = score >= 80 ? 'Good' : score >= 60 ? 'Needs attention' : 'Significant issues';
  return `${verdict} (score: ${score}) — ${parts.join(', ')}`;
}

// ── Detection Rules ──────────────────────────────────────────────────────────

/**
 * Dead holds: a layer stays at the same value for >30% of scene duration
 * with no other animated properties providing visual interest.
 */
export function detectDeadHolds(layerTracks, durationFrames) {
  const issues = [];

  for (const [layerId, tracks] of Object.entries(layerTracks)) {
    const props = Object.keys(tracks);

    for (const prop of props) {
      const keyframes = tracks[prop];
      if (!keyframes || keyframes.length < 2) continue;

      // Check for long holds at the same value
      for (let i = 0; i < keyframes.length - 1; i++) {
        const curr = keyframes[i];
        const next = keyframes[i + 1];
        const holdFrames = next.frame - curr.frame;
        const holdRatio = holdFrames / durationFrames;

        if (holdRatio > DEAD_HOLD_THRESHOLD && curr.value === next.value) {
          // Check if other properties are animating during this window
          const otherPropsAnimating = props.some(otherProp => {
            if (otherProp === prop) return false;
            const otherKfs = tracks[otherProp];
            if (!otherKfs) return false;
            return otherKfs.some(kf =>
              kf.frame >= curr.frame && kf.frame <= next.frame
            );
          });

          if (!otherPropsAnimating) {
            issues.push({
              rule: 'dead_hold',
              severity: WARNING,
              layer: layerId,
              message: `Layer "${layerId}" holds ${prop}=${curr.value} for ${Math.round(holdRatio * 100)}% of scene with no other motion`,
              suggestion: 'Add subtle scale drift or filter animation to maintain visual interest',
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Flat motion: all layers have identical first-keyframe timing
 * (everything enters at the same frame — no stagger).
 */
export function detectFlatMotion(layerTracks) {
  const issues = [];
  const layerIds = Object.keys(layerTracks);

  if (layerIds.length < 2) return issues;

  // Get the earliest keyframe frame for each layer
  const startFrames = layerIds.map(id => {
    const tracks = layerTracks[id];
    let earliest = Infinity;
    for (const keyframes of Object.values(tracks)) {
      if (keyframes && keyframes.length > 0) {
        earliest = Math.min(earliest, keyframes[0].frame);
      }
    }
    return earliest;
  }).filter(f => f !== Infinity);

  if (startFrames.length < 2) return issues;

  // Check if all layers start at the same frame
  const allSame = startFrames.every(f => f === startFrames[0]);
  if (allSame) {
    issues.push({
      rule: 'flat_motion',
      severity: WARNING,
      layer: null,
      message: `All ${layerIds.length} layers start animating at frame ${startFrames[0]} — no stagger or sequencing`,
      suggestion: 'Add stagger intervals or cue-based delays to create visual rhythm',
    });
  }

  return issues;
}

/**
 * Missing hierarchy: hero layer has same or less animation complexity
 * than supporting layers. Hero is identified by scene layer metadata
 * or by being the first layer in the scene definition.
 */
export function detectMissingHierarchy(layerTracks, scene) {
  const issues = [];
  const layerIds = Object.keys(layerTracks);

  if (layerIds.length < 2 || !scene) return issues;

  // Identify hero layer: prefer product_role annotation, then depth_class heuristic
  const sceneLayers = scene.layers || [];
  const heroLayer = sceneLayers.find(l => l.product_role === 'hero')
    || sceneLayers.find(l => l.depth_class === 'foreground')
    || sceneLayers[0];

  if (!heroLayer) return issues;

  const heroId = heroLayer.id;
  const heroTracks = layerTracks[heroId];

  if (!heroTracks) return issues;

  // Compute complexity: number of animated properties * total keyframes
  const heroComplexity = computeTrackComplexity(heroTracks);

  for (const [layerId, tracks] of Object.entries(layerTracks)) {
    if (layerId === heroId) continue;
    const otherComplexity = computeTrackComplexity(tracks);

    if (otherComplexity > heroComplexity && heroComplexity > 0) {
      issues.push({
        rule: 'missing_hierarchy',
        severity: INFO,
        layer: heroId,
        message: `Hero layer "${heroId}" has less animation complexity (${heroComplexity}) than "${layerId}" (${otherComplexity})`,
        suggestion: 'Give the hero layer more animation properties or longer transitions to establish visual hierarchy',
      });
      break; // Only report once
    }
  }

  return issues;
}

/**
 * Repetitive easing: >80% of keyframes across all layers use the same
 * easing curve, creating monotonous motion feel.
 *
 * Also flags when >60% of scene-to-scene transitions use the same type
 * (requires sequenceContext with scenes[].transition_type).
 */
export function detectRepetitiveEasing(layerTracks, sequenceContext) {
  const issues = [];
  const easingCounts = {};
  let totalWithEasing = 0;

  for (const tracks of Object.values(layerTracks)) {
    for (const keyframes of Object.values(tracks)) {
      if (!keyframes) continue;
      for (const kf of keyframes) {
        if (kf.easing) {
          easingCounts[kf.easing] = (easingCounts[kf.easing] || 0) + 1;
          totalWithEasing++;
        }
      }
    }
  }

  if (totalWithEasing >= 4) {
    for (const [easing, count] of Object.entries(easingCounts)) {
      if (count / totalWithEasing > REPETITIVE_EASING_THRESHOLD) {
        issues.push({
          rule: 'repetitive_easing',
          severity: INFO,
          layer: null,
          message: `${Math.round(count / totalWithEasing * 100)}% of keyframes use "${easing}" — motion feels monotonous`,
          suggestion: 'Mix easing curves: use expo_out for hero entrances, ease_out for supporting, linear for ambient',
        });
      }
    }
  }

  // Sequence-level: flag when >60% of transitions use the same type
  if (sequenceContext && sequenceContext.scenes && sequenceContext.scenes.length >= 3) {
    const transitionCounts = {};
    let totalTransitions = 0;

    for (const s of sequenceContext.scenes) {
      if (s.transition_type) {
        transitionCounts[s.transition_type] = (transitionCounts[s.transition_type] || 0) + 1;
        totalTransitions++;
      }
    }

    if (totalTransitions >= 3) {
      for (const [type, count] of Object.entries(transitionCounts)) {
        if (count / totalTransitions > REPETITIVE_TRANSITION_THRESHOLD) {
          issues.push({
            rule: 'repetitive_easing',
            severity: INFO,
            layer: null,
            message: `${Math.round(count / totalTransitions * 100)}% of scene transitions use "${type}" — sequence feels monotonous`,
            suggestion: 'Alternate transition types: pair crossfades with hard cuts, or add a whip-wipe for energy shifts',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Orphan layers: layers defined in the scene but absent from timeline tracks
 * (no animation at all — completely static).
 */
export function detectOrphanLayers(layerTracks, scene) {
  const issues = [];

  if (!scene || !scene.layers) return issues;

  for (const layer of scene.layers) {
    if (!layerTracks[layer.id]) {
      issues.push({
        rule: 'orphan_layer',
        severity: WARNING,
        layer: layer.id,
        message: `Layer "${layer.id}" is defined in the scene but has no animation tracks`,
        suggestion: `Add "${layer.id}" to a motion group or give it an entrance primitive`,
      });
    }
  }

  return issues;
}

/**
 * Camera-motion mismatch: camera has peak energy at frames where
 * no layer animation is occurring (wasted camera movement).
 */
export function detectCameraMotionMismatch(cameraTracks, layerTracks, durationFrames) {
  const issues = [];

  // Find camera peak frames (where camera value changes most)
  const cameraKeyframes = getAllKeyframes(cameraTracks);
  if (cameraKeyframes.length < 2) return issues;

  // Find the camera peak: the keyframe with the largest delta from its predecessor
  let maxDelta = 0;
  let peakFrame = 0;
  for (let i = 1; i < cameraKeyframes.length; i++) {
    const delta = Math.abs(cameraKeyframes[i].value - cameraKeyframes[i - 1].value);
    if (delta > maxDelta) {
      maxDelta = delta;
      peakFrame = cameraKeyframes[i].frame;
    }
  }

  if (maxDelta === 0) return issues;

  // Check if any layer is animating near the camera peak (within 15-frame window)
  const peakWindow = 15;
  const layerAnimatingNearPeak = Object.values(layerTracks).some(tracks => {
    const kfs = getAllKeyframes(tracks);
    return kfs.some(kf =>
      Math.abs(kf.frame - peakFrame) <= peakWindow
    );
  });

  if (!layerAnimatingNearPeak) {
    issues.push({
      rule: 'camera_motion_mismatch',
      severity: WARNING,
      layer: null,
      message: `Camera peaks at frame ${peakFrame} but no layer animation occurs nearby`,
      suggestion: 'Sync camera peak_at with a group on_complete cue, or add layer motion during camera movement',
    });
  }

  return issues;
}

/**
 * Excessive simultaneity: >3 layers animating in the same 10-frame window
 * (visual chaos — too much happening at once).
 */
export function detectExcessiveSimultaneity(layerTracks, durationFrames) {
  const issues = [];
  const layerIds = Object.keys(layerTracks);

  if (layerIds.length <= SIMULTANEITY_LIMIT) return issues;

  // Build a frame → active layers map using windows
  const windowCount = Math.ceil(durationFrames / SIMULTANEITY_WINDOW);
  const reported = new Set();

  for (let w = 0; w < windowCount; w++) {
    const windowStart = w * SIMULTANEITY_WINDOW;
    const windowEnd = windowStart + SIMULTANEITY_WINDOW;

    // Count layers that have keyframe transitions spanning this window
    const activeLayers = [];
    for (const [layerId, tracks] of Object.entries(layerTracks)) {
      const isActive = Object.values(tracks).some(keyframes => {
        if (!keyframes) return false;
        for (let i = 0; i < keyframes.length - 1; i++) {
          const kfStart = keyframes[i].frame;
          const kfEnd = keyframes[i + 1].frame;
          // Transition is active if it overlaps the window
          if (kfStart < windowEnd && kfEnd > windowStart && kfStart !== kfEnd) {
            return true;
          }
        }
        return false;
      });
      if (isActive) activeLayers.push(layerId);
    }

    if (activeLayers.length > SIMULTANEITY_LIMIT && !reported.has(windowStart)) {
      reported.add(windowStart);
      issues.push({
        rule: 'excessive_simultaneity',
        severity: INFO,
        layer: null,
        message: `${activeLayers.length} layers animating simultaneously at frames ${windowStart}-${windowEnd}`,
        suggestion: 'Stagger layer entrances or use cue-based delays to reduce visual complexity',
      });
    }
  }

  return issues;
}

// ── New Detection Rules ──────────────────────────────────────────────────

/**
 * Flat pacing: 3+ consecutive scenes have the same energy level.
 * Energy is inferred from scene duration and transition type:
 *   - short duration (<3s) + fast transitions (hard_cut, whip_*) = high
 *   - long duration (>5s) + slow transitions (crossfade) = low
 *   - everything else = medium
 */
export function detectFlatPacing(sequenceContext) {
  const issues = [];

  if (!sequenceContext || !sequenceContext.scenes || sequenceContext.scenes.length < FLAT_PACING_RUN) {
    return issues;
  }

  const scenes = sequenceContext.scenes;

  // Infer energy per scene
  const energies = scenes.map(s => {
    // Use explicit energy if provided
    if (s.energy) return s.energy;

    const dur = s.duration_s || 3;
    const trans = (s.transition_type || '').toLowerCase();
    const fastTrans = ['hard_cut', 'whip_left', 'whip_right', 'whip_up', 'whip_down'].includes(trans);

    if (dur < 3 && fastTrans) return 'high';
    if (dur > 5 || trans === 'crossfade') return 'low';
    return 'medium';
  });

  // Scan for runs of FLAT_PACING_RUN+ consecutive same energy
  let runStart = 0;
  for (let i = 1; i <= energies.length; i++) {
    if (i < energies.length && energies[i] === energies[runStart]) continue;

    const runLen = i - runStart;
    if (runLen >= FLAT_PACING_RUN) {
      issues.push({
        rule: 'flat_pacing',
        severity: WARNING,
        layer: null,
        message: `Scenes ${runStart + 1}-${i} all have "${energies[runStart]}" energy — pacing feels flat`,
        suggestion: 'Vary scene durations and transition types to create rhythm: alternate high-impact moments with breathing room',
      });
    }
    runStart = i;
  }

  return issues;
}

/**
 * Missing secondary motion: hero layer animates but midground/background
 * layers are completely static (no parallax offset, no entrance stagger).
 */
export function detectMissingSecondaryMotion(layerTracks, scene) {
  const issues = [];

  if (!scene || !scene.layers || scene.layers.length < 2) return issues;

  // Find hero layer (foreground)
  const heroLayer = scene.layers.find(l => l.depth_class === 'foreground') || scene.layers[0];
  if (!heroLayer || !layerTracks[heroLayer.id]) return issues;

  const heroTracks = layerTracks[heroLayer.id];
  const heroComplexity = computeTrackComplexity(heroTracks);

  if (heroComplexity === 0) return issues; // hero isn't animating either

  // Check supporting layers (midground, background)
  const supportingLayers = scene.layers.filter(
    l => l.id !== heroLayer.id && (l.depth_class === 'midground' || l.depth_class === 'background')
  );

  if (supportingLayers.length === 0) return issues;

  const staticSupporting = supportingLayers.filter(l => {
    const tracks = layerTracks[l.id];
    if (!tracks) return true; // no tracks at all = static
    return computeTrackComplexity(tracks) === 0;
  });

  if (staticSupporting.length === supportingLayers.length) {
    const layerNames = staticSupporting.map(l => `"${l.id}"`).join(', ');
    issues.push({
      rule: 'missing_secondary_motion',
      severity: WARNING,
      layer: null,
      message: `Hero layer "${heroLayer.id}" animates but all supporting layers (${layerNames}) are static — no parallax or entrance stagger`,
      suggestion: 'Add subtle parallax offsets or staggered entrance delays to midground/background layers for depth',
    });
  }

  return issues;
}

/**
 * Weak contrast: sequence has no "still" moment — no scene with a static camera
 * and no entrance animations (just content hold). Best brand videos alternate
 * impact and stillness.
 */
export function detectWeakContrast(sequenceContext) {
  const issues = [];

  if (!sequenceContext || !sequenceContext.scenes || sequenceContext.scenes.length < 2) {
    return issues;
  }

  // Check if any scene in the sequence has a "still" moment
  const hasStillMoment = sequenceContext.scenes.some(s => {
    const hasStaticCamera = !s.camera_move || s.camera_move === 'static' || s.camera_move === 'none';
    const hasNoEntrances = !s.has_entrances && s.has_entrances !== undefined;
    // If has_entrances is not specified, check if energy is explicitly low
    const isLowEnergy = s.energy === 'low' || s.energy === 'still';
    return hasStaticCamera && (hasNoEntrances || isLowEnergy);
  });

  if (!hasStillMoment) {
    issues.push({
      rule: 'weak_contrast',
      severity: INFO,
      layer: null,
      message: 'Sequence has no "still" moment — every scene has camera movement or entrance animations',
      suggestion: 'Add at least one quiet scene with a static camera and no entrances — let content breathe to create contrast',
    });
  }

  return issues;
}

/**
 * Simultaneous transitions: during a transition overlap, more than 2 layer
 * entrance animations start in the same 5-frame window. Creates visual chaos
 * at the worst possible moment.
 */
export function detectSimultaneousTransitions(layerTracks, scene, durationFrames) {
  const issues = [];
  const layerIds = Object.keys(layerTracks);

  if (layerIds.length < 2) return issues;

  // Determine the transition zone: the first and last 15% of the scene
  // (where scene-to-scene transitions typically overlap)
  const transitionZoneFrames = Math.floor(durationFrames * 0.15);
  const zones = [
    { label: 'opening', start: 0, end: transitionZoneFrames },
    { label: 'closing', start: durationFrames - transitionZoneFrames, end: durationFrames },
  ];

  for (const zone of zones) {
    if (zone.start < 0 || zone.end <= zone.start) continue;

    // Collect first keyframe (entrance start) per layer within this zone
    const entranceFrames = [];
    for (const [layerId, tracks] of Object.entries(layerTracks)) {
      let earliest = Infinity;
      for (const keyframes of Object.values(tracks)) {
        if (!keyframes || keyframes.length < 2) continue;
        const first = keyframes[0].frame;
        if (first >= zone.start && first < zone.end) {
          earliest = Math.min(earliest, first);
        }
      }
      if (earliest !== Infinity) {
        entranceFrames.push({ layerId, frame: earliest });
      }
    }

    if (entranceFrames.length <= TRANSITION_SIMULTANEITY_LIMIT) continue;

    // Check for clusters within 5-frame windows
    entranceFrames.sort((a, b) => a.frame - b.frame);

    for (let i = 0; i < entranceFrames.length; i++) {
      const windowStart = entranceFrames[i].frame;
      const windowEnd = windowStart + TRANSITION_SIMULTANEITY_WINDOW;
      const inWindow = entranceFrames.filter(e => e.frame >= windowStart && e.frame < windowEnd);

      if (inWindow.length > TRANSITION_SIMULTANEITY_LIMIT) {
        const layerNames = inWindow.map(e => `"${e.layerId}"`).join(', ');
        issues.push({
          rule: 'simultaneous_transitions',
          severity: WARNING,
          layer: null,
          message: `${inWindow.length} layers (${layerNames}) start entrance animations within ${TRANSITION_SIMULTANEITY_WINDOW} frames during ${zone.label} transition zone`,
          suggestion: 'Stagger entrance animations during transitions — lead with the hero, follow with supporting layers 3-5 frames apart',
        });
        break; // One issue per zone is enough
      }
    }
  }

  return issues;
}

/**
 * Dead audio sync: when a scene has audio markers/beats data, flag major
 * beat points that don't align with any transition or layer entrance
 * within 200ms.
 */
export function detectDeadAudioSync(layerTracks, scene, fps) {
  const issues = [];

  if (!scene) return issues;

  // Check for audio beats data on the scene
  const beats = scene.audio_beats || scene.beats || (scene.audio && scene.audio.beats);
  if (!beats || !Array.isArray(beats) || beats.length === 0) return issues;

  const toleranceFrames = Math.ceil((AUDIO_SYNC_TOLERANCE_MS / 1000) * fps);

  // Collect all layer entrance frames (first keyframe of each layer)
  const eventFrames = [];
  for (const tracks of Object.values(layerTracks)) {
    for (const keyframes of Object.values(tracks)) {
      if (!keyframes || keyframes.length < 2) continue;
      eventFrames.push(keyframes[0].frame);
      // Also include any keyframe that starts a new transition (value change)
      for (let i = 1; i < keyframes.length; i++) {
        if (keyframes[i].value !== keyframes[i - 1].value) {
          eventFrames.push(keyframes[i].frame);
        }
      }
    }
  }

  if (eventFrames.length === 0) return issues;

  const unsyncedBeats = [];
  for (const beat of beats) {
    // Beat can be in ms or seconds; normalize to frames
    const beatFrame = typeof beat === 'number'
      ? (beat > 100 ? Math.round((beat / 1000) * fps) : Math.round(beat * fps))
      : null;

    if (beatFrame === null) continue;

    const aligned = eventFrames.some(f => Math.abs(f - beatFrame) <= toleranceFrames);
    if (!aligned) {
      unsyncedBeats.push(beatFrame);
    }
  }

  if (unsyncedBeats.length > 0) {
    issues.push({
      rule: 'dead_audio_sync',
      severity: INFO,
      layer: null,
      message: `${unsyncedBeats.length} audio beat point(s) at frames [${unsyncedBeats.join(', ')}] have no matching transition or entrance within ${AUDIO_SYNC_TOLERANCE_MS}ms`,
      suggestion: 'Align layer entrances or transition keyframes to major beat points for tighter audio-visual sync',
    });
  }

  return issues;
}

/**
 * Text on motion: flag text layers that have both an entrance animation AND
 * a camera move happening simultaneously. Text may be unreadable when both
 * the layer and camera are in motion.
 */
export function detectTextOnMotion(layerTracks, cameraTracks, scene) {
  const issues = [];

  if (!scene || !scene.layers) return issues;

  const cameraKeyframes = getAllKeyframes(cameraTracks);
  if (cameraKeyframes.length < 2) return issues; // no camera motion

  // Find camera motion ranges (where value is changing)
  const cameraRanges = [];
  for (let i = 0; i < cameraKeyframes.length - 1; i++) {
    if (cameraKeyframes[i].value !== cameraKeyframes[i + 1].value) {
      cameraRanges.push({
        start: cameraKeyframes[i].frame,
        end: cameraKeyframes[i + 1].frame,
      });
    }
  }

  if (cameraRanges.length === 0) return issues;

  // Check text layers for entrance animation overlapping camera motion
  const textLayers = scene.layers.filter(l => l.type === 'text');

  for (const textLayer of textLayers) {
    const tracks = layerTracks[textLayer.id];
    if (!tracks) continue;

    // Find the entrance range: from first keyframe to second keyframe of any property
    let entranceStart = Infinity;
    let entranceEnd = 0;
    for (const keyframes of Object.values(tracks)) {
      if (!keyframes || keyframes.length < 2) continue;
      entranceStart = Math.min(entranceStart, keyframes[0].frame);
      entranceEnd = Math.max(entranceEnd, keyframes[1].frame);
    }

    if (entranceStart === Infinity) continue;

    // Check if this entrance overlaps with any camera motion range
    const overlaps = cameraRanges.some(
      cr => entranceStart < cr.end && entranceEnd > cr.start
    );

    if (overlaps) {
      issues.push({
        rule: 'text_on_motion',
        severity: INFO,
        layer: textLayer.id,
        message: `Text layer "${textLayer.id}" has entrance animation (frames ${entranceStart}-${entranceEnd}) while camera is also moving — text may be unreadable`,
        suggestion: 'Delay text entrance until camera settles, or use a static camera during text reveals',
      });
    }
  }

  return issues;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute animation complexity for a set of tracks.
 * Complexity = number of properties * total keyframe count.
 */
function computeTrackComplexity(tracks) {
  if (!tracks) return 0;
  const props = Object.keys(tracks);
  let totalKf = 0;
  for (const keyframes of Object.values(tracks)) {
    if (keyframes) totalKf += keyframes.length;
  }
  return props.length * totalKf;
}

/**
 * Flatten all keyframes from a tracks object into a single sorted array.
 */
function getAllKeyframes(tracks) {
  if (!tracks) return [];
  const all = [];
  for (const keyframes of Object.values(tracks)) {
    if (keyframes) all.push(...keyframes);
  }
  return all.sort((a, b) => a.frame - b.frame);
}

// ── Combined Orchestrator ────────────────────────────────────────────────────

/**
 * Critique a scene using both timeline and semantic analysis.
 *
 * Timeline analysis always runs. Semantic analysis only runs when
 * scene.semantic exists. Issues are merged, score recomputed.
 *
 * @param {object} timeline - Compiled Level 2 timeline from compileMotion()
 * @param {object} scene - Original scene definition (v2 or v3)
 * @returns {{ score: number, issues: Array, summary: string }}
 */
export function critiqueScene(timeline, scene) {
  const timelineResult = critiqueTimeline(timeline, scene);

  if (!scene?.semantic) return timelineResult;

  const semanticResult = critiqueSemanticScene(scene, timeline);
  const allIssues = [...timelineResult.issues, ...semanticResult.issues];
  const score = computeScore(allIssues);

  return { score, issues: allIssues, summary: buildSummary(score, allIssues) };
}

// ── Exports ──────────────────────────────────────────────────────────────────

