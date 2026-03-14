# SparkUI — Ephemeral Web UI Generator

## When to Use
Use SparkUI when the user needs something **visual** that's better as a web page than chat text:
- **Dashboards** — nutrition trackers, fitness stats, project metrics
- **Data displays** — tables, charts, comparisons
- **Trackers** — daily logs, progress views
- **Rich content** — anything with colors, progress bars, layouts

**Don't use** for simple text answers, yes/no questions, or quick lists that work fine in chat.

## Server Location
- **Directory:** `/home/clawd/projects/sparkui/`
- **Port:** 3457 (configured in .env; override with `SPARKUI_PORT` env)
- **Config:** Push token is in `/home/clawd/projects/sparkui/.env`

## Step 1: Ensure Server is Running

```bash
# Check if running
curl -s http://localhost:3457/ | head -c 200

# If not running, start it:
cd /home/clawd/projects/sparkui && node server.js &
```

Use `exec` with `background: true` to start the server if it's down.

## Step 2: Get the Push Token

```bash
source /home/clawd/projects/sparkui/.env  # loads PUSH_TOKEN and SPARKUI_PORT
```

## Step 3: Push Content

### Using a Template (preferred for known types)

```bash
curl -s -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "macro-tracker",
    "data": {
      "date": "2026-03-10",
      "calories": {"current": 1250, "target": 1900},
      "protein": {"current": 62, "target": 86},
      "fat": {"current": 45, "target": 95},
      "carbs": {"current": 120, "target": 175},
      "meals": [
        {"name": "Oatmeal with berries", "calories": 350, "time": "6:30 AM"},
        {"name": "Grilled chicken salad", "calories": 480, "time": "12:00 PM"},
        {"name": "Greek yogurt", "calories": 150, "time": "3:00 PM"}
      ]
    },
    "ttl": 7200
  }'
```

### Using Raw HTML

```bash
curl -s -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"html": "<html>...</html>", "ttl": 3600}'
```

