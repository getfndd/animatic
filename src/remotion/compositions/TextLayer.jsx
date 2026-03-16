import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import {
  getWordRevealState,
  getScaleCascadePosition,
  getWeightMorphValue,
  TEXT_ANIMATION_DEFAULTS,
} from '../lib.js';

/**
 * TextLayer — Renders frame-synced text animations within the Remotion pipeline.
 *
 * Unlike HTML layers (rendered via iframe), TextLayer uses native React spans
 * driven by useCurrentFrame(), enabling precise per-frame animation control.
 *
 * Supports 3 animation primitives:
 * - word-reveal: Words appear sequentially with opacity + translateY
 * - scale-cascade: Text at 3 scales scrolling at different speeds
 * - weight-morph: Font weight animates with per-character stagger wave
 *
 * @param {object} props
 * @param {object} props.layer - Layer definition from scene JSON
 * @param {object} props.style - Container style from SceneLayer (entrance, blend, position)
 * @param {object} props.entrance - Resolved entrance primitive state
 */
export const TextLayer = ({ layer, style, entrance, semanticValues }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textStyle = {
    fontFamily: layer.style?.fontFamily || 'system-ui',
    fontSize: layer.style?.fontSize || 72,
    fontWeight: layer.style?.fontWeight || 700,
    color: layer.style?.color || '#ffffff',
    textTransform: layer.style?.textTransform || 'none',
    textAlign: layer.style?.textAlign || 'center',
    letterSpacing: layer.style?.letterSpacing || 'normal',
    lineHeight: layer.style?.lineHeight || 1.1,
  };

  const content = layer.content || '';

  // Timeline-driven text replace
  if (semanticValues?.text_replace_progress != null) {
    const align = textStyle.textAlign || 'center';
    const caretOpacity = semanticValues.caret_opacity ?? null;
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: align === 'left' ? 'flex-end' : 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        padding: align === 'left' ? '0 0 4px 4px' : 0,
      }}>
        <TextReplaceRenderer
          oldContent={layer.replace_from || content}
          newContent={layer.replace_to || content}
          progress={semanticValues.text_replace_progress}
          caretOpacity={caretOpacity}
          textStyle={textStyle}
        />
      </div>
    );
  }

  if (entrance?.mode === 'typewriter') {
    const align = textStyle.textAlign || 'center';
    const caretOpacity = semanticValues?.caret_opacity ?? null;
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: align === 'left' ? 'flex-end' : 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        padding: align === 'left' ? '0 0 4px 4px' : 0,
      }}>
        <TypewriterRenderer content={content} progress={entrance.progress} textStyle={textStyle} caretOpacity={caretOpacity} />
      </div>
    );
  }

  switch (layer.animation) {
    case 'word-reveal':
      return (
        <div style={style}>
          <WordRevealRenderer content={content} progress={progress} textStyle={textStyle} />
        </div>
      );
    case 'scale-cascade':
      return (
        <div style={style}>
          <ScaleCascadeRenderer content={content} progress={progress} textStyle={textStyle} viewportHeight={height} />
        </div>
      );
    case 'weight-morph':
      return (
        <div style={style}>
          <WeightMorphRenderer
            content={content}
            progress={progress}
            textStyle={textStyle}
            startWeight={layer.style?.fontWeightStart || TEXT_ANIMATION_DEFAULTS.WEIGHT_MORPH_MIN}
            endWeight={layer.style?.fontWeightEnd || TEXT_ANIMATION_DEFAULTS.WEIGHT_MORPH_MAX}
          />
        </div>
      );
    default:
      return (
        <div style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={textStyle}>{content}</span>
        </div>
      );
  }
};

const TypewriterRenderer = ({ content, progress, textStyle, caretOpacity }) => {
  const totalChars = content.length;
  const visibleChars = Math.max(0, Math.min(totalChars, Math.round(totalChars * progress)));
  const visibleText = content.slice(0, visibleChars);

  // Use timeline-driven caret opacity when available, otherwise fall back to blink logic
  const cursorVisible = caretOpacity != null
    ? caretOpacity > 0
    : (progress < 1 && Math.floor(progress * 16) % 2 === 0);
  const cursorOpacity = caretOpacity != null ? caretOpacity : 0.8;

  return (
    <span style={{ ...textStyle, whiteSpace: 'pre-wrap' }}>
      {visibleText}
      {cursorVisible && <span style={{ opacity: cursorOpacity }}>|</span>}
    </span>
  );
};

/**
 * TextReplaceRenderer — Cross-fades old text to new text using text_replace_progress.
 *
 * progress < 0.5: old text fading out (opacity 1 → 0)
 * progress >= 0.5: new text fading in (opacity 0 → 1)
 */
const TextReplaceRenderer = ({ oldContent, newContent, progress, caretOpacity, textStyle }) => {
  const isFirstHalf = progress < 0.5;
  const displayText = isFirstHalf ? oldContent : newContent;
  const textOpacity = isFirstHalf
    ? 1 - (progress * 2)   // 1 → 0 over first half
    : (progress - 0.5) * 2; // 0 → 1 over second half

  const showCaret = caretOpacity != null && caretOpacity > 0;

  return (
    <span style={{ ...textStyle, whiteSpace: 'pre-wrap' }}>
      <span style={{ opacity: textOpacity }}>{displayText}</span>
      {showCaret && <span style={{ opacity: caretOpacity }}>|</span>}
    </span>
  );
};

/**
 * Words appear sequentially with opacity + translateY.
 */
const WordRevealRenderer = ({ content, progress, textStyle }) => {
  const words = content.split(/\s+/).filter(Boolean);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      flexWrap: 'wrap',
      gap: '0.3em',
    }}>
      {words.map((word, i) => {
        const state = getWordRevealState(i, words.length, progress);
        return (
          <span
            key={i}
            style={{
              ...textStyle,
              display: 'inline-block',
              opacity: state.opacity,
              transform: `translateY(${state.translateY}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Same text at 3 scales scrolling vertically at different speeds.
 * Based on the kinetic-type-scale-cascade breakdown reference.
 */
const ScaleCascadeRenderer = ({ content, progress, textStyle, viewportHeight }) => {
  const layers = TEXT_ANIMATION_DEFAULTS.SCALE_CASCADE_SCALES.map((_, i) => {
    const { y, scale } = getScaleCascadePosition(i, progress, viewportHeight);
    return { y, scale, index: i };
  });

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    }}>
      {layers.map(({ y, scale, index }) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            transform: `translateY(${y}px)`,
            opacity: index === layers.length - 1 ? 1 : 0.3,
          }}
        >
          <span style={{
            ...textStyle,
            fontSize: (textStyle.fontSize || 72) * scale,
            whiteSpace: 'nowrap',
          }}>
            {content}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Font weight animates with per-character stagger wave.
 */
const WeightMorphRenderer = ({ content, progress, textStyle, startWeight, endWeight }) => {
  const chars = content.split('');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }}>
      {chars.map((char, i) => {
        const weight = getWeightMorphValue(progress, startWeight, endWeight, i, chars.length);
        return (
          <span
            key={i}
            style={{
              ...textStyle,
              fontWeight: weight,
              display: 'inline-block',
              whiteSpace: char === ' ' ? 'pre' : 'normal',
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
};
