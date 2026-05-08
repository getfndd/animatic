/**
 * Render Target Routing
 *
 * Pure function that determines the optimal render target for each scene:
 * - web_native: real DOM for websites, not captured
 * - browser_capture: render in Puppeteer, export as PNG sequence / ProRes plate
 * - remotion_native: render directly in Remotion (typography, transitions, camera)
 * - hybrid: captured plate + native Remotion overlays
 *
 * Deterministic, testable, no side effects.
 *
 * ANI-118 — manifest overrides + personality compatibility:
 *   Resolution priority for `render_target`:
 *     1. scene.render_target              (most specific — set on scene def)
 *     2. manifest_entry.render_target     (per-scene override in the manifest)
 *     3. manifest.render_target_default   (manifest-wide default)
 *     4. auto-detect (rules below)
 *
 *   Each route carries a `personality_compat` block listing any features in
 *   the scene's CSS that the personality forbids. `options.strict = true`
 *   throws on any compatibility warning instead of returning it.
 */

export const RENDER_TARGETS = ['web_native', 'browser_capture', 'remotion_native', 'hybrid'];

const COMPLEX_HTML_THRESHOLD = 500; // chars of HTML content considered "complex"
const REMOTION_NATIVE_TYPES = ['text', 'svg', 'card_conveyor', 'stack_fan_settle',
  'chart_build_explain', 'spotlight_cursor_reveal', 'moodboard', 'result_grid',
  'stacked_thumbs', 'media_strip'];

// Patterns that signal browser-dependent rendering
const BROWSER_SIGNALS = /gradient|filter|backdrop|clip-path|mask|animation|@keyframes|transform.*3d|perspective/i;

// Rough per-scene capture cost in seconds. Browser_capture spawns Puppeteer
// + ffmpeg per scene (~8s); hybrid does the same plus a Remotion compose
// pass (~10s); remotion_native renders direct in Remotion (~1s); web_native
// isn't captured at all. Numbers are intentionally coarse — the goal is to
// surface budget pressure as the long tail grows, not to predict to the ms.
const CAPTURE_COST_SECONDS = {
  browser_capture: 8,
  hybrid: 10,
  remotion_native: 1,
  web_native: 0,
};

