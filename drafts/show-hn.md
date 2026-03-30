# Show HN: SparkUI — Ephemeral interactive UIs for AI agents

**URL:** https://sparkui.dev
**GitHub:** https://github.com/Limeade-Labs/sparkui

---

## Post text:

Hey HN, I built SparkUI because AI agents are stuck in text and it's making them worse at their jobs.

When your agent needs to collect a star rating, it asks "rate 1-5." When it needs payment info, it says "paste your card number." When it runs a workout timer, it sends 30 countdown messages. We've given agents incredible capabilities but confined their output to a chat box.

SparkUI lets agents generate real, interactive web pages on demand. The agent pushes a template (or composes from components), gets back a URL, and shares it. The user clicks, interacts with a polished UI, and the results stream back to the agent via WebSocket. Pages self-destruct after a configurable TTL.

**What it is:**
- REST API: POST a template + data, get back a URL
- 11 templates (forms, polls, timers, checkout, approval flows, dashboards, etc.)
- 8 composable components for custom layouts
- Bidirectional: agent can push updates to live pages (toasts, DOM updates, reload)
- State persists across tab closes (Redis + localStorage)
- Events stream back via WebSocket with guaranteed delivery

**How to try it:**
- `npx @limeade-labs/sparkui` — runs locally in 5 seconds
- Live demos on the landing page (sparkui.dev) — click "Launch Demo" to generate a real page
- MCP server for Claude Desktop/Cursor/Windsurf
- OpenClaw plugin: `openclaw plugins install @limeade-labs/sparkui`
- Docker: `docker run -p 3457:3457 ghcr.io/limeade-labs/sparkui`

**The key insight:** The value isn't generating HTML — any LLM can do that. It's the round-trip: agent creates UI → user interacts → agent gets structured results back → agent acts on them. That loop doesn't exist in chat.

Stack: Node.js, Express, WebSocket, Redis. No frontend framework. MIT licensed.

I'd love feedback on what templates/components are missing and what integrations matter most to you.
