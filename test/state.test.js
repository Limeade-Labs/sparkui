'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../lib/templates');

// Templates that should include saveState and loadState in rendered HTML
const STATEFUL_TEMPLATES = {
  'poll': {
    question: 'Test?',
    options: ['A', 'B'],
    _pageId: 'test-poll',
  },
  'shopping-list': {
    items: [{ name: 'Milk' }],
    _pageId: 'test-shopping',
  },
  'checkout': {
    product: { name: 'Item', price: 10 },
    _pageId: 'test-checkout',
  },
  'approval-flow': {
    title: 'Request',
    _pageId: 'test-approval',
  },
  'feedback-form': {
    title: 'Feedback',
    _pageId: 'test-feedback',
  },
  'comparison': {
    items: [{ name: 'A' }, { name: 'B' }],
    _pageId: 'test-comparison',
  },
  'calendar': {
    date: '2026-03-30',
    events: [{ title: 'Event', start: '2026-03-30T10:00:00' }],
    _pageId: 'test-calendar',
  },
  'macro-tracker': {
    date: '2026-03-30',
    calories: { current: 500, target: 2000 },
    protein: { current: 30, target: 150 },
    fat: { current: 20, target: 65 },
    carbs: { current: 100, target: 250 },
    _pageId: 'test-macros',
  },
  'workout-timer': {
    title: 'Workout',
    exercises: [{ name: 'Pushups', reps: '10' }],
    _pageId: 'test-workout',
  },
};

// Templates that should NOT have state persistence
const STATELESS_TEMPLATES = ['analytics-dashboard', 'ws-test'];

describe('State persistence', () => {
  for (const [name, data] of Object.entries(STATEFUL_TEMPLATES)) {
    describe(name, () => {
      it('includes saveState call in rendered HTML', () => {
        const html = templates.render(name, data);
        assert.ok(
          html.includes('saveState'),
          `Template "${name}" should call saveState`
        );
      });

      it('includes loadState call in rendered HTML', () => {
        const html = templates.render(name, data);
        assert.ok(
          html.includes('loadState'),
          `Template "${name}" should call loadState`
        );
      });
    });
  }

  for (const name of STATELESS_TEMPLATES) {
    describe(`${name} (stateless)`, () => {
      it('is a known stateless template', () => {
        assert.ok(templates.has(name), `Template "${name}" should exist`);
        // These templates intentionally don't persist state
        // analytics-dashboard is read-only, ws-test is a demo
      });
    });
  }
});
