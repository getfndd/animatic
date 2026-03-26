/**
 * Storyboard Tools — Contact Sheet & Version Comparison
 *
 * Review and comparison utilities for the storyboard pipeline.
 * Generates contact sheet data structures, identifies key moments,
 * and diffs manifest versions for iterative review workflows.
 *
 * Pure functions, no side effects. JSON in, JSON out.
 */

// ── Contact Sheet ───────────────────────────────────────────────────────────

/**
 * Derive a human-readable thumbnail description from a scene's layers.
 * Summarizes what the viewer would see in a single frame.
 */
export function describeThumbnail(scene) {
  const layers = scene.layers || [];
  if (layers.length === 0) return 'Empty scene';

  const parts = [];

  for (const layer of layers) {
    const type = layer.type || 'unknown';

    if (type === 'text' || type === 'typography') {
      const text = layer.content?.text || layer.text || layer.content?.headline || '';
      if (text) {
        const truncated = text.length > 40 ? text.slice(0, 37) + '...' : text;
        parts.push(`Text: "${truncated}"`);
      } else {
        parts.push('Text block');
      }
    } else if (type === 'image' || type === 'asset') {
      const src = layer.src || layer.content?.src || '';
      const filename = src ? src.split('/').pop() : '';
      const label = layer.label || filename || layer.id || 'image';
      parts.push(`Image: ${label}`);
    } else if (type === 'video') {
      parts.push(`Video: ${layer.label || layer.id || 'clip'}`);
    } else if (type === 'shape' || type === 'overlay') {
      parts.push(`${type}: ${layer.label || layer.id || ''}`);
    } else if (type === 'component') {
      const component = layer.component || layer.content?.component || 'unknown';
      parts.push(`Component: ${component}`);
    } else {
      parts.push(`${type}: ${layer.label || layer.id || ''}`);
    }
  }

  return parts.join(' | ') || 'Scene';
}

/**
 * Infer motion energy from a scene's metadata or layers.
 */
function inferEnergy(scene) {
  if (scene.metadata?.motion_energy) return scene.metadata.motion_energy;

  const layers = scene.layers || [];
  const hasAnimation = layers.some(l =>
    l.entrance || l.animation || l.motion || l.entrance_primitive
  );
  const cameraMove = scene.camera?.move || scene.camera_move;

  if (cameraMove && cameraMove !== 'static' && hasAnimation) return 'high';
  if (hasAnimation || (cameraMove && cameraMove !== 'static')) return 'moderate';
  if (layers.length > 0) return 'subtle';
  return 'static';
}

/**
 * Generate a contact sheet data structure from a manifest and its scenes.
 *
 * Each entry captures the essentials a reviewer needs at a glance:
 * scene_id, duration, thumbnail description, transition, camera, energy.
 *
 * @param {object} manifest - Sequence manifest with scene_order and transitions
 * @param {object[]|object} scenes - Array of scene objects, or { sceneId: scene } map
 * @param {object} [options]
 * @param {boolean} [options.includeTimecodes=true] - Add start/end timecodes
 * @param {boolean} [options.includeTechnical=true] - Add camera and energy details
 * @returns {{ sheets: object[], total_duration_s: number, scene_count: number }}
 */
