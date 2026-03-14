#!/usr/bin/env node
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod/v4');

// ── Config ───────────────────────────────────────────────────────────────────

const SPARKUI_URL = (process.env.SPARKUI_URL || 'http://localhost:3457').replace(/\/+$/, '');
const SPARKUI_TOKEN = process.env.SPARKUI_TOKEN || '';

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function sparkuiRequest(method, path, body) {
  const url = `${SPARKUI_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (SPARKUI_TOKEN) {
    headers['Authorization'] = `Bearer ${SPARKUI_TOKEN}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `SparkUI API error: ${res.status}`);
  }
  return data;
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'sparkui',
  version: '0.1.0',
});

// Tool: sparkui_list_templates
server.tool(
  'sparkui_list_templates',
  'List available SparkUI page templates. Returns template names that can be used with sparkui_push.',
  {},
  async () => {
    const data = await sparkuiRequest('GET', '/');
    return {
      content: [{ type: 'text', text: JSON.stringify({ templates: data.templates }, null, 2) }],
    };
  }
);

// Tool: sparkui_list_components
server.tool(
  'sparkui_list_components',
  'List available SparkUI components for composing pages with sparkui_compose.',
  {},
  async () => {
    const components = [
      'header', 'button', 'timer', 'checklist', 'progress',
      'text', 'image', 'divider', 'card', 'input',
      'select', 'table', 'chart', 'code', 'form'
    ];
    return {
      content: [{ type: 'text', text: JSON.stringify({ components }, null, 2) }],
    };
  }
);

// Tool: sparkui_push
server.tool(
  'sparkui_push',
  'Push a page from a SparkUI template. Returns the page ID and URL.',
  {
    template: z.string().describe('Template name (e.g. "checkout", "macro-tracker", "workout-timer")'),
    data: z.record(z.string(), z.any()).describe('Template data object'),
    ttl: z.optional(z.number().describe('Time-to-live in seconds (default 3600)')),
    og: z.optional(z.object({
      title: z.optional(z.string()),
      description: z.optional(z.string()),
      image: z.optional(z.string()),
    }).describe('Open Graph metadata overrides')),
  },
  async ({ template, data, ttl, og }) => {
    const body = { template, data };
    if (ttl !== undefined) body.ttl = ttl;
    if (og) body.og = og;

    const result = await sparkuiRequest('POST', '/api/push', body);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool: sparkui_compose
server.tool(
  'sparkui_compose',
  'Compose a page from SparkUI components. Returns the page ID and URL.',
  {
    title: z.string().describe('Page title'),
    sections: z.array(z.object({
      type: z.string().describe('Component type (e.g. "header", "button", "timer", "checklist")'),
      config: z.optional(z.record(z.string(), z.any()).describe('Component configuration')),
    })).describe('Array of sections to compose'),
    ttl: z.optional(z.number().describe('Time-to-live in seconds')),
  },
  async ({ title, sections, ttl }) => {
    const body = { title, sections };
    if (ttl !== undefined) body.ttl = ttl;

    const result = await sparkuiRequest('POST', '/api/compose', body);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool: sparkui_page_status
server.tool(
  'sparkui_page_status',
  'Check if a SparkUI page exists and get its status.',
  {
    id: z.string().describe('Page UUID'),
  },
  async ({ id }) => {
    try {
      const url = `${SPARKUI_URL}/s/${id}`;
      const res = await fetch(url);

      if (res.status === 410) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ exists: false, status: 'expired' }, null, 2) }],
        };
      }

      if (res.status === 404) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ exists: false, status: 'not_found' }, null, 2) }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            exists: true,
            status: 'active',
            url: `/s/${id}`,
            fullUrl: `${SPARKUI_URL}/s/${id}`,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ exists: false, error: err.message }, null, 2) }],
      };
    }
  }
);

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SparkUI MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
