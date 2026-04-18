/**
 * Animation Project Model
 *
 * Represents one end-to-end motion deliverable. Projects live in a
 * `projects/` directory at the repo root. Provides CRUD operations
 * for project lifecycle: init → populate → review → approve.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { analyzeScene } from './analyze.js';
import { evaluateSequence } from './evaluate.js';
import { validateFullManifest } from './guardrails.js';
import { STYLE_PACKS, STYLE_TO_PERSONALITY } from './planner.js';
import { runPreflight } from './preflight.js';
import { renderRemotionSequence } from './video.js';

// ── Constants ────────────────────────────────────────────────────────────────

const PROJECTS_ROOT = join(process.cwd(), 'projects');

export const STATUS_PROJECT = ['draft', 'blocked', 'in_review', 'approved', 'archived'];
export const STATUS_SCENE   = ['draft', 'compiled', 'reviewed', 'approved'];
export const STATUS_VERSION = ['draft', 'candidate', 'approved', 'rejected'];

/** Subdirectories created for every new project. */
const PROJECT_DIRS = [
  'brief',
  'brief/references',
  'brief/references/moodboard',
  'brief/references/assets',
  'concept',
  'scenes',
  'motion',
  'motion/compiled',
  'motion/manifests',
  'motion/personalities',
  'prototypes',
  'prototypes/html',
  'prototypes/captures',
  'audio',
  'audio/sfx',
  'renders',
  'renders/draft',
  'renders/approved',
  'renders/frames',
  'review',
  'versions',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** YYYY-MM-DD date string. */
function datePrefix() {
  return new Date().toISOString().slice(0, 10);
}

/** ISO timestamp. */
function timestamp() {
  return new Date().toISOString();
}

/** Compute aspect ratio string from w/h. */
function aspectRatio(w, h) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

/** Read and parse a JSON file. Returns null on any error. */
async function readJSON(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Read a text file. Returns null on any error. */
async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** Write object as formatted JSON. */
async function writeJSON(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Strip a leading YYYY-MM-DD- prefix from a directory name to get the slug. */
function stripDatePrefix(dirName) {
  return dirName.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

// ── initProject ──────────────────────────────────────────────────────────────

/**
 * Create a new project folder structure and project.json.
 *
 * @param {object} config
 * @param {string} config.title
 * @param {string} config.slug
 * @param {boolean} [config.date_prefix=true]
 * @param {string} [config.brand]
 * @param {string} [config.personality]
 * @param {string} [config.style_pack]
 * @param {{ w: number, h: number }} [config.resolution]
 * @param {number} [config.fps]
 * @param {number} [config.duration_target_s]
 * @returns {Promise<{ project_id: string, project_root: string, project_file: string }>}
 */
export async function initProject(config) {
  const {
    title,
    slug,
    date_prefix = true,
    brand = null,
    personality = null,
    style_pack = null,
    resolution = { w: 1920, h: 1080 },
    fps = 60,
    duration_target_s = 30,
  } = config;

  const folderName = date_prefix ? `${datePrefix()}-${slug}` : slug;
  const projectRoot = join(PROJECTS_ROOT, folderName);
  const projectFile = join(projectRoot, 'project.json');

  // Create all subdirectories (recursive handles parent creation)
  for (const dir of PROJECT_DIRS) {
    await mkdir(join(projectRoot, dir), { recursive: true });
  }

  const now = datePrefix();
  const projectData = {
    id: slug,
    slug,
    title,
    status: 'draft',
    created_at: now,
    updated_at: timestamp(),
    brand: brand || null,
    personality: personality || null,
    style_pack: style_pack || null,
    format: {
      aspect_ratio: aspectRatio(resolution.w, resolution.h),
      resolution: { w: resolution.w, h: resolution.h },
      fps,
      duration_target_s,
    },
    entrypoints: {
      brief: 'brief/brief.md',
      storyboard: 'concept/storyboard.json',
      root_manifest: null,
      latest_render: null,
      approved_render: null,
    },
    scenes: [],
    versions: [],
    review: {
      evaluation: 'review/evaluation.json',
      critic: 'review/critic.json',
      notes: 'review/notes.md',
    },
    tags: [],
    owners: [],
    metadata: {},
  };

  await writeJSON(projectFile, projectData);

  return {
    project_id: slug,
    project_root: projectRoot,
    project_file: projectFile,
  };
}

// ── listProjects ─────────────────────────────────────────────────────────────

/**
 * List projects from the projects/ directory.
 *
 * @param {object} [options]
 * @param {string} [options.status] - Filter by project status.
 * @param {number} [options.limit=20] - Max results.
 * @returns {Promise<Array<{ id: string, slug: string, title: string, status: string, personality: string|null, updated_at: string, project_root: string }>>}
 */
export async function listProjects(options = {}) {
  const { status, limit = 20 } = options;

  let entries;
  try {
    entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
  } catch {
    // projects/ doesn't exist yet
    return [];
  }

  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectRoot = join(PROJECTS_ROOT, entry.name);
    const data = await readJSON(join(projectRoot, 'project.json'));
    if (!data) continue;

    if (status && data.status !== status) continue;

    projects.push({
      id: data.id,
      slug: data.slug,
      title: data.title,
      status: data.status,
      personality: data.personality || null,
      updated_at: data.updated_at,
      project_root: projectRoot,
    });
  }

  // Sort by updated_at descending
  projects.sort((a, b) => (b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0));

  return projects.slice(0, limit);
}

// ── getProject ───────────────────────────────────────────────────────────────

/**
 * Get full project.json by slug or path.
 *
 * @param {object} identifier
 * @param {string} identifier.project - Slug or directory path.
 * @returns {Promise<object|null>} Parsed project.json with project_root, or null.
 */
export async function getProject(identifier) {
  const { project } = identifier;

  // If it looks like an absolute path, try it directly
  if (project.startsWith('/')) {
    const data = await readJSON(join(project, 'project.json'));
    if (data) return { ...data, project_root: project };
    return null;
  }

  // Scan projects/ directory and match by slug
  let entries;
  try {
    entries = await readdir(PROJECTS_ROOT, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirSlug = stripDatePrefix(entry.name);
    if (dirSlug === project || entry.name === project) {
      const projectRoot = join(PROJECTS_ROOT, entry.name);
      const data = await readJSON(join(projectRoot, 'project.json'));
      if (data) return { ...data, project_root: projectRoot };
    }
  }

  return null;
}

// ── getProjectContext ────────────────────────────────────────────────────────

/**
 * Return minimum working context for a project.
 *
 * @param {object} options
 * @param {string} options.project - Slug or path.
 * @param {string[]} options.include - Keys to include: brief, storyboard, scenes, manifest, review.
 * @returns {Promise<object|null>}
 */
export async function getProjectContext(options) {
  const { project: projectId, include = [] } = options;

  const proj = await getProject({ project: projectId });
  if (!proj) return null;

  const { project_root } = proj;
  const result = { project: proj };

  for (const key of include) {
    switch (key) {
      case 'brief': {
        const briefPath = proj.entrypoints?.brief;
        result.brief = briefPath
          ? await readText(join(project_root, briefPath))
          : null;
        break;
      }
      case 'storyboard': {
        const sbPath = proj.entrypoints?.storyboard;
        result.storyboard = sbPath
          ? await readJSON(join(project_root, sbPath))
          : null;
        break;
      }
      case 'scenes': {
        // Read all scene files referenced in project.scenes
        const scenes = [];
        for (const sceneEntry of proj.scenes || []) {
          const scenePath = sceneEntry.source || sceneEntry.path;
          const sceneData = scenePath
            ? await readJSON(join(project_root, scenePath))
            : null;
          scenes.push({ ...sceneEntry, data: sceneData });
        }
        result.scenes = scenes;
        break;
      }
      case 'manifest': {
        const manifestPath = proj.entrypoints?.root_manifest;
        result.manifest = manifestPath
          ? await readJSON(join(project_root, manifestPath))
          : null;
        break;
      }
      case 'review': {
        const review = {};
        if (proj.review?.evaluation) {
          review.evaluation = await readJSON(join(project_root, proj.review.evaluation));
        }
        if (proj.review?.critic) {
          review.critic = await readJSON(join(project_root, proj.review.critic));
        }
        if (proj.review?.notes) {
          review.notes = await readText(join(project_root, proj.review.notes));
        }
        result.review = review;
        break;
      }
      default:
        // Unknown include key — skip silently
        break;
    }
  }

  return result;
}

// ── saveProjectArtifact ──────────────────────────────────────────────────────

/**
 * Register an artifact in project.json.
 *
 * @param {object} options
 * @param {string} options.project - Slug or path.
 * @param {string} options.kind - Artifact kind: brief, storyboard, manifest, render, scene, version, review.
 * @param {string} [options.role] - Sub-role (e.g. "evaluation", "critic", "notes" for review kind).
 * @param {string} options.path - Relative path from project root.
 * @param {string} [options.scene_id] - Scene identifier (for scene kind).
 * @param {string} [options.version_id] - Version identifier (for version kind).
 * @param {object} [options.metadata] - Extra metadata to store.
 * @returns {Promise<object>} Updated project data.
 */
export async function saveProjectArtifact(options) {
  const {
    project: projectId,
    kind,
    role,
    path: artifactPath,
    scene_id,
    version_id,
    metadata = {},
  } = options;

  const proj = await getProject({ project: projectId });
  if (!proj) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const { project_root } = proj;
  const projectFile = join(project_root, 'project.json');

  // Remove project_root from the data we'll write back
  const { project_root: _root, ...projectData } = proj;

  // Update timestamp
  projectData.updated_at = timestamp();

  switch (kind) {
    case 'brief':
      projectData.entrypoints.brief = artifactPath;
      break;

    case 'storyboard':
      projectData.entrypoints.storyboard = artifactPath;
      break;

    case 'manifest':
      projectData.entrypoints.root_manifest = artifactPath;
      break;

    case 'render': {
      projectData.entrypoints.latest_render = artifactPath;
      if (role === 'approved') {
        projectData.entrypoints.approved_render = artifactPath;
      }
      break;
    }

    case 'scene': {
      const existing = projectData.scenes.findIndex(
        (s) => s.id === scene_id
      );
      const sceneEntry = {
        id: scene_id,
        source: artifactPath,
        status: 'draft',
        ...metadata,
      };
      if (existing >= 0) {
        projectData.scenes[existing] = { ...projectData.scenes[existing], ...sceneEntry };
      } else {
        projectData.scenes.push(sceneEntry);
      }
      break;
    }

    case 'version': {
      const versionEntry = {
        version_id: version_id || `v${projectData.versions.length + 1}`,
        path: artifactPath,
        status: 'draft',
        created_at: timestamp(),
        ...metadata,
      };
      projectData.versions.push(versionEntry);
      break;
    }

    case 'review': {
      if (role && projectData.review[role] !== undefined) {
        projectData.review[role] = artifactPath;
      }
      break;
    }

    default:
      throw new Error(`Unknown artifact kind: ${kind}`);
  }

  await writeJSON(projectFile, projectData);

  return { ...projectData, project_root };
}

// ── reviewProject ────────────────────────────────────────────────────────────

/**
 * Validate and evaluate a project's manifest, writing results to review/evaluation.json.
 *
 * @param {object} options
 * @param {string} options.project - Slug or path.
 * @param {string} [options.manifest] - Optional manifest path override (relative to project_root).
 * @param {string} [options.style] - Optional style pack override.
 * @returns {Promise<{ validation, evaluation, evaluation_error, personality, style, reviewed_at, manifest } | { error: string }>}
 */
export async function reviewProject(options) {
  const proj = await getProject({ project: options.project });
  if (!proj) {
    return { error: `Project "${options.project}" not found` };
  }

  const manifestPath = options.manifest || proj.entrypoints?.root_manifest;
  if (!manifestPath) {
    return { error: 'No manifest to review' };
  }

  const fullManifestPath = join(proj.project_root, manifestPath);
  const manifest = await readJSON(fullManifestPath);
  if (!manifest) {
    return { error: `Cannot read manifest at ${fullManifestPath}` };
  }

  const style = options.style || proj.style_pack || null;
  const personality = proj.personality
    || (style ? STYLE_TO_PERSONALITY[style] : null)
    || 'cinematic-dark';

  const validationResult = validateFullManifest(manifest, personality);

  let evaluationResult = null;
  let evaluationError = null;
  if (!style) {
    evaluationError = 'No style_pack set on project — evaluation skipped';
  } else if (!STYLE_PACKS.includes(style)) {
    evaluationError = `Unknown style "${style}" — evaluation skipped`;
  } else {
    const analyzedScenes = [];
    const loadErrors = [];
    for (const entry of proj.scenes || []) {
      const scenePath = entry.source || entry.path;
      if (!scenePath) continue;
      const sceneData = await readJSON(join(proj.project_root, scenePath));
      if (!sceneData) {
        loadErrors.push(scenePath);
        continue;
      }
      const { metadata } = analyzeScene(sceneData);
      analyzedScenes.push({ ...sceneData, metadata });
    }
    if (analyzedScenes.length === 0) {
      evaluationError = loadErrors.length > 0
        ? `No loadable scenes (errors: ${loadErrors.join(', ')}) — evaluation skipped`
        : 'No scenes registered on project — evaluation skipped';
    } else {
      try {
        evaluationResult = evaluateSequence({ manifest, scenes: analyzedScenes, style });
      } catch (err) {
        evaluationError = `Evaluation failed: ${err.message}`;
      }
    }
  }

  const reviewDir = join(proj.project_root, 'review');
  await mkdir(reviewDir, { recursive: true });
  const evaluationOutput = {
    validation: validationResult,
    evaluation: evaluationResult,
    evaluation_error: evaluationError,
    personality,
    style,
    reviewed_at: new Date().toISOString(),
    manifest: manifestPath,
  };

  await writeJSON(join(reviewDir, 'evaluation.json'), evaluationOutput);

  return evaluationOutput;
}

// ── renderProject ────────────────────────────────────────────────────────────

/**
 * Render a project's root manifest to an MP4 via Remotion.
 *
 * Loads the project's manifest and scene definitions, assembles the
 * `{ manifest, sceneDefs }` props Remotion expects, and spawns `npx remotion
 * render Sequence`. Optionally registers the output as `latest_render`.
 *
 * Preflight (ANI-115) runs by default before the render — it catches
 * missing encoders, missing vendored fonts, unresolved scene refs, missing
 * plates, and disk-space issues before compute is spent. Any `fail`-level
 * check aborts the render with a structured error unless `skip_preflight`
 * is explicitly set.
 *
 * @param {object} options
 * @param {string} options.project - Slug or path.
 * @param {string} [options.manifest] - Optional manifest path override (relative to project_root).
 * @param {string} [options.output] - Optional output path override (relative to project_root).
 * @param {boolean} [options.mark_as_latest=true] - Register output as latest_render.
 * @param {boolean} [options.dry_run=false] - Assemble props and skip the render.
 * @param {boolean} [options.skip_preflight=false] - Skip the preflight doctor (ANI-115).
 * @returns {Promise<{ output, props, missing_scenes, skipped, preflight? } | { error: string, preflight? }>}
 */
export async function renderProject(options) {
  const {
    project: projectId,
    manifest: manifestOverride,
    output: outputOverride,
    mark_as_latest = true,
    dry_run = false,
    skip_preflight = false,
  } = options;

  const proj = await getProject({ project: projectId });
  if (!proj) {
    return { error: `Project "${projectId}" not found` };
  }

  const manifestPath = manifestOverride || proj.entrypoints?.root_manifest;
  if (!manifestPath) {
    return { error: 'No manifest specified and no root_manifest in project.json' };
  }

  const fullManifestPath = join(proj.project_root, manifestPath);
  const manifest = await readJSON(fullManifestPath);
  if (!manifest) {
    return { error: `Cannot read manifest at ${fullManifestPath}` };
  }

  // Load scene definitions referenced by the manifest.
  // Build sceneDefs map (scene_id → scene) from project.scenes[].
  const sceneDefs = {};
  const missingScenes = [];
  for (const entry of proj.scenes || []) {
    const scenePath = entry.source || entry.path;
    if (!scenePath) continue;
    const sceneData = await readJSON(join(proj.project_root, scenePath));
    if (!sceneData) {
      missingScenes.push(scenePath);
      continue;
    }
    const id = sceneData.scene_id || entry.id;
    if (id) sceneDefs[id] = sceneData;
  }

  // Verify every manifest scene reference has a loaded definition.
  const manifestSceneIds = (manifest.scenes || []).map(s => s.scene).filter(Boolean);
  const unresolved = manifestSceneIds.filter(id => !sceneDefs[id]);
  if (unresolved.length > 0) {
    return {
      error: `Manifest references scene(s) not found in project: ${unresolved.join(', ')}`,
      missing_scenes: missingScenes,
    };
  }

  const outputName = outputOverride || `renders/draft/${proj.slug}-render.mp4`;
  const outputPath = join(proj.project_root, outputName);

  const props = { manifest, sceneDefs };

  // Preflight before anything expensive. Dry runs still benefit from the
  // report — they just don't abort on failure, mirroring the "assemble
  // props and skip the render" contract.
  let preflight = null;
  if (!skip_preflight) {
    preflight = await runPreflight(manifest, {
      sceneDefs,
      outputDir: join(proj.project_root, 'renders'),
    });
    if (!preflight.ok && !dry_run) {
      return {
        error: `Preflight failed: ${preflight.summary}. Fix the blockers or pass skip_preflight: true to override.`,
        preflight,
      };
    }
  }

  if (dry_run) {
    return {
      output: outputPath,
      output_relative: outputName,
      props,
      missing_scenes: missingScenes,
      skipped: 'dry_run',
      preflight,
    };
  }

  await renderRemotionSequence(props, outputPath);

  if (mark_as_latest) {
    await saveProjectArtifact({
      project: projectId,
      kind: 'render',
      role: 'latest_render',
      path: outputName,
    });
  }

  return {
    output: outputPath,
    output_relative: outputName,
    missing_scenes: missingScenes,
    preflight,
  };
}
