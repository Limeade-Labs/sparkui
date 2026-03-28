/**
 * OpenClaw plugin entry point for SparkUI.
 *
 * This file is loaded by OpenClaw when the plugin is installed via:
 *   openclaw plugins install @limeade-labs/sparkui
 *
 * It wraps the existing SparkUI Express server and exposes it as a
 * managed service within the OpenClaw plugin lifecycle.
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** Resolve a push token: config → env → generate */
function resolvePushToken(configToken) {
  if (configToken) return configToken;
  if (process.env.PUSH_TOKEN) return process.env.PUSH_TOKEN;
  return "spk_" + randomBytes(24).toString("hex");
}

export default definePluginEntry({
  id: "sparkui",
  name: "SparkUI",
  description:
    "Ephemeral, purpose-built web UIs generated on demand from chat conversations",

  register(api) {
    const config = api.pluginConfig ?? {};
    const port = config.port ?? (parseInt(process.env.SPARKUI_PORT, 10) || 3457);
    const pushToken = resolvePushToken(config.pushToken);
    const publicUrl = config.publicUrl ?? process.env.SPARKUI_BASE_URL ?? null;
    const redisUrl = config.redisUrl ?? process.env.REDIS_URL ?? null;

    let serverRef = null;
    let serverReady = false;

    // Register SparkUI as a managed service
    api.registerService({
      id: "sparkui-server",
      name: "SparkUI Server",

      async start() {
        // Set env vars so server.js picks them up
        process.env.SPARKUI_PORT = String(port);
        process.env.PUSH_TOKEN = pushToken;
        if (publicUrl) process.env.SPARKUI_BASE_URL = publicUrl;
        if (redisUrl) process.env.REDIS_URL = redisUrl;

        // Import and start the server
        // server.js is CJS and auto-starts via startServer() at module load
        // We need to require() it, which triggers the start
        try {
          const sparkui = require(resolve(__dirname, "server.js"));
          serverRef = sparkui.server;
          serverReady = true;
          api.log?.info?.(
            `SparkUI server started on port ${port}` +
              (publicUrl ? ` (public: ${publicUrl})` : "")
          );
        } catch (err) {
          api.log?.error?.(`SparkUI failed to start: ${err.message}`);
          throw err;
        }
      },

      async stop() {
        if (serverRef) {
          return new Promise((resolve) => {
            serverRef.close(() => {
              serverReady = false;
              serverRef = null;
              resolve();
            });
            setTimeout(() => resolve(), 5000).unref();
          });
        }
      },

      inspect() {
        return {
          status: serverReady ? "running" : "stopped",
          port,
          pushToken: pushToken.slice(0, 8) + "..." + pushToken.slice(-4),
          publicUrl: publicUrl ?? `http://localhost:${port}`,
          redis: redisUrl ? "configured" : "not configured (in-memory mode)",
        };
      },
    });

    // Register an HTTP health route on the gateway
    api.registerHttpRoute({
      method: "GET",
      path: "/plugins/sparkui/status",
      handler: async (_req, res) => {
        if (!serverReady) {
          res.status(503).json({ status: "stopped" });
          return;
        }
        try {
          const resp = await fetch(`http://localhost:${port}/api/status`);
          const data = await resp.json();
          res.json({ status: "running", ...data });
        } catch (err) {
          res.status(502).json({ status: "error", error: err.message });
        }
      },
    });
  },
});