export function generateContactSheet(manifest, scenes, options = {}) {
  const { includeTimecodes = true, includeTechnical = true } = options;

  // Normalize scenes to an array
  const sceneArray = Array.isArray(scenes)
    ? scenes
    : Object.values(scenes || {});

  // Build scene lookup
  const sceneMap = new Map();
  for (const s of sceneArray) {
    if (s.scene_id) sceneMap.set(s.scene_id, s);
  }

  // Determine scene order from manifest
  const order = manifest.scene_order
    || manifest.scenes?.map(s => s.scene_id || s.id)
    || sceneArray.map(s => s.scene_id);

  // Build transition lookup from manifest
  const transitionMap = new Map();
  const transitions = manifest.transitions || [];
  for (const t of transitions) {
    if (t.after) transitionMap.set(t.after, t);
    else if (t.between) transitionMap.set(t.between[0], t);
  }

  // Also check manifest.scenes for inline transitions
  if (manifest.scenes) {
    for (const ms of manifest.scenes) {
      const id = ms.scene_id || ms.id;
      const inlineTrans = ms.transition_in || ms.transition;
      if (inlineTrans && !transitionMap.has(id)) {
        transitionMap.set(id, inlineTrans);
      }
    }
  }

  let currentTime = 0;
  const sheets = [];

  for (const sceneId of order) {
    const scene = sceneMap.get(sceneId);
    if (!scene) continue;

    const duration = scene.duration_s || scene.duration || 3;
    const transition = transitionMap.get(sceneId);
    const transitionType = transition?.type || transition?.style || 'hard_cut';
    const transitionDurationMs = transition?.duration_ms ?? (transitionType === 'hard_cut' ? 0 : 400);

    const entry = {
      scene_id: sceneId,
      index: sheets.length,
      duration_s: duration,
      thumbnail_description: describeThumbnail(scene),
      transition_in: transitionType,
      transition_duration_ms: transitionDurationMs,
    };

    if (includeTimecodes) {
      entry.timecode_start_s = Math.round(currentTime * 100) / 100;
      entry.timecode_end_s = Math.round((currentTime + duration) * 100) / 100;
    }

    if (includeTechnical) {
      entry.camera_move = scene.camera?.move || scene.camera_move || 'static';
      entry.energy = inferEnergy(scene);
      entry.layer_count = (scene.layers || []).length;

      if (scene.metadata?.content_type) {
        entry.content_type = scene.metadata.content_type;
      }
      if (scene.metadata?.intent_tags) {
        entry.intent_tags = scene.metadata.intent_tags;
      }
    }

    sheets.push(entry);
    currentTime += duration;

    // Subtract overlap from transition (next scene starts earlier)
    if (transitionDurationMs > 0 && transitionType !== 'hard_cut') {
      currentTime -= transitionDurationMs / 1000;
    }
  }

  return {
    sheets,
    total_duration_s: Math.round(currentTime * 100) / 100,
    scene_count: sheets.length,
  };
}

// ── Key Moment Strip ────────────────────────────────────────────────────────

/**
 * Identify "key moments" in a sequence: first frame, hero entrances,
 * transition midpoints, and final frame.
 *
 * Returns frame numbers (at 60fps) and descriptions for each moment.
 *
 * @param {object} manifest - Sequence manifest
 * @param {object[]|object} scenes - Scene array or map
 * @param {object} [options]
 * @param {number} [options.maxMoments=8] - Cap on returned moments
 * @param {number} [options.fps=60] - Frame rate for frame number calculation
 * @returns {{ moments: object[], fps: number }}
 */
