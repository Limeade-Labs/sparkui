'use strict';

/**
 * Client-side WebSocket + REST code for SparkUI pages.
 * v1.1 — REST-first with WS as real-time bonus.
 * Exported as a string so it can be inlined into HTML templates.
 * No external dependencies.
 */

const WS_CLIENT_JS = `
(function() {
  'use strict';

  var pageId = window.__SPARKUI_PAGE_ID__;
  if (!pageId) return;

  var baseUrl = location.origin;
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
  var offlineEventQueue = [];
  var LS_STATE_KEY = 'sparkui_state_' + pageId;
  var LS_EVENTS_KEY = 'sparkui_events_' + pageId;

  // ── Offline Event Queue ──

  function persistOfflineQueue() {
    try {
      localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(offlineEventQueue));
    } catch(e) {}
  }

  function loadOfflineQueue() {
    try {
      var raw = localStorage.getItem(LS_EVENTS_KEY);
      if (raw) {
        offlineEventQueue = JSON.parse(raw);
      }
    } catch(e) {}
  }

  function flushOfflineQueue() {
    if (offlineEventQueue.length === 0) return;
    var queue = offlineEventQueue.splice(0);
    localStorage.removeItem(LS_EVENTS_KEY);
    queue.forEach(function(item) {
      postEvent(item.type, item.data);
    });
  }

  // ── REST Helpers ──

  function postJson(path, body) {
    return fetch(baseUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json(); });
  }

  function getJson(path) {
    return fetch(baseUrl + path).then(function(r) { return r.json(); });
  }

  // ── Connection Management ──

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

    try { ws = new WebSocket(wsUrl); } catch(e) { scheduleReconnect(); return; }

    ws.onopen = function() {
      connected = true;
      reconnectDelay = 1000;
      startHeartbeat();
      dispatchStatus('connected');

      // Flush WS pending messages
      while (pendingQueue.length > 0) {
        var msg = pendingQueue.shift();
        try { ws.send(msg); } catch(e) {}
      }

      // Flush offline event queue via REST
      flushOfflineQueue();
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
        return;
      }

      // Handle agent push messages
      if (msg.type === 'push') {
        handlePush(msg);
        return;
      }

      // Handle state sync from other tabs
      if (msg.type === 'state_sync') {
        try {
          localStorage.setItem(LS_STATE_KEY, JSON.stringify({
            data: msg.data,
            updatedAt: Date.now()
          }));
        } catch(e) {}
        // Dispatch to handlers so app can react
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

    ws.onerror = function() {};
  }

  function scheduleReconnect() {
    setTimeout(function() {
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }

  // ── Agent Push Handler ──

  function handlePush(msg) {
    var pushType = msg.pushType || (msg.data && msg.data.type) || msg.type;
    var pushData = msg.data || {};

    switch (pushType) {
      case 'toast':
        showToast(pushData.message || pushData.text || 'Notification', pushData.duration || 5000);
        break;
      case 'slot':
        if (pushData.selector && pushData.html !== undefined) {
          var el = document.querySelector(pushData.selector);
          if (el) el.innerHTML = pushData.html;
        }
        break;
      case 'reload':
        location.reload();
        break;
    }

    // Dispatch to handlers too
    for (var i = 0; i < messageHandlers.length; i++) {
      try { messageHandlers[i](msg); } catch(err) {}
    }
  }

  function showToast(message, duration) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#333;color:#fff;padding:12px 20px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s;max-width:350px;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, duration || 5000);
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

  // ── Send Messages (WS) ──

  function wsSend(type, data) {
    var msg = JSON.stringify({ type: type, pageId: pageId, data: data || {}, timestamp: Date.now() });
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(msg); } catch(e) { if (pendingQueue.length < 1000) pendingQueue.push(msg); }
    } else {
      if (pendingQueue.length < 1000) {
        pendingQueue.push(msg);
      }
    }
  }

  // ── Event Emission (REST-first) ──

  function postEvent(type, data) {
    return postJson('/api/pages/' + pageId + '/events', { type: type || 'event', data: data || {} })
      .then(function(result) {
        // Also send via WS for real-time multi-tab awareness
        wsSend(type || 'event', data);
        return result;
      })
      .catch(function(err) {
        console.warn('[sparkui] REST event failed, queuing:', err.message || err);
        if (offlineEventQueue.length < 100) {
          offlineEventQueue.push({ type: type || 'event', data: data || {}, timestamp: Date.now() });
        }
        persistOfflineQueue();
        // Try WS as fallback
        wsSend(type || 'event', data);
      });
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

  // ── Completion ──

  function setCompletionData(data) {
    completionData = data || {};
  }

  function sendCompletion(data) {
    var payload = data || completionData;
    // REST-first for completion (critical path)
    postEvent('completion', payload);
  }

  window.addEventListener('beforeunload', function() {
    if (Object.keys(completionData).length > 0) {
      // Use sendBeacon for reliable delivery on unload
      try {
        navigator.sendBeacon(
          baseUrl + '/api/pages/' + pageId + '/events',
          new Blob([JSON.stringify({ type: 'completion', data: completionData })], { type: 'application/json' })
        );
      } catch(e) {
        // Fallback to WS
        if (ws && ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'completion', pageId: pageId, data: completionData, timestamp: Date.now() })); } catch(e2) {}
        }
      }
    }
  });

  // ── State Persistence (REST-first with localStorage cache) ──

  var saveStateTimer = null;
  var stateLoadedCallbacks = [];

  /**
   * Save state — writes to localStorage immediately, then POSTs to server.
   * Also sends via WS for real-time multi-tab sync.
   */
  function saveState(state) {
    // Write-through to localStorage (instant)
    try {
      localStorage.setItem(LS_STATE_KEY, JSON.stringify({
        data: state,
        updatedAt: Date.now()
      }));
    } catch(e) {}

    // Debounced POST to server
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(function() {
      postJson('/api/pages/' + pageId + '/state', state)
        .then(function() {
          // Also send via WS for multi-tab sync
          wsSend('save_state', state);
        })
        .catch(function(err) {
          console.warn('[sparkui] State save REST failed:', err.message || err);
          // WS fallback
          wsSend('save_state', state);
        });
    }, 500);
  }

  /**
   * Load state — checks localStorage first, then fetches from REST.
   * Uses whichever has the later timestamp.
   */
  function loadState() {
    return new Promise(function(resolve) {
      var localState = null;
      var localTs = 0;

      // Check localStorage
      try {
        var raw = localStorage.getItem(LS_STATE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          localState = parsed.data;
          localTs = parsed.updatedAt || 0;
        }
      } catch(e) {}

      // Fetch from REST (primary source of truth)
      getJson('/api/pages/' + pageId + '/state')
        .then(function(result) {
          var serverData = result.data;
          if (serverData === null && localState !== null) {
            // Server has no state but localStorage does — use local
            resolve(localState);
          } else if (serverData !== null) {
            // Server has state — use it (it's the source of truth)
            // Also update localStorage
            try {
              localStorage.setItem(LS_STATE_KEY, JSON.stringify({
                data: serverData,
                updatedAt: Date.now()
              }));
            } catch(e) {}
            resolve(serverData);
          } else {
            resolve(null);
          }
          // Fire callbacks (one-shot)
          var data = serverData || localState || null;
          stateLoadedCallbacks.forEach(function(cb) { try { cb(data); } catch(e) {} });
          stateLoadedCallbacks.length = 0;
        })
        .catch(function(err) {
          console.warn('[sparkui] State load REST failed, using localStorage:', err.message || err);
          resolve(localState);
          stateLoadedCallbacks.forEach(function(cb) { try { cb(localState); } catch(e) {} });
          stateLoadedCallbacks.length = 0;
        });
    });
  }

  function onStateLoaded(callback) {
    if (typeof callback === 'function') stateLoadedCallbacks.push(callback);
  }

  // Listen for state responses from WS (for multi-tab sync)
  onMessage(function(msg) {
    if (msg.type === 'state' || msg.type === 'state_sync') {
      var data = msg.data !== undefined ? msg.data : null;
      if (data !== null) {
        try {
          localStorage.setItem(LS_STATE_KEY, JSON.stringify({
            data: data,
            updatedAt: Date.now()
          }));
        } catch(e) {}
      }
    }
  });

  // ── Init ──

  loadOfflineQueue();

  // ── Public API ──

  window.sparkui = {
    send: function(type, data) { return postEvent(type, data); },
    wsSend: wsSend,
    onMessage: onMessage,
    offMessage: offMessage,
    setCompletionData: setCompletionData,
    sendCompletion: sendCompletion,
    saveState: saveState,
    loadState: loadState,
    onStateLoaded: onStateLoaded,
    showToast: showToast,
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
