'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { WebSocketServer } = require('ws');
const { PageStore } = require('./lib/store');
const templates = require('./lib/templates');
const components = require('./lib/components');
const { AnalyticsStore } = require('./lib/analytics');

// ── Config ───────────────────────────────────────────────────────────────────

const ENV_FILE = path.join(__dirname, '.env');

// Load .env file early so PORT and PUSH_TOKEN can come from it
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PORT = parseInt(process.env.SPARKUI_PORT, 10) || 3456;

// Resolve PUSH_TOKEN: env > .env file > generate new
function resolvePushToken() {
  if (process.env.PUSH_TOKEN) return process.env.PUSH_TOKEN;

  // Try to read from .env
  if (fs.existsSync(ENV_FILE)) {
    const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = envContent.match(/^PUSH_TOKEN=(.+)$/m);
    if (match) {
      process.env.PUSH_TOKEN = match[1];
      return match[1];
    }
  }

  // Generate new token
  const token = 'spk_' + crypto.randomBytes(24).toString('hex');
  const line = `PUSH_TOKEN=${token}\n`;
  fs.appendFileSync(ENV_FILE, line);
  process.env.PUSH_TOKEN = token;
  return token;
}

const PUSH_TOKEN = resolvePushToken();

// OpenClaw hooks config
const OPENCLAW_HOOKS_URL = process.env.OPENCLAW_HOOKS_URL || null;
const OPENCLAW_HOOKS_TOKEN = process.env.OPENCLAW_HOOKS_TOKEN || null;

// ── App ──────────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const store = new PageStore();
const analytics = new AnalyticsStore();

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  // CORS
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ── Auth Middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = auth.slice(7);
  if (token !== PUSH_TOKEN) {
    return res.status(401).json({ error: 'Invalid push token' });
  }
  next();
}

// ── Webhook Callback ─────────────────────────────────────────────────────────

/**
 * Forward a browser event to the page's callbackUrl via HTTP POST.
 * Fire-and-forget with logging.
 */
function forwardToCallback(pageId, type, data) {
  const cb = store.getCallback(pageId);
  if (!cb || !cb.callbackUrl) return;

  const payload = JSON.stringify({
    type,
    pageId,
    data: data || {},
    timestamp: Date.now(),
  });

  const url = new URL(cb.callbackUrl);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? require('https') : require('http');

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'User-Agent': 'SparkUI/1.0',
  };
  if (cb.callbackToken) {
    headers['Authorization'] = `Bearer ${cb.callbackToken}`;
  }

  const req = transport.request({
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers,
  }, (res) => {
    // Drain the response
    res.resume();
    if (res.statusCode >= 400) {
      console.warn(`[callback] POST ${cb.callbackUrl} returned ${res.statusCode} for page ${pageId}`);
    } else {
      console.log(`[callback] Forwarded ${type} event for page ${pageId} -> ${res.statusCode}`);
    }
  });

  req.on('error', (err) => {
    console.warn(`[callback] Failed to POST ${cb.callbackUrl} for page ${pageId}: ${err.message}`);
  });

  req.write(payload);
  req.end();
}

// ── OpenClaw Webhook Forwarding ──────────────────────────────────────────────

/**
 * Forward a browser event to OpenClaw hooks endpoint.
 * Only fires if page has openclaw config and event type is in eventTypes.
 */
