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
 * Fetch the top of a file's node tree (for frame-name read-back, ANI-113).
 * Depth 2 reaches document → pages → top-level frames.
 *
 * @param {string} fileKeyOrUrl
 * @param {object} [opts] - { depth=2, fetchImpl, env }
 * @returns {Promise<{ file_key: string, name: string, document: object }>}
 */
export async function fetchFileTree(fileKeyOrUrl, opts = {}) {
  const fileKey = extractFileKey(fileKeyOrUrl);
  if (!fileKey) throw new Error(`Cannot extract a Figma file key from "${fileKeyOrUrl}".`);
  const depth = opts.depth ?? 2;
  const body = await figmaGet(`/files/${encodeURIComponent(fileKey)}?depth=${depth}`, opts);
  if (!body?.document) throw new Error(`Figma returned no document for file ${fileKey}.`);
  return { file_key: fileKey, name: body.name || null, document: body.document };
}

/**
 * Fetch a file's comments (ANI-113 round-trip — plain REST, no plugin).
 *
 * @param {string} fileKeyOrUrl
 * @param {object} [opts] - { fetchImpl, env }
 * @returns {Promise<{ file_key: string, comments: object[] }>}
 */
export async function fetchComments(fileKeyOrUrl, opts = {}) {
  const fileKey = extractFileKey(fileKeyOrUrl);
  if (!fileKey) throw new Error(`Cannot extract a Figma file key from "${fileKeyOrUrl}".`);
  const body = await figmaGet(`/files/${encodeURIComponent(fileKey)}/comments`, opts);
  return { file_key: fileKey, comments: body?.comments || [] };
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

/**
 * Fetch the file's image-fill download URLs (ANI-175). Returns the
 * `imageRef → url` map from the "Get Image Fills" endpoint — the RAW fill
 * paint per `node.fills[].imageRef`, NOT a render of any node's subtree (so
 * a fill can back a node whose children still render on top, no duplication).
 *
 * The URLs are time-limited S3 links — download them immediately (see
 * `downloadBinary`) and never persist the URL itself.
 *
 * @param {string} fileKeyOrUrl
 * @param {object} [opts] - { fetchImpl, env }
 * @returns {Promise<{ file_key: string, images: Record<string, string> }>}
 */
export async function fetchImageFills(fileKeyOrUrl, opts = {}) {
  const fileKey = extractFileKey(fileKeyOrUrl);
  if (!fileKey) throw new Error(`Cannot extract a Figma file key from "${fileKeyOrUrl}".`);
  const body = await figmaGet(`/files/${encodeURIComponent(fileKey)}/images`, opts);
  return { file_key: fileKey, images: body?.meta?.images || {} };
}

/**
 * Download a binary asset from a (time-limited) URL. Deliberately NOT
 * `figmaGet`: image-fill URLs are presigned S3 links — they must not carry the
 * `X-Figma-Token` header and aren't under `api.figma.com`. Retries transient
 * 429/5xx with the same backoff policy as the API client.
 *
 * @param {string} url
 * @param {object} [opts] - { fetchImpl }
 * @returns {Promise<{ buffer: Buffer, bytes: number, contentType: string|null }>}
 */
export async function downloadBinary(url, opts = {}) {
  const doFetch = opts.fetchImpl ?? fetch;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await doFetch(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
      if (!res.ok) {
        const err = new Error(`Asset download HTTP ${res.status} for ${String(url).slice(0, 120)}`);
        if (res.status === 429 || res.status >= 500) {
          lastError = err;
          if (attempt < MAX_ATTEMPTS) { await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1)); continue; }
        }
        throw err;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers?.get?.('content-type') ?? null;
      return { buffer, bytes: buffer.length, contentType };
    } catch (err) {
      if (err.message?.startsWith('Asset download HTTP')) throw err;
      lastError = err;
      if (attempt < MAX_ATTEMPTS) { await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1)); continue; }
    }
  }
  throw new Error(`Asset download failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}`);
}

/**
 * Detect an image's format and intrinsic dimensions from its bytes (ANI-175).
 * Figma image-fill URLs return the ORIGINAL uploaded asset — commonly JPEG,
 * not PNG — so the extension/mime must come from the bytes, never a hardcoded
 * `.png`. Dimensions are parsed for PNG (IHDR) and JPEG (SOFn markers), which
 * cover effectively all real fills; GIF/WebP are recognized for the correct
 * extension but may return null dims (→ CROP degrades, see frame-to-scene).
 *
 * @param {Buffer} buffer
 * @param {string|null} [contentType] - download Content-Type, used only as a tiebreaker
 * @returns {{ ok: true, ext: string, mime: string, width: number|null, height: number|null }
 *           | { ok: false, reason: string }}
 */
export function sniffImage(buffer, contentType = null) {
  const b = buffer;
  if (!b || b.length < 12) return { ok: false, reason: 'not an image (too small)' };

  // PNG: 89 50 4E 47 0D 0A 1A 0A, then IHDR with width/height at bytes 16-24.
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { ok: true, ext: 'png', mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // GIF: "GIF8" — logical screen descriptor (LE) at bytes 6-10.
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return { ok: true, ext: 'gif', mime: 'image/gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  // WebP: "RIFF"...."WEBP". Dims vary by VP8/VP8L/VP8X subchunk — leave null.
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { ok: true, ext: 'webp', mime: 'image/webp', width: null, height: null };
  }
  // JPEG: FF D8 ... walk segments to the SOFn marker for dimensions.
  if (b[0] === 0xff && b[1] === 0xd8) {
    const dims = jpegDimensions(b);
    return { ok: true, ext: 'jpg', mime: 'image/jpeg', width: dims?.width ?? null, height: dims?.height ?? null };
  }
  return { ok: false, reason: `unrecognized image format${contentType ? ` (content-type ${contentType})` : ''}` };
}

/** Walk JPEG segments to the first SOF marker and read frame height/width. */
function jpegDimensions(b) {
  let i = 2;
  while (i < b.length - 8) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    // SOF0..SOF15 carry frame dims, excluding DHT(C4)/DAC(CC)/RSTn markers.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    // Standalone markers (no length): RSTn (D0-D7), SOI(D8), EOI(D9), TEM(01).
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}
