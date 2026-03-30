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
  'poll': require(path.join(TEMPLATES_DIR, 'poll')),
  'shopping-list': require(path.join(TEMPLATES_DIR, 'shopping-list')),
  'calendar': require(path.join(TEMPLATES_DIR, 'calendar')),
  'approval-flow': require(path.join(TEMPLATES_DIR, 'approval-flow')),
  'comparison': require(path.join(TEMPLATES_DIR, 'comparison')),
  'analytics-dashboard': require(path.join(TEMPLATES_DIR, 'analytics-dashboard')),
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

/**
 * Get the JSON Schema for a template's expected data.
 * @param {string} name
 * @returns {object|null}
 */
function getSchema(name) {
  const templateFn = registry[name];
  if (!templateFn) return null;
  return templateFn.schema || null;
}

/**
 * List all templates with their schemas.
 * @returns {Array<{name: string, description: string, schema: object|null}>}
 */
function listWithSchemas() {
  return Object.keys(registry).map(name => {
    const schema = getSchema(name);
    return {
      name,
      description: schema ? schema.description || '' : '',
      schema: schema || null,
    };
  });
}

/**
 * Validate data against a template's schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * @param {string} name - Template name
 * @param {object} data - Data to validate
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validate(name, data) {
  const schema = getSchema(name);
  if (!schema) return { valid: true }; // No schema = no validation

  const errors = [];

  // Common property name aliases — templates accept these interchangeably
  const NAME_ALIASES = ['name', 'label', 'title', 'text', 'item'];

  // Check if a field or any of its aliases is present
  function hasFieldOrAlias(obj, field) {
    if (obj[field] !== undefined && obj[field] !== null) return true;
    if (NAME_ALIASES.includes(field)) {
      return NAME_ALIASES.some(alias => obj[alias] !== undefined && obj[alias] !== null);
    }
    return false;
  }

  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!hasFieldOrAlias(data, field)) {
        const prop = schema.properties && schema.properties[field];
        const desc = prop ? ` (${prop.description || prop.type})` : '';
        errors.push(`Missing required field "${field}"${desc}`);
      }
    }
  }

  // Type-check provided fields against schema properties
  if (schema.properties && data) {
    for (const [key, value] of Object.entries(data)) {
      // Skip internal fields
      if (key.startsWith('_')) continue;

      const prop = schema.properties[key];
      if (!prop) continue; // Unknown field — allow (extensible)

      if (value === null || value === undefined) continue;

      const expectedType = prop.type;
      if (!expectedType) continue;

      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (expectedType === 'array' && actualType !== 'array') {
        errors.push(`Field "${key}" should be an array, got ${actualType}`);
      } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
        errors.push(`Field "${key}" should be an object, got ${actualType}`);
      } else if (expectedType === 'number' && actualType !== 'number') {
        errors.push(`Field "${key}" should be a number, got ${actualType}`);
      } else if (expectedType === 'string' && actualType !== 'string') {
        errors.push(`Field "${key}" should be a string, got ${actualType}`);
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push(`Field "${key}" should be a boolean, got ${actualType}`);
      }

      // Validate enum values
      if (prop.enum && !prop.enum.includes(value)) {
        errors.push(`Field "${key}" must be one of: ${prop.enum.join(', ')} (got "${value}")`);
      }

      // Validate nested required fields for objects
      if (expectedType === 'object' && prop.required && actualType === 'object') {
        for (const subField of prop.required) {
          if (value[subField] === undefined || value[subField] === null) {
            const subProp = prop.properties && prop.properties[subField];
            const desc = subProp ? ` (${subProp.description || subProp.type})` : '';
            errors.push(`Missing required field "${key}.${subField}"${desc}`);
          }
        }
      }

      // Validate array items have required fields
      if (expectedType === 'array' && actualType === 'array' && prop.items) {
        const itemSchema = prop.items.type === 'object' ? prop.items : (prop.items.oneOf ? null : null);
        if (itemSchema && itemSchema.required) {
          value.forEach((item, idx) => {
            if (typeof item !== 'object' || item === null) return;
            for (const subField of itemSchema.required) {
              if (!hasFieldOrAlias(item, subField)) {
                errors.push(`Missing required field "${key}[${idx}].${subField}"`);
              }
            }
          });
        }
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

module.exports = { render, has, list, getSchema, listWithSchemas, validate };