export function generateKeyMomentStrip(manifest, scenes, options = {}) {
  const { maxMoments = 8, fps = 60 } = options;

  const sceneArray = Array.isArray(scenes)
    ? scenes
    : Object.values(scenes || {});

  const sceneMap = new Map();
  for (const s of sceneArray) {
    if (s.scene_id) sceneMap.set(s.scene_id, s);
  }

  const order = manifest.scene_order
    || manifest.scenes?.map(s => s.scene_id || s.id)
    || sceneArray.map(s => s.scene_id);

  const transitions = manifest.transitions || [];
  const transitionMap = new Map();
  for (const t of transitions) {
    if (t.after) transitionMap.set(t.after, t);
    else if (t.between) transitionMap.set(t.between[0], t);
  }

  const moments = [];
  let currentTime = 0;

  for (let i = 0; i < order.length; i++) {
    const sceneId = order[i];
    const scene = sceneMap.get(sceneId);
    if (!scene) continue;

    const duration = scene.duration_s || scene.duration || 3;
    const isFirst = i === 0;
    const isLast = i === order.length - 1;
    const intentTags = scene.metadata?.intent_tags || [];
    const isHero = intentTags.includes('hero') || intentTags.includes('opening');

    // First frame of first scene
    if (isFirst) {
      moments.push({
        type: 'first_frame',
        frame: 0,
        time_s: 0,
        scene_id: sceneId,
        description: `Opening: ${describeThumbnail(scene)}`,
      });
    }

    // Hero entrance (first frame of hero scene)
    if (isHero && !isFirst) {
      moments.push({
        type: 'hero_entrance',
        frame: Math.round(currentTime * fps),
        time_s: Math.round(currentTime * 100) / 100,
        scene_id: sceneId,
        description: `Hero: ${describeThumbnail(scene)}`,
      });
    }

    // Transition midpoints
    const trans = transitionMap.get(sceneId);
    if (trans && !isLast) {
      const transDurationMs = trans.duration_ms || 400;
      const midpointTime = currentTime + duration - (transDurationMs / 1000 / 2);
      moments.push({
        type: 'transition_midpoint',
        frame: Math.round(midpointTime * fps),
        time_s: Math.round(midpointTime * 100) / 100,
        scene_id: sceneId,
        transition_type: trans.type || trans.style || 'crossfade',
        description: `Transition: ${trans.type || trans.style || 'crossfade'} from ${sceneId}`,
      });
    }

    // Final frame
    if (isLast) {
      const endTime = currentTime + duration;
      moments.push({
        type: 'final_frame',
        frame: Math.round(endTime * fps) - 1,
        time_s: Math.round(endTime * 100) / 100,
        scene_id: sceneId,
        description: `Closing: ${describeThumbnail(scene)}`,
      });
    }

    currentTime += duration;
    const transDurationMs = trans?.duration_ms || 0;
    if (transDurationMs > 0) {
      currentTime -= transDurationMs / 1000;
    }
  }

  // Sort by frame, deduplicate, and cap
  moments.sort((a, b) => a.frame - b.frame);

  // If over limit, keep first, last, and prioritize heroes + transitions
  if (moments.length > maxMoments) {
    const first = moments[0];
    const last = moments[moments.length - 1];
    const middle = moments.slice(1, -1);

    // Prioritize: hero > transition > other
    middle.sort((a, b) => {
      const priority = { hero_entrance: 0, transition_midpoint: 1 };
      return (priority[a.type] ?? 2) - (priority[b.type] ?? 2);
    });

    const selected = [first, ...middle.slice(0, maxMoments - 2), last];
    selected.sort((a, b) => a.frame - b.frame);
    return { moments: selected, fps };
  }

  return { moments, fps };
}

// ── Version Comparison ──────────────────────────────────────────────────────

/**
 * Compare two manifest versions and produce a structured diff report.
 *
 * @param {object} versionA - First manifest (older)
 * @param {object} versionB - Second manifest (newer)
 * @returns {object} Diff report
 */
export function compareProjectVersions(versionA, versionB) {
  const orderA = extractSceneOrder(versionA);
  const orderB = extractSceneOrder(versionB);

  const setA = new Set(orderA);
  const setB = new Set(orderB);

  const scenes_added = orderB.filter(id => !setA.has(id));
  const scenes_removed = orderA.filter(id => !setB.has(id));

  // Reorder detection: compare shared scenes in their relative order
  const shared = orderA.filter(id => setB.has(id));
  const sharedInB = orderB.filter(id => setA.has(id));
  const scenes_reordered = !arraysEqual(shared, sharedInB);

  // Duration analysis
  const durationsA = extractDurations(versionA);
  const durationsB = extractDurations(versionB);
  const totalA = sum(Object.values(durationsA));
  const totalB = sum(Object.values(durationsB));

  const duration_changes = [];
  const allSceneIds = new Set([...Object.keys(durationsA), ...Object.keys(durationsB)]);
  for (const id of allSceneIds) {
    const dA = durationsA[id];
    const dB = durationsB[id];
    if (dA != null && dB != null && dA !== dB) {
      duration_changes.push({ scene_id: id, from_s: dA, to_s: dB, delta_s: Math.round((dB - dA) * 100) / 100 });
    }
  }

  // Transition comparison
  const transA = extractTransitions(versionA);
  const transB = extractTransitions(versionB);
  const transition_changes = [];

  const allTransKeys = new Set([...Object.keys(transA), ...Object.keys(transB)]);
  for (const key of allTransKeys) {
    const tA = transA[key];
    const tB = transB[key];
    if (!tA && tB) {
      transition_changes.push({ scene_id: key, change: 'added', to: tB });
    } else if (tA && !tB) {
      transition_changes.push({ scene_id: key, change: 'removed', from: tA });
    } else if (tA && tB) {
      if (tA.type !== tB.type || tA.duration_ms !== tB.duration_ms) {
        transition_changes.push({ scene_id: key, change: 'modified', from: tA, to: tB });
      }
    }
  }

  // Camera comparison
  const camsA = extractCameraMoves(versionA);
  const camsB = extractCameraMoves(versionB);
  const camera_changes = [];

  const allCamKeys = new Set([...Object.keys(camsA), ...Object.keys(camsB)]);
  for (const key of allCamKeys) {
    if (camsA[key] !== camsB[key]) {
      camera_changes.push({ scene_id: key, from: camsA[key] || null, to: camsB[key] || null });
    }
  }

  // Timing delta: total shift in ms across all scenes
  const timing_delta_ms = Math.round((totalB - totalA) * 1000);

  return {
    scenes_added,
    scenes_removed,
    scenes_reordered,
    scene_count: { a: orderA.length, b: orderB.length },
    duration_change: {
      total_a_s: Math.round(totalA * 100) / 100,
      total_b_s: Math.round(totalB * 100) / 100,
      delta_s: Math.round((totalB - totalA) * 100) / 100,
    },
    duration_changes,
    transition_changes,
    camera_changes,
    timing_delta_ms,
  };
}

