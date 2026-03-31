/**
 * Telemetry — Anonymous, opt-out usage tracking
 *
 * Records: command/tool name, tool count, scene count, OS, version.
 * Never records: file contents, scene data, paths, user identity.
 *
 * Opt out:
 *   animatic telemetry off
 *   ANIMATIC_TELEMETRY=off (env var)
 *   Creates ~/.animatic/telemetry-opt-out
 *
 * Data is sent to a simple counter endpoint. No PII. No cookies.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir, platform, arch } from 'node:os';

const CONFIG_DIR = resolve(homedir(), '.animatic');
const OPT_OUT_FILE = resolve(CONFIG_DIR, 'telemetry-opt-out');
const DEVICE_ID_FILE = resolve(CONFIG_DIR, 'device-id');

// Read version from package.json (lazy)
let _version = null;
function getVersion() {
  if (!_version) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname || '.', '../../package.json'), 'utf-8'));
      _version = pkg.version || '0.0.0';
    } catch {
      _version = '0.0.0';
    }
  }
  return _version;
}

// Anonymous device ID — random hex, not tied to anything personal
function getDeviceId() {
  ensureConfigDir();
  if (existsSync(DEVICE_ID_FILE)) {
    return readFileSync(DEVICE_ID_FILE, 'utf-8').trim();
  }
  const id = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  writeFileSync(DEVICE_ID_FILE, id);
  return id;
}

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Check if telemetry is enabled.
 */
export function isEnabled() {
  // Env var overrides everything
  const env = process.env.ANIMATIC_TELEMETRY;
  if (env === 'off' || env === 'false' || env === '0') return false;

  // Opt-out file
  if (existsSync(OPT_OUT_FILE)) return false;

  // CI environments — don't track
  if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) return false;

  return true;
}

/**
 * Opt out of telemetry.
 */
export function optOut() {
  ensureConfigDir();
  writeFileSync(OPT_OUT_FILE, 'opted out\n');
}

/**
 * Opt back in.
 */
export function optIn() {
  try { unlinkSync(OPT_OUT_FILE); } catch {}
}

/**
 * Record a telemetry event. Non-blocking, fire-and-forget.
 * Never throws — failures are silently ignored.
 *
 * @param {string} event - Event name (e.g., 'cli.score', 'mcp.boot')
 * @param {object} [meta] - Optional metadata (scene_count, etc.)
 */
export function track(event, meta = {}) {
  if (!isEnabled()) return;

  const payload = {
    event,
    v: getVersion(),
    os: platform(),
    arch: arch(),
    node: process.version,
    did: getDeviceId(),
    ts: Date.now(),
    ...meta,
  };

  // Write to local log for usage-report.mjs
  try {
    ensureConfigDir();
    const logFile = resolve(CONFIG_DIR, 'usage-log.jsonl');
    appendFileSync(logFile, JSON.stringify(payload) + '\n');
  } catch {}

  // Fire and forget to remote — never block, never throw
  try {
    const endpoint = process.env.ANIMATIC_TELEMETRY_ENDPOINT || 'https://telemetry.presetai.dev/v1/event';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {}); // Silently ignore network failures
  } catch {
    // fetch not available or other error — ignore
  }
}

/**
 * Track an MCP tool call.
 */
export function trackTool(toolName) {
  track('mcp.tool', { tool: toolName });
}

/**
 * Track MCP server boot.
 */
export function trackBoot(toolCount) {
  track('mcp.boot', { tools: toolCount });
}

/**
 * Track CLI command.
 */
export function trackCLI(command, meta = {}) {
  track(`cli.${command}`, meta);
}
