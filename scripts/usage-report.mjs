#!/usr/bin/env node

/**
 * usage-report.mjs — Generate usage summary from telemetry data
 *
 * Usage:
 *   node scripts/usage-report.mjs                    # Print report
 *   node scripts/usage-report.mjs --json             # JSON output
 *   node scripts/usage-report.mjs --post-to-slack    # Post to Slack webhook
 *
 * This reads from the local telemetry log (~/.animatic/usage-log.jsonl)
 * and/or queries the remote telemetry endpoint.
 *
 * For automated reports, set up a cron or use the /schedule skill:
 *   /schedule "usage report" --cron "0 9 * * 1" --command "node scripts/usage-report.mjs"
 */

import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const LOG_FILE = resolve(homedir(), '.animatic', 'usage-log.jsonl');

// ── Local log reader ────────────────────────────────────────────────────────

function readLocalLog() {
  if (!existsSync(LOG_FILE)) return [];
  return readFileSync(LOG_FILE, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// ── Report generator ────────────────────────────────────────────────────────

function generateReport(events) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  const last7d = events.filter(e => now - e.ts < week);
  const last24h = events.filter(e => now - e.ts < day);

  // Tool usage counts
  const toolCounts = {};
  const cliCounts = {};
  let bootCount = 0;

  for (const e of last7d) {
    if (e.event === 'mcp.tool') {
      toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
    } else if (e.event?.startsWith('cli.')) {
      const cmd = e.event.replace('cli.', '');
      cliCounts[cmd] = (cliCounts[cmd] || 0) + 1;
    } else if (e.event === 'mcp.boot') {
      bootCount++;
    }
  }

  // Sort by usage
  const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topCLI = Object.entries(cliCounts).sort((a, b) => b[1] - a[1]);

  // Unique devices
  const devices = new Set(events.map(e => e.did).filter(Boolean));

  return {
    period: {
      total_events: events.length,
      last_7d: last7d.length,
      last_24h: last24h.length,
    },
    devices: {
      total: devices.size,
    },
    mcp: {
      boot_count_7d: bootCount,
      tool_calls_7d: Object.values(toolCounts).reduce((a, b) => a + b, 0),
      top_tools: topTools,
    },
    cli: {
      command_calls_7d: Object.values(cliCounts).reduce((a, b) => a + b, 0),
      top_commands: topCLI,
    },
  };
}

function formatReport(report) {
  let out = `
━━━ Animatic Usage Report ━━━

Period: Last 7 days
Events: ${report.period.last_7d} (${report.period.last_24h} in last 24h)
Devices: ${report.devices.total}

MCP Server
  Boots: ${report.mcp.boot_count_7d}
  Tool calls: ${report.mcp.tool_calls_7d}
`;

  if (report.mcp.top_tools.length > 0) {
    out += '\n  Top tools:\n';
    for (const [tool, count] of report.mcp.top_tools) {
      out += `    ${tool.padEnd(30)} ${count}\n`;
    }
  }

  if (report.cli.top_commands.length > 0) {
    out += `\nCLI\n  Commands: ${report.cli.command_calls_7d}\n`;
    for (const [cmd, count] of report.cli.top_commands) {
      out += `    ${cmd.padEnd(20)} ${count}\n`;
    }
  }

  out += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────

const events = readLocalLog();
const report = generateReport(events);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(formatReport(report));
}

// Post to Slack if requested
if (process.argv.includes('--post-to-slack')) {
  const webhook = process.env.ANIMATIC_SLACK_WEBHOOK;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `\`\`\`${formatReport(report)}\`\`\``,
        }),
      });
      console.log('Posted to Slack');
    } catch (err) {
      console.error(`Slack post failed: ${err.message}`);
    }
  } else {
    console.error('Set ANIMATIC_SLACK_WEBHOOK to post reports');
  }
}
