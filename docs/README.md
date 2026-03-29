# ⚡ SparkUI Documentation

**Ephemeral interactive UIs for AI agents.** Generate rich web pages from chat — no app install required.

SparkUI lets AI agents create polished, interactive web pages on demand. Instead of walls of text, your agent generates a URL the user clicks to see dashboards, forms, timers, and more. Pages auto-expire after a configurable TTL.

## Quick Navigation

| Guide | Description |
|-------|-------------|
| [Getting Started](./getting-started.md) | Install, configure, and push your first page |
| [API Reference](./api-reference.md) | Full REST API and WebSocket protocol documentation |
| [Templates](./templates.md) | 11 built-in templates with schemas and examples |
| [Components](./components.md) | 8 composable components for custom pages |
| [MCP Setup](./mcp-setup.md) | Use SparkUI from Claude Desktop, Cursor, or Windsurf |
| [OpenClaw Setup](./openclaw-setup.md) | Integrate SparkUI as an OpenClaw agent skill |
| [ChatGPT Setup](./chatgpt-setup.md) | Use SparkUI with ChatGPT Custom GPTs via Actions |

## Architecture

```
┌─────────┐     POST /api/push     ┌──────────────┐     GET /s/:id     ┌─────────┐
│  Agent   │ ──────────────────────▶│   SparkUI    │◀────────────────── │ Browser │
│ (AI/MCP) │                        │   Server     │ ──────────────────▶│  (User) │
│          │◀── WebSocket ──────────│   :3457      │──── WebSocket ────▶│         │
└─────────┘   completion events     └──────────────┘   user actions     └─────────┘
```

**Flow:**
1. Agent pushes a page (template, composed, or raw HTML)
2. Server generates HTML, stores in memory, returns URL
3. User opens URL in any browser
4. User interacts (checks items, fills forms, clicks buttons)
5. Actions flow back to the agent via WebSocket
6. Page auto-expires after TTL

## Key Features

- 🎯 **No app install** — just a URL that works in any browser
- ⏱️ **Ephemeral** — pages auto-expire (default 1 hour)
- 🔄 **Bidirectional** — user actions flow back to the agent via WebSocket
- 🧩 **Composable** — 8 components you can mix and match
- 📱 **Mobile-first** — designed for phones, works everywhere
- 🔌 **MCP compatible** — works with Claude Desktop, Cursor, Windsurf
- 🌙 **Dark theme** — easy on the eyes, polished look

## Links

- **GitHub:** [github.com/Limeade-Labs/sparkui](https://github.com/Limeade-Labs/sparkui)
- **npm:** [npmjs.com/package/sparkui](https://www.npmjs.com/package/sparkui)
- **Homepage:** [sparkui.dev](https://sparkui.dev)
