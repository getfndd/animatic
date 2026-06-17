/**
 * Render feedback loop → explainable scoring-weight recalibration (ANI-120).
 *
 * All scoring today is algorithmic against a fixed `DEFAULT_WEIGHTS`
 * (scoring.js). This module is the human-ground-truth path, MCP-native (no UI,
 * no daemon — the conversational agent is the feedback surface):
 *
 *   recordRenderFeedback   — append a human up/down verdict (+ optional
 *                            per-dimension notes) to a project's
 *                            review/feedback.json, with a full manifest snapshot.
 *   loadAllFeedback        — gather every project's feedback (scans the projects
 *                            tree directly — NOT listProjects(), whose limit=20
 *                            default would silently drop older projects).
 *   recalibrateScoringWeights — PROPOSE weight adjustments from accumulated
 *                            feedback, citing the entries that drove each one.
 *                            Returns a proposal; writes nothing. The user
 *                            applies by passing the weights to score_candidate_video.
 *
 * The recalibration is a deliberately transparent heuristic, not a model:
 * explainability is the acceptance bar. Only NAMED FAILURE (down) notes move a
 * weight — praising a dimension is not evidence to care less about it, so up-
 * notes are recorded as context but never reduce a weight.
 */

import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  PROJECTS_ROOT,
  getProject,
  saveProjectArtifact,
  readJSON,
  writeJSON,
  timestamp,
} from './projects.js';
import { SCORE_DIMENSIONS } from './comparison.js';
import { DEFAULT_WEIGHTS } from './scoring.js';

const VERDICTS = ['up', 'down'];
const FEEDBACK_REL = 'review/feedback.json';

// Recalibration tunables — named so the heuristic is easy to inspect/revise.
const DEFAULT_MIN_EVIDENCE = 3; // min down-notes before any proposal
const NUDGE_K = 0.5;            // strength of the up-weight per unit down-share
const MOVE_CAP = 0.4;           // max relative increase for a single dimension (+40%)

/** Normalize a per-dimension note value to { verdict?, note? }. */
function normalizeNote(value) {
  if (value == null) return {};
  if (typeof value === 'string') return { note: value };
  if (typeof value === 'object') {
    const out = {};
    if (value.verdict != null) out.verdict = value.verdict;
    if (value.note != null) out.note = String(value.note);
    return out;
  }
  return {};
}

/**
 * Record a human verdict against a render.
 *
 * @param {object} params
 * @param {string} params.project - Project slug or absolute path.
 * @param {'up'|'down'} params.verdict - Overall verdict.
 * @param {string} [params.render] - Explicit render path (relative to project
 *   root). Defaults to the approved → latest → master render.
 * @param {Object<string, {verdict?: string, note?: string}|string>} [params.dimension_notes]
 *   Optional per-dimension notes, keyed by SCORE_DIMENSIONS.
 * @returns {Promise<{ recorded: object, total: number, feedback_path: string }>}
 */
