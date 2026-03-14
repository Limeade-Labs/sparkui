# MCP Setup

Use SparkUI from AI clients like Claude Desktop, Cursor, and Windsurf via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

## What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI applications connect to external tools and data sources. Instead of writing custom integrations, any MCP-compatible client can use SparkUI tools through a standard protocol.

The SparkUI MCP server exposes tools like `sparkui_push` and `sparkui_compose` that AI clients can call to create ephemeral web pages.

## Prerequisites

1. SparkUI server running (see [Getting Started](./getting-started.md))
2. Your push token from `.env`
3. An MCP-compatible client (Claude Desktop, Cursor, Windsurf, Cline, etc.)

## Install the MCP Server

```bash
cd mcp-server
npm install
```

The MCP server is a lightweight Node.js process that communicates with your SparkUI server over HTTP.

## Claude Desktop Setup

Edit your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sparkui": {
      "command": "node",
      "args": ["/absolute/path/to/sparkui/mcp-server/index.js"],
      "env": {
        "SPARKUI_URL": "http://localhost:3457",
        "SPARKUI_TOKEN": "your-push-token"
      }
    }
  }
}
```

Restart Claude Desktop after saving. You should see "sparkui" in the MCP tools list (🔨 icon).

> **Tip:** Use an absolute path for the `args` value. Relative paths may not resolve correctly.

## Cursor Setup

Add to `.cursor/mcp.json` in your project root (or global config):

```json
{
  "mcpServers": {
    "sparkui": {
      "command": "node",
      "args": ["/absolute/path/to/sparkui/mcp-server/index.js"],
      "env": {
        "SPARKUI_URL": "http://localhost:3457",
        "SPARKUI_TOKEN": "your-push-token"
      }
    }
  }
}
```

## Windsurf Setup

Add to `.windsurf/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "sparkui": {
      "command": "node",
      "args": ["/absolute/path/to/sparkui/mcp-server/index.js"],
      "env": {
        "SPARKUI_URL": "http://localhost:3457",
        "SPARKUI_TOKEN": "your-push-token"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPARKUI_URL` | No | `http://localhost:3457` | Base URL of the SparkUI server |
| `SPARKUI_TOKEN` | Yes | — | Push token for API authentication |

## Available MCP Tools

### `sparkui_list_templates`

List available page templates.

**Parameters:** None

**Returns:**

```json
{ "templates": ["macro-tracker", "ws-test", "feedback-form", "checkout", "workout-timer"] }
```

### `sparkui_list_components`

List available components for page composition.

**Parameters:** None

**Returns:**

```json
{ "components": ["header", "button", "timer", "checklist", "progress", "stats", "form", "tabs"] }
```

### `sparkui_push`

Create a page from a template.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | string | Yes | Template name |
| `data` | object | Yes | Template data |
| `ttl` | number | No | Time-to-live in seconds |
| `og` | object | No | Open Graph overrides (`title`, `description`, `image`) |

### `sparkui_compose`

Compose a page from individual components.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Page title |
| `sections` | array | Yes | Array of `{ type, config }` component sections |
| `ttl` | number | No | Time-to-live in seconds |

### `sparkui_page_status`

Check if a page is still active.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Page UUID |

## Example Usage

Once configured, you can ask your AI client naturally:

> "Create a feedback form asking about the new feature"

The AI client will call `sparkui_push` with the feedback-form template and return a URL you can open.

> "Make a dashboard showing my project stats: 42 tasks done, 8 in progress, 3 blocked"

The AI will use `sparkui_compose` with header, stats, and progress components.

> "Build me a workout timer: 3 rounds of push-ups, squats, and planks with 60-second rest"

The AI calls `sparkui_push` with the workout-timer template.

## Architecture

```
Claude Desktop / Cursor / Windsurf
        ↓ (MCP stdio)
   SparkUI MCP Server (Node.js)
        ↓ (HTTP)
   SparkUI Server (localhost:3457)
        ↓
   Ephemeral web pages
```

The MCP server is a thin client — it translates MCP tool calls into SparkUI HTTP API requests. It doesn't import SparkUI internals or require being co-located with the SparkUI server.

## Troubleshooting

**"Tool not found" in Claude Desktop:**
- Ensure you restarted Claude Desktop after editing the config
- Check that the path to `index.js` is absolute and correct
- Verify the MCP server starts: `node /path/to/mcp-server/index.js` (it should wait for stdin)

**"SparkUI API error: 401":**
- Your `SPARKUI_TOKEN` doesn't match the `PUSH_TOKEN` in your SparkUI `.env`
- Check for trailing whitespace in the token

**"Connection refused":**
- SparkUI server isn't running — start it with `sparkui start`
- Check that `SPARKUI_URL` matches your server's actual port
