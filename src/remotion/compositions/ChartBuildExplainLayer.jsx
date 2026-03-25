/**
 * ChartBuildExplainLayer — Renders a bar chart build with annotation in Remotion.
 *
 * Consumes usePhysicsEngine with chart-build-explain init/step to produce
 * deterministic, frame-addressed bar heights and annotation state.
 * Bars grow, a highlight pulses, then an annotation slides in.
 *
 * Scene layer definition:
 * ```json
 * {
 *   "id": "revenue_chart",
 *   "type": "chart_build_explain",
 *   "bars": [
 *     { "label": "Q1", "value": 0.6, "color": "#6366f1" }
 *   ],
 *   "annotation": "Q3 saw 42% growth",
 *   "chart_config": { ... } // optional overrides to DEFAULTS
 * }
 * ```
 *
 * @module compositions/ChartBuildExplainLayer
 */

import { AbsoluteFill } from 'remotion';
import { usePhysicsEngine } from '../hooks/usePhysicsEngine.js';
import {
  DEFAULTS,
  createInit,
  createStep,
} from '../physics/chart-build-explain.js';

export const ChartBuildExplainLayer = ({ layer }) => {
  const bars = layer.bars || [];
  const annotation = layer.annotation || '';
  const config = { ...DEFAULTS, ...(layer.chart_config || {}) };
  const barCount = bars.length || config.barCount;
  const barValues = bars.map((b) => b.value || 0);

  const state = usePhysicsEngine({
    init: createInit(barCount, barValues, config),
    step: createStep(config),
  });

  if (!state || !state.bars) return null;

  // Chart layout: centered in viewport
  const totalChartWidth = barCount * config.barWidth + (barCount - 1) * config.barGap;
  const chartLeft = (1920 - totalChartWidth) / 2;
  const chartBottom = 1080 / 2 + config.maxBarHeight / 2 + 40;
  const labelY = chartBottom + 8;

  // Highlight bar position for annotation line
  const highlightBar = state.bars[config.highlightIndex];
  const highlightX = chartLeft + config.highlightIndex * (config.barWidth + config.barGap) + config.barWidth / 2;
  const highlightTop = highlightBar ? chartBottom - highlightBar.height : chartBottom;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
      }}
    >
      {/* SVG for bars and connecting line */}
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Bars */}
        {state.bars.map((bar, i) => {
          const content = bars[i] || {};
          const x = chartLeft + i * (config.barWidth + config.barGap);
          const barColor = content.color || '#6366f1';

          return (
            <g key={bar.id}>
              {/* Bar */}
              <rect
                x={x}
                y={chartBottom - bar.height}
                width={config.barWidth}
                height={Math.max(bar.height, 0)}
                rx={config.barRadius}
                ry={config.barRadius}
                fill={barColor}
                opacity={bar.opacity}
                transform={`scale(${bar.scale})`}
                style={{
                  transformOrigin: `${x + config.barWidth / 2}px ${chartBottom}px`,
                  transformBox: 'fill-box',
                }}
              />

              {/* Glow effect on highlighted bar */}
              {bar.glowOpacity > 0 && (
                <rect
                  x={x - 4}
                  y={chartBottom - bar.height - 4}
                  width={config.barWidth + 8}
                  height={Math.max(bar.height + 8, 0)}
                  rx={config.barRadius + 2}
                  ry={config.barRadius + 2}
                  fill="none"
                  stroke={barColor}
                  strokeWidth="2"
                  opacity={bar.glowOpacity}
                />
              )}

              {/* Label */}
              <text
                x={x + config.barWidth / 2}
                y={labelY + 16}
                textAnchor="middle"
                fill="rgba(243,244,246,0.5)"
                fontSize="12"
                fontFamily="system-ui, sans-serif"
                opacity={bar.opacity}
              >
                {content.label || ''}
              </text>
            </g>
          );
        })}

        {/* Connecting line from highlight bar to annotation */}
        {state.lineProgress > 0 && (
          <line
            x1={highlightX}
            y1={highlightTop - 8}
            x2={highlightX + 120 * state.lineProgress}
            y2={highlightTop - 48 * state.lineProgress}
            stroke="rgba(243,244,246,0.3)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity={state.lineProgress}
          />
        )}
      </svg>

      {/* Annotation callout (HTML overlay) */}
      {state.annotationOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: highlightX + 120,
            top: highlightTop - 72,
            transform: `translateX(${state.annotationX}px)`,
            opacity: state.annotationOpacity,
            maxWidth: 320,
            padding: '12px 18px',
            background: 'rgba(28,32,48,0.92)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            color: '#f3f4f6',
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          {annotation}
        </div>
      )}
    </AbsoluteFill>
  );
};
