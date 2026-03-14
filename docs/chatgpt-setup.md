# ChatGPT Setup

Use SparkUI with ChatGPT Custom GPTs via the Actions feature. This lets a GPT create ephemeral web pages during conversations and share links with users.

## Overview

ChatGPT Custom GPTs support "Actions" — HTTP API calls the GPT can make during a conversation. By configuring SparkUI's push API as an action, your GPT can generate interactive pages (dashboards, forms, timers) and share the URL.

## Prerequisites

1. SparkUI server running and **publicly accessible** (not just localhost)
2. A ChatGPT Plus account (Actions require a paid plan)
3. Your push token

> **Important:** Your SparkUI server must be reachable from the internet. Use a reverse proxy, cloud deployment, or tunnel (e.g., Cloudflare Tunnel, ngrok) and set `SPARKUI_BASE_URL` accordingly.

## OpenAPI Spec

Create this OpenAPI specification for the GPT builder. Replace `https://your-sparkui-server.com` with your actual public URL.

```yaml
openapi: 3.1.0
info:
  title: SparkUI
  description: Create ephemeral interactive web pages on demand
  version: 1.1.0
servers:
  - url: https://your-sparkui-server.com
paths:
  /api/push:
    post:
      operationId: pushPage
      summary: Create a new ephemeral page from a template or raw HTML
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                template:
                  type: string
                  description: "Template name: macro-tracker, checkout, workout-timer, feedback-form, ws-test"
                data:
                  type: object
                  description: Template data (varies by template)
                html:
                  type: string
                  description: Raw HTML content (alternative to template)
                ttl:
                  type: integer
                  description: Time-to-live in seconds (default 3600)
                  default: 3600
              anyOf:
                - required: [template, data]
                - required: [html]
      responses:
        "201":
          description: Page created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  url:
                    type: string
                  fullUrl:
                    type: string
  /api/compose:
    post:
      operationId: composePage
      summary: Compose a page from individual components
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [sections]
              properties:
                title:
                  type: string
                  default: "SparkUI"
                sections:
                  type: array
                  items:
                    type: object
                    required: [type]
                    properties:
                      type:
                        type: string
                        description: "Component: header, button, timer, checklist, progress, stats, form, tabs"
                      config:
                        type: object
                ttl:
                  type: integer
                  default: 3600
      responses:
        "201":
          description: Page created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  url:
                    type: string
                  fullUrl:
                    type: string
```

## Setting Up the Action in GPT Builder

1. Go to [ChatGPT GPT Builder](https://chatgpt.com/gpts/editor)
2. Create a new GPT or edit an existing one
3. Click **Configure** → scroll to **Actions** → **Create new action**
4. Paste the OpenAPI spec above into the schema editor
5. Under **Authentication**:
   - Select **API Key**
   - Auth Type: **Bearer**
   - Paste your `PUSH_TOKEN` as the API key
6. Click **Save**

### GPT Instructions

Add these instructions to your GPT's system prompt:

```
You have access to SparkUI, which creates ephemeral interactive web pages.

When the user needs something visual (dashboards, trackers, forms, timers):
1. Use the pushPage action with an appropriate template and data
2. Share the fullUrl with the user

Available templates:
- macro-tracker: Nutrition tracking (data: date, calories, protein, fat, carbs, meals)
- checkout: Product checkout demo (data: product with name/description/price)
- workout-timer: Exercise routine (data: title, exercises, rounds, restSeconds)
- feedback-form: Feedback collection (data: title, subtitle, questions)

For custom layouts, use composePage with sections array. Components:
header, button, timer, checklist, progress, stats, form, tabs

Pages expire after TTL seconds. Always share the fullUrl link.
```

## Authentication

SparkUI uses Bearer token authentication. In the GPT builder:

- **Auth type:** API Key
- **Scheme:** Bearer
- **Key:** Your `PUSH_TOKEN` value (e.g., `spk_abc123...`)

The GPT sends this automatically with every action call as:

```
Authorization: Bearer spk_abc123...
```

## Example Prompts and Expected Behavior

### Nutrition Dashboard

**User:** "Show me a nutrition dashboard for today. I've had 1,200 calories, 55g protein, 40g fat, 20g carbs out of targets 1,900/86/95/25."

**GPT calls:** `pushPage` with `macro-tracker` template

**GPT responds:** "Here's your nutrition dashboard for today: [link]. You're at 63% of your calorie target with solid macro distribution."

### Feedback Form

**User:** "Create a feedback form for our new feature launch"

**GPT calls:** `pushPage` with `feedback-form` template

**GPT responds:** "Here's your feedback form: [link]. Share this with your team to collect ratings and comments."

### Custom Dashboard

**User:** "Make a project status dashboard showing 42 tasks done, 8 in progress, 3 blocked"

**GPT calls:** `composePage` with header + stats + progress components

**GPT responds:** "Here's your project dashboard: [link]. It shows your current task breakdown with trend indicators."

### Workout Timer

**User:** "Create a workout: 3 rounds of push-ups (15), squats (20), and planks (30 sec) with 60-second rest"

**GPT calls:** `pushPage` with `workout-timer` template

**GPT responds:** "Your workout is ready: [link]. Open it on your phone and hit Start when you're ready."

## Limitations

- **Public access required** — SparkUI must be internet-accessible (not localhost)
- **No WebSocket** — ChatGPT can create pages but can't receive real-time events back. Use the `callbackUrl` parameter if you need webhook notifications.
- **Rate limits** — ChatGPT may throttle action calls. Keep page creation to a reasonable frequency.
- **TTL** — Pages are ephemeral. Set longer TTL values if users need extended access.

> **Tip:** For bidirectional communication (agent receives user actions), consider using [OpenClaw](./openclaw-setup.md) or [MCP](./mcp-setup.md) integrations instead.
