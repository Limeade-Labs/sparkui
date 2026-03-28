'use strict';

const base = require('./base');

/**
 * Calendar template.
 * Day or week view with color-coded events, event details on tap,
 * today highlight, and mobile-first design.
 *
 * @param {object} data
 * @param {string} [data.title] - Calendar title
 * @param {string} [data.view='day'] - 'day' or 'week'
 * @param {string} [data.date] - Focus date (ISO string or YYYY-MM-DD), defaults to today
 * @param {Array<{title:string,start:string,end?:string,category?:string,color?:string,location?:string,description?:string,allDay?:boolean}>} data.events
 * @param {object} [data.categories] - { name: color } map for category colors
 * @param {string} [data._pageId]
 * @param {object} [data._og]
 * @returns {string} Full HTML page
 */
function calendar(data = {}) {
  const pageId = data._pageId || 'unknown';
  const _og = data._og || {};
  const title = data.title || 'Calendar';
  const view = data.view || 'day';
  const focusDate = data.date || new Date().toISOString().split('T')[0];
  const events = data.events || [];
  const categories = data.categories || {};

  const defaultColors = {
    'Work': '#3b82f6', 'Personal': '#22c55e', 'Health': '#ef4444',
    'Meeting': '#8b5cf6', 'Social': '#f59e0b', 'Travel': '#06b6d4',
    'Default': '#6366f1',
  };

  const eventsJson = JSON.stringify(events);
  const categoriesJson = JSON.stringify({ ...defaultColors, ...categories });

  const body = `
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 style="font-size:1.4rem;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px">
          📅 ${escHtml(title)}
        </h1>
        <p id="date-label" style="color:#888;font-size:0.9rem;margin-top:4px"></p>
      </div>
      <div style="display:flex;gap:6px">
        <button id="prev-btn" style="width:36px;height:36px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#aaa;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Previous">‹</button>
        <button id="today-btn" style="padding:0 12px;height:36px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#aaa;font-size:0.8rem;cursor:pointer" title="Today">Today</button>
        <button id="next-btn" style="width:36px;height:36px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#aaa;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Next">›</button>
      </div>
    </div>

    <!-- View toggle -->
    <div style="display:flex;gap:4px;margin-bottom:20px;background:#1a1a1a;padding:4px;border-radius:8px;border:1px solid #222">
      <button class="view-btn" data-view="day" style="flex:1;padding:8px;border-radius:6px;border:none;font-size:0.85rem;font-weight:500;cursor:pointer;transition:all 0.2s;background:transparent;color:#888">Day</button>
      <button class="view-btn" data-view="week" style="flex:1;padding:8px;border-radius:6px;border:none;font-size:0.85rem;font-weight:500;cursor:pointer;transition:all 0.2s;background:transparent;color:#888">Week</button>
    </div>

    <!-- Day view -->
    <div id="day-view" style="display:none">
      <!-- All-day events -->
      <div id="all-day-section" style="display:none;margin-bottom:16px">
        <div style="font-size:0.75rem;color:#666;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">All Day</div>
        <div id="all-day-events"></div>
      </div>
      <!-- Time slots -->
      <div id="time-slots" style="position:relative"></div>
      <!-- Empty state -->
      <div id="empty-day" style="display:none;text-align:center;padding:48px 20px">
        <div style="font-size:2.5rem;margin-bottom:12px;opacity:0.5">📭</div>
        <p style="color:#666;font-size:0.95rem">No events this day</p>
      </div>
    </div>

    <!-- Week view -->
    <div id="week-view" style="display:none">
      <div id="week-grid"></div>
    </div>

    <!-- Event detail modal -->
    <div id="event-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:none;align-items:flex-end;justify-content:center;padding:16px">
      <div id="modal-content" style="background:#1a1a1a;border:1px solid #333;border-radius:16px 16px 0 0;padding:24px;width:100%;max-width:600px;max-height:70vh;overflow-y:auto;animation:slideUp 0.3s ease">
        <div style="width:40px;height:4px;background:#444;border-radius:2px;margin:0 auto 16px"></div>
        <div id="modal-color-bar" style="height:4px;border-radius:2px;margin-bottom:16px"></div>
        <h3 id="modal-title" style="font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:8px"></h3>
        <div id="modal-time" style="color:#888;font-size:0.9rem;margin-bottom:12px;display:flex;align-items:center;gap:6px"></div>
        <div id="modal-location" style="color:#888;font-size:0.9rem;margin-bottom:12px;display:none;align-items:center;gap:6px"></div>
        <div id="modal-category" style="display:none;margin-bottom:12px"></div>
        <div id="modal-desc" style="color:#aaa;font-size:0.9rem;line-height:1.6;display:none"></div>
        <button id="modal-close" style="width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:transparent;color:#888;font-size:0.9rem;cursor:pointer;margin-top:16px;transition:all 0.2s" onmouseover="this.style.borderColor='#555'" onmouseout="this.style.borderColor='#333'">Close</button>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:28px;padding-top:16px;border-top:1px solid #222">
      <span style="font-size:0.8rem;color:#555">Powered by SparkUI ⚡</span>
    </div>

    <style>
      @keyframes slideUp { 0%{transform:translateY(100%)} 100%{transform:translateY(0)} }
      @keyframes fadeInEvent { 0%{opacity:0;transform:translateX(-4px)} 100%{opacity:1;transform:translateX(0)} }
      .time-slot {
        display:flex;min-height:48px;border-bottom:1px solid #1a1a1a;
      }
      .time-label {
        width:52px;flex-shrink:0;color:#555;font-size:0.75rem;padding-top:2px;
        font-variant-numeric:tabular-nums;text-align:right;padding-right:12px;
      }
      .slot-content { flex:1;min-height:48px;position:relative;padding:2px 0; }
      .event-card {
        background:#1e293b;border-left:3px solid #6366f1;border-radius:6px;
        padding:8px 12px;margin-bottom:4px;cursor:pointer;transition:all 0.2s;
        animation:fadeInEvent 0.3s ease;
      }
      .event-card:hover { transform:translateX(2px);box-shadow:0 2px 12px rgba(0,0,0,0.3); }
      .event-card .ev-title { font-size:0.88rem;font-weight:600;color:#eee; }
      .event-card .ev-time { font-size:0.75rem;color:#888;margin-top:2px; }
      .event-card .ev-loc { font-size:0.75rem;color:#666;margin-top:1px; }
      .week-day-col { flex:1;min-width:0; }
      .week-day-header {
        text-align:center;padding:8px 4px;font-size:0.75rem;font-weight:600;
        color:#888;border-bottom:1px solid #222;
      }
      .week-day-header.today { color:#00ff88; }
      .week-day-header .day-num {
        display:block;font-size:1.2rem;font-weight:700;color:#eee;margin-top:2px;
      }
      .week-day-header.today .day-num {
        color:#111;background:#00ff88;width:32px;height:32px;border-radius:50%;
        display:inline-flex;align-items:center;justify-content:center;
      }
      .week-event {
        margin:4px 2px;padding:6px 8px;border-radius:4px;font-size:0.75rem;
        color:#eee;cursor:pointer;transition:opacity 0.2s;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .week-event:hover { opacity:0.8; }
      .all-day-event {
        padding:8px 12px;border-radius:6px;margin-bottom:4px;cursor:pointer;
        transition:all 0.2s;
      }
      .all-day-event:hover { opacity:0.8; }
    </style>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var events = ${eventsJson};
      var cats = ${categoriesJson};
      var currentView = '${view}';
      var focusDate = new Date('${focusDate}T00:00:00');
      var today = new Date();
      today.setHours(0,0,0,0);

      var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

      function getColor(event) {
        if (event.color) return event.color;
        if (event.category && cats[event.category]) return cats[event.category];
        return cats['Default'] || '#6366f1';
      }

      function formatTime(d) {
        var h = d.getHours(), m = d.getMinutes();
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + (m > 0 ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + ampm;
      }

      function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      }

      function dateStr(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      }

      function updateDateLabel() {
        var el = document.getElementById('date-label');
        if (currentView === 'day') {
          var isToday = sameDay(focusDate, today);
          el.textContent = (isToday ? 'Today — ' : '') + DAYS[focusDate.getDay()] + ', ' + MONTHS[focusDate.getMonth()] + ' ' + focusDate.getDate() + ', ' + focusDate.getFullYear();
        } else {
          var start = getWeekStart(focusDate);
          var end = new Date(start);
          end.setDate(end.getDate() + 6);
          el.textContent = MONTHS[start.getMonth()] + ' ' + start.getDate() + ' — ' + (end.getMonth() !== start.getMonth() ? MONTHS[end.getMonth()] + ' ' : '') + end.getDate() + ', ' + end.getFullYear();
        }
      }

      function getWeekStart(d) {
        var s = new Date(d);
        s.setDate(s.getDate() - s.getDay());
        return s;
      }

      function getEventsForDay(d) {
        var ds = dateStr(d);
        return events.filter(function(ev) {
          var evDate = ev.start.substring(0, 10);
          return evDate === ds;
        }).sort(function(a, b) {
          if (a.allDay && !b.allDay) return -1;
          if (!a.allDay && b.allDay) return 1;
          return a.start.localeCompare(b.start);
        });
      }

      function renderDayView() {
        var dayEvents = getEventsForDay(focusDate);
        var allDayEvs = dayEvents.filter(function(e) { return e.allDay; });
        var timedEvs = dayEvents.filter(function(e) { return !e.allDay; });

        // All-day section
        var allDaySec = document.getElementById('all-day-section');
        var allDayEl = document.getElementById('all-day-events');
        if (allDayEvs.length > 0) {
          allDaySec.style.display = 'block';
          allDayEl.innerHTML = '';
          allDayEvs.forEach(function(ev) {
            var c = getColor(ev);
            var div = document.createElement('div');
            div.className = 'all-day-event';
            div.style.background = c + '22';
            div.style.borderLeft = '3px solid ' + c;
            div.innerHTML = '<span style="font-size:0.9rem;font-weight:600;color:' + c + '">' + escH(ev.title) + '</span>';
            div.addEventListener('click', function() { showModal(ev); });
            allDayEl.appendChild(div);
          });
        } else {
          allDaySec.style.display = 'none';
        }

        // Time slots
        var slotsEl = document.getElementById('time-slots');
        slotsEl.innerHTML = '';
        var emptyEl = document.getElementById('empty-day');

        if (timedEvs.length === 0 && allDayEvs.length === 0) {
          emptyEl.style.display = 'block';
          slotsEl.style.display = 'none';
          return;
        }
        emptyEl.style.display = 'none';
        slotsEl.style.display = 'block';

        // Find time range
        var startHour = 8, endHour = 18;
        timedEvs.forEach(function(ev) {
          var h = new Date(ev.start).getHours();
          if (h < startHour) startHour = h;
          var eh = ev.end ? new Date(ev.end).getHours() + 1 : h + 1;
          if (eh > endHour) endHour = Math.min(eh, 24);
        });

        for (var h = startHour; h <= endHour; h++) {
          var slot = document.createElement('div');
          slot.className = 'time-slot';
          var label = (h === 0 ? '12' : h > 12 ? (h-12) : h) + (h < 12 ? 'a' : 'p');
          slot.innerHTML = '<div class="time-label">' + label + '</div><div class="slot-content" data-hour="' + h + '"></div>';
          slotsEl.appendChild(slot);
        }

        // Place events
        timedEvs.forEach(function(ev) {
          var start = new Date(ev.start);
          var hour = start.getHours();
          var slotContent = slotsEl.querySelector('.slot-content[data-hour="' + hour + '"]');
          if (!slotContent) return;

          var color = getColor(ev);
          var card = document.createElement('div');
          card.className = 'event-card';
          card.style.borderLeftColor = color;

          var timeStr = formatTime(start);
          if (ev.end) timeStr += ' — ' + formatTime(new Date(ev.end));

          card.innerHTML = '<div class="ev-title">' + escH(ev.title) + '</div>' +
            '<div class="ev-time">🕐 ' + timeStr + '</div>' +
            (ev.location ? '<div class="ev-loc">📍 ' + escH(ev.location) + '</div>' : '');

          card.addEventListener('click', function() { showModal(ev); });
          slotContent.appendChild(card);
        });
      }

      function renderWeekView() {
        var weekGrid = document.getElementById('week-grid');
        weekGrid.innerHTML = '';
        weekGrid.style.cssText = 'display:flex;gap:2px;overflow-x:auto';

        var weekStart = getWeekStart(focusDate);
        for (var i = 0; i < 7; i++) {
          var d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          var isToday = sameDay(d, today);
          var dayEvents = getEventsForDay(d);

          var col = document.createElement('div');
          col.className = 'week-day-col';
          col.innerHTML = '<div class="week-day-header' + (isToday ? ' today' : '') + '">' +
            DAYS[d.getDay()] + '<span class="day-num">' + d.getDate() + '</span></div>';

          var evContainer = document.createElement('div');
          evContainer.style.cssText = 'padding:4px 0';

          if (dayEvents.length === 0) {
            evContainer.innerHTML = '<div style="text-align:center;padding:12px 0;color:#333;font-size:0.75rem">—</div>';
          }

          dayEvents.forEach(function(ev) {
            var color = getColor(ev);
            var evEl = document.createElement('div');
            evEl.className = 'week-event';
            evEl.style.background = color + '33';
            evEl.style.borderLeft = '2px solid ' + color;
            evEl.textContent = (ev.allDay ? '◆ ' : '') + ev.title;
            evEl.addEventListener('click', function() { showModal(ev); });
            evContainer.appendChild(evEl);
          });

          col.appendChild(evContainer);
          weekGrid.appendChild(col);
        }
      }

      function showModal(ev) {
        var color = getColor(ev);
        document.getElementById('modal-color-bar').style.background = color;
        document.getElementById('modal-title').textContent = ev.title;

        // Time
        var timeEl = document.getElementById('modal-time');
        if (ev.allDay) {
          timeEl.innerHTML = '📅 All day';
        } else {
          var ts = formatTime(new Date(ev.start));
          if (ev.end) ts += ' — ' + formatTime(new Date(ev.end));
          timeEl.innerHTML = '🕐 ' + ts;
        }

        // Location
        var locEl = document.getElementById('modal-location');
        if (ev.location) {
          locEl.style.display = 'flex';
          locEl.innerHTML = '📍 ' + escH(ev.location);
        } else {
          locEl.style.display = 'none';
        }

        // Category
        var catEl = document.getElementById('modal-category');
        if (ev.category) {
          catEl.style.display = 'block';
          catEl.innerHTML = '<span style="background:' + color + '22;color:' + color + ';padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:500">' + escH(ev.category) + '</span>';
        } else {
          catEl.style.display = 'none';
        }

        // Description
        var descEl = document.getElementById('modal-desc');
        if (ev.description) {
          descEl.style.display = 'block';
          descEl.textContent = ev.description;
        } else {
          descEl.style.display = 'none';
        }

        document.getElementById('event-modal').style.display = 'flex';
      }

      // Close modal
      document.getElementById('modal-close').addEventListener('click', function() {
        document.getElementById('event-modal').style.display = 'none';
      });
      document.getElementById('event-modal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
      });

      // View toggle
      document.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          currentView = this.getAttribute('data-view');
          renderView();
        });
      });

      // Navigation
      document.getElementById('prev-btn').addEventListener('click', function() {
        if (currentView === 'day') focusDate.setDate(focusDate.getDate() - 1);
        else focusDate.setDate(focusDate.getDate() - 7);
        renderView();
      });
      document.getElementById('next-btn').addEventListener('click', function() {
        if (currentView === 'day') focusDate.setDate(focusDate.getDate() + 1);
        else focusDate.setDate(focusDate.getDate() + 7);
        renderView();
      });
      document.getElementById('today-btn').addEventListener('click', function() {
        focusDate = new Date(today);
        renderView();
      });

      function renderView() {
        updateDateLabel();
        document.querySelectorAll('.view-btn').forEach(function(btn) {
          var active = btn.getAttribute('data-view') === currentView;
          btn.style.background = active ? '#333' : 'transparent';
          btn.style.color = active ? '#fff' : '#888';
        });
        document.getElementById('day-view').style.display = currentView === 'day' ? 'block' : 'none';
        document.getElementById('week-view').style.display = currentView === 'week' ? 'block' : 'none';
        if (currentView === 'day') renderDayView();
        else renderWeekView();
      }

      // WS updates
      if (window.sparkui) {
        sparkui.onMessage(function(msg) {
          if (msg.type === 'update' && msg.data && msg.data.events) {
            events = msg.data.events;
            renderView();
          }
        });
      }

      function escH(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

      renderView();
    });
    </script>
  `;

  const og = {
    title: _og.title || '📅 ' + title,
    description: _og.description || events.length + ' events',
    image: _og.image,
    url: _og.url,
  };

  return base({
    title,
    body,
    id: pageId,
    extraHead,
    og,
  });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

calendar.schema = {
  type: 'object',
  description: 'Calendar view (day or week) with color-coded events, event details, and navigation.',
  properties: {
    title: { type: 'string', description: 'Calendar title', default: 'Calendar', example: 'My Schedule' },
    view: { type: 'string', description: 'Initial view mode', enum: ['day', 'week'], default: 'day' },
    date: { type: 'string', description: 'Focus date (ISO or YYYY-MM-DD), defaults to today', example: '2026-03-27' },
    events: {
      type: 'array',
      description: 'Calendar events',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title', example: 'Team Standup' },
          start: { type: 'string', description: 'Start time (ISO string)', example: '2026-03-27T09:00:00' },
          end: { type: 'string', description: 'End time (ISO string)', example: '2026-03-27T09:30:00' },
          category: { type: 'string', description: 'Category for color coding (Work, Personal, Health, Meeting, Social, Travel)', example: 'Meeting' },
          color: { type: 'string', description: 'Custom color override (hex)', example: '#3b82f6' },
          location: { type: 'string', description: 'Event location', example: 'Conference Room A' },
          description: { type: 'string', description: 'Event description' },
          allDay: { type: 'boolean', description: 'All-day event', default: false },
        },
        required: ['title', 'start'],
      },
    },
    categories: {
      type: 'object',
      description: 'Custom category-to-color mapping',
      additionalProperties: { type: 'string' },
      example: { 'Work': '#3b82f6', 'Personal': '#22c55e' },
    },
  },
  required: ['events'],
  example: {
    title: 'Today\'s Schedule',
    view: 'day',
    date: '2026-03-27',
    events: [
      { title: 'Team Standup', start: '2026-03-27T09:00:00', end: '2026-03-27T09:30:00', category: 'Meeting' },
      { title: 'Lunch with Client', start: '2026-03-27T12:00:00', end: '2026-03-27T13:00:00', category: 'Work', location: 'Downtown Cafe' },
      { title: 'Gym', start: '2026-03-27T17:00:00', end: '2026-03-27T18:00:00', category: 'Health' },
    ],
  },
};

module.exports = calendar;
