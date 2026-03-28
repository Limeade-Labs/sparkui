'use strict';

const base = require('./base');

/**
 * Poll / Voting template.
 * Real-time vote tallying via WebSocket, bar chart visualization,
 * single or multi-select, anonymous or named voting, auto-close support.
 *
 * @param {object} data
 * @param {string} data.question - The poll question
 * @param {Array<string|{text:string,icon?:string}>} data.options - Choice options
 * @param {boolean} [data.multiSelect=false] - Allow selecting multiple options
 * @param {boolean} [data.anonymous=true] - Anonymous voting (no name required)
 * @param {boolean} [data.showResults=true] - Show live results
 * @param {number} [data.maxVotes] - Auto-close after this many votes
 * @param {string} [data.closesAt] - ISO timestamp to auto-close
 * @param {string} [data.subtitle] - Optional subtitle
 * @param {string} [data._pageId] - Injected by template engine
 * @param {object} [data._og] - OG metadata
 * @returns {string} Full HTML page
 */
function poll(data = {}) {
  const pageId = data._pageId || 'unknown';
  const _og = data._og || {};
  const question = data.question || 'What do you think?';
  const subtitle = data.subtitle || '';
  const options = (data.options || ['Yes', 'No']).map(o =>
    typeof o === 'string' ? { text: o, icon: '' } : { text: o.text || '', icon: o.icon || '' }
  );
  const multiSelect = !!data.multiSelect;
  const anonymous = data.anonymous !== false;
  const showResults = data.showResults !== false;
  const maxVotes = data.maxVotes || 0;
  const closesAt = data.closesAt || '';

  const optionsJson = JSON.stringify(options);

  const body = `
    <div style="text-align:center;margin-bottom:28px">
      <div style="font-size:2.5rem;margin-bottom:12px">📊</div>
      <h1 style="font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:6px;line-height:1.3">${escHtml(question)}</h1>
      ${subtitle ? `<p style="color:#888;font-size:0.9rem">${escHtml(subtitle)}</p>` : ''}
      ${multiSelect ? '<p style="color:#666;font-size:0.8rem;margin-top:6px">Select all that apply</p>' : ''}
    </div>

    <!-- Voter name (non-anonymous) -->
    <div id="voter-name-section" style="display:${anonymous ? 'none' : 'block'};margin-bottom:20px">
      <input id="voter-name" type="text" placeholder="Your name" style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#eee;font-size:1rem;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#333'">
    </div>

    <!-- Options -->
    <div id="poll-options" style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
    </div>

    <!-- Submit -->
    <button id="vote-btn" style="width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:1.05rem;font-weight:600;cursor:pointer;transition:all 0.2s;opacity:0.5;pointer-events:none" disabled>
      Cast Vote
    </button>

    <!-- Results Section -->
    <div id="results-section" style="display:none;margin-top:28px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 style="font-size:1rem;font-weight:600;color:#aaa">Results</h2>
        <span id="total-votes" style="font-size:0.85rem;color:#666">0 votes</span>
      </div>
      <div id="results-bars"></div>
    </div>

    <!-- Closed overlay -->
    <div id="poll-closed" style="display:none;text-align:center;margin-top:24px;padding:20px;background:#1a1a1a;border-radius:12px;border:1px solid #333">
      <div style="font-size:1.5rem;margin-bottom:8px">🔒</div>
      <p style="color:#888;font-size:0.95rem">This poll is closed</p>
    </div>

    <!-- Voted confirmation -->
    <div id="vote-confirmed" style="display:none;text-align:center;margin-top:20px">
      <div style="font-size:2rem;margin-bottom:8px;animation:pop 0.3s ease">✅</div>
      <p style="color:#00ff88;font-size:0.95rem;font-weight:500">Vote submitted!</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:28px;padding-top:16px;border-top:1px solid #222">
      <span style="font-size:0.8rem;color:#555">Powered by SparkUI ⚡</span>
    </div>

    <style>
      @keyframes pop { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
      @keyframes slideIn { 0%{transform:translateX(-8px);opacity:0} 100%{transform:translateX(0);opacity:1} }
      .poll-option {
        background:#1a1a1a;border:2px solid #2a2a2a;border-radius:10px;padding:14px 16px;
        cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:12px;
        position:relative;overflow:hidden;
      }
      .poll-option:hover { border-color:#444; }
      .poll-option.selected { border-color:#6366f1;background:#1e1b4b; }
      .poll-option .check {
        width:22px;height:22px;border-radius:${multiSelect ? '4px' : '50%'};
        border:2px solid #444;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;transition:all 0.2s;
      }
      .poll-option.selected .check {
        border-color:#6366f1;background:#6366f1;
      }
      .result-bar-bg {
        height:32px;background:#1a1a1a;border-radius:6px;overflow:hidden;
        position:relative;margin-bottom:10px;
      }
      .result-bar-fill {
        height:100%;border-radius:6px;transition:width 0.6s ease;
        background:linear-gradient(90deg,#6366f1,#8b5cf6);min-width:0;
      }
      .result-label {
        position:absolute;top:0;left:12px;right:12px;height:100%;
        display:flex;align-items:center;justify-content:space-between;
        font-size:0.85rem;color:#eee;font-weight:500;
      }
    </style>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var options = ${optionsJson};
      var multiSelect = ${multiSelect};
      var anonymous = ${anonymous};
      var showResults = ${showResults};
      var maxVotes = ${maxVotes};
      var closesAt = ${closesAt ? `'${escJs(closesAt)}'` : 'null'};
      var selected = [];
      var voted = false;
      var closed = false;
      var votes = {};
      options.forEach(function(o,i){ votes[i] = 0; });

      var optionsEl = document.getElementById('poll-options');
      var voteBtn = document.getElementById('vote-btn');
      var resultsSection = document.getElementById('results-section');
      var resultsBars = document.getElementById('results-bars');
      var totalVotesEl = document.getElementById('total-votes');
      var pollClosed = document.getElementById('poll-closed');
      var voteConfirmed = document.getElementById('vote-confirmed');

      // Render options
      options.forEach(function(opt, i) {
        var div = document.createElement('div');
        div.className = 'poll-option';
        div.setAttribute('data-idx', i);
        div.style.animation = 'slideIn 0.3s ease ' + (i * 0.05) + 's both';
        div.innerHTML = '<div class="check">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="display:none"><path d="M2 7L5.5 10.5L12 3.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>' +
          '</div>' +
          (opt.icon ? '<span style="font-size:1.3rem">' + opt.icon + '</span>' : '') +
          '<span style="color:#eee;font-size:0.95rem;flex:1">' + escH(opt.text) + '</span>';
        div.addEventListener('click', function() {
          if (voted || closed) return;
          var idx = parseInt(this.getAttribute('data-idx'));
          if (multiSelect) {
            var pos = selected.indexOf(idx);
            if (pos >= 0) { selected.splice(pos, 1); this.classList.remove('selected'); this.querySelector('svg').style.display='none'; }
            else { selected.push(idx); this.classList.add('selected'); this.querySelector('svg').style.display='block'; }
          } else {
            selected = [idx];
            document.querySelectorAll('.poll-option').forEach(function(el) {
              el.classList.remove('selected');
              el.querySelector('svg').style.display = 'none';
            });
            this.classList.add('selected');
            this.querySelector('svg').style.display = 'block';
          }
          voteBtn.disabled = selected.length === 0;
          voteBtn.style.opacity = selected.length > 0 ? '1' : '0.5';
          voteBtn.style.pointerEvents = selected.length > 0 ? 'auto' : 'none';
        });
        optionsEl.appendChild(div);
      });

      // Submit vote
      voteBtn.addEventListener('click', function() {
        if (voted || closed || selected.length === 0) return;
        var voterName = anonymous ? 'anonymous' : (document.getElementById('voter-name').value.trim() || 'Anonymous');
        if (!anonymous && !document.getElementById('voter-name').value.trim()) {
          document.getElementById('voter-name').style.borderColor = '#ff4444';
          document.getElementById('voter-name').focus();
          return;
        }

        voted = true;
        var payload = {
          action: 'vote',
          selections: selected.map(function(i) { return options[i].text; }),
          selectionIndexes: selected,
          voter: voterName,
          multiSelect: multiSelect,
          votedAt: new Date().toISOString()
        };

        // Update local counts
        selected.forEach(function(i) { votes[i] = (votes[i] || 0) + 1; });
        renderResults();

        // Send via WS
        if (window.sparkui) {
          sparkui.sendCompletion(payload);
        }

        // Visual feedback
        voteBtn.style.display = 'none';
        voteConfirmed.style.display = 'block';
        if (showResults) resultsSection.style.display = 'block';

        // Disable option clicks
        document.querySelectorAll('.poll-option').forEach(function(el) {
          el.style.cursor = 'default';
          el.style.pointerEvents = 'none';
        });
      });

      function renderResults() {
        var total = 0;
        for (var k in votes) total += votes[k];
        totalVotesEl.textContent = total + (total === 1 ? ' vote' : ' votes');

        resultsBars.innerHTML = '';
        options.forEach(function(opt, i) {
          var count = votes[i] || 0;
          var pct = total > 0 ? Math.round((count / total) * 100) : 0;
          var div = document.createElement('div');
          div.className = 'result-bar-bg';
          div.innerHTML = '<div class="result-bar-fill" style="width:0%"></div>' +
            '<div class="result-label"><span>' + (opt.icon ? opt.icon + ' ' : '') + escH(opt.text) + '</span><span>' + pct + '%</span></div>';
          resultsBars.appendChild(div);
          // Animate
          setTimeout(function() {
            div.querySelector('.result-bar-fill').style.width = pct + '%';
          }, 50);
        });
      }

      // Check auto-close
      function checkClose() {
        if (closesAt) {
          var closeTime = new Date(closesAt).getTime();
          if (Date.now() >= closeTime) {
            closed = true;
            if (!voted) {
              voteBtn.style.display = 'none';
              pollClosed.style.display = 'block';
            }
          }
        }
      }
      checkClose();
      if (closesAt) setInterval(checkClose, 5000);

      // Listen for WS updates (vote tallies from other voters)
      if (window.sparkui) {
        sparkui.onMessage(function(msg) {
          if (msg.type === 'update' && msg.data && msg.data.votes) {
            votes = msg.data.votes;
            renderResults();
            if (showResults) resultsSection.style.display = 'block';
            if (msg.data.closed) {
              closed = true;
              if (!voted) {
                voteBtn.style.display = 'none';
                pollClosed.style.display = 'block';
              }
            }
          }
        });
      }

      // Show results initially if configured
      if (showResults && !voted) {
        renderResults();
      }

      function escH(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    });
    </script>
  `;

  const og = {
    title: _og.title || '📊 ' + question,
    description: _og.description || options.map(o => o.text).join(' · '),
    image: _og.image,
    url: _og.url,
  };

  return base({
    title: 'Poll — ' + question,
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

function escJs(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

poll.schema = {
  type: 'object',
  description: 'Poll / voting page with real-time tallying, bar chart, single or multi-select.',
  properties: {
    question: { type: 'string', description: 'The poll question', example: 'What framework do you prefer?' },
    options: {
      type: 'array',
      description: 'Choice options — strings or {text, icon} objects',
      items: {
        oneOf: [
          { type: 'string' },
          { type: 'object', properties: { text: { type: 'string' }, icon: { type: 'string' } }, required: ['text'] },
        ],
      },
      example: ['React', 'Vue', 'Svelte'],
    },
    multiSelect: { type: 'boolean', description: 'Allow selecting multiple options', default: false },
    anonymous: { type: 'boolean', description: 'Anonymous voting (no name required)', default: true },
    showResults: { type: 'boolean', description: 'Show live results', default: true },
    maxVotes: { type: 'number', description: 'Auto-close after this many votes' },
    closesAt: { type: 'string', description: 'ISO timestamp to auto-close the poll', example: '2026-04-01T00:00:00Z' },
    subtitle: { type: 'string', description: 'Optional subtitle text' },
  },
  required: ['question', 'options'],
  example: {
    question: 'What should we build next?',
    options: ['Dashboard', 'Mobile app', 'API v2'],
    multiSelect: false,
    anonymous: true,
    showResults: true,
  },
};

module.exports = poll;
