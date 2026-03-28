'use strict';

const base = require('./base');

/**
 * Analytics Dashboard Template
 * Shows real-time analytics for a specific page or all pages.
 *
 * Data shape:
 * {
 *   pageId: string (optional — if omitted, shows all pages),
 *   token: string (push token for API auth),
 *   title: string (optional),
 *   _pageId: string (SparkUI page ID),
 *   _og: object
 * }
 */
function analyticsDashboard(data = {}) {
  const { pageId, token, title, _pageId, _og } = data;
  const dashTitle = title || (pageId ? `Analytics: ${pageId.slice(0, 8)}…` : 'SparkUI Analytics');

  const body = `
    <div id="analytics-root">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <h1 style="font-size:1.5rem;font-weight:700;color:#00ff88;">⚡ ${dashTitle}</h1>
        <span id="live-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#555;" title="Connection status"></span>
      </div>

      <!-- Summary Cards -->
      <div id="summary-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px;">
        <div class="stat-card"><div class="stat-value" id="stat-views">—</div><div class="stat-label">Views</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-unique">—</div><div class="stat-label">Unique</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-time">—</div><div class="stat-label">Avg Time</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-interactions">—</div><div class="stat-label">Interactions</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-completions">—</div><div class="stat-label">Completions</div></div>
        <div class="stat-card"><div class="stat-value" id="stat-rate">—</div><div class="stat-label">Completion %</div></div>
      </div>

      <!-- Interaction Types Chart -->
      <div id="chart-section" style="margin-bottom:24px;">
        <h2 style="font-size:1rem;color:#888;margin-bottom:12px;">Interactions by Type</h2>
        <div id="interaction-chart" style="min-height:60px;"></div>
      </div>

      <!-- Pages Table (summary mode) -->
      <div id="pages-section" style="margin-bottom:24px;display:none;">
        <h2 style="font-size:1rem;color:#888;margin-bottom:12px;">Pages</h2>
        <div id="pages-table" style="overflow-x:auto;"></div>
      </div>

      <!-- Recent Activity -->
      <div id="activity-section">
        <h2 style="font-size:1rem;color:#888;margin-bottom:12px;">Recent Activity</h2>
        <div id="activity-feed" style="max-height:300px;overflow-y:auto;"></div>
      </div>

      <div style="margin-top:24px;text-align:center;color:#444;font-size:0.75rem;">
        Auto-refreshes every 10s • <span id="last-update">—</span>
      </div>
    </div>

    <style>
      .stat-card {
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        padding: 16px 12px;
        text-align: center;
      }
      .stat-value {
        font-size: 1.8rem;
        font-weight: 700;
        color: #00ff88;
        line-height: 1.2;
      }
      .stat-label {
        font-size: 0.75rem;
        color: #888;
        margin-top: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .bar-row {
        display: flex;
        align-items: center;
        margin-bottom: 6px;
        font-size: 0.85rem;
      }
      .bar-label {
        width: 100px;
        color: #aaa;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .bar-track {
        flex: 1;
        height: 20px;
        background: #1a1a1a;
        border-radius: 4px;
        margin: 0 8px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        background: #00ff88;
        border-radius: 4px;
        transition: width 0.5s ease;
        min-width: 2px;
      }
      .bar-count {
        width: 40px;
        text-align: right;
        color: #888;
        font-size: 0.8rem;
      }
      .activity-item {
        padding: 8px 12px;
        border-left: 2px solid #2a2a2a;
        margin-bottom: 4px;
        font-size: 0.85rem;
        color: #aaa;
      }
      .activity-item .time {
        color: #555;
        font-size: 0.75rem;
      }
      .pages-row {
        display: grid;
        grid-template-columns: 1fr 80px 80px 80px 80px;
        padding: 8px 0;
        border-bottom: 1px solid #1a1a1a;
        font-size: 0.85rem;
      }
      .pages-row.header {
        color: #888;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 0.5px;
      }
      .pages-row .cell {
        text-align: right;
        color: #aaa;
      }
      .pages-row .cell:first-child {
        text-align: left;
        color: #e0e0e0;
      }
    </style>

    <script>
      (function() {
        var targetPageId = ${JSON.stringify(pageId || null)};
        var token = ${JSON.stringify(token || '')};
        var apiBase = targetPageId ? '/api/analytics/' + targetPageId : '/api/analytics';

        function formatTime(seconds) {
          if (!seconds || seconds === 0) return '0s';
          if (seconds < 60) return seconds + 's';
          var m = Math.floor(seconds / 60);
          var s = seconds % 60;
          return m + 'm ' + s + 's';
        }

        function fetchAnalytics() {
          fetch(apiBase, {
            headers: { 'Authorization': 'Bearer ' + token }
          })
          .then(function(r) { return r.json(); })
          .then(function(data) { render(data); })
          .catch(function(err) { console.error('Analytics fetch error:', err); });
        }

        function render(data) {
          if (targetPageId) {
            // Single page view
            document.getElementById('stat-views').textContent = data.views ? data.views.total : 0;
            document.getElementById('stat-unique').textContent = data.views ? data.views.unique : 0;
            document.getElementById('stat-time').textContent = formatTime(data.avgTimeOnPage || 0);
            document.getElementById('stat-interactions').textContent = data.interactions ? data.interactions.total : 0;
            document.getElementById('stat-completions').textContent = data.completions ? data.completions.total : 0;
            document.getElementById('stat-rate').textContent = (data.completionRate || 0) + '%';

            // Interaction chart
            if (data.interactions && data.interactions.byType) {
              renderChart(data.interactions.byType);
            }

            // Activity feed
            var items = [];
            if (data.interactions && data.interactions.recent) {
              data.interactions.recent.forEach(function(i) {
                items.push({ time: i.timestamp, text: i.type + ' on ' + (i.element || 'unknown'), type: 'interaction' });
              });
            }
            if (data.completions && data.completions.recent) {
              data.completions.recent.forEach(function(c) {
                items.push({ time: c.timestamp, text: 'Completion: ' + c.type, type: 'completion' });
              });
            }
            renderActivity(items);
          } else {
            // Summary view
            document.getElementById('stat-views').textContent = data.totalViews || 0;
            document.getElementById('stat-unique').textContent = data.totalUniqueVisitors || 0;
            document.getElementById('stat-time').textContent = formatTime(data.avgTimeOnPage || 0);
            document.getElementById('stat-interactions').textContent = data.totalInteractions || 0;
            document.getElementById('stat-completions').textContent = data.totalCompletions || 0;
            document.getElementById('stat-rate').textContent = (data.overallCompletionRate || 0) + '%';

            // Pages table
            if (data.pages && data.pages.length > 0) {
              document.getElementById('pages-section').style.display = 'block';
              renderPagesTable(data.pages);
            }
          }

          document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
        }

        function renderChart(byType) {
          var el = document.getElementById('interaction-chart');
          var keys = Object.keys(byType);
          if (keys.length === 0) {
            el.innerHTML = '<div style="color:#555;font-size:0.85rem;">No interactions yet</div>';
            return;
          }
          var max = Math.max.apply(null, keys.map(function(k) { return byType[k]; }));
          var html = '';
          keys.sort(function(a,b) { return byType[b] - byType[a]; });
          keys.forEach(function(k) {
            var pct = max > 0 ? (byType[k] / max * 100) : 0;
            html += '<div class="bar-row">' +
              '<div class="bar-label">' + k + '</div>' +
              '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
              '<div class="bar-count">' + byType[k] + '</div></div>';
          });
          el.innerHTML = html;
        }

        function renderPagesTable(pages) {
          var el = document.getElementById('pages-table');
          var html = '<div class="pages-row header">' +
            '<div class="cell">Page</div><div class="cell">Views</div>' +
            '<div class="cell">Unique</div><div class="cell">Actions</div><div class="cell">Rate</div></div>';
          pages.sort(function(a,b) { return (b.views.total || 0) - (a.views.total || 0); });
          pages.forEach(function(p) {
            html += '<div class="pages-row">' +
              '<div class="cell" style="overflow:hidden;text-overflow:ellipsis;">' + (p.template || p.pageId.slice(0,8)) + '</div>' +
              '<div class="cell">' + (p.views.total || 0) + '</div>' +
              '<div class="cell">' + (p.views.unique || 0) + '</div>' +
              '<div class="cell">' + (p.interactions || 0) + '</div>' +
              '<div class="cell">' + (p.completionRate || 0) + '%</div></div>';
          });
          el.innerHTML = html;
        }

        function renderActivity(items) {
          var el = document.getElementById('activity-feed');
          if (items.length === 0) {
            el.innerHTML = '<div style="color:#555;font-size:0.85rem;">No activity yet</div>';
            return;
          }
          items.sort(function(a,b) { return new Date(b.time) - new Date(a.time); });
          var html = '';
          items.slice(0, 20).forEach(function(item) {
            var color = item.type === 'completion' ? '#00ff88' : '#2a2a2a';
            var t = item.time ? new Date(item.time).toLocaleTimeString() : '';
            html += '<div class="activity-item" style="border-left-color:' + color + ';">' +
              item.text + ' <span class="time">' + t + '</span></div>';
          });
          el.innerHTML = html;
        }

        // Live indicator
        if (typeof window.sparkui !== 'undefined') {
          document.addEventListener('sparkui:status', function(e) {
            var dot = document.getElementById('live-dot');
            dot.style.background = e.detail.status === 'connected' ? '#00ff88' : '#555';
          });
        }

        // Auto-refresh
        fetchAnalytics();
        setInterval(fetchAnalytics, 10000);

        // Also refresh on WS update
        if (typeof window.sparkui !== 'undefined') {
          window.sparkui.onMessage(function(msg) {
            if (msg.type === 'analytics_update') fetchAnalytics();
          });
        }
      })();
    </script>`;

  return base({
    title: dashTitle,
    body,
    id: _pageId,
    og: _og || {},
    extraHead: '<meta name="robots" content="noindex">',
  });
}

analyticsDashboard.schema = {
  type: 'object',
  description: 'Real-time analytics dashboard for SparkUI pages. Shows views, interactions, completions, and activity feed.',
  properties: {
    pageId: { type: 'string', description: 'Specific page UUID to show analytics for (omit for all pages)', example: 'abc123-def456' },
    token: { type: 'string', description: 'Push token for API authentication (required to fetch analytics data)' },
    title: { type: 'string', description: 'Dashboard title', example: 'Campaign Analytics' },
  },
  required: ['token'],
  example: {
    token: 'spk_your_push_token_here',
    title: 'My Dashboard',
  },
};

module.exports = analyticsDashboard;
