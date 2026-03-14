# ⚡ SparkUI

**Ephemeral interactive UIs for AI agents.** Generate rich web pages from chat — no app install required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/sparkui.svg)](https://www.npmjs.com/package/sparkui)

---

## What is SparkUI?

SparkUI lets AI agents generate interactive web UIs on demand. Instead of walls of text, your agent creates a polished, ephemeral web page and shares a link. Users click, interact, and the results flow back to the agent via WebSocket. Pages self-destruct after a configurable TTL.

- 🎯 **No app install** — just a URL that works in any browser
- ⏱️ **Ephemeral** — pages auto-expire (default 1 hour)
- 🔄 **Bidirectional** — user actions flow back to the agent via WebSocket
- 🧩 **Composable** — 15 components you can mix and match
- 📱 **Mobile-first** — designed for phones, works everywhere
- 🔌 **MCP compatible** — works with Claude Desktop, Cursor, Windsurf
- 🌙 **Dark theme** — easy on the eyes, polished look

## Quick Start

```bash
# Clone and install
git clone https://github.com/limeade-labs/sparkui.git
cd sparkui
npm install

# Configure
cp .env.example .env
# Edit .env — set your PUSH_TOKEN

# Run
npm start
# Server running at http://localhost:3457
```

## Push a Page

```bash
curl -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "checkout",
    "data": {
      "product": {
        "name": "SparkUI Pro",
        "description": "Unlimited ephemeral UIs",
        "price": 29.99,
        "image": "⚡"
      }
    }
  }'
```

Returns:
```json
{
  "id": "abc123",
  "url": "/s/abc123",
  "fullUrl": "http://localhost:3457/s/abc123",
  "expiresAt": "2026-03-14T01:00:00.000Z"
}
```

## Built-in Templates

| Template | Description |
|----------|-------------|
| `macro-tracker` | Daily nutrition/macro tracking with progress bars |
| `checkout` | Stripe-like checkout flow with quantity, promo codes, payment |
| `workout-timer` | Exercise routine with rounds, rest timer, checklists |
| `feedback-form` | Multi-field form with star ratings and text inputs |
| `ws-test` | WebSocket connectivity test page |

## Compose Custom Pages

Don't want a template? Compose pages from individual components:

```bash
curl -X POST http://localhost:3457/api/compose \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Lunch Poll",
    "sections": [
      {
        "type": "header",
        "config": { "title": "Where should we eat?", "subtitle": "Vote by noon", "icon": "🍕" }
      },
      {
        "type": "checklist",
        "config": {
          "items": ["Chipotle", "Chick-fil-A", "Thai place on Main St"],
          "allowAdd": true
        }
      },
      {
        "type": "button",
        "config": { "text": "Submit Vote", "style": "primary", "emitEvent": "vote_submitted" }
      }
    ]
  }'
```

## Components

| Component | Description | Key Config |
|-----------|-------------|------------|
| `header` | Title, subtitle, icon, badge | `title`, `subtitle`, `icon` |
| `button` | Action button with event emission | `text`, `style`, `emitEvent` |
| `timer` | Countdown, stopwatch, or interval timer | `mode`, `seconds`, `intervals` |
| `checklist` | Tappable checklist with progress bar | `items`, `allowAdd` |
| `progress` | Single or multi-segment progress bars | `segments`, `value`, `max` |
| `stats` | Grid of stat cards with trends | `items: [{label, value, icon}]` |
| `form` | Text, number, select, textarea, star ratings | `fields`, `submitText` |
| `tabs` | Switchable content panels | `tabs: [{label, content}]` |

All components emit events via WebSocket. Dark theme. Responsive. Zero external dependencies.

## MCP Server

Use SparkUI from Claude Desktop, Cursor, or Windsurf via the [MCP server](./mcp-server/README.md):

```json
{
  "mcpServers": {
    "sparkui": {
      "command": "node",
      "args": ["./mcp-server/index.js"],
      "env": {
        "SPARKUI_URL": "http://localhost:3457",
        "SPARKUI_TOKEN": "your-push-token"
      }
    }
  }
}
```

## Page Management API

```bash
# List active pages
GET /api/pages

# Page details (includes view count)
GET /api/pages/:id

# Update page data or extend TTL
PATCH /api/pages/:id

# Delete a page
DELETE /api/pages/:id
```

All endpoints require `Authorization: Bearer <token>`.

## Architecture

```
┌─────────┐     POST /api/push     ┌──────────────┐     GET /s/:id     ┌─────────┐
│  Agent   │ ──────────────────────▶│  SparkUI     │◀────────────────── │ Browser │
│ (AI/MCP) │                        │  Server      │ ──────────────────▶│  (User) │
│          │◀── WebSocket ──────────│  :3457       │──── WebSocket ────▶│         │
└─────────┘   completion events     └──────────────┘   user actions     └─────────┘
```

**Flow:**
1. Agent pushes a page (template or composed)
2. Server generates HTML, stores in memory, returns URL
3. User opens URL in any browser
4. User interacts (checks items, fills forms, clicks buttons)
5. Actions flow back to the agent via WebSocket
6. Page auto-expires after TTL

## Examples

See the [`examples/`](./examples/) directory for working scripts:

- **[`basic-push.sh`](./examples/basic-push.sh)** — Push a macro-tracker page with curl
- **[`compose-page.sh`](./examples/compose-page.sh)** — Compose a page from individual components
- **[`manage-pages.sh`](./examples/manage-pages.sh)** — Full page lifecycle: list, update, delete
- **[`node-client.js`](./examples/node-client.js)** — Node.js client with WebSocket event listener

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SPARKUI_PORT` | `3457` | Server port |
| `PUSH_TOKEN` | *(required)* | Auth token for push/compose/manage APIs |
| `SPARKUI_BASE_URL` | `http://localhost:3457` | Public URL for generated links |
| `OPENCLAW_HOOKS_URL` | *(optional)* | OpenClaw webhook URL for event forwarding |
| `OPENCLAW_HOOKS_TOKEN` | *(optional)* | Auth token for OpenClaw webhook |

## OpenClaw Skill

SparkUI works as an [OpenClaw](https://github.com/openclaw/openclaw) skill for direct agent integration. Install it as a skill to let your agent generate UIs from chat automatically.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Related

- **[MCP Server](./mcp-server/README.md)** — Use SparkUI from Claude Desktop, Cursor, or Windsurf
- **[Examples](./examples/README.md)** — Working scripts and code samples
- **[Contributing](./CONTRIBUTING.md)** — Setup, testing, and PR guidelines

## License

[MIT](./LICENSE) © [Limeade Labs](https://limeadelabs.com)
