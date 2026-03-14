'use strict';

const DEFAULT_TTL = 3600; // 1 hour in seconds

class PageStore {
  constructor() {
    this.pages = new Map();
    // Sweep expired pages every 60s
    this._sweepInterval = setInterval(() => this._sweep(), 60_000);
    this._sweepInterval.unref();
  }

  /**
   * Store a page.
   * @param {string} id - UUID
   * @param {object} opts - { html, ttl, callbackUrl, callbackToken, meta }
   */
  set(id, { html, ttl = DEFAULT_TTL, callbackUrl, callbackToken, meta, openclaw }) {
    const expiresAt = Date.now() + ttl * 1000;
    this.pages.set(id, {
      html,
      ttl,
      expiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      callbackUrl: callbackUrl || null,
      callbackToken: callbackToken || null,
      meta: meta || {},
      openclaw: openclaw || null,
      viewCount: 0,
      lastViewedAt: null,
    });
  }

  /**
   * Get a page by id. Returns null if not found or expired.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    const page = this.pages.get(id);
    if (!page) return null;
    if (Date.now() > page.expiresAt) {
      this.pages.delete(id);
      return null;
    }
    return page;
  }

  /**
   * Update an existing page's HTML content. Resets TTL.
   * @param {string} id
   * @param {object} opts - { html, ttl }
   * @returns {boolean} true if updated, false if not found/expired
   */
  update(id, { html, ttl }) {
    const existing = this.get(id);
    if (!existing) return false;
    const newTtl = ttl ?? existing.ttl;
    existing.html = html;
    existing.ttl = newTtl;
    existing.expiresAt = Date.now() + newTtl * 1000;
    existing.updatedAt = Date.now();
    return true;
  }

  /**
   * Delete a page immediately.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    return this.pages.delete(id);
  }

  /**
   * Record a page view. Increments viewCount and updates lastViewedAt.
   * @param {string} id
   */
  recordView(id) {
    const page = this.get(id);
    if (!page) return;
    page.viewCount = (page.viewCount || 0) + 1;
    page.lastViewedAt = Date.now();
  }

  /**
   * List all pages, optionally filtered.
   * @param {object} opts - { status: 'active'|'expired'|'all', template: string }
   * @returns {Array}
   */
  list({ status = 'active', template } = {}) {
    const now = Date.now();
    const results = [];
    for (const [id, page] of this.pages) {
      const isExpired = now > page.expiresAt;
      const pageStatus = isExpired ? 'expired' : 'active';

      if (status !== 'all' && pageStatus !== status) continue;
      if (template && (page.meta && page.meta.template) !== template) continue;

      results.push({
        id,
        template: (page.meta && page.meta.template) || null,
        title: (page.meta && (page.meta.title || page.meta.og && page.meta.og.title)) || null,
        createdAt: new Date(page.createdAt).toISOString(),
        expiresAt: new Date(page.expiresAt).toISOString(),
        viewCount: page.viewCount || 0,
        lastViewedAt: page.lastViewedAt ? new Date(page.lastViewedAt).toISOString() : null,
        status: pageStatus,
      });
    }
    return results;
  }

  /**
   * Get full page details (for API, not just HTML).
   * @param {string} id
   * @returns {object|null}
   */
  getDetails(id) {
    const page = this.pages.get(id);
    if (!page) return null;
    const now = Date.now();
    const isExpired = now > page.expiresAt;
    return {
      id,
      template: (page.meta && page.meta.template) || null,
      data: (page.meta && page.meta.data) || null,
      createdAt: new Date(page.createdAt).toISOString(),
      expiresAt: new Date(page.expiresAt).toISOString(),
      updatedAt: new Date(page.updatedAt).toISOString(),
      viewCount: page.viewCount || 0,
      lastViewedAt: page.lastViewedAt ? new Date(page.lastViewedAt).toISOString() : null,
      status: isExpired ? 'expired' : 'active',
      meta: page.meta || {},
      openclaw: page.openclaw || null,
      ttl: page.ttl,
    };
  }

  /**
   * Check if a page ever existed (even if expired).
   * For distinguishing 404 vs 410.
   */
  has(id) {
    return this.pages.has(id);
  }

  /**
   * Get callback info for a page.
   * @param {string} id
   * @returns {{ callbackUrl: string|null, callbackToken: string|null }|null}
   */
  getCallback(id) {
    const page = this.get(id);
    if (!page) return null;
    return { callbackUrl: page.callbackUrl, callbackToken: page.callbackToken };
  }

  /**
   * Get OpenClaw config for a page.
   * @param {string} id
   * @returns {object|null}
   */
  getOpenclaw(id) {
    const page = this.get(id);
    if (!page) return null;
    return page.openclaw || null;
  }

  /** Sweep expired entries */
  _sweep() {
    const now = Date.now();
    for (const [id, page] of this.pages) {
      if (now > page.expiresAt) {
        this.pages.delete(id);
      }
    }
  }

  /** For graceful shutdown */
  destroy() {
    clearInterval(this._sweepInterval);
    this.pages.clear();
  }

  get size() {
    return this.pages.size;
  }
}

module.exports = { PageStore, DEFAULT_TTL };
