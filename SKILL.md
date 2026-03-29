# SparkUI — Ephemeral Web UI Generator

## When to Use
Use SparkUI when the user needs something **visual** that's better as a web page than chat text:
- **Dashboards** — nutrition trackers, fitness stats, project metrics
- **Data displays** — tables, charts, comparisons
- **Trackers** — daily logs, progress views
- **Rich content** — anything with colors, progress bars, layouts

**Don't use** for simple text answers, yes/no questions, or quick lists that work fine in chat.

## Setup

### OpenClaw Plugin (Recommended)

If installed via `openclaw plugins install @limeade-labs/sparkui`, the server, push token, and this skill are **auto-configured** — no manual setup needed. The plugin manages the server lifecycle and injects the token automatically.

### Standalone

When running SparkUI standalone, configure via environment variables (or a `.env` file):
- `SPARKUI_PORT` — server port (default: `3457`)
- `PUSH_TOKEN` — API authentication token
- `SPARKUI_BASE_URL` — public URL if behind a reverse proxy

## Server Location
- **URL:** `http://localhost:${SPARKUI_PORT:-3457}` (default: `http://localhost:3457`)
- **Port:** 3457 by default; override with `SPARKUI_PORT` env var

## Step 1: Ensure Server is Running

```bash
# Check if running
curl -s http://localhost:3457/ | head -c 200

# If not running (standalone mode):
sparkui start
# or: node server.js &
```

Use `exec` with `background: true` to start the server if it's down.

## Step 2: Get the Push Token

The push token is available as the `PUSH_TOKEN` environment variable. If running as an OpenClaw plugin, it's set automatically.

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
| `workout-timer` | Interactive workout with rounds, timers, checklists | See Workout Timer section below |
| `feedback-form` | Rating + text feedback form | `{title, subtitle?, questions?}` — questions is optional `string[]` for extra text fields |
| `poll` | Voting/polling | `{question, options: [{text}]}` |
| `shopping-list` | Checkable shopping list | `{title, items: [{text, category?}]}` |
| `calendar` | Calendar/schedule view | `{title, events: [{date, title, time?}]}` |
| `comparison` | Side-by-side comparison | `{title, items: [{name, attributes: [{label, value}]}]}` |
| `checkout` | Stripe-style checkout form | `{title, items: [{name, price}], currency?}` |
| `approval-flow` | Approve/reject workflow | `{title, description, options?: [{label, action}]}` |
| `analytics-dashboard` | Charts and metrics | `{title, metrics: [{label, value, unit?}], charts?: [...]}` |

### Workout Timer Template

The `workout-timer` template supports interactive workouts with rounds, rest timers, warmup/cooldown checklists, and **granular event emission**.

**Data shape:**
```json
{
  "title": "Morning Kettlebell",
  "exercises": [
    {"name": "KB Swings", "reps": "15"},
    {"name": "Goblet Squats", "reps": "10"},
    {"name": "KB Rows", "reps": "8 each side"}
  ],
  "rounds": 3,
  "restSeconds": 60,
  "warmup": [
    {"text": "Arm circles (30s)"},
    {"text": "Leg swings (30s)"}
  ],
  "cooldown": [
    {"text": "Hamstring stretch (30s each)"},
    {"text": "Shoulder stretch (30s each)"}
  ]
}
```

**Events emitted (when `openclaw.eventTypes` includes `"event"`):**
- `exercise_started` — `{ exercise, setIndex }`
- `set_completed` — `{ exercise, setNumber, totalSets, reps, duration }`
- `rest_started` — `{ exercise, duration }`
- `exercise_completed` — `{ exercise, setsCompleted, totalSets }`
- `workout_completed` — `{ totalExercises, totalSets, totalDuration, exercises: [...] }`

**State persistence:** Workout progress (current round, checked items, completed sets) auto-saves. If the user closes the tab and reopens, progress is restored.

