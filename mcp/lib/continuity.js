/**
 * Cross-scene continuity system.
 *
 * Enables persistent element identity across scenes so shots can transform
 * into each other — a prompt chip becomes a search bar, a card expands into
 * a detail panel, etc.
 */

export const VALID_STRATEGIES = ['position', 'scale', 'mask_expand', 'content_morph', 'card_to_panel'];

/**
 * Suggest a transition strategy based on layer type transitions.
 */
function suggestStrategy(fromLayer, toLayer) {
  const from = fromLayer.type;
  const to = toLayer.type;

  // Same text content changing → content morph
  if (from === 'text' && to === 'text') return 'content_morph';

  // HTML to HTML with different sizes → card_to_panel
  if (from === 'html' && to === 'html') return 'card_to_panel';

  // Image to image → scale (zoom transition)
  if (from === 'image' && to === 'image') return 'scale';

  // SVG to SVG → position
  if (from === 'svg' && to === 'svg') return 'position';

  // Card compound → html detail → card_to_panel
  if (from === 'card_conveyor' || from === 'stacked_cards' || to === 'card_conveyor' || to === 'stacked_cards') {
    return 'card_to_panel';
  }

  // Anything else with a size change → scale, otherwise position
  return 'scale';
}

/**
 * Compute a simple similarity score (0–1) between two layers based on
 * type, position, and content overlap. Used by suggestMatchCuts to rank
 * candidate pairings that lack explicit continuity_ids.
 */
