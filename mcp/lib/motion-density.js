/**
 * Motion Density Audit — analyzes animation density per time window
 * to identify over-animated, under-animated, and competing motion.
 *
 * Exports:
 *   auditMotionDensity(timeline, scene, options)
 *   suggestSimplification(densityReport)
 */

const DEFAULT_WINDOW_SIZE = 10; // frames per analysis window
const IDEAL_SCORE = 50;
const SPARSE_THRESHOLD = 30;
const BUSY_THRESHOLD = 70;

// ── auditMotionDensity ──────────────────────────────────────────────────────

/**
 * Analyze motion density across a timeline and scene.
 *
 * @param {object} timeline - Timeline with layers and their keyframes
 *   Expected shape: { fps?: number, duration_frames?: number, layers: [{ id, keyframes: [{ frame, ...props }] }] }
 * @param {object} scene - Scene definition with duration and layer metadata
 *   Expected shape: { duration_s, fps?: number, layers?: [{ id, role?, ... }] }
 * @param {object} [options]
 * @param {number} [options.window_size] - Frames per analysis window (default 10)
 * @param {number} [options.fps] - Frames per second (default 60, overridden by scene/timeline)
 * @returns {{ score: number, density_curve: number[], hold_windows: object[], dominant_subject: object|null, hot_spots: object[], suggestions: string[] }}
 */
export function auditMotionDensity(timeline, scene, options = {}) {
  const fps = scene?.fps || timeline?.fps || options.fps || 60;
  const windowSize = options.window_size || DEFAULT_WINDOW_SIZE;

  const durationFrames = timeline?.duration_frames
    || Math.round((scene?.duration_s || 5) * fps);

  const layers = normalizeLayers(timeline, scene);

  if (layers.length === 0) {
    return {
      score: IDEAL_SCORE,
      density_curve: [],
      hold_windows: [],
      dominant_subject: null,
      hot_spots: [],
      suggestions: ['No layers found — nothing to audit.'],
    };
  }

  // Build per-frame activity map
  const frameActivity = buildFrameActivity(layers, durationFrames);

  // Compute density per window
  const windowCount = Math.max(1, Math.ceil(durationFrames / windowSize));
  const densityCurve = [];
  const holdWindows = [];
  const hotSpots = [];

  for (let w = 0; w < windowCount; w++) {
    const startFrame = w * windowSize;
    const endFrame = Math.min(startFrame + windowSize, durationFrames);
    const windowLen = endFrame - startFrame;

    // Count unique movers and total motion events in this window
    const moversInWindow = new Set();
    let motionEvents = 0;

    for (let f = startFrame; f < endFrame; f++) {
      const active = frameActivity[f] || [];
      for (const layerId of active) {
        moversInWindow.add(layerId);
      }
      motionEvents += active.length;
    }

    const simultaneousMovers = moversInWindow.size;
    // Density: ratio of motion events to max possible (all layers * all frames)
    const maxPossible = layers.length * windowLen;
    const rawDensity = maxPossible > 0 ? (motionEvents / maxPossible) * 100 : 0;

    densityCurve.push(Math.round(rawDensity * 10) / 10);

    if (motionEvents === 0) {
      holdWindows.push({
        window_index: w,
        start_frame: startFrame,
        end_frame: endFrame,
        duration_frames: windowLen,
      });
    }

    if (rawDensity > BUSY_THRESHOLD) {
      hotSpots.push({
        window_index: w,
        start_frame: startFrame,
        end_frame: endFrame,
        density: Math.round(rawDensity * 10) / 10,
        simultaneous_movers: simultaneousMovers,
        movers: [...moversInWindow],
      });
    }
  }

  // Overall score: average density, clamped 0-100
  const avgDensity = densityCurve.length > 0
    ? densityCurve.reduce((a, b) => a + b, 0) / densityCurve.length
    : 0;
  const score = Math.round(Math.min(100, Math.max(0, avgDensity)) * 10) / 10;

  // Dominant subject: layer with the most animated frames
  const dominant = findDominantSubject(layers, frameActivity, durationFrames);

  // Auto-generate suggestions
  const suggestions = generateSuggestions(
    score, densityCurve, holdWindows, hotSpots, layers, frameActivity, durationFrames, windowSize,
  );

  return {
    score,
    density_curve: densityCurve,
    hold_windows: holdWindows,
    dominant_subject: dominant,
    hot_spots: hotSpots,
    suggestions,
  };
}

// ── suggestSimplification ───────────────────────────────────────────────────

/**
 * Given a density report, suggest specific simplifications.
 *
 * @param {object} report - Output from auditMotionDensity
 * @returns {string[]} Array of actionable suggestion strings
 */
