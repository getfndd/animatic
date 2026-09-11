/**
 * Tests for the Animation Project Model.
 *
 * Covers: initProject, listProjects, getProject, getProjectContext,
 * saveProjectArtifact, status enums, folder scaffolding.
 *
 * Uses Node's built-in test runner (zero dependencies).
 * Run: node --test mcp/test/projects.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  initProject,
  listProjects,
  getProject,
  getProjectContext,
  saveProjectArtifact,
  reviewProject,
  renderProject,
  writeJSON,
  STATUS_PROJECT,
  STATUS_SCENE,
  STATUS_VERSION,
} from '../lib/projects.js';

const PROJECTS_ROOT = join(process.cwd(), 'projects');
const TEST_SLUG = '__test_project__';
const TEST_SLUG_2 = '__test_project_2__';
const TEST_SLUG_REVIEW = '__test_project_review__';
const TEST_SLUG_BEATPLAN = '__test_project_beatplan__';
let testProjectRoot;
let testProjectRoot2;

// ── Setup / Teardown ────────────────────────────────────────────────────────

before(() => {
  // Clean up any leftover test projects
  cleanup();
});

after(() => {
  cleanup();
});

function cleanup() {
  // Remove test project directories
  for (const slug of [TEST_SLUG, TEST_SLUG_2, TEST_SLUG_REVIEW, TEST_SLUG_BEATPLAN]) {
    const entries = existsSync(PROJECTS_ROOT)
      ? readdirSync(PROJECTS_ROOT)
      : [];
    for (const entry of entries) {
      if (entry.includes(slug)) {
        rmSync(join(PROJECTS_ROOT, entry), { recursive: true, force: true });
      }
    }
  }
}

// ── Status Enums ────────────────────────────────────────────────────────────

describe('status enums', () => {
  it('STATUS_PROJECT has expected values', () => {
    assert.deepEqual(STATUS_PROJECT, ['draft', 'blocked', 'in_review', 'approved', 'archived']);
  });

  it('STATUS_SCENE has expected values', () => {
    assert.deepEqual(STATUS_SCENE, ['draft', 'compiled', 'reviewed', 'approved']);
  });

  it('STATUS_VERSION has expected values', () => {
    assert.deepEqual(STATUS_VERSION, ['draft', 'candidate', 'approved', 'rejected']);
  });
});

// ── initProject ─────────────────────────────────────────────────────────────

describe('initProject', () => {
  it('creates project folder structure and project.json', async () => {
    const result = await initProject({
      title: 'Test Project',
      slug: TEST_SLUG,
      date_prefix: false,
      brand: 'test-brand',
      personality: 'cinematic-dark',
      style_pack: 'dramatic',
      fps: 60,
      duration_target_s: 30,
    });

    testProjectRoot = result.project_root;

    assert.equal(result.project_id, TEST_SLUG);
    assert.ok(result.project_root.endsWith(TEST_SLUG));
    assert.ok(result.project_file.endsWith('project.json'));
    assert.ok(existsSync(result.project_file), 'project.json should exist');
  });

  it('creates all required subdirectories', async () => {
    const requiredDirs = [
      'brief', 'brief/references', 'brief/references/moodboard', 'brief/references/assets',
      'concept', 'scenes', 'motion', 'motion/compiled', 'motion/manifests', 'motion/personalities',
      'prototypes', 'prototypes/html', 'prototypes/captures',
      'audio', 'audio/sfx',
      'renders', 'renders/draft', 'renders/approved', 'renders/frames',
      'review', 'versions',
    ];

    for (const dir of requiredDirs) {
      const fullPath = join(testProjectRoot, dir);
      assert.ok(existsSync(fullPath), `${dir} should exist`);
    }
  });

  it('project.json has correct schema', async () => {
    const project = await getProject({ project: TEST_SLUG });
    assert.equal(project.id, TEST_SLUG);
    assert.equal(project.slug, TEST_SLUG);
    assert.equal(project.title, 'Test Project');
    assert.equal(project.status, 'draft');
    assert.equal(project.brand, 'test-brand');
    assert.equal(project.personality, 'cinematic-dark');
    assert.equal(project.style_pack, 'dramatic');
    assert.equal(project.format.fps, 60);
    assert.equal(project.format.resolution.w, 1920);
    assert.equal(project.format.resolution.h, 1080);
    assert.equal(project.format.aspect_ratio, '16:9');
    assert.equal(project.format.duration_target_s, 30);
    assert.deepEqual(project.scenes, []);
    assert.deepEqual(project.versions, []);
    assert.deepEqual(project.tags, []);
    assert.equal(project.entrypoints.brief, 'brief/brief.md');
    assert.equal(project.entrypoints.root_manifest, null);
  });

  it('creates project with date prefix by default', async () => {
    const result = await initProject({
      title: 'Test Project 2',
      slug: TEST_SLUG_2,
      personality: 'editorial',
    });

    testProjectRoot2 = result.project_root;

    // Should have YYYY-MM-DD prefix
    const folderName = result.project_root.split('/').pop();
    assert.match(folderName, /^\d{4}-\d{2}-\d{2}-/);
    assert.ok(folderName.endsWith(TEST_SLUG_2));
  });
});

// ── listProjects ────────────────────────────────────────────────────────────

describe('listProjects', () => {
  it('lists all test projects', async () => {
    const projects = await listProjects();
    const testProjects = projects.filter(p => p.slug === TEST_SLUG || p.slug === TEST_SLUG_2);
    assert.equal(testProjects.length, 2);
  });

  it('filters by status', async () => {
    const drafts = await listProjects({ status: 'draft' });
    assert.ok(drafts.length >= 2);
    assert.ok(drafts.every(p => p.status === 'draft'));

    const approved = await listProjects({ status: 'approved' });
    const testApproved = approved.filter(p => p.slug === TEST_SLUG);
    assert.equal(testApproved.length, 0);
  });

  it('respects limit', async () => {
    const projects = await listProjects({ limit: 1 });
    assert.equal(projects.length, 1);
  });

  it('returns empty array when projects/ does not exist', async () => {
    // This tests the fallback — projects/ does exist but there might be
    // an error scenario. We just verify the function doesn't throw.
    const result = await listProjects({ status: 'nonexistent_status' });
    assert.ok(Array.isArray(result));
  });
});

// ── getProject ──────────────────────────────────────────────────────────────

describe('getProject', () => {
  it('finds project by slug', async () => {
    const project = await getProject({ project: TEST_SLUG });
    assert.ok(project);
    assert.equal(project.slug, TEST_SLUG);
    assert.ok(project.project_root);
  });

  it('finds project by slug with date prefix', async () => {
    const project = await getProject({ project: TEST_SLUG_2 });
    assert.ok(project);
    assert.equal(project.slug, TEST_SLUG_2);
  });

  it('returns null for nonexistent project', async () => {
    const result = await getProject({ project: 'nonexistent-project-xyz' });
    assert.equal(result, null);
  });
});

// ── getProjectContext ───────────────────────────────────────────────────────

describe('getProjectContext', () => {
  it('returns project with empty context for missing files', async () => {
    const ctx = await getProjectContext({
      project: TEST_SLUG,
      include: ['brief', 'storyboard', 'manifest', 'review'],
    });

    assert.ok(ctx);
    assert.equal(ctx.project.slug, TEST_SLUG);
    // Files don't exist yet, so these should be null
    assert.equal(ctx.brief, null);
    assert.equal(ctx.storyboard, null);
    assert.equal(ctx.manifest, null);
  });

  it('reads brief when file exists', async () => {
    // Write a test brief
    const briefPath = join(testProjectRoot, 'brief', 'brief.md');
    writeFileSync(briefPath, '# Test Brief\n\nThis is a test brief.');

    const ctx = await getProjectContext({
      project: TEST_SLUG,
      include: ['brief'],
    });

    assert.ok(ctx.brief);
    assert.ok(ctx.brief.includes('Test Brief'));
  });

  it('reads scenes when registered', async () => {
    // Write a test scene
    const scenePath = join(testProjectRoot, 'scenes', 'sc_01_test.json');
    writeFileSync(scenePath, JSON.stringify({ scene_id: 'sc_01_test', duration_s: 3 }));

    // Register it
    await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'scene',
      path: 'scenes/sc_01_test.json',
      scene_id: 'sc_01_test',
    });

    const ctx = await getProjectContext({
      project: TEST_SLUG,
      include: ['scenes'],
    });

    assert.ok(ctx.scenes);
    assert.equal(ctx.scenes.length, 1);
    assert.equal(ctx.scenes[0].data?.scene_id, 'sc_01_test');
  });

  it('returns null for nonexistent project', async () => {
    const result = await getProjectContext({
      project: 'nonexistent',
      include: ['brief'],
    });
    assert.equal(result, null);
  });
});

// ── saveProjectArtifact ─────────────────────────────────────────────────────

describe('saveProjectArtifact', () => {
  it('updates brief entrypoint', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'brief',
      path: 'brief/brief-v2.md',
    });

    assert.equal(result.entrypoints.brief, 'brief/brief-v2.md');
  });

  it('updates manifest entrypoint', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'manifest',
      path: 'motion/manifests/sequence-v1.json',
    });

    assert.equal(result.entrypoints.root_manifest, 'motion/manifests/sequence-v1.json');
  });

  it('updates latest_render', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'render',
      path: 'renders/draft/test-v1.mp4',
    });

    assert.equal(result.entrypoints.latest_render, 'renders/draft/test-v1.mp4');
    assert.equal(result.entrypoints.approved_render, null); // not approved yet
  });

  it('sets approved_render with role=approved', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'render',
      role: 'approved',
      path: 'renders/approved/test-final.mp4',
    });

    assert.equal(result.entrypoints.approved_render, 'renders/approved/test-final.mp4');
  });

  it('adds scene to scenes array', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'scene',
      path: 'scenes/sc_02_test.json',
      scene_id: 'sc_02_test',
    });

    const sc2 = result.scenes.find(s => s.id === 'sc_02_test');
    assert.ok(sc2);
    assert.equal(sc2.source, 'scenes/sc_02_test.json');
    assert.equal(sc2.status, 'draft');
  });

  it('updates existing scene entry', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'scene',
      path: 'scenes/sc_02_test_v2.json',
      scene_id: 'sc_02_test',
      metadata: { status: 'compiled' },
    });

    const sc2 = result.scenes.find(s => s.id === 'sc_02_test');
    assert.equal(sc2.source, 'scenes/sc_02_test_v2.json');
    assert.equal(sc2.status, 'compiled');
  });

  it('adds version to versions array', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'version',
      path: 'motion/manifests/sequence-v1.json',
      version_id: 'v1',
      metadata: { label: 'Initial sequence' },
    });

    assert.equal(result.versions.length, 1);
    assert.equal(result.versions[0].version_id, 'v1');
    assert.equal(result.versions[0].label, 'Initial sequence');
    assert.equal(result.versions[0].status, 'draft');
  });

  it('updates review paths', async () => {
    const result = await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'review',
      role: 'notes',
      path: 'review/notes-v2.md',
    });

    assert.equal(result.review.notes, 'review/notes-v2.md');
  });

  it('bumps updated_at on every save', async () => {
    const before = await getProject({ project: TEST_SLUG });
    const beforeTime = before.updated_at;

    // Small delay to ensure timestamp differs
    await new Promise(r => setTimeout(r, 10));

    await saveProjectArtifact({
      project: TEST_SLUG,
      kind: 'brief',
      path: 'brief/brief-v3.md',
    });

    const after = await getProject({ project: TEST_SLUG });
    assert.ok(after.updated_at >= beforeTime, 'updated_at should be bumped');
  });

  it('throws for unknown artifact kind', async () => {
    await assert.rejects(
      () => saveProjectArtifact({
        project: TEST_SLUG,
        kind: 'unknown',
        path: 'foo.txt',
      }),
      { message: /Unknown artifact kind/ }
    );
  });

  it('throws for nonexistent project', async () => {
    await assert.rejects(
      () => saveProjectArtifact({
        project: 'nonexistent',
        kind: 'brief',
        path: 'brief.md',
      }),
      { message: /not found/ }
    );
  });
});

// ── saveProjectArtifact — beat plans must not clobber the storyboard pointer ──
//
// ANI-220 regression: `/direct` Step 8 used to register storyboard AND all
// three beat plans under kind: 'storyboard'. Since saveProjectArtifact's
// storyboard case is a scalar overwrite of entrypoints.storyboard, whichever
// beat plan saved last replaced the storyboard pointer (verified live in
// projects/2026-03-25-fintech-sizzle/project.json). Beat plans get their own
// `beat_plan` kind, keyed by strategy, that never touches entrypoints.

describe('saveProjectArtifact — beat_plan kind (ANI-220)', () => {
  it('storyboard pointer survives saving three beat plans under their own kind', async () => {
    cleanup();
    await initProject({
      title: 'Beat Plan Isolation Test',
      slug: TEST_SLUG_BEATPLAN,
      date_prefix: false,
    });

    const storyboardResult = await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'storyboard',
      path: 'concept/storyboard.json',
    });
    assert.equal(storyboardResult.entrypoints.storyboard, 'concept/storyboard.json');

    for (const strategy of ['dramatic', 'energy', 'prestige']) {
      const result = await saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind: 'beat_plan',
        role: strategy,
        path: `concept/beat-plan-${strategy}.json`,
      });

      // The storyboard pointer must be untouched by every beat-plan save.
      assert.equal(
        result.entrypoints.storyboard,
        'concept/storyboard.json',
        `storyboard entrypoint clobbered after saving beat plan "${strategy}"`
      );
    }

    const final = await getProject({ project: TEST_SLUG_BEATPLAN });
    assert.equal(final.entrypoints.storyboard, 'concept/storyboard.json');

    // All three beat plans are retrievable under their own key, each with
    // its own strategy-scoped path (not a single scalar overwritten 3x).
    assert.equal(final.beat_plans.length, 3);
    const byStrategy = Object.fromEntries(final.beat_plans.map(bp => [bp.strategy, bp.path]));
    assert.equal(byStrategy.dramatic, 'concept/beat-plan-dramatic.json');
    assert.equal(byStrategy.energy, 'concept/beat-plan-energy.json');
    assert.equal(byStrategy.prestige, 'concept/beat-plan-prestige.json');
  });

  it('re-saving a beat plan for the same strategy replaces that entry, not the whole array', async () => {
    cleanup();
    await initProject({
      title: 'Beat Plan Replace Test',
      slug: TEST_SLUG_BEATPLAN,
      date_prefix: false,
    });

    await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'beat_plan',
      role: 'dramatic',
      path: 'concept/beat-plan-dramatic.json',
    });
    await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'beat_plan',
      role: 'energy',
      path: 'concept/beat-plan-energy.json',
    });
    const result = await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'beat_plan',
      role: 'dramatic',
      path: 'concept/beat-plan-dramatic-v2.json',
    });

    assert.equal(result.beat_plans.length, 2, 're-saving the same strategy must replace, not append');
    const byStrategy = Object.fromEntries(result.beat_plans.map(bp => [bp.strategy, bp.path]));
    assert.equal(byStrategy.dramatic, 'concept/beat-plan-dramatic-v2.json');
    assert.equal(byStrategy.energy, 'concept/beat-plan-energy.json');
  });

  it('getProjectContext({ include: ["beat_plans"] }) returns all saved beat plans with data', async () => {
    cleanup();
    const init = await initProject({
      title: 'Beat Plan Context Test',
      slug: TEST_SLUG_BEATPLAN,
      date_prefix: false,
    });
    const root = init.project_root;

    for (const strategy of ['dramatic', 'energy']) {
      const path = `concept/beat-plan-${strategy}.json`;
      writeFileSync(join(root, path), JSON.stringify({ strategy, beats: [] }, null, 2));
      await saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind: 'beat_plan',
        role: strategy,
        path,
      });
    }

    const context = await getProjectContext({
      project: TEST_SLUG_BEATPLAN,
      include: ['beat_plans'],
    });

    assert.equal(context.beat_plans.length, 2);
    const byStrategy = Object.fromEntries(context.beat_plans.map(bp => [bp.strategy, bp]));
    assert.equal(byStrategy.dramatic.data.strategy, 'dramatic');
    assert.equal(byStrategy.energy.data.strategy, 'energy');
  });
});

// ── Codex review follow-up (58582d6) ─────────────────────────────────────────
//
// A `beat_plan` with no strategy was silently appended (and duplicated on
// every re-save, since the lookup that would replace it needs a strategy to
// match on); `metadata` was spread after the canonical `strategy`/`path`/
// `created_at` fields, so a caller-supplied metadata.strategy could silently
// overwrite `role`'s strategy and land the entry under the wrong key.

// Derive the set of artifact kinds straight from saveProjectArtifact's own
// `switch (kind)` in mcp/lib/projects.js — not a hand-typed list here — so
// "no kind can clobber entrypoints.storyboard" stays a property of the
// switch statement itself, not a snapshot of it that can silently drift.
function deriveArtifactKinds() {
  const src = readFileSync(join(process.cwd(), 'mcp/lib/projects.js'), 'utf-8');
  const start = src.indexOf('export async function saveProjectArtifact');
  const end = src.indexOf('export async function reviewProject');
  assert.ok(start >= 0 && end > start, 'could not locate saveProjectArtifact in mcp/lib/projects.js');
  const switchBody = src.slice(start, end);
  const kinds = [...switchBody.matchAll(/case '([a-z_]+)':/g)].map(m => m[1]);
  assert.ok(kinds.includes('beat_plan'), 'sanity check: beat_plan case not found — regex or slice is wrong');
  return [...new Set(kinds)];
}

// Extra args each kind needs to save without throwing, beyond project/kind/path.
// beat_plan now requires a strategy (this review's own fix); every other kind
// tolerates being called with just a path.
const EXTRA_ARGS_BY_KIND = {
  beat_plan: { role: 'dramatic' },
};

describe('saveProjectArtifact — no non-storyboard kind can touch entrypoints.storyboard (Codex 58582d6)', () => {
  const kinds = deriveArtifactKinds().filter(k => k !== 'storyboard');

  it('derived at least brief/render/scene/version/review/master/beat_plan (guards against an empty/broken derivation)', () => {
    for (const expected of ['brief', 'render', 'scene', 'version', 'review', 'master', 'beat_plan']) {
      assert.ok(kinds.includes(expected), `deriveArtifactKinds() missing "${expected}" — regex drifted from the switch`);
    }
  });

  for (const kind of kinds) {
    it(`kind: '${kind}' leaves entrypoints.storyboard untouched`, async () => {
      cleanup();
      await initProject({
        title: `Kind Isolation Test — ${kind}`,
        slug: TEST_SLUG_BEATPLAN,
        date_prefix: false,
      });
      await saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind: 'storyboard',
        path: 'concept/storyboard.json',
      });

      const result = await saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind,
        path: `test-artifact-${kind}.json`,
        ...(EXTRA_ARGS_BY_KIND[kind] || {}),
      });

      assert.equal(
        result.entrypoints.storyboard,
        'concept/storyboard.json',
        `kind "${kind}" clobbered the storyboard entrypoint`
      );
    });
  }
});

describe('saveProjectArtifact — beat_plan strategy integrity (Codex 58582d6)', () => {
  it('rejects a missing strategy (no role, no metadata.strategy)', async () => {
    cleanup();
    await initProject({ title: 'No Strategy', slug: TEST_SLUG_BEATPLAN, date_prefix: false });

    await assert.rejects(
      () => saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind: 'beat_plan',
        path: 'concept/beat-plan-dramatic.json',
      }),
      { message: /beat_plan requires a strategy/ }
    );
  });

  it('rejects an empty-string strategy', async () => {
    cleanup();
    await initProject({ title: 'Empty Strategy', slug: TEST_SLUG_BEATPLAN, date_prefix: false });

    await assert.rejects(
      () => saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind: 'beat_plan',
        role: '',
        path: 'concept/beat-plan-dramatic.json',
      }),
      { message: /beat_plan requires a strategy/ }
    );
  });

  it('rejects a re-save with a missing strategy rather than appending a duplicate', async () => {
    cleanup();
    await initProject({ title: 'No Strategy Resave', slug: TEST_SLUG_BEATPLAN, date_prefix: false });
    await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'beat_plan',
      role: 'dramatic',
      path: 'concept/beat-plan-dramatic.json',
    });

    await assert.rejects(
      () => saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind: 'beat_plan',
        path: 'concept/beat-plan-dramatic-v2.json',
      }),
      { message: /beat_plan requires a strategy/ }
    );

    const project = await getProject({ project: TEST_SLUG_BEATPLAN });
    assert.equal(project.beat_plans.length, 1, 'the rejected save must not have appended anything');
  });

  it('rejects role/metadata.strategy disagreement instead of silently picking one', async () => {
    cleanup();
    await initProject({ title: 'Strategy Conflict', slug: TEST_SLUG_BEATPLAN, date_prefix: false });

    await assert.rejects(
      () => saveProjectArtifact({
        project: TEST_SLUG_BEATPLAN,
        kind: 'beat_plan',
        role: 'dramatic',
        path: 'concept/beat-plan-dramatic.json',
        metadata: { strategy: 'energy' },
      }),
      { message: /disagree/ }
    );
  });

  it('accepts metadata.strategy alone (no role) as the strategy', async () => {
    cleanup();
    await initProject({ title: 'Metadata Strategy Only', slug: TEST_SLUG_BEATPLAN, date_prefix: false });

    const result = await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'beat_plan',
      path: 'concept/beat-plan-energy.json',
      metadata: { strategy: 'energy' },
    });

    assert.equal(result.beat_plans.length, 1);
    assert.equal(result.beat_plans[0].strategy, 'energy');
  });

  it('canonical path/created_at win over conflicting metadata fields of the same name', async () => {
    cleanup();
    await initProject({ title: 'Metadata Identity Guard', slug: TEST_SLUG_BEATPLAN, date_prefix: false });

    const result = await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'beat_plan',
      role: 'dramatic',
      path: 'concept/beat-plan-dramatic.json',
      metadata: { path: 'concept/attacker-controlled.json', created_at: 'not-a-real-date', note: 'kept' },
    });

    assert.equal(result.beat_plans[0].path, 'concept/beat-plan-dramatic.json');
    assert.notEqual(result.beat_plans[0].created_at, 'not-a-real-date');
    assert.equal(result.beat_plans[0].note, 'kept', 'non-identity metadata fields still pass through');
  });
});

describe('getProjectContext — beat_plans edge cases (Codex 58582d6)', () => {
  it('returns [] for a legacy project.json with no beat_plans key at all', async () => {
    cleanup();
    const init = await initProject({ title: 'Legacy Project', slug: TEST_SLUG_BEATPLAN, date_prefix: false });
    const { project_root: root } = init;

    // Simulate a pre-ANI-220 project.json written before `beat_plans` existed.
    const legacy = await getProject({ project: TEST_SLUG_BEATPLAN });
    delete legacy.beat_plans;
    const { project_root: _root, ...legacyData } = legacy;
    await writeJSON(join(root, 'project.json'), legacyData);

    const context = await getProjectContext({
      project: TEST_SLUG_BEATPLAN,
      include: ['beat_plans'],
    });

    assert.deepEqual(context.beat_plans, []);
  });

  it('a registered beat plan whose file is missing on disk reads as data: null, matching every other include (readJSON swallows the error)', async () => {
    cleanup();
    await initProject({ title: 'Missing Beat Plan File', slug: TEST_SLUG_BEATPLAN, date_prefix: false });
    await saveProjectArtifact({
      project: TEST_SLUG_BEATPLAN,
      kind: 'beat_plan',
      role: 'dramatic',
      path: 'concept/beat-plan-dramatic-never-written.json',
    });

    const context = await getProjectContext({
      project: TEST_SLUG_BEATPLAN,
      include: ['beat_plans'],
    });

    assert.equal(context.beat_plans.length, 1);
    assert.equal(context.beat_plans[0].data, null, 'missing file must degrade to null, like scenes/manifest/review do — never throw');
    assert.equal(context.beat_plans[0].strategy, 'dramatic', 'the entry itself is still returned even though its file is missing');
  });
});

// ── reviewProject ──────────────────────────────────────────────────────────

describe('reviewProject — end-to-end', () => {
  // Minimal valid scene JSON (pre-analysis). analyzeScene fills metadata.
  function makeSceneJSON(id) {
    return {
      scene_id: id,
      duration_s: 3,
      layers: [{ id: 'l1', type: 'text', depth_class: 'foreground', content: 'Hello' }],
    };
  }

  // Minimal valid manifest referencing 3 scenes.
  function makeManifest() {
    return {
      sequence_id: 'seq_smoke_test',
      style: 'prestige',
      scenes: [
        { scene: 'sc_a', duration_s: 3 },
        { scene: 'sc_b', duration_s: 3, transition_in: { type: 'crossfade', duration_ms: 400 } },
        { scene: 'sc_c', duration_s: 3, transition_in: { type: 'crossfade', duration_ms: 400 } },
      ],
    };
  }

  async function buildProject(slug, { style_pack, personality } = {}) {
    const result = await initProject({
      title: 'Review Smoke Test',
      slug,
      date_prefix: false,
      personality,
      style_pack,
    });
    const root = result.project_root;

    // Write three scene files.
    const scenes = ['sc_a', 'sc_b', 'sc_c'];
    for (const id of scenes) {
      writeFileSync(join(root, `scenes/${id}.json`), JSON.stringify(makeSceneJSON(id), null, 2));
      await saveProjectArtifact({
        project: slug,
        kind: 'scene',
        scene_id: id,
        path: `scenes/${id}.json`,
      });
    }

    // Write manifest.
    writeFileSync(join(root, 'motion/manifests/root.json'), JSON.stringify(makeManifest(), null, 2));
    await saveProjectArtifact({
      project: slug,
      kind: 'manifest',
      path: 'motion/manifests/root.json',
    });

    return root;
  }

  it('init → save manifest → review: produces validation + evaluation + written artifact', async () => {
    cleanup();
    const root = await buildProject(TEST_SLUG_REVIEW, { style_pack: 'prestige' });

    const result = await reviewProject({ project: TEST_SLUG_REVIEW });

    assert.ok(!result.error, `unexpected error: ${result.error}`);
    assert.ok(result.validation, 'validation result missing');
    assert.ok(['PASS', 'WARN', 'BLOCK'].includes(result.validation.verdict),
      `unexpected verdict: ${result.validation.verdict}`);
    assert.ok(result.evaluation, 'evaluation result missing when style is set');
    assert.equal(typeof result.evaluation.score, 'number');
    assert.ok(result.evaluation.score >= 0 && result.evaluation.score <= 100);
    assert.equal(result.style, 'prestige');
    assert.equal(result.personality, 'editorial'); // STYLE_TO_PERSONALITY[prestige]
    assert.equal(result.evaluation_error, null);

    // Artifact written.
    const artifactPath = join(root, 'review/evaluation.json');
    assert.ok(existsSync(artifactPath), 'evaluation.json not written');
    const onDisk = JSON.parse(readFileSync(artifactPath, 'utf-8'));
    assert.equal(onDisk.evaluation.score, result.evaluation.score);
  });

  it('skips evaluation gracefully when style_pack is unset', async () => {
    cleanup();
    await buildProject(TEST_SLUG_REVIEW, {}); // no style_pack

    const result = await reviewProject({ project: TEST_SLUG_REVIEW });

    assert.ok(!result.error);
    assert.ok(result.validation, 'validation still runs without style');
    assert.equal(result.evaluation, null);
    assert.match(result.evaluation_error, /style_pack/);
  });

  it('accepts style override via args', async () => {
    cleanup();
    await buildProject(TEST_SLUG_REVIEW, {}); // no style_pack on project

    const result = await reviewProject({ project: TEST_SLUG_REVIEW, style: 'energy' });

    assert.ok(!result.error);
    assert.ok(result.evaluation, 'evaluation should run with style override');
    assert.equal(result.style, 'energy');
  });

  it('returns error for unknown project', async () => {
    const result = await reviewProject({ project: '__does_not_exist__' });
    assert.match(result.error, /not found/);
  });

  it('returns error when project has no manifest', async () => {
    cleanup();
    await initProject({
      title: 'No Manifest',
      slug: TEST_SLUG_REVIEW,
      date_prefix: false,
      style_pack: 'prestige',
    });
    const result = await reviewProject({ project: TEST_SLUG_REVIEW });
    assert.match(result.error, /No manifest/);
  });

  it('reports loadable-scenes error when scene files are missing from disk', async () => {
    cleanup();
    const root = await initProject({
      title: 'Missing Scenes',
      slug: TEST_SLUG_REVIEW,
      date_prefix: false,
      style_pack: 'prestige',
    });

    // Register a scene but do not write the file.
    await saveProjectArtifact({
      project: TEST_SLUG_REVIEW,
      kind: 'scene',
      scene_id: 'sc_ghost',
      path: 'scenes/ghost.json',
    });
    writeFileSync(join(root.project_root, 'motion/manifests/root.json'),
      JSON.stringify(makeManifest(), null, 2));
    await saveProjectArtifact({
      project: TEST_SLUG_REVIEW,
      kind: 'manifest',
      path: 'motion/manifests/root.json',
    });

    const result = await reviewProject({ project: TEST_SLUG_REVIEW });
    assert.ok(result.validation, 'validation runs despite missing scenes');
    assert.equal(result.evaluation, null);
    assert.match(result.evaluation_error, /No loadable scenes/);
  });
});

// ── renderProject ──────────────────────────────────────────────────────────

describe('renderProject — dry_run path (assembly)', () => {
  function makeSceneJSON(id) {
    return {
      scene_id: id,
      duration_s: 3,
      layers: [{ id: 'l1', type: 'text', depth_class: 'foreground', content: 'Hello' }],
    };
  }

  function makeManifest() {
    return {
      sequence_id: 'seq_render_test',
      style: 'prestige',
      scenes: [
        { scene: 'sc_a', duration_s: 3 },
        { scene: 'sc_b', duration_s: 3 },
      ],
    };
  }

  async function buildProject(slug) {
    const result = await initProject({
      title: 'Render Smoke Test',
      slug,
      date_prefix: false,
      style_pack: 'prestige',
    });
    const root = result.project_root;
    for (const id of ['sc_a', 'sc_b']) {
      writeFileSync(join(root, `scenes/${id}.json`), JSON.stringify(makeSceneJSON(id), null, 2));
      await saveProjectArtifact({ project: slug, kind: 'scene', scene_id: id, path: `scenes/${id}.json` });
    }
    writeFileSync(join(root, 'motion/manifests/root.json'), JSON.stringify(makeManifest(), null, 2));
    await saveProjectArtifact({ project: slug, kind: 'manifest', path: 'motion/manifests/root.json' });
    return root;
  }

  it('assembles {manifest, sceneDefs} props with every manifest scene resolved', async () => {
    cleanup();
    const root = await buildProject(TEST_SLUG_REVIEW);

    const result = await renderProject({ project: TEST_SLUG_REVIEW, dry_run: true });

    assert.ok(!result.error, `unexpected error: ${result.error}`);
    assert.equal(result.skipped, 'dry_run');
    assert.ok(result.props.manifest, 'props.manifest missing');
    assert.equal(result.props.manifest.sequence_id, 'seq_render_test');
    assert.ok(result.props.sceneDefs.sc_a, 'sc_a missing from sceneDefs');
    assert.ok(result.props.sceneDefs.sc_b, 'sc_b missing from sceneDefs');
    assert.equal(result.output, join(root, 'renders/draft/' + TEST_SLUG_REVIEW + '-render.mp4'));
  });

  it('returns error when manifest references an unresolved scene_id', async () => {
    cleanup();
    const root = await initProject({
      title: 'Unresolved Scene',
      slug: TEST_SLUG_REVIEW,
      date_prefix: false,
      style_pack: 'prestige',
    });

    // Manifest references sc_missing but project has no such scene registered.
    const manifest = {
      sequence_id: 'seq_unresolved',
      style: 'prestige',
      scenes: [{ scene: 'sc_missing', duration_s: 3 }],
    };
    writeFileSync(join(root.project_root, 'motion/manifests/root.json'),
      JSON.stringify(manifest, null, 2));
    await saveProjectArtifact({
      project: TEST_SLUG_REVIEW,
      kind: 'manifest',
      path: 'motion/manifests/root.json',
    });

    const result = await renderProject({ project: TEST_SLUG_REVIEW, dry_run: true });
    assert.match(result.error, /not found in project: sc_missing/);
  });

  it('returns error for unknown project', async () => {
    const result = await renderProject({ project: '__does_not_exist__', dry_run: true });
    assert.match(result.error, /not found/);
  });

  it('returns error when project has no manifest', async () => {
    cleanup();
    await initProject({
      title: 'No Manifest',
      slug: TEST_SLUG_REVIEW,
      date_prefix: false,
      style_pack: 'prestige',
    });
    const result = await renderProject({ project: TEST_SLUG_REVIEW, dry_run: true });
    assert.match(result.error, /No manifest/);
  });

  it('accepts output path override', async () => {
    cleanup();
    const root = await buildProject(TEST_SLUG_REVIEW);
    const result = await renderProject({
      project: TEST_SLUG_REVIEW,
      output: 'renders/draft/custom-name.mp4',
      dry_run: true,
    });
    assert.ok(!result.error);
    assert.equal(result.output, join(root, 'renders/draft/custom-name.mp4'));
  });

  it('preserves manifest.audio through the render-prop assembly (ANI-106)', async () => {
    cleanup();
    const result = await initProject({
      title: 'Audio End-to-End',
      slug: TEST_SLUG_REVIEW,
      date_prefix: false,
      style_pack: 'prestige',
    });
    const root = result.project_root;
    const scenes = ['sc_a', 'sc_b'];
    for (const id of scenes) {
      writeFileSync(join(root, `scenes/${id}.json`), JSON.stringify(makeSceneJSON(id), null, 2));
      await saveProjectArtifact({ project: TEST_SLUG_REVIEW, kind: 'scene', scene_id: id, path: `scenes/${id}.json` });
    }
    const manifestWithAudio = {
      sequence_id: 'seq_audio_test',
      style: 'prestige',
      audio: { src: 'audio/bg.mp3', volume: 0.7, fade_in_ms: 500, fade_out_ms: 1000, offset_s: 2 },
      scenes: [
        { scene: 'sc_a', duration_s: 3 },
        { scene: 'sc_b', duration_s: 3 },
      ],
    };
    writeFileSync(join(root, 'motion/manifests/root.json'), JSON.stringify(manifestWithAudio, null, 2));
    await saveProjectArtifact({ project: TEST_SLUG_REVIEW, kind: 'manifest', path: 'motion/manifests/root.json' });

    const render = await renderProject({ project: TEST_SLUG_REVIEW, dry_run: true });

    assert.ok(!render.error, `unexpected error: ${render.error}`);
    assert.ok(render.props.manifest.audio, 'audio field must survive to props.manifest');
    assert.equal(render.props.manifest.audio.src, 'audio/bg.mp3');
    assert.equal(render.props.manifest.audio.volume, 0.7);
    assert.equal(render.props.manifest.audio.fade_in_ms, 500);
    assert.equal(render.props.manifest.audio.fade_out_ms, 1000);
    assert.equal(render.props.manifest.audio.offset_s, 2);
  });
});