// Personality CSS compatibility. Values mirror catalog/camera-guardrails.json
// `personality_boundaries[*].forbidden_features`, but only the CSS-detectable
// features are encoded here — the rest (camera_movement, spring_physics) are
// runtime concerns the motion compiler/critic owns.
//
// Inlined rather than loaded from disk so render-routing stays a pure module
// with no I/O. Drift is unlikely (these rules are stable), but if guardrails
// ever change, update both. The cinematic-dark personality has no entries
// because it permits all CSS features the router can detect.
const PERSONALITY_FORBIDDEN_CSS = {
  editorial: {
    '3d_transforms': /transform[^;]*(?:perspective\(|translate3d|translateZ|rotateX|rotateY|matrix3d)/i,
    'blur_entrance': /(?:filter|backdrop-filter)[^;]*blur\(/i,
  },
  'neutral-light': {
    '3d_transforms': /transform[^;]*(?:perspective\(|translate3d|translateZ|rotateX|rotateY|matrix3d)/i,
    'blur': /(?:filter|backdrop-filter)[^;]*blur\(/i,
  },
  montage: {
    '3d_transforms': /transform[^;]*(?:perspective\(|translate3d|translateZ|rotateX|rotateY|matrix3d)/i,
    'blur': /(?:filter|backdrop-filter)[^;]*blur\(/i,
  },
  'cinematic-dark': {},
};

const KNOWN_PERSONALITIES = new Set(Object.keys(PERSONALITY_FORBIDDEN_CSS));

/** Scan a scene's layers for primitive references targeting library-driven
 * compound primitives (slug prefix lib-). Used for capture-cost telemetry. */
function isLibraryDrivenScene(scene) {
  const layers = scene?.layers || [];
  for (const l of layers) {
    if (typeof l.primitive === 'string' && l.primitive.startsWith('lib-')) return true;
    if (typeof l.entrance?.primitive === 'string' && l.entrance.primitive.startsWith('lib-')) return true;
    if (typeof l.motion?.compound === 'string' && l.motion.compound.startsWith('lib-')) return true;
  }
  return false;
}

const EMPTY_SUMMARY = () => ({
  browser_capture: 0,
  remotion_native: 0,
  web_native: 0,
  hybrid: 0,
  library_driven: 0,
  estimated_capture_seconds: 0,
  warnings: 0,
});

/**
 * Resolve render targets for an array of scenes.
 *
 * @param {object[]} scenes - Annotated scene definitions
 * @param {object} [options]
 * @param {object} [options.defaults] - Default capture config
 * @param {object} [options.manifest] - Sequence manifest. When provided,
 *   `manifest.render_target_default` becomes the global fallback and
 *   `manifest.scenes[i].render_target` becomes a per-scene override
 *   keyed by `scene` (scene_id reference). Conflicts with scene-level
 *   overrides surface as compatibility warnings.
 * @param {string} [options.personality] - Personality slug. Used to detect
 *   forbidden CSS features per scene. Falls back to `scene.personality`
 *   when omitted.
 * @param {boolean} [options.strict] - Throw on any compatibility warning
 *   instead of returning it. Default false (permissive).
 * @returns {{ routes: object[], summary: object }}
 */
export function resolveRenderTargets(scenes, options = {}) {
  if (!scenes || !Array.isArray(scenes)) {
    return { routes: [], summary: EMPTY_SUMMARY() };
  }

  const defaults = options.defaults || {
    viewport: { w: 1920, h: 1080 },
    device_scale_factor: 2,
    format: 'png_sequence',
    fps: 60,
  };

  // Build a map of scene_id → manifest entry override for O(1) lookup.
  const manifestOverrides = new Map();
  const manifestDefault = options.manifest?.render_target_default || null;
  if (options.manifest?.scenes) {
    for (const entry of options.manifest.scenes) {
      const sceneId = entry.scene || entry.scene_id;
      if (sceneId && entry.render_target) {
        manifestOverrides.set(sceneId, entry.render_target);
      }
    }
  }

  const routes = scenes.map(scene => resolveScene(scene, defaults, {
    manifestOverrides,
    manifestDefault,
    personality: options.personality,
  }));

  const summary = EMPTY_SUMMARY();
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    if (summary[r.render_target] != null) summary[r.render_target]++;
    if (isLibraryDrivenScene(scenes[i])) {
      summary.library_driven++;
      r.library_driven = true;
    }
    summary.estimated_capture_seconds += CAPTURE_COST_SECONDS[r.render_target] || 0;
    summary.warnings += r.personality_compat?.warnings?.length || 0;
  }

  if (options.strict && summary.warnings > 0) {
    const all = routes.flatMap(r =>
      (r.personality_compat?.warnings || []).map(w => `${r.scene_id}: ${w.rule} — ${w.message}`)
    );
    throw new Error(
      `resolveRenderTargets: ${summary.warnings} compatibility warning(s) in strict mode\n  ${all.join('\n  ')}`
    );
  }

  return { routes, summary };
}

/**
 * Resolve a single scene's render target. Returns a route with rationale,
 * raw signals, and a personality_compat block.
 */
function resolveScene(scene, defaults, ctx) {
  const sceneId = scene.scene_id || '';
  const layers = scene.layers || [];
  const personality = ctx.personality || scene.personality || null;
  const role = scene.product_role || null;

  // Pre-compute layer signals so they're available regardless of branch.
  const heroLayer = layers.find(l => l.product_role === 'hero')
    || layers.find(l => l.depth_class === 'foreground')
    || layers[0];
  const htmlLayers = layers.filter(l => l.type === 'html' && l.depth_class !== 'background');
  const nativeLayers = layers.filter(l => REMOTION_NATIVE_TYPES.includes(l.type));
  const totalFgLayers = layers.filter(l => l.depth_class !== 'background').length;
  const longestHtmlChars = htmlLayers.reduce((max, l) => {
    const len = typeof l.content === 'string' ? l.content.length : 0;
    return len > max ? len : max;
  }, 0);
  const browserCssHits = layers.reduce((n, l) => {
    const c = typeof l.content === 'string' ? l.content : '';
    return n + (BROWSER_SIGNALS.test(c) ? 1 : 0);
  }, 0);

  const signals = {
    html_layers: htmlLayers.length,
    native_layers: nativeLayers.length,
    total_fg_layers: totalFgLayers,
    hero_type: heroLayer?.type || null,
    longest_html_chars: longestHtmlChars,
    browser_css_hits: browserCssHits,
    scene_role: role,
    personality,
  };

  // ── Decide render_target ────────────────────────────────────────────────
  let target;
  let source;
  let reason;
  let confidence;
  const overrideWarnings = [];

  // Priority 1: scene-level explicit override.
  if (scene.render_target && RENDER_TARGETS.includes(scene.render_target)) {
    target = scene.render_target;
    source = 'explicit_scene';
    reason = 'Explicitly set on scene';
    confidence = 1.0;

    // If a manifest entry tries to override the same scene with a different
    // target, that's a conflict — scene-level wins, but surface it.
    const manifestOverride = ctx.manifestOverrides.get(sceneId);
    if (manifestOverride && manifestOverride !== scene.render_target) {
      overrideWarnings.push({
        rule: 'manifest_override_conflict',
        message: `Scene declares render_target="${scene.render_target}" but manifest entry sets "${manifestOverride}" — scene-level wins`,
      });
    }
  }
  // Priority 2: manifest entry override.
  else if (ctx.manifestOverrides.has(sceneId)) {
    const override = ctx.manifestOverrides.get(sceneId);
    if (RENDER_TARGETS.includes(override)) {
      target = override;
      source = 'explicit_manifest_entry';
      reason = `Set via manifest scene entry override`;
      confidence = 0.95;
    }
  }

  // If neither explicit override applied, run the auto-detect rules.
  if (!target) {
    // Rule: capture.entry → browser_capture
    if (scene.capture?.entry) {
      target = 'browser_capture';
      source = 'capture_entry';
      reason = `Has capture entry: ${scene.capture.entry}`;
      confidence = 0.95;
    }
    // Rule: atmosphere/cta/transition → remotion_native (typography + camera)
    else if (role === 'atmosphere' || role === 'cta' || role === 'transition') {
      target = 'remotion_native';
      source = 'role_remotion';
      reason = `${role} scene — Remotion handles typography, camera, and logo resolve natively`;
      confidence = 0.85;
    }
    // Rule: hero is complex HTML → browser_capture
    else if (heroLayer?.type === 'html'
      && (longestHtmlChars > COMPLEX_HTML_THRESHOLD || browserCssHits > 0)) {
      target = 'browser_capture';
      source = 'hero_complex_html';
      const hint = browserCssHits > 0 ? ', has browser-dependent CSS' : '';
      reason = `Hero layer "${heroLayer.id}" is complex HTML (${longestHtmlChars} chars${hint})`;
      confidence = 0.85;
    }
    // Rule: majority HTML foreground → browser_capture (when total content is meaningful)
    else if (htmlLayers.length > 0 && totalFgLayers > 0
      && htmlLayers.length / totalFgLayers > 0.5) {
      const totalContent = htmlLayers.reduce((s, l) =>
        s + (typeof l.content === 'string' ? l.content.length : 0), 0);
      if (totalContent > COMPLEX_HTML_THRESHOLD) {
        target = 'browser_capture';
        source = 'majority_html';
        reason = `${htmlLayers.length}/${totalFgLayers} foreground layers are HTML (${totalContent} total chars)`;
        confidence = 0.75;
      }
    }
    // Rule: mostly native types → remotion_native
    if (!target && nativeLayers.length > 0 && totalFgLayers > 0
      && nativeLayers.length / totalFgLayers >= 0.5) {
      target = 'remotion_native';
      source = 'mostly_native';
      reason = `${nativeLayers.length}/${totalFgLayers} foreground layers are Remotion-native types`;
      confidence = 0.8;
    }
    // Rule: video/image hero → remotion_native
    if (!target && (heroLayer?.type === 'video' || heroLayer?.type === 'image')) {
      target = 'remotion_native';
      source = 'media_hero';
      reason = `Hero is ${heroLayer.type} — Remotion handles media natively`;
      confidence = 0.8;
    }
    // Rule: hybrid mix
    if (!target && htmlLayers.length > 0 && nativeLayers.length > 0) {
      target = 'hybrid';
      source = 'hybrid_mix';
      reason = `Mix of HTML (${htmlLayers.length}) and native (${nativeLayers.length}) layers`;
      confidence = 0.6;
    }
    // Priority 3: manifest default (only when auto-detect didn't produce one).
    if (!target && ctx.manifestDefault && RENDER_TARGETS.includes(ctx.manifestDefault)) {
      target = ctx.manifestDefault;
      source = 'manifest_default';
      reason = `Manifest default render_target_default="${ctx.manifestDefault}"`;
      confidence = 0.7;
    }
    // Default: small HTML or unknown → remotion_native
    if (!target) {
      target = 'remotion_native';
      source = 'default';
      reason = 'Default — no strong signal for browser capture';
      confidence = 0.5;
    }
  }

  // ── Compatibility checks ────────────────────────────────────────────────
  const personalityWarnings = [
    ...overrideWarnings,
    ...detectPersonalityViolations(scene, personality),
    ...detectWebNativeMisuse(target, source),
  ];

  const route = {
    scene_id: sceneId,
    render_target: target,
    reason,
    source,
    confidence,
    signals,
    personality_compat: {
      ok: personalityWarnings.length === 0,
      warnings: personalityWarnings,
    },
  };
  if (target === 'browser_capture' || (target === 'hybrid' && scene.capture)) {
    route.capture_config = buildCaptureConfig(scene, defaults);
  }
  // Hybrid auto-detect with no scene.capture still wants a capture_config —
  // preserves prior behavior (capture happens for the HTML side of the mix).
  if (target === 'hybrid' && !route.capture_config) {
    route.capture_config = buildCaptureConfig(scene, defaults);
  }
  return route;
}

/**
 * Inspect each layer's CSS content for personality-forbidden features.
 * Returns a list of warnings naming the feature and the layer that uses it.
 */
function detectPersonalityViolations(scene, personality) {
  if (!personality) return [];
  if (!KNOWN_PERSONALITIES.has(personality)) {
    return [{
      rule: 'unknown_personality',
      message: `Unknown personality "${personality}" — known: ${[...KNOWN_PERSONALITIES].join(', ')}`,
    }];
  }
  const forbidden = PERSONALITY_FORBIDDEN_CSS[personality];
  const warnings = [];
  for (const layer of scene.layers || []) {
    const content = typeof layer.content === 'string' ? layer.content : '';
    if (!content) continue;
    for (const [feature, pattern] of Object.entries(forbidden)) {
      if (pattern.test(content)) {
        warnings.push({
          rule: 'personality_forbidden_feature',
          message: `Layer "${layer.id}" uses ${feature} but ${personality} personality forbids it`,
          layer: layer.id,
          feature,
        });
      }
    }
  }
  return warnings;
}

/**
 * web_native is for live-website embedding, not video rendering. If the
 * routing layer produced web_native via either explicit override path,
 * flag it so callers can fail-fast in a video pipeline. Auto-detect
 * never produces web_native — only explicit overrides — so this only
 * fires when a caller asked for it.
 */
function detectWebNativeMisuse(target, source) {
  if (target !== 'web_native') return [];
  if (source !== 'explicit_scene' && source !== 'explicit_manifest_entry') return [];
  return [{
    rule: 'web_native_in_video_context',
    message: 'web_native is for interactive prototype embedding only — not for video rendering. Choose browser_capture or remotion_native for video output',
  }];
}

/**
 * Build capture configuration for a browser_capture or hybrid scene.
 */
function buildCaptureConfig(scene, defaults) {
  return {
    entry: scene.capture?.entry || null,
    viewport: scene.capture?.viewport || defaults.viewport,
    device_scale_factor: scene.capture?.device_scale_factor || defaults.device_scale_factor,
    background: scene.capture?.background || 'opaque',
    format: scene.capture?.format || defaults.format,
    fps: scene.capture?.fps || defaults.fps,
    duration_s: scene.duration_s || 3,
  };
}
