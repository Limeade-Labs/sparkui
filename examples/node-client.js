/**
 * node-client.js — Node.js client that pushes a page and listens for events via WebSocket
 *
 * Usage:
 *   export SPARKUI_TOKEN="your-push-token"
 *   export SPARKUI_URL="http://localhost:3457"  # optional
 *   node examples/node-client.js
 *
 * Requires: Node.js 18+ (uses built-in fetch and WebSocket)
 *   For Node < 21, install ws: npm install ws
 */

const SPARKUI_URL = process.env.SPARKUI_URL || 'http://localhost:3457';
const SPARKUI_TOKEN = process.env.SPARKUI_TOKEN;

if (!SPARKUI_TOKEN) {
  console.error('❌ Set SPARKUI_TOKEN environment variable');
  process.exit(1);
}

// Use built-in WebSocket (Node 21+) or fall back to 'ws' package
let WebSocket;
try {
  WebSocket = globalThis.WebSocket || require('ws');
} catch {
  console.error('❌ WebSocket not available. Use Node 21+ or install ws: npm install ws');
  process.exit(1);
}

async function main() {
  // ── 1. Push a checkout page ──
  console.log('⚡ Pushing a checkout page...\n');

  const res = await fetch(`${SPARKUI_URL}/api/push`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SPARKUI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template: 'checkout',
      data: {
        product: {
          name: 'SparkUI Pro',
          description: 'Unlimited ephemeral UIs for your AI agents',
          price: 29.99,
          image: '⚡',
        },
      },
      ttl: 600, // 10 minutes
    }),
  });

  if (!res.ok) {
    console.error(`❌ Push failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const page = await res.json();
  console.log(`✅ Page created!`);
  console.log(`   ID:  ${page.id}`);
  console.log(`   URL: ${page.fullUrl}`);
  console.log(`\n📡 Listening for events via WebSocket...\n`);

  // ── 2. Connect via WebSocket to receive user actions ──
  const wsUrl = SPARKUI_URL.replace(/^http/, 'ws') + `/ws?page=${page.id}`;
  const ws = new WebSocket(wsUrl);

  ws.addEventListener('open', () => {
    console.log('🔌 WebSocket connected');
  });

  ws.addEventListener('message', (event) => {
    const data = typeof event.data === 'string' ? event.data : event.data.toString();
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      console.log('📨 Raw message:', data);
      return;
    }

    switch (msg.type) {
      case 'pong':
        // Heartbeat response — ignore
        break;
      case 'event':
        console.log('🎯 Event received:', JSON.stringify(msg.data, null, 2));
        break;
      case 'completion':
        console.log('✅ Completion received:', JSON.stringify(msg.data, null, 2));
        console.log('\n🎉 User completed the checkout! Cleaning up...');
        cleanup(page.id);
        break;
      case 'update':
        console.log('🔄 Page updated');
        break;
      case 'destroy':
        console.log('💥 Page destroyed');
        ws.close();
        process.exit(0);
        break;
      default:
        console.log(`📨 ${msg.type}:`, JSON.stringify(msg.data || msg, null, 2));
    }
  });

  ws.addEventListener('close', () => {
    console.log('🔌 WebSocket disconnected');
  });

  ws.addEventListener('error', (err) => {
    console.error('❌ WebSocket error:', err.message || err);
  });

  // ── 3. Heartbeat to keep connection alive ──
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }, 25000);

  // ── Cleanup helper ──
  async function cleanup(pageId) {
    clearInterval(heartbeat);
    // Optionally delete the page after completion
    await fetch(`${SPARKUI_URL}/api/pages/${pageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SPARKUI_TOKEN}` },
    });
    console.log('🧹 Page deleted');
    ws.close();
    process.exit(0);
  }

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    cleanup(page.id);
  });
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
