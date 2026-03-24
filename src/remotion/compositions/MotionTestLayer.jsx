/**
 * MotionTestLayer — Validates that motion/react works inside Remotion.
 *
 * This is a verification component, not production code.
 * Tests that <motion.div> renders correctly in Remotion's
 * headless browser environment.
 *
 * @module compositions/MotionTestLayer
 */

import { useCurrentFrame, useVideoConfig } from 'remotion';
import { motion } from 'motion/react';

/**
 * Simple entrance animation using Motion's spring system.
 * Validates the integration path: motion/react → Remotion composition.
 */
export const MotionTestLayer = ({ layer }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(frame / (fps * 0.8), 1); // 0→1 over 0.8s

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: progress, y: 20 * (1 - progress), scale: 0.95 + 0.05 * progress }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '24px 32px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        color: '#f3f4f6',
        fontSize: '18px',
        fontWeight: 600,
      }}
    >
      {layer?.content || 'Motion.dev integration test'}
    </motion.div>
  );
};
