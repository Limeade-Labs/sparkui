# API Reference

All API endpoints require authentication via a Bearer token in the `Authorization` header (except `GET /` health check and `GET /s/:id` page serving).

```
Authorization: Bearer YOUR_PUSH_TOKEN
```

Base URL: `http://localhost:3457` (or your configured `SPARKUI_BASE_URL`)

---

## POST /api/push

Create a new ephemeral page from a template, raw HTML, or both.

### Request Body

```json
{
  "template": "macro-tracker",
  "data": { ... },
  "html": "<html>...</html>",
  "ttl": 3600,
  "meta": { "title": "My Page" },
  "og": {
    "title": "Custom OG Title",
    "description": "Custom description",
    "image": "https://example.com/image.png"
  },
  "callbackUrl": "https://your-server.com/webhook",
  "callbackToken": "your-webhook-secret",
  "openclaw": {
    "enabled": true,
    "channel": "slack",
    "to": "C0AKMF5E0KD",
    "eventTypes": ["completion"]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `template` | string | One of `template` or `html` | Template name (see [Templates](./templates.md)) |
| `data` | object | With `template` | Data to pass to the template renderer |
| `html` | string | One of `template` or `html` | Raw HTML content |
| `ttl` | number | No | Time-to-live in seconds (default: 3600) |
| `meta` | object | No | Arbitrary metadata stored with the page |
| `og` | object | No | Open Graph overrides: `title`, `description`, `image` |
| `callbackUrl` | string | No | URL to POST browser events to |
| `callbackToken` | string | No | Bearer token sent with callback requests |
| `openclaw` | object | No | OpenClaw webhook config (see below) |

### OpenClaw Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | Yes | Enable OpenClaw event forwarding |
| `channel` | string | No | Delivery channel (default: `"slack"`) |
| `to` | string | No | Target channel/user ID |
| `eventTypes` | string[] | No | Events to forward: `["completion"]`, `["event"]`, or both. Default: `["completion"]` |
| `sessionKey` | string | No | Session key override for routing |

### Response — `201 Created`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "/s/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "fullUrl": "http://localhost:3457/s/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Examples

**Push from template:**

```bash
curl -X POST http://localhost:3457/api/push \
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
        {"name": "Grilled chicken salad", "calories": 480, "time": "12:00 PM"}
      ]
    },
    "ttl": 7200
  }'
```

**Push raw HTML:**

```bash
curl -X POST http://localhost:3457/api/push \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><body style=\"background:#111;color:#eee;font-family:sans-serif;padding:40px\"><h1>Hello World</h1></body></html>",
    "ttl": 1800
  }'
