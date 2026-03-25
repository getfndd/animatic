/**
 * Beat-Aware Audio Sequencing — ANI-100
 *
 * Makes audio a first-class motion driver. Aligns scene transitions to beat
 * points, generates hit markers for transition alignment, plans audio cues
 * (risers, whooshes, stings) based on energy curves, and scores sync quality.
 *
 * Pure functions, no I/O. Consumes beat data from analyze_beats.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const TIGHT_SYNC_MS = 100;
const LOOSE_SYNC_MS = 200;
const MAX_DURATION_ADJUST = 0.15; // ±15%

/** Beat types ordered by rhythmic importance. */
const BEAT_IMPORTANCE = { downbeat: 3, kick: 2, snare: 1 };

/** Audio cue templates per scene role pattern. */
export const CUE_TEMPLATES = {
  riser:  { lead_beats: [2, 3, 4], description: 'Build tension before key transition' },
  whoosh: { on_transition: true, types: ['whip_left', 'whip_right', 'whip_up', 'whip_down'], description: 'Accent whip transitions' },
  sting:  { on_role: ['closing', 'logo', 'brand_reveal'], description: 'Punctuate brand/logo reveals' },
  hit:    { on_role: ['hero', 'opening'], description: 'Accent hero moments' },
};

// ── syncSequenceToBeats ──────────────────────────────────────────────────────

/**
 * Align a sequence manifest's scene transitions to nearest beat points.
 *
 * Adjusts scene durations so transition boundaries land on (or near) beats.
 * Duration changes are clamped to ±15% to avoid breaking pacing.
 *
 * @param {object} manifest — Sequence manifest with `scenes` array
 * @param {object} beats — Beat data from analyze_beats: { beats, tempo_bpm, energy_curve }
 * @param {object} [options]
 * @param {string} [options.sync_mode='tight'] — 'tight' (100ms) or 'loose' (200ms)
 * @param {number} [options.max_adjust_pct=0.15] — Max duration adjustment as fraction
 * @returns {{ manifest: object, sync_report: object }}
 */
export function syncSequenceToBeats(manifest, beats, options = {}) {
  const {
    sync_mode = 'tight',
    max_adjust_pct = MAX_DURATION_ADJUST,
  } = options;

  if (!manifest?.scenes?.length || !beats?.beats?.length) {
    return {
      manifest: manifest || { scenes: [] },
      sync_report: {
        adjusted_count: 0,
        total_scenes: manifest?.scenes?.length || 0,
        sync_score: 0,
        adjustments: [],
      },
    };
  }

  const beatTimes = normalizeBeatTimes(beats.beats);
  const tolerance = sync_mode === 'tight' ? TIGHT_SYNC_MS / 1000 : LOOSE_SYNC_MS / 1000;

  const adjustedScenes = [...manifest.scenes.map(s => ({ ...s }))];
  const adjustments = [];
  let cumulative = 0;

  for (let i = 0; i < adjustedScenes.length - 1; i++) {
    const scene = adjustedScenes[i];
    const originalDur = scene.duration_s;
    cumulative += originalDur;

    // Find nearest beat to this transition boundary
    const nearest = findNearestBeat(cumulative, beatTimes);
    if (nearest === null) continue;

    const delta = nearest - cumulative;
    const absDelta = Math.abs(delta);

    // Already within tolerance — no adjustment needed
    if (absDelta < 0.01) continue;

    // Check if adjustment is within tolerance window
    if (absDelta > tolerance * 2) continue;

    // Check if adjustment stays within ±max_adjust_pct of original duration
    const maxDelta = originalDur * max_adjust_pct;
    if (absDelta > maxDelta) continue;

    // Apply adjustment
    const newDuration = parseFloat((originalDur + delta).toFixed(3));
    if (newDuration < 0.5) continue; // floor

    adjustedScenes[i] = { ...scene, duration_s: newDuration };
    cumulative = nearest;

    adjustments.push({
      scene_index: i,
      scene_id: scene.scene || scene.id || `scene_${i}`,
      original_duration: originalDur,
      adjusted_duration: newDuration,
      delta_s: parseFloat(delta.toFixed(3)),
      beat_time: nearest,
      type: delta > 0 ? 'stretch' : 'compress',
    });
  }

  const adjustedManifest = { ...manifest, scenes: adjustedScenes };
  const syncScore = scoreAudioSync(adjustedManifest, beats);

  return {
    manifest: adjustedManifest,
    sync_report: {
      adjusted_count: adjustments.length,
      total_scenes: adjustedScenes.length,
      sync_score: syncScore.score,
      sync_mode,
      adjustments,
    },
  };
}

