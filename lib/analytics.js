'use strict';

/**
 * In-memory analytics store for SparkUI pages.
 * Tracks views, interactions, completions, and session durations.
 */
class AnalyticsStore {
  constructor() {
    // pageId -> analytics data
    this.data = new Map();
  }

  /**
   * Initialize analytics for a page.
   */
  init(pageId, { template, created, expires }) {
    if (this.data.has(pageId)) return;
    this.data.set(pageId, {
      pageId,
      template: template || 'unknown',
      created: created || new Date().toISOString(),
      expires: expires || null,
      views: { total: 0, unique: 0, visitors: new Set() },
      interactions: [],
      completions: [],
      totalTimeOnPage: 0,
      sessionCount: 0,
      sessions: [],
    });
  }

  /**
   * Record a page view.
   * @param {string} pageId
   * @param {string} visitorId - fingerprint hash
   */
  recordView(pageId, visitorId) {
    const a = this.data.get(pageId);
    if (!a) return;
    a.views.total++;
    if (visitorId && !a.views.visitors.has(visitorId)) {
      a.views.visitors.add(visitorId);
      a.views.unique++;
    }
  }

  /**
   * Record an interaction event.
   */
  recordInteraction(pageId, { type, element, data }) {
    const a = this.data.get(pageId);
    if (!a) return;
    a.interactions.push({
      type: type || 'unknown',
      element: element || '',
      timestamp: new Date().toISOString(),
      data: data || null,
    });
    // Cap at 1000 interactions per page to prevent memory bloat
    if (a.interactions.length > 1000) {
      a.interactions = a.interactions.slice(-500);
    }
  }

  /**
   * Record a completion event.
   */
  recordCompletion(pageId, { type, data }) {
    const a = this.data.get(pageId);
    if (!a) return;
    a.completions.push({
      type: type || 'completion',
      timestamp: new Date().toISOString(),
      data: data || null,
    });
  }

  /**
   * Record a session with time-on-page.
   */
  recordSession(pageId, { visitorId, duration, interactions }) {
    const a = this.data.get(pageId);
    if (!a) return;
    const now = new Date().toISOString();
    a.sessions.push({
      visitorId: visitorId || 'unknown',
      endTime: now,
      duration: duration || 0,
      interactions: interactions || 0,
    });
    a.totalTimeOnPage += (duration || 0);
    a.sessionCount++;
    // Cap sessions at 500
    if (a.sessions.length > 500) {
      a.sessions = a.sessions.slice(-250);
    }
  }

  /**
   * Get analytics for a specific page (serializable).
   */
  getPage(pageId) {
    const a = this.data.get(pageId);
    if (!a) return null;
    return {
      pageId: a.pageId,
      template: a.template,
      created: a.created,
      expires: a.expires,
      views: {
        total: a.views.total,
        unique: a.views.unique,
      },
      interactions: {
        total: a.interactions.length,
        recent: a.interactions.slice(-20),
        byType: this._countByType(a.interactions),
      },
      completions: {
        total: a.completions.length,
        recent: a.completions.slice(-10),
      },
      avgTimeOnPage: a.sessionCount > 0
        ? Math.round(a.totalTimeOnPage / a.sessionCount)
        : 0,
      sessions: {
        total: a.sessionCount,
        recent: a.sessions.slice(-10),
      },
      completionRate: a.views.unique > 0
        ? Math.round((a.completions.length / a.views.unique) * 10000) / 100
        : 0,
    };
  }

  /**
   * Get summary analytics across all pages.
   */
  getSummary() {
    const pages = [];
    let totalViews = 0;
    let totalUnique = 0;
    let totalInteractions = 0;
    let totalCompletions = 0;
    let totalTime = 0;
    let totalSessions = 0;

    for (const [pageId, a] of this.data) {
      totalViews += a.views.total;
      totalUnique += a.views.unique;
      totalInteractions += a.interactions.length;
      totalCompletions += a.completions.length;
      totalTime += a.totalTimeOnPage;
      totalSessions += a.sessionCount;

      pages.push({
        pageId,
        template: a.template,
        created: a.created,
        views: { total: a.views.total, unique: a.views.unique },
        interactions: a.interactions.length,
        completions: a.completions.length,
        avgTimeOnPage: a.sessionCount > 0
          ? Math.round(a.totalTimeOnPage / a.sessionCount)
          : 0,
        completionRate: a.views.unique > 0
          ? Math.round((a.completions.length / a.views.unique) * 10000) / 100
          : 0,
      });
    }

    return {
      totalPages: this.data.size,
      totalViews,
      totalUniqueVisitors: totalUnique,
      totalInteractions,
      totalCompletions,
      avgTimeOnPage: totalSessions > 0
        ? Math.round(totalTime / totalSessions)
        : 0,
      overallCompletionRate: totalUnique > 0
        ? Math.round((totalCompletions / totalUnique) * 10000) / 100
        : 0,
      pages,
    };
  }

  /**
   * Remove analytics for a page.
   */
  remove(pageId) {
    this.data.delete(pageId);
  }

  /** Count interactions by type */
  _countByType(items) {
    const counts = {};
    for (const item of items) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  }
}

module.exports = { AnalyticsStore };
