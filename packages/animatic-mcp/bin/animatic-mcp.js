#!/usr/bin/env node

/**
 * @presetai/animatic-mcp — MCP server entry point
 *
 * Usage:
 *   npx -y @presetai/animatic-mcp
 *
 * Or in Claude Desktop / Cursor MCP config:
 *   { "command": "npx", "args": ["-y", "@presetai/animatic-mcp"] }
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, '../mcp/index.js');

await import(serverPath);
