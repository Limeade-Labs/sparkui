'use strict';

const base = require('./base');

/**
 * Comparison template.
 * Side-by-side product/option comparison with feature matrix,
 * best-value highlights, responsive stacking on mobile. 2-5 items.
 *
 * @param {object} data
 * @param {string} [data.title] - Comparison title
 * @param {string} [data.subtitle] - Subtitle text
 * @param {Array<{name:string,image?:string,price?:string,rating?:number,recommended?:boolean,pros?:string[],cons?:string[],features?:object,link?:string,badge?:string}>} data.items
 * @param {string[]} [data.featureLabels] - Feature names for the comparison matrix
 * @param {string} [data._pageId]
 * @param {object} [data._og]
 * @returns {string} Full HTML page
 */
function comparison(data = {}) {
  const pageId = data._pageId || 'unknown';
  const _og = data._og || {};
  const title = data.title || 'Compare Options';
  const subtitle = data.subtitle || '';
  const items = (data.items || []).slice(0, 5);
  const featureLabels = data.featureLabels || [];

  // Auto-detect feature labels from items if not provided
  const allFeatures = featureLabels.length > 0 ? featureLabels :
    [...new Set(items.flatMap(item => Object.keys(item.features || {})))];

  const itemsJson = JSON.stringify(items);
  const featuresJson = JSON.stringify(allFeatures);
  const itemCount = items.length;

  const body = `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:2rem;margin-bottom:8px">⚖️</div>
      <h1 style="font-size:1.4rem;font-weight:700;color:#fff;margin-bottom:6px">${escHtml(title)}</h1>
      ${subtitle ? `<p style="color:#888;font-size:0.9rem">${escHtml(subtitle)}</p>` : ''}
    </div>

    <!-- Cards view (mobile + default) -->
    <div id="cards-view">
      ${items.map((item, i) => {
        const isRec = item.recommended;
        const borderColor = isRec ? '#00ff88' : '#2a2a2a';
        const stars = item.rating ? renderStars(item.rating) : '';
        const badge = item.badge || (isRec ? '⭐ Recommended' : '');

        return `
        <div class="compare-card" style="background:#1a1a1a;border:2px solid ${borderColor};border-radius:12px;padding:20px;margin-bottom:16px;position:relative;${isRec ? 'box-shadow:0 0 20px rgba(0,255,136,0.1)' : ''};animation:fadeInCard 0.4s ease ${i * 0.1}s both">
          ${badge ? `<div style="position:absolute;top:-1px;right:16px;background:${isRec ? '#00ff88' : '#6366f1'};color:#111;font-size:0.75rem;font-weight:700;padding:4px 12px;border-radius:0 0 8px 8px">${escHtml(badge)}</div>` : ''}

          <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;${badge ? 'margin-top:8px' : ''}">
            ${item.image ? (item.image.length <= 4
              ? `<div style="font-size:2.5rem;width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:#111;border-radius:10px;flex-shrink:0">${item.image}</div>`
              : `<img src="${escHtml(item.image)}" alt="${escHtml(item.name)}" style="width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#111">`)
            : ''}
            <div style="flex:1;min-width:0">
              <h3 style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:2px">${escHtml(item.name)}</h3>
              ${stars ? `<div style="font-size:0.85rem">${stars}</div>` : ''}
            </div>
            ${item.price ? `<div style="font-size:1.3rem;font-weight:700;color:#fff;flex-shrink:0">${escHtml(item.price)}</div>` : ''}
          </div>

          <!-- Features for this item -->
          ${allFeatures.length > 0 ? `
          <div style="margin-bottom:16px">
            ${allFeatures.map(f => {
              const val = (item.features || {})[f];
              const display = renderFeatureValue(val);
              return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222">
                <span style="color:#888;font-size:0.85rem">${escHtml(f)}</span>
                <span style="color:#eee;font-size:0.85rem;font-weight:500">${display}</span>
              </div>`;
            }).join('')}
          </div>` : ''}

          <!-- Pros/Cons -->
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${(item.pros && item.pros.length) ? `
            <div style="flex:1;min-width:120px">
              <div style="font-size:0.75rem;color:#22c55e;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Pros</div>
              ${item.pros.map(p => `<div style="font-size:0.85rem;color:#aaa;padding:3px 0;display:flex;align-items:start;gap:6px"><span style="color:#22c55e;flex-shrink:0">+</span> ${escHtml(p)}</div>`).join('')}
            </div>` : ''}
            ${(item.cons && item.cons.length) ? `
            <div style="flex:1;min-width:120px">
              <div style="font-size:0.75rem;color:#ef4444;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Cons</div>
              ${item.cons.map(c => `<div style="font-size:0.85rem;color:#aaa;padding:3px 0;display:flex;align-items:start;gap:6px"><span style="color:#ef4444;flex-shrink:0">−</span> ${escHtml(c)}</div>`).join('')}
            </div>` : ''}
          </div>

          ${item.link ? `
          <a href="${escHtml(item.link)}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:16px;padding:10px;border-radius:8px;border:1px solid ${isRec ? '#00ff88' : '#333'};background:${isRec ? '#00ff8811' : 'transparent'};color:${isRec ? '#00ff88' : '#888'};font-size:0.9rem;font-weight:500;text-decoration:none;transition:all 0.2s" onmouseover="this.style.borderColor='#00ff88';this.style.color='#00ff88'" onmouseout="this.style.borderColor='${isRec ? '#00ff88' : '#333'}';this.style.color='${isRec ? '#00ff88' : '#888'}'">
            View Details →
          </a>` : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Feature matrix table (desktop, toggleable) -->
    ${allFeatures.length > 0 && itemCount >= 2 ? `
    <div id="matrix-toggle" style="text-align:center;margin-bottom:16px">
      <button id="toggle-matrix-btn" style="padding:8px 20px;border-radius:20px;border:1px solid #333;background:transparent;color:#888;font-size:0.85rem;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;gap:6px" onmouseover="this.style.borderColor='#6366f1';this.style.color='#6366f1'" onmouseout="this.style.borderColor='#333';this.style.color='#888'">
        📊 Show Comparison Table
      </button>
    </div>
    <div id="matrix-view" style="display:none;overflow-x:auto;margin-bottom:24px;animation:fadeInCard 0.3s ease">
      <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a">
        <thead>
          <tr style="background:#111">
            <th style="padding:14px 12px;text-align:left;color:#888;font-size:0.8rem;font-weight:600;border-bottom:1px solid #2a2a2a;min-width:100px">Feature</th>
            ${items.map(item => `<th style="padding:14px 12px;text-align:center;color:${item.recommended ? '#00ff88' : '#eee'};font-size:0.85rem;font-weight:600;border-bottom:1px solid #2a2a2a;min-width:100px">${escHtml(item.name)}${item.recommended ? ' ⭐' : ''}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${item_price_row(items)}
          ${item_rating_row(items)}
          ${allFeatures.map((f, fi) => `
          <tr style="background:${fi % 2 === 0 ? 'transparent' : '#11111180'}">
            <td style="padding:10px 12px;color:#888;font-size:0.85rem;border-bottom:1px solid #1a1a1a">${escHtml(f)}</td>
            ${items.map(item => {
              const val = (item.features || {})[f];
              return `<td style="padding:10px 12px;text-align:center;color:#eee;font-size:0.85rem;border-bottom:1px solid #1a1a1a">${renderFeatureValue(val)}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Selection button -->
    <div id="select-section" style="text-align:center;margin-top:8px;margin-bottom:16px">
      ${items.map((item, i) => `
      <button class="select-btn" data-idx="${i}" style="display:inline-block;margin:4px;padding:10px 20px;border-radius:20px;border:1px solid #333;background:transparent;color:#aaa;font-size:0.85rem;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='#00ff88';this.style.color='#00ff88'" onmouseout="if(!this.classList.contains('chosen')){this.style.borderColor='#333';this.style.color='#aaa'}">
        Choose ${escHtml(item.name)}
      </button>`).join('')}
    </div>

    <!-- Chosen confirmation (hidden) -->
    <div id="chosen-msg" style="display:none;text-align:center;padding:24px;background:#1a1a1a;border-radius:12px;border:1px solid #00ff8833;margin-top:16px">
      <div style="font-size:2rem;margin-bottom:8px;animation:popIn 0.3s ease">🎯</div>
      <p id="chosen-text" style="color:#00ff88;font-size:1rem;font-weight:600"></p>
      <p style="color:#666;font-size:0.85rem;margin-top:4px">Your choice has been recorded</p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:28px;padding-top:16px;border-top:1px solid #222">
      <span style="font-size:0.8rem;color:#555">Powered by SparkUI ⚡</span>
    </div>

    <style>
      @keyframes fadeInCard { 0%{opacity:0;transform:translateY(12px)} 100%{opacity:1;transform:translateY(0)} }
      @keyframes popIn { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
      .select-btn.chosen { border-color:#00ff88!important;color:#00ff88!important;background:#00ff8811!important; }
    </style>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var items = ${itemsJson};

      // Matrix toggle
      var toggleBtn = document.getElementById('toggle-matrix-btn');
      var matrixView = document.getElementById('matrix-view');
      if (toggleBtn && matrixView) {
        var showing = false;
        toggleBtn.addEventListener('click', function() {
          showing = !showing;
          matrixView.style.display = showing ? 'block' : 'none';
          toggleBtn.innerHTML = showing ? '📊 Hide Comparison Table' : '📊 Show Comparison Table';
        });
      }

      // Selection buttons
      var selectBtns = document.querySelectorAll('.select-btn');
      selectBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(this.getAttribute('data-idx'));
          var item = items[idx];
          if (!item) return;

          // Highlight chosen
          selectBtns.forEach(function(b) { b.classList.remove('chosen'); });
          this.classList.add('chosen');

          // Show confirmation
          document.getElementById('chosen-text').textContent = 'You chose: ' + item.name;
          document.getElementById('chosen-msg').style.display = 'block';

          // Send via WS
          if (window.sparkui) {
            sparkui.sendCompletion({
              action: 'selection',
              selectedIndex: idx,
              selectedItem: item.name,
              selectedAt: new Date().toISOString()
            });
          }
        });
      });
    });
    </script>
  `;

  const og = {
    title: _og.title || '⚖️ ' + title,
    description: _og.description || 'Compare ' + items.map(i => i.name).join(' vs '),
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

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  let stars = '<span style="color:#f59e0b">';
  for (let i = 0; i < full; i++) stars += '★';
  if (half) stars += '½';
  for (let i = 0; i < empty; i++) stars += '<span style="color:#333">★</span>';
  stars += '</span>';
  stars += ` <span style="color:#888;font-size:0.8rem">${rating}</span>`;
  return stars;
}

function renderFeatureValue(val) {
  if (val === true) return '<span style="color:#22c55e;font-size:1rem">✓</span>';
  if (val === false) return '<span style="color:#555;font-size:1rem">✗</span>';
  if (val === null || val === undefined) return '<span style="color:#333">—</span>';
  return escHtml(String(val));
}

function item_price_row(items) {
  const hasPrice = items.some(i => i.price);
  if (!hasPrice) return '';
  return `<tr style="background:#11111180">
    <td style="padding:10px 12px;color:#888;font-size:0.85rem;font-weight:600;border-bottom:1px solid #1a1a1a">Price</td>
    ${items.map(item => `<td style="padding:10px 12px;text-align:center;color:#fff;font-size:0.95rem;font-weight:700;border-bottom:1px solid #1a1a1a">${item.price ? escHtml(item.price) : '—'}</td>`).join('')}
  </tr>`;
}

function item_rating_row(items) {
  const hasRating = items.some(i => i.rating);
  if (!hasRating) return '';
  return `<tr>
    <td style="padding:10px 12px;color:#888;font-size:0.85rem;font-weight:600;border-bottom:1px solid #1a1a1a">Rating</td>
    ${items.map(item => `<td style="padding:10px 12px;text-align:center;border-bottom:1px solid #1a1a1a">${item.rating ? renderStars(item.rating) : '—'}</td>`).join('')}
  </tr>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = comparison;