// ── generateHitMarkers ───────────────────────────────────────────────────────

/**
 * Identify key hit points from beat data and generate markers for transition
 * alignment. Filters by beat type importance and energy.
 *
 * @param {object} beats — Beat data: { beats, tempo_bpm, energy_curve }
 * @param {object} [options]
 * @param {number} [options.sensitivity=0.5] — Energy threshold for inclusion (0-1)
 * @param {number} [options.minGapMs=200] — Minimum gap between markers in ms
 * @returns {{ markers: object[], stats: object }}
 */
export function generateHitMarkers(beats, options = {}) {
  const {
    sensitivity = 0.5,
    minGapMs = 200,
  } = options;

  if (!beats?.beats?.length) {
    return { markers: [], stats: { total: 0, by_type: {} } };
  }

  const beatList = normalizeBeatTimes(beats.beats);
  const energyCurve = beats.energy_curve || [];
  const minGapS = minGapMs / 1000;

  // Score each beat by importance + energy at that time
  const scored = beatList.map(b => {
    const time = typeof b === 'number' ? b : b.time_s;
    const type = typeof b === 'object' ? (b.type || 'kick') : 'kick';
    const strength = typeof b === 'object' ? (b.strength || 0.5) : 0.5;

    // Look up energy at this time
    const energy = getEnergyAtTime(time, energyCurve, beats.duration_s || estimateDuration(beatList));
    const importance = BEAT_IMPORTANCE[type] || 1;
    const score = (importance * 0.4) + (strength * 0.3) + (energy * 0.3);

    return { time_s: time, type, strength, energy, importance, score };
  });

  // Filter by sensitivity threshold
  const filtered = scored.filter(b => b.score >= sensitivity);

  // Enforce minimum gap
  const markers = [];
  for (const beat of filtered) {
    if (markers.length === 0 || (beat.time_s - markers[markers.length - 1].time_s) >= minGapS) {
      markers.push({
        time_s: beat.time_s,
        type: beat.type,
        strength: parseFloat(beat.strength.toFixed(2)),
        energy: parseFloat(beat.energy.toFixed(2)),
        score: parseFloat(beat.score.toFixed(2)),
        label: beat.importance >= 2 ? 'primary' : 'secondary',
      });
    }
  }

  // Stats
  const byType = {};
  for (const m of markers) {
    byType[m.type] = (byType[m.type] || 0) + 1;
  }

  return {
    markers,
    stats: {
      total: markers.length,
      by_type: byType,
      avg_score: markers.length > 0
        ? parseFloat((markers.reduce((s, m) => s + m.score, 0) / markers.length).toFixed(2))
        : 0,
    },
  };
}

// ── planAudioCues ────────────────────────────────────────────────────────────

/**
 * Given beats and a sequence archetype slug, suggest where to place audio
 * cues (risers, whooshes, stings, logo hits) based on energy curve and
 * scene roles.
 *
 * @param {object} beats — Beat data: { beats, tempo_bpm, energy_curve }
 * @param {string} archetypeSlug — Sequence archetype (e.g. 'product-launch', 'brand-story', 'sizzle-reel')
 * @param {object} [manifest] — Optional manifest for scene role awareness
 * @returns {{ cues: object[], summary: object }}
 */