// ── Markdown Formatters ─────────────────────────────────────────────────────

/**
 * Format a contact sheet as a markdown table.
 */
export function formatContactSheetMarkdown(contactSheet) {
  const { sheets, total_duration_s, scene_count } = contactSheet;

  let md = `# Contact Sheet\n\n`;
  md += `**Scenes:** ${scene_count} | **Total Duration:** ${total_duration_s.toFixed(1)}s\n\n`;

  if (sheets.length === 0) {
    md += '_No scenes._\n';
    return md;
  }

  // Build header
  const hasTimecodes = sheets[0].timecode_start_s != null;
  const hasTechnical = sheets[0].camera_move != null;

  let header = '| # | Scene | Duration | Description | Transition';
  let separator = '|---|-------|----------|-------------|----------';

  if (hasTimecodes) {
    header += ' | Timecode';
    separator += '|--------';
  }
  if (hasTechnical) {
    header += ' | Camera | Energy';
    separator += '|--------|------';
  }

  md += header + ' |\n';
  md += separator + '|\n';

  for (const s of sheets) {
    let row = `| ${s.index + 1} | ${s.scene_id} | ${s.duration_s.toFixed(1)}s | ${s.thumbnail_description} | ${s.transition_in}`;

    if (hasTimecodes) {
      row += ` | ${formatTimecode(s.timecode_start_s)} - ${formatTimecode(s.timecode_end_s)}`;
    }
    if (hasTechnical) {
      row += ` | ${s.camera_move} | ${s.energy}`;
    }

    md += row + ' |\n';
  }

  return md;
}

/**
 * Format a version comparison as markdown.
 */
