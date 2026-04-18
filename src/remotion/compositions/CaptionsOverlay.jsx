/**
 * CaptionsOverlay — burn-in captions layer for a scene (ANI-112).
 *
 * Renders the active caption cue at the bottom of the frame, respecting
 * canvas-relative safe zones. Typography defaults to Satoshi (vendored via
 * ANI-115) so renders stay deterministic; brand typography flows in via
 * `scene.captions_style` when the brand package supplies an override.
 *
 * Stays out of the camera rig on purpose — captions are viewer-facing chrome,
 * not scene content, so they shouldn't inherit scene transforms.
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

const DEFAULT_STYLE = {
  font_family: "'Satoshi', system-ui, -apple-system, sans-serif",
  font_weight: 700,
  // Aim for ~5% of canvas height at 1080p → ~54px. Clamp for very short scenes.
  font_size_pct: 0.05,
  color: '#ffffff',
  background: 'rgba(0, 0, 0, 0.72)',
  // Bottom safe-zone is 10% of canvas height (social-safe across IG/TikTok).
  bottom_inset_pct: 0.10,
  // Horizontal padding clamps the line away from the edges.
  horizontal_inset_pct: 0.08,
  padding_y_px: 14,
  padding_x_px: 22,
  border_radius_px: 10,
  line_height: 1.25,
};

function activeCueFrame(captions, frame, fps) {
  if (!Array.isArray(captions) || captions.length === 0) return null;
  const nowMs = (frame / fps) * 1000;
  // Use a small epsilon so cues don't flicker off exactly at their end boundary.
  for (const cue of captions) {
    if (nowMs >= cue.start_ms - 0.5 && nowMs < cue.end_ms) return cue;
  }
  return null;
}

export const CaptionsOverlay = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const captions = scene?.captions;
  if (!Array.isArray(captions) || captions.length === 0) return null;

  const cue = activeCueFrame(captions, frame, fps);
  if (!cue) return null;

  const style = { ...DEFAULT_STYLE, ...(scene.captions_style || {}) };
  const fontSizePx = Math.max(18, Math.round(height * style.font_size_pct));
  const bottomInsetPx = Math.round(height * style.bottom_inset_pct);
  const horizontalInsetPx = Math.round(width * style.horizontal_inset_pct);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        data-layer="captions"
        style={{
          position: 'absolute',
          left: horizontalInsetPx,
          right: horizontalInsetPx,
          bottom: bottomInsetPx,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: style.font_family,
            fontWeight: style.font_weight,
            fontSize: fontSizePx,
            lineHeight: style.line_height,
            color: style.color,
            background: style.background,
            padding: `${style.padding_y_px}px ${style.padding_x_px}px`,
            borderRadius: style.border_radius_px,
            textAlign: 'center',
            maxWidth: '100%',
            whiteSpace: 'pre-wrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.45)',
          }}
        >
          {cue.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
