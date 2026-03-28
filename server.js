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
const { RedisStore } = require('./lib/redis');
const { DeliveryWorker } = require('./lib/delivery-worker');
const sparkuiIcons = require('@limeade-labs/sparkui-icons');
const SPARKUI_ICONS_CSS = fs.readFileSync(require.resolve('@limeade-labs/sparkui-icons/style.css'), 'utf-8');
const SPARKUI_ICONS_STYLE_TAG = `<style id="sparkui-icons-styles">${SPARKUI_ICONS_CSS}</style>`;

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

// Interactive templates that default openclaw.enabled = true
const INTERACTIVE_TEMPLATES = new Set([
  'workout-timer', 'feedback-form', 'poll',
  'approval-flow', 'checkout', 'shopping-list'
]);

// ── App ──────────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const store = new PageStore();
const analytics = new AnalyticsStore();
const redisStore = new RedisStore();

// L1 cache for HTML (in-memory for fast serving)
const htmlCache = new Map(); // pageId -> html string

// Delivery worker
const deliveryWorker = new DeliveryWorker(redisStore, {
  openclawHooksUrl: OPENCLAW_HOOKS_URL,
  openclawHooksToken: OPENCLAW_HOOKS_TOKEN,
  getPageMeta: async (pageId) => redisStore.loadMeta(pageId),
  getPageCallback: (pageId) => {
    const page = store.get(pageId);
    if (!page) return null;
    return { callbackUrl: page.callbackUrl, callbackToken: page.callbackToken };
  },
  getPageOpenclaw: (pageId) => {
    const page = store.get(pageId);
    if (!page) return null;
    return page.openclaw || null;
  },
});

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use('/files', express.static(path.join(__dirname, 'public', 'files')));
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

// ── Page State Helpers (Redis-backed) ────────────────────────────────────────

/**
 * Save state for a page (Redis-backed with in-memory store fallback check).
 */
async function savePageState(pageId, data) {
  const page = store.get(pageId);
  if (!page) return false;
  try {
    await redisStore.saveState(pageId, data);
    return true;
  } catch (err) {
    console.error(`[state] Redis save failed for ${pageId}:`, err.message);
    return false;
  }
}

/**
 * Load state for a page from Redis.
 */
async function loadPageState(pageId) {
  const page = store.get(pageId);
  if (!page) return null;
  try {
    const entry = await redisStore.loadState(pageId);
    return entry ? entry.data : null;
  } catch (err) {
    console.error(`[state] Redis load failed for ${pageId}:`, err.message);
    return null;
  }
}

// Clean up state when pages expire
setInterval(() => {
  // The in-memory store's sweep handles page expiry;
  // Redis keys expire via TTL automatically
}, 60_000).unref();

// ── Event & Delivery Helpers ─────────────────────────────────────────────────

/**
 * Record event and queue for delivery (replaces direct HTTP forwarding).
 */
async function recordAndQueueEvent(pageId, type, data) {
  try {
    // Write to event stream
    await redisStore.appendEvent(pageId, type, data);
    // Queue for delivery worker
    await redisStore.queueDelivery(pageId, type, data);
  } catch (err) {
    console.error(`[event] Failed to record/queue event for ${pageId}:`, err.message);
    // Fallback: direct forwarding (fire-and-forget, better than nothing)
    forwardToCallbackDirect(pageId, type, data);
    forwardToOpenClawDirect(pageId, type, data);
  }
}

/**
 * Direct callback forwarding (fallback if Redis is down).
 */
function forwardToCallbackDirect(pageId, type, data) {
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
    res.resume();
    if (res.statusCode >= 400) {
      console.warn(`[callback-fallback] POST ${cb.callbackUrl} returned ${res.statusCode}`);
    }
  });

  req.on('error', (err) => {
    console.warn(`[callback-fallback] Failed: ${err.message}`);
  });

  req.write(payload);
  req.end();
}

