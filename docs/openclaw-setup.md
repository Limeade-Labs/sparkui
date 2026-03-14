# OpenClaw Setup

Integrate SparkUI as an [OpenClaw](https://github.com/openclaw/openclaw) agent skill so your AI agent can automatically generate interactive web pages during conversations.

## What is OpenClaw?

OpenClaw is an AI agent runtime that connects language models to tools, channels (Slack, Discord, Telegram), and external services. Skills are modular capabilities the agent can invoke — SparkUI is one such skill.

When SparkUI is installed as a skill, the agent can detect when a visual UI would be better than text (dashboards, forms, trackers) and automatically generate a page without being explicitly asked.

## Install SparkUI as an OpenClaw Skill

### 1. Clone SparkUI into your skills directory

```bash
cd ~/your-openclaw-workspace/skills/
git clone https://github.com/Limeade-Labs/sparkui.git
```

Or symlink if SparkUI is already installed elsewhere:

```bash
ln -s /path/to/sparkui ~/your-openclaw-workspace/skills/sparkui
```

### 2. Verify the SKILL.md

SparkUI includes a `SKILL.md` file that tells the agent how to use it. The key sections are:

- **When to Use** — triggers (dashboards, trackers, forms, rich content)
- **Server Location** — directory, port, config file location
- **Step-by-step instructions** — check server, get token, push content
- **Available templates** — template names and data shapes
- **Composable components** — component types and configs

The agent reads this file automatically when it determines SparkUI is relevant to the task.

### 3. Configure Environment

Ensure the SparkUI server is accessible from the OpenClaw host. The `.env` file should include:

```bash
PUSH_TOKEN=spk_your_token_here
SPARKUI_PORT=3457
SPARKUI_BASE_URL=http://localhost:3457

# For round-trip event callbacks to OpenClaw
OPENCLAW_HOOKS_URL=http://127.0.0.1:18789/hooks/agent
OPENCLAW_HOOKS_TOKEN=your_openclaw_hooks_token
```

### 4. Start the SparkUI Server

```bash
cd /path/to/sparkui
node server.js &
```

Or use the CLI:

```bash
sparkui start
```

## How the Agent Uses It

Once configured, the agent automatically detects opportunities to use SparkUI:

1. **Agent reads SKILL.md** — on startup or when a relevant task is detected
2. **Agent checks server health** — `curl http://localhost:3457/`
3. **Agent loads push token** — `source /path/to/sparkui/.env`
4. **Agent pushes a page** — via `curl` to the push or compose API
5. **Agent shares the URL** — sends the `fullUrl` to the user in chat

The agent decides when to use SparkUI based on the "When to Use" section in SKILL.md:

- ✅ Dashboards, nutrition trackers, fitness stats
- ✅ Data displays, tables, comparisons
- ✅ Interactive forms, feedback collection
- ✅ Anything with progress bars, colors, layouts
- ❌ Simple text answers, yes/no questions, quick lists

## Example: Macro Tracking Flow

Here's how the agent handles a nutrition tracking request end-to-end:

**User says:** "Log my lunch — chicken salad, 480 cal, 35g protein, 20g fat, 15g carbs"

**Agent does:**

1. Updates the nutrition spreadsheet with the new meal
2. Reads today's totals from the sheet
3. Pushes a macro-tracker page:

```bash
curl -s -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "macro-tracker",
    "data": {
      "date": "2026-03-14",
      "calories": {"current": 1250, "target": 1900},
      "protein": {"current": 62, "target": 86},
      "fat": {"current": 45, "target": 95},
      "carbs": {"current": 15, "target": 25},
      "meals": [
        {"name": "Eggs & bacon", "calories": 450, "time": "6:30 AM"},
        {"name": "Chicken salad", "calories": 480, "time": "12:00 PM"}
      ]
    },
    "ttl": 7200
  }'
```

4. Shares the link: "Logged! Here's your updated dashboard: http://..."

## Round-Trip Events (OpenClaw Callbacks)

SparkUI can forward user interactions back to the agent via OpenClaw's webhook system. This closes the loop: **agent pushes page → user interacts → agent gets notified**.

### Enable OpenClaw Forwarding

Add `openclaw` config when pushing a page:

```json
{
  "template": "feedback-form",
  "data": { "title": "Quick Feedback" },
  "openclaw": {
    "enabled": true,
    "channel": "slack",
    "to": "C0AKMF5E0KD",
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

### How It Works

1. Agent pushes a page with `openclaw` config
2. User opens the page and interacts (fills form, clicks buttons)
3. Browser sends events via WebSocket to SparkUI server
4. SparkUI forwards matching events to OpenClaw's `/hooks/agent` endpoint
5. OpenClaw delivers the message to the specified channel
6. Agent receives the notification and can respond

### Use Cases

- **Feedback forms** — get notified when user submits a rating
- **Approval workflows** — user clicks approve/reject buttons
- **Data collection** — form submissions with structured data
- **Checklist completion** — notified when all items are checked

## SKILL.md Reference

The full `SKILL.md` is located at the root of the SparkUI directory. It contains:

- Server location and configuration details
- Step-by-step instructions for the agent
- Template data schemas
- Component reference
- OpenClaw round-trip configuration

The agent reads this file automatically — you don't need to configure it separately.

> **Tip:** If you modify the SKILL.md (e.g., to add custom templates or change defaults), the agent will pick up the changes on its next invocation.