function forwardToOpenClaw(pageId, type, data) {
  const oc = store.getOpenclaw(pageId);
  if (!oc || !oc.enabled) return;
  if (!OPENCLAW_HOOKS_URL || !OPENCLAW_HOOKS_TOKEN) {
    console.warn('[openclaw] OPENCLAW_HOOKS_URL or OPENCLAW_HOOKS_TOKEN not set, skipping');
    return;
  }

  // Check if this event type should be forwarded
  const eventTypes = oc.eventTypes || ['completion'];
  if (!eventTypes.includes(type)) return;

  const page = store.get(pageId);
  const pageMeta = page ? page.meta : {};
  const pageTitle = pageMeta.title || (page && page.meta && page.meta.title) || 'Untitled';
  const templateName = pageMeta.template || 'unknown';

  // Build message
  let message;
  if (type === 'completion') {
    // Richer message for completion events
    const dataStr = JSON.stringify(data, null, 2);
    message = `[SparkUI Completion] Page ${pageId}: Form submitted!\n\n` +
      `📝 **Page:** ${pageTitle}\n` +
      `📋 **Template:** ${templateName}\n\n` +
      `**Submitted Data:**\n\`\`\`\n${dataStr}\n\`\`\``;
  } else {
    const dataStr = JSON.stringify(data);
    message = `[SparkUI Event] Page ${pageId}: ${type} event received.\n\n` +
      `Data: ${dataStr}\n\n` +
      `Page title: ${pageTitle}\nTemplate: ${templateName}`;
  }

  const payload = JSON.stringify({
    message,
    deliver: true,
    channel: oc.channel || 'slack',
    to: oc.to || undefined,
    sessionKey: oc.sessionKey || undefined,
  });

  const url = new URL(OPENCLAW_HOOKS_URL);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? require('https') : require('http');

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'User-Agent': 'SparkUI/1.1',
    'Authorization': `Bearer ${OPENCLAW_HOOKS_TOKEN}`,
  };

  const req = transport.request({
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers,
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      if (res.statusCode >= 400) {
        console.warn(`[openclaw] POST ${OPENCLAW_HOOKS_URL} returned ${res.statusCode} for page ${pageId}: ${body}`);
      } else {
        console.log(`[openclaw] Forwarded ${type} event for page ${pageId} -> ${res.statusCode}`);
      }
    });
  });

  req.on('error', (err) => {
    console.warn(`[openclaw] Failed to POST ${OPENCLAW_HOOKS_URL} for page ${pageId}: ${err.message}`);
  });

  req.write(payload);
  req.end();
}

// ── WebSocket ────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });

// Track clients per page ID
const pageClients = new Map(); // pageId -> Set<ws>

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pageId = url.searchParams.get('page');

  // Mark connection as alive for heartbeat
  ws._isAlive = true;
  ws._pageId = pageId;

  if (pageId) {
    if (!pageClients.has(pageId)) pageClients.set(pageId, new Set());
    pageClients.get(pageId).add(ws);

    ws.on('close', () => {
      const clients = pageClients.get(pageId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) pageClients.delete(pageId);
      }
    });
  }

  // ── Handle incoming messages from browser ──
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // ignore non-JSON
    }

    const msgPageId = msg.pageId || pageId;

    switch (msg.type) {
      case 'heartbeat':
        // Respond with pong to keep client happy
        ws._isAlive = true;
        try { ws.send(JSON.stringify({ type: 'pong' })); } catch {}
        break;

      case 'analytics_view':
        // Client-side view tracking with fingerprint
        analytics.recordView(msgPageId, msg.visitorId || null);
        break;

      case 'analytics_interaction':
        // Client-side interaction tracking
        analytics.recordInteraction(msgPageId, msg.data || {});
        break;

      case 'analytics_session':
        // Client-side session/time-on-page tracking
        analytics.recordSession(msgPageId, msg.data || {});
        break;

      case 'analytics_completion':
        // Client-side completion tracking
        analytics.recordCompletion(msgPageId, msg.data || {});
        break;

      case 'event':
        console.log(`[ws] Event from page ${msgPageId}:`, JSON.stringify(msg.data).slice(0, 200));
        // Also record as analytics interaction
        analytics.recordInteraction(msgPageId, { type: 'event', element: '', data: msg.data });
        forwardToCallback(msgPageId, 'event', msg.data);
        forwardToOpenClaw(msgPageId, 'event', msg.data);
        break;

      case 'completion':
        console.log(`[ws] Completion from page ${msgPageId}:`, JSON.stringify(msg.data).slice(0, 200));
        // Also record as analytics completion
        analytics.recordCompletion(msgPageId, { type: 'completion', data: msg.data });
        forwardToCallback(msgPageId, 'completion', msg.data);
        forwardToOpenClaw(msgPageId, 'completion', msg.data);
        break;

      default:
        // Unknown type — forward anyway if it has data
        if (msg.data) {
          forwardToCallback(msgPageId, msg.type || 'unknown', msg.data);
          forwardToOpenClaw(msgPageId, msg.type || 'unknown', msg.data);
        }
        break;
    }
  });

  ws.on('error', () => {}); // swallow errors

  // Respond to WS-level pong frames (from server ping)
  ws.on('pong', () => {
    ws._isAlive = true;
  });
});