/**
 * Direct OpenClaw forwarding (fallback if Redis is down).
 */
function forwardToOpenClawDirect(pageId, type, data) {
  const oc = store.getOpenclaw(pageId);
  if (!oc || !oc.enabled) return;
  if (!OPENCLAW_HOOKS_URL || !OPENCLAW_HOOKS_TOKEN) return;

  const eventTypes = oc.eventTypes || ['completion'];
  if (!eventTypes.includes(type)) return;

  const page = store.get(pageId);
  const pageMeta = page ? page.meta : {};
  const pageTitle = pageMeta.title || 'Untitled';
  const templateName = pageMeta.template || 'unknown';

  let message;
  if (type === 'completion') {
    const dataStr = JSON.stringify(data, null, 2);
    message = `[SparkUI Completion] Page ${pageId}: Form submitted!\n\n📝 **Page:** ${pageTitle}\n📋 **Template:** ${templateName}\n\n**Submitted Data:**\n\`\`\`\n${dataStr}\n\`\`\``;
  } else {
    const dataStr = JSON.stringify(data);
    message = `[SparkUI Event] Page ${pageId}: ${type} event received.\n\nData: ${dataStr}\n\nPage title: ${pageTitle}\nTemplate: ${templateName}`;
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

  const req = transport.request({
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': 'SparkUI/1.1',
      'Authorization': `Bearer ${OPENCLAW_HOOKS_TOKEN}`,
    },
  }, (res) => {
    res.resume();
  });

  req.on('error', () => {});
  req.write(payload);
  req.end();
}

// ── Redis Page Metadata Sync ─────────────────────────────────────────────────

/**
 * Save page metadata to Redis when a page is created/updated.
 */