export function planAudioCues(beats, archetypeSlug, manifest = null) {
  if (!beats?.beats?.length) {
    return { cues: [], summary: { total: 0, by_type: {} } };
  }

  const beatList = normalizeBeatTimes(beats.beats);
  const energyCurve = beats.energy_curve || [];
  const totalDuration = beats.duration_s || estimateDuration(beatList);
  const bpm = beats.tempo_bpm || 120;
  const beatInterval = 60 / bpm;

  const cues = [];
  const scenes = manifest?.scenes || [];

  // Determine archetype-specific emphasis
  const emphasis = getArchetypeEmphasis(archetypeSlug);

  // Build cumulative scene boundaries for role lookup
  const boundaries = [];
  let cum = 0;
  for (const scene of scenes) {
    cum += scene.duration_s || 0;
    boundaries.push({
      end_s: cum,
      scene_id: scene.scene || scene.id,
      transition_type: scene.transition_in?.type || 'hard_cut',
    });
  }

  // 1. Risers: Place before energy peaks and key transitions
  const energyPeaks = findEnergyPeaks(energyCurve, totalDuration);
  for (const peak of energyPeaks) {
    const leadBeats = emphasis.riser_lead_beats || 3;
    const riserStart = peak.time_s - (leadBeats * beatInterval);
    if (riserStart < 0) continue;

    // Snap riser start to nearest beat
    const snappedStart = snapToNearestBeat(riserStart, beatList);
    cues.push({
      type: 'riser',
      time_s: parseFloat(snappedStart.toFixed(3)),
      duration_s: parseFloat((peak.time_s - snappedStart).toFixed(3)),
      intensity: parseFloat(peak.energy.toFixed(2)),
      reason: `Energy peak at ${peak.time_s.toFixed(1)}s`,
    });
  }

  // 2. Whooshes: Align with whip transitions
  for (const boundary of boundaries) {
    const tType = boundary.transition_type;
    if (tType.startsWith('whip_')) {
      const transitionTime = boundary.end_s;
      cues.push({
        type: 'whoosh',
        time_s: parseFloat((transitionTime - 0.1).toFixed(3)), // slightly before
        duration_s: 0.3,
        transition: tType,
        reason: `${tType} transition at ${transitionTime.toFixed(1)}s`,
      });
    }
  }

  // 3. Stings: On logo/brand reveals (last scene or scenes with brand-like IDs)
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneId = (scene.scene || scene.id || '').toLowerCase();
    const isLogoScene = /logo|brand|reveal|closing|tagline/.test(sceneId);

    if (isLogoScene) {
      const sceneStart = boundaries[i]
        ? boundaries[i].end_s - (scene.duration_s || 0)
        : 0;
      // Snap to nearest beat
      const snapped = snapToNearestBeat(sceneStart, beatList);
      cues.push({
        type: 'sting',
        time_s: parseFloat(snapped.toFixed(3)),
        duration_s: 0.5,
        scene_id: scene.scene || scene.id,
        reason: `Logo/brand scene "${sceneId}"`,
      });
    }
  }

  // 4. Hits: On hero moments / high-energy beats
  if (emphasis.use_hits) {
    const hitMarkers = generateHitMarkers(beats, { sensitivity: 0.6, minGapMs: 500 });
    for (const marker of hitMarkers.markers.slice(0, emphasis.max_hits || 4)) {
      // Avoid duplicating existing cues within 200ms
      const tooClose = cues.some(c => Math.abs(c.time_s - marker.time_s) < 0.2);
      if (!tooClose) {
        cues.push({
          type: 'hit',
          time_s: marker.time_s,
          duration_s: 0.15,
          strength: marker.strength,
          reason: `High-energy ${marker.type} beat`,
        });
      }
    }
  }

  // Sort by time
  cues.sort((a, b) => a.time_s - b.time_s);

  // Summary
  const byType = {};
  for (const c of cues) {
    byType[c.type] = (byType[c.type] || 0) + 1;
  }

  return {
    cues,
    summary: {
      total: cues.length,
      by_type: byType,
      archetype: archetypeSlug,
      tempo_bpm: bpm,
      total_duration_s: parseFloat(totalDuration.toFixed(1)),
    },
  };
}

// ── scoreAudioSync ───────────────────────────────────────────────────────────

/**
 * Score how well a manifest's transitions align with beat points.
 *
 * @param {object} manifest — Sequence manifest with `scenes` array
 * @param {object} beats — Beat data: { beats, tempo_bpm, energy_curve }
 * @returns {{ score: number, details: object[], grade: string }}
 */
