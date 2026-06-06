/**
 * Figma REST client (ANI-114)
 *
 * Minimal read-side client for the Figma REST API — fetches node trees for
 * frame→scene conversion. Ported from the Preset repo's production client
 * (`packages/mcp/src/figma/api.ts`): URL/key parsing, color conversion,
 * token redaction, and status-code error mapping carry over; the
 * `/files/:key/nodes` endpoint and the retry policy are new here.
 *
 * BYOK, same as the TTS providers (ANI-128): the token comes from the
 * user's environment (`FIGMA_TOKEN` or `FIGMA_PERSONAL_ACCESS_TOKEN`) —
 * nothing is bundled, and the hosted edge surface never sees it.
 */

const FIGMA_API_BASE = 'https://api.figma.com/v1';
const ATTEMPT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Extract a file key from a Figma URL or bare key.
 * Accepts figma.com/file/:key/... and figma.com/design/:key/... forms.
 *
 * @param {string} urlOrKey
 * @returns {string|null}
 */
export function extractFileKey(urlOrKey) {
  if (typeof urlOrKey !== 'string' || urlOrKey.trim().length === 0) return null;
  const input = urlOrKey.trim();

  // Bare key: a single alphanumeric token.
  if (/^[a-zA-Z0-9]+$/.test(input)) return input;

  try {
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    const fileIndex = parts.findIndex(p => p === 'file' || p === 'design');
    if (fileIndex !== -1 && parts[fileIndex + 1]) return parts[fileIndex + 1];
  } catch {
    const match = input.match(/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Normalize a node id: Figma URLs carry `node-id=12-34` while the API
 * expects `12:34`.
 *
 * @param {string} nodeId
 * @returns {string}
 */
export function normalizeNodeId(nodeId) {
  return String(nodeId || '').trim().replace(/-/g, ':');
}

/**
 * Convert Figma RGBA (0-1 floats) to a hex string. Alpha is appended only
 * when meaningfully below 1.
 *
 * @param {{ r: number, g: number, b: number, a?: number }} color
 * @returns {string}
 */
export function figmaColorToHex(color) {
  const to255 = (v) => Math.round(Math.min(1, Math.max(0, v ?? 0)) * 255);
  const hex = (v) => to255(v).toString(16).padStart(2, '0');
  const base = `#${hex(color?.r)}${hex(color?.g)}${hex(color?.b)}`;
  const a = color?.a;
  return a != null && a < 0.999 ? `${base}${hex(a)}` : base;
}

/** Redact a token for error messages / logs. */
export function redactToken(token) {
  if (typeof token !== 'string' || token.length < 8) return '****';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/** Resolve the Figma token from the environment, or throw a clear error. */
export function getFigmaToken(env = process.env) {
  const token = env.FIGMA_TOKEN || env.FIGMA_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'FIGMA_TOKEN is not set. figma_frame_to_scene needs a Figma personal access token ' +
      '(figma.com → Settings → Security → Personal access tokens) — export FIGMA_TOKEN, ' +
      'or add it to the `env` block of the animatic server entry in your MCP config.',
    );
  }
  return token;
}

/** Map a non-OK Figma response to an actionable error. */
function figmaHttpError(status, detail, token) {
  switch (status) {
    case 401:
      return new Error(`Figma API 401: token ${redactToken(token)} is invalid or expired.`);
    case 403:
      return new Error('Figma API 403: token lacks access to this file (check file sharing / token scopes).');
    case 404:
      return new Error('Figma API 404: file or node not found — check the file key and node id.');
    case 429:
      return new Error('Figma API 429: rate limited.');
    default:
      return new Error(`Figma API HTTP ${status}: ${String(detail).slice(0, 300)}`);
  }
}

/**
 * GET a Figma API path with retry on transient failures (429/5xx/network).
 *
 * @param {string} path - Path under /v1, e.g. `/files/KEY/nodes?ids=1:2`
 * @param {object} [opts]
 * @param {Function} [opts.fetchImpl] - fetch override (tests)
 * @param {object} [opts.env] - environment override (tests)
 * @returns {Promise<object>} Parsed JSON body
 */
export async function figmaGet(path, opts = {}) {
  const token = getFigmaToken(opts.env);
  const doFetch = opts.fetchImpl ?? fetch;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await doFetch(`${FIGMA_API_BASE}${path}`, {
        headers: { 'X-Figma-Token': token },
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        const err = figmaHttpError(res.status, detail, token);
        if (res.status === 429 || res.status >= 500) {
          lastError = err;
          if (attempt < MAX_ATTEMPTS) {
            await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
            continue;
          }
        }
        throw err;
      }
      return await res.json();
    } catch (err) {
      if (err.message?.startsWith('Figma API')) throw err;
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
        continue;
      }
    }
  }
  throw new Error(`Figma API failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}`);
}

/**
 * Fetch a single node's document subtree.
 *
 * @param {string} fileKeyOrUrl - File key or full figma.com URL
 * @param {string} nodeId - Node id (`12:34` or URL-style `12-34`)
 * @param {object} [opts] - { fetchImpl, env }
 * @returns {Promise<{ file_key: string, node_id: string, name: string, document: object }>}
 */
export async function fetchNode(fileKeyOrUrl, nodeId, opts = {}) {
  const fileKey = extractFileKey(fileKeyOrUrl);
  if (!fileKey) {
    throw new Error(`Cannot extract a Figma file key from "${fileKeyOrUrl}".`);
  }
  const id = normalizeNodeId(nodeId);
  if (!id) throw new Error('fetchNode requires a node id.');

  const body = await figmaGet(
    `/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(id)}`,
    opts,
  );
  const entry = body?.nodes?.[id];
  if (!entry?.document) {
    throw new Error(`Figma returned no document for node ${id} in file ${fileKey}.`);
  }
  return { file_key: fileKey, node_id: id, name: body.name || null, document: entry.document };
}
