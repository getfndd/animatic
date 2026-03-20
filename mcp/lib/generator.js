/**
 * Scene Generator — ANI-31
 *
 * Rule-based scene generation from creative briefs.
 * Bridges brief → scenes, completing the full automated pipeline.
 *
 * 8 stage functions + orchestrator. Pure functions, catalog data at
 * module level. Self-validates output via validateScene().
 *
 * Rule-based core with optional LLM enhancement (ANI-36).
 */

import { validateScene } from '../../src/remotion/lib.js';
import { loadBriefTemplates, loadStylePacks, loadPersonalitiesCatalog, loadRecipes, loadBrands } from '../data/loader.js';
import { isLLMAvailable, enhanceScenePlan, enrichSceneContent } from './llm.js';
import { expandRecipe, lookupRecipe } from './interaction-recipes.js';

// ── Load catalog data at module level ────────────────────────────────────────

const personalitiesCatalog = loadPersonalitiesCatalog();
const stylePacksCatalog = loadStylePacks(
  personalitiesCatalog.array.map(p => p.slug)
);
const briefTemplatesCatalog = loadBriefTemplates();
const recipesCatalog = loadRecipes();
const brandsCatalog = loadBrands();

// ── Constants & Maps ─────────────────────────────────────────────────────────

/**
 * Regex patterns to classify assets from filenames.
 * Tested against the basename (without extension).
 */
export const ASSET_FILENAME_PATTERNS = [
  { pattern: /^hero[-_]|[-_]hero$/i,       content_type: 'product_shot', role: 'hero' },
  { pattern: /^product[-_]|[-_]product/i,  content_type: 'product_shot', role: 'hero' },
  { pattern: /^team[-_]|[-_]team/i,        content_type: 'portrait',     role: 'supporting' },
  { pattern: /^portrait[-_]|[-_]portrait/i,content_type: 'portrait',     role: 'supporting' },
  { pattern: /^ui[-_]|[-_]ui[-_]|^screen/i,content_type: 'ui_screenshot',role: 'supporting' },
  { pattern: /^dash/i,                     content_type: 'ui_screenshot',role: 'supporting' },
  { pattern: /^logo[-_]|[-_]logo|^brand/i, content_type: 'brand_mark',   role: 'closing' },
  { pattern: /^bg[-_]|[-_]bg$|^background/i,content_type: 'moodboard',  role: 'background' },
  { pattern: /^photo[-_]|[-_]photo/i,      content_type: 'portrait',     role: 'supporting' },
  { pattern: /^chart[-_]|[-_]chart|^graph/i,content_type: 'data_visualization', role: 'supporting' },
  { pattern: /^icon[-_]|[-_]icon/i,        content_type: 'brand_mark',   role: 'supporting' },
  { pattern: /^music[-_]|[-_]music/i,     content_type: 'audio',        role: 'background' },
  { pattern: /^narration[-_]|[-_]narration/i, content_type: 'audio',    role: 'supporting' },
  { pattern: /^voiceover[-_]|[-_]voiceover/i, content_type: 'audio',    role: 'supporting' },
  { pattern: /^sfx[-_]|[-_]sfx/i,         content_type: 'audio',        role: 'supporting' },
];

/**
 * Map explicit hint strings to content types.
 */
export const HINT_TO_CONTENT_TYPE = {
  'product':           'product_shot',
  'product-shot':      'product_shot',
  'product_shot':      'product_shot',
  'hero':              'product_shot',
  'screenshot':        'ui_screenshot',
  'ui':                'ui_screenshot',
  'ui-screenshot':     'ui_screenshot',
  'ui_screenshot':     'ui_screenshot',
  'dashboard':         'ui_screenshot',
  'portrait':          'portrait',
  'face':              'portrait',
  'headshot':          'portrait',
  'team':              'portrait',
  'logo':              'brand_mark',
  'brand':             'brand_mark',
  'brand-mark':        'brand_mark',
  'brand_mark':        'brand_mark',
  'icon':              'brand_mark',
  'chart':             'data_visualization',
  'graph':             'data_visualization',
  'data':              'data_visualization',
  'data-visualization':'data_visualization',
  'data_visualization':'data_visualization',
  'background':        'moodboard',
  'bg':                'moodboard',
  'collage':           'collage',
  'grid':              'collage',
  'photo':             'portrait',
  'video':             'product_shot',
  'audio':             'audio',
  'music':             'audio',
  'narration':         'audio',
  'voiceover':         'audio',
  'sfx':               'audio',
  'sound':             'audio',
};

/**
 * Default layout template for each content type.
 */
export const CONTENT_TYPE_TO_LAYOUT = {
  typography:          'hero-center',
  product_shot:        'device-mockup',
  ui_screenshot:       'device-mockup',
  portrait:            'split-panel',
  brand_mark:          'hero-center',
  data_visualization:  'hero-center',
  moodboard:           'full-bleed',
  collage:             'masonry-grid',
  device_mockup:       'device-mockup',
  split_panel:         'split-panel',
  notification:        'hero-center',
};

/**
 * Map brief section labels to intent tags.
 */
export const LABEL_TO_INTENT = {
  'opening':       ['opening'],
  'hero':          ['opening', 'hero'],
  'hook':          ['opening', 'hero'],
  'title':         ['opening'],
  'intro':         ['opening'],
  'problem':       ['emotional'],
  'people':        ['emotional'],
  'vision':        ['hero'],
  'product':       ['hero'],
  'features':      ['detail'],
  'feature':       ['detail'],
  'step':          ['detail', 'informational'],
  'traction':      ['detail'],
  'proof':         ['detail'],
  'team':          ['detail'],
  'result':        ['hero'],
  'social proof':  ['emotional'],
  'visual':        ['detail'],
  'grid':          ['detail'],
  'cta':           ['closing'],
  'closing':       ['closing'],
  'ask':           ['closing'],
  'next steps':    ['closing'],
};

/**
 * Map tone mood to suggested style packs.
 */
