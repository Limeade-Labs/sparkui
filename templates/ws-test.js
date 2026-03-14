'use strict';

const base = require('./base');

/**
 * WebSocket test/demo template.
 * Tests all WS bridge features: events, completion, status, server messages.
 */
function wsTest(data = {}) {
  const pageId = data._pageId || 'unknown';
  const _og = data._og || {};

  const body = `
    <h1 style="font-size:1.5rem;margin-bottom:8px">⚡ SparkUI WebSocket Test</h1>
    <p style="color:#888;margin-bottom:24px">Page ID: <code style="color:#6cf">${pageId}</code></p>

    <!-- Connection Status -->
    <div id="status" style="padding:12px;border-radius:8px;margin-bottom:20px;background:#1a1a1a;border:1px solid #333">
      <span id="status-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f44;margin-right:8px;vertical-align:middle"></span>
      <span id="status-text" style="vertical-align:middle">Connecting...</span>
    </div>

    <!-- Test Buttons -->
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <button id="btn-click" style="padding:10px 20px;border-radius:6px;border:none;background:#2563eb;color:#fff;font-size:1rem;cursor:pointer;flex:1;min-width:120px">
        🖱️ Send Click Event
      </button>
      <button id="btn-custom" style="padding:10px 20px;border-radius:6px;border:none;background:#7c3aed;color:#fff;font-size:1rem;cursor:pointer;flex:1;min-width:120px">
        ⚡ Send Custom Event
      </button>
    </div>

    <!-- Form -->
    <form id="test-form" style="background:#1a1a1a;padding:16px;border-radius:8px;margin-bottom:20px;border:1px solid #333">
      <h3 style="margin-bottom:12px;font-size:1rem">📋 Test Form (sends completion)</h3>
      <label style="display:block;margin-bottom:8px;color:#aaa;font-size:0.9rem">Name</label>
      <input id="form-name" type="text" placeholder="Enter name" style="width:100%;padding:8px 12px;border-radius:4px;border:1px solid #444;background:#222;color:#eee;font-size:1rem;margin-bottom:12px">
      <label style="display:block;margin-bottom:8px;color:#aaa;font-size:0.9rem">Rating</label>
      <select id="form-rating" style="width:100%;padding:8px 12px;border-radius:4px;border:1px solid #444;background:#222;color:#eee;font-size:1rem;margin-bottom:16px">
        <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
        <option value="4">⭐⭐⭐⭐ Good</option>
        <option value="3">⭐⭐⭐ OK</option>
        <option value="2">⭐⭐ Poor</option>
        <option value="1">⭐ Bad</option>
      </select>
      <button type="submit" style="width:100%;padding:10px;border-radius:6px;border:none;background:#059669;color:#fff;font-size:1rem;cursor:pointer">
        ✅ Submit (sends completion)
      </button>
    </form>

    <!-- Message Log -->
    <div style="background:#1a1a1a;padding:16px;border-radius:8px;border:1px solid #333">
      <h3 style="margin-bottom:12px;font-size:1rem">📨 Message Log</h3>
      <div id="log" style="font-family:monospace;font-size:0.85rem;max-height:300px;overflow-y:auto">
        <div style="color:#555">Waiting for messages...</div>
      </div>
    </div>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var log = document.getElementById('log');
      var statusDot = document.getElementById('status-dot');
      var statusText = document.getElementById('status-text');

      function addLog(msg, color) {
        var div = document.createElement('div');
        div.style.cssText = 'padding:4px 0;border-bottom:1px solid #222;color:' + (color || '#ccc');
        var time = new Date().toLocaleTimeString();
        div.textContent = '[' + time + '] ' + msg;
        if (log.firstChild && log.firstChild.textContent === 'Waiting for messages...') {
          log.innerHTML = '';
        }
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
      }

      // Connection status
      document.addEventListener('sparkui:status', function(e) {
        var s = e.detail.status;
        statusText.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        statusDot.style.background = s === 'connected' ? '#4ade80' : '#f44';
        addLog('Status: ' + s, s === 'connected' ? '#4ade80' : '#f44');
      });

      // Listen for server messages
      if (window.sparkui) {
        sparkui.onMessage(function(msg) {
          addLog('← Server: ' + JSON.stringify(msg), '#6cf');
        });
      }

      // Button: click event
      document.getElementById('btn-click').addEventListener('click', function() {
        sparkui.send('event', { action: 'click', button: 'test', timestamp: Date.now() });
        addLog('→ Sent click event', '#fbbf24');
      });

      // Button: custom event
      document.getElementById('btn-custom').addEventListener('click', function() {
        sparkui.send('event', { action: 'custom', value: Math.random().toString(36).slice(2, 8) });
        addLog('→ Sent custom event', '#c084fc');
      });

      // Form: completion
      document.getElementById('test-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = {
          name: document.getElementById('form-name').value,
          rating: document.getElementById('form-rating').value,
        };
        sparkui.sendCompletion({ formData: formData, completedAt: Date.now() });
        addLog('→ Sent completion: ' + JSON.stringify(formData), '#34d399');
      });
    });
    </script>
  `;

  const og = {
    title: _og.title || 'WebSocket Test',
    description: _og.description || 'SparkUI WebSocket connectivity test ⚡',
    image: _og.image,
    url: _og.url,
  };

  return base({
    title: 'SparkUI WS Test',
    body,
    id: pageId,
    extraHead,
    og,
  });
}

module.exports = wsTest;
