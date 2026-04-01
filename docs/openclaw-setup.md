# OpenClaw Setup

Integrate SparkUI as an [OpenClaw](https://github.com/openclaw/openclaw) plugin so your AI agent can automatically generate interactive web pages during conversations.

## Install (One Command)

```bash
openclaw plugins install @limeade-labs/sparkui
openclaw gateway restart
```

That's it. The plugin auto-starts the SparkUI server, generates a push token, and registers the agent skill.

### Required: Allow Plugin Tools

OpenClaw's default `coding` tools profile only includes built-in tools — plugin tools are excluded by default. You need to explicitly allow SparkUI's tools:

```bash
openclaw config set tools.alsoAllow '["sparkui_push", "sparkui_compose"]'
openclaw gateway restart
```

> **Note:** `tools.alsoAllow` is additive — it won't clobber any existing tool configuration. If you use `tools.allow` instead, it replaces the entire allow list.

Without this step, agents will fall back to using `curl` instead of the native tools. Verify the config was applied:

```bash
openclaw config get tools.alsoAllow
# Should include "sparkui_push" and "sparkui_compose"
```

Your agent can now start generating pages using the `sparkui_push` and `sparkui_compose` tools directly.

To see the auto-generated push token and server status:

```bash
openclaw plugins inspect sparkui
```

### Optional Configuration

You can customize the plugin via OpenClaw's plugin config:

| Setting | Description | Default |
|---------|-------------|---------|
| `port` | Server port | `3457` |
| `pushToken` | API token | Auto-generated |
| `publicUrl` | Public URL (if behind proxy) | `http://localhost:3457` |
| `redisUrl` | Redis for state persistence | In-memory mode |

## How the Agent Uses It

Once installed, the agent automatically detects opportunities to use SparkUI:

1. **Agent reads SKILL.md** — on startup or when a relevant task is detected
2. **Agent checks server health** — `curl http://localhost:3457/`
3. **Agent pushes a page** — via `curl` to the push or compose API
4. **Agent shares the URL** — sends the `fullUrl` to the user in chat

The agent decides when to use SparkUI based on the "When to Use" section in SKILL.md:

- ✅ Dashboards, nutrition trackers, fitness stats
- ✅ Data displays, tables, comparisons
- ✅ Interactive forms, feedback collection
- ✅ Anything with progress bars, colors, layouts
- ❌ Simple text answers, yes/no questions, quick lists

## Round-Trip Events (OpenClaw Callbacks)

SparkUI can forward user interactions back to the agent via OpenClaw's webhook system. This closes the loop: **agent pushes page → user interacts → agent gets notified**.

### Plugin Mode (Automatic)

When installed as a plugin, hooks are auto-configured — no manual `.env` setup needed. The plugin reads `hooks.token` and the gateway port from OpenClaw config and sets `OPENCLAW_HOOKS_URL` and `OPENCLAW_HOOKS_TOKEN` automatically. The `openclaw` metadata (channel, destination) is also injected into every page push automatically from the originating session context.

Just ensure hooks are enabled in your OpenClaw config (`hooks.token` must be set).

### Manual / Standalone Mode

If running SparkUI standalone (not as a plugin), you must set `OPENCLAW_HOOKS_URL` and `OPENCLAW_HOOKS_TOKEN` in your `.env` (see [Manual Setup](#manual-setup-alternative) below) and include `openclaw` config when pushing a page.

### Enable OpenClaw Forwarding

Add `openclaw` config when pushing a page (only needed in standalone mode — the plugin injects this automatically):

```json
{
  "template": "feedback-form",
  "data": { "title": "Quick Feedback" },
  "openclaw": {
    "enabled": true,
    "channel": "slack",
    "to": "YOUR_CHANNEL_ID",
    "eventTypes": ["completion"]
  }
}
```

### Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable event forwarding |
| `channel` | string | Delivery channel (default: `"slack"`) |
| `to` | string | Target channel/user ID |
| `eventTypes` | string[] | Events to forward: `["completion"]`, `["event"]`, or both |
| `sessionKey` | string | Optional session key for routing |

---

## Manual Setup (Alternative)

If you prefer to run SparkUI standalone (without the plugin system), you can set it up manually.

### 1. Install SparkUI

```bash
npm install -g @limeade-labs/sparkui
```

Or clone for development:

```bash
git clone https://github.com/Limeade-Labs/sparkui.git
cd sparkui
npm install
```

### 2. Symlink the Skill

```bash
ln -s /path/to/sparkui/skills/sparkui ~/your-openclaw-workspace/skills/sparkui
```

### 3. Configure Environment

Create a `.env` file (or set environment variables):

```bash
PUSH_TOKEN=spk_your_token_here
SPARKUI_PORT=3457
SPARKUI_BASE_URL=http://localhost:3457

# For round-trip event callbacks to OpenClaw
OPENCLAW_HOOKS_URL=http://127.0.0.1:18789/hooks/agent
OPENCLAW_HOOKS_TOKEN=your_openclaw_hooks_token
```

### 4. Start the Server

```bash
sparkui start
# or: node server.js
```

### 5. Restart OpenClaw

```bash
openclaw gateway restart
```

The agent will pick up the new skill on next invocation.
