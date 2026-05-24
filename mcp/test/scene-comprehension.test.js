/**
 * Tests for the Scene Comprehension Analyzer (ANI-121).
 *
 * Covers the deterministic heuristic core (sync), the async LLM/vision judge
 * with a mocked client, input normalization (contact sheet vs key-moment
 * strip), word-boundary keyword matching, and the deterministic fallback on
 * every LLM failure mode. No real API calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSceneComprehension,
  comprehensionHeuristic,
  isComprehensionLLMAvailable,
  COMPREHENSION_DIMENSIONS,
  __setComprehensionClientForTest,
} from '../lib/scene-comprehension.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// A well-annotated input→processing→result→cta arc.
function goodScenes() {
  return [
    {
      scene_id: 's1', product_role: 'input', primary_subject: 'prompt-box', duration_s: 3,
      interaction_truth: { has_typing: true, timing_realistic: true },
      layers: [
        { id: 'box', product_role: 'hero', clarity_weight: 5, type: 'html' },
        { id: 'label', type: 'text', clarity_weight: 2 },
      ],
    },
    {
      scene_id: 's2', product_role: 'processing', primary_subject: 'spinner', outcome: 'analyzing data', duration_s: 2.5,
      interaction_truth: { has_state_change: true },
      layers: [{ id: 'spin', product_role: 'hero', clarity_weight: 4 }],
    },
    {
      scene_id: 's3', product_role: 'result', primary_subject: 'chart', outcome: 'insight revealed', duration_s: 4,
      layers: [
        { id: 'chart', product_role: 'hero', clarity_weight: 5 },
        { id: 'cap', type: 'text', clarity_weight: 2 },
      ],
    },
    {
      scene_id: 's4', product_role: 'cta', primary_subject: 'logo', duration_s: 2,
      layers: [{ id: 'logo', product_role: 'hero', clarity_weight: 5 }],
    },
  ];
}

function goodStrip() {
  return {
    sheets: [
      { scene_id: 's1', thumbnail_description: 'Text: "Type your prompt"', duration_s: 3, layer_count: 2, energy: 'moderate', camera_move: 'static' },
      { scene_id: 's2', thumbnail_description: 'Component: spinner', duration_s: 2.5, layer_count: 1, energy: 'subtle' },
      { scene_id: 's3', thumbnail_description: 'Image: chart.png', duration_s: 4, layer_count: 2, energy: 'high' },
      { scene_id: 's4', thumbnail_description: 'Image: logo', duration_s: 2, layer_count: 1, energy: 'subtle' },
    ],
  };
}

// Unannotated, dense single scene.
function poorScenes() {
  return [
    {
      scene_id: 'x1', duration_s: 1.5,
      layers: Array.from({ length: 10 }, (_, i) => ({ id: `l${i}` })),
    },
  ];
}

function poorStrip() {
  return { sheets: [{ scene_id: 'x1', thumbnail_description: 'Scene', duration_s: 1.5, layer_count: 10 }] };
}

// ── Deterministic heuristic ─────────────────────────────────────────────────

describe('comprehensionHeuristic', () => {
  it('returns a structured zero result for empty input', () => {
    const r = comprehensionHeuristic({});
    assert.equal(r.score, 0);
    assert.equal(r.source, 'deterministic');
    assert.deepEqual(Object.keys(r.dimensions).sort(), [...COMPREHENSION_DIMENSIONS].sort());
    for (const d of COMPREHENSION_DIMENSIONS) assert.equal(r.dimensions[d], 0);
    assert.ok(r.reasoning.length > 0);
    assert.match(r.rationale, /no key frames/i);
  });

  it('scores a well-annotated arc highly with all dimensions present', () => {
    const r = comprehensionHeuristic({ frame_strip: goodStrip(), annotations: goodScenes() });
    assert.equal(r.source, 'deterministic');
    assert.ok(r.score > 0.7, `expected > 0.7, got ${r.score}`);
    assert.equal(r.dimensions.subject_clarity, 1);          // every frame names a subject
    assert.equal(r.dimensions.progression_coherence, 1);    // opens input, closes cta, arc ordered
    assert.ok(r.reasoning.length >= 4);                     // one line per dimension
    assert.match(r.rationale, /comprehension/i);
  });

  it('scores an unannotated, dense scene poorly', () => {
    const r = comprehensionHeuristic({ frame_strip: poorStrip(), annotations: poorScenes() });
    assert.ok(r.score < 0.4, `expected < 0.4, got ${r.score}`);
    assert.equal(r.dimensions.subject_clarity, 0);
    assert.equal(r.dimensions.intent_legibility, 0);
    assert.ok(r.dimensions.cognitive_load < 0.5, 'dense frame should raise cognitive load');
  });

  it('ranks the good arc above the poor scene', () => {
    const good = comprehensionHeuristic({ frame_strip: goodStrip(), annotations: goodScenes() });
    const poor = comprehensionHeuristic({ frame_strip: poorStrip(), annotations: poorScenes() });
    assert.ok(good.score > poor.score);
  });

  it('accepts a key-moment strip ({ moments }) as well as a contact sheet', () => {
    const strip = {
      moments: [
        { type: 'first_frame', scene_id: 's1', description: 'Opening: Text: "Type your prompt"' },
        { type: 'final_frame', scene_id: 's4', description: 'Closing: Image: logo' },
      ],
    };
    const r = comprehensionHeuristic({ frame_strip: strip, annotations: goodScenes() });
    assert.ok(r.score > 0, 'should produce a non-zero score from a moment strip');
    assert.ok(r.reasoning.some(line => /subject clarity/i.test(line)));
  });

  it('derives frames from annotations when no strip is supplied', () => {
    const r = comprehensionHeuristic({ annotations: goodScenes() });
    assert.ok(r.score > 0);
  });
});

// ── Word-boundary keyword matching (ANI-153 invariant) ────────────────────────

describe('intent action cues use word-boundary matching', () => {
  // "Download" contains the substring "load" but must NOT match the 'load' cue.
  const base = { product_role: 'atmosphere', duration_s: 3, layers: [{ id: 'a' }] };

  it('does not telegraph intent from a substring match ("Download" ⊅ "load")', () => {
    const strip = { sheets: [{ scene_id: 'd1', thumbnail_description: 'Text: "Download brochure"', duration_s: 3, layer_count: 1 }] };
    const annotations = [{ ...base, scene_id: 'd1' }];
    const r = comprehensionHeuristic({ frame_strip: strip, annotations });
    // role alone = 0.4 (< 0.5 legible threshold), no boundary cue → not legible.
    assert.equal(r.dimensions.intent_legibility, 0);
  });

  it('does telegraph intent from a real word cue ("Click")', () => {
    const strip = { sheets: [{ scene_id: 'c1', thumbnail_description: 'Text: "Click to start"', duration_s: 3, layer_count: 1 }] };
    const annotations = [{ ...base, scene_id: 'c1' }];
    const r = comprehensionHeuristic({ frame_strip: strip, annotations });
    // role 0.4 + telegraph 0.3 = 0.7 ≥ 0.5 → legible.
    assert.equal(r.dimensions.intent_legibility, 1);
  });
});

// ── Async LLM judge (mocked) ──────────────────────────────────────────────────

function mockJudgeResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

const validPayload = {
  score: 0.42,
  dimensions: { subject_clarity: 0.5, intent_legibility: 0.4, progression_coherence: 0.3, cognitive_load: 0.6 },
  reasoning: ['subject clear in s1', 'intent muddy in s4'],
  rationale: 'reads mostly but the close is weak',
};

describe('analyzeSceneComprehension (LLM judge)', () => {
  it('uses the LLM verdict when the client returns valid JSON (text mode)', async () => {
    __setComprehensionClientForTest({ messages: { create: async () => mockJudgeResponse(validPayload) } });
    try {
      const r = await analyzeSceneComprehension({ frame_strip: goodStrip(), annotations: goodScenes() });
      assert.equal(r.source, 'llm-text');
      assert.equal(r.score, 0.42);
      assert.equal(r.dimensions.cognitive_load, 0.6);
      assert.deepEqual(r.reasoning, validPayload.reasoning);
      assert.equal(r.rationale, validPayload.rationale);
    } finally {
      __setComprehensionClientForTest(null);
    }
  });

  it('reports vision mode when images are supplied', async () => {
    let received;
    __setComprehensionClientForTest({
      messages: {
        create: async (req) => { received = req; return mockJudgeResponse(validPayload); },
      },
    });
    try {
      const r = await analyzeSceneComprehension({
        frame_strip: goodStrip(),
        annotations: goodScenes(),
        images: [{ scene_id: 's1', media_type: 'image/png', data: 'QUJD' }],
      });
      assert.equal(r.source, 'llm-vision');
      // The request carried an image content block.
      const blocks = received.messages[0].content;
      assert.ok(blocks.some(b => b.type === 'image' && b.source?.data === 'QUJD'));
    } finally {
      __setComprehensionClientForTest(null);
    }
  });

  it('labels and orders vision stills by scene_id regardless of caller order', async () => {
    let received;
    __setComprehensionClientForTest({
      messages: { create: async (req) => { received = req; return mockJudgeResponse(validPayload); } },
    });
    try {
      // Stills supplied in REVERSE frame order, with a gap (no still for s3).
      const images = [
        { scene_id: 's4', data: 'IMG4' },
        { scene_id: 's2', data: 'IMG2' },
        { scene_id: 's1', data: 'IMG1' },
      ];
      const r = await analyzeSceneComprehension({ frame_strip: goodStrip(), annotations: goodScenes(), images });
      assert.equal(r.source, 'llm-vision');

      const blocks = received.messages[0].content;
      // Pair each image block with its immediately preceding label.
      const pairs = [];
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].type === 'image') pairs.push({ label: blocks[i - 1]?.text || '', data: blocks[i].source.data });
      }
      // Emitted in FRAME order (s1, s2, s4 — s3 has no still), each correctly labeled.
      assert.deepEqual(pairs.map(p => p.data), ['IMG1', 'IMG2', 'IMG4']);
      assert.match(pairs[0].label, /"s1"/);
      assert.match(pairs[1].label, /"s2"/);
      assert.match(pairs[2].label, /"s4"/);
    } finally {
      __setComprehensionClientForTest(null);
    }
  });

  it('clamps out-of-range scores and drops non-numeric dimensions', async () => {
    __setComprehensionClientForTest({
      messages: {
        create: async () => mockJudgeResponse({
          score: 1.8,
          dimensions: { subject_clarity: 2.0, intent_legibility: -1, progression_coherence: 'high', cognitive_load: 0.5 },
          reasoning: [],
        }),
      },
    });
    try {
      const r = await analyzeSceneComprehension({ frame_strip: goodStrip(), annotations: goodScenes() });
      assert.equal(r.score, 1);
      assert.equal(r.dimensions.subject_clarity, 1);
      assert.equal(r.dimensions.intent_legibility, 0);
      assert.equal(r.dimensions.progression_coherence, null); // non-numeric dropped
      assert.equal(r.dimensions.cognitive_load, 0.5);
      assert.ok(r.rationale); // synthesized when LLM omits it
    } finally {
      __setComprehensionClientForTest(null);
    }
  });

  it('falls back to the deterministic heuristic on malformed JSON', async () => {
    __setComprehensionClientForTest({ messages: { create: async () => ({ content: [{ type: 'text', text: 'not json {[' }] }) } });
    try {
      const r = await analyzeSceneComprehension({ frame_strip: goodStrip(), annotations: goodScenes() });
      assert.equal(r.source, 'deterministic');
      assert.ok(r.notes.some(n => /invalid/i.test(n)));
    } finally {
      __setComprehensionClientForTest(null);
    }
  });

  it('falls back to the deterministic heuristic when the client throws', async () => {
    __setComprehensionClientForTest({ messages: { create: async () => { throw new Error('rate limit'); } } });
    try {
      const r = await analyzeSceneComprehension({ frame_strip: goodStrip(), annotations: goodScenes() });
      assert.equal(r.source, 'deterministic');
      assert.ok(r.notes.some(n => /rate limit/i.test(n)));
    } finally {
      __setComprehensionClientForTest(null);
    }
  });

  it('honors options.enhance=false by staying deterministic even with a client set', async () => {
    let called = false;
    __setComprehensionClientForTest({ messages: { create: async () => { called = true; return mockJudgeResponse(validPayload); } } });
    try {
      const r = await analyzeSceneComprehension({ frame_strip: goodStrip(), annotations: goodScenes(), options: { enhance: false } });
      assert.equal(r.source, 'deterministic');
      assert.equal(called, false);
    } finally {
      __setComprehensionClientForTest(null);
    }
  });

  it('accepts the `scenes` alias for annotations', async () => {
    __setComprehensionClientForTest(null);
    const r = await analyzeSceneComprehension({ frame_strip: goodStrip(), scenes: goodScenes(), options: { enhance: false } });
    assert.ok(r.score > 0.7);
  });
});

// ── Availability flag ─────────────────────────────────────────────────────────

describe('isComprehensionLLMAvailable', () => {
  it('reflects the presence of ANTHROPIC_API_KEY', () => {
    assert.equal(isComprehensionLLMAvailable(), !!process.env.ANTHROPIC_API_KEY);
  });
});