// ── Server-side heartbeat: ping every 30s, drop stale after 60s ──

const WS_PING_INTERVAL = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._isAlive === false) {
      // Stale — hasn't responded since last ping
      console.log(`[ws] Dropping stale client for page ${ws._pageId || 'unknown'}`);
      return ws.terminate();
    }
    ws._isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 30000);

WS_PING_INTERVAL.unref();

/** Notify all WS clients watching a page to reload */
function notifyPageUpdate(pageId) {
  const clients = pageClients.get(pageId);
  if (!clients) return;
  const msg = JSON.stringify({ type: 'update', pageId });
  for (const ws of clients) {
    try { ws.send(msg); } catch {}
  }
}

/** Notify all WS clients watching a page that it's destroyed */
function notifyPageDestroy(pageId) {
  const clients = pageClients.get(pageId);
  if (!clients) return;
  const msg = JSON.stringify({ type: 'destroy', pageId });
  for (const ws of clients) {
    try { ws.send(msg); } catch {}
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sparkui',
    version: '1.1.0',
    pages: store.size,
    wsClients: wss.clients.size,
    templates: templates.list(),
    uptime: Math.floor(process.uptime()),
  });
});

// Serve a page
app.get('/s/:id', (req, res) => {
  const page = store.get(req.params.id);
  if (!page) {
    return res.status(410).set('Content-Type', 'text/html').send(
      `<!DOCTYPE html><html><head><title>Gone</title></head><body style="background:#111;color:#888;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:3rem;margin-bottom:8px">⚡</h1><p>This page has expired or been removed.</p><p style="color:#555;font-size:0.85rem">SparkUI pages are ephemeral by design.</p></div></body></html>`
    );
  }
  store.recordView(req.params.id);

  // Record analytics view with visitor fingerprint from query or header
  const visitorId = req.query._vid || req.headers['x-visitor-id'] || null;
  analytics.recordView(req.params.id, visitorId);

  res.set('Content-Type', 'text/html').send(page.html);
});

/**
 * Prettify a template name for OG defaults.
 * e.g. "macro-tracker" → "Macro Tracker"
 */
