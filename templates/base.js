'use strict';

const { getClientScript } = require('../lib/ws-client');

/**
 * Base HTML template wrapper.
 * Dark theme, responsive, mobile-friendly, includes full WS client with sparkui API.
 *
 * @param {object} opts
 * @param {string} opts.title - Page title
 * @param {string} opts.body - Inner HTML body content
 * @param {string} [opts.id] - Page ID for WebSocket connection
 * @param {number} [opts.refreshSeconds] - Auto-refresh interval (0 to disable)
 * @param {string} [opts.extraHead] - Extra tags for <head>
 * @param {object} [opts.og] - Open Graph metadata { title, description, image, url }
 * @returns {string} Full HTML document
 */
function base({ title = 'SparkUI', body = '', id = '', refreshSeconds = 0, extraHead = '', og = {} } = {}) {
  const refreshMeta = refreshSeconds > 0
    ? `<meta http-equiv="refresh" content="${refreshSeconds}">`
    : '';

  const wsScript = id ? `<script>${getClientScript(id)}</script>` : '';

  // Analytics tracking script — injected on every page with an ID
  const analyticsScript = id ? `<script>
(function(){
  var pageId = ${JSON.stringify(id)};

  // Simple visitor fingerprint (UA + screen size hash, no cookies)
  function fingerprint() {
    var s = (navigator.userAgent || '') + screen.width + 'x' + screen.height + (screen.colorDepth || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return 'v' + Math.abs(h).toString(36);
  }

  var vid = fingerprint();
  var sessionStart = Date.now();
  var interactionCount = 0;
  var useWS = typeof window.sparkui !== 'undefined';

  function send(type, data) {
    if (useWS && window.sparkui && window.sparkui.connected) {
      try {
        window.sparkui.send('analytics_' + type, data);
        return;
      } catch(e) {}
    }
    // Fallback: beacon API
    try {
      var payload = JSON.stringify({ pageId: pageId, type: type, visitorId: vid, data: data });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/beacon', new Blob([payload], { type: 'application/json' }));
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/analytics/beacon', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
      }
    } catch(e) {}
  }

  // Send view on load
  setTimeout(function() {
    useWS = typeof window.sparkui !== 'undefined' && window.sparkui.connected;
    if (useWS && window.sparkui) {
      try {
        var ws = window.sparkui;
        // Send view via WS with visitorId at top level
        var raw = JSON.stringify({ type: 'analytics_view', pageId: pageId, visitorId: vid, timestamp: Date.now() });
        // Access internal send — fallback to beacon
        send('view', { visitorId: vid });
      } catch(e) {
        send('view', { visitorId: vid });
      }
    } else {
      send('view', { visitorId: vid });
    }
  }, 500);

  // Track interactions (clicks, submits, changes) inside .sparkui-container
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (!t.closest || !t.closest('.sparkui-container')) return;
    var tag = t.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || t.type === 'submit' || t.role === 'button') {
      interactionCount++;
      send('interaction', { type: 'click', element: tag + (t.className ? '.' + t.className.split(' ')[0] : ''), data: { text: (t.textContent || '').slice(0, 50) } });
    }
  }, true);

  document.addEventListener('submit', function(e) {
    interactionCount++;
    send('interaction', { type: 'submit', element: 'form', data: { id: e.target.id || '' } });
    send('completion', { type: 'form_submit', data: { formId: e.target.id || '' } });
  }, true);

  document.addEventListener('change', function(e) {
    var t = e.target;
    if (!t.closest || !t.closest('.sparkui-container')) return;
    var tag = t.tagName.toLowerCase();
    if (t.type === 'checkbox' || t.type === 'radio' || tag === 'select') {
      interactionCount++;
      send('interaction', { type: 'change', element: tag + '[' + (t.type || '') + ']', data: { name: t.name || '' } });
    }
  }, true);

  // Heartbeat every 30s for time tracking
  var heartbeatTimer = setInterval(function() {
    // Just keep session alive — actual duration sent on unload
  }, 30000);

  // Send session data on page unload
  function endSession() {
    var duration = Math.round((Date.now() - sessionStart) / 1000);
    send('session', { visitorId: vid, duration: duration, interactions: interactionCount });
  }

  window.addEventListener('beforeunload', endSession);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') endSession();
  });
})();
</script>` : '';

  // Open Graph meta tags
  const ogTitle = og.title || title || 'SparkUI';
  const ogDescription = og.description || 'An ephemeral micro-app powered by SparkUI ⚡';
  const ogUrl = og.url || '';
  const ogImage = og.image || '';

  const ogTags = `
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:type" content="website" />
  ${ogUrl ? `<meta property="og:url" content="${ogUrl}" />` : ''}
  ${ogImage ? `<meta property="og:image" content="${ogImage}" />` : ''}
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  ${ogImage ? `<meta name="twitter:image" content="${ogImage}" />` : ''}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  ${refreshMeta}
  <title>${title}</title>
  ${ogTags}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #111;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .sparkui-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px 16px;
    }
    @media (min-width: 768px) {
      .sparkui-container { padding: 32px 24px; }
    }
  </style>
  ${extraHead}
</head>
<body>
  <div class="sparkui-container">
    ${body}
  </div>
  ${wsScript}
  ${analyticsScript}
</body>
</html>`;
}

module.exports = base;
