'use strict';

const base = require('./base');

/**
 * Fake Stripe-style checkout template.
 * 100% cosmetic — no real payment processing. Demo only.
 *
 * Expected data shape:
 * {
 *   product: { name, description, price, image?, imageUrl? },
 *   shipping: 0,
 *   tax: 2.40,
 *   currency: "USD"  // optional, defaults to USD
 * }
 */
function checkout(data = {}) {
  const pageId = data._pageId || 'unknown';
  const _og = data._og || {};

  const product = data.product || {};
  const productName = product.name || 'Product';
  const productDesc = product.description || '';
  const productPrice = typeof product.price === 'number' ? product.price : 29.99;
  const productImage = product.imageUrl || product.image || '📦';
  const isEmoji = !product.imageUrl && productImage.length <= 4;

  const shipping = typeof data.shipping === 'number' ? data.shipping : 0;
  const tax = typeof data.tax === 'number' ? data.tax : 0;
  const currency = data.currency || 'USD';
  const currencySymbol = currency === 'USD' ? '$' : currency;

  const subtotal = productPrice;
  const total = (subtotal + shipping + tax).toFixed(2);

  const body = `
    <!-- DEMO Watermark -->
    <div style="position:fixed;top:0;left:0;right:0;z-index:1000;background:linear-gradient(90deg,#ff6b00,#ff8c00);color:#fff;text-align:center;font-size:0.75rem;padding:4px 0;font-weight:700;letter-spacing:2px">
      ⚠️ DEMO MODE — No real charges will be made
    </div>

    <!-- Security Banner -->
    <div style="margin-top:28px;background:#0a2a1a;border:1px solid #00ff8840;border-radius:8px;padding:12px 16px;text-align:center;font-size:0.85rem;color:#00ff88;margin-bottom:24px">
      🔒 Secure checkout — card details never touch your chat
    </div>

    <!-- Product Card -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:24px;display:flex;align-items:center;gap:16px">
      <div style="${isEmoji
        ? 'font-size:3rem;width:72px;height:72px;display:flex;align-items:center;justify-content:center;background:#111;border-radius:12px;flex-shrink:0'
        : 'width:72px;height:72px;border-radius:12px;overflow:hidden;flex-shrink:0;background:#111'}">
        ${isEmoji ? productImage : `<img src="${productImage}" alt="${productName}" style="width:100%;height:100%;object-fit:cover">`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:1.1rem;font-weight:600;color:#fff;margin-bottom:4px">${productName}</div>
        <div style="font-size:0.85rem;color:#888;line-height:1.4">${productDesc}</div>
      </div>
      <div style="font-size:1.25rem;font-weight:700;color:#fff;flex-shrink:0">${currencySymbol}${productPrice.toFixed(2)}</div>
    </div>

    <!-- Quantity -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding:0 4px">
      <span style="color:#aaa;font-size:0.9rem">Quantity</span>
      <div style="display:flex;align-items:center;gap:12px">
        <button id="qty-minus" type="button" style="width:32px;height:32px;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center">−</button>
        <span id="qty-display" style="font-size:1rem;font-weight:600;color:#fff;min-width:20px;text-align:center">1</span>
        <button id="qty-plus" type="button" style="width:32px;height:32px;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>
      </div>
    </div>

    <!-- Payment Section -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 style="font-size:1rem;font-weight:600;color:#fff;margin:0">Payment details</h2>
        <div style="display:flex;gap:6px;align-items:center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span style="font-size:0.75rem;color:#00ff88;font-weight:500">Secure</span>
        </div>
      </div>

      <!-- Card Number -->
      <label style="display:block;font-size:0.8rem;color:#888;margin-bottom:6px">Card number</label>
      <div style="position:relative;margin-bottom:14px">
        <input id="card-number" type="text" value="4242 4242 4242 4242" maxlength="19" style="width:100%;padding:12px 14px;padding-right:48px;border-radius:8px;border:1px solid #333;background:#222;color:#fff;font-size:1rem;font-family:monospace;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
        <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);display:flex;gap:4px">
          <svg width="24" height="16" viewBox="0 0 24 16" fill="none"><rect width="24" height="16" rx="2" fill="#1a1f71"/><circle cx="9" cy="8" r="5" fill="#eb001b"/><circle cx="15" cy="8" r="5" fill="#f79e1b" opacity="0.8"/></svg>
        </div>
      </div>

      <!-- Expiry + CVC row -->
      <div style="display:flex;gap:12px;margin-bottom:14px">
        <div style="flex:1">
          <label style="display:block;font-size:0.8rem;color:#888;margin-bottom:6px">Expiry</label>
          <input id="card-expiry" type="text" value="12/28" maxlength="5" style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid #333;background:#222;color:#fff;font-size:1rem;font-family:monospace;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:0.8rem;color:#888;margin-bottom:6px">CVC</label>
          <input id="card-cvc" type="text" value="123" maxlength="4" style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid #333;background:#222;color:#fff;font-size:1rem;font-family:monospace;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
        </div>
      </div>

      <!-- Cardholder Name -->
      <label style="display:block;font-size:0.8rem;color:#888;margin-bottom:6px">Cardholder name</label>
      <input id="card-name" type="text" placeholder="Full name on card" style="width:100%;padding:12px 14px;border-radius:8px;border:1px solid #333;background:#222;color:#fff;font-size:1rem;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
    </div>

    <!-- Order Summary -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:24px">
      <h2 style="font-size:1rem;font-weight:600;color:#fff;margin-bottom:16px">Order summary</h2>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.9rem">
        <span style="color:#aaa">Subtotal</span>
        <span id="summary-subtotal" style="color:#ccc">${currencySymbol}${subtotal.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.9rem">
        <span style="color:#aaa">Shipping</span>
        <span style="color:#ccc">${shipping === 0 ? 'Free' : currencySymbol + shipping.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:0.9rem">
        <span style="color:#aaa">Tax</span>
        <span style="color:#ccc">${currencySymbol}${tax.toFixed(2)}</span>
      </div>

      <!-- Promo Code -->
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input type="text" placeholder="Promo code" style="flex:1;padding:8px 12px;border-radius:6px;border:1px solid #333;background:#222;color:#fff;font-size:0.85rem;outline:none" onfocus="this.style.borderColor='#00ff88'" onblur="this.style.borderColor='#333'">
        <button type="button" style="padding:8px 16px;border-radius:6px;border:1px solid #333;background:#222;color:#888;font-size:0.85rem;cursor:pointer" onclick="this.textContent='Coming soon';this.style.color='#00ff88';setTimeout(()=>{this.textContent='Apply';this.style.color='#888'},2000)">Apply</button>
      </div>

      <div style="border-top:1px solid #333;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:1rem;font-weight:600;color:#fff">Total</span>
        <span id="summary-total" style="font-size:1.25rem;font-weight:700;color:#fff">${currencySymbol}${total}</span>
      </div>
    </div>

    <!-- Pay Button -->
    <button id="pay-btn" type="button" style="width:100%;padding:16px;border-radius:10px;border:none;background:linear-gradient(135deg,#00cc6a,#00ff88);color:#000;font-size:1.1rem;font-weight:700;cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 20px #00ff8840'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <span id="pay-text">Pay ${currencySymbol}${total}</span>
      <div id="pay-spinner" style="display:none;position:absolute;inset:0;background:inherit;display:none;align-items:center;justify-content:center">
        <div style="width:24px;height:24px;border:3px solid rgba(0,0,0,0.2);border-top-color:#000;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      </div>
    </button>

    <!-- Success State (hidden) -->
    <div id="success-overlay" style="display:none;position:fixed;inset:0;background:#111;z-index:2000;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px">
      <div id="checkmark-container" style="width:80px;height:80px;margin-bottom:24px">
        <svg viewBox="0 0 80 80" style="width:80px;height:80px">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#00ff88" stroke-width="3" stroke-dasharray="226" stroke-dashoffset="226" style="animation:circle-draw 0.6s ease forwards"/>
          <path d="M24 42 L35 53 L56 28" fill="none" stroke="#00ff88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="60" stroke-dashoffset="60" style="animation:check-draw 0.4s ease 0.5s forwards"/>
        </svg>
      </div>
      <h2 style="font-size:1.5rem;font-weight:700;color:#fff;margin-bottom:8px">Payment successful!</h2>
      <p id="success-order-id" style="color:#00ff88;font-size:0.9rem;margin-bottom:8px"></p>
      <p style="color:#888;font-size:0.9rem;margin-bottom:32px">Your agent has been notified. You can close this page.</p>
      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:16px 24px;display:inline-flex;align-items:center;gap:12px">
        <span style="font-size:1.5rem">${isEmoji ? productImage : '✅'}</span>
        <div style="text-align:left">
          <div style="font-size:0.95rem;font-weight:600;color:#fff">${productName}</div>
          <div id="success-total" style="font-size:0.85rem;color:#00ff88"></div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:20px;padding:16px 0">
      <span style="font-size:0.8rem;color:#555">Powered by SparkUI ⚡</span>
    </div>

    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes circle-draw {
        to { stroke-dashoffset: 0; }
      }
      @keyframes check-draw {
        to { stroke-dashoffset: 0; }
      }
      input::placeholder { color: #555; }
    </style>
  `;

  const extraHead = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      var quantity = 1;
      var unitPrice = ${productPrice};
      var shipping = ${shipping};
      var tax = ${tax};
      var symbol = '${currencySymbol}';
      var productName = ${JSON.stringify(productName)};

      var qtyDisplay = document.getElementById('qty-display');
      var summarySubtotal = document.getElementById('summary-subtotal');
      var summaryTotal = document.getElementById('summary-total');
      var payText = document.getElementById('pay-text');

      function updateTotals() {
        var sub = (unitPrice * quantity);
        var tot = (sub + shipping + tax).toFixed(2);
        summarySubtotal.textContent = symbol + sub.toFixed(2);
        summaryTotal.textContent = symbol + tot;
        payText.textContent = 'Pay ' + symbol + tot;
        qtyDisplay.textContent = quantity;
      }

      document.getElementById('qty-minus').addEventListener('click', function() {
        if (quantity > 1) { quantity--; updateTotals(); }
      });
      document.getElementById('qty-plus').addEventListener('click', function() {
        if (quantity < 99) { quantity++; updateTotals(); }
      });

      // Pay button
      document.getElementById('pay-btn').addEventListener('click', function() {
        var btn = this;
        var spinner = document.getElementById('pay-spinner');
        var text = document.getElementById('pay-text');

        // Disable + show spinner
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        text.style.visibility = 'hidden';
        spinner.style.display = 'flex';

        // Simulate processing
        setTimeout(function() {
          var orderId = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
          var sub = (unitPrice * quantity);
          var tot = (sub + shipping + tax).toFixed(2);

          // Send completion event via WS
          if (window.sparkui && sparkui.sendCompletion) {
            sparkui.sendCompletion({
              action: 'checkout_complete',
              orderId: orderId,
              product: productName,
              quantity: quantity,
              total: parseFloat(tot),
              status: 'success',
              completedAt: new Date().toISOString()
            });
          }

          // Show success
          document.getElementById('success-order-id').textContent = 'Order ' + orderId;
          document.getElementById('success-total').textContent = symbol + tot;
          var overlay = document.getElementById('success-overlay');
          overlay.style.display = 'flex';
        }, 2000);
      });
    });
    </script>
  `;

  const og = {
    title: `Secure Checkout — ${productName}`,
    description: 'Complete your purchase securely',
    image: _og.image,
    url: _og.url,
  };

  return base({
    title: `Checkout — ${productName}`,
    body,
    id: pageId,
    extraHead,
    og,
  });
}

checkout.schema = {
  type: 'object',
  description: 'Fake Stripe-style checkout page. 100% cosmetic — no real payment processing.',
  properties: {
    product: {
      type: 'object',
      description: 'Product being purchased',
      properties: {
        name: { type: 'string', description: 'Product name', example: 'Pro Plan' },
        description: { type: 'string', description: 'Product description', example: '1 year of Pro features' },
        price: { type: 'number', description: 'Unit price', example: 29.99 },
        image: { type: 'string', description: 'Emoji icon for product', example: '🚀' },
        imageUrl: { type: 'string', description: 'URL to product image (overrides image emoji)', example: 'https://example.com/product.png' },
      },
      required: ['name', 'price'],
    },
    shipping: { type: 'number', description: 'Shipping cost (0 = Free)', default: 0, example: 0 },
    tax: { type: 'number', description: 'Tax amount', default: 0, example: 2.40 },
    currency: { type: 'string', description: 'Currency code', default: 'USD', example: 'USD' },
  },
  required: ['product'],
  example: {
    product: { name: 'Pro Plan', description: 'Annual subscription', price: 99.99, image: '🚀' },
    shipping: 0,
    tax: 8.00,
    currency: 'USD',
  },
};

module.exports = checkout;
