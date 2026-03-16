/**
 * Semantic Motion Critic tests — ANI-73
 *
 * Tests for each semantic detection rule and the orchestrator.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/semantic-critic.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  critiqueSemanticScene,
  detectDensityOverload,
  detectMissingFocal,
  detectSimultaneousInteractions,
  detectWeakSpacing,
  detectBadTypingCadence,
  detectUnreadableHold,
  DENSITY_LIMIT,
  MIN_READABLE_HOLD_MS,
  TYPING_SPEED_MIN_MS,
  TYPING_SPEED_MAX_MS,
  SPACING_THRESHOLD_PX,
} from '../lib/semantic-critic.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeComponents(count, opts = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `cmp_${i}`,
    type: opts.type || 'prompt_card',
    role: i === 0 && opts.heroFirst !== false ? 'hero' : 'supporting',
    ...(opts.position ? { position: { x: i * 100, y: i * 100 } } : {}),
  }));
}

function makeInteraction(id, target, kind, atMs, params = {}) {
  return {
    id,
    target,
    kind,
    timing: { at_ms: atMs },
    params,
  };
}

// ── detectDensityOverload ────────────────────────────────────────────────────

describe('detectDensityOverload', () => {
  it('detects >4 components interacting in same 500ms window', () => {
    const components = makeComponents(6);
    const interactions = components.map((c, i) =>
      makeInteraction(`int_${i}`, c.id, 'focus', 100)
    );

    const issues = detectDensityOverload(components, interactions, 300, 60);
    assert.ok(issues.length > 0, 'should detect density overload');
    assert.equal(issues[0].rule, 'semantic_density_overload');
    assert.equal(issues[0].severity, 'warning');
  });

  it('does not flag <=4 components in same window', () => {
    const components = makeComponents(4);
    const interactions = components.map((c, i) =>
      makeInteraction(`int_${i}`, c.id, 'focus', 100)
    );

    const issues = detectDensityOverload(components, interactions, 300, 60);
    assert.equal(issues.length, 0);
  });

  it('does not flag components spread across windows', () => {
    const components = makeComponents(6);
    const interactions = components.map((c, i) =>
      makeInteraction(`int_${i}`, c.id, 'focus', i * 600)
    );

    const issues = detectDensityOverload(components, interactions, 600, 60);
    assert.equal(issues.length, 0);
  });
});

// ── detectMissingFocal ───────────────────────────────────────────────────────

describe('detectMissingFocal', () => {
  it('detects no hero role with 2+ components', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card', role: 'supporting' },
      { id: 'cmp_1', type: 'result_stack', role: 'supporting' },
    ];

    const issues = detectMissingFocal(components);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].rule, 'semantic_missing_focal');
    assert.equal(issues[0].severity, 'warning');
  });

  it('does not flag when hero exists', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card', role: 'hero' },
      { id: 'cmp_1', type: 'result_stack', role: 'supporting' },
    ];

    const issues = detectMissingFocal(components);
    assert.equal(issues.length, 0);
  });

  it('does not flag single-component scenes', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card', role: 'supporting' },
    ];

    const issues = detectMissingFocal(components);
    assert.equal(issues.length, 0);
  });
});

// ── detectSimultaneousInteractions ───────────────────────────────────────────

describe('detectSimultaneousInteractions', () => {
  it('detects >3 interaction starts within 200ms', () => {
    const interactions = [
      makeInteraction('int_0', 'cmp_0', 'focus', 100),
      makeInteraction('int_1', 'cmp_1', 'focus', 120),
      makeInteraction('int_2', 'cmp_2', 'type_text', 150),
      makeInteraction('int_3', 'cmp_3', 'open_menu', 180),
    ];

    const issues = detectSimultaneousInteractions(interactions, 300, 60);
    assert.ok(issues.length > 0, 'should detect simultaneous interactions');
    assert.equal(issues[0].rule, 'semantic_simultaneous_interactions');
    assert.equal(issues[0].severity, 'info');
  });

  it('does not flag well-spaced interactions', () => {
    const interactions = [
      makeInteraction('int_0', 'cmp_0', 'focus', 0),
      makeInteraction('int_1', 'cmp_1', 'focus', 500),
      makeInteraction('int_2', 'cmp_2', 'type_text', 1000),
      makeInteraction('int_3', 'cmp_3', 'open_menu', 1500),
    ];

    const issues = detectSimultaneousInteractions(interactions, 300, 60);
    assert.equal(issues.length, 0);
  });

  it('does not flag <=3 interactions', () => {
    const interactions = [
      makeInteraction('int_0', 'cmp_0', 'focus', 100),
      makeInteraction('int_1', 'cmp_1', 'focus', 100),
      makeInteraction('int_2', 'cmp_2', 'focus', 100),
    ];

    const issues = detectSimultaneousInteractions(interactions, 300, 60);
    assert.equal(issues.length, 0);
  });
});

// ── detectWeakSpacing ────────────────────────────────────────────────────────

describe('detectWeakSpacing', () => {
  it('detects components within threshold distance', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card', position: { x: 100, y: 100 } },
      { id: 'cmp_1', type: 'result_stack', position: { x: 120, y: 110 } },
    ];

    const issues = detectWeakSpacing(components, {});
    assert.ok(issues.length > 0, 'should detect weak spacing');
    assert.equal(issues[0].rule, 'semantic_weak_spacing');
    assert.equal(issues[0].severity, 'info');
  });

  it('does not flag well-spaced components', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card', position: { x: 100, y: 100 } },
      { id: 'cmp_1', type: 'result_stack', position: { x: 300, y: 300 } },
    ];

    const issues = detectWeakSpacing(components, {});
    assert.equal(issues.length, 0);
  });

  it('skips components without position data', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card' },
      { id: 'cmp_1', type: 'result_stack' },
    ];

    const issues = detectWeakSpacing(components, {});
    assert.equal(issues.length, 0);
  });
});

// ── detectBadTypingCadence ───────────────────────────────────────────────────

describe('detectBadTypingCadence', () => {
  it('detects too-fast typing speed', () => {
    const interactions = [
      makeInteraction('int_0', 'cmp_0', 'type_text', 0, { speed: 10 }),
    ];

    const issues = detectBadTypingCadence(interactions, []);
    assert.ok(issues.length > 0);
    assert.equal(issues[0].rule, 'semantic_bad_typing_cadence');
    assert.equal(issues[0].severity, 'warning');
  });

  it('detects too-slow typing speed', () => {
    const interactions = [
      makeInteraction('int_0', 'cmp_0', 'type_text', 0, { speed: 150 }),
    ];

    const issues = detectBadTypingCadence(interactions, []);
    assert.ok(issues.length > 0);
    assert.equal(issues[0].rule, 'semantic_bad_typing_cadence');
    assert.equal(issues[0].severity, 'info');
  });

  it('does not flag speed within range', () => {
    const interactions = [
      makeInteraction('int_0', 'cmp_0', 'type_text', 0, { speed: 45 }),
    ];

    const issues = detectBadTypingCadence(interactions, []);
    assert.equal(issues.length, 0);
  });

  it('ignores non-type_text interactions', () => {
    const interactions = [
      makeInteraction('int_0', 'cmp_0', 'focus', 0, { speed: 5 }),
    ];

    const issues = detectBadTypingCadence(interactions, []);
    assert.equal(issues.length, 0);
  });
});

// ── detectUnreadableHold ─────────────────────────────────────────────────────

describe('detectUnreadableHold', () => {
  it('detects text hold shorter than minimum', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card', role: 'hero' },
    ];
    const interactions = [
      { id: 'int_0', target: 'cmp_0', kind: 'type_text', timing: { at_ms: 0 }, params: { text: 'Hi', speed: 50 } },
      { id: 'int_1', target: 'cmp_0', kind: 'replace_text', timing: { at_ms: 200 }, params: { text: 'New' } },
    ];

    const issues = detectUnreadableHold(interactions, components, 300, 60);
    assert.ok(issues.length > 0, 'should detect unreadable hold');
    assert.equal(issues[0].rule, 'semantic_unreadable_hold');
    assert.equal(issues[0].severity, 'warning');
  });

  it('does not flag sufficient hold time', () => {
    const components = [
      { id: 'cmp_0', type: 'prompt_card', role: 'hero' },
    ];
    const interactions = [
      { id: 'int_0', target: 'cmp_0', kind: 'type_text', timing: { at_ms: 0 }, params: { text: 'Hi', speed: 50 } },
      { id: 'int_1', target: 'cmp_0', kind: 'replace_text', timing: { at_ms: 2000 }, params: { text: 'New' } },
    ];

    const issues = detectUnreadableHold(interactions, components, 300, 60);
    assert.equal(issues.length, 0);
  });

  it('skips non-text component types', () => {
    const components = [
      { id: 'cmp_0', type: 'dropdown_menu', role: 'hero' },
    ];
    const interactions = [
      { id: 'int_0', target: 'cmp_0', kind: 'type_text', timing: { at_ms: 0 }, params: { text: 'Hi', speed: 50 } },
      { id: 'int_1', target: 'cmp_0', kind: 'replace_text', timing: { at_ms: 200 }, params: { text: 'New' } },
    ];

    const issues = detectUnreadableHold(interactions, components, 300, 60);
    assert.equal(issues.length, 0);
  });
});

// ── critiqueSemanticScene — integration ───────────────────────────────────────

describe('critiqueSemanticScene', () => {
  it('returns empty issues for v2 scene (no semantic block)', () => {
    const scene = { scene_id: 'test', duration_s: 4, layers: [] };
    const result = critiqueSemanticScene(scene, null);
    assert.equal(result.issues.length, 0);
  });

  it('returns combined issues for v3 scene with problems', () => {
    const scene = {
      scene_id: 'test',
      duration_s: 4,
      fps: 60,
      semantic: {
        components: [
          { id: 'cmp_0', type: 'prompt_card', role: 'supporting' },
          { id: 'cmp_1', type: 'prompt_card', role: 'supporting' },
        ],
        interactions: [
          makeInteraction('int_0', 'cmp_0', 'type_text', 0, { speed: 10 }),
        ],
      },
    };

    const result = critiqueSemanticScene(scene, null);
    assert.ok(result.issues.length >= 2, 'should have missing_focal + bad_typing_cadence');
    const rules = result.issues.map(i => i.rule);
    assert.ok(rules.includes('semantic_missing_focal'));
    assert.ok(rules.includes('semantic_bad_typing_cadence'));
  });

  it('issues have correct shape', () => {
    const scene = {
      scene_id: 'test',
      duration_s: 4,
      fps: 60,
      semantic: {
        components: [
          { id: 'cmp_0', type: 'prompt_card', role: 'supporting' },
          { id: 'cmp_1', type: 'result_stack', role: 'supporting' },
        ],
        interactions: [],
      },
    };

    const result = critiqueSemanticScene(scene, null);
    assert.ok(result.issues.length > 0);

    for (const issue of result.issues) {
      assert.ok(issue.rule, 'issue must have rule');
      assert.ok(issue.severity, 'issue must have severity');
      assert.ok('layer' in issue, 'issue must have layer field');
      assert.ok(issue.message, 'issue must have message');
      assert.ok(issue.suggestion, 'issue must have suggestion');
    }
  });
});
