# SparkUI Examples

Working examples to get started with the SparkUI API.

## Setup

1. Start the SparkUI server:
   ```bash
   cd /path/to/sparkui
   npm install
   npm start
   ```

2. Set your token:
   ```bash
   export SPARKUI_TOKEN="your-push-token"
   export SPARKUI_URL="http://localhost:3457"  # optional, this is the default
   ```

3. Make the shell scripts executable:
   ```bash
   chmod +x examples/*.sh
   ```

## Examples

### [`basic-push.sh`](./basic-push.sh)

Pushes a **macro-tracker** page using the `/api/push` endpoint with a built-in template. Shows how to pass structured data (nutrition targets, meals) and set a TTL. The simplest way to create a page.

### [`compose-page.sh`](./compose-page.sh)

Composes a custom **Team Standup** page from individual components using the `/api/compose` endpoint. Demonstrates mixing `header`, `stats`, `checklist`, and `form` components into a single page without needing a template.

### [`manage-pages.sh`](./manage-pages.sh)

Walks through the full **page lifecycle**: create → list → details → update (extend TTL) → delete → verify deletion. Covers every endpoint in the Page Management API.

### [`node-client.js`](./node-client.js)

A **Node.js client** that pushes a checkout page via `fetch`, then connects via **WebSocket** to receive real-time user events (button clicks, form submissions, completions). Includes heartbeat handling, graceful cleanup, and auto-deletion on completion.

```bash
node examples/node-client.js
```

Requires Node.js 18+ (uses built-in `fetch`). For WebSocket, Node 21+ has built-in support; older versions need `npm install ws`.

## Notes

- All examples use `jq` for pretty-printing JSON responses (install via `brew install jq` or `apt install jq`)
- The shell scripts use `set -euo pipefail` for safety — they'll exit on any error
- Pages are ephemeral — they auto-expire after the TTL (default: 1 hour)
- Replace `YOUR_TOKEN` with the `PUSH_TOKEN` from your `.env` file
