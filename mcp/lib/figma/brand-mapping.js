/**
 * Figma → Animatic brand-package color mapping (ANI-119).
 *
 * Two hops, both pure (no I/O — feed it the output of fetchVariables /
 * fetchFileStyles from ./client.js):
 *
 *   1. Figma token NAME → shadcn-style semantic token + a 0-100 name-match
 *      confidence. Ported from the Preset repo's confidence-scored matcher
 *      (`packages/mcp/src/figma/mapping.ts`): direct match → collection-prefix
 *      strip → two-part join → fuzzy regex.
 *   2. Semantic token → Animatic brand color slot (`catalog/brands/_schema.json`
 *      `colors.*`) via SEMANTIC_TO_SLOT. This bridge is the animatic-specific
 *      design decision; ambiguous bridges carry an advisory.
 *
 * Color VALUES come pre-hexed from the client (figmaColorToHex). Variable
 * aliases are resolved one-or-more hops to a concrete color (with a cycle
 * guard) rather than skipped. Typography/logo are out of scope for this module
 * (Figma variables rarely carry them) and handled as advisories upstream.
 */

import { figmaColorToHex } from './client.js';

// ── Stage 1: name → semantic (ported from Preset mapping.ts) ─────────────────

/** Figma variable/style name fragments → shadcn semantic token. */
const FIGMA_TO_SEMANTIC_MAP = {
  background: 'background', bg: 'background', surface: 'background',
  foreground: 'foreground', fg: 'foreground', text: 'foreground',
  primary: 'primary', 'primary/default': 'primary',
  'primary-foreground': 'primaryForeground', 'primary/foreground': 'primaryForeground', 'on-primary': 'primaryForeground',
  secondary: 'secondary', 'secondary/default': 'secondary',
  'secondary-foreground': 'secondaryForeground', 'secondary/foreground': 'secondaryForeground',
  muted: 'muted', 'muted/default': 'muted',
  'muted-foreground': 'mutedForeground', 'muted/foreground': 'mutedForeground',
  accent: 'accent', 'accent/default': 'accent',
  'accent-foreground': 'accentForeground', 'accent/foreground': 'accentForeground',
  destructive: 'destructive', 'destructive/default': 'destructive', danger: 'destructive', error: 'destructive',
  'destructive-foreground': 'destructiveForeground', 'destructive/foreground': 'destructiveForeground',
  card: 'card', 'card/default': 'card', 'card-foreground': 'cardForeground', 'card/foreground': 'cardForeground',
  popover: 'popover', 'popover/default': 'popover', 'popover-foreground': 'popoverForeground', 'popover/foreground': 'popoverForeground',
  border: 'border', 'border/default': 'border',
  input: 'input', 'input/default': 'input',
  ring: 'ring', focus: 'ring',
  'chart-1': 'chart1', 'chart-2': 'chart2', 'chart-3': 'chart3', 'chart-4': 'chart4', 'chart-5': 'chart5',
};

const FUZZY_PATTERNS = [
  { pattern: /primary.*foreground|on.*primary/i, token: 'primaryForeground', confidence: 70 },
  { pattern: /secondary.*foreground|on.*secondary/i, token: 'secondaryForeground', confidence: 70 },
  { pattern: /destructive.*foreground|on.*destructive|on.*error/i, token: 'destructiveForeground', confidence: 70 },
  { pattern: /^primary$|main.*action/i, token: 'primary', confidence: 70 },
  { pattern: /^secondary$/i, token: 'secondary', confidence: 70 },
  { pattern: /background|bg|surface/i, token: 'background', confidence: 60 },
  { pattern: /foreground|fg|text/i, token: 'foreground', confidence: 60 },
  { pattern: /border|stroke|outline/i, token: 'border', confidence: 60 },
  { pattern: /muted|subtle|disabled/i, token: 'muted', confidence: 50 },
  { pattern: /accent|highlight/i, token: 'accent', confidence: 50 },
  { pattern: /danger|error|destructive|delete/i, token: 'destructive', confidence: 50 },
];

/**
 * Map a Figma token name to a shadcn semantic token with 0-100 confidence.
 * @param {string} name
 * @returns {{ token: string|null, confidence: number }}
 */
