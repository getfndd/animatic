/**
 * Storyboard ↔ Figma round-trip (ANI-113)
 *
 * The deterministic bookends around the agent-driven creation step:
 *
 *   - `verifyExportAgainstTree` — after the agent builds the Figma file
 *     from the export payload, the file tree is REST-read back and checked
 *     against the frame-naming contract. Fail-closed: a file that drifted
 *     from the payload is reported, not assumed.
 *   - `mapCommentsToScenes` — designer comments REST-read from the file
 *     map back to scenes via the `sb_<scene_id>` contract, becoming
 *     storyboard revision notes. Comments that can't be attributed land in
 *     an explicit `unmapped` bucket rather than being dropped.
 *
 * Both are pure (tree/comments in, report out); the network halves live in
 * client.js.
 */

import { STORYBOARD_FRAME_PREFIX } from './storyboard-export.js';

/** Collect all frames named with the storyboard prefix, anywhere in the tree. */
function collectStoryboardFrames(node, found = new Map(), depth = 0) {
  if (!node || depth > 6) return found;
  if (typeof node.name === 'string' && node.name.startsWith(STORYBOARD_FRAME_PREFIX)) {
    // First occurrence wins; duplicates are reported by the verifier.
    if (!found.has(node.name)) found.set(node.name, []);
    found.get(node.name).push(node.id);
  }
  for (const child of node.children || []) {
    collectStoryboardFrames(child, found, depth + 1);
  }
  return found;
}

/**
 * Map every node id at or below an sb_ frame to that frame's scene id —
 * designers pin comments to the panel image or caption INSIDE the frame
 * at least as often as to the frame itself (PR #90 review finding), so
 * attribution must cover descendants, not just frame roots. Bounded by
 * the depth of the fetched tree (fetch with depth ≥ 4).
 */
function collectNodeSceneMap(node, map = new Map(), currentScene = null, depth = 0) {
  if (!node || depth > 8) return map;
  let scene = currentScene;
  if (typeof node.name === 'string' && node.name.startsWith(STORYBOARD_FRAME_PREFIX)) {
    scene = node.name.slice(STORYBOARD_FRAME_PREFIX.length);
  }
  if (scene && node.id) map.set(node.id, scene);
  for (const child of node.children || []) {
    collectNodeSceneMap(child, map, scene, depth + 1);
  }
  return map;
}

/**
 * Verify a created Figma file against the export payload's naming contract.
 *
 * @param {object} payload - From buildStoryboardExportPayload
 * @param {object} fileTree - From fetchFileTree (document at depth ≥ 2)
 * @returns {{ ok: boolean, expected: number, found: number,
 *             missing_frames: string[], duplicate_frames: string[],
 *             extra_frames: string[], frame_ids: Record<string, string>,
 *             summary: string }}
 */
export function verifyExportAgainstTree(payload, fileTree) {
  const expected = payload?.naming_contract?.expected_frames;
  if (!Array.isArray(expected) || expected.length === 0) {
    throw new Error('verifyExportAgainstTree requires payload.naming_contract.expected_frames');
  }
  const document = fileTree?.document;
  if (!document) throw new Error('verifyExportAgainstTree requires a fileTree with document');

  const found = collectStoryboardFrames(document);
  const missing = expected.filter(name => !found.has(name));
  const duplicates = [...found.entries()].filter(([, ids]) => ids.length > 1).map(([name]) => name);
  const extra = [...found.keys()].filter(name => !expected.includes(name));

  const ok = missing.length === 0 && duplicates.length === 0 && extra.length === 0;
  const frameIds = Object.fromEntries(
    [...found.entries()].map(([name, ids]) => [name, ids[0]]),
  );

  const problems = [
    missing.length ? `missing: ${missing.join(', ')}` : null,
    duplicates.length ? `duplicated: ${duplicates.join(', ')}` : null,
    extra.length ? `unexpected: ${extra.join(', ')}` : null,
  ].filter(Boolean);

  return {
    ok,
    expected: expected.length,
    found: found.size,
    missing_frames: missing,
    duplicate_frames: duplicates,
    extra_frames: extra,
    frame_ids: frameIds,
    summary: ok
      ? `All ${expected.length} storyboard frames present and uniquely named.`
      : `Export does not match the payload contract — ${problems.join('; ')}.`,
  };
}

/**
 * Map Figma comments to storyboard scenes.
 *
 * Attribution order per comment:
 *   1. pinned node id (`client_meta.node_id`) → the sb_ frame it sits on
 *      OR inside (every fetched descendant of a frame attributes to it —
 *      fetch the tree with depth ≥ 4 so panel images/captions resolve)
 *   2. reply-thread inheritance from the parent comment
 *   3. an `sb_<scene_id>` mention in the comment text
 *   4. otherwise → `unmapped`
 *
 * Comment threads keep their structure: replies inherit the parent's
 * scene attribution.
 *
 * @param {object[]} comments - From fetchComments
 * @param {object} fileTree - From fetchFileTree (for frame id → name)
 * @returns {{ scenes: Record<string, Array<{ id, text, author, created_at, resolved }>>,
 *             unmapped: object[], total: number }}
 */
export function mapCommentsToScenes(comments, fileTree) {
  const frames = collectStoryboardFrames(fileTree?.document || {});
  // Every descendant of an sb_ frame attributes to that scene — pins land
  // on panel images and captions, not just frame roots.
  const idToScene = collectNodeSceneMap(fileTree?.document || {});

  const mentionRe = new RegExp(`${STORYBOARD_FRAME_PREFIX}([a-zA-Z0-9_]+)`);
  const parentScene = new Map(); // comment id → scene attribution for replies

  const scenes = {};
  const unmapped = [];
  const push = (sceneId, comment) => {
    if (!scenes[sceneId]) scenes[sceneId] = [];
    scenes[sceneId].push({
      id: comment.id,
      text: comment.message,
      author: comment.user?.handle || comment.user?.email || 'unknown',
      created_at: comment.created_at || null,
      resolved: Boolean(comment.resolved_at),
    });
  };

  for (const comment of comments || []) {
    let sceneId = null;

    const pinnedNode = comment.client_meta?.node_id;
    if (pinnedNode && idToScene.has(pinnedNode)) sceneId = idToScene.get(pinnedNode);

    if (!sceneId && comment.parent_id && parentScene.has(comment.parent_id)) {
      sceneId = parentScene.get(comment.parent_id);
    }

    if (!sceneId && typeof comment.message === 'string') {
      const mention = comment.message.match(mentionRe);
      if (mention) {
        const candidate = mention[1];
        // Only accept mentions of frames that actually exist in the file.
        if ([...frames.keys()].includes(`${STORYBOARD_FRAME_PREFIX}${candidate}`)) {
          sceneId = candidate;
        }
      }
    }

    if (sceneId) {
      parentScene.set(comment.id, sceneId);
      push(sceneId, comment);
    } else {
      unmapped.push({
        id: comment.id,
        text: comment.message,
        author: comment.user?.handle || comment.user?.email || 'unknown',
      });
    }
  }

  return { scenes, unmapped, total: (comments || []).length };
}
