/**
 * CardConveyorLayer — Renders a Z-space card conveyor in Remotion.
 *
 * Consumes usePhysicsEngine with card-conveyor init/step to produce
 * deterministic, frame-addressed card positions. Each card is rendered
 * with translate3d + rotateX (from physics) inside a perspective stage.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "insight_conveyor",
 *   "type": "card_conveyor",
 *   "stories": [
 *     { "title": "...", "excerpt": "...", "meta": "...", "trend": "↗", "trendColor": "#34d399" }
 *   ],
 *   "conveyor_config": { ... } // optional overrides to DEFAULTS
 * }
 * ```
 *
 * @module compositions/CardConveyorLayer
 */

import { AbsoluteFill } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
  computeCardVisuals,
} from '../physics/card-conveyor.js';

export const CardConveyorLayer = ({ layer }) => {
  const stories = layer.stories || [];
  const config = { ...DEFAULTS, ...(layer.conveyor_config || {}) };

  const state = usePhysicsEngine({
    init: createInit(stories.length, config),
    step: createStep(config),
  });

  if (!state || !state.cards) return null;

  return (
    <AbsoluteFill
      style={{
        perspective: '1900px',
        perspectiveOrigin: '50% 24%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
        }}
      >
        {state.cards.map((card) => {
          const vis = computeCardVisuals(card, state, config);
          const story = stories[vis.contentIndex] || {};

          return (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: config.cardTop ?? 318,
                width: config.cardWidth ?? 680,
                marginLeft: -(config.cardWidth ?? 680) / 2,
                transformOrigin: 'center 0%',
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
                transform: `translate3d(0px, ${vis.y}px, ${vis.z}px) rotateX(${vis.tilt}deg)`,
                opacity: vis.opacity,
                zIndex: vis.zIndex,
              }}
            >
              <div
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  background: layer.card_background || '#1c2030',
                  border: vis.isPicked
                    ? '1px solid rgba(99,102,241,0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  boxShadow: vis.isPicked
                    ? '0 18px 42px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.2)'
                    : '0 3px 14px rgba(0,0,0,0.3)',
                  color: '#f3f4f6',
                  transformOrigin: 'center center',
                  transform: `translate3d(0px, ${vis.shellY}px, 0px) scale(${vis.shellScale})`,
                }}
              >
                {/* Trend icon */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                    marginTop: 2,
                    color: story.trendColor || '#94a3b8',
                  }}
                >
                  {story.trend || '↗'}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1.3,
                      marginBottom: 8,
                      letterSpacing: '-0.02em',
                      color: '#f3f4f6',
                    }}
                  >
                    {story.title || ''}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: 'rgba(243,244,246,0.5)',
                      marginBottom: 10,
                    }}
                  >
                    {story.excerpt || ''}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(243,244,246,0.3)',
                    }}
                  >
                    {story.meta || ''}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
