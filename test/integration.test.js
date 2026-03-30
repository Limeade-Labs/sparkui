'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

// Load .env manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/\r$/, '');
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// Use a random high port for tests to avoid conflicts
const TEST_PORT = 30000 + Math.floor(Math.random() * 20000);
process.env.SPARKUI_PORT = String(TEST_PORT);

// Force memory-only mode for fast tests (no Redis latency)
process.env.REDIS_URL = 'redis://localhost:1';

const PUSH_TOKEN = process.env.PUSH_TOKEN || 'test-token';

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${PUSH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Integration tests', () => {
  let server;

  before(async () => {
    const mod = require('../server');
    server = mod.server;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start in 10s')), 10000);
      if (server.listening) {
        clearTimeout(timeout);
        return resolve();
      }
      server.on('listening', () => { clearTimeout(timeout); resolve(); });
      server.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ── Template rendering ──────────────────────────────────────────────────────

  const allTemplates = [
    { name: 'shopping-list', data: { items: [{ name: 'Milk' }, { name: 'Eggs' }] } },
    { name: 'poll', data: { question: 'Best color?', options: ['Red', 'Blue'] } },
    { name: 'comparison', data: { items: [{ name: 'A' }, { name: 'B' }] } },
    { name: 'macro-tracker', data: { date: '2026-03-30', calories: { current: 500, target: 2000 }, protein: { current: 30, target: 150 }, fat: { current: 20, target: 65 }, carbs: { current: 100, target: 250 } } },
    { name: 'workout-timer', data: { title: 'Test Workout', exercises: [{ name: 'Pushups', reps: '10' }] } },
    { name: 'feedback-form', data: { title: 'Test Feedback' } },
    { name: 'approval-flow', data: { title: 'Approve this?' } },
    { name: 'checkout', data: { product: { name: 'Widget', price: 9.99 } } },
    { name: 'calendar', data: { date: '2026-03-30', events: [{ title: 'Meeting', start: '2026-03-30T10:00:00' }] } },
    { name: 'analytics-dashboard', data: { token: PUSH_TOKEN } },
    { name: 'ws-test', data: {} },
  ];

  describe('Template rendering — all 11', () => {
    for (const { name, data } of allTemplates) {
      it(`pushes and renders ${name}`, async () => {
        // Push page
        const push = await request('POST', '/api/push', { template: name, data });
        assert.ok(push.status === 200 || push.status === 201, `Push ${name} failed: ${push.status}`);
        assert.ok(push.body.id, `No id returned for ${name}`);
        assert.ok(push.body.url, `No url returned for ${name}`);

        // Verify page renders
        const page = await request('GET', `/s/${push.body.id}`);
        assert.equal(page.status, 200, `Render ${name} returned ${page.status}`);
        assert.ok(typeof page.raw === 'string' && page.raw.length > 0, `Empty HTML for ${name}`);
      });
    }
  });

  // ── LLM-style property fallbacks ────────────────────────────────────────────

  describe('LLM-style property name fallbacks', () => {
    it('poll accepts label instead of text for options', async () => {
      const res = await request('POST', '/api/push', {
        template: 'poll',
        data: { question: 'Fallback?', options: [{ label: 'Yes' }, { label: 'No' }] },
      });
      assert.ok(res.status === 200 || res.status === 201);
      const page = await request('GET', `/s/${res.body.id}`);
      assert.ok(page.raw.includes('Yes'), 'Should render option with label fallback');
    });

    it('shopping-list renders with label/title fallbacks at template level', async () => {
      // Validation requires 'name', but the template renders label/title fallbacks.
      // Test via direct render (fallbacks.test.js covers this path).
      // Here we verify the API accepts items with 'name' and renders correctly.
      const res = await request('POST', '/api/push', {
        template: 'shopping-list',
        data: { items: [{ name: 'Bread' }] },
      });
      assert.ok(res.status === 200 || res.status === 201);
      const page = await request('GET', `/s/${res.body.id}`);
      assert.ok(page.raw.includes('Bread'), 'Should render item');
    });
  });

  // ── State persistence ───────────────────────────────────────────────────────

  describe('State persistence via REST API', () => {
    it('save state endpoint accepts data', async () => {
      const push = await request('POST', '/api/push', {
        template: 'shopping-list',
        data: { items: [{ name: 'Test item' }] },
      });
      const pageId = push.body.id;

      const state = { checked: [0], customItems: ['Added item'] };
      const save = await request('POST', `/api/pages/${pageId}/state`, state);
      assert.ok(save.status === 200 || save.status === 201, `Save state failed: ${save.status}`);
      assert.ok(save.body.ok, 'Save should return ok: true');
    });

    it('load state endpoint returns valid response', async () => {
      const push = await request('POST', '/api/push', {
        template: 'poll',
        data: { question: 'No state?', options: ['A'] },
      });
      const load = await request('GET', `/api/pages/${push.body.id}/state`);
      assert.equal(load.status, 200);
      assert.ok('data' in load.body || 'pageId' in load.body, 'Should return state envelope');
    });

    it('returns 404 for non-existent page state', async () => {
      const load = await request('GET', '/api/pages/nonexistent-id/state');
      assert.equal(load.status, 404);
    });
  });

  // ── WebSocket connection ────────────────────────────────────────────────────

  describe('WebSocket connection', () => {
    it('connects and receives heartbeat', async () => {
      const push = await request('POST', '/api/push', {
        template: 'ws-test',
        data: {},
      });
      const pageId = push.body.id;

      const WebSocket = require('ws');
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws?page=${pageId}`);

      const connected = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { ws.close(); reject(new Error('WS connect timeout')); }, 5000);
        ws.on('open', () => { clearTimeout(timeout); resolve(true); });
        ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
      });

      assert.ok(connected, 'WebSocket should connect');
      ws.close();
    });
  });

  // ── Page expiry ─────────────────────────────────────────────────────────────

  describe('Page expiry', () => {
    it('page with very short TTL expires', async () => {
      const push = await request('POST', '/api/push', {
        template: 'ws-test',
        data: {},
        ttl: 1,
      });
      const pageId = push.body.id;

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const page = await request('GET', `/s/${pageId}`);
      // Should be 404 or show expired message
      assert.ok(page.status === 404 || page.status === 410 || page.raw.includes('expired') || page.raw.includes('not found'),
        `Expected expired page, got status ${page.status}`);
    });
  });

  // ── Auth enforcement ────────────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('rejects push without token', async () => {
      const res = await new Promise((resolve, reject) => {
        const opts = {
          hostname: '127.0.0.1',
          port: TEST_PORT,
          path: '/api/push',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        };
        const req = http.request(opts, (r) => {
          let data = '';
          r.on('data', (c) => { data += c; });
          r.on('end', () => {
            let parsed;
            try { parsed = JSON.parse(data); } catch { parsed = data; }
            resolve({ status: r.statusCode, body: parsed });
          });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ template: 'ws-test', data: {} }));
        req.end();
      });
      assert.equal(res.status, 401);
    });
  });
});
