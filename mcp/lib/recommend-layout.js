/**
 * UI-surface layout + personality-for-context recommenders (ANI-152).
 *
 * Pure functions, JSON in / JSON out — the index.js handlers are thin wrappers.
 *
 * - recommendUiStoryboardLayout: product-UI surface patterns, the counterpart
 *   to the video-canvas EDITORIAL_PATTERNS in index.js.
 * - recommendPersonalityForContext: ranks the four personalities against a
 *   context so callers don't hand-reason across four get_personality specs.
 */

// Signals that a content description is a product-UI surface, not a video
// canvas. Shared with index.js so recommend_editorial_layout can redirect.
export const UI_SURFACE_KEYWORDS = [
  'window', 'chrome', 'toolbar', 'titlebar', 'title bar', 'rail', 'sidebar',
  'panel', 'pane', 'status bar', 'statusbar', 'app', 'surface', 'inspector',
  'table', 'tree', 'master', 'detail', 'settings', 'dashboard', 'menu',
];

export const UI_SURFACE_PATTERNS = {
  'split-pane-app': {
    description: 'Window chrome with a left navigation rail and a main content panel. The canonical desktop-app surface — file trees, source browsers, scanners.',
    regions: [
      { role: 'window_chrome', position: 'top', size: 'full-width', notes: 'title + toolbar' },
      { role: 'left_rail', position: 'left', size: '22%', notes: 'tree / list / nav' },
      { role: 'main_panel', position: 'center-right', size: '78%', notes: 'primary content' },
      { role: 'status_bar', position: 'bottom', size: 'full-width', notes: 'progress / counts' },
    ],
    motion: { state_cycle: 'crossfade main_panel; rail selection drives the change', dwell_s: 5 },
    keywords: ['rail', 'tree', 'source', 'file', 'sidebar', 'nav', 'scanner', 'browser', 'panel'],
  },
  'table-with-detail-rail': {
    description: 'A data table as the primary surface with a right-hand detail rail that reflects the selected row. For records, results, line items.',
    regions: [
      { role: 'window_chrome', position: 'top', size: 'full-width', notes: 'title + filters' },
      { role: 'table', position: 'left', size: '64%', notes: 'rows with selection' },
      { role: 'detail_rail', position: 'right', size: '36%', notes: 'selected-row detail' },
    ],
    motion: { state_cycle: 'highlight row → detail_rail content swaps', dwell_s: 4 },
    keywords: ['table', 'row', 'rows', 'list of', 'records', 'results', 'columns', 'grid'],
  },
  'master-detail': {
    description: 'A list of items on the left, a full detail view on the right. For inboxes, settings groups, entity browsers.',
    regions: [
      { role: 'master_list', position: 'left', size: '32%', notes: 'item list' },
      { role: 'detail_view', position: 'right', size: '68%', notes: 'selected item' },
    ],
    motion: { state_cycle: 'list selection → detail_view slide/crossfade', dwell_s: 4 },
    keywords: ['master', 'detail', 'inbox', 'items', 'entity', 'select', 'thread'],
  },
  'inspector-rail': {
    description: 'A central work canvas with a right-hand inspector of properties/controls. For editors, design tools, configurators.',
    regions: [
      { role: 'canvas', position: 'center-left', size: '74%', notes: 'work surface' },
      { role: 'inspector', position: 'right', size: '26%', notes: 'properties / controls' },
    ],
    motion: { state_cycle: 'edit on canvas → inspector values update', dwell_s: 4 },
    keywords: ['inspector', 'canvas', 'editor', 'properties', 'controls', 'design tool', 'configure'],
  },
  'settings-list': {
    description: 'A sectioned list of settings or form rows, optionally with a section nav. For preferences, onboarding forms, configuration.',
    regions: [
      { role: 'section_nav', position: 'left', size: '24%', notes: 'optional section list' },
      { role: 'form_rows', position: 'center-right', size: '76%', notes: 'grouped rows' },
    ],
    motion: { state_cycle: 'section nav → form_rows scroll/crossfade', dwell_s: 4 },
    keywords: ['settings', 'preferences', 'form', 'onboarding', 'config', 'sections', 'toggle'],
  },
};

/**
 * Recommend a structural layout for a product-UI surface description.
 * @param {{ content_description?: string, personality?: string }} args
 */
