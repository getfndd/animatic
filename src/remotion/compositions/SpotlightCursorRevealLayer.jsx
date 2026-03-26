/**
 * SpotlightCursorRevealLayer — Renders a cursor-click-spotlight reveal in Remotion.
 *
 * Consumes usePhysicsEngine with spotlight-cursor-reveal init/step to produce
 * deterministic, frame-addressed cursor position, click animation, and
 * radial spotlight expansion.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "feature_demo",
 *   "type": "spotlight_cursor_reveal",
 *   "content": {
 *     "cursorStyle": "pointer",
 *     "spotlightTarget": "Dashboard",
 *     "revealContent": "Real-time analytics at your fingertips"
 *   },
 *   "cursor_config": {
 *     "cursorPath": [
 *       { "x": 200, "y": 200, "t": 0 },
 *       { "x": 600, "y": 400, "t": 0.5 },
 *       { "x": 960, "y": 540, "t": 1 }
 *     ]
 *   }
 * }
 * ```
 *
 * @module compositions/SpotlightCursorRevealLayer
 */

import { AbsoluteFill } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
} from '../physics/spotlight-cursor-reveal.js';

export const SpotlightCursorRevealLayer = ({ layer }) => {
  const content = layer.content || {};
  const config = { ...DEFAULTS, ...(layer.cursor_config || {}) };

  const state = usePhysicsEngine({
    init: createInit(config),
    step: createStep(config),
  });

  if (!state) return null;

  const cursorColor = '#f3f4f6';
  const glowColor = config.glowColor || DEFAULTS.glowColor;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
      }}
    >
      {/* Dimmed background layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          opacity: state.spotlightOpacity * 0.8,
        }}
      />

      {/* Spotlight radial reveal mask */}
      {state.spotlightRadius > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle ${state.spotlightRadius}px at ${state.clickX}px ${state.clickY}px, ${glowColor} 0%, transparent 70%)`,
            opacity: state.spotlightOpacity,
          }}
        />
      )}

      {/* Reveal content (visible through spotlight) */}
      {state.revealOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: state.clickX - 160,
            top: state.clickY + 40,
            width: 320,
            textAlign: 'center',
            opacity: state.revealOpacity,
          }}
        >
          {content.spotlightTarget && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(99,102,241,0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {content.spotlightTarget}
            </div>
          )}
          {content.revealContent && (
            <div
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: '#f3f4f6',
                lineHeight: 1.5,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '-0.01em',
              }}
            >
              {content.revealContent}
            </div>
          )}
        </div>
      )}

      {/* Click ripple ring */}
      {state.rippleOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: state.clickX - config.rippleMaxRadius,
            top: state.clickY - config.rippleMaxRadius,
            width: config.rippleMaxRadius * 2,
            height: config.rippleMaxRadius * 2,
            borderRadius: '50%',
            border: `2px solid ${cursorColor}`,
            transform: `scale(${state.rippleScale})`,
            opacity: state.rippleOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Cursor */}
      {state.cursorOpacity > 0 && (
        <svg
          width={config.cursorSize}
          height={config.cursorSize}
          viewBox="0 0 24 24"
          style={{
            position: 'absolute',
            left: state.cursorX,
            top: state.cursorY,
            transform: `scale(${state.cursorScale})`,
            opacity: state.cursorOpacity,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
          }}
        >
          {/* Default cursor arrow */}
          <path
            d="M5 3l14 8.5L12.5 13l-1.5 7L5 3z"
            fill={cursorColor}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </AbsoluteFill>
  );
};
