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
 */
export const TextLayer = ({ layer, style }) => {
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