export function recommendUiStoryboardLayout({ content_description, personality = 'editorial' } = {}) {
  const desc = (content_description || '').toLowerCase();

  const scores = {};
  for (const [pattern, p] of Object.entries(UI_SURFACE_PATTERNS)) {
    scores[pattern] = p.keywords.reduce((s, kw) => s + (desc.includes(kw) ? 1 : 0), 0);
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const bestMatch = scores[ranked[0]] > 0 ? ranked[0] : 'split-pane-app';

  return {
    scope: 'Product-UI surface mockups (not video canvas — see recommend_editorial_layout for that).',
    recommended_pattern: bestMatch,
    all_patterns: Object.entries(UI_SURFACE_PATTERNS).map(([name, p]) => ({
      name,
      description: p.description,
      match_score: scores[name],
      regions: p.regions,
      motion: p.motion,
    })),
    personality_note: personality === 'editorial' || personality === 'neutral-light'
      ? 'Light register suits product-UI mockups: real chrome, restrained motion, crossfade between states.'
      : `Note: product-UI surfaces are usually storyboarded in editorial or neutral-light register; "${personality}" is unusual here.`,
  };
}

export const PERSONALITY_PROFILES = {
  'cinematic-dark': {
    best_for: 'Dramatic product reveals, launch hero moments, premium/bold brand films.',
    register: 'dark',
    signals: ['dramatic', 'dark', 'cinematic', 'premium', 'bold', 'hero', 'launch', 'reveal', 'luxury', 'film', 'moody', 'spring', '3d', 'depth'],
    avoid_when: 'Content-forward editorial pieces, tutorials, or any light-register / Silver-Light context.',
  },
  'editorial': {
    best_for: 'Content-forward pieces, feature explainers, marketing walkthroughs, magazine-style reveals — light register, no 3D/blur.',
    register: 'light',
    signals: ['editorial', 'content', 'article', 'magazine', 'marketing', 'feature', 'walkthrough', 'explainer', 'clean', 'calm', 'light', 'product-ui', 'storyboard', 'museum', 'silver-light'],
    avoid_when: 'High-drama launches (use cinematic-dark) or step-by-step teaching (use neutral-light).',
  },
  'neutral-light': {
    best_for: 'Tutorials, onboarding, step-by-step guides — spotlights, cursors, step indicators, no camera movement.',
    register: 'light',
    signals: ['tutorial', 'onboarding', 'teach', 'step', 'guide', 'help', 'docs', 'how-to', 'instruction', 'spotlight', 'cursor'],
    avoid_when: 'Marketing pieces that should not feel instructional (use editorial), or dramatic reveals.',
  },
  'montage': {
    best_for: 'Sizzle reels, brand-launch hype, fast energetic cutdowns — hard cuts and whip-wipes, dark register.',
    register: 'dark',
    signals: ['sizzle', 'montage', 'reel', 'hype', 'fast', 'energetic', 'cutdown', 'brand launch', 'highlights', 'kinetic', 'punchy'],
    avoid_when: 'Anything that needs ambient motion, calm pacing, or content legibility over energy.',
  },
};

/**
 * Rank the four personalities against a context description.
 * @param {{ context?: string, content_type?: string, doctrine_tags?: string[] }} args
 * @returns {object|{ error: string }}
 */
export function recommendPersonalityForContext({ context, content_type, doctrine_tags } = {}) {
  const text = [context, content_type, ...(Array.isArray(doctrine_tags) ? doctrine_tags : [])]
    .filter(Boolean).join(' ').toLowerCase();

  if (!text.trim()) {
    return { error: 'A `context` description is required (e.g., "marketing-site explainer cycling product UI states").' };
  }

  const ranked = Object.entries(PERSONALITY_PROFILES)
    .map(([slug, p]) => {
      const matched = p.signals.filter(s => text.includes(s));
      return { personality: slug, score: matched.length, matched_signals: matched, best_for: p.best_for, register: p.register };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const recommended = top.score > 0 ? top.personality : 'editorial';
  const rationale = top.score > 0
    ? `"${recommended}" best matches the context (signals: ${top.matched_signals.join(', ')}). ${PERSONALITY_PROFILES[recommended].best_for}`
    : 'No strong signal — defaulting to "editorial" (the most content-neutral, light-register choice). Refine the context for a sharper match.';

  return {
    recommended_personality: recommended,
    rationale,
    ranked,
    comparison: Object.entries(PERSONALITY_PROFILES).map(([slug, p]) => ({
      personality: slug, register: p.register, best_for: p.best_for, avoid_when: p.avoid_when,
    })),
  };
}
