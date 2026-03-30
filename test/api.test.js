'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

// Load .env manually (no dotenv dependency)
const fs = require('node:fs');
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

describe('API integration tests', () => {
  let server;

  before(async () => {
    // Import server — it auto-starts via startServer()
    const mod = require('../server');
    server = mod.server;

    // Wait for server to be listening
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

  describe('GET /api/status', () => {
    it('returns healthy status', async () => {
      const res = await request('GET', '/api/status');
      assert.equal(res.status, 200);
      assert.ok(res.body.status === 'ok' || res.body.version);
      assert.ok(res.body.templates, 'Should list templates');
    });
  });

  describe('POST /api/push', () => {
    const templateTests = [
      {
        name: 'poll',
        data: { question: 'API test?', options: ['Yes', 'No'] },
      },
      {
        name: 'shopping-list',
        data: { items: [{ name: 'Eggs' }] },
      },
      {
        name: 'checkout',
        data: { product: { name: 'Book', price: 12.99 } },
      },
      {
        name: 'approval-flow',
        data: { title: 'API Test Request' },
      },
      {
        name: 'feedback-form',
        data: { title: 'API Feedback' },
      },
      {
        name: 'comparison',
        data: { items: [{ name: 'A' }, { name: 'B' }] },
      },
      {
        name: 'calendar',
        data: { date: '2026-03-30', events: [{ title: 'Test', start: '2026-03-30T10:00:00' }] },
      },
      {
        name: 'macro-tracker',
        data: {
          date: '2026-03-30',
          calories: { current: 500, target: 2000 },
          protein: { current: 30, target: 150 },
          fat: { current: 20, target: 65 },
          carbs: { current: 100, target: 250 },
        },
      },
      {
        name: 'workout-timer',
        data: { title: 'Test', exercises: [{ name: 'Run', reps: '1' }] },
      },
      {
        name: 'analytics-dashboard',
        data: { token: PUSH_TOKEN },
      },
      {
        name: 'ws-test',
        data: {},
      },
    ];

    for (const { name, data } of templateTests) {
      it(`creates a ${name} page`, async () => {
        const res = await request('POST', '/api/push', {
          template: name,
          data,
        });
        assert.ok(res.status === 200 || res.status === 201, `Expected 200/201 for ${name}, got ${res.status}: ${JSON.stringify(res.body)}`);
        assert.ok(res.body.id, `Response should have an id for ${name}`);
        assert.ok(res.body.url, `Response should have a url for ${name}`);
      });
    }
  });

  describe('GET /api/pages/:id', () => {
    let pageId;

    before(async () => {
      const res = await request('POST', '/api/push', {
        template: 'poll',
        data: { question: 'Page detail test?', options: ['A', 'B'] },
      });
      pageId = res.body.id;
    });

    it('returns page details', async () => {
      const res = await request('GET', `/api/pages/${pageId}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.id || res.body.template, 'Should return page info');
    });

    it('returns 404 for non-existent page', async () => {
      const res = await request('GET', '/api/pages/non-existent-id-12345');
      assert.equal(res.status, 404);
    });
  });

  describe('Page rendering at /s/:id', () => {
    let pageId;

    before(async () => {
      const res = await request('POST', '/api/push', {
        template: 'feedback-form',
        data: { title: 'Render Test' },
      });
      pageId = res.body.id;
    });

    it('renders the page HTML', async () => {
      const res = await request('GET', `/s/${pageId}`);
      assert.equal(res.status, 200);
      assert.ok(typeof res.raw === 'string');
      assert.ok(res.raw.includes('<!DOCTYPE html>') || res.raw.includes('Render Test'),
        'Should return rendered HTML');
    });
  });

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
