/**
 * Shot grammars for the 4 ai-demo archetypes (ANI-187, extends ANI-179).
 *
 * ANI-179 added per-archetype shot blocks to the 6 main archetypes in
 * sequence-archetypes.json. This wires the 4 ai-demo archetypes (a separate
 * catalog) into plan_sequence and gives each a distinct shot-role sequence.
 * Mirrors shot-grammar-first.test.js: distinctness + no shot_role leak.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { planSequence } from '../lib/planner.js';
import { loadSequenceArchetypes, loadAiDemoArchetypes, loadIntentMappings, loadBriefTemplates, listReferenceDocs } from '../data/loader.js';
import { STYLE_PACKS } from '../lib/planner.js';
import { ART_DIRECTION_SLUGS } from '../lib/art-direction.js';
import { COMPOSITING_PASS_SLUGS } from '../lib/compositing.js';
import { AVAILABLE_PROVIDERS as TTS_PROVIDERS } from '../lib/tts.js';
import { buildTools } from '../tools.js';

// Scenes whose ids end with archetype role slugs → deterministic role assignment.
function scenesFor(roleSuffixes) {
  return roleSuffixes.map((role, i) => ({
    scene_id: `sc_0${i + 1}_${role}`,
    duration_s: 3,
    metadata: { content_type: 'ui_screenshot', intent_tags: [] },
    layers: [{ id: 'bg', type: 'html', depth_class: 'background', content: '<div></div>' }],
  }));
}

// The four ai-demo archetypes' scene-role orders (from catalog/ai-demo-archetypes.json).
const ROLES = {
  prompt_to_answer: ['context_setup', 'prompt_input', 'thinking', 'answer_reveal', 'interaction'],
  brief_to_board: ['brief_entry', 'generation_progress', 'board_reveal', 'detail_zoom', 'refinement'],
  query_to_report: ['data_context', 'query_input', 'processing', 'chart_reveal', 'insight_callouts', 'drilldown'],
  upload_to_insight: ['upload_prompt', 'file_drop', 'extraction', 'insight_reveal', 'action_options', 'value_summary'],
};

// Expected distinct shot-role sequences (no universal list).
const EXPECTED_SHOT_ROLES = {
  prompt_to_answer: 'establish>input>anticipate>reveal>engage',
  brief_to_board: 'frame>build>unveil>inspect>refine',
  query_to_report: 'orient>ask>compute>chart>annotate>drill',
  upload_to_insight: 'present>ingest>scan>surface>act>resolve',
};

function planAiDemo(slug) {
  // `prestige` maps to editorial — all chosen axes are editorial-valid, so the
  // grammar is stamped from the template without personality correction.
  return planSequence({ scenes: scenesFor(ROLES[slug]), style: 'prestige', sequence_id: `seq_${slug}`, archetype: slug });
}

// ── reachability (acceptance #2) ─────────────────────────────────────────────────

describe('ai-demo archetypes — plan_sequence plans shot-grammar-first', () => {
  it('prompt_to_answer plans shot-grammar-first with shot_grammar from the template', () => {
    const { manifest, notes } = planAiDemo('prompt_to_answer');
    assert.equal(notes.shot_grammar_mode, 'archetype:prompt_to_answer');
    assert.equal(notes.shot_list.length, 5);
    const establish = notes.shot_list[0];
    assert.equal(establish.shot_role, 'establish');
    assert.deepEqual(establish.shot_grammar, { shot_size: 'wide', angle: 'eye_level', framing: 'center' });
    assert.ok(establish.motion_candidates.length > 0, 'shot role carries motion candidates');
    assert.ok(manifest.scenes[0].shot_grammar, 'shot_grammar reached the manifest');
  });

  it('all four ai-demo archetypes are reachable via plan_sequence({ archetype })', () => {
    for (const slug of Object.keys(ROLES)) {
      const { notes } = planAiDemo(slug);
      assert.equal(notes.shot_grammar_mode, `archetype:${slug}`, `${slug} planned shot-grammar-first`);
      assert.equal(notes.shot_list.length, ROLES[slug].length, `${slug} assigned every scene a shot`);
    }
  });

  it('the unknown-archetype error now lists ai-demo slugs (catalogs merged)', () => {
    assert.throws(
      () => planSequence({ scenes: scenesFor(['x']), style: 'prestige', archetype: 'nope' }),
      (err) => /Unknown archetype/.test(err.message) && /prompt_to_answer/.test(err.message) && /brand-teaser/.test(err.message),
    );
  });

  it('drift guard: plan_sequence archetype enum equals the union of both catalogs', () => {
    const tools = buildTools({
      STYLE_PACKS, intentMappings: loadIntentMappings(), briefTemplatesCatalog: loadBriefTemplates(),
      ART_DIRECTION_SLUGS, COMPOSITING_PASS_SLUGS, TTS_PROVIDERS, listReferenceDocs,
    });
    const enumSlugs = tools.find(t => t.name === 'plan_sequence').inputSchema.properties.archetype.enum;
    const catalogSlugs = [...loadSequenceArchetypes(), ...loadAiDemoArchetypes()].map(a => a.slug);
    assert.deepEqual([...enumSlugs].sort(), [...catalogSlugs].sort(), 'every plannable archetype must be in the schema enum (and vice-versa)');
  });
});

// ── per-archetype distinctness (no universal list) ───────────────────────────────

describe('ai-demo archetypes — distinct shot-role sequences', () => {
  it('each archetype has its own shot-role sequence', () => {
    for (const [slug, expected] of Object.entries(EXPECTED_SHOT_ROLES)) {
      const { notes } = planAiDemo(slug);
      const seq = notes.shot_list.map(s => s.shot_role).join('>');
      assert.equal(seq, expected, `${slug} shot-role sequence`);
    }
  });

  it('no two ai-demo archetypes share a shot-role sequence', () => {
    const seqs = Object.values(EXPECTED_SHOT_ROLES);
    assert.equal(new Set(seqs).size, seqs.length, 'all four sequences are distinct');
  });

  it('a within-archetype shot list varies shot_size (not one size repeated)', () => {
    const { notes } = planAiDemo('query_to_report');
    const sizes = new Set(notes.shot_list.map(s => s.shot_grammar.shot_size));
    assert.ok(sizes.size >= 2, 'the shot list uses more than one shot size');
  });
});

// ── no schema drift at the manifest boundary ─────────────────────────────────────

describe('ai-demo archetypes — no shot_role leak into the manifest', () => {
  it('every manifest shot_grammar has exactly {shot_size, angle, framing}', () => {
    for (const slug of Object.keys(ROLES)) {
      const { manifest } = planAiDemo(slug);
      for (const s of manifest.scenes) {
        assert.ok(s.shot_grammar, `${slug}: archetype path stamps shot_grammar`);
        assert.deepEqual(Object.keys(s.shot_grammar).sort(), ['angle', 'framing', 'shot_size'], `${slug}: exactly the three grammar axes`);
        assert.ok(!('shot_role' in s.shot_grammar), `${slug}: shot_role must not leak into the manifest`);
      }
    }
  });
});
