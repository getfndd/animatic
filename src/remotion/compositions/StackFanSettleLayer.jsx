/**
 * StackFanSettleLayer — Renders a card fan-out and spring-settle in Remotion.
 *
 * Consumes usePhysicsEngine with stack-fan-settle init/step to produce
 * deterministic, frame-addressed card positions. Cards fan out from a
 * center stack then spring-settle into a grid layout.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "feature_cards",
 *   "type": "stack_fan_settle",
 *   "cards": [
 *     { "title": "...", "description": "...", "icon": "⚡" }
 *   ],
 *   "fan_config": { ... } // optional overrides to DEFAULTS
 * }
 * ```
 *
 * @module compositions/StackFanSettleLayer
 */

import { AbsoluteFill } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
  computeCardVisuals,
} from '../physics/stack-fan-settle.js';

export const StackFanSettleLayer = ({ layer }) => {
  const cards = layer.cards || [];
  const config = { ...DEFAULTS, ...(layer.fan_config || {}) };
  const cardCount = Math.min(cards.length || config.cardCount, config.cardCount);

  const state = usePhysicsEngine({
    init: createInit(cardCount, config),
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
        const content = cards[card.id] || {};

        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              left: vis.x - config.cardWidth / 2,
              top: vis.y - config.cardHeight / 2,
              width: config.cardWidth,
              height: config.cardHeight,
              transformOrigin: 'center center',
              willChange: 'transform, opacity',
              transform: `rotate(${vis.rotate}deg) scale(${vis.scale})`,
              opacity: vis.opacity,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: layer.card_background || '#1c2030',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                color: '#f3f4f6',
                overflow: 'hidden',
              }}
            >
              {/* Icon */}
              {content.icon && (
                <div
                  style={{
                    fontSize: 24,
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {content.icon}
                </div>
              )}

              {/* Title */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  color: '#f3f4f6',
                }}
              >
                {content.title || ''}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: 'rgba(243,244,246,0.5)',
                }}
              >
                {content.description || ''}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
