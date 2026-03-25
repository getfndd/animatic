/**
 * SemanticRenderers — Presentational components for v3 semantic motion values.
 *
 * These render visual representations of semantic timeline properties that
 * TimelineLayer transports but TextLayer doesn't handle:
 *
 * - CounterRenderer: Animated numeric count-up/down driven by counter_value
 * - ListRenderer: Insert/reorder/remove list items driven by list_*_progress
 * - SelectionOverlay: Text selection highlight driven by selection_start/end
 * - MenuRenderer: Dropdown open/select driven by menu_open_progress + menu_selected_index
 * - FocusPulseOverlay: Ring/glow pulse driven by focus_pulse_progress
 */

// ── CounterRenderer ─────────────────────────────────────────────────────────

/**
 * Renders an animated numeric counter driven by counter_value from the timeline.
 *
 * @param {object} props
 * @param {number} props.counterValue - Current numeric value (interpolated by timeline)
 * @param {object} props.layer - Layer definition (for style + formatting)
 * @param {object} [props.style] - Container style
 */
export const CounterRenderer = ({ counterValue, layer, style }) => {
  const format = layer.counter_format || {};
  const prefix = format.prefix || '';
  const suffix = format.suffix || '';
  const decimals = format.decimals ?? 0;
  const separator = format.separator ?? ',';

  const formatted = formatNumber(counterValue, decimals, separator);

  const textStyle = {
    fontFamily: layer.style?.fontFamily || 'system-ui',
    fontSize: layer.style?.fontSize || 64,
    fontWeight: layer.style?.fontWeight || 700,
    color: layer.style?.color || '#ffffff',
    letterSpacing: layer.style?.letterSpacing || '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    ...style,
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }}>
      <span style={textStyle}>
        {prefix}{formatted}{suffix}
      </span>
    </div>
  );
};

function formatNumber(value, decimals, separator) {
  const fixed = value.toFixed(decimals);
  if (!separator) return fixed;
  const [whole, frac] = fixed.split('.');
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return frac != null ? `${withSep}.${frac}` : withSep;
}

// ── ListRenderer ────────────────────────────────────────────────────────────

/**
 * Renders a list with animated insert/remove/reorder transitions.
 *
 * - list_insert_progress (0→1): New items fade in + slide down from above
 * - list_remove_progress (0→1): Items fade out + collapse height
 * - list_reorder_progress (0→1): Items slide to new positions
 *
 * @param {object} props
 * @param {object} props.layer - Layer definition (items, insert_index, remove_index, reorder_map)
 * @param {object} props.semanticValues - { list_insert_progress, list_remove_progress, list_reorder_progress }
 * @param {object} [props.style] - Container style
 */
