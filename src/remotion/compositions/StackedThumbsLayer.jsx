/**
 * StackedThumbsLayer — Renders overlapping thumbnails that fan out in Remotion.
 *
 * Consumes usePhysicsEngine with stacked-thumbs init/step to produce
 * deterministic, frame-addressed thumb positions. Thumbs start stacked
 * at center with slight offsets, then fan out with spring-driven rotation.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "photo_stack",
 *   "type": "stacked_thumbs",
 *   "items": [
 *     { "src": "...", "label": "Photo 1" }
 *   ],
 *   "thumbs_config": { ... } // optional overrides to DEFAULTS
 * }
 * ```
 *
 * @module compositions/StackedThumbsLayer
 */

import { AbsoluteFill, Img } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
  computeThumbVisuals,
} from '../physics/stacked-thumbs.js';

export const StackedThumbsLayer = ({ layer }) => {
  const items = layer.items || [];
  const config = { ...DEFAULTS, ...(layer.thumbs_config || {}) };

  const state = usePhysicsEngine({
    init: createInit(items.length, config),
    step: createStep(config),
  });

  if (!state || !state.thumbs) return null;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
      }}
    >
      {state.thumbs.map((thumb) => {
        const vis = computeThumbVisuals(thumb, state, config);
        const content = items[vis.contentIndex] || {};

        return (
          <div
            key={thumb.id}
            style={{
              position: 'absolute',
              left: vis.x - config.thumb_width / 2,
              top: vis.y - config.thumb_height / 2,
              width: config.thumb_width,
              height: config.thumb_height,
              transformOrigin: 'center center',
              willChange: 'transform, opacity',
              transform: `rotate(${vis.rotate}deg) scale(${vis.scale})`,
              opacity: vis.opacity,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: layer.thumb_background || '#1c2030',
            }}
          >
            {content.src && (
              <Img
                src={content.src}
                style={{
                  width: '100%',
                  height: content.label ? 'calc(100% - 32px)' : '100%',
                  objectFit: 'cover',
                }}
              />
            )}
            {content.label && (
              <div
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(243,244,246,0.7)',
                  background: layer.thumb_background || '#1c2030',
                  letterSpacing: '-0.01em',
                }}
              >
                {content.label}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