```

---

## POST /api/compose

Create a page by composing individual [components](./components.md). This is the recommended approach for custom layouts.

### Request Body

```json
{
  "title": "Page Title",
  "sections": [
    { "type": "header", "config": { "title": "Hello", "subtitle": "World", "icon": "⚡" } },
    { "type": "stats", "config": { "items": [{"label": "Views", "value": "42", "icon": "👁️"}] } },
    { "type": "button", "config": { "label": "Done", "action": "complete", "style": "primary" } }
  ],
  "ttl": 3600,
  "openclaw": { "enabled": true, "channel": "slack", "to": "C0AKMF5E0KD" }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Page title (default: `"Composed"`) |
| `sections` | array | Yes | Array of `{ type, config }` component objects |
| `ttl` | number | No | Time-to-live in seconds |
| `openclaw` | object | No | OpenClaw webhook config |

### Response — `201 Created`

```json
{
  "id": "def-456-...",
  "url": "/s/def-456-...",
  "fullUrl": "http://localhost:3457/s/def-456-..."
}
```

> **Tip:** The compose API is the fastest path to a custom page. Mix and match components — no HTML required.

---

## GET /api/pages

List pages with optional filters.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `"active"` | Filter by status: `"active"` or `"all"` |
| `template` | string | — | Filter by template name |

### Response — `200 OK`

```json
{
  "pages": [
    {
      "id": "a1b2c3d4-...",
      "createdAt": "2026-03-14T18:00:00.000Z",
      "expiresAt": "2026-03-14T19:00:00.000Z",
      "views": 3,
      "meta": { "title": "My Dashboard", "template": "macro-tracker" }
    }
  ],
  "total": 1
}
```

### Example

```bash
# List all active pages
curl http://localhost:3457/api/pages \
  -H "Authorization: Bearer $PUSH_TOKEN"

# Filter by template
curl "http://localhost:3457/api/pages?template=macro-tracker" \
  -H "Authorization: Bearer $PUSH_TOKEN"
```

---

## GET /api/pages/:id

Get details for a specific page.

### Response — `200 OK`

```json
{
  "id": "a1b2c3d4-...",
  "createdAt": "2026-03-14T18:00:00.000Z",
  "expiresAt": "2026-03-14T19:00:00.000Z",
  "views": 5,
  "meta": {
    "title": "Macro Tracker",
    "template": "macro-tracker",
    "data": { ... }
  }
}
```

### Errors

- `404` — Page not found

---

## PATCH /api/pages/:id

Update an existing page's content, data, or TTL.

### Request Body

```json
{
  "template": "macro-tracker",
  "data": { ... },
  "html": "<html>...</html>",
  "ttl": 7200
}
```

| Field | Type | Description |
|-------|------|-------------|
| `template` | string | Re-render with a different or same template |
| `data` | object | New data for template rendering. If no `template` given, re-renders the page's existing template |
| `html` | string | Replace HTML directly |
| `ttl` | number | Extend the page's time-to-live |

> **Tip:** To update a template page with new data (e.g., updated macro totals), just send `data` — it will re-render using the page's original template.

### Response — `200 OK`

Returns updated page details (same format as `GET /api/pages/:id`).

### Errors

- `404` — Page not found
- `410` — Page expired

### Example

```bash
# Update macro data
curl -X PATCH http://localhost:3457/api/pages/a1b2c3d4-... \
  -H "Authorization: Bearer $PUSH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "date": "2026-03-14",
      "calories": {"current": 1700, "target": 1900},
      "protein": {"current": 80, "target": 86},
      "fat": {"current": 85, "target": 95},
      "carbs": {"current": 20, "target": 25}
    }
  }'
```

Connected WebSocket clients receive an `update` message and refresh automatically.

---

## DELETE /api/pages/:id

Delete a page immediately.

### Response — `200 OK`

```json
{
  "id": "a1b2c3d4-...",
  "deleted": true
}
```

Connected WebSocket clients receive a `destroy` message.

### Errors

- `404` — Page not found

---

## GET /s/:id

Serve a page's HTML to the browser. **No authentication required.**

- `200` — Returns the rendered HTML page
- `410` — Page has expired or been removed (shows a styled "Gone" page)

---

## GET /

Health check endpoint. **No authentication required.**

```json
{
  "status": "ok",
  "service": "sparkui",
  "version": "1.1.0",
  "pages": 3,
  "wsClients": 1,
  "templates": ["macro-tracker", "ws-test", "feedback-form", "checkout", "workout-timer"],
  "uptime": 3600
}
```

---

## GET /og/:id.svg

Dynamic Open Graph image for social previews. Returns an SVG with the page title and template name. Cached for 1 hour.

---

## WebSocket Protocol

Connect to `ws://localhost:3457/ws?page=PAGE_ID` to receive real-time updates.

### Client → Server Messages

```json
{"type": "heartbeat"}
```

Keeps the connection alive. Server responds with `{"type": "pong"}`.

```json
{"type": "event", "pageId": "abc-123", "data": {"action": "button_click"}}
```

General UI events (button clicks, checklist toggles, etc.).

```json
{"type": "completion", "pageId": "abc-123", "data": {"formData": {"name": "John", "rating": 5}}}
```

Completion events (form submissions, checklist completion, timer done).

### Server → Client Messages

```json
{"type": "update", "pageId": "abc-123"}
```

Page content was updated via `PATCH`. Client should reload.

```json
{"type": "destroy", "pageId": "abc-123"}
```

Page was deleted. Client should show an expiration message.

```json
{"type": "pong"}
```

Response to heartbeat.

### Event Forwarding

Events received via WebSocket are forwarded to:

1. **Callback URL** — If `callbackUrl` was set during push, events are POSTed there
2. **OpenClaw** — If `openclaw.enabled` is true, matching events (per `eventTypes`) are forwarded to the OpenClaw hooks endpoint

Callback payload:

```json
{
  "type": "completion",
  "pageId": "abc-123",
  "data": { "formData": { ... } },
  "timestamp": 1710450000000
}
```

### Connection Health

- Server pings all clients every 30 seconds
- Stale connections (no pong response) are terminated after 60 seconds
- Browser client should implement reconnection logic (the built-in templates do this automatically)

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Description of the error"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — missing or invalid fields |
| `401` | Unauthorized — missing or invalid Bearer token |
| `404` | Not found — page doesn't exist |
| `410` | Gone — page has expired |
| `500` | Server error |

---

## Authentication

All `/api/*` endpoints (except the health check) require a Bearer token:

```
Authorization: Bearer spk_your_token_here
```

The token is configured via the `PUSH_TOKEN` environment variable or `.env` file. If no token is set, SparkUI generates one on first start and appends it to `.env`.