export const ListRenderer = ({ layer, semanticValues, style }) => {
  const items = layer.list_items || [];
  const insertProgress = semanticValues?.list_insert_progress ?? 1;
  const removeProgress = semanticValues?.list_remove_progress ?? 0;
  const reorderProgress = semanticValues?.list_reorder_progress ?? 0;

  const insertIndex = layer.list_insert_index ?? -1;
  const removeIndex = layer.list_remove_index ?? -1;
  const reorderMap = layer.list_reorder_map || null; // { from: [0,1,2], to: [2,0,1] }

  const itemHeight = layer.list_item_height || 48;
  const gap = layer.list_gap || 8;

  const textStyle = {
    fontFamily: layer.style?.fontFamily || 'system-ui',
    fontSize: layer.style?.fontSize || 16,
    fontWeight: layer.style?.fontWeight || 400,
    color: layer.style?.color || '#ffffff',
    lineHeight: `${itemHeight}px`,
    padding: '0 16px',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: `${gap}px`,
      width: '100%',
      ...style,
    }}>
      {items.map((item, i) => {
        let opacity = 1;
        let transform = 'none';
        let maxHeight = `${itemHeight}px`;

        // Insert animation: new item fades in and slides down
        if (i === insertIndex) {
          opacity = insertProgress;
          const slideY = (1 - insertProgress) * -itemHeight * 0.5;
          transform = `translateY(${slideY}px)`;
          maxHeight = `${insertProgress * itemHeight}px`;
        }

        // Remove animation: item fades out and collapses
        if (i === removeIndex) {
          opacity = 1 - removeProgress;
          maxHeight = `${(1 - removeProgress) * itemHeight}px`;
        }

        // Reorder animation: items slide to new positions
        if (reorderMap && reorderProgress > 0) {
          const fromIdx = reorderMap.from?.indexOf(i) ?? -1;
          if (fromIdx !== -1) {
            const toIdx = reorderMap.to?.[fromIdx] ?? i;
            const offset = (toIdx - i) * (itemHeight + gap) * reorderProgress;
            transform = `translateY(${offset}px)`;
          }
        }

        return (
          <div
            key={`item-${i}`}
            style={{
              opacity,
              transform,
              maxHeight,
              overflow: 'hidden',
              transition: 'none', // Frame-driven, no CSS transitions
              background: layer.list_item_bg || 'rgba(255,255,255,0.05)',
              borderRadius: layer.list_item_radius || 8,
            }}
          >
            <span style={textStyle}>
              {typeof item === 'string' ? item : item.label || item.text || `Item ${i + 1}`}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── SelectionOverlay ────────────────────────────────────────────────────────

/**
 * Renders a text selection highlight over text content.
 *
 * @param {object} props
 * @param {string} props.content - Full text content
 * @param {number} props.selectionStart - Character index where selection begins
 * @param {number} props.selectionEnd - Character index where selection ends
 * @param {object} props.layer - Layer definition (for text style)
 * @param {object} [props.style] - Container style
 */
export const SelectionOverlay = ({ content, selectionStart, selectionEnd, layer, style }) => {
  const start = Math.round(Math.max(0, selectionStart));
  const end = Math.round(Math.min(content.length, selectionEnd));

  const before = content.slice(0, start);
  const selected = content.slice(start, end);
  const after = content.slice(end);

  const textStyle = {
    fontFamily: layer.style?.fontFamily || 'system-ui',
    fontSize: layer.style?.fontSize || 16,
    fontWeight: layer.style?.fontWeight || 400,
    color: layer.style?.color || '#ffffff',
    whiteSpace: 'pre-wrap',
  };

  const highlightColor = layer.selection_color || 'rgba(56, 132, 255, 0.35)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      ...style,
    }}>
      <span style={textStyle}>
        {before}
        <span style={{ background: highlightColor, borderRadius: 2 }}>{selected}</span>
        {after}
      </span>
    </div>
  );
};

// ── MenuRenderer ────────────────────────────────────────────────────────────

/**
 * Renders a dropdown menu with open/select animations.
 *
 * - menu_open_progress (0→1): Menu expands from closed to open
 * - menu_selected_index: Which item gets the selection highlight
 *
 * @param {object} props
 * @param {object} props.layer - Layer definition (menu_items, menu_trigger)
 * @param {object} props.semanticValues - { menu_open_progress, menu_selected_index }
 * @param {object} [props.style] - Container style
 */
export const MenuRenderer = ({ layer, semanticValues, style }) => {
  const openProgress = semanticValues?.menu_open_progress ?? 0;
  const selectedIndex = semanticValues?.menu_selected_index ?? -1;

  const items = layer.menu_items || [];
  const triggerText = layer.menu_trigger || 'Select...';
  const itemHeight = layer.menu_item_height || 40;

  const menuHeight = items.length * itemHeight;
  const visibleHeight = openProgress * menuHeight;

  const textStyle = {
    fontFamily: layer.style?.fontFamily || 'system-ui',
    fontSize: layer.style?.fontSize || 14,
    color: layer.style?.color || '#ffffff',
  };

  const selectedColor = layer.menu_selected_color || 'rgba(56, 132, 255, 0.2)';
  const menuBg = layer.menu_bg || 'rgba(30, 30, 40, 0.95)';
  const triggerBg = layer.menu_trigger_bg || 'rgba(255,255,255,0.08)';

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      {/* Trigger */}
      <div style={{
        ...textStyle,
        fontWeight: 500,
        padding: '8px 16px',
        background: triggerBg,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>{triggerText}</span>
        <span style={{
          transform: `rotate(${openProgress * 180}deg)`,
          fontSize: 12,
          opacity: 0.6,
        }}>▼</span>
      </div>

      {/* Dropdown */}
      {openProgress > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: visibleHeight,
          overflow: 'hidden',
          background: menuBg,
          borderRadius: '0 0 8px 8px',
          opacity: openProgress,
        }}>
          {items.map((item, i) => {
            const isSelected = i === Math.round(selectedIndex);
            const label = typeof item === 'string' ? item : item.label || item.text || `Option ${i + 1}`;

            return (
              <div
                key={`menu-${i}`}
                style={{
                  ...textStyle,
                  height: itemHeight,
                  lineHeight: `${itemHeight}px`,
                  padding: '0 16px',
                  background: isSelected ? selectedColor : 'transparent',
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── FocusPulseOverlay ───────────────────────────────────────────────────────

/**
 * Renders a focus ring/glow pulse effect.
 *
 * - focus_pulse_progress (0→1): Drives pulse cycle (scale + opacity oscillation)
 *
 * @param {object} props
 * @param {object} props.layer - Layer definition (focus_color, focus_radius, focus_count)
 * @param {number} props.pulseProgress - Current pulse progress (0-1 per cycle)
 * @param {React.ReactNode} props.children - Content to wrap with focus ring
 * @param {object} [props.style] - Container style
 */
export const FocusPulseOverlay = ({ layer, pulseProgress, children, style }) => {
  const color = layer.focus_color || 'rgba(56, 132, 255, 0.4)';
  const radius = layer.focus_radius || 8;
  const count = layer.focus_count || 2;

  // Oscillate through pulse count
  const cycleProgress = (pulseProgress * count) % 1;
  const pulseScale = 1 + cycleProgress * 0.08;
  const pulseOpacity = Math.sin(cycleProgress * Math.PI);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      ...style,
    }}>
      {children}
      <div style={{
        position: 'absolute',
        inset: -4,
        borderRadius: radius + 4,
        border: `2px solid ${color}`,
        opacity: pulseOpacity * 0.8,
        transform: `scale(${pulseScale})`,
        pointerEvents: 'none',
        boxShadow: `0 0 ${12 * pulseOpacity}px ${color}`,
      }} />
    </div>
  );
};
