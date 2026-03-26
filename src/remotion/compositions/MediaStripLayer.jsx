/**
 * MediaStripLayer — Renders a horizontal scrolling filmstrip in Remotion.
 *
 * Consumes usePhysicsEngine with media-strip init/step to produce
 * deterministic, frame-addressed scroll positions. Items scroll
 * horizontally with optional pause-at points for editorial pacing.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "film_reel",
 *   "type": "media_strip",
 *   "items": [
 *     { "src": "...", "caption": "Frame 1" }
 *   ],
 *   "strip_config": { ... } // optional overrides to DEFAULTS
 * }
 * ```
 *
 * @module compositions/MediaStripLayer
 */

import { AbsoluteFill, Img } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
  computeStripVisuals,
} from '../physics/media-strip.js';

export const MediaStripLayer = ({ layer }) => {
  const items = layer.items || [];
  const config = { ...DEFAULTS, ...(layer.strip_config || {}) };

  const state = usePhysicsEngine({
    init: createInit(items.length, config),
    step: createStep(config),
  });

  if (!state) return null;

  const vis = computeStripVisuals(state, config);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        opacity: vis.opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: config.strip_y - config.item_height / 2,
          left: 0,
          height: config.item_height + 32, // Extra space for captions
          display: 'flex',
          gap: config.gap,
          transform: `translateX(${-vis.scrollX}px)`,
          willChange: 'transform',
        }}
      >
        {items.map((item, i) => {
          const itemVis = vis.items[i];
          if (!itemVis || !itemVis.visible) return null;

          return (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: config.item_width,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Image */}
              <div
                style={{
                  width: config.item_width,
                  height: config.item_height,
                  borderRadius: config.item_radius,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {item.src && (
                  <Img
                    src={item.src}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </div>

              {/* Caption */}
              {item.caption && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'rgba(243,244,246,0.5)',
                    textAlign: 'center',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.caption}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