**Note:** Interactive templates (workout-timer, feedback-form, poll, approval-flow, checkout, shopping-list) auto-enable `openclaw` with `eventTypes: ["completion"]`. You only need to explicitly set `openclaw` if you want to override the defaults (e.g., add a `sessionKey` for routing, or include `"event"` types for granular tracking).

## State Persistence (v1.1 — Redis-backed)

SparkUI pages persist state across tab closes, page refreshes, and even server restarts.

**How it works (layered):**
1. **localStorage** — instant write-through cache in the browser. State restores in <100ms on page reopen.
2. **REST API** — primary server-side persistence via `POST/GET /api/pages/:id/state`. Works without WebSocket.
3. **Redis** — server-side source of truth. Survives server restarts. TTL-managed (expires with the page).
4. **WebSocket** — bonus real-time sync for multi-tab scenarios.

**On page load:** localStorage first (instant) → REST fetch (confirms) → uses whichever is available.
**On state change:** localStorage write (instant) → debounced REST POST → WS sync (bonus).

**Templates that use state persistence:** `workout-timer` (round progress, checked items, elapsed time, completed sets)

## OpenClaw Round-Trip (Event Callbacks)

Interactive templates auto-enable OpenClaw forwarding for `completion` events. The flow:

1. Agent pushes a page (openclaw auto-enabled for interactive templates)
2. User interacts → events stored in Redis event stream
3. On completion → delivery worker POSTs to OpenClaw hooks with guaranteed delivery (retry + dead-letter)
4. Agent receives structured JSON and can act on it

### ⚠️ Routing: Always Include `to` for Slack

On Slack (multi-channel), completions need routing info to reach the right channel. **Always include `to` with the channel ID** when pushing interactive pages:

```bash
curl -s -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "workout-timer",
    "data": { ... },
    "openclaw": {
      "enabled": true,
      "channel": "slack",
      "to": "C0AKMF5E0KD",
      "eventTypes": ["completion"]
    }
  }'
```

**Note:** `sessionKey` requires `hooks.allowRequestSessionKey=true` in OpenClaw config. Use `to` (channel ID) instead — it works out of the box.

On Telegram or single-channel setups, routing is automatic — no `to` needed.

### OpenClaw Config Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | auto | Enable OpenClaw forwarding (auto-true for interactive templates) |
| `sessionKey` | string | recommended | Route completions back to the agent session that created the page |
| `channel` | string | no | Delivery channel override (default: "slack") |
| `to` | string | no | Target channel/user ID (alternative to sessionKey) |
| `eventTypes` | string[] | no | `["completion"]` (default), `["event"]`, or `["event", "completion"]`. **Avoid `"event"` unless you need granular tracking** — it fires for every micro-interaction |

### Completion Message Format

Completions arrive as structured JSON:
```json
{
  "_sparkui": true,
  "type": "completion",
  "pageId": "uuid",
  "template": "workout-timer",
  "title": "Morning Workout",
  "data": { ... },
  "timestamp": 1234567890
}
```

Process these **silently** — don't echo raw event data to the user. Extract what matters and post a clean summary.

### Agent Push API (Bidirectional)

Push updates to a live page while the user is on it:

```bash
# Toast notification
curl -s -X POST http://localhost:3457/api/pages/PAGE_ID/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "toast", "data": {"message": "Great job! Keep going 💪"}}'

# Replace a DOM element by ID
curl -s -X POST http://localhost:3457/api/pages/PAGE_ID/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "slot", "data": {"id": "status_badge", "html": "<span>Approved ✓</span>"}}'

# Force page reload
curl -s -X POST http://localhost:3457/api/pages/PAGE_ID/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "reload"}'
```

### Event Query API (Agent Polling)

If hooks delivery fails or for on-demand checks:
```bash
# Get all events for a page
curl -s http://localhost:3457/api/pages/PAGE_ID/events \
  -H "Authorization: Bearer $PUSH_TOKEN"

# Filter by type and time
curl -s "http://localhost:3457/api/pages/PAGE_ID/events?type=completion&since=1234567890" \
  -H "Authorization: Bearer $PUSH_TOKEN"
```

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
