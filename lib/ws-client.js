'use strict';

/**
 * Client-side WebSocket code for SparkUI pages.
 * Exported as a string so it can be inlined into HTML templates.
 * No external dependencies.
 */

const WS_CLIENT_JS = `
(function() {
  'use strict';

  var pageId = window.__SPARKUI_PAGE_ID__;
  if (!pageId) return;

  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = proto + '//' + location.host + '/ws?page=' + encodeURIComponent(pageId);

  var ws = null;
  var reconnectDelay = 1000;
  var maxReconnectDelay = 30000;
  var heartbeatTimer = null;
  var connected = false;
  var messageHandlers = [];
  var pendingQueue = [];
  var completionData = {};

  // ── Connection Management ──

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

    try { ws = new WebSocket(wsUrl); } catch(e) { scheduleReconnect(); return; }

    ws.onopen = function() {
      connected = true;
      reconnectDelay = 1000;
      startHeartbeat();
      dispatchStatus('connected');

      // Flush pending messages
      while (pendingQueue.length > 0) {
        var msg = pendingQueue.shift();
        try { ws.send(msg); } catch(e) {}
      }
    };

    ws.onmessage = function(e) {
      try {
        var msg = JSON.parse(e.data);
      } catch(err) { return; }

      // Handle built-in message types
      if (msg.type === 'update') {
        location.reload();
        return;
      }

      if (msg.type === 'destroy') {
        stopHeartbeat();
        document.body.innerHTML = '<div style="background:#111;color:#888;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:3rem;margin-bottom:8px">⚡</h1><p>This page has expired or been removed.</p><p style="color:#555;font-size:0.85rem">SparkUI pages are ephemeral by design.</p></div></div>';
        return;
      }

      if (msg.type === 'pong') {
        // Server heartbeat response, connection is alive
        return;
      }

      // Dispatch to registered handlers
      for (var i = 0; i < messageHandlers.length; i++) {
        try { messageHandlers[i](msg); } catch(err) { console.error('[sparkui] handler error:', err); }
      }
    };

    ws.onclose = function() {
      connected = false;
      stopHeartbeat();
      dispatchStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = function() {
      // onclose will fire after this
    };
  }

  function scheduleReconnect() {
    setTimeout(function() {
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }

  // ── Heartbeat ──

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'heartbeat' })); } catch(e) {}
      }
    }, 25000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  // ── Send Messages ──

  function send(type, data) {
    var msg = JSON.stringify({ type: type, pageId: pageId, data: data || {}, timestamp: Date.now() });
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(msg); } catch(e) { pendingQueue.push(msg); }
    } else {
      pendingQueue.push(msg);
    }
  }

  // ── Event Handlers ──

  function onMessage(handler) {
    if (typeof handler === 'function') messageHandlers.push(handler);
  }

  function offMessage(handler) {
    messageHandlers = messageHandlers.filter(function(h) { return h !== handler; });
  }

  // ── Status Dispatch ──

  function dispatchStatus(status) {
    var event;
    try {
      event = new CustomEvent('sparkui:status', { detail: { status: status, pageId: pageId } });
    } catch(e) {
      event = document.createEvent('CustomEvent');
      event.initCustomEvent('sparkui:status', true, true, { status: status, pageId: pageId });
    }
    document.dispatchEvent(event);
  }

  // ── Completion on Unload ──

  function setCompletionData(data) {
    completionData = data || {};
  }

  function sendCompletion(data) {
    var payload = data || completionData;
    send('completion', payload);
  }

  // Send completion on page unload
  window.addEventListener('beforeunload', function() {
    if (ws && ws.readyState === WebSocket.OPEN && Object.keys(completionData).length > 0) {
      // Use sendBeacon-style: just try to send, no guarantee
      try { ws.send(JSON.stringify({ type: 'completion', pageId: pageId, data: completionData, timestamp: Date.now() })); } catch(e) {}
    }
  });

  // ── Public API ──

  window.sparkui = {
    send: send,
    onMessage: onMessage,
    offMessage: offMessage,
    setCompletionData: setCompletionData,
    sendCompletion: sendCompletion,
    get connected() { return connected; },
    get pageId() { return pageId; }
  };

  // Auto-connect
  connect();
})();
`;

/**
 * Get the client JS with pageId injected.
 * @param {string} pageId
 * @returns {string} Script tag content
 */
function getClientScript(pageId) {
  return WS_CLIENT_JS.replace('window.__SPARKUI_PAGE_ID__', JSON.stringify(pageId));
}

/**
 * Get the raw client JS string (for manual injection).
 * @returns {string}
 */
function getRawClientJS() {
  return WS_CLIENT_JS;
}

module.exports = { getClientScript, getRawClientJS };