function layerSimilarity(a, b) {
  let score = 0;

  // Same type is the strongest signal
  if (a.type === b.type) score += 0.4;

  // Same depth class
  if (a.depth_class && b.depth_class && a.depth_class === b.depth_class) score += 0.15;

  // Same slot
  if (a.slot && b.slot && a.slot === b.slot) score += 0.2;

  // Shared asset reference
  if (a.asset && b.asset && a.asset === b.asset) score += 0.25;

  // Text content overlap (Jaccard on words)
  if (a.content && b.content) {
    const wordsA = new Set(a.content.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.content.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    if (union > 0) score += 0.25 * (intersection / union);
  }

  return Math.min(score, 1);
}

/**
 * Resolve explicit continuity links across adjacent scenes.
 *
 * Scans manifest scenes and their definitions to find layers with matching
 * continuity_ids across adjacent scenes.
 *
 * @param {object} manifest - Sequence manifest with scenes array
 * @param {object[]} sceneDefs - Array of scene definitions (order matches manifest.scenes)
 * @returns {{ from_scene: string, to_scene: string, continuity_id: string, from_layer: object, to_layer: object, suggested_strategy: string }[]}
 */
export function resolveContinuityLinks(manifest, sceneDefs) {
  const links = [];

  if (!manifest?.scenes || !Array.isArray(sceneDefs)) return links;

  for (let i = 0; i < manifest.scenes.length - 1; i++) {
    const fromDef = sceneDefs[i];
    const toDef = sceneDefs[i + 1];
    if (!fromDef?.layers || !toDef?.layers) continue;

    // Build a map of continuity_id → layer for the source scene
    const fromMap = new Map();
    for (const layer of fromDef.layers) {
      if (layer.continuity_id) {
        fromMap.set(layer.continuity_id, layer);
      }
    }

    // Find matching continuity_ids in the target scene
    for (const layer of toDef.layers) {
      if (layer.continuity_id && fromMap.has(layer.continuity_id)) {
        const fromLayer = fromMap.get(layer.continuity_id);
        links.push({
          from_scene: manifest.scenes[i].scene,
          to_scene: manifest.scenes[i + 1].scene,
          continuity_id: layer.continuity_id,
          from_layer: fromLayer,
          to_layer: layer,
          suggested_strategy: suggestStrategy(fromLayer, layer),
        });
      }
    }
  }

  return links;
}

/**
 * Suggest potential match-cut opportunities between adjacent scenes
 * even without explicit continuity_ids.
 *
 * Looks for: same layer types at similar positions, similar content,
 * shared assets. Returns ranked suggestions.
 *
 * @param {object} manifest
 * @param {object[]} sceneDefs
 * @returns {{ from_scene: string, to_scene: string, from_layer: object, to_layer: object, similarity: number, suggested_continuity_id: string, suggested_strategy: string }[]}
 */
export function suggestMatchCuts(manifest, sceneDefs) {
  const suggestions = [];

  if (!manifest?.scenes || !Array.isArray(sceneDefs)) return suggestions;

  for (let i = 0; i < manifest.scenes.length - 1; i++) {
    const fromDef = sceneDefs[i];
    const toDef = sceneDefs[i + 1];
    if (!fromDef?.layers || !toDef?.layers) continue;

    // Skip layers that already have continuity_ids
    const fromLayers = fromDef.layers.filter(l => !l.continuity_id);
    const toLayers = toDef.layers.filter(l => !l.continuity_id);

    for (const fromLayer of fromLayers) {
      for (const toLayer of toLayers) {
        const similarity = layerSimilarity(fromLayer, toLayer);
        if (similarity >= 0.4) {
          // Generate a suggested id from the layer ids
          const baseName = (fromLayer.id || toLayer.id || 'element').replace(/^ly_/, '');
          suggestions.push({
            from_scene: manifest.scenes[i].scene,
            to_scene: manifest.scenes[i + 1].scene,
            from_layer: fromLayer,
            to_layer: toLayer,
            similarity,
            suggested_continuity_id: baseName,
            suggested_strategy: suggestStrategy(fromLayer, toLayer),
          });
        }
      }
    }
  }

  // Sort by similarity descending
  suggestions.sort((a, b) => b.similarity - a.similarity);
  return suggestions;
}

/**
 * Automatically annotate layers with continuity_ids and add
 * transition_in.match configs to the manifest.
 *
 * Returns a deep-cloned annotated manifest and scene defs — does not
 * mutate the originals.
 *
 * @param {object} manifest
 * @param {object[]} sceneDefs
 * @param {{ auto_assign_ids?: boolean, preferred_strategies?: string[] }} options
 * @returns {{ manifest: object, scenes: object[] }}
 */
export function planContinuityLinks(manifest, sceneDefs, options = {}) {
  const { auto_assign_ids = true, preferred_strategies = [] } = options;

  // Deep clone to avoid mutation
  const clonedManifest = JSON.parse(JSON.stringify(manifest));
  const clonedScenes = JSON.parse(JSON.stringify(sceneDefs));

  if (!clonedManifest?.scenes || !Array.isArray(clonedScenes)) {
    return { manifest: clonedManifest, scenes: clonedScenes };
  }

  // Step 1: Auto-assign continuity_ids to layers that match across scenes
  if (auto_assign_ids) {
    for (let i = 0; i < clonedManifest.scenes.length - 1; i++) {
      const fromDef = clonedScenes[i];
      const toDef = clonedScenes[i + 1];
      if (!fromDef?.layers || !toDef?.layers) continue;

      const fromUntagged = fromDef.layers.filter(l => !l.continuity_id);
      const toUntagged = toDef.layers.filter(l => !l.continuity_id);

      // Match untagged layers by similarity
      const used = new Set();
      for (const fromLayer of fromUntagged) {
        let bestMatch = null;
        let bestSim = 0;
        for (const toLayer of toUntagged) {
          if (used.has(toLayer.id)) continue;
          const sim = layerSimilarity(fromLayer, toLayer);
          if (sim > bestSim && sim >= 0.4) {
            bestSim = sim;
            bestMatch = toLayer;
          }
        }
        if (bestMatch) {
          const cid = (fromLayer.id || 'elem').replace(/^ly_/, '');
          fromLayer.continuity_id = cid;
          bestMatch.continuity_id = cid;
          used.add(bestMatch.id);
        }
      }
    }
  }

  // Step 2: Resolve links from the (now annotated) scenes and add match configs
  const links = resolveContinuityLinks(clonedManifest, clonedScenes);

  for (const link of links) {
    // Find the manifest scene entry for the target
    const targetIdx = clonedManifest.scenes.findIndex(s => s.scene === link.to_scene);
    if (targetIdx < 0) continue;

    const sceneEntry = clonedManifest.scenes[targetIdx];
    if (!sceneEntry.transition_in) {
      sceneEntry.transition_in = { type: 'crossfade', duration_ms: 400 };
    }

    // Don't overwrite existing match configs
    if (sceneEntry.transition_in.match) continue;

    let strategy = link.suggested_strategy;
    if (preferred_strategies.length > 0 && preferred_strategies.includes(strategy)) {
      // Keep it
    } else if (preferred_strategies.length > 0) {
      strategy = preferred_strategies[0];
    }

    sceneEntry.transition_in.match = {
      source_continuity_id: link.continuity_id,
      strategy,
    };
  }

  return { manifest: clonedManifest, scenes: clonedScenes };
}

/**
 * Validate that all continuity_id references resolve correctly and
 * strategies are compatible with layer type transitions.
 *
 * @param {object} manifest
 * @param {object[]} sceneDefs
 * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
 */
export function validateContinuityChain(manifest, sceneDefs) {
  const errors = [];
  const warnings = [];

  if (!manifest?.scenes || !Array.isArray(sceneDefs)) {
    return { valid: true, warnings, errors };
  }

  for (let i = 0; i < manifest.scenes.length; i++) {
    const sceneEntry = manifest.scenes[i];
    const prefix = `scenes[${i}]`;

    if (!sceneEntry.transition_in?.match) continue;

    const match = sceneEntry.transition_in.match;
    const sourceCid = match.source_continuity_id;
    const targetCid = match.target_continuity_id || sourceCid;

    // Must not be first scene (no previous scene to match from)
    if (i === 0) {
      errors.push(`${prefix}.transition_in.match: cannot match on first scene (no previous scene)`);
      continue;
    }

    const prevDef = sceneDefs[i - 1];
    const currDef = sceneDefs[i];

    // Find source layer in previous scene
    const sourceLayer = prevDef?.layers?.find(l => l.continuity_id === sourceCid);
    if (!sourceLayer) {
      errors.push(`${prefix}.transition_in.match.source_continuity_id "${sourceCid}" not found in previous scene`);
    }

    // Find target layer in current scene
    const targetLayer = currDef?.layers?.find(l => l.continuity_id === targetCid);
    if (!targetLayer) {
      errors.push(`${prefix}.transition_in.match.target_continuity_id "${targetCid}" not found in current scene`);
    }

    // Validate strategy compatibility
    if (sourceLayer && targetLayer && match.strategy) {
      if (match.strategy === 'content_morph') {
        if (sourceLayer.type !== 'text' || targetLayer.type !== 'text') {
          warnings.push(`${prefix}: content_morph strategy works best with text→text layers (got ${sourceLayer.type}→${targetLayer.type})`);
        }
      }
      if (match.strategy === 'card_to_panel') {
        const cardTypes = ['html', 'card_conveyor', 'stacked_cards'];
        if (!cardTypes.includes(sourceLayer.type) && !cardTypes.includes(targetLayer.type)) {
          warnings.push(`${prefix}: card_to_panel strategy expects html/card layer types (got ${sourceLayer.type}→${targetLayer.type})`);
        }
      }
    }
  }

  return { valid: errors.length === 0, warnings, errors };
}
