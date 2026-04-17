'use strict';

const base = require('./base');

/**
 * Feedback form template.
 * Simple form: rating 1-5, text feedback, submit.
 * Sends a completion event with form data on submit.
 */
function feedbackForm(data = {}) {
  const pageId = data._pageId || 'unknown';
  const title = data.title || data.name || data.label || 'Feedback';
  const subtitle = data.subtitle || 'We\'d love to hear from you.';
  const questions = data.questions || null; // optional array of extra text fields
  const collectName = !!data.collectName;
  const _og = data._og || {};

  let extraFields = '';
  let extraFieldsJs = '';
  if (questions && Array.isArray(questions)) {
    questions.forEach((q, i) => {
      const fieldId = `extra-field-${i}`;
      extraFields += `
        <label style="display:block;margin-bottom:6px;color:#aaa;font-size:0.9rem">${q}</label>
        <input id="${fieldId}" type="text" placeholder="Your answer" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#eee;font-size:1rem;margin-bottom:16px;outline:none" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#333'">
      `;
      extraFieldsJs += `formData['${q.replace(/'/g, "\\'")}'] = document.getElementById('${fieldId}').value;\n`;
    });
  }

  const body = `
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="font-size:1.5rem;margin-bottom:6px">📝 ${title}</h1>
      <p style="color:#888;font-size:0.95rem">${subtitle}</p>
    </div>

    <!-- Response count -->
    <div id="response-count" style="text-align:center;margin-bottom:8px;color:#666;font-size:0.85rem"></div>

    <!-- Multi-respondent hint -->
    <p style="text-align:center;margin-bottom:16px;color:#555;font-size:0.75rem">Each browser can submit independently — share this link to collect more responses.</p>

    <form id="feedback-form" style="background:#1a1a1a;padding:20px;border-radius:12px;border:1px solid #222">
      <!-- Name (optional) -->
      <div id="name-section" style="display:${collectName ? 'block' : 'none'};margin-bottom:16px">
        <label style="display:block;margin-bottom:6px;color:#aaa;font-size:0.9rem">Your name</label>
        <input id="respondent-name" type="text" placeholder="Enter your name" style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #333;background:#111;color:#eee;font-size:1rem;outline:none" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#333'">
      </div>

      <!-- Rating -->
      <label style="display:block;margin-bottom:10px;color:#aaa;font-size:0.9rem">Rating</label>
      <div id="star-rating" style="display:flex;gap:8px;margin-bottom:20px;justify-content:center">
        <button type="button" class="star-btn" data-value="1" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.3;transition:opacity 0.2s">⭐</button>
        <button type="button" class="star-btn" data-value="2" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.3;transition:opacity 0.2s">⭐</button>
        <button type="button" class="star-btn" data-value="3" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.3;transition:opacity 0.2s">⭐</button>
        <button type="button" class="star-btn" data-value="4" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.3;transition:opacity 0.2s">⭐</button>
        <button type="button" class="star-btn" data-value="5" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.3;transition:opacity 0.2s">⭐</button>
      </div>
      <input type="hidden" id="rating-value" value="0">

      <!-- Feedback text -->
      <label style="display:block;margin-bottom:6px;color:#aaa;font-size:0.9rem">Feedback</label>
      <textarea id="feedback-text" rows="4" placeholder="Tell us what you think..." style="width:100%;padding:10px 12px;border-radius:6px;border:1px solid #333;background:#111;color:#eee;font-size:1rem;margin-bottom:16px;resize:vertical;outline:none;font-family:inherit" onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#333'"></textarea>

      ${extraFields}

      <!-- Submit -->
      <button type="submit" id="submit-btn" style="width:100%;padding:12px;border-radius:8px;border:none;background:#059669;color:#fff;font-size:1.05rem;cursor:pointer;font-weight:600;transition:background 0.2s" onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">
        Submit Feedback
      </button>
    </form>

    <!-- Success state (hidden) -->
    <div id="success-msg" style="display:none;text-align:center;padding:40px 20px">
      <div style="font-size:3rem;margin-bottom:12px">✅</div>
      <h2 style="font-size:1.3rem;margin-bottom:8px">Thank you!</h2>
      <p style="color:#888;margin-bottom:12px">Your feedback has been submitted.</p>
      <div id="your-submission" style="display:none;text-align:left;background:#1a1a1a;padding:16px;border-radius:10px;border:1px solid #222;margin-top:12px">
        <p style="color:#666;font-size:0.8rem;margin-bottom:8px">Your submission:</p>
        <div id="your-rating" style="color:#eee;font-size:0.9rem;margin-bottom:4px"></div>
        <div id="your-feedback" style="color:#aaa;font-size:0.85rem;font-style:italic"></div>
      </div>
      <p style="color:#555;font-size:0.8rem;margin-top:16px">Different people can submit from different browsers.</p>
    </div>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var selectedRating = 0;
      var collectName = ${collectName};
      var pageId = ${JSON.stringify(pageId)};
      var LS_KEY = 'sparkui_feedback_' + pageId;
      var responseCount = 0;
      var stars = document.querySelectorAll('.star-btn');
      var responseCountEl = document.getElementById('response-count');

      function updateStars(value) {
        stars.forEach(function(s) {
          s.style.opacity = parseInt(s.getAttribute('data-value')) <= value ? '1' : '0.3';
        });
      }

      stars.forEach(function(star) {
        star.addEventListener('click', function() {
          selectedRating = parseInt(this.getAttribute('data-value'));
          document.getElementById('rating-value').value = selectedRating;
          updateStars(selectedRating);
        });
        star.addEventListener('mouseenter', function() {
          updateStars(parseInt(this.getAttribute('data-value')));
        });
        star.addEventListener('mouseleave', function() {
          updateStars(selectedRating);
        });
      });

      document.getElementById('feedback-form').addEventListener('submit', function(e) {
        e.preventDefault();

        var rating = parseInt(document.getElementById('rating-value').value);
        if (rating === 0) {
          alert('Please select a rating');
          return;
        }

        var feedbackText = document.getElementById('feedback-text').value;
        var formData = {
          rating: rating,
          feedback: feedbackText,
          submittedAt: new Date().toISOString()
        };

        if (collectName) {
          formData.name = document.getElementById('respondent-name').value.trim();
        }

        ${extraFieldsJs}

        // Send completion via WS
        if (window.sparkui) {
          sparkui.sendCompletion(formData);
        }

        // Increment response count
        responseCount++;

        // Save state (with response count)
        if (window.sparkui && sparkui.saveState) {
          sparkui.saveState({ submitted: true, rating: formData.rating, feedback: formData.feedback, responseCount: responseCount });
        }

        // Store own submission in localStorage
        try {
          localStorage.setItem(LS_KEY, JSON.stringify({ rating: rating, feedback: feedbackText }));
        } catch(e) {}

        // Show success with submission details
        document.getElementById('feedback-form').style.display = 'none';
        document.getElementById('success-msg').style.display = 'block';
        showOwnSubmission(rating, feedbackText);
        updateResponseCount();
      });

      function showOwnSubmission(rating, feedback) {
        var sub = document.getElementById('your-submission');
        if (rating || feedback) {
          sub.style.display = 'block';
          var stars = '';
          for (var s = 0; s < rating; s++) stars += '\u2B50';
          document.getElementById('your-rating').textContent = 'Rating: ' + stars + ' (' + rating + '/5)';
          if (feedback) {
            document.getElementById('your-feedback').textContent = '"' + feedback + '"';
          }
        }
      }

      function updateResponseCount() {
        if (responseCount > 0) {
          responseCountEl.textContent = responseCount + (responseCount === 1 ? ' response' : ' responses') + ' collected';
        }
      }

      // Check localStorage for previous submission — act immediately (no server round-trip)
      var localSubmission = null;
      try {
        var stored = localStorage.getItem(LS_KEY);
        if (stored) localSubmission = JSON.parse(stored);
      } catch(e) {}

      if (localSubmission) {
        document.getElementById('feedback-form').style.display = 'none';
        document.getElementById('success-msg').style.display = 'block';
        showOwnSubmission(localSubmission.rating, localSubmission.feedback);
      }

      // Load persisted state (for response count + server-side data)
      if (window.sparkui && sparkui.loadState) {
        sparkui.loadState().then(function(state) {
          if (state && state.responseCount) {
            responseCount = state.responseCount;
            updateResponseCount();
          }
          if (!localSubmission && state && state.submitted) {
            // Server says submitted but no local record — different browser submitted
            // Show the form (this browser hasn't submitted yet)
            updateResponseCount();
          }
        });
      } else if (localSubmission) {
        // sparkui not available but we already handled localStorage above
        showOwnSubmission(localSubmission.rating, localSubmission.feedback);
      }
    });
    </script>
  `;

  const og = {
    title: _og.title || title,
    description: _og.description || 'Quick feedback form — share your thoughts ⚡',
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

feedbackForm.schema = {
  type: 'object',
  description: 'Feedback form with star rating (1-5), text feedback, optional extra questions.',
  properties: {
    title: { type: 'string', description: 'Form title', default: 'Feedback', example: 'How was your experience?' },
    subtitle: { type: 'string', description: 'Subtitle text', default: "We'd love to hear from you.", example: 'Your feedback helps us improve' },
    collectName: { type: 'boolean', description: 'Show a name input field', default: false },
    questions: {
      type: 'array',
      description: 'Optional extra text fields (labels)',
      items: { type: 'string' },
      example: ['What feature do you want most?', 'How did you hear about us?'],
    },
  },
  required: [],
  example: {
    title: 'Product Feedback',
    subtitle: 'Tell us what you think',
    questions: ['What could we improve?'],
  },
};

module.exports = feedbackForm;
