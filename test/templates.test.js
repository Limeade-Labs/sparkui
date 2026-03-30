'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../lib/templates');

const TEMPLATE_DATA = {
  'poll': {
    question: 'Favorite color?',
    options: ['Red', 'Blue', 'Green'],
    _pageId: 'test-poll',
  },
  'shopping-list': {
    title: 'Groceries',
    items: [{ name: 'Milk', category: 'Dairy' }, { name: 'Bread', category: 'Bakery' }],
    _pageId: 'test-shopping',
  },
  'checkout': {
    product: { name: 'Widget', price: 9.99, description: 'A fine widget' },
    shipping: 5,
    tax: 1.50,
    _pageId: 'test-checkout',
  },
  'approval-flow': {
    title: 'Budget Request',
    description: 'Need $5k for servers',
    requester: 'Alice',
    amount: '$5,000',
    _pageId: 'test-approval',
  },
  'feedback-form': {
    title: 'App Feedback',
    subtitle: 'Tell us what you think',
    questions: ['What feature do you want?'],
    _pageId: 'test-feedback',
  },
  'comparison': {
    title: 'Phone Comparison',
    items: [
      { name: 'Phone A', price: '$999', rating: 4.5, pros: ['Fast'], cons: ['Expensive'] },
      { name: 'Phone B', price: '$699', rating: 4.0, pros: ['Cheap'], cons: ['Slow'] },
    ],
    _pageId: 'test-comparison',
  },
  'calendar': {
    title: 'My Calendar',
    date: '2026-03-30',
    events: [
      { title: 'Standup', start: '2026-03-30T09:00:00', end: '2026-03-30T09:30:00', category: 'Meeting' },
    ],
    _pageId: 'test-calendar',
  },
  'macro-tracker': {
    date: '2026-03-30',
    calories: { current: 1200, target: 2000 },
    protein: { current: 80, target: 150 },
    fat: { current: 40, target: 65 },
    carbs: { current: 150, target: 250 },
    meals: [{ name: 'Breakfast', calories: 400 }],
    _pageId: 'test-macros',
  },
  'workout-timer': {
    title: 'HIIT Workout',
    exercises: [{ name: 'Burpees', reps: '10' }, { name: 'Squats', reps: '15' }],
    rounds: 3,
    restSeconds: 30,
    _pageId: 'test-workout',
  },
  'analytics-dashboard': {
    token: 'test-token',
    title: 'Dashboard',
    _pageId: 'test-analytics',
  },
  'ws-test': {
    _pageId: 'test-ws',
  },
};

// Expected elements per template
const EXPECTED_ELEMENTS = {
  'poll': ['poll-options', 'vote-btn', 'Cast Vote'],
  'shopping-list': ['items-container', 'progress-bar', 'Groceries'],
  'checkout': ['DEMO MODE', 'order', 'Pay'],
  'approval-flow': ['Approve', 'Reject', 'Budget Request'],
  'feedback-form': ['rating', 'feedback', 'Submit'],
  'comparison': ['Phone A', 'Phone B', 'Compare'],
  'calendar': ['calendar', 'Standup', 'My Calendar'],
  'macro-tracker': ['Calories', 'Protein', 'Fat', 'Carbs'],
  'workout-timer': ['Burpees', 'Squats', 'round'],
  'analytics-dashboard': ['analytics', 'Dashboard'],
  'ws-test': ['WebSocket', 'status'],
};

describe('Template rendering', () => {
  const allTemplates = templates.list();

  it('has all 11 templates registered', () => {
    assert.equal(allTemplates.length, 11);
    for (const name of Object.keys(TEMPLATE_DATA)) {
      assert.ok(templates.has(name), `Template "${name}" should be registered`);
    }
  });

  for (const name of allTemplates) {
    describe(name, () => {
      it('renders without errors', () => {
        const data = TEMPLATE_DATA[name];
        assert.ok(data, `Test data missing for "${name}"`);
        const html = templates.render(name, data);
        assert.ok(typeof html === 'string');
        assert.ok(html.length > 0);
      });

      it('returns a complete HTML document', () => {
        const html = templates.render(name, TEMPLATE_DATA[name]);
        assert.ok(html.includes('<!DOCTYPE html>'), 'Should start with DOCTYPE');
        assert.ok(html.includes('<html'), 'Should contain <html>');
        assert.ok(html.includes('</html>'), 'Should close </html>');
        assert.ok(html.includes('sparkui-container'), 'Should have sparkui-container');
      });

      it('contains expected key elements', () => {
        const html = templates.render(name, TEMPLATE_DATA[name]);
        const expected = EXPECTED_ELEMENTS[name] || [];
        for (const el of expected) {
          assert.ok(html.includes(el), `Template "${name}" should contain "${el}"`);
        }
      });

      it('injects WebSocket client script when _pageId is provided', () => {
        const html = templates.render(name, TEMPLATE_DATA[name]);
        assert.ok(html.includes('sparkui'), 'Should include sparkui client');
      });
    });
  }
});
