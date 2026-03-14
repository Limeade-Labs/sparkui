'use strict';

const base = require('./base');

/**
 * Macro Tracker template.
 *
 * @param {object} data
 * @param {string} data.date - e.g. "2026-03-10"
 * @param {object} data.calories - { current, target }
 * @param {object} data.protein - { current, target }
 * @param {object} data.fat - { current, target }
 * @param {object} data.carbs - { current, target }
 * @param {Array} [data.meals] - [{ name, calories, time }]
 * @param {string} [data._pageId] - injected by template engine
 * @returns {string} Full HTML page
 */
function macroTracker(data) {
  const { date, calories, protein, fat, carbs, meals = [], _pageId = '', _og = {} } = data;

  const macros = [
    { label: 'Calories', ...calories, unit: 'cal', color: '#00d4aa', icon: '🔥' },
    { label: 'Protein', ...protein, unit: 'g', color: '#6c63ff', icon: '💪' },
    { label: 'Fat', ...fat, unit: 'g', color: '#ff6b6b', icon: '🥑' },
    { label: 'Carbs', ...carbs, unit: 'g', color: '#ffd93d', icon: '⚡' },
  ];

  function pct(current, target) {
    if (!target) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  const macroCards = macros.map(m => {
    const p = pct(m.current, m.target);
    const isOver = m.current > m.target;
    return `
    <div class="macro-card">
      <div class="macro-header">
        <span class="macro-icon">${m.icon}</span>
        <span class="macro-label">${m.label}</span>
      </div>
      <div class="macro-value">
        <span class="macro-current" style="color:${m.color}">${m.current ?? 0}</span>
        <span class="macro-unit">${m.unit}</span>
      </div>
      <div class="macro-target">of ${m.target} ${m.unit}</div>
      <div class="progress-track">
        <div class="progress-fill ${isOver ? 'over' : ''}" style="width:${p}%;background:${m.color}"></div>
      </div>
      <div class="macro-pct">${p}%</div>
    </div>`;
  }).join('\n');

  const mealRows = meals.map(meal => `
    <div class="meal-row">
      <div class="meal-info">
        <span class="meal-name">${meal.name}</span>
        <span class="meal-time">${meal.time || ''}</span>
      </div>
      <div class="meal-cal">${meal.calories} cal</div>
    </div>`).join('\n');

  const mealSection = meals.length > 0 ? `
    <div class="section-header">
      <span class="section-icon">🍽️</span>
      <span>Meals</span>
    </div>
    <div class="meals-list">
      ${mealRows}
    </div>` : '';

  const totalCal = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const remaining = (calories.target || 0) - (calories.current || 0);

  const summaryBar = `
    <div class="summary-bar">
      <div class="summary-item">
        <div class="summary-value">${totalCal}</div>
        <div class="summary-label">Eaten</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <div class="summary-value" style="color:${remaining >= 0 ? '#00d4aa' : '#ff6b6b'}">${remaining >= 0 ? remaining : Math.abs(remaining)}</div>
        <div class="summary-label">${remaining >= 0 ? 'Remaining' : 'Over'}</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <div class="summary-value">${calories.target || 0}</div>
        <div class="summary-label">Goal</div>
      </div>
    </div>`;

  const body = `
    <div class="tracker-header">
      <h1>📊 Macro Tracker</h1>
      <div class="tracker-date">${formatDate(date)}</div>
    </div>
    ${summaryBar}
    <div class="macro-grid">
      ${macroCards}
    </div>
    ${mealSection}
    <div class="tracker-footer">
      <span class="sparkui-badge">⚡ SparkUI</span>
      <span class="update-time">Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  `;

  const extraHead = `<style>
    .tracker-header { text-align: center; margin-bottom: 24px; }
    .tracker-header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
    .tracker-date { color: #888; font-size: 0.9rem; }

    .summary-bar {
      display: flex; align-items: center; justify-content: center;
      background: #1a1a1a; border-radius: 16px; padding: 16px 20px;
      margin-bottom: 24px; gap: 20px;
    }
    .summary-item { text-align: center; flex: 1; }
    .summary-value { font-size: 1.4rem; font-weight: 700; color: #fff; }
    .summary-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .summary-divider { width: 1px; height: 36px; background: #333; }

    .macro-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      margin-bottom: 28px;
    }
    .macro-card {
      background: #1a1a1a; border-radius: 16px; padding: 16px;
      transition: transform 0.15s ease;
    }
    .macro-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .macro-icon { font-size: 1.1rem; }
    .macro-label { font-size: 0.8rem; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .macro-value { display: flex; align-items: baseline; gap: 4px; }
    .macro-current { font-size: 2rem; font-weight: 800; line-height: 1.1; }
    .macro-unit { font-size: 0.8rem; color: #666; }
    .macro-target { font-size: 0.8rem; color: #666; margin-bottom: 10px; }
    .progress-track {
      width: 100%; height: 6px; background: #2a2a2a; border-radius: 3px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; border-radius: 3px; transition: width 0.5s ease;
    }
    .progress-fill.over { opacity: 0.8; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 0.8; } 50% { opacity: 1; } }
    .macro-pct { font-size: 0.75rem; color: #666; text-align: right; margin-top: 4px; }

    .section-header {
      display: flex; align-items: center; gap: 8px;
      font-size: 1rem; font-weight: 600; margin-bottom: 12px; color: #ccc;
    }
    .section-icon { font-size: 1.1rem; }
    .meals-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
    .meal-row {
      display: flex; justify-content: space-between; align-items: center;
      background: #1a1a1a; border-radius: 12px; padding: 12px 16px;
    }
    .meal-info { display: flex; flex-direction: column; }
    .meal-name { font-weight: 500; font-size: 0.95rem; }
    .meal-time { font-size: 0.8rem; color: #666; }
    .meal-cal { font-weight: 600; color: #00d4aa; font-size: 0.95rem; white-space: nowrap; }

    .tracker-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 16px; border-top: 1px solid #222;
    }
    .sparkui-badge {
      font-size: 0.75rem; color: #555; font-weight: 500;
    }
    .update-time { font-size: 0.75rem; color: #555; }
  </style>`;

  // Template provides richer defaults than the generic ones from server.js
  const defaultDesc = `Daily macro tracking for ${formatDate(date)} — ${calories.current || 0}/${calories.target || 0} cal`;
  const isGenericDesc = !_og.description || _og.description === 'An ephemeral micro-app powered by SparkUI ⚡';
  const isGenericTitle = !_og.title || _og.title === 'Macro Tracker';

  const og = {
    title: isGenericTitle ? `Macro Tracker — ${formatDate(date)}` : _og.title,
    description: isGenericDesc ? defaultDesc : _og.description,
    image: _og.image,
    url: _og.url,
  };

  return base({
    title: `Macros — ${date}`,
    body,
    id: _pageId,
    refreshSeconds: 30,
    extraHead,
    og,
  });
}

module.exports = macroTracker;