export function suggestSimplification(report) {
  if (!report) return [];

  const suggestions = [];

  // Too busy overall
  if (report.score > BUSY_THRESHOLD) {
    suggestions.push(
      `Overall density is ${report.score}/100 (ideal ~50). Reduce simultaneous animations or increase scene duration.`,
    );
  }

  // Too sparse overall
  if (report.score < SPARSE_THRESHOLD && report.score > 0) {
    suggestions.push(
      `Overall density is ${report.score}/100 (ideal ~50). The scene feels static — add entrance animations or ambient motion.`,
    );
  }

  // Hot spots with competing motion
  for (const hs of (report.hot_spots || [])) {
    if (hs.simultaneous_movers >= 3) {
      suggestions.push(
        `Frames ${hs.start_frame}–${hs.end_frame}: ${hs.simultaneous_movers} layers animate simultaneously (${hs.movers.join(', ')}). Stagger their start times or remove non-essential entrances.`,
      );
    }
  }

  // Long hold windows
  const longHolds = (report.hold_windows || []).filter(h => h.duration_frames >= 20);
  for (const h of longHolds) {
    suggestions.push(
      `Frames ${h.start_frame}–${h.end_frame}: ${h.duration_frames}-frame hold with no motion. Add a subtle ambient animation (drift, breathe) or shorten the hold.`,
    );
  }

  // Dominant subject advice
  if (report.dominant_subject && report.dominant_subject.pct > 60) {
    suggestions.push(
      `Layer "${report.dominant_subject.id}" dominates ${report.dominant_subject.pct}% of all motion. Ensure secondary layers have enough visual weight to support the composition.`,
    );
  }

  // Consecutive hot spots
  const consecutiveHot = findConsecutiveRuns(
    report.density_curve || [],
    v => v > BUSY_THRESHOLD,
  );
  for (const run of consecutiveHot) {
    if (run.length >= 3) {
      suggestions.push(
        `Windows ${run[0]}–${run[run.length - 1]}: sustained high density across ${run.length} consecutive windows. Insert a breath/hold to give the viewer's eye a rest.`,
      );
    }
  }

  return suggestions;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Normalize layers from timeline + scene into a standard format.
 */
function normalizeLayers(timeline, scene) {
  const layers = [];

  if (timeline?.layers && Array.isArray(timeline.layers)) {
    for (const layer of timeline.layers) {
      const id = layer.id || layer.name || `layer_${layers.length}`;
      const keyframes = normalizeKeyframes(layer.keyframes || layer.animations || []);
      const role = layer.role || null;
      layers.push({ id, keyframes, role });
    }
  } else if (scene?.layers && Array.isArray(scene.layers)) {
    // Fall back to scene layers if timeline has none
    for (const layer of scene.layers) {
      const id = layer.id || layer.name || `layer_${layers.length}`;
      const keyframes = normalizeKeyframes(layer.keyframes || layer.animations || []);
      const role = layer.role || null;
      layers.push({ id, keyframes, role });
    }
  }

  return layers;
}

/**
 * Normalize keyframes into [{ start_frame, end_frame }] ranges.
 */
function normalizeKeyframes(keyframes) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return [];

  const ranges = [];

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];

    if (kf.start_frame !== undefined && kf.end_frame !== undefined) {
      ranges.push({ start_frame: kf.start_frame, end_frame: kf.end_frame });
    } else if (kf.frame !== undefined) {
      // Single keyframe — assume activity spans to the next keyframe or +1
      const nextFrame = keyframes[i + 1]?.frame ?? kf.frame + 1;
      ranges.push({ start_frame: kf.frame, end_frame: nextFrame });
    } else if (kf.start !== undefined && kf.end !== undefined) {
      ranges.push({ start_frame: kf.start, end_frame: kf.end });
    }
  }

  return ranges;
}

/**
 * Build a per-frame map of which layers are active.
 */
function buildFrameActivity(layers, durationFrames) {
  const activity = {};

  for (const layer of layers) {
    for (const range of layer.keyframes) {
      const start = Math.max(0, range.start_frame);
      const end = Math.min(durationFrames, range.end_frame);
      for (let f = start; f < end; f++) {
        if (!activity[f]) activity[f] = [];
        activity[f].push(layer.id);
      }
    }
  }

  return activity;
}

/**
 * Find the layer with the most animated frames.
 */
function findDominantSubject(layers, frameActivity, durationFrames) {
  if (layers.length === 0) return null;

  const counts = {};
  let totalMotionFrames = 0;

  for (let f = 0; f < durationFrames; f++) {
    const active = frameActivity[f] || [];
    totalMotionFrames += active.length;
    for (const id of active) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  if (totalMotionFrames === 0) return null;

  let maxId = null;
  let maxCount = 0;

  for (const [id, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxId = id;
    }
  }

  return {
    id: maxId,
    frames: maxCount,
    pct: Math.round((maxCount / totalMotionFrames) * 100),
  };
}

/**
 * Generate suggestions based on density analysis.
 */
function generateSuggestions(score, densityCurve, _holdWindows, hotSpots, layers, _frameActivity, _durationFrames, windowSize) {
  const suggestions = [];

  if (score > BUSY_THRESHOLD) {
    suggestions.push('Scene is over-animated. Consider removing entrance animations from background layers.');
  } else if (score < SPARSE_THRESHOLD && score > 0) {
    suggestions.push('Scene feels static. Consider adding subtle ambient motion (drift, breathe) to background layers.');
  }

  // Find layers that start at the same frame
  const startFrames = {};
  for (const layer of layers) {
    if (layer.keyframes.length > 0) {
      const firstFrame = layer.keyframes[0].start_frame;
      if (!startFrames[firstFrame]) startFrames[firstFrame] = [];
      startFrames[firstFrame].push(layer.id);
    }
  }

  for (const [frame, layerIds] of Object.entries(startFrames)) {
    if (layerIds.length >= 3) {
      suggestions.push(
        `Stagger layers ${layerIds.join(', ')} — they all start at frame ${frame}.`,
      );
    }
  }

  // Suggest holds after hot spots
  for (const hs of hotSpots) {
    const nextWindow = hs.window_index + 1;
    if (nextWindow < densityCurve.length && densityCurve[nextWindow] > IDEAL_SCORE) {
      suggestions.push(
        `Add a ${Math.round(windowSize / 2)}-frame hold after the burst at frame ${hs.end_frame}.`,
      );
    }
  }

  return suggestions;
}

/**
 * Find runs of consecutive indices where the predicate is true.
 */
function findConsecutiveRuns(arr, predicate) {
  const runs = [];
  let current = [];

  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) {
      current.push(i);
    } else {
      if (current.length > 0) {
        runs.push(current);
        current = [];
      }
    }
  }

  if (current.length > 0) {
    runs.push(current);
  }

  return runs;
}
