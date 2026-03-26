/**
 * ResultGridLayer — Renders a row-by-row filling grid of result cards in Remotion.
 *
 * Consumes usePhysicsEngine with result-grid init/step to produce
 * deterministic, frame-addressed card positions. Cards enter with
 * staggered translateY + opacity, with optional highlight pulse.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "search_results",
 *   "type": "result_grid",
 *   "items": [
 *     { "title": "...", "subtitle": "...", "thumbnail": "...", "badge": "New" }
 *   ],
 *   "grid_config": { ... } // optional overrides to DEFAULTS
 * }
 * ```
 *
 * @module compositions/ResultGridLayer
 */

import { AbsoluteFill, Img } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
  computeCardVisuals,
} from '../physics/result-grid.js';

export const ResultGridLayer = ({ layer }) => {
  const items = layer.items || [];
  const config = { ...DEFAULTS, ...(layer.grid_config || {}) };

  const state = usePhysicsEngine({
    init: createInit(items.length, config),
    step: createStep(config),
  });

  if (!state || !state.cards) return null;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
      }}
    >
      {state.cards.map((card) => {
        const vis = computeCardVisuals(card, state, config);
        const content = items[vis.contentIndex] || {};
        const isHighlighted = vis.highlightGlow > 0;

        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              left: vis.x,
              top: vis.y + vis.offsetY,
              width: vis.w,
              height: config.card_height,
              willChange: 'transform, opacity',
              opacity: vis.opacity,
              borderRadius: config.card_radius,
              overflow: 'hidden',
              background: layer.card_background || '#1c2030',
              border: isHighlighted
                ? `1px solid rgba(99,102,241,${0.2 + vis.highlightGlow * 0.4})`
                : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isHighlighted
                ? `0 0 0 ${Math.round(vis.highlightGlow * 3)}px rgba(99,102,241,${vis.highlightGlow * 0.3}), 0 4px 16px rgba(0,0,0,0.3)`
                : '0 4px 16px rgba(0,0,0,0.3)',
              display: 'flex',
              gap: '12px',
              padding: '16px',
              color: '#f3f4f6',
            }}
          >
            {/* Thumbnail */}
            {content.thumbnail && (
              <div
                style={{
                  width: 80,
                  height: config.card_height - 32,
                  flexShrink: 0,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                <Img
                  src={content.thumbnail}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  color: '#f3f4f6',
                  marginBottom: 4,
                }}
              >
                {content.title || ''}
              </div>
              {content.subtitle && (
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.4,
                    color: 'rgba(243,244,246,0.5)',
                  }}
                >
                  {content.subtitle}
                </div>
              )}
            </div>

            {/* Badge */}
            {content.badge && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(99,102,241,0.15)',
                  color: 'rgba(165,180,252,0.9)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  flexShrink: 0,
                }}
              >
                {content.badge}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
