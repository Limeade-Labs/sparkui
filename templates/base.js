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
</body>
</html>`;
}

module.exports = base;
