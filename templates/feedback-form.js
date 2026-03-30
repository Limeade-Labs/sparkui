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

    <form id="feedback-form" style="background:#1a1a1a;padding:20px;border-radius:12px;border:1px solid #222">
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
      <p style="color:#888">Your feedback has been submitted.</p>
    </div>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var selectedRating = 0;
      var stars = document.querySelectorAll('.star-btn');

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

        var formData = {
          rating: rating,
          feedback: document.getElementById('feedback-text').value,
          submittedAt: new Date().toISOString()
        };

        ${extraFieldsJs}

        // Send completion via WS
        if (window.sparkui) {
          sparkui.sendCompletion(formData);
        }

        // Show success
        document.getElementById('feedback-form').style.display = 'none';
        document.getElementById('success-msg').style.display = 'block';
      });
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