export function mapToSemanticToken(name) {
  const normalized = String(name || '').toLowerCase().replace(/[_\s]+/g, '-');

  if (FIGMA_TO_SEMANTIC_MAP[normalized]) {
    return { token: FIGMA_TO_SEMANTIC_MAP[normalized], confidence: 100 };
  }

  const parts = normalized.split('/');
  const lastPart = parts[parts.length - 1];
  if (lastPart && FIGMA_TO_SEMANTIC_MAP[lastPart]) {
    return { token: FIGMA_TO_SEMANTIC_MAP[lastPart], confidence: 90 };
  }

  if (parts.length >= 2) {
    const a = parts[parts.length - 2];
    const b = parts[parts.length - 1];
    if (FIGMA_TO_SEMANTIC_MAP[`${a}/${b}`]) return { token: FIGMA_TO_SEMANTIC_MAP[`${a}/${b}`], confidence: 85 };
    if (FIGMA_TO_SEMANTIC_MAP[`${a}-${b}`]) return { token: FIGMA_TO_SEMANTIC_MAP[`${a}-${b}`], confidence: 85 };
  }

  for (const { pattern, token, confidence } of FUZZY_PATTERNS) {
    if (pattern.test(name)) return { token, confidence };
  }
  return { token: null, confidence: 0 };
}

// ── Stage 2: semantic → animatic brand slot ──────────────────────────────────

/**
 * shadcn semantic token → animatic `colors.*` slot. `advisory` flags a bridge
 * that needs human confirmation. Semantics absent here (secondary*, *Foreground,
 * input, chart1-5) have no clean animatic slot and are reported as unmapped.
 *
 * Note: shadcn `accent` is the hover/active tint (not a primary action color),
 * so it bridges to `accent_hover` — which lets `primary` own `accent` without a
 * collision.
 */
const SEMANTIC_TO_SLOT = {
  background: { slot: 'bg_primary', confidence: 'high' },
  card: { slot: 'bg_surface', confidence: 'high' },
  popover: { slot: 'bg_elevated', confidence: 'medium' },
  foreground: { slot: 'text_primary', confidence: 'high' },
  mutedForeground: { slot: 'text_secondary', confidence: 'medium' },
  primary: { slot: 'accent', confidence: 'high' },
  accent: { slot: 'accent_hover', confidence: 'medium', advisory: 'shadcn "accent" → accent_hover; confirm it is the hover/active tint, not a primary action color' },
  border: { slot: 'border', confidence: 'high' },
  ring: { slot: 'border_active', confidence: 'medium' },
  destructive: { slot: 'trend_down', confidence: 'low', advisory: 'shadcn "destructive" → trend_down (finance-specific); confirm semantics' },
};

// ── Value helpers ─────────────────────────────────────────────────────────────

const isFigmaColor = (v) =>
  v != null && typeof v === 'object' && typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number';

const isVariableAlias = (v) =>
  v != null && typeof v === 'object' && v.type === 'VARIABLE_ALIAS' && typeof v.id === 'string';

/**
 * Resolve a mode value to a concrete Figma color, following VARIABLE_ALIAS hops
 * within the same mode. Returns null on an unresolvable/cyclic alias.
 */
function resolveColor(value, modeId, variables, visited = new Set()) {
  if (isFigmaColor(value)) return value;
  if (isVariableAlias(value)) {
    if (visited.has(value.id)) return null; // cycle guard
    visited.add(value.id);
    const target = variables[value.id];
    if (!target) return null;
    return resolveColor(target.valuesByMode?.[modeId], modeId, variables, visited);
  }
  return null;
}

/** Detect light/dark mode ids for a collection (ported from Preset). */
function detectModes(collection) {
  const modes = collection?.modes || [];
  let lightModeId = null;
  let darkModeId = null;
  for (const mode of modes) {
    const lower = String(mode.name || '').toLowerCase();
    if (lower.includes('light') || lower === 'default') lightModeId = mode.modeId;
    else if (lower.includes('dark')) darkModeId = mode.modeId;
  }
  if (!lightModeId && modes.length === 1) lightModeId = modes[0].modeId;
  if (!lightModeId) lightModeId = collection?.defaultModeId ?? null;
  return { lightModeId, darkModeId };
}

// ── Normalize the two client shapes into a common color list ─────────────────

/** Variables result → [{ figmaName, value, darkValue, reason? }]. */
function colorsFromVariables(variables, collections) {
  const modesByCollection = {};
  for (const [id, collection] of Object.entries(collections || {})) {
    modesByCollection[id] = detectModes(collection);
  }

  const out = [];
  for (const variable of Object.values(variables || {})) {
    if (variable.hiddenFromPublishing) continue;
    if (variable.resolvedType !== 'COLOR') continue;
    const modes = modesByCollection[variable.variableCollectionId];
    if (!modes) continue;

    const rawLight = modes.lightModeId ? variable.valuesByMode?.[modes.lightModeId] : null;
    const light = resolveColor(rawLight, modes.lightModeId, variables);
    if (!light) {
      out.push({ figmaName: variable.name, value: null, reason: isVariableAlias(rawLight) ? 'unresolved alias' : 'no resolvable color value' });
      continue;
    }
    const rawDark = modes.darkModeId ? variable.valuesByMode?.[modes.darkModeId] : null;
    const dark = resolveColor(rawDark, modes.darkModeId, variables);
    out.push({
      figmaName: variable.name,
      value: figmaColorToHex(light),
      darkValue: dark ? figmaColorToHex(dark) : null,
    });
  }
  return out;
}

