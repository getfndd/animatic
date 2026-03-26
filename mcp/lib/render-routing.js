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
 */

export const RENDER_TARGETS = ['web_native', 'browser_capture', 'remotion_native', 'hybrid'];

const COMPLEX_HTML_THRESHOLD = 500; // chars of HTML content considered "complex"
const REMOTION_NATIVE_TYPES = ['text', 'svg', 'card_conveyor', 'stack_fan_settle',
  'chart_build_explain', 'spotlight_cursor_reveal', 'moodboard', 'result_grid',
  'stacked_thumbs', 'media_strip'];

// Patterns that signal browser-dependent rendering
const BROWSER_SIGNALS = /gradient|filter|backdrop|clip-path|mask|animation|@keyframes|transform.*3d|perspective/i;

/**
 * Resolve render targets for an array of scenes.
 *
 * @param {object[]} scenes - Annotated scene definitions
 * @param {object} [options]
 * @param {object} [options.defaults] - Default capture config
 * @returns {{ routes: object[], summary: { browser_capture: number, remotion_native: number, web_native: number, hybrid: number } }}
 */
export function resolveRenderTargets(scenes, options = {}) {
  if (!scenes || !Array.isArray(scenes)) {
    return { routes: [], summary: { browser_capture: 0, remotion_native: 0, web_native: 0, hybrid: 0 } };
  }

  const defaults = options.defaults || {
    viewport: { w: 1920, h: 1080 },
    device_scale_factor: 2,
    format: 'png_sequence',
    fps: 60,
  };

  const routes = scenes.map(scene => resolveScene(scene, defaults));

  const summary = { browser_capture: 0, remotion_native: 0, web_native: 0, hybrid: 0 };
  for (const r of routes) {
    if (summary[r.render_target] != null) summary[r.render_target]++;
  }

  return { routes, summary };
}

/**
 * Resolve a single scene's render target.
 */
function resolveScene(scene, defaults) {
  const sceneId = scene.scene_id || '';
  const layers = scene.layers || [];

  // Rule 1: Explicit render_target — always trust it
  if (scene.render_target && RENDER_TARGETS.includes(scene.render_target)) {
    return {
      scene_id: sceneId,
      render_target: scene.render_target,
      reason: 'Explicitly set on scene',
      confidence: 1.0,
      capture_config: scene.render_target === 'browser_capture' ? buildCaptureConfig(scene, defaults) : null,
    };
  }

  // Rule 2: Has capture.entry pointing to HTML prototype
  if (scene.capture?.entry) {
    return {
      scene_id: sceneId,
      render_target: 'browser_capture',
      reason: `Has capture entry: ${scene.capture.entry}`,
      confidence: 0.95,
      capture_config: buildCaptureConfig(scene, defaults),
    };
  }

  // Rule 3 (early): Atmosphere/CTA/transition with any content → remotion_native
  // These scene types are always better handled by Remotion (typography, camera, logo resolve)
  const role = scene.product_role;
  if (role === 'atmosphere' || role === 'cta' || role === 'transition') {
    return {
      scene_id: sceneId,
      render_target: 'remotion_native',
      reason: `${role} scene — Remotion handles typography, camera, and logo resolve natively`,
      confidence: 0.85,
    };
  }

  // Analyze layers
  const heroLayer = layers.find(l => l.product_role === 'hero')
    || layers.find(l => l.depth_class === 'foreground')
    || layers[0];

  const htmlLayers = layers.filter(l => l.type === 'html' && l.depth_class !== 'background');
  const nativeLayers = layers.filter(l => REMOTION_NATIVE_TYPES.includes(l.type));
  const totalFgLayers = layers.filter(l => l.depth_class !== 'background').length;

  // Rule 3: Hero is complex HTML → browser_capture
  if (heroLayer?.type === 'html') {
    const content = typeof heroLayer.content === 'string' ? heroLayer.content : '';
    const isComplex = content.length > COMPLEX_HTML_THRESHOLD || BROWSER_SIGNALS.test(content);

    if (isComplex) {
      return {
        scene_id: sceneId,
        render_target: 'browser_capture',
        reason: `Hero layer "${heroLayer.id}" is complex HTML (${content.length} chars${BROWSER_SIGNALS.test(content) ? ', has browser-dependent CSS' : ''})`,
        confidence: 0.85,
        capture_config: buildCaptureConfig(scene, defaults),
      };
    }
  }

  // Rule 4: Majority HTML foreground layers → browser_capture
  if (htmlLayers.length > 0 && totalFgLayers > 0 && htmlLayers.length / totalFgLayers > 0.5) {
    const totalContent = htmlLayers.reduce((s, l) => s + (typeof l.content === 'string' ? l.content.length : 0), 0);
    if (totalContent > COMPLEX_HTML_THRESHOLD) {
      return {
        scene_id: sceneId,
        render_target: 'browser_capture',
        reason: `${htmlLayers.length}/${totalFgLayers} foreground layers are HTML (${totalContent} total chars)`,
        confidence: 0.75,
        capture_config: buildCaptureConfig(scene, defaults),
      };
    }
  }

  // Rule 5: Mostly native Remotion types → remotion_native
  if (nativeLayers.length > 0 && totalFgLayers > 0 && nativeLayers.length / totalFgLayers >= 0.5) {
    return {
      scene_id: sceneId,
      render_target: 'remotion_native',
      reason: `${nativeLayers.length}/${totalFgLayers} foreground layers are Remotion-native types`,
      confidence: 0.8,
    };
  }

  // (Atmosphere/CTA/transition already handled above)

  // Rule 7: Has video/image hero → remotion_native (Remotion handles media well)
  if (heroLayer?.type === 'video' || heroLayer?.type === 'image') {
    return {
      scene_id: sceneId,
      render_target: 'remotion_native',
      reason: `Hero is ${heroLayer.type} — Remotion handles media natively`,
      confidence: 0.8,
    };
  }

  // Rule 8: Hybrid — has both complex HTML and native layers
  if (htmlLayers.length > 0 && nativeLayers.length > 0) {
    return {
      scene_id: sceneId,
      render_target: 'hybrid',
      reason: `Mix of HTML (${htmlLayers.length}) and native (${nativeLayers.length}) layers`,
      confidence: 0.6,
      capture_config: buildCaptureConfig(scene, defaults),
    };
  }

  // Default: small HTML or unknown → remotion_native
  return {
    scene_id: sceneId,
    render_target: 'remotion_native',
    reason: 'Default — no strong signal for browser capture',
    confidence: 0.5,
  };
}

/**
 * Build capture configuration for a browser_capture scene.
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
