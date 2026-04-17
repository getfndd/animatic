/**
 * One-shot video pipeline — ANI-93
 *
 * Orchestrates the full brief → scenes → analyze → plan → compile → critique
 * pipeline from a single text prompt. Returns scene files, manifest, timelines,
 * and quality scores.
 *
 * Falls back gracefully at every stage: no LLM required, no Remotion required.
 */

import { generateScenes } from './generator.js';
import { analyzeScene } from './analyze.js';
import { planSequence, STYLE_TO_PERSONALITY } from './planner.js';
import { compileMotion } from './compiler.js';
import { critiqueScene } from './critic.js';
import { evaluateSequence } from './evaluate.js';
import {
  loadPrimitivesCatalog,
  loadPersonalitiesCatalog,
  loadRecipes,
  loadShotGrammar,
} from '../data/loader.js';

const catalogs = {
  primitives: loadPrimitivesCatalog(),
  personalities: loadPersonalitiesCatalog(),
  recipes: loadRecipes(),
  shotGrammar: loadShotGrammar(),
};

// ── Prompt Parsing ──────────────────────────────────────────────────────────

const STYLE_KEYWORDS = {
  prestige: ['prestige', 'premium', 'luxury', 'elegant'],
  energy: ['energy', 'energetic', 'fast', 'dynamic', 'upbeat'],
  dramatic: ['dramatic', 'cinematic', 'bold', 'intense'],
  minimal: ['minimal', 'minimalist', 'clean', 'simple'],
  intimate: ['intimate', 'personal', 'warm', 'close'],
  corporate: ['corporate', 'professional', 'business', 'enterprise'],
  kinetic: ['kinetic', 'motion', 'movement', 'action'],
  fade: ['fade', 'gentle', 'soft', 'subtle'],
};

const PERSONALITY_KEYWORDS = {
  'cinematic-dark': ['cinematic', 'dark', 'cinematic-dark', 'dramatic', 'moody'],
  editorial: ['editorial', 'content', 'article', 'story'],
  'neutral-light': ['neutral', 'light', 'tutorial', 'onboarding', 'neutral-light'],
  montage: ['montage', 'sizzle', 'reel', 'highlight'],
};

const TEMPLATE_KEYWORDS = {
  'product-launch': ['product', 'launch', 'release', 'announce', 'introducing'],
  'brand-story': ['brand', 'story', 'about', 'mission', 'vision'],
  'investor-pitch': ['investor', 'pitch', 'funding', 'deck', 'raise'],
  'photo-essay': ['photo', 'essay', 'gallery', 'portfolio', 'showcase'],
  tutorial: ['tutorial', 'how-to', 'guide', 'walkthrough', 'demo'],
};

/**
 * Parse a natural language prompt into a structured brief.
 *
 * @param {string} prompt - e.g. "30-second promo for an AI finance dashboard, cinematic-dark, prestige style"
 * @returns {{ brief: object, style: string, personality: string }}
 */
export function parsePrompt(prompt) {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/);

  // Extract duration
  const durationMatch = lower.match(/(\d+)\s*(?:second|sec|s)\b/);
  const duration = durationMatch ? parseInt(durationMatch[1]) : null;

  // Detect style
  let style = 'prestige';
  for (const [styleName, keywords] of Object.entries(STYLE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      style = styleName;
      break;
    }
  }

  // Detect personality (explicit override)
  let personality = null;
  for (const [slug, keywords] of Object.entries(PERSONALITY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      personality = slug;
      break;
    }
  }

  // Detect template
  let template = 'product-launch';
  for (const [tmpl, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      template = tmpl;
      break;
    }
  }

  // Extract the "subject" — strip known keywords to get the core description
  const stripWords = new Set([
    ...Object.values(STYLE_KEYWORDS).flat(),
    ...Object.values(PERSONALITY_KEYWORDS).flat(),
    ...Object.values(TEMPLATE_KEYWORDS).flat(),
    'video', 'make', 'create', 'generate', 'build', 'a', 'an', 'the', 'for',
    'my', 'our', 'new', 'with', 'style', 'second', 'seconds', 'sec', 'promo',
    'promotional', 'explainer', 'animated', 'animation',
  ]);

  const subjectWords = words.filter(w => {
    const clean = w.replace(/[^a-z0-9-]/g, '');
    return clean.length > 0 && !stripWords.has(clean) && !/^\d+$/.test(clean);
  });
  const subject = subjectWords.join(' ') || 'Product Demo';

  // Build title from subject
  const title = subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const brief = {
    project: {
      title,
      description: prompt,
      ...(duration ? { duration_target_s: duration } : {}),
    },
    template,
    tone: 'confident',
    style,
    content: {
      sections: [
        { label: 'hero', text: title },
        { label: 'feature', text: prompt },
        { label: 'closing', text: title },
      ],
    },
    assets: [],
  };

  return {
    brief,
    style,
    personality: personality || STYLE_TO_PERSONALITY[style] || 'editorial',
  };
}