function prettifyTemplateName(name) {
  if (!name) return 'SparkUI';
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Push API — create a page
app.post('/api/push', requireAuth, (req, res) => {
  try {
    const { html, template, data, ttl, callbackUrl, callbackToken, meta, openclaw, og } = req.body;

    if (!html && !template) {
      return res.status(400).json({ error: 'Provide either "html" or "template" + "data"' });
    }

    const id = uuidv4();
    const baseUrl = process.env.SPARKUI_BASE_URL || `http://localhost:${PORT}`;
    let finalHtml;

    // Build OG defaults
    const ogDefaults = {
      title: (og && og.title) || prettifyTemplateName(template) || 'SparkUI',
      description: (og && og.description) || 'An ephemeral micro-app powered by SparkUI ⚡',
      image: (og && og.image) || `${baseUrl}/og/${id}.svg`,
      url: `${baseUrl}/s/${id}`,
    };

    if (template) {
      if (!templates.has(template)) {
        return res.status(400).json({ error: `Unknown template "${template}". Available: ${templates.list().join(', ')}` });
      }
      const templateData = { ...data, _pageId: id, _og: ogDefaults };
      finalHtml = templates.render(template, templateData);
    } else {
      finalHtml = html;
    }

    // Enrich meta with template/title for OpenClaw forwarding context
    const enrichedMeta = {
      ...(meta || {}),
      template: template || (meta && meta.template) || null,
      title: (data && data.title) || (meta && meta.title) || null,
      og: ogDefaults,
    };

    store.set(id, {
      html: finalHtml,
      ttl: ttl || undefined,
      callbackUrl: callbackUrl || null,
      callbackToken: callbackToken || null,
      meta: { ...enrichedMeta, data: data || null },
      openclaw: openclaw || null,
    });

    // Initialize analytics for this page
    const pageTtl = ttl || 3600;
    analytics.init(id, {
      template: template || 'raw',
      created: new Date().toISOString(),
      expires: new Date(Date.now() + pageTtl * 1000).toISOString(),
    });

    res.status(201).json({ id, url: `/s/${id}`, fullUrl: `${baseUrl}/s/${id}` });
  } catch (err) {
    console.error('Push error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// List pages
app.get('/api/pages', requireAuth, (req, res) => {
  const status = req.query.status || 'active';
  const template = req.query.template || undefined;
  const pages = store.list({ status, template });
  res.json({ pages, total: pages.length });
});

// Page details
app.get('/api/pages/:id', requireAuth, (req, res) => {
  const details = store.getDetails(req.params.id);
  if (!details) {
    return res.status(404).json({ error: 'Page not found' });
  }
  res.json(details);
});

// Update a page
app.patch('/api/pages/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const page = store.get(id);

  if (!page) {
    return res.status(store.has(id) ? 410 : 404).json({ error: store.has(id) ? 'Page expired' : 'Page not found' });
  }

  const { html, template, data, ttl } = req.body;
  let finalHtml = null;

  if (template) {
    if (!templates.has(template)) {
      return res.status(400).json({ error: `Unknown template "${template}"` });
    }
    finalHtml = templates.render(template, { ...data, _pageId: id });
  } else if (html) {
    finalHtml = html;
  } else if (data && page.meta && page.meta.template && templates.has(page.meta.template)) {
    // Re-render existing template with new data
    finalHtml = templates.render(page.meta.template, { ...data, _pageId: id });
  }

  // Update data in meta if provided
  if (data && page.meta) {
    page.meta.data = data;
  }

  // Update HTML if we have new content, or just extend TTL
  if (finalHtml) {
    store.update(id, { html: finalHtml, ttl });
  } else if (ttl) {
    // TTL-only update
    store.update(id, { html: page.html, ttl });
  } else if (!finalHtml && !ttl) {
    return res.status(400).json({ error: 'Provide "html", "template" + "data", "data" (for template pages), or "ttl"' });
  }

  notifyPageUpdate(id);

  const details = store.getDetails(id);
  res.json(details);
});

// Delete a page
app.delete('/api/pages/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const deleted = store.delete(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Page not found' });
  }
  notifyPageDestroy(id); // notify clients the page is gone
  res.json({ id, deleted: true });
});

// ── Dynamic OG Image (SVG) ───────────────────────────────────────────────────