/** Styles result → [{ figmaName, value, darkValue:null }]. */
function colorsFromStyles(styles) {
  return (styles || [])
    .filter(s => s.color)
    .map(s => ({ figmaName: s.name, value: s.color, darkValue: null }));
}

// ── Public entry ─────────────────────────────────────────────────────────────

/**
 * Map a Figma fetch result to Animatic brand color slots + an advisory report.
 *
 * @param {object} input - One of the client fetch shapes:
 *   { enterprise, variables, collections } from fetchVariables, OR
 *   { styles } from fetchFileStyles.
 * @returns {{
 *   colors: Record<string,string>,
 *   darkColors: Record<string,string>,
 *   report: {
 *     source: 'variables'|'styles',
 *     mapped: Array<{ figmaName, semantic, slot, value, darkValue, nameConfidence }>,
 *     unmapped: Array<{ figmaName, value, reason }>,
 *     advisories: string[],
 *     stats: { totalColors, mappedToSlot, unmapped, lowConfidence, slotConflicts },
 *   }
 * }}
 */
export function mapFigmaToBrand(input = {}) {
  const usingVariables = input.enterprise !== false && input.variables && Object.keys(input.variables).length > 0;
  const source = usingVariables ? 'variables' : 'styles';
  const colorList = usingVariables
    ? colorsFromVariables(input.variables, input.collections)
    : colorsFromStyles(input.styles);

  const colors = {};
  const darkColors = {};
  const mapped = [];
  const unmapped = [];
  const advisories = [];
  // Track which figmaName won each slot, for conflict resolution.
  const slotOwner = {}; // slot → { figmaName, nameConfidence }
  let lowConfidence = 0;
  let slotConflicts = 0;

  for (const c of colorList) {
    if (!c.value) {
      unmapped.push({ figmaName: c.figmaName, value: null, reason: c.reason || 'no color value' });
      continue;
    }
    const { token: semantic, confidence: nameConfidence } = mapToSemanticToken(c.figmaName);
    if (!semantic) {
      unmapped.push({ figmaName: c.figmaName, value: c.value, reason: 'no semantic match for name' });
      continue;
    }
    const bridge = SEMANTIC_TO_SLOT[semantic];
    if (!bridge) {
      unmapped.push({ figmaName: c.figmaName, value: c.value, reason: `semantic "${semantic}" has no animatic brand slot` });
      continue;
    }

    const slot = bridge.slot;
    const prior = slotOwner[slot];
    if (prior && prior.nameConfidence >= nameConfidence) {
      // A higher- (or equal-) confidence token already claimed this slot.
      slotConflicts += 1;
      unmapped.push({ figmaName: c.figmaName, value: c.value, reason: `slot ${slot} already filled by "${prior.figmaName}" (higher confidence)` });
      advisories.push(`Multiple tokens map to ${slot}: kept "${prior.figmaName}", dropped "${c.figmaName}".`);
      continue;
    }
    if (prior) {
      // This token outranks the previous owner — demote the old one.
      slotConflicts += 1;
      advisories.push(`Multiple tokens map to ${slot}: replaced "${prior.figmaName}" with higher-confidence "${c.figmaName}".`);
      const demotedIdx = mapped.findIndex(m => m.slot === slot);
      if (demotedIdx !== -1) {
        const demoted = mapped.splice(demotedIdx, 1)[0];
        unmapped.push({ figmaName: demoted.figmaName, value: demoted.value, reason: `slot ${slot} reassigned to higher-confidence "${c.figmaName}"` });
      }
    }

    colors[slot] = c.value;
    if (c.darkValue) darkColors[slot] = c.darkValue;
    slotOwner[slot] = { figmaName: c.figmaName, nameConfidence };
    mapped.push({ figmaName: c.figmaName, semantic, slot, value: c.value, darkValue: c.darkValue || null, nameConfidence });

    if (nameConfidence < 80) {
      lowConfidence += 1;
      advisories.push(`Low-confidence (${nameConfidence}) name match: "${c.figmaName}" → ${semantic} → ${slot}.`);
    }
    if (bridge.advisory) advisories.push(`${bridge.advisory} (from "${c.figmaName}").`);
  }

  return {
    colors,
    darkColors,
    report: {
      source,
      mapped,
      unmapped,
      advisories,
      stats: {
        totalColors: colorList.length,
        mappedToSlot: mapped.length,
        unmapped: unmapped.length,
        lowConfidence,
        slotConflicts,
      },
    },
  };
}
