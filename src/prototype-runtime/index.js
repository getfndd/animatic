/**
 * Prototype Runtime — Declarative choreography engine for browser prototypes.
 *
 * Replaces hardcoded CSS animation-delay patterns with a phase/timeline config.
 * Uses WAAPI for sequencing. CSS for local primitives only.
 *
 * Usage:
 *   <script type="module">
 *     import { Choreographer, createFromScenes, stagger } from './prototype-runtime/index.js';
 *   </script>
 */

export { Choreographer, createFromScenes, stagger } from './choreographer.js';
