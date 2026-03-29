# Security Notes

## Install-Time Scanner Warnings

When installing SparkUI, automated security scanners may flag the following patterns. These are expected and not vulnerabilities.

### `process.env` + Network Access

SparkUI is a web server. It reads configuration from environment variables (`PUSH_TOKEN`, `SPARKUI_PORT`, `REDIS_URL`, etc.) and binds to a network port to serve HTTP requests and WebSocket connections. This is standard behavior for any Node.js web server.

### `child_process` in CLI

The `sparkui` CLI (`bin/sparkui.js`) uses `child_process` to spawn the server process (e.g., `sparkui start` runs `node server.js`). This is the same pattern used by tools like `next`, `vite`, and `express-generator`.

### `crypto` Module

Used to generate random push tokens (`crypto.randomBytes`) when one isn't provided via configuration. No cryptographic keys are stored or transmitted.

## Reporting Vulnerabilities

If you discover an actual security vulnerability, please report it responsibly by emailing **security@limeadelabs.co**. Do not open a public issue.
