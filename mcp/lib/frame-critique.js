/**
 * Frame Strip Critique — Render-Aware Scoring
 *
 * Evaluates visual quality from contact sheet data, scene metadata,
 * and rendered frame strip descriptions. Scores properties that
 * manifest-only analysis can't assess: contrast, readability,
 * visual hierarchy, and brand consistency.
 *
 * Operates on contact sheet + annotated scenes — does not require
 * actual pixel data (though could be extended to accept it).
 */

// ── Score dimensions ────────────────────────────────────────────────────────

export const FRAME_DIMENSIONS = [
  'contrast',         // Visual contrast between scenes
  'readability',      // Text legibility and hierarchy
  'visual_hierarchy', // Hero prominence, depth ordering
  'brand_consistency', // Color, typography, treatment consistency
  'pacing_rhythm',    // Visual rhythm across the strip
];

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Score a frame strip (contact sheet + annotated scenes) for visual quality.
 *
 * @param {object} params
 * @param {object} params.contactSheet - Output of generateContactSheet { sheets, total_duration_s }
 * @param {object[]} params.scenes - Annotated scene definitions
 * @param {object} [params.brand] - Brand package for consistency checking
 * @param {object} [params.manifest] - Sequence manifest for transition analysis
 * @returns {{ overall, dimensions, findings, per_scene }}
 */
export function scoreFrameStrip({ contactSheet, scenes, brand, manifest } = {}) {
  if (!contactSheet?.sheets || !scenes?.length) {
    return {
      overall: 0,
      dimensions: Object.fromEntries(FRAME_DIMENSIONS.map(d => [d, { score: 0, findings: [] }])),
      findings: ['No contact sheet or scenes provided'],
      per_scene: [],
    };
  }

  const sheets = contactSheet.sheets;
  const sceneMap = new Map();
  for (const s of scenes) sceneMap.set(s.scene_id, s);

  // Score each dimension
  const contrast = scoreContrast(sheets, sceneMap);
  const readability = scoreReadability(sheets, sceneMap, brand);
  const hierarchy = scoreVisualHierarchy(sheets, sceneMap);
  const brandConsistency = scoreBrandConsistency(sheets, sceneMap, brand);
  const pacingRhythm = scorePacingRhythm(sheets, sceneMap, manifest);

  const dimensions = {
    contrast,
    readability,
    visual_hierarchy: hierarchy,
    brand_consistency: brandConsistency,
    pacing_rhythm: pacingRhythm,
  };

  // Weighted overall
  const weights = { contrast: 0.2, readability: 0.25, visual_hierarchy: 0.2, brand_consistency: 0.2, pacing_rhythm: 0.15 };
  let overall = 0;
  for (const [dim, w] of Object.entries(weights)) {
    overall += (dimensions[dim]?.score ?? 0) * w;
  }
  overall = Math.round(overall * 1000) / 1000;

  // Aggregate findings
  const findings = [];
  for (const [dim, data] of Object.entries(dimensions)) {
    for (const f of data.findings) {
      findings.push({ dimension: dim, ...f });
    }
  }

  // Per-scene visual scores
  const per_scene = sheets.map(sheet => {
    const sceneDef = sceneMap.get(sheet.scene_id);
    return {
      scene_id: sheet.scene_id,
      contrast: scoreSceneContrast(sceneDef),
      readability: scoreSceneReadability(sceneDef, brand),
      hierarchy: scoreSceneHierarchy(sceneDef),
      brand_match: scoreSceneBrandMatch(sceneDef, brand),
    };
  });

  return { overall, dimensions, findings, per_scene };
}

// ── Contrast ────────────────────────────────────────────────────────────────

function scoreContrast(sheets, sceneMap) {
  let score = 0.5;
  const findings = [];

  // Check energy variety across strip
  const energies = sheets.map(s => s.energy).filter(Boolean);
  const uniqueEnergies = new Set(energies);

  if (uniqueEnergies.size >= 3) score += 0.3;
  else if (uniqueEnergies.size >= 2) score += 0.15;
  else {
    findings.push({ severity: 'warning', message: 'All scenes have similar energy — strip lacks visual contrast' });
  }

  // Check for energy transitions (high→low or low→high adjacency)
  let transitions = 0;
  for (let i = 1; i < energies.length; i++) {
    if (energies[i] !== energies[i - 1]) transitions++;
  }
  if (transitions >= energies.length * 0.5) score += 0.2;
  else if (transitions >= 2) score += 0.1;
  else {
    findings.push({ severity: 'info', message: 'Few energy transitions — consider alternating high/low scenes' });
  }

  // Check camera variety
  const cameras = sheets.map(s => s.camera_move).filter(Boolean);
  const uniqueCameras = new Set(cameras);
  if (uniqueCameras.size >= 3) score += 0.1;

  return { score: clamp(score), findings };
}

