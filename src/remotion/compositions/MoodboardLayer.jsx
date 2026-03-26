/**
 * MoodboardLayer — Renders a staggered grid of images/colors in Remotion.
 *
 * Consumes usePhysicsEngine with moodboard init/step to produce
 * deterministic, frame-addressed cell positions. Each cell fades in
 * with slight rotation randomness and soft shadows.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "inspiration_board",
 *   "type": "moodboard",
 *   "items": [
 *     { "src": "...", "alt": "...", "accent_color": "#1a1a2e" }
 *   ],
 *   "moodboard_config": { ... } // optional overrides to DEFAULTS
 * }
 * ```
 *
 * @module compositions/MoodboardLayer
 */

import { AbsoluteFill, Img } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
  computeCellVisuals,
} from '../physics/moodboard.js';

export const MoodboardLayer = ({ layer }) => {
  const items = layer.items || [];
  const config = { ...DEFAULTS, ...(layer.moodboard_config || {}) };

  const state = usePhysicsEngine({
    init: createInit(items.length, config),
    step: createStep(config),
  });

  if (!state || !state.cells) return null;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
      }}
    >
      {state.cells.map((cell) => {
        const vis = computeCellVisuals(cell, state, config);
        const content = items[vis.contentIndex] || {};

        return (
          <div
            key={cell.id}
            style={{
              position: 'absolute',
              left: vis.x,
              top: vis.y,
              width: vis.w,
              height: vis.h,
              transformOrigin: 'center center',
              willChange: 'transform, opacity',
              transform: `rotate(${vis.rotation}deg) scale(${vis.scale})`,
              opacity: vis.opacity,
              borderRadius: config.cell_radius,
              overflow: 'hidden',
              boxShadow: layer.cell_shadow || '0 4px 16px rgba(0,0,0,0.25)',
              background: content.accent_color || '#1a1a2e',
            }}
          >
            {content.src && (
              <Img
                src={content.src}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
