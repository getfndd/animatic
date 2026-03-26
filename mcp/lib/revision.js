/**
 * Bounded Manifest Revision
 *
 * Applies a constrained set of revision operations to a sequence manifest
 * and scene definitions. Each operation is a pure transform — no generation,
 * no side effects. Returns the revised manifest, scenes, and a diff log.
 *
 * Operations:
 *   trim            — reduce scene duration (min 1s)
 *   extend_hold     — increase scene duration
 *   swap_transition — replace transition_in
 *   reorder         — move scene to new index
 *   boost_hierarchy — promote a layer to hero depth_class
 *   compress        — set target duration for scene
 *   add_continuity  — insert continuity_id + match config
 *   adjust_density  — mark scene for density adjustment
 */

export const REVISION_OPS = [
  'trim', 'extend_hold', 'swap_transition', 'reorder',
  'boost_hierarchy', 'compress', 'add_continuity', 'adjust_density',
  'needs_annotation',
];

const VALID_TRANSITIONS = [
  'hard_cut', 'crossfade', 'whip_left', 'whip_right', 'whip_up', 'whip_down',
  'zoom_crossfade', 'parallax_crossfade', 'light_wipe', 'focus_dissolve', 'match_cut_scale',
];

const MIN_DURATION_S = 1;
const MAX_DURATION_S = 30;

/**
 * Apply bounded revisions to a manifest and scene definitions.
 *
 * @param {object} params
 * @param {object} params.manifest - Sequence manifest (deep-cloned internally)
 * @param {object[]} params.scenes - Scene definitions (deep-cloned internally)
 * @param {object[]} params.revisions - Array of { op, ...params }
 * @returns {{ manifest, scenes, diff, revision_count }}
 */
export function reviseCandidateVideo({ manifest, scenes, revisions }) {
  if (!manifest?.scenes) {
    throw new Error('reviseCandidateVideo requires a manifest with scenes');
  }
  if (!revisions || !Array.isArray(revisions) || revisions.length === 0) {
    throw new Error('reviseCandidateVideo requires a non-empty revisions array');
  }

  // Deep clone to avoid mutation
  let m = JSON.parse(JSON.stringify(manifest));
  let s = JSON.parse(JSON.stringify(scenes || []));
  const diff = [];

  for (const rev of revisions) {
    if (!rev.op || !REVISION_OPS.includes(rev.op)) {
      throw new Error(`Unknown revision op: ${rev.op}. Valid: ${REVISION_OPS.join(', ')}`);
    }

    const result = applyOp(m, s, rev);
    m = result.manifest;
    s = result.scenes;
    if (result.entry) diff.push(result.entry);
  }

  return {
    manifest: m,
    scenes: s,
    diff,
    revision_count: diff.length,
  };
}

// ── Operation dispatch ──────────────────────────────────────────────────────

function applyOp(manifest, scenes, rev) {
  switch (rev.op) {
    case 'trim': return applyTrim(manifest, scenes, rev);
    case 'extend_hold': return applyExtendHold(manifest, scenes, rev);
    case 'swap_transition': return applySwapTransition(manifest, scenes, rev);
    case 'reorder': return applyReorder(manifest, scenes, rev);
    case 'boost_hierarchy': return applyBoostHierarchy(manifest, scenes, rev);
    case 'compress': return applyCompress(manifest, scenes, rev);
    case 'add_continuity': return applyAddContinuity(manifest, scenes, rev);
    case 'adjust_density': return applyAdjustDensity(manifest, scenes, rev);
    case 'needs_annotation': return { manifest, scenes, entry: { op: 'needs_annotation', target: null, before: 'low_confidence', after: 'advisory', reason: rev.reason || 'Annotations need human review' } };
    default: return { manifest, scenes, entry: null };
  }
}

// ── trim ────────────────────────────────────────────────────────────────────

function applyTrim(manifest, scenes, rev) {
  const target = rev.target || rev.scene;
  const amount = rev.amount_s || 0.5;
  const entry = findEntry(manifest, target);
  if (!entry) return { manifest, scenes, entry: null };

  const before = entry.duration_s || 3;
  const after = Math.max(MIN_DURATION_S, before - amount);

  entry.duration_s = Math.round(after * 10) / 10;

  return {
    manifest, scenes,
    entry: { op: 'trim', target, before, after: entry.duration_s, reason: rev.reason || 'Trimmed duration' },
  };
}

