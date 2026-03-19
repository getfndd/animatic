/**
 * Tests for one-shot video pipeline (ANI-93).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { generateVideo, parsePrompt } from '../lib/video.js';

// ── Prompt Parsing ──────────────────────────────────────────────────────────

describe('parsePrompt', () => {
  it('detects style from prompt', () => {
    const { style } = parsePrompt('product launch video, dramatic style');
    assert.equal(style, 'dramatic');
  });

  it('detects personality from prompt', () => {
    const { personality } = parsePrompt('cinematic-dark promo for a SaaS app');
    assert.equal(personality, 'cinematic-dark');
  });

  it('detects template from prompt', () => {
    const { brief } = parsePrompt('investor pitch deck video');
    assert.equal(brief.template, 'investor-pitch');
  });

  it('extracts duration', () => {
    const { brief } = parsePrompt('45 second explainer about AI');
    assert.equal(brief.project.duration_target_s, 45);
  });

  it('defaults to prestige style', () => {
    const { style } = parsePrompt('make a video about cats');
    assert.equal(style, 'prestige');
  });

  it('builds a valid brief structure', () => {
    const { brief } = parsePrompt('product launch for Mercury banking app');
    assert.ok(brief.project.title);
    assert.ok(brief.content.sections.length >= 2);
    assert.equal(brief.template, 'product-launch');
  });
});

// ── Full Pipeline ───────────────────────────────────────────────────────────

describe('generateVideo', () => {
  it('produces scenes + manifest + scores from a prompt', async () => {
    const result = await generateVideo('promo for a finance dashboard, prestige');

    assert.ok(!result.error, `Pipeline failed: ${result.error}`);
    assert.ok(result.scenes.length > 0, 'has scenes');
    assert.ok(result.manifest, 'has manifest');
    assert.ok(result.manifest.scenes.length > 0, 'manifest has scenes');
    assert.ok(result.scores.length > 0, 'has critique scores');
    assert.ok(result.summary, 'has summary');
  });

  it('all critique scores >= 70', async () => {
    const result = await generateVideo('30 second product launch for a design tool');

    assert.ok(!result.error);
    for (const s of result.scores) {
      assert.ok(s.score >= 70, `${s.scene_id} scored ${s.score}, expected >= 70`);
    }
  });

  it('sequence score >= 60', async () => {
    const result = await generateVideo('brand story video for an AI company');

    assert.ok(!result.error);
    assert.ok(result.evaluation, 'has evaluation');
    assert.ok(result.evaluation.score >= 60, `sequence scored ${result.evaluation.score}, expected >= 60`);
  });

  it('detects cinematic-dark personality', async () => {
    const result = await generateVideo('cinematic product demo, dramatic');

    assert.ok(!result.error);
    assert.equal(result.summary.personality, 'cinematic-dark');
  });

  it('detects editorial personality', async () => {
    const result = await generateVideo('editorial content video about design trends');

    assert.ok(!result.error);
    assert.equal(result.summary.personality, 'editorial');
  });

  it('accepts style override', async () => {
    const result = await generateVideo('make a video', { style: 'minimal' });

    assert.ok(!result.error);
    assert.equal(result.summary.style, 'minimal');
  });

  it('summary has expected fields', async () => {
    const result = await generateVideo('quick promo video');

    assert.ok(!result.error);
    const s = result.summary;
    assert.equal(typeof s.prompt, 'string');
    assert.equal(typeof s.style, 'string');
    assert.equal(typeof s.personality, 'string');
    assert.equal(typeof s.scene_count, 'number');
    assert.equal(typeof s.compiled, 'number');
    assert.equal(typeof s.avg_critique_score, 'number');
    assert.equal(typeof s.duration_s, 'number');
    assert.ok(Array.isArray(s.errors));
    assert.ok(Array.isArray(s.warnings));
  });
});
