/**
 * ANI-153 — boundary-aware keyword matching for parsePrompt + the
 * recommend_editorial_layout pattern scorer (follow-up to ANI-137).
 *
 * Substring includes() matched design vocabulary inside larger words:
 *   "soft" in "software" → style=fade
 *   "light" in "highlight" → personality=neutral-light (before montage)
 *   "ui" in "build"/"fluid", "two" in "network", "type" in "prototype"
 * Both call sites now route through matchesKeyword (word-boundary, hyphen-aware).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parsePrompt } from '../lib/video.js';
import { matchesKeyword } from '../lib/recommend-layout.js';

describe('ANI-153 — parsePrompt keyword detection is boundary-aware', () => {
  it('does not pick style=fade because "soft" is inside "software"', () => {
    assert.notEqual(parsePrompt('promo for our software product').style, 'fade');
  });

  it('detects montage (not neutral-light) for "highlight reel"', () => {
    // "light" is inside "highlight"; neutral-light is iterated before montage,
    // so the substring bug mis-detected neutral-light here.
    assert.equal(parsePrompt('montage highlight reel').personality, 'montage');
  });

  it('still detects explicitly-named style / personality / template keywords', () => {
    assert.equal(parsePrompt('premium luxury brand film').style, 'prestige');
    assert.equal(parsePrompt('cinematic dramatic product demo').personality, 'cinematic-dark');
    assert.equal(parsePrompt('an editorial content piece').personality, 'editorial');
    assert.equal(parsePrompt('product launch announcement').brief.template, 'product-launch');
  });
});

describe('ANI-153 — editorial-layout pattern scoring relies on boundary matching', () => {
  // recommend_editorial_layout's EDITORIAL_PATTERNS scorer (index.js) now uses
  // matchesKeyword. The handler is inline (not exported), so assert the mechanism
  // on its worst short-token offenders.
  it('short tokens do not match inside larger words', () => {
    assert.equal(matchesKeyword('we build fluid software', 'ui'), false);
    assert.equal(matchesKeyword('a network diagram', 'two'), false);
    assert.equal(matchesKeyword('a prototype screen', 'type'), false);
  });

  it('standalone tokens still match', () => {
    assert.equal(matchesKeyword('floating ui fragments', 'ui'), true);
    assert.equal(matchesKeyword('split into two panels', 'two'), true);
    assert.equal(matchesKeyword('minimal type layout', 'type'), true);
  });
});