// ── extend_hold ─────────────────────────────────────────────────────────────

function applyExtendHold(manifest, scenes, rev) {
  const target = rev.target || rev.scene;
  const amount = rev.amount_s || 0.5;
  const entry = findEntry(manifest, target);
  if (!entry) return { manifest, scenes, entry: null };

  const before = entry.duration_s || 3;
  const after = Math.min(MAX_DURATION_S, before + amount);

  entry.duration_s = Math.round(after * 10) / 10;

  return {
    manifest, scenes,
    entry: { op: 'extend_hold', target, before, after: entry.duration_s, reason: rev.reason || 'Extended hold' },
  };
}

// ── swap_transition ─────────────────────────────────────────────────────────

function applySwapTransition(manifest, scenes, rev) {
  const target = rev.target || rev.scene;
  const newTransition = rev.transition || { type: 'crossfade', duration_ms: 400 };
  const entry = findEntry(manifest, target);
  if (!entry) return { manifest, scenes, entry: null };

  // Validate transition type
  if (newTransition.type && !VALID_TRANSITIONS.includes(newTransition.type)) {
    return { manifest, scenes, entry: null };
  }

  const before = entry.transition_in ? `${entry.transition_in.type}` : 'none';
  entry.transition_in = newTransition;

  return {
    manifest, scenes,
    entry: { op: 'swap_transition', target, before, after: newTransition.type, reason: rev.reason || 'Swapped transition' },
  };
}

// ── reorder ─────────────────────────────────────────────────────────────────

function applyReorder(manifest, scenes, rev) {
  const target = rev.target || rev.scene;
  const newIndex = rev.new_index;
  if (typeof newIndex !== 'number') return { manifest, scenes, entry: null };

  const oldIndex = manifest.scenes.findIndex(s => (s.scene || s.scene_id) === target);
  if (oldIndex < 0) return { manifest, scenes, entry: null };

  const clampedIndex = Math.max(0, Math.min(manifest.scenes.length - 1, newIndex));
  if (clampedIndex === oldIndex) return { manifest, scenes, entry: null };

  // Splice and reinsert
  const [moved] = manifest.scenes.splice(oldIndex, 1);
  manifest.scenes.splice(clampedIndex, 0, moved);

  // First scene should not have transition_in
  if (manifest.scenes[0].transition_in) {
    manifest.scenes[0].transition_in = null;
  }
  // Second scene needs a transition if it doesn't have one
  if (manifest.scenes.length > 1 && !manifest.scenes[1].transition_in) {
    manifest.scenes[1].transition_in = { type: 'crossfade', duration_ms: 400 };
  }

  return {
    manifest, scenes,
    entry: { op: 'reorder', target, before: oldIndex, after: clampedIndex, reason: rev.reason || 'Reordered scene' },
  };
}

// ── boost_hierarchy ─────────────────────────────────────────────────────────

function applyBoostHierarchy(manifest, scenes, rev) {
  const target = rev.target || rev.scene;
  const layerId = rev.layer;
  const sceneDef = scenes.find(s => (s.scene_id || s.id) === target);
  if (!sceneDef?.layers) return { manifest, scenes, entry: null };

  const layer = layerId
    ? sceneDef.layers.find(l => l.id === layerId)
    : sceneDef.layers.find(l => l.product_role !== 'hero' && l.depth_class !== 'background');

  if (!layer) return { manifest, scenes, entry: null };

  const before = layer.product_role || layer.depth_class || 'default';

  // Set product_role (what the scorer reads) AND ensure foreground depth_class
  layer.product_role = 'hero';
  layer.clarity_weight = 5;
  if (layer.depth_class === 'background') layer.depth_class = 'foreground';

  // Also set primary_subject on the scene if not already set
  if (!sceneDef.primary_subject) sceneDef.primary_subject = layer.id;

  return {
    manifest, scenes,
    entry: { op: 'boost_hierarchy', target: `${target}/${layer.id}`, before, after: 'hero (product_role)', reason: rev.reason || 'Promoted to hero' },
  };
}