app.get('/og/:id.svg', (req, res) => {
  const page = store.get(req.params.id);
  const ogTitle = (page && page.meta && page.meta.og && page.meta.og.title) || 'SparkUI';
  const templateName = (page && page.meta && page.meta.template) || '';
  const subtitle = templateName ? prettifyTemplateName(templateName) : 'Ephemeral Micro-App';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111111"/>
  <rect x="0" y="0" width="1200" height="4" fill="#00ff88"/>
  <text x="100" y="260" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="56" font-weight="800" fill="#e0e0e0">${escapeXml(ogTitle)}</text>
  <text x="100" y="320" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="28" fill="#888888">${escapeXml(subtitle)}</text>
  <text x="100" y="530" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="32" fill="#00ff88" font-weight="600">⚡ SparkUI</text>
  <text x="1100" y="530" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="22" fill="#555555" text-anchor="end">sparkui</text>
</svg>`;

  res.set('Content-Type', 'image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
});

/** Escape text for safe XML/SVG embedding */
function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ── Compose API ──────────────────────────────────────────────────────────────

app.post('/api/compose', requireAuth, (req, res) => {
  try {
    const layout = req.body;

    if (!layout || !layout.sections || !Array.isArray(layout.sections)) {
      return res.status(400).json({ error: 'Provide a layout with "sections" array' });
    }

    const { html, pushBody } = components.compose(layout);
    const id = uuidv4();

    // Replace placeholder page ID with actual UUID
    const finalHtml = html.replace(/__PAGE_ID__/g, id);

    const ttl = layout.ttl || undefined;
    const openclaw = layout.openclaw || null;

    store.set(id, {
      html: finalHtml,
      ttl,
      meta: { title: layout.title || 'Composed', template: 'composed' },
      openclaw,
    });

    // Initialize analytics for composed page
    const composedTtl = ttl || 3600;
    analytics.init(id, {
      template: 'composed',
      created: new Date().toISOString(),
      expires: new Date(Date.now() + composedTtl * 1000).toISOString(),
    });

    const baseUrl = process.env.SPARKUI_BASE_URL || `http://localhost:${PORT}`;
    res.status(201).json({ id, url: `/s/${id}`, fullUrl: `${baseUrl}/s/${id}` });
  } catch (err) {
    console.error('Compose error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics API ────────────────────────────────────────────────────────────

// Summary analytics across all pages
app.get('/api/analytics', requireAuth, (req, res) => {
  res.json(analytics.getSummary());
});

// Detailed analytics for a specific page
app.get('/api/analytics/:pageId', requireAuth, (req, res) => {
  const data = analytics.getPage(req.params.pageId);
  if (!data) {
    return res.status(404).json({ error: 'No analytics found for this page' });
  }
  res.json(data);
});

// Analytics beacon endpoint (POST) — for client-side tracking without WS
app.post('/api/analytics/beacon', express.json(), (req, res) => {
  const { pageId, type, visitorId, data } = req.body;
  if (!pageId) return res.status(400).json({ error: 'pageId required' });

  switch (type) {
    case 'view':
      analytics.recordView(pageId, visitorId);
      break;
    case 'interaction':
      analytics.recordInteraction(pageId, data || {});
      break;
    case 'completion':
      analytics.recordCompletion(pageId, data || {});
      break;
    case 'session':
      analytics.recordSession(pageId, data || {});
      break;
    default:
      break;
  }
  res.json({ ok: true });
});

// ── Test Echo Endpoint ───────────────────────────────────────────────────────

const echoLog = []; // In-memory log of received webhooks (last 50)

app.post('/api/test/echo', requireAuth, (req, res) => {
  const entry = {
    receivedAt: new Date().toISOString(),
    body: req.body,
  };
  echoLog.push(entry);
  if (echoLog.length > 50) echoLog.shift();
  console.log(`[echo] Received webhook:`, JSON.stringify(req.body).slice(0, 300));
  res.json({ ok: true, received: entry });
});

// View echo log
app.get('/api/test/echo', requireAuth, (req, res) => {
  res.json({ entries: echoLog, count: echoLog.length });
});

// ── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`⚡ SparkUI server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/`);
  console.log(`   Push token: ${PUSH_TOKEN.slice(0, 8)}...${PUSH_TOKEN.slice(-4)}`);
  console.log(`   Templates: ${templates.list().join(', ')}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down...`);
  clearInterval(WS_PING_INTERVAL);
  server.close(() => {
    store.destroy();
    wss.close();
    console.log('SparkUI stopped.');
    process.exit(0);
  });
  // Force exit after 5s
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server }; // for testing
