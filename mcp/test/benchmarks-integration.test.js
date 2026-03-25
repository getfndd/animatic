/**
 * Benchmark integration tests.
 *
 * Validates all example projects against their benchmark.json thresholds.
 * Ensures scenes pass validation, annotations reach quality targets,
 * and scores meet minimum expectations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { annotateScenes, auditAnnotationQuality } from '../lib/scene-annotations.js';
import { scoreCandidateVideo } from '../lib/scoring.js';
import { loadBrand } from '../lib/brands.js';
import { validateScene } from '../../src/remotion/lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const EXAMPLES = resolve(ROOT, 'examples');
const brand = loadBrand('fintech-demo');

const projects = readdirSync(EXAMPLES)
  .filter(d => existsSync(resolve(EXAMPLES, d, 'benchmark.json')));

describe('benchmark projects', () => {
  for (const proj of projects) {
    describe(proj, () => {
      const dir = resolve(EXAMPLES, proj);
      let manifest, scenes, benchmark;

      try {
        manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf-8'));
        const scenesDir = resolve(dir, 'scenes');
        scenes = readdirSync(scenesDir).filter(f => f.endsWith('.json')).sort()
          .map(f => JSON.parse(readFileSync(resolve(scenesDir, f), 'utf-8')));
        benchmark = JSON.parse(readFileSync(resolve(dir, 'benchmark.json'), 'utf-8'));
      } catch (e) {
        it('loads project files', () => { assert.fail(`Failed to load: ${e.message}`); });
        return;
      }

      it('all scenes pass validation', () => {
        for (const s of scenes) {
          const v = validateScene(s);
          assert.ok(v.valid, `${s.scene_id}: ${v.errors.join(', ')}`);
        }
      });

      it('annotation audit meets quality threshold', () => {
        const annotated = annotateScenes(scenes);
        const audit = auditAnnotationQuality(annotated, { mode: 'strict' });
        const minQuality = benchmark.expected_audit?.quality_min || 0;
        assert.ok(audit.quality >= minQuality,
          `Audit quality ${audit.quality.toFixed(2)} < threshold ${minQuality}`);
        if (benchmark.expected_audit?.strict_pass) {
          assert.ok(audit.pass, `Strict audit failed: ${audit.issues.filter(i => i.severity === 'error').map(i => i.message).join('; ')}`);
        }
      });

      it('scores meet benchmark minimums', () => {
        const annotated = annotateScenes(scenes);
        const style = benchmark.style || manifest.style || 'prestige';
        const card = scoreCandidateVideo({ manifest, scenes: annotated, style, brand });

        for (const [dim, range] of Object.entries(benchmark.expected_scores || {})) {
          const actual = dim === 'overall' ? card.overall : card.subscores[dim]?.score;
          if (actual == null) continue;
          assert.ok(actual >= range.min,
            `${dim}: ${actual.toFixed(3)} < min ${range.min}`);
        }
      });

      it('has complete scene annotations', () => {
        const annotated = annotateScenes(scenes);
        for (const s of annotated) {
          assert.ok(s.product_role, `${s.scene_id}: missing product_role`);
          assert.ok(s.primary_subject, `${s.scene_id}: missing primary_subject`);
          assert.ok(s.interaction_truth, `${s.scene_id}: missing interaction_truth`);
        }
      });
    });
  }
});