function scoreSceneContrast(sceneDef) {
  if (!sceneDef?.layers) return 0.5;
  const hasMultipleDepths = new Set(sceneDef.layers.map(l => l.depth_class).filter(Boolean)).size >= 2;
  return hasMultipleDepths ? 0.7 : 0.4;
}

// ── Readability ─────────────────────────────────────────────────────────────

function scoreReadability(sheets, sceneMap, brand) {
  let score = 0.5;
  const findings = [];

  let textScenes = 0;
  let textWithHierarchy = 0;

  for (const sheet of sheets) {
    const sceneDef = sceneMap.get(sheet.scene_id);
    if (!sceneDef?.layers) continue;

    const textLayers = sceneDef.layers.filter(l =>
      l.type === 'text' || (l.type === 'html' && l.content_class === 'typography'));

    if (textLayers.length > 0) {
      textScenes++;
      // Check for text hierarchy (different clarity weights)
      const weights = textLayers.map(l => l.clarity_weight || 3);
      if (new Set(weights).size > 1 || textLayers.some(l => l.block_role)) {
        textWithHierarchy++;
      }
    }

    // Camera + text collision
    if (textLayers.length > 0 && sheet.camera_move && sheet.camera_move !== 'static') {
      if (sheet.camera_move === 'push_in' || sheet.camera_move === 'pull_out') {
        findings.push({ severity: 'info', message: `${sheet.scene_id}: camera ${sheet.camera_move} with text — may reduce readability` });
      }
    }
  }

  if (textScenes > 0) {
    const hierarchyRatio = textWithHierarchy / textScenes;
    score += hierarchyRatio * 0.3;
  }

  // Brand typography consistency
  if (brand?.typography?.font_family) {
    score += 0.1; // Credit for having brand typography defined
  }

  // Duration check — text scenes need minimum time
  for (const sheet of sheets) {
    const sceneDef = sceneMap.get(sheet.scene_id);
    const hasText = sceneDef?.layers?.some(l => l.type === 'text' || l.content_class === 'typography');
    if (hasText && sheet.duration_s < 2) {
      findings.push({ severity: 'warning', message: `${sheet.scene_id}: text scene at ${sheet.duration_s}s may not be readable` });
      score -= 0.1;
    }
  }

  return { score: clamp(score), findings };
}

function scoreSceneReadability(sceneDef, brand) {
  if (!sceneDef?.layers) return 0.5;
  const textLayers = sceneDef.layers.filter(l => l.type === 'text' || l.content_class === 'typography');
  if (textLayers.length === 0) return 0.7; // No text = no readability concern
  const hasBlock = textLayers.some(l => l.block_role);
  return hasBlock ? 0.8 : 0.5;
}

// ── Visual Hierarchy ────────────────────────────────────────────────────────

function scoreVisualHierarchy(sheets, sceneMap) {
  let score = 0.5;
  const findings = [];

  let heroScenes = 0;
  let heroWithMotion = 0;

  for (const sheet of sheets) {
    const sceneDef = sceneMap.get(sheet.scene_id);
    if (!sceneDef?.layers) continue;

    const heroLayer = sceneDef.layers.find(l => l.product_role === 'hero');
    if (heroLayer) {
      heroScenes++;
      // Check if hero has motion targeting
      const groups = sceneDef.motion?.groups || [];
      if (groups.some(g => g.targets?.includes(heroLayer.id))) {
        heroWithMotion++;
      }
    } else {
      findings.push({ severity: 'warning', message: `${sheet.scene_id}: no hero layer — viewer may not know where to look` });
    }

    // Clarity weight distribution
    const weights = sceneDef.layers.map(l => l.clarity_weight || 0);
    const maxWeight = Math.max(...weights);
    const heroWeight = heroLayer?.clarity_weight || 0;
    if (heroLayer && heroWeight < maxWeight) {
      findings.push({ severity: 'info', message: `${sheet.scene_id}: hero layer "${heroLayer.id}" doesn't have highest clarity_weight` });
    }
  }

  if (sheets.length > 0) {
    score += (heroScenes / sheets.length) * 0.3;
    if (heroScenes > 0) score += (heroWithMotion / heroScenes) * 0.2;
  }

  return { score: clamp(score), findings };
}