For raw HTML, use the dark theme (#111 bg, #e0e0e0 text, -apple-system font) to match SparkUI's design language.

### Updating a Page

```bash
curl -s -X PATCH http://localhost:3457/api/pages/PAGE_ID \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template": "macro-tracker", "data": {...}}'
```

## Step 4: Share the Link

The push API returns `{ id, url, fullUrl }`. Share the `fullUrl` with the user.

**Important:** The server runs on localhost. For the user to access it, they need network access to the host. If behind a tunnel (e.g., Cloudflare Tunnel, ngrok), set `SPARKUI_BASE_URL` env var to the public URL.

## Available Templates

| Template | Description | Data Shape |
|----------|-------------|------------|
| `macro-tracker` | Nutrition macro dashboard | `{date, calories, protein, fat, carbs, meals}` — each macro has `{current, target}`, meals is `[{name, calories, time}]` |
| `feedback-form` | Rating + text feedback form | `{title, subtitle?, questions?}` — questions is optional `string[]` for extra text fields |

## OpenClaw Round-Trip (Event Callbacks)

When you want SparkUI to report user interactions back to the agent via OpenClaw webhooks, add `openclaw` config to the push request. This closes the loop: **agent pushes page → user interacts → agent gets notified**.

### Push with OpenClaw Config

```bash
curl -s -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "feedback-form",
    "data": {"title": "Quick Feedback", "subtitle": "How was the experience?"},
    "openclaw": {
      "enabled": true,
      "channel": "slack",
      "to": "YOUR_CHANNEL_ID",
      "eventTypes": ["completion"]
    }
  }'
```

### OpenClaw Config Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | yes | Enable OpenClaw forwarding |
| `channel` | string | no | Delivery channel (default: "slack") |
| `to` | string | no | Target channel/user ID (e.g., "YOUR_CHANNEL_ID" for #sparkui) |
| `eventTypes` | string[] | no | Which events to forward: `["completion"]`, `["event"]`, or `["event", "completion"]`. Default: `["completion"]` |
| `sessionKey` | string | no | Optional session key override for routing |

### How It Works

1. Agent pushes a page with `openclaw` config
2. User opens the page and interacts (clicks, submits form)
3. Browser sends events via WebSocket to SparkUI server
4. SparkUI server checks `openclaw` config and forwards matching events to OpenClaw's `/hooks/agent` endpoint
5. OpenClaw delivers the message to the specified channel
6. Agent receives the message and can respond

### When to Use OpenClaw Round-Trip

- **Feedback forms** — get notified when user submits
- **Approval workflows** — user clicks approve/reject
- **Interactive quizzes** — collect answers
- **Any form** — completion events carry all form data

### Environment Variables

Set these in `.env` (already configured):
```
OPENCLAW_HOOKS_URL=http://127.0.0.1:18789/hooks/agent
OPENCLAW_HOOKS_TOKEN=your_openclaw_hooks_token
```

## Composable Components (Preferred)

Instead of raw HTML or monolithic templates, use the **compose API** to assemble pages from reusable components. This is the fastest path — under 3 seconds from request to rendered UI.

### POST /api/compose

```bash
curl -s -X POST http://localhost:3457/api/compose \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Page Title",
    "sections": [
      { "type": "header", "config": { "title": "Hello", "subtitle": "World", "icon": "⚡", "badge": "New" } },
      { "type": "checklist", "config": { "items": [{"text": "Item 1"}, {"text": "Item 2"}], "showProgress": true, "allowAdd": true } },
      { "type": "button", "config": { "label": "Done", "action": "complete", "style": "primary" } }
    ],
    "openclaw": { "enabled": true, "channel": "slack", "to": "YOUR_CHANNEL_ID" }
  }'
```

Returns `{ id, url, fullUrl }` — ready to share.

### Available Components

| Component | Config | Description |
|-----------|--------|-------------|
| `header` | `{ title, subtitle?, icon?, badge? }` | Page header with optional icon/badge |
| `button` | `{ label, action, style?, icon?, disabled? }` | Clickable button. Styles: `primary` (green), `secondary` (outline), `danger` (red). Sends `event` with `{action}` |
| `timer` | `{ mode, duration?, intervals?, autoStart? }` | Modes: `countdown` (duration in secs), `stopwatch`, `interval` (array of `{label, seconds}`). Sends `timer` event on complete |
| `checklist` | `{ items: [{text, checked?}], allowAdd?, showProgress? }` | Interactive checklist with progress bar. Sends `completion` when all checked |
| `progress` | `{ value, max, label?, color?, showPercent?, segments? }` | Single bar or multi-segment. Segments: `[{label, value, max, color}]` |
| `stats` | `{ items: [{label, value, unit?, icon?, trend?}] }` | 2-column grid of stat cards. Trend: `up`/`down`/`flat` |
| `form` | `{ fields: [{type, name, label, placeholder?, options?, required?}], submitLabel? }` | Form with text/number/select/textarea/rating fields. Sends `completion` with `{formData}` |
| `tabs` | `{ tabs: [{label, content}], activeIndex? }` | Tab switcher. Content can be HTML strings (including other component output) |

### Component Examples

**Workout Timer:**
```json
{ "type": "timer", "config": { "mode": "interval", "intervals": [
  {"label": "Work", "seconds": 30}, {"label": "Rest", "seconds": 10},
  {"label": "Work", "seconds": 30}, {"label": "Rest", "seconds": 10}
] } }
```

**Stats Dashboard:**
```json
{ "type": "stats", "config": { "items": [
  {"label": "Weight", "value": "222", "unit": "lbs", "icon": "⚖️", "trend": "down"},
  {"label": "Streak", "value": "5", "unit": "days", "icon": "🔥", "trend": "up"}
] } }
```

**Multi-Segment Progress:**
```json
{ "type": "progress", "config": { "segments": [
  {"label": "Protein", "value": 62, "max": 86, "color": "#ff6b6b"},
  {"label": "Fat", "value": 45, "max": 95, "color": "#ffd93d"},
  {"label": "Carbs", "value": 120, "max": 175, "color": "#6bcb77"}
] } }
```

**Feedback Form:**
```json
{ "type": "form", "config": {
  "fields": [
    {"type": "rating", "name": "rating", "label": "How was it?"},
    {"type": "textarea", "name": "feedback", "label": "Comments", "placeholder": "Tell us more..."}
  ],
  "submitLabel": "Send"
} }
```

### When to Use Compose vs Templates

- **Compose** — for any new page, custom layouts, mixing components. This is the default choice.
- **Templates** — only for `macro-tracker` (has specialized chart logic) or when exact existing template behavior is needed.

## Example Flow: Daily Macro Tracking

1. User says "log my lunch — chicken sandwich, 450 cal, 35g protein, 15g fat, 40g carbs"
2. Agent updates the nutrition spreadsheet
3. Agent reads today's totals from the sheet
4. Agent pushes a macro-tracker page with the current totals
5. Agent shares the link: "Here's your updated dashboard: http://..."
6. If the page already exists from earlier, use PATCH to update it instead of creating a new one

## Notes
- Pages expire after their TTL (default 1 hour). This is by design — they're ephemeral.
- The macro-tracker template auto-refreshes every 30 seconds.
- WebSocket support is built in — pages will auto-reload when updated via PATCH.
- For longer-lived pages, set a higher TTL (e.g., 86400 for 24h).
