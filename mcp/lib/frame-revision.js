/**
 * Frame evidence → bounded revisions (ANI-180)
 *
 * Turns rendered-frame findings (the ANI-178 hero-frame audit) and the cheap
 * descriptor frame-strip into the SAME bounded-op shape the structural loop
 * already uses (`{ op, target, ...params, reason }`, see generateRevisions in
 * scoring.js) so `reviseCandidateVideo` consumes them directly.
 *
 * Two-bucket return — `{ revisions, advisories }`:
 *   - `revisions` are real transforms that move the manifest.
 *   - `advisories` are `needs_annotation` entries for findings with NO bounded
 *     lever (composition geometry — centering, scale, air). They are kept OUT of
 *     the applied batch: `reviseCandidateVideo` would otherwise count a
 *     needs_annotation as a "revision" though it changes nothing, which would
 *     inflate revision_count and let the loop think it made progress. The caller
 *     reports advisories but never applies them.
 *
 * Conservative by design: only emit a transform where a real lever exists; never
 * fabricate a geometry fix the bounded ops can't actually perform.
 */

const LEGIBILITY_LOW = 0.5;   // subject_clarity / hierarchy / readable_text floor
const COMPOSITION_LOW = 0.6;  // visual_center / subject_scale / whitespace_air floor
const CONTRAST_LOW = 0.5;     // strip-level contrast floor (descriptor signal)
const SHORT_SCENE_S = 3;      // below this, a hard-to-read text scene gets more time

const COMPOSITION_GEOMETRY_AXES = ['visual_center', 'subject_scale', 'whitespace_air'];

function fmt(n) { return n == null ? 'n/a' : n.toFixed(2); }

/**
 * @param {object} heroAudit - Result of `auditHeroFrames` ({ scenes: [{ scene_id, overall, subscores }] }).
 * @param {object} [frameStrip] - Result of `scoreFrameStrip` ({ dimensions, per_scene }).
 * @param {object} manifest - Sequence manifest (for per-scene durations + order).
 * @param {Set<string>} [appliedOps] - `op:target` keys already applied this run (dedup).
 * @returns {{ revisions: object[], advisories: object[] }}
 */
export function frameFindingsToRevisions(heroAudit, frameStrip, manifest, appliedOps = new Set()) {
  const revisions = [];
  const advisories = [];
  const seen = new Set(); // op:target chosen this batch

  const durationByScene = new Map();
  for (const e of manifest?.scenes || []) {
    const id = e.scene || e.scene_id || e.id;
    if (id) durationByScene.set(id, e.duration_s);
  }

  const emit = (list, rev) => {
    const key = `${rev.op}:${rev.target ?? rev.from_scene ?? ''}`;
    if (appliedOps.has(key) || seen.has(key)) return;
    seen.add(key);
    list.push(rev);
  };

  // Per-scene hero-frame findings — worst scene first so the loop's slice(0,3)
  // spends the budget on the weakest frames.
  const scenes = [...(heroAudit?.scenes || [])]
    .filter(s => s && s.subscores && !s.missing_definition)
    .sort((a, b) => (a.overall ?? 1) - (b.overall ?? 1));

  for (const s of scenes) {
    const get = (axis) => (s.subscores[axis] && s.subscores[axis].score != null ? s.subscores[axis].score : null);
    const subjClarity = get('subject_clarity');
    const hierarchy = get('hierarchy');
    const readable = get('readable_text');

    // Weak subject / hierarchy → promote the subject layer.
    if ((subjClarity != null && subjClarity < LEGIBILITY_LOW) || (hierarchy != null && hierarchy < LEGIBILITY_LOW)) {
      emit(revisions, {
        op: 'boost_hierarchy',
        target: s.scene_id,
        reason: `${s.scene_id}: weak hero frame (subject_clarity ${fmt(subjClarity)}, hierarchy ${fmt(hierarchy)}) — promote the subject layer [source: frame]`,
        source: 'frame',
      });
    }

    // Hard-to-read text → more time if the scene is short, else strengthen hierarchy.
    if (readable != null && readable < LEGIBILITY_LOW) {
      const dur = durationByScene.get(s.scene_id);
      if (dur != null && dur < SHORT_SCENE_S) {
        emit(revisions, {
          op: 'extend_hold',
          target: s.scene_id,
          amount_s: Math.round((SHORT_SCENE_S + 0.5 - dur) * 10) / 10,
          reason: `${s.scene_id}: text hard to read at ${dur}s — extend hold [source: frame]`,
          source: 'frame',
        });
      } else {
        emit(revisions, {
          op: 'boost_hierarchy',
          target: s.scene_id,
          reason: `${s.scene_id}: text legibility ${fmt(readable)} — strengthen the text hierarchy [source: frame]`,
          source: 'frame',
        });
      }
    }

    // Composition geometry — only known weak when actually rendered+judged (verified).
    // No bounded op can recenter/rescale a layer, so this is advisory, never applied.
    const weakGeom = COMPOSITION_GEOMETRY_AXES.filter((a) => {
      const v = get(a);
      return v != null && v < COMPOSITION_LOW;
    });
    if (weakGeom.length) {
      emit(advisories, {
        op: 'needs_annotation',
        target: s.scene_id,
        reason: `${s.scene_id}: composition needs author attention (${weakGeom.join(', ')} below ${COMPOSITION_LOW}) — no bounded transform; recompose/scale by hand [source: frame]`,
        source: 'frame',
      });
    }
  }

  // Strip-level contrast (descriptor signal the hero frame doesn't cover) →
  // vary motion density on the flattest scene.
  const contrastDim = frameStrip?.dimensions?.contrast?.score;
  if (contrastDim != null && contrastDim < CONTRAST_LOW && Array.isArray(frameStrip.per_scene) && frameStrip.per_scene.length) {
    const flattest = [...frameStrip.per_scene].sort((a, b) => (a.contrast ?? 1) - (b.contrast ?? 1))[0];
    if (flattest) {
      emit(revisions, {
        op: 'adjust_density',
        target: flattest.scene_id,
        target_density: 'moderate',
        reason: `strip contrast ${fmt(contrastDim)} is flat — vary motion density on ${flattest.scene_id} [source: frame]`,
        source: 'frame',
      });
    }
  }

  return { revisions, advisories };
}