// ── Pipeline Orchestrator ───────────────────────────────────────────────────

/**
 * Run the full video pipeline from a text prompt.
 *
 * @param {string} prompt - Natural language video description
 * @param {object} [options]
 * @param {boolean} [options.enhance=false] - Use LLM enhancement
 * @param {string} [options.style] - Override detected style
 * @param {string} [options.personality] - Override detected personality
 * @param {string} [options.template] - Override detected template
 * @returns {Promise<{ scenes, manifest, timelines, scores, summary }>}
 */
export async function generateVideo(prompt, options = {}) {
  const parsed = parsePrompt(prompt);
  const style = options.style || parsed.style;
  const personality = options.personality || parsed.personality;
  const brief = parsed.brief;

  if (options.template) brief.template = options.template;
  if (options.style) brief.style = options.style;

  const errors = [];
  const warnings = [];

  // ── Stage 1: Generate scenes ────────────────────────────────────────────
  let scenes;
  try {
    const result = await generateScenes(brief, { enhance: options.enhance });
    scenes = result.scenes;
  } catch (e) {
    return { error: `Scene generation failed: ${e.message}`, stage: 'generate' };
  }

  // ── Stage 2: Analyze scenes ─────────────────────────────────────────────
  const analyzed = scenes.map(scene => {
    const analysis = analyzeScene(scene);
    return { ...scene, ...analysis.metadata };
  });

  // ── Stage 3: Plan sequence ──────────────────────────────────────────────
  let manifest;
  let planNotes;
  try {
    const plan = planSequence({ scenes: analyzed, style });
    manifest = plan.manifest;
    planNotes = plan.notes;
  } catch (e) {
    return { error: `Sequence planning failed: ${e.message}`, stage: 'plan', scenes };
  }

  // ── Stage 4: Compile motion ─────────────────────────────────────────────
  // Keyed by scene_id to match SequenceComposition.jsx + compileAllScenes() format
  const timelines = {};
  for (const scene of scenes) {
    try {
      const timeline = compileMotion(scene, catalogs);
      if (timeline) {
        timelines[scene.scene_id] = timeline;
      } else {
        warnings.push(`${scene.scene_id}: no motion block (v1 scene)`);
      }
    } catch (e) {
      errors.push(`${scene.scene_id}: compile error — ${e.message}`);
    }
  }

  // ── Stage 5: Critique scenes ────────────────────────────────────────────
  const scores = [];
  for (const [sceneId, timeline] of Object.entries(timelines)) {
    const scene = scenes.find(s => s.scene_id === sceneId);
    try {
      const critique = critiqueScene(timeline, scene);
      scores.push({
        scene_id: sceneId,
        score: critique.score,
        issues: critique.issues.length,
        pass: critique.score >= 70,
      });
      if (critique.score < 70) {
        warnings.push(`${sceneId}: critique score ${critique.score}/100 (below 70 threshold)`);
      }
    } catch (e) {
      errors.push(`${sceneId}: critique error — ${e.message}`);
    }
  }

  // ── Stage 6: Evaluate sequence ──────────────────────────────────────────
  let evaluation = null;
  try {
    evaluation = evaluateSequence({ manifest, scenes: analyzed, style });
  } catch (e) {
    warnings.push(`Sequence evaluation failed: ${e.message}`);
  }

  // ── Build summary ───────────────────────────────────────────────────────
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0;

  const summary = {
    prompt,
    style,
    personality,
    template: brief.template,
    scene_count: scenes.length,
    compiled: Object.keys(timelines).length,
    avg_critique_score: avgScore,
    sequence_score: evaluation?.score ?? null,
    duration_s: manifest.scenes.reduce((sum, s) => sum + (s.duration_s || 0), 0),
    errors,
    warnings,
  };

  return {
    scenes,
    manifest,
    timelines,
    scores,
    evaluation,
    summary,
  };
}

// ── renderRemotionSequence ───────────────────────────────────────────────────

/**
 * Render a sequence via Remotion CLI.
 * Writes props to a temp file, spawns `npx remotion render Sequence`.
 *
 * @param {{ manifest: object, sceneDefs: object }} props - Render props.
 * @param {string} outputPath - Absolute path for output MP4.
 * @param {object} [opts]
 * @param {string} [opts.cwd] - Working directory (defaults to process.cwd()).
 * @param {number} [opts.timeoutMs=600000] - Render timeout.
 */
export async function renderRemotionSequence(props, outputPath, opts = {}) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const execFileAsync = promisify(execFile);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'animatic-render-'));
  const propsPath = path.join(tmpDir, 'props.json');

  try {
    fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));
    await execFileAsync('npx', [
      'remotion', 'render', 'Sequence',
      '--props', propsPath,
      '--output', outputPath,
    ], {
      cwd: opts.cwd || process.cwd(),
      timeout: opts.timeoutMs ?? 600_000,
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