async function syncPageToRedis(id, page, ttlSeconds) {
  try {
    const meta = {
      html: page.html,
      meta: page.meta || {},
      openclaw: page.openclaw || null,
      callbackUrl: page.callbackUrl || null,
      callbackToken: page.callbackToken || null,
      ttl: page.ttl || ttlSeconds,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
    await redisStore.saveMeta(id, meta, ttlSeconds);
    // Cache HTML in memory
    htmlCache.set(id, page.html);
  } catch (err) {
    console.error(`[redis] Failed to sync page ${id}:`, err.message);
  }
}

/**
 * On server start, reload active pages from Redis into in-memory store.
 */
async function reloadPagesFromRedis() {
  try {
    const ids = await redisStore.getActivePageIds();
    let reloaded = 0;
    for (const id of ids) {
      const meta = await redisStore.loadMeta(id);
      if (!meta || !meta.html) continue;

      // Compute remaining TTL
      const ttl = await redisStore.client.ttl(`page:meta:${id}`);
      if (ttl <= 0) continue;

      // Restore into in-memory store
      store.set(id, {
        html: meta.html,
        ttl: ttl,
        callbackUrl: meta.callbackUrl || null,
        callbackToken: meta.callbackToken || null,
        meta: meta.meta || {},
        openclaw: meta.openclaw || null,
      });

      // L1 HTML cache
      htmlCache.set(id, meta.html);
      reloaded++;
    }
    console.log(`[redis] Reloaded ${reloaded} pages from Redis`);
  } catch (err) {
    console.error('[redis] Failed to reload pages:', err.message);
  }
}

// ── WebSocket ────────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });

// Track clients per page ID
const pageClients = new Map(); // pageId -> Set<ws>

// Push subscription cleanup functions per page
const pushUnsubscribers = new Map(); // pageId -> unsubscribe fn

/**
 * Ensure we're subscribed to Redis push channel for a page.
 */
function ensurePushSubscription(pageId) {
  if (pushUnsubscribers.has(pageId)) return;
  const unsub = redisStore.subscribePush(pageId, (message) => {
    // Forward push message to all WS clients watching this page
    const clients = pageClients.get(pageId);
    if (!clients || clients.size === 0) return;
    const msg = JSON.stringify({ type: 'push', pageId, ...message });
    for (const ws of clients) {
      try { ws.send(msg); } catch {}
    }
  });
  pushUnsubscribers.set(pageId, unsub);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pageId = url.searchParams.get('page');

  // Mark connection as alive for heartbeat
  ws._isAlive = true;
  ws._pageId = pageId;

  if (pageId) {
    if (!pageClients.has(pageId)) pageClients.set(pageId, new Set());
    pageClients.get(pageId).add(ws);

    // Subscribe to push channel for this page
    ensurePushSubscription(pageId);

    ws.on('close', () => {
      const clients = pageClients.get(pageId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          pageClients.delete(pageId);
          // Unsubscribe from push channel
          const unsub = pushUnsubscribers.get(pageId);
          if (unsub) { unsub(); pushUnsubscribers.delete(pageId); }
        }
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
        ws._isAlive = true;
        try { ws.send(JSON.stringify({ type: 'pong' })); } catch {}
        break;

      case 'analytics_view':
        analytics.recordView(msgPageId, msg.visitorId || null);
        break;

      case 'analytics_interaction':
        analytics.recordInteraction(msgPageId, msg.data || {});
        break;

      case 'analytics_session':
        analytics.recordSession(msgPageId, msg.data || {});
        break;

      case 'analytics_completion':
        analytics.recordCompletion(msgPageId, msg.data || {});
        break;

      case 'save_state':
        // Save page state (Redis-backed)
        if (msgPageId && msg.data !== undefined) {
          savePageState(msgPageId, msg.data).then((saved) => {
            if (saved) {
              try { ws.send(JSON.stringify({ type: 'state_saved', pageId: msgPageId })); } catch {}
              // Broadcast to other tabs watching this page
              const clients = pageClients.get(msgPageId);
              if (clients) {
                const syncMsg = JSON.stringify({ type: 'state_sync', pageId: msgPageId, data: msg.data });
                for (const client of clients) {
                  if (client !== ws) {
                    try { client.send(syncMsg); } catch {}
                  }
                }
              }
            } else {
              try { ws.send(JSON.stringify({ type: 'state_error', pageId: msgPageId, error: 'Page not found or expired' })); } catch {}
            }
          }).catch((err) => {
            console.error(`[ws] save_state error:`, err.message);
            try { ws.send(JSON.stringify({ type: 'state_error', pageId: msgPageId, error: 'Internal error' })); } catch {}
          });
        }
        break;

      case 'load_state':
        // Load page state (Redis-backed)
        if (msgPageId) {
          loadPageState(msgPageId).then((stateData) => {
            try { ws.send(JSON.stringify({ type: 'state', pageId: msgPageId, data: stateData })); } catch {}
          }).catch((err) => {
            console.error(`[ws] load_state error:`, err.message);
            try { ws.send(JSON.stringify({ type: 'state', pageId: msgPageId, data: null })); } catch {}
          });
        }
        break;

      case 'event':
        console.log(`[ws] Event from page ${msgPageId}:`, JSON.stringify(msg.data).slice(0, 200));
        analytics.recordInteraction(msgPageId, { type: 'event', element: '', data: msg.data });
        recordAndQueueEvent(msgPageId, 'event', msg.data);
        break;

      case 'completion':
        console.log(`[ws] Completion from page ${msgPageId}:`, JSON.stringify(msg.data).slice(0, 200));
        analytics.recordCompletion(msgPageId, { type: 'completion', data: msg.data });
        recordAndQueueEvent(msgPageId, 'completion', msg.data);
        break;

      default:
        if (msg.data) {
          recordAndQueueEvent(msgPageId, msg.type || 'unknown', msg.data);
        }
        break;
    }
  });

  ws.on('error', () => {}); // swallow errors

  ws.on('pong', () => {
    ws._isAlive = true;
  });
});

// ── Server-side heartbeat: ping every 30s, drop stale after 60s ──

