'use strict';

const base = require('./base');

/**
 * Shopping List template.
 * Categorized, checkable items with real-time WebSocket sync,
 * dynamic add, quantities, notes, and share link support.
 *
 * @param {object} data
 * @param {string} [data.title] - List title
 * @param {Array<{category?:string,name:string,quantity?:string,notes?:string,checked?:boolean}>} data.items
 * @param {boolean} [data.allowAdd=true] - Allow adding items dynamically
 * @param {boolean} [data.collaborative=false] - Show share/collab indicator
 * @param {string} [data._pageId]
 * @param {object} [data._og]
 * @returns {string} Full HTML page
 */
function shoppingList(data = {}) {
  const pageId = data._pageId || 'unknown';
  const _og = data._og || {};
  const title = data.title || 'Shopping List';
  const allowAdd = data.allowAdd !== false;
  const collaborative = !!data.collaborative;

  // Normalize items with categories
  const items = (data.items || []).map((item, i) => ({
    id: i,
    category: item.category || 'Other',
    name: item.name || item.title || item.label || item.item || 'Item',
    quantity: item.quantity || '',
    notes: item.notes || '',
    checked: !!item.checked,
  }));

  const itemsJson = JSON.stringify(items);

  const categoryIcons = {
    'Produce': '🥬', 'Fruits': '🍎', 'Dairy': '🧀', 'Meat': '🥩',
    'Seafood': '🐟', 'Bakery': '🍞', 'Frozen': '🧊', 'Beverages': '🥤',
    'Snacks': '🍿', 'Pantry': '🫙', 'Household': '🧹', 'Personal Care': '🧴',
    'Other': '📦', 'Deli': '🥪', 'Condiments': '🫗', 'Spices': '🌿',
  };
  const iconsJson = JSON.stringify(categoryIcons);

  const body = `
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 style="font-size:1.4rem;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px">
          🛒 ${escHtml(title)}
        </h1>
        <p id="progress-text" style="color:#888;font-size:0.85rem;margin-top:4px">0 / 0 items</p>
      </div>
      ${collaborative ? `
      <div style="display:flex;align-items:center;gap:6px;background:#1a1a1a;padding:6px 12px;border-radius:20px;border:1px solid #333">
        <div style="width:8px;height:8px;border-radius:50%;background:#00ff88;animation:pulse 2s infinite"></div>
        <span style="font-size:0.8rem;color:#888">Live</span>
      </div>` : ''}
    </div>

    <!-- Progress bar -->
    <div style="height:4px;background:#222;border-radius:2px;margin-bottom:24px;overflow:hidden">
      <div id="progress-bar" style="height:100%;background:linear-gradient(90deg,#00ff88,#22c55e);width:0%;transition:width 0.4s ease;border-radius:2px"></div>
    </div>

    <!-- Add item form -->
    ${allowAdd ? `
    <div id="add-form" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:24px">
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input id="add-name" type="text" placeholder="Add item..." style="flex:1;padding:10px 14px;border-radius:8px;border:1px solid #333;background:#111;color:#eee;font-size:0.95rem;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
        <button id="add-btn" style="padding:10px 18px;border-radius:8px;border:none;background:#00ff88;color:#111;font-weight:700;font-size:1.1rem;cursor:pointer;transition:background 0.2s" onclick="">+</button>
      </div>
      <div style="display:flex;gap:8px">
        <select id="add-category" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #333;background:#111;color:#aaa;font-size:0.85rem;outline:none;cursor:pointer">
          <option value="Other">Category...</option>
          <option value="Produce">🥬 Produce</option>
          <option value="Fruits">🍎 Fruits</option>
          <option value="Dairy">🧀 Dairy</option>
          <option value="Meat">🥩 Meat</option>
          <option value="Seafood">🐟 Seafood</option>
          <option value="Bakery">🍞 Bakery</option>
          <option value="Frozen">🧊 Frozen</option>
          <option value="Beverages">🥤 Beverages</option>
          <option value="Snacks">🍿 Snacks</option>
          <option value="Pantry">🫙 Pantry</option>
          <option value="Household">🧹 Household</option>
          <option value="Other">📦 Other</option>
        </select>
        <input id="add-qty" type="text" placeholder="Qty" style="width:60px;padding:8px 10px;border-radius:8px;border:1px solid #333;background:#111;color:#aaa;font-size:0.85rem;outline:none;text-align:center" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
        <input id="add-notes" type="text" placeholder="Notes" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #333;background:#111;color:#aaa;font-size:0.85rem;outline:none" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
      </div>
    </div>` : ''}

    <!-- Items list -->
    <div id="items-container"></div>

    <!-- Share button -->
    <div style="text-align:center;margin-top:24px">
      <button id="share-btn" style="padding:10px 24px;border-radius:20px;border:1px solid #333;background:transparent;color:#888;font-size:0.85rem;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;gap:6px" onmouseover="this.style.borderColor='#00ff88';this.style.color='#00ff88'" onmouseout="this.style.borderColor='#333';this.style.color='#888'">
        📋 Copy Share Link
      </button>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid #222">
      <span style="font-size:0.8rem;color:#555">Powered by SparkUI ⚡</span>
    </div>

    <style>
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      @keyframes fadeIn { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
      @keyframes strikeAnim { 0%{width:0} 100%{width:100%} }
      .category-group { margin-bottom:20px; }
      .category-header {
        font-size:0.8rem;font-weight:600;color:#888;text-transform:uppercase;
        letter-spacing:0.08em;padding:8px 0;border-bottom:1px solid #222;margin-bottom:8px;
        display:flex;align-items:center;gap:6px;
      }
      .shop-item {
        display:flex;align-items:center;gap:12px;padding:12px 8px;
        border-radius:8px;transition:all 0.2s;cursor:pointer;
      }
      .shop-item:hover { background:#1a1a1a; }
      .shop-item.checked .item-name { color:#555;text-decoration:line-through; }
      .shop-item .item-check {
        width:24px;height:24px;border-radius:50%;border:2px solid #444;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        transition:all 0.2s;
      }
      .shop-item.checked .item-check { border-color:#00ff88;background:#00ff88; }
      .shop-item .item-details { flex:1;min-width:0; }
      .shop-item .item-name { color:#eee;font-size:0.95rem;transition:all 0.3s; }
      .shop-item .item-meta { color:#666;font-size:0.8rem;margin-top:2px; }
      .shop-item .item-qty {
        background:#222;color:#aaa;font-size:0.8rem;padding:2px 8px;
        border-radius:4px;flex-shrink:0;
      }
    </style>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var items = ${itemsJson};
      var icons = ${iconsJson};
      var nextId = items.length;
      var container = document.getElementById('items-container');

      function render() {
        // Group by category
        var groups = {};
        items.forEach(function(item) {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category].push(item);
        });

        container.innerHTML = '';
        var sortedCats = Object.keys(groups).sort(function(a,b) {
          if (a === 'Other') return 1;
          if (b === 'Other') return -1;
          return a.localeCompare(b);
        });

        sortedCats.forEach(function(cat) {
          var section = document.createElement('div');
          section.className = 'category-group';
          var icon = icons[cat] || '📦';
          section.innerHTML = '<div class="category-header"><span>' + icon + '</span> ' + escH(cat) + ' <span style="color:#555;font-weight:400;font-size:0.75rem">(' + groups[cat].length + ')</span></div>';

          groups[cat].forEach(function(item) {
            var row = document.createElement('div');
            row.className = 'shop-item' + (item.checked ? ' checked' : '');
            row.setAttribute('data-id', item.id);

            var meta = [];
            if (item.notes) meta.push(item.notes);

            row.innerHTML =
              '<div class="item-check">' +
                (item.checked ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="#111" stroke-width="2.5" stroke-linecap="round"/></svg>' : '') +
              '</div>' +
              '<div class="item-details">' +
                '<div class="item-name">' + escH(item.name) + '</div>' +
                (meta.length ? '<div class="item-meta">' + escH(meta.join(' · ')) + '</div>' : '') +
              '</div>' +
              (item.quantity ? '<span class="item-qty">' + escH(item.quantity) + '</span>' : '');

            row.addEventListener('click', function() {
              var id = parseInt(this.getAttribute('data-id'));
              toggleItem(id);
            });

            section.appendChild(row);
          });

          container.appendChild(section);
        });

        updateProgress();
      }

      function toggleItem(id) {
        var item = items.find(function(i) { return i.id === id; });
        if (!item) return;
        item.checked = !item.checked;
        render();
        saveItems();

        if (window.sparkui) {
          sparkui.send('event', {
            action: 'item_toggle',
            itemId: id,
            name: item.name,
            checked: item.checked
          });

          // Check if all done
          var allChecked = items.length > 0 && items.every(function(i) { return i.checked; });
          if (allChecked) {
            sparkui.sendCompletion({
              action: 'list_complete',
              items: items,
              completedAt: new Date().toISOString()
            });
          }
        }
      }

      function updateProgress() {
        var total = items.length;
        var done = items.filter(function(i) { return i.checked; }).length;
        var pct = total > 0 ? Math.round((done / total) * 100) : 0;
        document.getElementById('progress-text').textContent = done + ' / ' + total + ' items';
        document.getElementById('progress-bar').style.width = pct + '%';
      }

      // Add item
      var addBtn = document.getElementById('add-btn');
      var addName = document.getElementById('add-name');
      if (addBtn && addName) {
        function addItem() {
          var name = addName.value.trim();
          if (!name) return;
          var cat = document.getElementById('add-category').value || 'Other';
          var qty = document.getElementById('add-qty').value.trim();
          var notes = document.getElementById('add-notes').value.trim();

          var newItem = {
            id: nextId++,
            category: cat,
            name: name,
            quantity: qty,
            notes: notes,
            checked: false,
          };
          items.push(newItem);
          render();
          saveItems();

          // Clear inputs
          addName.value = '';
          document.getElementById('add-qty').value = '';
          document.getElementById('add-notes').value = '';
          addName.focus();

          if (window.sparkui) {
            sparkui.send('event', { action: 'item_added', item: newItem });
          }
        }
        addBtn.addEventListener('click', addItem);
        addName.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') addItem();
        });
      }

      // Share button
      var shareBtn = document.getElementById('share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', function() {
          var url = window.location.href;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(function() {
              shareBtn.innerHTML = '✅ Copied!';
              setTimeout(function() { shareBtn.innerHTML = '📋 Copy Share Link'; }, 2000);
            });
          } else {
            prompt('Share this link:', url);
          }
        });
      }

      // WebSocket updates
      if (window.sparkui) {
        sparkui.onMessage(function(msg) {
          if (msg.type === 'update' && msg.data && msg.data.items) {
            items = msg.data.items;
            nextId = items.length;
            render();
            saveItems();
          }
        });
      }

      function saveItems() {
        if (window.sparkui && sparkui.saveState) {
          sparkui.saveState({ items: items });
        }
      }

      function escH(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

      render();

      // Load persisted state
      if (window.sparkui && sparkui.loadState) {
        sparkui.loadState().then(function(state) {
          if (state && state.items && state.items.length > 0) {
            items = state.items;
            nextId = items.reduce(function(max, i) { return Math.max(max, (i.id || 0) + 1); }, items.length);
            render();
          }
        });
      }
    });
    </script>
  `;

  const og = {
    title: _og.title || '🛒 ' + title,
    description: _og.description || items.length + ' items to get',
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

shoppingList.schema = {
  type: 'object',
  description: 'Categorized shopping list with checkable items, real-time sync, and dynamic add.',
  properties: {
    title: { type: 'string', description: 'List title', default: 'Shopping List', example: 'Grocery Run' },
    items: {
      type: 'array',
      description: 'Shopping list items',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Item name', example: 'Avocados' },
          category: { type: 'string', description: 'Category (Produce, Dairy, Meat, Bakery, Frozen, Beverages, Snacks, Pantry, Household, Other)', default: 'Other', example: 'Produce' },
          quantity: { type: 'string', description: 'Quantity', example: '3' },
          notes: { type: 'string', description: 'Notes', example: 'Ripe ones' },
          checked: { type: 'boolean', description: 'Already checked off', default: false },
        },
        required: ['name'],
      },
    },
    allowAdd: { type: 'boolean', description: 'Allow adding items dynamically', default: true },
    collaborative: { type: 'boolean', description: 'Show live collaboration indicator', default: false },
  },
  required: ['items'],
  example: {
    title: 'Weekly Groceries',
    items: [
      { name: 'Avocados', category: 'Produce', quantity: '3' },
      { name: 'Chicken breast', category: 'Meat', quantity: '2 lbs' },
      { name: 'Almond milk', category: 'Dairy', quantity: '1' },
    ],
    allowAdd: true,
    collaborative: false,
  },
};

module.exports = shoppingList;