export function scoreAudioSync(manifest, beats) {
  if (!manifest?.scenes?.length || !beats?.beats?.length) {
    return { score: 0, details: [], grade: 'F' };
  }

  const beatTimes = normalizeBeatTimes(beats.beats);
  const details = [];
  let cumulative = 0;
  let totalScore = 0;

  // Score each transition boundary (between scenes)
  for (let i = 0; i < manifest.scenes.length - 1; i++) {
    const scene = manifest.scenes[i];
    cumulative += scene.duration_s || 0;

    const nearest = findNearestBeat(cumulative, beatTimes);
    if (nearest === null) continue;

    const offsetMs = Math.abs(cumulative - nearest) * 1000;
    let transitionScore;
    let syncLevel;

    if (offsetMs <= TIGHT_SYNC_MS) {
      transitionScore = 100 - (offsetMs / TIGHT_SYNC_MS) * 15; // 85-100
      syncLevel = 'tight';
    } else if (offsetMs <= LOOSE_SYNC_MS) {
      transitionScore = 70 - ((offsetMs - TIGHT_SYNC_MS) / (LOOSE_SYNC_MS - TIGHT_SYNC_MS)) * 30; // 40-70
      syncLevel = 'loose';
    } else {
      transitionScore = Math.max(0, 40 - (offsetMs - LOOSE_SYNC_MS) / 10);
      syncLevel = 'off';
    }

    transitionScore = Math.round(Math.max(0, Math.min(100, transitionScore)));

    details.push({
      scene_index: i,
      scene_id: scene.scene || scene.id || `scene_${i}`,
      transition_time_s: parseFloat(cumulative.toFixed(3)),
      nearest_beat_s: nearest,
      offset_ms: parseFloat(offsetMs.toFixed(1)),
      score: transitionScore,
      sync_level: syncLevel,
    });

    totalScore += transitionScore;
  }

  const score = details.length > 0
    ? Math.round(totalScore / details.length)
    : 0;

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  return { score, details, grade };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize beat data — accepts both number[] and object[] formats.
 */
function normalizeBeatTimes(beats) {
  if (!beats || beats.length === 0) return [];
  if (typeof beats[0] === 'number') return beats;
  return beats.map(b => b.time_s);
}

/**
 * Find the nearest beat timestamp to a given time.
 */
function findNearestBeat(time, beatTimes) {
  if (!beatTimes.length) return null;
  let closest = null;
  let closestDist = Infinity;
  for (const bt of beatTimes) {
    const dist = Math.abs(bt - time);
    if (dist < closestDist) {
      closestDist = dist;
      closest = bt;
    }
  }
  return closest;
}

/**
 * Snap a time to the nearest beat.
 */
function snapToNearestBeat(time, beatTimes) {
  const nearest = findNearestBeat(time, beatTimes);
  return nearest !== null ? nearest : time;
}

/**
 * Get energy at a specific time from the energy curve.
 */
function getEnergyAtTime(time, energyCurve, totalDuration) {
  if (!energyCurve.length || !totalDuration) return 0.5;

  // Energy curve may be array of numbers or array of { time_s, energy }
  if (typeof energyCurve[0] === 'number') {
    const idx = Math.min(
      Math.floor((time / totalDuration) * energyCurve.length),
      energyCurve.length - 1
    );
    return energyCurve[Math.max(0, idx)];
  }

  // Object format: find nearest point
  let closest = energyCurve[0];
  for (const point of energyCurve) {
    if (Math.abs(point.time_s - time) < Math.abs(closest.time_s - time)) {
      closest = point;
    }
  }
  return closest.energy || 0.5;
}

/**
 * Estimate total duration from beat timestamps.
 */
function estimateDuration(beatTimes) {
  if (!beatTimes.length) return 0;
  const times = beatTimes.map(b => typeof b === 'number' ? b : b.time_s);
  return Math.max(...times) + 1; // Add 1s buffer after last beat
}

/**
 * Find peaks in the energy curve.
 */
function findEnergyPeaks(energyCurve, totalDuration) {
  if (!energyCurve.length) return [];

  const peaks = [];
  const isObjectFormat = typeof energyCurve[0] !== 'number';

  const values = isObjectFormat
    ? energyCurve.map(p => p.energy)
    : energyCurve;

  const times = isObjectFormat
    ? energyCurve.map(p => p.time_s)
    : values.map((_, i) => (i / values.length) * totalDuration);

  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1] && values[i] > 0.6) {
      peaks.push({ time_s: times[i], energy: values[i] });
    }
  }

  // If no peaks found, use the global maximum
  if (peaks.length === 0 && values.length > 0) {
    const maxIdx = values.indexOf(Math.max(...values));
    if (values[maxIdx] > 0.3) {
      peaks.push({ time_s: times[maxIdx], energy: values[maxIdx] });
    }
  }

  return peaks;
}

/**
 * Archetype-specific emphasis configuration.
 */
function getArchetypeEmphasis(slug) {
  const defaults = {
    riser_lead_beats: 3,
    use_hits: true,
    max_hits: 4,
  };

  const overrides = {
    'product-launch': { riser_lead_beats: 4, use_hits: true, max_hits: 6 },
    'brand-story':    { riser_lead_beats: 3, use_hits: false, max_hits: 0 },
    'sizzle-reel':    { riser_lead_beats: 2, use_hits: true, max_hits: 8 },
    'investor-pitch': { riser_lead_beats: 3, use_hits: false, max_hits: 0 },
    'tutorial':       { riser_lead_beats: 2, use_hits: false, max_hits: 0 },
    'photo-essay':    { riser_lead_beats: 4, use_hits: false, max_hits: 0 },
  };

  return { ...defaults, ...(overrides[slug] || {}) };
}