// ── compress ────────────────────────────────────────────────────────────────

function applyCompress(manifest, scenes, rev) {
  const target = rev.target || rev.scene;
  const targetS = rev.target_s || rev.duration_s;
  if (typeof targetS !== 'number') return { manifest, scenes, entry: null };

  const entry = findEntry(manifest, target);
  if (!entry) return { manifest, scenes, entry: null };

  const before = entry.duration_s || 3;
  const after = Math.max(MIN_DURATION_S, Math.min(MAX_DURATION_S, targetS));
  entry.duration_s = Math.round(after * 10) / 10;

  return {
    manifest, scenes,
    entry: { op: 'compress', target, before, after: entry.duration_s, reason: rev.reason || 'Compressed to target' },
  };
}

// ── add_continuity ──────────────────────────────────────────────────────────

function applyAddContinuity(manifest, scenes, rev) {
  const fromScene = rev.from_scene;
  const toScene = rev.to_scene;
  const strategy = rev.strategy || 'scale';

  if (!fromScene || !toScene) return { manifest, scenes, entry: null };

  const toEntry = findEntry(manifest, toScene);
  if (!toEntry) return { manifest, scenes, entry: null };

  // Generate a continuity_id from the scene names
  const cid = `${fromScene}_to_${toScene}`;

  // Add match config to transition_in
  if (!toEntry.transition_in) {
    toEntry.transition_in = { type: 'crossfade', duration_ms: 400 };
  }
  toEntry.transition_in.match = {
    source_continuity_id: cid,
    strategy,
  };

  // Tag the hero/foreground layer (not layers[0] which is often background)
  const fromDef = scenes.find(s => (s.scene_id || s.id) === fromScene);
  const toDef = scenes.find(s => (s.scene_id || s.id) === toScene);

  const pickHeroLayer = (sceneDef) => {
    if (!sceneDef?.layers?.length) return null;
    // Prefer primary_subject, then product_role hero, then first foreground
    if (sceneDef.primary_subject) return sceneDef.layers.find(l => l.id === sceneDef.primary_subject);
    return sceneDef.layers.find(l => l.product_role === 'hero')
      || sceneDef.layers.find(l => l.depth_class === 'foreground' || l.depth_class === 'midground')
      || sceneDef.layers.find(l => l.depth_class !== 'background')
      || null;
  };

  const fromLayer = pickHeroLayer(fromDef);
  const toLayer = pickHeroLayer(toDef);

  if (fromLayer && !fromLayer.continuity_id) {
    fromLayer.continuity_id = cid;
  }
  if (toLayer && !toLayer.continuity_id) {
    toLayer.continuity_id = cid;
  }

  return {
    manifest, scenes,
    entry: { op: 'add_continuity', target: `${fromScene}→${toScene}`, before: 'none', after: `${strategy} (${cid})`, reason: rev.reason || 'Added continuity link' },
  };
}

// ── adjust_density ──────────────────────────────────────────────────────────

function applyAdjustDensity(manifest, scenes, rev) {
  const target = rev.target || rev.scene;
  const targetDensity = rev.target_density || 'moderate';

  const sceneDef = scenes.find(s => (s.scene_id || s.id) === target);
  if (!sceneDef) return { manifest, scenes, entry: null };

  // Add density hint to scene metadata
  if (!sceneDef.metadata) sceneDef.metadata = {};
  const before = sceneDef.metadata.target_density || 'unset';
  sceneDef.metadata.target_density = targetDensity;

  // For sparse: remove entrance from background layers
  // For busy: ensure all layers have entrances
  if (targetDensity === 'sparse' && sceneDef.layers) {
    for (const layer of sceneDef.layers) {
      if (layer.depth_class === 'background' && layer.entrance) {
        layer.entrance = { type: 'none' };
      }
    }
  }

  return {
    manifest, scenes,
    entry: { op: 'adjust_density', target, before, after: targetDensity, reason: rev.reason || 'Adjusted motion density' },
  };
}

// ── Utilities ───────────────────────────────────────────────────────────────

function findEntry(manifest, sceneId) {
  if (!sceneId) return null;
  return manifest.scenes.find(s => (s.scene || s.scene_id) === sceneId) || null;
}
