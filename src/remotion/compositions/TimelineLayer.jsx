import React from 'react';
import { useCurrentFrame } from 'remotion';
import {
  interpolateAllTracks,
  trackValuesToCSS,
  getParallaxFactor,
} from '../lib.js';

/**
 * TimelineLayer — Renders a single layer driven by Level 2 Motion Timeline tracks.
 *
 * Replaces the hardcoded entrance animation path for v2 scenes. Each animatable
 * property (opacity, translateX/Y, scale, rotate, filter_blur, etc.) is driven
 * by its own keyframe track with per-segment easing.
 *
 * Non-CSS properties (text_chars) are extracted and passed to children via cloneElement.
 *
 * @param {object} props
 * @param {object} props.layer - Layer definition from scene JSON
 * @param {object} props.tracks - { opacity: [{frame, value, easing}], translateX: [...], ... }
 * @param {object} props.assets - Asset lookup map
 * @param {React.ReactNode} props.children - Layer content (rendered by SceneComposition)
 */
// Semantic property keys — extracted from interpolated values and passed
// to children via cloneElement instead of being converted to CSS.
const SEMANTIC_KEYS = [
  'text_chars', 'text_replace_progress', 'caret_opacity',
  'selection_start', 'selection_end',
  'list_insert_progress', 'list_remove_progress', 'list_reorder_progress',
  'counter_value',
];

export const TimelineLayer = ({ layer, tracks, children, style: parentStyle }) => {
  const frame = useCurrentFrame();

  // Interpolate all property tracks at current frame
  const values = interpolateAllTracks(tracks, frame);

  // Extract non-CSS semantic properties before CSS conversion
  const semanticValues = {};
  let hasSemanticValues = false;
  for (const key of SEMANTIC_KEYS) {
    if (values[key] != null) {
      semanticValues[key] = values[key];
      hasSemanticValues = true;
    }
  }

  // Apply parallax scaling to translation values
  const parallaxFactor = getParallaxFactor(layer.depth_class);
  if (values.translateX != null) values.translateX *= parallaxFactor;
  if (values.translateY != null) values.translateY *= parallaxFactor;

  // Convert to CSS
  const trackCSS = trackValuesToCSS(values);

  const layerStyle = {
    position: 'absolute',
    inset: 0,
    mixBlendMode: layer.blend_mode || 'normal',
    overflow: 'hidden',
    // Apply slot positioning if present
    ...(layer.position
      ? {
          inset: 'auto',
          left: layer.position.x,
          top: layer.position.y,
          width: layer.position.w,
          height: layer.position.h,
        }
      : {}),
    // Layer-level opacity from scene definition (multiplied with track opacity)
    opacity: (trackCSS.opacity ?? 1) * (layer.opacity ?? 1),
    transform: trackCSS.transform,
    filter: trackCSS.filter,
    ...(trackCSS.clipPath ? { clipPath: trackCSS.clipPath } : {}),
    // Surface effect CSS
    ...(trackCSS.boxShadow ? { boxShadow: trackCSS.boxShadow } : {}),
    ...(trackCSS.backdropFilter ? { backdropFilter: trackCSS.backdropFilter } : {}),
    // SVG-specific CSS custom properties for inline SVG animation
    ...(trackCSS.svgProperties || {}),
    ...parentStyle,
  };

  // Pass semantic properties to children via cloneElement
  const enrichedChildren = hasSemanticValues
    ? React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              textChars: semanticValues.text_chars != null ? Math.round(semanticValues.text_chars) : undefined,
              semanticValues,
            })
          : child
      )
    : children;

  return <div style={layerStyle}>{enrichedChildren}</div>;
};