export const MOOD_TO_STYLES = {
  'warm':          ['intimate', 'fade'],
  'authoritative': ['corporate', 'prestige'],
  'confident':     ['prestige', 'dramatic'],
  'contemplative': ['fade', 'intimate'],
  'clear':         ['minimal', 'corporate'],
  'energetic':     ['energy', 'kinetic'],
  'dramatic':      ['dramatic', 'intimate'],
  'playful':       ['kinetic', 'energy'],
};

/**
 * Map content types to v3 semantic component types.
 * null = no semantic mapping (stays v2).
 */
export const CONTENT_TYPE_TO_COMPONENT = {
  typography:          'prompt_card',
  brand_mark:          'icon_label_row',
  data_visualization:  'icon_label_row',
  collage:             'stacked_cards',
  ui_screenshot:       null,
  product_shot:        null,
  portrait:            null,
  moodboard:           null,
};

// ── File extension fallback map ──────────────────────────────────────────────

const EXTENSION_TO_CONTENT_TYPE = {
  svg:  'brand_mark',
  mp4:  'product_shot',
  webm: 'product_shot',
  mov:  'product_shot',
  mp3:  'audio',
  wav:  'audio',
  m4a:  'audio',
  aac:  'audio',
  ogg:  'audio',
};

// ── Stage 1: validateBrief ───────────────────────────────────────────────────

/**
 * Validate a brief JSON against required structure.
 *
 * @param {object} brief
 * @returns {{ valid: boolean, errors: string[] }}
 */

// ── Brand Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve brand tokens from brief.brand_id or brief.brand inline object.
 * Maps structured brand tokens to the flat colors/font format the scene
 * builders already use. Also produces a CSS custom properties string for
 * injection into background layers.
 *
 * @param {object} brief
 * @returns {{ colors: object, font: string|null, brand: object|null, cssVars: string }}
 */
export function resolveBrand(brief) {
  let brand = null;

  // Priority: inline brief.brand object > brief.brand_id lookup > default
  if (brief.brand && typeof brief.brand === 'object' && brief.brand.colors) {
    brand = brief.brand;
  } else if (brief.brand_id && brandsCatalog.byId.has(brief.brand_id)) {
    brand = brandsCatalog.byId.get(brief.brand_id);
  } else if (typeof brief.brand === 'string' && brandsCatalog.byId.has(brief.brand)) {
    brand = brandsCatalog.byId.get(brief.brand);
  }

  if (!brand) {
    brand = brandsCatalog.default;
  }

  if (!brand) {
    return {
      colors: brief.brand?.colors || {},
      font: brief.brand?.font || null,
      brand: null,
      cssVars: '',
    };
  }

  // Map structured brand tokens → flat colors object for scene builders
  const colors = {
    background: brand.colors.bg_primary,
    primary: brand.colors.bg_primary,
    text: brand.colors.text_primary,
    accent: brand.colors.accent,
    surface: brand.colors.bg_surface,
    elevated: brand.colors.bg_elevated,
    secondary: brand.colors.text_secondary,
    muted: brand.colors.text_muted,
    border: brand.colors.border,
    trend_up: brand.colors.trend_up,
    trend_down: brand.colors.trend_down,
    ...brand.colors,
  };

  const font = brand.typography?.font_family || null;

  // Build CSS custom properties string
  const vars = [];
  if (brand.colors) {
    for (const [key, value] of Object.entries(brand.colors)) {
      vars.push(`--brand-${key.replace(/_/g, '-')}: ${value}`);
    }
  }
  if (brand.typography) {
    vars.push(`--brand-font: ${brand.typography.font_family}`);
    if (brand.typography.font_mono) {
      vars.push(`--brand-font-mono: ${brand.typography.font_mono}`);
    }
    for (const [scale, props] of Object.entries(brand.typography)) {
      if (typeof props === 'object' && props.size) {
        vars.push(`--brand-${scale}-size: ${props.size}`);
        vars.push(`--brand-${scale}-weight: ${props.weight || '400'}`);
        vars.push(`--brand-${scale}-lh: ${props.line_height || '1.4'}`);
        if (props.letter_spacing) {
          vars.push(`--brand-${scale}-ls: ${props.letter_spacing}`);
        }
      }
    }
  }
  if (brand.surfaces) {
    for (const [name, surface] of Object.entries(brand.surfaces)) {
      if (surface.background) vars.push(`--brand-${name}-bg: ${surface.background}`);
      if (surface.border) vars.push(`--brand-${name}-border: ${surface.border}`);
      if (surface.border_radius) vars.push(`--brand-${name}-radius: ${surface.border_radius}`);
      if (surface.shadow) vars.push(`--brand-${name}-shadow: ${surface.shadow}`);
      if (surface.padding) vars.push(`--brand-${name}-padding: ${surface.padding}`);
    }
  }

  const cssVars = vars.length > 0 ? `:root { ${vars.join('; ')} }` : '';

  return { colors, font, brand, cssVars };
}