export async function recordRenderFeedback({ project, verdict, render, dimension_notes } = {}) {
  if (!project) throw new Error('record_render_feedback requires a project.');
  if (!VERDICTS.includes(verdict)) {
    throw new Error(`verdict must be one of ${VERDICTS.join('/')}, got ${JSON.stringify(verdict)}.`);
  }

  const proj = await getProject({ project });
  if (!proj) throw new Error(`Project not found: ${project}`);
  const root = proj.project_root;
  const entrypoints = proj.entrypoints || {};

  // Manifest snapshot — feedback is meaningless without the thing it judges.
  const manifestRel = entrypoints.root_manifest;
  const manifest = manifestRel ? await readJSON(join(root, manifestRel)) : null;
  if (!manifest) {
    throw new Error(`No manifest to attach for project "${project}" (entrypoints.root_manifest is ${manifestRel ? 'unreadable' : 'unset'}).`);
  }

  // Resolve which render the feedback is about.
  const renderRef = resolveRenderRef(render, entrypoints);
  if (!renderRef) {
    throw new Error(`No render to give feedback on for project "${project}" — no approved/latest render or master, and none supplied.`);
  }

  // Validate + normalize dimension notes against the canonical vocabulary.
  const notes = {};
  for (const [dim, raw] of Object.entries(dimension_notes || {})) {
    if (!SCORE_DIMENSIONS.includes(dim)) {
      throw new Error(`Unknown scoring dimension "${dim}". Valid: ${SCORE_DIMENSIONS.join(', ')}.`);
    }
    const n = normalizeNote(raw);
    if (n.verdict != null && !VERDICTS.includes(n.verdict)) {
      throw new Error(`dimension_notes.${dim}.verdict must be one of ${VERDICTS.join('/')}, got ${JSON.stringify(n.verdict)}.`);
    }
    // A dimension note with no explicit verdict inherits the overall verdict —
    // so the natural call `verdict:'down', dimension_notes:{clarity:'confusing'}`
    // records clarity as a down-note (and actually counts in recalibration).
    notes[dim] = { verdict: n.verdict ?? verdict, ...(n.note != null ? { note: n.note } : {}) };
  }

  const entry = {
    recorded_at: timestamp(),
    verdict,
    render_ref: renderRef,
    dimension_notes: notes,
    scene_ids: manifestSceneIds(manifest),
    manifest_snapshot: manifest,
  };

  // Append to review/feedback.json (create the array on first feedback).
  const path = join(root, FEEDBACK_REL);
  await mkdir(join(root, 'review'), { recursive: true });
  const existing = (await readJSON(path)) || [];
  const log = Array.isArray(existing) ? existing : [];
  log.push(entry);
  await writeJSON(path, log);

  // Register the pointer in project.json (review.feedback).
  await saveProjectArtifact({ project, kind: 'review', role: 'feedback', path: FEEDBACK_REL });

  return { recorded: entry, total: log.length, feedback_path: FEEDBACK_REL };
}

/** Pick the render the feedback is about: explicit → approved → latest → master. */
function resolveRenderRef(explicit, entrypoints) {
  if (explicit) return { path: explicit, role: 'explicit' };
  if (entrypoints.approved_render) return { path: entrypoints.approved_render, role: 'approved' };
  if (entrypoints.latest_render) return { path: entrypoints.latest_render, role: 'latest' };
  if (entrypoints.latest_master) return { path: entrypoints.latest_master, role: 'master' };
  return null;
}

/** Scene ids referenced by a manifest (handles `scene` and `scene_id` keys). */
function manifestSceneIds(manifest) {
  return (manifest.scenes || []).map(s => s.scene || s.scene_id || s.id).filter(Boolean);
}

/**
 * Gather feedback from every project. Scans PROJECTS_ROOT directly rather than
 * listProjects() — its limit=20 default would silently exclude older projects
 * and break the "accumulated feedback across all projects" contract.
 *
 * @param {object} [opts]
 * @param {string} [opts.root=PROJECTS_ROOT] - Projects tree to scan (tests override).
 * @returns {Promise<object[]>} Feedback entries, each tagged with `project`.
 */
export async function loadAllFeedback({ root = PROJECTS_ROOT } = {}) {
  let dirs;
  try {
    dirs = await readdir(root, { withFileTypes: true });
  } catch {
    return []; // projects/ doesn't exist yet
  }
  const all = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const log = await readJSON(join(root, d.name, FEEDBACK_REL));
    if (!Array.isArray(log)) continue;
    for (const entry of log) all.push({ ...entry, project: d.name });
  }
  return all;
}

/**
 * Propose scoring-weight adjustments from accumulated feedback — explainable by
 * construction. Only down-notes move weights; every moved dimension cites the
 * exact entries that moved it. Pure: reads feedback, writes nothing, never
 * mutates DEFAULT_WEIGHTS.
 *
 * @param {object} [opts]
 * @param {number} [opts.minEvidence=3] - Min down-notes before proposing.
 * @param {object[]} [opts.feedback] - Pre-loaded feedback (tests); else loadAllFeedback().
 * @returns {Promise<object>} { proposal | null, reason?, summary }
 */
