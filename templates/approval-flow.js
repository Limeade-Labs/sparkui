'use strict';

const base = require('./base');

/**
 * Approval Flow template.
 * Request details with Approve/Reject/Request Changes actions,
 * optional comment, status badge, and agent callback via WebSocket.
 *
 * @param {object} data
 * @param {string} data.title - Request title
 * @param {string} [data.description] - Request description
 * @param {string} [data.requester] - Who submitted the request
 * @param {string} [data.amount] - Amount/impact (e.g. "$5,000", "High")
 * @param {string} [data.status='pending'] - pending/approved/rejected/changes_requested
 * @param {Array<{label:string,value:string}>} [data.details] - Key-value detail rows
 * @param {boolean} [data.requireComment=false] - Require comment before action
 * @param {boolean} [data.showRequestChanges=true] - Show "Request Changes" button
 * @param {string} [data.urgency] - low/medium/high/critical
 * @param {string} [data._pageId]
 * @param {object} [data._og]
 * @returns {string} Full HTML page
 */
function approvalFlow(data = {}) {
  const pageId = data._pageId || 'unknown';
  const _og = data._og || {};
  const title = data.title || data.name || data.label || 'Approval Request';
  const description = data.description || '';
  const requester = data.requester || '';
  const amount = data.amount || '';
  const status = data.status || 'pending';
  const details = (data.details || []).map(d => ({
    ...d,
    label: d.label || d.name || d.title || '',
  }));
  const requireComment = !!data.requireComment;
  const showRequestChanges = data.showRequestChanges !== false;
  const urgency = data.urgency || '';

  const detailsJson = JSON.stringify(details);
  const isPending = status === 'pending';

  const urgencyColors = {
    low: { bg: '#1a2e1a', border: '#22c55e33', text: '#22c55e', label: 'Low' },
    medium: { bg: '#2e2a1a', border: '#f59e0b33', text: '#f59e0b', label: 'Medium' },
    high: { bg: '#2e1a1a', border: '#ef444433', text: '#ef4444', label: 'High' },
    critical: { bg: '#3b1111', border: '#dc262666', text: '#dc2626', label: 'Critical' },
  };
  const urg = urgencyColors[urgency] || null;

  const statusConfig = {
    pending: { icon: '⏳', color: '#f59e0b', bg: '#f59e0b22', text: 'Pending Review' },
    approved: { icon: '✅', color: '#22c55e', bg: '#22c55e22', text: 'Approved' },
    rejected: { icon: '❌', color: '#ef4444', bg: '#ef444422', text: 'Rejected' },
    changes_requested: { icon: '🔄', color: '#6366f1', bg: '#6366f122', text: 'Changes Requested' },
  };
  const st = statusConfig[status] || statusConfig.pending;

  const body = `
    <!-- Status badge -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div id="status-badge" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;background:${st.bg};border:1px solid ${st.color}33;font-size:0.85rem;font-weight:500;color:${st.color}">
        <span>${st.icon}</span> ${st.text}
      </div>
      ${urg ? `<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;background:${urg.bg};border:1px solid ${urg.border};font-size:0.75rem;font-weight:600;color:${urg.text}">
        ${urgency === 'critical' ? '🚨' : '⚡'} ${urg.label}
      </div>` : ''}
    </div>

    <!-- Title & Description -->
    <div style="margin-bottom:24px">
      <h1 style="font-size:1.4rem;font-weight:700;color:#fff;line-height:1.3;margin-bottom:8px">${escHtml(title)}</h1>
      ${description ? `<p style="color:#aaa;font-size:0.95rem;line-height:1.6">${escHtml(description)}</p>` : ''}
    </div>

    <!-- Request details card -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:24px">
      ${requester ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #222">
        <div style="width:36px;height:36px;border-radius:50%;background:#333;display:flex;align-items:center;justify-content:center;font-size:0.9rem;color:#aaa">${escHtml(requester.charAt(0).toUpperCase())}</div>
        <div>
          <div style="color:#eee;font-size:0.9rem;font-weight:500">${escHtml(requester)}</div>
          <div style="color:#666;font-size:0.8rem">Requester</div>
        </div>
      </div>` : ''}

      ${amount ? `
      <div style="text-align:center;padding:16px 0;margin-bottom:16px;border-bottom:1px solid #222">
        <div style="font-size:2rem;font-weight:700;color:#fff">${escHtml(amount)}</div>
        <div style="color:#666;font-size:0.8rem;margin-top:4px">Amount / Impact</div>
      </div>` : ''}

      <div id="details-section">
        ${details.map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1a1a1a">
          <span style="color:#888;font-size:0.88rem">${escHtml(d.label)}</span>
          <span style="color:#eee;font-size:0.88rem;font-weight:500;text-align:right">${escHtml(d.value)}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- Comment field -->
    <div id="comment-section" style="margin-bottom:20px;${isPending ? '' : 'display:none'}">
      <label style="display:block;font-size:0.85rem;color:#888;margin-bottom:6px">
        Comment ${requireComment ? '<span style="color:#ef4444">*</span>' : '<span style="color:#555">(optional)</span>'}
      </label>
      <textarea id="comment-field" rows="3" placeholder="Add a note or reason..." style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#eee;font-size:0.95rem;resize:vertical;outline:none;font-family:inherit;transition:border-color 0.2s" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#333'"></textarea>
    </div>

    <!-- Action buttons -->
    <div id="action-buttons" style="display:${isPending ? 'flex' : 'none'};flex-direction:column;gap:10px">
      <button id="approve-btn" class="action-btn" data-action="approved" style="width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#059669,#22c55e);color:#fff;font-size:1.05rem;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px">
        ✅ Approve
      </button>
      <div style="display:flex;gap:10px">
        ${showRequestChanges ? `
        <button id="changes-btn" class="action-btn" data-action="changes_requested" style="flex:1;padding:14px;border-radius:10px;border:2px solid #6366f1;background:transparent;color:#6366f1;font-size:0.95rem;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px">
          🔄 Request Changes
        </button>` : ''}
        <button id="reject-btn" class="action-btn" data-action="rejected" style="flex:1;padding:14px;border-radius:10px;border:2px solid #ef4444;background:transparent;color:#ef4444;font-size:0.95rem;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:6px">
          ❌ Reject
        </button>
      </div>
    </div>

    <!-- Confirmation dialog (hidden) -->
    <div id="confirm-dialog" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:none;align-items:center;justify-content:center;padding:24px">
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:28px;width:100%;max-width:400px;text-align:center;animation:popIn 0.2s ease">
        <div id="confirm-icon" style="font-size:2.5rem;margin-bottom:12px"></div>
        <h3 id="confirm-title" style="font-size:1.15rem;font-weight:700;color:#fff;margin-bottom:8px"></h3>
        <p id="confirm-text" style="color:#888;font-size:0.9rem;margin-bottom:24px"></p>
        <div style="display:flex;gap:10px">
          <button id="confirm-cancel" style="flex:1;padding:12px;border-radius:8px;border:1px solid #333;background:transparent;color:#888;font-size:0.95rem;cursor:pointer;transition:all 0.2s">Cancel</button>
          <button id="confirm-yes" style="flex:1;padding:12px;border-radius:8px;border:none;font-size:0.95rem;font-weight:600;cursor:pointer;transition:all 0.2s"></button>
        </div>
      </div>
    </div>

    <!-- Result state (hidden) -->
    <div id="result-state" style="display:none;text-align:center;padding:32px 20px;background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;margin-top:20px">
      <div id="result-icon" style="font-size:3rem;margin-bottom:12px;animation:popIn 0.3s ease"></div>
      <h2 id="result-title" style="font-size:1.2rem;font-weight:700;margin-bottom:6px"></h2>
      <p id="result-text" style="color:#888;font-size:0.9rem"></p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:28px;padding-top:16px;border-top:1px solid #222">
      <span style="font-size:0.8rem;color:#555">Powered by SparkUI ⚡</span>
    </div>

    <style>
      @keyframes popIn { 0%{transform:scale(0.9);opacity:0} 100%{transform:scale(1);opacity:1} }
      .action-btn:hover { transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.3); }
      .action-btn:active { transform:translateY(0); }
    </style>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var requireComment = ${requireComment};
      var pendingAction = null;

      var actionBtns = document.querySelectorAll('.action-btn');
      var confirmDialog = document.getElementById('confirm-dialog');
      var confirmCancel = document.getElementById('confirm-cancel');
      var confirmYes = document.getElementById('confirm-yes');

      var confirmMessages = {
        approved: { icon: '✅', title: 'Approve this request?', text: 'This action will be sent to the requester.', btnText: 'Approve', btnColor: '#22c55e' },
        rejected: { icon: '❌', title: 'Reject this request?', text: 'The requester will be notified.', btnText: 'Reject', btnColor: '#ef4444' },
        changes_requested: { icon: '🔄', title: 'Request changes?', text: 'The requester will receive your feedback.', btnText: 'Send Feedback', btnColor: '#6366f1' },
      };

      var resultMessages = {
        approved: { icon: '✅', title: 'Approved', color: '#22c55e' },
        rejected: { icon: '❌', title: 'Rejected', color: '#ef4444' },
        changes_requested: { icon: '🔄', title: 'Changes Requested', color: '#6366f1' },
      };

      actionBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var action = this.getAttribute('data-action');
          var comment = document.getElementById('comment-field').value.trim();

          if (requireComment && !comment) {
            document.getElementById('comment-field').style.borderColor = '#ef4444';
            document.getElementById('comment-field').focus();
            document.getElementById('comment-field').setAttribute('placeholder', 'A comment is required...');
            return;
          }

          // Show confirmation
          pendingAction = action;
          var msg = confirmMessages[action];
          document.getElementById('confirm-icon').textContent = msg.icon;
          document.getElementById('confirm-title').textContent = msg.title;
          document.getElementById('confirm-text').textContent = msg.text;
          confirmYes.textContent = msg.btnText;
          confirmYes.style.background = msg.btnColor;
          confirmYes.style.color = '#fff';
          confirmDialog.style.display = 'flex';
        });
      });

      confirmCancel.addEventListener('click', function() {
        confirmDialog.style.display = 'none';
        pendingAction = null;
      });

      confirmDialog.addEventListener('click', function(e) {
        if (e.target === this) { this.style.display = 'none'; pendingAction = null; }
      });

      confirmYes.addEventListener('click', function() {
        if (!pendingAction) return;
        confirmDialog.style.display = 'none';

        var comment = document.getElementById('comment-field').value.trim();
        var payload = {
          action: pendingAction,
          decision: pendingAction,
          comment: comment,
          decidedAt: new Date().toISOString()
        };

        // Send via WS
        if (window.sparkui) {
          sparkui.sendCompletion(payload);
        }

        // Update UI
        document.getElementById('action-buttons').style.display = 'none';
        document.getElementById('comment-section').style.display = 'none';

        var rm = resultMessages[pendingAction];
        document.getElementById('result-icon').textContent = rm.icon;
        document.getElementById('result-title').style.color = rm.color;
        document.getElementById('result-title').textContent = rm.title;
        document.getElementById('result-text').textContent = comment ? 'Comment: "' + comment + '"' : 'Your decision has been recorded.';
        document.getElementById('result-state').style.display = 'block';

        // Update status badge
        var badge = document.getElementById('status-badge');
        badge.style.background = rm.color + '22';
        badge.style.borderColor = rm.color + '33';
        badge.style.color = rm.color;
        badge.innerHTML = '<span>' + rm.icon + '</span> ' + rm.title;

        pendingAction = null;
      });

      // WS updates
      if (window.sparkui) {
        sparkui.onMessage(function(msg) {
          if (msg.type === 'update' && msg.data && msg.data.status) {
            // External status update
            var rm = resultMessages[msg.data.status];
            if (rm) {
              document.getElementById('action-buttons').style.display = 'none';
              document.getElementById('comment-section').style.display = 'none';
              var badge = document.getElementById('status-badge');
              badge.style.background = rm.color + '22';
              badge.style.borderColor = rm.color + '33';
              badge.style.color = rm.color;
              badge.innerHTML = '<span>' + rm.icon + '</span> ' + rm.title;
            }
          }
        });
      }
    });
    </script>
  `;

  const og = {
    title: _og.title || '📋 ' + title,
    description: _og.description || 'Approval request' + (requester ? ' from ' + requester : ''),
    image: _og.image,
    url: _og.url,
  };

  return base({
    title: 'Approval — ' + title,
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

approvalFlow.schema = {
  type: 'object',
  description: 'Approval request page with Approve/Reject/Request Changes actions, optional comment, and status tracking.',
  properties: {
    title: { type: 'string', description: 'Request title', example: 'Q2 Marketing Budget' },
    description: { type: 'string', description: 'Request description', example: 'Budget increase for digital campaigns' },
    requester: { type: 'string', description: 'Who submitted the request', example: 'Jane Smith' },
    amount: { type: 'string', description: 'Amount or impact level', example: '$5,000' },
    status: { type: 'string', description: 'Current status', enum: ['pending', 'approved', 'rejected', 'changes_requested'], default: 'pending' },
    details: {
      type: 'array',
      description: 'Key-value detail rows',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Detail label', example: 'Department' },
          value: { type: 'string', description: 'Detail value', example: 'Marketing' },
        },
        required: ['label', 'value'],
      },
    },
    requireComment: { type: 'boolean', description: 'Require comment before action', default: false },
    showRequestChanges: { type: 'boolean', description: 'Show "Request Changes" button', default: true },
    urgency: { type: 'string', description: 'Urgency level', enum: ['low', 'medium', 'high', 'critical'] },
  },
  required: ['title'],
  example: {
    title: 'New Server Purchase',
    description: 'Need to provision 3 additional servers for scaling',
    requester: 'Ryan Eade',
    amount: '$12,000',
    status: 'pending',
    urgency: 'high',
    details: [
      { label: 'Department', value: 'Engineering' },
      { label: 'Priority', value: 'P1' },
      { label: 'Deadline', value: '2026-04-15' },
    ],
    requireComment: true,
  },
};

module.exports = approvalFlow;
