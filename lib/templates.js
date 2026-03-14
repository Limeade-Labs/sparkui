'use strict';

const path = require('path');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// Registry of known templates
const registry = {
  'macro-tracker': require(path.join(TEMPLATES_DIR, 'macro-tracker')),
  'ws-test': require(path.join(TEMPLATES_DIR, 'ws-test')),
  'feedback-form': require(path.join(TEMPLATES_DIR, 'feedback-form')),
  'checkout': require(path.join(TEMPLATES_DIR, 'checkout')),
  'workout-timer': require(path.join(TEMPLATES_DIR, 'workout-timer')),
};

/**
 * Render a named template with data.
 * @param {string} name - Template name (e.g. "macro-tracker")
 * @param {object} data - Template data
 * @returns {string} Rendered HTML
 * @throws {Error} if template not found
 */
function render(name, data) {
  const templateFn = registry[name];
  if (!templateFn) {
    const available = Object.keys(registry).join(', ');
    throw new Error(`Unknown template "${name}". Available: ${available}`);
  }
  return templateFn(data);
}

/**
 * Check if a template exists.
 * @param {string} name
 * @returns {boolean}
 */
function has(name) {
  return name in registry;
}

/**
 * List available template names.
 * @returns {string[]}
 */
function list() {
  return Object.keys(registry);
}

module.exports = { render, has, list };