export async function recalibrateScoringWeights({ minEvidence = DEFAULT_MIN_EVIDENCE, feedback } = {}) {
  const entries = feedback || (await loadAllFeedback());

  const summary = {
    total_feedback: entries.length,
    up: entries.filter(e => e.verdict === 'up').length,
    down: entries.filter(e => e.verdict === 'down').length,
    down_notes_by_dimension: {},
    up_notes_by_dimension: {},
    dimensions_moved: 0,
  };

  // Collect per-dimension down-note evidence (the only signal that moves weights).
  const downEvidence = {};   // dim → [{ project, render_ref, note, recorded_at }]
  for (const dim of SCORE_DIMENSIONS) downEvidence[dim] = [];
  for (const e of entries) {
    for (const [dim, n] of Object.entries(e.dimension_notes || {})) {
      if (!SCORE_DIMENSIONS.includes(dim)) continue;
      // A note's verdict falls back to the entry's overall verdict — covers
      // bare-string notes and any legacy/seeded entry that omitted it.
      const dv = n?.verdict ?? e.verdict;
      if (dv === 'down') {
        downEvidence[dim].push({ project: e.project, render_ref: e.render_ref, note: n?.note || null, recorded_at: e.recorded_at });
      } else if (dv === 'up') {
        summary.up_notes_by_dimension[dim] = (summary.up_notes_by_dimension[dim] || 0) + 1;
      }
    }
  }
  for (const dim of SCORE_DIMENSIONS) {
    if (downEvidence[dim].length) summary.down_notes_by_dimension[dim] = downEvidence[dim].length;
  }

  const totalDownNotes = Object.values(downEvidence).reduce((s, arr) => s + arr.length, 0);
  if (totalDownNotes < minEvidence) {
    return { proposal: null, reason: `insufficient evidence: ${totalDownNotes} down-note(s), need ${minEvidence}`, summary };
  }

  // Up-weight flagged dimensions, clamped, then renormalize to sum 1.0. The
  // renormalization is the only thing that reduces unflagged dimensions.
  const current = { ...DEFAULT_WEIGHTS };
  const raw = {};
  for (const dim of SCORE_DIMENSIONS) {
    const d = downEvidence[dim].length;
    const factor = d > 0 ? 1 + Math.min(MOVE_CAP, NUDGE_K * (d / totalDownNotes)) : 1;
    raw[dim] = current[dim] * factor;
  }
  const sum = Object.values(raw).reduce((s, v) => s + v, 0);
  const proposed = {};
  for (const dim of SCORE_DIMENSIONS) proposed[dim] = raw[dim] / sum;

  // Two distinct lists so the "every adjustment cites evidence" contract holds
  // literally: `adjustments` are the down-note-driven up-weights (each with its
  // citing entries); `renormalized` are the proportional reductions that absorb
  // them (no evidence — they moved only to keep the weights summing to 1.0).
  const adjustments = [];
  const renormalized = [];
  for (const dim of SCORE_DIMENSIONS) {
    const delta = round4(proposed[dim] - current[dim]);
    const row = { dimension: dim, from: round4(current[dim]), to: round4(proposed[dim]), delta };
    if (downEvidence[dim].length > 0) {
      adjustments.push({ ...row, down_notes: downEvidence[dim].length, evidence: downEvidence[dim] });
    } else if (Math.abs(delta) > 1e-6) {
      renormalized.push({ ...row, reason: 'reduced proportionally to make room' });
    }
  }
  adjustments.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  renormalized.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  summary.dimensions_moved = adjustments.length + renormalized.length;

  return {
    proposal: { current_weights: current, proposed_weights: proposed, sample_size: totalDownNotes, adjustments, renormalized },
    summary,
  };
}

const round4 = (n) => (Math.round(n * 1e4) / 1e4) || 0;
