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
 * - Orphan layers: layers in scene but absent from timeline tracks
 * - Camera-motion mismatch: camera peaks while no layer motion happening
 * - Excessive simultaneity: >3 layers animating in the same 10-frame window
 *
 * Pure deterministic analysis — no LLM calls, no side effects.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const DEAD_HOLD_THRESHOLD = 0.3;       // 30% of scene duration
const REPETITIVE_EASING_THRESHOLD = 0.8; // 80% same easing
const SIMULTANEITY_WINDOW = 10;         // frames
const SIMULTANEITY_LIMIT = 3;           // max layers in window

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
 * @returns {{ score: number, issues: Array, summary: string }}
 */
export function critiqueTimeline(timeline, scene) {
  if (!timeline || !timeline.tracks) {
    return {
      score: 100,
      issues: [],
      summary: 'No timeline to critique',
    };
  }

  const issues = [];
  const durationFrames = timeline.duration_frames || 0;
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
  issues.push(...detectRepetitiveEasing(layerTracks));
  issues.push(...detectOrphanLayers(layerTracks, scene));
  issues.push(...detectCameraMotionMismatch(cameraTracks, layerTracks, durationFrames));
  issues.push(...detectExcessiveSimultaneity(layerTracks, durationFrames));

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
 * Compute a 0-100 motion quality score from issues.
 */
function computeScore(issues) {
  let deduction = 0;
  for (const issue of issues) {
    deduction += SEVERITY_DEDUCTIONS[issue.severity] || 3;
  }
  return Math.max(0, Math.min(100, 100 - deduction));
}

/**
 * Build a one-line summary verdict.
 */
function buildSummary(score, issues) {
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

  // Identify hero layer: first foreground layer, or first layer
  const sceneLayers = scene.layers || [];
  const heroLayer = sceneLayers.find(l => l.depth_class === 'foreground')
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
 */
export function detectRepetitiveEasing(layerTracks) {
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

  if (totalWithEasing < 4) return issues; // Too few to judge

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

// ── Exports ──────────────────────────────────────────────────────────────────

