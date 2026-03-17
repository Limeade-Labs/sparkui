'use strict';

const Redis = require('ioredis');

// ── Key Patterns ─────────────────────────────────────────────────────────────
// page:state:{pageId}    — JSON string of page state data
// page:meta:{pageId}     — JSON string of page metadata (html, meta, openclaw, callback, ttl, timestamps)
// page:events:{pageId}   — Redis Stream of events for this page
// sparkui:delivery       — Redis Stream delivery queue for OpenClaw/callback forwarding
// sparkui:dead-letter    — Dead-letter stream for failed deliveries
// sparkui:push:{pageId}  — Pub/sub channel for agent→page push
// sparkui:pages          — Set of all active page IDs (for enumeration/reload)

const KEY = {
  state: (id) => `page:state:${id}`,
  meta: (id) => `page:meta:${id}`,
  events: (id) => `page:events:${id}`,
  delivery: 'sparkui:delivery',
  deadLetter: 'sparkui:dead-letter',
  push: (id) => `sparkui:push:${id}`,
  pageSet: 'sparkui:pages',
};

class RedisStore {
  constructor(opts = {}) {
    const redisUrl = opts.url || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: false,
    });
    // Separate client for pub/sub (ioredis requires dedicated connection)
    this.subClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: false,
    });
    this.client.on('error', (err) => console.error('[redis] client error:', err.message));
    this.subClient.on('error', (err) => console.error('[redis] sub client error:', err.message));
  }

  // ── Health ───────────────────────────────────────────────────────────────

  async healthCheck() {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  // ── Page State CRUD ──────────────────────────────────────────────────────

  async saveState(pageId, data) {
    const key = KEY.state(pageId);
    const payload = JSON.stringify({ data, updatedAt: Date.now() });
    await this.client.set(key, payload);
    // Inherit TTL from meta if it exists
    const metaTtl = await this.client.ttl(KEY.meta(pageId));
    if (metaTtl > 0) {
      await this.client.expire(key, metaTtl);
    }
    return true;
  }

  async loadState(pageId) {
    const raw = await this.client.get(KEY.state(pageId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async deleteState(pageId) {
    return this.client.del(KEY.state(pageId));
  }

  // ── Page Metadata ────────────────────────────────────────────────────────

  async saveMeta(pageId, meta, ttlSeconds) {
    const key = KEY.meta(pageId);
    const payload = JSON.stringify(meta);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.setex(key, ttlSeconds, payload);
    } else {
      await this.client.set(key, payload);
    }
    // Track page in active set
    await this.client.sadd(KEY.pageSet, pageId);
  }

  async loadMeta(pageId) {
    const raw = await this.client.get(KEY.meta(pageId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async deleteMeta(pageId) {
    await this.client.del(KEY.meta(pageId));
    await this.client.srem(KEY.pageSet, pageId);
  }

  /**
   * Update TTL for a page's meta and state keys.
   */
  async updateTtl(pageId, ttlSeconds) {
    if (!ttlSeconds || ttlSeconds <= 0) return;
    const pipeline = this.client.pipeline();
    pipeline.expire(KEY.meta(pageId), ttlSeconds);
    pipeline.expire(KEY.state(pageId), ttlSeconds);
    pipeline.expire(KEY.events(pageId), ttlSeconds);
    await pipeline.exec();
  }

  /**
   * Get all active page IDs (for server restart reload).
   */
  async getActivePageIds() {
    const ids = await this.client.smembers(KEY.pageSet);
    // Filter out pages whose meta has expired
    const active = [];
    for (const id of ids) {
      const exists = await this.client.exists(KEY.meta(id));
      if (exists) {
        active.push(id);
      } else {
        // Clean up stale entry
        await this.client.srem(KEY.pageSet, id);
      }
    }
    return active;
  }

  // ── Event Stream Operations ──────────────────────────────────────────────

  /**
   * Append an event to the page's event stream.
   * @returns {string} Event ID from Redis
   */
  async appendEvent(pageId, type, data) {
    const key = KEY.events(pageId);
    const eventId = await this.client.xadd(
      key, '*',
      'type', type,
      'data', JSON.stringify(data || {}),
      'pageId', pageId,
      'timestamp', String(Date.now())
    );
    // Set TTL on stream to match page meta
    const metaTtl = await this.client.ttl(KEY.meta(pageId));
    if (metaTtl > 0) {
      await this.client.expire(key, metaTtl);
    }
    return eventId;
  }

  /**
   * Read events since a given ID (or from beginning).
   * @param {string} pageId
   * @param {string} sinceId - Redis stream ID, e.g. '0-0' for all, or a specific ID
   * @param {number} count - Max events to return
   */
  async readEvents(pageId, sinceId = '0-0', count = 100) {
    const key = KEY.events(pageId);
    const results = await this.client.xrange(key, sinceId, '+', 'COUNT', count);
    return results.map(([id, fields]) => {
      const obj = {};
      for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
      }
      // Parse data back to object
      if (obj.data) {
        try { obj.data = JSON.parse(obj.data); } catch {}
      }
      if (obj.timestamp) obj.timestamp = parseInt(obj.timestamp, 10);
      obj.id = id;
      return obj;
    });
  }

  // ── Delivery Queue ───────────────────────────────────────────────────────

  /**
   * Add an event to the delivery queue for OpenClaw/callback forwarding.
   */
  async queueDelivery(pageId, type, data, deliveryMeta = {}) {
    return this.client.xadd(
      KEY.delivery, '*',
      'pageId', pageId,
      'type', type,
      'data', JSON.stringify(data || {}),
      'meta', JSON.stringify(deliveryMeta),
      'timestamp', String(Date.now()),
      'attempts', '0'
    );
  }

  /**
   * Create consumer group for delivery stream (idempotent).
   */
  async ensureDeliveryGroup(groupName = 'sparkui-workers') {
    try {
      await this.client.xgroup('CREATE', KEY.delivery, groupName, '0', 'MKSTREAM');
    } catch (err) {
      if (!err.message.includes('BUSYGROUP')) throw err;
      // Group already exists — fine
    }
  }

  /**
   * Read from delivery queue as a consumer.
   */
  async readDelivery(groupName, consumerName, count = 10, blockMs = 5000) {
    const results = await this.client.xreadgroup(
      'GROUP', groupName, consumerName,
      'COUNT', count,
      'BLOCK', blockMs,
      'STREAMS', KEY.delivery, '>'
    );
    if (!results) return [];
    // results: [[streamKey, [[id, fields], ...]]]
    const entries = results[0][1];
    return entries.map(([id, fields]) => {
      const obj = {};
      for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
      }
      if (obj.data) {
        try { obj.data = JSON.parse(obj.data); } catch {}
      }
      if (obj.meta) {
        try { obj.meta = JSON.parse(obj.meta); } catch {}
      }
      if (obj.timestamp) obj.timestamp = parseInt(obj.timestamp, 10);
      if (obj.attempts) obj.attempts = parseInt(obj.attempts, 10);
      obj.id = id;
      return obj;
    });
  }

  /**
   * Acknowledge delivery of an event.
   */
  async ackDelivery(groupName, eventId) {
    return this.client.xack(KEY.delivery, groupName, eventId);
  }

  /**
   * Move a failed event to the dead-letter stream.
   */
  async deadLetter(event, error) {
    return this.client.xadd(
      KEY.deadLetter, '*',
      'originalId', event.id,
      'pageId', event.pageId || '',
      'type', event.type || '',
      'data', JSON.stringify(event.data || {}),
      'meta', JSON.stringify(event.meta || {}),
      'error', String(error),
      'failedAt', String(Date.now())
    );
  }

  // ── Pub/Sub (Agent Push) ─────────────────────────────────────────────────

  /**
   * Publish a push message to a page's channel.
   */
  async publishPush(pageId, message) {
    const channel = KEY.push(pageId);
    return this.client.publish(channel, JSON.stringify(message));
  }

  /**
   * Subscribe to push messages for a page.
   * @param {string} pageId
   * @param {function} callback - Called with parsed message
   * @returns {function} unsubscribe function
   */
  subscribePush(pageId, callback) {
    const channel = KEY.push(pageId);
    this.subClient.subscribe(channel);

    const handler = (ch, message) => {
      if (ch !== channel) return;
      try {
        callback(JSON.parse(message));
      } catch (err) {
        console.error('[redis] push message parse error:', err.message);
      }
    };

    this.subClient.on('message', handler);

    return () => {
      this.subClient.unsubscribe(channel);
      this.subClient.removeListener('message', handler);
    };
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  /**
   * Clean up all keys for a page.
   */
  async cleanupPage(pageId) {
    const pipeline = this.client.pipeline();
    pipeline.del(KEY.state(pageId));
    pipeline.del(KEY.meta(pageId));
    pipeline.del(KEY.events(pageId));
    pipeline.srem(KEY.pageSet, pageId);
    await pipeline.exec();
  }

  /**
   * Graceful shutdown — disconnect clients.
   */
  async shutdown() {
    try { await this.subClient.quit(); } catch {}
    try { await this.client.quit(); } catch {}
  }
}

module.exports = { RedisStore, KEY };