const WS_PING_INTERVAL = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._isAlive === false) {
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

// Landing page
// ── FreshBooks OAuth Callback ────────────────────────────────────────────────
app.get('/freshbooks/callback', (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  // Save code to file for pickup
  const cbFile = path.join(__dirname, 'freshbooks', 'auth-code.txt');
  fs.writeFileSync(cbFile, code, 'utf-8');
  res.send(`
    <html><body style="font-family: sans-serif; text-align: center; padding: 60px;">
      <h1>✅ FreshBooks Authorization Received</h1>
      <p>Auth code captured. Ron is exchanging it for tokens now.</p>
      <p style="color: #666;">You can close this tab.</p>
    </body></html>
  `);
});

app.get('/', (req, res) => {
  const landingPath = path.join(__dirname, 'landing', 'index.html');
  if (fs.existsSync(landingPath)) {
    let html = fs.readFileSync(landingPath, 'utf-8');
    // Preserve sections marked with SPARKUI-ICONS-SKIP comments
    const skipBlocks = [];
    html = html.replace(/<!-- SPARKUI-ICONS-SKIP-START -->[\s\S]*?<!-- SPARKUI-ICONS-SKIP-END -->/g, (match, offset) => {
      const placeholder = `__SPARKUI_SKIP_${skipBlocks.length}__`;
      skipBlocks.push(match);
      return placeholder;
    });
    // Run sparkui-icons replacement on landing page (eat our own dogfood)
    let result = sparkuiIcons.replace(html, {
      variant: 'duotone',
      colorMap: require('@limeade-labs/sparkui-icons/colors')
    });
    // Restore skipped blocks
    skipBlocks.forEach((block, i) => {
      result = result.replace(`__SPARKUI_SKIP_${i}__`, block);
    });
    // Inject icon CSS
    if (result !== html) {
      result = result.replace('</head>', SPARKUI_ICONS_STYLE_TAG + '</head>');
    }
    res.set('Content-Type', 'text/html');
    return res.send(result);
  }
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

// ── Template Schema Discovery ────────────────────────────────────────────────

// GET /api/templates — list all templates with schemas
app.get('/api/templates', (req, res) => {
  res.json({ templates: templates.listWithSchemas() });
});

// GET /api/templates/:name/schema — get schema for a specific template
app.get('/api/templates/:name/schema', (req, res) => {
  const name = req.params.name;
  if (!templates.has(name)) {
    return res.status(404).json({ error: `Unknown template "${name}". Available: ${templates.list().join(', ')}` });
  }
  const schema = templates.getSchema(name);
  if (!schema) {
    return res.status(404).json({ error: `Template "${name}" has no schema defined` });
  }
  res.json({ template: name, schema });
});

// Health/status check (API) — now includes Redis health
app.get('/up', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/status', async (req, res) => {
  const redisHealthy = await redisStore.healthCheck();
  res.json({
    status: 'ok',
    service: 'sparkui',
    version: '1.1.0',
    pages: store.size,
    wsClients: wss.clients.size,
    templates: templates.list(),
    uptime: Math.floor(process.uptime()),
    redis: redisHealthy ? 'connected' : 'disconnected',
  });
});

// Serve a page
app.get('/s/:id', (req, res) => {
  const id = req.params.id;

  // Try L1 cache first, then store
  let html = htmlCache.get(id);
  if (!html) {
    const page = store.get(id);
    if (!page) {
      return res.status(410).set('Content-Type', 'text/html').send(
        `<!DOCTYPE html><html><head><title>Gone</title></head><body style="background:#111;color:#888;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:3rem;margin-bottom:8px">⚡</h1><p>This page has expired or been removed.</p><p style="color:#555;font-size:0.85rem">SparkUI pages are ephemeral by design.</p></div></body></html>`
      );
    }
    html = page.html;
    htmlCache.set(id, html);
  } else {
    // Verify page still exists in store (not expired)
    if (!store.get(id)) {
      htmlCache.delete(id);
      return res.status(410).set('Content-Type', 'text/html').send(
        `<!DOCTYPE html><html><head><title>Gone</title></head><body style="background:#111;color:#888;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:3rem;margin-bottom:8px">⚡</h1><p>This page has expired or been removed.</p><p style="color:#555;font-size:0.85rem">SparkUI pages are ephemeral by design.</p></div></body></html>`
      );
    }
  }

  store.recordView(id);
  const visitorId = req.query._vid || req.headers['x-visitor-id'] || null;
  analytics.recordView(id, visitorId);

  // Replace emojis with Lucide SVG icons and inject base styles
  let finalHtml = sparkuiIcons.replace(html, {
    variant: 'duotone',
    strokeColor: '#ffffff',
    fillColor: '#3b82f6',
    fillOpacity: 0.6,
    colorMap: require('@limeade-labs/sparkui-icons/colors')
  });
  if (finalHtml !== html && !finalHtml.includes('sparkui-icon-wrap')) {
    // Replacement happened but styles might be missing — handled by inline styles
  }
  // Inject sparkui-icons CSS if page has replaced icons and doesn't already include it
  if (finalHtml.includes('sparkui-icon-wrap') && !finalHtml.includes('sparkui-icons-styles')) {
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${SPARKUI_ICONS_STYLE_TAG}</head>`);
    } else if (finalHtml.includes('<body')) {
      finalHtml = finalHtml.replace('<body', `${SPARKUI_ICONS_STYLE_TAG}<body`);
    } else {
      finalHtml = SPARKUI_ICONS_STYLE_TAG + finalHtml;
    }
  }

  res.set('Content-Type', 'text/html').send(finalHtml);
});

/**
 * Prettify a template name for OG defaults.
 */
function prettifyTemplateName(name) {
  if (!name) return 'SparkUI';
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Push API — create a page
app.post('/api/push', requireAuth, async (req, res) => {
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

      // Validate data against template schema
      if (data) {
        const validation = templates.validate(template, data);
        if (!validation.valid) {
          const schema = templates.getSchema(template);
          return res.status(400).json({
            error: 'Data validation failed',
            template,
            validationErrors: validation.errors,
            hint: schema && schema.example ? 'Example data: ' + JSON.stringify(schema.example) : undefined,
          });
        }
      }

      const templateData = { ...data, _pageId: id, _og: ogDefaults };
      finalHtml = templates.render(template, templateData);
    } else {
      finalHtml = html;
    }

    // Enrich meta with template/title
    const enrichedMeta = {
      ...(meta || {}),
      template: template || (meta && meta.template) || null,
      title: (data && data.title) || (meta && meta.title) || null,
      og: ogDefaults,
    };

    // Auto-enable openclaw for interactive templates
    let finalOpenclaw = openclaw || null;
    if (!finalOpenclaw && template && INTERACTIVE_TEMPLATES.has(template)) {
      finalOpenclaw = { enabled: true, eventTypes: ['completion'] };
    }

    const pageOpts = {
      html: finalHtml,
      ttl: ttl || undefined,
      callbackUrl: callbackUrl || null,
      callbackToken: callbackToken || null,
      meta: { ...enrichedMeta, data: data || null },
      openclaw: finalOpenclaw,
    };

    store.set(id, pageOpts);

    // Sync to Redis for persistence
    const pageTtl = ttl || 3600;
    await syncPageToRedis(id, store.get(id), pageTtl);

    // Initialize analytics
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
app.patch('/api/pages/:id', requireAuth, async (req, res) => {
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
    finalHtml = templates.render(page.meta.template, { ...data, _pageId: id });
  }

  if (data && page.meta) {
    page.meta.data = data;
  }

  if (finalHtml) {
    store.update(id, { html: finalHtml, ttl });
    htmlCache.set(id, finalHtml);
  } else if (ttl) {
    store.update(id, { html: page.html, ttl });
  } else if (!finalHtml && !ttl) {
    return res.status(400).json({ error: 'Provide "html", "template" + "data", "data" (for template pages), or "ttl"' });
  }

  // Sync updated page to Redis
  const updatedPage = store.get(id);
  if (updatedPage) {
    await syncPageToRedis(id, updatedPage, ttl || updatedPage.ttl || 3600);
  }

  notifyPageUpdate(id);

  const details = store.getDetails(id);
  res.json(details);
});

// ── Page State REST Endpoints ─────────────────────────────────────────────────

// Save page state
app.post('/api/pages/:id/state', async (req, res) => {
  const { id } = req.params;
  const page = store.get(id);
  if (!page) {
    return res.status(404).json({ error: 'Page not found or expired' });
  }
  const saved = await savePageState(id, req.body);
  if (saved) {
    // Broadcast to WS clients for multi-tab sync
    const clients = pageClients.get(id);
    if (clients) {
      const syncMsg = JSON.stringify({ type: 'state_sync', pageId: id, data: req.body });
      for (const ws of clients) {
        try { ws.send(syncMsg); } catch {}
      }
    }
    res.json({ ok: true, pageId: id });
  } else {
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// Load page state
app.get('/api/pages/:id/state', async (req, res) => {
  const { id } = req.params;
  const page = store.get(id);
  if (!page) {
    return res.status(404).json({ error: 'Page not found or expired' });
  }
  const stateData = await loadPageState(id);
  res.json({ pageId: id, data: stateData });
});

// ── Event REST Endpoints (NEW) ───────────────────────────────────────────────

// POST /api/pages/:id/events — accept events from client via REST
app.post('/api/pages/:id/events', async (req, res) => {
  const { id } = req.params;
  const page = store.get(id);
  if (!page) {
    return res.status(404).json({ error: 'Page not found or expired' });
  }

  const { type, data } = req.body;
  const eventType = type || 'event';

  console.log(`[rest] Event from page ${id}:`, JSON.stringify(data).slice(0, 200));
  analytics.recordInteraction(id, { type: eventType, element: '', data: data || {} });

  try {
    await recordAndQueueEvent(id, eventType, data || {});
    res.json({ ok: true, pageId: id, type: eventType });
  } catch (err) {
    console.error(`[rest] Event error for ${id}:`, err.message);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// GET /api/pages/:id/events — query event history (auth required)
app.get('/api/pages/:id/events', requireAuth, async (req, res) => {
  const { id } = req.params;
  const since = req.query.since || '0-0';
  const count = parseInt(req.query.count, 10) || 100;

  try {
    const events = await redisStore.readEvents(id, since, count);
    res.json({ pageId: id, events, count: events.length });
  } catch (err) {
    console.error(`[rest] Event query error for ${id}:`, err.message);
    res.status(500).json({ error: 'Failed to query events' });
  }
});

// ── Agent Push API (NEW) ─────────────────────────────────────────────────────

// POST /api/pages/:id/push — agent push to live page
app.post('/api/pages/:id/push', requireAuth, async (req, res) => {
  const { id } = req.params;
  const page = store.get(id);
  if (!page) {
    return res.status(404).json({ error: 'Page not found or expired' });
  }

  const { type, data } = req.body;
  if (!type || !['toast', 'slot', 'reload'].includes(type)) {
    return res.status(400).json({ error: 'type must be "toast", "slot", or "reload"' });
  }

  try {
    // Publish via Redis pub/sub for WS delivery
    await redisStore.publishPush(id, { type, data: data || {} });

    // Also send directly to connected WS clients as fallback
    const clients = pageClients.get(id);
    let delivered = 0;
    if (clients) {
      const msg = JSON.stringify({ type: 'push', pageId: id, pushType: type, data: data || {} });
      for (const ws of clients) {
        try { ws.send(msg); delivered++; } catch {}
      }
    }

    res.json({ ok: true, pageId: id, pushType: type, delivered });
  } catch (err) {
    console.error(`[push] Error for ${id}:`, err.message);
    res.status(500).json({ error: 'Failed to push' });
  }
});

// Delete a page
app.delete('/api/pages/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const deleted = store.delete(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Page not found' });
  }
  htmlCache.delete(id);
  notifyPageDestroy(id);

  // Clean up Redis
  try {
    await redisStore.cleanupPage(id);
  } catch (err) {
    console.error(`[redis] Cleanup failed for ${id}:`, err.message);
  }

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

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ── Compose API ──────────────────────────────────────────────────────────────

app.post('/api/compose', requireAuth, async (req, res) => {
  try {
    const layout = req.body;

    if (!layout || !layout.sections || !Array.isArray(layout.sections)) {
      return res.status(400).json({ error: 'Provide a layout with "sections" array' });
    }

    const { html, pushBody } = components.compose(layout);
    const id = uuidv4();
    const finalHtml = html.replace(/__PAGE_ID__/g, id);
    const ttl = layout.ttl || undefined;
    const openclaw = layout.openclaw || null;

    store.set(id, {
      html: finalHtml,
      ttl,
      meta: { title: layout.title || 'Composed', template: 'composed' },
      openclaw,
    });

    const composedTtl = ttl || 3600;
    await syncPageToRedis(id, store.get(id), composedTtl);

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

app.get('/api/analytics', requireAuth, (req, res) => {
  res.json(analytics.getSummary());
});

app.get('/api/analytics/:pageId', requireAuth, (req, res) => {
  const data = analytics.getPage(req.params.pageId);
  if (!data) {
    return res.status(404).json({ error: 'No analytics found for this page' });
  }
  res.json(data);
});

app.post('/api/analytics/beacon', express.json(), (req, res) => {
  const { pageId, type, visitorId, data } = req.body;
  if (!pageId) return res.status(400).json({ error: 'pageId required' });

  switch (type) {
    case 'view': analytics.recordView(pageId, visitorId); break;
    case 'interaction': analytics.recordInteraction(pageId, data || {}); break;
    case 'completion': analytics.recordCompletion(pageId, data || {}); break;
    case 'session': analytics.recordSession(pageId, data || {}); break;
    default: break;
  }
  res.json({ ok: true });
});

// ── Test Echo Endpoint ───────────────────────────────────────────────────────

const echoLog = [];

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

app.get('/api/test/echo', requireAuth, (req, res) => {
  res.json({ entries: echoLog, count: echoLog.length });
});

// ── Start ────────────────────────────────────────────────────────────────────

async function startServer() {
  // Check Redis health
  const redisOk = await redisStore.healthCheck();
  if (redisOk) {
    console.log('⚡ Redis connected');
    // Reload pages from Redis
    await reloadPagesFromRedis();
    // Start delivery worker
    await deliveryWorker.start();
  } else {
    console.warn('⚠️  Redis not available — running in degraded mode (in-memory only)');
  }

  server.listen(PORT, () => {
    console.log(`⚡ SparkUI server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/`);
    console.log(`   Push token: ${PUSH_TOKEN.slice(0, 8)}...${PUSH_TOKEN.slice(-4)}`);
    console.log(`   Templates: ${templates.list().join(', ')}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   Redis: ${redisOk ? 'connected ✓' : 'disconnected ✗ (degraded mode)'}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down...`);
  clearInterval(WS_PING_INTERVAL);

  // Stop delivery worker
  try { await deliveryWorker.stop(); } catch {}

  // Clean up push subscriptions
  for (const [, unsub] of pushUnsubscribers) {
    try { unsub(); } catch {}
  }
  pushUnsubscribers.clear();

  // Disconnect Redis
  try { await redisStore.shutdown(); } catch {}

  server.close(() => {
    store.destroy();
    wss.close();
    console.log('SparkUI stopped.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server };
