/**
 * Compositing primitives tests (ANI-75).
 *
 * Run: node --test mcp/test/compositing.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { trackValuesToCSS } from '../../src/remotion/lib.js';
import {
  COMPOSITING_PRESETS,
  getCompositingPreset,
  resolvePresetEffects,
} from '../lib/compositing-presets.js';

// ── effectTypeToProperty mapping ────────────────────────────────────────────

describe('effectTypeToProperty — compositing types', () => {
  // Import the compiler to test effectTypeToProperty indirectly via compileMotion
  // Since effectTypeToProperty is private, we test through ANIMATABLE_DEFAULTS
  it('ANIMATABLE_DEFAULTS includes all compositing properties', async () => {
    const { ANIMATABLE_DEFAULTS } = await import('../lib/compiler.js');
    const expected = [
      'shadow_offset_x', 'shadow_offset_y', 'shadow_blur_radius',
      'shadow_spread', 'shadow_opacity',
      'inner_glow_spread', 'inner_glow_opacity',
      'mask_gradient_start', 'mask_gradient_end', 'mask_gradient_angle',
    ];
    for (const prop of expected) {
      assert.ok(prop in ANIMATABLE_DEFAULTS, `Missing: ${prop}`);
    }
  });

  it('mask_gradient_end defaults to 1', async () => {
    const { ANIMATABLE_DEFAULTS } = await import('../lib/compiler.js');
    assert.equal(ANIMATABLE_DEFAULTS.mask_gradient_end, 1);
  });

  it('mask_gradient_angle defaults to 180', async () => {
    const { ANIMATABLE_DEFAULTS } = await import('../lib/compiler.js');
    assert.equal(ANIMATABLE_DEFAULTS.mask_gradient_angle, 180);
  });
});

// ── trackValuesToCSS — compositing rendering ────────────────────────────────

describe('trackValuesToCSS — directional shadow', () => {
  it('renders boxShadow when shadow_opacity > 0', () => {
    const css = trackValuesToCSS({
      shadow_opacity: 0.2,
      shadow_offset_y: 8,
      shadow_blur_radius: 24,
    });
    assert.ok(css.boxShadow);
    assert.ok(css.boxShadow.includes('8px'));
    assert.ok(css.boxShadow.includes('24px'));
    assert.ok(css.boxShadow.includes('0.20'));
  });

  it('includes shadow_offset_x and shadow_spread', () => {
    const css = trackValuesToCSS({
      shadow_opacity: 0.3,
      shadow_offset_x: 4,
      shadow_offset_y: 6,
      shadow_blur_radius: 12,
      shadow_spread: 2,
    });
    assert.ok(css.boxShadow.includes('4px 6px 12px 2px'));
  });

  it('does not render shadow when opacity is 0', () => {
    const css = trackValuesToCSS({ shadow_opacity: 0 });
    assert.equal(css.boxShadow, undefined);
  });
});

describe('trackValuesToCSS — inner glow', () => {
  it('renders inset boxShadow when inner_glow_opacity > 0', () => {
    const css = trackValuesToCSS({
      inner_glow_opacity: 0.3,
      inner_glow_spread: 4,
    });
    assert.ok(css.boxShadow);
    assert.ok(css.boxShadow.includes('inset'));
    assert.ok(css.boxShadow.includes('4px'));
  });

  it('does not render glow when opacity is 0', () => {
    const css = trackValuesToCSS({ inner_glow_opacity: 0 });
    assert.equal(css.boxShadow, undefined);
  });
});

describe('trackValuesToCSS — gradient mask', () => {
  it('renders maskImage when gradient start > 0', () => {
    const css = trackValuesToCSS({
      mask_gradient_start: 0.5,
      mask_gradient_end: 1,
      mask_gradient_angle: 180,
    });
    assert.ok(css.maskImage);
    assert.ok(css.WebkitMaskImage);
    assert.ok(css.maskImage.includes('linear-gradient'));
    assert.ok(css.maskImage.includes('180deg'));
    assert.ok(css.maskImage.includes('50.0%'));
  });

  it('renders maskImage when gradient end < 1', () => {
    const css = trackValuesToCSS({
      mask_gradient_start: 0,
      mask_gradient_end: 0.7,
      mask_gradient_angle: 90,
    });
    assert.ok(css.maskImage);
    assert.ok(css.maskImage.includes('90deg'));
    assert.ok(css.maskImage.includes('70.0%'));
  });

  it('does not render mask when start=0 and end=1', () => {
    const css = trackValuesToCSS({
      mask_gradient_start: 0,
      mask_gradient_end: 1,
    });
    assert.equal(css.maskImage, undefined);
  });
});

// ── Compositing Presets ─────────────────────────────────────────────────────

describe('COMPOSITING_PRESETS', () => {
  it('has 7 named presets', () => {
    assert.equal(Object.keys(COMPOSITING_PRESETS).length, 7);
  });

  it('all presets have description and effects', () => {
    for (const [name, preset] of Object.entries(COMPOSITING_PRESETS)) {
      assert.ok(preset.description, `${name} missing description`);
      assert.ok(Array.isArray(preset.effects), `${name} missing effects`);
      assert.ok(preset.effects.length > 0, `${name} has no effects`);
    }
  });
});

describe('getCompositingPreset', () => {
  it('returns preset by name', () => {
    const p = getCompositingPreset('soft-shadow');
    assert.ok(p);
    assert.equal(p.effects.length, 3);
  });

  it('returns null for unknown name', () => {
    assert.equal(getCompositingPreset('nope'), null);
  });
});

describe('resolvePresetEffects', () => {
  it('returns cloned effects without overrides', () => {
    const effects = resolvePresetEffects('soft-shadow');
    assert.equal(effects.length, 3);
    assert.equal(effects[0].to, 0.15);
  });

  it('applies overrides by effect type', () => {
    const effects = resolvePresetEffects('soft-shadow', {
      shadow_opacity: { to: 0.5 },
    });
    const opacity = effects.find(e => e.type === 'shadow_opacity');
    assert.equal(opacity.to, 0.5);
    assert.equal(opacity.from, 0); // unchanged
  });

  it('returns null for unknown preset', () => {
    assert.equal(resolvePresetEffects('nope'), null);
  });
});

// ── Personality constraints ─────────────────────────────────────────────────

describe('personality constraints — compositing', () => {
  it('editorial caps shadow_opacity at 0.1', async () => {
    const { applySemanticConstraints } = await import('../lib/compiler.js');
    const groups = [{
      id: 'shadow-in',
      effects: [
        { type: 'shadow_opacity', from: 0, to: 0.5 },
        { type: 'opacity', from: 0, to: 1 },
      ],
    }];
    applySemanticConstraints(groups, 'editorial');
    const shadowEffect = groups[0].effects.find(e => e.type === 'shadow_opacity');
    assert.ok(shadowEffect, 'shadow_opacity effect should exist');
    assert.equal(shadowEffect.to, 0.1, 'shadow_opacity should be capped at 0.1');
  });

  it('neutral-light strips shadow and glow effects', async () => {
    const { applySemanticConstraints } = await import('../lib/compiler.js');
    const groups = [{
      id: 'shadow-glow-test',
      effects: [
        { type: 'shadow_opacity', from: 0, to: 0.3 },
        { type: 'inner_glow_opacity', from: 0, to: 0.5 },
        { type: 'shadow_offset_y', from: 0, to: 8 },
        { type: 'opacity', from: 0, to: 1 },
      ],
    }];
    applySemanticConstraints(groups, 'neutral-light');
    const remaining = groups[0].effects.map(e => e.type);
    assert.ok(!remaining.includes('shadow_opacity'), 'shadow_opacity should be stripped');
    assert.ok(!remaining.includes('inner_glow_opacity'), 'inner_glow_opacity should be stripped');
    assert.ok(!remaining.includes('shadow_offset_y'), 'shadow_offset_y should be stripped');
    assert.ok(remaining.includes('opacity'), 'opacity should survive');
  });
});
