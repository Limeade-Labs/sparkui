'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const templates = require('../lib/templates');

describe('Property fallback tests', () => {

  describe('poll — option text fallbacks', () => {
    const variants = [
      { key: 'text', options: [{ text: 'Option A' }, { text: 'Option B' }] },
      { key: 'label', options: [{ label: 'Option A' }, { label: 'Option B' }] },
      { key: 'name', options: [{ name: 'Option A' }, { name: 'Option B' }] },
    ];

    for (const { key, options } of variants) {
      it(`renders options using "${key}" property`, () => {
        const html = templates.render('poll', {
          question: 'Test?',
          options,
          _pageId: 'test',
        });
        assert.ok(html.includes('Option A'), `Option A should render via "${key}"`);
        assert.ok(html.includes('Option B'), `Option B should render via "${key}"`);
      });
    }

    it('renders string options directly', () => {
      const html = templates.render('poll', {
        question: 'Test?',
        options: ['Alpha', 'Beta'],
        _pageId: 'test',
      });
      assert.ok(html.includes('Alpha'));
      assert.ok(html.includes('Beta'));
    });
  });

  describe('shopping-list — item name fallbacks', () => {
    const variants = [
      { key: 'name', items: [{ name: 'Apples' }] },
      { key: 'title', items: [{ title: 'Apples' }] },
      { key: 'label', items: [{ label: 'Apples' }] },
    ];

    for (const { key, items } of variants) {
      it(`renders items using "${key}" property`, () => {
        const html = templates.render('shopping-list', { items, _pageId: 'test' });
        assert.ok(html.includes('Apples'), `Item should render via "${key}"`);
      });
    }
  });

  describe('comparison — item name fallbacks', () => {
    const variants = [
      { key: 'name', items: [{ name: 'Plan A' }, { name: 'Plan B' }] },
      { key: 'title', items: [{ title: 'Plan A' }, { title: 'Plan B' }] },
      { key: 'label', items: [{ label: 'Plan A' }, { label: 'Plan B' }] },
    ];

    for (const { key, items } of variants) {
      it(`renders items using "${key}" property`, () => {
        const html = templates.render('comparison', { items, _pageId: 'test' });
        assert.ok(html.includes('Plan A'), `Item should render via "${key}"`);
        assert.ok(html.includes('Plan B'), `Item should render via "${key}"`);
      });
    }
  });

  describe('workout-timer — exercise name fallbacks', () => {
    const base = { title: 'Test', rounds: 1, restSeconds: 10, _pageId: 'test' };

    const variants = [
      { key: 'name', exercises: [{ name: 'Push-ups', reps: '10' }] },
      { key: 'title', exercises: [{ title: 'Push-ups', reps: '10' }] },
      { key: 'label', exercises: [{ label: 'Push-ups', reps: '10' }] },
    ];

    for (const { key, exercises } of variants) {
      it(`renders exercises using "${key}" property`, () => {
        const html = templates.render('workout-timer', { ...base, exercises });
        assert.ok(html.includes('Push-ups'), `Exercise should render via "${key}"`);
      });
    }
  });

  describe('checkout — product name fallbacks', () => {
    const variants = [
      { key: 'name', product: { name: 'Gadget', price: 19.99 } },
      { key: 'title', product: { title: 'Gadget', price: 19.99 } },
      { key: 'label', product: { label: 'Gadget', price: 19.99 } },
    ];

    for (const { key, product } of variants) {
      it(`renders product using "${key}" property`, () => {
        const html = templates.render('checkout', { product, _pageId: 'test' });
        assert.ok(html.includes('Gadget'), `Product should render via "${key}"`);
      });
    }
  });

  describe('calendar — event title fallbacks', () => {
    const base = { title: 'Cal', date: '2026-03-30', _pageId: 'test' };

    const variants = [
      { key: 'title', events: [{ title: 'Lunch Meeting', start: '2026-03-30T12:00:00' }] },
      { key: 'name', events: [{ name: 'Lunch Meeting', start: '2026-03-30T12:00:00' }] },
      { key: 'label', events: [{ label: 'Lunch Meeting', start: '2026-03-30T12:00:00' }] },
    ];

    for (const { key, events } of variants) {
      it(`renders events using "${key}" property`, () => {
        const html = templates.render('calendar', { ...base, events });
        assert.ok(html.includes('Lunch Meeting'), `Event should render via "${key}"`);
      });
    }
  });

  describe('feedback-form — title fallbacks', () => {
    it('uses name as fallback for title', () => {
      const html = templates.render('feedback-form', { name: 'Survey', _pageId: 'test' });
      assert.ok(html.includes('Survey'));
    });

    it('uses label as fallback for title', () => {
      const html = templates.render('feedback-form', { label: 'Survey', _pageId: 'test' });
      assert.ok(html.includes('Survey'));
    });
  });

  describe('approval-flow — title fallbacks', () => {
    it('uses name as fallback for title', () => {
      const html = templates.render('approval-flow', { name: 'Deploy Request', _pageId: 'test' });
      assert.ok(html.includes('Deploy Request'));
    });

    it('uses label as fallback for title', () => {
      const html = templates.render('approval-flow', { label: 'Deploy Request', _pageId: 'test' });
      assert.ok(html.includes('Deploy Request'));
    });
  });

  describe('analytics-dashboard — title fallbacks', () => {
    it('uses name as fallback for title', () => {
      const html = templates.render('analytics-dashboard', { name: 'My Analytics', token: 'x', _pageId: 'test' });
      assert.ok(html.includes('My Analytics'));
    });

    it('uses label as fallback for title', () => {
      const html = templates.render('analytics-dashboard', { label: 'My Analytics', token: 'x', _pageId: 'test' });
      assert.ok(html.includes('My Analytics'));
    });
  });
});