function scoreSceneHierarchy(sceneDef) {
  if (!sceneDef?.layers) return 0.5;
  const hero = sceneDef.layers.find(l => l.product_role === 'hero');
  if (!hero) return 0.3;
  const groups = sceneDef.motion?.groups || [];
  return groups.some(g => g.targets?.includes(hero.id)) ? 0.9 : 0.6;
}

// ── Brand Consistency ───────────────────────────────────────────────────────

function scoreBrandConsistency(sheets, sceneMap, brand) {
  let score = 0.5;
  const findings = [];

  if (!brand) {
    findings.push({ severity: 'info', message: 'No brand package — skipping consistency check' });
    return { score: 0.7, findings }; // Neutral without brand
  }

  // Check personality alignment
  let personalityMatches = 0;
  for (const sheet of sheets) {
    const sceneDef = sceneMap.get(sheet.scene_id);
    if (sceneDef?.brand === brand.brand_id) personalityMatches++;
  }
  if (sheets.length > 0) {
    score += (personalityMatches / sheets.length) * 0.2;
  }

  // Check for logo/CTA scene
  const hasCta = sheets.some(s => {
    const def = sceneMap.get(s.scene_id);
    return def?.product_role === 'cta';
  });
  if (hasCta) score += 0.1;
  else findings.push({ severity: 'warning', message: 'No CTA/logo scene — brand resolve may be missing' });

  // Check intro/outro patterns
  const first = sceneMap.get(sheets[0]?.scene_id);
  const last = sceneMap.get(sheets[sheets.length - 1]?.scene_id);
  if (first?.product_role === 'atmosphere') score += 0.1;
  if (last?.product_role === 'cta' || last?.product_role === 'atmosphere') score += 0.1;

  // Motion intensity vs brand max
  if (brand.motion?.max_intensity) {
    let overIntensity = false;
    for (const sheet of sheets) {
      const sceneDef = sceneMap.get(sheet.scene_id);
      const intensity = sceneDef?.camera?.intensity || 0;
      if (intensity > brand.motion.max_intensity) {
        overIntensity = true;
        findings.push({ severity: 'warning', message: `${sheet.scene_id}: camera intensity ${intensity} exceeds brand max ${brand.motion.max_intensity}` });
      }
    }
    if (!overIntensity) score += 0.1;
  }

  return { score: clamp(score), findings };
}

function scoreSceneBrandMatch(sceneDef, brand) {
  if (!brand) return 0.7;
  return sceneDef?.brand === brand.brand_id ? 0.9 : 0.5;
}

// ── Pacing Rhythm ───────────────────────────────────────────────────────────

function scorePacingRhythm(sheets, sceneMap, manifest) {
  let score = 0.5;
  const findings = [];

  if (sheets.length < 2) return { score: 0.5, findings };

  // Duration variety
  const durations = sheets.map(s => s.duration_s);
  const uniqueDurations = new Set(durations.map(d => Math.round(d * 2) / 2)); // Round to 0.5s
  if (uniqueDurations.size >= 3) score += 0.2;
  else if (uniqueDurations.size >= 2) score += 0.1;
  else findings.push({ severity: 'warning', message: 'All scenes have identical duration — rhythm feels mechanical' });

  // Transition variety
  const transitions = sheets.map(s => s.transition_in).filter(t => t && t !== 'hard_cut');
  const uniqueTransitions = new Set(transitions);
  if (uniqueTransitions.size >= 2) score += 0.15;
  else if (transitions.length > 0) score += 0.05;

  // Opening/closing pacing
  const openDuration = sheets[0]?.duration_s || 0;
  const closeDuration = sheets[sheets.length - 1]?.duration_s || 0;
  if (openDuration >= 2 && openDuration <= 5) score += 0.05;
  if (closeDuration >= 2 && closeDuration <= 4) score += 0.05;

  // Avoid front-loading all long scenes or all short scenes
  const firstHalf = durations.slice(0, Math.ceil(durations.length / 2));
  const secondHalf = durations.slice(Math.ceil(durations.length / 2));
  const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const balance = 1 - Math.abs(firstMean - secondMean) / Math.max(firstMean, secondMean, 1);
  score += balance * 0.1;

  return { score: clamp(score), findings };
}

// ── Utility ─────────────────────────────────────────────────────────────────

function clamp(n) {
  return Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));
}