export function validateBrief(brief) {
  const errors = [];

  if (!brief || typeof brief !== 'object') {
    return { valid: false, errors: ['Brief must be a non-null object'] };
  }

  // project
  if (!brief.project) {
    errors.push('project is required');
  } else {
    if (!brief.project.title || typeof brief.project.title !== 'string') {
      errors.push('project.title is required and must be a string');
    }
  }

  // template
  if (brief.template) {
    const validTemplates = briefTemplatesCatalog.array.map(t => t.template_id);
    if (!validTemplates.includes(brief.template) && brief.template !== 'custom') {
      errors.push(`template "${brief.template}" is not valid. Valid: ${validTemplates.join(', ')}, custom`);
    }
  }

  // content
  if (!brief.content) {
    errors.push('content is required');
  } else {
    if (!brief.content.sections || !Array.isArray(brief.content.sections) || brief.content.sections.length === 0) {
      errors.push('content.sections is required and must be a non-empty array');
    } else {
      for (let i = 0; i < brief.content.sections.length; i++) {
        const s = brief.content.sections[i];
        if (!s.label || typeof s.label !== 'string') {
          errors.push(`content.sections[${i}].label is required and must be a string`);
        }
      }
    }
  }

  // assets — unique IDs, valid structure
  if (brief.assets && Array.isArray(brief.assets)) {
    const ids = new Set();
    for (let i = 0; i < brief.assets.length; i++) {
      const a = brief.assets[i];
      if (!a.id || typeof a.id !== 'string') {
        errors.push(`assets[${i}].id is required and must be a string`);
      } else if (ids.has(a.id)) {
        errors.push(`assets[${i}].id "${a.id}" is a duplicate`);
      } else {
        ids.add(a.id);
      }
      if (!a.src || typeof a.src !== 'string') {
        errors.push(`assets[${i}].src is required and must be a string`);
      }
    }

    // Referential integrity: section asset refs must point to valid asset IDs
    if (brief.content?.sections) {
      for (let i = 0; i < brief.content.sections.length; i++) {
        const sectionAssets = brief.content.sections[i].assets || [];
        for (const ref of sectionAssets) {
          if (!ids.has(ref)) {
            errors.push(`content.sections[${i}].assets references unknown asset "${ref}"`);
          }
        }
      }
    }
  }

  // constraints
  if (brief.constraints) {
    if (brief.constraints.must_include && Array.isArray(brief.constraints.must_include)) {
      const assetIds = new Set((brief.assets || []).map(a => a.id));
      for (const id of brief.constraints.must_include) {
        if (!assetIds.has(id)) {
          errors.push(`constraints.must_include references unknown asset "${id}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Stage 2: classifyAssets ──────────────────────────────────────────────────

/**
 * Classify each asset in the brief using 3-tier priority:
 *   1. Explicit hint → confidence 1.0
 *   2. Filename convention → confidence 0.8
 *   3. Extension fallback → confidence 0.3
 *
 * @param {object} brief
 * @returns {object[]} — classified asset array with content_type, role, confidence
 */
export function classifyAssets(brief) {
  const assets = brief.assets || [];
  return assets.map(asset => {
    const result = { ...asset };

    // Tier 1: explicit hint
    if (asset.hint) {
      const normalized = asset.hint.toLowerCase().replace(/\s+/g, '-');
      const contentType = HINT_TO_CONTENT_TYPE[normalized];
      if (contentType) {
        result.content_type = contentType;
        result.confidence = 1.0;
        result.role = inferRole(contentType, asset.id);
        result.classification_source = 'hint';
        return result;
      }
    }

    // Tier 2: filename convention
    const basename = getBasename(asset.src);
    for (const { pattern, content_type, role } of ASSET_FILENAME_PATTERNS) {
      if (pattern.test(basename)) {
        result.content_type = content_type;
        result.confidence = 0.8;
        result.role = role;
        result.classification_source = 'filename';
        return result;
      }
    }

    // Tier 3: extension fallback
    const ext = getExtension(asset.src);
    if (ext && EXTENSION_TO_CONTENT_TYPE[ext]) {
      result.content_type = EXTENSION_TO_CONTENT_TYPE[ext];
      result.confidence = 0.3;
      result.role = 'supporting';
      result.classification_source = 'extension';
      return result;
    }

    // Default: unknown
    result.content_type = 'product_shot';
    result.confidence = 0.1;
    result.role = 'supporting';
    result.classification_source = 'default';
    return result;
  });
}

function getBasename(src) {
  const parts = src.split('/');
  const filename = parts[parts.length - 1];
  const dotIdx = filename.lastIndexOf('.');
  return dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
}

function getExtension(src) {
  const dotIdx = src.lastIndexOf('.');
  return dotIdx > 0 ? src.substring(dotIdx + 1).toLowerCase() : null;
}

function inferRole(contentType) {
  if (contentType === 'brand_mark') return 'closing';
  if (contentType === 'product_shot') return 'hero';
  if (contentType === 'moodboard') return 'background';
  return 'supporting';
}

// ── Stage 3: resolveTemplate ─────────────────────────────────────────────────

/**
 * Load the brief's template or infer virtual structure for custom briefs.
 *
 * @param {object} brief
 * @returns {{ sections: object[], defaults: object, suggested_scene_count: object }}
 */
export function resolveTemplate(brief) {
  const templateId = brief.template || 'custom';

  // Named template
  if (templateId !== 'custom') {
    const template = briefTemplatesCatalog.byId.get(templateId);
    if (template) {
      return {
        sections: template.sections,
        defaults: template.defaults,
        suggested_scene_count: template.suggested_scene_count,
      };
    }
  }

  // Custom: infer from brief content sections
  const contentSections = brief.content?.sections || [];

  if (contentSections.length === 0) {
    // Fallback to product-launch structure
    const fallback = briefTemplatesCatalog.byId.get('product-launch');
    if (fallback) {
      return {
        sections: fallback.sections,
        defaults: fallback.defaults,
        suggested_scene_count: fallback.suggested_scene_count,
      };
    }
  }

  // Infer virtual sections from brief content
  const sections = contentSections.map((s, i) => {
    const label = s.label.toLowerCase();
    const intentTags = LABEL_TO_INTENT[label] || [];

    // First/last section fallback intent
    if (intentTags.length === 0 && i === 0) intentTags.push('opening');
    if (intentTags.length === 0 && i === contentSections.length - 1) intentTags.push('closing');

    // Infer content type from section assets
    let suggestedContentType = 'typography';
    let suggestedLayout = 'hero-center';

    if (s.assets && s.assets.length > 0) {
      // Will be resolved further in buildScenePlan from classified assets
      suggestedContentType = 'product_shot';
      suggestedLayout = 'device-mockup';
    }

    return {
      label: s.label,
      description: s.text || '',
      emphasis: s.emphasis || 'normal',
      suggested_layout: suggestedLayout,
      suggested_content_type: suggestedContentType,
      intent_tags: intentTags,
      optional: false,
    };
  });

  // Infer defaults
  const defaults = {
    style: brief.style || 'prestige',
    duration_target_s: brief.project?.duration_target_s || contentSections.length * 3,
    tone: brief.tone || { mood: 'confident', energy: 'medium' },
  };

  return {
    sections,
    defaults,
    suggested_scene_count: {
      min: Math.max(3, contentSections.length),
      max: Math.max(8, contentSections.length * 2),
    },
  };
}

// ── Stage 4: resolveStyle ────────────────────────────────────────────────────

/**
 * Resolve style pack name: explicit > template default > tone inference > fallback.
 *
 * @param {object} brief
 * @param {object} template — resolved template from resolveTemplate()
 * @returns {string} — style pack name
 */
export function resolveStyle(brief, template) {
  // 1. Explicit style in brief
  if (brief.style) {
    if (stylePacksCatalog.byName.has(brief.style)) {
      return brief.style;
    }
  }

  // 2. Template default
  if (template.defaults?.style) {
    if (stylePacksCatalog.byName.has(template.defaults.style)) {
      return template.defaults.style;
    }
  }

  // 3. Tone inference
  const mood = brief.tone?.mood || template.defaults?.tone?.mood;
  if (mood) {
    const candidates = MOOD_TO_STYLES[mood.toLowerCase()];
    if (candidates) {
      for (const name of candidates) {
        if (stylePacksCatalog.byName.has(name)) {
          return name;
        }
      }
    }
  }

  // 4. Fallback
  return 'prestige';
}

// ── Stage 5: allocateDurations ───────────────────────────────────────────────

/**
 * Weighted duration division across scenes.
 * Strong emphasis sections get 1.5× weight.
 * Each scene clamped to [0.5, 30].
 *
 * @param {object} brief
 * @param {object} template — resolved template
 * @param {number} sceneCount — actual number of scenes to generate
 * @returns {number[]} — duration per scene
 */
export function allocateDurations(brief, template, sceneCount) {
  if (sceneCount === 0) return [];

  const total = brief.project?.duration_target_s
    || template.defaults?.duration_target_s
    || sceneCount * 3;

  // Placeholder: we don't know emphases until scene plan is built,
  // but we can accept a pre-computed emphasis array
  const equalDuration = total / sceneCount;
  const durations = new Array(sceneCount).fill(equalDuration);

  // Clamp
  return durations.map(d => Math.max(0.5, Math.min(30, parseFloat(d.toFixed(1)))));
}

/**
 * Allocate durations with emphasis weights.
 * Strong emphasis sections get 1.5× weight; normal get 1.0×.
 *
 * @param {number} total — target total duration
 * @param {string[]} emphases — 'strong' or 'normal' per scene
 * @returns {number[]} — duration per scene
 */
export function allocateDurationsWeighted(total, emphases) {
  if (emphases.length === 0) return [];

  const weights = emphases.map(e => e === 'strong' ? 1.5 : 1.0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const durations = weights.map(w => {
    const raw = (w / totalWeight) * total;
    return Math.max(0.5, Math.min(30, parseFloat(raw.toFixed(1))));
  });

  return durations;
}

// ── Stage 6: buildScenePlan ──────────────────────────────────────────────────

/**
 * Expand template sections into a concrete scene plan.
 * Handles repeats, optionals, asset assignment, and must_include.
 *
 * @param {object} brief
 * @param {object[]} classifiedAssets
 * @param {object} template — resolved template
 * @param {string} style — resolved style name
 * @returns {object[]} — ScenePlan array
 */
export function buildScenePlan(brief, classifiedAssets, template) {
  const contentSections = brief.content?.sections || [];
  const templateSections = template.sections;
  const mustInclude = new Set(brief.constraints?.must_include || []);

  // Build a lookup: label → content sections with that label
  const sectionsByLabel = {};
  for (const s of contentSections) {
    const key = s.label.toLowerCase();
    if (!sectionsByLabel[key]) sectionsByLabel[key] = [];
    sectionsByLabel[key].push(s);
  }

  // Track which assets have been assigned
  const assignedAssets = new Set();
  const plan = [];

  for (const tplSection of templateSections) {
    const label = tplSection.label.toLowerCase();
    const matchingSections = sectionsByLabel[label] || [];

    if (matchingSections.length === 0 && tplSection.optional) {
      continue; // Skip optional sections with no content
    }

    // Determine repetition count
    let repeatCount = 1;
    if (tplSection.repeat) {
      repeatCount = Math.min(
        tplSection.repeat.max,
        Math.max(tplSection.repeat.min, matchingSections.length)
      );
    } else if (matchingSections.length > 0) {
      repeatCount = matchingSections.length;
    }

    for (let r = 0; r < repeatCount; r++) {
      const contentSection = matchingSections[r] || matchingSections[0] || {};
      const sectionAssetIds = contentSection.assets || [];

      // Resolve assets for this scene
      const sceneAssets = [];
      for (const assetId of sectionAssetIds) {
        const classified = classifiedAssets.find(a => a.id === assetId);
        if (classified) {
          sceneAssets.push(classified);
          assignedAssets.add(assetId);
        }
      }

      // Determine content type
      let contentType = tplSection.suggested_content_type || 'typography';
      if (sceneAssets.length > 0 && sceneAssets[0].content_type) {
        // Let the primary asset influence content type
        contentType = sceneAssets[0].content_type;
      }

      // Determine layout
      let layout = tplSection.suggested_layout || CONTENT_TYPE_TO_LAYOUT[contentType] || 'hero-center';

      // For collage/grid content with multiple assets
      if (sceneAssets.length >= 4) {
        contentType = 'collage';
        layout = 'masonry-grid';
      }

      plan.push({
        label: tplSection.label,
        text: contentSection.text || '',
        emphasis: tplSection.emphasis || contentSection.emphasis || 'normal',
        content_type: contentType,
        layout,
        intent_tags: tplSection.intent_tags || LABEL_TO_INTENT[label] || [],
        assets: sceneAssets,
        repeat_index: r,
      });
    }
  }

  // Handle unmatched content sections (not in template)
  for (const s of contentSections) {
    const label = s.label.toLowerCase();
    const hasTemplateMatch = templateSections.some(
      t => t.label.toLowerCase() === label
    );
    if (!hasTemplateMatch) {
      const sectionAssetIds = s.assets || [];
      const sceneAssets = [];
      for (const assetId of sectionAssetIds) {
        const classified = classifiedAssets.find(a => a.id === assetId);
        if (classified) {
          sceneAssets.push(classified);
          assignedAssets.add(assetId);
        }
      }

      let contentType = 'typography';
      let layout = 'hero-center';
      if (sceneAssets.length > 0 && sceneAssets[0].content_type) {
        contentType = sceneAssets[0].content_type;
        layout = CONTENT_TYPE_TO_LAYOUT[contentType] || 'hero-center';
      }

      // For collage/grid content with multiple assets
      if (sceneAssets.length >= 4) {
        contentType = 'collage';
        layout = 'masonry-grid';
      }

      plan.push({
        label: s.label,
        text: s.text || '',
        emphasis: s.emphasis || 'normal',
        content_type: contentType,
        layout,
        intent_tags: LABEL_TO_INTENT[label] || [],
        assets: sceneAssets,
        repeat_index: 0,
      });
    }
  }

  // Pass 2: distribute unassigned assets by affinity
  const unassigned = classifiedAssets.filter(a => !assignedAssets.has(a.id));
  for (const asset of unassigned) {
    // Skip must_include assets — they get special treatment below
    if (mustInclude.has(asset.id)) continue;

    const bestScene = findBestSceneForAsset(asset, plan);
    if (bestScene) {
      bestScene.assets.push(asset);
      assignedAssets.add(asset.id);
    }
  }

  // Pass 3: force must_include assets into best-matching scene
  for (const assetId of mustInclude) {
    if (assignedAssets.has(assetId)) continue;
    const asset = classifiedAssets.find(a => a.id === assetId);
    if (!asset) continue;

    const bestScene = findBestSceneForAsset(asset, plan);
    if (bestScene) {
      bestScene.assets.push(asset);
      assignedAssets.add(assetId);
    } else if (plan.length > 0) {
      // Force into last scene before closing, or last scene
      const closingIdx = plan.findIndex(p =>
        p.intent_tags.includes('closing')
      );
      const targetIdx = closingIdx > 0 ? closingIdx - 1 : plan.length - 1;
      plan[targetIdx].assets.push(asset);
      assignedAssets.add(assetId);
    }
  }

  return plan;
}

/**
 * Find the best scene in the plan for an unassigned asset.
 */
function findBestSceneForAsset(asset, plan) {
  // Priority 1: matching content type
  for (const scene of plan) {
    if (scene.content_type === asset.content_type && scene.assets.length === 0) {
      return scene;
    }
  }

  // Priority 2: role affinity
  if (asset.role === 'hero') {
    const heroScene = plan.find(p =>
      p.intent_tags.includes('hero') || p.intent_tags.includes('opening')
    );
    if (heroScene) return heroScene;
  }
  if (asset.role === 'closing') {
    const closingScene = plan.find(p => p.intent_tags.includes('closing'));
    if (closingScene) return closingScene;
  }
  if (asset.role === 'background') {
    // Heavy scenes (most layers or emphasis)
    const heaviest = plan.reduce((best, p) =>
      (p.emphasis === 'strong' || p.assets.length > (best?.assets.length || 0)) ? p : best,
      null
    );
    if (heaviest) return heaviest;
  }

  // Priority 3: first scene with no assets
  return plan.find(p => p.assets.length === 0) || null;
}

// ── Stage 7: generateScene ───────────────────────────────────────────────────

/**
 * Generate a single scene JSON from a plan entry.
 *
 * @param {object} planEntry — from buildScenePlan
 * @param {number} index — scene index
 * @param {object} brief — the original brief
 * @param {object[]} classifiedAssets — all classified assets
 * @returns {object} — scene JSON conforming to scene-format spec
 */
export function generateScene(planEntry, index, brief, resolvedBrand) {
  const sceneId = makeSceneId(planEntry.label, index);
  const brandColors = resolvedBrand?.colors || brief.brand?.colors || {};
  const brandFont = resolvedBrand?.font || brief.brand?.font;

  const scene = {
    scene_id: sceneId,
    duration_s: 3, // placeholder, overridden by allocateDurations
    camera: { move: 'static' },
    layout: { template: planEntry.layout },
    assets: [],
    layers: [],
    metadata: {
      content_type: planEntry.content_type,
      intent_tags: planEntry.intent_tags,
    },
  };

  // Add grid config for masonry-grid
  if (planEntry.layout === 'masonry-grid') {
    const assetCount = planEntry.assets.length;
    const cols = assetCount <= 4 ? 2 : 3;
    const rows = Math.ceil(assetCount / cols);
    scene.layout.config = { columns: cols, rows };
  }

  // Build assets and layers based on content type
  const contentType = planEntry.content_type;

  switch (contentType) {
    case 'typography':
      buildTypographyScene(scene, planEntry, brandColors, brandFont);
      break;
    case 'ui_screenshot':
    case 'device_mockup':
      buildDeviceMockupScene(scene, planEntry, brandColors, brandFont);
      break;
    case 'product_shot':
      buildProductShotScene(scene, planEntry, brandColors, brandFont);
      break;
    case 'portrait':
      buildPortraitScene(scene, planEntry, brandColors, brandFont);
      break;
    case 'brand_mark':
      buildBrandMarkScene(scene, planEntry, brandColors, brandFont);
      break;
    case 'collage':
    case 'moodboard':
      buildCollageScene(scene, planEntry, brandColors);
      break;
    case 'data_visualization':
      buildDataVizScene(scene, planEntry, brandColors, brandFont);
      break;
    default:
      buildTypographyScene(scene, planEntry, brandColors, brandFont);
  }

  return scene;
}

/**
 * Attach a v2 motion block to a generated scene.
 *
 * Selects a recipe from the catalog based on content_type and personality,
 * maps layer IDs to recipe target roles, and emits motion groups with
 * stagger and camera sync.
 *
 * @param {object} scene - Generated scene (mutated in place)
 * @param {string} personality - Personality slug
 */
export function attachMotionBlock(scene, personality) {
  const layers = scene.layers || [];
  if (layers.length === 0) return;

  // Classify layers into roles
  const heroLayers = layers.filter(l => l.depth_class === 'foreground' || l.type === 'text');
  const supportingLayers = layers.filter(l => l.depth_class === 'midground' || (l.type !== 'text' && l.depth_class !== 'background' && l.depth_class !== 'foreground'));
  const bgLayers = layers.filter(l => l.depth_class === 'background');

  // Find a recipe for this personality
  const personalityRecipes = recipesCatalog.array.filter(r => r.personality === personality);
  if (personalityRecipes.length === 0) return;

  // Select recipe based on content type
  const contentType = scene.metadata?.content_type;
  let recipe;
  if (contentType === 'typography' || contentType === 'brand_mark') {
    recipe = personalityRecipes.find(r => r.id.includes('reveal') || r.id.includes('focus'));
  } else if (contentType === 'data_visualization') {
    recipe = personalityRecipes.find(r => r.id.includes('stat') || r.id.includes('stagger'));
  } else {
    recipe = personalityRecipes.find(r => r.id.includes('stagger') || r.id.includes('entrance'));
  }
  recipe = recipe || personalityRecipes[0];

  // Build motion groups
  const groups = [];

  if (heroLayers.length > 0) {
    const heroGroup = recipe.groups.find(g => g.role === 'hero') || recipe.groups[0];
    groups.push({
      id: 'hero',
      targets: heroLayers.map(l => l.id),
      primitive: heroGroup.primitive,
      on_complete: { emit: 'hero_done' },
    });
  }

  if (supportingLayers.length > 0) {
    const supportGroup = recipe.groups.find(g => g.role === 'supporting' || g.role === '*');
    const primitive = supportGroup?.primitive || recipe.groups[0].primitive;
    const stagger = supportGroup?.stagger || { interval_ms: 120, order: 'sequential' };

    groups.push({
      id: 'supporting',
      targets: supportingLayers.map(l => l.id),
      primitive,
      stagger,
      delay: heroLayers.length > 0 ? { after: 'hero_done', offset_ms: 200 } : undefined,
    });
  }

  if (groups.length === 0) return;

  scene.format_version = 2;
  scene.motion = {
    groups,
    camera: recipe.default_camera
      ? { ...recipe.default_camera, sync: recipe.camera_sync || undefined }
      : scene.camera,
  };
}

/**
 * Attach a v3 semantic block to a generated scene.
 *
 * Maps content types to semantic component types and generates
 * interactions based on intent tags and component type.
 *
 * @param {object} scene - Generated scene (mutated in place)
 * @param {string} personality - Personality slug
 * @param {object} planEntry - Plan entry with content_type, intent_tags, text
 * @returns {boolean} true if semantic block was attached, false if no mapping
 */
export function attachSemanticBlock(scene, personality, planEntry) {
  const componentType = CONTENT_TYPE_TO_COMPONENT[planEntry.content_type];
  if (!componentType) return false;

  const layers = scene.layers || [];
  if (layers.length === 0) return false;

  const intentTags = planEntry.intent_tags || [];
  const isHero = intentTags.includes('hero') || intentTags.includes('opening');

  // Build components from layers (component IDs must match ^cmp_[a-z0-9_]+$)
  const components = [];
  let cmpIndex = 0;
  for (const layer of layers) {
    if (layer.type === 'text') {
      components.push({
        id: `cmp_${cmpIndex++}`,
        type: componentType,
        role: layer.depth_class === 'foreground' ? 'hero' : 'supporting',
        layer_ref: layer.id,
        anchor: layer.slot || 'center',
        props: layer.content ? { text: layer.content } : {},
      });
    }
  }

  // If no text layers produced components, use the first foreground/midground layer
  if (components.length === 0) {
    const primary = layers.find(l => l.depth_class === 'foreground' || l.depth_class === 'midground');
    if (primary) {
      components.push({
        id: `cmp_${cmpIndex++}`,
        type: componentType,
        role: 'hero',
        layer_ref: primary.id,
        anchor: primary.slot || 'center',
        props: {},
      });
    }
  }

  if (components.length === 0) return false;

  // Build interactions based on component type + intent
  const interactions = buildSemanticInteractions(componentType, intentTags, components, planEntry);

  // Build camera behavior
  const cameraBehavior = isHero
    ? { mode: 'reactive' }
    : { mode: 'ambient', ambient: { drift: 0.15 } };

  scene.format_version = 3;
  scene.semantic = {
    components,
    interactions,
    camera_behavior: cameraBehavior,
  };

  return true;
}

/**
 * Build recipe-specific params from a plan entry.
 */
function buildRecipeParams(recipeId, planEntry) {
  switch (recipeId) {
    case 'type-and-complete':
      return { text: planEntry.text || '', speed: 45 };
    case 'fade-and-swap-prompt':
      return { text: planEntry.text || '' };
    case 'fan-and-settle-cards':
      return {};
    default:
      return {};
  }
}

/**
 * Build semantic interactions for a component type + intent combination.
 * Tries recipe lookup first; falls back to inline interactions.
 */
function buildSemanticInteractions(componentType, intentTags, components, planEntry) {
  const heroComponent = components.find(c => c.role === 'hero') || components[0];
  const targetId = heroComponent.id;

  // Try recipe lookup
  const recipeId = lookupRecipe(componentType, intentTags);
  if (recipeId) {
    const params = buildRecipeParams(recipeId, planEntry);
    return expandRecipe(recipeId, targetId, params);
  }

  // Fallback: inline interactions for unmapped combinations
  const interactions = [];

  switch (componentType) {
    case 'prompt_card':
    case 'icon_label_row': {
      interactions.push({
        id: `int_focus_${targetId}`,
        target: targetId,
        kind: 'focus',
        timing: { at_ms: 0 },
        on_complete: { emit: 'focused' },
      });
      if (componentType === 'icon_label_row') {
        interactions.push({
          id: `int_pulse_${targetId}`,
          target: targetId,
          kind: 'pulse_focus',
          params: { count: 1 },
          timing: { delay: { after: 'focused', offset_ms: 200 } },
        });
      }
      break;
    }
  }

  return interactions;
}

function makeSceneId(label, index) {
  const sanitized = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const padded = String(index).padStart(2, '0');
  return `sc_${padded}_${sanitized}`;
}

function buildTypographyScene(scene, plan, colors, font) {
  const textAnimation = plan.emphasis === 'strong' ? 'scale-cascade' : 'word-reveal';
  const textColor = colors.text || '#ffffff';

  // Optional background HTML layer
  const bgColor = colors.background || colors.primary || '#0a0a0a';
  scene.layers.push({
    id: `${scene.scene_id}_bg`,
    type: 'html',
    content: `<div style="width:100%;height:100%;background:${bgColor}"></div>`,
    depth_class: 'background',
  });

  // Foreground text layer
  const style = { color: textColor };
  if (font) style.fontFamily = font;

  scene.layers.push({
    id: `${scene.scene_id}_text`,
    type: 'text',
    content: plan.text || 'Untitled',
    animation: textAnimation,
    depth_class: 'foreground',
    style,
  });
}

function buildDeviceMockupScene(scene, plan, colors, font) {
  scene.layout.template = 'device-mockup';

  // Background
  const bgColor = colors.background || '#f5f5f5';
  scene.layers.push({
    id: `${scene.scene_id}_bg`,
    type: 'html',
    content: `<div style="width:100%;height:100%;background:${bgColor}"></div>`,
    depth_class: 'background',
    slot: 'background',
  });

  // Device slot (image asset)
  if (plan.assets.length > 0) {
    const asset = plan.assets[0];
    scene.assets.push({ id: asset.id, src: asset.src });
    scene.layers.push({
      id: `${scene.scene_id}_device`,
      type: 'image',
      asset: asset.id,
      depth_class: 'midground',
      slot: 'device',
    });
  }

  // Content slot (text)
  if (plan.text) {
    const textColor = colors.text || '#1a1a1a';
    const style = { color: textColor };
    if (font) style.fontFamily = font;

    scene.layers.push({
      id: `${scene.scene_id}_text`,
      type: 'text',
      content: plan.text,
      animation: 'word-reveal',
      depth_class: 'foreground',
      slot: 'content',
      style,
    });
  }
}

function buildProductShotScene(scene, plan, colors, font) {
  // Use device-mockup if we have assets, full-bleed otherwise
  const hasAssets = plan.assets.length > 0;
  if (hasAssets) {
    scene.layout.template = 'device-mockup';

    const bgColor = colors.background || '#f5f5f5';
    scene.layers.push({
      id: `${scene.scene_id}_bg`,
      type: 'html',
      content: `<div style="width:100%;height:100%;background:${bgColor}"></div>`,
      depth_class: 'background',
      slot: 'background',
    });

    const asset = plan.assets[0];
    scene.assets.push({ id: asset.id, src: asset.src });
    scene.layers.push({
      id: `${scene.scene_id}_media`,
      type: 'image',
      asset: asset.id,
      depth_class: 'midground',
      slot: 'device',
    });

    if (plan.text) {
      const textColor = colors.text || '#1a1a1a';
      const style = { color: textColor };
      if (font) style.fontFamily = font;
      scene.layers.push({
        id: `${scene.scene_id}_text`,
        type: 'text',
        content: plan.text,
        animation: 'word-reveal',
        depth_class: 'foreground',
        slot: 'content',
        style,
      });
    }
  } else {
    // Text-only fallback
    buildTypographyScene(scene, plan, colors, font);
  }
}

function buildPortraitScene(scene, plan, colors, font) {
  scene.layout.template = 'split-panel';

  // Background
  const bgColor = colors.background || '#f5f5f5';
  scene.layers.push({
    id: `${scene.scene_id}_bg`,
    type: 'html',
    content: `<div style="width:100%;height:100%;background:${bgColor}"></div>`,
    depth_class: 'background',
    slot: 'background',
  });

  // Left panel: image
  if (plan.assets.length > 0) {
    const asset = plan.assets[0];
    scene.assets.push({ id: asset.id, src: asset.src });
    scene.layers.push({
      id: `${scene.scene_id}_portrait`,
      type: 'image',
      asset: asset.id,
      depth_class: 'midground',
      slot: 'left',
    });
  }

  // Right panel: text
  if (plan.text) {
    const textColor = colors.text || '#1a1a1a';
    const style = { color: textColor };
    if (font) style.fontFamily = font;
    scene.layers.push({
      id: `${scene.scene_id}_text`,
      type: 'text',
      content: plan.text,
      animation: 'word-reveal',
      depth_class: 'foreground',
      slot: 'right',
      style,
    });
  }
}

function buildBrandMarkScene(scene, plan, colors, font) {
  scene.layout.template = 'hero-center';

  // Background
  const bgColor = colors.background || colors.primary || '#0a0a0a';
  scene.layers.push({
    id: `${scene.scene_id}_bg`,
    type: 'html',
    content: `<div style="width:100%;height:100%;background:${bgColor}"></div>`,
    depth_class: 'background',
    slot: 'background',
  });

  // Center: brand mark image or SVG
  if (plan.assets.length > 0) {
    const asset = plan.assets[0];
    scene.assets.push({ id: asset.id, src: asset.src });
    scene.layers.push({
      id: `${scene.scene_id}_mark`,
      type: 'image',
      asset: asset.id,
      depth_class: 'foreground',
      slot: 'center',
    });
  }

  // Optional text below/over
  if (plan.text) {
    const textColor = colors.text || '#ffffff';
    const style = { color: textColor };
    if (font) style.fontFamily = font;
    scene.layers.push({
      id: `${scene.scene_id}_text`,
      type: 'text',
      content: plan.text,
      animation: 'word-reveal',
      depth_class: 'foreground',
      style,
    });
  }
}

function buildCollageScene(scene, plan) {
  scene.layout.template = 'masonry-grid';
  const assets = plan.assets;

  const cols = assets.length <= 4 ? 2 : 3;
  const rows = Math.ceil(assets.length / cols);
  scene.layout.config = { columns: cols, rows };

  // Add each asset as a cell
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    scene.assets.push({ id: asset.id, src: asset.src });
    scene.layers.push({
      id: `${scene.scene_id}_cell_${i}`,
      type: 'image',
      asset: asset.id,
      depth_class: 'midground',
      slot: `cell-${i}`,
    });
  }
}

function buildDataVizScene(scene, plan, colors, font) {
  // Similar to typography but with data-focused layout
  scene.layout.template = 'hero-center';

  const bgColor = colors.background || '#0a0a0a';
  scene.layers.push({
    id: `${scene.scene_id}_bg`,
    type: 'html',
    content: `<div style="width:100%;height:100%;background:${bgColor}"></div>`,
    depth_class: 'background',
    slot: 'background',
  });

  if (plan.assets.length > 0) {
    const asset = plan.assets[0];
    scene.assets.push({ id: asset.id, src: asset.src });
    scene.layers.push({
      id: `${scene.scene_id}_chart`,
      type: 'image',
      asset: asset.id,
      depth_class: 'foreground',
      slot: 'center',
    });
  }

  if (plan.text) {
    const textColor = colors.text || '#ffffff';
    const style = { color: textColor };
    if (font) style.fontFamily = font;
    scene.layers.push({
      id: `${scene.scene_id}_text`,
      type: 'text',
      content: plan.text,
      animation: 'word-reveal',
      depth_class: 'foreground',
      style,
    });
  }
}

// ── Stage 8: generateScenes (Orchestrator) ───────────────────────────────────

/**
 * Full orchestrator: validates brief, composes stages 1-7, self-validates output.
 *
 * When `options.enhance` is true and ANTHROPIC_API_KEY is set, layers LLM
 * improvements on top of rule-based generation (ANI-36). Falls back to
 * rule-based output on any LLM failure.
 *
 * @param {object} brief — creative brief JSON
 * @param {object} [options] — optional settings
 * @param {boolean} [options.enhance=false] — enable LLM enhancement
 * @param {string} [options.format='v2'] — output format: 'v2' (motion blocks) or 'v3' (semantic components)
 * @returns {Promise<{ scenes: object[], notes: object }>}
 */
export async function generateScenes(brief, options = {}) {
  // Stage 1: Validate
  const validation = validateBrief(brief);
  if (!validation.valid) {
    throw new Error(`Brief validation failed: ${validation.errors.join('; ')}`);
  }

  // Stage 1b: Resolve brand tokens
  const resolvedBrand = resolveBrand(brief);

  // Stage 2: Classify assets
  const classifiedAssets = classifyAssets(brief);

  // Stage 3: Resolve template
  const template = resolveTemplate(brief);

  // Stage 4: Resolve style
  const style = resolveStyle(brief, template);

  // Stage 5: Build scene plan (determines scene count)
  let plan = buildScenePlan(brief, classifiedAssets, template);
  const llmNotes = [];

  // LLM Stage A: Enhance scene plan text (ANI-36)
  if (options.enhance && isLLMAvailable()) {
    const { enhanced, notes: planNotes } = await enhanceScenePlan(plan, brief, style);
    plan = enhanced;
    llmNotes.push(...planNotes);
  }

  // Allocate durations with emphasis weighting
  const total = brief.project?.duration_target_s
    || template.defaults?.duration_target_s
    || plan.length * 3;
  const emphases = plan.map(p => p.emphasis);
  const durations = allocateDurationsWeighted(total, emphases);

  // Stage 6-7: Generate scenes (with resolved brand tokens)
  let scenes = plan.map((entry, i) => {
    const scene = generateScene(entry, i, brief, resolvedBrand);
    scene.duration_s = durations[i] || 3;
    return scene;
  });

  // Inject brand CSS custom properties into the first scene's background layer
  if (resolvedBrand.cssVars && scenes.length > 0) {
    const firstBgLayer = scenes[0].layers?.find(l => l.depth_class === 'background' && l.type === 'html');
    if (firstBgLayer && firstBgLayer.content) {
      firstBgLayer.content = `<style>${resolvedBrand.cssVars}</style>${firstBgLayer.content}`;
    }
    // Store brand metadata on each scene for downstream consumers (Preset renderer)
    for (const scene of scenes) {
      scene.brand = resolvedBrand.brand?.brand_id || null;
    }
  }

  // LLM Stage B: Enrich scene content — camera suggestions (ANI-36)
  if (options.enhance && isLLMAvailable()) {
    const { enriched, notes: enrichNotes } = await enrichSceneContent(scenes, style);
    scenes = enriched;
    llmNotes.push(...enrichNotes);
  }

  // Stage 8: Attach motion blocks (v2 recipe-based or v3 semantic)
  const format = options.format || 'v2';
  const stylePack = stylePacksCatalog.byName.get(style);
  const personality = stylePack?.personality || 'editorial';
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (format === 'v3') {
      const attached = attachSemanticBlock(scene, personality, plan[i]);
      if (!attached) attachMotionBlock(scene, personality);
    } else {
      attachMotionBlock(scene, personality);
    }
  }

  // Self-validate each scene
  const sceneErrors = [];
  for (const scene of scenes) {
    const result = validateScene(scene);
    if (!result.valid) {
      sceneErrors.push(`${scene.scene_id}: ${result.errors.join('; ')}`);
    }
  }

  if (sceneErrors.length > 0) {
    throw new Error(`Generated scenes failed validation:\n${sceneErrors.join('\n')}`);
  }

  // Build notes
  const notes = {
    scene_count: scenes.length,
    format,
    template: brief.template || 'custom',
    style,
    total_duration_s: durations.reduce((sum, d) => sum + d, 0),
    asset_classification: classifiedAssets.map(a => ({
      id: a.id,
      content_type: a.content_type,
      confidence: a.confidence,
      role: a.role,
      source: a.classification_source,
    })),
    plan_summary: plan.map(p => ({
      label: p.label,
      content_type: p.content_type,
      layout: p.layout,
      intent_tags: p.intent_tags,
      asset_count: p.assets.length,
    })),
    ...(llmNotes.length > 0 ? { llm_enhancement: llmNotes } : {}),
  };

  return { scenes, notes };
}