export function formatComparisonMarkdown(comparison) {
  let md = `# Version Comparison\n\n`;

  // Summary
  md += `## Summary\n\n`;
  md += `| Metric | Version A | Version B | Delta |\n`;
  md += `|--------|-----------|-----------|-------|\n`;
  md += `| Scenes | ${comparison.scene_count.a} | ${comparison.scene_count.b} | ${comparison.scene_count.b - comparison.scene_count.a >= 0 ? '+' : ''}${comparison.scene_count.b - comparison.scene_count.a} |\n`;
  md += `| Duration | ${comparison.duration_change.total_a_s.toFixed(1)}s | ${comparison.duration_change.total_b_s.toFixed(1)}s | ${comparison.duration_change.delta_s >= 0 ? '+' : ''}${comparison.duration_change.delta_s.toFixed(1)}s |\n`;
  md += `| Timing shift | | | ${comparison.timing_delta_ms >= 0 ? '+' : ''}${comparison.timing_delta_ms}ms |\n`;
  md += `| Reordered | | | ${comparison.scenes_reordered ? 'Yes' : 'No'} |\n`;
  md += '\n';

  // Scene changes
  if (comparison.scenes_added.length > 0 || comparison.scenes_removed.length > 0) {
    md += `## Scene Changes\n\n`;
    if (comparison.scenes_added.length > 0) {
      md += `**Added:** ${comparison.scenes_added.join(', ')}\n\n`;
    }
    if (comparison.scenes_removed.length > 0) {
      md += `**Removed:** ${comparison.scenes_removed.join(', ')}\n\n`;
    }
  }

  // Duration changes
  if (comparison.duration_changes.length > 0) {
    md += `## Duration Changes\n\n`;
    md += `| Scene | From | To | Delta |\n`;
    md += `|-------|------|----|-------|\n`;
    for (const d of comparison.duration_changes) {
      md += `| ${d.scene_id} | ${d.from_s.toFixed(1)}s | ${d.to_s.toFixed(1)}s | ${d.delta_s >= 0 ? '+' : ''}${d.delta_s.toFixed(1)}s |\n`;
    }
    md += '\n';
  }

  // Transition changes
  if (comparison.transition_changes.length > 0) {
    md += `## Transition Changes\n\n`;
    md += `| Scene | Change | Details |\n`;
    md += `|-------|--------|--------|\n`;
    for (const t of comparison.transition_changes) {
      if (t.change === 'added') {
        md += `| ${t.scene_id} | Added | ${t.to.type} (${t.to.duration_ms}ms) |\n`;
      } else if (t.change === 'removed') {
        md += `| ${t.scene_id} | Removed | was ${t.from.type} (${t.from.duration_ms}ms) |\n`;
      } else {
        md += `| ${t.scene_id} | Modified | ${t.from.type} (${t.from.duration_ms}ms) -> ${t.to.type} (${t.to.duration_ms}ms) |\n`;
      }
    }
    md += '\n';
  }

  // Camera changes
  if (comparison.camera_changes.length > 0) {
    md += `## Camera Changes\n\n`;
    md += `| Scene | From | To |\n`;
    md += `|-------|------|----|\n`;
    for (const c of comparison.camera_changes) {
      md += `| ${c.scene_id} | ${c.from || '(none)'} | ${c.to || '(none)'} |\n`;
    }
    md += '\n';
  }

  return md;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function extractSceneOrder(manifest) {
  if (manifest.scene_order) return manifest.scene_order;
  if (manifest.scenes) return manifest.scenes.map(s => s.scene_id || s.id);
  return [];
}

function extractDurations(manifest) {
  const durations = {};
  if (manifest.scenes) {
    for (const s of manifest.scenes) {
      const id = s.scene_id || s.id;
      durations[id] = s.duration_s || s.duration || 0;
    }
  }
  if (manifest.sceneDefs) {
    for (const [id, s] of Object.entries(manifest.sceneDefs)) {
      durations[id] = s.duration_s || s.duration || 0;
    }
  }
  return durations;
}

function extractTransitions(manifest) {
  const trans = {};

  // From transitions array
  if (manifest.transitions) {
    for (const t of manifest.transitions) {
      const key = t.after || (t.between ? t.between[0] : null);
      if (key) {
        trans[key] = { type: t.type || t.style || 'hard_cut', duration_ms: t.duration_ms ?? 0 };
      }
    }
  }

  // From inline scene transitions
  if (manifest.scenes) {
    for (const s of manifest.scenes) {
      const id = s.scene_id || s.id;
      const inlineTrans = s.transition_in || s.transition;
      if (inlineTrans && !trans[id]) {
        const t = inlineTrans;
        trans[id] = { type: t.type || t.style || 'hard_cut', duration_ms: t.duration_ms ?? 0 };
      }
    }
  }

  return trans;
}

function extractCameraMoves(manifest) {
  const cams = {};
  if (manifest.scenes) {
    for (const s of manifest.scenes) {
      const id = s.scene_id || s.id;
      const move = s.camera?.move || s.camera_move || s.camera_override?.move;
      if (move) cams[id] = move;
    }
  }
  if (manifest.sceneDefs) {
    for (const [id, s] of Object.entries(manifest.sceneDefs)) {
      const move = s.camera?.move || s.camera_move;
      if (move) cams[id] = move;
    }
  }
  return cams;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sum(arr) {
  return arr.reduce((acc, v) => acc + (v || 0), 0);
}

function formatTimecode(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}
