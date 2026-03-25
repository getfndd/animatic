/**
 * MCP Server boot smoke test.
 *
 * Spawns the server process and verifies it starts without import errors.
 * Does NOT test tool functionality — just that all imports resolve and
 * the server reaches the "running" log line.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '..', 'index.js');

describe('MCP server boot', () => {
  it('starts without import or initialization errors', async () => {
    const result = await new Promise((resolve) => {
      const child = spawn('node', [SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });

      let stderr = '';
      let stdout = '';

      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.stdout.on('data', (data) => { stdout += data.toString(); });

      // Give the server time to initialize, then kill it
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
      }, 2000);

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stderr, stdout });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ code: 1, signal: null, stderr: err.message, stdout: '' });
      });
    });

    // Server should have printed the "running" line to stderr
    assert.ok(
      result.stderr.includes('Animatic MCP Server running on stdio'),
      `Expected server startup message in stderr, got: ${result.stderr.slice(0, 500)}`
    );

    // Should not contain "Error" or "Cannot find module" in stderr
    const hasImportError = result.stderr.includes('Cannot find module')
      || result.stderr.includes('SyntaxError')
      || result.stderr.includes('has already been declared');
    assert.ok(!hasImportError, `Server had import errors: ${result.stderr.slice(0, 500)}`);
  });
});
