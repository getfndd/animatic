/**
 * Tests for LLM Enhancement Layer (ANI-36).
 *
 * Covers: parseJSONResponse, isLLMAvailable, fallback behavior.
 * Does NOT make real API calls — tests the parsing and fallback logic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseJSONResponse, isLLMAvailable } from '../lib/llm.js';

// ── parseJSONResponse ────────────────────────────────────────────────────────

describe('parseJSONResponse', () => {
  it('parses plain JSON array', () => {
    const result = parseJSONResponse('[{"label": "intro", "text": "Hello"}]');
    assert.deepEqual(result, [{ label: 'intro', text: 'Hello' }]);
  });

  it('parses JSON inside markdown code fence', () => {
    const input = '```json\n[{"label": "intro", "text": "Hello"}]\n```';
    const result = parseJSONResponse(input);
    assert.deepEqual(result, [{ label: 'intro', text: 'Hello' }]);
  });

  it('parses JSON inside bare code fence', () => {
    const input = '```\n[{"a": 1}]\n```';
    const result = parseJSONResponse(input);
    assert.deepEqual(result, [{ a: 1 }]);
  });

  it('parses JSON object', () => {
    const result = parseJSONResponse('{"key": "value"}');
    assert.deepEqual(result, { key: 'value' });
  });

  it('extracts array from surrounding text', () => {
    const input = 'Here are the suggestions:\n[{"index": 0}]\nHope that helps!';
    const result = parseJSONResponse(input);
    assert.deepEqual(result, [{ index: 0 }]);
  });

  it('returns null for invalid JSON', () => {
    assert.equal(parseJSONResponse('not json at all'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(parseJSONResponse(''), null);
  });

  it('handles whitespace around JSON', () => {
    const result = parseJSONResponse('  \n  [1, 2, 3]  \n  ');
    assert.deepEqual(result, [1, 2, 3]);
  });
});

// ── isLLMAvailable ───────────────────────────────────────────────────────────

describe('isLLMAvailable', () => {
  it('returns false when ANTHROPIC_API_KEY is not set', () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      assert.equal(isLLMAvailable(), false);
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('returns true when ANTHROPIC_API_KEY is set', () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    try {
      assert.equal(isLLMAvailable(), true);
    } finally {
      if (original) {
        process.env.ANTHROPIC_API_KEY = original;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });
});
