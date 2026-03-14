# SparkUI MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes SparkUI as tools for AI clients like Claude Desktop, Cursor, Windsurf, and Cline.

Any MCP-compatible client can create ephemeral web pages on the fly — checkout flows, workout timers, dashboards, forms — through natural language.

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

The server uses two environment variables:

| Variable | Description | Default |
|---|---|---|
| `SPARKUI_URL` | Base URL of the SparkUI server | `http://localhost:3457` |
| `SPARKUI_TOKEN` | Push API authentication token | *(required)* |

## Claude Desktop Setup

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

## Cursor / Windsurf Setup

Add to `.cursor/mcp.json` or `.windsurf/mcp.json` in your project root:

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

## Available Tools

### `sparkui_list_templates`

List available page templates.

**Parameters:** None

**Returns:**
```json
{
  "templates": ["macro-tracker", "checkout", "workout-timer", "feedback-form", "ws-test"]
}
```

### `sparkui_list_components`

List available components for composing pages.

**Parameters:** None

**Returns:**
```json
{
  "components": ["header", "button", "timer", "checklist", "progress", ...]
}
```

### `sparkui_push`

Create a page from a template.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `template` | string | ✅ | Template name (e.g. `"checkout"`) |
| `data` | object | ✅ | Template data |
| `ttl` | number | | Time-to-live in seconds (default: 3600) |
| `og` | object | | Open Graph overrides `{title, description, image}` |

**Example:**
```json
{
  "template": "checkout",
  "data": {
    "title": "Your Order",
    "items": [{"name": "Widget", "price": 9.99, "qty": 2}],
    "total": 19.98
  },
  "ttl": 7200
}
```

**Returns:**
```json
{
  "id": "abc-123-...",
  "url": "/s/abc-123-...",
  "fullUrl": "http://localhost:3457/s/abc-123-..."
}
```

### `sparkui_compose`

Compose a page from individual components.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Page title |
| `sections` | array | ✅ | Array of `{type, config}` sections |
| `ttl` | number | | Time-to-live in seconds |

**Example:**
```json
{
  "title": "Quick Poll",
  "sections": [
    {"type": "header", "config": {"text": "What should we build?"}},
    {"type": "checklist", "config": {"items": ["Feature A", "Feature B", "Feature C"]}}
  ]
}
```

**Returns:**
```json
{
  "id": "def-456-...",
  "url": "/s/def-456-...",
  "fullUrl": "http://localhost:3457/s/def-456-..."
}
```

### `sparkui_page_status`

Check if a page exists and whether it's still active.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Page UUID |

**Returns:**
```json
{
  "exists": true,
  "status": "active",
  "url": "/s/abc-123-...",
  "fullUrl": "http://localhost:3457/s/abc-123-..."
}
```

## How It Works

The MCP server communicates with the SparkUI HTTP API over HTTP. It does **not** import SparkUI internals — it's a standalone client that calls `POST /api/push`, `POST /api/compose`, and `GET /` on the SparkUI server.

```
Claude Desktop / Cursor / Windsurf
        ↓ (MCP stdio)
   SparkUI MCP Server
        ↓ (HTTP)
   SparkUI Server (localhost:3457)
        ↓
   Ephemeral web pages
```

## License

MIT
